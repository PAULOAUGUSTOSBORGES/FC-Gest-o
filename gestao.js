// gestao.js - Lógica Financeiro, XML e Relatórios

let acaoConfirmacaoPendente = null;
window.tempXMLData = null; 
window.xmlItemEditIndex = null;
const categoriasPagar = ['Fornecedores', 'Funcionários', 'Impostos', 'Aluguel', 'Água', 'Energia', 'Outras Despesas'];
const categoriasReceber = ['Vendas', 'Serviços', 'Outras Receitas'];

function mudarVisaoLocal(viewId) {
    document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('active'); });
    document.getElementById(`view-${viewId}`).classList.remove('hidden'); document.getElementById(`view-${viewId}`).classList.add('active');
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('text-slate-300'); });
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`); if(activeBtn) { activeBtn.classList.remove('text-slate-300'); activeBtn.classList.add('bg-blue-600', 'text-white'); }
    if (window.innerWidth < 768) { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); }
    
    if(viewId === 'financeiro') renderFinAbas('caixa');
    if(viewId === 'relatorios') renderDashboard();
    if(viewId === 'compras') renderComprasHist();
}

function inicializarGestao() {
    renderFinAbas('caixa');
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if(view) mudarVisaoLocal(view);
}

window.onload = () => { initGlobalData(inicializarGestao); };

// Funções Genéricas de UI (Impressão, Confirmação)
function abrirConfirmacao(titulo, mensagem, acao) { document.getElementById('modal-confirm-title').innerText = titulo; document.getElementById('modal-confirm-msg').innerText = mensagem; acaoConfirmacaoPendente = acao; document.getElementById('modal-confirmacao').classList.remove('hidden'); document.getElementById('modal-confirm-btn').onclick = function() { if(acaoConfirmacaoPendente) acaoConfirmacaoPendente(); fecharModalConfirmacao(); }; }
function fecharModalConfirmacao() { document.getElementById('modal-confirmacao').classList.add('hidden'); acaoConfirmacaoPendente = null; document.getElementById('modal-confirm-btn').onclick = null; }

function imprimirArea(areaId) {
    const printContent = document.getElementById(areaId).innerHTML; const style = document.createElement('style'); style.id = 'print-style-temp';
    style.innerHTML = `@media print { body > :not(#print-temp) { display: none !important; } #print-temp { display: block !important; position: absolute; left: 0; top: 0; width: 100%; background: #fff; color: #000; padding: 20px; z-index: 99999; } .print\\:hidden { display: none !important; } @page { size: auto; margin: 10mm; } }`;
    document.head.appendChild(style); const printDiv = document.createElement('div'); printDiv.id = 'print-temp';
    printDiv.innerHTML = `<h2 style="font-size: 22px; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">FC Móveis - Relatório</h2>` + printContent;
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

// Kardex
function salvarKardex(ref, prodId, prodNome, qtd, tipo) { db.movimentacoes.unshift({ id: Date.now() + Math.random(), data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo }); }

// ==========================================
// FINANCEIRO & CAIXA
// ==========================================
function renderFinAbas(aba) {
    document.querySelectorAll('.fin-area').forEach(el => el.classList.add('hidden')); document.querySelectorAll('[id^="fin-tab-"]').forEach(el => { el.classList.remove('bg-blue-600', 'text-white'); el.classList.add('text-slate-600'); });
    document.getElementById(`fin-area-${aba}`).classList.remove('hidden'); document.getElementById(`fin-tab-${aba}`).classList.remove('text-slate-600'); document.getElementById(`fin-tab-${aba}`).classList.add('bg-blue-600', 'text-white');
    if(aba === 'caixa') renderCaixaDiario(); if(aba === 'receber') renderTitulos('RECEITA'); if(aba === 'pagar') renderTitulos('DESPESA');
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

function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar'; const statusFilter = document.getElementById(`filtro-${prefix}-status`).value; const sortOrder = document.getElementById(`sort-${prefix}`)? document.getElementById(`sort-${prefix}`).value : 'venc_asc'; const termoBusca = document.getElementById(`busca-fin-${prefix}`).value.toLowerCase();
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    if(termoBusca) { lista = lista.filter(f => (f.pessoa && f.pessoa.toLowerCase().includes(termoBusca)) || (f.ref && f.ref.toLowerCase().includes(termoBusca)) || (f.categoria && f.categoria.toLowerCase().includes(termoBusca))); }
    if(statusFilter !== 'TODOS') { lista = lista.filter(f => f.status === statusFilter); }
    lista.sort((a, b) => { if (sortOrder === 'venc_asc') return new Date(a.data) - new Date(b.data); if (sortOrder === 'venc_desc') return new Date(b.data) - new Date(a.data); if (sortOrder === 'valor_desc') return b.valor - a.valor; if (sortOrder === 'valor_asc') return a.valor - b.valor; return 0; });
    
    document.getElementById(`tabela-fin-${prefix}`).innerHTML = lista.map(f => {
        const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime(); const corStatus = f.status === 'PAGO' ? 'bg-emerald-100 text-emerald-700' : (isAtrasado ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'); const badgeStatus = f.status === 'PAGO' ? 'PAGO' : (isAtrasado ? 'ATRASADO' : 'PENDENTE');
        let btnWhats = ''; if(tipo === 'RECEITA' && f.status === 'PENDENTE') { let c = db.clientes.find(cli => cli.nome === f.pessoa); let nro = c && c.wpp ? c.wpp.replace(/\D/g, '') : ''; if(nro) { let texto = `Olá! Notamos que há um título pendente no valor de ${formatMoney(f.valor)} (Ref: ${f.ref}). Por favor, entre em contato.`; btnWhats = `<a href="https://wa.me/55${nro}?text=${encodeURIComponent(texto)}" target="_blank" class="text-emerald-500 hover:text-emerald-700 p-2 print:hidden" title="Cobrar por WhatsApp"><i class="fa-brands fa-whatsapp text-lg"></i></a>`; } }
        return `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-3 text-slate-500 font-mono text-xs">${formatData(f.data).split(' ')[0]}</td><td class="p-3 font-bold text-slate-800 truncate max-w-[200px]">${f.pessoa}</td><td class="p-3 text-slate-600 text-[11px]">${f.categoria || '-'} <br><span class="font-bold">${f.ref}</span></td><td class="p-3 text-right font-black ${tipo === 'RECEITA' ? 'text-blue-600' : 'text-red-500'}">${formatMoney(f.valor)}</td><td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${corStatus}">${badgeStatus}</span></td><td class="p-3 text-center flex items-center justify-center gap-1 print:hidden"><button onclick="verDetalhesTitulo(${f.id})" class="text-blue-500 hover:text-blue-700 p-1.5" title="Detalhes do Título"><i class="fa-solid fa-eye"></i></button>${btnWhats}${f.status === 'PENDENTE' ? `<button onclick="abrirModalBaixa(${f.id})" class="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-bold hover:bg-blue-100">Baixar</button>` : ``}<button onclick="excluirTitulo(${f.id})" class="text-slate-400 hover:text-red-500 p-1.5 ml-1" title="Excluir"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    }).join('') || `<tr><td colspan="6" class="p-6 text-center text-slate-500">Nenhum título encontrado.</td></tr>`;
}

function abrirModalConta(tipo) {
    document.getElementById('conta-id').value = ''; document.getElementById('conta-tipo').value = tipo === 'RECEBER' ? 'RECEITA' : 'DESPESA'; document.getElementById('lbl-conta-pessoa').innerText = tipo === 'RECEBER' ? 'Cliente / Pagador *' : 'Fornecedor / Favorecido *';
    document.getElementById('conta-categoria').innerHTML = (tipo === 'RECEBER' ? categoriasReceber : categoriasPagar).map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('modal-conta-header').className = `p-4 md:p-5 text-white flex justify-between items-center ${tipo === 'RECEBER' ? 'bg-emerald-500' : 'bg-red-500'}`; document.getElementById('modal-conta-title').innerText = tipo === 'RECEBER' ? 'Nova Conta a Receber' : 'Nova Conta a Pagar';
    ['pessoa','ref','vencimento','valor'].forEach(id => document.getElementById(`conta-${id}`).value = ''); document.getElementById('modal-nova-conta').classList.remove('hidden');
}
function fecharModalConta() { document.getElementById('modal-nova-conta').classList.add('hidden'); }

function salvarConta() {
    const tipo = document.getElementById('conta-tipo').value; const pessoa = document.getElementById('conta-pessoa').value.trim(); const valor = parseFloat(document.getElementById('conta-valor').value); const venc = document.getElementById('conta-vencimento').value;
    if(!pessoa || isNaN(valor) || !venc) return showToast('Preencha Todos os campos!', 'error'); const dtIso = new Date(venc + 'T12:00:00').toISOString();
    db.financeiro.unshift({ id: Date.now(), tipo: tipo, pessoa: pessoa, ref: document.getElementById('conta-ref').value || 'Avulso', categoria: document.getElementById('conta-categoria').value, data: dtIso, valor: valor, status: 'PENDENTE' });
    saveDB(); fecharModalConta(); renderFinAbas(tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Título Salvo!', 'success');
}
function excluirTitulo(id) { abrirConfirmacao('Excluir Título', 'Deseja apagar permanentemente?', () => { const tit = db.financeiro.find(f => f.id === id); db.financeiro = db.financeiro.filter(f => f.id !== id); saveDB(); if(tit) renderFinAbas(tit.tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Excluído!'); }); }

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
    f.status = 'PAGO'; f.valorPago = vf; f.metodoPagamento = metodo; f.dataPagamento = new Date().toISOString();
    saveDB(); fecharModalBaixa(); renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Baixa realizada com sucesso!', 'success');
}

// ==========================================
// COMPRAS E XML
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
            window.tempXMLData = { fornNome, fornCNPJ, totalNF, produtosXML, freteExtra: 0 };
            window.tempXMLData.produtosXML.forEach(p => {
                let match = db.produtos.find(prod => (prod.ean && prod.ean === p.cEAN) || prod.nome.toLowerCase() === p.nome.toLowerCase());
                if(match) { p.statusDB = 'ATUALIZAR'; p.idMatch = match.id; p.margemAtual = match.margem || 50; }
                let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0;
                let freteRateado = window.tempXMLData.freteExtra * pesoValor;
                p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + freteRateado) / p.qCom) : 0;
                p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100));
            });
            renderTelaConferenciaXML(); document.getElementById('modal-conferencia-xml').classList.remove('hidden');
        } catch (err) { showToast('Erro ao ler XML.', 'error'); }
    }; reader.readAsText(file); document.getElementById('xml-upload').value = '';
}

function recalcularRateioXML() {
    window.tempXMLData.freteExtra = parseFloat(document.getElementById('xml-frete-extra').value) || 0;
    window.tempXMLData.produtosXML.forEach(p => { let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0; p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + (window.tempXMLData.freteExtra * pesoValor)) / p.qCom) : 0; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100)); });
    renderTelaConferenciaXML();
}

function xmlAtualizarValores(i, campo, val) {
    const p = window.tempXMLData.produtosXML[i]; val = parseFloat(val) || 0;
    if(campo === 'custo') { p.custoFinal = val; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); }
    if(campo === 'margem') { p.margemAtual = val; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); }
    if(campo === 'preco') { p.precoVendaSug = val; if(p.custoFinal>0) p.margemAtual = ((p.precoVendaSug-p.custoFinal)/p.custoFinal)*100; }
    renderTelaConferenciaXML();
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
    const d = window.tempXMLData; document.getElementById('xml-forn-nome').innerText = d.fornNome; document.getElementById('xml-forn-cnpj').innerText = d.fornCNPJ; document.getElementById('xml-total-nota').innerText = formatMoney(d.totalNF);
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
        } else { let pDB = db.produtos.find(x => x.id === idProd); if (pDB) { pDB.estoque += p.qCom; pDB.custo = p.custoFinal; pDB.margem = p.margemAtual; pDB.preco = p.precoVendaSug; pDB.nome = p.nome; pDB.ativo = true; } }
        totalQtd += p.qCom; salvarKardex(`NF-e ${data.fornNome}`, idProd, p.nome, p.qCom, 'ENTRADA XML');
    });
    db.compras.unshift({ id: Date.now(), data: new Date().toISOString(), fornecedor: data.fornNome, cnpj: data.fornCNPJ, totalNF: data.totalNF, qtdTotal: totalQtd, itens: data.produtosXML });
    db.financeiro.unshift({ id: Date.now()+1, ref: `NF-e Entrada`, data: new Date().toISOString(), pessoa: data.fornNome, wpp: '', valor: data.totalNF, status: 'PENDENTE', tipo: 'DESPESA', categoria: 'Fornecedores' });
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
// RELATÓRIOS E DRE
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

    // Calcula os totais de forma segura
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

    // Monta o texto estruturado que a IA entende perfeitamente
    let relatorioTexto = `=== RELATÓRIO FINANCEIRO E DE GESTÃO - FC MÓVEIS ===\n`;
    relatorioTexto += `Data da exportação: ${new Date().toLocaleString('pt-BR')}\n\n`;
    
    relatorioTexto += `--- 1. DRE SIMPLIFICADA ---\n`;
    relatorioTexto += `- Receita Bruta Total: R$ ${receitaBruta.toFixed(2)}\n`;
    relatorioTexto += `- Custo da Mercadoria Vendida (CMV): R$ ${custoTotal.toFixed(2)}\n`;
    relatorioTexto += `- Lucro Bruto Real: R$ ${lucroBruto.toFixed(2)}\n\n`;

    relatorioTexto += `--- 2. HISTÓRICO DE VENDAS RECENTES ---\n`;
    vendas.slice(-20).forEach((v, index) => {
        relatorioTexto +`[Venda ${index + 1}] Data: ${v.data || 'N/A'} | Total: R$ ${Number(v.total || 0).toFixed(2)} | Forma de Pagamento: ${v.pagamento || 'N/A'}\n`;
    });

    relatorioTexto += `\n--- 3. MOVIMENTAÇÕES FINANCEIRAS / CAIXA ---\n`;
    financeiro.slice(-20).forEach((f, index) => {
        relatorioTexto += `[Movimento ${index + 1}] Tipo: ${f.tipo || 'N/A'} | Descrição: ${f.descricao || 'N/A'} | Valor: R$ ${Number(f.valor || 0).toFixed(2)} | Data: ${f.data || 'N/A'}\n`;
    });

    // Cria o arquivo para download automático no navegador
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