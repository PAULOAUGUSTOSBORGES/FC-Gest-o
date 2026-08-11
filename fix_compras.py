import re

with open('compras.js', 'r', encoding='utf-8') as f:
    content = f.read()

correct_code = """function renderTabelaCompraManual() {
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
            <td class="p-2 md:p-3 text-center"><button onclick="removerLinhaCompraManual(${i})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    calcularTotaisCompraManual();
}

function toggleCompraManualModo() {
    const apenasValor = document.getElementById('compra-manual-apenas-valor')?.checked;
    if(apenasValor) {
        document.getElementById('div-compra-manual-produtos').classList.add('hidden');
        document.getElementById('div-compra-manual-valor-avulso').classList.remove('hidden');
    } else {
        document.getElementById('div-compra-manual-produtos').classList.remove('hidden');
        document.getElementById('div-compra-manual-valor-avulso').classList.add('hidden');
    }
    calcularTotaisCompraManual();
}

function calcularTotaisCompraManual() {
    const apenasValor = document.getElementById('compra-manual-apenas-valor')?.checked;
    let totalGeral = 0;
    let totalProdutos = 0;
    let frete = 0;
    
    if(apenasValor) {
        totalGeral = parseFloat(document.getElementById('compra-manual-valor-total').value) || 0;
    } else {
        frete = parseFloat(document.getElementById('compra-manual-frete').value) || 0;
        totalProdutos = compraManualItens.reduce((acc, item) => acc + (item.qtd * item.custoUnit), 0);
        totalGeral = totalProdutos + frete;
        
        const display = document.getElementById('compra-manual-total-display');
        if(display) display.innerText = formatMoney(totalGeral);
    }
    
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
    
    const apenasValor = document.getElementById('compra-manual-apenas-valor')?.checked;
    const totais = calcularTotaisCompraManual();
    
    if(totais.totalGeral <= 0) return showToast("Valor total deve ser maior que zero!", "error");
    
    if(!apenasValor) {
        if(compraManualItens.length === 0) return showToast("Adicione itens válidos!", "error");
        for(let i=0; i<compraManualItens.length; i++) {
            if(!compraManualItens[i].prodId) return showToast("Selecione os produtos em todas as linhas!", "error");
        }
    }

    const batch = firestore.batch();

    if (isEdicao) {
        const cAntiga = db.compras.find(x => String(x.id) === String(idEdit));
        if (cAntiga) {
            if(cAntiga.itens && cAntiga.itens.length > 0) {
                cAntiga.itens.forEach(item => {
                    if (item.idMatch) {"""

# Replace from 'function renderTabelaCompraManual() {' up to 'if (item.idMatch) {'
start_idx = content.find('function renderTabelaCompraManual() {')
end_idx = content.find('                    if (item.idMatch) {', start_idx) + len('                    if (item.idMatch) {')

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + correct_code + content[end_idx:]
    with open('compras.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed!")
else:
    print("Could not find boundaries")
