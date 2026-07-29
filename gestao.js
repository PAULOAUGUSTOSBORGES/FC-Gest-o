// ==========================================
// GESTÃO.JS - ERP FINANCEIRO, DASHBOARD E PROJEÇÕES
// ==========================================

let acaoConfirmacaoPendente = null;
window.tempXMLData = null; 
window.xmlItemEditIndex = null;

const categoriasPagar = ['Fornecedores / Compras', 'Impostos (DAS, ICMS, etc)', 'Salários / Folha', 'Aluguel', 'Água', 'Energia', 'Internet / Telefonia', 'Contabilidade', 'Sistema / Software', 'IPTU', 'Outras Despesas'];
const categoriasReceber = ['Vendas', 'Serviços', 'Outras Receitas'];

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
        btn.classList.add('text-slate-300'); 
    });
    
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`); 
    if (activeBtn) { 
        activeBtn.classList.remove('text-slate-300'); 
        activeBtn.classList.add('bg-blue-600', 'text-white'); 
    }
    
    if (window.innerWidth < 768) { 
        const sidebar = document.getElementById('sidebar'); 
        if (sidebar) sidebar.classList.add('-translate-x-full'); 
        const overlay = document.getElementById('sidebar-overlay'); 
        if (overlay) overlay.classList.add('hidden'); 
    }
    
    if (viewId === 'financeiro') {
        renderFinAbas('caixa');
        atualizarCardsFluxoDeCaixa(); 
    }
    if (viewId === 'relatorios') renderDashboard();
    if (viewId === 'compras') renderComprasHist();
}

function inicializarGestao() {
    const urlParams = new URLSearchParams(window.location.search);
    let view = urlParams.get('view');
    if (!view) view = 'financeiro';
    mudarVisaoLocal(view);
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
// 2. FUNÇÕES GENÉRICAS
// ==========================================
function abrirConfirmacao(titulo, mensagem, acao) { document.getElementById('modal-confirm-title').innerText = titulo; document.getElementById('modal-confirm-msg').innerText = mensagem; acaoConfirmacaoPendente = acao; document.getElementById('modal-confirmacao').classList.remove('hidden'); document.getElementById('modal-confirm-btn').onclick = function() { if(acaoConfirmacaoPendente) acaoConfirmacaoPendente(); fecharModalConfirmacao(); }; }
function fecharModalConfirmacao() { document.getElementById('modal-confirmacao').classList.add('hidden'); acaoConfirmacaoPendente = null; document.getElementById('modal-confirm-btn').onclick = null; }

function imprimirArea(areaId) {
    const printContent = document.getElementById(areaId).innerHTML; const style = document.createElement('style'); style.id = 'print-style-temp';
    style.innerHTML = `@media print { body > :not(#print-temp) { display: none !important; } #print-temp { display: block !important; position: absolute; left: 0; top: 0; width: 100%; background: #fff; color: #000; padding: 20px; z-index: 99999; } .print\\:hidden { display: none !important; } @page { size: auto; margin: 10mm; } }`;
    document.head.appendChild(style); const printDiv = document.createElement('div'); printDiv.id = 'print-temp';
    printDiv.innerHTML = `<h2 style="font-size: 22px; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">Relatório Oficial do Sistema</h2>` + printContent;
    document.body.appendChild(printDiv); window.print(); setTimeout(() => { printDiv.remove(); style.remove(); }, 1000);
}

function exportarExcel(tabelaId, filename) {
    let table = document.getElementById(tabelaId); if(!table) return showToast('Tabela não encontrada.', 'error');
    let rows = table.querySelectorAll('tr'); let csv = [];
    for (let i = 0; i < rows.length; i++) { let row = [], cols = rows[i].querySelectorAll('td:not(.print\\:hidden), th:not(.print\\:hidden)'); for (let j = 0; j < cols.length; j++) { row.push('"' + cols[j].innerText.replace(/"/g, '""').trim() + '"'); } csv.push(row.join(';')); }
    let csvFile = new Blob(["\uFEFF"+csv.join('\n')], {type: 'text/csv;charset=utf-8;'});
    let link = document.createElement("a"); link.href = window.URL.createObjectURL(csvFile); link.setAttribute("download", filename + "_" + Date.now() + ".csv");
    document.body.appendChild(link); link.click(); showToast('Excel exportado!', 'success');
}

function baixarPDF(areaId, filename) {
    const element = document.getElementById(areaId); const opt = { margin: 10, filename: filename + '_' + Date.now() + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
    const hideElements = element.querySelectorAll('.print\\:hidden'); hideElements.forEach(el => el.style.display = 'none');
    html2pdf().set(opt).from(element).save().then(() => { hideElements.forEach(el => el.style.display = ''); showToast('PDF Gerado!', 'success'); });
}

function salvarKardex(ref, prodId, prodNome, qtd, tipo) { db.movimentacoes.unshift({ id: Date.now() + Math.random(), data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo }); }

// ==========================================
// 3. FINANCEIRO E CAIXA FÍSICO
// ==========================================
function renderFinAbas(aba) {
    document.querySelectorAll('.fin-area').forEach(el => el.classList.add('hidden')); document.querySelectorAll('[id^="fin-tab-"]').forEach(el => { el.classList.remove('bg-blue-600', 'text-white'); el.classList.add('text-slate-600'); });
    document.getElementById(`fin-area-${aba}`).classList.remove('hidden'); document.getElementById(`fin-tab-${aba}`).classList.remove('text-slate-600'); document.getElementById(`fin-tab-${aba}`).classList.add('bg-blue-600', 'text-white');
    if(aba === 'caixa') renderCaixaDiario(); if(aba === 'receber') renderTitulos('RECEITA'); if(aba === 'pagar') renderTitulos('DESPESA');
    atualizarCardsFluxoDeCaixa();
}

function renderCaixaDiario() {
    document.getElementById('caixa-saldo-display').innerText = formatMoney(db.caixa.saldo); const b = document.getElementById('caixa-status-badge');
    if(db.caixa.status === 'ABERTO') { b.innerText = 'ABERTO'; b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-emerald-100 text-emerald-700 border border-emerald-300'; } else { b.innerText = 'FECHADO'; b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-red-100 text-red-700 border border-red-300'; }
    const hoje = new Date().toISOString().split('T')[0]; const movs = db.caixa.historico.filter(m => m.data.startsWith(hoje));
    document.getElementById('tabela-caixa-historico').innerHTML = movs.map(m => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-3 text-slate-500 font-mono text-[10px]">${formatData(m.data).split(' ')[1]}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${m.tipo}</span></td><td class="p-3 text-slate-700 text-xs font-bold">${m.desc}</td><td class="p-3 text-right font-black ${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? 'text-emerald-500' : 'text-red-500'}">${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? '+ ' : '- '}${formatMoney(m.valor)}</td></tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500">Sem movimentos hoje no caixa físico.</td></tr>';
}

function abrirModalCaixa(op) {
    if(op === 'abrir' && db.caixa.status === 'ABERTO') return showToast('O caixa já está aberto!', 'error'); if(op !== 'abrir' && db.caixa.status === 'FECHADO') return showToast('Abra o caixa primeiro!', 'error');
    document.getElementById('caixa-operacao-tipo').value = op.toUpperCase(); document.getElementById('modal-caixa-title').innerText = op === 'abrir' ? 'Abertura de Caixa' : (op === 'fechar' ? 'Fechamento de Caixa' : (op === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'));
    document.getElementById('caixa-op-valor').value = ''; document.getElementById('caixa-op-desc').value = '';
    if(op === 'fechar') { document.getElementById('caixa-op-valor').value = db.caixa.saldo; document.getElementById('caixa-op-desc').value = 'Fechamento do dia'; } if(op === 'abrir') { document.getElementById('caixa-op-valor').value = 0; document.getElementById('caixa-op-desc').value = 'Troco Inicial'; }
    document.getElementById('modal-mov-caixa').classList.remove('hidden');
}
function fecharModalCaixa() { document.getElementById('modal-mov-caixa').classList.add('hidden'); }

function confirmarMovCaixa() {
    const op = document.getElementById('caixa-operacao-tipo').value; const val = parseFloat(document.getElementById('caixa-op-valor').value) || 0; const desc = document.getElementById('caixa-op-desc').value || op;
    if(op === 'ABRIR') { db.caixa.status = 'ABERTO'; db.caixa.saldo = val; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'ABERTURA', desc, valor: val }); }
    else if(op === 'FECHAR') { db.caixa.status = 'FECHADO'; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'FECHAMENTO', desc: `Fechamento (Retirado: ${formatMoney(val)})`, valor: val }); db.caixa.saldo -= val; }
    else if(op === 'SANGRIA') { if(val > db.caixa.saldo) return showToast('Saldo insuficiente para sangria!', 'error'); db.caixa.saldo -= val; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `SANGRIA: ${desc}`, valor: val }); }
    else if(op === 'SUPRIMENTO') { db.caixa.saldo += val; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `SUPRIMENTO: ${desc}`, valor: val }); }
    saveDB(); fecharModalCaixa(); renderCaixaDiario(); showToast('Operação realizada com sucesso!', 'success');
}

// ==========================================
// 4. CONTAS A PAGAR E RECEBER
// ==========================================
function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar'; 
    const statusFilter = document.getElementById(`filtro-${prefix}-status`).value; 
    const periodoFilter = document.getElementById(`filtro-${prefix}-periodo`) ? document.getElementById(`filtro-${prefix}-periodo`).value : 'TUDO';
    const termoBusca = document.getElementById(`busca-fin-${prefix}`).value.toLowerCase();
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    if (termoBusca) { 
        lista = lista.filter(f => (f.pessoa && f.pessoa.toLowerCase().includes(termoBusca)) || (f.ref && f.ref.toLowerCase().includes(termoBusca)) || (f.categoria && f.categoria.toLowerCase().includes(termoBusca)) || (f.numNF && f.numNF.includes(termoBusca))); 
    }
    
    if (statusFilter !== 'TODOS') { 
        if (statusFilter === 'ATRASADO') {
            lista = lista.filter(f => f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime());
        } else {
            lista = lista.filter(f => f.status === statusFilter); 
        }
    }

    if (periodoFilter !== 'TUDO') {
        const hoje = new Date().getTime();
        const limiteFuturo = hoje + (parseInt(periodoFilter) * 24 * 60 * 60 * 1000);
        lista = lista.filter(f => new Date(f.data).getTime() <= limiteFuturo);
    }
    
    lista.sort((a, b) => new Date(a.data) - new Date(b.data));
    
    document.getElementById(`tabela-fin-${prefix}`).innerHTML = lista.map(f => {
        const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime(); 
        let corStatus = 'bg-amber-100 text-amber-700';
        let badgeStatus = 'PENDENTE';
        
        if (f.status === 'PAGO') { corStatus = 'bg-emerald-100 text-emerald-700'; badgeStatus = 'PAGO'; }
        else if (f.status === 'CANCELADO') { corStatus = 'bg-slate-200 text-slate-600'; badgeStatus = 'CANCELADO'; }
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
                <button onclick="abrirModalBaixa(${f.id})" class="text-blue-600 bg-blue-50 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 ml-1">Baixar</button>
                <button onclick="abrirModalRenegociacao(${f.id})" class="text-purple-600 hover:text-purple-800 p-1.5 ml-1 print:hidden" title="Renegociar / Parcelar"><i class="fa-solid fa-handshake"></i></button>
            `;
        } else if (f.status === 'PAGO') {
            acoesExtras = `<button onclick="estornarTitulo(${f.id})" class="text-amber-500 hover:text-amber-700 p-1.5 ml-1 print:hidden" title="Estornar Pagamento"><i class="fa-solid fa-rotate-left"></i></button>`;
        }

        return `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
            <td class="p-3 text-slate-500 font-mono text-xs">${formatData(f.data).split(' ')[0]}</td>
            <td class="p-3 font-bold text-slate-800 truncate max-w-[200px]">${f.pessoa}</td>
            <td class="p-3 text-slate-600 text-[11px]">${f.categoria || '-'} <br><span class="font-bold">${f.ref}</span></td>
            <td class="p-3 text-right font-black ${tipo === 'RECEITA' ? 'text-blue-600' : 'text-red-500'}">${formatMoney(valorAExibir)}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${corStatus}">${badgeStatus}</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-1 print:hidden">
                <button onclick="verDetalhesTitulo(${f.id})" class="text-blue-500 hover:text-blue-700 p-1.5" title="Detalhes do Título"><i class="fa-solid fa-eye"></i></button>
                <button onclick="abrirModalContaEdicao(${f.id})" class="text-indigo-500 hover:text-indigo-700 p-1.5" title="Editar Lançamento"><i class="fa-solid fa-pen"></i></button>
                ${btnWhats}
                ${acoesExtras}
                <button onclick="excluirTitulo(${f.id})" class="text-slate-400 hover:text-red-500 p-1.5 ml-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="6" class="p-6 text-center text-slate-500">Nenhum título encontrado.</td></tr>`;
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
    
    ['pessoa','ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','data-pgto','obs','anexo-base64'].forEach(id => {
        const el = document.getElementById(`conta-${id}`);
        if(el) el.value = '';
    });
    
    // Libera a recorrência
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
    document.getElementById('modal-conta-header').className = `p-4 md:p-5 text-white flex justify-between items-center shrink-0 bg-indigo-600`; 
    document.getElementById('modal-conta-title').innerText = 'Editar Lançamento Financeiro';
    
    // Trava a recorrência na edição para evitar bagunça
    document.getElementById('conta-recorrencia').value = 'UNICA';
    document.getElementById('conta-recorrencia').disabled = true;
    toggleRecorrencia();

    document.getElementById('conta-pessoa').value = f.pessoa || '';
    document.getElementById('conta-ref').value = f.ref || '';
    document.getElementById('conta-categoria').value = f.categoria || (tipo === 'RECEBER' ? 'Vendas' : 'Outras Despesas');
    document.getElementById('conta-centro-custo').value = f.centroCusto || 'Geral';
    document.getElementById('conta-banco').value = f.contaBancaria || 'Caixa Físico';
    
    document.getElementById('conta-emissao').value = f.dataEmissao || '';
    document.getElementById('conta-vencimento').value = f.data ? f.data.split('T')[0] : '';
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
    const pessoa = document.getElementById('conta-pessoa').value.trim(); 
    const valorOriginal = parseFloat(document.getElementById('conta-valor').value); 
    const vencBase = document.getElementById('conta-vencimento').value;
    
    if(!pessoa || isNaN(valorOriginal) || !vencBase) return showToast('Preencha Favorecido, Vencimento e Valor!', 'error'); 
    
    const valorFin = calcularValorFinalFormulario();
    
    // Lógica da Recorrência
    const recorrencia = document.getElementById('conta-recorrencia').value;
    const isEdicao = !!idExistente;
    const qtdLançamentos = (recorrencia === 'UNICA' || isEdicao) ? 1 : (parseInt(document.getElementById('conta-qtd-recorrencia').value) || 1);
    const refBase = document.getElementById('conta-ref').value || 'Avulso';

    let contasGeradas = 0;

    for(let i = 0; i < qtdLançamentos; i++) {
        
        let dataVenc = new Date(vencBase + 'T12:00:00');
        
        // Calcula os pulos de datas para as assinaturas
        if (recorrencia === 'MENSAL') dataVenc.setMonth(dataVenc.getMonth() + i);
        if (recorrencia === 'ANUAL') dataVenc.setFullYear(dataVenc.getFullYear() + i);
        if (recorrencia === 'SEMANAL') dataVenc.setDate(dataVenc.getDate() + (i * 7));
        if (recorrencia === 'QUINZENAL') dataVenc.setDate(dataVenc.getDate() + (i * 15));

        let refFinal = refBase;
        if (qtdLançamentos > 1) refFinal += ` (${i+1}/${qtdLançamentos})`;

        const contaObj = {
            id: isEdicao ? parseInt(idExistente) : Date.now() + i,
            tipo: tipo, 
            pessoa: pessoa, 
            ref: refFinal, 
            categoria: document.getElementById('conta-categoria').value,
            centroCusto: document.getElementById('conta-centro-custo').value,
            contaBancaria: document.getElementById('conta-banco').value,
            dataEmissao: document.getElementById('conta-emissao').value,
            data: dataVenc.toISOString(), // Salva a data calculada da recorrência
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
            const index = db.financeiro.findIndex(f => f.id === parseInt(idExistente));
            if (index > -1) db.financeiro[index] = contaObj;
        } else {
            db.financeiro.unshift(contaObj);
            contasGeradas++;
        }
    }

    saveDB(); 
    fecharModalConta(); 
    renderFinAbas(tipo === 'RECEITA' ? 'receber' : 'pagar'); 
    
    if (isEdicao) {
        showToast('Título Atualizado!', 'success');
    } else {
        if (qtdLançamentos > 1) showToast(`${contasGeradas} Títulos de Assinatura gerados com sucesso!`, 'success');
        else showToast('Título Salvo!', 'success');
    }
}

function excluirTitulo(id) { 
    abrirConfirmacao('Excluir Título', 'Deseja apagar permanentemente?', () => { 
        const tit = db.financeiro.find(f => f.id === id); 
        db.financeiro = db.financeiro.filter(f => f.id !== id); 
        saveDB(); 
        if(tit) renderFinAbas(tit.tipo === 'RECEITA' ? 'receber' : 'pagar'); 
        showToast('Excluído!'); 
    }); 
}

// ==========================================
// 6. ESTORNO E RENEGOCIAÇÃO
// ==========================================
function estornarTitulo(id) {
    const f = db.financeiro.find(x => x.id === id);
    if (!f || f.status !== 'PAGO') return;

    abrirConfirmacao('Estornar Pagamento', 'Isto voltará o título para PENDENTE e reverterá o saldo do caixa (se pago em dinheiro). Confirma?', () => {
        
        if (f.metodoPagamento === 'Dinheiro') {
            if (f.tipo === 'RECEITA') {
                db.caixa.saldo -= f.valorPago;
                db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno Recbto: ${f.pessoa}`, valor: f.valorPago });
            } else {
                db.caixa.saldo += f.valorPago;
                db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `Estorno Pgto: ${f.pessoa}`, valor: f.valorPago });
            }
        }
        
        f.status = 'PENDENTE';
        f.dataPagamento = '';
        f.metodoPagamento = '';
        f.ultimaAlteracao = Date.now();

        saveDB();
        renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar'); 
        showToast('Pagamento Estornado!', 'success');
    });
}

function abrirModalRenegociacao(id) {
    const f = db.financeiro.find(x => x.id === id);
    if (!f) return;
    
    document.getElementById('reneg-id').value = f.id;
    document.getElementById('reneg-valor').innerText = formatMoney(f.valor);
    
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 30);
    document.getElementById('reneg-data').value = hoje.toISOString().split('T')[0];
    
    document.getElementById('modal-renegociacao').classList.remove('hidden');
}

function fecharModalRenegociacao() {
    document.getElementById('modal-renegociacao').classList.add('hidden');
}

function confirmarRenegociacao() {
    const id = parseInt(document.getElementById('reneg-id').value);
    const fOriginal = db.financeiro.find(x => x.id === id);
    if (!fOriginal) return;

    const qtdParcelas = parseInt(document.getElementById('reneg-qtd').value);
    const dataInicialStr = document.getElementById('reneg-data').value;
    if (!dataInicialStr || isNaN(qtdParcelas)) return showToast('Preencha os dados da renegociação.', 'error');

    const valorPorParcela = fOriginal.valor / qtdParcelas;
    const dataInicial = new Date(dataInicialStr + 'T12:00:00');

    fOriginal.status = 'RENEGOCIADO';
    fOriginal.observacao = (fOriginal.observacao || '') + `\nRenegociado em ${qtdParcelas}x no dia ${new Date().toLocaleDateString('pt-BR')}.`;

    for (let i = 0; i < qtdParcelas; i++) {
        let novaData = new Date(dataInicial);
        novaData.setMonth(novaData.getMonth() + i);
        
        db.financeiro.unshift({
            id: Date.now() + i,
            tipo: fOriginal.tipo,
            pessoa: fOriginal.pessoa,
            ref: `${fOriginal.ref} (Reneg. ${i+1}/${qtdParcelas})`,
            categoria: fOriginal.categoria,
            data: novaData.toISOString(),
            valor: valorPorParcela,
            status: 'PENDENTE'
        });
    }

    saveDB();
    fecharModalRenegociacao();
    renderFinAbas(fOriginal.tipo === 'RECEITA' ? 'receber' : 'pagar');
    showToast(`Dívida renegociada em ${qtdParcelas}x com sucesso!`, 'success');
}

// ==========================================
// 7. MODAL DE DETALHES E BAIXA RÁPIDA
// ==========================================
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
function calcularAcrescimos() { const id = parseInt(document.getElementById('baixa-id').value); const f = db.financeiro.find(x => x.id === id); if(!f) return; const ac = parseFloat(document.getElementById('baixa-acrescimo').value) || 0; const de = parseFloat(document.getElementById('baixa-desconto').value) || 0; const vf = f.valor + ac - de; document.getElementById('baixa-valor-final').innerText = formatMoney(vf); return vf; }

function confirmarBaixa() {
    const id = parseInt(document.getElementById('baixa-id').value); const f = db.financeiro.find(x => x.id === id); if(!f) return;
    const vf = calcularAcrescimos(); const metodo = document.getElementById('baixa-metodo').value;
    if(metodo === 'Dinheiro') {
        if(db.caixa.status !== 'ABERTO') return showToast('Abra o Caixa Físico primeiro!', 'error');
        if(f.tipo === 'RECEITA') { db.caixa.saldo += vf; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `Recbto. Título: ${f.pessoa}`, valor: vf }); } 
        else { if(vf > db.caixa.saldo) return showToast('Saldo do Caixa insuficiente!', 'error'); db.caixa.saldo -= vf; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Pgto. Título: ${f.pessoa}`, valor: vf }); }
    }
    f.status = 'PAGO'; f.valorPago = vf; f.metodoPagamento = metodo; f.dataPagamento = new Date().toISOString(); f.ultimaAlteracao = Date.now();
    saveDB(); fecharModalBaixa(); renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Baixa realizada com sucesso!', 'success');
}

// ==========================================
// 8. COMPRAS E LEITURA DE XML / CT-E
// ==========================================
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
            if (vTPrestNode) valorFrete = parseFloat(vTPrestNode.textContent);
            else if (vRecNode) valorFrete = parseFloat(vRecNode.textContent);
            
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
        <div class="flex flex-col sm:flex-row gap-2 items-center bg-white p-2 rounded-lg border border-amber-200 shadow-sm">
            <input type="text" class="w-full sm:w-1/2 bg-transparent text-xs font-bold text-amber-900 outline-none p-1" value="${f.desc}" onchange="atualizarParcelaXML(${i}, 'desc', this.value)">
            <input type="date" class="w-full sm:w-auto bg-transparent text-xs text-amber-800 font-bold outline-none p-1" value="${f.venc}" onchange="atualizarParcelaXML(${i}, 'venc', this.value)">
            <input type="number" step="0.01" class="w-full sm:w-24 text-right bg-transparent text-sm font-black text-red-600 outline-none p-1" value="${f.valor.toFixed(2)}" onchange="atualizarParcelaXML(${i}, 'valor', this.value)">
            <button onclick="removeParcelaXML(${i})" class="text-red-400 hover:text-red-600 p-1"><i class="fa-solid fa-trash"></i></button>
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
        <tr class="border-b border-slate-100 hover:bg-indigo-50">
            <td class="p-2 text-xs"><input type="text" class="w-full bg-transparent font-bold text-slate-800 outline-none" value="${p.nome}" onchange="tempXMLData.produtosXML[${idx}].nome = this.value"><span class="text-[10px] text-slate-500">EAN: ${p.cEAN || 'S/N'}</span></td>
            <td class="p-2 text-xs text-center"><span class="${p.statusDB.includes('NOVO') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded font-bold">${p.statusDB}</span></td>
            <td class="p-2 text-xs text-center font-bold">${p.qCom}</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-20 bg-white border border-slate-300 rounded p-1 text-right font-bold text-red-600 outline-none" value="${p.custoFinal.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'custo', this.value)"></td>
            <td class="p-2 text-xs text-center"><input type="number" step="0.1" class="w-16 bg-white border border-slate-300 rounded p-1 text-center font-bold text-blue-600 outline-none" value="${p.margemAtual.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'margem', this.value)"> %</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-24 bg-white border border-slate-300 rounded p-1 text-right font-bold text-emerald-600 outline-none" value="${p.precoVendaSug.toFixed(2)}" onchange="xmlAtualizarValores(${idx}, 'preco', this.value)"></td>
            <td class="p-2 text-xs text-center"><button onclick="abrirModalProdutoDoXML(${idx})" class="text-indigo-500 bg-indigo-100 p-1.5 rounded"><i class="fa-solid fa-pen-to-square"></i></button></td>
        </tr>`).join('');
}

function abrirModalProdutoDoXML(index) {
    const p = window.tempXMLData.produtosXML[index]; window.xmlItemEditIndex = index; document.getElementById('modal-produto').classList.remove('hidden');
    if(p.statusDB === 'ATUALIZAR' && p.idMatch) { document.getElementById('prod-id').value = p.idMatch; document.getElementById('modal-produto-title').innerText = 'Atualizar Custo Produto'; document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); } 
    else { document.getElementById('prod-id').value = ''; document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); }
}

function fecharModalProduto() { document.getElementById('modal-produto').classList.add('hidden'); }

function salvarProdutoXmlModal() {
    const nome = document.getElementById('prod-nome').value; const id = document.getElementById('prod-id').value;
    const pXML = window.tempXMLData.produtosXML[window.xmlItemEditIndex];
    if(!nome) return showToast('Nome obrigatório', 'error');
    pXML.nome = nome; pXML.cEAN = document.getElementById('prod-ean').value;
    pXML.custoFinal = parseFloat(document.getElementById('prod-custo').value)||0; pXML.margemAtual = parseFloat(document.getElementById('prod-margem').value)||0; pXML.precoVendaSug = parseFloat(document.getElementById('prod-preco').value)||0;
    if(!id) { pXML.statusDB = 'NOVO CADASTRADO'; }
    fecharModalProduto(); renderTelaConferenciaXML(); showToast('Ficha salva para a importação!');
}

function renderTelaConferenciaXML() {
    const d = window.tempXMLData; 
    document.getElementById('xml-forn-nome').innerText = d.fornNome; 
    document.getElementById('xml-forn-cnpj').innerText = d.fornCNPJ; 
    document.getElementById('xml-total-nota').innerText = formatMoney(d.totalNF);
    document.getElementById('rev-nfe').innerText = d.numNF;
    document.getElementById('rev-data').innerText = d.dataEmissao.split('-').reverse().join('/');
    document.getElementById('rev-vprod').innerText = formatMoney(d.produtosXML.reduce((a,b)=>a+b.vTotalItemNaNota,0));
    
    document.getElementById('xml-produtos-body').innerHTML = d.produtosXML.map((p, i) => `
        <tr class="border-b border-slate-100 hover:bg-indigo-50">
            <td class="p-2 text-xs"><input type="text" class="w-full bg-transparent font-bold text-slate-800 outline-none" value="${p.nome}" onchange="tempXMLData.produtosXML[${i}].nome = this.value"><span class="text-[10px] text-slate-500">EAN: ${p.cEAN || 'S/N'}</span></td>
            <td class="p-2 text-xs text-center"><span class="${p.statusDB.includes('NOVO') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded font-bold">${p.statusDB}</span></td>
            <td class="p-2 text-xs text-center font-bold">${p.qCom}</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-20 bg-white border border-slate-300 rounded p-1 text-right font-bold text-red-600 outline-none" value="${p.custoFinal.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'custo', this.value)"></td>
            <td class="p-2 text-xs text-center"><input type="number" step="0.1" class="w-16 bg-white border border-slate-300 rounded p-1 text-center font-bold text-blue-600 outline-none" value="${p.margemAtual.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'margem', this.value)"> %</td>
            <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-24 bg-white border border-slate-300 rounded p-1 text-right font-bold text-emerald-600 outline-none" value="${p.precoVendaSug.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'preco', this.value)"></td>
            <td class="p-2 text-xs text-center"><button onclick="abrirModalProdutoDoXML(${i})" class="text-indigo-500 bg-indigo-100 p-1.5 rounded"><i class="fa-solid fa-pen-to-square"></i></button></td>
        </tr>`).join('');
        
    renderXMLFinanceiro(); 
}

function fecharModalXML() { document.getElementById('modal-conferencia-xml').classList.add('hidden'); window.tempXMLData = null; }

function salvarXMLConferido() {
    const data = window.tempXMLData; let totalQtd = 0;
    let forn = db.fornecedores.find(f => f.doc === data.fornCNPJ || f.cnpj === data.fornCNPJ);
    if(!forn) { db.fornecedores.push({ id: Date.now(), nome: data.fornNome, doc: data.fornCNPJ, cnpj: data.fornCNPJ, ie: '', wpp: '', email: '', contato: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', condicoes: '', produtos: '' }); }
    
    data.produtosXML.forEach(p => {
        let idProd = p.idMatch;
        if ((p.statusDB === 'NOVO' || p.statusDB.includes('CADASTRADO')) && !idProd) {
            idProd = Date.now() + Math.floor(Math.random() * 1000);
            db.produtos.push({ id: idProd, ean: p.cEAN, nome: p.nome, categoria: 'Geral', marca: data.fornNome, custo: p.custoFinal, margem: p.margemAtual, preco: p.precoVendaSug, estoque: p.qCom, min: 5, foto: '', ativo: true });
        } else { 
            let pDB = db.produtos.find(x => x.id === idProd); 
            if (pDB) { pDB.estoque += p.qCom; pDB.custo = p.custoFinal; pDB.margem = p.margemAtual; pDB.preco = p.precoVendaSug; pDB.nome = p.nome; pDB.ativo = true; } 
        }
        totalQtd += p.qCom; salvarKardex(`NF-e ${data.numNF} ${data.fornNome}`, idProd, p.nome, p.qCom, 'ENTRADA XML');
    });

    db.compras.unshift({ id: Date.now(), numeroNF: data.numNF, data: new Date().toISOString(), fornecedor: data.fornNome, cnpj: data.fornCNPJ, totalNF: data.totalNF + data.freteExtra, qtdTotal: totalQtd, itens: data.produtosXML });
    
    // Lançamento dos boletos revisados/adicionados no contas a pagar
    data.financeiroXML.forEach((f, idx) => {
        if(f.valor > 0) {
            db.financeiro.unshift({ 
                id: Date.now() + 1 + idx, 
                ref: f.desc, 
                data: new Date(f.venc + 'T12:00:00').toISOString(), 
                pessoa: data.fornNome, 
                wpp: '', 
                valor: f.valor, 
                status: 'PENDENTE', 
                tipo: 'DESPESA', 
                categoria: 'Fornecedores / Compras' 
            });
        }
    });

    saveDB(); fecharModalXML(); renderComprasHist(); renderFinAbas('pagar'); showToast('Entrada de XML Concluída!', 'success');
}

function renderComprasHist() {
    if(!db.compras) db.compras = [];
    document.getElementById('tabela-compras-hist').innerHTML = db.compras.slice(0,20).map(c => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-4 text-xs">${formatData(c.data).split(' ')[0]}</td><td class="p-4 font-bold text-slate-800">${c.fornecedor}</td><td class="p-4 text-right font-bold text-indigo-600">${formatMoney(c.totalNF)}</td><td class="p-4 text-center flex items-center justify-center gap-2"><button onclick="verDetalhesNF(${c.id})" class="text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg font-bold text-xs"><i class="fa-solid fa-eye"></i></button><button onclick="excluirNF(${c.id})" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500">Nenhuma Nota Fiscal.</td></tr>';
}
function excluirNF(id) { abrirConfirmacao('Excluir Nota', 'Atenção: Não reverte o estoque nem o financeiro.', () => { db.compras = db.compras.filter(c => c.id !== id); saveDB(); renderComprasHist(); showToast('Nota excluída!'); }); }
function verDetalhesNF(id) { const c = db.compras.find(x => x.id === id); if(!c) return; document.getElementById('det-nf-fornecedor').innerText = c.fornecedor; document.getElementById('det-nf-data').innerText = formatData(c.data); document.getElementById('det-nf-total').innerText = formatMoney(c.totalNF); document.getElementById('det-nf-itens').innerHTML = c.itens.map(i => `<tr class="border-b border-slate-100"><td class="p-3 text-xs">${i.nome}</td><td class="p-3 text-xs text-center font-bold">${i.qCom}</td><td class="p-3 text-xs text-right font-bold text-emerald-600">${formatMoney(i.custoFinal)}</td></tr>`).join(''); document.getElementById('modal-detalhes-nf').classList.remove('hidden'); }
function fecharModalDetalhesNF() { document.getElementById('modal-detalhes-nf').classList.add('hidden'); }

// ==========================================
// 9. RELATÓRIOS E DRE
// ==========================================
function renderDashboard() {
    const vendas = db.vendas || [];
    const fatTotal = vendas.reduce((a, b) => a + b.tot, 0); const cmvTotal = vendas.reduce((a, b) => a + (b.custoTotal || 0), 0); const taxasTotal = vendas.reduce((a, b) => a + (b.taxaValor || 0), 0); const lucroReal = fatTotal - cmvTotal - taxasTotal;
    
    document.getElementById('bi-receita').innerText = formatMoney(fatTotal); document.getElementById('bi-cmv').innerText = `- ${formatMoney(cmvTotal)}`; if(document.getElementById('bi-taxas')) document.getElementById('bi-taxas').innerText = `- ${formatMoney(taxasTotal)}`; document.getElementById('bi-lucro').innerText = formatMoney(lucroReal);
    const rankingProd = {}; vendas.forEach(v => v.itens.forEach(i => { if(!rankingProd[i.nome]) rankingProd[i.nome] = 0; rankingProd[i.nome] += (i.preco * i.qtd); }));
    document.getElementById('bi-abc-produtos').innerHTML = Object.keys(rankingProd).map(k => ({nome: k, val: rankingProd[k]})).sort((a,b) => b.val - a.val).slice(0,5).map((p, i) => `<div class="flex justify-between text-sm border-b pb-1"><span class="truncate pr-2">${i+1}. ${p.nome}</span><span class="font-bold text-emerald-600">${formatMoney(p.val)}</span></div>`).join('');
    const comissoes = {}; vendas.forEach(v => { const vend = v.vendedor || 'Desconhecido'; if(!comissoes[vend]) comissoes[vend] = 0; comissoes[vend] += v.tot; });
    document.getElementById('bi-comissoes').innerHTML = Object.keys(comissoes).map(v => `<div class="flex justify-between text-sm border-b pb-1"><span>${v}</span><span class="font-bold text-purple-600">${formatMoney(comissoes[v] * 0.05)}</span></div>`).join('');
    const rankingCli = {}; vendas.forEach(v => { const c = v.clienteNome || 'Consumidor'; if(!rankingCli[c]) rankingCli[c] = 0; rankingCli[c] += v.tot; });
    document.getElementById('bi-top-clientes').innerHTML = Object.keys(rankingCli).map(k => ({nome: k, val: rankingCli[k]})).sort((a,b) => b.val - a.val).slice(0,5).map((c, i) => `<div class="flex justify-between text-sm border-b pb-1"><span class="truncate pr-2">${i+1}. ${c.nome}</span><span class="font-bold text-blue-600">${formatMoney(c.val)}</span></div>`).join('');
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
    if (!db) {
        showToast("Nenhum dado financeiro carregado.", "error");
        return;
    }

    const vendas = db.vendas || [];
    const financeiro = db.financeiro || [];
    const produtos = db.produtos || [];

    let receitaBruta = vendas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    let custoTotal = vendas.reduce((acc, v) => {
        return acc + (v.itens || []).reduce((subAcc, item) => {
            const prod = produtos.find(p => p.id === item.id || p.nome === item.nome);
            const custoUnit = prod ? (Number(prod.custo) || 0) : 0;
            return subAcc + (custoUnit * (Number(item.quantidade) || 1));
        }, 0);
    }, 0);

    let lucroBruto = receitaBruta - custoTotal;

    let relatorioTexto = `=== RELATÓRIO FINANCEIRO E DE GESTÃO - FC MÓVEIS ===\n`;
    relatorioTexto += `Data da exportação: ${new Date().toLocaleString('pt-BR')}\n\n`;
    
    relatorioTexto += `--- 1. DRE SIMPLIFICADA ---\n`;
    relatorioTexto += `- Receita Bruta Total: R$ ${receitaBruta.toFixed(2)}\n`;
    relatorioTexto += `- Custo da Mercadoria Vendida (CMV): R$ ${custoTotal.toFixed(2)}\n`;
    relatorioTexto += `- Lucro Bruto Real: R$ ${lucroBruto.toFixed(2)}\n\n`;

    relatorioTexto += `--- 2. HISTÓRICO DE VENDAS RECENTES ---\n`;
    vendas.slice(-20).forEach((v, index) => {
        relatorioTexto += `[Venda ${index + 1}] Data: ${v.data || 'N/A'} | Total: R$ ${Number(v.total || 0).toFixed(2)} | Forma de Pagamento: ${v.pagamento || 'N/A'}\n`;
    });

    relatorioTexto += `\n--- 3. MOVIMENTAÇÕES FINANCEIRAS / CAIXA ---\n`;
    financeiro.slice(-20).forEach((f, index) => {
        relatorioTexto += `[Movimento ${index + 1}] Tipo: ${f.tipo || 'N/A'} | Descrição: ${f.descricao || 'N/A'} | Valor: R$ ${Number(f.valor || 0).toFixed(2)} | Data: ${f.data || 'N/A'}\n`;
    });

    const blob = new Blob([relatorioTexto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo_financeiro_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Relatório baixado com sucesso! Basta enviar para a IA.", "success");
}