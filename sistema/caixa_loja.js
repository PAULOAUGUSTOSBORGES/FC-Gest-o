// caixa_loja.js

let chartResumo7Dias = null;
let chartPeriodoBar = null;
let chartPeriodoPie = null;
let chartProdutosTop = null;
let chartPagamentosBar = null;

let currentTab = 'resumo';
let currentPeriodType = 'hoje';

// Helper: seta propriedade de elemento com segurança (evita null errors)
function setEl(id, val, prop = 'textContent') {
    const el = document.getElementById(id);
    if (el) el[prop] = val;
}

// Cache of local data
let dbLoja = {
    vendas: [],
    financeiro: [],
    caixa_atual: null,
    caixas: [],
    caixa_fechamentos: [],
    produtos: [],
    clientes: [],
    funcionarios: []
};




window.addEventListener('load', () => {
    if (typeof initGlobalData === 'function') {
        initGlobalData(inicializarCaixaLoja);
    } else {
        console.error('global.js não carregado corretamente.');
    }
});

async function inicializarCaixaLoja() {
    try {
        await loadInitialData();

        // Set initial filters to current month (com guard para null)
        const hoje = new Date();
        const anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('filtro-vendas-mes', anoMes);
        setVal('filtro-pagamentos-mes', anoMes);
        setVal('filtro-produtos-mes', anoMes);
        setVal('filtro-vendedores-mes', anoMes);
        setVal('filtro-fechamentos-mes', anoMes);

        switchTab('resumo');
        listenCaixaAtual();
    } catch (e) {
        console.error('Erro na inicialização do Caixa da Loja:', e);
    }
}

async function loadInitialData() {
    const empresaRef = window.getEmpresaRef();
    if (!empresaRef) return;

    try {
        const [
            vendasSnap, 
            financeiroSnap, 
            fechamentosSnap, 
            produtosSnap, 
            clientesSnap, 
            funcionariosSnap,
            caixasSnap
        ] = await Promise.all([
            empresaRef.collection('vendas').get(),
            empresaRef.collection('financeiro').get(),
            empresaRef.collection('caixa_fechamentos').get(),
            empresaRef.collection('produtos').get(),
            empresaRef.collection('clientes').get(),
            empresaRef.collection('funcionarios').get(),
            empresaRef.collection('caixa').get()
        ]);

        dbLoja.vendas = vendasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoja.financeiro = financeiroSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoja.caixa_fechamentos = fechamentosSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.dataFechamento || 0) - new Date(a.dataFechamento || 0));
        dbLoja.produtos = produtosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoja.clientes = clientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoja.funcionarios = funcionariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        dbLoja.caixas = caixasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cxAtualDoc = dbLoja.caixas.find(c => c.id === 'caixa_atual') || dbLoja.caixas[0] || null;
        dbLoja.caixa_atual = cxAtualDoc;

        // Iniciar listeners em tempo real para refletir qualquer venda, conta paga ou movimentação imediatamente
        setupRealtimeListeners();

    } catch (e) {
        console.error("Erro ao carregar dados do caixa da loja:", e);
        if (typeof showToast === 'function') showToast("Erro ao carregar dados do sistema", "error");
    }
}

function setupRealtimeListeners() {
    const empresaRef = window.getEmpresaRef();
    if (!empresaRef) return;

    // Escuta vendas
    empresaRef.collection('vendas').onSnapshot(snap => {
        dbLoja.vendas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reRenderCurrentTab();
    }, err => console.warn('Erro listener vendas caixa loja:', err));

    // Escuta financeiro (contas a pagar quitadas e contas a receber recebidas)
    empresaRef.collection('financeiro').onSnapshot(snap => {
        dbLoja.financeiro = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reRenderCurrentTab();
    }, err => console.warn('Erro listener financeiro caixa loja:', err));

    // Escuta todos os caixas físicos da empresa
    empresaRef.collection('caixa').onSnapshot(snap => {
        dbLoja.caixas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cxAtualDoc = dbLoja.caixas.find(c => c.id === 'caixa_atual') || dbLoja.caixas[0] || null;
        dbLoja.caixa_atual = cxAtualDoc;
        reRenderCurrentTab();
    }, err => console.warn('Erro listener caixa físico loja:', err));
}

function listenCaixaAtual() {
    // Mantido por compatibilidade
}

function reRenderCurrentTab() {
    if (currentTab === 'resumo') renderTabResumo();
    else if (currentTab === 'periodo') renderTabPeriodo();
    else if (currentTab === 'vendas') renderTabVendas();
    else if (currentTab === 'pagamentos') renderTabPagamentos();
}
function switchTab(tabId) {
    currentTab = tabId;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('text-slate-500');
    });

    document.getElementById(`tab-content-${tabId}`).classList.remove('hidden');
    const btn = document.getElementById(`tab-btn-${tabId}`);
    if (btn) {
        btn.classList.add('bg-blue-600', 'text-white');
        btn.classList.remove('text-slate-500');
    }

    if (tabId === 'resumo') renderTabResumo();
    if (tabId === 'periodo') renderTabPeriodo();
    if (tabId === 'vendas') renderTabVendas();
    if (tabId === 'pagamentos') renderTabPagamentos();
    if (tabId === 'produtos') renderTabProdutos();
    if (tabId === 'vendedores') renderTabVendedores();
    if (tabId === 'fechamentos') renderTabFechamentos();
}

// ---------------------------------------------
// FILTER LOGIC
// ---------------------------------------------
function getPeriodDates(tipo, customStart, customEnd) {
    let inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    let fim = new Date();
    fim.setHours(23, 59, 59, 999);

    switch (tipo) {
        case 'hoje':
            break;
        case 'ontem':
            inicio.setDate(inicio.getDate() - 1);
            fim.setDate(fim.getDate() - 1);
            break;
        case 'semana':
            const diaSemana = inicio.getDay(); // 0 = Domingo
            inicio.setDate(inicio.getDate() - diaSemana);
            break;
        case 'semana_passada':
            const ds = inicio.getDay();
            inicio.setDate(inicio.getDate() - ds - 7);
            fim.setDate(fim.getDate() - fim.getDay() - 1);
            break;
        case 'mes':
            inicio.setDate(1);
            break;
        case 'mes_passado':
            inicio.setMonth(inicio.getMonth() - 1);
            inicio.setDate(1);
            fim.setDate(0); // Último dia do mês anterior
            break;
        case 'ano':
            inicio.setMonth(0, 1);
            break;
        case 'personalizado':
            if (customStart) {
                const parts = customStart.split('-');
                inicio = new Date(parts[0], parts[1] - 1, parts[2]);
                inicio.setHours(0, 0, 0, 0);
            }
            if (customEnd) {
                const parts = customEnd.split('-');
                fim = new Date(parts[0], parts[1] - 1, parts[2]);
                fim.setHours(23, 59, 59, 999);
            }
            break;
    }
    return { inicio, fim };
}

function filterByPeriod(array, dateField, tipo, customStart, customEnd) {
    const { inicio, fim } = getPeriodDates(tipo, customStart, customEnd);
    return array.filter(item => {
        if (!item[dateField]) return false;
        let d;
        if (item[dateField].toDate) { // Firestore Timestamp
            d = item[dateField].toDate();
        } else if (typeof item[dateField] === 'string') { // ISO string
            d = new Date(item[dateField]);
        } else {
            d = new Date(item[dateField]); // ms
        }
        return d >= inicio && d <= fim;
    });
}

function parseMonthInput(value) {
    if (!value) return null;
    const [ano, mes] = value.split('-');
    const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
    const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
    return { inicio, fim };
}

function filterByMonthRange(array, dateField, monthValue) {
    const range = parseMonthInput(monthValue);
    if (!range) return array;
    return array.filter(item => {
        if (!item[dateField]) return false;
        let d;
        if (item[dateField].toDate) {
            d = item[dateField].toDate();
        } else {
            d = new Date(item[dateField]);
        }
        return d >= range.inicio && d <= range.fim;
    });
}

// ---------------------------------------------
// TAB 1: RESUMO DO CAIXA (CONSOLIDADO COMPLETO DA LOJA)
// ---------------------------------------------
function renderTabResumo() {
    // 1. Vendas Pagas/Concluídas Hoje
    const vendasHoje = filterByPeriod(dbLoja.vendas, 'data', 'hoje').filter(v => {
        if (!v) return false;
        const st = String(v.status || '').toUpperCase();
        const tp = String(v.tipo || '').toUpperCase();
        return st !== 'CANCELADA' && st !== 'AGUARDANDO_PAGAMENTO' && tp !== 'ORÇAMENTO';
    });

    const vendasSemana = filterByPeriod(dbLoja.vendas, 'data', 'semana').filter(v => {
        if (!v) return false;
        const st = String(v.status || '').toUpperCase();
        const tp = String(v.tipo || '').toUpperCase();
        return st !== 'CANCELADA' && st !== 'AGUARDANDO_PAGAMENTO' && tp !== 'ORÇAMENTO';
    });

    // 2. Contas a Receber Pagas Hoje (Receitas financeiras quitadas, excluindo duplicidades de vendas)
    const receitasHoje = filterByPeriod(dbLoja.financeiro, 'dataPagamento', 'hoje').filter(f => {
        return f && f.tipo === 'RECEITA' && f.status === 'PAGO' && !f.origemVendaId;
    });

    // 3. Contas a Pagar Pagas Hoje (Despesas financeiras quitadas)
    const despesasHoje = filterByPeriod(dbLoja.financeiro, 'dataPagamento', 'hoje').filter(f => {
        return f && f.tipo === 'DESPESA' && f.status === 'PAGO';
    });

    // 4. Movimentações físicas de todos os Caixas da loja Hoje (Suprimentos e Sangrias)
    let todosHistoricos = [];
    let saldoTotalGavetas = 0;
    if (Array.isArray(dbLoja.caixas) && dbLoja.caixas.length > 0) {
        dbLoja.caixas.forEach(c => {
            if (c) {
                saldoTotalGavetas += (Number(c.saldo) || 0);
                if (Array.isArray(c.historico)) todosHistoricos = todosHistoricos.concat(c.historico);
            }
        });
    } else if (dbLoja.caixa_atual) {
        saldoTotalGavetas = Number(dbLoja.caixa_atual.saldo) || 0;
        if (Array.isArray(dbLoja.caixa_atual.historico)) todosHistoricos = dbLoja.caixa_atual.historico;
    }

    const histHoje = filterByPeriod(todosHistoricos, 'data', 'hoje');
    const suprimentosHoje = histHoje.filter(h => h.tipo === 'SUPRIMENTO' || h.tipo === 'ABERTURA').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);
    const sangriasHoje = histHoje.filter(h => h.tipo === 'SANGRIA').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);

    // Totais calculados
    const totalVendasHoje = vendasHoje.reduce((acc, v) => acc + (parseFloat(v.tot || v.subtotal || 0)), 0);
    const totalReceitasHoje = receitasHoje.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);
    const totalDespesasHoje = despesasHoje.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);

    // ENTRADAS HOJE = Todas as Vendas Concluídas + Todos os Títulos Recebidos + Suprimentos
    const entradasHoje = totalVendasHoje + totalReceitasHoje + suprimentosHoje;

    // SAÍDAS HOJE = Todas as Contas Pagas / Despesas Quitadas + Sangrias
    const saidasHoje = totalDespesasHoje + sangriasHoje;

    const totalVendasSemana = vendasSemana.reduce((acc, v) => acc + (parseFloat(v.tot || v.subtotal || 0)), 0);
    const ticketMedioHoje = vendasHoje.length > 0 ? (totalVendasHoje / vendasHoje.length) : 0;

    // Atualiza cards no DOM
    setEl('resumo-saldo', window.formatMoney ? window.formatMoney(saldoTotalGavetas) : `R$ ${saldoTotalGavetas.toFixed(2)}`);
    setEl('resumo-vendas-hoje', window.formatMoney ? window.formatMoney(totalVendasHoje) : `R$ ${totalVendasHoje.toFixed(2)}`);
    setEl('resumo-entradas-hoje', window.formatMoney ? window.formatMoney(entradasHoje) : `R$ ${entradasHoje.toFixed(2)}`);
    setEl('resumo-saidas-hoje', window.formatMoney ? window.formatMoney(saidasHoje) : `R$ ${saidasHoje.toFixed(2)}`);
    setEl('resumo-vendas-semana', window.formatMoney ? window.formatMoney(totalVendasSemana) : `R$ ${totalVendasSemana.toFixed(2)}`);
    setEl('resumo-ticket-hoje', window.formatMoney ? window.formatMoney(ticketMedioHoje) : `R$ ${ticketMedioHoje.toFixed(2)}`);
    setEl('resumo-qtd-vendas', vendasHoje.length);

    // Formas de Pagamento recebidas hoje
    const formas = {};
    vendasHoje.forEach(v => {
        const pag = v.pag || 'Dinheiro';
        formas[pag] = (formas[pag] || 0) + (parseFloat(v.tot || v.subtotal || 0));
    });
    receitasHoje.forEach(f => {
        const pag = f.metodoPagamento || 'Outros';
        formas[pag] = (formas[pag] || 0) + (parseFloat(f.valorPago || f.valor || 0));
    });

    let topPgto = '-';
    let maxPgto = 0;
    for (const [p, val] of Object.entries(formas)) {
        if (val > maxPgto) {
            maxPgto = val;
            topPgto = p;
        }
    }
    setEl('resumo-top-pagamento', topPgto);

    // Mini chart 7 dias de vendas
    const vendas7Dias = [];
    const labels7Dias = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels7Dias.push(`${d.getDate()}/${d.getMonth()+1}`);
        
        const dStart = new Date(d); dStart.setHours(0,0,0,0);
        const dEnd = new Date(d); dEnd.setHours(23,59,59,999);
        
        const vs = dbLoja.vendas.filter(v => {
            if (!v || !v.data || v.status === 'CANCELADA' || v.status === 'AGUARDANDO_PAGAMENTO' || v.tipo === 'ORÇAMENTO') return false;
            const vd = new Date(v.data.toDate ? v.data.toDate() : v.data);
            return vd >= dStart && vd <= dEnd;
        });
        const sum = vs.reduce((acc, v) => acc + (parseFloat(v.tot || v.subtotal || 0)), 0);
        vendas7Dias.push(sum);
    }

    const ctxEl_chartResumo7Dias = document.getElementById('chart-resumo-7dias');
    if (ctxEl_chartResumo7Dias) {
        if (chartResumo7Dias) chartResumo7Dias.destroy();
        chartResumo7Dias = new Chart(ctxEl_chartResumo7Dias.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels7Dias,
                datasets: [{
                    label: 'Vendas (R$)',
                    data: vendas7Dias,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}
// TAB 2: RELATÓRIO POR PERÍODO
// ---------------------------------------------
function mudarPeriodo(tipo) {
    currentPeriodType = tipo;
    
    document.querySelectorAll('.btn-periodo').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-600', 'text-white');
        btn.classList.add('text-slate-600', 'dark:text-slate-300');
    });
    const target = Array.from(document.querySelectorAll('.btn-periodo')).find(b => b.textContent.toLowerCase().includes(tipo.replace('_', ' ')));
    if (target) {
        target.classList.add('bg-blue-600', 'text-white', 'active');
        target.classList.remove('text-slate-600', 'dark:text-slate-300');
    }

    if (tipo === 'personalizado') {
        document.getElementById('periodo-custom-inputs').classList.remove('hidden');
        document.getElementById('periodo-custom-inputs').classList.add('flex');
    } else {
        document.getElementById('periodo-custom-inputs').classList.add('hidden');
        document.getElementById('periodo-custom-inputs').classList.remove('flex');
        renderTabPeriodo();
    }
}

function renderTabPeriodo() {
    const cIni = document.getElementById('data-inicio-periodo')?.value;
    const cFim = document.getElementById('data-fim-periodo')?.value;
    
    // 1. Vendas Pagas/Concluídas no período
    const vendasPeriodo = filterByPeriod(dbLoja.vendas, 'data', currentPeriodType, cIni, cFim).filter(v => {
        if (!v) return false;
        const st = String(v.status || '').toUpperCase();
        const tp = String(v.tipo || '').toUpperCase();
        return st !== 'CANCELADA' && st !== 'AGUARDANDO_PAGAMENTO' && tp !== 'ORÇAMENTO';
    });

    // 2. Contas a Receber quitadas no período (sem duplicar com vendas)
    const receitasPeriodo = filterByPeriod(dbLoja.financeiro, 'dataPagamento', currentPeriodType, cIni, cFim).filter(f => {
        return f && f.tipo === 'RECEITA' && f.status === 'PAGO' && !f.origemVendaId;
    });

    // 3. Contas a Pagar quitadas no período (todas as despesas pagas)
    const despesasPeriodo = filterByPeriod(dbLoja.financeiro, 'dataPagamento', currentPeriodType, cIni, cFim).filter(f => {
        return f && f.tipo === 'DESPESA' && f.status === 'PAGO';
    });

    // 4. Histórico de todos os caixas e fechamentos no período (Suprimentos e Sangrias)
    let todosHist = [];
    if (Array.isArray(dbLoja.caixa_fechamentos)) {
        dbLoja.caixa_fechamentos.forEach(fc => {
            if (Array.isArray(fc.historico)) todosHist = todosHist.concat(fc.historico);
        });
    }
    if (Array.isArray(dbLoja.caixas)) {
        dbLoja.caixas.forEach(c => {
            if (Array.isArray(c.historico)) todosHist = todosHist.concat(c.historico);
        });
    } else if (dbLoja.caixa_atual && Array.isArray(dbLoja.caixa_atual.historico)) {
        todosHist = todosHist.concat(dbLoja.caixa_atual.historico);
    }

    const historicoPeriodo = filterByPeriod(todosHist, 'data', currentPeriodType, cIni, cFim);
    const suprimentosPeriodo = historicoPeriodo.filter(h => h.tipo === 'SUPRIMENTO').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);
    const sangriasPeriodo = historicoPeriodo.filter(h => h.tipo === 'SANGRIA').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);

    // Valores totais
    const totalVendas = vendasPeriodo.reduce((acc, v) => acc + (parseFloat(v.tot || v.subtotal || 0)), 0);
    const totalReceitas = receitasPeriodo.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);
    const totalDespesas = despesasPeriodo.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);

    // ENTRADAS (TODO TIPO DE RECEBIDO): Vendas + Títulos Recebidos + Suprimentos
    const totalEntradas = totalVendas + totalReceitas + suprimentosPeriodo;

    // SAÍDAS (TODO TIPO DE CONTA PAGA): Contas Pagas / Despesas + Sangrias
    const totalSaidas = totalDespesas + sangriasPeriodo;

    // RESULTADO / LUCRO OPERACIONAL DO PERÍODO
    const lucroOperacional = totalEntradas - totalSaidas;
    const ticket = vendasPeriodo.length > 0 ? (totalVendas / vendasPeriodo.length) : 0;

    setEl('rp-qtd-vendas', vendasPeriodo.length);
    setEl('rp-total-vendas', window.formatMoney ? window.formatMoney(totalVendas) : `R$ ${totalVendas.toFixed(2)}`);
    setEl('rp-total-entradas', window.formatMoney ? window.formatMoney(totalEntradas) : `R$ ${totalEntradas.toFixed(2)}`);
    setEl('rp-total-saidas', window.formatMoney ? window.formatMoney(totalSaidas) : `R$ ${totalSaidas.toFixed(2)}`);
    setEl('rp-lucro-bruto', window.formatMoney ? window.formatMoney(lucroOperacional) : `R$ ${lucroOperacional.toFixed(2)}`);
    setEl('rp-ticket-medio', window.formatMoney ? window.formatMoney(ticket) : `R$ ${ticket.toFixed(2)}`);

    // Extrato Consolidado Detalhado do Período
    const combined = [];

    // Vendas
    vendasPeriodo.forEach(v => {
        const num = String(v.numeroPedido || v.id || '').substring(0, 6);
        const cli = v.clienteNome || v.cliente || 'Consumidor Final';
        combined.push({
            data: new Date(v.data.toDate ? v.data.toDate() : v.data),
            tipo: 'Venda',
            desc: `Venda #${num} - ${cli}`,
            pag: v.pag || 'Dinheiro',
            valor: parseFloat(v.tot || v.subtotal || 0),
            isEntrada: true
        });
    });

    // Títulos Recebidos (Contas a Receber)
    receitasPeriodo.forEach(f => {
        combined.push({
            data: new Date(f.dataPagamento ? f.dataPagamento : (f.data.toDate ? f.data.toDate() : f.data)),
            tipo: 'Recebimento',
            desc: `Recbto. Título: ${f.pessoa || 'Cliente'} (${f.categoria || 'Vendas'})`,
            pag: f.metodoPagamento || 'Outros',
            valor: parseFloat(f.valorPago || f.valor || 0),
            isEntrada: true
        });
    });

    // Contas Pagas (Contas a Pagar / Despesas da loja)
    despesasPeriodo.forEach(f => {
        combined.push({
            data: new Date(f.dataPagamento ? f.dataPagamento : (f.data.toDate ? f.data.toDate() : f.data)),
            tipo: 'Conta Paga',
            desc: `Pgto. Título: ${f.pessoa || 'Fornecedor'} (${f.categoria || 'Despesa'})`,
            pag: f.metodoPagamento || 'Outros',
            valor: -Math.abs(parseFloat(f.valorPago || f.valor || 0)),
            isEntrada: false
        });
    });

    // Suprimentos do caixa
    historicoPeriodo.filter(h => h.tipo === 'SUPRIMENTO').forEach(h => {
        combined.push({
            data: new Date(h.data.toDate ? h.data.toDate() : h.data),
            tipo: 'Suprimento',
            desc: `Suprimento Caixa: ${h.desc || h.descricao || 'Entrada manual'}`,
            pag: 'Dinheiro',
            valor: Math.abs(Number(h.valor || 0)),
            isEntrada: true
        });
    });

    // Sangrias do caixa
    historicoPeriodo.filter(h => h.tipo === 'SANGRIA').forEach(h => {
        combined.push({
            data: new Date(h.data.toDate ? h.data.toDate() : h.data),
            tipo: 'Sangria',
            desc: `Sangria Caixa: ${h.desc || h.descricao || 'Retirada manual'}`,
            pag: 'Dinheiro',
            valor: -Math.abs(Number(h.valor || 0)),
            isEntrada: false
        });
    });

    // Ordenar decrescente por data
    combined.sort((a, b) => b.data - a.data);

    const tbody = document.getElementById('tabela-periodo-extrato');
    if (tbody) {
        tbody.innerHTML = '';
        combined.forEach(item => {
            const d = item.data;
            const dataStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            const cor = item.valor >= 0 ? 'text-emerald-600' : 'text-red-600';
            let badgeBg = 'bg-slate-200 text-slate-700';
            if (item.tipo === 'Venda') badgeBg = 'bg-emerald-100 text-emerald-800';
            else if (item.tipo === 'Recebimento') badgeBg = 'bg-blue-100 text-blue-800';
            else if (item.tipo === 'Conta Paga') badgeBg = 'bg-red-100 text-red-800';
            else if (item.tipo === 'Suprimento') badgeBg = 'bg-teal-100 text-teal-800';
            else if (item.tipo === 'Sangria') badgeBg = 'bg-amber-100 text-amber-800';
            
            tbody.innerHTML += `
                <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="p-3 text-slate-600 dark:text-slate-300 font-mono text-xs">${dataStr}</td>
                    <td class="p-3 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${badgeBg}">${item.tipo}</span></td>
                    <td class="p-3 text-slate-700 dark:text-slate-200 truncate max-w-xs font-medium">${item.desc}</td>
                    <td class="p-3 text-slate-500 text-xs font-semibold">${item.pag}</td>
                    <td class="p-3 text-right font-black ${cor}">${item.valor >= 0 ? '+' : ''}${window.formatMoney ? window.formatMoney(item.valor) : 'R$ ' + item.valor.toFixed(2)}</td>
                </tr>
            `;
        });

        if (combined.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500">Nenhuma movimentação no período</td></tr>';
        }
    }

    // Gráficos da Tab Período
    const formas = {};
    const dias = {};
    vendasPeriodo.forEach(v => {
        const pag = v.pag || 'Dinheiro';
        formas[pag] = (formas[pag] || 0) + parseFloat(v.tot || v.subtotal || 0);
        
        const d = new Date(v.data.toDate ? v.data.toDate() : v.data);
        const dStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        dias[dStr] = (dias[dStr] || 0) + parseFloat(v.tot || v.subtotal || 0);
    });

    const ctxEl_chartPeriodoPie = document.getElementById('chart-periodo-pie');
    if (ctxEl_chartPeriodoPie) {
        if (chartPeriodoPie) chartPeriodoPie.destroy();
        chartPeriodoPie = new Chart(ctxEl_chartPeriodoPie.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(formas),
                datasets: [{
                    data: Object.values(formas),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#ef4444', '#06b6d4']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }

    const sortedDias = Object.keys(dias).sort((a, b) => {
        const [da, ma] = a.split('/');
        const [db, mb] = b.split('/');
        return new Date(2020, ma-1, da) - new Date(2020, mb-1, db);
    });

    const ctxEl_chartPeriodoBar = document.getElementById('chart-periodo-bar');
    if (ctxEl_chartPeriodoBar) {
        if (chartPeriodoBar) chartPeriodoBar.destroy();
        chartPeriodoBar = new Chart(ctxEl_chartPeriodoBar.getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedDias,
                datasets: [{
                    label: 'Vendas (R$)',
                    data: sortedDias.map(k => dias[k]),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}
function imprimirRelatorio(areaId) {
    const area = document.getElementById(areaId);
    if (!area) return;
    document.getElementById('titulo-impressao-periodo').classList.remove('hidden');
    window.print();
    document.getElementById('titulo-impressao-periodo').classList.add('hidden');
}

function baixarPDFRelatorio(areaId, filename) {
    const el = document.getElementById(areaId);
    if (!el) return;
    const opt = {
        margin: 10,
        filename: `${filename}_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(el).save();
}

function exportarCSVPeriodo() {
    const table = document.getElementById('tabela-periodo-extrato');
    exportarTabelaCSV(table, 'Relatorio_Periodo');
}

// ---------------------------------------------
// TAB 3: VENDAS DETALHADAS
// ---------------------------------------------
function renderTabVendas() {
    const mes = document.getElementById('filtro-vendas-mes').value;
    const busca = document.getElementById('filtro-vendas-busca').value.toLowerCase();
    
    let vendasFiltradas = filterByMonthRange(dbLoja.vendas, 'data', mes);
    
    if (busca) {
        vendasFiltradas = vendasFiltradas.filter(v => 
            (v.cliente && v.cliente.toLowerCase().includes(busca)) ||
            (v.id && v.id.toLowerCase().includes(busca)) ||
            (v.vendedor && v.vendedor.toLowerCase().includes(busca))
        );
    }
    
    vendasFiltradas.sort((a,b) => {
        const da = a.data.toDate ? a.data.toDate() : new Date(a.data);
        const db = b.data.toDate ? b.data.toDate() : new Date(b.data);
        return db - da;
    });

    const tbody = document.getElementById('tabela-vendas-detalhadas');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;

    vendasFiltradas.forEach(v => {
        const d = v.data.toDate ? v.data.toDate() : new Date(v.data);
        const dataStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const val = parseFloat(v.tot || v.subtotal || 0);
        total += val;
        
        let statusBadge = `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">CONCLUÍDO</span>`;
        if (v.status === 'CANCELADA') statusBadge = `<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">CANCELADA</span>`;
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                <td class="p-3 text-slate-600 dark:text-slate-300">${dataStr}</td>
                <td class="p-3 text-slate-700 dark:text-slate-200 font-medium">#${v.id.substring(0,6).toUpperCase()}</td>
                <td class="p-3 text-slate-700 dark:text-slate-200">${v.cliente || 'Consumidor Final'}</td>
                <td class="p-3 text-slate-500">${v.pag || '-'}</td>
                <td class="p-3 text-slate-500">${v.vendedor || '-'}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-right font-black text-slate-700 dark:text-white">${window.formatMoney ? window.formatMoney(val) : `R$ ${val.toFixed(2)}`}</td>
                <td class="p-3 text-center">
                    <button onclick="verDetalheVenda('${v.id}')" class="text-blue-600 hover:text-blue-800 p-1"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>
        `;
    });
    
    if (vendasFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500">Nenhuma venda encontrada para os filtros</td></tr>`;
    }

    setEl('rodape-vendas-total', window.formatMoney ? window.formatMoney(total) : `R$ ${total.toFixed(2)}`);
}

function verDetalheVenda(id) {
    const v = dbLoja.vendas.find(x => x.id === id);
    if (!v) return;

    const d = v.data.toDate ? v.data.toDate() : new Date(v.data);
    const dataStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    let itensHtml = '';
    if (v.itens && v.itens.length > 0) {
        v.itens.forEach(i => {
            const val = parseFloat(i.precoUnit || i.preco || 0);
            const total = val * (i.qtd || 1);
            itensHtml += `
                <tr class="border-b border-slate-200 dark:border-slate-700">
                    <td class="py-2 text-sm text-slate-700 dark:text-slate-200">${i.nome || 'Produto'}</td>
                    <td class="py-2 text-sm text-center text-slate-700 dark:text-slate-200">${i.qtd || 1}</td>
                    <td class="py-2 text-sm text-right text-slate-700 dark:text-slate-200">${window.formatMoney ? window.formatMoney(val) : val.toFixed(2)}</td>
                    <td class="py-2 text-sm text-right font-bold text-slate-700 dark:text-slate-200">${window.formatMoney ? window.formatMoney(total) : total.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    const html = `
        <div class="space-y-4">
            <div class="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                    <p class="text-xs text-slate-500 uppercase font-bold">Venda</p>
                    <p class="text-lg font-black text-slate-800 dark:text-white">#${v.id.substring(0,8).toUpperCase()}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-bold">Data/Hora</p>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${dataStr}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                    <p class="text-xs text-slate-500 uppercase font-bold">Cliente</p>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${v.cliente || 'Consumidor Final'}</p>
                </div>
                <div class="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                    <p class="text-xs text-slate-500 uppercase font-bold">Vendedor</p>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${v.vendedor || '-'}</p>
                </div>
            </div>

            <div class="mt-4">
                <h4 class="font-bold text-slate-700 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Itens</h4>
                <table class="w-full text-left">
                    <thead>
                        <tr class="text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                            <th class="pb-2">Produto</th>
                            <th class="pb-2 text-center">Qtd</th>
                            <th class="pb-2 text-right">V. Unit</th>
                            <th class="pb-2 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itensHtml}</tbody>
                </table>
            </div>

            <div class="flex justify-end gap-6 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-bold">Forma Pagto</p>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${v.pag || '-'}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-bold">Subtotal</p>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${window.formatMoney ? window.formatMoney(parseFloat(v.subtotal || v.tot || 0)) : (v.subtotal||0).toFixed(2)}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-bold">Total</p>
                    <p class="text-xl font-black text-blue-600">${window.formatMoney ? window.formatMoney(parseFloat(v.tot || v.subtotal || 0)) : (v.tot||0).toFixed(2)}</p>
                </div>
            </div>
        </div>
    `;

    setEl('modal-venda-conteudo', html, 'innerHTML');
    document.getElementById('modal-detalhe-venda').classList.remove('hidden');
}

function exportarCSVVendas() {
    exportarTabelaCSV(document.getElementById('tabela-vendas-detalhadas').parentElement.parentElement.querySelector('table'), 'Relatorio_Vendas');
}

// ---------------------------------------------
// TAB 4: PAGAMENTOS
// ---------------------------------------------
function renderTabPagamentos() {
    const mes = document.getElementById('filtro-pagamentos-mes').value;
    const vendasFiltradas = filterByMonthRange(dbLoja.vendas, 'data', mes);
    
    const pgtos = {};
    let totalGeral = 0;
    
    vendasFiltradas.forEach(v => {
        const p = v.pag || 'Outros';
        const val = parseFloat(v.tot || v.subtotal || 0);
        if (!pgtos[p]) pgtos[p] = { count: 0, val: 0 };
        pgtos[p].count += 1;
        pgtos[p].val += val;
        totalGeral += val;
    });

    const container = document.getElementById('cards-pagamentos');
    container.innerHTML = '';
    
    const labels = [];
    const data = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#06b6d4'];
    let cIdx = 0;

    Object.keys(pgtos).sort((a,b) => pgtos[b].val - pgtos[a].val).forEach(p => {
        const perc = totalGeral > 0 ? ((pgtos[p].val / totalGeral) * 100).toFixed(1) : 0;
        
        container.innerHTML += `
            <div class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
                <p class="text-xs font-bold text-slate-500 uppercase truncate" title="${p}">${p}</p>
                <h3 class="text-xl font-black text-slate-800 dark:text-white mt-1">${window.formatMoney ? window.formatMoney(pgtos[p].val) : `R$ ${pgtos[p].val.toFixed(2)}`}</h3>
                <div class="flex justify-between items-center mt-2 text-xs">
                    <span class="text-slate-500">${pgtos[p].count} transações</span>
                    <span class="font-bold text-blue-600">${perc}%</span>
                </div>
            </div>
        `;

        labels.push(p);
        data.push(pgtos[p].val);
    });

    const ctxEl_chartPagamentosBar = document.getElementById('chart-pagamentos-bar');
    if (ctxEl_chartPagamentosBar) {
        if (chartPagamentosBar) chartPagamentosBar.destroy();
        chartPagamentosBar = new Chart(ctxEl_chartPagamentosBar.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor (R$)',
                data: data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }});
    }
}

// ---------------------------------------------
// TAB 5: PRODUTOS
// ---------------------------------------------
function renderTabProdutos() {
    const mes = document.getElementById('filtro-produtos-mes').value;
    const vendasFiltradas = filterByMonthRange(dbLoja.vendas, 'data', mes);
    
    const prodStats = {};
    let totalVendido = 0;
    
    vendasFiltradas.forEach(v => {
        if (v.itens && Array.isArray(v.itens)) {
            v.itens.forEach(i => {
                const id = i.produtoId || i.id || i.nome;
                const nome = i.nome || 'Desconhecido';
                const qtd = parseFloat(i.qtd || 1);
                const val = parseFloat(i.precoUnit || i.preco || 0) * qtd;
                
                if (!prodStats[id]) prodStats[id] = { nome, qtd: 0, val: 0 };
                prodStats[id].qtd += qtd;
                prodStats[id].val += val;
                totalVendido += val;
            });
        }
    });

    const arrayProd = Object.values(prodStats).sort((a,b) => b.val - a.val);

    const tbody = document.getElementById('tabela-produtos-ranking');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    arrayProd.forEach(p => {
        const perc = totalVendido > 0 ? ((p.val / totalVendido) * 100).toFixed(1) : 0;
        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50">
                <td class="p-3 text-slate-700 dark:text-slate-200 font-medium">${p.nome}</td>
                <td class="p-3 text-right text-slate-600 dark:text-slate-300">${p.qtd}</td>
                <td class="p-3 text-right font-bold text-slate-800 dark:text-white">${window.formatMoney ? window.formatMoney(p.val) : `R$ ${p.val.toFixed(2)}`}</td>
                <td class="p-3 text-right text-blue-600 font-bold">${perc}%</td>
            </tr>
        `;
    });

    if (arrayProd.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Nenhum produto vendido no período</td></tr>`;
    }

    const top10 = arrayProd.slice(0, 10);
    
    const ctxEl_chartProdutosTop = document.getElementById('chart-produtos-top');
    if (ctxEl_chartProdutosTop) {
        if (chartProdutosTop) chartProdutosTop.destroy();
        chartProdutosTop = new Chart(ctxEl_chartProdutosTop.getContext('2d'), {
        type: 'bar',
        data: {
            labels: top10.map(p => p.nome.substring(0, 15) + (p.nome.length>15?'...':'')),
            datasets: [{
                label: 'Valor Vendido',
                data: top10.map(p => p.val),
                backgroundColor: '#10b981',
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y',
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } } 
        }});
    }
}

function exportarCSVProdutos() {
    exportarTabelaCSV(document.getElementById('tabela-produtos-ranking').parentElement, 'Relatorio_Produtos');
}

// ---------------------------------------------
// TAB 6: VENDEDORES
// ---------------------------------------------
function renderTabVendedores() {
    const mes = document.getElementById('filtro-vendedores-mes').value;
    const vendasFiltradas = filterByMonthRange(dbLoja.vendas, 'data', mes);
    
    const vendStats = {};
    let totalGeral = 0;
    
    vendasFiltradas.forEach(v => {
        const vend = v.vendedor || 'Sem Vendedor';
        const val = parseFloat(v.tot || v.subtotal || 0);
        
        if (!vendStats[vend]) vendStats[vend] = { nome: vend, count: 0, val: 0 };
        vendStats[vend].count += 1;
        vendStats[vend].val += val;
        totalGeral += val;
    });

    const arrVend = Object.values(vendStats).sort((a,b) => b.val - a.val);

    const cardsContainer = document.getElementById('cards-vendedores');
    cardsContainer.innerHTML = '';
    
    const tbody = document.getElementById('tabela-vendedores-ranking');
    if (!tbody) return;
    tbody.innerHTML = '';

    arrVend.forEach((v, index) => {
        const perc = totalGeral > 0 ? ((v.val / totalGeral) * 100).toFixed(1) : 0;
        const ticket = v.count > 0 ? (v.val / v.count) : 0;
        
        if (index < 4) { // Top 4 in cards
            cardsContainer.innerHTML += `
                <div class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">${index + 1}</div>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">${v.nome}</p>
                    </div>
                    <h3 class="text-xl font-black text-emerald-600">${window.formatMoney ? window.formatMoney(v.val) : `R$ ${v.val.toFixed(2)}`}</h3>
                    <p class="text-xs text-slate-500 mt-1">${v.count} vendas | ${perc}% do total</p>
                </div>
            `;
        }

        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50">
                <td class="p-3 text-center font-bold text-slate-500">${index + 1}º</td>
                <td class="p-3 text-slate-700 dark:text-slate-200 font-medium">${v.nome}</td>
                <td class="p-3 text-center text-slate-600 dark:text-slate-300">${v.count}</td>
                <td class="p-3 text-right text-slate-600 dark:text-slate-300">${window.formatMoney ? window.formatMoney(ticket) : `R$ ${ticket.toFixed(2)}`}</td>
                <td class="p-3 text-right font-bold text-slate-800 dark:text-white">${window.formatMoney ? window.formatMoney(v.val) : `R$ ${v.val.toFixed(2)}`}</td>
            </tr>
        `;
    });

    if (arrVend.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Nenhuma venda encontrada</td></tr>`;
    }
}

// ---------------------------------------------
// TAB 7: FECHAMENTOS
// ---------------------------------------------
function renderTabFechamentos() {
    const mes = document.getElementById('filtro-fechamentos-mes').value;
    const fechamentosFiltrados = filterByMonthRange(dbLoja.caixa_fechamentos, 'dataFechamento', mes);
    
    fechamentosFiltrados.sort((a,b) => {
        const da = a.dataFechamento.toDate ? a.dataFechamento.toDate() : new Date(a.dataFechamento);
        const db = b.dataFechamento.toDate ? b.dataFechamento.toDate() : new Date(b.dataFechamento);
        return db - da;
    });

    const tbody = document.getElementById('tabela-historico-fechamentos');
    if (!tbody) return;
    tbody.innerHTML = '';

    fechamentosFiltrados.forEach(f => {
        const d = f.dataFechamento.toDate ? f.dataFechamento.toDate() : new Date(f.dataFechamento);
        const dataStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        
        const totSis = parseFloat(f.totalSistema || 0);
        const totDec = parseFloat(f.totalDeclarado || 0);
        const dif = totDec - totSis;
        
        let status = `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">CONCILIADO</span>`;
        if (Math.abs(dif) > 0.1) {
            if (dif > 0) status = `<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">SOBRA</span>`;
            else status = `<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">QUEBRA</span>`;
        }

        const difColor = dif > 0.1 ? 'text-emerald-600' : (dif < -0.1 ? 'text-red-600' : 'text-slate-500');

        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                <td class="p-3 text-slate-600 dark:text-slate-300">${dataStr}</td>
                <td class="p-3 text-slate-700 dark:text-slate-200">${f.operador || 'Sistema'}</td>
                <td class="p-3 text-right">${window.formatMoney ? window.formatMoney(totSis) : totSis.toFixed(2)}</td>
                <td class="p-3 text-right font-medium">${window.formatMoney ? window.formatMoney(totDec) : totDec.toFixed(2)}</td>
                <td class="p-3 text-right font-bold ${difColor}">${window.formatMoney ? window.formatMoney(dif) : dif.toFixed(2)}</td>
                <td class="p-3 text-center">${status}</td>
                <td class="p-3 text-center">
                    <button onclick="verMapaFechamento('${f.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded font-bold text-xs"><i class="fa-solid fa-receipt mr-1"></i> Mapa</button>
                </td>
            </tr>
        `;
    });

    if (fechamentosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">Nenhum fechamento no período selecionado</td></tr>`;
    }
}

function verMapaFechamento(id) {
    const fechamento = dbLoja.caixa_fechamentos.find(f => f.id === id);
    if (!fechamento) return;
    
    // Check if renderizarMapaCaixaHTML exists globally (from caixa.js)
    if (typeof window.renderizarMapaCaixaHTML === 'function') {
        const html = window.renderizarMapaCaixaHTML(fechamento);
        setEl('mapa-caixa-conteudo', html, 'innerHTML');
        document.getElementById('modal-mapa-caixa').classList.remove('hidden');
    } else {
        showToast("Função de mapa não encontrada", "warning");
    }
}

// ---------------------------------------------
// UTILS
// ---------------------------------------------
function exportarTabelaCSV(tableEl, filename) {
    if (!tableEl) return;
    let csv = [];
    const rows = tableEl.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').trim();
            data = data.replace(/"/g, '""');
            row.push('"' + data + '"');
        }
        csv.push(row.join(';'));
    }

    const csvFile = new Blob(["\uFEFF"+csv.join('\n')], {type: "text/csv;charset=utf-8;"});
    const downloadLink = document.createElement("a");
    downloadLink.download = filename + '_' + new Date().getTime() + '.csv';
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// ---------------------------------------------
// OPERAÇÕES DO CAIXA (ABERTURA, SANGRIA, SUPRIMENTO)
// ---------------------------------------------
function abrirModalCaixa(op) {
    op = (op || 'abrir').toLowerCase();
    const cxStatus = dbLoja.caixa_atual?.status || 'FECHADO';
    if (op === 'abrir' && cxStatus === 'ABERTO') {
        if (typeof showToast === 'function') showToast('O caixa já está aberto!', 'warning');
        return;
    }
    if (op !== 'abrir' && cxStatus === 'FECHADO') {
        if (typeof showToast === 'function') showToast('Abra o caixa primeiro!', 'warning');
        return;
    }

    const tipoEl = document.getElementById('caixa-operacao-tipo');
    if (tipoEl) tipoEl.value = op.toUpperCase();

    const titleEl = document.getElementById('modal-caixa-title');
    if (titleEl) {
        titleEl.innerText = op === 'abrir' ? 'Abertura de Caixa' : (op === 'fechar' ? 'Fechamento de Caixa' : (op === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'));
    }

    const valorEl = document.getElementById('caixa-op-valor');
    const descEl = document.getElementById('caixa-op-desc');
    if (valorEl) valorEl.value = '';
    if (descEl) descEl.value = op === 'abrir' ? 'Troco Inicial' : '';

    const modal = document.getElementById('modal-mov-caixa');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalCaixa() {
    const modal = document.getElementById('modal-mov-caixa');
    if (modal) modal.classList.add('hidden');
}

async function confirmarMovCaixa() {
    const tipoEl = document.getElementById('caixa-operacao-tipo');
    const valorEl = document.getElementById('caixa-op-valor');
    const descEl = document.getElementById('caixa-op-desc');

    const op = tipoEl ? tipoEl.value : 'ABRIR';
    const val = typeof parseInputMoney === 'function' ? parseInputMoney(valorEl ? valorEl.value : '0') : parseFloat(valorEl?.value || 0);
    const desc = (descEl && descEl.value) ? descEl.value.trim() : op;

    let cxAtual = dbLoja.caixa_atual || { status: 'FECHADO', saldo: 0, historico: [] };
    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
    let novoStatus = cxAtual.status || 'FECHADO';
    let novoSaldo = cxAtual.saldo || 0;
    const dataIso = new Date().toISOString();
    const operadorNome = window.currentUserInfo?.nome || 'Operador Caixa';

    if (op === 'ABRIR') {
        novoStatus = 'ABERTO';
        novoSaldo = val;
        cxHistoricoNovo.unshift({
            data: dataIso,
            tipo: 'ABERTURA',
            desc: `Abertura de Caixa (Troco Inicial: ${window.formatMoney ? window.formatMoney(val) : 'R$ ' + val}) - Op: ${operadorNome}`,
            valor: val,
            operador: operadorNome,
            saldoApos: novoSaldo
        });
    } else if (op === 'SANGRIA') {
        if (val > novoSaldo) {
            if (typeof showToast === 'function') showToast('Saldo em dinheiro insuficiente para sangria!', 'error');
            return;
        }
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
        const empresaRef = window.getEmpresaRef();
        if (!empresaRef) return;
        const targetCaixaRef = (typeof window.obterCaixaDocRef === 'function') ? window.obterCaixaDocRef() : empresaRef.collection('caixa').doc('caixa_atual');
        await targetCaixaRef.set({
            ...cxAtual,
            status: novoStatus,
            saldo: novoSaldo,
            historico: cxHistoricoNovo,
            ultimaAbertura: op === 'ABRIR' ? dataIso : (cxAtual.ultimaAbertura || dataIso),
            operadorAtual: op === 'ABRIR' ? operadorNome : (cxAtual.operadorAtual || operadorNome)
        }, { merge: true });

        fecharModalCaixa();
        if (typeof showToast === 'function') showToast(`Operação de ${op} realizada com sucesso!`, 'success');
    } catch(err) {
        console.error('Erro na movimentação do caixa:', err);
        if (typeof showToast === 'function') showToast('Erro ao registrar operação no caixa.', 'error');
    }
}

// ---------------------------------------------
// FECHAMENTO CEGO
// ---------------------------------------------
function abrirModalFechamentoCego() {
    const cxStatus = dbLoja.caixa_atual?.status || 'FECHADO';
    if (cxStatus !== 'ABERTO') {
        if (typeof showToast === 'function') showToast('O caixa já está FECHADO!', 'warning');
        return;
    }
    const ids = ['fc-dinheiro', 'fc-debito', 'fc-credito', 'fc-pix', 'fc-outros', 'fc-obs'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const disp = document.getElementById('fc-total-declarado-display');
    if (disp) disp.innerText = 'R$ 0,00';
    const modal = document.getElementById('modal-fechamento-cego');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalFechamentoCego() {
    const modal = document.getElementById('modal-fechamento-cego');
    if (modal) modal.classList.add('hidden');
}

function recalcularTotalDeclarado() {
    const getVal = id => {
        const el = document.getElementById(id);
        if (!el) return 0;
        return typeof parseInputMoney === 'function' ? parseInputMoney(el.value) : (parseFloat(el.value) || 0);
    };
    const tot = getVal('fc-dinheiro') + getVal('fc-debito') + getVal('fc-credito') + getVal('fc-pix') + getVal('fc-outros');
    const disp = document.getElementById('fc-total-declarado-display');
    if (disp) disp.innerText = window.formatMoney ? window.formatMoney(tot) : 'R$ ' + tot.toFixed(2);
    return tot;
}

async function confirmarFechamentoCego() {
    const getVal = id => {
        const el = document.getElementById(id);
        if (!el) return 0;
        return typeof parseInputMoney === 'function' ? parseInputMoney(el.value) : (parseFloat(el.value) || 0);
    };

    const decDinheiro = getVal('fc-dinheiro');
    const decDebito = getVal('fc-debito');
    const decCredito = getVal('fc-credito');
    const decPix = getVal('fc-pix');
    const decOutros = getVal('fc-outros');
    const decTotal = decDinheiro + decDebito + decCredito + decPix + decOutros;
    const obs = document.getElementById('fc-obs')?.value.trim() || '';

    let cxAtual = dbLoja.caixa_atual || { status: 'ABERTO', saldo: 0, historico: [] };
    const dataAbertura = cxAtual.ultimaAbertura || (new Date(Date.now() - 86400000).toISOString());
    const dataFechamento = new Date().toISOString();
    const operador = cxAtual.operadorAtual || window.currentUserInfo?.nome || 'Operador Caixa';

    const vendasTurno = (dbLoja.vendas || []).filter(v => {
        if (v.tipo === 'ORÇAMENTO') return false;
        const dt = new Date(v.data?.toDate ? v.data.toDate() : (v.data || 0)).getTime();
        return dt >= new Date(dataAbertura).getTime();
    });

    let sysDinheiro = 0, sysDebito = 0, sysCredito = 0, sysPix = 0;
    vendasTurno.forEach(v => {
        const pag = String(v.pag || '');
        const tot = Number(v.tot || v.subtotal || 0);
        if (pag.includes('Dinheiro')) sysDinheiro += tot;
        else if (pag.includes('Débito') || pag.includes('Debito')) sysDebito += tot;
        else if (pag.includes('Crédito') || pag.includes('Credito')) sysCredito += tot;
        else if (pag.includes('PIX') || pag.includes('Pix')) sysPix += tot;
    });

    const saldoEsperadoGaveta = (cxAtual.saldo || 0);
    const totalApuradoSistema = saldoEsperadoGaveta + sysDebito + sysCredito + sysPix;
    const difGeral = decTotal - totalApuradoSistema;

    const mapaDados = {
        id: 'FECH-' + Date.now(),
        dataAbertura: dataAbertura,
        dataFechamento: dataFechamento,
        operador: operador,
        observacao: obs,
        apuradoSistema: {
            fundoTroco: 0,
            suprimentos: 0,
            sangrias: 0,
            vendasDinheiro: sysDinheiro,
            vendasDebito: sysDebito,
            vendasCredito: sysCredito,
            vendasPix: sysPix,
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
            difGeral: difGeral,
            status: Math.abs(difGeral) < 0.1 ? 'CONCILIADO / EXATO' : (difGeral > 0 ? 'SOBRA DE CAIXA' : 'QUEBRA DE CAIXA')
        }
    };

    try {
        const empresaRef = window.getEmpresaRef();
        if (!empresaRef) return;

        await empresaRef.collection('caixa_fechamentos').doc(mapaDados.id).set(mapaDados);

        await empresaRef.collection('caixa').doc('caixa_atual').set({
            status: 'FECHADO',
            saldo: 0,
            historico: [],
            ultimoFechamento: dataFechamento,
            operadorFechamento: operador
        }, { merge: true });

        fecharModalFechamentoCego();
        if (typeof showToast === 'function') showToast('Caixa fechado com sucesso!', 'success');

        // Exibe o mapa de fechamento
        const modalMapa = document.getElementById('modal-mapa-caixa');
        const contMapa = document.getElementById('mapa-caixa-conteudo');
        if (modalMapa && contMapa) {
            contMapa.innerHTML = renderizarMapaCaixaHTML(mapaDados);
            modalMapa.classList.remove('hidden');
        }

        // Recarrega dados
        await loadInitialData();
        renderTabResumo();
    } catch(err) {
        console.error('Erro ao fechar caixa:', err);
        if (typeof showToast === 'function') showToast('Erro ao realizar fechamento do caixa.', 'error');
    }
}

// ---------------------------------------------
// TRANSFERÊNCIA ENTRE CONTAS
// ---------------------------------------------
function abrirModalTransferenciaCaixa() {
    const modal = document.getElementById('modal-transferencia-caixa');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalTransferenciaCaixa() {
    const modal = document.getElementById('modal-transferencia-caixa');
    if (modal) modal.classList.add('hidden');
}

async function confirmarTransferenciaCaixa() {
    const conta = document.getElementById('transf-conta-destino')?.value || 'Banco';
    const valInput = document.getElementById('transf-valor');
    const valor = typeof parseInputMoney === 'function' ? parseInputMoney(valInput?.value || '0') : parseFloat(valInput?.value || 0);
    const obs = document.getElementById('transf-obs')?.value.trim() || '';

    if (!valor || valor <= 0) {
        if (typeof showToast === 'function') showToast('Digite um valor válido para transferência.', 'warning');
        return;
    }

    const saldoGaveta = dbLoja.caixa_atual?.saldo || 0;
    if (valor > saldoGaveta) {
        if (typeof showToast === 'function') showToast('Saldo em dinheiro insuficiente no caixa para transferir.', 'error');
        return;
    }

    try {
        const empresaRef = window.getEmpresaRef();
        if (!empresaRef) return;

        const dataIso = new Date().toISOString();
        const novoSaldo = saldoGaveta - valor;
        const novoHistorico = [...(dbLoja.caixa_atual?.historico || [])];
        novoHistorico.unshift({
            data: dataIso,
            tipo: 'SAIDA',
            desc: `TRANSFERÊNCIA PARA ${conta.toUpperCase()} ${obs ? '(' + obs + ')' : ''}`,
            valor: valor,
            operador: window.currentUserInfo?.nome || 'Operador',
            saldoApos: novoSaldo
        });

        const targetCaixaRef = (typeof window.obterCaixaDocRef === 'function') ? window.obterCaixaDocRef() : empresaRef.collection('caixa').doc('caixa_atual');
        await targetCaixaRef.update({
            saldo: novoSaldo,
            historico: novoHistorico
        });

        fecharModalTransferenciaCaixa();
        if (typeof showToast === 'function') showToast(`Transferência de ${window.formatMoney ? window.formatMoney(valor) : 'R$ ' + valor} realizada!`, 'success');
        if (currentTab === 'resumo') renderTabResumo();
    } catch(err) {
        console.error('Erro na transferência:', err);
        if (typeof showToast === 'function') showToast('Erro ao realizar transferência.', 'error');
    }
}

// ---------------------------------------------
// IMPRESSÃO E MAPA DE CAIXA
// ---------------------------------------------
function renderizarMapaCaixaHTML(m) {
    const emp = window.db?.config?.empresa || { nome: 'FC Gestão', cnpj: '00.000.000/0000-00', telefone: '' };
    const corDiferenca = (m.diferencas?.difGeral || 0) >= 0 ? 'text-emerald-600' : 'text-red-600';
    const bgDiferenca = (m.diferencas?.difGeral || 0) >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30';

    const fmtData = dt => {
        if (!dt) return '-';
        const d = new Date(dt.toDate ? dt.toDate() : dt);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    return `
    <div class="font-mono text-xs text-slate-800 dark:text-slate-200 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div class="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h2 class="text-base font-black uppercase text-slate-900 dark:text-white">${emp.nome}</h2>
            <p class="text-[10px] text-slate-500">CNPJ: ${emp.cnpj || 'Não informado'} | Tel: ${emp.telefone || ''}</p>
            <p class="text-xs font-bold uppercase mt-1 bg-slate-100 dark:bg-slate-800 py-1 rounded">MAPA DE FECHAMENTO DE CAIXA (REDUÇÃO Z)</p>
            <p class="text-[10px] text-slate-400 mt-1">Ref: #${m.id}</p>
        </div>

        <div class="space-y-1.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3 text-[11px]">
            <div class="flex justify-between"><span>OPERADOR:</span><strong class="uppercase">${m.operador || 'Balcão'}</strong></div>
            <div class="flex justify-between"><span>ABERTURA:</span><strong>${fmtData(m.dataAbertura)}</strong></div>
            <div class="flex justify-between"><span>FECHAMENTO:</span><strong>${fmtData(m.dataFechamento)}</strong></div>
            ${m.observacao ? `<div class="flex justify-between text-slate-500"><span>OBS:</span><em>${m.observacao}</em></div>` : ''}
        </div>

        <div class="border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h4 class="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1.5">1. FLUXO DE GAVETA (DINHEIRO FÍSICO)</h4>
            <div class="flex justify-between text-[11px]"><span>(+) Vendas em Dinheiro:</span><span>${formatMoney(m.apuradoSistema?.vendasDinheiro || 0)}</span></div>
            <div class="flex justify-between font-bold text-xs pt-1 border-t border-slate-200 dark:border-slate-800 mt-1">
                <span>(=) Saldo Esperado Gaveta:</span><span class="text-blue-600">${formatMoney(m.apuradoSistema?.saldoEsperadoGaveta || 0)}</span>
            </div>
            <div class="flex justify-between font-bold text-xs text-emerald-600">
                <span>(V) Dinheiro Declarado:</span><span>${formatMoney(m.declaradoOperador?.dinheiro || 0)}</span>
            </div>
        </div>

        <div class="border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h4 class="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1.5">2. MÉTODOS ELETRÔNICOS</h4>
            <div class="flex justify-between text-[11px]"><span>Cartão Débito:</span><span>${formatMoney(m.apuradoSistema?.vendasDebito || 0)} / <strong>${formatMoney(m.declaradoOperador?.debito || 0)}</strong></span></div>
            <div class="flex justify-between text-[11px]"><span>Cartão Crédito:</span><span>${formatMoney(m.apuradoSistema?.vendasCredito || 0)} / <strong>${formatMoney(m.declaradoOperador?.credito || 0)}</strong></span></div>
            <div class="flex justify-between text-[11px]"><span>PIX:</span><span>${formatMoney(m.apuradoSistema?.vendasPix || 0)} / <strong>${formatMoney(m.declaradoOperador?.pix || 0)}</strong></span></div>
        </div>

        <div class="${bgDiferenca} p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
            <div class="flex justify-between text-xs font-bold mb-1">
                <span>TOTAL APURADO NO SISTEMA:</span><span>${formatMoney(m.apuradoSistema?.totalGeral || 0)}</span>
            </div>
            <div class="flex justify-between text-xs font-bold mb-1.5">
                <span>TOTAL DECLARADO:</span><span>${formatMoney(m.declaradoOperador?.totalGeral || 0)}</span>
            </div>
            <div class="flex justify-between text-sm font-black pt-1.5 border-t border-slate-300 dark:border-slate-700 ${corDiferenca}">
                <span>DIVERGÊNCIA (${m.diferencas?.status || 'CONCILIADO'}):</span>
                <span>${(m.diferencas?.difGeral || 0) >= 0 ? '+' : ''}${formatMoney(m.diferencas?.difGeral || 0)}</span>
            </div>
        </div>
    </div>`;
}

function imprimirArea(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const janela = window.open('', '', 'width=450,height=650');
    if (!janela) {
        if (typeof showToast === 'function') showToast('Permita pop-ups no navegador para imprimir.', 'warning');
        return;
    }
    janela.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir</title>
            <style>
                body { font-family: monospace, sans-serif; font-size: 12px; padding: 15px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            ${el.innerHTML}
        </body>
        </html>
    `);
    janela.document.close();
}

