// caixa_loja.js - Módulo de Caixa da Loja & Fechamento Consolidado (FC Gestão)
// Revisão Geral e Blindagem de Todas as Funções

let chartResumo7Dias = null;
let chartPeriodoBar = null;
let chartPeriodoPie = null;
let chartProdutosTop = null;
let chartPagamentosBar = null;

let currentTab = 'resumo';
let currentPeriodType = 'hoje';
let filtroFechamentosModo = 'mes'; // 'mes' ou 'todos'

// Funções monetárias (formatMoney e parseInputMoney) já providas globalmente pelo global.js

// Helper: seta propriedade de elemento com segurança contra null
function setEl(id, val, prop = 'textContent') {
    const el = document.getElementById(id);
    if (el) el[prop] = val;
}

// Estado e dados em memória
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

// Helper: normaliza qualquer estrutura para um array seguro de caixas
function normalizarCaixasArray(dados) {
    if (!dados) return [];
    if (Array.isArray(dados)) return dados.filter(Boolean);
    if (typeof dados === 'object') return [dados];
    return [];
}

// -----------------------------------------------------------------
// RESOLUÇÃO PRECISA DO CAIXA DO OPERADOR ATIVO
// -----------------------------------------------------------------
function obterCaixaOperacao() {
    const op = (typeof window.obterOperadorAtual === 'function') 
        ? window.obterOperadorAtual() 
        : { uid: (window.currentUser && window.currentUser.uid) || null, nome: 'Operador', isAdmin: false };
    
    const myDocId = (typeof window.obterCaixaDocId === 'function') 
        ? window.obterCaixaDocId(op.uid) 
        : 'caixa_atual';

    const caixas = normalizarCaixasArray(dbLoja.caixas);
    if (dbLoja.caixa_atual && !caixas.some(c => c && c.id === dbLoja.caixa_atual.id)) {
        caixas.push(dbLoja.caixa_atual);
    }

    // 1. Procura caixa do operador atual que esteja ABERTO com saldo físico em gaveta (> 0)
    let cx = caixas.find(c => c && c.id === myDocId && c.status === 'ABERTO' && (Number(c.saldo) || 0) > 0);

    // 2. Procura pelo operadorUid com status ABERTO e saldo > 0
    if (!cx && op.uid) {
        cx = caixas.find(c => c && c.operadorUid === op.uid && c.status === 'ABERTO' && (Number(c.saldo) || 0) > 0);
    }

    // 3. Procura qualquer caixa no banco que esteja ABERTO com saldo físico em gaveta (> 0)
    // Garante sincronismo imediato se o operador físico abriu caixa com saldo
    if (!cx) {
        cx = caixas.find(c => c && c.status === 'ABERTO' && (Number(c.saldo) || 0) > 0);
    }

    // 4. Procura caixa do operador atual que esteja ABERTO (mesmo com saldo 0)
    if (!cx) {
        cx = caixas.find(c => c && c.id === myDocId && c.status === 'ABERTO');
    }
    if (!cx && op.uid) {
        cx = caixas.find(c => c && c.operadorUid === op.uid && c.status === 'ABERTO');
    }

    // 5. Procura qualquer caixa que esteja ABERTO
    if (!cx) {
        cx = caixas.find(c => c && c.status === 'ABERTO');
    }

    // 6. Procura documento exato do operador atual (mesmo fechado)
    if (!cx) {
        cx = caixas.find(c => c && c.id === myDocId);
    }

    // 7. Procura caixa_atual legado
    if (!cx) {
        cx = caixas.find(c => c && c.id === 'caixa_atual');
    }

    // 8. Primeiro documento existente ou estrutura limpa
    if (!cx && caixas.length > 0) {
        cx = caixas[0];
    }

    if (!cx) {
        cx = { id: myDocId, status: 'FECHADO', saldo: 0, historico: [], operadorUid: op.uid || '', operadorAtual: op.nome || 'Operador' };
    }

    return cx;
}


function atualizarStatusCaixaBadge() {
    const badge = document.getElementById('resumo-status-caixa-badge');
    if (!badge) return;

    const cx = obterCaixaOperacao();
    const status = (cx && cx.status) ? String(cx.status).toUpperCase() : 'FECHADO';
    const saldo = Number(cx?.saldo || 0);
    const opNome = cx?.operadorAtual || window.currentUserInfo?.nome || 'Operador';

    if (status === 'ABERTO') {
        badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ABERTO (${opNome}) - ${formatMoney(saldo)}`;
    } else {
        badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-700';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span> FECHADO ${saldo > 0 ? `(Gaveta: ${formatMoney(saldo)})` : ''}`;
    }
}

// -----------------------------------------------------------------
// INICIALIZAÇÃO DO MÓDULO
// -----------------------------------------------------------------
function _iniciarCaixaLoja() {
    if (window._caixaLojaIniciado) return;
    window._caixaLojaIniciado = true;
    if (typeof initGlobalData === 'function') {
        initGlobalData(inicializarCaixaLoja);
    } else {
        console.error('global.js não carregado corretamente.');
        setTimeout(inicializarCaixaLoja, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _iniciarCaixaLoja);
} else {
    _iniciarCaixaLoja();
}

async function inicializarCaixaLoja() {
    try {
        // Inicializa filtros com o mês atual
        const hoje = new Date();
        const anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('filtro-vendas-mes', anoMes);
        setVal('filtro-pagamentos-mes', anoMes);
        setVal('filtro-produtos-mes', anoMes);
        setVal('filtro-vendedores-mes', anoMes);
        setVal('filtro-fechamentos-mes', anoMes);

        await loadInitialData();
        switchTab('resumo');
    } catch (e) {
        console.error('Erro na inicialização do Caixa da Loja:', e);
    }
}

// -----------------------------------------------------------------
// CARREGAMENTO DE DADOS (CACHE + FIRESTORE + TEMPO REAL)
// -----------------------------------------------------------------
async function loadInitialData() {
    // 1. Tenta carregar do repositório local instantaneamente (< 2ms)
    if (typeof window.FCCache !== 'undefined') {
        const cVendas = window.FCCache.get('vendas');
        const cFin = window.FCCache.get('financeiro');
        const cFech = window.FCCache.get('caixa_fechamentos');
        const cProd = window.FCCache.get('produtos');
        const cCli = window.FCCache.get('clientes');
        const cFunc = window.FCCache.get('funcionarios');
        const cCx = window.FCCache.get('caixa') || window.FCCache.get('fc_moveis_caixa');

        if (Array.isArray(cVendas) && cVendas.length > 0) dbLoja.vendas = cVendas;
        if (Array.isArray(cFin) && cFin.length > 0) dbLoja.financeiro = cFin;
        if (Array.isArray(cFech) && cFech.length > 0) dbLoja.caixa_fechamentos = cFech;
        if (Array.isArray(cProd)) dbLoja.produtos = cProd;
        if (Array.isArray(cCli)) dbLoja.clientes = cCli;
        if (Array.isArray(cFunc)) dbLoja.funcionarios = cFunc;
        if (cCx) {
            dbLoja.caixas = normalizarCaixasArray(cCx);
            dbLoja.caixa_atual = obterCaixaOperacao();
        }

        // Renderiza imediatamente com dados em cache para não dar tela em branco
        reRenderCurrentTab();
    }

    const empresaRef = window.getEmpresaRef();
    if (!empresaRef) return;

    try {
        // Carrega dados completos do Firestore em paralelo
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
            .sort((a, b) => {
                const da = a.dataFechamento?.toDate ? a.dataFechamento.toDate() : new Date(a.dataFechamento || 0);
                const db = b.dataFechamento?.toDate ? b.dataFechamento.toDate() : new Date(b.dataFechamento || 0);
                return db - da;
            });
        dbLoja.produtos = produtosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoja.clientes = clientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dbLoja.funcionarios = funcionariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        dbLoja.caixas = normalizarCaixasArray(caixasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        dbLoja.caixa_atual = obterCaixaOperacao();

        // Salva cópia fresca no FCCache
        if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function') {
            window.FCCache.set('vendas', dbLoja.vendas);
            window.FCCache.set('financeiro', dbLoja.financeiro);
            window.FCCache.set('caixa_fechamentos', dbLoja.caixa_fechamentos);
            if (dbLoja.caixa_atual) window.FCCache.set('caixa', dbLoja.caixa_atual);
        }

        // Ativa escuta em tempo real para sincronização com outras telas e PDV
        setupRealtimeListeners();

        // Atualiza telas
        reRenderCurrentTab();

    } catch (e) {
        console.error("Erro ao carregar dados do caixa da loja:", e);
        if (typeof showToast === 'function') showToast("Erro ao sincronizar dados do caixa", "error");
    }
}

function setupRealtimeListeners() {
    if (window._caixaLojaListenersAtivos) return;
    window._caixaLojaListenersAtivos = true;

    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb) {
        const empRef = window.getEmpresaRef();
        if (!empRef) return null;
        return empRef.collection(col).onSnapshot(snap => {
            cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, err => console.warn(`Erro no listener de ${col}:`, err));
    };

    _listen('vendas', function(dados) {
        dbLoja.vendas = dados || [];
        reRenderCurrentTab();
    });

    _listen('financeiro', function(dados) {
        dbLoja.financeiro = dados || [];
        reRenderCurrentTab();
    });

    _listen('caixa', function(dados) {
        dbLoja.caixas = normalizarCaixasArray(dados);
        dbLoja.caixa_atual = obterCaixaOperacao();
        atualizarStatusCaixaBadge();
        reRenderCurrentTab();
    });

    _listen('caixa_fechamentos', function(dados) {
        dbLoja.caixa_fechamentos = (dados || []).sort((a, b) => {
            const da = a.dataFechamento?.toDate ? a.dataFechamento.toDate() : new Date(a.dataFechamento || 0);
            const db = b.dataFechamento?.toDate ? b.dataFechamento.toDate() : new Date(b.dataFechamento || 0);
            return db - da;
        });
        if (currentTab === 'fechamentos') renderTabFechamentos();
    });
}

function reRenderCurrentTab() {
    atualizarStatusCaixaBadge();
    if (currentTab === 'resumo') renderTabResumo();
    else if (currentTab === 'periodo') renderTabPeriodo();
    else if (currentTab === 'vendas') renderTabVendas();
    else if (currentTab === 'pagamentos') renderTabPagamentos();
    else if (currentTab === 'produtos') renderTabProdutos();
    else if (currentTab === 'vendedores') renderTabVendedores();
    else if (currentTab === 'fechamentos') renderTabFechamentos();
}

function switchTab(tabId) {
    currentTab = tabId;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('text-slate-500');
    });

    const activeContent = document.getElementById(`tab-content-${tabId}`);
    if (activeContent) activeContent.classList.remove('hidden');

    const btn = document.getElementById(`tab-btn-${tabId}`);
    if (btn) {
        btn.classList.add('bg-blue-600', 'text-white');
        btn.classList.remove('text-slate-500');
    }

    reRenderCurrentTab();
}

// -----------------------------------------------------------------
// FILTROS DE DATA
// -----------------------------------------------------------------
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
        case 'semana': {
            const diaSemana = inicio.getDay(); // 0 = Domingo
            inicio.setDate(inicio.getDate() - diaSemana);
            break;
        }
        case 'semana_passada': {
            const ds = inicio.getDay();
            inicio.setDate(inicio.getDate() - ds - 7);
            fim.setDate(fim.getDate() - ds - 1);
            break;
        }
        case 'mes':
            inicio.setDate(1);
            break;
        case 'mes_passado':
            inicio.setMonth(inicio.getMonth() - 1);
            inicio.setDate(1);
            fim.setDate(0);
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
    if (!Array.isArray(array)) return [];
    const { inicio, fim } = getPeriodDates(tipo, customStart, customEnd);
    return array.filter(item => {
        if (!item) return false;
        const val = item[dateField] || item['data'] || item['dataPagamento'];
        if (!val) return false;
        let d;
        if (val.toDate) d = val.toDate();
        else d = new Date(val);
        if (isNaN(d.getTime())) return false;
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
    if (!Array.isArray(array)) return [];
    const range = parseMonthInput(monthValue);
    if (!range) return array;
    return array.filter(item => {
        if (!item) return false;
        const val = item[dateField] || item['data'] || item['dataFechamento'];
        if (!val) return false;
        let d;
        if (val.toDate) d = val.toDate();
        else d = new Date(val);
        if (isNaN(d.getTime())) return false;
        return d >= range.inicio && d <= range.fim;
    });
}

// -----------------------------------------------------------------
// TAB 1: RESUMO DO CAIXA (CONSOLIDADO DA LOJA)
// -----------------------------------------------------------------
function renderTabResumo() {
    atualizarStatusCaixaBadge();

    // 1. Vendas Concluídas Hoje
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

    // 2. Receitas financeiras quitadas hoje (excluindo duplicidades de vendas)
    const receitasHoje = filterByPeriod(dbLoja.financeiro, 'dataPagamento', 'hoje').filter(f => {
        return f && f.tipo === 'RECEITA' && f.status === 'PAGO' && !f.origemVendaId;
    });

    // 3. Despesas financeiras quitadas hoje
    const despesasHoje = filterByPeriod(dbLoja.financeiro, 'dataPagamento', 'hoje').filter(f => {
        return f && f.tipo === 'DESPESA' && f.status === 'PAGO';
    });

    // 4. Saldo em Gaveta (Consolidado)
    const cxAtivo = obterCaixaOperacao();
    let saldoTotalGavetas = Number(cxAtivo?.saldo || 0);

    const caixasAbertos = normalizarCaixasArray(dbLoja.caixas).filter(c => c && c.status === 'ABERTO');
    if (caixasAbertos.length > 0) {
        const vistos = new Set();
        let soma = 0;
        caixasAbertos.forEach(c => {
            const key = c.operadorUid || c.id;
            if (!vistos.has(key)) {
                vistos.add(key);
                soma += Number(c.saldo || 0);
            }
        });
        if (soma > 0) saldoTotalGavetas = soma;
    }

    let todosHistoricos = [];
    const caixasArr = normalizarCaixasArray(dbLoja.caixas);
    if (caixasArr.length > 0) {
        caixasArr.forEach(c => {
            if (c && Array.isArray(c.historico)) todosHistoricos = todosHistoricos.concat(c.historico);
        });
    } else if (cxAtivo && Array.isArray(cxAtivo.historico)) {
        todosHistoricos = cxAtivo.historico;
    }

    const histHoje = filterByPeriod(todosHistoricos, 'data', 'hoje');
    const suprimentosHoje = histHoje.filter(h => h.tipo === 'SUPRIMENTO' || h.tipo === 'ABERTURA').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);
    const sangriasHoje = histHoje.filter(h => h.tipo === 'SANGRIA').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);

    // Totais calculados
    const totalVendasHoje = vendasHoje.reduce((acc, v) => acc + (parseFloat(v.tot || v.subtotal || 0)), 0);
    const totalReceitasHoje = receitasHoje.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);
    const totalDespesasHoje = despesasHoje.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);

    const entradasHoje = totalVendasHoje + totalReceitasHoje + suprimentosHoje;
    const saidasHoje = totalDespesasHoje + sangriasHoje;
    const totalVendasSemana = vendasSemana.reduce((acc, v) => acc + (parseFloat(v.tot || v.subtotal || 0)), 0);
    const ticketMedioHoje = vendasHoje.length > 0 ? (totalVendasHoje / vendasHoje.length) : 0;

    // Atualiza cards no DOM
    setEl('resumo-saldo', formatMoney(saldoTotalGavetas));
    setEl('resumo-vendas-hoje', formatMoney(totalVendasHoje));
    setEl('resumo-entradas-hoje', formatMoney(entradasHoje));
    setEl('resumo-saidas-hoje', formatMoney(saidasHoje));
    setEl('resumo-vendas-semana', formatMoney(totalVendasSemana));
    setEl('resumo-ticket-hoje', formatMoney(ticketMedioHoje));
    setEl('resumo-qtd-vendas', vendasHoje.length);

    // Formas de Pagamento Hoje
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

    // Gráfico de vendas dos últimos 7 dias
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
    if (ctxEl_chartResumo7Dias && typeof Chart !== 'undefined') {
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

// -----------------------------------------------------------------
// TAB 2: RELATÓRIO POR PERÍODO
// -----------------------------------------------------------------
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
        document.getElementById('periodo-custom-inputs')?.classList.remove('hidden');
        document.getElementById('periodo-custom-inputs')?.classList.add('flex');
    } else {
        document.getElementById('periodo-custom-inputs')?.classList.add('hidden');
        document.getElementById('periodo-custom-inputs')?.classList.remove('flex');
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

    // 2. Contas a Receber quitadas no período
    const receitasPeriodo = filterByPeriod(dbLoja.financeiro, 'dataPagamento', currentPeriodType, cIni, cFim).filter(f => {
        return f && f.tipo === 'RECEITA' && f.status === 'PAGO' && !f.origemVendaId;
    });

    // 3. Contas a Pagar quitadas no período
    const despesasPeriodo = filterByPeriod(dbLoja.financeiro, 'dataPagamento', currentPeriodType, cIni, cFim).filter(f => {
        return f && f.tipo === 'DESPESA' && f.status === 'PAGO';
    });

    // 4. Histórico de movimentações de gaveta
    let todosHist = [];
    const caixasArrPeriodo = normalizarCaixasArray(dbLoja.caixas);
    caixasArrPeriodo.forEach(c => {
        if (c && Array.isArray(c.historico)) todosHist = todosHist.concat(c.historico);
    });

    const historicoPeriodo = filterByPeriod(todosHist, 'data', currentPeriodType, cIni, cFim);
    const suprimentosPeriodo = historicoPeriodo.filter(h => h.tipo === 'SUPRIMENTO').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);
    const sangriasPeriodo = historicoPeriodo.filter(h => h.tipo === 'SANGRIA').reduce((acc, h) => acc + (Number(h.valor) || 0), 0);

    const totalVendas = vendasPeriodo.reduce((acc, v) => acc + (parseFloat(v.tot || v.subtotal || 0)), 0);
    const totalReceitas = receitasPeriodo.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);
    const totalDespesas = despesasPeriodo.reduce((acc, f) => acc + (parseFloat(f.valorPago || f.valor || 0)), 0);

    const totalEntradas = totalVendas + totalReceitas + suprimentosPeriodo;
    const totalSaidas = totalDespesas + sangriasPeriodo;
    const lucroOperacional = totalEntradas - totalSaidas;
    const ticket = vendasPeriodo.length > 0 ? (totalVendas / vendasPeriodo.length) : 0;

    setEl('rp-qtd-vendas', vendasPeriodo.length);
    setEl('rp-total-vendas', formatMoney(totalVendas));
    setEl('rp-total-entradas', formatMoney(totalEntradas));
    setEl('rp-total-saidas', formatMoney(totalSaidas));
    setEl('rp-lucro-bruto', formatMoney(lucroOperacional));
    setEl('rp-ticket-medio', formatMoney(ticket));

    // Extrato Consolidado Detalhado do Período
    const combined = [];

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

    receitasPeriodo.forEach(f => {
        combined.push({
            data: new Date(f.dataPagamento ? f.dataPagamento : (f.data?.toDate ? f.data.toDate() : f.data)),
            tipo: 'Recebimento',
            desc: `Recbto. Título: ${f.pessoa || 'Cliente'} (${f.categoria || 'Vendas'})`,
            pag: f.metodoPagamento || 'Outros',
            valor: parseFloat(f.valorPago || f.valor || 0),
            isEntrada: true
        });
    });

    despesasPeriodo.forEach(f => {
        combined.push({
            data: new Date(f.dataPagamento ? f.dataPagamento : (f.data?.toDate ? f.data.toDate() : f.data)),
            tipo: 'Conta Paga',
            desc: `Pgto. Título: ${f.pessoa || 'Fornecedor'} (${f.categoria || 'Despesa'})`,
            pag: f.metodoPagamento || 'Outros',
            valor: -Math.abs(parseFloat(f.valorPago || f.valor || 0)),
            isEntrada: false
        });
    });

    historicoPeriodo.filter(h => h.tipo === 'SUPRIMENTO').forEach(h => {
        combined.push({
            data: new Date(h.data.toDate ? h.data.toDate() : h.data),
            tipo: 'Suprimento',
            desc: `Suprimento Gaveta: ${h.desc || h.descricao || 'Entrada manual'}`,
            pag: 'Dinheiro',
            valor: Math.abs(Number(h.valor || 0)),
            isEntrada: true
        });
    });

    historicoPeriodo.filter(h => h.tipo === 'SANGRIA').forEach(h => {
        combined.push({
            data: new Date(h.data.toDate ? h.data.toDate() : h.data),
            tipo: 'Sangria',
            desc: `Sangria Gaveta: ${h.desc || h.descricao || 'Retirada manual'}`,
            pag: 'Dinheiro',
            valor: -Math.abs(Number(h.valor || 0)),
            isEntrada: false
        });
    });

    combined.sort((a, b) => b.data - a.data);

    const tbody = document.getElementById('tabela-periodo-extrato');
    if (tbody) {
        tbody.innerHTML = '';
        combined.forEach(item => {
            const d = item.data;
            const dataStr = isNaN(d.getTime()) ? '-' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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
                    <td class="p-3 text-right font-black ${cor}">${item.valor >= 0 ? '+' : ''}${formatMoney(item.valor)}</td>
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
    if (ctxEl_chartPeriodoPie && typeof Chart !== 'undefined') {
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
    if (ctxEl_chartPeriodoBar && typeof Chart !== 'undefined') {
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
    const tit = document.getElementById('titulo-impressao-periodo');
    if (tit) tit.classList.remove('hidden');
    window.print();
    if (tit) tit.classList.add('hidden');
}

function baixarPDFRelatorio(areaId, filename) {
    const el = document.getElementById(areaId);
    if (!el || typeof html2pdf === 'undefined') {
        window.print();
        return;
    }
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
    const table = document.getElementById('tabela-periodo-extrato')?.parentElement?.parentElement?.querySelector('table');
    exportarTabelaCSV(table, 'Relatorio_Periodo');
}

// -----------------------------------------------------------------
// TAB 3: VENDAS DETALHADAS
// -----------------------------------------------------------------
function renderTabVendas() {
    const mes = document.getElementById('filtro-vendas-mes')?.value;
    const busca = document.getElementById('filtro-vendas-busca')?.value?.toLowerCase() || '';
    
    let vendasFiltradas = filterByMonthRange(dbLoja.vendas, 'data', mes);
    
    if (busca) {
        vendasFiltradas = vendasFiltradas.filter(v => 
            (v.cliente && v.cliente.toLowerCase().includes(busca)) ||
            (v.clienteNome && v.clienteNome.toLowerCase().includes(busca)) ||
            (v.id && v.id.toLowerCase().includes(busca)) ||
            (v.vendedor && v.vendedor.toLowerCase().includes(busca)) ||
            (v.numeroPedido && String(v.numeroPedido).includes(busca))
        );
    }
    
    vendasFiltradas.sort((a,b) => {
        const da = a.data?.toDate ? a.data.toDate() : new Date(a.data || 0);
        const db = b.data?.toDate ? b.data.toDate() : new Date(b.data || 0);
        return db - da;
    });

    const tbody = document.getElementById('tabela-vendas-detalhadas');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;

    vendasFiltradas.forEach(v => {
        const d = v.data?.toDate ? v.data.toDate() : new Date(v.data || 0);
        const dataStr = isNaN(d.getTime()) ? '-' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const val = parseFloat(v.tot || v.subtotal || 0);
        total += val;
        
        let statusBadge = `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">CONCLUÍDO</span>`;
        if (v.status === 'CANCELADA') statusBadge = `<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">CANCELADA</span>`;
        
        const numPed = String(v.numeroPedido || v.id || '').substring(0,6).toUpperCase();

        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                <td class="p-3 text-slate-600 dark:text-slate-300 font-mono text-xs">${dataStr}</td>
                <td class="p-3 text-slate-700 dark:text-slate-200 font-medium">#${numPed}</td>
                <td class="p-3 text-slate-700 dark:text-slate-200">${v.clienteNome || v.cliente || 'Consumidor Final'}</td>
                <td class="p-3 text-slate-500">${v.pag || '-'}</td>
                <td class="p-3 text-slate-500">${v.vendedor || '-'}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-right font-black text-slate-700 dark:text-white">${formatMoney(val)}</td>
                <td class="p-3 text-center">
                    <button onclick="verDetalheVenda('${v.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>
        `;
    });
    
    if (vendasFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500">Nenhuma venda encontrada para os filtros</td></tr>`;
    }

    setEl('rodape-vendas-total', formatMoney(total));
}

function verDetalheVenda(id) {
    const v = dbLoja.vendas.find(x => x.id === id);
    if (!v) return;

    const d = v.data?.toDate ? v.data.toDate() : new Date(v.data || 0);
    const dataStr = isNaN(d.getTime()) ? '-' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    let itensHtml = '';
    if (v.itens && v.itens.length > 0) {
        v.itens.forEach(i => {
            const val = parseFloat(i.precoUnit || i.preco || 0);
            const total = val * (i.qtd || 1);
            itensHtml += `
                <tr class="border-b border-slate-200 dark:border-slate-700">
                    <td class="py-2 text-sm text-slate-700 dark:text-slate-200">${i.nome || 'Produto'}</td>
                    <td class="py-2 text-sm text-center text-slate-700 dark:text-slate-200">${i.qtd || 1}</td>
                    <td class="py-2 text-sm text-right text-slate-700 dark:text-slate-200">${formatMoney(val)}</td>
                    <td class="py-2 text-sm text-right font-bold text-slate-700 dark:text-slate-200">${formatMoney(total)}</td>
                </tr>
            `;
        });
    }

    const html = `
        <div class="space-y-4">
            <div class="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                    <p class="text-xs text-slate-500 uppercase font-bold">Venda</p>
                    <p class="text-lg font-black text-slate-800 dark:text-white">#${String(v.numeroPedido || v.id).substring(0,8).toUpperCase()}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-bold">Data/Hora</p>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${dataStr}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                    <p class="text-xs text-slate-500 uppercase font-bold">Cliente</p>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${v.clienteNome || v.cliente || 'Consumidor Final'}</p>
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
                    <p class="text-sm font-medium text-slate-800 dark:text-white">${formatMoney(parseFloat(v.subtotal || v.tot || 0))}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-bold">Total</p>
                    <p class="text-xl font-black text-blue-600">${formatMoney(parseFloat(v.tot || v.subtotal || 0))}</p>
                </div>
            </div>
        </div>
    `;

    setEl('modal-venda-conteudo', html, 'innerHTML');
    document.getElementById('modal-detalhe-venda')?.classList.remove('hidden');
}

function exportarCSVVendas() {
    exportarTabelaCSV(document.getElementById('tabela-vendas-detalhadas')?.parentElement?.parentElement?.querySelector('table'), 'Relatorio_Vendas');
}

// -----------------------------------------------------------------
// TAB 4: FORMAS DE PAGAMENTO
// -----------------------------------------------------------------
function renderTabPagamentos() {
    const mes = document.getElementById('filtro-pagamentos-mes')?.value;
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
    if (!container) return;
    container.innerHTML = '';
    
    const labels = [];
    const data = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#06b6d4'];

    Object.keys(pgtos).sort((a,b) => pgtos[b].val - pgtos[a].val).forEach(p => {
        const perc = totalGeral > 0 ? ((pgtos[p].val / totalGeral) * 100).toFixed(1) : 0;
        
        container.innerHTML += `
            <div class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
                <p class="text-xs font-bold text-slate-500 uppercase truncate" title="${p}">${p}</p>
                <h3 class="text-xl font-black text-slate-800 dark:text-white mt-1">${formatMoney(pgtos[p].val)}</h3>
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
    if (ctxEl_chartPagamentosBar && typeof Chart !== 'undefined') {
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
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

function exportarCSVPagamentos() {
    const mes = document.getElementById('filtro-pagamentos-mes')?.value;
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

    let csv = ['"Forma de Pagamento";"Qtd Transações";"Valor Total";"% do Total"'];
    Object.keys(pgtos).sort((a,b) => pgtos[b].val - pgtos[a].val).forEach(p => {
        const perc = totalGeral > 0 ? ((pgtos[p].val / totalGeral) * 100).toFixed(2) : '0';
        csv.push(`"${p}";"${pgtos[p].count}";"${pgtos[p].val.toFixed(2)}";"${perc}%"`);
    });

    const csvFile = new Blob(["\uFEFF" + csv.join('\n')], {type: "text/csv;charset=utf-8;"});
    const downloadLink = document.createElement("a");
    downloadLink.download = 'Relatorio_Formas_Pagamento_' + (mes || 'geral') + '.csv';
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// -----------------------------------------------------------------
// TAB 5: POR PRODUTO
// -----------------------------------------------------------------
function renderTabProdutos() {
    const mes = document.getElementById('filtro-produtos-mes')?.value;
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
                <td class="p-3 text-right text-slate-600 dark:text-slate-300 font-bold">${p.qtd}</td>
                <td class="p-3 text-right font-bold text-slate-800 dark:text-white">${formatMoney(p.val)}</td>
                <td class="p-3 text-right text-blue-600 font-bold">${perc}%</td>
            </tr>
        `;
    });

    if (arrayProd.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Nenhum produto vendido no período</td></tr>`;
    }

    const top10 = arrayProd.slice(0, 10);
    
    const ctxEl_chartProdutosTop = document.getElementById('chart-produtos-top');
    if (ctxEl_chartProdutosTop && typeof Chart !== 'undefined') {
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
            }
        });
    }
}

function exportarCSVProdutos() {
    exportarTabelaCSV(document.getElementById('tabela-produtos-ranking')?.parentElement, 'Relatorio_Produtos');
}

// -----------------------------------------------------------------
// TAB 6: POR VENDEDOR
// -----------------------------------------------------------------
function renderTabVendedores() {
    const mes = document.getElementById('filtro-vendedores-mes')?.value;
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
    if (cardsContainer) cardsContainer.innerHTML = '';
    
    const tbody = document.getElementById('tabela-vendedores-ranking');
    if (!tbody) return;
    tbody.innerHTML = '';

    arrVend.forEach((v, index) => {
        const perc = totalGeral > 0 ? ((v.val / totalGeral) * 100).toFixed(1) : 0;
        const ticket = v.count > 0 ? (v.val / v.count) : 0;
        
        if (cardsContainer && index < 4) {
            cardsContainer.innerHTML += `
                <div class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">${index + 1}</div>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">${v.nome}</p>
                    </div>
                    <h3 class="text-xl font-black text-emerald-600">${formatMoney(v.val)}</h3>
                    <p class="text-xs text-slate-500 mt-1">${v.count} vendas | ${perc}% do total</p>
                </div>
            `;
        }

        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50">
                <td class="p-3 text-center font-bold text-slate-500">${index + 1}º</td>
                <td class="p-3 text-slate-700 dark:text-slate-200 font-medium">${v.nome}</td>
                <td class="p-3 text-center text-slate-600 dark:text-slate-300">${v.count}</td>
                <td class="p-3 text-right text-slate-600 dark:text-slate-300 font-medium">${formatMoney(ticket)}</td>
                <td class="p-3 text-right font-bold text-slate-800 dark:text-white">${formatMoney(v.val)}</td>
            </tr>
        `;
    });

    if (arrVend.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Nenhuma venda encontrada no período</td></tr>`;
    }
}

function exportarCSVVendedores() {
    const table = document.getElementById('tabela-vendedores-ranking')?.parentElement?.parentElement?.querySelector('table') || document.getElementById('tabela-vendedores-ranking')?.closest('table');
    if (table) {
        exportarTabelaCSV(table, 'Relatorio_Vendedores');
    }
}

// -----------------------------------------------------------------
// TAB 7: HISTÓRICO DE FECHAMENTOS (REVISADO E 100% OPERACIONAL)
// -----------------------------------------------------------------
function mudarFiltroFechamentoMes(valor) {
    filtroFechamentosModo = 'mes';
    atualizarBotoesFiltroFechamentos('mes');
    renderTabFechamentos();
}

function filtrarFechamentosPeriodo(tipo) {
    const mesEl = document.getElementById('filtro-fechamentos-mes');
    const hoje = new Date();
    
    if (tipo === 'mes_atual') {
        filtroFechamentosModo = 'mes';
        const anoMes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
        if (mesEl) mesEl.value = anoMes;
        atualizarBotoesFiltroFechamentos('mes_atual');
    } else if (tipo === 'mes_anterior') {
        filtroFechamentosModo = 'mes';
        const mesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const anoMes = mesAnt.getFullYear() + '-' + String(mesAnt.getMonth() + 1).padStart(2, '0');
        if (mesEl) mesEl.value = anoMes;
        atualizarBotoesFiltroFechamentos('mes_anterior');
    } else if (tipo === 'todos') {
        filtroFechamentosModo = 'todos';
        atualizarBotoesFiltroFechamentos('todos');
    }
    renderTabFechamentos();
}

function atualizarBotoesFiltroFechamentos(ativo) {
    const btns = {
        'mes_atual': document.getElementById('btn-fech-mes-atual'),
        'mes_anterior': document.getElementById('btn-fech-mes-anterior'),
        'todos': document.getElementById('btn-fech-todos')
    };
    Object.entries(btns).forEach(([k, btn]) => {
        if (!btn) return;
        if (k === ativo) {
            btn.className = 'btn-fech-filtro px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-xs transition-colors';
        } else {
            btn.className = 'btn-fech-filtro px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors';
        }
    });
}

function renderTabFechamentos() {
    let lista = Array.isArray(dbLoja.caixa_fechamentos) ? [...dbLoja.caixa_fechamentos] : [];
    
    if (filtroFechamentosModo === 'mes') {
        const mes = document.getElementById('filtro-fechamentos-mes')?.value;
        if (mes) {
            lista = filterByMonthRange(lista, 'dataFechamento', mes);
        }
    }

    lista.sort((a, b) => {
        const da = a.dataFechamento?.toDate ? a.dataFechamento.toDate() : new Date(a.dataFechamento || 0);
        const db = b.dataFechamento?.toDate ? b.dataFechamento.toDate() : new Date(b.dataFechamento || 0);
        return db - da;
    });

    const badgeTotal = document.getElementById('fechamentos-badge-total');
    if (badgeTotal) {
        badgeTotal.innerText = `${lista.length} fechamento${lista.length === 1 ? '' : 's'}`;
    }

    const tbody = document.getElementById('tabela-historico-fechamentos');
    if (!tbody) return;
    tbody.innerHTML = '';

    lista.forEach(f => {
        const d = f.dataFechamento?.toDate ? f.dataFechamento.toDate() : new Date(f.dataFechamento || 0);
        const dataStr = isNaN(d.getTime()) ? '-' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        
        const totSis = Number(f.totalSistema ?? f.apuradoSistema?.totalGeral ?? 0);
        const totDec = Number(f.totalDeclarado ?? f.declaradoOperador?.totalGeral ?? 0);
        const dif = Number(f.diferenca ?? f.diferencas?.difGeral ?? (totDec - totSis));
        
        let status = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-md text-[10px] font-black uppercase">CONCILIADO</span>`;
        if (Math.abs(dif) > 0.05) {
            if (dif > 0) {
                status = `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-md text-[10px] font-black uppercase">SOBRA (${formatMoney(dif)})</span>`;
            } else {
                status = `<span class="px-2.5 py-1 bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 rounded-md text-[10px] font-black uppercase">QUEBRA (${formatMoney(dif)})</span>`;
            }
        }

        const difColor = Math.abs(dif) <= 0.05 ? 'text-slate-500' : (dif > 0 ? 'text-emerald-600' : 'text-red-600');

        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                <td class="p-3 text-slate-700 dark:text-slate-300 font-mono text-xs">${dataStr}</td>
                <td class="p-3 text-slate-800 dark:text-slate-200 font-bold">${f.operador || 'Operador'}</td>
                <td class="p-3 text-right font-medium">${formatMoney(totSis)}</td>
                <td class="p-3 text-right font-bold text-slate-800 dark:text-slate-100">${formatMoney(totDec)}</td>
                <td class="p-3 text-right font-black ${difColor}">${dif >= 0 ? '+' : ''}${formatMoney(dif)}</td>
                <td class="p-3 text-center">${status}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button onclick="verMapaFechamento('${f.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"><i class="fa-solid fa-receipt mr-1"></i> Mapa</button>
                    <button onclick="excluirFechamento('${f.id}')" title="Excluir este registro de fechamento" class="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-bold text-xs ml-1 transition-colors"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `;
    });

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-500">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fa-solid fa-clipboard-question text-3xl opacity-40"></i>
                        <span>Nenhum fechamento no período selecionado</span>
                        <button onclick="filtrarFechamentosPeriodo('todos')" class="mt-2 text-xs font-bold text-blue-600 hover:underline">
                            Ver todos os fechamentos cadastrados
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
}

function verMapaFechamento(id) {
    const fechamento = dbLoja.caixa_fechamentos.find(f => f.id === id);
    if (!fechamento) {
        if (typeof showToast === 'function') showToast('Fechamento não localizado.', 'error');
        return;
    }
    const html = renderizarMapaCaixaHTML(fechamento);
    setEl('mapa-caixa-conteudo', html, 'innerHTML');
    const modal = document.getElementById('modal-mapa-caixa');
    if (modal) modal.classList.remove('hidden');
}

async function excluirFechamento(id) {
    if (!id) return;
    const f = (dbLoja.caixa_fechamentos || []).find(item => item.id === id);
    const idTxt = f ? `#${f.id} (${f.operador || 'Operador'} - ${f.status || ''})` : `#${id}`;
    
    if (!confirm(`Tem certeza que deseja EXCLUIR o fechamento ${idTxt}?\n\nEsta ação removerá este fechamento do histórico e permitirá apurar o turno novamente caso tenha sido fechado por engano.`)) {
        return;
    }
    
    try {
        const empresaRef = window.getEmpresaRef();
        if (!empresaRef) throw new Error('Referência da empresa não encontrada.');
        
        // 1. Deletar do Firestore
        await empresaRef.collection('caixa_fechamentos').doc(id).delete();
        
        // 2. Remover da memória dbLoja
        dbLoja.caixa_fechamentos = (dbLoja.caixa_fechamentos || []).filter(item => item.id !== id);
        if (Array.isArray(window.db?.caixa_fechamentos)) {
            window.db.caixa_fechamentos = window.db.caixa_fechamentos.filter(item => item.id !== id);
        }
        
        // 3. Atualizar cache
        if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function') {
            window.FCCache.set('caixa_fechamentos', dbLoja.caixa_fechamentos);
        }
        
        // 4. Se o caixa atual estava com status FECHADO pelo fechamento excluído, perguntar se deseja reabrir
        const cx = obterCaixaOperacao();
        if (cx && (cx.ultimoFechamento?.id === id || cx.status === 'FECHADO')) {
            const reabrir = confirm('Deseja REABRIR o caixa atual para continuar registrando e apurando as vendas de hoje normalmente?');
            if (reabrir) {
                cx.status = 'ABERTO';
                if (cx.ultimoFechamento?.id === id) delete cx.ultimoFechamento;
                const targetDocId = cx.id || 'caixa_atual';
                await empresaRef.collection('caixa').doc(targetDocId).set(cx, { merge: true });
                if (targetDocId !== 'caixa_atual') {
                    await empresaRef.collection('caixa').doc('caixa_atual').set(cx, { merge: true });
                }
                if (window.db?.caixa) {
                    window.db.caixa.status = 'ABERTO';
                    if (window.db.caixa.ultimoFechamento?.id === id) delete window.db.caixa.ultimoFechamento;
                }
            }
        }
        
        if (typeof showToast === 'function') showToast('Fechamento excluído com sucesso!', 'success');
        renderTabFechamentos();
        renderTabResumo();
    } catch(err) {
        console.error('Erro ao excluir fechamento:', err);
        if (typeof showToast === 'function') showToast('Erro ao excluir fechamento: ' + err.message, 'error');
    }
}
window.excluirFechamento = excluirFechamento;

function exportarCSVFechamentos() {
    const table = document.getElementById('tabela-historico-fechamentos')?.parentElement?.parentElement?.querySelector('table');
    exportarTabelaCSV(table, 'Historico_Fechamentos');
}

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

// -----------------------------------------------------------------
// OPERAÇÕES DO CAIXA: ABERTURA, SANGRIA, SUPRIMENTO
// -----------------------------------------------------------------
function abrirModalCaixa(op) {
    op = (op || 'abrir').toLowerCase();
    const cx = obterCaixaOperacao();
    const cxStatus = cx?.status || 'FECHADO';
    
    if (op === 'abrir' && cxStatus === 'ABERTO') {
        if (typeof showToast === 'function') showToast('O seu caixa já está aberto!', 'warning');
        return;
    }
    if (op !== 'abrir' && cxStatus === 'FECHADO') {
        if (typeof showToast === 'function') showToast('Abra o caixa primeiro antes de realizar esta movimentação!', 'warning');
        return;
    }

    const tipoEl = document.getElementById('caixa-operacao-tipo');
    if (tipoEl) tipoEl.value = op.toUpperCase();

    const titleEl = document.getElementById('modal-caixa-title');
    if (titleEl) {
        titleEl.innerText = op === 'abrir' ? 'Abertura de Caixa' : (op === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)');
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
    const val = parseInputMoney(valorEl ? valorEl.value : '0') || 0;
    const desc = (descEl && descEl.value) ? descEl.value.trim() : op;

    if (val < 0) {
        if (typeof showToast === 'function') showToast('Valor inválido.', 'error');
        return;
    }

    let cxAtual = obterCaixaOperacao();
    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
    let novoStatus = cxAtual.status || 'FECHADO';
    let novoSaldo = Number(cxAtual.saldo || 0);
    const dataIso = new Date().toISOString();
    const opInfo = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : { nome: 'Operador' };
    const operadorNome = window.currentUserInfo?.nome || opInfo.nome || 'Operador Caixa';

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
        if (val > novoSaldo) {
            if (typeof showToast === 'function') showToast(`Saldo em dinheiro insuficiente para sangria! (Saldo atual: ${formatMoney(novoSaldo)})`, 'error');
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
        if (!empresaRef) throw new Error('Empresa ativa não identificada.');
        
        const targetDocId = cxAtual.id || (typeof window.obterCaixaDocId === 'function' ? window.obterCaixaDocId() : 'caixa_atual');
        const targetCaixaRef = empresaRef.collection('caixa').doc(targetDocId);

        const dadosSalvar = {
            ...cxAtual,
            id: targetDocId,
            status: novoStatus,
            saldo: novoSaldo,
            historico: cxHistoricoNovo,
            ultimaAbertura: op === 'ABRIR' ? dataIso : (cxAtual.ultimaAbertura || dataIso),
            operadorAtual: operadorNome,
            operadorUid: opInfo.uid || cxAtual.operadorUid || ''
        };

        const batch = (typeof firestore !== 'undefined' && firestore.batch) ? firestore.batch() : null;
        if (batch) {
            batch.set(targetCaixaRef, dadosSalvar, { merge: true });
            if (targetDocId !== 'caixa_atual') {
                batch.set(empresaRef.collection('caixa').doc('caixa_atual'), dadosSalvar, { merge: true });
            }
            await batch.commit();
        } else {
            await targetCaixaRef.set(dadosSalvar, { merge: true });
            if (targetDocId !== 'caixa_atual') {
                await empresaRef.collection('caixa').doc('caixa_atual').set(dadosSalvar, { merge: true });
            }
        }

        // Atualização síncrona local
        Object.assign(cxAtual, dadosSalvar);
        dbLoja.caixa_atual = cxAtual;
        const idx = dbLoja.caixas.findIndex(c => c.id === targetDocId);
        if (idx >= 0) dbLoja.caixas[idx] = dadosSalvar;
        else dbLoja.caixas.push(dadosSalvar);

        if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function') {
            window.FCCache.set('caixa', dadosSalvar);
            window.FCCache.set('fc_moveis_caixa', dadosSalvar);
            if (targetDocId) window.FCCache.set('fc_moveis_' + targetDocId, dadosSalvar);
        }

        fecharModalCaixa();
        if (typeof showToast === 'function') showToast(`Operação de ${op} realizada com sucesso!`, 'success');
        reRenderCurrentTab();
    } catch(err) {
        console.error('Erro na movimentação do caixa:', err);
        if (typeof showToast === 'function') showToast('Erro ao registrar operação no caixa: ' + (err.message || ''), 'error');
    }
}

// -----------------------------------------------------------------
// FECHAMENTO CEGO & ENCERRAMENTO DE TURNO
// -----------------------------------------------------------------
function abrirModalFechamentoCego() {
    const cx = obterCaixaOperacao();
    const cxStatus = cx?.status || 'FECHADO';
    const saldo = Number(cx?.saldo || 0);

    // Se estiver fechado E o saldo for zero:
    if (cxStatus !== 'ABERTO' && saldo <= 0) {
        if (typeof showToast === 'function') showToast('O caixa já está FECHADO e com saldo zerado!', 'info');
        return;
    }
    
    // Se o status estiver marcado como FECHADO mas ainda tem saldo físico na gaveta:
    if (cxStatus !== 'ABERTO' && saldo > 0) {
        if (typeof showToast === 'function') showToast(`Atenção: O caixa consta como fechado mas possui saldo de ${formatMoney(saldo)}. Iniciando conferência e encerramento.`, 'warning');
    }

    // Preenche automaticamente com os valores apurados pelo sistema para agilizar conferência
    preencherValoresSistemaFechamento();
    
    const modal = document.getElementById('modal-fechamento-cego');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalFechamentoCego() {
    const modal = document.getElementById('modal-fechamento-cego');
    if (modal) modal.classList.add('hidden');
}

function recalcularTotalDeclarado() {
    const getVal = id => parseInputMoney(document.getElementById(id)?.value) || 0;
    const tot = getVal('fc-dinheiro') + getVal('fc-debito') + getVal('fc-credito') + getVal('fc-pix') + getVal('fc-outros');
    const disp = document.getElementById('fc-total-declarado-display');
    if (disp) disp.innerText = formatMoney(tot);
    return tot;
}

function apurarValoresTurno(cxAtual) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeInicioTime = hoje.getTime();

    // Determina timestamp de abertura informada
    let dataAbertura = cxAtual?.ultimaAbertura;
    let dataAberturaTime = 0;
    if (dataAbertura) {
        const dtParsed = new Date(dataAbertura).getTime();
        if (!isNaN(dtParsed)) dataAberturaTime = dtParsed - 60000; // tolerância de 1 min
    }

    // Busca o último fechamento válido realizado hoje
    let ultimoFechamentoHojeTime = 0;
    const listaFech = Array.isArray(dbLoja?.caixa_fechamentos) ? dbLoja.caixa_fechamentos : [];
    listaFech.forEach(f => {
        const dtF = new Date(f.dataFechamento?.toDate ? f.dataFechamento.toDate() : (f.dataFechamento || f.criadoEm || 0)).getTime();
        if (dtF >= hojeInicioTime && dtF > ultimoFechamentoHojeTime) {
            ultimoFechamentoHojeTime = dtF;
        }
    });

    // Marco inicial do turno atual:
    // 1. Se houve fechamento hoje, o corte é após o último fechamento (ou data de abertura se for posterior).
    // 2. Se o caixa foi aberto antes de hoje e ainda não foi fechado, usa a data de abertura antiga.
    // 3. Se não houve fechamento hoje, o corte abrange TODAS as operações de hoje (a partir das 00:00),
    //    garantindo que vendas realizadas pela manhã antes de clicar em "Abrir Caixa" NÃO sejam ignoradas.
    let dataCorteTime = hojeInicioTime;
    if (ultimoFechamentoHojeTime > 0) {
        dataCorteTime = (dataAberturaTime > ultimoFechamentoHojeTime) ? dataAberturaTime : ultimoFechamentoHojeTime;
    } else if (dataAberturaTime > 0 && dataAberturaTime < hojeInicioTime) {
        dataCorteTime = dataAberturaTime;
    } else {
        dataCorteTime = hojeInicioTime;
    }

    if (!dataAbertura) {
        dataAbertura = new Date(dataCorteTime).toISOString();
    }

    const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : { uid: null, nome: 'Operador' };
    const targetDocId = cxAtual?.id || (typeof window.obterCaixaDocId === 'function' ? window.obterCaixaDocId(opAtual.uid) : 'caixa_atual');
    const targetUid = cxAtual?.operadorUid || opAtual.uid || '';

    // No Caixa Consolidado da Loja, apura todas as vendas concluídas da loja no turno (sem segregação restritiva de vendedor)
    const vendasTurno = (dbLoja.vendas || []).filter(v => {
        if (!v || v.tipo === 'ORÇAMENTO') return false;
        const st = String(v.status || '').toUpperCase();
        if (st === 'CANCELADA' || st === 'AGUARDANDO_PAGAMENTO') return false;
        const dt = new Date(v.data?.toDate ? v.data.toDate() : (v.data || 0)).getTime();
        if (dt < dataCorteTime) return false;
        return true;
    });

    let sysDinheiro = 0, sysDebito = 0, sysCredito = 0, sysPix = 0, sysBoleto = 0, sysFiado = 0, sysOutros = 0;

    vendasTurno.forEach(v => {
        if (Array.isArray(v.pagamentos) && v.pagamentos.length > 0) {
            v.pagamentos.forEach(p => {
                const metodo = String(p.metodo || '');
                let val = Number(p.valor || 0);
                if (metodo.includes('Dinheiro') && Number(v.troco || 0) > 0) {
                    val = Math.max(0, val - Number(v.troco || 0));
                }
                if (metodo.includes('Dinheiro')) sysDinheiro += val;
                else if (metodo.includes('Débito') || metodo.includes('Debito')) sysDebito += val;
                else if (metodo.includes('Crédito') || metodo.includes('Credito')) sysCredito += val;
                else if (metodo.includes('PIX') || metodo.includes('Pix')) sysPix += val;
                else if (metodo.includes('Boleto')) sysBoleto += val;
                else if (metodo.includes('Fiado')) sysFiado += val;
                else sysOutros += val;
            });
        } else {
            const pag = String(v.pag || '');
            const tot = Number(v.tot || v.subtotal || 0);
            if (pag.includes('Dinheiro')) sysDinheiro += tot;
            else if (pag.includes('Débito') || pag.includes('Debito')) sysDebito += tot;
            else if (pag.includes('Crédito') || pag.includes('Credito')) sysCredito += tot;
            else if (pag.includes('PIX') || pag.includes('Pix')) sysPix += tot;
            else if (pag.includes('Boleto')) sysBoleto += tot;
            else if (pag.includes('Fiado')) sysFiado += tot;
            else sysOutros += tot;
        }
    });

    const movsTurno = (cxAtual?.historico || []).filter(m => {
        const dt = new Date(m.data?.toDate ? m.data.toDate() : (m.data || 0)).getTime();
        return dt >= dataCorteTime;
    });

    let sysFundoTroco = 0, sysSuprimentos = 0, sysSangrias = 0;
    movsTurno.forEach(m => {
        const v = Number(m.valor || 0);
        if (m.tipo === 'ABERTURA') sysFundoTroco += v;
        else if (m.tipo === 'ENTRADA' && !String(m.desc || '').includes('VENDA')) sysSuprimentos += v;
        else if (m.tipo === 'SAIDA') sysSangrias += v;
    });

    const saldoEsperadoGaveta = Number(cxAtual?.saldo || 0);
    const saldoMovsGaveta = sysSuprimentos + sysDinheiro - sysSangrias;
    if (sysFundoTroco === 0 || Math.abs(saldoEsperadoGaveta - (sysFundoTroco + saldoMovsGaveta)) > 0.01) {
        sysFundoTroco = Math.max(0, saldoEsperadoGaveta - saldoMovsGaveta);
    }

    const totalApuradoSistema = saldoEsperadoGaveta + sysDebito + sysCredito + sysPix + sysOutros;

    return {
        dataAbertura,
        dataAberturaTime,
        sysDinheiro,
        sysDebito,
        sysCredito,
        sysPix,
        sysBoleto,
        sysFiado,
        sysOutros,
        sysFundoTroco,
        sysSuprimentos,
        sysSangrias,
        saldoEsperadoGaveta,
        totalApuradoSistema,
        targetDocId,
        targetUid,
        opAtual
    };
}

function preencherValoresSistemaFechamento() {
    const cx = obterCaixaOperacao();
    const ap = apurarValoresTurno(cx);

    const setInputMoney = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    };

    setInputMoney('fc-debito', ap.sysDebito);
    setInputMoney('fc-credito', ap.sysCredito);
    setInputMoney('fc-pix', ap.sysPix);
    setInputMoney('fc-outros', ap.sysOutros);
    setInputMoney('fc-dinheiro', ap.saldoEsperadoGaveta);

    recalcularTotalDeclarado();
    if (typeof showToast === 'function') {
        showToast('Valores apurados pelo sistema foram preenchidos!', 'info');
    }
}
window.preencherValoresSistemaFechamento = preencherValoresSistemaFechamento;

async function confirmarFechamentoCego() {
    let decDinheiro = parseInputMoney(document.getElementById('fc-dinheiro')?.value) || 0;
    let decDebito = parseInputMoney(document.getElementById('fc-debito')?.value) || 0;
    let decCredito = parseInputMoney(document.getElementById('fc-credito')?.value) || 0;
    let decPix = parseInputMoney(document.getElementById('fc-pix')?.value) || 0;
    let decOutros = parseInputMoney(document.getElementById('fc-outros')?.value) || 0;
    let decTotal = decDinheiro + decDebito + decCredito + decPix + decOutros;
    const obs = document.getElementById('fc-obs')?.value.trim() || '';

    const cxAtual = obterCaixaOperacao();
    const ap = apurarValoresTurno(cxAtual);
    const targetDocId = ap.targetDocId || cxAtual.id || 'caixa_atual';
    const targetUid = ap.targetUid || cxAtual.operadorUid || '';

    const dataFechamento = new Date().toISOString();
    const operador = cxAtual.operadorAtual || ap.opAtual.nome || window.currentUserInfo?.nome || 'Operador Caixa';

    // Se o operador não digitou nada (tudo zerado) mas o sistema tinha apuração:
    if (decTotal === 0 && (ap.saldoEsperadoGaveta > 0 || (ap.sysDebito + ap.sysCredito + ap.sysPix + ap.sysOutros) > 0)) {
        const querPreencher = confirm("Atenção: Os valores declarados estão zerados (R$ 0,00).\n\nDeseja preencher automaticamente com os valores apurados pelo sistema para fechar conciliado?\n\n[OK] Sim, preencher com os valores do sistema e concluir.\n[Cancelar] Fechar como R$ 0,00 (Gerará Quebra de Caixa).");
        if (querPreencher) {
            preencherValoresSistemaFechamento();
            decDinheiro = ap.saldoEsperadoGaveta;
            decDebito = ap.sysDebito;
            decCredito = ap.sysCredito;
            decPix = ap.sysPix;
            decOutros = ap.sysOutros;
            decTotal = decDinheiro + decDebito + decCredito + decPix + decOutros;
        }
    }

    const difDinheiro = decDinheiro - ap.saldoEsperadoGaveta;
    const difGeral = decTotal - ap.totalApuradoSistema;

    // Se o operador conferiu apenas o dinheiro físico e deixou cartões vazios:
    const apenasGavetaDeclarada = (decDebito === 0 && decCredito === 0 && decPix === 0 && decOutros === 0 && decDinheiro > 0);
    let statusDiff = 'CONCILIADO / EXATO';
    let difEfetiva = difGeral;

    if (apenasGavetaDeclarada) {
        difEfetiva = difDinheiro;
        statusDiff = Math.abs(difDinheiro) < 0.05 ? 'GAVETA CONCILIADA' : (difDinheiro > 0 ? 'SOBRA EM GAVETA' : 'QUEBRA EM GAVETA');
    } else {
        statusDiff = Math.abs(difGeral) < 0.05 ? 'CONCILIADO / EXATO' : (difGeral > 0 ? 'SOBRA DE CAIXA' : 'QUEBRA DE CAIXA');
    }

    const mapaDados = {
        id: 'FECH-' + Date.now(),
        caixaId: targetDocId,
        operadorId: targetUid,
        dataAbertura: ap.dataAbertura,
        dataFechamento: dataFechamento,
        operador: operador,
        observacao: obs,
        totalSistema: ap.totalApuradoSistema,
        totalDeclarado: decTotal,
        diferenca: difEfetiva,
        status: statusDiff,
        apuradoSistema: {
            fundoTroco: ap.sysFundoTroco,
            suprimentos: ap.sysSuprimentos,
            sangrias: ap.sysSangrias,
            vendasDinheiro: ap.sysDinheiro,
            vendasDebito: ap.sysDebito,
            vendasCredito: ap.sysCredito,
            vendasPix: ap.sysPix,
            vendasBoleto: ap.sysBoleto,
            vendasFiado: ap.sysFiado,
            saldoEsperadoGaveta: ap.saldoEsperadoGaveta,
            totalGeral: ap.totalApuradoSistema
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
            difEfetiva: difEfetiva,
            status: statusDiff,
            apenasGavetaDeclarada: apenasGavetaDeclarada
        }
    };

    try {
        const empresaRef = window.getEmpresaRef();
        if (!empresaRef) throw new Error('Referência da empresa não encontrada.');

        const cxHistoricoNovo = Array.isArray(cxAtual.historico) ? [...cxAtual.historico] : [];
        cxHistoricoNovo.unshift({
            data: dataFechamento,
            tipo: 'FECHAMENTO',
            desc: `FECHAMENTO DE TURNO (${statusDiff}) - Retirado: ${formatMoney(decDinheiro)} - Op: ${operador}`,
            valor: decDinheiro,
            operador: operador,
            saldoApos: 0
        });

        const novoCaixaDados = {
            ...cxAtual,
            id: targetDocId,
            status: 'FECHADO',
            saldo: 0,
            historico: cxHistoricoNovo,
            ultimoFechamento: mapaDados,
            dataFechamento: dataFechamento,
            operadorFechamento: operador
        };

        const batch = (typeof firestore !== 'undefined' && firestore.batch) ? firestore.batch() : null;
        if (batch) {
            const targetRef = empresaRef.collection('caixa').doc(targetDocId);
            batch.set(targetRef, novoCaixaDados, { merge: true });

            if (targetDocId !== 'caixa_atual') {
                batch.set(empresaRef.collection('caixa').doc('caixa_atual'), novoCaixaDados, { merge: true });
            }

            batch.set(empresaRef.collection('caixa_fechamentos').doc(mapaDados.id), mapaDados);
            await batch.commit();
        } else {
            await empresaRef.collection('caixa').doc(targetDocId).set(novoCaixaDados, { merge: true });
            if (targetDocId !== 'caixa_atual') {
                await empresaRef.collection('caixa').doc('caixa_atual').set(novoCaixaDados, { merge: true });
            }
            await empresaRef.collection('caixa_fechamentos').doc(mapaDados.id).set(mapaDados);
        }

        // Atualização síncrona local imediata
        Object.assign(cxAtual, novoCaixaDados);
        dbLoja.caixa_atual = cxAtual;
        
        const idx = dbLoja.caixas.findIndex(c => c.id === targetDocId);
        if (idx >= 0) dbLoja.caixas[idx] = novoCaixaDados;
        else dbLoja.caixas.push(novoCaixaDados);

        dbLoja.caixa_fechamentos = [mapaDados, ...dbLoja.caixa_fechamentos.filter(f => f.id !== mapaDados.id)];

        if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function') {
            window.FCCache.set('caixa_fechamentos', dbLoja.caixa_fechamentos);
            window.FCCache.set('caixa', novoCaixaDados);
            window.FCCache.set('fc_moveis_caixa', novoCaixaDados);
            if (targetDocId) window.FCCache.set('fc_moveis_' + targetDocId, novoCaixaDados);
        }

        fecharModalFechamentoCego();
        if (typeof showToast === 'function') showToast('Caixa fechado com sucesso!', 'success');

        // Exibe o mapa de fechamento
        const modalMapa = document.getElementById('modal-mapa-caixa');
        const contMapa = document.getElementById('mapa-caixa-conteudo');
        if (modalMapa && contMapa) {
            contMapa.innerHTML = renderizarMapaCaixaHTML(mapaDados);
            modalMapa.classList.remove('hidden');
        }

        renderTabResumo();
        renderTabFechamentos();
    } catch(err) {
        console.error('Erro ao fechar caixa:', err);
        if (typeof showToast === 'function') showToast('Erro ao realizar fechamento do caixa: ' + (err.message || ''), 'error');
    }
}

// -----------------------------------------------------------------
// TRANSFERÊNCIA ENTRE CONTAS
// -----------------------------------------------------------------
function abrirModalTransferenciaCaixa() {
    const cx = obterCaixaOperacao();
    const saldoGaveta = Number(cx?.saldo || 0);
    if (saldoGaveta <= 0) {
        if (typeof showToast === 'function') showToast('O caixa físico está sem saldo para transferir.', 'warning');
        return;
    }
    const valInput = document.getElementById('transf-valor');
    if (valInput) valInput.value = formatMoney(saldoGaveta).replace('R$', '').trim();
    const obsInput = document.getElementById('transf-obs');
    if (obsInput) obsInput.value = '';

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
    const valor = parseInputMoney(valInput?.value || '0') || 0;
    const obs = document.getElementById('transf-obs')?.value.trim() || '';

    if (!valor || valor <= 0) {
        if (typeof showToast === 'function') showToast('Digite um valor válido para transferência.', 'warning');
        return;
    }

    const cxAtual = obterCaixaOperacao();
    const saldoGaveta = Number(cxAtual?.saldo || 0);
    if (valor > saldoGaveta) {
        if (typeof showToast === 'function') showToast(`Saldo em dinheiro insuficiente no caixa para transferir! (Saldo atual: ${formatMoney(saldoGaveta)})`, 'error');
        return;
    }

    try {
        const empresaRef = window.getEmpresaRef();
        if (!empresaRef) throw new Error('Empresa ativa não identificada.');

        const dataIso = new Date().toISOString();
        const novoSaldo = saldoGaveta - valor;
        const novoHistorico = [...(cxAtual.historico || [])];
        const operador = window.currentUserInfo?.nome || (typeof window.obterOperadorAtual === 'function' ? window.obterOperadorAtual().nome : 'Operador');

        novoHistorico.unshift({
            data: dataIso,
            tipo: 'SAIDA',
            desc: `TRANSFERÊNCIA PARA ${conta.toUpperCase()} ${obs ? '(' + obs + ')' : ''}`,
            valor: valor,
            operador: operador,
            saldoApos: novoSaldo
        });

        const targetDocId = cxAtual.id || (typeof window.obterCaixaDocId === 'function' ? window.obterCaixaDocId() : 'caixa_atual');
        const targetCaixaRef = empresaRef.collection('caixa').doc(targetDocId);

        const dadosCaixaAtualizados = {
            ...cxAtual,
            saldo: novoSaldo,
            historico: novoHistorico
        };

        const batch = (typeof firestore !== 'undefined' && firestore.batch) ? firestore.batch() : null;
        if (batch) {
            batch.set(targetCaixaRef, dadosCaixaAtualizados, { merge: true });
            if (targetDocId !== 'caixa_atual') {
                batch.set(empresaRef.collection('caixa').doc('caixa_atual'), dadosCaixaAtualizados, { merge: true });
            }
            const finRef = empresaRef.collection('financeiro').doc();
            batch.set(finRef, {
                ref: `Transf. Caixa para ${conta.toUpperCase()} ${obs ? '(' + obs + ')' : ''}`,
                data: dataIso,
                pessoa: `Caixa Loja - ${operador}`,
                wpp: '',
                valor: valor,
                status: 'PAGO',
                tipo: 'TRANSFERENCIA',
                categoria: 'Transferência Interna',
                metodoPagamento: 'Dinheiro',
                dataPagamento: dataIso,
                contaDestino: conta
            });
            await batch.commit();
        } else {
            await targetCaixaRef.set(dadosCaixaAtualizados, { merge: true });
            if (targetDocId !== 'caixa_atual') {
                await empresaRef.collection('caixa').doc('caixa_atual').set(dadosCaixaAtualizados, { merge: true });
            }
            await empresaRef.collection('financeiro').add({
                ref: `Transf. Caixa para ${conta.toUpperCase()} ${obs ? '(' + obs + ')' : ''}`,
                data: dataIso,
                pessoa: `Caixa Loja - ${operador}`,
                wpp: '',
                valor: valor,
                status: 'PAGO',
                tipo: 'TRANSFERENCIA',
                categoria: 'Transferência Interna',
                metodoPagamento: 'Dinheiro',
                dataPagamento: dataIso,
                contaDestino: conta
            });
        }

        // Atualiza memória
        Object.assign(cxAtual, dadosCaixaAtualizados);
        dbLoja.caixa_atual = cxAtual;
        const idx = dbLoja.caixas.findIndex(c => c.id === targetDocId);
        if (idx >= 0) dbLoja.caixas[idx] = dadosCaixaAtualizados;

        fecharModalTransferenciaCaixa();
        if (typeof showToast === 'function') showToast(`Transferência de ${formatMoney(valor)} realizada com sucesso!`, 'success');
        reRenderCurrentTab();
    } catch(err) {
        console.error('Erro na transferência:', err);
        if (typeof showToast === 'function') showToast('Erro ao realizar transferência: ' + (err.message || ''), 'error');
    }
}

// -----------------------------------------------------------------
// MAPA DE FECHAMENTO (REDUÇÃO Z) E IMPRESSÃO
// -----------------------------------------------------------------
function renderizarMapaCaixaHTML(m) {
    if (!m) return '<p class="text-center text-slate-500">Dados do fechamento indisponíveis.</p>';

    const defaultEmpNome = (window.currentEmpresaData?.nomeEmpresa) || localStorage.getItem('fc_nome_empresa_ativa') || (localStorage.getItem('fc_empresa_ativa') === 'emp_fc_moveis' ? 'FC Móveis & Interiores' : 'FC Gestão');
    const emp = window.db?.config?.empresa || { nome: defaultEmpNome, cnpj: '00.000.000/0000-00', telefone: '' };

    const ap = m.apuradoSistema || {};
    const dec = m.declaradoOperador || {};

    let fundoTrocoExibir = Number(ap.fundoTroco || 0);
    const supr = Number(ap.suprimentos || 0);
    const vDin = Number(ap.vendasDinheiro || 0);
    const sang = Number(ap.sangrias || 0);
    const sGav = Number(ap.saldoEsperadoGaveta || 0);

    const saldoMovs = supr + vDin - sang;
    if (fundoTrocoExibir === 0 && sGav > saldoMovs) {
        fundoTrocoExibir = Math.max(0, sGav - saldoMovs);
    }

    const decDin = Number(dec.dinheiro || 0);
    const difDinheiro = Number(m.diferencas?.difDinheiro ?? (decDin - sGav));
    const difGeral = Number(m.diferenca ?? m.diferencas?.difGeral ?? 0);

    const apenasGaveta = (Number(dec.debito || 0) === 0 && Number(dec.credito || 0) === 0 && Number(dec.pix || 0) === 0 && decDin > 0);
    const difExibir = apenasGaveta ? difDinheiro : difGeral;
    const corDiferenca = difExibir >= 0 ? 'text-emerald-600' : 'text-red-600';
    const bgDiferenca = difExibir >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30';
    const statusTxt = m.status || (apenasGaveta 
        ? (Math.abs(difDinheiro) < 0.05 ? 'GAVETA CONCILIADA' : (difDinheiro > 0 ? 'SOBRA EM GAVETA' : 'QUEBRA EM GAVETA'))
        : (Math.abs(difGeral) < 0.05 ? 'CONCILIADO / EXATO' : (difGeral > 0 ? 'SOBRA DE CAIXA' : 'QUEBRA DE CAIXA')));

    const totSis = Number(m.totalSistema ?? ap.totalGeral ?? 0);
    const totDec = Number(m.totalDeclarado ?? dec.totalGeral ?? 0);

    const fmtData = dt => {
        if (!dt) return '-';
        const d = dt.toDate ? dt.toDate() : new Date(dt);
        if (isNaN(d.getTime())) return '-';
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    return `
    <div class="font-mono text-xs text-slate-800 dark:text-slate-200 p-2 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner">
        <div class="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h2 class="text-base font-black uppercase text-slate-900 dark:text-white">${emp.nome}</h2>
            <p class="text-[10px] text-slate-500">CNPJ: ${emp.cnpj || 'Não informado'} ${emp.telefone ? '| Tel: ' + emp.telefone : ''}</p>
            <p class="text-xs font-bold uppercase mt-1 bg-slate-100 dark:bg-slate-800 py-1 rounded">MAPA DE FECHAMENTO DE CAIXA (REDUÇÃO Z)</p>
            <p class="text-[10px] text-slate-400 mt-1">Ref: #${m.id}</p>
        </div>

        <div class="space-y-1.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3 text-[11px]">
            <div class="flex justify-between"><span>OPERADOR:</span><strong class="uppercase">${m.operador || 'Balcão'}</strong></div>
            <div class="flex justify-between"><span>ABERTURA:</span><strong>${fmtData(m.dataAbertura)}</strong></div>
            <div class="flex justify-between"><span>FECHAMENTO:</span><strong>${fmtData(m.dataFechamento)}</strong></div>
            ${m.observacao ? `<div class="flex justify-between text-slate-500"><span>OBS:</span><em>${m.observacao}</em></div>` : ''}
        </div>

        <!-- 1. FLUXO DE GAVETA -->
        <div class="border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h4 class="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1.5">1. FLUXO DE GAVETA (DINHEIRO FÍSICO)</h4>
            <div class="flex justify-between text-[11px]"><span>(+) Saldo Inicial / Fundo de Troco:</span><span>${formatMoney(fundoTrocoExibir)}</span></div>
            <div class="flex justify-between text-[11px]"><span>(+) Suprimentos (Entradas):</span><span>${formatMoney(supr)}</span></div>
            <div class="flex justify-between text-[11px]"><span>(+) Vendas em Dinheiro:</span><span>${formatMoney(vDin)}</span></div>
            <div class="flex justify-between text-[11px]"><span>(-) Sangrias (Retiradas):</span><span>- ${formatMoney(sang)}</span></div>
            <div class="flex justify-between font-bold text-xs pt-1 border-t border-slate-200 dark:border-slate-800 mt-1">
                <span>(=) Saldo Esperado Gaveta:</span><span class="text-blue-600">${formatMoney(sGav)}</span>
            </div>
            <div class="flex justify-between font-bold text-xs text-emerald-600">
                <span>(V) Dinheiro Declarado:</span><span>${formatMoney(decDin)}</span>
            </div>
            <div class="flex justify-between font-bold text-xs pt-1 border-t border-dotted border-slate-200 dark:border-slate-800 ${difDinheiro >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                <span>Diferença em Dinheiro:</span>
                <span>${difDinheiro >= 0 ? '+' : ''}${formatMoney(difDinheiro)}</span>
            </div>
        </div>

        <!-- 2. MÉTODOS ELETRÔNICOS -->
        <div class="border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
            <h4 class="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] mb-1.5">2. MÉTODOS ELETRÔNICOS E OUTROS</h4>
            <div class="flex justify-between text-[11px]"><span>Cartão Débito (Sistema / Declarado):</span><span>${formatMoney(ap.vendasDebito || 0)} / <strong>${formatMoney(dec.debito || 0)}</strong></span></div>
            <div class="flex justify-between text-[11px]"><span>Cartão Crédito (Sistema / Declarado):</span><span>${formatMoney(ap.vendasCredito || 0)} / <strong>${formatMoney(dec.credito || 0)}</strong></span></div>
            <div class="flex justify-between text-[11px]"><span>PIX (Sistema / Declarado):</span><span>${formatMoney(ap.vendasPix || 0)} / <strong>${formatMoney(dec.pix || 0)}</strong></span></div>
            ${(Number(ap.vendasBoleto || 0) > 0 || Number(ap.vendasFiado || 0) > 0) ? `<div class="flex justify-between text-[11px]"><span>Boletos / Fiados:</span><span>${formatMoney((ap.vendasBoleto || 0) + (ap.vendasFiado || 0))}</span></div>` : ''}
            ${Number(dec.outros || 0) > 0 ? `<div class="flex justify-between text-[11px]"><span>Outros Declarados:</span><strong>${formatMoney(dec.outros || 0)}</strong></div>` : ''}
        </div>

        <!-- 3. RESUMO GERAL E AUDITORIA -->
        <div class="${bgDiferenca} p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
            <div class="flex justify-between text-xs font-bold mb-1">
                <span>TOTAL APURADO NO SISTEMA:</span><span>${formatMoney(totSis)}</span>
            </div>
            <div class="flex justify-between text-xs font-bold mb-1.5">
                <span>TOTAL DECLARADO PELO OPERADOR:</span><span>${formatMoney(totDec)}</span>
            </div>
            <div class="flex justify-between text-sm font-black pt-1.5 border-t border-slate-300 dark:border-slate-700 ${corDiferenca}">
                <span>DIVERGÊNCIA (${statusTxt}):</span>
                <span>${difExibir >= 0 ? '+' : ''}${formatMoney(difExibir)}</span>
            </div>
        </div>

        <div class="pt-6 border-t border-dashed border-slate-300 dark:border-slate-700 grid grid-cols-2 gap-6 text-center text-[10px]">
            <div>
                <div class="border-b border-slate-400 dark:border-slate-600 mb-1"></div>
                <p>Assinatura do Operador</p>
            </div>
            <div>
                <div class="border-b border-slate-400 dark:border-slate-600 mb-1"></div>
                <p>Assinatura da Gerência</p>
            </div>
        </div>
    </div>`;
}
window.renderizarMapaCaixaHTML = renderizarMapaCaixaHTML;

function imprimirArea(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const janela = window.open('', '', 'width=450,height=650');
    if (!janela) {
        if (typeof showToast === 'function') showToast('Permita pop-ups no navegador para imprimir o mapa.', 'warning');
        return;
    }
    janela.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir Mapa de Caixa</title>
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
window.imprimirArea = imprimirArea;

// Exportação explícita de todas as funções para o escopo global (window)
window.switchTab = switchTab;
window.mudarPeriodo = mudarPeriodo;
window.renderTabPeriodo = renderTabPeriodo;
window.imprimirRelatorio = imprimirRelatorio;
window.baixarPDFRelatorio = baixarPDFRelatorio;
window.exportarCSVPeriodo = exportarCSVPeriodo;
window.renderTabVendas = renderTabVendas;
window.exportarCSVVendas = exportarCSVVendas;
window.renderTabPagamentos = renderTabPagamentos;
window.exportarCSVPagamentos = exportarCSVPagamentos;
window.renderTabProdutos = renderTabProdutos;
window.exportarCSVProdutos = exportarCSVProdutos;
window.renderTabVendedores = renderTabVendedores;
window.exportarCSVVendedores = exportarCSVVendedores;
window.filtrarFechamentosPeriodo = filtrarFechamentosPeriodo;
window.renderTabFechamentos = renderTabFechamentos;
window.verMapaFechamento = verMapaFechamento;
window.exportarCSVFechamentos = exportarCSVFechamentos;
window.abrirModalCaixa = abrirModalCaixa;
window.fecharModalCaixa = fecharModalCaixa;
window.confirmarMovCaixa = confirmarMovCaixa;
window.abrirModalFechamentoCego = abrirModalFechamentoCego;
window.fecharModalFechamentoCego = fecharModalFechamentoCego;
window.recalcularTotalDeclarado = recalcularTotalDeclarado;
window.confirmarFechamentoCego = confirmarFechamentoCego;
window.abrirModalTransferenciaCaixa = abrirModalTransferenciaCaixa;
window.fecharModalTransferenciaCaixa = fecharModalTransferenciaCaixa;
window.confirmarTransferenciaCaixa = confirmarTransferenciaCaixa;
window.preencherValoresSistemaFechamento = preencherValoresSistemaFechamento;
window.inicializarCaixaLoja = inicializarCaixaLoja;
window.loadInitialData = loadInitialData;

