// index.js - Lógica exclusiva do Dashboard (MEGA BI)

let renderTimeout = null;

function atualizarDashboard() {
    renderDashboard();
}

function renderDashboard() {
    // Evitar renderizações excessivas se várias coleções atualizarem ao mesmo tempo
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        executarCalculosDashboard();
    }, 100);
}

function executarCalculosDashboard() {
    // Pegar o filtro de período
    const filtroEl = document.getElementById('dash-filtro-periodo');
    const periodo = filtroEl ? filtroEl.value : 'mes';

    const agora = new Date();
    let dataIni = new Date(0); 
    let dataFim = new Date();

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    switch(periodo) {
        case 'hoje':
            dataIni = hoje;
            break;
        case 'ontem':
            dataIni = ontem;
            dataFim = new Date(ontem);
            dataFim.setHours(23,59,59,999);
            break;
        case '7d':
            dataIni = new Date(hoje);
            dataIni.setDate(dataIni.getDate() - 7);
            break;
        case '15d':
            dataIni = new Date(hoje);
            dataIni.setDate(dataIni.getDate() - 15);
            break;
        case '30d':
            dataIni = new Date(hoje);
            dataIni.setDate(dataIni.getDate() - 30);
            break;
        case 'mes':
            dataIni = new Date(agora.getFullYear(), agora.getMonth(), 1);
            break;
        case '3m':
            dataIni = new Date(agora.getFullYear(), agora.getMonth() - 3, 1);
            break;
        case 'ano':
            dataIni = new Date(agora.getFullYear(), 0, 1);
            break;
        case 'tudo':
            // dataIni já é epoch
            break;
    }

    const labelPeriodo = (periodo === 'hoje' || periodo === 'ontem') ? 'Dia' : (periodo === 'mes' ? 'Mês' : 'Período');
    document.querySelectorAll('.periodo-label').forEach(el => el.innerText = labelPeriodo);

    const dentroDoPeriodo = (dataString) => {
        if (!dataString) return false;
        const d = new Date(dataString).getTime();
        return d >= dataIni.getTime() && d <= dataFim.getTime();
    };

    // 1. FATURAMENTO E VENDAS
    const vendasTotais = (db.vendas || []).filter(v => v.tipo !== 'ORÇAMENTO');
    const orcamentosTotais = (db.vendas || []).filter(v => v.tipo === 'ORÇAMENTO');
    
    const vendasPeriodo = vendasTotais.filter(v => dentroDoPeriodo(v.data));
    const vendasHoje = vendasTotais.filter(v => {
        if(!v.data) return false;
        const d = new Date(v.data);
        return d >= hoje && d <= new Date(hoje.getTime() + 86399999);
    });

    const fatHoje = vendasHoje.reduce((a, b) => a + (Number(b.tot) || 0), 0);
    const fatPeriodo = vendasPeriodo.reduce((a, b) => a + (Number(b.tot) || 0), 0);
    const cmvPeriodo = vendasPeriodo.reduce((a, b) => a + (Number(b.custoTotal) || 0) + (Number(b.taxaValor) || 0), 0);
    const lucroPeriodo = fatPeriodo - cmvPeriodo;
    const qtdVendasPeriodo = vendasPeriodo.length;

    // 2. ORÇAMENTOS PENDENTES
    const orcamentosPendentes = orcamentosTotais.filter(v => dentroDoPeriodo(v.data)).length;

    // 3. FINANCEIRO
    const contas = db.financeiro || [];
    
    // Despesas = Pago no período
    const despesasPeriodo = contas.filter(c => c.tipo === 'DESPESA' && c.status === 'PAGO' && dentroDoPeriodo(c.dataPgto || c.data)).reduce((a,b) => a + (Number(b.valor) || 0), 0);
    
    const aReceberTodas = contas.filter(c => (!c.tipo || c.tipo === 'RECEITA') && c.status === 'PENDENTE');
    const valorReceber = aReceberTodas.reduce((a,b) => a + (Number(b.valor) || 0), 0);
    const qtdReceberVencidas = aReceberTodas.filter(c => c.data && new Date(c.data).getTime() < hoje.getTime()).length;

    const aPagarTodas = contas.filter(c => c.tipo === 'DESPESA' && c.status === 'PENDENTE');
    const valorPagar = aPagarTodas.reduce((a,b) => a + (Number(b.valor) || 0), 0);
    const qtdPagarVencidas = aPagarTodas.filter(c => c.data && new Date(c.data).getTime() < hoje.getTime()).length;

    const saldoCaixa = (db.caixa && db.caixa.saldo) ? Number(db.caixa.saldo) : 0;

    // 4. ESTOQUE
    const produtos = db.produtos || [];
    let valorTotalEstoque = 0;
    let produtosVazios = 0;
    let produtosBaixo = 0;
    
    produtos.forEach(p => {
        const est = Number(p.estoque) || 0;
        const min = Number(p.estoqueMin) || 0;
        if(est > 0) {
            valorTotalEstoque += est * (Number(p.custo) || 0);
        }
        
        if (est <= 0) produtosVazios++;
        else if (est <= min) produtosBaixo++;
    });

    // 5. CADASTROS
    const qtdClientes = (db.clientes || []).length;
    const qtdFornecedores = (db.fornecedores || []).length;

    // ATUALIZAR DOM
    const fM = (val) => typeof formatMoney === 'function' ? formatMoney(val) : `R$ ${Number(val).toFixed(2).replace('.', ',')}`;
    const setHtml = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };

    setHtml('dash-faturamento-hoje', fM(fatHoje));
    setHtml('dash-faturamento', fM(fatPeriodo));
    setHtml('dash-lucro', fM(lucroPeriodo));
    setHtml('dash-despesas', fM(despesasPeriodo));
    
    setHtml('dash-caixa', fM(saldoCaixa));
    setHtml('dash-receber', fM(valorReceber));
    setHtml('dash-receber-vencido', qtdReceberVencidas > 0 ? `<span class="text-red-500 font-bold dark:text-red-400"><i class="fa-solid fa-triangle-exclamation"></i> ${qtdReceberVencidas} vencidas</span>` : '0 vencidas');
    setHtml('dash-pagar', fM(valorPagar));
    setHtml('dash-pagar-vencido', qtdPagarVencidas > 0 ? `<span class="text-red-500 font-bold dark:text-red-400"><i class="fa-solid fa-triangle-exclamation"></i> ${qtdPagarVencidas} vencidas</span>` : '0 vencidas');
    
    setHtml('dash-valor-estoque', fM(valorTotalEstoque));
    setHtml('dash-qtd-vendas', qtdVendasPeriodo);
    setHtml('dash-orcamentos', orcamentosPendentes);
    setHtml('dash-clientes', qtdClientes);
    setHtml('dash-fornecedores', qtdFornecedores);

    // 6. RANKINGS (Top Produtos e Clientes) E CURVA ABC
    let produtoVendas = {}; // { 'idProduto': { nome: '...', qtd: 0, receita: 0 } }
    let clienteVendas = {}; // { 'idCliente': { nome: '...', compras: 0, receita: 0 } }

    vendasPeriodo.forEach(v => {
        // Agrupar Clientes
        const cNome = v.clienteNome || 'Cliente Não Identificado';
        const cId = v.clienteId || cNome;
        if(!clienteVendas[cId]) {
            clienteVendas[cId] = { nome: cNome, compras: 0, receita: 0 };
        }
        clienteVendas[cId].compras++;
        clienteVendas[cId].receita += Number(v.tot) || 0;

        // Agrupar Produtos
        if(v.itens && Array.isArray(v.itens)) {
            v.itens.forEach(item => {
                const pNome = item.nome || 'Produto Não Identificado';
                const pId = item.id || pNome;
                if(!produtoVendas[pId]) {
                    produtoVendas[pId] = { nome: pNome, qtd: 0, receita: 0 };
                }
                produtoVendas[pId].qtd += Number(item.qtd) || 0;
                produtoVendas[pId].receita += (Number(item.qtd) || 0) * (Number(item.precoUnitario) || 0);
            });
        }
    });

    // Top 5 Produtos
    const topProdutos = Object.values(produtoVendas).sort((a,b) => b.receita - a.receita).slice(0, 5);
    const tbodyProd = document.getElementById('dash-top-produtos');
    if(tbodyProd) {
        if(topProdutos.length > 0) {
            tbodyProd.innerHTML = topProdutos.map(p => `
                <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">${p.nome}</td>
                    <td class="px-4 py-3">${p.qtd}</td>
                    <td class="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">${fM(p.receita)}</td>
                </tr>
            `).join('');
        } else {
            tbodyProd.innerHTML = `<tr><td colspan="3" class="text-center py-4">Nenhuma venda no período</td></tr>`;
        }
    }

    // Top 5 Clientes
    const topClientes = Object.values(clienteVendas).sort((a,b) => b.receita - a.receita).slice(0, 5);
    const tbodyCli = document.getElementById('dash-top-clientes');
    if(tbodyCli) {
        if(topClientes.length > 0) {
            tbodyCli.innerHTML = topClientes.map(c => `
                <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">${c.nome}</td>
                    <td class="px-4 py-3">${c.compras}</td>
                    <td class="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">${fM(c.receita)}</td>
                </tr>
            `).join('');
        } else {
            tbodyCli.innerHTML = `<tr><td colspan="3" class="text-center py-4">Nenhuma venda no período</td></tr>`;
        }
    }

    // Curva ABC de Vendas (Produtos)
    const todosProdutosRank = Object.values(produtoVendas).sort((a,b) => b.receita - a.receita);
    const receitaTotalABC = todosProdutosRank.reduce((acc, p) => acc + p.receita, 0);
    
    let acum = 0;
    const abcCalculada = todosProdutosRank.map(p => {
        const percTotal = receitaTotalABC > 0 ? (p.receita / receitaTotalABC) * 100 : 0;
        acum += percTotal;
        
        let classeCurva = 'C';
        let colorCurva = 'text-red-500 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50';
        if(acum <= 80) { 
            classeCurva = 'A'; 
            colorCurva = 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50';
        }
        else if(acum <= 95) { 
            classeCurva = 'B'; 
            colorCurva = 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50';
        }

        return { ...p, percTotal, acum, classeCurva, colorCurva };
    });

    const tbodyABC = document.getElementById('dash-curva-abc');
    if(tbodyABC) {
        if(abcCalculada.length > 0) {
            tbodyABC.innerHTML = abcCalculada.map(p => `
                <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">${p.nome}</td>
                    <td class="px-4 py-3 text-slate-600 dark:text-slate-300">${fM(p.receita)}</td>
                    <td class="px-4 py-3">${p.percTotal.toFixed(1)}%</td>
                    <td class="px-4 py-3">${p.acum.toFixed(1)}%</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 text-xs font-bold rounded border ${p.colorCurva}">${p.classeCurva}</span>
                    </td>
                </tr>
            `).join('');
        } else {
            tbodyABC.innerHTML = `<tr><td colspan="5" class="text-center py-8">Nenhuma venda para análise ABC</td></tr>`;
        }
    }

    renderizarNotificacoes(produtosVazios, produtosBaixo, qtdReceberVencidas, qtdPagarVencidas, saldoCaixa);
}

function renderizarNotificacoes(prodVazios, prodBaixo, recVencidas, pagVencidas, caixa) {
    const painel = document.getElementById('dash-notificacoes');
    if (!painel) return;

    let alertas = [];

    if (caixa < 0) {
        alertas.push(`<div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-lg flex gap-3 items-center cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" onclick="window.location.href='gestao.html?view=financeiro'">
            <div class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div><p class="text-sm font-bold text-slate-800 dark:text-slate-100">Caixa Negativo</p><p class="text-xs text-slate-500 dark:text-slate-400">O saldo em caixa está negativo.</p></div>
        </div>`);
    }

    if (prodVazios > 0) {
        alertas.push(`<div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-lg flex gap-3 items-center cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" onclick="window.location.href='cadastro.html?view=produtos'">
            <div class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-box-open"></i></div>
            <div><p class="text-sm font-bold text-slate-800 dark:text-slate-100">${prodVazios} Produto(s) sem estoque</p><p class="text-xs text-slate-500 dark:text-slate-400">Reponha o estoque urgentemente.</p></div>
        </div>`);
    }

    if (prodBaixo > 0) {
        alertas.push(`<div class="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg flex gap-3 items-center cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors" onclick="window.location.href='cadastro.html?view=produtos'">
            <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-battery-quarter"></i></div>
            <div><p class="text-sm font-bold text-slate-800 dark:text-slate-100">${prodBaixo} Produto(s) acabando</p><p class="text-xs text-slate-500 dark:text-slate-400">Estoque atingiu o nível mínimo.</p></div>
        </div>`);
    }

    if (pagVencidas > 0) {
        alertas.push(`<div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-lg flex gap-3 items-center cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" onclick="window.location.href='gestao.html?view=financeiro'">
            <div class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-invoice-dollar"></i></div>
            <div><p class="text-sm font-bold text-slate-800 dark:text-slate-100">${pagVencidas} Conta(s) a Pagar vencida(s)</p><p class="text-xs text-slate-500 dark:text-slate-400">Regularize para evitar juros.</p></div>
        </div>`);
    }

    if (recVencidas > 0) {
        alertas.push(`<div class="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg flex gap-3 items-center cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors" onclick="window.location.href='gestao.html?view=financeiro'">
            <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><i class="fa-solid fa-hand-holding-dollar"></i></div>
            <div><p class="text-sm font-bold text-slate-800 dark:text-slate-100">${recVencidas} Recebimento(s) em atraso</p><p class="text-xs text-slate-500 dark:text-slate-400">Faça cobranças ativas.</p></div>
        </div>`);
    }

    if (alertas.length === 0) {
        painel.innerHTML = `<div class="text-center text-slate-400 dark:text-slate-500 mt-10"><i class="fa-solid fa-circle-check text-4xl mb-3 text-emerald-400/50"></i><p class="text-sm">Tudo tranquilo! Nenhum alerta crítico.</p></div>`;
    } else {
        painel.innerHTML = alertas.join('');
    }
}

async function migrarBancoAntigo() {
    try {
        const docRef = firestore.collection("fc_móveis").doc("banco_principal");
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const dados = docSnap.data();
            if (dados.migrado) return;
            
            showToast("Sincronizando banco de dados para a nova versão...", "info");
            
            const colecoes = ['produtos', 'clientes', 'fornecedores', 'vendas', 'movimentacoes', 'financeiro', 'compras'];
            let count = 0;
            const promessas = [];
            
            for (let col of colecoes) {
                if (dados[col] && Array.isArray(dados[col])) {
                    for (let item of dados[col]) {
                        const id = item.id ? String(item.id) : firestore.collection(col).doc().id;
                        promessas.push(firestore.collection(col).doc(id).set(item));
                        count++;
                    }
                }
            }
            
            if (dados.caixa) promessas.push(firestore.collection("fc_móveis").doc("caixa").set(dados.caixa));
            if (dados.config) promessas.push(firestore.collection("fc_móveis").doc("config").set(dados.config, {merge: true}));
            
            await Promise.all(promessas);
            await docRef.update({ migrado: true });
            
            showToast(`Migração concluída! ${count} registros importados.`, "success");
            setTimeout(() => window.location.reload(), 1500);
        }
    } catch (e) {
        console.error("Erro ao migrar dados: ", e);
    }
}

function inicializarDashboard() {
    migrarBancoAntigo();

    // Listeners para todas as coleções que afetam os KPIs
    firestore.collection('produtos').onSnapshot(snap => {
        db.produtos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
    firestore.collection('clientes').onSnapshot(snap => {
        db.clientes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
    firestore.collection('vendas').onSnapshot(snap => {
        db.vendas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
    firestore.collection('financeiro').onSnapshot(snap => {
        db.financeiro = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
    firestore.collection('fc_móveis').doc('caixa').onSnapshot(doc => {
        db.caixa = doc.data() || { saldo: 0 };
        renderDashboard();
    });

    inicializarGraficos();
}

// ==========================================
// GRÁFICOS (FASE 2)
// ==========================================

let chartPrincipal = null;
let chartEstoque = null;
let chartInadimplencia = null;
let modoGraficoPrincipal = 'vendas'; // 'vendas' ou 'financeiro'

function mudarTipoGraficoPrincipal(tipo) {
    modoGraficoPrincipal = tipo;
    
    const btnVendas = document.getElementById('btn-chart-vendas');
    if (btnVendas) btnVendas.className = tipo === 'vendas' ? 'text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-bold transition-colors' : 'text-xs px-3 py-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400 font-bold transition-colors';
    
    const btnFin = document.getElementById('btn-chart-financeiro');
    if (btnFin) btnFin.className = tipo === 'financeiro' ? 'text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-bold transition-colors' : 'text-xs px-3 py-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400 font-bold transition-colors';
    
    renderizarGraficos(); 
}

function inicializarGraficos() {
    if (typeof ApexCharts === 'undefined') {
        setTimeout(inicializarGraficos, 500); // Aguarda carregar script
        return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // Gráfico Principal
    const optionsPrincipal = {
        series: [],
        chart: { type: 'area', height: 300, toolbar: { show: false }, background: 'transparent' },
        colors: ['#3b82f6', '#10b981', '#ef4444'],
        theme: { mode: isDark ? 'dark' : 'light' },
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 90, 100] } },
        dataLabels: { enabled: false },
        xaxis: { categories: [], tooltip: { enabled: false }, labels: { style: { colors: textColor } } },
        yaxis: { labels: { style: { colors: textColor }, formatter: (value) => `R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` } },
        grid: { borderColor: gridColor, strokeDashArray: 4 },
        legend: { position: 'top', horizontalAlign: 'right' }
    };
    chartPrincipal = new ApexCharts(document.querySelector("#chart-principal"), optionsPrincipal);
    chartPrincipal.render();

    // Gráfico de Estoque
    const optionsEstoque = {
        series: [],
        chart: { type: 'donut', height: 250, background: 'transparent' },
        labels: [],
        theme: { mode: isDark ? 'dark' : 'light' },
        stroke: { show: true, colors: [isDark ? '#1e293b' : '#ffffff'] },
        dataLabels: { enabled: false },
        plotOptions: { pie: { donut: { size: '75%', labels: { show: true, name: { show: true, color: textColor }, value: { show: true, color: isDark ? '#f8fafc' : '#0f172a', formatter: val => val } } } } },
        legend: { show: false }
    };
    chartEstoque = new ApexCharts(document.querySelector("#chart-estoque"), optionsEstoque);
    chartEstoque.render();

    // Fluxo de Inadimplência
    const optionsInad = {
        series: [],
        chart: { type: 'bar', height: 150, stacked: true, toolbar: { show: false }, background: 'transparent' },
        colors: ['#10b981', '#ef4444', '#f59e0b'],
        theme: { mode: isDark ? 'dark' : 'light' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, dataLabels: { total: { enabled: false } } } },
        stroke: { width: 1, colors: ['transparent'] },
        xaxis: { categories: ['Recebimentos'], labels: { style: { colors: textColor }, formatter: (val) => "R$ " + Number(val).toLocaleString('pt-BR') } },
        yaxis: { show: false },
        fill: { opacity: 1 },
        legend: { position: 'top', horizontalAlign: 'left' }
    };
    chartInadimplencia = new ApexCharts(document.querySelector("#chart-inadimplencia"), optionsInad);
    chartInadimplencia.render();
}

function renderizarGraficos() {
    if (!chartPrincipal || !chartEstoque || !chartInadimplencia) return;

    // ----------------------------------------------------
    // 1. GRÁFICO PRINCIPAL (Últimos 7 dias ou por mês se for ano)
    // ----------------------------------------------------
    const vendas = db.vendas || [];
    const contas = db.financeiro || [];
    
    // Gerar ultimos 7 dias
    let categorias = [];
    let dadosVendas = [];
    let dadosReceitas = [];
    let dadosDespesas = [];

    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];
        let diaMes = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        categorias.push(diaMes);

        // Vendas no dia
        let vDia = vendas.filter(v => v.data && v.data.startsWith(dateStr) && v.status !== 'Cancelada' && v.status !== 'Orçamento');
        let totalVenda = vDia.reduce((a, b) => a + (Number(b.totalFinal) || 0), 0);
        dadosVendas.push(totalVenda);

        // Receitas no dia (PAGAS)
        let rDia = contas.filter(c => (!c.tipo || c.tipo === 'RECEITA') && c.status === 'PAGO' && c.dataPgto && c.dataPgto.startsWith(dateStr));
        dadosReceitas.push(rDia.reduce((a, b) => a + (Number(b.valor) || 0), 0));

        // Despesas no dia (PAGAS)
        let dDia = contas.filter(c => c.tipo === 'DESPESA' && c.status === 'PAGO' && c.dataPgto && c.dataPgto.startsWith(dateStr));
        dadosDespesas.push(dDia.reduce((a, b) => a + (Number(b.valor) || 0), 0));
    }

    if (modoGraficoPrincipal === 'vendas') {
        chartPrincipal.updateOptions({ colors: ['#3b82f6'] });
        chartPrincipal.updateSeries([{ name: 'Vendas (R$)', data: dadosVendas }]);
    } else {
        chartPrincipal.updateOptions({ colors: ['#10b981', '#ef4444'] });
        chartPrincipal.updateSeries([
            { name: 'Receitas (R$)', data: dadosReceitas },
            { name: 'Despesas (R$)', data: dadosDespesas }
        ]);
    }
    chartPrincipal.updateOptions({ xaxis: { categories: categorias } });

    // ----------------------------------------------------
    // 2. GRÁFICO DE ESTOQUE (Top 5 Categorias)
    // ----------------------------------------------------
    const produtos = db.produtos || [];
    let categoriasMap = {};
    produtos.forEach(p => {
        const cat = p.categoria || 'Sem Categoria';
        const qtd = Number(p.quantidade) || 0;
        if (qtd > 0) {
            categoriasMap[cat] = (categoriasMap[cat] || 0) + qtd;
        }
    });
    
    // Sort and get top 5
    let sortedCats = Object.entries(categoriasMap).sort((a,b) => b[1] - a[1]);
    let topCats = sortedCats.slice(0, 5);
    let others = sortedCats.slice(5).reduce((a,b) => a + b[1], 0);
    
    let labelsEstoque = topCats.map(c => c[0]);
    let seriesEstoque = topCats.map(c => c[1]);
    if (others > 0) {
        labelsEstoque.push('Outros');
        seriesEstoque.push(others);
    }
    
    if(seriesEstoque.length === 0) { labelsEstoque = ['Vazio']; seriesEstoque = [1]; }
    
    chartEstoque.updateSeries(seriesEstoque);
    chartEstoque.updateOptions({ labels: labelsEstoque });

    // ----------------------------------------------------
    // 3. GRÁFICO DE INADIMPLÊNCIA VS PAGOS (Geral PENDENTES x ATRASADOS x PAGOS)
    // ----------------------------------------------------
    const hoje = new Date().getTime();
    const receber = contas.filter(c => (!c.tipo || c.tipo === 'RECEITA'));
    
    let totalPago = receber.filter(c => c.status === 'PAGO').reduce((a,b) => a + (Number(b.valor) || 0), 0);
    let totalAtrasado = receber.filter(c => c.status === 'PENDENTE' && c.data && new Date(c.data).getTime() < hoje).reduce((a,b) => a + (Number(b.valor) || 0), 0);
    let totalPendenteDia = receber.filter(c => c.status === 'PENDENTE' && c.data && new Date(c.data).getTime() >= hoje).reduce((a,b) => a + (Number(b.valor) || 0), 0);

    chartInadimplencia.updateSeries([
        { name: 'Recebidos', data: [totalPago] },
        { name: 'Em Atraso', data: [totalAtrasado] },
        { name: 'A Vencer', data: [totalPendenteDia] }
    ]);
}

window.onload = () => { 
    initGlobalData(inicializarDashboard); 
};