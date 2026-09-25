// ==========================================
// GESTÃO.JS - ERP FINANCEIRO, DASHBOARD E PROJEÇÕES
// ==========================================

let acaoConfirmacaoPendente = null;
window.tempXMLData = null; 
window.xmlItemEditIndex = null;
let compraManualItens = []; 

const categoriasPagar = ['Fornecedores / Compras', 'Impostos (DAS, ICMS, etc)', 'Salários / Folha', 'Aluguel', 'Água', 'Energia', 'Internet / Telefonia', 'Contabilidade', 'Sistema / Software', 'IPTU', 'Outras Despesas'];
const categoriasReceber = ['Vendas', 'Serviços', 'Outras Receitas'];

// Navegação suave e scroll direto para cards de relatório (Histórico de Vendas, Kardex, etc.)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if (view === 'vendas_gestao' || view === 'vendas' || window.location.hash === '#card-historico-vendas') {
        setTimeout(() => navegarParaHistoricoVendas(), 400);
    } else if (view === 'estoque' || window.location.hash === '#card-estoque-kardex') {
        setTimeout(() => { if (typeof navegarParaKardex === 'function') navegarParaKardex(); }, 400);
    }
});

function navegarParaHistoricoVendas() {
    const card = document.getElementById('card-historico-vendas');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.classList.add('ring-4', 'ring-blue-500/50');
        setTimeout(() => {
            card.classList.remove('ring-4', 'ring-blue-500/50');
        }, 2000);
    }
}
window.navegarParaHistoricoVendas = navegarParaHistoricoVendas;

function mudarVisaoLocal(viewId) {
    if (viewId === 'vendas_gestao' || viewId === 'vendas') {
        navegarParaHistoricoVendas();
    } else if (viewId === 'estoque') {
        if (typeof navegarParaKardex === 'function') navegarParaKardex();
    }
}
window.mudarVisaoLocal = mudarVisaoLocal;

async function migrarDadosSeNecessario() {
    // Desativado: rotina legada que causava loop infinito de recarregamento
    return;
}

// FIX: refreshCurrentView estava sendo chamada mas nao existia, causando ReferenceError silencioso
// que impedia o dashboard de renderizar. Agora chama renderDashboard() corretamente.
function refreshCurrentView() {
    try {
        renderDashboard();
    } catch(e) {
        console.error('Erro ao atualizar a view de relatorios:', e);
    }
}
function inicializarGestao() {
    if (window.__paginaBloqueadaPorPermissao || (typeof window.verificarPermissaoRota === 'function' && !window.verificarPermissaoRota(window.location.pathname).permitido)) {
        console.warn('Bloqueando execução: usuário sem permissão para esta rota.');
        return;
    }
    // Migração legada desativada (migrarDadosSeNecessario)

    // Cache inteligente: serve dados instantaneamente do sessionStorage
    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb, opts) {
        let ref = window.getEmpresaRef().collection(col);
        if (opts && typeof opts.query === 'function') ref = opts.query(ref);
        return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    const _listenDoc = (typeof window.fcListenDoc === 'function') ? window.fcListenDoc : function(col, id, cb) {
        return window.getEmpresaRef().collection(col).doc(id).onSnapshot(doc => cb(doc.exists ? doc.data() : null));
    };

    // Debounce para evitar renderizacoes multiplas simultaneas
    let renderTimer = null;
    function debouncedRenderDashboard() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => { if (colecoesProntas >= totalColecoes) renderDashboard(); }, 150);
    }

    // Controla quantas colecoes ja carregaram o primeiro snapshot
    let colecoesProntas = 0;
    const totalColecoes = 6;
    function tentarRefresh() {
        colecoesProntas++;
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    }

    _listen('vendas', function(dados) {
        db.vendas = dados;
        tentarRefresh(); // CORRECAO: tentarRefresh ao inves de renderDashboard direto
        debouncedRenderDashboard();
    });
    _listen('financeiro', function(dados) {
        db.financeiro = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('compras', function(dados) {
        db.compras = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('produtos', function(dados) {
        db.produtos = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('clientes', function(dados) {
        db.clientes = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('fornecedores', function(dados) {
        db.fornecedores = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('funcionarios', function(dados) {
        db.funcionarios = dados;
        // Nao conta no tentarRefresh (colecao adicional)
        debouncedRenderDashboard();
    });
    _listen('movimentacoes', function(dados) {
        db.movimentacoes = dados;
        debouncedRenderDashboard();
    }, { query: function(ref) { return ref.orderBy('data', 'desc').limit(300); } });
    // Caixa: sempre ativo pois e critico (saldo em tempo real)
    _listenDoc('caixa', 'caixa_atual', function(data) {
        db.caixa = data || { status: 'FECHADO', saldo: 0, historico: [] };
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    });

    // Inicia carregamento do historico de relatorios com IA e aplicacao de permissoes
    setTimeout(() => {
        if (typeof carregarHistoricoRelatoriosIA === 'function') carregarHistoricoRelatoriosIA();
        if (typeof aplicarControleAcessoRelatoriosPorPlano === 'function') aplicarControleAcessoRelatoriosPorPlano();
    }, 600);
}


window.addEventListener('load', () => { 
    initGlobalData(inicializarGestao); 
    setTimeout(() => {
        if (typeof carregarHistoricoRelatoriosIA === 'function') carregarHistoricoRelatoriosIA();
        if (typeof aplicarControleAcessoRelatoriosPorPlano === 'function') aplicarControleAcessoRelatoriosPorPlano();
    }, 1200);
});

function atualizarCardsFluxoDeCaixa() {
    if (!db.financeiro) return;
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const msPorDia = 24 * 60 * 60 * 1000;

    let fluxo30 = 0; let fluxo60 = 0; let fluxo90 = 0; let inadimplencia = 0;

    db.financeiro.forEach(f => {
        if (f.status === 'CANCELADO' || f.status === 'RENEGOCIADO') return;
        
        const dataVenc = new Date(f.data);
        const diasDiff = (dataVenc - hoje) / msPorDia;
        
        const valorReal = f.status === 'PAGO' ? (f.valorPago || f.valor) : f.valor;
        const sinal = (f.tipo === 'RECEITA' || !f.tipo) ? 1 : -1;

        if (f.status === 'PENDENTE' && diasDiff < 0) {
            inadimplencia += (valorReal * sinal);
        }

        if (diasDiff <= 30 && diasDiff >= -30) fluxo30 += (valorReal * sinal);
        if (diasDiff > 30 && diasDiff <= 60 && f.status === 'PENDENTE') fluxo60 += (valorReal * sinal);
        if (diasDiff > 60 && diasDiff <= 90 && f.status === 'PENDENTE') fluxo90 += (valorReal * sinal);
    });

    const f30El = document.getElementById('dash-fluxo-30');
    if(f30El) { f30El.innerText = formatMoney(fluxo30); f30El.className = `text-xl font-black mt-1 ${fluxo30 >= 0 ? 'text-blue-600' : 'text-red-600'}`; }
    
    const f60El = document.getElementById('dash-fluxo-60');
    if(f60El) { f60El.innerText = formatMoney(fluxo60); f60El.className = `text-xl font-black mt-1 ${fluxo60 >= 0 ? 'text-indigo-600' : 'text-red-600'}`; }
    
    const f90El = document.getElementById('dash-fluxo-90');
    if(f90El) { f90El.innerText = formatMoney(fluxo90); f90El.className = `text-xl font-black mt-1 ${fluxo90 >= 0 ? 'text-purple-600' : 'text-red-600'}`; }

    const inadmEl = document.getElementById('dash-inadimplencia');
    if(inadmEl) { inadmEl.innerText = formatMoney(inadimplencia); }
}

// ==========================================
// 2. MOTORES DE IMPRESSÃO E PDF (100% BLINDADOS E DEFINITIVOS)
// ==========================================

function abrirConfirmacao(titulo, mensagem, acao) { 
    document.getElementById('modal-confirm-title').innerText = titulo; 
    document.getElementById('modal-confirm-msg').innerText = mensagem; 
    acaoConfirmacaoPendente = acao; 
    document.getElementById('modal-confirmacao').classList.remove('hidden'); 
    document.getElementById('modal-confirm-btn').onclick = function() { 
        if(acaoConfirmacaoPendente) acaoConfirmacaoPendente(); 
        fecharModalConfirmacao(); 
    }; 
}

function fecharModalConfirmacao() { 
    document.getElementById('modal-confirmacao').classList.add('hidden'); 
    acaoConfirmacaoPendente = null; 
    document.getElementById('modal-confirm-btn').onclick = null; 
}


function printHtmlSeguro(htmlCompleto) {
    showToast("Preparando documento para Impressão...", "info");
    
    const printWin = window.open('', '', 'width=800,height=600');
    if (!printWin) {
        showToast("Por favor, permita popups para imprimir.", "warning");
        return;
    }
    
    const doc = printWin.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impressão</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { margin: 10mm; }
                body { font-family: Arial, sans-serif; background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .print\\\\:hidden { display: none !important; }
                table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
            </style>
        </head>
        <body class="bg-white dark:bg-slate-800 p-4">
            ${htmlCompleto}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => { 
        printWin.focus(); 
        printWin.print(); 
        printWin.close(); 
    }, 1500);
}

function imprimirArea(areaId) {
    let empNome = "Relatório Oficial do Sistema";
    if (db && db.config && db.config.empresa && db.config.empresa.nome) empNome = db.config.empresa.nome;
    let logoHtml = "";
    if (db && db.config && db.config.empresa && db.config.empresa.logo) logoHtml = `<img src="${db.config.empresa.logo}" style="max-height: 60px; margin-bottom: 10px; border-radius: 8px;">`;
    
    const element = document.getElementById(areaId);
    if(!element) return showToast("Área de impressão não encontrada.", "error");
    
    // Clona e remove relatorios bloqueados do documento impresso
    const cloneElement = element.cloneNode(true);
    cloneElement.querySelectorAll('[data-relatorio-bloqueado="true"]').forEach(n => n.remove());
    const printContent = cloneElement.innerHTML; 
    const htmlCompleto = `
        <div style="padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #000;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                ${logoHtml}
                <h2 style="font-size: 20px; font-weight: bold; margin: 5px 0; text-transform: uppercase;">${empNome}</h2>
                <p style="margin: 0; font-size: 12px; color: #555;">Documento Gerencial Oficial</p>
            </div>
            ${printContent}
        </div>
    `; 
    printHtmlSeguro(htmlCompleto);
}

function baixarPDF(areaId, filename) {
    const element = document.getElementById(areaId); 
    if(!element) return showToast("Erro: Área do PDF não encontrada.", "error");

    const printContent = element.innerHTML; 
    
    const win = window.open('', '_blank');
    if (!win) {
        return showToast("O bloqueador de pop-ups bloqueou o PDF. Permita pop-ups neste site.", "error");
    }

    win.document.open();
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${filename || 'Documento'}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { margin: 15mm; size: A4; }
                body { font-family: Arial, sans-serif; background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 20px; max-width: 1000px; margin: 0 auto; }
                .print\\:hidden { display: none !important; }
                table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
                
                @media print {
                    body { padding: 0; max-width: none; }
                }
            </style>
        </head>
        <body class="bg-white text-black">
            ${printContent}
            
            <script>
                // Executa a impressão quando tudo carregar
                setTimeout(() => {
                    window.focus();
                    window.print();
                }, 1000);
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

function downloadPDF(areaId, filename) { baixarPDF(areaId, filename); }

function exportarExcel(tabelaId, filename) {
    let table = document.getElementById(tabelaId); if(!table) return showToast('Tabela não encontrada.', 'error');
    let rows = table.querySelectorAll('tr'); let csv = [];
    for (let i = 0; i < rows.length; i++) { let row = [], cols = rows[i].querySelectorAll('td:not(.print\\:hidden), th:not(.print\\:hidden)'); for (let j = 0; j < cols.length; j++) { row.push('"' + cols[j].innerText.replace(/"/g, '""').trim() + '"'); } csv.push(row.join(';')); }
    let csvFile = new Blob(["\uFEFF"+csv.join('\n')], {type: 'text/csv;charset=utf-8;'});
    let link = document.createElement("a"); link.href = window.URL.createObjectURL(csvFile); link.setAttribute("download", filename + "_" + Date.now() + ".csv");
    document.body.appendChild(link); link.click(); showToast('Excel exportado!', 'success');
}

// ==========================================
// 3. FINANCEIRO E CAIXA FÍSICO
// ==========================================
function renderFinAbas(aba) {
    document.querySelectorAll('.fin-area').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="fin-tab-"]').forEach(el => {
        el.classList.remove('bg-blue-600', 'text-white');
        el.classList.add('text-slate-600', 'dark:text-slate-300');
    });
    document.getElementById(`fin-area-${aba}`).classList.remove('hidden');
    document.getElementById(`fin-tab-${aba}`).classList.remove('text-slate-600', 'dark:text-slate-300');
    document.getElementById(`fin-tab-${aba}`).classList.add('bg-blue-600', 'text-white');
    if(aba === 'caixa') renderCaixaDiario();
    if(aba === 'receber') renderTitulos('RECEITA');
    if(aba === 'pagar') renderTitulos('DESPESA');
    atualizarCardsFluxoDeCaixa();
}

function renderCaixaDiario() {
    document.getElementById('caixa-saldo-display').innerText = formatMoney(db.caixa.saldo); const b = document.getElementById('caixa-status-badge');
    if(db.caixa.status === 'ABERTO') { b.innerText = 'ABERTO'; b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-emerald-100 text-emerald-700 border border-emerald-300'; } else { b.innerText = 'FECHADO'; b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-red-100 text-red-700 border border-red-300'; }
    
    let dataFiltroEl = document.getElementById('filtro-data-caixa');
    let dataFiltro = dataFiltroEl ? dataFiltroEl.value : null;
    if (!dataFiltro) {
        dataFiltro = new Date().toISOString().split('T')[0];
        if (dataFiltroEl) dataFiltroEl.value = dataFiltro;
    }
    
    const movs = db.caixa.historico.filter(m => m.data && m.data.startsWith(dataFiltro));
    document.getElementById('tabela-caixa-historico').innerHTML = movs.map(m => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">${formatData(m.data).split(' ')[1]}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${m.tipo}</span></td><td class="p-3 text-slate-700 dark:text-slate-200 text-xs font-bold">${m.desc}</td><td class="p-3 text-right font-black ${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? 'text-emerald-500' : 'text-red-500'}">${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? '+ ' : '- '}${formatMoney(m.valor)}</td></tr>`).join('') || `<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem movimentos registrados para ${dataFiltro.split('-').reverse().join('/')}.</td></tr>`;
}

function abrirModalCaixa(op) {
    if(op === 'abrir' && db.caixa.status === 'ABERTO') return showToast('O caixa já está aberto!', 'error'); if(op !== 'abrir' && db.caixa.status === 'FECHADO') return showToast('Abra o caixa primeiro!', 'error');
    document.getElementById('caixa-operacao-tipo').value = op.toUpperCase(); document.getElementById('modal-caixa-title').innerText = op === 'abrir' ? 'Abertura de Caixa' : (op === 'fechar' ? 'Fechamento de Caixa' : (op === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'));
    document.getElementById('caixa-op-valor').value = ''; document.getElementById('caixa-op-desc').value = '';
    if(op === 'fechar') { document.getElementById('caixa-op-valor').value = db.caixa.saldo; document.getElementById('caixa-op-desc').value = 'Fechamento do dia'; } if(op === 'abrir') { document.getElementById('caixa-op-valor').value = 0; document.getElementById('caixa-op-desc').value = 'Troco Inicial'; }
    document.getElementById('modal-mov-caixa').classList.remove('hidden');
}
function fecharModalCaixa() { document.getElementById('modal-mov-caixa').classList.add('hidden'); }

async function confirmarMovCaixa() {
    const op = document.getElementById('caixa-operacao-tipo').value; const val = parseInputMoney(document.getElementById('caixa-op-valor').value) || 0; const desc = document.getElementById('caixa-op-desc').value || op;
    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
    let novoStatus = cxAtual.status; let novoSaldo = cxAtual.saldo || 0;

    if(op === 'ABRIR') { novoStatus = 'ABERTO'; novoSaldo = val; cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ABERTURA', desc, valor: val }); }
    else if(op === 'FECHAR') { novoStatus = 'FECHADO'; cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'FECHAMENTO', desc: `Fechamento (Retirado: ${formatMoney(val)})`, valor: val }); novoSaldo -= val; }
    else if(op === 'SANGRIA') { if(val > novoSaldo) return showToast('Saldo insuficiente para sangria!', 'error'); novoSaldo -= val; cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `SANGRIA: ${desc}`, valor: val }); }
    else if(op === 'SUPRIMENTO') { novoSaldo += val; cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `SUPRIMENTO: ${desc}`, valor: val }); }
    
    try {
        await window.getEmpresaRef().collection('caixa').doc('caixa_atual').set({ ...cxAtual, status: novoStatus, saldo: novoSaldo, historico: cxHistoricoNovo }, { merge: true });
        fecharModalCaixa(); renderCaixaDiario(); showToast('Operação realizada com sucesso!', 'success');
    } catch(err) { console.error(err); showToast('Erro ao registrar caixa.', 'error'); }
}

// ==========================================
// 4. CONTAS A PAGAR E RECEBER
// ==========================================
function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar';
    if (!document.getElementById('tabela-fin-' + prefix)) return;
    if (!db.financeiro) return;
    
    const statusFilterEl = document.getElementById('filtro-' + prefix + '-status');
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'TODOS';
    
    const periodoFilterEl = document.getElementById('filtro-' + prefix + '-periodo');
    const periodoFilter = periodoFilterEl ? periodoFilterEl.value : 'TUDO';

    const formaPagamentoFilterEl = document.getElementById('filtro-' + prefix + '-forma-pagamento');
    const formaPagamentoFilter = formaPagamentoFilterEl ? formaPagamentoFilterEl.value : '';
    
    const buscaEl = document.getElementById('busca-fin-' + prefix);
    const termoBusca = buscaEl ? buscaEl.value.toLowerCase() : '';
    
    const dataIniEl = document.getElementById('filtro-' + prefix + '-ini');
    const dataIni = dataIniEl ? dataIniEl.value : '';
    
    const dataFimEl = document.getElementById('filtro-' + prefix + '-fim');
    const dataFim = dataFimEl ? dataFimEl.value : '';
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    if (termoBusca) { 
        lista = lista.filter(f => 
            (f.pessoa && f.pessoa.toLowerCase().includes(termoBusca)) || 
            (f.ref && f.ref.toLowerCase().includes(termoBusca)) || 
            (f.categoria && f.categoria.toLowerCase().includes(termoBusca)) || 
            (f.numNF && String(f.numNF).includes(termoBusca)) || 
            (f.data && formatData(f.data).toLowerCase().includes(termoBusca))
        ); 
    }
    
    // 3. FILTRAGEM POR STATUS
    if (statusFilter !== 'TODOS') { 
        if (statusFilter === 'ATRASADO') {
            lista = lista.filter(f => f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime());
        } else if (statusFilter === 'RENEGOCIADO') {
            lista = lista.filter(f => f.status === 'RENEGOCIADO');
        } else {
            lista = lista.filter(f => f.status === statusFilter); 
        }
    }

    // 3.5 FILTRAGEM POR FORMA DE PAGAMENTO
    if (formaPagamentoFilter) {
        const fpNorm = formaPagamentoFilter.trim().toLowerCase();
        lista = lista.filter(f => {
            const metodo = (f.metodoPagamento || f.formaPagamento || f.metodo || '').trim().toLowerCase();
            if (!metodo) return false;
            if (fpNorm.includes('cart') || fpNorm.includes('crédito') || fpNorm.includes('débito')) {
                return metodo.includes('cart') || metodo.includes('credito') || metodo.includes('debito') || metodo.includes('crédito') || metodo.includes('débito');
            }
            return metodo === fpNorm || metodo.includes(fpNorm) || fpNorm.includes(metodo);
        });
    }

    // 4. FILTRO DE DATAS ESPECÍFICAS (SEMPRE RESPEITADO)
    if (dataIni) {
        lista = lista.filter(f => f.data.split('T')[0] >= dataIni);
    }
    if (dataFim) {
        lista = lista.filter(f => f.data.split('T')[0] <= dataFim);
    }

    if (periodoFilter !== 'TUDO' && !dataIni && !dataFim) {
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth();
        if (periodoFilter === 'MES') {
            const inicioMes = new Date(anoAtual, mesAtual, 1).getTime();
            const fimMes = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59).getTime();
            lista = lista.filter(f => { const t = new Date(f.data).getTime(); return t >= inicioMes && t <= fimMes; });
        } else if (periodoFilter === 'MES_ANT') {
            const inicioMesAnt = new Date(anoAtual, mesAtual - 1, 1).getTime();
            const fimMesAnt = new Date(anoAtual, mesAtual, 0, 23, 59, 59).getTime();
            lista = lista.filter(f => { const t = new Date(f.data).getTime(); return t >= inicioMesAnt && t <= fimMesAnt; });
        } else if (periodoFilter === 'ANO') {
            const inicioAno = new Date(anoAtual, 0, 1).getTime();
            const fimAno = new Date(anoAtual, 11, 31, 23, 59, 59).getTime();
            lista = lista.filter(f => { const t = new Date(f.data).getTime(); return t >= inicioAno && t <= fimAno; });
        } else {
            const limiteFuturo = hoje.getTime() + (parseInt(periodoFilter) * 24 * 60 * 60 * 1000);
            lista = lista.filter(f => new Date(f.data).getTime() <= limiteFuturo);
        }
    }
    
    if (termoNorm || pessoaFiltroVal) {
        if (typeof ordenarListaAlfabeticamente === 'function') {
            lista = ordenarListaAlfabeticamente(lista, f => f.pessoa || f.clienteNome || f.favorecido || f.sacado || f.ref || f.categoria || '');
        } else {
            lista.sort((a, b) => {
                const pA = a.pessoa || a.clienteNome || a.favorecido || a.sacado || a.ref || a.categoria || '';
                const pB = b.pessoa || b.clienteNome || b.favorecido || b.sacado || b.ref || b.categoria || '';
                return pA.localeCompare(pB, 'pt-BR', { numeric: true, sensitivity: 'base' });
            });
        }
    } else {
        lista.sort((a, b) => new Date(a.data) - new Date(b.data));
    }
    
    document.getElementById(`tabela-fin-${prefix}`).innerHTML = lista.map(f => {
        const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime(); 
        let corStatus = 'bg-amber-100 text-amber-700';
        let badgeStatus = 'PENDENTE';
        
        if (f.status === 'PAGO') { corStatus = 'bg-emerald-100 text-emerald-700'; badgeStatus = 'PAGO'; }
        else if (f.status === 'CANCELADO') { corStatus = 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'; badgeStatus = 'CANCELADO'; }
        else if (f.status === 'RENEGOCIADO') { corStatus = 'bg-purple-100 text-purple-700'; badgeStatus = 'RENEGOCIADO'; }
        else if (isAtrasado) { corStatus = 'bg-red-100 text-red-700'; badgeStatus = 'ATRASADO'; }
        
        let btnWhats = ''; 
        if(tipo === 'RECEITA') { 
            let c = db.clientes ? db.clientes.find(cli => cli.nome === f.pessoa) : null; 
            let nro = c && c.wpp ? c.wpp.replace(/\D/g, '') : (c && c.telefone ? c.telefone.replace(/\D/g, '') : ''); 
            
            if(nro) { 
                let texto = `Olá! Notamos que há um título pendente no valor de ${formatMoney(f.valor)} (Ref: ${f.ref}). Por favor, entre em contato conosco da ${db.config?.empresa?.nome || 'nossa loja'}.`; 
                if (f.status === 'PAGO') texto = `Olá! Gostaríamos de agradecer o pagamento do seu título no valor de ${formatMoney(f.valor)} (Ref: ${f.ref}). Muito obrigado!`;
                if (f.status === 'ATRASADO' || isAtrasado) texto = `Olá! Verificamos que o título no valor de ${formatMoney(f.valor)} (Ref: ${f.ref}) encontra-se em atraso. Pode nos ajudar com a previsão de pagamento?`;
                
                btnWhats = `<a href="https://wa.me/55${nro}?text=${encodeURIComponent(texto)}" target="_blank" class="text-emerald-500 hover:text-emerald-700 p-1.5 print:hidden" title="Enviar WhatsApp"><i class="fa-brands fa-whatsapp text-lg"></i></a>`; 
            } else {
                btnWhats = `<button onclick="showToast('Cliente não possui WhatsApp ou Telefone cadastrado.', 'info')" class="text-slate-300 hover:text-slate-400 p-1.5 print:hidden" title="Sem WhatsApp na Ficha"><i class="fa-brands fa-whatsapp text-lg"></i></button>`;
            }
        }

        const valorAExibir = f.status === 'PAGO' ? (f.valorPago || f.valor) : f.valor;

        let acoesExtras = '';
        if (f.status === 'PENDENTE') {
            acoesExtras = `
                <button onclick="abrirModalBaixa('${f.id}')" class="text-blue-600 bg-blue-50 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 ml-1">Baixar</button>
                <button onclick="abrirModalRenegociacao('${f.id}')" class="text-purple-600 hover:text-purple-800 p-1.5 ml-1 print:hidden" title="Renegociar / Parcelar"><i class="fa-solid fa-handshake"></i></button>
            `;
        } else if (f.status === 'PAGO') {
            acoesExtras = `<button onclick="estornarTitulo('${f.id}')" class="text-amber-500 hover:text-amber-700 p-1.5 ml-1 print:hidden" title="Estornar Pagamento"><i class="fa-solid fa-rotate-left"></i></button>`;
        }

        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
            <td class="p-3 text-slate-500 dark:text-slate-400 font-mono text-xs">${formatData(f.data).split(' ')[0]}</td>
            <td class="p-3 font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">${f.pessoa}</td>
            <td class="p-3 text-slate-600 dark:text-slate-300 text-[11px]">${f.categoria || '-'} <br><span class="font-bold">${f.ref}</span></td>
            <td class="p-3 text-right font-black ${tipo === 'RECEITA' ? 'text-blue-600' : 'text-red-500'}">${formatMoney(valorAExibir)}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${corStatus}">${badgeStatus}</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-1 print:hidden">
                <button onclick="verDetalhesTitulo('${String(f.id || '').replace(/'/g, "\\'")}')" class="text-blue-500 hover:text-blue-700 p-1.5" title="Detalhes do Título"><i class="fa-solid fa-eye"></i></button>
                <button onclick="abrirModalContaEdicao('${String(f.id || '').replace(/'/g, "\\'")}')" class="text-indigo-500 hover:text-indigo-700 p-1.5" title="Editar Lançamento"><i class="fa-solid fa-pen"></i></button>
                ${btnWhats}
                ${acoesExtras}
                <button onclick="excluirTitulo('${String(f.id || '').replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-red-500 p-1.5 ml-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum título encontrado.</td></tr>`;
}

// ==========================================

// ===== HELPER: PESSOA SELECT DROPDOWN =====
function preencherContaPessoaSelect(tipo) {
    const sel = document.getElementById('conta-pessoa-select');
    if (!sel) return;
    const lista = tipo === 'RECEBER'
        ? (db.clientes || []).map(c => c.nome || c.razaoSocial || c.nomeFantasia || '')
        : [...(db.fornecedores || []), ...(db.funcionarios || [])].map(f => f.nome || f.razaoSocial || f.nomeFantasia || f.fantasia || '');
    const unique = [...new Set(lista.filter(n => n && n.trim()))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    sel.innerHTML = '<option value="">-- Selecione um cadastrado --</option>'
        + unique.map(n => `<option value="${(typeof escapeHtml === 'function' ? escapeHtml(n) : n)}">${(typeof escapeHtml === 'function' ? escapeHtml(n) : n)}</option>`).join('')
        + '<option value="__novo__">+ Cadastrar novo...</option>';
    sel.value = '';
}

function toggleContaPessoaInput(val) {
    const wrap = document.getElementById('conta-pessoa-novo-wrap');
    const input = document.getElementById('conta-pessoa');
    if (!wrap || !input) return;
    if (val === '__novo__' || val === '' || val === '__avulso__') {
        wrap.classList.remove('hidden');
        input.value = '';
        input.focus();
    } else {
        wrap.classList.add('hidden');
        input.value = '';
    }
}

function getPessoaFinalConta() {
    const sel = document.getElementById('conta-pessoa-select');
    const input = document.getElementById('conta-pessoa');
    const selVal = sel ? sel.value : '';
    const inputVal = input ? input.value.trim() : '';
    if (selVal && selVal !== '__novo__' && selVal !== '__avulso__' && selVal !== '') return selVal;
    return inputVal;
}
// ==========================================
// 5. MODAL DE CADASTRO/EDIÇÃO DE CONTA (COM RECORRÊNCIA)
// ==========================================
function toggleRecorrencia() {
    const rec = document.getElementById('conta-recorrencia').value;
    const div = document.getElementById('div-qtd-recorrencia');
    if(rec === 'UNICA') div.classList.add('hidden');
    else div.classList.remove('hidden');
}

function abrirModalConta(tipo) {
    document.getElementById('conta-id').value = ''; 
    document.getElementById('conta-tipo').value = tipo === 'RECEBER' ? 'RECEITA' : 'DESPESA'; 
    document.getElementById('lbl-conta-pessoa').innerText = tipo === 'RECEBER' ? 'Cliente / Pagador *' : 'Fornecedor / Favorecido *';
    
    document.getElementById('conta-categoria').innerHTML = (tipo === 'RECEBER' ? categoriasReceber : categoriasPagar).map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('modal-conta-header').className = `p-4 md:p-5 text-white flex justify-between items-center shrink-0 ${tipo === 'RECEBER' ? 'bg-emerald-500' : 'bg-red-500'}`; 
    document.getElementById('modal-conta-title').innerText = tipo === 'RECEBER' ? 'Nova Conta a Receber' : 'Nova Conta a Pagar';
    
    preencherContaPessoaSelect(tipo);
    const _selEl = document.getElementById('conta-pessoa-select'); if(_selEl) _selEl.value = '';
    const _wrapEl = document.getElementById('conta-pessoa-novo-wrap'); if(_wrapEl) _wrapEl.classList.add('hidden');
    const _pessoaEl = document.getElementById('conta-pessoa'); if(_pessoaEl) _pessoaEl.value = '';

    ['ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','data-pgto','obs','anexo-base64'].forEach(id => {
        const el = document.getElementById(`conta-${id}`);
        if(el) el.value = '';
    });
    
    document.getElementById('conta-recorrencia').disabled = false;
    document.getElementById('conta-recorrencia').value = 'UNICA';
    toggleRecorrencia();
    
    document.getElementById('conta-acrescimo').value = '0';
    document.getElementById('conta-desconto').value = '0';
    document.getElementById('conta-centro-custo').value = 'Geral';
    document.getElementById('conta-banco').value = 'Caixa Físico';
    document.getElementById('conta-status').value = 'PENDENTE';
    document.getElementById('conta-metodo').value = '';
    
    calcularValorFinalFormulario();
    document.getElementById('modal-nova-conta').classList.remove('hidden');
}

function abrirModalContaEdicao(id) {
    try {
        const f = (db.financeiro || []).find(x => String(x.id).trim() === String(id).trim());
        if (!f) {
            console.warn("Lançamento financeiro não encontrado para ID:", id);
            if (typeof showToast === 'function') showToast('Lançamento não encontrado.', 'error');
            return;
        }
        
        const tipoNorm = String(f.tipo || '').toUpperCase();
        const tipo = (tipoNorm === 'RECEITA' || tipoNorm === 'RECEBER' || tipoNorm === 'ENTRADA') ? 'RECEBER' : 'PAGAR';
        
        const elId = document.getElementById('conta-id'); if (elId) elId.value = f.id;
        const elTipo = document.getElementById('conta-tipo'); if (elTipo) elTipo.value = tipo === 'RECEBER' ? 'RECEITA' : 'DESPESA';
        const elLblPessoa = document.getElementById('lbl-conta-pessoa');
        if (elLblPessoa) elLblPessoa.innerText = tipo === 'RECEBER' ? 'Cliente / Pagador *' : 'Fornecedor / Favorecido *';
        
        const elCat = document.getElementById('conta-categoria');
        if (elCat) {
            const arrCats = tipo === 'RECEBER' ? (typeof categoriasReceber !== 'undefined' ? categoriasReceber : []) : (typeof categoriasPagar !== 'undefined' ? categoriasPagar : []);
            elCat.innerHTML = arrCats.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        const elHeader = document.getElementById('modal-conta-header');
        if (elHeader) elHeader.className = `p-4 md:p-5 text-white flex justify-between items-center shrink-0 bg-indigo-600`; 
        const elTitle = document.getElementById('modal-conta-title');
        if (elTitle) elTitle.innerText = 'Editar Lançamento Financeiro';
        
        const elRec = document.getElementById('conta-recorrencia');
        if (elRec) {
            elRec.value = 'UNICA';
            elRec.disabled = true;
        }
        if (typeof toggleRecorrencia === 'function') toggleRecorrencia();

        const tipoPessoa = tipo;
        if (typeof preencherContaPessoaSelect === 'function') preencherContaPessoaSelect(tipoPessoa);
        const pessoaSelEl = document.getElementById('conta-pessoa-select');
        const pessoaWrapEl = document.getElementById('conta-pessoa-novo-wrap');
        const pessoaInputEl = document.getElementById('conta-pessoa');
        
        const nomePessoa = String(f.pessoa || f.favorecido || f.fornecedor || f.cliente || '').trim();
        
        if (pessoaSelEl) {
            const optionsArr = [...pessoaSelEl.options];
            let match = optionsArr.find(o => o.value && o.value.trim().toLowerCase() === nomePessoa.toLowerCase());
            
            if (!match && nomePessoa) {
                const normP = nomePessoa.toLowerCase();
                match = optionsArr.find(o => {
                    const optVal = (o.value || '').toLowerCase().trim();
                    if (!optVal || optVal === '__novo__' || optVal.startsWith('--')) return false;
                    return optVal.includes(normP) || normP.includes(optVal);
                });
            }

            if (match && match.value && match.value !== '__novo__') {
                pessoaSelEl.value = match.value;
                if (pessoaWrapEl) pessoaWrapEl.classList.add('hidden');
                if (pessoaInputEl) pessoaInputEl.value = '';
            } else {
                pessoaSelEl.value = '__novo__';
                if (pessoaWrapEl) pessoaWrapEl.classList.remove('hidden');
                if (pessoaInputEl) pessoaInputEl.value = nomePessoa;
            }
        } else if (pessoaInputEl) {
            pessoaInputEl.value = nomePessoa;
        }
        
        const elRef = document.getElementById('conta-ref'); if (elRef) elRef.value = f.ref || '';
        if (elCat) elCat.value = f.categoria || (tipo === 'RECEBER' ? 'Vendas' : 'Outras Despesas');
        const elCC = document.getElementById('conta-centro-custo'); if (elCC) elCC.value = f.centroCusto || 'Geral';
        const elBanco = document.getElementById('conta-banco'); if (elBanco) elBanco.value = f.contaBancaria || 'Caixa Físico';
        
        const safeDateFormat = typeof formatarDataParaInputDate === 'function' 
            ? formatarDataParaInputDate 
            : (v) => {
                if (!v) return '';
                if (typeof v === 'string') return v.split('T')[0];
                if (v && typeof v.toDate === 'function') return v.toDate().toISOString().split('T')[0];
                return '';
            };

        const elEmissao = document.getElementById('conta-emissao'); 
        if (elEmissao) elEmissao.value = safeDateFormat(f.dataEmissao || f.emissao || f.criadoEm);
        
        const elVenc = document.getElementById('conta-vencimento'); 
        if (elVenc) elVenc.value = safeDateFormat(f.data || f.dataVencimento || f.vencimento);
        
        const elCart = document.getElementById('conta-cartorio'); if (elCart) elCart.value = f.cartorioNome || '';
        const elProt = document.getElementById('conta-data-protesto'); if (elProt) elProt.value = safeDateFormat(f.dataCartorio || f.dataProtesto);
        const elMulta = document.getElementById('conta-multa'); if (elMulta) elMulta.value = f.multaPerc || '';
        const elJuros = document.getElementById('conta-juros'); if (elJuros) elJuros.value = f.jurosMesPerc || '';
        const elComp = document.getElementById('conta-competencia'); if (elComp) elComp.value = f.competencia || '';
        
        const elNF = document.getElementById('conta-num-nf'); if (elNF) elNF.value = f.numNF || '';
        const elBol = document.getElementById('conta-num-boleto'); if (elBol) elBol.value = f.numBoleto || '';
        
        const formatForInputMoney = (val) => {
            const num = (typeof parseInputMoney === 'function' ? parseInputMoney(val) : Number(val)) || 0;
            return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        
        const elVal = document.getElementById('conta-valor');
        if (elVal) elVal.value = formatForInputMoney(f.valor);
        
        const elAcresc = document.getElementById('conta-acrescimo');
        if (elAcresc) elAcresc.value = f.acrescimo ? formatForInputMoney(f.acrescimo) : '0,00';
        
        const elDesc = document.getElementById('conta-desconto');
        if (elDesc) elDesc.value = f.desconto ? formatForInputMoney(f.desconto) : '0,00';
        
        const elStatus = document.getElementById('conta-status'); if (elStatus) elStatus.value = f.status || 'PENDENTE';
        const elPgto = document.getElementById('conta-data-pgto'); if (elPgto) elPgto.value = safeDateFormat(f.dataPagamento || f.dataPgto);
        const elMetodo = document.getElementById('conta-metodo'); if (elMetodo) elMetodo.value = f.metodoPagamento || '';
        
        const elObs = document.getElementById('conta-obs'); if (elObs) elObs.value = f.observacao || '';
        const elAnexo = document.getElementById('conta-anexo-base64'); if (elAnexo) elAnexo.value = f.anexoBase64 || '';
        
        if (typeof calcularValorFinalFormulario === 'function') calcularValorFinalFormulario();
        const modal = document.getElementById('modal-nova-conta');
        if (modal) modal.classList.remove('hidden');
    } catch (err) {
        console.error("Erro em abrirModalContaEdicao:", err);
        if (typeof showToast === 'function') showToast('Erro ao abrir formulário de edição: ' + err.message, 'error');
    }
}

function calcularValorFinalFormulario() {
    const vOrig = parseInputMoney(document.getElementById('conta-valor').value) || 0;
    const acre = parseInputMoney(document.getElementById('conta-acrescimo').value) || 0;
    const desc = parseInputMoney(document.getElementById('conta-desconto').value) || 0;
    
    const vFin = vOrig + acre - desc;
    document.getElementById('conta-valor-final-display').innerText = formatMoney(vFin);
    return vFin;
}

const campoAnexo = document.getElementById('conta-anexo');
if (campoAnexo) {
    campoAnexo.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('conta-anexo-base64').value = event.target.result;
            showToast('Anexo lido e pronto para salvar!', 'success');
        };
        reader.readAsDataURL(file);
    });
}

function fecharModalConta() { document.getElementById('modal-nova-conta').classList.add('hidden'); }

function salvarConta() {
    const idExistente = document.getElementById('conta-id').value;
    const tipo = document.getElementById('conta-tipo').value; 
    const pessoa = getPessoaFinalConta(); 
    const valorOriginal = parseInputMoney(document.getElementById('conta-valor').value); 
    const vencBase = document.getElementById('conta-vencimento').value;
    
    if(!pessoa || isNaN(valorOriginal) || !vencBase) return showToast('Preencha Favorecido, Vencimento e Valor!', 'error'); 
    
    const valorFin = calcularValorFinalFormulario();
    
    const recorrencia = document.getElementById('conta-recorrencia').value;
    const isEdicao = !!idExistente;
    const qtdLancamentos = (recorrencia === 'UNICA' || isEdicao) ? 1 : (parseInt(document.getElementById('conta-qtd-recorrencia').value) || 1);
    const refBase = document.getElementById('conta-ref').value || 'Avulso';

    let contasGeradas = 0;
    const batch = firestore.batch();

    for(let i = 0; i < qtdLancamentos; i++) {
        let dataVenc = new Date(vencBase + 'T12:00:00');
        
        if (recorrencia === 'MENSAL') dataVenc.setMonth(dataVenc.getMonth() + i);
        if (recorrencia === 'ANUAL') dataVenc.setFullYear(dataVenc.getFullYear() + i);
        if (recorrencia === 'SEMANAL') dataVenc.setDate(dataVenc.getDate() + (i * 7));
        if (recorrencia === 'QUINZENAL') dataVenc.setDate(dataVenc.getDate() + (i * 15));

        let refFinal = refBase;
        if (qtdLancamentos > 1) refFinal += ` (${i+1}/${qtdLancamentos})`;

                const contaObj = {
            tipo: tipo, 
            pessoa: pessoa, 
            ref: refFinal, 
            categoria: document.getElementById('conta-categoria') ? document.getElementById('conta-categoria').value : '',
            centroCusto: document.getElementById('conta-centro-custo') ? document.getElementById('conta-centro-custo').value : '',
            contaBancaria: document.getElementById('conta-banco') ? document.getElementById('conta-banco').value : '',
            dataEmissao: document.getElementById('conta-emissao') ? document.getElementById('conta-emissao').value : '',
            data: dataVenc.toISOString(), 
            competencia: document.getElementById('conta-competencia') ? document.getElementById('conta-competencia').value : '',
            numNF: document.getElementById('conta-num-nf') ? document.getElementById('conta-num-nf').value : '',
            numBoleto: document.getElementById('conta-num-boleto') ? document.getElementById('conta-num-boleto').value : '',
            valor: valorOriginal, 
            acrescimo: parseInputMoney(document.getElementById('conta-acrescimo') ? document.getElementById('conta-acrescimo').value : 0) || 0,
            desconto: parseInputMoney(document.getElementById('conta-desconto') ? document.getElementById('conta-desconto').value : 0) || 0,
            valorPago: valorFin,
            status: document.getElementById('conta-status') ? document.getElementById('conta-status').value : 'PENDENTE',
            dataPagamento: (document.getElementById('conta-data-pgto') && document.getElementById('conta-data-pgto').value) ? new Date(document.getElementById('conta-data-pgto').value + 'T12:00:00').toISOString() : '',
            metodoPagamento: document.getElementById('conta-metodo') ? document.getElementById('conta-metodo').value : '',
            observacao: document.getElementById('conta-obs') ? document.getElementById('conta-obs').value : '',
            anexoBase64: document.getElementById('conta-anexo-base64') ? document.getElementById('conta-anexo-base64').value : '',
            ultimaAlteracao: Date.now()
        };

        if (isEdicao) {
            const ref = window.getEmpresaRef().collection('financeiro').doc(String(idExistente));
            batch.set(ref, contaObj, { merge: true });
        } else {
            const ref = window.getEmpresaRef().collection('financeiro').doc();
            batch.set(ref, contaObj);
            contasGeradas++;
        }
    }

    // Auto-register new fornecedor/cliente if typed manually
    const _selFinal = document.getElementById('conta-pessoa-select');
    const _inpFinal = document.getElementById('conta-pessoa');
    const _selValFinal = _selFinal ? _selFinal.value : '';
    const _inpValFinal = _inpFinal ? _inpFinal.value.trim() : '';
    const tipoContaFinal = document.getElementById('conta-tipo').value;
    if (_selValFinal === '__novo__' && _inpValFinal) {
        if (tipoContaFinal === 'DESPESA') {
            if (!(db.fornecedores || []).find(f => f.nome && f.nome.toLowerCase() === _inpValFinal.toLowerCase())) {
                const _fRef = window.getEmpresaRef().collection('fornecedores').doc();
                batch.set(_fRef, { nome: _inpValFinal, doc: '', cnpj: '', telefone: '' });
            }
        } else {
            if (!(db.clientes || []).find(c => (c.nome||c.razaoSocial||'').toLowerCase() === _inpValFinal.toLowerCase())) {
                const _cRef = window.getEmpresaRef().collection('clientes').doc();
                batch.set(_cRef, { nome: _inpValFinal, telefone: '', email: '', doc: '' });
            }
        }
    }

    batch.commit().then(() => {
        fecharModalConta(); 
        renderFinAbas(tipo === 'RECEITA' ? 'receber' : 'pagar'); 
        
        if (isEdicao) {
            showToast('Título Atualizado!', 'success');
        } else {
            if (qtdLancamentos > 1) showToast(`${contasGeradas} Títulos gerados!`, 'success');
            else showToast('Título Salvo!', 'success');
        }
    }).catch(e => {
        console.error(e);
        showToast('Erro ao salvar conta.', 'error');
    });
}

function excluirTitulo(id) { 
    abrirConfirmacao('Excluir Título', 'Deseja apagar permanentemente?', () => { 
        const tit = db.financeiro.find(f => String(f.id) === String(id)); 
        window.getEmpresaRef().collection('financeiro').doc(String(id)).delete().then(() => {
            if(tit) renderFinAbas(tit.tipo === 'RECEITA' ? 'receber' : 'pagar'); 
            showToast('Excluído!'); 
        }).catch(e => { console.error(e); showToast('Erro', 'error'); });
    }); 
}

async function estornarTitulo(id) {
    const f = db.financeiro.find(x => String(x.id) === String(id));
    if (!f || f.status !== 'PAGO') return;

    abrirConfirmacao('Estornar Pagamento', 'Voltará para PENDENTE e reverterá o caixa.', async () => {
        const batch = firestore.batch();
        if (f.metodoPagamento === 'Dinheiro') {
            let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
            let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
            let cxSaldoNovo = cxAtual.saldo || 0;
            
            if (f.tipo === 'RECEITA') {
                cxSaldoNovo -= f.valorPago;
                cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno: ${f.pessoa}`, valor: f.valorPago });
            } else {
                cxSaldoNovo += f.valorPago;
                cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `Estorno: ${f.pessoa}`, valor: f.valorPago });
            }
            batch.set(window.getEmpresaRef().collection('caixa').doc('caixa_atual'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
        }
        
        const finRef = window.getEmpresaRef().collection('financeiro').doc(String(id));
        batch.update(finRef, { status: 'PENDENTE', dataPagamento: '', metodoPagamento: '', ultimaAlteracao: Date.now() });
        
        try {
            await batch.commit();
            renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Estornado!', 'success');
        } catch(e) { console.error(e); showToast('Erro', 'error'); }
    });
}

let renegociacaoAtual = null;

function abrirModalRenegociacao(id) {
    const f = (db.financeiro || []).find(x => String(x.id) === String(id));
    if (!f) return showToast('Título não encontrado.', 'error');

    renegociacaoAtual = { ...f };

    const isReceber = (f.tipo === 'RECEITA' || !f.tipo);
    const idEl = document.getElementById('reneg-id');
    const badgeTipo = document.getElementById('reneg-badge-tipo');
    const subtitulo = document.getElementById('reneg-tipo-subtitulo');
    const pessoaEl = document.getElementById('reneg-pessoa');
    const refEl = document.getElementById('reneg-ref');
    const valOrigEl = document.getElementById('reneg-valor-original');
    const vencOrigEl = document.getElementById('reneg-venc-original');
    const modalEl = document.getElementById('modal-renegociacao');

    if (idEl) idEl.value = f.id;
    if (badgeTipo) {
        badgeTipo.innerText = isReceber ? 'Conta a Receber (Cliente)' : 'Conta a Pagar (Dívida / Fornecedor)';
        badgeTipo.className = isReceber 
            ? 'px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' 
            : 'px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300';
    }
    if (subtitulo) {
        subtitulo.innerText = isReceber ? 'Negociação de Recebimento de Cliente' : 'Renegociação de Dívida / Pagamento a Fornecedor';
    }
    if (pessoaEl) pessoaEl.innerText = f.pessoa || 'Sem Favorecido';
    if (refEl) refEl.innerText = `Ref: ${f.ref || 'Título'} | Categoria: ${f.categoria || 'Geral'}`;
    
    const valorOriginal = Number(f.valor || 0);
    if (valOrigEl) valOrigEl.innerText = formatMoney(valorOriginal);
    if (vencOrigEl) {
        vencOrigEl.innerText = `Venc. Original: ${f.data ? formatData(f.data).split(' ')[0] : '--/--/----'}`;
    }

    const jurosEl = document.getElementById('reneg-juros');
    const descEl = document.getElementById('reneg-desconto');
    const entradaEl = document.getElementById('reneg-entrada');
    const qtdEl = document.getElementById('reneg-qtd');
    const intervaloEl = document.getElementById('reneg-intervalo');
    const dataPrimeiraEl = document.getElementById('reneg-data-primeira');
    const obsEl = document.getElementById('reneg-obs');

    if (jurosEl) jurosEl.value = '0.00';
    if (descEl) descEl.value = '0.00';
    if (entradaEl) entradaEl.value = '0.00';
    if (qtdEl) qtdEl.value = '2';
    if (intervaloEl) intervaloEl.value = '30';
    
    const dIni = new Date();
    dIni.setDate(dIni.getDate() + 30);
    if (dataPrimeiraEl) dataPrimeiraEl.value = dIni.toISOString().split('T')[0];
    if (obsEl) obsEl.value = '';

    recalcularTotaisRenegociacao();
    if (modalEl) modalEl.classList.remove('hidden');
}

function fecharModalRenegociacao() {
    const modalEl = document.getElementById('modal-renegociacao');
    if (modalEl) modalEl.classList.add('hidden');
    renegociacaoAtual = null;
}

function recalcularTotaisRenegociacao() {
    if (!renegociacaoAtual) return;
    
    const valorOriginal = Number(renegociacaoAtual.valor || 0);
    const juros = parseFloat(document.getElementById('reneg-juros')?.value) || 0;
    const desconto = parseFloat(document.getElementById('reneg-desconto')?.value) || 0;
    const entrada = parseFloat(document.getElementById('reneg-entrada')?.value) || 0;

    const totalRenegociado = Math.max(0, valorOriginal + juros - desconto);
    const saldoAParcelar = Math.max(0, totalRenegociado - entrada);

    const totalEl = document.getElementById('reneg-novo-total');
    if (totalEl) totalEl.innerText = formatMoney(totalRenegociado);

    const saldoDisplay = document.getElementById('reneg-saldo-parcelar-display');
    if (saldoDisplay) saldoDisplay.innerText = formatMoney(saldoAParcelar);

    gerarPreviewParcelasRenegociacao();
}

function gerarPreviewParcelasRenegociacao() {
    if (!renegociacaoAtual) return;

    const valorOriginal = Number(renegociacaoAtual.valor || 0);
    const juros = parseFloat(document.getElementById('reneg-juros')?.value) || 0;
    const desconto = parseFloat(document.getElementById('reneg-desconto')?.value) || 0;
    const entrada = parseFloat(document.getElementById('reneg-entrada')?.value) || 0;

    const totalRenegociado = Math.max(0, valorOriginal + juros - desconto);
    const saldoAParcelar = Math.max(0, totalRenegociado - entrada);

    const qtdEl = document.getElementById('reneg-qtd');
    let qtd = parseInt(qtdEl ? qtdEl.value : '1') || 1;
    if (qtd < 1) qtd = 1;
    if (qtd > 48) qtd = 48;
    if (qtdEl) qtdEl.value = qtd;

    const intervaloDias = parseInt(document.getElementById('reneg-intervalo')?.value || '30');
    const dataPrimeiraStr = document.getElementById('reneg-data-primeira')?.value;
    
    let baseDate = dataPrimeiraStr ? new Date(dataPrimeiraStr + 'T12:00:00') : new Date();
    if (isNaN(baseDate.getTime())) baseDate = new Date();

    const tbody = document.getElementById('reneg-tabela-parcelas');
    if (!tbody) return;
    tbody.innerHTML = '';

    const valorBaseParcela = Math.floor((saldoAParcelar / qtd) * 100) / 100;
    let restoCentavos = Math.round((saldoAParcelar - (valorBaseParcela * qtd)) * 100) / 100;

    for (let i = 0; i < qtd; i++) {
        let vencimento = new Date(baseDate);
        if (intervaloDias === 30) {
            vencimento.setMonth(vencimento.getMonth() + i);
        } else {
            vencimento.setDate(vencimento.getDate() + (i * intervaloDias));
        }

        let valParcela = valorBaseParcela;
        if (i === 0) {
            valParcela = Math.round((valParcela + restoCentavos) * 100) / 100;
        }

        const dataVencIso = vencimento.toISOString().split('T')[0];
        const numParcela = `${i + 1}/${qtd}`;

        tbody.innerHTML += `
            <tr class="dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700/60">
                <td class="p-2.5 text-center font-bold text-slate-500 dark:text-slate-400">${numParcela}</td>
                <td class="p-2.5">
                    <input type="date" value="${dataVencIso}" class="reneg-item-data w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-purple-500">
                </td>
                <td class="p-2.5 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <span class="text-[11px] text-slate-400 font-bold">R$</span>
                        <input type="number" step="0.01" min="0" value="${valParcela.toFixed(2)}" oninput="validarSomaParcelasManual()" class="reneg-item-valor w-28 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-1.5 rounded-lg text-xs font-black text-slate-900 dark:text-white outline-none focus:border-purple-500 text-right">
                    </div>
                </td>
                <td class="p-2.5">
                    <input type="text" placeholder="Obs / Cheque / Ref..." value="${renegociacaoAtual.ref || ''} (${numParcela})" class="reneg-item-obs w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-purple-500">
                </td>
            </tr>
        `;
    }

    validarSomaParcelasManual();
}

function validarSomaParcelasManual() {
    if (!renegociacaoAtual) return;

    const valorOriginal = Number(renegociacaoAtual.valor || 0);
    const juros = parseFloat(document.getElementById('reneg-juros')?.value) || 0;
    const desconto = parseFloat(document.getElementById('reneg-desconto')?.value) || 0;
    const entrada = parseFloat(document.getElementById('reneg-entrada')?.value) || 0;

    const totalRenegociado = Math.max(0, valorOriginal + juros - desconto);
    const saldoAParcelar = Math.max(0, totalRenegociado - entrada);

    const valorInputs = document.querySelectorAll('.reneg-item-valor');
    let soma = 0;
    valorInputs.forEach(inp => {
        soma += parseFloat(inp.value) || 0;
    });
    soma = Math.round(soma * 100) / 100;

    const somaDisplay = document.getElementById('reneg-soma-parcelas-display');
    if (somaDisplay) somaDisplay.innerText = formatMoney(soma);

    const alerta = document.getElementById('reneg-alerta-diferenca');
    const alertaTexto = document.getElementById('reneg-diferenca-texto');
    const dif = Math.round((soma - saldoAParcelar) * 100) / 100;

    if (Math.abs(dif) > 0.01) {
        if (alerta) alerta.classList.remove('hidden');
        if (alertaTexto) {
            alertaTexto.innerText = dif > 0 
                ? `Soma ultrapassa o saldo em ${formatMoney(Math.abs(dif))}` 
                : `Faltam ${formatMoney(Math.abs(dif))} para atingir o saldo`;
        }
    } else {
        if (alerta) alerta.classList.add('hidden');
    }
}

function ajustarDiferencaUltimaParcela() {
    if (!renegociacaoAtual) return;

    const valorOriginal = Number(renegociacaoAtual.valor || 0);
    const juros = parseFloat(document.getElementById('reneg-juros')?.value) || 0;
    const desconto = parseFloat(document.getElementById('reneg-desconto')?.value) || 0;
    const entrada = parseFloat(document.getElementById('reneg-entrada')?.value) || 0;

    const totalRenegociado = Math.max(0, valorOriginal + juros - desconto);
    const saldoAParcelar = Math.max(0, totalRenegociado - entrada);

    const valorInputs = Array.from(document.querySelectorAll('.reneg-item-valor'));
    if (valorInputs.length === 0) return;

    let somaExcetoUltima = 0;
    for (let i = 0; i < valorInputs.length - 1; i++) {
        somaExcetoUltima += parseFloat(valorInputs[i].value) || 0;
    }

    const valorUltima = Math.max(0, Math.round((saldoAParcelar - somaExcetoUltima) * 100) / 100);
    valorInputs[valorInputs.length - 1].value = valorUltima.toFixed(2);
    validarSomaParcelasManual();
}

async function confirmarRenegociacaoAvancada() {
    if (!renegociacaoAtual) return showToast('Nenhum título selecionado para renegociação.', 'error');
    const idOriginal = renegociacaoAtual.id;
    const fOriginal = (db.financeiro || []).find(x => String(x.id) === String(idOriginal)) || renegociacaoAtual;

    const juros = parseFloat(document.getElementById('reneg-juros')?.value) || 0;
    const desconto = parseFloat(document.getElementById('reneg-desconto')?.value) || 0;
    const entrada = parseFloat(document.getElementById('reneg-entrada')?.value) || 0;
    const entradaForma = document.getElementById('reneg-entrada-forma')?.value || 'PIX';
    const entradaConta = document.getElementById('reneg-entrada-conta')?.value || 'Caixa Físico';
    const obsAcordo = document.getElementById('reneg-obs')?.value.trim() || '';

    const datasInp = Array.from(document.querySelectorAll('.reneg-item-data'));
    const valoresInp = Array.from(document.querySelectorAll('.reneg-item-valor'));
    const obsInp = Array.from(document.querySelectorAll('.reneg-item-obs'));

    if (valoresInp.length === 0 && entrada <= 0) {
        return showToast('Informe ao menos uma parcela ou valor de entrada.', 'error');
    }

    const parcelas = [];
    let somaParcelas = 0;

    for (let i = 0; i < valoresInp.length; i++) {
        const val = parseFloat(valoresInp[i].value) || 0;
        const dt = datasInp[i] ? datasInp[i].value : '';
        const obsP = obsInp[i] ? obsInp[i].value.trim() : '';

        if (!dt) return showToast(`Preencha a data da parcela ${i + 1}.`, 'error');
        if (val <= 0) return showToast(`O valor da parcela ${i + 1} deve ser maior que zero.`, 'error');

        somaParcelas += val;
        parcelas.push({
            numero: i + 1,
            totalParcelas: valoresInp.length,
            dataVencimento: dt,
            valor: val,
            obs: obsP
        });
    }

    const valorOriginal = Number(fOriginal.valor || 0);
    const totalRenegociado = Math.max(0, valorOriginal + juros - desconto);
    const saldoAParcelar = Math.max(0, totalRenegociado - entrada);

    const dif = Math.abs(Math.round((somaParcelas - saldoAParcelar) * 100) / 100);
    if (dif > 0.05) {
        return showToast(`A soma das parcelas difere do saldo a parcelar. Corrija antes de salvar.`, 'warning');
    }

    const btnConfirmar = document.getElementById('reneg-btn-confirmar');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
        const batch = firestore.batch();
        const agoraIso = new Date().toISOString();
        const hojeBr = new Date().toLocaleDateString('pt-BR');
        const tipoOriginal = fOriginal.tipo || 'DESPESA';
        const pessoaOriginal = fOriginal.pessoa || fOriginal.clienteNome || 'Sem Favorecido';

        const refOriginalDoc = window.getEmpresaRef().collection('financeiro').doc(String(idOriginal));
        const historicoTexto = `\n[Renegociado em ${hojeBr}: ${entrada > 0 ? `Entrada ${formatMoney(entrada)} + ` : ''}${parcelas.length}x. Acordo: ${obsAcordo || 'N/A'}]`;

        batch.update(refOriginalDoc, {
            status: 'RENEGOCIADO',
            observacao: (fOriginal.observacao || '') + historicoTexto,
            renegociadoEm: agoraIso,
            renegociacaoJuros: juros,
            renegociacaoDesconto: desconto,
            renegociacaoEntrada: entrada,
            renegociacaoQtdParcelas: parcelas.length,
            ultimaAlteracao: Date.now()
        });

        if (entrada > 0) {
            const refEntrada = window.getEmpresaRef().collection('financeiro').doc();
            batch.set(refEntrada, {
                tipo: tipoOriginal,
                pessoa: pessoaOriginal,
                clienteId: fOriginal.clienteId || null,
                fornecedorId: fOriginal.fornecedorId || null,
                ref: `${fOriginal.ref || 'Título'} (Entrada Renegociação)`,
                categoria: fOriginal.categoria || 'Renegociação',
                centroCusto: fOriginal.centroCusto || 'Operacional',
                contaBancaria: entradaConta,
                formaPagamento: entradaForma,
                metodoPagamento: entradaForma,
                data: agoraIso,
                dataPagamento: agoraIso,
                valor: entrada,
                valorPago: entrada,
                status: 'PAGO',
                origemRenegociacaoId: String(idOriginal),
                observacao: `Entrada da renegociação do título ${fOriginal.ref || idOriginal}. ${obsAcordo}`.trim(),
                criadoEm: agoraIso,
                ultimaAlteracao: Date.now()
            });
        }

        parcelas.forEach(p => {
            const refParcela = window.getEmpresaRef().collection('financeiro').doc();
            const dataParcelaIso = new Date(p.dataVencimento + 'T12:00:00').toISOString();

            batch.set(refParcela, {
                tipo: tipoOriginal,
                pessoa: pessoaOriginal,
                clienteId: fOriginal.clienteId || null,
                fornecedorId: fOriginal.fornecedorId || null,
                ref: p.obs || `${fOriginal.ref || 'Título'} (Reneg. ${p.numero}/${p.totalParcelas})`,
                categoria: fOriginal.categoria || 'Renegociação',
                centroCusto: fOriginal.centroCusto || 'Operacional',
                contaBancaria: fOriginal.contaBancaria || 'Caixa Físico',
                data: dataParcelaIso,
                valor: p.valor,
                status: 'PENDENTE',
                origemRenegociacaoId: String(idOriginal),
                parcelaNumero: p.numero,
                parcelaTotal: p.totalParcelas,
                observacao: `Parcela ${p.numero}/${p.totalParcelas} da renegociação do título ${fOriginal.ref || idOriginal}. ${obsAcordo}`.trim(),
                criadoEm: agoraIso,
                ultimaAlteracao: Date.now()
            });
        });

        await batch.commit();

        fecharModalRenegociacao();
        showToast(`Título renegociado com sucesso em ${entrada > 0 ? 'Entrada + ' : ''}${parcelas.length} parcelas!`, 'success');
        renderFinAbas(tipoOriginal === 'RECEITA' ? 'receber' : 'pagar');

    } catch (err) {
        console.error('Erro ao salvar renegociação:', err);
        showToast('Erro ao gravar renegociação no banco de dados.', 'error');
    } finally {
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

window.abrirModalRenegociacao = abrirModalRenegociacao;
window.fecharModalRenegociacao = fecharModalRenegociacao;
window.recalcularTotaisRenegociacao = recalcularTotaisRenegociacao;
window.gerarPreviewParcelasRenegociacao = gerarPreviewParcelasRenegociacao;
window.validarSomaParcelasManual = validarSomaParcelasManual;
window.ajustarDiferencaUltimaParcela = ajustarDiferencaUltimaParcela;
window.confirmarRenegociacaoAvancada = confirmarRenegociacaoAvancada;
window.confirmarRenegociacao = confirmarRenegociacaoAvancada;

function verDetalhesTitulo(id) {
    const f = db.financeiro.find(x => x.id === id); if(!f) return; const isReceita = f.tipo === 'RECEITA' || !f.tipo;
    document.getElementById('det-tit-header').className = `p-4 md:p-5 text-white flex justify-between items-center ${isReceita ? 'bg-blue-600' : 'bg-red-600'}`; document.getElementById('det-tit-lbl-pessoa').innerText = isReceita ? 'Cliente / Pagador' : 'Fornecedor / Favorecido'; document.getElementById('det-tit-pessoa').innerText = f.pessoa || 'Não informado';
    const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime(); const badge = document.getElementById('det-tit-status'); badge.innerText = f.status === 'PAGO' ? 'PAGO' : (isAtrasado ? 'ATRASADO' : 'PENDENTE'); badge.className = `mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${f.status === 'PAGO' ? 'bg-emerald-100 text-emerald-700' : (isAtrasado ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}`;
    document.getElementById('det-tit-venc').innerText = formatData(f.data).split(' ')[0]; document.getElementById('det-tit-valor-orig').innerText = formatMoney(f.valor); document.getElementById('det-tit-ref').innerText = f.ref || '-'; document.getElementById('det-tit-cat').innerText = f.categoria || '-';
    const areaPgto = document.getElementById('det-tit-area-pagamento');
    if(f.status === 'PAGO') { areaPgto.classList.remove('hidden'); document.getElementById('det-tit-dtpag').innerText = f.dataPagamento ? formatData(f.dataPagamento).split(' ')[0] : '-'; document.getElementById('det-tit-metodo').innerText = f.metodoPagamento || '-'; document.getElementById('det-tit-valfinal').innerText = formatMoney(f.valorPago || f.valor); } else { areaPgto.classList.add('hidden'); }
    document.getElementById('modal-detalhes-titulo').classList.remove('hidden');
}
function fecharModalDetalhesTitulo() { document.getElementById('modal-detalhes-titulo').classList.add('hidden'); }

function abrirModalBaixa(id) { const f = db.financeiro.find(x => x.id === id); if(!f) return; document.getElementById('baixa-id').value = f.id; document.getElementById('baixa-valor-original').innerText = formatMoney(f.valor); document.getElementById('baixa-vencimento').innerText = formatData(f.data).split(' ')[0]; document.getElementById('baixa-acrescimo').value = 0; document.getElementById('baixa-desconto').value = 0; calcularAcrescimos(); document.getElementById('modal-baixa-conta').classList.remove('hidden'); }
function fecharModalBaixa() { document.getElementById('modal-baixa-conta').classList.add('hidden'); }
function calcularAcrescimos() { const id = parseInt(document.getElementById('baixa-id').value); const f = db.financeiro.find(x => x.id === id); if(!f) return; const ac = parseInputMoney(document.getElementById('baixa-acrescimo').value) || 0; const de = parseInputMoney(document.getElementById('baixa-desconto').value) || 0; const vf = f.valor + ac - de; document.getElementById('baixa-valor-final').innerText = formatMoney(vf); return vf; }

async function confirmarBaixa() {
    const id = parseInt(document.getElementById('baixa-id').value); const f = db.financeiro.find(x => String(x.id) === String(id)); if(!f) return;
    const vf = calcularAcrescimos(); const metodo = document.getElementById('baixa-metodo').value;
    const batch = firestore.batch();
    
    if(metodo === 'Dinheiro') {
        let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
        let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
        let cxSaldoNovo = cxAtual.saldo || 0;
        
        if(cxAtual.status !== 'ABERTO') return showToast('Abra o Caixa Físico primeiro!', 'error');
        if(f.tipo === 'RECEITA') { cxSaldoNovo += vf; cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `Recbto. Título: ${f.pessoa}`, valor: vf }); } 
        else { if(vf > cxSaldoNovo) return showToast('Saldo do Caixa insuficiente!', 'error'); cxSaldoNovo -= vf; cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Pgto. Título: ${f.pessoa}`, valor: vf }); }
        
        batch.set(window.getEmpresaRef().collection('caixa').doc('caixa_atual'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
    }
    
    const finRef = window.getEmpresaRef().collection('financeiro').doc(String(id));
    batch.update(finRef, { status: 'PAGO', valorPago: vf, metodoPagamento: metodo, dataPagamento: new Date().toISOString(), ultimaAlteracao: Date.now() });
    
    try {
        await batch.commit();
        fecharModalBaixa(); renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Baixado com sucesso!', 'success');
    } catch(e) { console.error(e); showToast('Erro', 'error'); }
}

// ==========================================
// 8. COMPRAS E LEITURA DE XML / CT-E
// ==========================================
function processarXMLReal(event) {
    const file = event.target.files[0]; if(!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new DOMParser(); const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
            const getFloatSafe = (context, tag) => { const node = context ? context.getElementsByTagName(tag)[0] : null; return node && node.textContent ? parseInputMoney(node.textContent) : 0; };
            const getStringSafe = (context, tag) => { const node = context ? context.getElementsByTagName(tag)[0] : null; return node ? node.textContent : ''; };
            const emit = xmlDoc.getElementsByTagName("emit")[0]; if(!emit) throw new Error("XML inválido.");
            
            const fornNome = getStringSafe(emit, "xNome"); const fornCNPJ = getStringSafe(emit, "CNPJ"); const totalNF = getFloatSafe(xmlDoc, "vNF");
            const numNF = getStringSafe(xmlDoc.getElementsByTagName("ide")[0], "nNF") || "S/N";
            const dataEmissao = getStringSafe(xmlDoc.getElementsByTagName("ide")[0], "dhEmi").split('T')[0] || new Date().toISOString().split('T')[0];

            const detNodes = xmlDoc.getElementsByTagName("det"); const produtosXML = [];
            
            for(let i=0; i<detNodes.length; i++) {
                const prod = detNodes[i].getElementsByTagName("prod")[0]; const imposto = detNodes[i].getElementsByTagName("imposto")[0];
                const nome = getStringSafe(prod, "xProd"); const cEAN = getStringSafe(prod, "cEAN");
                const vProd = getFloatSafe(prod, "vProd"); const qCom = getFloatSafe(prod, "qCom");
                const vFrete = getFloatSafe(prod, "vFrete"); const vDesc = getFloatSafe(prod, "vDesc");
                const vIPI = getFloatSafe(imposto, "vIPI"); const vICMSST = getFloatSafe(imposto, "vICMSST");
                const vTotalItemNaNota = vProd + vFrete - vDesc + vIPI + vICMSST;
                produtosXML.push({ nItem: i+1, cEAN, nome, qCom, vTotalItemNaNota, statusDB: 'NOVO', idMatch: null, margemAtual: 50, custoFinal: 0, precoVendaSug: 0 });
            }

            const financeiroXML = [];
            const dups = xmlDoc.getElementsByTagName("dup");
            for(let i=0; i<dups.length; i++) {
                financeiroXML.push({
                    num: getStringSafe(dups[i], "nDup") || `00${i+1}`,
                    venc: getStringSafe(dups[i], "dVenc") || dataEmissao,
                    valor: getFloatSafe(dups[i], "vDup") || 0,
                    desc: `NF ${numNF} - Parc ${getStringSafe(dups[i], "nDup") || (i+1)}`
                });
            }

            if(financeiroXML.length === 0 && totalNF > 0) {
                financeiroXML.push({ num: '001', venc: dataEmissao, valor: totalNF, desc: `NF ${numNF} - Parcela Única` });
            }

            window.tempXMLData = { fornNome, fornCNPJ, numNF, dataEmissao, totalNF, produtosXML, financeiroXML, freteExtra: 0 };
            
            window.tempXMLData.produtosXML.forEach(p => {
                let match = db.produtos.find(prod => (prod.ean && prod.ean === p.cEAN && p.cEAN !== 'SEM GTIN') || prod.nome.toLowerCase() === p.nome.toLowerCase());
                if(match) { p.statusDB = 'ATUALIZAR'; p.idMatch = match.id; p.margemAtual = (match.custo > 0 && match.preco > 0) ? ((match.preco - match.custo) / match.custo) * 100 : (match.margem || 50); }
                let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0;
                let freteRateado = window.tempXMLData.freteExtra * pesoValor;
                p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + freteRateado) / p.qCom) : 0;
                if(match && match.preco > 0) {
                      p.precoVendaSug = match.preco;
                      p.margemAtual = p.custoFinal > 0 ? ((p.precoVendaSug - p.custoFinal) / p.custoFinal) * 100 : 0;
                  } else {
                      p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100));
                  }
            });

            document.getElementById('xml-frete-extra').value = 0; 
            renderTelaConferenciaXML(); 
            document.getElementById('modal-conferencia-xml').classList.remove('hidden');
        } catch (err) { console.log(err); showToast('Erro ao ler XML.', 'error'); }
    }; reader.readAsText(file); document.getElementById('xml-upload').value = '';
}

function lerXMLCTe(event) {
    const file = event.target.files[0]; 
    if(!file) return; 
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new DOMParser(); 
            const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
            
            const vTPrestNode = xmlDoc.getElementsByTagName("vTPrest")[0];
            const vRecNode = xmlDoc.getElementsByTagName("vRec")[0];
            const emitNode = xmlDoc.getElementsByTagName("emit")[0];
            const xNomeNode = emitNode ? emitNode.getElementsByTagName("xNome")[0] : null;
            const nomeTransportadora = xNomeNode ? xNomeNode.textContent : "Transportadora";
            
            let valorFrete = 0;
            if (vTPrestNode) valorFrete = parseInputMoney(vTPrestNode.textContent) || 0;
            else if (vRecNode) valorFrete = parseInputMoney(vRecNode.textContent) || 0;
            
            if (valorFrete > 0) {
                document.getElementById('xml-frete-extra').value = valorFrete.toFixed(2);
                recalcularRateioXML();
                
                window.tempXMLData.financeiroXML.push({ 
                    num: 'CT-e', 
                    venc: new Date().toISOString().split('T')[0], 
                    valor: valorFrete, 
                    desc: `Frete NF ${window.tempXMLData.numNF} - ${nomeTransportadora}` 
                });
                renderXMLFinanceiro();
                
                showToast(`CT-e lido! Frete de R$ ${valorFrete.toFixed(2)} rateado nos produtos.`, 'success');
            } else {
                showToast("Valor do frete não encontrado neste CT-e.", "error");
            }
        } catch (err) { 
            console.error(err); 
            showToast('Erro ao ler XML do CT-e.', 'error'); 
        }
    }; 
    reader.readAsText(file); 
    event.target.value = '';
}

function recalcularRateioXML() {
    window.tempXMLData.freteExtra = parseInputMoney(document.getElementById('xml-frete-extra').value) || 0;
    window.tempXMLData.produtosXML.forEach(p => { 
        let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0; 
        p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + (window.tempXMLData.freteExtra * pesoValor)) / p.qCom) : 0; 
        if(p.statusDB === 'ATUALIZAR' && p.precoVendaSug > 0) {
            p.margemAtual = p.custoFinal > 0 ? ((p.precoVendaSug - p.custoFinal) / p.custoFinal) * 100 : 0;
        } else {
            p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100)); 
        } 
    });
    renderTelaConferenciaXML();
}

function renderXMLFinanceiro() {
    const d = window.tempXMLData;
    const container = document.getElementById('xml-financeiro-body');
    if(!container) return;

    let totalLancado = 0;
    container.innerHTML = d.financeiroXML.map((f, i) => {
        totalLancado += f.valor;
        return `
        <div class="flex flex-col sm:flex-row gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-2 md:p-3 rounded-lg border border-amber-200 dark:border-amber-700/50 shadow-sm">
            <input type="text" class="w-full sm:flex-1 bg-transparent text-xs font-bold text-amber-900 dark:text-amber-100 outline-none p-1" value="${f.desc}" onchange="atualizarParcelaXML(${i}, 'desc', this.value)">
            <input type="date" class="w-full sm:w-36 bg-transparent text-xs font-bold text-amber-800 dark:text-amber-200 outline-none p-1" value="${f.venc}" onchange="atualizarParcelaXML(${i}, 'venc', this.value)">
            <input type="text" data-mask="money" inputmode="numeric"   class="w-full sm:w-28 text-right bg-transparent text-sm font-black text-red-600 dark:text-red-400 outline-none p-1" value="${f.valor.toFixed(2)}" onchange="atualizarParcelaXML(${i}, 'valor', this.value)">
            <button onclick="removeParcelaXML('${i}')" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>
        `;
    }).join('');

    document.getElementById('xml-total-financeiro').innerText = formatMoney(totalLancado);
}

function atualizarParcelaXML(idx, campo, val) {
    if(campo === 'valor') window.tempXMLData.financeiroXML[idx][campo] = parseInputMoney(val) || 0;
    else window.tempXMLData.financeiroXML[idx][campo] = val;
    renderXMLFinanceiro();
}

function addParcelaXML() {
    window.tempXMLData.financeiroXML.push({ num: 'EXT', venc: new Date().toISOString().split('T')[0], valor: 0, desc: `Ref. Frete NF ${window.tempXMLData.numNF}` });
    renderXMLFinanceiro();
}

function removeParcelaXML(idx) {
    window.tempXMLData.financeiroXML.splice(idx, 1);
    renderXMLFinanceiro();
}

function xmlAtualizarValores(i, campo, val) {
    const p = window.tempXMLData.produtosXML[i]; val = parseInputMoney(val) || 0;
    if(campo === 'custo') { p.custoFinal = val; if(p.statusDB === 'ATUALIZAR' && p.precoVendaSug > 0) { p.margemAtual = p.custoFinal > 0 ? ((p.precoVendaSug - p.custoFinal) / p.custoFinal) * 100 : 0; } else { p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); } }
    if(campo === 'margem') { p.margemAtual = val; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); }
    if(campo === 'preco') { p.precoVendaSug = val; if(p.custoFinal>0) p.margemAtual = ((p.precoVendaSug-p.custoFinal)/p.custoFinal)*100; }
    
    document.getElementById('xml-produtos-body').innerHTML = window.tempXMLData.produtosXML.map((p, idx) => `
        <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="p-2 text-xs"><input type="text" class="w-full bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none dark:text-white" value="${p.nome}" onchange="tempXMLData.produtosXML[${idx}].nome = this.value"><span class="text-[10px] text-slate-500 dark:text-slate-400">EAN: ${p.cEAN || 'S/N'}</span></td>
            <td class="p-2 text-xs text-center"><span class="${p.statusDB.includes('NOVO') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded font-bold">${p.statusDB}</span></td>
            <td class="p-2 text-xs text-center font-bold">${p.qCom}</td>
            <td class="p-2 text-xs text-right"><input type="text" data-mask="money" inputmode="numeric"   class="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-red-600 outline-none dark:text-white" value="${p.custoFinal.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'custo', this.value)"></td>
            <td class="p-2 text-xs text-center"><input type="text" data-mask="money" inputmode="numeric" step="0.1" class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold text-blue-600 outline-none dark:text-white" value="${p.margemAtual.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'margem', this.value)"> %</td>
            <td class="p-2 text-xs text-right"><input type="text" data-mask="money" inputmode="numeric"   class="w-24 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-emerald-600 outline-none dark:text-white" value="${p.precoVendaSug.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'preco', this.value)"></td>
            <td class="p-2 text-xs text-center"><button onclick="abrirModalProdutoDoXML('${idx}')" class="text-indigo-500 bg-indigo-100 p-1.5 rounded"><i class="fa-solid fa-pen-to-square"></i></button></td>
        </tr>`).join('');
}

function abrirModalProdutoDoXML(index) {
    const p = window.tempXMLData.produtosXML[index]; window.xmlItemEditIndex = index; document.getElementById('modal-produto').classList.remove('hidden');
    
    const divAcao = document.getElementById('div-acao-vinculo-xml');
    if(divAcao) divAcao.classList.remove('hidden'); 
    
    const selectAcao = document.getElementById('prod-acao-vinculo');
    const divBusca = document.getElementById('div-vinculo-busca');
    const selProd = document.getElementById('prod-vinculo-select');
    
    if(selectAcao) {
        selectAcao.value = (p.statusDB === 'ATUALIZAR' && p.idMatch) ? 'VINCULAR' : 'NOVO';
        if(selectAcao.value === 'VINCULAR') {
            divBusca.classList.remove('hidden');
            if(selProd && selProd.options.length <= 1) {
                let html = '<option value="">Selecione um produto...</option>';
                const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
                sorted.forEach(prod => {
                    html += "<option value=\"" + prod.id + "\">" + prod.nome + " (Estoque: " + prod.estoque + ")</option>";
                });
                selProd.innerHTML = html;
            }
            if(selProd) selProd.value = p.idMatch || '';
        } else {
            divBusca.classList.add('hidden');
        }
    }

    if(p.statusDB === 'ATUALIZAR' && p.idMatch) { 
        document.getElementById('prod-id').value = p.idMatch; document.getElementById('modal-produto-title').innerText = 'Atualizar Produto Vinculado'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    } 
    else { 
        document.getElementById('prod-id').value = ''; document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    }
}

function fecharModalProduto() { document.getElementById('modal-produto').classList.add('hidden'); }

function salvarProdutoXmlModal() {
    const nome = document.getElementById('prod-nome').value; const id = document.getElementById('prod-id').value;
    const pXML = window.tempXMLData.produtosXML[window.xmlItemEditIndex];
    if(!nome) return showToast('Nome obrigatório', 'error');
    
    const selectAcao = document.getElementById('prod-acao-vinculo');
    if(selectAcao && selectAcao.value === 'VINCULAR' && !id) {
        return showToast('Selecione um produto para vincular', 'error');
    }

    pXML.nome = nome; pXML.cEAN = document.getElementById('prod-ean').value;
    pXML.custoFinal = parseInputMoney(document.getElementById('prod-custo').value)||0; pXML.margemAtual = parseInputMoney(document.getElementById('prod-margem').value)||0; pXML.precoVendaSug = parseInputMoney(document.getElementById('prod-preco').value)||0;
    
    if(selectAcao && selectAcao.value === 'VINCULAR' && id) {
        pXML.statusDB = 'ATUALIZAR';
        pXML.idMatch = id;
    } else {
        pXML.statusDB = 'NOVO CADASTRADO';
        pXML.idMatch = null;
    }
    fecharModalProduto(); renderTelaConferenciaXML(); showToast('Ficha salva para a importação!');
}

function renderTelaConferenciaXML() {
    const d = window.tempXMLData; 
    document.getElementById('xml-forn-nome').innerText = d.fornNome; document.getElementById('xml-forn-cnpj').innerText = d.fornCNPJ; document.getElementById('xml-total-nota').innerText = formatMoney(d.totalNF); document.getElementById('rev-nfe').innerText = d.numNF; document.getElementById('rev-data').innerText = d.dataEmissao.split('-').reverse().join('/'); document.getElementById('rev-vprod').innerText = formatMoney(d.produtosXML.reduce((a,b)=>a+b.vTotalItemNaNota,0));
    document.getElementById('xml-produtos-body').innerHTML = d.produtosXML.map((p, i) => `
        <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="p-2 text-xs"><input type="text" class="w-full bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none dark:text-white" value="${p.nome}" onchange="tempXMLData.produtosXML[${i}].nome = this.value"><span class="text-[10px] text-slate-500 dark:text-slate-400">EAN: ${p.cEAN || 'S/N'}</span></td>
            <td class="p-2 text-xs text-center"><span class="${p.statusDB.includes('NOVO') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded font-bold">${p.statusDB}</span></td>
            <td class="p-2 text-xs text-center font-bold">${p.qCom}</td>
            <td class="p-2 text-xs text-right"><input type="text" data-mask="money" inputmode="numeric"   class="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-red-600 outline-none dark:text-white" value="${p.custoFinal.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'custo', this.value)"></td>
            <td class="p-2 text-xs text-center"><input type="text" data-mask="money" inputmode="numeric" step="0.1" class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold text-blue-600 outline-none dark:text-white" value="${p.margemAtual.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'margem', this.value)"> %</td>
            <td class="p-2 text-xs text-right"><input type="text" data-mask="money" inputmode="numeric"   class="w-24 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-emerald-600 outline-none dark:text-white" value="${p.precoVendaSug.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'preco', this.value)"></td>
            <td class="p-2 text-xs text-center"><button onclick="abrirModalProdutoDoXML('${i}')" class="text-indigo-500 bg-indigo-100 p-1.5 rounded"><i class="fa-solid fa-pen-to-square"></i></button></td>
        </tr>`).join('');
    renderXMLFinanceiro(); 
}

function fecharModalXML() { document.getElementById('modal-conferencia-xml').classList.add('hidden'); window.tempXMLData = null; }

async function salvarXMLConferido() {
    const data = window.tempXMLData; let totalQtd = 0;
    const batch = firestore.batch();

    let forn = db.fornecedores.find(f => f.doc === data.fornCNPJ || f.cnpj === data.fornCNPJ);
    if(!forn) { 
        const fornRef = window.getEmpresaRef().collection('fornecedores').doc();
        batch.set(fornRef, { nome: data.fornNome, doc: data.fornCNPJ, cnpj: data.fornCNPJ, ie: '', wpp: '', email: '', contato: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', condicoes: '', produtos: '' });
    }
    
    data.produtosXML.forEach(p => {
        let idProd = p.idMatch;
        let pDB = null;
        if ((p.statusDB === 'NOVO' || p.statusDB.includes('CADASTRADO')) && !idProd) {
            idProd = String(Date.now() + Math.floor(Math.random() * 1000));
            pDB = { id: idProd, ean: p.cEAN, nome: p.nome, categoria: 'Geral', marca: data.fornNome, custo: p.custoFinal, margem: p.margemAtual, preco: p.precoVendaSug, estoque: p.qCom, min: 5, foto: '', ativo: true };
            const prodRef = window.getEmpresaRef().collection('produtos').doc(idProd);
            batch.set(prodRef, pDB);
        } else { 
            pDB = db.produtos.find(x => String(x.id) === String(idProd)); 
            if (pDB) { 
                pDB.estoque += p.qCom; pDB.custo = p.custoFinal; pDB.margem = p.margemAtual; pDB.preco = p.precoVendaSug; pDB.nome = p.nome; pDB.ativo = true;
                const prodRef = window.getEmpresaRef().collection('produtos').doc(String(idProd));
                batch.update(prodRef, { estoque: pDB.estoque, custo: pDB.custo, margem: pDB.margem, preco: pDB.preco, nome: pDB.nome, ativo: true });
            } 
        }
        p.idMatch = idProd; // Garante a rastreabilidade pro Relatório de Evolução
        totalQtd += p.qCom; 
        const kRef = window.getEmpresaRef().collection('movimentacoes').doc();
        batch.set(kRef, { data: new Date().toISOString(), ref: `NF-e ${data.numNF} ${data.fornNome}`, produtoId: idProd, produtoNome: p.nome, qtd: p.qCom, tipo: 'ENTRADA XML' });
        
        p.custoUnitOriginal = p.qCom > 0 ? (p.vTotalItemNaNota / p.qCom) : 0;
    });

    const compraRef = window.getEmpresaRef().collection('compras').doc();
    batch.set(compraRef, { 
        numeroNF: data.numNF, 
        data: new Date().toISOString(), 
        dataEmissao: data.dataEmissao || new Date().toISOString().split('T')[0],
        fornecedor: data.fornNome, 
        cnpj: data.fornCNPJ, 
        totalNF: data.totalNF + data.freteExtra, 
        freteExtra: data.freteExtra,
        qtdTotal: totalQtd, 
        itens: data.produtosXML 
    });
    
    data.financeiroXML.forEach((f, idx) => {
        if(f.valor > 0) {
            const finRef = window.getEmpresaRef().collection('financeiro').doc();
            batch.set(finRef, { ref: f.desc, data: new Date(f.venc + 'T12:00:00').toISOString(), pessoa: data.fornNome, wpp: '', valor: f.valor, status: 'PENDENTE', tipo: 'DESPESA', categoria: 'Fornecedores / Compras' });
        }
    });

    try {
        await batch.commit();
        fecharModalXML(); renderComprasHist(); renderFinAbas('pagar'); showToast('Entrada de XML Concluída!', 'success');
    } catch(err) { console.error(err); showToast('Erro ao importar XML.', 'error'); }
}

// ==========================================
// COMPRA MANUAL E EDIÇÃO
// ==========================================
function abrirModalCompraManual() {
    compraManualItens = [];
    document.getElementById('compra-manual-id').value = '';
    document.getElementById('compra-manual-titulo-modal').innerText = 'Lançar Compra (Sem NF)';
    document.getElementById('compra-manual-btn-salvar').innerHTML = '<i class="fa-solid fa-save mr-1"></i> Confirmar Lançamento';
    
    document.getElementById('compra-manual-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('compra-manual-ref').value = '';
    document.getElementById('compra-manual-frete').value = '0';
    document.getElementById('compra-manual-forn-avulso').value = '';
    
    const divFinanceiro = document.getElementById('div-compra-manual-financeiro');
    if (divFinanceiro) divFinanceiro.classList.remove('hidden');
    document.getElementById('compra-manual-gerar-financeiro').checked = true;
    
    const selFornecedor = document.getElementById('compra-manual-fornecedor');
    selFornecedor.innerHTML = '<option value="">Selecione Fornecedor...</option>' + (db.fornecedores || []).map(f => `<option value="${f.nome}">${f.nome}</option>`).join('');
    
    renderTabelaCompraManual();
    document.getElementById('modal-compra-manual').classList.remove('hidden');
}

function fecharModalCompraManual() {
    document.getElementById('modal-compra-manual').classList.add('hidden');
}

function editarCompra(id) {
    const c = db.compras.find(x => String(x.id) === String(id));
    if (!c) return showToast('Compra não encontrada.', 'error');

    abrirConfirmacao('Editar Compra', 'Deseja carregar esta compra para edição? O estoque e o financeiro gerado anteriormente serão apagados ao salvar a nova.', () => {
        
        document.getElementById('compra-manual-id').value = c.id;
        document.getElementById('compra-manual-titulo-modal').innerText = 'Editar Compra e Estoque';
        document.getElementById('compra-manual-btn-salvar').innerHTML = '<i class="fa-solid fa-check-double mr-1"></i> Salvar Alteração';
        
        document.getElementById('compra-manual-data').value = c.data ? c.data.split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('compra-manual-ref').value = c.numeroNF === 'S/N' ? '' : c.numeroNF;
        document.getElementById('compra-manual-frete').value = c.freteExtra || 0;
        
        const selFornecedor = document.getElementById('compra-manual-fornecedor');
        selFornecedor.innerHTML = '<option value="">Selecione Fornecedor...</option>' + (db.fornecedores || []).map(f => `<option value="${f.nome}">${f.nome}</option>`).join('');
        
        const optExiste = Array.from(selFornecedor.options).some(opt => opt.value === c.fornecedor);
        if (optExiste) {
            selFornecedor.value = c.fornecedor;
            document.getElementById('compra-manual-forn-avulso').value = '';
        } else {
            selFornecedor.value = '';
            document.getElementById('compra-manual-forn-avulso').value = c.fornecedor;
        }

        const divFinanceiro = document.getElementById('div-compra-manual-financeiro');
        if (divFinanceiro) divFinanceiro.classList.add('hidden');
        document.getElementById('compra-manual-gerar-financeiro').checked = false;

        compraManualItens = c.itens.map(i => {
            let custoUnt = i.custoUnitOriginal || (i.qCom > 0 ? (i.vTotalItemNaNota / i.qCom) : 0);
            return {
                prodId: i.idMatch || '', 
                qtd: i.qCom,
                custoUnit: custoUnt
            };
        });

        renderTabelaCompraManual();
        document.getElementById('modal-compra-manual').classList.remove('hidden');
        showToast('Compra carregada no painel!', 'success');
    });
}

function addLinhaCompraManual() {
    compraManualItens.push({ prodId: '', qtd: 1, custoUnit: 0 });
    renderTabelaCompraManual();
}

function removerLinhaCompraManual(index) {
    compraManualItens.splice(index, 1);
    renderTabelaCompraManual();
}

function atualizarLinhaCompraManual(index, campo, valor) {
    if(campo === 'qtd' || campo === 'custoUnit') {
        compraManualItens[index][campo] = parseInputMoney(valor) || 0;
    } else {
        compraManualItens[index][campo] = valor;
        if(campo === 'prodId' && valor) {
            const p = db.produtos.find(x => String(x.id) === String(valor));
            if(p) compraManualItens[index].custoUnit = Number(p.custo) || 0;
        }
    }
    calcularTotaisCompraManual();
    renderTabelaCompraManual(); 
}

function renderTabelaCompraManual() {
    const tbody = document.getElementById('tabela-compra-manual-body');
    const prodsOptions = '<option value="">Selecione ou busque...</option>' + (db.produtos || []).map(p => `<option value="${p.id}">${p.nome} (Est: ${p.estoque})</option>`).join('');

    tbody.innerHTML = compraManualItens.map((item, i) => `
        <tr>
            <td class="p-2 md:p-3">
                <select class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded outline-none focus:border-emerald-500 text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white" onchange="atualizarLinhaCompraManual(${i}, 'prodId', this.value)">
                    ${prodsOptions.replace(`value="${item.prodId}"`, `value="${item.prodId}" selected`)}
                </select>
            </td>
            <td class="p-2 md:p-3"><input type="text" data-mask="money" inputmode="numeric"  min="0.01"  class="w-full text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded outline-none focus:border-emerald-500 text-xs font-bold dark:text-white" value="${item.qtd}" onchange="atualizarLinhaCompraManual(${i}, 'qtd', this.value)"></td>
            <td class="p-2 md:p-3"><input type="text" data-mask="money" inputmode="numeric"  min="0"  class="w-full text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded outline-none focus:border-emerald-500 text-xs font-bold dark:text-white" value="${item.custoUnit.toFixed(2)}" onchange="atualizarLinhaCompraManual(${i}, 'custoUnit', this.value)"></td>
            <td class="p-2 md:p-3 text-right font-bold text-slate-700 dark:text-slate-200">R$ ${(item.qtd * item.custoUnit).toFixed(2).replace('.',',')}</td>
            <td class="p-2 md:p-3 text-center"><button onclick="removerLinhaCompraManual('${i}')" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    calcularTotaisCompraManual();
}

function calcularTotaisCompraManual() {
    const frete = parseInputMoney(document.getElementById('compra-manual-frete').value) || 0;
    let totalProdutos = compraManualItens.reduce((acc, item) => acc + (item.qtd * item.custoUnit), 0);
    let totalGeral = totalProdutos + frete;
    
    document.getElementById('compra-manual-total-display').innerText = formatMoney(totalGeral);
    return { totalProdutos, frete, totalGeral };
}

async function salvarCompraManual() {
    const idEdit = document.getElementById('compra-manual-id').value;
    const isEdicao = !!idEdit;

    const fornSel = document.getElementById('compra-manual-fornecedor').value;
    const fornAvulso = document.getElementById('compra-manual-forn-avulso').value.trim();
    const fornecedorFinal = fornAvulso || fornSel;
    
    if(!fornecedorFinal) return showToast("Informe o fornecedor!", "error");
    
    const dataCompra = document.getElementById('compra-manual-data').value;
    const refPed = document.getElementById('compra-manual-ref').value || 'S/N';
    
    const totais = calcularTotaisCompraManual();
    if(compraManualItens.length === 0 || totais.totalGeral <= 0) return showToast("Adicione itens válidos!", "error");
    
    for(let i=0; i<compraManualItens.length; i++) {
        if(!compraManualItens[i].prodId) return showToast("Selecione os produtos em todas as linhas!", "error");
    }

    const batch = firestore.batch();

    if (isEdicao) {
        const cAntiga = db.compras.find(x => String(x.id) === String(idEdit));
        if (cAntiga) {
            if(cAntiga.itens && cAntiga.itens.length > 0) {
                cAntiga.itens.forEach(item => {
                    if (item.idMatch) {
                        const pDB = db.produtos.find(x => String(x.id) === String(item.idMatch));
                        if (pDB) {
                            pDB.estoque -= item.qCom;
                            batch.update(window.getEmpresaRef().collection('produtos').doc(String(pDB.id)), { estoque: pDB.estoque });
                            const kRef = window.getEmpresaRef().collection('movimentacoes').doc();
                            batch.set(kRef, { data: new Date().toISOString(), ref: `Estorno Edição Compra ${cAntiga.numeroNF}`, produtoId: pDB.id, produtoNome: pDB.nome, qtd: -item.qCom, tipo: 'ESTORNO COMPRA' });
                        }
                    }
                });
            }
            try {
                const snapFin = await window.getEmpresaRef().collection('financeiro').where('tipo', '==', 'DESPESA').get();
                snapFin.docs.forEach(doc => {
                    const finData = doc.data();
                    if (finData.ref && String(finData.ref).includes(cAntiga.numeroNF) && cAntiga.numeroNF !== 'S/N') {
                        batch.delete(doc.ref);
                    }
                });
            } catch(e) { console.error('Erro ao buscar financeiro atrelado:', e); }
        }
    }

    let totalQtd = 0;
    let itensRateadosParaSalvar = [];

    compraManualItens.forEach(item => {
        const pDB = db.produtos.find(x => String(x.id) === String(item.prodId));
        if(!pDB) return;
        
        let pesoValor = (item.qtd * item.custoUnit) / totais.totalProdutos;
        let freteRateado = totais.frete * pesoValor;
        let custoRateadoFinal = item.custoUnit + (freteRateado / item.qtd);
        
        pDB.estoque += item.qtd;
        pDB.custo = custoRateadoFinal;
        pDB.preco = custoRateadoFinal * (1 + ((pDB.margem || 0) / 100));
        
        totalQtd += item.qtd;
        
        batch.update(window.getEmpresaRef().collection('produtos').doc(String(pDB.id)), {
            estoque: pDB.estoque, custo: pDB.custo, preco: pDB.preco
        });
        
        const kRef = window.getEmpresaRef().collection('movimentacoes').doc();
        batch.set(kRef, { data: new Date().toISOString(), ref: `Compra Man. ${refPed} (${fornecedorFinal})`, produtoId: pDB.id, produtoNome: pDB.nome, qtd: item.qtd, tipo: 'ENTRADA COMPRA' });
        
        itensRateadosParaSalvar.push({
            idMatch: pDB.id, nome: pDB.nome, qCom: item.qtd, custoFinal: custoRateadoFinal, vTotalItemNaNota: (item.qtd * item.custoUnit) + freteRateado, custoUnitOriginal: item.custoUnit 
        });
    });

    const idCompra = isEdicao ? idEdit : Date.now();
    const compraRef = window.getEmpresaRef().collection('compras').doc(String(idCompra));
    batch.set(compraRef, { 
        id: idCompra, numeroNF: refPed, data: new Date(dataCompra + 'T12:00:00').toISOString(), fornecedor: fornecedorFinal, cnpj: '', 
        totalNF: totais.totalGeral, freteExtra: totais.frete, qtdTotal: totalQtd, itens: itensRateadosParaSalvar 
    }, { merge: true });

    if(document.getElementById('compra-manual-gerar-financeiro').checked && !isEdicao) {
        const finRef = window.getEmpresaRef().collection('financeiro').doc();
        batch.set(finRef, { ref: `Compra: ${refPed}`, data: new Date(dataCompra + 'T12:00:00').toISOString(), pessoa: fornecedorFinal, valor: totais.totalGeral, status: 'PENDENTE', tipo: 'DESPESA', categoria: 'Fornecedores / Compras' });
    }

    if(fornAvulso && !db.fornecedores.find(f => f.nome.toLowerCase() === fornAvulso.toLowerCase())) {
        const fornRef = window.getEmpresaRef().collection('fornecedores').doc();
        batch.set(fornRef, { nome: fornAvulso, doc: '', cnpj: '', telefone: '' });
    }

    try {
        await batch.commit();
        fecharModalCompraManual(); renderComprasHist(); renderFinAbas('pagar');
        showToast(isEdicao ? "Compra atualizada com sucesso!" : "Compra Manual lançada com sucesso!", "success");
    } catch(err) { console.error(err); showToast('Erro', 'error'); }
}

function renderComprasHist() {
    if(!db.compras) db.compras = [];
    let filtrados = [...db.compras];

    const buscaEl = document.getElementById('busca-compras');
    const dataIniEl = document.getElementById('filtro-compras-ini');
    const dataFimEl = document.getElementById('filtro-compras-fim');
    const tipoEl = document.getElementById('filtro-compras-tipo');

    const termo = buscaEl && buscaEl.value ? String(buscaEl.value).toLowerCase().trim() : '';
    const dataIni = dataIniEl ? dataIniEl.value : '';
    const dataFim = dataFimEl ? dataFimEl.value : '';
    const tipo = tipoEl ? tipoEl.value : '';

    if (termo) {
        filtrados = filtrados.filter(c => 
            (c.fornecedor && String(c.fornecedor).toLowerCase().includes(termo)) || 
            (c.numeroNF && String(c.numeroNF).toLowerCase().includes(termo))
        );
    }
    
    if (tipo) {
        filtrados = filtrados.filter(c => {
            const isManual = c.numeroNF === 'S/N' || (c.itens && c.itens[0] && !c.itens[0].cEAN) ? 'MANUAL' : 'XML NF-e';
            return isManual === tipo;
        });
    }

    if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(c => c.data && new Date(c.data).getTime() >= dIni); }
    if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(c => c.data && new Date(c.data).getTime() <= dFim); }

    filtrados.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));

    let totalCompras = 0;

    document.getElementById('tabela-compras-hist').innerHTML = filtrados.map(c => {
        totalCompras += (Number(c.totalNF) || 0);
        const isManual = c.numeroNF === 'S/N' || (c.itens && c.itens[0] && !c.itens[0].cEAN) ? 'MANUAL' : 'XML NF-e';
        const badge = isManual === 'MANUAL' 
            ? '<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">MANUAL</span>' 
            : '<span class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">XML NF-e</span>';
        
        const rawDataEmi = c.dataEmissao || (c.data ? c.data.split('T')[0] : '');
        const dataEmiFormatada = rawDataEmi ? formatData(rawDataEmi + 'T12:00:00').split(' ')[0].replace(',', '') : '-';
        const dataEntradaFormatada = c.data ? formatData(c.data).split(' ')[0].replace(',', '') : '-';
        
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
            <td class="p-4 text-xs">${dataEntradaFormatada}</td>
            <td class="p-4 text-xs font-mono text-slate-500">${dataEmiFormatada}</td>
            <td class="p-4 font-bold text-slate-800 dark:text-slate-100">${c.fornecedor}</td>
            <td class="p-4 text-center font-mono text-xs text-slate-500 dark:text-slate-400">${c.numeroNF || '-'}</td>
            <td class="p-4 text-center">${badge}</td>
            <td class="p-4 text-right font-bold text-indigo-600">${formatMoney(c.totalNF)}</td>
            <td class="p-4 text-center flex items-center justify-center gap-2 print:hidden">
                <button onclick="verDetalhesNF('${c.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                <button onclick="editarCompra('${c.id}')" class="text-amber-500 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="excluirNF('${c.id}')" class="text-red-500 hover:text-red-700 p-2 transition-colors" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma compra encontrada no período.</td></tr>';

    const totalEl = document.getElementById('compras-total-filtros');
    if (totalEl) totalEl.innerText = `Total Gasto: ${formatMoney(totalCompras)}`;
}

function excluirNF(id) { 
    abrirConfirmacao('Excluir Nota / Compra', 'Atenção: Não reverte o estoque nem o financeiro.', () => { 
        window.getEmpresaRef().collection('compras').doc(String(id)).delete().then(() => {
            renderComprasHist(); showToast('Compra excluída!'); 
        }).catch(e => { console.error(e); showToast('Erro ao excluir NF.', 'error'); });
    }); 
}

function verDetalhesNF(id) { 
    const c = db.compras.find(x => String(x.id) === String(id)); 
    if(!c) return; 
    document.getElementById('det-nf-fornecedor').innerText = c.fornecedor; 
    document.getElementById('det-nf-data').innerText = formatData(c.data); 
    const nfNumEl = document.getElementById('det-nf-num');
    if(nfNumEl) nfNumEl.innerText = c.numeroNF || 'S/N';
    document.getElementById('det-nf-total').innerText = formatMoney(c.totalNF); 
    document.getElementById('det-nf-itens').innerHTML = c.itens.map(i => `<tr class="border-b border-slate-100 dark:border-slate-700"><td class="p-3 text-xs">${i.nome}</td><td class="p-3 text-xs text-center font-bold">${i.qCom}</td><td class="p-3 text-xs text-right font-bold text-emerald-600">${formatMoney(i.custoFinal)}</td></tr>`).join(''); 
    document.getElementById('modal-detalhes-nf').classList.remove('hidden'); 
}
function fecharModalDetalhesNF() { document.getElementById('modal-detalhes-nf').classList.add('hidden'); }

// ==========================================
// 9. RELATÓRIOS E BI
// ==========================================

function mudarFiltroBI() {
    const tipo = document.getElementById('bi-filtro-periodo');
    const customDiv = document.getElementById('bi-datas-custom');
    if (!tipo) return;
    if (tipo.value === 'personalizado') {
        if(customDiv) customDiv.classList.remove('hidden');
    } else {
        if(customDiv) customDiv.classList.add('hidden');
    }
}

function obterIntervaloDatasBI() {
    const tipo = document.getElementById('bi-filtro-periodo');
    if (!tipo) return null;
    
    const hoje = new Date();
    
    let inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
    let fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);
    let label = 'Este Mês';
    
    if (tipo.value === 'mes') {
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0, 0);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
        label = `Este Mês (${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')})`;
    } else if (tipo.value === '30') {
        inicio = new Date(hoje.getTime() - (30 * 24 * 60 * 60 * 1000));
        inicio.setHours(0, 0, 0, 0);
        label = `Últimos 30 dias (${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')})`;
    } else if (tipo.value === '60') {
        inicio = new Date(hoje.getTime() - (60 * 24 * 60 * 60 * 1000));
        inicio.setHours(0, 0, 0, 0);
        label = `Últimos 60 dias (${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')})`;
    } else if (tipo.value === '90') {
        inicio = new Date(hoje.getTime() - (90 * 24 * 60 * 60 * 1000));
        inicio.setHours(0, 0, 0, 0);
        label = `Últimos 90 dias (${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')})`;
    } else if (tipo.value === 'personalizado') {
        const iStr = document.getElementById('bi-data-inicio')?.value;
        const fStr = document.getElementById('bi-data-fim')?.value;
        if (iStr) {
            inicio = new Date(iStr + 'T00:00:00');
        } else {
            inicio = new Date('2000-01-01T00:00:00');
        }
        if (fStr) {
            fim = new Date(fStr + 'T23:59:59');
        } else {
            fim = new Date('2100-01-01T23:59:59');
        }
        label = `Personalizado (${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')})`;
    }
    
    return { inicio, fim, label };
}

// Helper: Garante que apenas contas rigorosamente PAGAS cujo pagamento foi feito no período sejam computadas
function obterDespesasPagasDoPeriodo(periodo) {
    if (!db.financeiro) return [];
    const _parseD = typeof parseDataGenerica === 'function' ? parseDataGenerica : (x => new Date(x));
    return db.financeiro.filter(f => {
        const tipo = String(f.tipo || '').toUpperCase();
        if (tipo !== 'DESPESA') return false;
        
        // RIGOROSAMENTE APENAS CONTAS EFETIVAMENTE PAGAS
        const status = String(f.status || '').toUpperCase();
        if (status !== 'PAGO') return false;

        const cat = String(f.categoria || '').toLowerCase();
        if (cat.includes('transferência') || cat.includes('transferencia')) return false;

        if (!periodo) return true;

        // Data do pagamento: usa dataPagamento se existir, senão data do título (somente se estiver PAGO)
        const rawData = f.dataPagamento || f.data;
        if (!rawData) return false;

        const dataPg = _parseD(rawData);
        if (!dataPg || isNaN(dataPg.getTime())) return false;

        return dataPg >= periodo.inicio && dataPg <= periodo.fim;
    });
}

// Helper: Vendas válidas dentro do período filtrado
function obterVendasDoPeriodo(periodo) {
    if (!db.vendas) return [];
    const _parseD = typeof parseDataGenerica === 'function' ? parseDataGenerica : (x => new Date(x));
    return db.vendas.filter(v => {
        const tipo = String(v.tipo || '').toUpperCase();
        if (tipo === 'ORÇAMENTO' || tipo === 'ORCAMENTO') return false;
        const status = String(v.status || '').toUpperCase();
        if (status === 'CANCELADA' || status === 'CANCELADO') return false;

        if (!periodo) return true;

        const rawData = v.data || v.dataVenda || v.criadoEm;
        if (!rawData) return false;

        const dataV = _parseD(rawData);
        if (!dataV || isNaN(dataV.getTime())) return false;

        return dataV >= periodo.inicio && dataV <= periodo.fim;
    });
}

// Helper: Compras registradas dentro do período filtrado
function obterComprasDoPeriodo(periodo) {
    if (!db.compras) return [];
    const _parseD = typeof parseDataGenerica === 'function' ? parseDataGenerica : (x => new Date(x));
    return db.compras.filter(c => {
        if (!periodo) return true;

        const rawData = c.data || c.dataEmissao || c.criadoEm;
        if (!rawData) return false;

        const dataC = _parseD(rawData);
        if (!dataC || isNaN(dataC.getTime())) return false;

        return dataC >= periodo.inicio && dataC <= periodo.fim;
    });
}

function renderDashboard() {
    const periodo = obterIntervaloDatasBI();
    const vendas = obterVendasDoPeriodo(periodo);
    const compras = obterComprasDoPeriodo(periodo);
    const despesasPagas = obterDespesasPagasDoPeriodo(periodo);

    const fatTotal = vendas.reduce((a, b) => a + Number(b.tot || b.total || b.valor || 0), 0); 
    const cmvTotal = vendas.reduce((a, b) => a + Number(b.custoTotal || 0), 0); 
    const taxasTotal = vendas.reduce((a, b) => a + Number(b.taxaValor || 0), 0); 
    const recLiquida = fatTotal - taxasTotal;
    const lucroBruto = recLiquida - cmvTotal;

    // Despesas Operacionais e Impostos: rigorosamente apenas despesas pagas no período
    let despesasOperacionais = 0;
    let impostosTotal = 0;

    despesasPagas.forEach(d => {
        const cat = String(d.categoria || '').toLowerCase();
        const val = Number(d.valorPago || d.valor || 0);

        if (cat.includes('imposto') || cat.includes('das') || cat.includes('icms') || cat.includes('simples') || cat.includes('tributo')) {
            impostosTotal += val;
        } else {
            despesasOperacionais += val;
        }
    });

    const resultadoLiquido = lucroBruto - despesasOperacionais - impostosTotal;

    // 1. Elementos DRE Estruturado & Análise Vertical (AV%)
    // Base de cálculo AV: Faturamento Bruto para deduções/líquida, e Receita Líquida para operacionais/CMV
    const avBruta = 100.0;
    const avTaxas = fatTotal > 0 ? (taxasTotal / fatTotal) * 100 : 0;
    const avLiquida = fatTotal > 0 ? (recLiquida / fatTotal) * 100 : 100.0;
    const avBaseOperacional = recLiquida > 0 ? recLiquida : (fatTotal > 0 ? fatTotal : 1);
    const avCmv = (cmvTotal / avBaseOperacional) * 100;
    const avLucroBruto = (lucroBruto / avBaseOperacional) * 100;
    const avDespesas = (despesasOperacionais / avBaseOperacional) * 100;
    const avImpostos = (impostosTotal / avBaseOperacional) * 100;
    const avResultadoLiq = (resultadoLiquido / avBaseOperacional) * 100;

    const dreBrutaEl = document.getElementById('dre-receita-bruta'); if(dreBrutaEl) dreBrutaEl.innerText = formatMoney(fatTotal);
    const dreBrutaAvEl = document.getElementById('dre-receita-bruta-av'); if(dreBrutaAvEl) dreBrutaAvEl.innerText = `${avBruta.toFixed(1)}%`;

    const dreTaxEl = document.getElementById('dre-deducoes-taxas'); if(dreTaxEl) dreTaxEl.innerText = `- ${formatMoney(taxasTotal)}`;
    const dreTaxAvEl = document.getElementById('dre-deducoes-taxas-av'); if(dreTaxAvEl) dreTaxAvEl.innerText = `-${avTaxas.toFixed(1)}%`;

    const dreLiqEl = document.getElementById('dre-receita-liquida'); if(dreLiqEl) dreLiqEl.innerText = formatMoney(recLiquida);
    const dreLiqAvEl = document.getElementById('dre-receita-liquida-av'); if(dreLiqAvEl) dreLiqAvEl.innerText = `${avLiquida.toFixed(1)}%`;

    const dreCmvEl = document.getElementById('dre-cmv'); if(dreCmvEl) dreCmvEl.innerText = `- ${formatMoney(cmvTotal)}`;
    const dreCmvAvEl = document.getElementById('dre-cmv-av'); if(dreCmvAvEl) dreCmvAvEl.innerText = `-${avCmv.toFixed(1)}%`;

    const dreLucroBrutoEl = document.getElementById('dre-lucro-bruto'); if(dreLucroBrutoEl) dreLucroBrutoEl.innerText = formatMoney(lucroBruto);
    const dreLucroBrutoAvEl = document.getElementById('dre-lucro-bruto-av'); if(dreLucroBrutoAvEl) dreLucroBrutoAvEl.innerText = `${avLucroBruto.toFixed(1)}%`;

    const dreDespEl = document.getElementById('dre-despesas-operacionais'); if(dreDespEl) dreDespEl.innerText = `- ${formatMoney(despesasOperacionais)}`;
    const dreDespAvEl = document.getElementById('dre-despesas-operacionais-av'); if(dreDespAvEl) dreDespAvEl.innerText = `-${avDespesas.toFixed(1)}%`;

    const dreImpEl = document.getElementById('dre-impostos'); if(dreImpEl) dreImpEl.innerText = `- ${formatMoney(impostosTotal)}`;
    const dreImpAvEl = document.getElementById('dre-impostos-av'); if(dreImpAvEl) dreImpAvEl.innerText = `-${avImpostos.toFixed(1)}%`;

    const dreResEl = document.getElementById('dre-resultado-liquido'); 
    const dreResAvEl = document.getElementById('dre-resultado-liquido-av');
    if(dreResEl) {
        dreResEl.innerText = formatMoney(resultadoLiquido);
        dreResEl.className = `p-4 rounded-r-lg text-right font-black text-base md:text-lg ${resultadoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
    }
    if(dreResAvEl) {
        dreResAvEl.innerText = `${avResultadoLiq.toFixed(1)}%`;
        dreResAvEl.className = `p-4 text-right text-xs md:text-sm font-black ${resultadoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
    }

    // 2. Raio-X Diagnóstico Executivo & Termômetro de Equilíbrio (Break-Even)
    const despesasFixas = despesasOperacionais + impostosTotal;
    const margemContribPct = recLiquida > 0 ? (lucroBruto / recLiquida) : 0;
    const pontoEquilibrio = margemContribPct > 0 ? (despesasFixas / margemContribPct) : (despesasFixas > 0 ? despesasFixas : 0);

    const kpiMargemValEl = document.getElementById('kpi-margem-contribuicao-valor');
    if (kpiMargemValEl) kpiMargemValEl.innerText = formatMoney(lucroBruto);
    const kpiMargemPctEl = document.getElementById('kpi-margem-contribuicao-perc');
    if (kpiMargemPctEl) kpiMargemPctEl.innerText = `${(margemContribPct * 100).toFixed(1)}% da Receita Líq.`;

    const kpiPontoEqValEl = document.getElementById('kpi-ponto-equilibrio-valor');
    if (kpiPontoEqValEl) kpiPontoEqValEl.innerText = formatMoney(pontoEquilibrio);
    const kpiPontoEqDetEl = document.getElementById('kpi-ponto-equilibrio-detalhe');
    if (kpiPontoEqDetEl) kpiPontoEqDetEl.innerText = despesasFixas > 0 ? `Cobre ${formatMoney(despesasFixas)} de despesas e tributos.` : 'Nenhum custo fixo no período.';

    const pctEquilibrio = pontoEquilibrio > 0 ? ((recLiquida / pontoEquilibrio) * 100) : (recLiquida > 0 ? 100 : 0);
    const kpiPctBadgeEl = document.getElementById('kpi-break-even-pct-badge');
    if (kpiPctBadgeEl) kpiPctBadgeEl.innerText = `${pctEquilibrio.toFixed(0)}%`;

    const kpiBarraEl = document.getElementById('kpi-break-even-barra');
    if (kpiBarraEl) {
        kpiBarraEl.style.width = `${Math.min(100, Math.max(0, pctEquilibrio))}%`;
        kpiBarraEl.className = resultadoLiquido >= 0 ? 'bg-emerald-500 h-full rounded-full transition-all duration-500' : 'bg-amber-500 h-full rounded-full transition-all duration-500';
    }

    const kpiStatusEl = document.getElementById('kpi-break-even-status');
    const kpiSobraEl = document.getElementById('kpi-break-even-sobra');
    if (kpiStatusEl) {
        if (resultadoLiquido >= 0) {
            kpiStatusEl.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Meta Batida! Operação no Lucro</span>`;
            if (kpiSobraEl) kpiSobraEl.innerText = `Superávit de ${formatMoney(recLiquida - pontoEquilibrio)} além do 0 a 0.`;
        } else {
            kpiStatusEl.innerHTML = `<span class="text-amber-400 font-bold flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> Faltam ${formatMoney(Math.abs(resultadoLiquido))} p/ o 0 a 0</span>`;
            if (kpiSobraEl) kpiSobraEl.innerText = `Receita ainda insuficiente p/ cobrir custos fixos.`;
        }
    }

    const margemLiqRealPct = fatTotal > 0 ? ((resultadoLiquido / fatTotal) * 100) : 0;
    const kpiMargemLiqEl = document.getElementById('kpi-margem-liquida-perc');
    if (kpiMargemLiqEl) {
        kpiMargemLiqEl.innerText = `${margemLiqRealPct.toFixed(1)}%`;
        kpiMargemLiqEl.className = `text-xl font-black ${resultadoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
    }
    const kpiResLiqEl = document.getElementById('kpi-resultado-liquido-card');
    if (kpiResLiqEl) kpiResLiqEl.innerText = formatMoney(resultadoLiquido);

    const kpiSaudeBadgeEl = document.getElementById('kpi-saude-financeira-badge');
    if (kpiSaudeBadgeEl) {
        if (resultadoLiquido > 0 && margemLiqRealPct >= 15) {
            kpiSaudeBadgeEl.className = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm';
            kpiSaudeBadgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Alta Eficiência (> 15%)`;
        } else if (resultadoLiquido > 0 && margemLiqRealPct >= 5) {
            kpiSaudeBadgeEl.className = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 shadow-sm';
            kpiSaudeBadgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-400"></span> Saudável (5% - 15%)`;
        } else if (resultadoLiquido > 0) {
            kpiSaudeBadgeEl.className = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm';
            kpiSaudeBadgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Atenção (Margem < 5%)`;
        } else {
            kpiSaudeBadgeEl.className = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1.5 shadow-sm';
            kpiSaudeBadgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-400 animate-bounce"></span> Déficit Operacional`;
        }
    }

    // Fallback legado
    const rBrutaEl = document.getElementById('bi-receita'); if(rBrutaEl) rBrutaEl.innerText = formatMoney(fatTotal); 
    const rCmvEl = document.getElementById('bi-cmv'); if(rCmvEl) rCmvEl.innerText = `- ${formatMoney(cmvTotal)}`; 
    const rTaxEl = document.getElementById('bi-taxas'); if(rTaxEl) rTaxEl.innerText = `- ${formatMoney(taxasTotal)}`; 
    const rLucroEl = document.getElementById('bi-lucro'); if(rLucroEl) rLucroEl.innerText = formatMoney(resultadoLiquido);

    // Top Compras (Produtos em que mais se gastou)
    const rankingComprasProd = {};
    compras.forEach(c => {
        (c.itens || []).forEach(i => {
            const pNome = i.nome || 'Produto';
            if (!rankingComprasProd[pNome]) rankingComprasProd[pNome] = 0;
            rankingComprasProd[pNome] += Number(i.vTotalItemNaNota || (i.custoFinal * (i.qCom || 1)) || 0);
        });
    });
    const topComprasEl = document.getElementById('bi-top-compras');
    if (topComprasEl) {
        const itensTopCompras = Object.keys(rankingComprasProd)
            .map(k => ({ nome: k, val: rankingComprasProd[k] }))
            .sort((a,b) => b.val - a.val)
            .slice(0, 5);
        if (itensTopCompras.length > 0) {
            const maxCompras = itensTopCompras[0].val || 1;
            topComprasEl.innerHTML = itensTopCompras.map((p, i) => {
                const pct = (p.val / maxCompras) * 100;
                return `
                <div onclick="abrirDrilldownDRE('PRODUTO_COMPRAS', '${p.nome.replace(/'/g, "\\'")}')" class="relative overflow-hidden flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver compras deste produto">
                    <div class="absolute left-0 top-0 bottom-0 bg-red-500/10 pointer-events-none rounded-lg" style="width: ${pct}%"></div>
                    <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors relative z-10">${i+1}. ${p.nome}</span>
                    <div class="flex items-center gap-2 shrink-0 relative z-10">
                        <span class="font-bold text-red-500 dark:text-red-400">${formatMoney(p.val)}</span>
                        <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            topComprasEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhuma compra no período</div>';
        }
    }
    
    // Top Vendas Produtos (Top 5)
    const rankingProd = {}; 
    vendas.forEach(v => (v.itens || []).forEach(i => { 
        const pNome = i.nome || 'Produto';
        if(!rankingProd[pNome]) rankingProd[pNome] = 0; 
        rankingProd[pNome] += (Number(i.preco || 0) * Number(i.qtd || 1)); 
    }));
    const abcEl = document.getElementById('bi-abc-produtos');
    if(abcEl) {
        const itensTopVendas = Object.keys(rankingProd).map(k => ({nome: k, val: rankingProd[k]})).sort((a,b) => b.val - a.val).slice(0,5);
        if (itensTopVendas.length > 0) {
            const maxVendas = itensTopVendas[0].val || 1;
            abcEl.innerHTML = itensTopVendas.map((p, i) => {
                const pct = (p.val / maxVendas) * 100;
                return `
                <div onclick="abrirDrilldownDRE('PRODUTO_VENDAS', '${p.nome.replace(/'/g, "\\'")}')" class="relative overflow-hidden flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver vendas deste produto">
                    <div class="absolute left-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none rounded-lg" style="width: ${pct}%"></div>
                    <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors relative z-10">${i+1}. ${p.nome}</span>
                    <div class="flex items-center gap-2 shrink-0 relative z-10">
                        <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(p.val)}</span>
                        <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            abcEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhuma venda no período</div>';
        }
    }
    
    // Top Clientes
    const rankingCli = {}; 
    vendas.forEach(v => { 
        const c = v.clienteNome || 'Consumidor'; 
        if(!rankingCli[c]) rankingCli[c] = 0; 
        rankingCli[c] += Number(v.tot || v.total || v.valor || 0); 
    });
    const cliEl = document.getElementById('bi-top-clientes');
    if(cliEl) {
        const itensTopCli = Object.keys(rankingCli).map(k => ({nome: k, val: rankingCli[k]})).sort((a,b) => b.val - a.val).slice(0,5);
        if (itensTopCli.length > 0) {
            const maxCli = itensTopCli[0].val || 1;
            cliEl.innerHTML = itensTopCli.map((c, i) => {
                const pct = (c.val / maxCli) * 100;
                return `
                <div onclick="abrirDrilldownDRE('CLIENTE_VENDAS', '${c.nome.replace(/'/g, "\\'")}')" class="relative overflow-hidden flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver compras deste cliente">
                    <div class="absolute left-0 top-0 bottom-0 bg-blue-500/10 pointer-events-none rounded-lg" style="width: ${pct}%"></div>
                    <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors relative z-10">${i+1}. ${c.nome}</span>
                    <div class="flex items-center gap-2 shrink-0 relative z-10">
                        <span class="font-bold text-blue-600 dark:text-blue-400">${formatMoney(c.val)}</span>
                        <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            cliEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhum cliente no período</div>';
        }
    }

    // Top Fornecedores
    const rankingForn = {};
    compras.forEach(c => {
        const fNome = c.fornecedor || 'Desconhecido';
        if(!rankingForn[fNome]) rankingForn[fNome] = 0;
        rankingForn[fNome] += Number(c.totalNF || c.valor || 0);
    });
    const fornEl = document.getElementById('bi-top-fornecedores');
    if(fornEl) {
        const itensTopForn = Object.keys(rankingForn).map(k => ({nome: k, val: rankingForn[k]})).sort((a,b) => b.val - a.val).slice(0,5);
        if (itensTopForn.length > 0) {
            const maxForn = itensTopForn[0].val || 1;
            fornEl.innerHTML = itensTopForn.map((f, i) => {
                const pct = (f.val / maxForn) * 100;
                return `
                <div onclick="abrirDrilldownDRE('FORNECEDOR_COMPRAS', '${f.nome.replace(/'/g, "\\'")}')" class="relative overflow-hidden flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver compras deste fornecedor">
                    <div class="absolute left-0 top-0 bottom-0 bg-red-500/10 pointer-events-none rounded-lg" style="width: ${pct}%"></div>
                    <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors relative z-10">${i+1}. ${f.nome}</span>
                    <div class="flex items-center gap-2 shrink-0 relative z-10">
                        <span class="font-bold text-red-500 dark:text-red-400">${formatMoney(f.val)}</span>
                        <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            fornEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhum fornecedor no período</div>';
        }
    }

    // Despesas por Categoria, Centro de Custo, Favorecido e Funcionários (RIGOROSAMENTE APENAS CONTAS PAGAS)
    const rankingCategorias = {};
    const rankingCentros = {};
    const rankingFavorecidos = {};
    const rankingFuncionarios = {};
    
    despesasPagas.forEach(f => {
        const cat = f.categoria || 'Sem Categoria';
        const ctc = f.centroCusto || 'Sem Centro de Custo';
        const val = parseInputMoney(f.valorPago || f.valor || 0);
        const pessoa = f.pessoa || 'Sem Nome / Não Informado';

        const catLower = cat.toLowerCase();
        
        if (!rankingFavorecidos[pessoa]) rankingFavorecidos[pessoa] = 0;
        rankingFavorecidos[pessoa] += val;
        
        if (catLower.includes('salário') || catLower.includes('salario') || catLower.includes('folha') || catLower.includes('pró-labore') || catLower.includes('pro-labore') || catLower.includes('pro labore')) {
            if (!rankingFuncionarios[pessoa]) rankingFuncionarios[pessoa] = 0;
            rankingFuncionarios[pessoa] += val;
        }
        
        if (!rankingCategorias[cat]) rankingCategorias[cat] = 0;
        rankingCategorias[cat] += val;
        
        if (!rankingCentros[ctc]) rankingCentros[ctc] = 0;
        rankingCentros[ctc] += val;
    });
    
    const catEl = document.getElementById('bi-despesas-categoria');
    if (catEl) {
        if (Object.keys(rankingCategorias).length > 0) {
            catEl.innerHTML = Object.keys(rankingCategorias)
                .map(k => ({nome: k, val: rankingCategorias[k]}))
                .sort((a,b) => b.val - a.val)
                .map((c, i) => `
                    <div onclick="abrirDrilldownDRE('CATEGORIA', '${c.nome.replace(/'/g, "\\'")}')" class="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver extrato detalhado desta categoria">
                        <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-red-500 transition-colors">${i+1}. ${c.nome}</span>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="font-bold text-red-500 dark:text-red-400">${formatMoney(c.val)}</span>
                            <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                    </div>
                `).join('');
        } else {
            catEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhuma despesa paga no período</div>';
        }
    }

    // Renderiza Donut Chart de Despesas por Categoria
    renderGraficoDespesasCategoria(rankingCategorias);
    
    const favEl = document.getElementById('bi-despesas-favorecido');
    if (favEl) {
        if (Object.keys(rankingFavorecidos).length > 0) {
            favEl.innerHTML = Object.keys(rankingFavorecidos)
                .map(k => ({nome: k, val: rankingFavorecidos[k]}))
                .sort((a,b) => b.val - a.val)
                .map((c, i) => `
                    <div onclick="abrirDrilldownDRE('FAVORECIDO', '${c.nome.replace(/'/g, "\\'")}')" class="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver extrato detalhado deste favorecido">
                        <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-500 transition-colors">${i+1}. ${c.nome}</span>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="font-bold text-indigo-500 dark:text-indigo-400">${formatMoney(c.val)}</span>
                            <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                    </div>
                `).join('');
        } else {
            favEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhuma despesa paga no período</div>';
        }
    }
    
    const funcEl = document.getElementById('bi-despesas-funcionario');
    if (funcEl) {
        if (Object.keys(rankingFuncionarios).length > 0) {
            funcEl.innerHTML = Object.keys(rankingFuncionarios)
                .map(k => ({nome: k, val: rankingFuncionarios[k]}))
                .sort((a,b) => b.val - a.val)
                .map((c, i) => `
                    <div onclick="abrirDrilldownDRE('FUNCIONARIO', '${c.nome.replace(/'/g, "\\'")}')" class="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver extrato deste funcionário">
                        <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-emerald-500 transition-colors">${i+1}. ${c.nome}</span>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="font-bold text-emerald-500 dark:text-emerald-400">${formatMoney(c.val)}</span>
                            <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                    </div>
                `).join('');
        } else {
            funcEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhum pagamento de folha/salário pago no período</div>';
        }
    }

    const ctcEl = document.getElementById('bi-despesas-centro-custo');
    if (ctcEl) {
        if (Object.keys(rankingCentros).length > 0) {
            ctcEl.innerHTML = Object.keys(rankingCentros)
                .map(k => ({nome: k, val: rankingCentros[k]}))
                .sort((a,b) => b.val - a.val)
                .map((c, i) => `
                    <div onclick="abrirDrilldownDRE('CENTRO_CUSTO', '${c.nome.replace(/'/g, "\\'")}')" class="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-1.5 cursor-pointer dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors group" title="Clique para ver extrato deste centro de custo">
                        <span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200 group-hover:text-purple-500 transition-colors">${i+1}. ${c.nome}</span>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="font-bold text-purple-500 dark:text-purple-400">${formatMoney(c.val)}</span>
                            <i class="fa-solid fa-magnifying-glass text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                    </div>
                `).join('');
        } else {
            ctcEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhum lançamento pago no período</div>';
        }
    }

    // Alerta de Centro de Custo não classificado
    const semCtcDespesas = despesasPagas.filter(d => {
        const c = String(d.centroCusto || '').trim().toLowerCase();
        return !c || c === 'sem centro de custo' || c === 'não informado' || c === 'nao informado';
    });
    const alertaCtcEl = document.getElementById('alerta-centro-custo-pendente');
    const alertaCtcTxt = document.getElementById('alerta-centro-custo-texto');
    if (alertaCtcEl && alertaCtcTxt) {
        if (semCtcDespesas.length > 0) {
            const totSemCtc = semCtcDespesas.reduce((a, b) => a + parseInputMoney(b.valorPago || b.valor || 0), 0);
            alertaCtcTxt.innerText = `${semCtcDespesas.length} despesa(s) (${formatMoney(totSemCtc)}) sem Centro de Custo.`;
            alertaCtcEl.classList.remove('hidden');
        } else {
            alertaCtcEl.classList.add('hidden');
        }
    }
    
    // Totalizadores de Compras
    const biQtdEl = document.getElementById('bi-compras-qtd'); if(biQtdEl) biQtdEl.innerText = compras.length;
    const biTicketEl = document.getElementById('bi-compras-ticket'); if(biTicketEl) biTicketEl.innerText = formatMoney(compras.length ? (compras.reduce((a,b)=>a+(Number(b.totalNF||0)),0)/compras.length) : 0);
    const biItensEl = document.getElementById('bi-compras-itens'); if(biItensEl) biItensEl.innerText = `${compras.reduce((a,b)=>(a+((b.itens||[]).reduce((x,y)=>x+(Number(y.qCom||0)),0))),0)} un`;

    // Renderiza Curva ABC e Sugestor de Reposição Inteligente
    renderCurvaABC(vendas, fatTotal);
    renderSugestorCompras(vendas, periodo);

    // Popula select de produtos para Histórico/Evolução de Custos
    const dlProdCusto = document.getElementById('lista-produtos-custo');
    if (dlProdCusto && (dlProdCusto.options.length === 0 || dlProdCusto.dataset.loaded !== 'true')) {
        const sortedProds = [...(db.produtos || [])].sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));
        dlProdCusto.innerHTML = sortedProds.map(p => `<option value="${p.nome}">Estoque: ${p.estoque || 0}</option>`).join('');
        dlProdCusto.dataset.loaded = 'true';
    }

    // Scanner de inflação de insumos (Top 3 Aumentos de Custo)
    try { renderAlertaTopAumentosCusto(compras); } catch (e) { console.error('Erro em renderAlertaTopAumentosCusto:', e); }

    // Relatório de Estoque & Kardex de Movimentações
    try { renderRelatorioEstoqueKardex(); } catch (e) { console.error('Erro em renderRelatorioEstoqueKardex:', e); }

    // Relatório & Histórico Gerencial de Vendas
    try { renderVendas(); } catch (e) { console.error('Erro em renderVendas:', e); }

    // Relatório Detalhado de Comissões por Vendedor
    try { renderizarRelatorioComissoes(); } catch (e) { console.error('Erro em renderizarRelatorioComissoes:', e); }

    // Aplica o Controle de Acesso a Relatórios por Plano SaaS
    try { aplicarControleAcessoRelatoriosPorPlano(); } catch (e) { console.error('Erro em aplicarControleAcessoRelatoriosPorPlano:', e); }
}

// ==========================================
// DRILL-DOWN ANALÍTICO DO DRE E BI (100% AUDITÁVEL)
// ==========================================

window.dadosDrilldownDREAtual = [];
window.infoDrilldownDREAtual = {};

function abrirDrilldownDRE(tipo, parametroExtra = null) {
    const periodo = obterIntervaloDatasBI();
    const vendas = obterVendasDoPeriodo(periodo);
    const compras = obterComprasDoPeriodo(periodo);
    const despesasPagas = obterDespesasPagasDoPeriodo(periodo);

    let titulo = 'Detalhamento Analítico';
    let badgeTipo = 'DRE OFICIAL';
    let icone = 'fa-solid fa-file-invoice-dollar';
    let iconeCor = 'text-emerald-400';
    let listaItens = [];
    let corTotal = 'text-emerald-600 dark:text-emerald-400';

    switch (tipo) {
        case 'RECEITA_BRUTA':
            titulo = 'Detalhamento: Receita Operacional Bruta (Vendas & Serviços)';
            badgeTipo = 'ENTRADA DE VENDAS';
            icone = 'fa-solid fa-arrow-trend-up';
            iconeCor = 'text-emerald-400';
            corTotal = 'text-emerald-600 dark:text-emerald-400';
            listaItens = vendas.map(v => {
                const itensResumo = (v.itens || []).map(i => `${i.qtd || 1}x ${i.nome}`).slice(0, 3).join(', ') + ((v.itens || []).length > 3 ? '...' : '');
                const numPed = String(v.numeroPedido || v.id || '').padStart(4, '0');
                return {
                    data: v.data || v.dataVenda || v.criadoEm,
                    descricao: `Venda/Serviço #${numPed}${itensResumo ? ' (' + itensResumo + ')' : ''}`,
                    pessoa: v.clienteNome || 'Consumidor Final',
                    categoria: v.tipo === 'SERVIÇO' ? 'Prestação de Serviço' : 'Venda de Mercadorias',
                    centroCusto: v.vendedor ? `Vendedor: ${v.vendedor}` : 'Comercial / Loja',
                    metodo: v.pag || v.formaPagamento || 'À Vista',
                    banco: v.contaBancaria || 'PDV / Caixa',
                    valor: Number(v.tot || v.total || v.valor || 0),
                    badge: v.tipo === 'SERVIÇO' ? 'SERVIÇO' : 'VENDA',
                    corValor: 'text-emerald-600 dark:text-emerald-400'
                };
            });
            break;

        case 'DEDUCOES_TAXAS':
            titulo = 'Detalhamento: Deduções e Taxas de Meios de Pagamento';
            badgeTipo = 'DEDUÇÃO';
            icone = 'fa-solid fa-credit-card';
            iconeCor = 'text-red-400';
            corTotal = 'text-red-500 dark:text-red-400';
            listaItens = vendas.filter(v => Number(v.taxaValor || 0) > 0).map(v => {
                const numPed = String(v.numeroPedido || v.id || '').padStart(4, '0');
                return {
                    data: v.data || v.dataVenda || v.criadoEm,
                    descricao: `Taxa de Cartão / Maquininha (Venda #${numPed})`,
                    pessoa: `Operadora / Gateway (${v.pag || 'Cartão'})`,
                    categoria: 'Taxas Financeiras / Meios de Pgto',
                    centroCusto: 'Financeiro / Deduções',
                    metodo: v.pag || 'Cartão',
                    banco: 'Desconto Automático na Liquidação',
                    valor: Number(v.taxaValor || 0),
                    badge: 'TAXA PGTO',
                    corValor: 'text-red-500 dark:text-red-400'
                };
            });
            break;

        case 'RECEITA_LIQUIDA':
            titulo = 'Detalhamento: Receita Operacional Líquida (Vendas - Taxas)';
            badgeTipo = 'RECEITA LÍQUIDA';
            icone = 'fa-solid fa-scale-balanced';
            iconeCor = 'text-blue-400';
            corTotal = 'text-blue-600 dark:text-blue-400';
            listaItens = vendas.map(v => {
                const numPed = String(v.numeroPedido || v.id || '').padStart(4, '0');
                const bruto = Number(v.tot || v.total || v.valor || 0);
                const taxa = Number(v.taxaValor || 0);
                const liquido = bruto - taxa;
                return {
                    data: v.data || v.dataVenda || v.criadoEm,
                    descricao: `Pedido #${numPed} [Bruto: ${formatMoney(bruto)} | Taxas: -${formatMoney(taxa)}]`,
                    pessoa: v.clienteNome || 'Consumidor Final',
                    categoria: v.tipo === 'SERVIÇO' ? 'Serviço Líquido' : 'Mercadoria Líquida',
                    centroCusto: v.vendedor ? `Vend: ${v.vendedor}` : 'Comercial',
                    metodo: v.pag || 'À Vista',
                    banco: v.contaBancaria || 'PDV / Caixa',
                    valor: liquido,
                    badge: 'VALOR LÍQUIDO',
                    corValor: 'text-blue-600 dark:text-blue-400'
                };
            });
            break;

        case 'CMV':
            titulo = 'Detalhamento: Custo das Mercadorias Vendidas (CMV Analítico)';
            badgeTipo = 'CUSTO DE ESTOQUE';
            icone = 'fa-solid fa-boxes-stacked';
            iconeCor = 'text-amber-400';
            corTotal = 'text-red-500 dark:text-red-400';
            vendas.forEach(v => {
                const numPed = String(v.numeroPedido || v.id || '').padStart(4, '0');
                if (v.itens && v.itens.length > 0) {
                    v.itens.forEach(item => {
                        const qtd = Number(item.qtd || item.quantidade || 1);
                        const custoUn = Number(item.custo || item.custoUnit || 0);
                        const custoTotalItem = custoUn * qtd;
                        listaItens.push({
                            data: v.data || v.dataVenda || v.criadoEm,
                            descricao: `CMV: ${item.nome} (${qtd} un × ${formatMoney(custoUn)}) - Ref. Pedido #${numPed}`,
                            pessoa: `Cliente: ${v.clienteNome || 'Consumidor'}`,
                            categoria: 'Custo de Reposição de Mercadoria',
                            centroCusto: 'Estoque / Vendas',
                            metodo: 'Baixa de Kardex',
                            banco: 'Custo Direto',
                            valor: custoTotalItem,
                            badge: 'CMV ITEM',
                            corValor: 'text-red-500 dark:text-red-400'
                        });
                    });
                } else if (Number(v.custoTotal || 0) > 0) {
                    listaItens.push({
                        data: v.data || v.dataVenda || v.criadoEm,
                        descricao: `CMV Consolidado da Venda #${numPed}`,
                        pessoa: `Cliente: ${v.clienteNome || 'Consumidor'}`,
                        categoria: 'Custo de Mercadoria',
                        centroCusto: 'Estoque',
                        metodo: 'Baixa Geral',
                        banco: 'Custo Direto',
                        valor: Number(v.custoTotal || 0),
                        badge: 'CMV VENDA',
                        corValor: 'text-red-500 dark:text-red-400'
                    });
                }
            });
            break;

        case 'LUCRO_BRUTO':
            titulo = 'Detalhamento: Lucro Bruto Operacional (Margem de Contribuição)';
            badgeTipo = 'MARGEM BRUTA';
            icone = 'fa-solid fa-chart-pie';
            iconeCor = 'text-emerald-400';
            corTotal = 'text-emerald-600 dark:text-emerald-400';
            listaItens = vendas.map(v => {
                const numPed = String(v.numeroPedido || v.id || '').padStart(4, '0');
                const bruto = Number(v.tot || v.total || v.valor || 0);
                const taxa = Number(v.taxaValor || 0);
                const cmv = Number(v.custoTotal || 0);
                const margemBruta = bruto - taxa - cmv;
                return {
                    data: v.data || v.dataVenda || v.criadoEm,
                    descricao: `Margem Pedido #${numPed} [Bruto: ${formatMoney(bruto)} | CMV: ${formatMoney(cmv)} | Taxas: ${formatMoney(taxa)}]`,
                    pessoa: v.clienteNome || 'Consumidor Final',
                    categoria: 'Margem de Contribuição',
                    centroCusto: v.vendedor ? `Vend: ${v.vendedor}` : 'Comercial',
                    metodo: v.pag || 'À Vista',
                    banco: 'Resultado Operacional',
                    valor: margemBruta,
                    badge: margemBruta >= 0 ? 'MARGEM POSITIVA' : 'MARGEM NEGATIVA',
                    corValor: margemBruta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                };
            });
            break;

        case 'DESPESAS_OPERACIONAIS':
            titulo = 'Detalhamento: Despesas Operacionais, Fixas & Boletos Pagos';
            badgeTipo = 'CONTAS PAGAS';
            icone = 'fa-solid fa-money-bill-transfer';
            iconeCor = 'text-red-400';
            corTotal = 'text-red-500 dark:text-red-400';
            listaItens = despesasPagas.filter(d => {
                const cat = String(d.categoria || '').toLowerCase();
                return !(cat.includes('imposto') || cat.includes('das') || cat.includes('icms') || cat.includes('simples') || cat.includes('tributo'));
            }).map(d => {
                const docRef = [
                    d.ref || d.descricao || 'Despesa',
                    d.numNF ? `NF ${d.numNF}` : '',
                    d.numBoleto ? `Bol: ${d.numBoleto}` : ''
                ].filter(Boolean).join(' - ');
                return {
                    data: d.dataPagamento || d.data,
                    descricao: docRef,
                    pessoa: d.pessoa || 'Favorecido Não Informado',
                    categoria: d.categoria || 'Despesa Operacional',
                    centroCusto: d.centroCusto || 'Operacional',
                    metodo: d.metodoPagamento || 'Pago',
                    banco: d.banco || 'Conta Geral',
                    valor: Number(d.valorPago || d.valor || 0),
                    badge: 'PAGO',
                    corValor: 'text-red-500 dark:text-red-400'
                };
            });
            break;

        case 'IMPOSTOS':
            titulo = 'Detalhamento: Impostos e Tributos Pagos (DAS / Simples / ICMS)';
            badgeTipo = 'TRIBUTOS PAGOS';
            icone = 'fa-solid fa-building-columns';
            iconeCor = 'text-orange-400';
            corTotal = 'text-red-500 dark:text-red-400';
            listaItens = despesasPagas.filter(d => {
                const cat = String(d.categoria || '').toLowerCase();
                return cat.includes('imposto') || cat.includes('das') || cat.includes('icms') || cat.includes('simples') || cat.includes('tributo');
            }).map(d => {
                return {
                    data: d.dataPagamento || d.data,
                    descricao: `${d.ref || d.descricao || 'Guia de Impostos'} ${d.numNF ? '[Doc: ' + d.numNF + ']' : ''}`,
                    pessoa: d.pessoa || 'Receita Federal / Fazenda Estadual',
                    categoria: d.categoria || 'Impostos & Tributos',
                    centroCusto: d.centroCusto || 'Fiscal / Tributário',
                    metodo: d.metodoPagamento || 'Pago',
                    banco: d.banco || 'Conta Geral',
                    valor: Number(d.valorPago || d.valor || 0),
                    badge: 'IMPOSTO PAGO',
                    corValor: 'text-red-500 dark:text-red-400'
                };
            });
            break;

        case 'RESULTADO_LIQUIDO':
            titulo = 'Demonstrativo Consolidado do Resultado Líquido (Lucro Real)';
            badgeTipo = 'DRE CONSOLIDADO';
            icone = 'fa-solid fa-trophy';
            iconeCor = 'text-amber-400';
            const fatT = vendas.reduce((a, b) => a + Number(b.tot || b.total || b.valor || 0), 0);
            const taxT = vendas.reduce((a, b) => a + Number(b.taxaValor || 0), 0);
            const recL = fatT - taxT;
            const cmvT = vendas.reduce((a, b) => a + Number(b.custoTotal || 0), 0);
            const lucB = recL - cmvT;
            let despOp = 0; let impT = 0;
            despesasPagas.forEach(d => {
                const cat = String(d.categoria || '').toLowerCase();
                const v = Number(d.valorPago || d.valor || 0);
                if (cat.includes('imposto') || cat.includes('das') || cat.includes('icms') || cat.includes('simples') || cat.includes('tributo')) impT += v;
                else despOp += v;
            });
            const resL = lucB - despOp - impT;
            corTotal = resL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
            listaItens = [
                { data: periodo.fim.toISOString(), descricao: '(+) RECEITA OPERACIONAL BRUTA (Vendas & Serviços)', pessoa: `${vendas.length} vendas registradas`, categoria: 'Faturamento Bruto', centroCusto: 'Comercial', metodo: 'Todos os meios', banco: 'Consolidado', valor: fatT, badge: 'RECEITA (+)', corValor: 'text-emerald-600 dark:text-emerald-400' },
                { data: periodo.fim.toISOString(), descricao: '(-) Deduções e Taxas de Meios de Pagamento', pessoa: 'Operadoras de Cartão / Gateway', categoria: 'Deduções', centroCusto: 'Financeiro', metodo: 'Taxas retidas', banco: 'Retenção', valor: -taxT, badge: 'DEDUÇÃO (-)', corValor: 'text-red-500 dark:text-red-400' },
                { data: periodo.fim.toISOString(), descricao: '(=) RECEITA OPERACIONAL LÍQUIDA', pessoa: 'Resultado após deduções de taxas', categoria: 'Receita Líquida', centroCusto: 'Geral', metodo: '-', banco: '-', valor: recL, badge: 'SUBTOTAL (=)', corValor: 'text-blue-600 dark:text-blue-400' },
                { data: periodo.fim.toISOString(), descricao: '(-) Custo das Mercadorias Vendidas (CMV)', pessoa: 'Custo de reposição do estoque', categoria: 'CMV Direto', centroCusto: 'Estoque', metodo: 'Kardex', banco: 'Estoque', valor: -cmvT, badge: 'CMV (-)', corValor: 'text-red-500 dark:text-red-400' },
                { data: periodo.fim.toISOString(), descricao: '(=) LUCRO BRUTO OPERACIONAL (Margem de Contribuição)', pessoa: 'Sobra limpa das vendas para cobrir custos fixos', categoria: 'Margem Contribuição', centroCusto: 'Geral', metodo: '-', banco: '-', valor: lucB, badge: 'SUBTOTAL (=)', corValor: 'text-emerald-600 dark:text-emerald-400' },
                { data: periodo.fim.toISOString(), descricao: '(-) Despesas Operacionais, Fixas & Boletos Pagos', pessoa: 'Salários, aluguel, água, energia, fornecedores pagos', categoria: 'Despesas Fixas / Variáveis', centroCusto: 'Operacional / ADM', metodo: 'Boletos / PIX Pagos', banco: 'Contas Bancárias', valor: -despOp, badge: 'DESPESAS (-)', corValor: 'text-red-500 dark:text-red-400' },
                { data: periodo.fim.toISOString(), descricao: '(-) Impostos e Tributos Pagos (DAS / Simples)', pessoa: 'Receita Federal / Fazenda', categoria: 'Impostos', centroCusto: 'Fiscal', metodo: 'Guias Pagas', banco: 'Conta Bancária', valor: -impT, badge: 'IMPOSTOS (-)', corValor: 'text-red-500 dark:text-red-400' }
            ];
            break;

        case 'CATEGORIA':
            titulo = `Detalhamento: Despesas Pagas na Categoria "${parametroExtra}"`;
            badgeTipo = 'CATEGORIA PAGA';
            icone = 'fa-solid fa-tags';
            iconeCor = 'text-red-400';
            corTotal = 'text-red-500 dark:text-red-400';
            listaItens = despesasPagas.filter(d => (d.categoria || 'Sem Categoria') === parametroExtra).map(d => ({
                data: d.dataPagamento || d.data,
                descricao: `${d.ref || d.descricao || 'Despesa'} ${d.numNF ? '[NF ' + d.numNF + ']' : ''}`,
                pessoa: d.pessoa || 'Favorecido Não Informado',
                categoria: d.categoria || 'Sem Categoria',
                centroCusto: d.centroCusto || 'Operacional',
                metodo: d.metodoPagamento || 'Pago',
                banco: d.banco || 'Conta Geral',
                valor: Number(d.valorPago || d.valor || 0),
                badge: 'PAGO',
                corValor: 'text-red-500 dark:text-red-400'
            }));
            break;

        case 'CENTRO_CUSTO':
            titulo = `Detalhamento: Despesas Pagas no Centro de Custo "${parametroExtra}"`;
            badgeTipo = 'CENTRO DE CUSTO PAGO';
            icone = 'fa-solid fa-building';
            iconeCor = 'text-purple-400';
            corTotal = 'text-purple-600 dark:text-purple-400';
            listaItens = despesasPagas.filter(d => (d.centroCusto || 'Sem Centro de Custo') === parametroExtra).map(d => ({
                data: d.dataPagamento || d.data,
                descricao: `${d.ref || d.descricao || 'Despesa'} ${d.numNF ? '[NF ' + d.numNF + ']' : ''}`,
                pessoa: d.pessoa || 'Favorecido Não Informado',
                categoria: d.categoria || 'Sem Categoria',
                centroCusto: d.centroCusto || 'Centro de Custo',
                metodo: d.metodoPagamento || 'Pago',
                banco: d.banco || 'Conta Geral',
                valor: Number(d.valorPago || d.valor || 0),
                badge: 'PAGO',
                corValor: 'text-purple-500 dark:text-purple-400'
            }));
            break;

        case 'FAVORECIDO':
            titulo = `Detalhamento: Despesas Pagas para "${parametroExtra}"`;
            badgeTipo = 'FAVORECIDO PAGO';
            icone = 'fa-solid fa-users';
            iconeCor = 'text-indigo-400';
            corTotal = 'text-indigo-600 dark:text-indigo-400';
            listaItens = despesasPagas.filter(d => (d.pessoa || 'Sem Nome / Não Informado') === parametroExtra).map(d => ({
                data: d.dataPagamento || d.data,
                descricao: `${d.ref || d.descricao || 'Despesa'} ${d.numNF ? '[NF ' + d.numNF + ']' : ''}`,
                pessoa: d.pessoa || 'Favorecido',
                categoria: d.categoria || 'Sem Categoria',
                centroCusto: d.centroCusto || 'Operacional',
                metodo: d.metodoPagamento || 'Pago',
                banco: d.banco || 'Conta Geral',
                valor: Number(d.valorPago || d.valor || 0),
                badge: 'PAGO',
                corValor: 'text-indigo-500 dark:text-indigo-400'
            }));
            break;

        case 'FUNCIONARIO':
            titulo = `Extrato de Pagamentos ao Funcionário: "${parametroExtra}"`;
            badgeTipo = 'FOLHA DE PAGAMENTO PAGA';
            icone = 'fa-solid fa-user-tie';
            iconeCor = 'text-emerald-400';
            corTotal = 'text-emerald-600 dark:text-emerald-400';
            listaItens = despesasPagas.filter(d => {
                const pessoa = d.pessoa || 'Sem Nome / Não Informado';
                const catLower = (d.categoria || '').toLowerCase();
                const isFolha = catLower.includes('salário') || catLower.includes('salario') || catLower.includes('folha') || catLower.includes('pró-labore') || catLower.includes('pro-labore') || catLower.includes('pro labore');
                return pessoa === parametroExtra && isFolha;
            }).map(d => ({
                data: d.dataPagamento || d.data,
                descricao: `${d.ref || d.descricao || 'Pagamento de Salário/Folha'}`,
                pessoa: d.pessoa || 'Funcionário',
                categoria: d.categoria || 'Salários / Folha',
                centroCusto: d.centroCusto || 'RH / Pessoal',
                metodo: d.metodoPagamento || 'PIX / Transf',
                banco: d.banco || 'Conta Empresa',
                valor: Number(d.valorPago || d.valor || 0),
                badge: 'SALÁRIO PAGO',
                corValor: 'text-emerald-600 dark:text-emerald-400'
            }));
            break;

        case 'CLIENTE_VENDAS':
            titulo = `Histórico de Compras do Cliente: "${parametroExtra}"`;
            badgeTipo = 'VENDAS DO CLIENTE';
            icone = 'fa-solid fa-user-check';
            iconeCor = 'text-blue-400';
            corTotal = 'text-blue-600 dark:text-blue-400';
            listaItens = vendas.filter(v => (v.clienteNome || 'Consumidor') === parametroExtra).map(v => {
                const numPed = String(v.numeroPedido || v.id || '').padStart(4, '0');
                const itensResumo = (v.itens || []).map(i => `${i.qtd || 1}x ${i.nome}`).join(', ');
                return {
                    data: v.data || v.dataVenda || v.criadoEm,
                    descricao: `Pedido #${numPed}: ${itensResumo || 'Venda'}`,
                    pessoa: v.clienteNome || 'Cliente',
                    categoria: v.tipo || 'Venda',
                    centroCusto: v.vendedor ? `Vend: ${v.vendedor}` : 'Comercial',
                    metodo: v.pag || 'À Vista',
                    banco: v.contaBancaria || 'PDV / Caixa',
                    valor: Number(v.tot || v.total || v.valor || 0),
                    badge: 'COMPRA CLIENTE',
                    corValor: 'text-blue-600 dark:text-blue-400'
                };
            });
            break;

        case 'FORNECEDOR_COMPRAS':
            titulo = `Histórico de Compras com o Fornecedor: "${parametroExtra}"`;
            badgeTipo = 'COMPRAS FORNECEDOR';
            icone = 'fa-solid fa-truck';
            iconeCor = 'text-red-400';
            corTotal = 'text-red-500 dark:text-red-400';
            listaItens = compras.filter(c => (c.fornecedor || 'Desconhecido') === parametroExtra).map(c => {
                const itensResumo = (c.itens || []).map(i => `${i.qCom || 1}x ${i.nome}`).slice(0, 3).join(', ');
                return {
                    data: c.data || c.dataEmissao || c.criadoEm,
                    descricao: `NF/Pedido #${c.numeroNF || 'S/N'}${itensResumo ? ' (' + itensResumo + ')' : ''}`,
                    pessoa: c.fornecedor || 'Fornecedor',
                    categoria: 'Compra de Mercadoria / Matéria-Prima',
                    centroCusto: 'Estoque / Compras',
                    metodo: c.numeroNF === 'S/N' ? 'Entrada Manual' : 'XML NF-e',
                    banco: 'Contas a Pagar / Fornecedor',
                    valor: Number(c.totalNF || c.valor || 0),
                    badge: 'COMPRA FORNECEDOR',
                    corValor: 'text-red-500 dark:text-red-400'
                };
            });
            break;

        case 'PRODUTO_VENDAS':
            titulo = `Vendas do Produto: "${parametroExtra}"`;
            badgeTipo = 'CURVA ABC PRODUTO';
            icone = 'fa-solid fa-box-open';
            iconeCor = 'text-emerald-400';
            corTotal = 'text-emerald-600 dark:text-emerald-400';
            vendas.forEach(v => {
                const numPed = String(v.numeroPedido || v.id || '').padStart(4, '0');
                (v.itens || []).forEach(item => {
                    if (item.nome === parametroExtra) {
                        const qtd = Number(item.qtd || item.quantidade || 1);
                        const precoUn = Number(item.preco || 0);
                        listaItens.push({
                            data: v.data || v.dataVenda || v.criadoEm,
                            descricao: `Venda ${qtd} un × ${formatMoney(precoUn)} (Pedido #${numPed})`,
                            pessoa: `Cliente: ${v.clienteNome || 'Consumidor'}`,
                            categoria: 'Venda de Produto',
                            centroCusto: v.vendedor ? `Vend: ${v.vendedor}` : 'Comercial',
                            metodo: v.pag || 'À Vista',
                            banco: 'PDV / Caixa',
                            valor: qtd * precoUn,
                            badge: 'ITEM VENDIDO',
                            corValor: 'text-emerald-600 dark:text-emerald-400'
                        });
                    }
                });
            });
            break;

        case 'PRODUTO_COMPRAS':
            titulo = `Histórico de Compras do Produto: "${parametroExtra}"`;
            badgeTipo = 'COMPRAS PRODUTO';
            icone = 'fa-solid fa-cart-flatbed';
            iconeCor = 'text-indigo-400';
            corTotal = 'text-indigo-600 dark:text-indigo-400';
            compras.forEach(c => {
                (c.itens || []).forEach(item => {
                    if (item.nome === parametroExtra) {
                        const qtd = Number(item.qCom || item.qtd || 1);
                        const custoUn = Number(item.custoFinal || item.custoUnitOriginal || 0);
                        listaItens.push({
                            data: c.data || c.dataEmissao || c.criadoEm,
                            descricao: `Compra ${qtd} un × ${formatMoney(custoUn)} (NF/Ref: ${c.numeroNF || 'S/N'})`,
                            pessoa: `Fornecedor: ${c.fornecedor || 'Fornecedor'}`,
                            categoria: 'Reposição de Estoque',
                            centroCusto: 'Estoque / Compras',
                            metodo: c.numeroNF === 'S/N' ? 'Entrada Manual' : 'XML NF-e',
                            banco: 'Fornecedor',
                            valor: Number(item.vTotalItemNaNota || (custoUn * qtd)),
                            badge: 'COMPRA ITEM',
                            corValor: 'text-indigo-600 dark:text-indigo-400'
                        });
                    }
                });
            });
            break;
    }

    // Ordena por data mais recente se não for consolidação do DRE
    if (tipo !== 'RESULTADO_LIQUIDO') {
        listaItens.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
    }

    // Calcula totalizador
    const totalGeral = tipo === 'RESULTADO_LIQUIDO'
        ? (listaItens.find(x => x.descricao.startsWith('(=) RESULTADO'))?.valor || 0)
        : listaItens.reduce((acc, item) => acc + item.valor, 0);

    const mediaGeral = listaItens.length > 0 ? (totalGeral / listaItens.length) : 0;

    window.dadosDrilldownDREAtual = listaItens;
    window.infoDrilldownDREAtual = { tipo, titulo, badgeTipo, totalGeral, mediaGeral, corTotal, periodoLabel: periodo.label };

    // Atualiza modal header e cards
    document.getElementById('dre-drilldown-title').innerText = titulo;
    document.getElementById('dre-drilldown-badge-tipo').innerText = badgeTipo;
    document.getElementById('dre-drilldown-periodo').innerText = periodo.label;
    
    const iconWrap = document.getElementById('dre-drilldown-icon-wrap');
    if (iconWrap) iconWrap.className = `w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg md:text-xl ${iconeCor}`;
    const iconEl = document.getElementById('dre-drilldown-icon');
    if (iconEl) iconEl.className = icone;

    const cardTotal = document.getElementById('dre-drilldown-card-total');
    if (cardTotal) {
        cardTotal.innerText = formatMoney(totalGeral);
        cardTotal.className = `text-lg md:text-xl font-black ${corTotal}`;
    }

    const cardQtd = document.getElementById('dre-drilldown-card-qtd');
    if (cardQtd) cardQtd.innerText = `${listaItens.length} registros`;

    const cardMedia = document.getElementById('dre-drilldown-card-media');
    if (cardMedia) cardMedia.innerText = formatMoney(mediaGeral);

    const footerTotal = document.getElementById('dre-drilldown-footer-total');
    if (footerTotal) {
        footerTotal.innerText = formatMoney(totalGeral);
        footerTotal.className = `text-lg md:text-xl font-black ${corTotal}`;
    }

    const buscaInput = document.getElementById('dre-drilldown-busca');
    if (buscaInput) buscaInput.value = '';

    const countEl = document.getElementById('dre-drilldown-filtrados-count');
    if (countEl) countEl.innerText = `Exibindo todos os ${listaItens.length} registros`;

    renderLinhasDrilldownDRE(listaItens);

    const modal = document.getElementById('modal-detalhes-dre-drilldown');
    if (modal) modal.classList.remove('hidden');
}

function renderLinhasDrilldownDRE(lista) {
    const tbody = document.getElementById('dre-drilldown-tbody');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 dark:text-slate-400 italic"><i class="fa-solid fa-inbox text-3xl mb-2 block opacity-40"></i>Nenhum registro encontrado no período selecionado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const dataFmt = item.data ? (typeof formatData === 'function' ? formatData(item.data).split(' ')[0].replace(',', '') : String(item.data).split('T')[0].split('-').reverse().join('/')) : '-';
        const badgeSpan = item.badge ? `<span class="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ml-1 inline-block">${item.badge}</span>` : '';
        return `
            <tr class="dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-700">
                <td class="p-3 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">${dataFmt}</td>
                <td class="p-3 font-semibold text-slate-800 dark:text-slate-100">
                    <div>${item.descricao} ${badgeSpan}</div>
                </td>
                <td class="p-3 text-slate-700 dark:text-slate-300">${item.pessoa || '-'}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-xs">
                    <span class="font-medium text-slate-800 dark:text-slate-200">${item.categoria || '-'}</span>
                    <span class="text-[10px] text-slate-400 block">${item.centroCusto || '-'}</span>
                </td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-xs">
                    <span class="font-medium text-slate-700 dark:text-slate-300">${item.metodo || '-'}</span>
                    <span class="text-[10px] text-slate-400 block">${item.banco || '-'}</span>
                </td>
                <td class="p-3 text-right font-black ${item.corValor || 'text-slate-800 dark:text-slate-100'} whitespace-nowrap">
                    ${formatMoney(item.valor)}
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarTabelaDrilldownDRE() {
    const termo = (document.getElementById('dre-drilldown-busca')?.value || '').toLowerCase().trim();
    const dados = window.dadosDrilldownDREAtual || [];
    
    let filtrados = dados;
    if (termo) {
        filtrados = dados.filter(item => {
            return (
                (item.descricao && item.descricao.toLowerCase().includes(termo)) ||
                (item.pessoa && item.pessoa.toLowerCase().includes(termo)) ||
                (item.categoria && item.categoria.toLowerCase().includes(termo)) ||
                (item.centroCusto && item.centroCusto.toLowerCase().includes(termo)) ||
                (item.metodo && item.metodo.toLowerCase().includes(termo)) ||
                (item.banco && item.banco.toLowerCase().includes(termo)) ||
                (item.data && String(item.data).toLowerCase().includes(termo))
            );
        });
    }

    if (typeof ordenarListaAlfabeticamente === 'function') {
        filtrados = ordenarListaAlfabeticamente(filtrados, item => item.descricao || item.pessoa || item.categoria || '');
    } else {
        filtrados.sort((a, b) => (a.descricao || a.pessoa || '').localeCompare(b.descricao || b.pessoa || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }

    renderLinhasDrilldownDRE(filtrados);
    
    const countEl = document.getElementById('dre-drilldown-filtrados-count');
    if (countEl) {
        if (termo) {
            countEl.innerText = `Filtrados: ${filtrados.length} de ${dados.length}`;
        } else {
            countEl.innerText = `Exibindo todos os ${dados.length} registros`;
        }
    }
}

function fecharDrilldownDRE() {
    const modal = document.getElementById('modal-detalhes-dre-drilldown');
    if (modal) modal.classList.add('hidden');
}

function imprimirDrilldownDRE() {
    const info = window.infoDrilldownDREAtual || {};
    const tableEl = document.getElementById('dre-drilldown-table');
    if (!tableEl) return showToast('Tabela de dados não encontrada para impressão.', 'error');
    
    let empNome = db?.config?.empresa?.nome || 'FC Móveis';
    let logoHtml = db?.config?.empresa?.logo ? `<img src="${db.config.empresa.logo}" style="max-height: 50px; margin-bottom: 8px;">` : '';

    const htmlImpressao = `
        <div style="padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #000;">
            <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px;">
                ${logoHtml}
                <h2 style="font-size: 18px; margin: 0; text-transform: uppercase;">${empNome}</h2>
                <h3 style="font-size: 15px; margin: 6px 0 2px 0; color: #1e40af;">${info.titulo || 'Detalhamento Analítico'}</h3>
                <p style="font-size: 12px; color: #666; margin: 0;">Período: ${info.periodoLabel || '-'} | Total Consolidado: <b>${formatMoney(info.totalGeral || 0)}</b></p>
            </div>
            ${tableEl.outerHTML}
            <div style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 11px; color: #777; display: flex; justify-content: space-between;">
                <span>Auditoria Oficial: 100% Contas Pagas & Registros de Vendas Validados</span>
                <span>Emitido em: ${new Date().toLocaleString('pt-BR')}</span>
            </div>
        </div>
    `;
    printHtmlSeguro(htmlImpressao);
}

function exportarExcelDrilldownDRE() {
    const info = window.infoDrilldownDREAtual || {};
    const dados = window.dadosDrilldownDREAtual || [];
    if (dados.length === 0) return showToast('Nenhum dado para exportar.', 'info');

    let csv = [];
    csv.push(['Data', 'Descrição', 'Favorecido / Fornecedor / Cliente', 'Categoria', 'Centro de Custo', 'Método de Pagamento', 'Conta Bancária', 'Valor (R$)'].join(';'));

    dados.forEach(d => {
        const dataFmt = d.data ? (typeof formatData === 'function' ? formatData(d.data).split(' ')[0].replace(',', '') : String(d.data).split('T')[0]) : '-';
        csv.push([
            `"${dataFmt}"`,
            `"${(d.descricao || '').replace(/"/g, '""')}"`,
            `"${(d.pessoa || '').replace(/"/g, '""')}"`,
            `"${(d.categoria || '').replace(/"/g, '""')}"`,
            `"${(d.centroCusto || '').replace(/"/g, '""')}"`,
            `"${(d.metodo || '').replace(/"/g, '""')}"`,
            `"${(d.banco || '').replace(/"/g, '""')}"`,
            `"${Number(d.valor || 0).toFixed(2).replace('.', ',')}"`
        ].join(';'));
    });

    csv.push(['', '', '', '', '', '', 'TOTAL CONSOLIDADO', `"${Number(info.totalGeral || 0).toFixed(2).replace('.', ',')}"`].join(';'));

    let csvFile = new Blob(["\uFEFF" + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    link.href = window.URL.createObjectURL(csvFile);
    link.setAttribute("download", `DRE_Drilldown_${(info.badgeTipo || 'Relatorio').replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    showToast('Planilha Excel exportada com sucesso!', 'success');
}


// --- GRÁFICOS & INTELIGÊNCIA ANALÍTICA APEXCHARTS ---
window.graficoDespesasCategoriaInstance = null;
function renderGraficoDespesasCategoria(rankingCategorias) {
    const container = document.getElementById('grafico-despesas-categoria');
    if (!container) return;
    if (typeof ApexCharts === 'undefined') return;

    const entries = Object.keys(rankingCategorias || {})
        .map(k => ({ nome: k, val: rankingCategorias[k] }))
        .filter(c => c.val > 0)
        .sort((a, b) => b.val - a.val);

    if (entries.length === 0) {
        if (window.graficoDespesasCategoriaInstance) {
            window.graficoDespesasCategoriaInstance.destroy();
            window.graficoDespesasCategoriaInstance = null;
        }
        container.innerHTML = '<div class="text-xs text-slate-400 italic text-center py-8">Nenhuma despesa no período para exibir gráfico.</div>';
        return;
    }

    container.innerHTML = '';

    let nomes = [];
    let valores = [];
    if (entries.length <= 5) {
        nomes = entries.map(e => e.nome);
        valores = entries.map(e => Math.round(e.val * 100) / 100);
    } else {
        const top5 = entries.slice(0, 5);
        const outrasVal = entries.slice(5).reduce((acc, cur) => acc + cur.val, 0);
        nomes = [...top5.map(e => e.nome), 'Outras Categorias'];
        valores = [...top5.map(e => Math.round(e.val * 100) / 100), Math.round(outrasVal * 100) / 100];
    }

    const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';

    const options = {
        series: valores,
        labels: nomes,
        chart: {
            type: 'donut',
            height: 230,
            background: 'transparent',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
        },
        theme: { mode: isDark ? 'dark' : 'light' },
        colors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
        dataLabels: { enabled: false },
        legend: {
            position: 'bottom',
            fontSize: '11px',
            fontFamily: 'Inter, sans-serif',
            labels: { colors: isDark ? '#94a3b8' : '#64748b' },
            markers: { width: 8, height: 8, radius: 4 }
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            y: { formatter: val => formatMoney(val) }
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '68%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total Pago',
                            fontSize: '11px',
                            color: isDark ? '#94a3b8' : '#64748b',
                            formatter: () => formatMoney(valores.reduce((a, b) => a + b, 0))
                        },
                        value: {
                            fontSize: '14px',
                            fontWeight: 700,
                            color: isDark ? '#f8fafc' : '#1e293b',
                            formatter: val => formatMoney(Number(val))
                        }
                    }
                }
            }
        },
        stroke: { show: false }
    };

    if (window.graficoDespesasCategoriaInstance) {
        window.graficoDespesasCategoriaInstance.destroy();
        window.graficoDespesasCategoriaInstance = null;
    }

    window.graficoDespesasCategoriaInstance = new ApexCharts(container, options);
    window.graficoDespesasCategoriaInstance.render();
}

// --- CURVA ABC MULTIDIMENSIONAL & PARETO ---
window.curvaAbcModoAtual = 'faturamento';
window.graficoParetoInstance = null;

window.mudarModoCurvaABC = function(modo) {
    window.curvaAbcModoAtual = modo;
    
    const botoes = {
        'faturamento': document.getElementById('btn-abc-fat'),
        'qtd': document.getElementById('btn-abc-qtd'),
        'lucro': document.getElementById('btn-abc-lucro')
    };

    Object.keys(botoes).forEach(k => {
        const btn = botoes[k];
        if (!btn) return;
        if (k === modo) {
            btn.className = 'px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm transition-all flex items-center gap-1.5';
        } else {
            btn.className = 'px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-1.5';
        }
    });

    const colHeader = document.getElementById('col-header-abc-valor');
    if (colHeader) {
        if (modo === 'faturamento') colHeader.innerText = 'Faturamento Total';
        else if (modo === 'qtd') colHeader.innerText = 'Volume Total (Un)';
        else if (modo === 'lucro') colHeader.innerText = 'Lucro Bruto Real';
    }

    const subtituloPareto = document.getElementById('pareto-info-subtitulo');
    if (subtituloPareto) {
        if (modo === 'faturamento') subtituloPareto.innerText = 'Por Receita Financeira (80/15/5)';
        else if (modo === 'qtd') subtituloPareto.innerText = 'Por Volume / Giro de Peças';
        else if (modo === 'lucro') subtituloPareto.innerText = 'Por Margem Bruta Real em R$';
    }

    const periodo = obterIntervaloDatasBI();
    const vendas = obterVendasDoPeriodo(periodo);
    const fatTotal = vendas.reduce((a, b) => a + Number(b.tot || b.total || b.valor || 0), 0);
    renderCurvaABC(vendas, fatTotal);
};

function renderCurvaABC(vendasFiltradas, fatTotal) {
    const tbody = document.getElementById('tabela-curva-abc');
    if (!tbody) return;

    if (vendasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Nenhuma venda no período para gerar a Curva ABC.</td></tr>';
        if (window.graficoParetoInstance) {
            window.graficoParetoInstance.destroy();
            window.graficoParetoInstance = null;
        }
        const graficoEl = document.getElementById('grafico-curva-abc-pareto');
        if (graficoEl) graficoEl.innerHTML = '<div class="text-xs text-slate-400 italic text-center py-10">Nenhuma venda no período para traçar a Curva de Pareto</div>';
        return;
    }

    const modo = window.curvaAbcModoAtual || 'faturamento';

    // 1. Agrupar vendas por produto
    const rankingProd = {};
    const prodsMap = {};
    (db.produtos || []).forEach(p => { if (p && p.id) prodsMap[p.id] = p; });

    vendasFiltradas.forEach(v => {
        (v.itens || []).forEach(i => {
            const id = i.id || i.nome;
            if (!rankingProd[id]) {
                const prodRef = prodsMap[i.id];
                rankingProd[id] = {
                    id: id,
                    nome: i.nome || prodRef?.nome || 'Produto Sem Nome',
                    qtd: 0,
                    faturamento: 0,
                    custoTotal: 0,
                    lucro: 0
                };
            }
            const q = Number(i.qtd || 1);
            const pr = Number(i.preco || 0);
            const prodRef = prodsMap[i.id];
            const custoUnit = Number(i.custoUnitario || i.custo || prodRef?.custo || 0);

            rankingProd[id].qtd += q;
            rankingProd[id].faturamento += (pr * q);
            rankingProd[id].custoTotal += (custoUnit * q);
            rankingProd[id].lucro += ((pr - custoUnit) * q);
        });
    });

    const listaProdutos = Object.values(rankingProd);

    // 2. Definir métrica de ordenação
    listaProdutos.forEach(p => {
        if (modo === 'faturamento') {
            p.metricaValor = p.faturamento;
        } else if (modo === 'qtd') {
            p.metricaValor = p.qtd;
        } else {
            p.metricaValor = Math.max(0, p.lucro);
        }
    });

    const totalMetrica = listaProdutos.reduce((acc, p) => acc + p.metricaValor, 0);

    if (totalMetrica === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Total apurado zerado para a métrica selecionada.</td></tr>';
        return;
    }

    // Ordenar descrescente
    const produtosOrdenados = listaProdutos.sort((a, b) => b.metricaValor - a.metricaValor);

    // 3. Classificar A (80%), B (15%), C (5%)
    let acumulado = 0;
    let html = '';

    const paretoCategorias = [];
    const paretoValores = [];
    const paretoAcumulados = [];

    produtosOrdenados.forEach((p, idx) => {
        acumulado += p.metricaValor;
        const percAcumulado = (acumulado / totalMetrica) * 100;
        const percIndividual = (p.metricaValor / totalMetrica) * 100;

        let classe = 'C';
        let badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';

        if (percAcumulado <= 80 || (idx === 0 && percAcumulado > 80)) {
            classe = 'A';
            badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
        } else if (percAcumulado <= 95) {
            classe = 'B';
            badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
        }

        // Salva top 10 para o gráfico de Pareto
        if (idx < 10) {
            paretoCategorias.push(p.nome.length > 18 ? p.nome.slice(0, 16) + '...' : p.nome);
            paretoValores.push(Math.round(p.metricaValor * 100) / 100);
            paretoAcumulados.push(Math.round(percAcumulado * 10) / 10);
        }

        let textoMetrica = '';
        if (modo === 'faturamento') textoMetrica = formatMoney(p.faturamento);
        else if (modo === 'qtd') textoMetrica = `${p.qtd} un`;
        else textoMetrica = formatMoney(p.lucro);

        html += `
            <tr onclick="abrirDrilldownDRE('PRODUTO_VENDAS', '${p.nome.replace(/'/g, "\\'")}')" class="dark:hover:bg-slate-800 transition-colors cursor-pointer group" title="Clique para auditar vendas deste produto">
                <td class="p-3">
                    <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded text-xs font-bold border ${badgeColor}">${classe}</span>
                </td>
                <td class="p-3 font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${p.nome}</td>
                <td class="p-3 text-center text-slate-600 dark:text-slate-400 font-semibold">${p.qtd}</td>
                <td class="p-3 text-right font-bold text-slate-700 dark:text-slate-300">${textoMetrica} <span class="text-xs font-normal text-slate-400 block">${percIndividual.toFixed(1)}%</span></td>
                <td class="p-3 text-right text-slate-500 dark:text-slate-400 font-bold">${percAcumulado.toFixed(1)}%</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Renderiza Gráfico de Pareto
    renderGraficoParetoABC(paretoCategorias, paretoValores, paretoAcumulados, modo);
}

function renderGraficoParetoABC(categorias, valores, acumulados, modo) {
    const container = document.getElementById('grafico-curva-abc-pareto');
    if (!container) return;
    if (typeof ApexCharts === 'undefined') return;

    if (categorias.length === 0) {
        container.innerHTML = '';
        return;
    }

    const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';

    let nomeSerie1 = 'Faturamento (R$)';
    if (modo === 'qtd') nomeSerie1 = 'Qtd. Vendida';
    else if (modo === 'lucro') nomeSerie1 = 'Lucro Bruto (R$)';

    const options = {
        series: [
            {
                name: nomeSerie1,
                type: 'column',
                data: valores
            },
            {
                name: '% Acumulado (Pareto)',
                type: 'line',
                data: acumulados
            }
        ],
        chart: {
            height: 260,
            type: 'line',
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: 'Inter, sans-serif'
        },
        theme: { mode: isDark ? 'dark' : 'light' },
        stroke: {
            width: [0, 3],
            curve: 'smooth'
        },
        colors: ['#6366f1', '#10b981'],
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: '45%'
            }
        },
        dataLabels: {
            enabled: true,
            enabledOnSeries: [1],
            formatter: val => `${val}%`,
            style: {
                fontSize: '10px',
                fontWeight: 700,
                colors: [isDark ? '#34d399' : '#059669']
            },
            background: {
                enabled: true,
                foreColor: isDark ? '#0f172a' : '#ffffff',
                borderRadius: 2,
                padding: 3,
                opacity: 0.85
            }
        },
        labels: categorias,
        xaxis: {
            labels: {
                rotate: -20,
                style: {
                    colors: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '10px'
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: [
            {
                title: {
                    text: nomeSerie1,
                    style: { color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' }
                },
                labels: {
                    formatter: val => modo === 'qtd' ? `${Math.round(val)} un` : formatMoney(val),
                    style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '10px' }
                }
            },
            {
                opposite: true,
                max: 100,
                min: 0,
                title: {
                    text: '% Acumulado',
                    style: { color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' }
                },
                labels: {
                    formatter: val => `${val}%`,
                    style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '10px' }
                }
            }
        ],
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            labels: { colors: isDark ? '#94a3b8' : '#64748b' }
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            shared: true,
            intersect: false,
            y: {
                formatter: function (y, { seriesIndex }) {
                    if (seriesIndex === 0) {
                        return modo === 'qtd' ? `${y} un` : formatMoney(y);
                    }
                    return `${y}%`;
                }
            }
        }
    };

    if (window.graficoParetoInstance) {
        window.graficoParetoInstance.destroy();
        window.graficoParetoInstance = null;
    }

    window.graficoParetoInstance = new ApexCharts(container, options);
    window.graficoParetoInstance.render();
}

function renderSugestorCompras(vendasFiltradas, periodoObj) {
    const tbody = document.getElementById('tabela-sugestao-compras');
    if(!tbody) return;

    // Calcular quantos dias tem no período filtrado para achar a média diária
    let diasPeriodo = 30; // padrão
    if (periodoObj && periodoObj.inicio && periodoObj.fim) {
        const diffTime = Math.abs(periodoObj.fim - periodoObj.inicio);
        diasPeriodo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if(diasPeriodo === 0) diasPeriodo = 1;
    }

    // 1. Agrupar vendas por produto
    const vendaPorProduto = {};
    vendasFiltradas.forEach(v => {
        (v.itens || []).forEach(i => {
            if(!vendaPorProduto[i.id]) {
                vendaPorProduto[i.id] = { id: i.id, nome: i.nome, qtdVendida: 0 };
            }
            vendaPorProduto[i.id].qtdVendida += i.qtd;
        });
    });

    let html = '';
    const produtosApp = (typeof ordenarListaAlfabeticamente === 'function') ? ordenarListaAlfabeticamente(db.produtos || [], 'nome') : [...(db.produtos || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    const ALVO_DIAS_ESTOQUE = 30; // 30 dias de cobertura

    produtosApp.forEach(p => {
        if(p.tipo === 'Servico') return;

        const infoVenda = vendaPorProduto[p.id];
        if(!infoVenda) return;

        const mediaDiaria = infoVenda.qtdVendida / diasPeriodo;
        if(mediaDiaria <= 0) return;

        const estoqueAtual = Number(p.estoque) || 0;
        const autonomiaDias = estoqueAtual / mediaDiaria;
        
        if(autonomiaDias <= 15) {
            const estoqueIdeal = mediaDiaria * ALVO_DIAS_ESTOQUE;
            const sugestaoCompra = Math.ceil(estoqueIdeal - estoqueAtual);
            
            if(sugestaoCompra > 0) {
                let statusBadge = '';
                if(autonomiaDias <= 0) {
                    statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold border bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50"><i class="fa-solid fa-triangle-exclamation"></i> Ruptura</span>';
                } else if(autonomiaDias <= 7) {
                    statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold border bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50"><i class="fa-solid fa-fire"></i> Crítico</span>';
                } else {
                    statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold border bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"><i class="fa-solid fa-clock"></i> Atenção</span>';
                }

                html += `
                    <tr class="dark:hover:bg-slate-800 transition-colors">
                        <td class="p-3">${statusBadge}</td>
                        <td class="p-3 font-medium text-slate-800 dark:text-slate-200">${p.nome}</td>
                        <td class="p-3 text-center ${estoqueAtual <= 0 ? 'text-red-500 font-bold' : 'text-slate-600 dark:text-slate-400'}">${estoqueAtual}</td>
                        <td class="p-3 text-center text-slate-600 dark:text-slate-400">${mediaDiaria.toFixed(1)} un/dia</td>
                        <td class="p-3 text-center text-slate-600 dark:text-slate-400">${Math.floor(autonomiaDias)} dias</td>
                        <td class="p-3 text-right font-bold text-blue-600 dark:text-blue-400">Comprar ${sugestaoCompra} un</td>
                    </tr>
                `;
            }
        }
    });

    if(html === '') {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-emerald-600 dark:text-emerald-400 font-medium"><i class="fa-solid fa-check-circle mr-2"></i> Estoque saudável! Nenhuma necessidade de reposição urgente baseada nas vendas.</td></tr>';
    } else {
        tbody.innerHTML = html;
    }
}

// --- EVOLUÇÃO E HISTÓRICO DE CUSTOS & ALERTA DE INFLAÇÃO ---
window.selecionarProdutoCustoBusca = function(nomeOuId) {
    if (!nomeOuId) return;
    const prods = db.produtos || [];
    const termo = String(nomeOuId).toLowerCase().trim();
    const match = prods.find(p => String(p.id) === String(nomeOuId) || String(p.nome).toLowerCase() === termo)
               || prods.find(p => String(p.nome).toLowerCase().includes(termo));
    if (match) {
        const hiddenEl = document.getElementById('relatorio-custo-produto');
        const inputEl = document.getElementById('busca-produto-custo');
        if (hiddenEl) hiddenEl.value = match.id;
        if (inputEl) inputEl.value = match.nome;
        renderEvolucaoCustos();
    }
};

function renderAlertaTopAumentosCusto(comprasDoPeriodo) {
    const container = document.getElementById('container-top-aumentos-custo');
    if (!container) return;

    const comprasPorProd = {};
    (db.compras || []).forEach(c => {
        (c.itens || []).forEach(item => {
            const pId = String(item.idMatch || item.id || item.nome);
            const pNome = item.nome || 'Produto';
            if (!comprasPorProd[pId]) comprasPorProd[pId] = { id: pId, nome: pNome, historico: [] };
            comprasPorProd[pId].historico.push({
                data: c.data || c.dataEmissao || c.criadoEm,
                custo: Number(item.custoFinal || item.custoUnitOriginal || item.custo || 0)
            });
        });
    });

    const aumentos = [];
    Object.values(comprasPorProd).forEach(p => {
        if (p.historico.length >= 2) {
            p.historico.sort((a, b) => new Date(a.data) - new Date(b.data));
            const primeiro = p.historico[0].custo;
            const ultimo = p.historico[p.historico.length - 1].custo;
            if (primeiro > 0 && ultimo > primeiro) {
                const diff = ultimo - primeiro;
                const pct = (diff / primeiro) * 100;
                aumentos.push({
                    id: p.id,
                    nome: p.nome,
                    aumentoPct: pct,
                    diff: diff,
                    atual: ultimo
                });
            }
        }
    });

    aumentos.sort((a, b) => b.aumentoPct - a.aumentoPct);
    const top3 = aumentos.slice(0, 3);

    if (top3.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="p-3.5 bg-slate-100 dark:bg-slate-900 border border-amber-300/80 dark:border-amber-500/40 rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <i class="fa-solid fa-arrow-trend-up text-sm"></i>
                </span>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-800 dark:text-slate-100 text-xs">Alerta de Inflação de Insumos</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300">Radar de Custos</span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Maior reajuste de preço de custo unitário entre compras consecutivas no período:</p>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                ${top3.map(item => `
                    <button onclick="selecionarProdutoCustoBusca('${item.nome.replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shadow-xs group cursor-pointer" title="Ver histórico de custos de ${item.nome}">
                        <span class="truncate max-w-[130px] text-slate-700 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400">${item.nome}</span>
                        <span class="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-[11px] font-black border border-red-200 dark:border-red-900/60">+${item.aumentoPct.toFixed(0)}%</span>
                    </button>
                `).join('')}
                <button onclick="abrirInfoRelatorio('inflacao_custos')" class="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer text-sm p-1" title="Entenda o Alerta de Inflação">
                    <i class="fa-solid fa-circle-question"></i>
                </button>
            </div>
        </div>
    `;
}

function renderEvolucaoCustos() {
    const prodId = document.getElementById('relatorio-custo-produto')?.value;
    const prodNome = document.getElementById('busca-produto-custo')?.value?.toLowerCase()?.trim() || '';
    const tbody = document.getElementById('tabela-evolucao-custos');
    if(!tbody) return;
    
    if(!prodId && !prodNome) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Selecione um produto acima para ver o histórico.</td></tr>';
        return;
    }

    let historico = [];
    (db.compras || []).forEach(compra => {
        (compra.itens || []).forEach(item => {
            const matchId = prodId && (String(item.idMatch) === String(prodId) || String(item.id) === String(prodId));
            const matchNome = prodNome && String(item.nome || '').toLowerCase().trim() === prodNome;
            if (matchId || matchNome) {
                historico.push({
                    data: compra.data || compra.dataEmissao || compra.criadoEm,
                    fornecedor: compra.fornecedor || 'Fornecedor Não Informado',
                    ref: compra.numeroNF || compra.ref || 'S/N',
                    qtd: item.qCom || item.qtd || 0,
                    custo: item.custoFinal || item.custoUnitOriginal || item.custo || 0
                });
            }
        });
    });

    historico.sort((a, b) => new Date(a.data) - new Date(b.data));

    let lastCost = null;
    historico.forEach(h => {
        if (lastCost === null) {
            h.variacao = 0; h.variacaoPercent = 0; h.isFirst = true;
        } else {
            h.variacao = h.custo - lastCost;
            h.variacaoPercent = lastCost > 0 ? (h.variacao / lastCost) * 100 : 0;
            h.isFirst = false;
        }
        lastCost = h.custo;
    });

    historico.reverse();

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Nenhuma compra registrada para este produto.</td></tr>';
        return;
    }

    tbody.innerHTML = historico.map(h => {
        let variacaoHtml = '<span class="text-slate-400 font-bold">-</span>';
        if (!h.isFirst) {
            if (h.variacao > 0) {
                variacaoHtml = `<span class="text-red-500 font-bold" title="Aumento de ${formatMoney(h.variacao)}"><i class="fa-solid fa-arrow-trend-up"></i> +${h.variacaoPercent.toFixed(1)}%</span>`;
            } else if (h.variacao < 0) {
                variacaoHtml = `<span class="text-emerald-500 font-bold" title="Queda de ${formatMoney(Math.abs(h.variacao))}"><i class="fa-solid fa-arrow-trend-down"></i> ${h.variacaoPercent.toFixed(1)}%</span>`;
            } else {
                variacaoHtml = `<span class="text-slate-400 font-bold"><i class="fa-solid fa-equals"></i> 0%</span>`;
            }
        }

        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
            <td class="p-3 text-xs text-slate-500 dark:text-slate-400">${formatData(h.data).split(' ')[0]}</td>
            <td class="p-3 font-bold text-slate-700 dark:text-slate-200">${h.fornecedor} <br><span class="font-normal text-[10px] text-slate-400">NF/Ref: ${h.ref === 'S/N' ? 'Sem NF' : h.ref}</span></td>
            <td class="p-3 text-center font-bold text-slate-600 dark:text-slate-300">${h.qtd} un</td>
            <td class="p-3 text-right font-black text-indigo-600">${formatMoney(h.custo)}</td>
            <td class="p-3 text-right">${variacaoHtml}</td>
        </tr>`;
    }).join('');
}

// ==========================================
// RELATÓRIO DE ESTOQUE & KARDEX DE MOVIMENTAÇÕES
// ==========================================
function renderRelatorioEstoqueKardex() {
    const card = document.getElementById('card-estoque-kardex');
    if (!card) return;

    // 1. KPIs de Valoração de Estoque
    const produtos = (db.produtos || []).filter(p => p.tipo !== 'Servico');
    let totalItens = 0;
    let custoTotal = 0;
    let vendaTotal = 0;

    produtos.forEach(p => {
        const est = Number(p.estoque || 0);
        if (est > 0) {
            totalItens += est;
            const cUnit = Number(p.custo || p.custoUnit || 0);
            const pUnit = Number(p.preco || p.precoVenda || 0);
            custoTotal += (est * cUnit);
            vendaTotal += (est * pUnit);
        }
    });

    const lucroProjetado = vendaTotal - custoTotal;
    const margemProjetada = vendaTotal > 0 ? ((lucroProjetado / vendaTotal) * 100) : 0;

    const elItens = document.getElementById('kardex-kpi-total-itens');
    if (elItens) elItens.innerText = `${totalItens} un`;

    const elCusto = document.getElementById('kardex-kpi-custo-total');
    if (elCusto) elCusto.innerText = formatMoney(custoTotal);

    const elVenda = document.getElementById('kardex-kpi-venda-total');
    if (elVenda) elVenda.innerText = formatMoney(vendaTotal);

    const elLucro = document.getElementById('kardex-kpi-lucro-projetado');
    if (elLucro) {
        elLucro.innerText = formatMoney(lucroProjetado);
        elLucro.className = `text-xl font-black ${lucroProjetado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`;
    }

    const elMargem = document.getElementById('kardex-kpi-margem-projetada');
    if (elMargem) {
        elMargem.innerText = `Margem projetada: ${margemProjetada.toFixed(1)}%`;
    }

    // 2. Renderizar Tabela do Kardex com filtros
    filtrarKardexRelatorio();
}

function filtrarKardexRelatorio() {
    const tbody = document.getElementById('tabela-relatorio-kardex');
    if (!tbody) return;

    const inputBusca = document.getElementById('kardex-busca-produto');
    const selectTipo = document.getElementById('kardex-filtro-tipo');
    const contadorEl = document.getElementById('kardex-contador-registros');

    const termo = inputBusca ? inputBusca.value.trim().toLowerCase() : '';
    const filtroTipo = selectTipo ? selectTipo.value : 'TODOS';

    let movimentacoes = (db.movimentacoes || []);

    if (!movimentacoes || movimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400"><i class="fa-solid fa-inbox text-2xl mb-2 text-slate-400 block"></i>Nenhuma movimentação registrada no Kardex até o momento.</td></tr>';
        if (contadorEl) contadorEl.innerText = '0 movimentações';
        return;
    }

    // Mapa de saldos atuais de produtos para exibir saldo em estoque
    const mapaEstoque = {};
    (db.produtos || []).forEach(p => {
        if (p.id) mapaEstoque[String(p.id)] = Number(p.estoque || 0);
        if (p.nome) mapaEstoque[String(p.nome).toLowerCase()] = Number(p.estoque || 0);
    });

    const filtradas = movimentacoes.filter(m => {
        // Filtro por tipo
        const tipoStr = String(m.tipo || '').toUpperCase();
        if (filtroTipo === 'ENTRADA' && !tipoStr.includes('ENTRADA') && !tipoStr.includes('COMPRA')) return false;
        if (filtroTipo === 'SAIDA' && !tipoStr.includes('SAIDA') && !tipoStr.includes('VENDA')) return false;
        if (filtroTipo === 'AJUSTE' && !tipoStr.includes('AJUSTE') && !tipoStr.includes('BALANÇO') && !tipoStr.includes('BALANCO') && !tipoStr.includes('PERDA')) return false;

        // Filtro por busca de texto (produto, ref, id)
        if (termo) {
            const pNome = String(m.prodNome || m.produtoNome || '').toLowerCase();
            const ref = String(m.ref || m.doc || '').toLowerCase();
            const pId = String(m.prodId || m.produtoId || '').toLowerCase();
            if (!pNome.includes(termo) && !ref.includes(termo) && !pId.includes(termo)) return false;
        }

        return true;
    });

    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400"><i class="fa-solid fa-filter-circle-xmark text-2xl mb-2 text-slate-400 block"></i>Nenhuma movimentação encontrada para os filtros aplicados.</td></tr>';
        if (contadorEl) contadorEl.innerText = `0 movim.${termo || filtroTipo !== 'TODOS' ? ' (filtradas)' : ''}`;
        return;
    }

    // Limite de exibicao configuravel (padrao: 10 primeiras movimentacoes)
    const selectLimiteK = document.getElementById('kardex-filtro-limite');
    const limiteKardex = selectLimiteK ? (selectLimiteK.value === 'TODOS' ? Infinity : (parseInt(selectLimiteK.value, 10) || 10)) : 10;
    const listaExibir = filtradas.slice(0, limiteKardex);

    if (contadorEl) {
        if (filtradas.length > listaExibir.length) {
            contadorEl.innerText = `${filtradas.length} movim. (exibindo ${listaExibir.length})`;
        } else {
            contadorEl.innerText = `${filtradas.length} movim.${termo || filtroTipo !== 'TODOS' ? ' (filtradas)' : ''}`;
        }
    }

    tbody.innerHTML = listaExibir.map(m => {
        const tipoStr = String(m.tipo || '').toUpperCase();
        let badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        let badgeIcon = 'fa-solid fa-arrow-right-arrow-left';

        if (tipoStr.includes('ENTRADA') || tipoStr.includes('COMPRA')) {
            badgeClass = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50';
            badgeIcon = 'fa-solid fa-arrow-down';
        } else if (tipoStr.includes('VENDA') || tipoStr.includes('SAIDA')) {
            badgeClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50';
            badgeIcon = 'fa-solid fa-arrow-up';
        } else if (tipoStr.includes('AJUSTE') || tipoStr.includes('BALANÇO') || tipoStr.includes('BALANCO')) {
            badgeClass = 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
            badgeIcon = 'fa-solid fa-sliders';
        } else if (tipoStr.includes('PERDA')) {
            badgeClass = 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/50';
            badgeIcon = 'fa-solid fa-triangle-exclamation';
        }

        const qtdNum = Number(m.qtd || 0);
        const corQtd = qtdNum > 0 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : (qtdNum < 0 ? 'text-rose-500 font-bold' : 'text-slate-500');
        const sinalQtd = qtdNum > 0 ? `+${qtdNum}` : `${qtdNum}`;

        const pNome = m.prodNome || m.produtoNome || 'Produto';
        const pId = m.prodId || m.produtoId;
        const saldoAtual = (pId && mapaEstoque[String(pId)] !== undefined)
            ? mapaEstoque[String(pId)]
            : (mapaEstoque[String(pNome).toLowerCase()] !== undefined ? mapaEstoque[String(pNome).toLowerCase()] : '-');

        let dataFormatada = '-';
        try {
            if (m.data) {
                const dt = new Date(m.data);
                if (!isNaN(dt.getTime())) {
                    dataFormatada = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                } else {
                    dataFormatada = String(m.data);
                }
            }
        } catch (e) {
            dataFormatada = String(m.data || '-');
        }

        return `
            <tr class="dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800">
                <td class="p-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">${dataFormatada}</td>
                <td class="p-3 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeClass}">
                        <i class="${badgeIcon} text-[10px]"></i> ${m.tipo || 'MOVIMENTAÇÃO'}
                    </span>
                </td>
                <td class="p-3 text-slate-800 dark:text-slate-100 font-medium">
                    <div class="truncate max-w-xs sm:max-w-md font-semibold">${pNome}</div>
                </td>
                <td class="p-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">${m.ref || m.doc || '-'}</td>
                <td class="p-3 text-right whitespace-nowrap ${corQtd} text-sm">${sinalQtd}</td>
                <td class="p-3 text-right whitespace-nowrap font-bold text-slate-700 dark:text-slate-300">${saldoAtual !== '-' ? saldoAtual + ' un' : '-'}</td>
            </tr>
        `;
    }).join('') + (filtradas.length > listaExibir.length ? `<tr><td colspan="6" class="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900">Exibindo as primeiras ${listaExibir.length} movimentações de ${filtradas.length}. Use os filtros acima para refinar.</td></tr>` : '');
}

window.filtrarKardexRelatorio = filtrarKardexRelatorio;
window.renderRelatorioEstoqueKardex = renderRelatorioEstoqueKardex;

function navegarParaKardex(event) {
    if (event) event.preventDefault();
    if (typeof mudarVisaoLocal === 'function') {
        mudarVisaoLocal('relatorios');
    }
    const card = document.getElementById('card-estoque-kardex');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.classList.add('ring-4', 'ring-indigo-500/50');
        setTimeout(() => {
            card.classList.remove('ring-4', 'ring-indigo-500/50');
        }, 2000);
    }
}
window.navegarParaKardex = navegarParaKardex;

// Se a página for aberta com âncora #card-estoque-kardex ou view=estoque, rola diretamente
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.location.hash === '#card-estoque-kardex' || window.location.search.includes('view=estoque')) {
            navegarParaKardex();
        }
    }, 400);
});

// --- EXPORTAÇÃO EXECUTIVA EM PDF ---
window.exportarRelatorioExecutivoPDF = function() {
    if (typeof html2pdf === 'undefined') {
        showToast('Biblioteca de PDF não disponível.', 'error');
        return;
    }

    const periodoTexto = document.getElementById('bi-filtro-periodo')?.selectedOptions[0]?.text || 'Período Atual';
    const empresaNome = document.getElementById('menu-empresa-nome')?.innerText || db?.config?.empresa?.nome || 'FC Móveis';

    const printArea = document.getElementById('print-area-relatorios');
    if (!printArea) {
        showToast('Área de relatório não localizada.', 'error');
        return;
    }

    showToast('Gerando Relatório Executivo em PDF...', 'info');

    const wrapper = document.createElement('div');
    wrapper.style.padding = '20px';
    wrapper.style.fontFamily = 'Inter, sans-serif';
    wrapper.style.color = '#0f172a';
    wrapper.style.backgroundColor = '#ffffff';

    const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 18px;">
            <div>
                <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">${empresaNome}</h1>
                <p style="font-size: 12px; color: #475569; margin: 3px 0 0 0; font-weight: 600;">Relatório Executivo & DRE Gerencial Completo</p>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 11px; font-weight: 700; color: #1d4ed8; background: #dbeafe; padding: 4px 12px; border-radius: 9999px; display: inline-block;">Período: ${periodoTexto}</span>
                <p style="font-size: 10px; color: #94a3b8; margin: 5px 0 0 0;">Emitido em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    `;

    const clone = printArea.cloneNode(true);
    clone.querySelectorAll('.no-print, button, input, datalist, #busca-produto-custo, #grafico-curva-abc-pareto, #grafico-despesas-categoria-container').forEach(el => el.remove());

    wrapper.innerHTML = headerHtml;
    wrapper.appendChild(clone);

    const opt = {
        margin: [8, 8, 8, 8],
        filename: `Relatorio_Executivo_${empresaNome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(wrapper).save().then(() => {
        showToast('Relatório Executivo em PDF gerado com sucesso!', 'success');
    }).catch(err => {
        console.error('Erro ao gerar PDF:', err);
        showToast('Erro ao exportar PDF.', 'error');
    });
};

// --- IMPRESSÃO INDIVIDUAL DE CADA RELATÓRIO SEPARADO ---
window.imprimirRelatorioIndividual = function(containerId, tituloRelatorio) {
    const elCheck = document.getElementById(containerId);
    if (elCheck) {
        const relIdCheck = elCheck.getAttribute('data-relatorio-id');
        if (relIdCheck && typeof window.verificarAcessoRelatorio === 'function' && !window.verificarAcessoRelatorio(relIdCheck)) {
            if (typeof showToast === 'function') showToast("Este relatório não está disponível no seu plano atual.", "warning");
            return;
        }
    }
    const el = document.getElementById(containerId);
    if (!el) {
        showToast("Relatório não encontrado para impressão.", "error");
        return;
    }

    let empNome = "FC Gestão Comercial";
    if (db && db.config && db.config.empresa && db.config.empresa.nome) {
        empNome = db.config.empresa.nome;
    }
    let logoHtml = "";
    if (db && db.config && db.config.empresa && db.config.empresa.logo) {
        logoHtml = `<img src="${db.config.empresa.logo}" style="max-height: 48px; margin-bottom: 6px; border-radius: 6px;">`;
    }

    const periodoFiltro = document.getElementById('bi-filtro-periodo')?.selectedOptions[0]?.text || 'Período Atual';
    const dataIni = document.getElementById('bi-data-inicio')?.value || '';
    const dataFim = document.getElementById('bi-data-fim')?.value || '';
    let datasDesc = periodoFiltro;
    if (dataIni && dataFim) {
        const d1 = dataIni.split('-').reverse().join('/');
        const d2 = dataFim.split('-').reverse().join('/');
        datasDesc += ` (${d1} a ${d2})`;
    }

    // Clonar elemento para manipular sem alterar a tela
    const clone = el.cloneNode(true);

    // Remover botões, inputs, abas e controles interativos da cópia
    clone.querySelectorAll('button, input, select, datalist, .no-print, .print\\:hidden, #busca-produto-custo, #container-top-aumentos-custo, #alerta-centro-custo-pendente').forEach(node => node.remove());

    // Ajustar classes de grid
    clone.classList.remove('md:col-span-2', 'col-span-2');

    // Ajustar card caso seja o Raio-X (que tem fundo escuro denso para papel)
    if (containerId === 'card-raio-x-executivo') {
        clone.className = "p-4 rounded-xl border border-slate-300 bg-white text-slate-900";
        clone.querySelectorAll('.bg-slate-800\\/80, .bg-slate-900').forEach(c => {
            c.className = "p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800";
        });
        clone.querySelectorAll('.text-white, .text-slate-300, .text-slate-400').forEach(t => {
            t.classList.remove('text-white', 'text-slate-300', 'text-slate-400');
            t.classList.add('text-slate-700');
        });
    }

    const htmlCompleto = `
        <div style="padding: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #0f172a;">
            <!-- Cabeçalho Oficial de Impressão -->
            <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    ${logoHtml}
                    <h2 style="font-size: 18px; font-weight: 800; margin: 0; color: #0f172a; text-transform: uppercase;">${empNome}</h2>
                    <h3 style="font-size: 14px; font-weight: 700; margin: 3px 0 0 0; color: #2563eb;">${tituloRelatorio || 'Relatório Gerencial Oficial'}</h3>
                </div>
                <div style="text-align: right; font-size: 11px; color: #475569;">
                    <div><b>Filtro / Período:</b> ${datasDesc}</div>
                    <div><b>Emissão:</b> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>

            <!-- Conteúdo do Relatório Formatado -->
            <div class="relatorio-impressao-conteudo">
                ${clone.innerHTML}
            </div>

            <!-- Rodapé Oficial -->
            <div style="margin-top: 25px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
                <span>FC Gestão - Sistema de Gestão Empresarial e Comercial</span>
                <span>Documento emitido para conferência e auditoria interna</span>
            </div>
        </div>
    `;

    printHtmlSeguro(htmlCompleto);
};

async function analisarFinanceiroIA() {
    const vendas = db.vendas || [];
    const fatTotal = vendas.reduce((a, b) => a + b.tot, 0); 
    const cmvTotal = vendas.reduce((a, b) => a + (b.custoTotal || 0), 0); 
    const lucroReal = fatTotal - cmvTotal - vendas.reduce((a, b) => a + (b.taxaValor || 0), 0);
    const despesasPendentes = db.financeiro.filter(f => f.tipo === 'DESPESA' && f.status === 'PENDENTE').reduce((a,b)=>a+b.valor,0);
    const receitasPendentes = db.financeiro.filter(f => f.tipo === 'RECEITA' && f.status === 'PENDENTE').reduce((a,b)=>a+b.valor,0);

    const prompt = `Você é um CFO rigoroso analisando uma loja varejista de móveis. Analise os seguintes números mensais exatos:
    - Faturamento Bruto: R$ ${fatTotal.toFixed(2)}
    - Custo de Mercadorias (CMV): R$ ${cmvTotal.toFixed(2)}
    - Lucro Líquido Parcial: R$ ${lucroReal.toFixed(2)}
    - Contas a Pagar (Atrasadas/Pendentes): R$ ${despesasPendentes.toFixed(2)}
    - Contas a Receber (Inadimplência/Pendentes): R$ ${receitasPendentes.toFixed(2)}
    
    Aja como o consultor financeiro do gestor. Forneça exatamente 3 insights práticos e executáveis para melhorar o caixa. Seja direto ao ponto. Use marcadores (bullet points). Não use formatação markdown como asteriscos duplos.`;

    const btn = document.getElementById('btn-ia-fin');
    const divRes = document.getElementById('resultado-ia-fin');
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> O Gemini está pensando...';
    btn.disabled = true;
    divRes.classList.remove('hidden');
    divRes.innerHTML = 'Cruzando dados de faturamento, estoque e contas. Aguarde alguns segundos...';

    const resposta = await chamarGemini(prompt);
    
    if(resposta) {
        divRes.innerHTML = resposta.replace(/\*\*/g, '').replace(/\*/g, '•');
        showToast('Análise concluída com sucesso!', 'success');
    } else {
        divRes.innerHTML = 'Erro ao gerar análise por Inteligência Artificial. Verifique se o módulo de IA está ativo no seu plano ou contate o suporte.';
    }

    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refazer Análise';
    btn.disabled = false;
}

function exportarDadosParaIA() {
    if (!db) return showToast("Nenhum dado financeiro carregado.", "error");

    const vendas = db.vendas || [];
    const financeiro = db.financeiro || [];
    const produtos = db.produtos || [];

    let receitaBruta = vendas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    let custoTotal = vendas.reduce((acc, v) => {
        return acc + (v.itens || []).reduce((subAcc, item) => {
            const prod = produtos.find(p => p.id === item.id || p.nome === item.nome);
            return subAcc + ((prod ? (Number(prod.custo) || 0) : 0) * (Number(item.quantidade) || 1));
        }, 0);
    }, 0);

    let lucroBruto = receitaBruta - custoTotal;

    let relatorioTexto = `=== RELATÓRIO FINANCEIRO E DE GESTÃO - FC MÓVEIS ===\nData da exportação: ${new Date().toLocaleString('pt-BR')}\n\n`;
    relatorioTexto += `--- 1. DRE SIMPLIFICADA ---\n- Receita Bruta Total: R$ ${receitaBruta.toFixed(2)}\n- Custo da Mercadoria Vendida (CMV): R$ ${custoTotal.toFixed(2)}\n- Lucro Bruto Real: R$ ${lucroBruto.toFixed(2)}\n\n`;
    relatorioTexto += `--- 2. HISTÓRICO DE VENDAS RECENTES ---\n`;
    vendas.slice(-20).forEach((v, index) => { relatorioTexto += `[Venda ${index + 1}] Data: ${v.data || 'N/A'} | Total: R$ ${Number(v.total || 0).toFixed(2)} | Forma de Pagamento: ${v.pagamento || 'N/A'}\n`; });
    relatorioTexto += `\n--- 3. MOVIMENTAÇÕES FINANCEIRAS / CAIXA ---\n`;
    financeiro.slice(-20).forEach((f, index) => { relatorioTexto += `[Movimento ${index + 1}] Tipo: ${f.tipo || 'N/A'} | Descrição: ${f.descricao || 'N/A'} | Valor: R$ ${Number(f.valor || 0).toFixed(2)} | Data: ${f.data || 'N/A'}\n`; });

    const blob = new Blob([relatorioTexto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `resumo_financeiro_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast("Relatório baixado com sucesso! Basta enviar para a IA.", "success");
}




function abrirInfoRelatorio(tipo) {
    const titleEl = document.getElementById('modal-info-title');
    const contentEl = document.getElementById('modal-info-content');
    const modal = document.getElementById('modal-info-relatorio');
    
    if(!titleEl || !contentEl || !modal) return;

    let titulo = '';
    let conteudo = '';

    switch(tipo) {
        case 'historico_vendas':
            titulo = 'Relatório & Histórico Gerencial de Vendas';
            conteudo = `
                <div class="space-y-4">
                    <p class="text-slate-700 dark:text-slate-200 font-medium">Este relatório gerencial detalha com precisão cirúrgica a lucratividade real de cada venda e serviço prestado pela sua empresa:</p>
                    
                    <div class="p-3 bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-sack-dollar"></i> Lucro Líquido Real por Venda
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Diferença entre o valor recebido pelo cliente e os custos diretos da mercadoria (CMV) somados às taxas de maquininhas de cartão ou intermediadores. Revela o lucro verdadeiro que cada pedido injetou no seu caixa.</p>
                    </div>

                    <div class="p-3 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-file-invoice-dollar"></i> DRE por Pedido (Auditoria Item a Item)
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Ao clicar no ícone de visualização (olho) de qualquer venda, você acessa a ficha contábil do pedido com margens, markups, desconto aplicado e comprovante anexado, permitindo auditar a performance dos seus vendedores.</p>
                    </div>

                    <div class="p-3 bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-filter"></i> Filtros Segmentados
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Permite cruzar vendas por forma de pagamento (PIX, Cartão, Dinheiro), tipo de operação (Venda vs Serviço) e períodos personalizados para conciliação contábil.</p>
                    </div>
                </div>
            `;
            break;

        case 'raio_x':
            titulo = 'Raio-X Diagnóstico Executivo & Termômetro de Equilíbrio';
            conteudo = `
                <div class="space-y-4">
                    <p class="text-slate-700 dark:text-slate-200 font-medium">Este painel sintetiza os 4 indicadores vitais de sobrevivência, lucratividade e saúde do negócio no período selecionado:</p>
                    
                    <div class="p-3 bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-chart-pie"></i> 1. Margem de Contribuição
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">É a sobra bruta das vendas após descontar o Custo das Mercadorias Vendidas (CMV) e as taxas de meios de pagamento (cartão/PIX). É o dinheiro real que entra no caixa para pagar as despesas fixas (aluguel, equipe, luz) e gerar o lucro.</p>
                    </div>

                    <div class="p-3 bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-scale-balanced"></i> 2. Ponto de Equilíbrio (Break-Even / Zero a Zero)
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Indica exatamente quanto sua empresa precisa faturar para cobrir <b>100% de todas as despesas operacionais e tributos</b> sem ter nem lucro nem prejuízo.</p>
                    </div>

                    <div class="p-3 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-gauge-high"></i> 3. Termômetro de Equilíbrio
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Mede o progresso em direção ao ponto de equilíbrio. Ao atingir <b>100%</b>, todas as contas do mês já foram pagas e cada nova venda gera puro lucro líquido.</p>
                    </div>

                    <div class="p-3 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-trophy"></i> 4. Margem Líquida Real
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Percentual de eficiência financeira. Revela quantos reais de cada R$ 100,00 vendidos sobraram limpos no caixa após abater rigorosamente todas as saídas, taxas, salários e impostos.</p>
                    </div>
                </div>
            `;
            break;

        case 'dre':
            titulo = 'DRE - Demonstrativo do Resultado do Exercício';
            conteudo = `
                <div class="space-y-4">
                    <p class="text-slate-700 dark:text-slate-200 font-medium">O DRE Gerencial demonstra passo a passo como o faturamento bruto é consumido por custos operacionais até a formação do <b>Lucro Líquido Real</b>.</p>
                    
                    <div class="p-3 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-percent"></i> Como interpretar a coluna AV (%) - Análise Vertical?
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">A Análise Vertical revela qual percentual da sua <b>Receita Líquida (Base 100%)</b> foi absorvido por cada linha contábil. Exemplo: se o CMV for 42%, significa que para cada R$ 100 vendidos, R$ 42 foram para pagar fornecedores.</p>
                    </div>

                    <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                        <div class="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Estrutura de Linhas:</div>
                        <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                            <li><b>(+) Receita Operacional Bruta:</b> Total faturado em vendas e serviços antes de deduções.</li>
                            <li><b>(-) Deduções e Taxas:</b> Descontos comerciais e taxas de cartões/maquininhas.</li>
                            <li><b>(=) Receita Operacional Líquida:</b> O faturamento efetivo que entra no caixa (base 100%).</li>
                            <li><b>(-) CMV:</b> Custo das Mercadorias Vendidas (custo de aquisição dos itens vendidos).</li>
                            <li><b>(=) Lucro Bruto Operacional:</b> A margem de contribuição restante para cobrir despesas fixas.</li>
                            <li><b>(-) Despesas Operacionais:</b> Boletos pagos, salários, aluguel, luz e manutenção.</li>
                            <li><b>(-) Impostos e Tributos:</b> Guias fiscais pagas no período (DAS / Simples Nacional).</li>
                            <li><b>(=) Resultado Líquido:</b> O lucro real e auditável que sobra no caixa.</li>
                        </ul>
                    </div>

                    <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <i class="fa-solid fa-lightbulb text-emerald-500 text-base"></i>
                        <span><b>Dica de Auditoria:</b> Clique em qualquer linha do DRE para abrir o extrato analítico com todos os lançamentos individuais!</span>
                    </div>
                </div>
            `;
            break;

        case 'curva_abc':
        case 'curva_abc_produtos':
            titulo = 'Curva ABC Multidimensional & Gráfico de Pareto';
            conteudo = `
                <div class="space-y-4">
                    <p class="text-slate-700 dark:text-slate-200 font-medium">A Curva ABC classifica o catálogo de produtos aplicando o <b>Princípio de Pareto (80/15/5)</b> para foco máximo em quem realmente traz resultado:</p>
                    
                    <div class="space-y-2">
                        <div class="p-2.5 bg-emerald-50 dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-xs">
                            <span class="font-black text-emerald-600 dark:text-emerald-400">Classe A (80% do Total):</span>
                            <p class="text-slate-600 dark:text-slate-300 mt-0.5">Produtos vitais e mais estratégicos. <b>Nunca podem faltar no estoque</b>, pois respondem por 80% do desempenho.</p>
                        </div>
                        <div class="p-2.5 bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 rounded-xl text-xs">
                            <span class="font-black text-amber-600 dark:text-amber-400">Classe B (15% do Total):</span>
                            <p class="text-slate-600 dark:text-slate-300 mt-0.5">Produtos intermediários com giro moderado. Manter compras equilibradas.</p>
                        </div>
                        <div class="p-2.5 bg-rose-50 dark:bg-slate-900 border border-rose-300 dark:border-rose-800/60 rounded-xl text-xs">
                            <span class="font-black text-rose-600 dark:text-rose-400">Classe C (5% do Total):</span>
                            <p class="text-slate-600 dark:text-slate-300 mt-0.5">A maioria dos itens do catálogo, mas que somados geram apenas 5% do resultado. Evite empatar capital de giro com estoque elevado deles.</p>
                        </div>
                    </div>

                    <div class="p-3 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-indigo-700 dark:text-indigo-400 text-xs flex items-center gap-1.5">
                            <i class="fa-solid fa-layer-group"></i> 3 Modos de Análise pelas Abas:
                        </div>
                        <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                            <li><b>Faturamento:</b> Classifica pelos produtos que trouxeram maior receita bruta em dinheiro.</li>
                            <li><b>Qtd. Vendida:</b> Classifica pelo volume físico de unidades vendidas (giro de balcão).</li>
                            <li><b>Lucro Bruto:</b> Classifica pelo lucro real que cada produto deixou (faturamento menos CMV).</li>
                        </ul>
                    </div>

                    <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                        <div class="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-chart-line text-indigo-500"></i> Como ler o Gráfico de Pareto?
                        </div>
                        <p>As <b>barras azuis</b> mostram a contribuição individual dos 10 primeiros produtos e a <b>linha vermelha pontilhada</b> mostra o percentual acumulado. Ao atingir 80%, identifica-se com precisão os itens campeões.</p>
                    </div>
                </div>
            `;
            break;

        case 'inflacao_custos':
            titulo = 'Alerta de Inflação de Insumos & Histórico de Custos';
            conteudo = `
                <div class="space-y-4">
                    <p class="text-slate-700 dark:text-slate-200 font-medium">O radar de inflação analisa automaticamente todas as notas e pedidos de compra e compara preços unitários de aquisição:</p>
                    
                    <div class="p-3 bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-arrow-trend-up text-red-500"></i> Identificação Automática de Reajustes
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Quando você compra o mesmo insumo mais de uma vez e o preço de custo sobe entre uma compra e outra, o sistema destaca no topo do painel os itens com maiores aumentos percentuais.</p>
                    </div>

                    <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                        <div class="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Ações Estratégicas Recomendadas:</div>
                        <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                            <li><b>Renegociar com o Fornecedor:</b> Apresente os preços das compras anteriores para contestar reajustes excessivos.</li>
                            <li><b>Recalcular o Preço de Venda:</b> Se o custo unitário subiu e o preço de venda continuou igual, a sua margem de lucro diminuiu. Atualize o valor de venda no catálogo.</li>
                            <li><b>Buscar Alternativas:</b> Cote com fornecedores concorrentes antes de emitir a próxima ordem de compra.</li>
                        </ul>
                    </div>
                </div>
            `;
            break;

        case 'despesas_centro_custo':
        case 'centro_custo_alerta':
            titulo = 'Despesas por Centro de Custo & Auditoria';
            conteudo = `
                <div class="space-y-4">
                    <p class="text-slate-700 dark:text-slate-200 font-medium">O Centro de Custo permite saber exatamente qual área ou setor da empresa está demandando mais recursos financeiros:</p>
                    
                    <div class="p-3 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-building"></i> Gestão por Departamento
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Permite dividir contas entre setores como <b>Administração, Vendas/Loja, Produção/Fábrica, Logística</b> ou filiais, avaliando o retorno operacional de cada centro.</p>
                    </div>

                    <div class="p-3 bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-triangle-exclamation text-amber-500"></i> Alerta de Despesas Sem Centro de Custo
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Se o alerta amarelo aparecer, significa que existem títulos lançados sem atribuição de departamento. Clique em <b>Auditar</b> para listar as contas pendentes e atribuir o Centro de Custo correspondente.</p>
                    </div>
                </div>
            `;
            break;

        case 'top_vendas':
        case 'curva_abc_vendas':
            titulo = 'Curva ABC de Vendas (Top Produtos Campeões)';
            conteudo = '<p class="mb-2">Ranking dos produtos mais vendidos e que geraram maior volume de receita para a loja no período selecionado.</p><p class="text-xs text-slate-500 dark:text-slate-400">Ajuda a identificar com precisão os itens mais procurados e manter estoques ajustados à demanda real.</p>';
            break;

        case 'top_compras':
            titulo = 'Top Compras (Investimento em Estoque)';
            conteudo = '<p class="mb-2">Mostra quais foram os produtos em que você <b>mais investiu dinheiro</b> comprando de fornecedores no período selecionado.</p><p class="text-xs text-slate-500 dark:text-slate-400">Ajuda a entender para onde está indo o caixa da empresa na hora da reposição.</p>';
            break;

        case 'top_clientes':
            titulo = 'Top Clientes (Concentração de Faturamento)';
            conteudo = '<p class="mb-2">Ranking dos clientes que <b>mais trouxeram faturamento</b> para a loja.</p><p class="text-xs text-slate-500 dark:text-slate-400">Ideal para identificar clientes VIPs, oferecer condições exclusivas e ações de fidelização.</p>';
            break;

        case 'top_fornecedores':
            titulo = 'Top Fornecedores (Parceiros de Compra)';
            conteudo = '<p class="mb-2">Ranking dos fornecedores de quem você <b>mais comprou</b> (em R$).</p><p class="text-xs text-slate-500 dark:text-slate-400">Útil para saber com quem você tem maior poder de barganha para negociar prazos maiores ou descontos.</p>';
            break;

        case 'evolucao_custos':
            titulo = 'Evolução e Histórico de Custos por Produto';
            conteudo = '<p class="mb-2">Permite selecionar um produto específico e auditar o <b>histórico cronológico de preços pagos por ele</b> nas compras registradas.</p><p class="text-xs text-slate-500 dark:text-slate-400">Excelente para identificar se a inflação está corroendo sua margem ou se um fornecedor reajustou o valor unitário.</p>';
            break;

        case 'sugestao_compras':
            titulo = 'Sugestão Inteligente de Reposição de Estoque';
            conteudo = '<p class="mb-3">O sistema analisa a velocidade média diária com que cada produto foi vendido no período e cruza com o saldo em estoque:</p><ul class="list-disc pl-5 space-y-2 text-xs text-slate-600 dark:text-slate-300"><li><b>Autonomia:</b> Quantos dias seu estoque atual vai durar no ritmo atual de vendas.</li><li><b>Sugestão de Compra:</b> Quantidade exata recomendada para cobrir os próximos 30 dias de demanda.</li><li><b>Ruptura:</b> Estoque zerado com perda iminente de vendas.</li><li><b>Crítico:</b> Estoque vai acabar em menos de 7 dias.</li></ul>';
            break;

        case 'estatisticas_compras':
            titulo = 'Estatísticas Gerais de Compras';
            conteudo = '<p>Resumo consolidado do volume de compras no período: total de notas/pedidos, ticket médio por compra e total de unidades físicas adquiridas.</p>';
            break;

        case 'despesas_categoria':
            titulo = 'Despesas por Categoria';
            conteudo = '<p>Agrupa todas as despesas operacionais pelas categorias cadastradas (Aluguel, Folha, Impostos, Energia). Facilita enxergar onde o dinheiro está sendo gasto e planejar cortes de despesas.</p>';
            break;

        case 'despesas_favorecido':
            titulo = 'Despesas por Favorecido';
            conteudo = '<p>Lista os maiores recebedores de pagamentos da empresa, auxiliando a auditar concentração de pagamentos em prestadores ou empresas parceiras.</p>';
            break;

        case 'despesas_funcionario':
            titulo = 'Despesas por Funcionário (Folha & Encargos)';
            conteudo = '<p>Demonstra os custos associados a cada colaborador da equipe, incluindo salários, comissões e despesas vinculadas para controle da folha de pagamento.</p>';
            break;

        case 'estoque_kardex':
            titulo = 'Relatório de Estoque & Kardex de Movimentações';
            conteudo = `
                <div class="space-y-4">
                    <p class="text-slate-700 dark:text-slate-200 font-medium">Este relatório consolida a <b>valoração contábil do inventário</b> da empresa e o <b>Kardex cronológico e auditável</b> de todas as movimentações de mercadorias:</p>

                    <div class="p-3 bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-sack-dollar"></i> Custo Imobilizado (Capital em Estoque)
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Representa a soma de todo o dinheiro da empresa que está fisicamente investido em produtos nas prateleiras, calculado pelo preço unitário de custo pago aos fornecedores.</p>
                    </div>

                    <div class="p-3 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-cash-register"></i> Valor Potencial de Venda & Margem Projetada
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Indica a receita bruta potencial se todos os produtos em estoque forem vendidos pelo preço atual de tabela. A diferença direta entre o valor de venda e o custo imobilizado indica o lucro bruto que o estoque irá render.</p>
                    </div>

                    <div class="p-3 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-1">
                        <div class="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-boxes-stacked"></i> A Ficha Kardex e a Auditoria de Estoque
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">O Kardex é o livro de registro contábil de movimentações físicas. Cada entrada (compra por nota fiscal ou lançamento manual), saída (venda no PDV) ou ajuste de inventário fica carimbado com data, hora, usuário, documento de origem e quantidade (+ ou -). É a ferramenta fundamental para auditorias e combate a perdas e divergências de estoque.</p>
                    </div>
                </div>
            `;
            break;
    }

    titleEl.innerHTML = titulo;
    contentEl.innerHTML = conteudo;
    modal.classList.remove('hidden');
}


// ==========================================
// HISTÓRICO DE VENDAS (GESTÃO) & AUDITORIA DE LUCRO
// ==========================================

function mudarPeriodoVendas(render = true) {
    const p = document.getElementById('filtro-vendas-periodo') ? document.getElementById('filtro-vendas-periodo').value : null;
    const customDiv = document.getElementById('vendas-datas-custom');
    const ini = document.getElementById('filtro-vendas-ini');
    const fim = document.getElementById('filtro-vendas-fim');
    
    if(!p || !ini || !fim) return;
    
    if(p === 'CUSTOM') {
        if(customDiv) customDiv.classList.remove('hidden');
        return;
    }
    
    if(customDiv) customDiv.classList.add('hidden');
    const hoje = new Date();
    
    const setDates = (d1, d2) => {
        ini.value = d1.toISOString().split('T')[0];
        fim.value = d2.toISOString().split('T')[0];
    };
    
    if(p === 'MES') {
        setDates(new Date(hoje.getFullYear(), hoje.getMonth(), 1), new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
    } else if (p === 'HOJE') {
        setDates(hoje, hoje);
    } else if (p === 'ONTEM') {
        const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
        setDates(ontem, ontem);
    } else if (p === '7') {
        const d = new Date(hoje); d.setDate(hoje.getDate() - 7);
        setDates(d, hoje);
    } else if (p === '30') {
        const d = new Date(hoje); d.setDate(hoje.getDate() - 30);
        setDates(d, hoje);
    } else if (p === 'MES_ANT') {
        setDates(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), new Date(hoje.getFullYear(), hoje.getMonth(), 0));
    } else if (p === 'ANO') {
        setDates(new Date(hoje.getFullYear(), 0, 1), new Date(hoje.getFullYear(), 11, 31));
    } else if (p === 'TUDO') {
        ini.value = ''; fim.value = '';
    }
    
    if(render && typeof renderVendas === 'function') renderVendas();
}

function renderVendas() {
    const buscaEl = document.getElementById('busca-vendas'); 
    const dataIniEl = document.getElementById('filtro-vendas-ini'); 
    const dataFimEl = document.getElementById('filtro-vendas-fim'); 
    const pgtoEl = document.getElementById('filtro-vendas-pgto'); 
    const tipoEl = document.getElementById('filtro-vendas-tipo');
    
    const termo = buscaEl && buscaEl.value ? String(buscaEl.value).toLowerCase().trim() : ''; 
    const dataIni = dataIniEl ? dataIniEl.value : ''; 
    const dataFim = dataFimEl ? dataFimEl.value : ''; 
    const pgto = pgtoEl ? pgtoEl.value : 'TODOS'; 
    const tipoFiltro = tipoEl ? tipoEl.value : 'TODOS';
    
    let filtrados = db.vendas || [];
    filtrados = filtrados.filter(v => v.tipo !== 'ORÇAMENTO');
    
    if (tipoFiltro === 'VENDAS') filtrados = filtrados.filter(v => v.tipo === 'VENDA' || !v.tipo);
    if (tipoFiltro === 'SERVIÇOS') filtrados = filtrados.filter(v => v.tipo === 'SERVIÇO');
    if (termo) filtrados = filtrados.filter(v => (v.clienteNome && String(v.clienteNome).toLowerCase().includes(termo)) || (v.numeroPedido && String(v.numeroPedido).includes(termo)) || (v.vendedor && String(v.vendedor).toLowerCase().includes(termo)));
    if (pgto !== 'TODOS') filtrados = filtrados.filter(v => v.pag && String(v.pag).includes(pgto));
    if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() >= dIni); }
    if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() <= dFim); }
    
    filtrados.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));
    window.vendasFiltradasAtuais = filtrados;

    let totalLucro = 0;
    let totalFaturamento = 0;
    let totalCusto = 0;
    
    const limiteVendasEl = document.getElementById('filtro-vendas-limite');
    const limiteVendas = limiteVendasEl ? (limiteVendasEl.value === 'TODOS' ? Infinity : (parseInt(limiteVendasEl.value, 10) || 10)) : 10;
    const vendasExibir = filtrados.slice(0, limiteVendas);

    const tbody = document.getElementById('tabela-vendas-body');
    if (tbody) {
        tbody.innerHTML = vendasExibir.map(v => {
            try {
                const fatVenda = Number(v.tot || v.total || v.valor || 0);
                const custoTotalDaVenda = (Number(v.custoTotal) || 0) + (Number(v.taxaValor) || 0); 
                const lucroDaVenda = fatVenda - custoTotalDaVenda; 
                const margemDaVenda = (fatVenda > 0) ? ((lucroDaVenda / fatVenda) * 100) : 0;
                const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0'); 
                
                totalFaturamento += fatVenda;
                totalCusto += custoTotalDaVenda;
                totalLucro += lucroDaVenda;
                
                const dataRender = v.data && typeof formatData === 'function' ? formatData(v.data).replace(',', '') : (v.data || '-'); 
                const clienteRender = v.clienteNome || 'Consumidor'; 
                const vendRender = v.vendedor || '-'; 
                const pagRender = v.pag || '-';
                
                const badgeTipo = v.tipo === 'SERVIÇO' ? '<span class="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1 whitespace-nowrap">SERVIÇO</span><br>' : '<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1 whitespace-nowrap">VENDA</span><br>';
                
                return `
                <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                    <td class="p-3 text-slate-500 dark:text-slate-400 text-xs">${dataRender}</td>
                    <td class="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">${badgeTipo}#${numPedStr}</td>
                    <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${clienteRender} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
                    <td class="p-3"><span class="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">${pagRender}</span></td>
                    <td class="p-3 text-right font-black text-slate-700 dark:text-slate-200">${typeof formatMoney === 'function' ? formatMoney(fatVenda) : fatVenda}</td>
                    <td class="p-3 text-right font-bold text-red-500">-${typeof formatMoney === 'function' ? formatMoney(custoTotalDaVenda) : custoTotalDaVenda}</td>
                    <td class="p-3 text-right">
                        <div class="font-black text-emerald-600">${typeof formatMoney === 'function' ? formatMoney(lucroDaVenda) : lucroDaVenda}</div>
                        <div class="text-[10px] text-blue-500 dark:text-blue-400 font-bold mt-0.5">${margemDaVenda.toFixed(1)}% Margem</div>
                    </td>
                    <td class="p-3 text-center no-print">
                        <button type="button" onclick="verDetalhesVenda('${v.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer" title="Ver Detalhes do Documento">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </td>
                </tr>`;
            } catch (e) { console.error(e); return ''; }
        }).join('') || '<tr><td colspan="8" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum registro encontrado com os filtros atuais.</td></tr>';
    }

    const margemGeral = totalFaturamento > 0 ? ((totalLucro / totalFaturamento) * 100) : 0;

    // Atualiza mini KPIs do card
    const kpiQtdEl = document.getElementById('vendas-card-kpi-qtd');
    if (kpiQtdEl) kpiQtdEl.innerText = `${filtrados.length} ${filtrados.length === 1 ? 'pedido' : 'pedidos'}`;

    const kpiFatEl = document.getElementById('vendas-card-kpi-total');
    if (kpiFatEl) kpiFatEl.innerText = typeof formatMoney === 'function' ? formatMoney(totalFaturamento) : `R$ ${totalFaturamento.toFixed(2)}`;

    const kpiCustoEl = document.getElementById('vendas-card-kpi-custo');
    if (kpiCustoEl) kpiCustoEl.innerText = typeof formatMoney === 'function' ? formatMoney(totalCusto) : `R$ ${totalCusto.toFixed(2)}`;

    const kpiLucroEl = document.getElementById('vendas-card-kpi-lucro');
    if (kpiLucroEl) kpiLucroEl.innerText = typeof formatMoney === 'function' ? formatMoney(totalLucro) : `R$ ${totalLucro.toFixed(2)}`;

    const kpiMargemEl = document.getElementById('vendas-card-kpi-margem');
    if (kpiMargemEl) kpiMargemEl.innerText = `Margem média: ${margemGeral.toFixed(1)}%`;

    const contadorEl = document.getElementById('vendas-contador-registros');
    if (contadorEl) {
        if (typeof vendasExibir !== 'undefined' && filtrados.length > vendasExibir.length) {
            contadorEl.innerText = `${filtrados.length} vendas (exibindo ${vendasExibir.length})`;
        } else {
            contadorEl.innerText = `${filtrados.length} ${filtrados.length === 1 ? 'venda' : 'vendas'}`;
        }
    }

    if (document.getElementById('vendas-total-filtros')) {
        document.getElementById('vendas-total-filtros').innerText = `Lucro Real Acumulado: ${typeof formatMoney === 'function' ? formatMoney(totalLucro) : totalLucro}`;
    }
}

function verDetalhesVenda(id) {
    const v = (db.vendas || []).find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    window.__vendaDetalheAtual = v;
    const btnIni = document.getElementById('btn-iniciar-edicao-custo');
    if (btnIni) btnIni.classList.remove('hidden');
    const acoesEdicao = document.getElementById('acoes-edicao-custo');
    if (acoesEdicao) acoesEdicao.classList.add('hidden');
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    let tipoTexto = v.tipo || 'VENDA';
    
    const cliEl = document.getElementById('det-venda-cliente');
    const dataEl = document.getElementById('det-venda-data');
    const pagEl = document.getElementById('det-venda-pag');
    if (cliEl) cliEl.innerText = v.clienteNome || 'Consumidor'; 
    if (dataEl) dataEl.innerText = `${v.data ? (typeof formatData === 'function' ? formatData(v.data).split(' ')[0] : v.data) : '-'} | #${numPedStr}`; 
    if (pagEl) pagEl.innerText = tipoTexto === 'ORÇAMENTO' ? 'Orçamento' : (v.pag || '-'); 
    
    let osInfoHtml = '';
    if (tipoTexto === 'SERVIÇO' && v.servicoDetalhes) {
        let galeriaHtml = '';
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) { 
            galeriaHtml = `<p class="mt-2"><strong>Fotos de Referência:</strong></p><div class="flex gap-2 flex-wrap mt-1">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" onclick="abrirZoom('${f}')" class="h-20 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`).join('')}</div>`; 
        } else if (v.servicoDetalhes.foto) { 
            galeriaHtml = `<p class="mt-2"><strong>Foto de Referência:</strong></p><img src="${v.servicoDetalhes.foto}" onclick="abrirZoom('${v.servicoDetalhes.foto}')" class="mt-1 h-24 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`; 
        }
        osInfoHtml = `
            <div class="mt-4 bg-purple-50 dark:bg-purple-900/20 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800/50 text-xs md:text-sm text-purple-900 dark:text-purple-200">
                <h4 class="font-bold mb-2 uppercase text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800/50 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Serviço</h4>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <p><strong>Prazo de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'Não informado'}</p>
                    <p><strong>Garantia:</strong> ${v.servicoDetalhes.garantia || 'Nenhuma'}</p>
                </div>
                <p class="mb-2"><strong>Escopo / Diagnóstico:</strong><br> ${v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}</p>
                ${galeriaHtml}
            </div>`;
    }
    
    const obsEl = document.getElementById('det-venda-obs');
    if (obsEl) {
        obsEl.innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observação geral vinculada a esta venda.</span>') + osInfoHtml;
    }
    
    let totalCusto = 0;
    const itensEl = document.getElementById('det-venda-itens');
    if (itensEl) {
        itensEl.innerHTML = (v.itens || []).map(i => {
            const preco = Number(i.preco) || 0;
            const qtd = Number(i.qtd) || 1;
            const custo = Number(i.custo) || 0;
            
            const subTot = preco * qtd;
            const subCusto = custo * qtd;
            const lucroSub = subTot - subCusto;
            const margemSub = subTot > 0 ? ((lucroSub / subTot) * 100) : 0;
            
            totalCusto += subCusto;
            
            return `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors group">
                <td class="p-4 border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${i.nome || 'Produto/Serviço'}</div>
                    ${i.obsVenda ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md"><i class="fa-solid fa-note-sticky mr-1"></i>${i.obsVenda}</div>` : ''}
                </td>
                <td class="p-4 text-center border-b border-slate-100 dark:border-slate-800/50">
                    <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700">${qtd}</span>
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-black text-slate-700 dark:text-slate-300 text-sm">${typeof formatMoney === 'function' ? formatMoney(preco) : preco}</div>
                    <div class="text-[10px] text-red-500/80 dark:text-red-400/80 font-bold mt-0.5 bg-red-50 dark:bg-red-900/20 inline-block px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800/30">Custo: ${typeof formatMoney === 'function' ? formatMoney(custo) : custo}</div>
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-black text-slate-800 dark:text-white text-sm">${typeof formatMoney === 'function' ? formatMoney(subTot) : subTot}</div>
                    <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub} <span class="text-blue-500">(${margemSub.toFixed(1)}%)</span></div>
                </td>
            </tr>`;
        }).join('');
    }
    
    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const taxaBoleto = Number(v.taxaBoleto) || 0;
    const totalDespesas = taxaCartao + taxaBoleto;
    const custoGeral = totalCusto + totalDespesas;
    const lucroLiquido = tot - custoGeral;
    const margemLiquidaReal = tot > 0 ? ((lucroLiquido / tot) * 100) : 0;
    const markupReal = custoGeral > 0 ? ((lucroLiquido / custoGeral) * 100) : 0;
    
    const tfootEl = document.querySelector('#det-venda-tfoot');
    if (tfootEl) {
        let tfootHtml = `
            <tr>
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Custo Total (Produtos/Serviços)</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : totalCusto}</td>
            </tr>
        `;
        if (taxaCartao > 0) {
            tfootHtml += `
            <tr>
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cartão / Operadora</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
            </tr>`;
        }
        tfootHtml += `
            <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
            </tr>
            <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro Líquido Real</td>
                <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
            </tr>
            <tr class="bg-emerald-50/40 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-800/30">
                <td colspan="3" class="p-3 text-right font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Margem de Lucro Real / Markup</td>
                <td class="p-3 text-right font-black text-sm">
                    <span class="bg-emerald-100 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded font-black text-xs">${margemLiquidaReal.toFixed(2)}% Margem</span>
                    <span class="text-[11px] text-blue-600 dark:text-blue-400 font-bold ml-1">(${markupReal.toFixed(2)}% MKP)</span>
                </td>
            </tr>
        `;
        tfootEl.innerHTML = tfootHtml;
    }
    
    const m = document.getElementById('modal-detalhes-venda');
    if (m) m.classList.remove('hidden');
}

function fecharModalDetalhesVenda() { 
    window.__vendaDetalheAtual = null;
    const btnIni = document.getElementById('btn-iniciar-edicao-custo');
    if (btnIni) btnIni.classList.remove('hidden');
    const acoesEdicao = document.getElementById('acoes-edicao-custo');
    if (acoesEdicao) acoesEdicao.classList.add('hidden');
    const m = document.getElementById('modal-detalhes-venda');
    if (m) m.classList.add('hidden'); 
}

function habilitarEdicaoCustoVenda() {
    const v = window.__vendaDetalheAtual;
    if (!v) return;

    const btnIni = document.getElementById('btn-iniciar-edicao-custo');
    if (btnIni) btnIni.classList.add('hidden');
    const acoesEdicao = document.getElementById('acoes-edicao-custo');
    if (acoesEdicao) acoesEdicao.classList.remove('hidden');

    // Transforma a seção de observações em textarea editável
    const obsEl = document.getElementById('det-venda-obs');
    if (obsEl) {
        const obsAtual = (v.obs || '');
        obsEl.innerHTML = `
            <div class="space-y-2">
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span><i class="fa-solid fa-pen-to-square text-indigo-500 mr-1"></i> Anotações / Observações Gerais da Venda</span>
                    <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Modo Edição Ativo</span>
                </label>
                <textarea id="edit-venda-obs" rows="3" placeholder="Digite uma anotação, motivo do ajuste de custo ou observação geral..." class="w-full bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-600 rounded-xl p-3 text-xs md:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100">${obsAtual.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                <p class="text-[11px] text-slate-400 italic">Dica: as anotações ficam gravadas no documento da venda para auditoria e histórico gerencial.</p>
            </div>
        `;
    }

    // Renderiza itens em modo de edição
    const itensEl = document.getElementById('det-venda-itens');
    if (itensEl) {
        itensEl.innerHTML = (v.itens || []).map((i, idx) => {
            const preco = Number(i.preco) || 0;
            const qtd = Number(i.qtd) || 1;
            const custo = Number(i.custo) || 0;
            const subTot = preco * qtd;
            const subCusto = custo * qtd;
            const lucroSub = subTot - subCusto;
            const margemSub = subTot > 0 ? ((lucroSub / subTot) * 100) : 0;

            // Busca produto no cadastro para permitir sincronização
            const prodCadastrado = (db.produtos || []).find(p => (i.id && String(p.id) === String(i.id)) || (p.nome && i.nome && p.nome.trim().toLowerCase() === i.nome.trim().toLowerCase()));

            return `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors bg-amber-50/20 dark:bg-amber-950/10">
                <td class="p-4 border-b border-slate-100 dark:border-slate-800/50 align-top">
                    <div class="font-bold text-slate-800 dark:text-slate-200 text-sm">${i.nome || 'Produto/Serviço'}</div>
                    <div class="mt-1.5">
                        <input type="text" id="edit-item-obs-${idx}" value="${(i.obsVenda || '').replace(/"/g, '&quot;')}" placeholder="Anotação deste item (opcional)..." class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500">
                    </div>
                </td>
                <td class="p-4 text-center border-b border-slate-100 dark:border-slate-800/50 align-top">
                    <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700" id="edit-item-qtd-${idx}">${qtd}</span>
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50 align-top">
                    <div class="font-black text-slate-700 dark:text-slate-300 text-sm" id="edit-item-preco-${idx}">${typeof formatMoney === 'function' ? formatMoney(preco) : preco}</div>
                    <div class="mt-2 flex flex-col items-end gap-1">
                        <div class="flex items-center gap-1.5 justify-end">
                            <span class="text-[11px] font-bold text-slate-400">Custo: R$</span>
                            <input type="text" data-mask="money" inputmode="numeric" 
                                   id="edit-custo-item-${idx}" 
                                   value="${typeof formatMoneyInput === 'function' ? formatMoneyInput(custo) : custo.toFixed(2).replace('.', ',')}" 
                                   oninput="recalcularCustosEdicaoLive()"
                                   class="w-24 bg-white dark:bg-slate-800 border border-amber-400 dark:border-amber-500 rounded-lg px-2 py-1 text-right text-xs font-black text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm">
                        </div>
                        ${prodCadastrado ? `
                        <label class="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline select-none mt-0.5" title="Se marcado, atualiza também o custo de compra deste produto no estoque para futuras vendas">
                            <input type="checkbox" id="sync-prod-custo-${idx}" data-prod-id="${prodCadastrado.id}" class="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                            <span>Atualizar no estoque</span>
                        </label>` : ''}
                    </div>
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50 align-top">
                    <div class="font-black text-slate-800 dark:text-white text-sm" id="edit-subtot-${idx}">${typeof formatMoney === 'function' ? formatMoney(subTot) : subTot}</div>
                    <div class="text-[10px] font-bold mt-1.5" id="edit-lucro-container-${idx}">
                        <div class="text-emerald-600 dark:text-emerald-400 font-bold" id="edit-sublucro-${idx}">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub}</div>
                        <div class="text-blue-500 dark:text-blue-400" id="edit-submargem-${idx}">(${margemSub.toFixed(1)}%)</div>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    recalcularCustosEdicaoLive();
}

function recalcularCustosEdicaoLive() {
    const v = window.__vendaDetalheAtual;
    if (!v) return;

    let totalCusto = 0;
    const itens = v.itens || [];

    itens.forEach((i, idx) => {
        const preco = Number(i.preco) || 0;
        const qtd = Number(i.qtd) || 1;
        const inputCusto = document.getElementById(`edit-custo-item-${idx}`);
        const custo = inputCusto ? (typeof parseInputMoney === 'function' ? parseInputMoney(inputCusto.value) : (parseFloat(inputCusto.value.replace(/\./g, '').replace(',', '.')) || 0)) : (Number(i.custo) || 0);

        const subTot = preco * qtd;
        const subCusto = custo * qtd;
        const lucroSub = subTot - subCusto;
        const margemSub = subTot > 0 ? ((lucroSub / subTot) * 100) : 0;

        totalCusto += subCusto;

        const subLucroEl = document.getElementById(`edit-sublucro-${idx}`);
        if (subLucroEl) {
            subLucroEl.innerText = `Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : 'R$ ' + lucroSub.toFixed(2)}`;
            if (lucroSub < 0) {
                subLucroEl.className = 'text-red-500 font-bold';
            } else {
                subLucroEl.className = 'text-emerald-600 dark:text-emerald-400 font-bold';
            }
        }
        const subMargemEl = document.getElementById(`edit-submargem-${idx}`);
        if (subMargemEl) {
            subMargemEl.innerText = `(${margemSub.toFixed(1)}%)`;
        }
    });

    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const taxaBoleto = Number(v.taxaBoleto) || 0;
    const totalDespesas = taxaCartao + taxaBoleto;
    const custoGeral = totalCusto + totalDespesas;
    const lucroLiquido = tot - custoGeral;
    const margemLiquidaReal = tot > 0 ? ((lucroLiquido / tot) * 100) : 0;
    const markupReal = custoGeral > 0 ? ((lucroLiquido / custoGeral) * 100) : 0;

    const tfootEl = document.querySelector('#det-venda-tfoot');
    if (tfootEl) {
        let tfootHtml = `
            <tr class="bg-amber-50/40 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800/40">
                <td colspan="3" class="p-4 text-right font-bold text-amber-800 dark:text-amber-300 text-[11px] uppercase tracking-wider">
                    <i class="fa-solid fa-calculator mr-1"></i> Custo Total Recalculado (Produtos)
                </td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : totalCusto}</td>
            </tr>
        `;
        if (taxaCartao > 0) {
            tfootHtml += `
            <tr>
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cartão / Operadora</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
            </tr>`;
        }
        tfootHtml += `
            <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
            </tr>
            <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro Líquido Real Recalculado</td>
                <td class="p-4 text-right font-black text-xl shadow-sm ${lucroLiquido < 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
            </tr>
            <tr class="bg-emerald-50/40 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-800/30">
                <td colspan="3" class="p-3 text-right font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Margem de Lucro Real / Markup</td>
                <td class="p-3 text-right font-black text-sm">
                    <span class="bg-emerald-100 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded font-black text-xs">${margemLiquidaReal.toFixed(2)}% Margem</span>
                    <span class="text-[11px] text-blue-600 dark:text-blue-400 font-bold ml-1">(${markupReal.toFixed(2)}% MKP)</span>
                </td>
            </tr>
        `;
        tfootEl.innerHTML = tfootHtml;
    }
}

function cancelarEdicaoCustoVenda() {
    if (window.__vendaDetalheAtual) {
        verDetalhesVenda(window.__vendaDetalheAtual.id);
    }
}

async function salvarAjusteCustoVenda() {
    const v = window.__vendaDetalheAtual;
    if (!v) return;

    const btnSalvar = document.getElementById('btn-salvar-edicao-custo');
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> <span>Salvando...</span>`;
    }

    try {
        const obsEl = document.getElementById('edit-venda-obs');
        const novaObs = obsEl ? obsEl.value.trim() : (v.obs || '');

        const novosItens = JSON.parse(JSON.stringify(v.itens || []));
        let novoCustoTotal = 0;
        const produtosParaAtualizarCusto = [];

        novosItens.forEach((item, idx) => {
            const inputCusto = document.getElementById(`edit-custo-item-${idx}`);
            const inputObsItem = document.getElementById(`edit-item-obs-${idx}`);
            const checkSync = document.getElementById(`sync-prod-custo-${idx}`);

            const custoUnit = inputCusto ? (typeof parseInputMoney === 'function' ? parseInputMoney(inputCusto.value) : (parseFloat(inputCusto.value.replace(/\./g, '').replace(',', '.')) || 0)) : (Number(item.custo) || 0);
            item.custo = Math.max(0, custoUnit);

            if (inputObsItem) {
                item.obsVenda = inputObsItem.value.trim();
            }

            const qtd = Number(item.qtd) || 1;
            novoCustoTotal += (item.custo * qtd);

            if (checkSync && checkSync.checked && checkSync.dataset.prodId) {
                produtosParaAtualizarCusto.push({
                    id: checkSync.dataset.prodId,
                    novoCusto: item.custo,
                    nome: item.nome || ''
                });
            }
        });

        const tot = Number(v.tot) || 0;
        const taxaCartao = Number(v.taxaValor) || 0;
        const taxaBoleto = Number(v.taxaBoleto) || 0;
        const totalDespesas = taxaCartao + taxaBoleto;
        const novoLucroReal = tot - (novoCustoTotal + totalDespesas);

        // Firestore Batch
        const batch = (typeof firestore !== 'undefined' && firestore.batch) 
            ? firestore.batch() 
            : window.getEmpresaRef().firestore.batch();

        const vendaRef = window.getEmpresaRef().collection('vendas').doc(String(v.id));

        const dadosAtualizacaoVenda = {
            itens: novosItens,
            custoTotal: novoCustoTotal,
            lucroReal: novoLucroReal,
            obs: novaObs,
            dataUltimoAjusteCusto: new Date().toISOString()
        };

        batch.update(vendaRef, dadosAtualizacaoVenda);

        // Sincronização opcional com cadastro de produtos
        produtosParaAtualizarCusto.forEach(pSync => {
            const prodRef = window.getEmpresaRef().collection('produtos').doc(String(pSync.id));
            batch.update(prodRef, {
                custo: pSync.novoCusto,
                dataAtualizacaoCusto: new Date().toISOString()
            });

            // Atualiza em memória db.produtos
            if (Array.isArray(db.produtos)) {
                const prodEmMemoria = db.produtos.find(p => String(p.id) === String(pSync.id));
                if (prodEmMemoria) {
                    prodEmMemoria.custo = pSync.novoCusto;
                }
            }
        });

        await batch.commit();

        // Atualiza objeto em memória db.vendas
        v.itens = novosItens;
        v.custoTotal = novoCustoTotal;
        v.lucroReal = novoLucroReal;
        v.obs = novaObs;
        v.dataUltimoAjusteCusto = dadosAtualizacaoVenda.dataUltimoAjusteCusto;

        if (Array.isArray(db.vendas)) {
            const idxV = db.vendas.findIndex(x => String(x.id) === String(v.id));
            if (idxV !== -1) {
                db.vendas[idxV] = Object.assign({}, db.vendas[idxV], dadosAtualizacaoVenda);
            }
        }

        // Atualiza FCCache se ativo
        if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function') {
            window.FCCache.set('vendas', db.vendas || []);
            if (produtosParaAtualizarCusto.length > 0) {
                window.FCCache.set('produtos', db.produtos || []);
            }
        }

        // Recarrega telas e tabelas dependentes
        if (typeof renderVendas === 'function') renderVendas();
        if (typeof renderizarDRE === 'function') renderizarDRE();
        if (typeof debouncedRenderDashboard === 'function') debouncedRenderDashboard();
        if (typeof renderEstatisticasVendas === 'function') renderEstatisticasVendas();

        if (typeof showToast === 'function') {
            const extraMsg = produtosParaAtualizarCusto.length > 0 
                ? ` e ${produtosParaAtualizarCusto.length} produto(s) atualizado(s) no estoque!` 
                : '!';
            showToast(`Custos e anotações da venda atualizados com sucesso${extraMsg}`, 'success');
        }

        // Retorna o modal para modo de visualização com os dados novos
        verDetalhesVenda(v.id);

    } catch (err) {
        console.error('Erro ao salvar ajuste de custo da venda:', err);
        if (typeof showToast === 'function') {
            showToast('Erro ao salvar ajustes: ' + (err.message || 'Falha na comunicação com o banco.'), 'error');
        }
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> <span>Salvar Alterações</span>`;
        }
    }
}

function abrirZoom(url) {
    let m = document.getElementById('modal-zoom-foto');
    if (!m) {
        m = document.createElement('div');
        m.id = 'modal-zoom-foto';
        m.className = 'fixed inset-0 bg-black/90 z-[600] hidden flex items-center justify-center p-4 cursor-pointer backdrop-blur-sm';
        m.onclick = () => m.classList.add('hidden');
        m.innerHTML = `<div class="relative max-w-4xl max-h-[90vh]"><img id="img-zoom-foto" src="" class="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"><button class="absolute -top-10 right-0 text-white text-3xl font-bold"><i class="fa-solid fa-xmark"></i></button></div>`;
        document.body.appendChild(m);
    }
    const img = document.getElementById('img-zoom-foto');
    if (img) img.src = url;
    m.classList.remove('hidden');
}

window.mudarPeriodoVendas = mudarPeriodoVendas;
window.renderVendas = renderVendas;
window.verDetalhesVenda = verDetalhesVenda;
window.fecharModalDetalhesVenda = fecharModalDetalhesVenda;
window.habilitarEdicaoCustoVenda = habilitarEdicaoCustoVenda;
window.recalcularCustosEdicaoLive = recalcularCustosEdicaoLive;
window.cancelarEdicaoCustoVenda = cancelarEdicaoCustoVenda;
window.salvarAjusteCustoVenda = salvarAjusteCustoVenda;
window.abrirZoom = abrirZoom;





// NOVO: Funções auxiliares para Vínculo de XML
function alternarAcaoVinculoXML() {
    const acao = document.getElementById('prod-acao-vinculo').value;
    if(acao === 'VINCULAR') {
        document.getElementById('div-vinculo-busca').classList.remove('hidden');
    } else {
        document.getElementById('div-vinculo-busca').classList.add('hidden');
        document.getElementById('prod-id').value = '';
    }
}

function preencherVinculoXML() {
    const id = document.getElementById('prod-vinculo-select').value;
    if(id) {
        const prod = db.produtos.find(p => String(p.id) === String(id));
        if(prod) {
            document.getElementById('prod-id').value = prod.id;
            document.getElementById('prod-nome').value = prod.nome;
            document.getElementById('prod-ean').value = prod.ean || '';
            document.getElementById('prod-margem').value = (prod.custo > 0 && prod.preco > 0) ? (((prod.preco - prod.custo) / prod.custo) * 100).toFixed(2) : (prod.margem || 50).toFixed(2);
            if(typeof calcularPrecoMargin === 'function') {
                calcularPrecoMargin('margem');
            }
        }
    }
}




function abrirModalXML() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = processarXMLReal;
    input.click();
}


function selecionarProdutoVinculoXML(id, nome) {
    document.getElementById('prod-vinculo-select').value = id;
    document.getElementById('prod-vinculo-search').value = nome;
    ocultarListaProdutosXMLBusca();
    preencherVinculoXML(); 
}

function filtrarProdutosXMLBusca() {
    const termo = document.getElementById('prod-vinculo-search').value.toLowerCase();
    const lista = document.getElementById('prod-vinculo-lista');
    lista.classList.remove('hidden');
    let html = '';
    const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
    let count = 0;
    sorted.forEach(p => {
        if(p.nome.toLowerCase().includes(termo) || (p.ean && p.ean.includes(termo))) {
            count++;
            if(count <= 50) {
                html += '<li onclick="selecionarProdutoVinculoXML(\'' + p.id + '\', \'' + p.nome.replace(/'/g, "\\'") + '\')" class="p-2 border-b border-slate-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer"><div class="font-bold text-xs">' + p.nome + '</div><div class="text-[10px] text-slate-500">Estoque: ' + p.estoque + ' | EAN: ' + (p.ean || 'S/N') + '</div></li>';
            }
        }
    });
    if(count === 0) html = '<li class="p-2 text-xs text-slate-500">Nenhum produto encontrado.</li>';
    lista.innerHTML = html;
}

function mostrarListaProdutosXMLBusca() { filtrarProdutosXMLBusca(); }
function ocultarListaProdutosXMLBusca() { document.getElementById('prod-vinculo-lista').classList.add('hidden'); }

// --- FUNCOES DO EXTRATO DE FUNCIONARIO ---
function abrirDetalhesFuncionario(nomeFuncionario) {
    if (typeof abrirDrilldownDRE === 'function') {
        abrirDrilldownDRE('FUNCIONARIO', nomeFuncionario);
    }
}

function imprimirExtratoFuncionario() {
    if (typeof imprimirDrilldownDRE === 'function') {
        imprimirDrilldownDRE();
    } else {
        window.print();
    }
}

function calcularPrecoMargin(quemMudou = 'preco') {
    const custoEl = document.getElementById('prod-custo');
    const margemEl = document.getElementById('prod-margem');
    const precoEl = document.getElementById('prod-preco');
    if (!custoEl || !margemEl || !precoEl) return;

    let custo = parseInputMoney(custoEl.value) || 0;
    let margem = parseInputMoney(margemEl.value) || 0;
    let preco = parseInputMoney(precoEl.value) || 0;

    if (quemMudou === 'custo' || quemMudou === 'margem') {
        if (custo > 0) {
            preco = custo * (1 + (margem / 100));
            precoEl.value = preco.toFixed(2);
        }
    } else if (quemMudou === 'preco') {
        if (custo > 0) {
            margem = ((preco - custo) / custo) * 100;
            margemEl.value = margem.toFixed(2);
        }
    }
}

// ==========================================
// EXPORTAÇÃO GLOBAL DE FUNÇÕES PARA O ESCOPO WINDOW











// ==========================================
// PAINEL INTELIGENTE IA - ASSISTENTE DE RELATÓRIOS
// ==========================================

function coletarDadosCompletosParaIA(perguntaUsuario) {
    if (!db) return "Nenhum dado carregado no sistema.";
    
    perguntaUsuario = perguntaUsuario || '';
    
    let periodo = null;
    const dataInicioIa = document.getElementById('ia-data-inicio');
    const dataFimIa = document.getElementById('ia-data-fim');
    
    if (dataInicioIa && dataFimIa && dataInicioIa.value && dataFimIa.value) {
        let inicio = new Date(dataInicioIa.value + 'T00:00:00');
        let fim = new Date(dataFimIa.value + 'T23:59:59');
        periodo = { inicio: inicio, fim: fim, label: 'Filtro IA' };
    } else {
        periodo = obterIntervaloDatasBI();
    }
    
    const txtPeriodo = (periodo && periodo.inicio && periodo.fim) ? 
        (periodo.inicio.toLocaleDateString('pt-BR') + ' ate ' + periodo.fim.toLocaleDateString('pt-BR')) : 'Todo o Historico';

    let diasPeriodo = 30;
    if (periodo && periodo.inicio && periodo.fim) {
        let diffMs = Math.abs(periodo.fim.getTime() - periodo.inicio.getTime());
        diasPeriodo = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
    let semanasPeriodo = Math.max(1, diasPeriodo / 7);
    let mesesPeriodo = Math.max(1, diasPeriodo / 30);

    const vendas = obterVendasDoPeriodo(periodo) || [];
    const compras = obterComprasDoPeriodo(periodo) || [];
    const despesasPagasObj = obterDespesasPagasDoPeriodo(periodo) || [];
    const financeiroTodos = db.financeiro || []; 
    const produtos = db.produtos || [];
    const clientes = db.clientes || [];
    const hoje = new Date();

    function extrairNomeCliente(v) {
        if (!v) return 'Consumidor Final';
        let nome = v.clienteNome || v.nomeCliente || v.cliente;
        if (nome && typeof nome === 'string' && nome.trim()) return nome.trim();
        if (v.clienteInfo && typeof v.clienteInfo === 'object' && v.clienteInfo.nome) {
            let n = String(v.clienteInfo.nome).trim();
            if (n) return n;
        }
        if (v.clienteId && db && Array.isArray(db.clientes)) {
            let c = db.clientes.find(x => String(x.id) === String(v.clienteId));
            if (c && c.nome && c.nome.trim()) return c.nome.trim();
        }
        return 'Consumidor Final';
    }

    function extrairPagamento(v) {
        if (!v) return 'Nao informado';
        let pag = v.pag || v.pagamento || v.formaPagamento;
        if (pag && typeof pag === 'string' && pag.trim()) return pag.trim();
        if (Array.isArray(v.pagamentos) && v.pagamentos.length > 0) {
            return v.pagamentos.map(p => {
                let m = p.metodo || p.forma || 'Outro';
                let val = Number(p.valor || 0);
                return m + (val > 0 ? ' (R$ ' + val.toFixed(2) + ')' : '');
            }).join(', ');
        }
        return 'Nao informado';
    }

    function extrairItens(v) {
        if (!v || !Array.isArray(v.itens)) return [];
        return v.itens.map(item => {
            let nome = item.nome || item.descricao || item.produto || 'Item sem nome';
            let qtd = Number(item.qtd != null ? item.qtd : (item.quantidade != null ? item.quantidade : 1)) || 1;
            let preco = Number(item.preco != null ? item.preco : (item.valor != null ? item.valor : 0)) || 0;
            let subtotal = Number(item.subtotal != null ? item.subtotal : (preco * qtd)) || (preco * qtd);
            return { nome, qtd, preco, subtotal };
        });
    }

    function formatarDataVenda(v) {
        let raw = v.data || v.dataVenda || v.criadoEm || '';
        if (!raw) return '-';
        let d = typeof parseDataGenerica === 'function' ? parseDataGenerica(raw) : new Date(raw);
        if (d && !isNaN(d.getTime())) return d.toLocaleString('pt-BR');
        return String(raw);
    }

    const fatTotal = vendas.reduce((a, b) => a + Number(b.tot || b.total || b.valor || 0), 0); 
    const cmvTotal = vendas.reduce((a, b) => a + Number(b.custoTotal || 0), 0); 
    const taxasTotal = vendas.reduce((a, b) => a + Number(b.taxaValor || 0), 0); 
    const descontosTotal = vendas.reduce((a, b) => a + Number(b.desconto || 0), 0);
    const recLiquida = fatTotal - taxasTotal;
    const lucroBruto = recLiquida - cmvTotal;
    
    let despesasOperacionais = 0;
    let impostosTotal = 0;
    despesasPagasObj.forEach(d => {
        const cat = String(d.categoria || '').toLowerCase();
        const val = Number(d.valorPago || d.valor || 0);
        if (cat.includes('imposto') || cat.includes('das') || cat.includes('icms') || cat.includes('simples') || cat.includes('tributo')) {
            impostosTotal += val;
        } else {
            despesasOperacionais += val;
        }
    });

    const lucroReal = lucroBruto - despesasOperacionais - impostosTotal;
    const ticketMedio = vendas.length > 0 ? fatTotal / vendas.length : 0;

    var despesasPendentes = financeiroTodos.filter(function(f){return f.tipo==='DESPESA'&&f.status==='PENDENTE';}).reduce(function(a,b){return a+(Number(b.valor)||0);},0);
    var receitasPendentes = financeiroTodos.filter(function(f){return f.tipo==='RECEITA'&&f.status==='PENDENTE';}).reduce(function(a,b){return a+(Number(b.valor)||0);},0);

    var pagamentos = {};
    vendas.forEach(function(v){
        var pag = extrairPagamento(v);
        if(!pagamentos[pag]) pagamentos[pag] = {qtd:0, total:0};
        pagamentos[pag].qtd++; pagamentos[pag].total += (Number(v.tot||v.total||v.valor)||0);
    });
    var pagamentosTexto = Object.entries(pagamentos).sort(function(a,b){return b[1].total-a[1].total;})
        .map(function(e){return '  - '+e[0]+': '+e[1].qtd+' vendas = R$ '+e[1].total.toFixed(2)+' ('+((fatTotal > 0 ? (e[1].total/fatTotal)*100 : 0)).toFixed(1)+'%)';}).join('\n');

    var prodVendidos = {};
    var categVendidas = {};
    vendas.forEach(function(v){
        extrairItens(v).forEach(function(item){
            var nome = item.nome;
            if(!prodVendidos[nome]) prodVendidos[nome]={qtd:0,receita:0};
            prodVendidos[nome].qtd += item.qtd;
            prodVendidos[nome].receita += item.subtotal;

            let pDb = produtos.find(p => p.nome === nome);
            let cat = pDb ? (pDb.categoria || 'Geral') : 'Desconhecida';
            if(!categVendidas[cat]) categVendidas[cat]={qtd:0,receita:0};
            categVendidas[cat].qtd += item.qtd;
            categVendidas[cat].receita += item.subtotal;
        });
    });
    var topProdTexto = Object.entries(prodVendidos).sort(function(a,b){return b[1].receita-a[1].receita;}).slice(0,25)
        .map(function(e,i){return '  '+(i+1)+'. '+e[0]+': '+e[1].qtd+' un = R$ '+e[1].receita.toFixed(2);}).join('\n');
    
    var categTexto = Object.entries(categVendidas).sort(function(a,b){return b[1].receita-a[1].receita;}).slice(0,10)
        .map(function(e,i){return '  '+(i+1)+'. '+e[0]+': '+e[1].qtd+' itens = R$ '+e[1].receita.toFixed(2);}).join('\n');

    // Mapeamento minucioso e completo de compras por cliente no período
    var clienteCompras = {};
    vendas.forEach(function(v){
        var nome = extrairNomeCliente(v);
        var itensVenda = extrairItens(v);
        var valorVenda = Number(v.tot || v.total || v.valor || 0);
        var qtdItensVenda = itensVenda.reduce(function(a, b){ return a + b.qtd; }, 0);
        var dataFormatada = formatarDataVenda(v);
        var pag = extrairPagamento(v);
        var pedNum = String(v.numeroPedido || v.id || '-');

        if (!clienteCompras[nome]) {
            clienteCompras[nome] = {
                nome: nome,
                pedidosQtd: 0,
                totalGasto: 0,
                itensQtdTotal: 0,
                primeiraData: dataFormatada,
                ultimaData: dataFormatada,
                produtos: {},
                vendasDetalhes: []
            };
        }

        var cInfo = clienteCompras[nome];
        cInfo.pedidosQtd++;
        cInfo.totalGasto += valorVenda;
        cInfo.itensQtdTotal += qtdItensVenda;
        cInfo.ultimaData = dataFormatada;

        itensVenda.forEach(function(it){
            if (!cInfo.produtos[it.nome]) cInfo.produtos[it.nome] = { qtd: 0, total: 0 };
            cInfo.produtos[it.nome].qtd += it.qtd;
            cInfo.produtos[it.nome].total += it.subtotal;
        });

        cInfo.vendasDetalhes.push({
            numero: pedNum,
            data: dataFormatada,
            total: valorVenda,
            pag: pag,
            vendedor: v.vendedor || '-',
            itens: itensVenda
        });
    });

    // Lista consolidada de clientes que compraram no período
    var clientesListaTexto = Object.values(clienteCompras).sort(function(a,b){ return b.totalGasto - a.totalGasto; })
        .map(function(c, i){
            var ticket = c.pedidosQtd > 0 ? (c.totalGasto / c.pedidosQtd) : 0;
            return '  ' + (i+1) + '. ' + c.nome + ': ' + c.pedidosQtd + ' compras | R$ ' + c.totalGasto.toFixed(2) + ' total | ' + c.itensQtdTotal + ' itens/produtos | Ticket Médio: R$ ' + ticket.toFixed(2) + ' | Última compra: ' + c.ultimaData;
        }).join('\n');

    var inativos60 = Object.values(clienteCompras).filter(function(c){
        if(!c.ultimaData || c.nome === 'Consumidor Final') return false;
        var parts = c.ultimaData.split('/');
        var ultima = parts.length === 3 ? new Date(parts[2], parts[1]-1, parts[0]) : new Date(c.ultimaData);
        return ((hoje - ultima) / 86400000) > 60;
    }).slice(0, 15).map(function(c){ return '  - ' + c.nome + ': última compra em ' + c.ultimaData + ', total R$ ' + c.totalGasto.toFixed(2); }).join('\n');

    var vendedores = {};
    vendas.forEach(function(v){
        var vend = v.vendedor||v.operador||'Sem vendedor';
        if(!vendedores[vend]) vendedores[vend]={qtd:0,total:0};
        vendedores[vend].qtd++; vendedores[vend].total+=(Number(v.tot||v.total||v.valor)||0);
    });
    var vendedoresTexto = Object.entries(vendedores).sort(function(a,b){return b[1].total-a[1].total;})
        .map(function(e){return '  - '+e[0]+': '+e[1].qtd+' vendas = R$ '+e[1].total.toFixed(2)+' | Ticket: R$ '+(e[1].total/e[1].qtd).toFixed(2);}).join('\n');

    var estoqueBaixo = produtos.filter(function(p){return (Number(p.estoque)||0)<=(Number(p.estoqueMin)||0);}).slice(0,15)
        .map(function(p){return '  - '+p.nome+': '+p.estoque+' un (min: '+(p.estoqueMin||0)+')';}).join('\n');
    var valorEstoqueTotal = produtos.reduce(function(a,p){return a+((Number(p.estoque)||0)*(Number(p.custo)||0));},0);

    var fornecedores = {};
    (compras||[]).forEach(function(c){
        var forn=c.fornecedor||'Desconhecido';
        if(!fornecedores[forn]) fornecedores[forn]={qtd:0,total:0};
        fornecedores[forn].qtd++; fornecedores[forn].total+=(Number(c.total||c.totalNF)||0);
    });
    var fornTexto = Object.entries(fornecedores).sort(function(a,b){return b[1].total-a[1].total;}).slice(0,10)
        .map(function(e){return '  - '+e[0]+': '+e[1].qtd+' pedidos = R$ '+e[1].total.toFixed(2);}).join('\n');

    var fiados = financeiroTodos.filter(function(f){return f.tipo==='RECEITA'&&f.status==='PENDENTE'&&(f.formaPagamento==='Fiado'||(f.descricao||'').toLowerCase().includes('fiado'));});
    var totalFiado = fiados.reduce(function(a,f){return a+(Number(f.valor)||0);},0);

    var contasReceberPorCliente = {};
    financeiroTodos.filter(function(f){return f.tipo==='RECEITA'&&f.status==='PENDENTE';}).forEach(function(f){
        var pessoa = f.pessoa || f.clienteNome || 'Desconhecido';
        if (!contasReceberPorCliente[pessoa]) contasReceberPorCliente[pessoa] = 0;
        contasReceberPorCliente[pessoa] += (Number(f.valor) || 0);
    });
    var contasReceberTexto = Object.entries(contasReceberPorCliente).sort(function(a,b){return b[1]-a[1];})
        .map(function(e){return '  - ' + e[0] + ': R$ ' + e[1].toFixed(2);}).join('\n');

    var contasPagarPorFornecedor = {};
    financeiroTodos.filter(function(f){return f.tipo==='DESPESA'&&f.status==='PENDENTE';}).forEach(function(f){
        var pessoa = f.pessoa || f.favorecido || 'Desconhecido';
        if (!contasPagarPorFornecedor[pessoa]) contasPagarPorFornecedor[pessoa] = 0;
        contasPagarPorFornecedor[pessoa] += (Number(f.valor) || 0);
    });
    var contasPagarTexto = Object.entries(contasPagarPorFornecedor).sort(function(a,b){return b[1]-a[1];})
        .map(function(e){return '  - ' + e[0] + ': R$ ' + e[1].toFixed(2);}).join('\n');

    // Amostra detalhada de vendas do período (com itens, clientes, pagamentos)
    var vendasRecentesTexto = vendas.slice(0, 100).map(function(v){
        var cli = extrairNomeCliente(v);
        var ped = String(v.numeroPedido || v.id || '-');
        var pag = extrairPagamento(v);
        var tot = Number(v.tot || v.total || v.valor || 0);
        var dataF = formatarDataVenda(v);
        var vend = v.vendedor || '-';
        var itensStr = extrairItens(v).map(function(it){ return it.qtd + 'x ' + it.nome + ' (R$ ' + it.subtotal.toFixed(2) + ')'; }).join(', ');
        return '  * [' + dataF + '] Pedido #' + ped + ' | Cliente: ' + cli + ' | Valor: R$ ' + tot.toFixed(2) + ' | Pag: ' + pag + ' | Vend: ' + vend + ' | Itens: ' + (itensStr || 'Sem itens descritos');
    }).join('\n');

    // Identificação contextual se a pergunta do usuário focar em um cliente específico
    var dossieClienteTexto = '';
    var normPergunta = String(perguntaUsuario).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    if (normPergunta) {
        var clientesCandidatos = [];
        var nomesVerificados = new Set();
        (clientes || []).forEach(function(c){ if (c.nome) nomesVerificados.add(c.nome); });
        Object.keys(clienteCompras).forEach(function(n){ nomesVerificados.add(n); });

        nomesVerificados.forEach(function(nomeC){
            var normNome = nomeC.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var match = false;
            if (normNome.length >= 3 && normPergunta.includes(normNome)) {
                match = true;
            } else {
                var tokens = normNome.split(/[\s\-_\/]+/).filter(function(t){ return t.length >= 4 && !['ltda', 'eireli', 'servicos', 'comercio', 'moveis', 'pintura', 's.a.'].includes(t); });
                for (var t = 0; t < tokens.length; t++) {
                    if (normPergunta.includes(tokens[t])) { match = true; break; }
                }
            }
            if (match) clientesCandidatos.push(nomeC);
        });

        if (clientesCandidatos.length > 0) {
            dossieClienteTexto = '\n\n========================================================\n' +
                '=== DOSSIÊ COMPLETO DO(S) CLIENTE(S) IDENTIFICADO(S) NA PERGUNTA ===\n' +
                '========================================================\n';
            
            clientesCandidatos.forEach(function(nomeC){
                var cadastroCli = (clientes || []).find(function(c){ return (c.nome || '').trim().toLowerCase() === nomeC.trim().toLowerCase(); }) || {};
                var infoPeriodo = clienteCompras[nomeC];
                
                // Todas as vendas de todo o histórico do banco para este cliente
                var todasVendasCli = (db.vendas || []).filter(function(v){ return extrairNomeCliente(v).toLowerCase() === nomeC.toLowerCase(); });
                todasVendasCli.sort(function(a,b){ return (new Date(b.data || 0)) - (new Date(a.data || 0)); });

                // Títulos financeiros (fiados/receber)
                var titulosCli = (financeiroTodos || []).filter(function(f){
                    var p = (f.pessoa || f.clienteNome || '').toLowerCase();
                    return p === nomeC.toLowerCase() || (cadastroCli.nome && p === cadastroCli.nome.toLowerCase());
                });
                var fiadoPendenteCli = titulosCli.filter(function(f){ return f.tipo === 'RECEITA' && f.status === 'PENDENTE'; });
                var totalFiadoCli = fiadoPendenteCli.reduce(function(a,b){ return a + Number(b.valor || 0); }, 0);
                var titulosPagosCli = titulosCli.filter(function(f){ return f.status === 'PAGO'; });
                var totalJaPagoCli = titulosPagosCli.reduce(function(a,b){ return a + Number(b.valorPago || b.valor || 0); }, 0);

                dossieClienteTexto += '\n--- CLIENTE: ' + nomeC + ' ---\n' +
                    '- Nome Cadastral: ' + (cadastroCli.nome || nomeC) + '\n' +
                    '- CPF/CNPJ: ' + (cadastroCli.doc || cadastroCli.cpfCnpj || cadastroCli.cnpj || 'Não informado') + '\n' +
                    '- Telefone: ' + (cadastroCli.telefone || cadastroCli.tel || 'Não informado') + '\n' +
                    '- Endereço: ' + (cadastroCli.endereco || cadastroCli.endCompleto || 'Não informado') + '\n' +
                    '- Saldo Devedor / Fiado Pendente Atual: R$ ' + totalFiadoCli.toFixed(2) + ' (' + fiadoPendenteCli.length + ' títulos em aberto)\n' +
                    '- Total já liquidado/pago pelo cliente no histórico: R$ ' + totalJaPagoCli.toFixed(2) + '\n';

                if (infoPeriodo) {
                    var mediaSemanal = (infoPeriodo.itensQtdTotal / semanasPeriodo);
                    var mediaMensal = (infoPeriodo.itensQtdTotal / mesesPeriodo);
                    var ticketCli = infoPeriodo.pedidosQtd > 0 ? (infoPeriodo.totalGasto / infoPeriodo.pedidosQtd) : 0;

                    dossieClienteTexto += '\n[MÉTRICAS DO CLIENTE NO PERÍODO: ' + txtPeriodo + ']\n' +
                        '  * Total de Compras/Pedidos no Período: ' + infoPeriodo.pedidosQtd + ' pedido(s)\n' +
                        '  * Total de Produtos/Itens Comprados no Período: ' + infoPeriodo.itensQtdTotal + ' unidade(s)\n' +
                        '  * Valor Total Gasto no Período: R$ ' + infoPeriodo.totalGasto.toFixed(2) + '\n' +
                        '  * Ticket Médio por Compra no Período: R$ ' + ticketCli.toFixed(2) + '\n' +
                        '  * MÉDIA DE PRODUTOS COMPRADOS POR SEMANA: ' + mediaSemanal.toFixed(1) + ' produtos/semana (base de ' + semanasPeriodo.toFixed(1) + ' semanas no período)\n' +
                        '  * MÉDIA DE PRODUTOS COMPRADOS POR MÊS: ' + mediaMensal.toFixed(1) + ' produtos/mês (base de ' + mesesPeriodo.toFixed(1) + ' meses no período)\n';

                    dossieClienteTexto += '\n[MIX DE PRODUTOS COMPRADOS PELO CLIENTE NO PERÍODO]\n';
                    Object.entries(infoPeriodo.produtos).sort(function(a,b){ return b[1].qtd - a[1].qtd; }).forEach(function(pr, idx){
                        dossieClienteTexto += '    ' + (idx+1) + '. ' + pr[0] + ': ' + pr[1].qtd + ' un = R$ ' + pr[1].total.toFixed(2) + '\n';
                    });

                    dossieClienteTexto += '\n[TODOS OS PEDIDOS DO CLIENTE NO PERÍODO SELECIONADO]\n';
                    infoPeriodo.vendasDetalhes.forEach(function(det){
                        var itStr = det.itens.map(function(it){ return it.qtd + 'x ' + it.nome + ' (R$ ' + it.subtotal.toFixed(2) + ')'; }).join(', ');
                        dossieClienteTexto += '    - [' + det.data + '] Pedido #' + det.numero + ' | Total: R$ ' + det.total.toFixed(2) + ' | Pag: ' + det.pag + ' | Vend: ' + det.vendedor + ' | Itens: ' + itStr + '\n';
                    });
                } else {
                    dossieClienteTexto += '\n[ATENÇÃO: O cliente NÃO possui compras registradas no recorte de data selecionado (' + txtPeriodo + ').]\n';
                }

                if (todasVendasCli.length > 0) {
                    var totalGeralHist = todasVendasCli.reduce(function(a,b){ return a + Number(b.tot || b.total || b.valor || 0); }, 0);
                    dossieClienteTexto += '\n[HISTÓRICO GERAL COMPLETO DO CLIENTE (TODOS OS TEMPOS)]\n' +
                        '  * Total de Compras em Todo o Sistema: ' + todasVendasCli.length + ' pedidos\n' +
                        '  * Valor Histórico Total Acumulado: R$ ' + totalGeralHist.toFixed(2) + '\n';
                }
            });
        }
    }

    // Dossiê contextual de Produto se a pergunta mencionar um produto ou categoria
    var dossieProdutoTexto = '';
    if (normPergunta) {
        var produtosCandidatos = [];
        var prodsBase = produtos || [];
        prodsBase.forEach(function(p){
            if (!p.nome) return;
            var normP = p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normP.length >= 4 && normPergunta.includes(normP)) {
                produtosCandidatos.push(p.nome);
            } else {
                var pTokens = normP.split(/[\s\-_\/]+/).filter(function(t){ return t.length >= 4 && !['para', 'com', 'sem', 'alto', 'solidos', 'lt', 'litros', 'un', 'unidade'].includes(t); });
                var matches = 0;
                for (var t = 0; t < pTokens.length; t++) {
                    if (normPergunta.includes(pTokens[t])) matches++;
                }
                if (matches >= 2 || (pTokens.length === 1 && matches === 1)) {
                    produtosCandidatos.push(p.nome);
                }
            }
        });

        if (produtosCandidatos.length === 0) {
            Object.keys(prodVendidos).forEach(function(nomeIt){
                var normIt = nomeIt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (normIt.length >= 4 && normPergunta.includes(normIt)) {
                    produtosCandidatos.push(nomeIt);
                }
            });
        }

        if (produtosCandidatos.length > 0) {
            dossieProdutoTexto = '\n\n========================================================\n' +
                '=== DOSSIÊ COMPLETO DO(S) PRODUTO(S) IDENTIFICADO(S) NA PERGUNTA ===\n' +
                '========================================================\n';
            
            produtosCandidatos.slice(0, 3).forEach(function(nomeProd){
                var prodDb = prodsBase.find(function(p){ return (p.nome || '').toLowerCase() === nomeProd.toLowerCase(); }) || {};
                var compradores = {};
                var totalQtdVendida = 0;
                var totalFatProduto = 0;
                var pedidosDoItem = [];

                vendas.forEach(function(v){
                    var cli = extrairNomeCliente(v);
                    var dataF = formatarDataVenda(v);
                    var pedNum = String(v.numeroPedido || v.id || '-');
                    extrairItens(v).forEach(function(it){
                        var matchItem = (it.nome.toLowerCase() === nomeProd.toLowerCase()) ||
                            it.nome.toLowerCase().includes(nomeProd.toLowerCase()) ||
                            nomeProd.toLowerCase().includes(it.nome.toLowerCase());
                        if (matchItem) {
                            if (!compradores[cli]) compradores[cli] = { qtd: 0, total: 0, datas: [] };
                            compradores[cli].qtd += it.qtd;
                            compradores[cli].total += it.subtotal;
                            compradores[cli].datas.push(dataF);
                            totalQtdVendida += it.qtd;
                            totalFatProduto += it.subtotal;
                            pedidosDoItem.push({
                                pedido: pedNum,
                                cliente: cli,
                                data: dataF,
                                qtd: it.qtd,
                                precoUnit: it.preco,
                                subtotal: it.subtotal
                            });
                        }
                    });
                });

                dossieProdutoTexto += '\n--- PRODUTO: ' + nomeProd + ' ---\n' +
                    '- Estoque Atual em Loja: ' + (prodDb.estoque != null ? prodDb.estoque : 'N/A') + ' un\n' +
                    '- Preço de Custo Cadastrado: R$ ' + (Number(prodDb.custo || 0)).toFixed(2) + '\n' +
                    '- Preço de Venda Sugerido/Cadastrado: R$ ' + (Number(prodDb.preco || 0)).toFixed(2) + '\n' +
                    '- Volume Total Vendido no Período: ' + totalQtdVendida + ' unidade(s)\n' +
                    '- Faturamento Total Gerado pelo Produto no Período: R$ ' + totalFatProduto.toFixed(2) + '\n' +
                    '\n[CLIENTES QUE COMPRARAM ESTE PRODUTO NO PERÍODO]\n';

                if (Object.keys(compradores).length > 0) {
                    Object.entries(compradores).sort(function(a,b){ return b[1].qtd - a[1].qtd; }).forEach(function(comp){
                        dossieProdutoTexto += '  * Cliente: ' + comp[0] + ' | Comprou: ' + comp[1].qtd + ' un | Total: R$ ' + comp[1].total.toFixed(2) + ' | Datas: ' + comp[1].datas.join(', ') + '\n';
                    });
                    dossieProdutoTexto += '\n[TODAS AS VENDAS/PEDIDOS DESTE PRODUTO NO PERÍODO]\n';
                    pedidosDoItem.forEach(function(po){
                        dossieProdutoTexto += '  - Pedido #' + po.pedido + ' (' + po.data + ') | Cliente: ' + po.cliente + ' | ' + po.qtd + ' un a R$ ' + po.precoUnit.toFixed(2) + ' = R$ ' + po.subtotal.toFixed(2) + '\n';
                    });
                } else {
                    dossieProdutoTexto += '  * Nenhuma venda registrada deste produto no período selecionado (' + txtPeriodo + ').\n';
                }
            });
        }
    }

    var todosClientesDb = clientes.slice(0, 500).map(function(c){ return c.nome + (c.telefone ? ' ('+c.telefone+')' : ''); }).join(' | ') + (clientes.length > 500 ? ' (+'+(clientes.length-500)+' outros)' : '');
    var todosProdutosDb = produtos.slice(0, 500).map(function(p){ return p.nome + ' (' + (p.estoque||0) + ' un - R$ ' + (Number(p.preco||0).toFixed(2)) + ')'; }).join(' | ') + (produtos.length > 500 ? ' (+'+(produtos.length-500)+' outros)' : '');
    var todosFornecedoresDb = (db.fornecedores || []).slice(0, 200).map(function(f){ return f.nome || f.razaoSocial; }).join(' | ') + ((db.fornecedores||[]).length > 200 ? ' (+'+((db.fornecedores||[]).length-200)+' outros)' : '');

    return '\n=== DADOS DO SISTEMA FC GESTAO ===\nPERIODO ANALISADO: '+txtPeriodo+'\nData de hoje: '+hoje.toLocaleDateString('pt-BR')+
    (dossieClienteTexto || '') +
    (dossieProdutoTexto || '') +
    '\n\n--- DRE RESUMIDA DO PERIODO ---\nReceita Bruta: R$ '+fatTotal.toFixed(2)+
    '\nDeducoes/Taxas Maquininha: R$ '+taxasTotal.toFixed(2)+
    '\nReceita Liquida: R$ '+recLiquida.toFixed(2)+
    '\nCMV (Custo Mercadoria): R$ '+cmvTotal.toFixed(2)+
    '\nLucro Bruto: R$ '+lucroBruto.toFixed(2)+
    '\nDespesas Operacionais Pagas: R$ '+despesasOperacionais.toFixed(2)+
    '\nImpostos Pagos: R$ '+impostosTotal.toFixed(2)+
    '\nLucro Real (DRE): R$ '+lucroReal.toFixed(2)+
    '\nTicket Medio da Loja: R$ '+ticketMedio.toFixed(2)+
    '\n\n--- INADIMPLENCIA E COMPROMISSOS (GERAL) ---\nContas Pagar Pendentes: R$ '+despesasPendentes.toFixed(2)+
    '\nContas Receber Pendentes: R$ '+receitasPendentes.toFixed(2)+'\nFiado Pendente (Subconjunto de Receber): R$ '+totalFiado.toFixed(2)+
    '\nValor Estoque Total Atual: R$ '+valorEstoqueTotal.toFixed(2)+
    '\n\n--- FORMAS DE PAGAMENTO NO PERIODO ---\n'+(pagamentosTexto||'Sem dados')+
    '\n\n--- VENDAS POR CATEGORIA NO PERIODO ---\n'+(categTexto||'Sem dados')+
    '\n\n--- TOP 25 PRODUTOS VENDIDOS NO PERIODO ---\n'+(topProdTexto||'Sem dados')+
    '\n\n--- COMPRAS FORNECEDORES NO PERIODO ---\n'+(fornTexto||'Sem compras')+
    '\n\n--- DESEMPENHO VENDEDORES NO PERIODO ---\n'+(vendedoresTexto||'Sem dados')+
    '\n\n--- ESTOQUE CRITICO (GERAL) ---\n'+(estoqueBaixo||'Nenhum critico')+
    '\n\n--- COMPROMISSOS DETALHADOS A PAGAR (FORNECEDORES/DESPESAS) ---\n'+(contasPagarTexto||'Nenhuma conta a pagar pendente')+
    '\n\n--- DIVIDAS PENDENTES POR CLIENTE (CONTAS A RECEBER) ---\n'+(contasReceberTexto||'Nenhuma divida pendente detalhada')+
    '\n\n--- TODOS OS CLIENTES COM COMPRAS NO PERIODO ---\n'+(clientesListaTexto||'Nenhuma compra de cliente registrada no periodo')+
    '\n\n--- AMOSTRA DETALHADA DE VENDAS REALIZADAS NO PERIODO ---\n'+(vendasRecentesTexto||'Sem vendas')+
    '\n\n--- CLIENTES INATIVOS (+60 DIAS SEM COMPRAR) ---\n'+(inativos60||'Nenhum')+
    '\n\n--- TODOS OS PRODUTOS CADASTRADOS (BASE GERAL DE ESTOQUE) ---\n'+(todosProdutosDb||'Nenhum produto cadastrado')+
    '\n\n--- TODOS OS FORNECEDORES CADASTRADOS (BASE GERAL) ---\n'+(todosFornecedoresDb||'Nenhum fornecedor cadastrado')+
    '\n\n--- TODOS OS CLIENTES CADASTRADOS (BASE GERAL) ---\n'+(todosClientesDb||'Nenhum cliente cadastrado');
}

async function gerarRelatorioComIA(descricaoRelatorio) {
    if (typeof window.verificarAcessoRelatorio === 'function' && !window.verificarAcessoRelatorio('rel_ia_assistente')) {
        if (typeof showToast === 'function') showToast("O Assistente IA de Relatórios não está liberado no seu plano.", "warning");
        return;
    }
    var divRes = document.getElementById('ia-rel-resultado');
    if (!divRes) return;
    divRes.innerHTML = '<div class="flex flex-col items-center justify-center py-10"><div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-4"><i class="fa-solid fa-brain text-white text-2xl animate-pulse"></i></div><p class="text-slate-200 font-semibold text-sm mb-1">Analisando seus dados em tempo real...</p><p class="text-slate-500 text-xs">Coletando vendas, estoque, clientes, financeiro...</p><div class="mt-4 flex gap-1.5"><span class="w-2 h-2 rounded-full bg-violet-400 animate-bounce"></span><span class="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style="animation-delay:150ms"></span><span class="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style="animation-delay:300ms"></span></div></div>';
    var inputLivre = document.getElementById('ia-rel-pergunta-livre');
    var btnLivre = document.getElementById('btn-ia-rel-livre');
    if (inputLivre) inputLivre.disabled = true;
    if (btnLivre) { btnLivre.disabled = true; btnLivre.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
        var contextoDados = coletarDadosCompletosParaIA(descricaoRelatorio);
        var prompt = 'Voce e um analista de negocios experiente de uma loja de varejo brasileira chamada FC Gestao.\nAbaixo estao os dados reais do sistema de gestao desta loja. Com base nesses dados, realize a seguinte tarefa:\n\nTAREFA: '+descricaoRelatorio+'\n\nDADOS DO SISTEMA:\n'+contextoDados+'\n\nINSTRUCOES:\n- Use os dados reais fornecidos para embasar TODA a analise.\n- Se houver um Dossiê do Cliente/Produto fornecido, use-o prioritariamente pois contem todos os pedidos, quantidades de itens, faturamento e medias calculadas.\n- Se um dado nao estiver disponivel, informe claramente.\n- Organize a resposta em secoes com titulos claros.\n- Use tabelas quando apresentar rankings ou comparacoes.\n- Destaque pontos importantes em **negrito**.\n- Forneca insights praticos e acionaveis.\n- Seja objetivo, direto e profissional.\n- Escreva em Portugues do Brasil.\n- Ao final, adicione uma secao com 2-3 Recomendacoes Praticas baseadas nos dados.';
        var resposta = await chamarGemini(prompt);
        if (resposta) {
            renderizarRelatorioIA(resposta);
            if (typeof showToast === 'function') showToast('Relatorio gerado com sucesso!', 'success');
            
            // Salvar no Historico
            if (typeof firestore !== 'undefined' && typeof window.getEmpresaRef === 'function') {
                const empRef = window.getEmpresaRef();
                if (empRef) {
                    empRef.collection('relatorios_ia_historico').add({
                        pergunta: descricaoRelatorio,
                        resposta: resposta,
                        dataGeracao: new Date().toISOString()
                    }).then(function() {
                        if (typeof carregarHistoricoRelatoriosIA === 'function') {
                            carregarHistoricoRelatoriosIA();
                        }
                    }).catch(function(err){ console.error('Erro ao salvar historico:', err); });
                }
            }
        } else {
            divRes.innerHTML = '<div class="flex flex-col items-center py-8"><i class="fa-solid fa-triangle-exclamation text-4xl text-amber-400 mb-3"></i><p class="text-slate-300 font-semibold text-sm mb-1">Não foi possível gerar o relatório com IA</p><p class="text-slate-500 text-xs text-center max-w-md">Verifique se o módulo de Inteligência Artificial está ativo no plano da sua loja ou contate o suporte.</p></div>';
        }
    } catch(e) {
        console.error('Erro ao gerar relatorio com IA:', e);
        divRes.innerHTML = '<div class="p-4 text-center text-red-400 text-sm"><i class="fa-solid fa-xmark mr-2"></i>Erro: '+(e.message||'Tente novamente')+'</div>';
    } finally {
        if (inputLivre) inputLivre.disabled = false;
        if (btnLivre) { btnLivre.disabled = false; btnLivre.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span class="hidden sm:inline">Perguntar</span>'; }
    }
}

async function gerarRelatorioLivre() {
    if (typeof window.verificarAcessoRelatorio === 'function' && !window.verificarAcessoRelatorio('rel_ia_assistente')) {
        if (typeof showToast === 'function') showToast("O Assistente IA de Relatórios não está liberado no seu plano.", "warning");
        return;
    }
    var input = document.getElementById('ia-rel-pergunta-livre');
    if (!input) return;
    var pergunta = input.value.trim();
    if (!pergunta) { if (typeof showToast === 'function') showToast('Digite sua pergunta antes de enviar.', 'warning'); return; }
    input.value = '';
    await gerarRelatorioComIA(pergunta);
}

function renderizarRelatorioIA(resposta) {
    var divRes = document.getElementById('ia-rel-resultado');
    if (!divRes) return;
    
    // Armazena o texto puro no data-raw decodificando aspas para os botoes de copiar/baixar
    divRes.setAttribute('data-raw', resposta.replace(/"/g, '&quot;'));

    var html = resposta
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*(.+?)\*\*/g,'<strong class="text-white">$1</strong>')
        .replace(/\*(.+?)\*/g,'<em class="text-slate-300">$1</em>')
        .replace(/^###\s+(.+)$/gm,'<h4 class="text-violet-300 font-bold text-sm mt-5 mb-2">$1</h4>')
        .replace(/^##\s+(.+)$/gm,'<h3 class="text-violet-200 font-bold text-base mt-6 mb-2 border-b border-slate-700 pb-2">$1</h3>')
        .replace(/^#\s+(.+)$/gm,'<h2 class="text-white font-bold text-lg mt-6 mb-3">$1</h2>')
        .replace(/^---$/gm,'<hr class="border-slate-700 my-4">');

    // Parse de Tabelas Markdown
    html = html.replace(/(?:^[^\n]*\|[^\n]*\n?)+/gm, function(match) {
        if (!match.includes('|')) return match;
        var rows = match.trim().split('\n');
        var tableHtml = '<div class="overflow-x-auto my-5 rounded-lg border border-slate-700"><table class="w-full text-left border-collapse text-sm text-slate-300">';
        var hasHeaders = false;
        rows.forEach(function(row, index) {
            if (row.match(/^[\s\|:\-]+$/)) return;
            var cells = row.split('|');
            if(cells.length > 0 && cells[0].trim() === '') cells.shift();
            if(cells.length > 0 && cells[cells.length-1].trim() === '') cells.pop();
            
            tableHtml += '<tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">';
            cells.forEach(function(cell) {
                var isHeader = (index === 0);
                var tag = isHeader ? 'th' : 'td';
                var cls = isHeader ? 'px-4 py-3 text-violet-300 font-semibold text-xs uppercase tracking-wider bg-slate-800/50' : 'px-4 py-2.5';
                tableHtml += '<' + tag + ' class="' + cls + '">' + cell.trim() + '</' + tag + '>';
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</table></div>';
        return tableHtml;
    });

    // Parse de Listas
    html = html.replace(/^[•\-]\s+(.+)$/gm,'<li class="flex gap-2 items-start text-slate-200 text-sm mt-1.5"><span class="text-violet-400 mt-0.5"><i class="fa-solid fa-circle text-[8px]"></i></span><span>$1</span></li>')
        .replace(/^(\d+)\.\s+(.+)$/gm,'<li class="flex gap-2 items-start text-slate-200 text-sm mt-1.5"><span class="text-violet-300 font-bold shrink-0 mt-0.5">$1.</span><span>$2</span></li>')
        .replace(/\n\n/g,'</p><p class="text-slate-300 text-sm mb-3">')
        .replace(/\n/g,'<br>');

    // Limpeza de <br> excedentes perto das tabelas
    html = html.replace(/<br><div class="overflow-x-auto/g, '<div class="overflow-x-auto').replace(/<\/div><br>/g, '</div>');

    // Botões de Ação
    var botoes = `
        <div class="mt-8 pt-4 border-t border-slate-700/50 flex flex-wrap gap-2 justify-end">
            <button onclick="copiarRelatorioIA()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-all flex items-center gap-1.5">
                <i class="fa-regular fa-copy"></i> Copiar
            </button>
            <button onclick="baixarRelatorioTXT()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-all flex items-center gap-1.5" title="Texto">
                <i class="fa-solid fa-file-lines text-slate-400"></i> .TXT
            </button>
            <button onclick="baixarRelatorioPlanilha()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-all flex items-center gap-1.5" title="Excel">
                <i class="fa-solid fa-file-excel text-green-500"></i> Planilha
            </button>
            <button onclick="baixarRelatorioWord()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-all flex items-center gap-1.5" title="Word">
                <i class="fa-solid fa-file-word text-blue-500"></i> Word
            </button>
            <button onclick="window.print()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded border border-slate-600 transition-all flex items-center gap-1.5">
                <i class="fa-solid fa-print text-emerald-400"></i> Imprimir
            </button>
        </div>
    `;

    divRes.innerHTML = '<div><div class="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-700/50"><div class="flex items-center gap-2"><i class="fa-solid fa-file-lines text-violet-400 text-base"></i><span class="text-xs font-bold text-slate-300 uppercase tracking-wide">Relatório Inteligente (Gerado por IA)</span></div><span class="text-xs text-slate-500">'+new Date().toLocaleString('pt-BR')+'</span></div><div class="text-slate-200 text-sm leading-relaxed space-y-1" id="ia-rel-conteudo-html"><p class="text-slate-200 text-sm mb-2">'+html+'</p></div>'+botoes+'</div>';
}

function baixarRelatorioWord() {
    var divRes = document.getElementById('ia-rel-conteudo-html');
    if (!divRes) return;
    
    // Constrói um HTML simples suportado pelo Word
    var header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>";
    header += "<head><meta charset='utf-8'><title>Relatório IA - FC Gestão</title>";
    header += "<style>";
    header += "body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }";
    header += "h2 { color: #2E1B4E; font-size: 16pt; margin-top: 15pt; margin-bottom: 5pt; }";
    header += "h3 { color: #4B2885; font-size: 14pt; margin-top: 10pt; margin-bottom: 5pt; border-bottom: 1px solid #CCC; padding-bottom: 2pt; }";
    header += "h4 { color: #643EAC; font-size: 12pt; margin-top: 10pt; margin-bottom: 2pt; }";
    header += "table { border-collapse: collapse; width: 100%; margin-top: 10pt; margin-bottom: 10pt; }";
    header += "th, td { border: 1px solid #999; padding: 5pt; text-align: left; }";
    header += "th { background-color: #E8E0F5; font-weight: bold; }";
    header += "p, li { line-height: 1.5; }";
    header += "</style></head><body>";
    
    var htmlContent = divRes.innerHTML;
    // O Word se perde com algumas classes do tailwind, mas o CSS injetado acima contorna,
    // e o formato das tags é padrão (h2, h3, h4, table, tr, th, td, p, li)
    
    var footer = "</body></html>";
    var sourceHTML = header + htmlContent + footer;
    
    var source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    var fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'Relatorio_IA_FC_Gestao_' + Date.now() + '.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
}

function baixarRelatorioPlanilha() {
    var divRes = document.getElementById('ia-rel-resultado');
    if (!divRes) return;
    var texto = divRes.getAttribute('data-raw') || '';
    if (!texto) return;

    var linhas = texto.split('\\n');
    var csv = [];
    var dentroDaTabela = false;

    linhas.forEach(function(linha) {
        linha = linha.trim();
        // Converte tabelas Markdown para CSV
        if (linha.startsWith('|')) {
            if (linha.match(/^[\\s\\|:\\-]+$/)) return; // ignora linha de formatação markdown
            dentroDaTabela = true;
            var colunas = linha.split('|');
            // Remove primeiro e último que são vazios em markdown
            if (colunas.length > 0 && colunas[0].trim() === '') colunas.shift();
            if (colunas.length > 0 && colunas[colunas.length-1].trim() === '') colunas.pop();
            
            var csvRow = colunas.map(function(c) {
                var limpa = c.trim().replace(/\"/g, '""'); // escapa aspas
                return '"' + limpa + '"';
            });
            csv.push(csvRow.join(';')); // Usa ponto-e-vírgula para excel PT-BR
        } else {
            // Se não for tabela, insere como texto numa única célula para contexto
            if (linha !== '') {
                // Remove formatação de negrito e itálico do texto
                var limpa = linha.replace(/\\*\\*(.*?)\\*\\*/g, '$1').replace(/\\*(.*?)\\*/g, '$1');
                csv.push('"' + limpa.replace(/\"/g, '""') + '"');
            } else if (dentroDaTabela) {
                // Adiciona espaço após a tabela
                csv.push('');
                dentroDaTabela = false;
            }
        }
    });

    // Inserir BOM (Byte Order Mark) para o Excel reconhecer UTF-8
    var blob = new Blob(["\\uFEFF" + csv.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = 'Relatorio_IA_FC_Gestao_' + Date.now() + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(url); }, 100);
}

async function carregarHistoricoRelatoriosIA() {
    var list = document.getElementById('ia-historico-lista');
    var badgeCount = document.getElementById('ia-historico-count');
    if (!list) return;

    list.innerHTML = '<div class="text-center py-10 text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2.5"><div class="w-7 h-7 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div><span class="text-xs font-medium">Buscando análises anteriores...</span></div>';

    try {
        if (typeof firestore === 'undefined') {
            list.innerHTML = '<div class="text-center py-6 text-slate-400 text-xs">Banco de dados indisponível no momento.</div>';
            return;
        }

        if (typeof window.getEmpresaRef !== 'function') {
            list.innerHTML = '<div class="text-center py-6 text-slate-400 text-xs">Aguardando identificação da empresa...</div>';
            return;
        }

        const empresaRef = window.getEmpresaRef();
        if (!empresaRef) {
            list.innerHTML = '<div class="text-center py-6 text-slate-400 text-xs">Empresa não selecionada.</div>';
            return;
        }

        let docs = [];
        try {
            const snap = await empresaRef.collection('relatorios_ia_historico')
                .orderBy('dataGeracao', 'desc')
                .limit(50)
                .get();
            snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
        } catch (queryErr) {
            console.warn('[Relatorios IA] Fallback query historico sem orderBy:', queryErr);
            const snapFallback = await empresaRef.collection('relatorios_ia_historico').limit(50).get();
            snapFallback.forEach(d => docs.push({ id: d.id, ...d.data() }));
            docs.sort((a, b) => new Date(b.dataGeracao || 0) - new Date(a.dataGeracao || 0));
        }

        if (badgeCount) {
            badgeCount.innerText = docs.length;
        }

        if (docs.length === 0) {
            list.innerHTML = '<div class="text-center py-12 px-4 text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2"><div class="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-base mb-1"><i class="fa-solid fa-sparkles"></i></div><span class="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhuma análise anterior</span><p class="text-[11px] text-slate-400 max-w-[220px] leading-relaxed">Clique em uma das opções sugeridas ou faça uma pergunta livre para gerar sua primeira análise com IA!</p></div>';
            return;
        }

        var html = '';
        docs.forEach(function(item) {
            var d = item.dataGeracao ? new Date(item.dataGeracao) : new Date();
            var dataFmt = !isNaN(d.getTime()) 
                ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : 'Recente';
            var titulo = (item.pergunta || 'Análise Comercial Inteligente').trim();
            var preview = (item.resposta || '')
                .replace(/[*#_`|>-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 95);
            if (preview.length >= 95) preview += '...';

            html += '<div class="shrink-0 relative bg-white/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-400/80 dark:hover:border-indigo-500/80 rounded-xl p-3 transition-all duration-200 cursor-pointer shadow-sm hover:shadow group" onclick="verRelatorioHistorico(\''+item.id+'\')">' +
                '<div class="flex items-start justify-between gap-2 mb-1.5">' +
                    '<div class="flex items-center gap-1.5 min-w-0">' +
                        '<i class="fa-solid fa-robot text-indigo-500 text-[11px] shrink-0"></i>' +
                        '<h5 class="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate leading-snug">'+titulo+'</h5>' +
                    '</div>' +
                    '<span class="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">'+dataFmt+'</span>' +
                '</div>' +
                '<p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed pl-4">'+(preview || 'Clique para visualizar o relatório completo gerado.')+'</p>' +
                '<div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between text-[10px] text-indigo-500 font-semibold pl-4">' +
                    '<span class="flex items-center gap-1 group-hover:underline"><i class="fa-solid fa-eye text-[9px]"></i> Ver Relatório</span>' +
                    '<button type="button" onclick="event.stopPropagation(); deletarRelatorioHistorico(\''+item.id+'\')" class="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors" title="Excluir do histórico">' +
                        '<i class="fa-solid fa-trash-can text-[10px]"></i>' +
                    '</button>' +
                '</div>' +
                '<textarea id="hist-raw-'+item.id+'" class="hidden">'+(item.resposta || '').replace(/</g,'&lt;')+'</textarea>' +
            '</div>';
        });
        list.innerHTML = html;
    } catch (e) {
        console.error('[Relatorios IA] Erro ao carregar historico:', e);
        list.innerHTML = '<div class="text-center py-6 text-red-400 text-xs">Erro ao consultar histórico: ' + (e.message || 'Tente novamente.') + '</div>';
    }
}

function verRelatorioHistorico(id) {
    var rawEl = document.getElementById('hist-raw-' + id);
    if (!rawEl) return;
    renderizarRelatorioIA(rawEl.value);
    
    // Rola suavemente até o container de resultado
    var divRes = document.getElementById('ia-rel-resultado');
    if (divRes) {
        divRes.scrollIntoView({ behavior: 'smooth', block: 'start' });
        divRes.classList.add('ring-4', 'ring-indigo-500/40');
        setTimeout(() => divRes.classList.remove('ring-4', 'ring-indigo-500/40'), 1500);
    }
}

async function deletarRelatorioHistorico(id) {
    if (!confirm('Deseja realmente remover esta análise do seu histórico?')) return;
    try {
        const empresaRef = window.getEmpresaRef();
        if (empresaRef) {
            await empresaRef.collection('relatorios_ia_historico').doc(id).delete();
            if (typeof showToast === 'function') showToast('Análise removida do histórico.', 'info');
            carregarHistoricoRelatoriosIA();
        }
    } catch (e) {
        console.error('Erro ao excluir historico IA:', e);
        if (typeof showToast === 'function') showToast('Erro ao remover: ' + e.message, 'error');
    }
}


function mudarAbaRelIA(aba) {
    document.querySelectorAll('.ia-chips-area').forEach(function(el){el.classList.add('hidden');});
    var chips = document.getElementById('ia-chips-'+aba);
    if (chips) chips.classList.remove('hidden');
    document.querySelectorAll('.ia-rel-tab').forEach(function(btn){
        btn.classList.remove('border-violet-500','text-violet-300');
        btn.classList.add('border-transparent','text-slate-400');
    });
    var tab = document.getElementById('ia-tab-'+aba);
    if (tab) { tab.classList.remove('border-transparent','text-slate-400'); tab.classList.add('border-violet-500','text-violet-300'); }
}

window.copiarRelatorioIA = function() {
    var raw = document.getElementById('ia-rel-resultado').getAttribute('data-raw');
    if(!raw) return;
    raw = raw.replace(/&quot;/g, '"');
    navigator.clipboard.writeText(raw).then(function(){
        if(typeof showToast === 'function') showToast('Relatório copiado para a área de transferência!', 'success');
        else alert('Relatório copiado para a área de transferência!');
    });
};

window.baixarRelatorioTXT = function() {
    var raw = document.getElementById('ia-rel-resultado').getAttribute('data-raw');
    if(!raw) return;
    raw = raw.replace(/&quot;/g, '"');
    var blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    var dateStr = new Date().toISOString().split('T')[0];
    link.download = 'Relatorio_IA_FC_Gestao_' + dateStr + '.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.gerarRelatorioComIA = gerarRelatorioComIA;
window.gerarRelatorioLivre = gerarRelatorioLivre;
window.renderizarRelatorioIA = renderizarRelatorioIA;
window.mudarAbaRelIA = mudarAbaRelIA;
window.coletarDadosCompletosParaIA = coletarDadosCompletosParaIA;




// =========================================================================
// MÓDULO: RELATÓRIO DETALHADO DE COMISSÕES POR VENDEDOR & CONTROLE POR PLANO
// =========================================================================

let _graficoComissaoChart = null;
let _dadosComissaoAtual = { vendedores: {}, totalVendas: 0, totalComissao: 0, periodo: '' };
let _vendedorExtratoSelecionado = null;

function formatarDataBR(dataStr) {
    if (!dataStr) return '';
    if (dataStr.includes('T')) dataStr = dataStr.split('T')[0];
    let parts = dataStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dataStr;
}

function isVendaEfetivaParaComissao(v) {
    if (!v) return false;

    // Status cancelado ou de orcamento
    const status = String(v.status || '').trim().toUpperCase();
    if (status === 'CANCELADA' || status === 'CANCELADO') return false;
    if (status === 'ORÇAMENTO' || status === 'ORCAMENTO' || status.includes('ORÇ') || status.includes('ORC')) return false;

    // Tipo de operacao
    const tipo = String(v.tipo || '').trim().toUpperCase();
    if (tipo === 'ORÇAMENTO' || tipo === 'ORCAMENTO' || tipo.includes('ORÇ') || tipo.includes('ORC')) return false;

    // Operacao do PDV
    const operacao = String(v.operacao || '').trim().toUpperCase();
    if (operacao === 'ORÇAMENTO' || operacao === 'ORCAMENTO' || operacao.includes('ORÇ') || operacao.includes('ORC')) return false;

    // Flags booleanas
    if (v.isOrcamento === true || v.isOrcamento === 'true' || v.orcamento === true) return false;

    // Forma de pagamento indicando orcamento
    const pag = String(v.pag || v.formaPagamento || '').toUpperCase();
    if (pag.includes('ORÇAMENTO') || pag.includes('ORCAMENTO')) return false;

    return true;
}



function renderizarRelatorioComissoes() {
    const card = document.getElementById('card-comissao-vendedores');
    if (!card) return;

    // Popula select de vendedores com os vendedores cadastrados e os que têm vendas
    const selVend = document.getElementById('filtro-comissao-vendedor');
    if (selVend) {
        const valAtual = selVend.value || 'TODOS';
        const nomesVendedoresSet = new Set();

        (db.funcionarios || []).forEach(f => {
            if (f.nome && (f.vendedor === 'SIM' || f.vendedor === 'Sim' || f.vendedor === true)) {
                nomesVendedoresSet.add(f.nome.trim().toUpperCase());
            }
        });
        (db.vendas || []).forEach(v => {
            if (!isVendaEfetivaParaComissao(v)) return;
            if (v.vendedor && v.vendedor.trim()) {
                nomesVendedoresSet.add(v.vendedor.trim().toUpperCase());
            }
        });

        const nomesOrdenados = Array.from(nomesVendedoresSet).sort();
        let optionsHtml = '<option value="TODOS">Todos os Vendedores</option>';
        nomesOrdenados.forEach(nome => {
            const isSel = valAtual === nome ? 'selected' : '';
            optionsHtml += `<option value="${nome}" ${isSel}>${nome}</option>`;
        });
        selVend.innerHTML = optionsHtml;
    }

    // Inicializa datas padrão (mês atual) se vazias
    const inpIni = document.getElementById('filtro-comissao-data-ini');
    const inpFim = document.getElementById('filtro-comissao-data-fim');
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');

    if (inpIni && !inpIni.value) {
        inpIni.value = `${ano}-${mes}-01`;
    }
    if (inpFim && !inpFim.value) {
        inpFim.value = `${ano}-${mes}-${dia}`;
    }

    const dataIniStr = inpIni ? inpIni.value : '';
    const dataFimStr = inpFim ? inpFim.value : '';
    const vendFiltro = selVend ? selVend.value : 'TODOS';

    const dIni = dataIniStr ? new Date(`${dataIniStr}T00:00:00`).getTime() : 0;
    const dFim = dataFimStr ? new Date(`${dataFimStr}T23:59:59`).getTime() : Infinity;

    // Mapa de taxas de comissão dos funcionários
    const funcComissaoMap = {};
    (db.funcionarios || []).forEach(f => {
        if (f.nome) {
            const n = f.nome.trim().toUpperCase();
            funcComissaoMap[n] = Number(f.comissao || 0);
        }
    });

    // Filtra exclusivamente VENDAS efetivas (exclui orcamentos, canceladas, etc)
    const todasVendas = db.vendas || [];
    const vendasFiltradas = todasVendas.filter(v => {
        if (!isVendaEfetivaParaComissao(v)) return false;

        const dTime = v.data ? new Date(v.data).getTime() : 0;
        if (dTime < dIni || dTime > dFim) return false;

        const vNome = (v.vendedor || 'Sem Vendedor').trim().toUpperCase();
        if (vendFiltro !== 'TODOS' && vNome !== vendFiltro) return false;

        return true;
    });

    // Agrupamento por vendedor
    const vendedoresMap = {};
    let totalGeralVendas = 0;
    let totalGeralComissao = 0;

    vendasFiltradas.forEach(v => {
        const vNome = (v.vendedor || 'SEM VENDEDOR').trim().toUpperCase();
        const totVenda = Number(v.tot || v.total || v.valorFinal || v.valor || 0);

        let perc = 0;
        if (v.comissaoPerc !== undefined && v.comissaoPerc !== null && v.comissaoPerc !== '') {
            perc = Number(v.comissaoPerc);
        } else if (funcComissaoMap[vNome] !== undefined) {
            perc = funcComissaoMap[vNome];
        }

        const valComissao = totVenda * (perc / 100);

        if (!vendedoresMap[vNome]) {
            vendedoresMap[vNome] = {
                nome: vNome,
                qtdVendas: 0,
                totalFaturado: 0,
                comissaoPercPadrao: perc,
                totalComissao: 0,
                vendas: []
            };
        }

        vendedoresMap[vNome].qtdVendas += 1;
        vendedoresMap[vNome].totalFaturado += totVenda;
        vendedoresMap[vNome].totalComissao += valComissao;
        vendedoresMap[vNome].vendas.push({
            id: v.id || v.numeroPedido || '-',
            numeroPedido: v.numeroPedido || v.id || '-',
            data: v.data || '',
            clienteNome: v.clienteNome || v.cliente || 'Consumidor',
            pag: v.pag || v.formaPagamento || 'A Vista',
            valorTotal: totVenda,
            comissaoPerc: perc,
            comissaoValor: valComissao
        });

        totalGeralVendas += totVenda;
        totalGeralComissao += valComissao;
    });

    _dadosComissaoAtual = {
        vendedores: vendedoresMap,
        totalVendas: totalGeralVendas,
        totalComissao: totalGeralComissao,
        periodo: `${dataIniStr ? formatarDataBR(dataIniStr) : ''} até ${dataFimStr ? formatarDataBR(dataFimStr) : ''}`
    };

    // Atualiza KPIs
    const elTotVendas = document.getElementById('kpi-comissao-total-vendas');
    if (elTotVendas) elTotVendas.innerText = formatMoney(totalGeralVendas);

    const elQtdVendas = document.getElementById('kpi-comissao-qtd-pedidos');
    if (elQtdVendas) elQtdVendas.innerText = `${vendasFiltradas.length} venda(s) no período`;

    const elTotComissao = document.getElementById('kpi-comissao-total-valor');
    if (elTotComissao) elTotComissao.innerText = formatMoney(totalGeralComissao);

    const elTicketMedio = document.getElementById('kpi-comissao-ticket-medio');
    const ticket = vendasFiltradas.length > 0 ? (totalGeralVendas / vendasFiltradas.length) : 0;
    if (elTicketMedio) elTicketMedio.innerText = formatMoney(ticket);

    // Top Vendedor
    const listaVendOrdenada = Object.values(vendedoresMap).sort((a, b) => b.totalFaturado - a.totalFaturado);
    const topVend = listaVendOrdenada.length > 0 ? listaVendOrdenada[0] : null;

    const elTopNome = document.getElementById('kpi-comissao-top-vendedor');
    const elTopValor = document.getElementById('kpi-comissao-top-valor');
    if (elTopNome) elTopNome.innerText = topVend ? topVend.nome : '-';
    if (elTopValor) elTopValor.innerText = topVend ? `${formatMoney(topVend.totalComissao)} em comissão (${topVend.qtdVendas} vendas)` : 'R$ 0,00';

    // Renderiza Tabela de Vendedores
    const tbody = document.getElementById('tabela-comissao-vendedores-body');
    if (tbody) {
        if (listaVendOrdenada.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Nenhuma venda comissionada no período selecionado.</td></tr>';
        } else {
            tbody.innerHTML = listaVendOrdenada.map(vend => {
                const percMedio = vend.totalFaturado > 0 ? ((vend.totalComissao / vend.totalFaturado) * 100) : vend.comissaoPercPadrao;
                const nomeEscapado = vend.nome.replace(/'/g, "\\'");
                return `
                    <tr class="dark:hover:bg-slate-800 transition-colors">
                        <td class="p-3 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <div class="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-xs">
                                <i class="fa-solid fa-user-tie"></i>
                            </div>
                            <span>${vend.nome}</span>
                        </td>
                        <td class="p-3 text-center font-semibold text-slate-600 dark:text-slate-300">${vend.qtdVendas}</td>
                        <td class="p-3 text-right font-bold text-slate-700 dark:text-slate-200">${formatMoney(vend.totalFaturado)}</td>
                        <td class="p-3 text-center font-bold text-blue-600 dark:text-blue-400">${percMedio.toFixed(1)}%</td>
                        <td class="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">${formatMoney(vend.totalComissao)}</td>
                        <td class="p-3 text-center print:hidden">
                            <button onclick="abrirExtratoComissaoVendedor('${nomeEscapado}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 mx-auto" title="Ver Vendas e Imprimir Recibo">
                                <i class="fa-solid fa-file-invoice-dollar"></i> Extrato
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Renderiza Gráfico Comparativo ApexCharts
    renderGraficoComissao(listaVendOrdenada);
}
window.renderizarRelatorioComissoes = renderizarRelatorioComissoes;

function renderGraficoComissao(listaVendedores) {
    const container = document.getElementById('grafico-comissao-vendedores');
    if (!container || typeof ApexCharts === 'undefined') return;

    if (_graficoComissaoChart) {
        try { _graficoComissaoChart.destroy(); } catch(e) {}
        _graficoComissaoChart = null;
    }

    const top5 = listaVendedores.slice(0, 8);
    if (top5.length === 0) {
        container.innerHTML = '<div class="text-xs text-slate-400 italic text-center py-6">Sem dados suficientes para o gráfico no período.</div>';
        return;
    }

    container.innerHTML = '';
    const isDark = document.documentElement.classList.contains('dark');

    const options = {
        series: [{
            name: 'Comissão (R$)',
            data: top5.map(v => Number(v.totalComissao.toFixed(2)))
        }],
        chart: {
            type: 'bar',
            height: 220,
            toolbar: { show: false },
            background: 'transparent'
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                horizontal: false,
                columnWidth: '45%',
                distributed: true
            }
        },
        colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#14b8a6', '#6366f1'],
        dataLabels: {
            enabled: true,
            formatter: val => formatMoney(val),
            style: { fontSize: '10px', fontWeight: 'bold' }
        },
        xaxis: {
            categories: top5.map(v => v.nome.split(' ')[0]),
            labels: {
                style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', fontWeight: 'bold' }
            }
        },
        yaxis: {
            labels: {
                formatter: val => formatMoney(val),
                style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '10px' }
            }
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            y: { formatter: val => formatMoney(val) }
        },
        legend: { show: false },
        grid: {
            borderColor: isDark ? '#334155' : '#e2e8f0',
            strokeDashArray: 3
        }
    };

    try {
        _graficoComissaoChart = new ApexCharts(container, options);
        _graficoComissaoChart.render();
    } catch(err) {
        console.warn('Erro ao renderizar gráfico de comissão:', err);
    }
}
window.renderGraficoComissao = renderGraficoComissao;

function abrirExtratoComissaoVendedor(vendedorNome) {
    const dados = _dadosComissaoAtual.vendedores[vendedorNome];
    if (!dados) return;

    _vendedorExtratoSelecionado = dados;

    const elNome = document.getElementById('modal-extrato-nome-vendedor');
    if (elNome) elNome.innerText = dados.nome;

    const elPeriodo = document.getElementById('modal-extrato-periodo-info');
    if (elPeriodo) elPeriodo.innerText = `Período: ${_dadosComissaoAtual.periodo || 'Geral'}`;

    const elQtd = document.getElementById('modal-extrato-qtd-vendas');
    if (elQtd) elQtd.innerText = `${dados.qtdVendas} pedidos`;

    const elFat = document.getElementById('modal-extrato-total-faturado');
    if (elFat) elFat.innerText = formatMoney(dados.totalFaturado);

    const elCom = document.getElementById('modal-extrato-total-comissao');
    if (elCom) elCom.innerText = formatMoney(dados.totalComissao);

    const tbody = document.getElementById('modal-extrato-tabela-vendas');
    if (tbody) {
        tbody.innerHTML = (dados.vendas || []).map(v => {
            const dataFmt = v.data ? formatarDataBR(v.data) : '-';
            return `
                <tr class="dark:hover:bg-slate-800">
                    <td class="p-2.5 font-medium text-slate-700 dark:text-slate-300">${dataFmt}</td>
                    <td class="p-2.5 font-bold text-blue-600">#${v.numeroPedido}</td>
                    <td class="p-2.5 font-medium text-slate-800 dark:text-slate-200">${v.clienteNome}</td>
                    <td class="p-2.5 text-slate-500">${v.pag}</td>
                    <td class="p-2.5 text-right font-bold text-slate-700 dark:text-slate-200">${formatMoney(v.valorTotal)}</td>
                    <td class="p-2.5 text-center font-bold text-blue-500">${v.comissaoPerc}%</td>
                    <td class="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">${formatMoney(v.comissaoValor)}</td>
                </tr>
            `;
        }).join('');
    }

    const modal = document.getElementById('modal-extrato-comissao');
    if (modal) modal.classList.remove('hidden');
}
window.abrirExtratoComissaoVendedor = abrirExtratoComissaoVendedor;

function fecharModalExtratoComissao() {
    const modal = document.getElementById('modal-extrato-comissao');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalExtratoComissao = fecharModalExtratoComissao;

function imprimirExtratoIndividualVendedor() {
    if (!_vendedorExtratoSelecionado) return;
    const v = _vendedorExtratoSelecionado;
    const emp = (window.currentEmpresaData) || { nomeEmpresa: 'FC Gestão' };

    const win = window.open('', '_blank');
    const linhas = (v.vendas || []).map(item => `
        <tr>
            <td style="padding:6px; border-bottom:1px solid #eee;">${item.data ? formatarDataBR(item.data) : '-'}</td>
            <td style="padding:6px; border-bottom:1px solid #eee;">#${item.numeroPedido}</td>
            <td style="padding:6px; border-bottom:1px solid #eee;">${item.clienteNome}</td>
            <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${formatMoney(item.valorTotal)}</td>
            <td style="padding:6px; border-bottom:1px solid #eee; text-align:center;">${item.comissaoPerc}%</td>
            <td style="padding:6px; border-bottom:1px solid #eee; text-align:right; font-weight:bold; color:#059669;">${formatMoney(item.comissaoValor)}</td>
        </tr>
    `).join('');

    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Recibo de Comissão - ${v.nome}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 800px; margin: auto; }
                h1, h2, h3 { margin: 0; }
                .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; }
                .grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; }
                .card { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
                th { background: #059669; color: white; padding: 8px 6px; text-align: left; }
                .ass-box { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
                .ass-linha { border-top: 1px solid #64748b; padding-top: 6px; text-align: center; font-size: 12px; flex: 1; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>${emp.nomeEmpresa || 'FC Gestão'}</h2>
                <p style="margin:4px 0 0; color:#64748b; font-size:12px;">Extrato de Fechamento de Comissão de Vendas</p>
            </div>
            <div class="grid">
                <div>
                    <strong>Colaborador / Vendedor:</strong> ${v.nome}<br>
                    <strong>Período:</strong> ${_dadosComissaoAtual.periodo || 'Atual'}
                </div>
                <div style="text-align:right;">
                    <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                </div>
            </div>
            <div class="card" style="display:flex; justify-content:space-around; text-align:center; margin-bottom:20px;">
                <div>
                    <div style="font-size:11px; color:#64748b; font-weight:bold;">PEDIDOS VENDIDOS</div>
                    <div style="font-size:18px; font-weight:bold; color:#1e293b;">${v.qtdVendas}</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#64748b; font-weight:bold;">TOTAL FATURADO</div>
                    <div style="font-size:18px; font-weight:bold; color:#2563eb;">${formatMoney(v.totalFaturado)}</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#059669; font-weight:bold;">TOTAL DE COMISSÃO A PAGAR</div>
                    <div style="font-size:20px; font-weight:900; color:#059669;">${formatMoney(v.totalComissao)}</div>
                </div>
            </div>
            <h3>Detalhamento das Vendas</h3>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th style="text-align:right;">Valor Venda</th>
                        <th style="text-align:center;">% Com.</th>
                        <th style="text-align:right;">Valor Comissão</th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>
            <div class="ass-box">
                <div class="ass-linha">
                    Assinatura da Empresa / Gestão
                </div>
                <div class="ass-linha">
                    Assinatura do Vendedor (${v.nome})
                </div>
            </div>
        </body>
        </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
}
window.imprimirExtratoIndividualVendedor = imprimirExtratoIndividualVendedor;

function imprimirRelatorioComissoes() {
    if (typeof imprimirRelatorioIndividual === 'function') {
        imprimirRelatorioIndividual('card-comissao-vendedores', 'Relatório Geral de Comissões por Vendedor');
    } else {
        window.print();
    }
}
window.imprimirRelatorioComissoes = imprimirRelatorioComissoes;

// -------------------------------------------------------------------------
// CONTROLE DE ACESSO VISUAL AOS RELATÓRIOS POR PLANO
// -------------------------------------------------------------------------
function aplicarControleAcessoRelatoriosPorPlano() {
    if (typeof window.verificarAcessoRelatorio !== 'function') return;

    const cards = document.querySelectorAll('[data-relatorio-id]');
    cards.forEach(card => {
        const relId = card.getAttribute('data-relatorio-id');
        if (!relId) return;

        const permitido = window.verificarAcessoRelatorio(relId);
        let overlayExistente = card.querySelector('.card-relatorio-bloqueado-overlay');

        if (!permitido) {
            // Marca atributo de bloqueio estrito
            card.setAttribute('data-relatorio-bloqueado', 'true');
            card.style.position = 'relative';
            card.style.overflow = 'hidden';

            // Oculta completamente todos os filhos internos para impedir QUALQUER visualizacao
            Array.from(card.children).forEach(child => {
                if (!child.classList.contains('card-relatorio-bloqueado-overlay')) {
                    child.style.visibility = 'hidden';
                    child.style.opacity = '0';
                    child.style.pointerEvents = 'none';
                    child.style.userSelect = 'none';
                    child.setAttribute('aria-hidden', 'true');
                }
            });

            if (!overlayExistente) {
                const overlay = document.createElement('div');
                overlay.className = 'card-relatorio-bloqueado-overlay absolute inset-0 z-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center p-6 text-center border border-amber-500/40 select-none';
                overlay.style.backgroundColor = '#0f172a';
                overlay.style.opacity = '1';
                overlay.innerHTML = `
                    <div class="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl mb-3 shadow-lg shadow-amber-500/10">
                        <i class="fa-solid fa-lock"></i>
                    </div>
                    <h4 class="text-base font-black text-white mb-1.5">Relatório Bloqueado no seu Plano</h4>
                    <p class="text-xs text-slate-300 max-w-sm mb-4 leading-relaxed">
                        Este relatório analítico avançado está disponível para contratação. Faça o upgrade do seu plano para liberá-lo imediatamente.
                    </p>
                    <a href="https://wa.me/5562993341774?text=${encodeURIComponent('Olá! Gostaria de fazer upgrade do plano para liberar relatórios adicionais no FC-Gestão.')}" target="_blank" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95">
                        <i class="fa-brands fa-whatsapp text-sm"></i> Fazer Upgrade
                    </a>
                `;
                card.appendChild(overlay);
            } else {
                overlayExistente.style.backgroundColor = '#0f172a';
                overlayExistente.style.opacity = '1';
                overlayExistente.classList.remove('bg-slate-900/90', 'backdrop-blur-[3px]');
                overlayExistente.classList.add('bg-slate-900', 'z-40');
            }
        } else {
            // Desbloqueia e restaura visibilidade
            card.removeAttribute('data-relatorio-bloqueado');
            if (overlayExistente) {
                overlayExistente.remove();
            }
            Array.from(card.children).forEach(child => {
                child.style.visibility = '';
                child.style.opacity = '';
                child.style.pointerEvents = '';
                child.style.userSelect = '';
                child.removeAttribute('aria-hidden');
            });
        }
    });
}
window.aplicarControleAcessoRelatoriosPorPlano = aplicarControleAcessoRelatoriosPorPlano;

window.carregarHistoricoRelatoriosIA = carregarHistoricoRelatoriosIA;
window.verRelatorioHistorico = verRelatorioHistorico;
window.deletarRelatorioHistorico = deletarRelatorioHistorico;


window.atualizarLimiteExtratoVendedor = function() {
    if (!_vendedorExtratoSelecionado) return;
    const dados = _vendedorExtratoSelecionado;
    const selLimite = document.getElementById('modal-extrato-filtro-limite');
    const limite = selLimite ? (selLimite.value === 'TODOS' ? Infinity : (parseInt(selLimite.value, 10) || 10)) : 10;
    const vendas = (dados.vendas || []).slice(0, limite);

    const tbody = document.getElementById('modal-extrato-tabela-vendas');
    if (tbody) {
        tbody.innerHTML = vendas.map(v => {
            const dataFmt = v.data ? formatarDataBR(v.data) : '-';
            return `
                <tr class="dark:hover:bg-slate-800">
                    <td class="p-2.5 font-medium text-slate-700 dark:text-slate-300">${dataFmt}</td>
                    <td class="p-2.5 font-bold text-blue-600">#${v.numeroPedido}</td>
                    <td class="p-2.5 font-medium text-slate-800 dark:text-slate-200">${v.clienteNome}</td>
                    <td class="p-2.5 text-slate-500">${v.pag}</td>
                    <td class="p-2.5 text-right font-bold text-slate-700 dark:text-slate-200">${formatMoney(v.valorTotal)}</td>
                    <td class="p-2.5 text-center font-bold text-blue-500">${v.comissaoPerc}%</td>
                    <td class="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">${formatMoney(v.comissaoValor)}</td>
                </tr>
            `;
        }).join('');
    }
};
