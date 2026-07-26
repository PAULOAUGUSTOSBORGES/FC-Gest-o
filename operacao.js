// operacao.js - Lógica de PDV, Câmera e Histórico de Vendas

let cart = [];
let html5QrCode = null; 
let acaoConfirmacaoPendente = null;

// Lógica local para as abas desta página
function mudarVisaoLocal(viewId) {
    document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('active'); });
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('text-slate-300'); });
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
    if(activeBtn) { activeBtn.classList.remove('text-slate-300'); activeBtn.classList.add('bg-blue-600', 'text-white'); }
    
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }
    
    if(viewId === 'pdv') prepararPDV();
    if(viewId === 'vendas') renderVendas();
}

function inicializarOperacao() {
    prepararPDV();
    
    // Verifica se veio com parâmetro na URL (ex: operacao.html?view=vendas)
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if(view === 'vendas') {
        mudarVisaoLocal('vendas');
    }
}

window.onload = () => { 
    initGlobalData(inicializarOperacao); 
};

// ==========================================
// FUNÇÕES GENÉRICAS (MODAIS, ZOOM, IMPRESSÃO)
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

function abrirZoom(src) {
    if(!src) return;
    document.getElementById('zoom-img-src').src = src;
    document.getElementById('modal-zoom').classList.remove('hidden');
}

function fecharZoom() {
    document.getElementById('modal-zoom').classList.add('hidden');
    document.getElementById('zoom-img-src').src = '';
}

function imprimirArea(areaId) {
    const printContent = document.getElementById(areaId).innerHTML;
    const style = document.createElement('style');
    style.id = 'print-style-temp';
    style.innerHTML = `@media print { body > :not(#print-temp) { display: none !important; } #print-temp { display: block !important; position: absolute; left: 0; top: 0; width: 100%; background: #fff; color: #000; padding: 20px; z-index: 99999; } .print\\:hidden { display: none !important; } @page { size: auto; margin: 10mm; } }`;
    document.head.appendChild(style);
    
    const printDiv = document.createElement('div');
    printDiv.id = 'print-temp';
    printDiv.innerHTML = `<h2 style="font-size: 22px; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">FC Móveis - Relatório</h2>` + printContent;
    document.body.appendChild(printDiv);
    
    window.print();
    setTimeout(() => { printDiv.remove(); style.remove(); }, 1000);
}

function printAction(type) {
    const printContent = document.getElementById('print-area').innerHTML;
    const widthStyle = type === 'thermal' ? 'width: 80mm; font-size: 12px; font-family: monospace; padding: 2mm; margin: 0 auto;' : 'width: 210mm; font-size: 14px; font-family: sans-serif; padding: 20mm; margin: 0 auto;';
    const style = document.createElement('style');
    style.id = 'print-style-temp';
    style.innerHTML = `@media print { body > :not(#print-temp) { display: none !important; } #print-temp { display: block !important; position: absolute; left: 0; top: 0; right: 0; background: #fff; color: #000; z-index: 99999; ${widthStyle} } @page { margin: 0; } }`;
    document.head.appendChild(style);
    const printDiv = document.createElement('div');
    printDiv.id = 'print-temp';
    printDiv.innerHTML = printContent;
    document.body.appendChild(printDiv);
    window.print();
    setTimeout(() => { printDiv.remove(); style.remove(); }, 1000);
}

function baixarPDF(areaId, filename) {
    const element = document.getElementById(areaId);
    const opt = { margin: 10, filename: filename + '_' + Date.now() + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
    const hideElements = element.querySelectorAll('.print\\:hidden'); hideElements.forEach(el => el.style.display = 'none');
    html2pdf().set(opt).from(element).save().then(() => { hideElements.forEach(el => el.style.display = ''); showToast('PDF Gerado!', 'success'); });
}

function downloadPDF(areaId, filename) {
    const element = document.getElementById(areaId); element.classList.remove('hidden'); element.style.padding = '20px'; element.style.fontFamily = 'sans-serif';
    html2pdf().set({ margin:10, filename:`${filename}_${Date.now()}.pdf`, html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} }).from(element).save().then(() => { element.classList.add('hidden'); element.style.padding = ''; showToast('PDF baixado!'); });
}

function exportarExcel(tabelaId, filename) {
    let table = document.getElementById(tabelaId); if(!table) return showToast('Tabela não encontrada.', 'error');
    let rows = table.querySelectorAll('tr'); let csv = [];
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td:not(.print\\:hidden), th:not(.print\\:hidden)');
        for (let j = 0; j < cols.length; j++) { row.push('"' + cols[j].innerText.replace(/"/g, '""').trim() + '"'); }
        csv.push(row.join(';'));
    }
    let csvFile = new Blob(["\uFEFF"+csv.join('\n')], {type: 'text/csv;charset=utf-8;'});
    let link = document.createElement("a"); link.href = window.URL.createObjectURL(csvFile); link.setAttribute("download", filename + "_" + Date.now() + ".csv");
    document.body.appendChild(link); link.click(); showToast('Excel exportado!', 'success');
}

// Emula o Kardex para as baixas feitas aqui no PDV
function salvarKardex(ref, prodId, prodNome, qtd, tipo) { 
    db.movimentacoes.unshift({ id: Date.now() + Math.random(), data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo }); 
}


// ==========================================
// CÂMERA / LEITOR DE CÓDIGO DE BARRAS
// ==========================================
function abrirLeitorCamera() {
    document.getElementById('modal-leitor-codigo').classList.remove('hidden');
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        showToast("Erro ao acessar a câmera. Verifique as permissões.", "error");
        fecharLeitorCamera();
    });
}

function fecharLeitorCamera() {
    document.getElementById('modal-leitor-codigo').classList.add('hidden');
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.log("Erro ao parar câmera", err));
    }
}

function onScanSuccess(decodedText) {
    fecharLeitorCamera();
    const buscaInput = document.getElementById('pdv-produto-busca');
    buscaInput.value = decodedText;
    pdvAdicionarItemBusca(true);
    showToast('Código lido com sucesso!', 'success');
}


// ==========================================
// PDV E CARRINHO
// ==========================================
function prepararPDV() {
    const sCli = document.getElementById('pdv-cliente'); 
    sCli.innerHTML = '<option value="0">Consumidor Final</option>' + db.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join(''); 
    document.getElementById('pdv-busca-resultados').classList.add('hidden'); 
    document.getElementById('pdv-produto-busca').value = '';
    
    const badgeCaixa = document.getElementById('pdv-status-caixa');
    if(db.caixa.status === 'ABERTO') { badgeCaixa.className = "bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; badgeCaixa.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Caixa Aberto'; } 
    else { badgeCaixa.className = "bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; badgeCaixa.innerHTML = '<i class="fa-solid fa-lock mr-1"></i> Caixa Fechado'; }
}

function buscarProdutoPDV() {
    const termo = document.getElementById('pdv-produto-busca').value.toLowerCase().trim(); const resC = document.getElementById('pdv-busca-resultados');
    if(!termo) { resC.classList.add('hidden'); return; }
    const filtrados = db.produtos.filter(p => p.ativo !== false && (String(p.id) === termo || String(p.ean) === termo || p.nome.toLowerCase().includes(termo)));
    if(filtrados.length === 0) { resC.innerHTML = '<div class="p-3 text-sm text-slate-500 text-center">Nenhum produto ativo.</div>'; resC.classList.remove('hidden'); return; }
    resC.innerHTML = filtrados.map(p => { 
        const fHtml = p.foto ? `<img src="${p.foto}" onclick="event.stopPropagation(); abrirZoom('${p.foto}')" class="w-8 h-8 rounded object-cover inline-block mr-2 cursor-zoom-in hover:opacity-80 transition" title="Ver foto em tela cheia">` : `<div class="w-8 h-8 rounded bg-slate-200 inline-flex items-center justify-center text-[10px] text-slate-400 mr-2"><i class="fa-regular fa-image"></i></div>`; 
        return `<div class="p-3 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors" onclick="pdvSelecionarProdutoBusca(${p.id})"><div class="flex items-center">${fHtml}<div><p class="font-bold text-slate-800 text-sm">${p.nome}</p><p class="text-[10px] text-slate-500">Cód: ${p.id}</p></div></div><div class="text-right"><p class="font-bold text-blue-600 text-sm">${formatMoney(p.preco)}</p><p class="text-[10px] font-bold ${p.estoque<1?'text-red-500':'text-emerald-600'}">Est: ${p.estoque}</p></div></div>`
    }).join(''); resC.classList.remove('hidden');
}

function pdvSelecionarProdutoBusca(id) { const p = db.produtos.find(x => x.id === id); if(p) processarAdicaoProduto(p); document.getElementById('pdv-produto-busca').value = ''; document.getElementById('pdv-busca-resultados').classList.add('hidden'); document.getElementById('pdv-produto-busca').focus(); }
function pdvAdicionarItemBusca(btnClick = false) { const termo = document.getElementById('pdv-produto-busca').value.toLowerCase().trim(); if(!termo) return; let p = db.produtos.find(x => x.ativo !== false && (String(x.ean) === termo || String(x.id) === termo)); if(!p) { const fil = db.produtos.filter(x => x.ativo !== false && x.nome.toLowerCase().includes(termo)); if(fil.length === 1) p = fil[0]; } if(p) pdvSelecionarProdutoBusca(p.id); else if(btnClick) showToast('Não encontrado.', 'error'); }

function processarAdicaoProduto(p) { const idx = cart.findIndex(i => i.id === p.id); if(idx >= 0) { cart[idx].qtd++; if(cart[idx].qtd > p.estoque) showToast(`Estoque NEGATIVO! Restam ${p.estoque}.`, 'info'); } else { cart.push({ id: p.id, nome: p.nome, preco: p.preco, custo: p.custo, qtd: 1, foto: p.foto }); if(p.estoque < 1) showToast(`Estoque NEGATIVO!`, 'info'); } renderCarrinho(); }

function renderCarrinho() {
    document.getElementById('pdv-carrinho-body').innerHTML = cart.map((item, i) => { 
        const fHtml = item.foto ? `<img src="${item.foto}" onclick="abrirZoom('${item.foto}')" class="w-10 h-10 rounded object-cover border border-slate-200 mx-auto cursor-zoom-in hover:opacity-80 transition" title="Ver foto em tela cheia">` : `<div class="w-10 h-10 mx-auto rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs border border-slate-200"><i class="fa-regular fa-image"></i></div>`; 
        return `<tr class="hover:bg-slate-50 border-b border-slate-50"><td class="py-2 text-center">${fHtml}</td><td class="py-2 text-slate-800 font-medium">${item.nome}</td><td class="py-2 text-center"><input type="number" min="1" value="${item.qtd}" onchange="pdvMudarQtd(${i}, this.value)" class="w-16 text-center border border-slate-300 rounded-lg p-1.5 font-bold outline-none"></td><td class="py-2 text-right text-slate-600 hidden sm:table-cell">${formatMoney(item.preco)}</td><td class="py-2 text-right font-bold text-slate-800">${formatMoney(item.preco * item.qtd)}</td><td class="py-2 text-center"><button onclick="cart.splice(${i},1); renderCarrinho()" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash text-lg"></i></button></td></tr>`
    }).join('');
    pdvAtualizarTotais();
}

function pdvMudarQtd(i, n) { const novaQtd = Math.max(1, parseInt(n)||1); cart[i].qtd = novaQtd; const p = db.produtos.find(x => x.id === cart[i].id); if(p && novaQtd > p.estoque) showToast(`Estoque NEGATIVO! Restam ${p.estoque}.`, 'info'); renderCarrinho(); }

function pdvLimpar() { cart = []; document.getElementById('pdv-desconto').value=0; document.getElementById('pdv-frete').value=0; document.getElementById('pdv-pagamento-selecionado').value=''; if(document.getElementById('pdv-obs')) document.getElementById('pdv-obs').value = ''; document.querySelectorAll('.btn-pag').forEach(b => b.classList.remove('bg-blue-50','border-blue-500','text-blue-700','ring-2')); document.getElementById('area-parcelamento').classList.add('hidden'); renderCarrinho(); }

function pdvAtualizarTotais() { 
    const sub = cart.reduce((acc, i) => acc + (i.preco * i.qtd), 0); 
    let frete = parseFloat(document.getElementById('pdv-frete').value) || 0;
    let desc = parseFloat(document.getElementById('pdv-desconto').value) || 0; 
    if(desc > (sub + frete)) desc = sub + frete; 
    const tot = sub + frete - desc; 
    document.getElementById('pdv-subtotal').innerText = formatMoney(sub); 
    document.getElementById('pdv-total').innerText = formatMoney(tot); 
    document.getElementById('pdv-qtd-itens').innerText = `${cart.reduce((a,b)=>a+b.qtd,0)} itens`; 
    calcularPreviaParcelas(tot); return { sub, desc, frete, tot }; 
}

function calcularPreviaParcelas(totalParam = null) { 
    const parc = parseInt(document.getElementById('pdv-parcelas').value) || 1; 
    let tot = totalParam !== null ? totalParam : pdvAtualizarTotais().tot;
    document.getElementById('pdv-previa-parcelas').innerText = tot > 0 && parc > 0 ? `${parc}x de ${formatMoney(tot/parc)}` : '1x de R$ 0,00'; 
}

function pdvSelPagamento(btnEl, metodo) { 
    document.querySelectorAll('.btn-pag').forEach(b => b.classList.remove('bg-blue-50','border-blue-500','text-blue-700','ring-2')); 
    btnEl.classList.add('bg-blue-50','border-blue-500','text-blue-700','ring-2'); 
    document.getElementById('pdv-pagamento-selecionado').value = metodo; 
    const area = document.getElementById('area-parcelamento'); 
    if(metodo === 'Cartão Crédito' || metodo === 'Boleto' || metodo === 'Fiado') { area.classList.remove('hidden'); calcularPreviaParcelas(); } else { area.classList.add('hidden'); document.getElementById('pdv-parcelas').value = 1; } 
}

function pdvFinalizar() {
    if(cart.length === 0) return showToast('O carrinho está vazio!', 'error');
    const pag = document.getElementById('pdv-pagamento-selecionado').value;
    if(!pag) return showToast('Selecione o Pagamento!', 'error');
    if(db.caixa.status !== 'ABERTO') return showToast('O Caixa está FECHADO. Vá em Gestão e abra o caixa.', 'error');

    const { sub, desc, frete, tot } = pdvAtualizarTotais(); 
    const custoTotal = cart.reduce((acc, i) => acc + (i.custo * i.qtd), 0);
    let parc = parseInt(document.getElementById('pdv-parcelas').value) || 1; 
    
    let taxaPct = 0;
    if (db.config && db.config.taxas) {
        if (pag === 'Cartão Crédito') { let pNum = parc > 12 ? 12 : parc; taxaPct = db.config.taxas['Cartão Crédito'][pNum] || 0; } else { taxaPct = db.config.taxas[pag] || 0; }
    }
    const taxaValor = tot * (taxaPct / 100); const valorLiquido = tot - taxaValor; const lucroReal = valorLiquido - custoTotal;

    const cId = document.getElementById('pdv-cliente').value; const cNome = cId === "0" ? 'Consumidor Final' : (db.clientes.find(x => String(x.id) === String(cId))?.nome || 'Consumidor Final');
    const op = document.getElementById('pdv-operacao').value; const vend = document.getElementById('pdv-vendedor').value; const obsTexto = document.getElementById('pdv-obs') ? document.getElementById('pdv-obs').value.trim() : ''; const vendaId = Date.now(); 
    
    const numeroPedido = db.vendas.length > 0 ? Math.max(...db.vendas.map(v => v.numeroPedido || 0)) + 1 : 1; const numPedStr = String(numeroPedido).padStart(4, '0');
    const dataIso = new Date().toISOString(); let txtFrete = frete > 0 ? `<p style="margin: 2px 0;">Frete/Entrega: ${formatMoney(frete)}</p>` : '';
    
    let htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÓVEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: ${op.toUpperCase()}</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data: ${new Date().toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${cNome}</p><p style="margin: 2px 0;">Vendedor: ${vend}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${cart.map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${formatMoney(i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><p style="margin: 2px 0;">Subtotal: ${formatMoney(sub)}</p>${txtFrete}<p style="margin: 2px 0;">Desconto: ${formatMoney(desc)}</p><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total: ${formatMoney(tot)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${pag}</p>${parc > 1 ? `<p style="margin: 2px 0; font-size: 0.85em;">Parcelado em ${parc}x</p>` : ''}</div>`;

    cart.forEach(item => { const p = db.produtos.find(x => x.id === item.id); if(p) { p.estoque -= item.qtd; salvarKardex(`Venda #${numPedStr}`, p.id, p.nome, -item.qtd, 'VENDA'); } });
    db.vendas.unshift({ id: vendaId, numeroPedido: numeroPedido, data: dataIso, clienteId: cId, clienteNome: cNome, subtotal: sub, frete: frete, desconto: desc, tot: tot, taxaPct: taxaPct, taxaValor: taxaValor, valorLiquido: valorLiquido, custoTotal: custoTotal, lucroReal: lucroReal, pag: pag, parcelas: parc, vendedor: vend, obs: obsTexto, itens: [...cart] });
    
    if(pag === 'Fiado' || pag === 'Boleto' || pag.includes('Crédito') || pag.includes('Prazo')) {
        const valParc = valorLiquido / parc; for(let i=1; i<=parc; i++) { db.financeiro.unshift({ id: Date.now()+i, ref: `Venda #${numPedStr} (${i}/${parc})`, data: dataIso, pessoa: cNome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas' }); }
    } else if (pag === 'Dinheiro' || pag === 'PIX' || pag.includes('Débito')) {
        db.financeiro.unshift({ id: Date.now()+1, ref: `Venda #${numPedStr} (PDV)`, data: dataIso, pessoa: cNome, wpp: '', valor: valorLiquido, status: 'PAGO', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: pag, dataPagamento: dataIso });
        if(pag === 'Dinheiro') { db.caixa.saldo += valorLiquido; db.caixa.historico.unshift({ data: dataIso, tipo: 'ENTRADA', desc: `Venda #${numPedStr}`, valor: valorLiquido }); }
    }
    saveDB(); document.getElementById('print-area').innerHTML = htmlRecibo; document.getElementById('modal-opcoes-recibo').classList.remove('hidden'); pdvLimpar();
}

function fecharModalOpcoesRecibo() { document.getElementById('modal-opcoes-recibo').classList.add('hidden'); }


// ==========================================
// HISTÓRICO DE VENDAS E EXCLUSÃO (ESTORNO)
// ==========================================
function renderVendas() {
    const termo = document.getElementById('busca-vendas').value.toLowerCase().trim(); const dataIni = document.getElementById('filtro-vendas-ini').value; const dataFim = document.getElementById('filtro-vendas-fim').value; const pgto = document.getElementById('filtro-vendas-pgto').value;
    let filtrados = db.vendas || [];
    if (termo) filtrados = filtrados.filter(v => v.clienteNome.toLowerCase().includes(termo) || String(v.numeroPedido).includes(termo) || (v.vendedor && v.vendedor.toLowerCase().includes(termo)));
    if (pgto !== 'TODOS') filtrados = filtrados.filter(v => v.pag && v.pag.includes(pgto));
    if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(v => new Date(v.data).getTime() >= dIni); }
    if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(v => new Date(v.data).getTime() <= dFim); }
    filtrados.sort((a,b) => new Date(b.data) - new Date(a.data));

    let totalLucro = 0;
    document.getElementById('tabela-vendas-body').innerHTML = filtrados.map(v => {
        const custoTotalDaVenda = (v.custoTotal || 0) + (v.taxaValor || 0); const lucroDaVenda = v.tot - custoTotalDaVenda; const numPedStr = String(v.numeroPedido || v.id).padStart(4, '0');
        totalLucro += lucroDaVenda;
        return `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-3 text-slate-500 text-xs">${formatData(v.data)}</td><td class="p-3 font-mono font-bold text-slate-700">#${numPedStr}</td><td class="p-3 font-bold text-slate-800">${v.clienteNome} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${v.vendedor || '-'}</span></td><td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${v.pag} ${v.parcelas > 1 ? '('+v.parcelas+'x)' : ''}</span></td><td class="p-3 text-right font-black text-slate-700">${formatMoney(v.tot)}</td><td class="p-3 text-right font-bold text-red-500">-${formatMoney(custoTotalDaVenda)}</td><td class="p-3 text-right font-black text-emerald-600">${formatMoney(lucroDaVenda)}</td><td class="p-3 text-center flex justify-center gap-1 print:hidden"><button onclick="verDetalhesVenda(${v.id})" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded font-bold text-xs"><i class="fa-solid fa-eye"></i></button><button onclick="reimprimirVenda(${v.id})" class="text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded font-bold text-xs"><i class="fa-solid fa-print"></i></button><button onclick="excluirVenda(${v.id})" class="text-red-500 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded font-bold text-xs ml-1"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="p-6 text-center text-slate-500">Nenhuma venda encontrada com os filtros atuais.</td></tr>';
    document.getElementById('vendas-total-filtros').innerText = `Lucro Real Acumulado: ${formatMoney(totalLucro)}`;
}

function excluirVenda(id) {
    abrirConfirmacao('Excluir Venda', 'Devolver estoque e apagar parcelas/caixa?', () => {
        try {
            const v = db.vendas.find(x => x.id === id);
            if(v) {
                const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
                if(v.itens && v.itens.length > 0) { v.itens.forEach(item => { const p = db.produtos.find(prod => prod.id === item.id); if(p) { p.estoque += item.qtd; salvarKardex(`Estorno Venda #${numPedStr}`, p.id, p.nome, item.qtd, 'ESTORNO'); } }); }
                db.financeiro = db.financeiro.filter(f => f.ref ? !f.ref.includes(`Venda #${numPedStr}`) : true);
                if(v.pag === 'Dinheiro') { if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] }; if(!db.caixa.historico) db.caixa.historico = []; db.caixa.saldo -= v.valorLiquido; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno Venda #${numPedStr}`, valor: v.valorLiquido }); }
                db.vendas = db.vendas.filter(x => x.id !== id); saveDB(); renderVendas(); showToast('Venda excluída com sucesso!', 'success');
            }
        } catch (err) { console.error(err); showToast('Erro ao excluir a venda.', 'error'); }
    });
}

function reimprimirVenda(id) {
    const v = db.vendas.find(x => x.id === id); if(!v) return; const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÓVEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: REIMPRESSÃO</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data Original: ${new Date(v.data).toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${v.clienteNome}</p><p style="margin: 2px 0;">Vendedor: ${v.vendedor || '-'}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${v.itens.map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${formatMoney(i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total Final: ${formatMoney(v.tot)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${v.pag}</p></div>`;
    document.getElementById('print-area').innerHTML = htmlRecibo; document.getElementById('modal-opcoes-recibo').classList.remove('hidden');
}

function verDetalhesVenda(id) {
    const v = db.vendas.find(x => x.id === id); if(!v) return; const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    document.getElementById('det-venda-cliente').innerText = v.clienteNome || 'Desconhecido'; document.getElementById('det-venda-data').innerText = `${formatData(v.data).split(' ')[0]} | #${numPedStr}`; document.getElementById('det-venda-pag').innerText = v.pag || '-'; document.getElementById('det-venda-obs').innerText = v.obs ? v.obs : 'Nenhuma observação registrada nesta venda.'; document.getElementById('det-venda-total').innerText = formatMoney(v.tot);
    document.getElementById('det-venda-itens').innerHTML = v.itens.map(i => `<tr class="hover:bg-slate-50 border-b border-slate-50"><td class="p-3 font-medium text-slate-700 text-xs">${i.nome}</td><td class="p-3 text-center text-xs font-bold text-slate-600">${i.qtd}</td><td class="p-3 text-right text-xs text-slate-500">${formatMoney(i.preco)}</td><td class="p-3 text-right text-xs font-bold text-slate-800">${formatMoney(i.preco * i.qtd)}</td></tr>`).join('');
    document.getElementById('modal-detalhes-venda').classList.remove('hidden');
}
function fecharModalDetalhesVenda() { document.getElementById('modal-detalhes-venda').classList.add('hidden'); }

// ==========================================
// CADASTRO RÁPIDO DE PRODUTO PELO PDV
// ==========================================
function abrirModalProduto() {
    ['id','nome','ean','marca','custo','preco','margem','estoque','minimo','obs'].forEach(id => { const el = document.getElementById(`prod-${id}`); if(el) el.value = ''; });
    document.getElementById('prod-estoque').value = 1; document.getElementById('prod-minimo').value = 1;
    document.getElementById('prod-foto-base64').value = ''; document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden');
    document.getElementById('modal-produto').classList.remove('hidden');
}

function fecharModalProduto() { 
    document.getElementById('modal-produto').classList.add('hidden'); 
}

function processarFoto(event) {
    const file = event.target.files[0]; if(!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image(); img.onload = function() {
            const canvas = document.createElement('canvas'); let w = img.width, h = img.height; const MAX = 300;
            if(w > h) { if(w > MAX) { h *= MAX/w; w = MAX; } } else { if(h > MAX) { w *= MAX/h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('preview-foto').src = dataUrl; document.getElementById('preview-foto').classList.remove('hidden');
            document.getElementById('texto-sem-foto').classList.add('hidden'); document.getElementById('prod-foto-base64').value = dataUrl;
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
}

function salvarProdutoRapido() {
    const nome = document.getElementById('prod-nome').value.trim(); const preco = parseFloat(document.getElementById('prod-preco').value);
    if(!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

    const p = {
        id: Date.now(), nome, preco, ean: document.getElementById('prod-ean').value, marca: document.getElementById('prod-marca').value, 
        categoria: document.getElementById('prod-categoria').value, unidade: document.getElementById('prod-unidade').value, 
        custo: parseFloat(document.getElementById('prod-custo').value) || 0, margem: parseFloat(document.getElementById('prod-margem').value) || 0, 
        estoque: parseInt(document.getElementById('prod-estoque').value) || 0, min: parseInt(document.getElementById('prod-minimo').value) || 0, 
        ativo: document.getElementById('prod-ativo').value === 'true', obs: document.getElementById('prod-obs').value, foto: document.getElementById('prod-foto-base64').value
    };

    db.produtos.push(p); 
    if(p.estoque > 0) salvarKardex('Estoque Inicial', p.id, p.nome, p.estoque, 'INICIAL'); 
    
    saveDB(); 
    fecharModalProduto(); 
    showToast('Produto Cadastrado!', 'success');
    
    // Adiciona direto no carrinho já que foi feito do PDV
    processarAdicaoProduto(p);
}