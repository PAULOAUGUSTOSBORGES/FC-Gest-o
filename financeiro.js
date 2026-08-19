// ==========================================
// GESTÃO.JS - ERP FINANCEIRO, DASHBOARD E PROJEÇÕES
// ==========================================

var ofxItemAtualIdx = null;
window.ofxItemAtualIdx = null;
window.extratoOFXAtual = null;
var ofxModoAtual = 'VINCULAR';
window.ofxModoAtual = 'VINCULAR';
var ofxTituloVinculadoId = null;
window.ofxTituloVinculadoId = null;

let acaoConfirmacaoPendente = null;
window.tempXMLData = null; 
window.xmlItemEditIndex = null;
let compraManualItens = []; 

const categoriasPagar = ['Fornecedores / Compras', 'Impostos (DAS, ICMS, etc)', 'Salários / Folha', 'Aluguel', 'Água', 'Energia', 'Internet / Telefonia', 'Contabilidade', 'Sistema / Software', 'IPTU', 'Outras Despesas'];
const categoriasReceber = ['Vendas', 'Serviços', 'Outras Receitas'];

// ==========================================
// FUNÇÕES DE TÍTULOS (DETALHES, BAIXA, RENEGOCIAÇÃO)
// ==========================================
function verDetalhesTitulo(id) {
    if (!db.financeiro) return;
    const f = db.financeiro.find(x => String(x.id) === String(id));
    if (!f) return;
    const isReceita = f.tipo === 'RECEITA' || !f.tipo;
    const headerEl = document.getElementById('det-tit-header');
    if (headerEl) headerEl.className = `p-4 md:p-5 text-white flex justify-between items-center ${isReceita ? 'bg-blue-600' : 'bg-rose-600'}`;
    const lblPessoa = document.getElementById('det-tit-lbl-pessoa');
    if (lblPessoa) lblPessoa.innerText = isReceita ? 'Cliente / Pagador' : 'Fornecedor / Favorecido';
    const detPessoa = document.getElementById('det-tit-pessoa');
    if (detPessoa) detPessoa.innerText = f.pessoa || 'Não informado';
    
    const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime();
    const badge = document.getElementById('det-tit-status');
    if (badge) {
        badge.innerText = f.status === 'PAGO' ? 'PAGO' : (isAtrasado ? 'ATRASADO' : 'PENDENTE');
        badge.className = `mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${f.status === 'PAGO' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : (isAtrasado ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300')}`;
    }
    
    const detVenc = document.getElementById('det-tit-venc');
    if (detVenc) detVenc.innerText = formatData(f.data).split(' ')[0];
    const detValOrig = document.getElementById('det-tit-valor-orig');
    if (detValOrig) detValOrig.innerText = formatMoney(f.valor);
    const detRef = document.getElementById('det-tit-ref');
    if (detRef) detRef.innerText = f.ref || '-';
    const detCat = document.getElementById('det-tit-cat');
    if (detCat) detCat.innerText = f.categoria || '-';
    
    const areaPgto = document.getElementById('det-tit-area-pagamento');
    if (areaPgto) {
        if (f.status === 'PAGO') {
            areaPgto.classList.remove('hidden');
            const dtPag = document.getElementById('det-tit-dtpag');
            if (dtPag) dtPag.innerText = f.dataPagamento ? formatData(f.dataPagamento).split(' ')[0] : '-';
            const metodo = document.getElementById('det-tit-metodo');
            if (metodo) metodo.innerText = f.metodoPagamento || '-';
            const valFin = document.getElementById('det-tit-valfinal');
            if (valFin) valFin.innerText = formatMoney(f.valorPago || f.valor);
        } else {
            areaPgto.classList.add('hidden');
        }
    }
    const modal = document.getElementById('modal-detalhes-titulo');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalDetalhesTitulo() {
    const modal = document.getElementById('modal-detalhes-titulo');
    if (modal) modal.classList.add('hidden');
}

function abrirModalBaixa(id) {
    if (!db.financeiro) return;
    const f = db.financeiro.find(x => String(x.id) === String(id));
    if (!f) return;
    const bId = document.getElementById('baixa-id');
    if (bId) bId.value = f.id;
    const bValOrig = document.getElementById('baixa-valor-original');
    if (bValOrig) bValOrig.innerText = formatMoney(f.valor);
    const bVenc = document.getElementById('baixa-vencimento');
    if (bVenc) bVenc.innerText = formatData(f.data).split(' ')[0];
    const bAc = document.getElementById('baixa-acrescimo');
    if (bAc) bAc.value = 0;
    const bDesc = document.getElementById('baixa-desconto');
    if (bDesc) bDesc.value = 0;
    calcularAcrescimos();
    const modal = document.getElementById('modal-baixa-conta');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalBaixa() {
    const modal = document.getElementById('modal-baixa-conta');
    if (modal) modal.classList.add('hidden');
}

function calcularAcrescimos() {
    const id = document.getElementById('baixa-id')?.value;
    const f = db.financeiro?.find(x => String(x.id) === String(id));
    if (!f) return 0;
    const ac = parseFloat(document.getElementById('baixa-acrescimo')?.value) || 0;
    const de = parseFloat(document.getElementById('baixa-desconto')?.value) || 0;
    const vf = f.valor + ac - de;
    const bValFin = document.getElementById('baixa-valor-final');
    if (bValFin) bValFin.innerText = formatMoney(vf);
    return vf;
}

async function confirmarBaixa() {
    const id = document.getElementById('baixa-id')?.value;
    const f = db.financeiro?.find(x => String(x.id) === String(id));
    if (!f) return;
    const vf = calcularAcrescimos();
    const metodo = document.getElementById('baixa-metodo')?.value || 'Pix';
    const batch = firestore.batch();
    
    if (metodo === 'Dinheiro') {
        let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
        let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
        let cxSaldoNovo = cxAtual.saldo || 0;
        
        if (cxAtual.status !== 'ABERTO') return showToast('Abra o Caixa Físico primeiro!', 'error');
        if (f.tipo === 'RECEITA') {
            cxSaldoNovo += vf;
            cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `Recbto. Título: ${f.pessoa}`, valor: vf });
        } else {
            if (vf > cxSaldoNovo) return showToast('Saldo do Caixa insuficiente!', 'error');
            cxSaldoNovo -= vf;
            cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Pgto. Título: ${f.pessoa}`, valor: vf });
        }
        batch.set(firestore.collection('fc_moveis').doc('caixa'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
    }
    
    const finRef = firestore.collection('financeiro').doc(String(id));
    batch.update(finRef, { status: 'PAGO', valorPago: vf, metodoPagamento: metodo, dataPagamento: new Date().toISOString(), ultimaAlteracao: Date.now() });
    
    try {
        await batch.commit();
        fecharModalBaixa();
        renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar');
        showToast('Baixa realizada com sucesso!', 'success');
    } catch(e) {
        console.error(e);
        showToast('Erro ao realizar baixa.', 'error');
    }
}

window.verDetalhesTitulo = verDetalhesTitulo;
window.fecharModalDetalhesTitulo = fecharModalDetalhesTitulo;
window.abrirModalBaixa = abrirModalBaixa;
window.fecharModalBaixa = fecharModalBaixa;
window.calcularAcrescimos = calcularAcrescimos;
window.confirmarBaixa = confirmarBaixa;

// Evita o "piscar" da tela carregando as abas instantaneamente antes do Firebase
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'financeiro';
    if (typeof mudarVisaoLocal === 'function') mudarVisaoLocal(view);
});

// ==========================================
// 1. NAVEGAÇÃO E DASHBOARDS
// ==========================================
function mudarVisaoLocal(viewId) {
    document.querySelectorAll('.view-section').forEach(el => { 
        el.classList.add('hidden'); 
        el.classList.remove('active'); 
    });
    
    const v = document.getElementById(`view-${viewId}`);
    if (v) { 
        v.classList.remove('hidden'); 
        v.classList.add('active'); 
    }
    
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => { 
        btn.classList.remove('bg-blue-600', 'text-white'); 
        btn.classList.add('text-slate-300', 'hover:bg-slate-800', 'hover:text-white'); 
    });
    
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`); 
    if (activeBtn) { 
        activeBtn.classList.remove('text-slate-300', 'hover:bg-slate-800', 'hover:text-white'); 
        activeBtn.classList.add('bg-blue-600', 'text-white'); 
    }
    
    if (window.innerWidth < 768) { 
        const sidebar = document.getElementById('sidebar'); 
        if (sidebar) sidebar.classList.add('-translate-x-full'); 
        const overlay = document.getElementById('sidebar-overlay'); 
        if (overlay) overlay.classList.add('hidden'); 
    }
    
    if (viewId === 'financeiro') {
        renderFinAbas('pagar');
        if (typeof atualizarCardsFluxoDeCaixa === 'function') atualizarCardsFluxoDeCaixa();
    }
    if (viewId === 'relatorios' && typeof renderDashboard === 'function') renderDashboard();
    if (viewId === 'compras' && typeof renderComprasHist === 'function') renderComprasHist();
    if (viewId === 'vendas' && typeof renderVendas === 'function') renderVendas();
}

function refreshCurrentView() {
    const urlParams = new URLSearchParams(window.location.search);
    let view = urlParams.get('view'); if (!view) view = 'financeiro';
    mudarVisaoLocal(view);
}

function mudarVisualizacaoFin(tipo) {
    const listBtn = document.getElementById('fin-view-lista');
    const calBtn = document.getElementById('fin-view-calendario');
    const calArea = document.getElementById('fin-area-calendario');
    const abasCont = document.getElementById('fin-abas-container');
    
    if (tipo === 'lista') {
        if (listBtn) listBtn.className = 'px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-all whitespace-nowrap';
        if (calBtn) calBtn.className = 'px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap';
        if (calArea) calArea.classList.add('hidden');
        if (abasCont) abasCont.classList.remove('hidden');
        renderFinAbas('pagar'); 
    } else if (tipo === 'calendario') {
        if (calBtn) calBtn.className = 'px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-all whitespace-nowrap';
        if (listBtn) listBtn.className = 'px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap';
        document.querySelectorAll('.fin-area').forEach(el => el.classList.add('hidden'));
        if (calArea) calArea.classList.remove('hidden');
        if (typeof renderCalendarFin === 'function') renderCalendarFin();
    }
}

function abrirModalRenegociacao(id) {
    const f = (db.financeiro || []).find(x => String(x.id) === String(id));
    if (!f) return;
    const idEl = document.getElementById('reneg-id');
    const valEl = document.getElementById('reneg-valor');
    const dataEl = document.getElementById('reneg-data');
    const modalEl = document.getElementById('modal-renegociacao');
    
    if (idEl) idEl.value = f.id;
    if (valEl) valEl.innerText = formatMoney(f.valor || 0);
    const hoje = new Date(); hoje.setDate(hoje.getDate() + 30);
    if (dataEl) dataEl.value = hoje.toISOString().split('T')[0];
    if (modalEl) modalEl.classList.remove('hidden');
}

function fecharModalRenegociacao() {
    const modalEl = document.getElementById('modal-renegociacao');
    if (modalEl) modalEl.classList.add('hidden');
}

async function confirmarRenegociacao() {
    const idEl = document.getElementById('reneg-id');
    if (!idEl) return;
    const id = idEl.value;
    const fOriginal = (db.financeiro || []).find(x => String(x.id) === String(id));
    if (!fOriginal) return showToast('Título original não encontrado.', 'error');

    const qtdEl = document.getElementById('reneg-qtd');
    const dataEl = document.getElementById('reneg-data');
    const qtdParcelas = parseInt(qtdEl ? qtdEl.value : '2');
    const dataInicialStr = dataEl ? dataEl.value : '';
    
    if (!dataInicialStr || isNaN(qtdParcelas) || qtdParcelas <= 1) {
        return showToast('Preencha as informações da renegociação.', 'error');
    }

    const valorTotal = fOriginal.valor || 0;
    const valorPorParcela = parseFloat((valorTotal / qtdParcelas).toFixed(2));
    const dataInicial = new Date(dataInicialStr + 'T12:00:00');

    const batch = firestore.batch();
    const finRef = firestore.collection('financeiro').doc(String(id));
    batch.update(finRef, {
        status: 'RENEGOCIADO',
        observacao: (fOriginal.observacao || '') + `\n[Renegociado em ${qtdParcelas}x em ${new Date().toLocaleDateString('pt-BR')}]`,
        ultimaAlteracao: Date.now()
    });

    for (let i = 0; i < qtdParcelas; i++) {
        let novaData = new Date(dataInicial);
        novaData.setMonth(novaData.getMonth() + i);
        const refNova = firestore.collection('financeiro').doc();
        batch.set(refNova, {
            tipo: fOriginal.tipo || 'DESPESA',
            pessoa: fOriginal.pessoa || 'Sem Favorecido',
            ref: `${fOriginal.ref || 'Título'} (Reneg. ${i+1}/${qtdParcelas})`,
            categoria: fOriginal.categoria || 'Geral',
            centroCusto: fOriginal.centroCusto || 'Operacional',
            contaBancaria: fOriginal.contaBancaria || 'Caixa Físico',
            data: novaData.toISOString(),
            valor: valorPorParcela,
            status: 'PENDENTE',
            origemRenegociacaoId: String(id),
            ultimaAlteracao: Date.now()
        });
    }

    try {
        await batch.commit();
        fecharModalRenegociacao();
        showToast(`Título renegociado em ${qtdParcelas} parcelas com sucesso!`, 'success');
        renderFinAbas(fOriginal.tipo === 'RECEITA' ? 'receber' : 'pagar');
    } catch (err) {
        console.error('Erro ao renegociar:', err);
        showToast('Erro ao renegociar título.', 'error');
    }
}

window.abrirModalNegociacao = function(id) {
    abrirModalRenegociacao(id);
};

// ==========================================
// MIGRAÇÃO AUTOMÁTICA DO BANCO ANTIGO
// ==========================================
async function migrarDadosSeNecessario() {
    try {
        // Verifica se já existem dados nas coleções novas
        const comprasSnap = await firestore.collection('compras').limit(1).get();
        const finSnap = await firestore.collection('financeiro').limit(1).get();
        
        // Se já há dados em compras OU financeiro, não precisa migrar
        if (!comprasSnap.empty || !finSnap.empty) return;

        // Coleções novas estão vazias — tenta ler do banco antigo
        const bancoPrincipalSnap = await firestore.collection('fc_moveis').doc('banco_principal').get();
        if (!bancoPrincipalSnap.exists) return;

        const dados = bancoPrincipalSnap.data();
        if (!dados) return;

        // Checa se há algum dado útil no banco antigo
        const temDados = (dados.compras && dados.compras.length > 0) || (dados.financeiro && dados.financeiro.length > 0);
        if (!temDados) return;

        showToast('Importando dados do sistema anterior... Aguarde!', 'info');

        const promessas = [];
        const colecoes = ['produtos', 'clientes', 'fornecedores', 'vendas', 'movimentacoes', 'financeiro', 'compras'];

        for (let col of colecoes) {
            if (dados[col] && Array.isArray(dados[col])) {
                for (let item of dados[col]) {
                    const id = item.id ? String(item.id) : firestore.collection(col).doc().id;
                    promessas.push(firestore.collection(col).doc(id).set(item, { merge: true }));
                }
            }
        }

        if (dados.caixa) promessas.push(firestore.collection('fc_moveis').doc('caixa').set(dados.caixa, { merge: true }));
        if (dados.config) promessas.push(firestore.collection('fc_moveis').doc('config').set(dados.config, { merge: true }));

        await Promise.all(promessas);
        // Marca como migrado
        try { await firestore.collection('fc_moveis').doc('banco_principal').update({ migrado: true }); } catch(e2){}

        showToast('Dados importados com sucesso! Recarregando...', 'success');
        setTimeout(() => window.location.reload(), 2000);

    } catch (e) {
        console.error('Erro na migração:', e);
        showToast('Aviso: Erro ao importar dados anteriores.', 'error');
    }
}

function inicializarGestao() {
    // Primeiro tenta migrar dados do banco antigo se necessário
    migrarDadosSeNecessario();

    // Controla quantas coleções já carregaram o primeiro snapshot
    let colecoesProntas = 0;
    const totalColecoes = 6;
    function tentarRefresh() {
        colecoesProntas++;
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    }

    firestore.collection('vendas').onSnapshot(snap => {
        db.vendas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCaixaDiario();
        tentarRefresh();
    });
    firestore.collection('financeiro').onSnapshot(snap => {
        db.financeiro = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    firestore.collection('compras').onSnapshot(snap => {
        db.compras = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    firestore.collection('produtos').onSnapshot(snap => {
        db.produtos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    firestore.collection('clientes').onSnapshot(snap => {
        db.clientes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    firestore.collection('fc_moveis').doc('caixa').onSnapshot(doc => {
        if(doc.exists) db.caixa = doc.data();
        else db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
        renderCaixaDiario();
        tentarRefresh();
    });
}


window.onload = () => { initGlobalData(inicializarGestao); };

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
    
    const printContent = element.innerHTML; 
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
        el.classList.remove('bg-blue-600', 'text-white', 'shadow-md', 'hover:bg-blue-700');
        el.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-white', 'dark:hover:bg-slate-800', 'hover:text-slate-900', 'dark:hover:text-white');
    });
    const targetArea = document.getElementById(`fin-area-${aba}`);
    if (targetArea) targetArea.classList.remove('hidden');
    const tabBtn = document.getElementById(`fin-tab-${aba}`);
    if (tabBtn) {
        tabBtn.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-white', 'dark:hover:bg-slate-800', 'hover:text-slate-900', 'dark:hover:text-white');
        tabBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md', 'hover:bg-blue-700');
    }
    if(aba === 'caixa') renderCaixaDiario();
    if(aba === 'receber') renderTitulos('RECEITA');
    if(aba === 'pagar') renderTitulos('DESPESA');
    if(aba === 'conciliacao' && typeof renderConciliacaoOFX === 'function') renderConciliacaoOFX();
    if(aba === 'transferencias' && typeof renderTransferenciasFin === 'function') renderTransferenciasFin();
    if (typeof atualizarCardsFluxoDeCaixa === 'function') atualizarCardsFluxoDeCaixa();
}

function renderCaixaDiario() {
    const saldoEl = document.getElementById('caixa-saldo-display');
    if (!saldoEl) return;
    if (db && db.caixa) {
        saldoEl.innerText = formatMoney(db.caixa.saldo || 0);
        const b = document.getElementById('caixa-status-badge');
        if (b) {
            if (db.caixa.status === 'ABERTO') {
                b.innerText = 'ABERTO';
                b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-emerald-100 text-emerald-700 border border-emerald-300';
            } else {
                b.innerText = 'FECHADO';
                b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-red-100 text-red-700 border border-red-300';
            }
        }
    }
    
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
    const op = document.getElementById('caixa-operacao-tipo').value;
    const val = parseFloat(document.getElementById('caixa-op-valor').value) || 0;
    const desc = document.getElementById('caixa-op-desc').value || op;
    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
    let novoStatus = cxAtual.status;
    let novoSaldo = cxAtual.saldo || 0;
    const dataIso = new Date().toISOString();
    const operadorNome = window.currentUserInfo?.nome || 'Operador Caixa';

    if (op === 'ABRIR') {
        novoStatus = 'ABERTO';
        novoSaldo = val;
        cxHistoricoNovo.unshift({
            data: dataIso,
            tipo: 'ABERTURA',
            desc: `Abertura de Caixa (Troco Inicial: ${formatMoney(val)}) - Op: ${operadorNome}`,
            valor: val,
            operador: operadorNome,
            saldoApos: novoSaldo
        });
    } else if (op === 'SANGRIA') {
        if (val > novoSaldo) return showToast('Saldo em dinheiro insuficiente para sangria!', 'error');
        novoSaldo -= val;
        cxHistoricoNovo.unshift({
            data: dataIso,
            tipo: 'SAIDA',
            desc: `SANGRIA: ${desc} - Op: ${operadorNome}`,
            valor: val,
            operador: operadorNome,
            saldoApos: novoSaldo
        });
    } else if (op === 'SUPRIMENTO') {
        novoSaldo += val;
        cxHistoricoNovo.unshift({
            data: dataIso,
            tipo: 'ENTRADA',
            desc: `SUPRIMENTO: ${desc} - Op: ${operadorNome}`,
            valor: val,
            operador: operadorNome,
            saldoApos: novoSaldo
        });
    }
    
    try {
        await firestore.collection('fc_moveis').doc('caixa').set({
            ...cxAtual,
            status: novoStatus,
            saldo: novoSaldo,
            historico: cxHistoricoNovo,
            ultimaAbertura: op === 'ABRIR' ? dataIso : (cxAtual.ultimaAbertura || dataIso),
            operadorAtual: op === 'ABRIR' ? operadorNome : (cxAtual.operadorAtual || operadorNome)
        }, { merge: true });

        fecharModalCaixa();
        renderCaixaDiario();
        showToast(`Operação de ${op} realizada com sucesso!`, 'success');
    } catch(err) {
        console.error(err);
        showToast('Erro ao registrar operação no caixa.', 'error');
    }
}

// ==========================================
// FECHAMENTO CEGO E MAPA DE CAIXA
// ==========================================
function abrirModalFechamentoCego() {
    if (!db.caixa || db.caixa.status !== 'ABERTO') {
        return showToast('O caixa já está FECHADO!', 'warning');
    }
    document.getElementById('fc-dinheiro').value = '';
    document.getElementById('fc-debito').value = '';
    document.getElementById('fc-credito').value = '';
    document.getElementById('fc-pix').value = '';
    document.getElementById('fc-outros').value = '';
    document.getElementById('fc-obs').value = '';
    document.getElementById('fc-total-declarado-display').innerText = 'R$ 0,00';
    document.getElementById('modal-fechamento-cego').classList.remove('hidden');
}

function fecharModalFechamentoCego() {
    document.getElementById('modal-fechamento-cego').classList.add('hidden');
}

function recalcularTotalDeclarado() {
    const d = parseFloat(document.getElementById('fc-dinheiro').value) || 0;
    const deb = parseFloat(document.getElementById('fc-debito').value) || 0;
    const cred = parseFloat(document.getElementById('fc-credito').value) || 0;
    const pix = parseFloat(document.getElementById('fc-pix').value) || 0;
    const outros = parseFloat(document.getElementById('fc-outros').value) || 0;
    const tot = d + deb + cred + pix + outros;
    document.getElementById('fc-total-declarado-display').innerText = formatMoney(tot);
    return tot;
}

async function confirmarFechamentoCego() {
    const decDinheiro = parseFloat(document.getElementById('fc-dinheiro').value) || 0;
    const decDebito = parseFloat(document.getElementById('fc-debito').value) || 0;
    const decCredito = parseFloat(document.getElementById('fc-credito').value) || 0;
    const decPix = parseFloat(document.getElementById('fc-pix').value) || 0;
    const decOutros = parseFloat(document.getElementById('fc-outros').value) || 0;
    const decTotal = decDinheiro + decDebito + decCredito + decPix + decOutros;
    const obs = document.getElementById('fc-obs').value.trim();

    let cxAtual = db.caixa || { status: 'ABERTO', saldo: 0, historico: [] };
    const dataAbertura = cxAtual.ultimaAbertura || (new Date(Date.now() - 86400000).toISOString());
    const dataFechamento = new Date().toISOString();
    const operador = cxAtual.operadorAtual || window.currentUserInfo?.nome || 'Operador Caixa';

    // 1. Apura dados de vendas do sistema desde a abertura do turno
    const vendasTurno = (db.vendas || []).filter(v => {
        if (v.tipo === 'ORÇAMENTO') return false;
        const dt = new Date(v.data || 0).getTime();
        return dt >= new Date(dataAbertura).getTime();
    });

    let sysDinheiro = 0;
    let sysDebito = 0;
    let sysCredito = 0;
    let sysPix = 0;
    let sysBoleto = 0;
    let sysFiado = 0;

    vendasTurno.forEach(v => {
        const pag = String(v.pag || '');
        const tot = Number(v.tot || 0);
        if (pag.includes('Dinheiro')) sysDinheiro += tot;
        else if (pag.includes('Débito') || pag.includes('Debito')) sysDebito += tot;
        else if (pag.includes('Crédito') || pag.includes('Credito')) sysCredito += tot;
        else if (pag.includes('PIX') || pag.includes('Pix')) sysPix += tot;
        else if (pag.includes('Boleto')) sysBoleto += tot;
        else if (pag.includes('Fiado')) sysFiado += tot;
    });

    // 2. Apura movimentações físicas de caixa (Abertura, Suprimentos, Sangrias)
    const movsTurno = (cxAtual.historico || []).filter(m => new Date(m.data || 0).getTime() >= new Date(dataAbertura).getTime());
    let sysFundoTroco = 0;
    let sysSuprimentos = 0;
    let sysSangrias = 0;

    movsTurno.forEach(m => {
        if (m.tipo === 'ABERTURA') sysFundoTroco += Number(m.valor || 0);
        else if (m.tipo === 'ENTRADA' && !m.desc.includes('VENDA')) sysSuprimentos += Number(m.valor || 0);
        else if (m.tipo === 'SAIDA') sysSangrias += Number(m.valor || 0);
    });

    // Saldo esperado em dinheiro físico na gaveta:
    const saldoEsperadoGaveta = (cxAtual.saldo || 0);
    const totalApuradoSistema = saldoEsperadoGaveta + sysDebito + sysCredito + sysPix;
    const difDinheiro = decDinheiro - saldoEsperadoGaveta;
    const difGeral = decTotal - totalApuradoSistema;

    const mapaDados = {
        id: 'FECH-' + Date.now(),
        dataAbertura: dataAbertura,
        dataFechamento: dataFechamento,
        operador: operador,
        observacao: obs,
        apuradoSistema: {
            fundoTroco: sysFundoTroco,
            suprimentos: sysSuprimentos,
            sangrias: sysSangrias,
            vendasDinheiro: sysDinheiro,
            vendasDebito: sysDebito,
            vendasCredito: sysCredito,
            vendasPix: sysPix,
            vendasBoleto: sysBoleto,
            vendasFiado: sysFiado,
            saldoEsperadoGaveta: saldoEsperadoGaveta,
            totalGeral: totalApuradoSistema
        },
        declaradoOperador: {
            dinheiro: decDinheiro,
            debito: decDebito,
            credito: decCredito,
            pix: decPix,
            outros: decOutros,
            totalGeral: decTotal
        },
        diferencas: {
            difDinheiro: difDinheiro,
            difGeral: difGeral,
            status: difGeral > 0.05 ? 'SOBRA DE CAIXA' : (difGeral < -0.05 ? 'QUEBRA DE CAIXA' : 'CONCILIADO / EXATO')
        }
    };

    try {
        let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
        cxHistoricoNovo.unshift({
            data: dataFechamento,
            tipo: 'FECHAMENTO',
            desc: `Fechamento de Turno (${mapaDados.diferencas.status}) - Retirado: ${formatMoney(decDinheiro)} - Op: ${operador}`,
            valor: decDinheiro,
            operador: operador,
            saldoApos: 0
        });

        const batch = firestore.batch();
        const caixaRef = firestore.collection('fc_moveis').doc('caixa');
        batch.set(caixaRef, {
            ...cxAtual,
            status: 'FECHADO',
            saldo: 0,
            historico: cxHistoricoNovo,
            ultimoFechamento: mapaDados
        }, { merge: true });

        const fechamentoDocRef = firestore.collection('fechamentos_caixa').doc(mapaDados.id);
        batch.set(fechamentoDocRef, mapaDados);

        await batch.commit();

        fecharModalFechamentoCego();
        renderCaixaDiario();
        exibirModalMapaCaixa(mapaDados);
        showToast('Turno de caixa fechado com sucesso!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Erro ao gravar fechamento de caixa.', 'error');
    }
}

function exibirModalMapaCaixa(mapa) {
    if (!mapa) return showToast('Nenhum dado de fechamento disponível.', 'info');
    const html = renderizarMapaCaixaHTML(mapa);
    document.getElementById('mapa-caixa-conteudo').innerHTML = html;
    document.getElementById('modal-mapa-caixa').classList.remove('hidden');
}

function abrirUltimoMapaCaixa() {
    if (db.caixa && db.caixa.ultimoFechamento) {
        exibirModalMapaCaixa(db.caixa.ultimoFechamento);
    } else {
        showToast('Nenhum histórico de fechamento registrado ainda.', 'info');
    }
}

function renderizarMapaCaixaHTML(m) {
    const emp = db.config?.empresa || { nome: 'FC Móveis & Interiores', cnpj: '00.000.000/0000-00', telefone: '' };
    const corDiferenca = m.diferencas.difGeral >= 0 ? 'text-emerald-600' : 'text-red-600';
    const bgDiferenca = m.diferencas.difGeral >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30';

    return `
    <div class="font-mono text-xs text-slate-800 dark:text-slate-200 p-2 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner">
        <div class="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h2 class="text-base font-black uppercase text-slate-900 dark:text-white">${emp.nome}</h2>
            <p class="text-[10px] text-slate-500">CNPJ: ${emp.cnpj || 'Não informado'} | Tel: ${emp.telefone || ''}</p>
            <p class="text-xs font-bold uppercase mt-1 bg-slate-100 dark:bg-slate-800 py-1 rounded">MAPA DE FECHAMENTO DE CAIXA (REDUÇÃO Z)</p>
            <p class="text-[10px] text-slate-400 mt-1">Ref: #${m.id}</p>
        </div>

        <div class="space-y-1.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3 text-[11px]">
            <div class="flex justify-between"><span>OPERADOR:</span><strong class="uppercase">${m.operador || 'Balcão'}</strong></div>
            <div class="flex justify-between"><span>ABERTURA:</span><strong>${formatData(m.dataAbertura)}</strong></div>
            <div class="flex justify-between"><span>FECHAMENTO:</span><strong>${formatData(m.dataFechamento)}</strong></div>
            ${m.observacao ? `<div class="flex justify-between text-slate-500"><span>OBS:</span><em>${m.observacao}</em></div>` : ''}
        </div>

        <!-- MOVIMENTAÇÃO GAVETA -->
        <div class="border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h4 class="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1.5">1. FLUXO DE GAVETA (DINHEIRO FÍSICO)</h4>
            <div class="flex justify-between text-[11px]"><span>(+) Fundo de Troco Inicial:</span><span>${formatMoney(m.apuradoSistema.fundoTroco)}</span></div>
            <div class="flex justify-between text-[11px]"><span>(+) Suprimentos (Reforços):</span><span>${formatMoney(m.apuradoSistema.suprimentos)}</span></div>
            <div class="flex justify-between text-[11px]"><span>(+) Vendas em Dinheiro:</span><span>${formatMoney(m.apuradoSistema.vendasDinheiro)}</span></div>
            <div class="flex justify-between text-[11px]"><span>(-) Sangrias (Retiradas):</span><span>- ${formatMoney(m.apuradoSistema.sangrias)}</span></div>
            <div class="flex justify-between font-bold text-xs pt-1 border-t border-slate-200 dark:border-slate-800 mt-1">
                <span>(=) Saldo Esperado Gaveta:</span><span class="text-blue-600">${formatMoney(m.apuradoSistema.saldoEsperadoGaveta)}</span>
            </div>
            <div class="flex justify-between font-bold text-xs text-emerald-600">
                <span>(V) Dinheiro Declarado:</span><span>${formatMoney(m.declaradoOperador.dinheiro)}</span>
            </div>
        </div>

        <!-- MÉTODOS ELETRÔNICOS -->
        <div class="border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h4 class="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1.5">2. MÉTODOS ELETRÔNICOS E PARCELADOS</h4>
            <div class="flex justify-between text-[11px]"><span>Cartão Débito (Sistema / Declarado):</span><span>${formatMoney(m.apuradoSistema.vendasDebito)} / <strong>${formatMoney(m.declaradoOperador.debito)}</strong></span></div>
            <div class="flex justify-between text-[11px]"><span>Cartão Crédito (Sistema / Declarado):</span><span>${formatMoney(m.apuradoSistema.vendasCredito)} / <strong>${formatMoney(m.declaradoOperador.credito)}</strong></span></div>
            <div class="flex justify-between text-[11px]"><span>PIX (Sistema / Declarado):</span><span>${formatMoney(m.apuradoSistema.vendasPix)} / <strong>${formatMoney(m.declaradoOperador.pix)}</strong></span></div>
            <div class="flex justify-between text-[11px]"><span>Boletos & Fiados Faturados:</span><span>${formatMoney((m.apuradoSistema.vendasBoleto || 0) + (m.apuradoSistema.vendasFiado || 0))}</span></div>
        </div>

        <!-- RESUMO GERAL E AUDITORIA -->
        <div class="${bgDiferenca} p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
            <div class="flex justify-between text-xs font-bold mb-1">
                <span>TOTAL APURADO NO SISTEMA:</span><span>${formatMoney(m.apuradoSistema.totalGeral)}</span>
            </div>
            <div class="flex justify-between text-xs font-bold mb-1.5">
                <span>TOTAL DECLARADO PELO OPERADOR:</span><span>${formatMoney(m.declaradoOperador.totalGeral)}</span>
            </div>
            <div class="flex justify-between text-sm font-black pt-1.5 border-t border-slate-300 dark:border-slate-700 ${corDiferenca}">
                <span>DIVERGÊNCIA (${m.diferencas.status}):</span>
                <span>${m.diferencas.difGeral >= 0 ? '+' : ''}${formatMoney(m.diferencas.difGeral)}</span>
            </div>
        </div>

        <div class="pt-6 border-t border-dashed border-slate-300 dark:border-slate-700 grid grid-cols-2 gap-6 text-center text-[10px]">
            <div>
                <div class="border-b border-slate-400 dark:border-slate-600 mb-1"></div>
                <p>Assinatura do Operador</p>
            </div>
            <div>
                <div class="border-b border-slate-400 dark:border-slate-600 mb-1"></div>
                <p>Assinatura da Gerência / Auditoria</p>
            </div>
        </div>
    </div>`;
}

// ==========================================
// TRANSFERÊNCIAS ENTRE CONTAS
// ==========================================
function abrirModalTransferenciaCaixa() {
    if (!db.caixa || (db.caixa.saldo || 0) <= 0) {
        return showToast('O caixa físico está sem saldo para transferir.', 'warning');
    }
    document.getElementById('transf-valor').value = db.caixa.saldo || '';
    document.getElementById('transf-obs').value = '';
    document.getElementById('modal-transferencia-caixa').classList.remove('hidden');
}

function fecharModalTransferenciaCaixa() {
    document.getElementById('modal-transferencia-caixa').classList.add('hidden');
}

async function confirmarTransferenciaCaixa() {
    const valor = parseFloat(document.getElementById('transf-valor').value) || 0;
    const destino = document.getElementById('transf-conta-destino').value;
    const obs = document.getElementById('transf-obs').value.trim() || `Transferência Gaveta -> ${destino}`;

    if (valor <= 0) return showToast('Informe um valor válido maior que zero.', 'error');
    if (valor > (db.caixa.saldo || 0)) return showToast('Saldo insuficiente no Caixa Físico!', 'error');

    let cxAtual = db.caixa || { status: 'ABERTO', saldo: 0, historico: [] };
    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
    let novoSaldo = (cxAtual.saldo || 0) - valor;
    const dataIso = new Date().toISOString();
    const operador = window.currentUserInfo?.nome || 'Operador Caixa';

    cxHistoricoNovo.unshift({
        data: dataIso,
        tipo: 'SAIDA',
        desc: `TRANSFERÊNCIA p/ ${destino}: ${obs} - Op: ${operador}`,
        valor: valor,
        operador: operador,
        saldoApos: novoSaldo
    });

    const batch = firestore.batch();
    const caixaRef = firestore.collection('fc_moveis').doc('caixa');
    batch.set(caixaRef, { ...cxAtual, saldo: novoSaldo, historico: cxHistoricoNovo }, { merge: true });

    // Registra entrada na conta destino no financeiro
    const finRef = firestore.collection('financeiro').doc();
    batch.set(finRef, {
        ref: `TRANSF. ENTRADA (${destino})`,
        data: dataIso,
        pessoa: 'Transferência Interna',
        valor: valor,
        status: 'PAGO',
        tipo: 'RECEITA',
        categoria: 'Transferências Internas',
        contaBancaria: destino,
        dataPagamento: dataIso,
        observacao: `Origem: Caixa Físico (Gaveta). ${obs}`
    });

    try {
        await batch.commit();
        fecharModalTransferenciaCaixa();
        renderCaixaDiario();
        showToast(`Transferência de ${formatMoney(valor)} para ${destino} concluída!`, 'success');
    } catch (e) {
        console.error(e);
        showToast('Erro ao realizar transferência.', 'error');
    }
}

function imprimirArea(areaId) {
    let empNome = "Relatório Oficial do Sistema";
    if (db && db.config && db.config.empresa && db.config.empresa.nome) empNome = db.config.empresa.nome;
    let logoHtml = "";
    if (db && db.config && db.config.empresa && db.config.empresa.logo) logoHtml = `<img src="${db.config.empresa.logo}" style="max-height: 60px; margin-bottom: 10px; border-radius: 8px;">`;
    
    const element = document.getElementById(areaId);
    if(!element) return showToast("Área de impressão não encontrada.", "error");
    
    const printContent = element.innerHTML; 
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

// 4. CONTAS A PAGAR E RECEBER
// ==========================================
function normalizarTexto(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function atualizarFiltrosPessoaFin(prefix) {
    const isReceber = prefix === 'receber';
    const datalist = document.getElementById(`lista-${isReceber ? 'clientes' : 'fornecedores'}-fin-${prefix}`);
    const select = document.getElementById(`filtro-${prefix}-${isReceber ? 'cliente' : 'fornecedor'}`) || document.getElementById(`filtro-${prefix}-pessoa`);
    
    const pessoas = isReceber
        ? (db.clientes || []).map(c => ({ nome: c.nome || c.razaoSocial || '', doc: c.doc || c.cpfCnpj || '' }))
        : [
            ...(db.fornecedores || []).map(f => ({ nome: f.nome || f.razaoSocial || '', doc: f.doc || f.cnpj || '' })),
            ...(db.funcionarios || []).map(func => ({ nome: func.nome || '', doc: func.doc || '' }))
        ];

    const uniquePessoas = [];
    const nomesJaVistos = new Set();
    pessoas.forEach(p => {
        const nomeTrim = (p.nome || '').trim();
        if (nomeTrim && !nomesJaVistos.has(nomeTrim.toLowerCase())) {
            nomesJaVistos.add(nomeTrim.toLowerCase());
            uniquePessoas.push({ nome: nomeTrim, doc: p.doc ? String(p.doc).trim() : '' });
        }
    });
    uniquePessoas.sort((a, b) => a.nome.localeCompare(b.nome));

    const totalKey = uniquePessoas.length + '_' + (uniquePessoas[0]?.nome || '');

    if (datalist && datalist.dataset.loadedKey !== totalKey) {
        datalist.innerHTML = uniquePessoas.map(p => `<option value="${p.nome}">${p.doc ? 'CPF/CNPJ: ' + p.doc : ''}</option>`).join('');
        datalist.dataset.loadedKey = totalKey;
    }

    if (select && select.dataset.loadedKey !== totalKey) {
        const valAtual = select.value;
        select.innerHTML = `<option value="">${isReceber ? 'Todos os Clientes' : 'Todos os Fornecedores'}</option>` +
            uniquePessoas.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
        select.value = valAtual;
        select.dataset.loadedKey = totalKey;
    }
}

function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar';
    if (!document.getElementById('tabela-fin-' + prefix)) return;
    if (!db.financeiro) return;
    
    atualizarFiltrosPessoaFin(prefix);

    const statusFilterEl = document.getElementById('filtro-' + prefix + '-status');
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'TODOS';
    
    const periodoFilterEl = document.getElementById('filtro-' + prefix + '-periodo');
    const periodoFilter = periodoFilterEl ? periodoFilterEl.value : 'MES';
    
    const buscaEl = document.getElementById('busca-fin-' + prefix);
    const termoBusca = buscaEl ? buscaEl.value : '';
    const termoNorm = normalizarTexto(termoBusca);
    const termoDigitos = termoBusca.replace(/\D/g, '');

    const pessoaFiltroEl = document.getElementById('filtro-' + prefix + '-cliente') || 
                           document.getElementById('filtro-' + prefix + '-fornecedor') || 
                           document.getElementById('filtro-' + prefix + '-pessoa');
    const pessoaFiltroVal = pessoaFiltroEl ? normalizarTexto(pessoaFiltroEl.value) : '';
    
    const dataIniEl = document.getElementById('filtro-' + prefix + '-ini');
    const dataIni = dataIniEl ? dataIniEl.value : '';
    
    const dataFimEl = document.getElementById('filtro-' + prefix + '-fim');
    const dataFim = dataFimEl ? dataFimEl.value : '';
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    // 1. FILTRAGEM POR PESSOA (SELECT DROPDOWN)
    if (pessoaFiltroVal) {
        lista = lista.filter(f => {
            const pessoaNorm = normalizarTexto(f.pessoa || f.clienteNome || f.cliente || f.favorecido || f.sacado || '');
            return pessoaNorm === pessoaFiltroVal || pessoaNorm.includes(pessoaFiltroVal);
        });
    }

    // 2. BUSCA TEXTUAL ABRANGENTE E INSENSÍVEL A ACENTOS / CAIXA
    if (termoNorm) { 
        lista = lista.filter(f => {
            let cliVinculado = null;
            if (db.clientes && db.clientes.length > 0) {
                if (f.clienteId) {
                    cliVinculado = db.clientes.find(c => String(c.id) === String(f.clienteId));
                }
                if (!cliVinculado && f.pessoa) {
                    const fPessoaNorm = normalizarTexto(f.pessoa);
                    cliVinculado = db.clientes.find(c => normalizarTexto(c.nome) === fPessoaNorm || normalizarTexto(c.razaoSocial) === fPessoaNorm);
                }
            }

            let fornVinculado = null;
            if (db.fornecedores && db.fornecedores.length > 0) {
                if (f.fornecedorId) {
                    fornVinculado = db.fornecedores.find(forn => String(forn.id) === String(f.fornecedorId));
                }
                if (!fornVinculado && f.pessoa) {
                    const fPessoaNorm = normalizarTexto(f.pessoa);
                    fornVinculado = db.fornecedores.find(forn => normalizarTexto(forn.nome) === fPessoaNorm || normalizarTexto(forn.razaoSocial) === fPessoaNorm);
                }
            }

            let vendaVinculada = null;
            if (f.origemVendaId && db.vendas && db.vendas.length > 0) {
                vendaVinculada = db.vendas.find(v => String(v.id) === String(f.origemVendaId));
            }

            const camposTexto = [
                f.pessoa,
                f.clienteNome,
                f.cliente,
                f.favorecido,
                f.sacado,
                f.cpfCnpj,
                f.clienteDoc,
                f.doc,
                f.telefone,
                f.wpp,
                f.tel,
                f.celular,
                f.ref,
                f.origemVendaId,
                f.numeroPedido,
                f.categoria,
                f.numNF,
                f.numBoleto,
                f.observacao,
                f.obs,
                f.centroCusto,
                f.contaBancaria,
                f.cartorioNome,
                f.metodoPagamento,
                cliVinculado?.nome,
                cliVinculado?.razaoSocial,
                cliVinculado?.doc,
                cliVinculado?.cpfCnpj,
                cliVinculado?.telefone,
                cliVinculado?.wpp,
                cliVinculado?.email,
                fornVinculado?.nome,
                fornVinculado?.razaoSocial,
                fornVinculado?.doc,
                fornVinculado?.cnpj,
                fornVinculado?.telefone,
                vendaVinculada?.numeroPedido ? `#${String(vendaVinculada.numeroPedido).padStart(4, '0')}` : '',
                vendaVinculada?.numeroPedido ? String(vendaVinculada.numeroPedido) : '',
                vendaVinculada?.clienteNome,
                vendaVinculada?.clienteDoc,
                vendaVinculada?.vendedor
            ];

            const textoGeralNorm = normalizarTexto(camposTexto.filter(Boolean).join(' '));

            if (textoGeralNorm.includes(termoNorm)) return true;

            if (termoDigitos && termoDigitos.length >= 2) {
                const camposDigitos = [
                    f.cpfCnpj,
                    f.clienteDoc,
                    f.doc,
                    f.telefone,
                    f.wpp,
                    f.tel,
                    f.numNF,
                    f.numBoleto,
                    f.numeroPedido,
                    f.origemVendaId,
                    cliVinculado?.doc,
                    cliVinculado?.cpfCnpj,
                    cliVinculado?.telefone,
                    cliVinculado?.wpp,
                    fornVinculado?.doc,
                    fornVinculado?.cnpj,
                    vendaVinculada?.numeroPedido
                ];
                const digitosGeral = camposDigitos.filter(Boolean).map(x => String(x).replace(/\D/g, '')).join(' ');
                if (digitosGeral.includes(termoDigitos)) return true;
            }

            if (f.data) {
                const dataFormatada = formatData(f.data).toLowerCase();
                const dataIso = f.data.split('T')[0];
                if (dataFormatada.includes(termoNorm) || dataIso.includes(termoNorm)) return true;
            }

            return false;
        }); 
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

    // 4. FILTRO DE DATAS ESPECÍFICAS (SEMPRE RESPEITADO)
    if (dataIni) {
        lista = lista.filter(f => f.data && f.data.split('T')[0] >= dataIni);
    }
    if (dataFim) {
        lista = lista.filter(f => f.data && f.data.split('T')[0] <= dataFim);
    }

    // 5. FILTRO DE PERÍODO RELATIVO (MÊS, 7 DIAS, ETC.)
    const temBuscaAtiva = !!(termoNorm || pessoaFiltroVal);
    if (!temBuscaAtiva && !dataIni && !dataFim && periodoFilter !== 'TUDO') {
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth();
        if (periodoFilter === 'MES' || periodoFilter === 'MES_ATUAL') {
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
    
    lista.sort((a, b) => new Date(a.data) - new Date(b.data));
    
    document.getElementById(`tabela-fin-${prefix}`).innerHTML = lista.map(f => {
        const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime(); 
        let corStatus = 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
        let badgeStatus = 'PENDENTE';
        
        if (f.status === 'PAGO') { corStatus = 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'; badgeStatus = 'PAGO'; }
        else if (f.status === 'CANCELADO') { corStatus = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700'; badgeStatus = 'CANCELADO'; }
        else if (f.status === 'RENEGOCIADO') { corStatus = 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'; badgeStatus = 'RENEGOCIADO'; }
        else if (isAtrasado) { corStatus = 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'; badgeStatus = 'ATRASADO'; }
        
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
                <button onclick="abrirModalBaixa('${f.id}')" class="text-blue-600 bg-blue-50 dark:bg-blue-950/70 dark:text-blue-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900 ml-1">Baixar</button>
                <button onclick="abrirModalRenegociacao('${f.id}')" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 p-1.5 ml-1 print:hidden" title="Renegociar / Parcelar"><i class="fa-solid fa-handshake"></i></button>
            `;
        } else if (f.status === 'PAGO') {
            acoesExtras = `<button onclick="estornarTitulo('${f.id}')" class="text-amber-500 hover:text-amber-700 dark:text-amber-400 p-1.5 ml-1 print:hidden" title="Estornar Pagamento"><i class="fa-solid fa-rotate-left"></i></button>`;
        }

        return `
        <tr class="hover:bg-slate-100/60 dark:hover:bg-slate-700/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60 transition-colors text-slate-800 dark:text-slate-200">
            <td class="p-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                  ${formatData(f.data).split(' ')[0]}
                  ${f.dataCartorio ? `<br><span class="text-[9.5px] font-bold text-rose-600 dark:text-rose-400 mt-1 inline-block" title="Ir para Cartório"><i class="fa-solid fa-gavel"></i> ${formatData(f.dataCartorio + "T12:00:00").split(" ")[0]}</span>` : ""}
              </td>
            <td class="p-3 font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">${f.pessoa}</td>
            <td class="p-3 text-slate-600 dark:text-slate-300 text-[11px]">${f.categoria || '-'} <br><span class="font-bold">${f.ref}</span></td>
            <td class="p-3 text-right ${tipo === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                  ${(() => {
                      const c = calcularJurosMulta(f);
                      if(c.diasAtraso > 0 && (c.multa > 0 || c.juros > 0)) {
                          return `<div class="flex flex-col items-end"><span class="line-through text-slate-400 text-[10px]">${formatMoney(f.valor)}</span><span class="font-black text-rose-600 dark:text-rose-400" title="Multa: ${formatMoney(c.multa)} | Juros: ${formatMoney(c.juros)}">${formatMoney(c.valorAtualizado)}</span></div>`;
                      }
                      return `<span class="font-black">${formatMoney(f.valor)}</span>`;
                  })()}
              </td>
            <td class="p-3 text-center"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${corStatus}">${badgeStatus}</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-1 print:hidden">
                <button onclick="verDetalhesTitulo('${f.id}')" class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1.5" title="Detalhes do Título"><i class="fa-solid fa-eye"></i></button>
                <button onclick="abrirModalContaEdicao('${f.id}')" class="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 p-1.5" title="Editar Lançamento"><i class="fa-solid fa-pen"></i></button>
                ${btnWhats}
                ${acoesExtras}
                <button onclick="excluirTitulo('${f.id}')" class="text-slate-400 hover:text-rose-500 p-1.5 ml-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum título encontrado.</td></tr>`;
}

// ==========================================
// 5. MODAL DE CADASTRO/EDIÇÃO DE CONTA (COM RECORRÊNCIA)
// ==========================================

// ===== HELPER: PESSOA SELECT DROPDOWN =====
function preencherContaPessoaSelect(tipo) {
    const sel = document.getElementById('conta-pessoa-select');
    if (!sel) return;
    const lista = tipo === 'RECEBER'
        ? (db.clientes || []).map(c => c.nome || c.razaoSocial || '')
        : (db.fornecedores || []).map(f => f.nome || f.razaoSocial || '');
    const unique = [...new Set(lista.filter(n => n.trim()))].sort();
    sel.innerHTML = '<option value="">-- Selecione um cadastrado --</option>'
        + unique.map(n => `<option value="${n}">${n}</option>`).join('')
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

function decodificarLinhaDigitavelBoleto() {
    const input = document.getElementById('conta-linha-digitavel')?.value || '';
    const digits = input.replace(/\D/g, '');
    if (!digits || (digits.length !== 47 && digits.length !== 48)) {
        return showToast('Linha digitável deve conter 47 ou 48 dígitos numéricos.', 'warning');
    }

    try {
        let valor = 0;
        let dataVencIso = '';

        if (digits.length === 47) {
            const fatorStr = digits.substring(33, 37);
            const fator = parseInt(fatorStr, 10);
            
            if (fator >= 1000) {
                const dataBase = new Date(1997, 9, 7);
                dataBase.setDate(dataBase.getDate() + fator);
                dataVencIso = dataBase.toISOString().split('T')[0];
            }

            const valorStr = digits.substring(37, 47);
            valor = parseInt(valorStr, 10) / 100;
        } else if (digits.length === 48) {
            const valorStr = digits.substring(4, 15);
            valor = parseInt(valorStr, 10) / 100;
        }

        if (valor > 0) {
            const elVal = document.getElementById('conta-valor');
            if (elVal) {
                elVal.value = valor.toFixed(2);
                if (typeof calcularValorFinalFormulario === 'function') calcularValorFinalFormulario();
            }
        }

        if (dataVencIso) {
            const elVenc = document.getElementById('conta-vencimento');
            if (elVenc) elVenc.value = dataVencIso;
        }

        const elRef = document.getElementById('conta-ref');
        if (elRef && !elRef.value) {
            elRef.value = 'Boleto ' + digits.substring(0, 15) + '...';
        }

        const elNumBoleto = document.getElementById('conta-num-boleto');
        if (elNumBoleto && !elNumBoleto.value) {
            elNumBoleto.value = digits;
        }

        showToast('Linha digitável decodificada com sucesso!', 'success');
    } catch (e) {
        console.error('Erro ao decodificar boleto:', e);
        showToast('Erro ao processar linha digitável.', 'error');
    }
}

function imprimirExtratoFuncionario() {
    window.print();
}

window.decodificarLinhaDigitavelBoleto = decodificarLinhaDigitavelBoleto;
window.imprimirExtratoFuncionario = imprimirExtratoFuncionario;
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
    
    const _selEl = document.getElementById('conta-pessoa-select'); if(_selEl) _selEl.value = '';
    const _wrapEl = document.getElementById('conta-pessoa-novo-wrap'); if(_wrapEl) _wrapEl.classList.add('hidden');
    const _pessoaEl = document.getElementById('conta-pessoa'); if(_pessoaEl) _pessoaEl.value = '';
    preencherContaPessoaSelect(tipo);
    
    document.getElementById('modal-conta-header').className = `p-4 md:p-5 text-white flex justify-between items-center shrink-0 ${tipo === 'RECEBER' ? 'bg-emerald-500' : 'bg-red-500'}`; 
    document.getElementById('modal-conta-title').innerText = tipo === 'RECEBER' ? 'Nova Conta a Receber' : 'Nova Conta a Pagar';
    
    ['pessoa','ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','multa','juros','data-pgto','obs','anexo-base64','cartorio','data-protesto'].forEach(id => {
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
    const f = db.financeiro.find(x => x.id === id);
    if (!f) return;
    
    const tipo = f.tipo === 'RECEITA' ? 'RECEBER' : 'PAGAR';
    
    document.getElementById('conta-id').value = f.id; 
    document.getElementById('conta-tipo').value = f.tipo; 
    document.getElementById('lbl-conta-pessoa').innerText = tipo === 'RECEBER' ? 'Cliente / Pagador *' : 'Fornecedor / Favorecido *';
    
    document.getElementById('conta-categoria').innerHTML = (tipo === 'RECEBER' ? categoriasReceber : categoriasPagar).map(c => `<option value="${c}">${c}</option>`).join('');
    
    preencherContaPessoaSelect(tipo);
    const pessoaSelEl = document.getElementById('conta-pessoa-select');
    const pessoaWrapEl = document.getElementById('conta-pessoa-novo-wrap');
    const pessoaInputEl = document.getElementById('conta-pessoa');
    if (pessoaSelEl) {
        let isKnown = false;
        Array.from(pessoaSelEl.options).forEach(opt => {
            if (opt.value === f.pessoa) isKnown = true;
        });
        if (isKnown) {
            pessoaSelEl.value = f.pessoa;
            if (pessoaWrapEl) pessoaWrapEl.classList.add('hidden');
            if (pessoaInputEl) pessoaInputEl.value = '';
        } else {
            pessoaSelEl.value = '__avulso__';
            if (pessoaWrapEl) pessoaWrapEl.classList.remove('hidden');
            if (pessoaInputEl) pessoaInputEl.value = f.pessoa || '';
        }
    } else {
        if (pessoaInputEl) pessoaInputEl.value = f.pessoa || '';
    }
    
    document.getElementById('modal-conta-header').className = `p-4 md:p-5 text-white flex justify-between items-center shrink-0 bg-indigo-600`; 
    document.getElementById('modal-conta-title').innerText = 'Editar Lançamento Financeiro';
    
    document.getElementById('conta-recorrencia').value = 'UNICA';
    document.getElementById('conta-recorrencia').disabled = true;
    toggleRecorrencia();

    document.getElementById('conta-ref').value = f.ref || '';
    document.getElementById('conta-categoria').value = f.categoria || (tipo === 'RECEBER' ? 'Vendas' : 'Outras Despesas');
    document.getElementById('conta-centro-custo').value = f.centroCusto || 'Geral';
    document.getElementById('conta-banco').value = f.contaBancaria || 'Caixa Físico';
    
    document.getElementById('conta-emissao').value = f.dataEmissao || '';
    document.getElementById('conta-vencimento').value = f.data ? f.data.split('T')[0] : '';
    const elCart = document.getElementById('conta-cartorio'); if(elCart) elCart.value = f.cartorioNome || '';
    const elProt = document.getElementById('conta-data-protesto'); if(elProt) elProt.value = f.dataCartorio || '';
      const elMulta = document.getElementById('conta-multa'); if(elMulta) elMulta.value = f.multaPerc || '';
      const elJuros = document.getElementById('conta-juros'); if(elJuros) elJuros.value = f.jurosMesPerc || '';
    document.getElementById('conta-competencia').value = f.competencia || '';
    
    document.getElementById('conta-num-nf').value = f.numNF || '';
    document.getElementById('conta-num-boleto').value = f.numBoleto || '';
    
    document.getElementById('conta-valor').value = f.valor || 0;
    document.getElementById('conta-acrescimo').value = f.acrescimo || 0;
    document.getElementById('conta-desconto').value = f.desconto || 0;
    
    document.getElementById('conta-status').value = f.status || 'PENDENTE';
    document.getElementById('conta-data-pgto').value = f.dataPagamento ? f.dataPagamento.split('T')[0] : '';
    document.getElementById('conta-metodo').value = f.metodoPagamento || '';
    
    document.getElementById('conta-obs').value = f.observacao || '';
    document.getElementById('conta-anexo-base64').value = f.anexoBase64 || '';
    
    calcularValorFinalFormulario();
    document.getElementById('modal-nova-conta').classList.remove('hidden');
}

function calcularValorFinalFormulario() {
    const vOrig = parseFloat(document.getElementById('conta-valor').value) || 0;
    const acre = parseFloat(document.getElementById('conta-acrescimo').value) || 0;
    const desc = parseFloat(document.getElementById('conta-desconto').value) || 0;
    
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
    const valorOriginal = parseFloat(document.getElementById('conta-valor').value); 
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
            categoria: document.getElementById('conta-categoria').value,
            centroCusto: document.getElementById('conta-centro-custo').value,
            contaBancaria: document.getElementById('conta-banco').value,
            dataEmissao: document.getElementById('conta-emissao').value,
            data: dataVenc.toISOString(), 
            dataCartorio: document.getElementById('conta-data-protesto') ? document.getElementById('conta-data-protesto').value : '',
            cartorioNome: document.getElementById('conta-cartorio') ? document.getElementById('conta-cartorio').value : '',
              multaPerc: parseFloat(document.getElementById('conta-multa').value) || 0,
              jurosMesPerc: parseFloat(document.getElementById('conta-juros').value) || 0, 
            competencia: document.getElementById('conta-competencia').value,
            numNF: document.getElementById('conta-num-nf').value,
            numBoleto: document.getElementById('conta-num-boleto').value,
            valor: valorOriginal, 
            acrescimo: parseFloat(document.getElementById('conta-acrescimo').value) || 0,
            desconto: parseFloat(document.getElementById('conta-desconto').value) || 0,
            valorPago: valorFin,
            status: document.getElementById('conta-status').value,
            dataPagamento: document.getElementById('conta-data-pgto').value ? new Date(document.getElementById('conta-data-pgto').value + 'T12:00:00').toISOString() : '',
            metodoPagamento: document.getElementById('conta-metodo').value,
            observacao: document.getElementById('conta-obs').value,
            anexoBase64: document.getElementById('conta-anexo-base64').value,
            ultimaAlteracao: Date.now()
        };

        if (isEdicao) {
            const ref = firestore.collection('financeiro').doc(String(idExistente));
            batch.set(ref, contaObj, { merge: true });
        } else {
            const ref = firestore.collection('financeiro').doc();
            batch.set(ref, contaObj);
            contasGeradas++;
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
        firestore.collection('financeiro').doc(String(id)).delete().then(() => {
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
            batch.set(firestore.collection('fc_moveis').doc('caixa'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
        }
        
        const finRef = firestore.collection('financeiro').doc(String(id));
        batch.update(finRef, { status: 'PENDENTE', dataPagamento: '', metodoPagamento: '', ultimaAlteracao: Date.now() });
        
        try {
            await batch.commit();
            renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar');
            showToast('Estorno concluído!', 'success');
        } catch (e) {
            console.error(e);
            showToast('Erro no estorno.', 'error');
        }
    });
}

function processarXMLReal(event) {
    const file = event.target.files[0]; if(!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new DOMParser(); const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
            const getFloatSafe = (context, tag) => { const node = context ? context.getElementsByTagName(tag)[0] : null; return node && node.textContent ? parseFloat(node.textContent) : 0; };
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
                if(match) { p.statusDB = 'ATUALIZAR'; p.idMatch = match.id; p.margemAtual = match.margem || 50; }
                let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0;
                let freteRateado = window.tempXMLData.freteExtra * pesoValor;
                p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + freteRateado) / p.qCom) : 0;
                p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100));
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
            if (vTPrestNode) valorFrete = parseFloat(vTPrestNode.textContent) || 0;
            else if (vRecNode) valorFrete = parseFloat(vRecNode.textContent) || 0;
            
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
    window.tempXMLData.freteExtra = parseFloat(document.getElementById('xml-frete-extra').value) || 0;
    window.tempXMLData.produtosXML.forEach(p => { 
        let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0; 
        p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + (window.tempXMLData.freteExtra * pesoValor)) / p.qCom) : 0; 
        p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100)); 
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
            <input type="number" step="0.01" class="w-full sm:w-28 text-right bg-transparent text-sm font-black text-red-600 dark:text-red-400 outline-none p-1" value="${f.valor.toFixed(2)}" onchange="atualizarParcelaXML(${i}, 'valor', this.value)">
            <button onclick="removeParcelaXML('${i}')" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>
        `;
    }).join('');

    document.getElementById('xml-total-financeiro').innerText = formatMoney(totalLancado);
}

function atualizarParcelaXML(idx, campo, val) {
    if(campo === 'valor') window.tempXMLData.financeiroXML[idx][campo] = parseFloat(val) || 0;
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
    const p = window.tempXMLData.produtosXML[i]; val = parseFloat(val) || 0;
    if(campo === 'custo') { p.custoFinal = val; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); }
    if(campo === 'margem') { p.margemAtual = val; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); }
    if(campo === 'preco') { p.precoVendaSug = val; if(p.custoFinal>0) p.margemAtual = ((p.precoVendaSug-p.custoFinal)/p.custoFinal)*100; }
    
    document.getElementById('xml-produtos-body').innerHTML = window.tempXMLData.produtosXML.map((p, idx) => `
        <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-indigo-50">
            <td class="p-2 text-xs"><input type="text" class="w-full bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none dark:text-white" value="${p.nome}" onchange="tempXMLData.produtosXML[${idx}].nome = this.value"><span class="text-[10px] text-slate-500 dark:text-slate-400">EAN: ${p.cEAN || 'S/N'}</span></td>
            <td class="p-2 text-xs text-center"><span class="${p.statusDB.includes('NOVO') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded font-bold">${p.statusDB}</span></td>
            <td class="p-2 text-xs text-center font-bold">${p.qCom}</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-red-600 outline-none dark:text-white" value="${p.custoFinal.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'custo', this.value)"></td>
            <td class="p-2 text-xs text-center"><input type="number" step="0.1" class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold text-blue-600 outline-none dark:text-white" value="${p.margemAtual.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'margem', this.value)"> %</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-24 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-emerald-600 outline-none dark:text-white" value="${p.precoVendaSug.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'preco', this.value)"></td>
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
    pXML.custoFinal = parseFloat(document.getElementById('prod-custo').value)||0; pXML.margemAtual = parseFloat(document.getElementById('prod-margem').value)||0; pXML.precoVendaSug = parseFloat(document.getElementById('prod-preco').value)||0;
    
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
        <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-indigo-50">
            <td class="p-2 text-xs"><input type="text" class="w-full bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none dark:text-white" value="${p.nome}" onchange="tempXMLData.produtosXML[${i}].nome = this.value"><span class="text-[10px] text-slate-500 dark:text-slate-400">EAN: ${p.cEAN || 'S/N'}</span></td>
            <td class="p-2 text-xs text-center"><span class="${p.statusDB.includes('NOVO') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded font-bold">${p.statusDB}</span></td>
            <td class="p-2 text-xs text-center font-bold">${p.qCom}</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-red-600 outline-none dark:text-white" value="${p.custoFinal.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'custo', this.value)"></td>
            <td class="p-2 text-xs text-center"><input type="number" step="0.1" class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold text-blue-600 outline-none dark:text-white" value="${p.margemAtual.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'margem', this.value)"> %</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-24 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-emerald-600 outline-none dark:text-white" value="${p.precoVendaSug.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'preco', this.value)"></td>
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
        const fornRef = firestore.collection('fornecedores').doc();
        batch.set(fornRef, { nome: data.fornNome, doc: data.fornCNPJ, cnpj: data.fornCNPJ, ie: '', wpp: '', email: '', contato: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', condicoes: '', produtos: '' });
    }
    
    data.produtosXML.forEach(p => {
        let idProd = p.idMatch;
        let pDB = null;
        if ((p.statusDB === 'NOVO' || p.statusDB.includes('CADASTRADO')) && !idProd) {
            idProd = String(Date.now() + Math.floor(Math.random() * 1000));
            pDB = { id: idProd, ean: p.cEAN, nome: p.nome, categoria: 'Geral', marca: data.fornNome, custo: p.custoFinal, margem: p.margemAtual, preco: p.precoVendaSug, estoque: p.qCom, min: 5, foto: '', ativo: true };
            const prodRef = firestore.collection('produtos').doc(idProd);
            batch.set(prodRef, pDB);
        } else { 
            pDB = db.produtos.find(x => String(x.id) === String(idProd)); 
            if (pDB) { 
                pDB.estoque += p.qCom; pDB.custo = p.custoFinal; pDB.margem = p.margemAtual; pDB.preco = p.precoVendaSug; pDB.nome = p.nome; pDB.ativo = true;
                const prodRef = firestore.collection('produtos').doc(String(idProd));
                batch.update(prodRef, { estoque: pDB.estoque, custo: pDB.custo, margem: pDB.margem, preco: pDB.preco, nome: pDB.nome, ativo: true });
            } 
        }
        p.idMatch = idProd; // Garante a rastreabilidade pro Relatório de Evolução
        totalQtd += p.qCom; 
        const kRef = firestore.collection('movimentacoes').doc();
        batch.set(kRef, { data: new Date().toISOString(), ref: `NF-e ${data.numNF} ${data.fornNome}`, produtoId: idProd, produtoNome: p.nome, qtd: p.qCom, tipo: 'ENTRADA XML' });
        
        p.custoUnitOriginal = p.qCom > 0 ? (p.vTotalItemNaNota / p.qCom) : 0;
    });

    const compraRef = firestore.collection('compras').doc();
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
            const finRef = firestore.collection('financeiro').doc();
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
        compraManualItens[index][campo] = parseFloat(valor) || 0;
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
            <td class="p-2 md:p-3"><input type="number" min="0.01" step="0.01" class="w-full text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded outline-none focus:border-emerald-500 text-xs font-bold dark:text-white" value="${item.qtd}" onchange="atualizarLinhaCompraManual(${i}, 'qtd', this.value)"></td>
            <td class="p-2 md:p-3"><input type="number" min="0" step="0.01" class="w-full text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded outline-none focus:border-emerald-500 text-xs font-bold dark:text-white" value="${item.custoUnit.toFixed(2)}" onchange="atualizarLinhaCompraManual(${i}, 'custoUnit', this.value)"></td>
            <td class="p-2 md:p-3 text-right font-bold text-slate-700 dark:text-slate-200">R$ ${(item.qtd * item.custoUnit).toFixed(2).replace('.',',')}</td>
            <td class="p-2 md:p-3 text-center"><button onclick="removerLinhaCompraManual('${i}')" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    calcularTotaisCompraManual();
}

function calcularTotaisCompraManual() {
    const frete = parseFloat(document.getElementById('compra-manual-frete').value) || 0;
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
                            batch.update(firestore.collection('produtos').doc(String(pDB.id)), { estoque: pDB.estoque });
                            const kRef = firestore.collection('movimentacoes').doc();
                            batch.set(kRef, { data: new Date().toISOString(), ref: `Estorno Edição Compra ${cAntiga.numeroNF}`, produtoId: pDB.id, produtoNome: pDB.nome, qtd: -item.qCom, tipo: 'ESTORNO COMPRA' });
                        }
                    }
                });
            }
            try {
                const snapFin = await firestore.collection('financeiro').where('tipo', '==', 'DESPESA').get();
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
        
        batch.update(firestore.collection('produtos').doc(String(pDB.id)), {
            estoque: pDB.estoque, custo: pDB.custo, preco: pDB.preco
        });
        
        const kRef = firestore.collection('movimentacoes').doc();
        batch.set(kRef, { data: new Date().toISOString(), ref: `Compra Man. ${refPed} (${fornecedorFinal})`, produtoId: pDB.id, produtoNome: pDB.nome, qtd: item.qtd, tipo: 'ENTRADA COMPRA' });
        
        itensRateadosParaSalvar.push({
            idMatch: pDB.id, nome: pDB.nome, qCom: item.qtd, custoFinal: custoRateadoFinal, vTotalItemNaNota: (item.qtd * item.custoUnit) + freteRateado, custoUnitOriginal: item.custoUnit 
        });
    });

    const idCompra = isEdicao ? idEdit : Date.now();
    const compraRef = firestore.collection('compras').doc(String(idCompra));
    batch.set(compraRef, { 
        id: idCompra, numeroNF: refPed, data: new Date(dataCompra + 'T12:00:00').toISOString(), fornecedor: fornecedorFinal, cnpj: '', 
        totalNF: totais.totalGeral, freteExtra: totais.frete, qtdTotal: totalQtd, itens: itensRateadosParaSalvar 
    }, { merge: true });

    if(document.getElementById('compra-manual-gerar-financeiro').checked && !isEdicao) {
        const finRef = firestore.collection('financeiro').doc();
        batch.set(finRef, { ref: `Compra: ${refPed}`, data: new Date(dataCompra + 'T12:00:00').toISOString(), pessoa: fornecedorFinal, valor: totais.totalGeral, status: 'PENDENTE', tipo: 'DESPESA', categoria: 'Fornecedores / Compras' });
    }

    if(fornAvulso && !db.fornecedores.find(f => f.nome.toLowerCase() === fornAvulso.toLowerCase())) {
        const fornRef = firestore.collection('fornecedores').doc();
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
        firestore.collection('compras').doc(String(id)).delete().then(() => {
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
    hoje.setHours(23, 59, 59, 999);
    
    let inicio = new Date(hoje);
    inicio.setHours(0, 0, 0, 0);
    let fim = new Date(hoje);
    
    if (tipo.value === 'mes') {
        inicio.setDate(1);
    } else if (tipo.value === '30') {
        inicio.setDate(inicio.getDate() - 30);
    } else if (tipo.value === '60') {
        inicio.setDate(inicio.getDate() - 60);
    } else if (tipo.value === '90') {
        inicio.setDate(inicio.getDate() - 90);
    } else if (tipo.value === 'personalizado') {
        const iStr = document.getElementById('bi-data-inicio')?.value;
        const fStr = document.getElementById('bi-data-fim')?.value;
        if (iStr) {
            inicio = new Date(iStr + 'T00:00:00');
        } else {
            inicio = new Date('2000-01-01');
        }
        if (fStr) {
            fim = new Date(fStr + 'T23:59:59');
        } else {
            fim = new Date('2100-01-01');
        }
    }
    
    return { inicio, fim };
}

function renderDashboard() {
    let vendas = db.vendas || [];
    let compras = db.compras || [];

    const periodo = obterIntervaloDatasBI();
    if (periodo) {
        vendas = vendas.filter(v => {
            const dataV = new Date(v.data);
            return dataV >= periodo.inicio && dataV <= periodo.fim;
        });
        compras = compras.filter(c => {
            const dataC = new Date(c.data);
            return dataC >= periodo.inicio && dataC <= periodo.fim;
        });
    }

    const fatTotal = vendas.reduce((a, b) => a + b.tot, 0); 
    const cmvTotal = vendas.reduce((a, b) => a + (b.custoTotal || 0), 0); 
    const taxasTotal = vendas.reduce((a, b) => a + (b.taxaValor || 0), 0); 
    const lucroReal = fatTotal - cmvTotal - taxasTotal;
    
    const rBrutaEl = document.getElementById('bi-receita'); if(rBrutaEl) rBrutaEl.innerText = formatMoney(fatTotal); 
    const rCmvEl = document.getElementById('bi-cmv'); if(rCmvEl) rCmvEl.innerText = `- ${formatMoney(cmvTotal)}`; 
    const rTaxEl = document.getElementById('bi-taxas'); if(rTaxEl) rTaxEl.innerText = `- ${formatMoney(taxasTotal)}`; 
    const rLucroEl = document.getElementById('bi-lucro'); if(rLucroEl) rLucroEl.innerText = formatMoney(lucroReal);
    
    const rankingProd = {}; 
    vendas.forEach(v => (v.itens || []).forEach(i => { 
        if(!rankingProd[i.nome]) rankingProd[i.nome] = 0; 
        rankingProd[i.nome] += (i.preco * i.qtd); 
    }));
    const abcEl = document.getElementById('bi-abc-produtos');
    if(abcEl) abcEl.innerHTML = Object.keys(rankingProd).map(k => ({nome: k, val: rankingProd[k]})).sort((a,b) => b.val - a.val).slice(0,5).map((p, i) => `<div class="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1"><span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200">${i+1}. ${p.nome}</span><span class="font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(p.val)}</span></div>`).join('');
    
    const rankingCli = {}; 
    vendas.forEach(v => { 
        const c = v.clienteNome || 'Consumidor'; 
        if(!rankingCli[c]) rankingCli[c] = 0; 
        rankingCli[c] += v.tot; 
    });
    const cliEl = document.getElementById('bi-top-clientes');
    if(cliEl) cliEl.innerHTML = Object.keys(rankingCli).map(k => ({nome: k, val: rankingCli[k]})).sort((a,b) => b.val - a.val).slice(0,5).map((c, i) => `<div class="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1"><span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200">${i+1}. ${c.nome}</span><span class="font-bold text-blue-600 dark:text-blue-400">${formatMoney(c.val)}</span></div>`).join('');

    const rankingForn = {};
    compras.forEach(c => {
        const fNome = c.fornecedor || 'Desconhecido';
        if(!rankingForn[fNome]) rankingForn[fNome] = 0;
        rankingForn[fNome] += (c.totalNF || 0);
    });
    const fornEl = document.getElementById('bi-top-fornecedores');
    if(fornEl) fornEl.innerHTML = Object.keys(rankingForn).map(k => ({nome: k, val: rankingForn[k]})).sort((a,b) => b.val - a.val).slice(0,5).map((f, i) => `<div class="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1"><span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200">${i+1}. ${f.nome}</span><span class="font-bold text-red-500 dark:text-red-400">${formatMoney(f.val)}</span></div>`).join('');

    const qtdCompras = compras.length;
    const totalGastoCompras = compras.reduce((acc, c) => acc + (c.totalNF || 0), 0);
    const ticketMedioCompras = qtdCompras > 0 ? totalGastoCompras / qtdCompras : 0;
    const totalItensComprados = compras.reduce((acc, c) => acc + (c.qtdTotal || 0), 0);
    
    const elQtd = document.getElementById('bi-compras-qtd'); if(elQtd) elQtd.innerText = qtdCompras;
    const elTicket = document.getElementById('bi-compras-ticket'); if(elTicket) elTicket.innerText = formatMoney(ticketMedioCompras);
    const elItens = document.getElementById('bi-compras-itens'); if(elItens) elItens.innerText = `${totalItensComprados} un`;

    const rankingCompras = {};
    compras.forEach(c => {
        (c.itens || []).forEach(i => {
            if(!rankingCompras[i.nome]) rankingCompras[i.nome] = 0;
            rankingCompras[i.nome] += (i.vTotalItemNaNota || 0); 
        });
    });
    const compEl = document.getElementById('bi-top-compras');
    if(compEl) compEl.innerHTML = Object.keys(rankingCompras).map(k => ({nome: k, val: rankingCompras[k]})).sort((a,b) => b.val - a.val).slice(0,5).map((p, i) => `<div class="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1"><span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200">${i+1}. ${p.nome}</span><span class="font-bold text-indigo-600 dark:text-indigo-400">${formatMoney(p.val)}</span></div>`).join('');

    const selProd = document.getElementById('relatorio-custo-produto');
    if(selProd) {
        const prodAtual = selProd.value;
        selProd.innerHTML = '<option value="">Selecione um Produto para carregar o histórico...</option>' + 
                            (db.produtos || []).map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        if(prodAtual) selProd.value = prodAtual;
    }
    
    // Chamar relatórios avançados
    renderCurvaABC(vendas, fatTotal);
    renderSugestorCompras(vendas, periodo);
}

function renderCurvaABC(vendasFiltradas, fatTotal) {
    const tbody = document.getElementById('tabela-curva-abc');
    if(!tbody) return;
    
    if(fatTotal === 0 || vendasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Nenhuma venda no período para gerar a Curva ABC.</td></tr>';
        return;
    }

    // 1. Agrupar vendas por produto
    const rankingProd = {};
    vendasFiltradas.forEach(v => {
        (v.itens || []).forEach(i => {
            if(!rankingProd[i.id]) {
                rankingProd[i.id] = { id: i.id, nome: i.nome, qtd: 0, faturamento: 0 };
            }
            rankingProd[i.id].qtd += i.qtd;
            rankingProd[i.id].faturamento += (i.preco * i.qtd);
        });
    });

    // 2. Ordenar por faturamento descrescente
    const produtosOrdenados = Object.values(rankingProd).sort((a, b) => b.faturamento - a.faturamento);

    // 3. Classificar A (80%), B (15%), C (5%)
    let fatAcumulado = 0;
    let html = '';

    produtosOrdenados.forEach(p => {
        fatAcumulado += p.faturamento;
        const percAcumulado = (fatAcumulado / fatTotal) * 100;
        const percIndividual = (p.faturamento / fatTotal) * 100;
        
        let classe = 'C';
        let badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';
        
        if (percAcumulado <= 80) {
            classe = 'A';
            badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
        } else if (percAcumulado <= 95) {
            classe = 'B';
            badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
        }

        html += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="p-3">
                    <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded text-xs font-bold border ${badgeColor}">${classe}</span>
                </td>
                <td class="p-3 font-medium text-slate-800 dark:text-slate-200">${p.nome}</td>
                <td class="p-3 text-center text-slate-600 dark:text-slate-400">${p.qtd}</td>
                <td class="p-3 text-right font-bold text-slate-700 dark:text-slate-300">${formatMoney(p.faturamento)} <span class="text-xs font-normal text-slate-400 block">${percIndividual.toFixed(1)}%</span></td>
                <td class="p-3 text-right text-slate-500 dark:text-slate-400">${percAcumulado.toFixed(1)}%</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderSugestorCompras(vendasFiltradas, periodoObj) {
    const tbody = document.getElementById('tabela-sugestor-compras');
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
    const produtosApp = db.produtos || [];
    const ALVO_DIAS_ESTOQUE = 30; // O usuário não especificou, mantendo 30 dias de cobertura

    produtosApp.forEach(p => {
        // Ignorar serviços ou itens sem controle de estoque
        if(p.tipo === 'Servico') return;

        const infoVenda = vendaPorProduto[p.id];
        if(!infoVenda) return; // Se não vendeu nada no período, não entra na sugestão (ou poderia entrar com alerta de encalhe)

        const mediaDiaria = infoVenda.qtdVendida / diasPeriodo;
        if(mediaDiaria <= 0) return;

        const estoqueAtual = Number(p.estoqueAtual) || 0;
        const autonomiaDias = estoqueAtual / mediaDiaria;
        
        // Sugere compra se a autonomia for menor que 15 dias ou se o estoque cobrir menos que o alvo (30)
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
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
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

function renderEvolucaoCustos() {
    const prodId = document.getElementById('relatorio-custo-produto').value;
    const tbody = document.getElementById('tabela-evolucao-custos');
    
    if(!prodId) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Selecione um produto acima para ver o histórico.</td></tr>';
        return;
    }

    let historico = [];
    (db.compras || []).forEach(compra => {
        (compra.itens || []).forEach(item => {
            if (String(item.idMatch) === String(prodId)) {
                historico.push({
                    data: compra.data,
                    fornecedor: compra.fornecedor,
                    ref: compra.numeroNF,
                    qtd: item.qCom || item.qtd || 0,
                    custo: item.custoFinal || item.custoUnitOriginal || 0
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
        divRes.innerHTML = 'Erro ao gerar análise. Verifique se você salvou sua chave API na aba Sistema.';
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
        case 'dre':
            titulo = 'DRE - Demonstra&ccedil;&atilde;o do Resultado';
            conteudo = '<p class="mb-3">Mostra a sa&uacute;de financeira das suas vendas no per&iacute;odo selecionado.</p><ul class="list-disc pl-5 space-y-2"><li><b>Receita Bruta:</b> Tudo o que voc&ecirc; vendeu (em R$).</li><li><b>Custo da Mercadoria (CMV):</b> Quanto voc&ecirc; pagou nos produtos que foram vendidos (Custo).</li><li><b>Taxas:</b> O total descontado pelas maquininhas de cart&atilde;o.</li><li><b>Lucro Bruto Real:</b> O que sobra limpo da venda dos produtos (Receita - Custo - Taxas). &Eacute; daqui que voc&ecirc; tira o dinheiro para pagar as despesas fixas (luz, aluguel, etc).</li></ul>';
            break;
        case 'top_compras':
            titulo = 'Top Compras (Produtos)';
            conteudo = '<p>Mostra quais foram os produtos em que voc&ecirc; <b>mais investiu dinheiro</b> comprando de fornecedores no per&iacute;odo selecionado. Ajuda a entender para onde est&aacute; indo o caixa da empresa na hora da reposi&ccedil;&atilde;o.</p>';
            break;
        case 'top_clientes':
            titulo = 'Top Clientes';
            conteudo = '<p>Ranking dos clientes que <b>mais trouxeram faturamento</b> para a loja. Ideal para voc&ecirc; identificar seus clientes VIPs, oferecer brindes, descontos especiais ou fazer a&ccedil;&otilde;es de fideliza&ccedil;&atilde;o.</p>';
            break;
        case 'top_fornecedores':
            titulo = 'Top Fornecedores';
            conteudo = '<p>Ranking dos fornecedores de quem voc&ecirc; <b>mais comprou</b> (em R$). &Uacute;til para saber com quem voc&ecirc; tem mais poder de barganha para negociar prazos maiores ou descontos.</p>';
            break;
        case 'evolucao_custos':
            titulo = 'Evolu&ccedil;&atilde;o de Custos';
            conteudo = '<p>Permite selecionar um produto espec&iacute;fico e ver o <b>hist&oacute;rico de pre&ccedil;os que voc&ecirc; pagou por ele</b> nas &uacute;ltimas compras. Excelente para identificar se a infla&ccedil;&atilde;o est&aacute; corroendo sua margem ou se um fornecedor subiu muito o pre&ccedil;o.</p>';
            break;
        case 'curva_abc':
            titulo = 'Curva ABC de Produtos';
            conteudo = '<p class="mb-3">A Curva ABC divide seus produtos pela import&acirc;ncia no seu faturamento usando a Regra de Pareto (80/20):</p><ul class="list-disc pl-5 space-y-2"><li><b>Classe A (Verde):</b> Produtos que somados trazem <b>80% do seu faturamento</b>. S&atilde;o o cora&ccedil;&atilde;o da loja, nunca podem faltar no estoque!</li><li><b>Classe B (Amarelo):</b> Produtos m&eacute;dios, trazem os pr&oacute;ximos <b>15%</b>.</li><li><b>Classe C (Vermelho):</b> A grande maioria dos itens, mas que juntos trazem s&oacute; os <b>5%</b> finais. N&atilde;o invista muito dinheiro estocando esses itens.</li></ul>';
            break;
        case 'sugestao_compras':
            titulo = 'Sugest&atilde;o Inteligente de Reposi&ccedil;&atilde;o';
            conteudo = '<p class="mb-3">O sistema analisa a velocidade com que cada produto foi vendido no per&iacute;odo e cruza com o que voc&ecirc; ainda tem no estoque.</p><ul class="list-disc pl-5 space-y-2"><li><b>Autonomia:</b> Quantos dias seu estoque atual vai durar se continuar vendendo nesse ritmo.</li><li><b>Sugest&atilde;o de Compra:</b> A quantidade exata que voc&ecirc; precisa comprar <b>hoje</b> para garantir que o produto n&atilde;o falte nos pr&oacute;ximos 30 dias.</li><li><b>Ruptura:</b> Quando o estoque j&aacute; acabou e voc&ecirc; est&aacute; perdendo vendas.</li><li><b>Cr&iacute;tico:</b> O estoque vai acabar em menos de 7 dias.</li></ul>';
            break;
        case 'estatisticas_compras':
            titulo = 'Estat&iacute;sticas de Compras';
            conteudo = '<p>Um resumo consolidado do volume de compras feitas no per&iacute;odo. Inclui o n&uacute;mero de notas/pedidos, o ticket m&eacute;dio (valor m&eacute;dio de cada compra feita com fornecedores) e a quantidade total de itens que entraram no estoque.</p>';
            break;
    }

    titleEl.innerHTML = titulo;
    contentEl.innerHTML = conteudo;
    modal.classList.remove('hidden');
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

    let totalLucro = 0;
    
    document.getElementById('tabela-vendas-body').innerHTML = filtrados.map(v => {
        try {
            const custoTotalDaVenda = (Number(v.custoTotal) || 0) + (Number(v.taxaValor) || 0); 
            const lucroDaVenda = (Number(v.tot) || 0) - custoTotalDaVenda; 
            const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0'); 
            totalLucro += lucroDaVenda;
            
            const dataRender = v.data && typeof formatData === 'function' ? formatData(v.data).replace(',', '') : (v.data || '-'); 
            const clienteRender = v.clienteNome || 'Desconhecido'; 
            const vendRender = v.vendedor || '-'; 
            const pagRender = v.pag || '-';
            
            const badgeTipo = v.tipo === 'SERVIÇO' ? `<span class="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1 whitespace-nowrap">SERVIÇO</span><br>` : `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1 whitespace-nowrap">VENDA</span><br>`;
            
            return `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                <td class="p-3 text-slate-500 dark:text-slate-400 text-xs">${dataRender}</td>
                <td class="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">${badgeTipo}#${numPedStr}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${clienteRender} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
                <td class="p-3"><span class="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">${pagRender}</span></td>
                <td class="p-3 text-right font-black text-slate-700 dark:text-slate-200">${typeof formatMoney === 'function' ? formatMoney(v.tot || 0) : (v.tot || 0)}</td>
                <td class="p-3 text-right font-bold text-red-500">-${typeof formatMoney === 'function' ? formatMoney(custoTotalDaVenda) : custoTotalDaVenda}</td>
                <td class="p-3 text-right font-black text-emerald-600">${typeof formatMoney === 'function' ? formatMoney(lucroDaVenda) : lucroDaVenda}</td>
            </tr>`;
        } catch (e) { console.error(e); return ''; }
    }).join('') || '<tr><td colspan="7" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum registro encontrado com os filtros atuais.</td></tr>';
    
    if (document.getElementById('vendas-total-filtros')) {
        document.getElementById('vendas-total-filtros').innerText = `Lucro Real Acumulado: ${typeof formatMoney === 'function' ? formatMoney(totalLucro) : totalLucro}`;
    }
}





function calcularJurosMulta(f) {
    if (f.status === 'PAGO' || f.status === 'CANCELADO') return { diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: f.valor };
    const hoje = new Date();
    const vdata = new Date(f.data);
    vdata.setHours(23, 59, 59, 999);
    if (hoje <= vdata) return { diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: f.valor };
    
    const diasAtraso = Math.floor((hoje - vdata) / (1000 * 60 * 60 * 24));
    if (diasAtraso <= 0) return { diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: f.valor };
    
    const multaPerc = f.multaPerc || 0;
    const jurosMesPerc = f.jurosMesPerc || 0;
    const multa = f.valor * (multaPerc / 100);
    const juros = f.valor * (jurosMesPerc / 100 / 30) * diasAtraso;
    const valorAtualizado = f.valor + multa + juros;
    return { diasAtraso, multa, juros, valorAtualizado };
}



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
            document.getElementById('prod-margem').value = (prod.margem || 50).toFixed(2);
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




// Expondo globalmente para evitar erros de escopo
window.mudarVisaoLocal = mudarVisaoLocal;
window.refreshCurrentView = refreshCurrentView;
window.inicializarGestao = inicializarGestao;
window.atualizarCardsFluxoDeCaixa = atualizarCardsFluxoDeCaixa;
window.abrirConfirmacao = abrirConfirmacao;
window.fecharModalConfirmacao = fecharModalConfirmacao;
window.printHtmlSeguro = printHtmlSeguro;
window.imprimirArea = imprimirArea;
window.baixarPDF = baixarPDF;
window.downloadPDF = downloadPDF;
window.exportarExcel = exportarExcel;
window.renderFinAbas = renderFinAbas;
window.renderCaixaDiario = renderCaixaDiario;
window.abrirModalCaixa = abrirModalCaixa;
window.fecharModalCaixa = fecharModalCaixa;
window.renderTitulos = renderTitulos;
window.preencherContaPessoaSelect = preencherContaPessoaSelect;
window.toggleContaPessoaInput = toggleContaPessoaInput;
window.getPessoaFinalConta = getPessoaFinalConta;
window.toggleRecorrencia = toggleRecorrencia;
window.abrirModalConta = abrirModalConta;
window.abrirModalContaEdicao = abrirModalContaEdicao;
window.calcularValorFinalFormulario = calcularValorFinalFormulario;
window.fecharModalConta = fecharModalConta;
window.salvarConta = salvarConta;
window.excluirTitulo = excluirTitulo;
window.abrirModalRenegociacao = abrirModalRenegociacao;
window.fecharModalRenegociacao = fecharModalRenegociacao;
window.verDetalhesTitulo = verDetalhesTitulo;
window.fecharModalDetalhesTitulo = fecharModalDetalhesTitulo;
window.abrirModalBaixa = abrirModalBaixa;
window.fecharModalBaixa = fecharModalBaixa;
window.calcularAcrescimos = calcularAcrescimos;
window.processarXMLReal = processarXMLReal;
window.lerXMLCTe = lerXMLCTe;
window.recalcularRateioXML = recalcularRateioXML;
window.renderXMLFinanceiro = renderXMLFinanceiro;
window.atualizarParcelaXML = atualizarParcelaXML;
window.addParcelaXML = addParcelaXML;
window.removeParcelaXML = removeParcelaXML;
window.xmlAtualizarValores = xmlAtualizarValores;
window.abrirModalProdutoDoXML = abrirModalProdutoDoXML;
window.fecharModalProduto = fecharModalProduto;
window.salvarProdutoXmlModal = salvarProdutoXmlModal;
window.renderTelaConferenciaXML = renderTelaConferenciaXML;
window.fecharModalXML = fecharModalXML;
window.abrirModalCompraManual = abrirModalCompraManual;
window.fecharModalCompraManual = fecharModalCompraManual;
window.editarCompra = editarCompra;
window.addLinhaCompraManual = addLinhaCompraManual;
window.removerLinhaCompraManual = removerLinhaCompraManual;
window.atualizarLinhaCompraManual = atualizarLinhaCompraManual;
window.renderTabelaCompraManual = renderTabelaCompraManual;
window.calcularTotaisCompraManual = calcularTotaisCompraManual;
window.renderComprasHist = renderComprasHist;
window.excluirNF = excluirNF;
window.verDetalhesNF = verDetalhesNF;
window.fecharModalDetalhesNF = fecharModalDetalhesNF;
window.mudarFiltroBI = mudarFiltroBI;
window.obterIntervaloDatasBI = obterIntervaloDatasBI;
window.renderDashboard = renderDashboard;
window.renderCurvaABC = renderCurvaABC;
window.renderSugestorCompras = renderSugestorCompras;
window.renderEvolucaoCustos = renderEvolucaoCustos;
window.exportarDadosParaIA = exportarDadosParaIA;
window.abrirInfoRelatorio = abrirInfoRelatorio;
window.renderVendas = renderVendas;
window.calcularJurosMulta = calcularJurosMulta;
window.alternarAcaoVinculoXML = alternarAcaoVinculoXML;
window.preencherVinculoXML = preencherVinculoXML;
window.abrirModalXML = abrirModalXML;
window.selecionarProdutoVinculoXML = selecionarProdutoVinculoXML;
window.filtrarProdutosXMLBusca = filtrarProdutosXMLBusca;
window.mostrarListaProdutosXMLBusca = mostrarListaProdutosXMLBusca;
window.ocultarListaProdutosXMLBusca = ocultarListaProdutosXMLBusca;

// Wrappers for backwards compatibility / user requested bindings
window.abrirCaixa = function() { abrirModalCaixa('abrir'); };
window.fecharCaixa = function() { abrirModalFechamentoCego(); };
window.registrarSuprimento = function() { abrirModalCaixa('suprimento'); };
window.registrarSangria = function() { abrirModalCaixa('sangria'); };
window.confirmarAberturaCaixa = confirmarMovCaixa;
window.confirmarFechamentoCaixa = confirmarFechamentoCego;
window.transferirParaBanco = abrirModalTransferenciaCaixa;

window.abrirModalFechamentoCego = abrirModalFechamentoCego;
window.fecharModalFechamentoCego = fecharModalFechamentoCego;
window.recalcularTotalDeclarado = recalcularTotalDeclarado;
window.confirmarFechamentoCego = confirmarFechamentoCego;
window.exibirModalMapaCaixa = exibirModalMapaCaixa;
window.abrirUltimoMapaCaixa = abrirUltimoMapaCaixa;
window.renderizarMapaCaixaHTML = renderizarMapaCaixaHTML;
window.abrirModalTransferenciaCaixa = abrirModalTransferenciaCaixa;
window.fecharModalTransferenciaCaixa = fecharModalTransferenciaCaixa;
window.confirmarTransferenciaCaixa = confirmarTransferenciaCaixa;
window.confirmarMovCaixa = confirmarMovCaixa;

// ==========================================
// TRANSFERÊNCIAS ENTRE CONTAS / BANCOS
// ==========================================
function abrirModalTransferenciaFin() {
    const valEl = document.getElementById('transf-fin-valor');
    const obsEl = document.getElementById('transf-fin-obs');
    const origEl = document.getElementById('transf-fin-origem');
    const destEl = document.getElementById('transf-fin-destino');
    
    if (valEl) valEl.value = '';
    if (obsEl) obsEl.value = '';
    if (origEl) origEl.value = 'Caixa Físico';
    if (destEl) destEl.value = 'Conta Corrente Principal';
    
    const modal = document.getElementById('modal-transferencia-fin');
    if (modal) modal.classList.remove('hidden');
    if (valEl) setTimeout(() => valEl.focus(), 100);
}

function fecharModalTransferenciaFin() {
    const modal = document.getElementById('modal-transferencia-fin');
    if (modal) modal.classList.add('hidden');
}

async function confirmarTransferenciaFin() {
    const origem = document.getElementById('transf-fin-origem')?.value || 'Caixa Físico';
    const destino = document.getElementById('transf-fin-destino')?.value || 'Conta Corrente Principal';
    const valor = parseFloat(document.getElementById('transf-fin-valor')?.value) || 0;
    const obs = document.getElementById('transf-fin-obs')?.value.trim() || '';

    if (valor <= 0) return showToast('Informe um valor válido para a transferência!', 'error');
    if (origem === destino) return showToast('A conta de origem e destino não podem ser iguais!', 'error');

    const batch = firestore.batch();
    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
    let cxSaldoNovo = cxAtual.saldo || 0;
    let atualizouCaixa = false;

    if (origem === 'Caixa Físico') {
        if (cxAtual.status !== 'ABERTO') return showToast('O Caixa Físico está fechado!', 'error');
        if (valor > cxSaldoNovo) return showToast('Saldo insuficiente no Caixa Físico!', 'error');
        cxSaldoNovo -= valor;
        cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: 'Transferência para ' + destino + (obs ? ' (' + obs + ')' : ''), valor: valor });
        atualizouCaixa = true;
    }

    if (destino === 'Caixa Físico') {
        if (cxAtual.status !== 'ABERTO') return showToast('O Caixa Físico está fechado!', 'error');
        cxSaldoNovo += valor;
        cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: 'Transferência de ' + origem + (obs ? ' (' + obs + ')' : ''), valor: valor });
        atualizouCaixa = true;
    }

    if (atualizouCaixa) {
        batch.set(firestore.collection('fc_moveis').doc('caixa'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
    }

    const transfRef = firestore.collection('financeiro').doc();
    const transfObj = {
        tipo: 'TRANSFERENCIA',
        origem: origem,
        destino: destino,
        pessoa: origem + ' ➔ ' + destino,
        ref: 'Transf: ' + origem + ' ➔ ' + destino,
        categoria: 'Transferência Entre Contas',
        centroCusto: 'Operacional',
        contaBancaria: destino,
        valor: valor,
        valorPago: valor,
        status: 'CONCLUIDA',
        observacao: obs,
        data: new Date().toISOString(),
        dataPagamento: new Date().toISOString(),
        metodoPagamento: 'Transferência Interna',
        ultimaAlteracao: Date.now()
    };
    batch.set(transfRef, transfObj);

    try {
        await batch.commit();
        fecharModalTransferenciaFin();
        renderTransferenciasFin();
        showToast('Transferência realizada com sucesso!', 'success');
    } catch (e) {
        console.error('Erro ao transferir:', e);
        showToast('Erro ao realizar transferência.', 'error');
    }
}

function renderTransferenciasFin() {
    const tbody = document.getElementById('tabela-transferencias-body');
    if (!tbody || !db.financeiro) return;
    const transferencias = db.financeiro.filter(f => f.tipo === 'TRANSFERENCIA' || f.categoria === 'Transferência Entre Contas').sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    if (transferencias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma transferência registrada.</td></tr>';
        return;
    }

    tbody.innerHTML = transferencias.map(t => {
        const dataFmt = t.data ? formatData(t.data) : '-';
        const origemDestino = t.origem && t.destino ? t.origem + ' <i class="fa-solid fa-arrow-right mx-1 text-xs text-slate-400"></i> ' + t.destino : (t.pessoa || t.ref);
        return '<tr class="hover:bg-slate-100/60 dark:hover:bg-slate-700/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60 transition-colors text-slate-800 dark:text-slate-200"><td class="p-3 text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">' + dataFmt + '</td><td class="p-3 text-xs font-bold text-slate-800 dark:text-slate-100">' + origemDestino + '</td><td class="p-3 text-xs text-slate-600 dark:text-slate-300">' + (t.observacao || '-') + '</td><td class="p-3 text-right font-black text-sm text-purple-600 dark:text-purple-400 whitespace-nowrap">' + formatMoney(t.valor || 0) + '</td><td class="p-3 text-center"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">CONCLUÍDA</span></td><td class="p-3 text-center"><button onclick="excluirTransferenciaFin(\'' + t.id + '\')" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="Excluir"><i class="fa-solid fa-trash"></i></button></td></tr>';
    }).join('');
}

async function excluirTransferenciaFin(id) {
    const t = db.financeiro?.find(x => String(x.id) === String(id));
    if (!t) return;

    abrirConfirmacao('Cancelar', 'Cancelar transferência de ' + formatMoney(t.valor) + '?', async () => {
        const batch = firestore.batch();
        if (t.origem === 'Caixa Físico' || t.destino === 'Caixa Físico') {
            let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
            let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
            let cxSaldoNovo = cxAtual.saldo || 0;
            if (t.origem === 'Caixa Físico') {
                cxSaldoNovo += (t.valor || 0);
                cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: 'Estorno Transf: para ' + t.destino, valor: t.valor });
            } else if (t.destino === 'Caixa Físico') {
                cxSaldoNovo -= (t.valor || 0);
                cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: 'Estorno Transf: de ' + t.origem, valor: t.valor });
            }
            batch.set(firestore.collection('fc_moveis').doc('caixa'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
        }
        batch.delete(firestore.collection('financeiro').doc(String(id)));
        try {
            await batch.commit();
            renderTransferenciasFin();
            showToast('Transferência estornada!', 'success');
        } catch (e) {
            showToast('Erro ao estornar.', 'error');
        }
    });
}

// ==========================================
// OFX
// ==========================================
window.extratoOFXAtual = null;

function processarArquivoOFX(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    showToast('Lendo arquivo OFX bancário...', 'info');
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const buffer = e.target.result;
            let rawText = '';
            try {
                const decUtf8 = new TextDecoder('utf-8', { fatal: false });
                rawText = decUtf8.decode(buffer);
                if (/CHARSET\s*:\s*(1252|ISO-8859-1|WIN)/i.test(rawText) || rawText.includes('\uFFFD')) {
                    rawText = new TextDecoder('iso-8859-1').decode(buffer);
                }
            } catch (errDec) {
                rawText = new TextDecoder('iso-8859-1').decode(buffer);
            }
            const extrato = parseOFXContent(rawText);
            if (!extrato || !extrato.transacoes || extrato.transacoes.length === 0) return showToast('Sem transações válidas no arquivo OFX', 'warning');
            window.extratoOFXAtual = extrato;
            cruzarOFXComFinanceiro();
            renderConciliacaoOFX();
            showToast('Extrato OFX importado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro OFX:', err);
            showToast('Erro ao processar arquivo OFX', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function parseOFXContent(rawText) {
    const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    function extrairTag(bloco, tag) {
        const regex = new RegExp('<' + tag + '>([^<\\n\\r]+)', 'i');
        const match = bloco.match(regex);
        return match ? match[1].trim() : '';
    }
    const org = extrairTag(text, 'ORG') || extrairTag(text, 'FID');
    const bankId = extrairTag(text, 'BANKID');
    const acctId = extrairTag(text, 'ACCTID');
    let bancoNome = org || bankId || 'Banco';
    
    const regexBloco = /<\s*STMTTRN\s*>([\s\S]*?)(?=<\s*\/\s*STMTTRN\s*>|<\s*STMTTRN\s*>|<\s*\/\s*BANKTRANLIST\s*>|$)/gi;
    const transacoes = [];
    let matchBloco;
    let idx = 0;
    while ((matchBloco = regexBloco.exec(text)) !== null) {
        const bloco = matchBloco[1];
        if (!bloco.trim()) continue;
        const trnType = extrairTag(bloco, 'TRNTYPE').toUpperCase();
        let dtPostedRaw = extrairTag(bloco, 'DTPOSTED');
        let trnAmtRaw = extrairTag(bloco, 'TRNAMT');
        const fitId = extrairTag(bloco, 'FITID');
        let memo = extrairTag(bloco, 'MEMO') || extrairTag(bloco, 'NAME') || '';
        let dataIso = '';
        const matchData = dtPostedRaw.match(/(\d{4})(\d{2})(\d{2})/);
        if (matchData) dataIso = matchData[1] + '-' + matchData[2] + '-' + matchData[3];
        else dataIso = new Date().toISOString().split('T')[0];
        const valorNum = parseFloat(trnAmtRaw.replace(',', '.')) || 0;
        if (valorNum === 0 && !memo) continue;
        const isCredito = valorNum > 0 || trnType === 'CREDIT' || trnType === 'DEP';
        transacoes.push({
            index: idx++,
            fitid: fitId || "ofx_" + Date.now() + "_" + idx,
            tipoFin: isCredito ? 'RECEITA' : 'DESPESA',
            isCredito: isCredito,
            data: dataIso,
            valor: Math.abs(valorNum),
            memo: memo,
            matchDoc: null,
            statusMatch: 'SEM_MATCH',
            conciliadoSucesso: false
        });
    }
    return { banco: bancoNome, conta: acctId, transacoes: transacoes };
}

function cruzarOFXComFinanceiro() {
    if (!window.extratoOFXAtual) return;
    const financeiro = db.financeiro || [];
    window.extratoOFXAtual.transacoes.forEach(t => {
        if (t.conciliadoSucesso) return;
        const jaConciliadoFitid = financeiro.find(f => f.fitid === t.fitid && f.status === 'PAGO');
        if (jaConciliadoFitid) { t.statusMatch = 'JA_CONCILIADO'; t.matchDoc = jaConciliadoFitid; return; }
        const candidatos = financeiro.filter(f => f.status !== 'CANCELADO' && (f.tipo === t.tipoFin || (!f.tipo && t.tipoFin==='RECEITA')));
        const matchExatoPendente = candidatos.find(f => f.status === 'PENDENTE' && Math.abs((f.valor||0)-t.valor)<=0.05);
        if (matchExatoPendente) { t.statusMatch = 'MATCH_EXATO'; t.matchDoc = matchExatoPendente; return; }
        const matchExatoPago = candidatos.find(f => f.status === 'PAGO' && Math.abs((f.valorPago||f.valor||0)-t.valor)<=0.05);
        if (matchExatoPago) { t.statusMatch = 'JA_CONCILIADO'; t.matchDoc = matchExatoPago; return; }
        t.statusMatch = 'SEM_MATCH';
        t.matchDoc = null;
    });
}

function renderConciliacaoOFX() {
    const area = document.getElementById('fin-area-conciliacao');
    const resumoPainel = document.getElementById('ofx-resumo-painel');
    const tabelaWrap = document.getElementById('ofx-tabela-wrap');
    const tbody = document.getElementById('ofx-tabela-body');

    if (!tbody || !window.extratoOFXAtual || !window.extratoOFXAtual.transacoes || window.extratoOFXAtual.transacoes.length === 0) {
        if (resumoPainel) resumoPainel.classList.add('hidden');
        if (tabelaWrap) tabelaWrap.classList.add('hidden');
        return;
    }

    cruzarOFXComFinanceiro();

    const extrato = window.extratoOFXAtual;
    const transacoes = extrato.transacoes;

    if (resumoPainel) {
        resumoPainel.classList.remove('hidden');
        const creditos = transacoes.filter(t => t.isCredito).reduce((acc, t) => acc + t.valor, 0);
        const debitos = transacoes.filter(t => !t.isCredito).reduce((acc, t) => acc + t.valor, 0);
        const bNomeEl = document.getElementById('ofx-banco-nome');
        if (bNomeEl) bNomeEl.innerText = extrato.banco;
        const cTotEl = document.getElementById('ofx-total-creditos');
        if (cTotEl) cTotEl.innerText = formatMoney(creditos);
        const dTotEl = document.getElementById('ofx-total-debitos');
        if (dTotEl) dTotEl.innerText = formatMoney(debitos);
        const rTotEl = document.getElementById('ofx-total-registros');
        if (rTotEl) rTotEl.innerText = transacoes.length + ' transações';
    }

    if (tabelaWrap) tabelaWrap.classList.remove('hidden');

    tbody.innerHTML = window.extratoOFXAtual.transacoes.map((t, idx) => {
        const dataFmt = t.data.split('-').reverse().join('/');
        const corValor = t.isCredito ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400';
        const sinalValor = t.isCredito ? '+ ' : '- ';
        const checkInput = (!t.conciliadoSucesso && t.statusMatch !== 'JA_CONCILIADO') 
            ? '<input type="checkbox" class="ofx-item-check w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600" data-idx="' + idx + '" checked>' 
            : '<input type="checkbox" disabled class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 opacity-40 cursor-not-allowed">';
        
        let acaoHtml = '';
        let matchTexto = '';
        let statusBadge = '';

        if (t.statusMatch === 'JA_CONCILIADO') {
            matchTexto = '<span class="text-slate-500 dark:text-slate-400 font-medium inline-flex items-center gap-1"><i class="fa-solid fa-check text-emerald-500 text-xs"></i> Baixado no sistema</span>';
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><i class="fa-solid fa-circle-check"></i> CONCILIADO</span>';
            acaoHtml = '<span class="text-emerald-600 dark:text-emerald-400 font-bold text-xs inline-flex items-center gap-1"><i class="fa-solid fa-check-double"></i> Pronto</span>';
        } else if (t.statusMatch === 'MATCH_EXATO') {
            matchTexto = '<span class="font-bold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 truncate max-w-[200px]" title="' + (t.matchDoc.pessoa || t.matchDoc.ref || '') + '"><i class="fa-solid fa-link text-xs"></i> ' + (t.matchDoc.pessoa || t.matchDoc.ref || '-') + '</span>';
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><i class="fa-solid fa-arrows-rotate"></i> MATCH ENCONTRADO</span>';
            acaoHtml = '<button onclick="conciliarItemOFX(' + idx + ')" class="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1.5 mx-auto"><i class="fa-solid fa-check"></i> Conciliar</button>';
        } else {
            matchTexto = '<span class="text-slate-400 dark:text-slate-500 italic">Não identificado</span>';
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">NOVO LANÇAMENTO</span>';
            acaoHtml = '<button onclick="criarEConciliarItemOFX(' + idx + ')" class="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1.5 mx-auto"><i class="fa-solid fa-plus"></i> Lançar & Baixar</button>';
        }
        return '<tr class="hover:bg-slate-100/60 dark:hover:bg-slate-700/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60 transition-colors text-slate-800 dark:text-slate-200"><td class="p-3 text-center">' + checkInput + '</td><td class="p-3 text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">' + dataFmt + '</td><td class="p-3 text-xs font-bold text-slate-800 dark:text-slate-100">' + t.memo + '</td><td class="p-3 text-right font-black ' + corValor + ' whitespace-nowrap text-sm">' + sinalValor + formatMoney(t.valor) + '</td><td class="p-3 text-xs">' + matchTexto + '</td><td class="p-3 text-center">' + statusBadge + '</td><td class="p-3 text-center">' + acaoHtml + '</td></tr>';
    }).join('');
}

function conciliarItemOFX(idx) {
    abrirModalConciliacaoOFX(idx, true);
}

function criarEConciliarItemOFX(idx) {
    abrirModalConciliacaoOFX(idx, false);
}

function ofxAlternarModo(modo) {
    ofxModoAtual = modo;
    window.ofxModoAtual = modo;
    
    const btnVincular = document.getElementById('ofx-btn-modo-vincular');
    const btnNovo = document.getElementById('ofx-btn-modo-novo');
    const areaVincular = document.getElementById('ofx-area-modo-vincular');
    const areaNovo = document.getElementById('ofx-area-modo-novo');

    if (modo === 'VINCULAR') {
        if (btnVincular) {
            btnVincular.className = 'py-2.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 bg-blue-600 text-white shadow-sm';
        }
        if (btnNovo) {
            btnNovo.className = 'py-2.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white';
        }
        if (areaVincular) areaVincular.classList.remove('hidden');
        if (areaNovo) areaNovo.classList.add('hidden');
        
        ofxRenderizarTitulosPendentes();
    } else {
        if (btnNovo) {
            btnNovo.className = 'py-2.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 bg-blue-600 text-white shadow-sm';
        }
        if (btnVincular) {
            btnVincular.className = 'py-2.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white';
        }
        if (areaVincular) areaVincular.classList.add('hidden');
        if (areaNovo) areaNovo.classList.remove('hidden');

        ofxDesvincularTitulo(true);
    }
}

function ofxRenderizarTitulosPendentes(filtroTexto = '') {
    const listaContainer = document.getElementById('ofx-lista-titulos-pendentes');
    const contadorEl = document.getElementById('ofx-contador-pendentes');
    if (!listaContainer || !window.extratoOFXAtual || ofxItemAtualIdx === null) return;

    const item = window.extratoOFXAtual.transacoes[ofxItemAtualIdx];
    if (!item) return;

    const tipoEsperado = item.isCredito ? 'RECEITA' : 'DESPESA';
    const termoNorm = normalizarTexto(filtroTexto);

    let pendentes = (db.financeiro || []).filter(f => {
        const isStatusPendente = f.status !== 'PAGO' && f.status !== 'CANCELADO';
        const isTipoCompativel = f.tipo === tipoEsperado || (!f.tipo && tipoEsperado === 'RECEITA');
        return isStatusPendente && isTipoCompativel;
    });

    if (termoNorm) {
        pendentes = pendentes.filter(f => {
            const textoBusca = normalizarTexto(`${f.pessoa || ''} ${f.ref || ''} ${f.categoria || ''} ${f.numNF || ''} ${f.numBoleto || ''} ${f.valor || ''}`);
            return textoBusca.includes(termoNorm);
        });
    }

    pendentes.sort((a, b) => {
        const diffA = Math.abs(a.valor - item.valor);
        const diffB = Math.abs(b.valor - item.valor);
        if (diffA < 0.01 && diffB >= 0.01) return -1;
        if (diffB < 0.01 && diffA >= 0.01) return 1;
        if (Math.abs(diffA - diffB) > 0.01) return diffA - diffB;
        return new Date(a.data) - new Date(b.data);
    });

    if (contadorEl) {
        contadorEl.innerText = `${pendentes.length} encontrado(s)`;
    }

    if (pendentes.length === 0) {
        listaContainer.innerHTML = `
            <div class="p-4 text-center text-slate-400 dark:text-slate-500 text-xs">
                <i class="fa-solid fa-folder-open text-lg mb-1 block opacity-60"></i>
                Nenhum título pendente compatível encontrado no momento.
                <button type="button" onclick="ofxAlternarModo('NOVO')" class="mt-2 text-blue-600 dark:text-blue-400 font-bold hover:underline block mx-auto">
                    + Criar como Novo Lançamento
                </button>
            </div>`;
        return;
    }

    listaContainer.innerHTML = pendentes.map(f => {
        const isSelecionado = String(f.id) === String(ofxTituloVinculadoId);
        const isExato = Math.abs(f.valor - item.valor) < 0.01;
        const dataFmt = f.data ? formatData(f.data).split(' ')[0] : '-';
        
        let cardBg = isSelecionado 
            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 shadow-sm' 
            : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/80';

        let badgeProximidade = isExato 
            ? '<span class="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"><i class="fa-solid fa-star"></i> Valor Exato</span>' 
            : '';

        let btnAcao = isSelecionado
            ? `<button type="button" class="bg-blue-600 text-white font-bold px-3 py-1 rounded-lg text-[11px] shadow-sm flex items-center gap-1">
                 <i class="fa-solid fa-check"></i> Vinculado
               </button>`
            : `<button type="button" onclick="ofxSelecionarTituloVinculado('${f.id}')" class="bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1 rounded-lg text-[11px] transition shadow-xs">
                 Selecionar
               </button>`;

        return `
            <div class="flex items-center justify-between p-2.5 rounded-lg border transition ${cardBg} cursor-pointer" onclick="ofxSelecionarTituloVinculado('${f.id}')">
                <div class="flex items-center gap-2.5 min-w-0 pr-2">
                    <div class="w-2 h-2 rounded-full ${isSelecionado ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-slate-300 dark:bg-slate-600'} shrink-0"></div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate max-w-[180px]">${f.pessoa || 'Sem favorecido'}</span>
                            ${badgeProximidade}
                        </div>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            <span class="font-mono text-slate-600 dark:text-slate-300">${dataFmt}</span> | Ref: ${f.ref || f.categoria || '-'}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <span class="font-black text-xs ${item.isCredito ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${formatMoney(f.valor)}</span>
                    ${btnAcao}
                </div>
            </div>`;
    }).join('');
}

function ofxFiltrarTitulosPendentes() {
    const input = document.getElementById('ofx-busca-titulos');
    ofxRenderizarTitulosPendentes(input ? input.value : '');
}

function ofxSelecionarTituloVinculado(id) {
    if (!db.financeiro) return;
    const f = db.financeiro.find(x => String(x.id) === String(id));
    if (!f) return;

    ofxTituloVinculadoId = f.id;
    window.ofxTituloVinculadoId = f.id;

    const cardSel = document.getElementById('ofx-card-titulo-selecionado');
    if (cardSel) {
        cardSel.classList.remove('hidden');
        document.getElementById('ofx-sel-pessoa').innerText = f.pessoa || f.ref || 'Não especificado';
        document.getElementById('ofx-sel-venc').innerText = f.data ? formatData(f.data).split(' ')[0] : '-';
        document.getElementById('ofx-sel-valor').innerText = formatMoney(f.valor);
    }

    const elTipo = document.getElementById('ofx-modal-tipo');
    if (elTipo) elTipo.value = f.tipo || (window.extratoOFXAtual.transacoes[ofxItemAtualIdx]?.isCredito ? 'RECEITA' : 'DESPESA');
    
    ofxModalAtualizarCategorias();

    const elPessoa = document.getElementById('ofx-modal-pessoa');
    if (elPessoa) elPessoa.value = f.pessoa || '';

    const elCat = document.getElementById('ofx-modal-categoria');
    if (elCat && f.categoria) elCat.value = f.categoria;

    const elCc = document.getElementById('ofx-modal-centro-custo');
    if (elCc) elCc.value = f.centroCusto || 'Geral';

    ofxRenderizarTitulosPendentes(document.getElementById('ofx-busca-titulos')?.value || '');
    showToast('Título vinculado para baixa!', 'info');
}

function ofxDesvincularTitulo(manterFormulario = false) {
    ofxTituloVinculadoId = null;
    window.ofxTituloVinculadoId = null;

    const cardSel = document.getElementById('ofx-card-titulo-selecionado');
    if (cardSel) cardSel.classList.add('hidden');

    if (!manterFormulario && window.extratoOFXAtual && ofxItemAtualIdx !== null) {
        const item = window.extratoOFXAtual.transacoes[ofxItemAtualIdx];
        if (item) {
            document.getElementById('ofx-modal-pessoa').value = item.memo || '';
            document.getElementById('ofx-modal-tipo').value = item.isCredito ? 'RECEITA' : 'DESPESA';
            ofxModalAtualizarCategorias();
            document.getElementById('ofx-modal-categoria').value = item.isCredito ? 'Outras Receitas' : 'Outras Despesas';
        }
    }

    ofxRenderizarTitulosPendentes(document.getElementById('ofx-busca-titulos')?.value || '');
}

function abrirModalConciliacaoOFX(idx, temMatch) {
    if (!window.extratoOFXAtual || !window.extratoOFXAtual.transacoes || !window.extratoOFXAtual.transacoes[idx]) return;
    const item = window.extratoOFXAtual.transacoes[idx];
    const docMatch = item.matchDoc;
    ofxItemAtualIdx = idx;
    window.ofxItemAtualIdx = idx;

    const bancoNome = window.extratoOFXAtual.banco || 'Conta Bancária';
    const elBanco = document.getElementById('ofx-modal-ext-banco');
    if (elBanco) elBanco.innerText = bancoNome;

    const elData = document.getElementById('ofx-modal-ext-data');
    if (elData) elData.innerText = item.data.split('-').reverse().join('/');

    const elDesc = document.getElementById('ofx-modal-ext-desc');
    if (elDesc) {
        elDesc.innerText = item.memo || '-';
        elDesc.title = item.memo || '';
    }

    const elVal = document.getElementById('ofx-modal-ext-valor');
    if (elVal) {
        elVal.innerText = (item.isCredito ? '+ ' : '- ') + formatMoney(item.valor);
        elVal.className = `font-black text-xl ${item.isCredito ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;
    }

    const elBadge = document.getElementById('ofx-modal-ext-tipo-badge');
    if (elBadge) {
        if (item.isCredito) {
            elBadge.innerText = 'Crédito / Entrada';
            elBadge.className = 'px-2.5 py-1 rounded-full text-xs font-black tracking-wide bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
        } else {
            elBadge.innerText = 'Débito / Saída';
            elBadge.className = 'px-2.5 py-1 rounded-full text-xs font-black tracking-wide bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
        }
    }

    const datalist = document.getElementById('ofx-pessoas-datalist');
    if (datalist) {
        const pessoas = new Set();
        (db.clientes || []).forEach(c => { if (c.nome) pessoas.add(c.nome); if (c.razaoSocial) pessoas.add(c.razaoSocial); });
        (db.fornecedores || []).forEach(f => { if (f.nome) pessoas.add(f.nome); if (f.razaoSocial) pessoas.add(f.razaoSocial); });
        datalist.innerHTML = Array.from(pessoas).sort().map(p => `<option value="${p}">`).join('');
    }

    const elTipo = document.getElementById('ofx-modal-tipo');
    if (elTipo) elTipo.value = item.isCredito ? 'RECEITA' : 'DESPESA';
    ofxModalAtualizarCategorias();

    const elDataPgto = document.getElementById('ofx-modal-data-pgto');
    if (elDataPgto) elDataPgto.value = item.data;

    const elValPago = document.getElementById('ofx-modal-valor-pago');
    if (elValPago) elValPago.value = item.valor.toFixed(2);

    const elMetodo = document.getElementById('ofx-modal-metodo');
    if (elMetodo) elMetodo.value = 'Pix';

    const elConta = document.getElementById('ofx-modal-conta-bancaria');
    if (elConta) elConta.value = bancoNome;

    const elObs = document.getElementById('ofx-modal-obs');
    if (elObs) elObs.value = `Conciliado via OFX em ${new Date().toLocaleDateString('pt-BR')} (Ref: ${item.memo || ''})`;

    const buscaInput = document.getElementById('ofx-busca-titulos');
    if (buscaInput) buscaInput.value = '';

    if (temMatch && docMatch) {
        ofxAlternarModo('VINCULAR');
        ofxSelecionarTituloVinculado(docMatch.id);
    } else {
        const temPendentes = (db.financeiro || []).some(f => f.status !== 'PAGO' && f.status !== 'CANCELADO' && (f.tipo === (item.isCredito ? 'RECEITA' : 'DESPESA') || (!f.tipo && item.isCredito)));
        if (temPendentes) {
            ofxAlternarModo('VINCULAR');
            ofxDesvincularTitulo(true);
            document.getElementById('ofx-modal-pessoa').value = item.memo || '';
        } else {
            ofxAlternarModo('NOVO');
            document.getElementById('ofx-modal-pessoa').value = item.memo || '';
        }
    }

    const modal = document.getElementById('modal-conciliacao-ofx');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalConciliacaoOFX() {
    const modal = document.getElementById('modal-conciliacao-ofx');
    if (modal) modal.classList.add('hidden');
    ofxItemAtualIdx = null;
    window.ofxItemAtualIdx = null;
    ofxTituloVinculadoId = null;
    window.ofxTituloVinculadoId = null;
}

function toggleTodosOFX(checked) {
    document.querySelectorAll('.ofx-item-check:not(:disabled)').forEach(cb => { cb.checked = checked; });
}

async function conciliarLoteOFX() {
    if (!window.extratoOFXAtual || !window.extratoOFXAtual.transacoes) return;
    const checkboxes = document.querySelectorAll('.ofx-item-check:checked');
    if (checkboxes.length === 0) return showToast('Selecione ao menos um!', 'warning');
    
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.idx));
    const bancoNome = window.extratoOFXAtual.banco || 'Conta Bancária';
    const batch = firestore.batch();
    let totalConciliados = 0;

    indices.forEach(idx => {
        const item = window.extratoOFXAtual.transacoes[idx];
        if (!item || item.conciliadoSucesso || item.statusMatch === 'JA_CONCILIADO') return;
        if (item.matchDoc && (item.statusMatch === 'MATCH_EXATO' || item.statusMatch === 'MATCH_PROVAVEL')) {
            const finRef = firestore.collection('financeiro').doc(String(item.matchDoc.id));
            batch.update(finRef, {
                status: 'PAGO',
                valorPago: item.valor,
                metodoPagamento: 'Extrato OFX (' + bancoNome + ')',
                contaBancaria: bancoNome,
                dataPagamento: new Date(item.data + 'T12:00:00').toISOString(),
                fitid: item.fitid || '',
                observacao: (item.matchDoc.observacao ? item.matchDoc.observacao + '\n' : '') + 'Conciliado via OFX',
                ultimaAlteracao: Date.now()
            });
            item.conciliadoSucesso = true;
            item.statusMatch = 'JA_CONCILIADO';
            totalConciliados++;
        } else if (item.statusMatch === 'SEM_MATCH') {
            const finRef = firestore.collection('financeiro').doc();
            const novoDoc = {
                tipo: item.tipoFin,
                pessoa: item.memo || (item.isCredito ? 'Recebimento Bancário' : 'Despesa Bancária'),
                ref: 'OFX: ' + (item.memo || 'Lançamento'),
                categoria: item.isCredito ? 'Outras Receitas' : 'Outras Despesas',
                centroCusto: 'Operacional',
                contaBancaria: bancoNome,
                valor: item.valor,
                valorPago: item.valor,
                status: 'PAGO',
                data: new Date(item.data + 'T12:00:00').toISOString(),
                dataPagamento: new Date(item.data + 'T12:00:00').toISOString(),
                metodoPagamento: 'Extrato OFX (' + bancoNome + ')',
                fitid: item.fitid || '',
                observacao: 'Criado via Extrato OFX',
                ultimaAlteracao: Date.now()
            };
            batch.set(finRef, novoDoc);
            item.conciliadoSucesso = true;
            item.statusMatch = 'JA_CONCILIADO';
            item.matchDoc = { id: finRef.id, ...novoDoc };
            totalConciliados++;
        }
    });

    if (totalConciliados === 0) return;
    try {
        await batch.commit();
        renderConciliacaoOFX();
        showToast(totalConciliados + ' lançamentos conciliados!', 'success');
    } catch (e) {
        showToast('Erro ao processar.', 'error');
    }
}

window.abrirModalTransferenciaFin = abrirModalTransferenciaFin;
window.fecharModalTransferenciaFin = fecharModalTransferenciaFin;
window.confirmarTransferenciaFin = confirmarTransferenciaFin;
window.renderTransferenciasFin = renderTransferenciasFin;
window.excluirTransferenciaFin = excluirTransferenciaFin;

window.processarArquivoOFX = processarArquivoOFX;
window.parseOFXContent = parseOFXContent;
window.cruzarOFXComFinanceiro = cruzarOFXComFinanceiro;
window.renderConciliacaoOFX = renderConciliacaoOFX;
window.conciliarItemOFX = conciliarItemOFX;
window.criarEConciliarItemOFX = criarEConciliarItemOFX;
window.conciliarLoteOFX = conciliarLoteOFX;
window.toggleTodosOFX = toggleTodosOFX;

function ofxModalAtualizarCategorias() {
    const elTipo = document.getElementById('ofx-modal-tipo');
    const catSelect = document.getElementById('ofx-modal-categoria');
    if (!elTipo || !catSelect) return;
    const tipo = elTipo.value;
    const cats = tipo === 'RECEITA' ? (typeof categoriasReceber !== 'undefined' ? categoriasReceber : ['Outras Receitas']) : (typeof categoriasPagar !== 'undefined' ? categoriasPagar : ['Outras Despesas']);
    catSelect.innerHTML = cats.map(c => '<option value="' + c + '">' + c + '</option>').join('');
}

async function confirmarConciliacaoModalOFX() {
    if (typeof window.ofxItemAtualIdx === 'undefined' || window.ofxItemAtualIdx === null) return;
    const item = window.extratoOFXAtual.transacoes[window.ofxItemAtualIdx];
    const docMatch = item.matchDoc;
    // Se estivermos vinculando a um título já existente
    const modoVinculo = window.ofxModoAtual === 'VINCULAR';
    const isNovo = !modoVinculo || !docMatch || (item.statusMatch === 'SEM_MATCH');

    const tipo = document.getElementById('ofx-modal-tipo')?.value || 'DESPESA';
    const pessoa = document.getElementById('ofx-modal-pessoa')?.value.trim() || '';
    const categoria = document.getElementById('ofx-modal-categoria')?.value || '';
    const centroCusto = document.getElementById('ofx-modal-centro-custo')?.value || 'Operacional';
    const dataPgto = document.getElementById('ofx-modal-data-pgto')?.value;
    const valorPago = parseFloat(document.getElementById('ofx-modal-valor-pago')?.value);
    const metodo = document.getElementById('ofx-modal-metodo')?.value || '';
    const contaBancaria = document.getElementById('ofx-modal-conta-bancaria')?.value.trim() || '';
    const obs = document.getElementById('ofx-modal-obs')?.value || '';

    if (!pessoa) return showToast('Preencha o Favorecido.', 'error');
    if (!dataPgto) return showToast('Preencha a Data.', 'error');
    if (isNaN(valorPago) || valorPago <= 0) return showToast('Preencha um Valor válido.', 'error');

    const batch = firestore.batch();
    
    if (isNovo) {
        const finRef = firestore.collection('financeiro').doc();
        const novoDoc = {
            tipo: tipo,
            pessoa: pessoa,
            ref: 'OFX: ' + (item.memo || 'Lançamento'),
            categoria: categoria,
            centroCusto: centroCusto,
            contaBancaria: contaBancaria,
            valor: valorPago,
            valorPago: valorPago,
            status: 'PAGO',
            data: new Date(dataPgto + 'T12:00:00').toISOString(),
            dataPagamento: new Date(dataPgto + 'T12:00:00').toISOString(),
            metodoPagamento: metodo,
            fitid: item.fitid || '',
            observacao: obs,
            ultimaAlteracao: Date.now()
        };
        batch.set(finRef, novoDoc);
        item.matchDoc = { id: finRef.id, ...novoDoc };
    } else {
        const finRef = firestore.collection('financeiro').doc(String(docMatch.id));
        batch.update(finRef, {
            pessoa: pessoa,
            categoria: categoria,
            centroCusto: centroCusto,
            status: 'PAGO',
            valorPago: valorPago,
            metodoPagamento: metodo,
            contaBancaria: contaBancaria,
            dataPagamento: new Date(dataPgto + 'T12:00:00').toISOString(),
            fitid: item.fitid || '',
            observacao: obs,
            ultimaAlteracao: Date.now()
        });
    }

    try {
        await batch.commit();
        item.conciliadoSucesso = true;
        item.statusMatch = 'JA_CONCILIADO';
        fecharModalConciliacaoOFX();
        renderConciliacaoOFX();
        showToast(isNovo ? 'Criado e conciliado!' : 'Conciliado!', 'success');
    } catch (e) {
        showToast('Erro ao gravar.', 'error');
    }
}

window.ofxAlternarModo = ofxAlternarModo;
window.ofxRenderizarTitulosPendentes = ofxRenderizarTitulosPendentes;
window.ofxFiltrarTitulosPendentes = ofxFiltrarTitulosPendentes;
window.ofxSelecionarTituloVinculado = ofxSelecionarTituloVinculado;
window.ofxDesvincularTitulo = ofxDesvincularTitulo;

window.abrirModalConciliacaoOFX = abrirModalConciliacaoOFX;
window.fecharModalConciliacaoOFX = fecharModalConciliacaoOFX;
window.ofxModalAtualizarCategorias = ofxModalAtualizarCategorias;
window.confirmarConciliacaoModalOFX = confirmarConciliacaoModalOFX;

window.mudarVisualizacaoFin = mudarVisualizacaoFin;
window.renderFinAbas = renderFinAbas;
