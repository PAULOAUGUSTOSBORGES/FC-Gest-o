// index.js - Lógica exclusiva do Dashboard

function renderDashboard() {
    const vendas = db.vendas || [];
    
    const fatTotal = vendas.reduce((a, b) => a + b.tot, 0); 
    const cmvTotal = vendas.reduce((a, b) => a + (b.custoTotal || 0), 0);
    const taxasTotal = vendas.reduce((a, b) => a + (b.taxaValor || 0), 0);
    const lucroReal = fatTotal - cmvTotal - taxasTotal;
    
    const aReceber = db.financeiro.filter(f => f.status === 'PENDENTE' && (!f.tipo || f.tipo === 'RECEITA')).reduce((a, b) => a + b.valor, 0);
    
    document.getElementById('dash-faturamento').innerText = formatMoney(fatTotal); 
    document.getElementById('dash-lucro').innerText = formatMoney(lucroReal);
    document.getElementById('dash-receber').innerText = formatMoney(aReceber); 
    document.getElementById('dash-produtos').innerText = db.produtos.length;
}

// Quando a página carrega, ela chama o initGlobalData, que por sua vez, puxa o banco de dados e depois roda o renderDashboard.
window.onload = () => { 
    initGlobalData(renderDashboard); 
};