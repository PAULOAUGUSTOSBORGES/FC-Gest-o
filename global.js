function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function ordenarListaAlfabeticamente(lista, campoOuGetter = 'nome', direcao = 'asc') {
    if (!Array.isArray(lista)) return [];
    return [...lista].sort((a, b) => {
        let valA = a ? (typeof campoOuGetter === 'function' ? campoOuGetter(a) : a[campoOuGetter]) : '';
        let valB = b ? (typeof campoOuGetter === 'function' ? campoOuGetter(b) : b[campoOuGetter]) : '';
        valA = valA !== null && valA !== undefined ? String(valA).trim() : '';
        valB = valB !== null && valB !== undefined ? String(valB).trim() : '';
        const comp = valA.localeCompare(valB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        return direcao === 'desc' ? -comp : comp;
    });
}
window.ordenarListaAlfabeticamente = ordenarListaAlfabeticamente;
window.selecionarProdutoCustoBusca = function(nomeProd) {
    const hiddenId = document.getElementById('relatorio-custo-produto');
    if(!hiddenId) return;
    const produtosDb = (typeof db !== 'undefined' && db.produtos) ? db.produtos : [];
    const prod = produtosDb.find(p => p.nome === nomeProd);
    if(prod) {
        hiddenId.value = prod.id;
    } else {
        hiddenId.value = '';
    }
    if(typeof renderEvolucaoCustos === 'function') {
        renderEvolucaoCustos();
    }
};

// ==========================================
// 1. CONFIGURA??ES DO FIREBASE E SEGURAN?A
// ==========================================
// --- CARREGADOR AUTOMÁTICO DO CLIENTE DE LICENCIAMENTO SAAS MASTER ---
if (typeof document !== 'undefined' && typeof window.consultarLicencaCentral !== 'function') {
    try {
        const s = document.createElement('script');
        const basePath = window.location.pathname.includes('/sistema/') ? '' : 'sistema/';
        s.src = basePath + 'saas_licenca.js';
        document.head.appendChild(s);
    } catch(e) {}
}


// --- KILL SWITCH DO SERVICE WORKER E CACHE ---
// Adicionado para resolver o problema de loop infinito (cache travado).
if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let r of registrations) {
            r.unregister();
        }
    }).catch(function(err) {
        console.warn("ServiceWorker:", err);
    });
}
if (window.caches && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    caches.keys().then(function(names) {
        for (let name of names) {
            caches.delete(name);
        }
    }).catch(function(err) {
        console.warn("Caches:", err);
    });
}
// ---------------------------------------------

// ==========================================
// MOTOR DE TEMA DO SISTEMA (Dark / Light)
// Sincronização em tempo real entre todas as telas
// Padrão: escuro (dark).
// ==========================================
(function () {
    const tema = localStorage.getItem('fc_theme_sistema') || 'dark';
    const html = document.documentElement;
    const body = document.body;
    if (tema === 'light') {
        html.classList.remove('dark');
        html.classList.add('light');
        html.setAttribute('data-theme', 'light');
        if (body) {
            body.classList.remove('dark');
            body.classList.add('light');
        }
    } else {
        html.classList.add('dark');
        html.classList.remove('light');
        html.setAttribute('data-theme', 'dark');
        if (body) {
            body.classList.add('dark');
            body.classList.remove('light');
        }
    }
})();

function aplicarTemaSistema(tema, broadcast = true) {
    if (tema !== 'dark' && tema !== 'light') {
        tema = 'dark';
    }
    
    const html = document.documentElement;
    const body = document.body;
    if (tema === 'light') {
        html.classList.remove('dark');
        html.classList.add('light');
        html.setAttribute('data-theme', 'light');
        if (body) {
            body.classList.remove('dark');
            body.classList.add('light');
        }
    } else {
        html.classList.add('dark');
        html.classList.remove('light');
        html.setAttribute('data-theme', 'dark');
        if (body) {
            body.classList.add('dark');
            body.classList.remove('light');
        }
    }
    
    localStorage.setItem('fc_theme_sistema', tema);
    _atualizarBotaoTemaSistema();
    
    // Se a tela atual possuir cards de configuração de tema (ex: sistema.html), atualiza-os
    if (typeof window.atualizarCardsTemaTela === 'function') {
        window.atualizarCardsTemaTela(tema);
    }
    
    // Notifica instantaneamente as outras abas/telas do sistema
    if (broadcast) {
        try {
            if ('BroadcastChannel' in window) {
                const bc = new BroadcastChannel('fc_theme_channel');
                bc.postMessage({ tema: tema });
                bc.close();
            }
        } catch (e) { console.error("Erro interno:", e); }
    }
}
window.aplicarTemaSistema = aplicarTemaSistema;

function toggleTemaSistema() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    const novoTema = isDark ? 'light' : 'dark';
    aplicarTemaSistema(novoTema, true);
    
    if (typeof showToast === 'function') {
        showToast(`Tema alterado para Modo ${novoTema === 'dark' ? 'Escuro' : 'Claro'} em todo o sistema!`, 'info');
    }
}
window.toggleTemaSistema = toggleTemaSistema;
window.alternarTemaSistema = toggleTemaSistema;

function _atualizarBotaoTemaSistema() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.sistema-theme-btn-icon').forEach(icon => {
        icon.className = isDark
            ? 'fa-solid fa-moon sistema-theme-btn-icon text-indigo-400'
            : 'fa-solid fa-sun sistema-theme-btn-icon text-amber-500';
    });
    document.querySelectorAll('.sistema-theme-btn-label').forEach(el => {
        el.textContent = isDark ? 'Tema Escuro (Toque p/ Claro)' : 'Tema Claro (Toque p/ Escuro)';
    });
    document.querySelectorAll('#header-btn-tema').forEach(btn => {
        btn.title = isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro';
    });
}

// Ouvinte do evento storage: se o usuário mudar o tema em outra aba, esta aba se atualiza na hora!
window.addEventListener('storage', function (e) {
    if (e.key === 'fc_theme_sistema' && e.newValue) {
        aplicarTemaSistema(e.newValue, false);
    }
});

// Canal Broadcast para sincronização ultrarrápida entre abas abertas
try {
    if ('BroadcastChannel' in window) {
        const bcListen = new BroadcastChannel('fc_theme_channel');
        bcListen.onmessage = function (e) {
            if (e.data && e.data.tema) {
                aplicarTemaSistema(e.data.tema, false);
            }
        };
    }
} catch (e) { console.error("Erro interno:", e); }

// Injeta os botões de tema (no rodapé da sidebar e no topo do header)
document.addEventListener('DOMContentLoaded', function () {
    // 1. Botão no rodapé da Sidebar
    const sidebarBottom = document.querySelector('#sidebar .p-4.border-t');
    if (sidebarBottom && !document.getElementById('btn-tema-sistema')) {
        const isDark = document.documentElement.classList.contains('dark');
        const btn = document.createElement('button');
        btn.id = 'btn-tema-sistema';
        btn.onclick = toggleTemaSistema;
        btn.className = 'w-full flex items-center justify-center gap-2 text-sm font-medium transition-all mt-2 py-2.5 px-3 rounded-xl cursor-pointer shadow-sm';
        btn.title = 'Alternar Modo Escuro / Claro';
        btn.innerHTML = `
            <i class="${isDark ? 'fa-solid fa-moon text-indigo-400' : 'fa-solid fa-sun text-amber-500'} sistema-theme-btn-icon"></i>
            <span class="sistema-theme-btn-label text-xs font-semibold">${isDark ? 'Tema Escuro (Toque p/ Claro)' : 'Tema Claro (Toque p/ Escuro)'}</span>
        `;
        sidebarBottom.prepend(btn);
    }

    // 2. Botão no Header (acesso instantâneo direto no celular e PC sem precisar abrir menu)
    const headerActions = document.querySelector('header .flex.items-center.gap-2, header .flex.items-center.gap-4');
    if (headerActions) { headerActions.classList.add('flex-nowrap', 'shrink-0'); }
    if (headerActions && !document.getElementById('header-btn-tema')) {
        const isDark = document.documentElement.classList.contains('dark');
        const headerBtn = document.createElement('button');
        headerBtn.id = 'header-btn-tema';
        headerBtn.onclick = toggleTemaSistema;
        headerBtn.className = 'w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer shadow-sm';
        headerBtn.title = isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro';
        headerBtn.innerHTML = `<i class="${isDark ? 'fa-solid fa-moon text-indigo-400' : 'fa-solid fa-sun text-amber-500'} sistema-theme-btn-icon"></i>`;
        headerActions.prepend(headerBtn);
    }

    // 3. Botão SINCRONIZAR no Header (Repositório Local com Firebase)
    if (headerActions && !document.getElementById('header-btn-sync')) {
        const syncBtn = document.createElement('button');
        syncBtn.id = 'header-btn-sync';
        syncBtn.type = 'button';
        syncBtn.onclick = function() {
            if (window.FCCache && typeof window.FCCache.sincronizarComFirebase === 'function') {
                window.FCCache.sincronizarComFirebase();
            } else if (typeof window.showToast === 'function') {
                window.showToast('Repositório local já atualizado.', 'info');
            }
        };
        syncBtn.className = 'h-9 w-9 sm:w-auto px-0 sm:px-3 flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] sm:text-xs font-bold tracking-wider transition-all cursor-pointer shadow-sm select-none border border-slate-600 shrink-0 relative';
        syncBtn.title = 'Sincronizar banco de dados local com o Firebase';
        syncBtn.innerHTML = `
            <span id="header-btn-sync-text" class="hidden sm:inline">SINCRONIZAR</span>
            <span id="header-btn-sync-box" class="w-full h-full sm:w-6 sm:h-6 flex items-center justify-center rounded bg-transparent sm:bg-white/10 text-white text-xs">
                <i id="header-btn-sync-icon" class="fa-solid fa-arrows-rotate"></i>
            </span>
            <span id="header-btn-sync-badge" class="hidden px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-slate-900 rounded-full">0</span>
        `;
        headerActions.prepend(syncBtn);
    }

    _atualizarBotaoTemaSistema();
});



// As credenciais e inicialização do Firebase agora vêm de sistema/config_banco.js

const firestore = firebase.firestore();

// --- INICIO MULTI-TENANT ---
window.getEmpresaRef = function() {
    const empId = localStorage.getItem('fc_empresa_ativa');
    if (!empId) {
        console.error("Nenhuma empresa ativa encontrada no login!");
        // Fallback temporario para nao quebrar em sessoes antigas
        return firestore.collection('empresas').doc('emp_fc_moveis');
    }
    return firestore.collection('empresas').doc(empId);
};
// --- FIM MULTI-TENANT ---

// Interceptar chamadas HTTPS para enviar empId automaticamente para as funções do Backend
if (typeof firebase !== 'undefined' && firebase.functions) {
    const _origFunctions = firebase.functions;
    firebase.functions = function(...args) {
        const fnInstance = _origFunctions.apply(this, args);
        if (fnInstance && !fnInstance._interceptorEmpIdAtivo) {
            const _origCallable = fnInstance.httpsCallable.bind(fnInstance);
            fnInstance.httpsCallable = function(name, options) {
                const callable = _origCallable(name, options);
                return async function(data) {
                    const payload = (typeof data === 'object' && data !== null) ? { ...data } : {};
                    if (!payload.empId) {
                        payload.empId = window.currentEmpresaId || localStorage.getItem('fc_empresa_ativa') || '';
                    }
                    return callable(payload);
                };
            };
            fnInstance._interceptorEmpIdAtivo = true;
        }
        return fnInstance;
    };
}

// ATIVAR MODO OFFLINE (Apenas em ambiente HTTP/HTTPS com servidor)
if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    firestore.enablePersistence({ synchronizeTabs: true })
        .catch(function(err) {
            if (err.code == 'failed-precondition') {
                console.warn("Múltiplas abas abertas. A persistência offline funcionará apenas na primeira aba.");
            } else if (err.code == 'unimplemented') {
                console.warn("Navegador não suporta persistência offline do Firebase.");
            }
        });
}

const auth = firebase.auth();

// Stub Global do DB (para não quebrar as outras telas enquanto são migradas)
var db = {
    produtos: [], categorias: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [],
    financeiro: [], compras: [], funcionarios: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] },
    config: { 
        empresa: { nome: '', fantasia: '', cnpj: '', telefone: '', logo: '' },
        taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } },
        prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 }
    }
};
window.db = db;

// ==========================================
// PRÃ‰-CARGA DO CACHE: popula o db com dados do
// sessionStorage antes do Firebase responder.
// Isso faz as telas carregarem instantaneamente.
// ==========================================
(function _preCarregarCacheGlobal() {
    // Aguarda o FCCache estar disponível (carregado via <script>)
    // Se ainda não estiver, agenda para quando o DOM estiver pronto
    function tentarPreCarregar() {
        if (typeof window.FCCache === 'undefined') return;
        const colecoesPrincipais = ['produtos', 'clientes', 'fornecedores', 'funcionarios', 'vendas', 'financeiro', 'compras', 'categorias', 'movimentacoes'];
        colecoesPrincipais.forEach(function(col) {
            if (window.FCCache.isValido(col)) {
                const dados = window.FCCache.get(col);
                if (dados !== null) {
                    db[col] = dados;
                    if (col === 'produtos' && Array.isArray(dados) && dados.length > 0) {
                        window._produtosCarregados = true;
                    }
                }
            }
        });
        // Carrega config do cache
        if (window.FCCache.isValido('config')) {
            const configCache = window.FCCache.get('config');
            if (configCache) db.config = configCache;
        } else if (window.FCCache.isValido('fc_moveis_config')) {
            const configCache = window.FCCache.get('fc_moveis_config');
            if (configCache) db.config = configCache;
        }
        // Carrega caixa do cache
        if (window.FCCache.isValido('caixa')) {
            const caixaCache = window.FCCache.get('caixa');
            if (caixaCache) db.caixa = caixaCache;
        } else if (window.FCCache.isValido('fc_moveis_caixa')) {
            const caixaCache = window.FCCache.get('fc_moveis_caixa');
            if (caixaCache) db.caixa = caixaCache;
        }
    }
    // Tenta pré-carregar imediatamente e também ao carregar o DOM
    tentarPreCarregar();
    document.addEventListener('DOMContentLoaded', tentarPreCarregar);
})();
window.currentUserInfo = null;

// ==========================================
// Monitoramento de Conexão (Online/Offline)
// ==========================================
function atualizarBadgeConexao(isOnline) {
    const titleEl = document.getElementById('menu-empresa-nome');
    if (titleEl && titleEl.nextElementSibling) {
        const badge = titleEl.nextElementSibling;
        if (isOnline) {
            badge.innerText = 'Sistema Ativo';
            badge.classList.remove('text-red-400');
            badge.classList.add('text-emerald-400');
        } else {
            badge.innerText = 'Modo Offline';
            badge.classList.remove('text-emerald-400');
            badge.classList.add('text-red-400');
        }
    }
}

window.addEventListener('offline', () => {
    showToast('Você está offline! Modo de trabalho local ativado.', 'warning');
    document.body.classList.add('is-offline');
    atualizarBadgeConexao(false);
});

window.addEventListener('online', () => {
    showToast('Conexão restabelecida! Sincronizando dados...', 'success');
    document.body.classList.remove('is-offline');
    atualizarBadgeConexao(true);
});

// Força checagem na inicialização
if (!navigator.onLine) {
    setTimeout(() => { atualizarBadgeConexao(false); }, 1000);
}

const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ==========================================
// FUN??ES DE MÁSCARA DE DINHEIRO
// ==========================================
function applyMoneyMask(el) {
    let raw = String(el.value || '');
    let isNegative = raw.trim().startsWith('-');
    let digits = raw.replace(/\D/g, "");
    if (!digits) digits = "0";
    digits = parseInt(digits, 10).toString();
    digits = digits.padStart(3, '0');
    
    let decimals = digits.slice(-2);
    let integers = digits.slice(0, -2);
    
    integers = integers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    el.value = (isNegative ? "-" : "") + integers + "," + decimals;
}

function parseInputMoney(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    let str = String(val).trim();
    
    if (str.includes(',')) {
        str = str.replace(/\./g, "").replace(",", ".");
    }
    
    let parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

// ==========================================
// MOTOR DE CAIXA INDIVIDUAL POR CONTA DE FUNCIONÁRIO
// ==========================================
window.obterOperadorAtual = function() {
    const user = window.currentUser || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null);
    const uid = user ? user.uid : localStorage.getItem('fc_sessao_uid');
    const nome = window.currentUserInfo?.nome || (user?.email ? user.email.split('@')[0] : 'Operador');
    const email = user ? user.email : '';
    const isAdmin = !!window.currentUserInfo?.isAdmin;
    return { uid, nome, email, isAdmin };
};

window.obterCaixaDocId = function(operadorUid) {
    const op = window.obterOperadorAtual();
    const uid = operadorUid || op.uid;
    return uid ? 'caixa_' + uid : 'caixa_atual';
};

window.obterCaixaDocRef = function(operadorUid) {
    const docId = window.obterCaixaDocId(operadorUid);
    return window.getEmpresaRef().collection('caixa').doc(docId);
};

function formatMoneyInput(val) {
    let num = Number(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

document.addEventListener('input', function(e) {
    if (e.target && e.target.dataset && e.target.dataset.mask === 'money') {
        applyMoneyMask(e.target);
    }
}, true); // Fase de Captura: roda ANTES de qualquer oninput inline nos inputs!

document.addEventListener('change', function(e) {
    if (e.target && e.target.dataset && e.target.dataset.mask === 'money') {
        applyMoneyMask(e.target);
    }
}, true);

document.addEventListener('focusin', function(e) {
    if (e.target && e.target.dataset && e.target.dataset.mask === 'money') {
        applyMoneyMask(e.target);
        if (e.target.value === '0,00' || e.target.value === '' || e.target.value === '0') {
            e.target.select();
        }
    }
}, true);

// Interceptar atribuições de '.value' em inputs de dinheiro para auto-formatar floats
let isMasking = false;
const originalValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
Object.defineProperty(HTMLInputElement.prototype, 'value', {
    set: function(newVal) {
        if (this.type === 'color' && (!newVal || newVal === "")) {
            newVal = "#000000";
        }
        if (this.dataset && this.dataset.mask === 'money' && !isMasking) {
            if (newVal !== '' && newVal !== null && newVal !== undefined) {
                if (typeof newVal === 'number' || !String(newVal).includes(',')) {
                    let parsed = parseFloat(newVal);
                    if (!isNaN(parsed)) newVal = parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
            isMasking = true;
            originalValueSetter.call(this, newVal);
            applyMoneyMask(this);
            isMasking = false;
        } else {
            originalValueSetter.call(this, newVal);
        }
    }
});

// Observer para formatar inputs injetados via innerHTML (ex: tabelas)
const moneyMaskObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { 
                    if (node.dataset && node.dataset.mask === 'money') {
                        if (node.value && !node.value.includes(',')) {
                            let p = parseFloat(node.value);
                            if (!isNaN(p)) node.value = p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                        applyMoneyMask(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('[data-mask="money"]').forEach(el => {
                            if (el.value && !el.value.includes(',')) {
                                let p = parseFloat(el.value);
                                if (!isNaN(p)) el.value = p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                            applyMoneyMask(el);
                        });
                    }
                }
            });
        }
    });
});
moneyMaskObserver.observe(document.body, { childList: true, subtree: true });
const formatData = (isoStr) => {
    if (!isoStr) return '-';
    if (typeof isoStr === 'object' && isoStr.seconds !== undefined) {
        return new Date(isoStr.seconds * 1000).toLocaleString('pt-BR');
    }
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
};
window.formatData = formatData;

function formatarDataParaInputDate(val) {
    if (!val) return '';
    try {
        if (typeof val === 'object' && typeof val.toDate === 'function') {
            return val.toDate().toISOString().split('T')[0];
        }
        if (typeof val === 'object' && val.seconds !== undefined) {
            return new Date(val.seconds * 1000).toISOString().split('T')[0];
        }
        if (val instanceof Date) {
            return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0];
        }
        if (typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        }
        const str = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.split('T')[0].substring(0, 10);
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
            const parts = str.split('/');
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
}
window.formatarDataParaInputDate = formatarDataParaInputDate;

function parseDataGenerica(val) {
    if (!val) return null;
    try {
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        if (typeof val === 'object' && typeof val.toDate === 'function') {
            const d = val.toDate();
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === 'object' && val.seconds !== undefined) {
            const d = new Date(val.seconds * 1000);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === 'string') {
            val = val.trim();
            if (!val) return null;
            // Formato brasileiro DD/MM/YYYY [HH:mm[:ss]]
            const brMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
            if (brMatch) {
                const dia = parseInt(brMatch[1], 10);
                const mes = parseInt(brMatch[2], 10) - 1;
                const ano = parseInt(brMatch[3], 10);
                const hora = brMatch[4] ? parseInt(brMatch[4], 10) : 12;
                const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
                const seg = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
                const d = new Date(ano, mes, dia, hora, min, seg);
                return isNaN(d.getTime()) ? null : d;
            }
            // Formato ISO YYYY-MM-DD puro ou com meia-noite UTC (evita cair no dia anterior no UTC-3)
            const isoDateOnly = val.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/);
            if (isoDateOnly) {
                const ano = parseInt(isoDateOnly[1], 10);
                const mes = parseInt(isoDateOnly[2], 10) - 1;
                const dia = parseInt(isoDateOnly[3], 10);
                const d = new Date(ano, mes, dia, 12, 0, 0);
                return isNaN(d.getTime()) ? null : d;
            }
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
    } catch(e) {
        return null;
    }
    return null;
}
window.parseDataGenerica = parseDataGenerica;

function normalizarTexto(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
window.normalizarTexto = normalizarTexto;

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast show ${type}`;
    t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')}"></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ==========================================
// INICIALIZA??O E CONTROLE DE SESS?O
// ==========================================
function initGlobalData(funcaoDeRenderizacaoDaPagina) {
    // Garante persistência permanente da sessão no Firebase Auth
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
        }
    } catch (e) {}

    auth.onAuthStateChanged(async (user) => {
        window.currentUser = user;
        const isLoginPage = window.location.pathname.toLowerCase().includes('login.html') || window.location.href.toLowerCase().includes('login.html');

        if (!user) {
            if (!isLoginPage) window.location.href = 'login.html';
            return;
        }

        // Se já está logado e abriu a tela de login, vai direto para o sistema
        if (isLoginPage) {
            if (!window._fazendoLogin) {
                window.location.href = 'index.html';
            }
            return;
        }

        // Controle de Sessão: encerra EXCLUSIVAMENTE se passar da meia-noite
        const hoje = new Date().toDateString();
        const sessaoData = localStorage.getItem('fc_sessao_data');

        if (sessaoData && sessaoData !== hoje) {
            console.log("Virada da meia-noite detectada. Encerrando sessão do dia anterior...");
            localStorage.removeItem('fc_sessao_data');
            localStorage.removeItem('fc_sessao_uid');
            sessionStorage.setItem('fc_sessao_expirada_msg', 'Meia-noite atingida: sua sessão diária encerrou. Faça login para o novo dia.');
            try { await auth.signOut(); } catch (e) {}
            window.location.href = 'login.html';
            return;
        }

        // Sessão do mesmo dia válida: mantém ativa sem deslogar por inatividade
        const ultimoUid = localStorage.getItem('fc_sessao_uid');
        if (ultimoUid && ultimoUid !== user.uid) {
            console.log("Troca de usuário detectada! Limpando cache do navegador...");
            sessionStorage.clear();
            localStorage.removeItem('fc_empresa_ativa');
        }

        localStorage.setItem('fc_sessao_data', hoje);
        localStorage.setItem('fc_sessao_uid', user.uid);

        // Busca ou valida a empresa deste usuário no Firestore
        let empId = localStorage.getItem('fc_empresa_ativa');
        if (!empId) {
            try {
                const uDoc = await firestore.collection('usuarios').doc(user.uid).get();
                if (uDoc.exists && uDoc.data().empresaId) {
                    empId = uDoc.data().empresaId;
                    localStorage.setItem('fc_empresa_ativa', empId);
                } else if (user.email === 'fabricadecoresgoiania@gmail.com') {
                    empId = 'emp_fc_moveis';
                    localStorage.setItem('fc_empresa_ativa', empId);
                }
            } catch(e) {
                console.error("Erro ao resolver empresa do usuário:", e);
                if (user.email === 'fabricadecoresgoiania@gmail.com') {
                    empId = 'emp_fc_moveis';
                    localStorage.setItem('fc_empresa_ativa', empId);
                }
            }
        }

        // 3. Verificação de Bloqueio por Inadimplência e Carregamento de Plano SaaS (Integrado ao SaaS Master)
        if (empId) {
            try {
                let empData = null;
                // Consulta prioritária ao servidor central do SaaS Master
                if (typeof window.consultarLicencaCentral === 'function') {
                    empData = await window.consultarLicencaCentral(empId, 'fc_gestao');
                }
                
                // Fallback para o banco local da empresa
                if (!empData) {
                    const empDoc = await firestore.collection('empresas').doc(empId).get();
                    if (empDoc.exists) empData = empDoc.data();
                }

                if (empData) {
                    window.currentEmpresaData = empData;

                    if (empData.status === 'BLOQUEADO') {
                        if (typeof window.aplicarBloqueioTotal === 'function') {
                            window.aplicarBloqueioTotal('O acesso da sua empresa foi suspenso por pendencia financeira.');
                            return;
                        }
                        sessionStorage.clear();
                        localStorage.removeItem('fc_empresa_ativa');
                        alert('O acesso da sua empresa esta suspenso temporariamente por pendencia financeira. Entre em contato com o suporte.');
                        await auth.signOut();
                        window.location.href = 'login.html';
                        return;
                    }

                    // Aplica controle real dos modulos contratados pelo plano da loja
                    aplicarControleDeModulosSaaS(empData, user);
                    // Inicia listener em tempo real para detectar mudancas de modulos pelo master
                    if (typeof window.iniciarListenerBloqueioTempoReal === 'function') {
                        window.iniciarListenerBloqueioTempoReal(empId, user.email);
                    }
                }
            } catch (errBloq) {
                console.warn("Aviso ao checar empresa:", errBloq);
            }
        }

        // Inicia monitor para detectar quando der meia-noite
        iniciarMonitorSessaoDiaria();

            // Pré-carrega Config e Permissões do cache para inicialização instantânea
            const configCache = (typeof window.FCCache !== 'undefined') && (window.FCCache.get('config') || window.FCCache.get('fc_moveis_config'));
            if (configCache) db.config = configCache;

            const userCacheKey = 'funcionario_' + user.uid;
            const userCache = (typeof window.FCCache !== 'undefined') && window.FCCache.get(userCacheKey);
            if (userCache) window.currentUserInfo = userCache;

            let renderizouImediato = false;
            if (window.currentUserInfo) {
                if (aplicarControleDeAcesso()) return;
                mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);
                aplicarIdentidadeVisualGlobal();
                if (window.__paginaBloqueadaPorPlano || window.__paginaBloqueadaPorPermissao) return;
                if (funcaoDeRenderizacaoDaPagina) {
                    try {
                        funcaoDeRenderizacaoDaPagina();
                        renderizouImediato = true;
                    } catch(e) {
                        console.error("Erro ao renderizar com cache:", e);
                    }
                }
            }

            // Sincronização paralela com Firebase (em background se já renderizou do cache)
            const sincronizarFirebase = async () => {
                try {
                    const [confSnap, userSnap] = await Promise.all([
                        window.getEmpresaRef().collection('configuracoes').doc('config').get().catch(e => { console.error("Erro ao carregar config:", e); return null; }),
                        window.getEmpresaRef().collection("funcionarios").doc(user.uid).get().catch(e => { console.error("Erro de permissões:", e); return null; })
                    ]);

                    if (confSnap && confSnap.exists) {
                        const dados = confSnap.data() || {};
                        const baseConfig = {
                            empresa: {
                                nome: window.currentEmpresaData?.nomeEmpresa || '',
                                fantasia: window.currentEmpresaData?.nomeEmpresa || '',
                                cnpj: '', telefone: '', logo: ''
                            },
                            taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } },
                            prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 },
                            loja: {}
                        };
                        db.config = {
                            ...baseConfig,
                            ...dados,
                            empresa: { ...baseConfig.empresa, ...(dados.empresa || {}) },
                            taxas: dados.taxas || baseConfig.taxas,
                            prazos: dados.prazos || baseConfig.prazos,
                            loja: { ...baseConfig.loja, ...(dados.loja || {}) }
                        };
                        if (typeof window.FCCache !== 'undefined') {
                            window.FCCache.set('config', db.config);
                            window.FCCache.set('fc_moveis_config', db.config);
                        }
                        if (typeof window.ajustarOpcoesOperacaoPDV === 'function') {
                            try { window.ajustarOpcoesOperacaoPDV(); } catch (e) {}
                        }
                    } else if (confSnap && !confSnap.exists) {
                        const novaConfig = {
                            empresa: {
                                nome: window.currentEmpresaData?.nomeEmpresa || '',
                                fantasia: window.currentEmpresaData?.nomeEmpresa || '',
                                cnpj: '', telefone: '', logo: ''
                            },
                            taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } },
                            prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 },
                            pdv: { permite_estoque_negativo: false }
                        };
                        db.config = novaConfig;
                        await window.getEmpresaRef().collection('configuracoes').doc('config').set(novaConfig).catch(() => {});
                        if (typeof window.FCCache !== 'undefined') {
                            window.FCCache.set('config', db.config);
                            window.FCCache.set('fc_moveis_config', db.config);
                        }
                    }

                    if (userSnap && userSnap.exists) {
                        window.currentUserInfo = userSnap.data();
                        
                        // CORRE??O: Garante admin para o email correto
                        if (user.email === 'fabricadecoresgoiania@gmail.com' && !window.currentUserInfo.isAdmin) {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
                            window.currentUserInfo.perm_produtos = true;
                            window.currentUserInfo.perm_clientes = true;
                            window.currentUserInfo.perm_gestao = true;
                            window.currentUserInfo.perm_config = true;
                            
                            window.getEmpresaRef().collection("funcionarios").doc(user.uid).update({
                                isAdmin: true,
                                perm_dashboard: true,
                                perm_pdv: true,
                                perm_cadastros: true,
                                perm_produtos: true,
                                perm_clientes: true,
                                perm_gestao: true,
                                perm_config: true
                            }).catch(e => console.error("Erro ao atualizar admin", e));
                        }
                        
                        if (typeof window.FCCache !== 'undefined') window.FCCache.set(userCacheKey, window.currentUserInfo);
                        if (aplicarControleDeAcesso()) return;
                        mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);
                    } else if (userSnap && !userSnap.exists) {
                        // Usuário não cadastrado na base de funcionários
                        window.currentUserInfo = { isAdmin: false, perm_dashboard: false, perm_pdv: false, perm_cadastros: false, perm_produtos: false, perm_clientes: false, perm_gestao: false, perm_config: false };
                        
                        // CORRE??O: Garante admin na criação do cadastro
                        if (user.email === 'fabricadecoresgoiania@gmail.com') {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
                            window.currentUserInfo.perm_produtos = true;
                            window.currentUserInfo.perm_clientes = true;
                            window.currentUserInfo.perm_gestao = true;
                            window.currentUserInfo.perm_config = true;
                        }

                        try {
                            await window.getEmpresaRef().collection('funcionarios').doc(user.uid).set({
                                nome: window.currentUserInfo.isAdmin ? "Administrador" : "NOVO CADASTRO", 
                                email: user.email || '', 
                                isAdmin: window.currentUserInfo.isAdmin,
                                perm_dashboard: window.currentUserInfo.perm_dashboard, 
                                perm_pdv: window.currentUserInfo.perm_pdv, 
                                perm_cadastros: window.currentUserInfo.perm_cadastros,
                                perm_produtos: window.currentUserInfo.perm_produtos,
                                perm_clientes: window.currentUserInfo.perm_clientes,
                                perm_gestao: window.currentUserInfo.perm_gestao, 
                                perm_config: window.currentUserInfo.perm_config, 
                                dataCadastro: new Date().toISOString(), 
                                status: window.currentUserInfo.isAdmin ? 'ATIVO' : 'PENDENTE'
                            });
                        } catch(e) { console.error("Erro ao registrar no banco:", e); }
                        
                        if (!window.currentUserInfo.isAdmin) {
                            const avisoAprovacao = document.createElement('div');
                            avisoAprovacao.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:#eab308; color:black; padding:15px 30px; font-size:16px; font-weight:bold; border-radius:10px; text-align:center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);";
                            avisoAprovacao.innerHTML = "<i class='fa-solid fa-clock'></i> Conta Registrada!<br><span style='font-size:13px; font-weight:normal;'>Aguarde o Administrador liberar suas permiss&otilde;es de acesso.</span>";
                            document.body.appendChild(avisoAprovacao);
                        }
                        aplicarControleDeAcesso();
                    }

                    aplicarIdentidadeVisualGlobal();

                    // Listener em tempo real para permissões do usuário
                    if (!window._listenerFuncionarioAtivo && user && user.uid) {
                        window._listenerFuncionarioAtivo = true;
                        try {
                            window.getEmpresaRef().collection("funcionarios").doc(user.uid).onSnapshot(docSnap => {
                                if (docSnap && docSnap.exists) {
                                    const dadosNovos = docSnap.data();
                                    window.currentUserInfo = dadosNovos;
                                    if (typeof window.FCCache !== 'undefined') window.FCCache.set(userCacheKey, dadosNovos);
                                    if (aplicarControleDeAcesso()) return;
                                    mostrarNomeUsuarioNoHeader(dadosNovos.isAdmin ? 'Admin Master' : `Func.: ${dadosNovos.nome || 'Usuário'}`);
                                }
                            }, errSnap => console.warn("Listener de permissões:", errSnap));
                        } catch(eSnap) {}
                    }

                    // Se não pôde renderizar de imediato por falta de cache, renderiza agora (apenas se página permitida)
                    if (!renderizouImediato && !window.__paginaBloqueadaPorPermissao && !window.__paginaBloqueadaPorPlano && funcaoDeRenderizacaoDaPagina) {
                        funcaoDeRenderizacaoDaPagina();
                    } else if (renderizouImediato && typeof window.carregarConfiguracoesNaTela === 'function') {
                        // Se a tela atual for a de configurações, atualiza os campos com os dados frescos do Firestore
                        window.carregarConfiguracoesNaTela();
                    }
                } catch (err) {
                    console.error("Erro na sincronização Firebase:", err);
                    if (!renderizouImediato && funcaoDeRenderizacaoDaPagina) {
                        aplicarIdentidadeVisualGlobal();
                        funcaoDeRenderizacaoDaPagina();
                    }
                }
            };

            if (renderizouImediato) {
                sincronizarFirebase();
            } else {
                await sincronizarFirebase();
            }
    });
}

// Monitor de sessão: encerra a sessão SOMENTE caso dê meia-noite
function iniciarMonitorSessaoDiaria() {
    if (window._monitorSessaoIniciado) return;
    window._monitorSessaoIniciado = true;

    const checarMeiaNoite = async () => {
        const isLoginPage = window.location.pathname.toLowerCase().includes('login.html') || window.location.href.toLowerCase().includes('login.html');
        if (isLoginPage) return;

        const user = auth.currentUser;
        if (!user) return;

        const hoje = new Date().toDateString();
        const sessaoData = localStorage.getItem('fc_sessao_data');

        // Se o dia virou (passou de meia-noite):
        if (sessaoData && sessaoData !== hoje) {
            console.warn("Meia-noite atingida. Encerrando sessão diária...");
            localStorage.removeItem('fc_sessao_data');
            localStorage.removeItem('fc_sessao_uid');
            sessionStorage.setItem('fc_sessao_expirada_msg', 'Meia-noite atingida: sua sessão diária encerrou. Por favor, faça login para o novo dia.');
            try { await auth.signOut(); } catch (e) {}
            window.location.href = 'login.html';
        }
    };

    // Checa a cada 30 segundos e ao voltar o foco para a aba se já virou meia-noite
    setInterval(checarMeiaNoite, 30000);
    window.addEventListener('focus', checarMeiaNoite);
}

// Funções auxiliares para checagem granular de permissões
window.checarPermissaoUsuario = function(user, key, fallbackKey) {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (user[key] !== undefined && user[key] !== null) {
        return user[key] === true || user[key] === 'true';
    }
    if (fallbackKey && user[fallbackKey] !== undefined && user[fallbackKey] !== null) {
        return user[fallbackKey] === true || user[fallbackKey] === 'true';
    }
    return false;
};

window.podeCadastrarProdutos = function(user = window.currentUserInfo) {
    return window.checarPermissaoUsuario(user, 'perm_produtos', 'perm_cadastros');
};

window.podeCadastrarClientes = function(user = window.currentUserInfo) {
    return window.checarPermissaoUsuario(user, 'perm_clientes', 'perm_cadastros');
};

window.podeCadastrarFornecedores = function(user = window.currentUserInfo) {
    return window.checarPermissaoUsuario(user, 'perm_fornecedores', 'perm_cadastros');
};

window.podeCadastrarFuncionarios = function(user = window.currentUserInfo) {
    if (!user) return false;
    if (user.isAdmin) return true;
    return window.checarPermissaoUsuario(user, 'perm_funcionarios');
};

window.podeAcessarCadastrosGerais = function(user = window.currentUserInfo) {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (user.perm_cadastros === true || user.perm_cadastros === 'true') return true;
    return window.podeCadastrarProdutos(user) || window.podeCadastrarClientes(user) || window.podeCadastrarFornecedores(user) || window.podeCadastrarFuncionarios(user);
};

window.verificarPermissaoRota = function(rota, user = window.currentUserInfo) {
    if (!user) return { permitido: false, motivo: 'Usuário não autenticado.' };
    if (user.isAdmin) return { permitido: true };

    const path = (rota || window.location.pathname).toLowerCase();
    const check = (k, fb) => window.checarPermissaoUsuario(user, k, fb);

    // 1. Dashboard / Visão Geral
    if (path.includes('index.html') || path.endsWith('/sistema/') || path.endsWith('/sistema') || path === '' || path === '/') {
        if (!check('perm_dashboard')) {
            return { permitido: false, motivo: 'Acesso Negado ao Dashboard (Visão Geral).' };
        }
        return { permitido: true };
    }

    // 2. Operação
    if (path.includes('pdv.html')) {
        if (!check('perm_pdv')) {
            return { permitido: false, motivo: 'Acesso Negado à Frente de Caixa (PDV).' };
        }
        return { permitido: true };
    }

    if (path.includes('vendas_operacao.html')) {
        if (!check('perm_vendas_op', 'perm_pdv')) {
            return { permitido: false, motivo: 'Acesso Negado ao Histórico de Vendas/Serviços.' };
        }
        return { permitido: true };
    }

    if (path.includes('orcamentos.html')) {
        if (!check('perm_orcamentos', 'perm_pdv')) {
            return { permitido: false, motivo: 'Acesso Negado a Meus Orçamentos.' };
        }
        return { permitido: true };
    }

    if (path.includes('fiscal.html')) {
        if (!check('perm_fiscal', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado ao Emissor Fiscal (NF-e).' };
        }
        return { permitido: true };
    }

    // 3. Cadastros
    if (path.includes('produtos.html')) {
        if (!window.podeCadastrarProdutos(user)) {
            return { permitido: false, motivo: 'Acesso Negado à Área de Cadastro de Produtos.' };
        }
        return { permitido: true };
    }

    if (path.includes('clientes.html')) {
        if (!window.podeCadastrarClientes(user)) {
            return { permitido: false, motivo: 'Acesso Negado à Área de Cadastro de Clientes.' };
        }
        return { permitido: true };
    }

    if (path.includes('fornecedores.html')) {
        if (!window.podeCadastrarFornecedores(user)) {
            return { permitido: false, motivo: 'Acesso Negado ao Cadastro de Fornecedores.' };
        }
        return { permitido: true };
    }

    if (path.includes('funcionarios.html') || path.includes('view=funcionarios')) {
        if (!window.podeCadastrarFuncionarios(user)) {
            return { permitido: false, motivo: 'Acesso Negado ao Cadastro de Funcionários.' };
        }
        return { permitido: true };
    }

    if (path.includes('cadastro.html')) {
        if (!window.podeAcessarCadastrosGerais(user)) {
            return { permitido: false, motivo: 'Acesso Negado aos Cadastros.' };
        }
        return { permitido: true };
    }

    // 4. Caixa da Loja
    if (path.includes('caixa_loja.html')) {
        const permitidoCaixaLoja = user.perm_caixa_loja !== undefined
            ? (user.perm_caixa_loja === true || user.perm_caixa_loja === 'true')
            : (check('perm_caixa') || check('perm_gestao'));
        if (!permitidoCaixaLoja) {
            return { permitido: false, motivo: 'Acesso Negado ao Caixa da Loja.' };
        }
        return { permitido: true };
    }

    // 5. Caixa Físico
    if (path.includes('caixa.html')) {
        const permitidoCaixa = user.perm_caixa !== undefined
            ? (user.perm_caixa === true || user.perm_caixa === 'true')
            : (check('perm_pdv') || check('perm_gestao'));
        if (!permitidoCaixa) {
            return { permitido: false, motivo: 'Acesso Negado ao Caixa Físico.' };
        }
        return { permitido: true };
    }

    // 6. Gestão Financeira
    if (path.includes('financeiro.html') || path.includes('vendas_gestao.html')) {
        if (!check('perm_financeiro', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado ao Financeiro e Gestão de Vendas.' };
        }
        return { permitido: true };
    }

    // 7. Compras
    if (path.includes('compras.html')) {
        if (!check('perm_compras', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado a Compras e XML.' };
        }
        return { permitido: true };
    }

    // 8. Relatórios
    if (path.includes('relatorios.html')) {
        if (!check('perm_relatorios', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado aos Relatórios & DRE.' };
        }
        return { permitido: true };
    }

    // 9. Agenda
    if (path.includes('agenda.html')) {
        if (!check('perm_agenda', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado à Agenda.' };
        }
        return { permitido: true };
    }

    // 10. Marketing
    if (path.includes('marketing.html')) {
        if (!check('perm_marketing', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado ao Marketing.' };
        }
        return { permitido: true };
    }

    // 11. Configurações do Sistema
    if (path.includes('sistema.html')) {
        if (!check('perm_config')) {
            return { permitido: false, motivo: 'Acesso Negado às Configurações do Sistema.' };
        }
        return { permitido: true };
    }

    return { permitido: true };
};

window.obterRotaInicialUsuario = function(user = window.currentUserInfo) {
    if (!user) return 'login.html';
    if (user.isAdmin) return 'index.html';

    const check = (k, fb) => window.checarPermissaoUsuario(user, k, fb);

    if (check('perm_dashboard')) return 'index.html';
    if (check('perm_pdv')) return 'pdv.html';
    if (check('perm_vendas_op', 'perm_pdv')) return 'vendas_operacao.html';
    if (check('perm_orcamentos', 'perm_pdv')) return 'orcamentos.html';
    if (check('perm_fiscal', 'perm_gestao')) return 'fiscal.html';
    if (window.podeCadastrarProdutos(user)) return 'produtos.html';
    if (window.podeCadastrarClientes(user)) return 'clientes.html';
    if (window.podeCadastrarFornecedores(user)) return 'fornecedores.html';
    if (window.podeCadastrarFuncionarios(user)) return 'funcionarios.html';
    if (user.perm_caixa_loja !== undefined ? (user.perm_caixa_loja === true || user.perm_caixa_loja === 'true') : (check('perm_caixa') || check('perm_gestao'))) return 'caixa_loja.html';
    if (check('perm_financeiro', 'perm_gestao')) return 'financeiro.html';
    if (user.perm_caixa !== undefined ? (user.perm_caixa === true || user.perm_caixa === 'true') : (check('perm_pdv') || check('perm_gestao'))) return 'caixa.html';
    if (check('perm_compras', 'perm_gestao')) return 'compras.html';
    if (check('perm_relatorios', 'perm_gestao')) return 'relatorios.html';
    if (check('perm_agenda', 'perm_gestao')) return 'agenda.html';
    if (check('perm_marketing', 'perm_gestao')) return 'marketing.html';
    if (check('perm_config')) return 'sistema.html';

    return 'login.html';
};

function esconderSecoesVaziasSidebar() {
    const nav = document.querySelector('aside nav');
    if (!nav) return;
    const titulos = nav.querySelectorAll('p');
    titulos.forEach(p => {
        let el = p.nextElementSibling;
        let temLinkVisivel = false;
        while (el && el.tagName !== 'P') {
            if (el.tagName === 'A' && !el.classList.contains('hidden') && el.style.display !== 'none') {
                temLinkVisivel = true;
                break;
            }
            el = el.nextElementSibling;
        }
        if (!temLinkVisivel) {
            p.classList.add('hidden');
        } else {
            p.classList.remove('hidden');
        }
    });
}

function aplicarControleDeAcesso() {
    if (!window.currentUserInfo) return false;
    const p = window.currentUserInfo;
    const path = window.location.pathname;

    // Se for admin, não bloqueia nada e garante todos os links visíveis
    if (p.isAdmin) {
        document.querySelectorAll('aside a, aside p').forEach(el => el.classList.remove('hidden'));
        return false;
    }

    // 1. Validação da Rota Atual da Página
    const rotaCheck = window.verificarPermissaoRota(path, p);
    if (!rotaCheck.permitido) {
        window.__paginaBloqueadaPorPermissao = true;
        const main = document.querySelector('main');
        if (main) {
            main.style.visibility = 'hidden';
            main.innerHTML = '';
        }
        showToast(rotaCheck.motivo, 'error');

        const rotaDestino = window.obterRotaInicialUsuario(p);
        const pathAtual = window.location.pathname.toLowerCase();
        if (!pathAtual.includes(rotaDestino)) {
            window.location.replace(rotaDestino);
        }
        return true; // Retorna true informando que a página foi bloqueada
    }

    // 2. Controle Dinâmico Completo do Menu Lateral (Sidebar)
    const check = (k, fb) => window.checarPermissaoUsuario(p, k, fb);

    // 2.1 Visão Geral
    document.querySelectorAll('a[href*="index.html"], [data-target="dashboard"]').forEach(el => {
        if (!check('perm_dashboard')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.2 Operação
    document.querySelectorAll('a[href*="pdv.html"], [data-target="pdv"]').forEach(el => {
        if (!check('perm_pdv')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="vendas_operacao.html"], [data-target="vendas_operacao"]').forEach(el => {
        if (!check('perm_vendas_op', 'perm_pdv')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="orcamentos.html"], [data-target="orcamentos"]').forEach(el => {
        if (!check('perm_orcamentos', 'perm_pdv')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="fiscal.html"], [data-target="fiscal"]').forEach(el => {
        if (!check('perm_fiscal', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.3 Cadastros
    document.querySelectorAll('a[href*="produtos.html"], [data-target="produtos"]').forEach(el => {
        if (!window.podeCadastrarProdutos(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="clientes.html"], [data-target="clientes"]').forEach(el => {
        if (!window.podeCadastrarClientes(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="fornecedores.html"], [data-target="fornecedores"]').forEach(el => {
        if (!window.podeCadastrarFornecedores(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="funcionarios.html"], a[href*="view=funcionarios"], [data-target="funcionarios"]').forEach(el => {
        if (!window.podeCadastrarFuncionarios(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.4 Gestão
    document.querySelectorAll('a[href*="financeiro.html"], [data-target="financeiro"], a[href*="vendas_gestao.html"], [data-target="vendas_gestao"]').forEach(el => {
        if (!check('perm_financeiro', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="caixa_loja.html"], [data-target="caixa_loja"]').forEach(el => {
        const permCaixaLoja = p.perm_caixa_loja !== undefined
            ? (p.perm_caixa_loja === true || p.perm_caixa_loja === 'true')
            : (check('perm_caixa') || check('perm_gestao'));
        if (!permCaixaLoja) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="caixa.html"], [data-target="caixa"]').forEach(el => {
        const permCaixa = p.perm_caixa !== undefined
            ? (p.perm_caixa === true || p.perm_caixa === 'true')
            : (check('perm_pdv') || check('perm_gestao'));
        if (!permCaixa) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="compras.html"], [data-target="compras"]').forEach(el => {
        if (!check('perm_compras', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="relatorios.html"], [data-target="relatorios"]').forEach(el => {
        if (!check('perm_relatorios', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="agenda.html"], [data-target="agenda"]').forEach(el => {
        if (!check('perm_agenda', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="marketing.html"], [data-target="marketing"]').forEach(el => {
        if (!check('perm_marketing', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.5 Configurações
    document.querySelectorAll('a[href*="sistema.html"], [data-target="config"]').forEach(el => {
        if (!check('perm_config')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.6 Esconde títulos de seções vazias no menu
    esconderSecoesVaziasSidebar();

    // 3. Controle de botões no PDV / Operação / Orçamentos
    const btnNovoProd = document.getElementById('btn-pdv-novo-produto');
    if (btnNovoProd) {
        if (!window.podeCadastrarProdutos(p)) {
            btnNovoProd.classList.add('hidden');
        } else {
            btnNovoProd.classList.remove('hidden');
        }
    }

    const btnNovoCli = document.getElementById('btn-pdv-novo-cliente');
    const inputCliBusca = document.getElementById('pdv-cliente-busca');
    if (btnNovoCli) {
        if (!window.podeCadastrarClientes(p)) {
            btnNovoCli.classList.add('hidden');
            if (inputCliBusca) {
                inputCliBusca.classList.remove('rounded-l-lg');
                inputCliBusca.classList.add('rounded-lg');
            }
        } else {
            btnNovoCli.classList.remove('hidden');
            if (inputCliBusca) {
                inputCliBusca.classList.remove('rounded-lg');
                inputCliBusca.classList.add('rounded-l-lg');
            }
        }
    }

    if (typeof window.ajustarOpcoesOperacaoPDV === 'function') {
        try { window.ajustarOpcoesOperacaoPDV(); } catch(eOp) {}
    }

    if (typeof window.renderCarrinho === 'function' && typeof window.cart !== 'undefined' && Array.isArray(window.cart) && window.cart.length > 0) {
        try { window.renderCarrinho(); } catch(eCarrinho) {}
    }

    // 4. Oculta atalhos e botões no Dashboard caso o usuário não tenha permissão
    const btnNovoCliDash = document.querySelector('button[onclick*="clientes.html"]');
    if (btnNovoCliDash && !window.podeCadastrarClientes(p)) btnNovoCliDash.classList.add('hidden');

    const btnNovoProdDash = document.querySelector('button[onclick*="produtos.html"]');
    if (btnNovoProdDash && !window.podeCadastrarProdutos(p)) btnNovoProdDash.classList.add('hidden');

    const btnLancFinDash = document.querySelector('button[onclick*="financeiro.html"]');
    if (btnLancFinDash && !p.perm_gestao) btnLancFinDash.classList.add('hidden');

    const btnPdvDash = document.querySelector('button[onclick*="pdv.html"], a[href*="pdv.html"]');
    if (btnPdvDash && !p.perm_pdv) btnPdvDash.classList.add('hidden');

    // Desativa cliques nos cards de KPI do dashboard para módulos sem permissão
    document.querySelectorAll('[onclick*="financeiro.html"]').forEach(card => {
        if (!p.perm_gestao && card.tagName !== 'BUTTON') {
            card.removeAttribute('onclick');
            card.classList.remove('cursor-pointer');
        }
    });
    document.querySelectorAll('[onclick*="vendas_operacao.html"]').forEach(card => {
        if (!p.perm_pdv && card.tagName !== 'BUTTON') {
            card.removeAttribute('onclick');
            card.classList.remove('cursor-pointer');
        }
    });

    return false;
}

// =======================================================
// CONTROLE REAL DE MÓDULOS CONTRATADOS DO PLANO SAAS
// =======================================================
function aplicarControleDeModulosSaaS(empData, user) {
    if (!empData) return;

    // Respeita estritamente a configuracao de modulos feita no SaaS Master
    const licencaCentral = window.currentSaaSLicense;
    let mods = (licencaCentral && Array.isArray(licencaCentral.modulosLiberados) && licencaCentral.modulosLiberados.length > 0)
        ? licencaCentral.modulosLiberados
        : empData.modulosLiberados;

    if (!mods || !Array.isArray(mods) || mods.length === 0) {
        const plano = (empData.plano || '').toUpperCase();
        if (plano.includes('START') || plano.includes('BASICO') || plano === 'FREE') {
            mods = ['pdv', 'vendas', 'estoque', 'caixa'];
        } else if (plano.includes('BALCAO')) {
            mods = ['pdv', 'vendas', 'estoque', 'caixa'];
        } else if (plano.includes('FISCAL')) {
            mods = ['pdv', 'vendas', 'fiscal', 'estoque', 'caixa'];
        } else if (plano.includes('PRO') || plano.includes('PROFISSIONAL')) {
            mods = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'site'];
        } else if (plano.includes('ENTERPRISE') || plano.includes('ULTRA') || plano.includes('ILIMITADO')) {
            mods = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'site', 'ia', 'agenda', 'marketing', 'suporte'];
        } else {
            mods = ['pdv', 'vendas', 'estoque', 'caixa', 'financeiro'];
        }
    }
    window.modulosLiberadosEmpresa = mods;

    const path = window.location.pathname.toLowerCase();

    // Mapeamento de paginas para seus modulos obrigatorios no SaaS
    const mapaPaginas = [
        { rotas: ['fiscal.html'],         modulo: 'fiscal',     nome: 'Emissor Fiscal (NF-e/NFC-e)' },
        { rotas: ['financeiro.html'],      modulo: 'financeiro', nome: 'Financeiro & Fluxo de Caixa' },
        { rotas: ['compras.html'],         modulo: 'compras',    nome: 'Compras & NF-e XML' },
        { rotas: ['relatorios.html'],      modulo: 'relatorios', nome: 'Relatorios & DRE' },
        { rotas: ['agenda.html'],          modulo: 'agenda',     nome: 'Agenda & Lembretes' },
        { rotas: ['marketing.html'],       modulo: 'ia',         nome: 'Marketing & IA' },
        { rotas: ['caixa.html', 'caixa_loja.html'], modulo: 'caixa', nome: 'Caixa Fisico & Caixa da Loja' },
        { rotas: ['pdv.html'],             modulo: 'pdv',        nome: 'Frente de Caixa (PDV)' },
        { rotas: ['vendas_operacao.html', 'vendas_gestao.html', 'orcamentos.html', 'operacao.html'], modulo: 'vendas', nome: 'Historico de Vendas & Orcamentos' },
        { rotas: ['produtos.html', 'cadastro.html', 'estoque.html', 'fornecedores.html'], modulo: 'estoque', nome: 'Produtos, Estoque & Cadastros' }
    ];

    // 1. Bloqueia a pagina se o modulo correspondente nao estiver contratado
    const _checar = typeof window.temPermissaoModulo === 'function' ? window.temPermissaoModulo : function(m, l) {
        if (!l || !Array.isArray(l)) return false;
        if (m === 'ia' || m === 'marketing') return l.includes('ia') || l.includes('marketing');
        if (m === 'caixa' || m === 'caixa_loja') return l.includes('caixa') || l.includes('caixa_loja');
        return l.includes(m);
    };
    for (const item of mapaPaginas) {
        const estaNaRota = item.rotas.some(r => path.endsWith('/' + r) || path.endsWith(r));
        if (estaNaRota && !_checar(item.modulo, mods)) {
            window.__paginaBloqueadaPorPlano = true;
            bloquearPaginaPorPlanoSaaS(item.nome, empData.plano || 'Atual', item.modulo);
            return;
        }
    }

    // 2. Bloqueia visualmente os itens da barra lateral
    setTimeout(() => {
        atualizarMenuLateralPorPlanoSaaS(mods);
    }, 100);
}
window.aplicarControleDeModulosSaaS = aplicarControleDeModulosSaaS;

function bloquearPaginaPorPlanoSaaS(nomeModulo, nomePlano, moduloId) {
    window.__paginaBloqueadaPorPlano = true;
    const main = document.querySelector('main');
    if (main) {
        main.style.visibility = 'hidden';
        main.innerHTML = '';
    }

    // Se o cliente SaaS tiver o overlay completo com comparativo de planos, aciona ele
    if (typeof window.aplicarBloqueioPlano === 'function') {
        window.aplicarBloqueioPlano(moduloId || 'modulo', nomeModulo);
        return;
    }

    // Fallback elegante caso saas_licenca.js nao esteja pronto
    const antigo = document.getElementById('fc-saas-overlay-plano');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fc-saas-overlay-plano';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.98); display:flex; align-items:center; justify-content:center; padding:16px; font-family:Inter,system-ui,sans-serif;';
    overlay.innerHTML = `
        <div style="max-width:480px; width:100%; text-align:center; padding:2.5rem 2rem; background:#1e293b; border-radius:1.5rem; border:1px solid #334155; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);">
            <div style="width:72px; height:72px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:1rem; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem; font-size:1.75rem; color:#f59e0b;">
                <i class="fa-solid fa-lock"></i>
            </div>
            <h2 style="color:#f8fafc; font-size:1.35rem; font-weight:900; margin:0 0 0.5rem;">Modulo Nao Habilitado</h2>
            <p style="color:#94a3b8; font-size:0.875rem; margin:0 0 1.5rem; line-height:1.6;">
                O modulo <strong style="color:#fbbf24;">${nomeModulo}</strong> nao faz parte do pacote liberado para a sua loja.
            </p>
            <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
                <a href="index.html" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.65rem 1.5rem; background:#334155; border-radius:0.75rem; color:#f8fafc; font-size:0.8rem; font-weight:700; text-decoration:none;">
                    <i class="fa-solid fa-arrow-left"></i> Voltar ao Painel
                </a>
                <a href="https://wa.me/5562993341774?text=${encodeURIComponent('Ola! Gostaria de fazer o upgrade do plano da minha loja para liberar o modulo ' + nomeModulo)}" target="_blank" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.65rem 1.5rem; background:linear-gradient(135deg,#f59e0b,#eab308); border-radius:0.75rem; color:#0f172a; font-size:0.8rem; font-weight:900; text-decoration:none;">
                    <i class="fa-brands fa-whatsapp"></i> Falar com Suporte
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function atualizarMenuLateralPorPlanoSaaS(modulosLiberados) {
    const checarPerm = typeof window.temPermissaoModulo === 'function' ? window.temPermissaoModulo : function(m, list) {
        if (!list || !Array.isArray(list)) return false;
        if (m === 'ia' || m === 'marketing') return list.includes('ia') || list.includes('marketing');
        if (m === 'caixa' || m === 'caixa_loja') return list.includes('caixa') || list.includes('caixa_loja');
        return list.includes(m);
    };

    const mapaLinks = [
        { href: 'fiscal.html',         modulo: 'fiscal',     nome: 'Emissor Fiscal (NF-e)' },
        { href: 'financeiro.html',      modulo: 'financeiro', nome: 'Financeiro & Contas' },
        { href: 'compras.html',         modulo: 'compras',    nome: 'Compras & NF-e XML' },
        { href: 'caixa.html',           modulo: 'caixa',      nome: 'Caixa Fisico' },
        { href: 'caixa_loja.html',      modulo: 'caixa',      nome: 'Caixa da Loja' },
        { href: 'relatorios.html',      modulo: 'relatorios', nome: 'Relatorios & DRE' },
        { href: 'pdv.html',             modulo: 'pdv',        nome: 'Frente de Caixa (PDV)' },
        { href: 'vendas_operacao.html', modulo: 'vendas',     nome: 'Vendas & Orcamentos' },
        { href: 'vendas_gestao.html',   modulo: 'vendas',     nome: 'Gestao de Vendas' },
        { href: 'orcamentos.html',      modulo: 'vendas',     nome: 'Meus Orcamentos' },
        { href: 'funcionarios.html',    modulo: 'vendas',     nome: 'Funcionarios' },
        { href: 'agenda.html',          modulo: 'agenda',     nome: 'Agenda & Lembretes' },
        { href: 'marketing.html',       modulo: 'ia',         nome: 'Marketing & Lembretes' },
        { href: 'produtos.html',        modulo: 'estoque',    nome: 'Produtos & Servicos' },
        { href: 'clientes.html',        modulo: 'vendas',     nome: 'Clientes' },
        { href: 'fornecedores.html',    modulo: 'estoque',    nome: 'Fornecedores' }
    ];

    mapaLinks.forEach(item => {
        const links = document.querySelectorAll(`aside a[href*="${item.href}"]`);
        links.forEach(link => {
            if (!checarPerm(item.modulo, modulosLiberados)) {
                link.classList.add('opacity-40', 'cursor-not-allowed');
                link.classList.remove('hover:bg-slate-800');
                if (!link.querySelector('.badge-modulo-bloqueado')) {
                    const badge = document.createElement('span');
                    badge.className = 'badge-modulo-bloqueado ml-auto text-[10px] text-amber-400/80 font-bold';
                    badge.innerHTML = '<i class="fa-solid fa-lock text-[9px]"></i>';
                    link.appendChild(badge);
                }
                link.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.aplicarBloqueioPlano === 'function') {
                        window.aplicarBloqueioPlano(item.modulo, item.nome);
                    } else if (typeof showToast === 'function') {
                        showToast(`O modulo ${item.nome} nao esta incluso no plano da sua loja. Fale com a administracao para ativar!`, 'warning');
                    } else {
                        alert(`O modulo ${item.nome} nao esta incluso no plano da sua loja. Fale com a administracao para ativar!`);
                    }
                };
            } else {
                link.classList.remove('opacity-40', 'cursor-not-allowed');
                const badge = link.querySelector('.badge-modulo-bloqueado');
                if (badge) badge.remove();
                link.onclick = null;
            }
        });
    });

    // Tratamento especifico do link da Loja Virtual na barra lateral
    const linksLoja = document.querySelectorAll('aside a[onclick*="abrirMinhaLojaVirtual"]');
    linksLoja.forEach(link => {
        const permitido = checarPerm('site', modulosLiberados);
        if (!permitido) {
            link.classList.add('opacity-40', 'cursor-not-allowed');
            link.classList.remove('hover:bg-slate-800', 'text-emerald-400');
            link.classList.add('text-slate-500');
            link.setAttribute('title', 'Loja Virtual nao inclusa no seu plano atual');
            if (!link.querySelector('.badge-modulo-bloqueado')) {
                const badge = document.createElement('span');
                badge.className = 'badge-modulo-bloqueado ml-auto text-[10px] text-amber-400/80 font-bold';
                badge.innerHTML = '<i class="fa-solid fa-lock text-[9px]"></i>';
                link.appendChild(badge);
            }
            link.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.aplicarBloqueioPlano === 'function') {
                    window.aplicarBloqueioPlano('site', 'Loja Virtual & Catalogo Online');
                } else if (typeof showToast === 'function') {
                    showToast('A Loja Virtual nao esta disponivel no plano atual da sua empresa.', 'warning');
                }
            };
        } else {
            link.classList.remove('opacity-40', 'cursor-not-allowed', 'text-slate-500');
            link.classList.add('text-emerald-400');
            link.removeAttribute('title');
            const badge = link.querySelector('.badge-modulo-bloqueado');
            if (badge) badge.remove();
            link.onclick = (e) => {
                e.preventDefault();
                abrirMinhaLojaVirtual();
            };
        }
    });
}

function mostrarNomeUsuarioNoHeader(nome) {
    const header = document.querySelector('header');
    if (!header) return;
    
    const rightDiv = header.lastElementChild;
    if (rightDiv && rightDiv.classList.contains('flex')) {
        if (!document.getElementById('header-user-name-display')) {
            const nameEl = document.createElement('div');
            nameEl.id = 'header-user-name-display';
            nameEl.className = 'hidden sm:block text-sm font-bold text-slate-700 dark:text-slate-200 mr-2';
            rightDiv.insertBefore(nameEl, rightDiv.lastElementChild);
        }
        document.getElementById('header-user-name-display').innerText = nome;
        
        const avatarEl = rightDiv.lastElementChild;
        if (avatarEl && avatarEl.classList.contains('rounded-full')) {
            const partes = nome.split(' ');
            let sigla = partes[0].substring(0, 1).toUpperCase();
            if (partes.length > 1) sigla += partes[1].substring(0, 1).toUpperCase();
            else if (partes[0].length > 1) sigla += partes[0].substring(1, 2).toUpperCase();
            avatarEl.innerText = sigla;
        }
    }
}

// Intercepta cliques nos links para nao deixar navegar se o modulo SaaS ou permissao estiver bloqueado
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    if (link.hostname !== window.location.hostname) return;

    // 1. CHECAGEM ESTRITA DE MODULOS DO SAAS (Aplica a todos os usuarios da loja)
    if (window.modulosLiberadosEmpresa && Array.isArray(window.modulosLiberadosEmpresa)) {
        const mapaRotasModulos = [
            { rotas: ['fiscal.html'],         modulo: 'fiscal',     nome: 'Emissor Fiscal (NF-e)' },
            { rotas: ['financeiro.html'],      modulo: 'financeiro', nome: 'Financeiro & Contas' },
            { rotas: ['compras.html'],         modulo: 'compras',    nome: 'Compras & NF-e XML' },
            { rotas: ['relatorios.html'],      modulo: 'relatorios', nome: 'Relatorios & DRE' },
            { rotas: ['agenda.html'],          modulo: 'agenda',     nome: 'Agenda & Lembretes' },
            { rotas: ['marketing.html'],       modulo: 'ia',         nome: 'Marketing & IA' },
            { rotas: ['caixa.html'],           modulo: 'caixa',      nome: 'Caixa Fisico' },
            { rotas: ['pdv.html'],             modulo: 'pdv',        nome: 'Frente de Caixa (PDV)' },
            { rotas: ['vendas_operacao.html', 'vendas_gestao.html', 'orcamentos.html'], modulo: 'vendas', nome: 'Vendas & Orcamentos' },
            { rotas: ['produtos.html', 'cadastro.html', 'estoque.html', 'fornecedores.html'], modulo: 'estoque', nome: 'Produtos & Estoque' }
        ];

        const targetPath = link.pathname.toLowerCase();
        const _checarClick = typeof window.temPermissaoModulo === 'function' ? window.temPermissaoModulo : function(m, l) {
            if (!l || !Array.isArray(l)) return false;
            if (m === 'ia' || m === 'marketing') return l.includes('ia') || l.includes('marketing');
            return l.includes(m);
        };
        for (const item of mapaRotasModulos) {
            const estaNaRota = item.rotas.some(r => targetPath.endsWith('/' + r) || targetPath.endsWith(r));
            if (estaNaRota && !_checarClick(item.modulo, window.modulosLiberadosEmpresa)) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.aplicarBloqueioPlano === 'function') {
                    window.aplicarBloqueioPlano(item.modulo, item.nome);
                } else if (typeof showToast === 'function') {
                    showToast(`O modulo ${item.nome} nao esta incluso no plano da sua loja.`, 'warning');
                }
                return;
            }
        }
    }
    
    // Ignora links externos ou vazios
    if (link.hostname !== window.location.hostname) return;
    
    const p = window.currentUserInfo;
    if (!p || p.isAdmin) return; // Se for admin, passa direto

    // Validação estrita e centralizada de rotas para usuários comuns
    const rotaCheck = window.verificarPermissaoRota(link.href, p);
    if (!rotaCheck.permitido) {
        e.preventDefault();
        e.stopPropagation();
        showToast(rotaCheck.motivo, 'error');
    }
});

async function salvarKardex(ref, prodId, prodNome, qtd, tipo) {
    try {
        await window.getEmpresaRef().collection('movimentacoes').add({
            data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo
        });
    } catch (e) {
        console.error("Erro ao salvar Kardex", e);
    }
}

function saveDB() {
    console.warn("saveDB obsoleto: Use salvamento direto nas coleções do Firestore");
}

async function fazerLogout() {
    localStorage.removeItem('fc_sessao_data');
    localStorage.removeItem('fc_sessao_uid');
    localStorage.removeItem('fc_empresa_ativa');
    sessionStorage.clear();
    // Limpa todo o cache ao fazer logout para garantir que outro usuário
    // não veja dados em cache do usuário anterior
    if (typeof window.FCCache !== 'undefined') {
        try { await window.FCCache.invalidarTudo(); } catch (e) {}
    }
    try {
        await auth.signOut();
    } catch(e) {
        console.error("Erro no signOut:", e);
    }
    window.location.href = 'login.html';
}
window.fazerLogout = fazerLogout;
window.logout = fazerLogout;

// Funções da Loja Virtual Multi-Tenant
window.gerarLinkLojaVirtual = function() {
    const empId = window.currentEmpresaId || localStorage.getItem('fc_empresa_ativa') || '';
    const baseUrl = window.location.href.split('/sistema/')[0] + '/site/index.html';
    return empId ? `${baseUrl}?loja=${encodeURIComponent(empId)}` : baseUrl;
};

window.copiarLinkLojaVirtual = function() {
    if (typeof window.verificarAcessoModulo === 'function' && !window.verificarAcessoModulo('site')) {
        if (typeof window.aplicarBloqueioPlano === 'function') {
            window.aplicarBloqueioPlano('site', 'Loja Virtual & Catalogo Online');
        } else if (typeof showToast === 'function') {
            showToast('A Loja Virtual nao esta disponivel no plano atual da sua empresa.', 'warning');
        }
        return;
    }
    const link = window.gerarLinkLojaVirtual();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            if (typeof showToast === 'function') showToast('Link da sua loja virtual copiado com sucesso!', 'success');
            else alert('Link copiado: ' + link);
        }).catch(() => {
            prompt('Copie o link da sua loja:', link);
        });
    } else {
        prompt('Copie o link da sua loja:', link);
    }
};

window.abrirMinhaLojaVirtual = function() {
    if (typeof window.verificarAcessoModulo === 'function' && !window.verificarAcessoModulo('site')) {
        if (typeof window.aplicarBloqueioPlano === 'function') {
            window.aplicarBloqueioPlano('site', 'Loja Virtual & Catalogo Online');
        } else if (typeof showToast === 'function') {
            showToast('A Loja Virtual nao esta disponivel no plano atual da sua empresa.', 'warning');
        }
        return;
    }
    const link = window.gerarLinkLojaVirtual();
    window.open(link, '_blank');
};

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        }
    }
}

// ==========================================
// M?DULO: MOTOR DE TEMA E IDENTIDADE DA EMPRESA
// ==========================================
function aplicarIdentidadeVisualGlobal() {
    if (!db) return;

    const elNome = document.getElementById('menu-empresa-nome');
    const elLogo = document.getElementById('menu-logo');
    const elPlaceholder = document.getElementById('menu-logo-placeholder');

    const emp = (db.config && db.config.empresa) ? db.config.empresa : {};
    const nomeEmpresa = emp.fantasia || emp.nome || 'FC Móveis';

    if (elNome) {
        elNome.innerText = nomeEmpresa;
    }

    if (elLogo && elPlaceholder) {
        if (emp.logo) {
            elLogo.src = emp.logo;
            elLogo.classList.remove('hidden');
            elPlaceholder.classList.add('hidden');
        } else {
            elLogo.classList.add('hidden');
            elPlaceholder.classList.remove('hidden');
        }
    }

    // Aplica o tema salvo pelo usuário (Light ou Dark)
    aplicarTema();
}

function aplicarTema() {
    const tema = localStorage.getItem('fc_theme_sistema') || (window.db && window.db.config && window.db.config.tema) || 'dark';
    aplicarTemaSistema(tema, false);
}



// ===== FUN??ES GLOBAIS DE IA, CONFIRMA??O E VENDAS =====

window.chamarGemini = async function(prompt) {
    try {
        // 1. Verifica se a loja contratou o módulo de IA no plano
        const user = firebase.auth().currentUser;
        const isMaster = user && (user.email === 'pauloaugusto.silvaborges@gmail.com' || user.email === 'fabricadecoresgoiania@gmail.com');
        const mods = window.modulosLiberadosEmpresa;

        // Se for o Fundador ou Super Admin, liberação total
        // Se for lojista, só bloqueia se modulosLiberados foi carregado e não contém 'ia'
        if (!isMaster && Array.isArray(mods) && mods.length > 0 && !mods.includes('ia')) {
            if (typeof showToast === 'function') {
                showToast("O módulo de Inteligência Artificial não está incluso no plano da sua loja. Fale com a administração para ativar!", 'warning');
            }
            return null;
        }

        // 2. Busca da Chave da API com alta redundância:
        let apiKey = '';
        if (window.currentEmpresaData && window.currentEmpresaData.geminiKey) {
            apiKey = window.currentEmpresaData.geminiKey;
        } else if (typeof db !== 'undefined' && db.config && db.config.empresa && db.config.empresa.geminiKey) {
            apiKey = db.config.empresa.geminiKey;
        }

        // 2.1 Busca na Chave Mestra Global configurada pelo Fundador no Master
        if (!apiKey) {
            try {
                const saasSnap = await firebase.firestore().collection('saas_config').doc('master').get();
                if (saasSnap.exists && saasSnap.data().geminiKeyMaster) {
                    apiKey = saasSnap.data().geminiKeyMaster;
                }
            } catch (e) {
                console.warn("Aviso ao buscar chave mestra do SaaS:", e);
            }
        }

        // 2.2 Busca na empresa ativa do Firestore
        if (!apiKey && typeof window.getEmpresaRef === 'function') {
            try {
                const empDoc = await window.getEmpresaRef().get();
                if (empDoc.exists && empDoc.data().geminiKey) {
                    apiKey = empDoc.data().geminiKey;
                }
            } catch(e) {}
        }

        // 2.3 Fallback nas configurações legadas (fc_moveis/config)
        if (!apiKey) {
            try {
                const legacySnap = await firebase.firestore().collection('fc_moveis').doc('config').get();
                if (legacySnap.exists) {
                    const lData = legacySnap.data();
                    apiKey = (lData.empresa && lData.empresa.geminiKey) || lData.geminiApiKey || '';
                }
            } catch(e) {}
        }

        if (!apiKey) {
            console.warn("Chave Gemini não localizada.");
            if (typeof showToast === 'function') {
                showToast("A Chave de Inteligência Artificial ainda não foi configurada no sistema.", 'warning');
            }
            return null;
        }

        // 3. Execução com os modelos operacionais da Google
        const modelosParaTentar = [
            'gemini-3.5-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3.5-flash',
            'gemini-3.8-flash',
            'gemini-3.6-flash',
            'gemini-3.7-flash',
            'gemini-flash-latest'
        ];

        for (const modelo of modelosParaTentar) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (response.ok) {
                    const data = await response.json();
                    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (txt) return txt;
                }
            } catch (e) {
                // Tenta o próximo modelo
            }
        }
        return null;
    } catch (e) {
        console.error("Erro ao chamar IA Gemini:", e);
        return null;
    }
};

let callbackConfirmacaoGlobal = null;
window.abrirConfirmacao = function(titulo, msg, callback) {
    callbackConfirmacaoGlobal = callback;
    const modal = document.getElementById('modal-confirmacao');
    if (modal) {
        const titEl = document.getElementById('modal-confirmacao-titulo');
        const msgEl = document.getElementById('modal-confirmacao-msg');
        if (titEl) titEl.innerText = titulo;
        if (msgEl) msgEl.innerText = msg;
        modal.classList.remove('hidden');
    } else {
        if (confirm(`${titulo}\n\n${msg}`)) {
            if (typeof callback === 'function') callback();
        }
    }
};

window.fecharModalConfirmacao = function() {
    const modal = document.getElementById('modal-confirmacao');
    if (modal) modal.classList.add('hidden');
    callbackConfirmacaoGlobal = null;
};

window.executarAcaoConfirmada = function() {
    if (typeof callbackConfirmacaoGlobal === 'function') {
        callbackConfirmacaoGlobal();
    }
    window.fecharModalConfirmacao();
};

window.reimprimirVenda = function(id) {
    const v = (window.db && window.db.vendas) ? window.db.vendas.find(x => String(x.id) === String(id)) : null; 
    if(!v) return showToast('Venda não encontrada.', 'error');
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC M?VEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: REIMPRESS?O</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data Original: ${new Date(v.data).toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${v.clienteNome || '-'}</p><p style="margin: 2px 0;">Vendedor: ${v.vendedor || '-'}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${(v.itens || []).map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${typeof formatMoney === 'function' ? formatMoney(i.preco*i.qtd) : (i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total Final: ${typeof formatMoney === 'function' ? formatMoney(v.tot || v.valorLiquido) : (v.tot || v.valorLiquido)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${v.pag || 'Diversos'}</p></div>`;
    
    const printArea = document.getElementById('print-area');
    const modalRecibo = document.getElementById('modal-opcoes-recibo');
    if (printArea && modalRecibo) {
        printArea.innerHTML = htmlRecibo; 
        modalRecibo.classList.remove('hidden');
    } else {
        const w = window.open('', '_blank');
        if (w) {
            w.document.write(`<html><body style="font-family: monospace; padding: 20px;">${htmlRecibo}</body></html>`);
            w.document.close();
            w.print();
        }
    }
};

window.excluirVenda = function(id) {
    const v = (window.db && window.db.vendas) ? window.db.vendas.find(x => String(x.id) === String(id)) : null; 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'OR?AMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja excluir este orçamento?' 
        : 'Atenção! Isso fará a exclusão completa desta venda (devolvendo estoque e apagando as parcelas do financeiro). Deseja continuar?';

    window.abrirConfirmacao('Excluir Operação', msg, async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (window.db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            const pRef = window.getEmpresaRef().collection('produtos').doc(String(p.id));
                            batch.update(pRef, { estoque: firebase.firestore.FieldValue.increment(Number(item.qtd || 1)) });
                            
                            const kardexRef = window.getEmpresaRef().collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: 'Estorno (Exclusão) ' + (v.tipo || 'Venda') + ' #' + numPedStr,
                                prodId: p.id,
                                prodNome: p.nome,
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        } 
                    }); 
                }
                
                const finQuery = await window.getEmpresaRef().collection('financeiro').where('origemVendaId', '==', String(id)).get();
                finQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                // Cálculo preciso do montante efetivamente pago em dinheiro
                let valorDinheiroEfetivo = 0;
                if (Array.isArray(v.pagamentos) && v.pagamentos.length > 0) {
                    const pDinheiro = v.pagamentos.find(p => p && (p.metodo === 'Dinheiro' || String(p.metodo).includes('Dinheiro')));
                    if (pDinheiro) {
                        valorDinheiroEfetivo = Number(pDinheiro.valor || 0) - Number(v.troco || 0);
                        if (valorDinheiroEfetivo < 0) valorDinheiroEfetivo = 0;
                    }
                } else if (v.pag && String(v.pag).includes('Dinheiro')) {
                    valorDinheiroEfetivo = Number(v.valorLiquido || v.tot || 0);
                }

                if (valorDinheiroEfetivo > 0) { 
                    let cxAtual = window.db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                    let cxSaldoNovo = (cxAtual.saldo || 0) - valorDinheiroEfetivo;
                    cxHistoricoNovo.unshift({ 
                        data: new Date().toISOString(), 
                        tipo: 'SAIDA', 
                        desc: 'Estorno (Exclusão) ' + (v.tipo || 'Venda') + ' #' + numPedStr, 
                        valor: valorDinheiroEfetivo 
                    });
                    
                    const caixaRef = window.getEmpresaRef().collection('caixa').doc('caixa_atual');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }

            const vendaRef = window.getEmpresaRef().collection('vendas').doc(String(id));
            batch.delete(vendaRef);

            // Atualiza memoria local e cache imediatamente
            if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
                db.vendas = db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) {
                window.db.vendas = window.db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.removerItem === 'function') {
                await window.FCCache.removerItem('vendas', id);
            }

            await batch.commit();

            try {
                const trExcluir = document.querySelector('button[onclick*="excluirVenda(\'' + id + '\')"]')?.closest('tr');
                if (trExcluir) trExcluir.remove();
            } catch(e) {}

            if (typeof renderVendas === 'function') renderVendas();
            if (typeof renderOrcamentos === 'function') renderOrcamentos();
            window.fecharModalConfirmacao();
            showToast('Operação excluída com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            window.fecharModalConfirmacao();
            showToast('Erro ao excluir a operação.', 'error');
        }
    });
};

// ==========================================
// FUNCOES DE BUSCA CEP E CNPJ GLOBAIS
// ==========================================

window.buscarCEP = function(prefixo) {
    const cepInput = document.getElementById(`${prefixo}-cep`);
    if(!cepInput) return;
    const cep = cepInput.value.replace(/\D/g, '');
    if(cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(res => res.json())
            .then(data => {
                if(!data.erro) {
                    const elEnd = document.getElementById(`${prefixo}-endereco`);
                    const elBai = document.getElementById(`${prefixo}-bairro`);
                    const elCid = document.getElementById(`${prefixo}-cidade`);
                    if(elEnd) elEnd.value = data.logradouro;
                    if(elBai) elBai.value = data.bairro;
                    if(elCid) elCid.value = data.localidade + ' - ' + data.uf;
                }
            })
            .catch(() => {});
    }
};

window.buscarCNPJ = function(prefixo) {
    const docInput = document.getElementById(`${prefixo}-doc`);
    if(!docInput) return;
    const cnpj = docInput.value.replace(/\D/g, '');
    if(cnpj.length === 14) {
        const btnBusca = document.getElementById(`btn-busca-cnpj-${prefixo}`);
        if(btnBusca) {
            const oldHtml = btnBusca.innerHTML;
            btnBusca.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btnBusca.disabled = true;
            
            fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
                .then(res => {
                    if(!res.ok) throw new Error('CNPJ inválido ou API indisponível.');
                    return res.json();
                })
                .then(data => {
                    const elNome = document.getElementById(`${prefixo}-nome`);
                    const elFantasia = document.getElementById(`${prefixo}-fantasia`);
                    const elCep = document.getElementById(`${prefixo}-cep`);
                    const elTel = document.getElementById(`${prefixo}-telefone`);
                    
                    if(elNome) elNome.value = data.razao_social || '';
                    if(elFantasia && data.nome_fantasia) elFantasia.value = data.nome_fantasia;
                    
                    if(elCep && data.cep) {
                        elCep.value = data.cep;
                        // Trigger CEP search
                        window.buscarCEP(prefixo);
                    }
                    
                    if(elTel && data.ddd_telefone_1) {
                        elTel.value = data.ddd_telefone_1;
                    }
                    
                    showToast('Dados do CNPJ preenchidos!', 'success');
                })
                .catch(err => {
                    showToast(err.message, 'error');
                })
                .finally(() => {
                    btnBusca.innerHTML = oldHtml;
                    btnBusca.disabled = false;
                });
        }
    } else {
        showToast('Digite um CNPJ válido com 14 dígitos.', 'error');
    }
};

window.formatarEBuscarDoc = function(input, prefixo) {
    let v = input.value.replace(/\D/g, '');
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
    }
    input.value = v;

    if (v.replace(/\D/g, '').length === 14) {
        if (typeof window.buscarCNPJ === 'function') {
            window.buscarCNPJ(prefixo);
        }
    }
};

// ==========================================
// SUPORTE A PWA & INSTALA??O DE APLICATIVO
// ==========================================
let deferredPwaPrompt = null;

if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    window.addEventListener('load', () => {
        const swPath = window.location.pathname.includes('/sistema/') ? '../sw.js' : './sw.js';
        navigator.serviceWorker.register(swPath)
            .then(reg => console.log('ðŸš€ PWA Service Worker ativo!'))
            .catch(err => console.warn('PWA Service Worker offline/ignorado:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    window.deferredPwaPrompt = e;
    console.log('ðŸ“² PWA: Evento de instalação pronto.');
    mostrarBotaoInstalarApp();
});

window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null;
    window.deferredPwaPrompt = null;
    console.log('ðŸŽ‰ PWA: Aplicativo instalado com sucesso!');
    const btn = document.getElementById('btn-instalar-pwa');
    if (btn) btn.remove();
    if (typeof showToast === 'function') {
        showToast('Aplicativo instalado com sucesso!', 'success');
    }
});

function mostrarBotaoInstalarApp() {
    if (document.getElementById('btn-instalar-pwa')) return;
    
    // Se já estiver rodando instalado como App, não precisa mostrar
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    // Procura o container do botão de Sair no menu lateral
    const logoutBtn = document.querySelector('button[onclick*="fazerLogout"]');
    if (logoutBtn && logoutBtn.parentElement) {
        const container = logoutBtn.parentElement;
        const btnInstalar = document.createElement('button');
        btnInstalar.id = 'btn-instalar-pwa';
        btnInstalar.className = 'w-full mb-3 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold py-2.5 px-3 rounded-lg shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] cursor-pointer';
        btnInstalar.innerHTML = '<i class="fa-solid fa-cloud-arrow-down text-sm"></i> Instalar Aplicativo';
        btnInstalar.onclick = window.instalarPWA;
        container.insertBefore(btnInstalar, logoutBtn);
    }
}

window.instalarPWA = async function() {
    if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        const choiceResult = await deferredPwaPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
            console.log('Usuário aceitou instalar o PWA');
            deferredPwaPrompt = null;
            const btn = document.getElementById('btn-instalar-pwa');
            if (btn) btn.remove();
        }
    } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            alert('ðŸ“² Como instalar no iPhone / iPad:\n\n1. Toque no botão "Compartilhar" (ícone com quadrado e seta para cima na barra do Safari).\n2. Role para baixo e toque em "Adicionar à Tela de Início".\n3. Toque em "Adicionar" no topo direito.');
        } else {
            alert('ðŸ“² Como instalar no Computador ou Android:\n\n1. No Google Chrome ou Microsoft Edge, clique no ícone "Instalar Aplicativo" na barra de endereços (ao lado da estrela de favoritos).\n2. Ou clique nos 3 pontinhos do navegador e escolha "Instalar FC Gestão".');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mostrarBotaoInstalarApp, 1000);
});

// ==========================================
// TABELAS RESPONSIVAS MOBILE (data-label)
// Injeta atributo data-label em cada <td> com base
// no cabeçalho correspondente da coluna, para que
// o CSS mobile exiba os labels sem scroll horizontal.
// ==========================================
function initResponsiveTables() {
    document.querySelectorAll('table').forEach(table => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        if (!headers.length) return;
        table.querySelectorAll('tbody tr').forEach(tr => {
            Array.from(tr.querySelectorAll('td')).forEach((td, i) => {
                if (headers[i]) td.setAttribute('data-label', headers[i]);
            });
        });
    });
}
window.initResponsiveTables = initResponsiveTables;

// Observa mutações no DOM para aplicar labels automaticamente
// quando as tabelas são preenchidas via JS assíncrono
(function() {
    // MutationObserver desativado: tabelas agora usam touch-scroll nativo preservando integridade das colunas
    const observer = { observe: () => {} };
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        if (window.innerWidth <= 640) initResponsiveTables();
    });
})();

// ==========================================
// FUNÇÕES FISCAIS UNIVERSAIS (DANFE & XML NATIVOS - SEFAZ DIRETO)
// ==========================================
async function obterVendaFiscal(vendaOrId) {
    if (vendaOrId && typeof vendaOrId === 'object') return vendaOrId;
    const vId = String(vendaOrId || '');
    if (window.vendaAtualImpressao && (!vId || String(window.vendaAtualImpressao.id) === vId)) {
        return window.vendaAtualImpressao;
    }
    if (typeof vendasGlobais !== 'undefined' && Array.isArray(vendasGlobais)) {
        const found = vendasGlobais.find(x => String(x.id) === vId);
        if (found) return found;
    }
    if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
        const found = db.vendas.find(x => String(x.id) === vId);
        if (found) return found;
    }
    // Verifica notas de devolução
    if (typeof db !== 'undefined' && Array.isArray(db.notasDevolucao)) {
        const found = db.notasDevolucao.find(x => String(x.id) === vId || String(x.vendaId) === vId || x.chave_nfe === vId);
        if (found) {
            return {
                id: vId,
                clienteNome: found.clienteNome || 'Consumidor Final',
                clienteDoc: found.clienteDoc || '',
                tot: Number(found.valor || 0),
                pag: 'Sem Pagamento',
                formaPagamento: 'Sem Pagamento',
                pagamentos: [{ metodo: 'Sem Pagamento', valor: 0 }],
                nfe_devolucao: found
            };
        }
    }
    // Verifica notas avulsas
    if (typeof db !== 'undefined' && Array.isArray(db.notasAvulsas)) {
        const found = db.notasAvulsas.find(x => String(x.id) === vId || x.chave_nfe === vId || String(x.numero) === vId);
        if (found) {
            const formaP = found.formaPagamento || found.pag || (found.pagamentos && found.pagamentos[0]?.metodo) || 'Dinheiro';
            return {
                id: vId,
                clienteNome: found.destinatario?.nome || 'Consumidor Final',
                clienteDoc: found.destinatario?.cpf || found.destinatario?.cnpj || found.destinatario?.doc || '',
                tot: Number(found.totalLiquido !== undefined ? found.totalLiquido : (found.valor || 0)),
                pag: formaP,
                formaPagamento: formaP,
                pagamentos: found.pagamentos || [{ metodo: formaP, valor: Number(found.valor || 0) }],
                nfe: (found.modelo === '55' || String(found.tipo || '').includes('NF-e')) ? found : null,
                nfce: (found.modelo === '65' || String(found.tipo || '').includes('NFC-e')) ? found : null,
                fiscal_xml: found.xml_conteudo || '',
                fiscal_chave: found.chave_nfe || '',
                itens: found.itens || [],
                produtos: found.itens || [],
                rawAvulsa: found
            };
        }
    }
    if (typeof firebase !== 'undefined' && firebase.firestore && vId) {
        try {
            const snap = await firebase.firestore().collection('vendas').doc(vId).get();
            if (snap.exists) return { id: snap.id, ...snap.data() };
            const snapAv = await firebase.firestore().collection('notas_avulsas').doc(vId).get();
            if (snapAv.exists) {
                const found = snapAv.data();
                const formaP = found.formaPagamento || found.pag || (found.pagamentos && found.pagamentos[0]?.metodo) || 'Dinheiro';
                return {
                    id: snapAv.id,
                    clienteNome: found.destinatario?.nome || 'Consumidor Final',
                    clienteDoc: found.destinatario?.cpf || found.destinatario?.cnpj || found.destinatario?.doc || '',
                    tot: Number(found.totalLiquido !== undefined ? found.totalLiquido : (found.valor || 0)),
                    pag: formaP,
                    formaPagamento: formaP,
                    pagamentos: found.pagamentos || [{ metodo: formaP, valor: Number(found.valor || 0) }],
                    nfe: (found.modelo === '55' || String(found.tipo || '').includes('NF-e')) ? found : null,
                    nfce: (found.modelo === '65' || String(found.tipo || '').includes('NFC-e')) ? found : null,
                    fiscal_xml: found.xml_conteudo || '',
                    fiscal_chave: found.chave_nfe || '',
                    itens: found.itens || [],
                    produtos: found.itens || [],
                    rawAvulsa: found
                };
            }
        } catch (e) {
            console.warn('Erro ao buscar venda no Firestore:', e);
        }
    }
    return null;
}

/**
 * Extrai a lista detalhada de pagamentos de uma nota fiscal.
 * Prioridades:
 * 1) Do XML oficial autorizado (tags <detPag> e <vTroco>), garantindo fidelidade 100% à SEFAZ
 * 2) Do array `v.pagamentos` ou `nota.pagamentos`
 * 3) Da string `v.pag` ou `nota.pag` (inclusive com múltiplos pagamentos separados por '+')
 * 4) Dos campos `v.formaPagamento` / `v.pagamento` / `v.metodo`
 * 5) Fallback padrão 'Dinheiro'
 */
function extrairPagamentosNota(v, nota) {
    const xml = nota?.xml_conteudo || v?.fiscal_xml || v?.nfce?.xml_conteudo || v?.nfe?.xml_conteudo || v?.rawAvulsa?.xml_conteudo || '';
    const totalNota = Number(v?.totalLiquido || v?.tot || v?.valorLiquido || v?.total || nota?.valor || 0);

    // 1. Tentar extrair do XML da SEFAZ
    if (xml && xml.includes('<detPag>')) {
        const detPags = [];
        const regexDetPag = /<detPag>([\s\S]*?)<\/detPag>/g;
        let match;
        const nomesSefaz = {
            '01': 'Dinheiro',
            '02': 'Cheque',
            '03': 'Cartão de Crédito',
            '04': 'Cartão de Débito',
            '05': 'Crédito Loja',
            '10': 'Vale Alimentação',
            '11': 'Vale Refeição',
            '12': 'Vale Presente',
            '13': 'Vale Combustível',
            '14': 'Duplicata Mercantil',
            '15': 'Boleto Bancário',
            '16': 'Depósito Bancário',
            '17': 'Pagamento Instantâneo (PIX)',
            '18': 'Transferência Bancária',
            '19': 'Programa de Fidelidade',
            '20': 'PIX',
            '90': 'Sem Pagamento',
            '99': 'Outros'
        };

        while ((match = regexDetPag.exec(xml)) !== null) {
            const bloco = match[1];
            const tPagMatch = bloco.match(/<tPag>(\d+)<\/tPag>/);
            const vPagMatch = bloco.match(/<vPag>([\d\.]+)<\/vPag>/);
            const xPagMatch = bloco.match(/<xPag>([\s\S]*?)<\/xPag>/);
            
            if (tPagMatch && vPagMatch) {
                const cod = tPagMatch[1].padStart(2, '0');
                const val = parseFloat(vPagMatch[1]) || 0;
                let nome = nomesSefaz[cod] || `Outros (${cod})`;
                if (cod === '99' && xPagMatch && xPagMatch[1].trim()) {
                    nome = xPagMatch[1].trim();
                } else if (cod === '17' || cod === '20') {
                    nome = 'PIX';
                }
                detPags.push({ codigo: cod, nome, valor: val });
            }
        }

        let troco = 0;
        const trocoMatch = xml.match(/<vTroco>([\d\.]+)<\/vTroco>/);
        if (trocoMatch) {
            troco = parseFloat(trocoMatch[1]) || 0;
        }

        if (detPags.length > 0) {
            return {
                pagamentos: detPags,
                troco,
                textoResumo: detPags.map(p => p.nome).join(' + ')
            };
        }
    }

    // 2. Tentar extrair do array de pagamentos (v.pagamentos ou nota.pagamentos)
    const listaArr = (v?.pagamentos && Array.isArray(v?.pagamentos) && v.pagamentos.length > 0)
        ? v.pagamentos
        : (nota?.pagamentos && Array.isArray(nota?.pagamentos) && nota.pagamentos.length > 0 ? nota.pagamentos : []);

    if (listaArr.length > 0) {
        const pagamentos = listaArr.map((p, idx) => {
            const metodo = p.metodo || p.forma || p.formaPagamento || p.nome || 'Dinheiro';
            const parcelas = parseInt(p.parcelas) || 1;
            const parcTxt = parcelas > 1 ? ` (${parcelas}x)` : '';
            const valor = (parseFloat(p.valor) || 0) || (listaArr.length === 1 ? totalNota : 0);
            return {
                codigo: '',
                nome: `${metodo}${parcTxt}`,
                valor,
                parcelas,
                vencimentoBase: p.vencimentoBase || ''
            };
        });
        const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0);
        const troco = soma > totalNota ? (soma - totalNota) : 0;
        return {
            pagamentos,
            troco,
            textoResumo: pagamentos.map(p => p.nome).join(' + ')
        };
    }

    // 3. Tentar extrair da string v.pag ou nota.pag
    const pagStr = v?.pag || nota?.pag || '';
    if (pagStr && typeof pagStr === 'string' && pagStr.trim()) {
        if (pagStr.includes('+')) {
            const partes = pagStr.split('+').map(s => s.trim()).filter(Boolean);
            const pagamentos = partes.map(pt => {
                const matchVal = pt.match(/\(R\$\s*([\d\.,]+)\)/i);
                let valor = 0;
                let nome = pt;
                if (matchVal) {
                    valor = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.')) || 0;
                    nome = pt.replace(matchVal[0], '').trim();
                }
                return { codigo: '', nome: nome || pt, valor };
            });
            const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0);
            const troco = soma > totalNota ? (soma - totalNota) : 0;
            return { pagamentos, troco, textoResumo: pagStr };
        } else {
            const matchVal = pagStr.match(/\(R\$\s*([\d\.,]+)\)/i);
            let valor = totalNota;
            let nome = pagStr;
            if (matchVal) {
                const vParsed = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.'));
                if (vParsed > 0) valor = vParsed;
                nome = pagStr.replace(matchVal[0], '').trim();
            }
            return { pagamentos: [{ codigo: '', nome: nome || pagStr, valor }], troco: 0, textoResumo: nome || pagStr };
        }
    }

    // 4. Campos avulsos
    const formaAvulsa = v?.formaPagamento || v?.pagamento || v?.metodo || nota?.formaPagamento || nota?.metodo || '';
    if (formaAvulsa) {
        return { pagamentos: [{ codigo: '', nome: formaAvulsa, valor: totalNota }], troco: 0, textoResumo: formaAvulsa };
    }

    // 5. Fallback final
    return { pagamentos: [{ codigo: '01', nome: 'Dinheiro', valor: totalNota }], troco: 0, textoResumo: 'Dinheiro' };
}
window.extrairPagamentosNota = extrairPagamentosNota;

// ==============================================================
// GERADOR DE CÓDIGO DE BARRAS CODE 128C PARA CHAVE DA NF-e
// Gera SVG vetorial 100% puro, nativo e offline (sem libs externas)
// ==============================================================
function gerarSvgCode128(chave44) {
    const limpo = String(chave44 || '').replace(/\D/g, '');
    if (limpo.length !== 44) return '';

    const patterns = [
        "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
        "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
        "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
        "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
        "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
        "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
        "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
        "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
        "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
        "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
        "114131","311141","411131","211412","211214","211232","2331112"
    ];

    const START_C = 105;
    const STOP = 106;

    let soma = START_C;
    const codigos = [START_C];

    for (let i = 0; i < 44; i += 2) {
        const par = parseInt(limpo.substring(i, i + 2), 10);
        codigos.push(par);
        const peso = (i / 2) + 1;
        soma += par * peso;
    }

    const checksum = soma % 103;
    codigos.push(checksum);
    codigos.push(STOP);

    let modulos = "";
    for (const c of codigos) {
        const p = patterns[c];
        let isBar = true;
        for (let i = 0; i < p.length; i++) {
            const w = parseInt(p[i], 10);
            modulos += (isBar ? "1" : "0").repeat(w);
            isBar = !isBar;
        }
    }

    const svgLargura = modulos.length;
    let svgRects = "";
    let x = 0;
    let barWidth = 0;

    for (let i = 0; i < modulos.length; i++) {
        if (modulos[i] === "1") {
            barWidth++;
        } else {
            if (barWidth > 0) {
                svgRects += `<rect x="${x}" y="0" width="${barWidth}" height="50" fill="#000" />`;
                x += barWidth;
                barWidth = 0;
            }
            x++;
        }
    }
    if (barWidth > 0) {
        svgRects += `<rect x="${x}" y="0" width="${barWidth}" height="50" fill="#000" />`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgLargura} 50" preserveAspectRatio="none" style="width:100%; height:38px; display:block;">${svgRects}</svg>`;
}
window.gerarSvgCode128 = gerarSvgCode128;

// ==============================================================
// LAYOUT OFICIAL DO DANFE NF-e (MOD 55) - PADRÃO A4 RETRATO
// ==============================================================
function gerarHtmlDanfeNFeA4(v, nota, emp) {
    const isDevolucao = Boolean(nota?.isDevolucao || nota?.tipo_devolucao || nota?.chave_original || v?.nfe_devolucao === nota || (typeof nota?.tipo === 'string' && nota.tipo.includes('Devolução')));
    const tpNF = isDevolucao ? '0' : '1';
    const naturezaOp = isDevolucao ? 'DEVOLUÇÃO DE MERCADORIA' : (emp?.naturezaOperacao || 'VENDA DE MERCADORIA');

    const chave = String(nota?.chave_nfe || v?.fiscal_chave || '').replace(/\D/g, '');
    const chaveFmt = chave ? chave.replace(/(\d{4})/g, '$1 ').trim() : '-';
    const barcodeSvg = gerarSvgCode128(chave);

    const numRaw = String(nota?.numero || v?.fiscal_numero || '0').padStart(9, '0');
    const numeroNota = numRaw.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
    const serie = nota?.serie || '1';
    const protocolo = nota?.protocolo || v?.fiscal_protocolo || 'AUTORIZADO';
    const dataEmissaoRaw = nota?.data_emissao || v?.data || new Date().toISOString();
    const dataEmissao = new Date(dataEmissaoRaw).toLocaleString('pt-BR');
    const dataApenas = dataEmissao.split(' ')[0] || '';
    const horaApenas = dataEmissao.split(' ')[1] || '';

    // Emitente
    const logoSrc = emp?.logo || emp?.logoBase64 || v?.empresaLogo || (typeof db !== 'undefined' && db?.config?.empresa?.logo) || '';
    const emitRazao = emp?.razaoSocial || emp?.nome || 'EMPRESA EMISSORA';
    const emitFantasia = emp?.nomeFantasia || emp?.fantasia || '';
    const emitCnpj = emp?.cnpj || '';
    const emitIe = emp?.ie || 'ISENTO';
    const emitIeSt = emp?.ieSt || '';
    const emitLogr = emp?.logradouro || emp?.rua || 'ENDEREÇO DA EMPRESA';
    const emitNro = emp?.numero || 'S/N';
    const emitBairro = emp?.bairro || 'CENTRO';
    const emitMun = emp?.cidade || emp?.municipio || '';
    const emitUf = (emp?.uf || 'GO').toUpperCase();
    const emitCep = emp?.cep || '';
    const emitFone = emp?.telefone || emp?.fone || '';

    // Destinatário
    const destNome = v?.clienteNome || v?.cliente?.nome || 'CONSUMIDOR FINAL';
    const destDoc = v?.clienteCpf || v?.clienteCnpj || v?.clienteDoc || v?.cliente?.cpf || v?.cliente?.cnpj || '000.000.000-00';
    const destLogr = v?.cliente?.endereco || v?.cliente?.rua || v?.cliente?.logradouro || 'RUA PRINCIPAL';
    const destNro = v?.cliente?.numero || 'S/N';
    const destBairro = v?.cliente?.bairro || 'CENTRO';
    const destMun = v?.cliente?.cidade || v?.cliente?.municipio || emitMun;
    const destUf = (v?.cliente?.uf || emitUf).toUpperCase();
    const destCep = v?.cliente?.cep || '';
    const destFone = v?.cliente?.telefone || v?.cliente?.fone || '';
    const destIe = v?.cliente?.ie || 'ISENTO';

    // Itens
    const itens = v?.itens || v?.produtos || [];
    let totalItens = 0;
    const itensTr = itens.map((it, idx) => {
        const qtd = Number(it.quantidade || it.qtd || 1);
        const preco = Number(it.preco || it.precoUnitario || 0);
        const subtotal = qtd * preco;
        totalItens += subtotal;
        const cod = escapeHtml(it.ean || it.codigo || it.codigoProduto || it.sku || it.codProduto || it.cod || it.id || String(idx + 1));
        const desc = escapeHtml(it.nome || it.descricao || 'PRODUTO');
        const ncm = escapeHtml(it.ncm || '94036000');
        const csosn = escapeHtml(it.csosn || '102');
        const cfop = escapeHtml(it.cfop || '5102');
        const un = escapeHtml(it.unidade || 'UN');

        return `
        <tr>
            <td>${cod}</td>
            <td>${desc}</td>
            <td>${ncm}</td>
            <td>${csosn}</td>
            <td>${cfop}</td>
            <td>${un}</td>
            <td style="text-align: right;">${qtd.toFixed(2)}</td>
            <td style="text-align: right;">${preco.toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">${subtotal.toFixed(2)}</td>
            <td style="text-align: right;">0.00</td>
            <td style="text-align: right;">0.00</td>
            <td style="text-align: right;">0.00</td>
            <td style="text-align: right;">0.00</td>
        </tr>`;
    }).join('');

    const totalNota = Number(v?.totalLiquido || v?.tot || v?.valorLiquido || v?.total || totalItens || 0).toFixed(2);
    const totalDesc = Number(v?.desconto || 0).toFixed(2);
    const totalProdFmt = Number(totalItens || totalNota).toFixed(2);
    const infoPag = extrairPagamentosNota(v, nota);
    const formaPag = escapeHtml(infoPag.textoResumo || 'Dinheiro');

    let linhasFatura = '';
    if (infoPag.pagamentos && infoPag.pagamentos.length > 0) {
        linhasFatura = infoPag.pagamentos.map((p, idx) => {
            const numParc = String(idx + 1).padStart(3, '0');
            const venc = p.vencimentoBase ? new Date(p.vencimentoBase + 'T12:00:00').toLocaleDateString('pt-BR') : dataApenas;
            const valFmt = Number(p.valor || totalNota).toFixed(2);
            return `
    <div class="row" style="${idx > 0 ? 'border-top: none;' : ''}">
        <div class="box ${idx > 0 ? 'border-t-0' : ''}" style="flex: 1.2;">
            <span class="box-title">FORMA DE PAGAMENTO</span>
            <div class="box-val">${escapeHtml(p.nome || 'Dinheiro')}</div>
        </div>
        <div class="box ${idx > 0 ? 'border-t-0' : ''} border-l-0" style="flex: 1;">
            <span class="box-title">PARCELA / VENCIMENTO</span>
            <div class="box-val">${numParc} - ${venc}</div>
        </div>
        <div class="box ${idx > 0 ? 'border-t-0' : ''} border-l-0" style="flex: 1;">
            <span class="box-title">VALOR DA PARCELA</span>
            <div class="box-val">R$ ${valFmt}</div>
        </div>
    </div>`;
        }).join('');
    } else {
        linhasFatura = `
    <div class="row">
        <div class="box" style="flex: 1.2;">
            <span class="box-title">FORMA DE PAGAMENTO</span>
            <div class="box-val">${formaPag}</div>
        </div>
        <div class="box border-l-0" style="flex: 1;">
            <span class="box-title">PARCELA / VENCIMENTO</span>
            <div class="box-val">001 - ${dataApenas}</div>
        </div>
        <div class="box border-l-0" style="flex: 1;">
            <span class="box-title">VALOR DA PARCELA</span>
            <div class="box-val">R$ ${totalNota}</div>
        </div>
    </div>`;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>DANFE NF-e Nº ${numeroNota} - ${emitRazao}</title>
    <style>
        @page { size: A4 portrait; margin: 4mm 5mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 0; font-size: 8px; background: #fff; width: 100%; }
        .canhoto { border: 1px solid #000; display: flex; width: 100%; margin-bottom: 3px; }
        .canhoto-txt { flex: 1; padding: 3px 5px; border-right: 1px solid #000; font-size: 7.5px; line-height: 1.1; }
        .canhoto-assinatura { width: 250px; padding: 3px 5px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; }
        .canhoto-nfe { width: 95px; text-align: center; padding: 3px 2px; display: flex; flex-direction: column; justify-content: center; }
        .linha-pontilhada { border-bottom: 1px dashed #000; margin: 3px 0 4px 0; }
        .box { border: 1px solid #000; padding: 2px 4px; overflow: hidden; }
        .box-title { font-size: 6px; text-transform: uppercase; font-weight: bold; display: block; line-height: 1; color: #333; margin-bottom: 1px; }
        .box-val { font-size: 8px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .box-val-normal { font-size: 8px; font-weight: normal; }
        .row { display: flex; width: 100%; }
        .border-t-0 { border-top: 0 !important; }
        .border-b-0 { border-bottom: 0 !important; }
        .border-l-0 { border-left: 0 !important; }
        .border-r-0 { border-right: 0 !important; }
        .section-header { font-size: 7.5px; font-weight: bold; text-transform: uppercase; margin: 4px 0 1px 1px; }
        table.tabela-itens { width: 100%; border-collapse: collapse; border: 1px solid #000; }
        table.tabela-itens th { font-size: 6.5px; font-weight: bold; text-transform: uppercase; border: 1px solid #000; padding: 2px 3px; background: #e8e8e8; text-align: left; }
        table.tabela-itens td { font-size: 7.5px; border: 1px solid #000; padding: 2px 3px; }
    </style>
</head>
<body>
    <div class="canhoto">
        <div class="canhoto-txt">
            RECEBEMOS DE <strong>${escapeHtml(emitRazao)}</strong> OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO.
            <div style="margin-top: 6px; font-size: 7px; color: #555;">EMISSÃO: ${dataEmissao} - DESTINATÁRIO: ${escapeHtml(destNome)} - VALOR TOTAL: R$ ${totalNota}</div>
        </div>
        <div class="canhoto-assinatura">
            <div class="box-title">DATA DE RECEBIMENTO</div>
            <div style="height: 14px; border-bottom: 1px solid #000; margin-bottom: 2px;"></div>
            <div class="box-title">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
        </div>
        <div class="canhoto-nfe">
            <strong style="font-size: 10px;">NF-e</strong>
            <div style="font-size: 8.5px; font-weight: bold;">Nº ${numeroNota}</div>
            <div style="font-size: 7.5px;">SÉRIE: ${serie}</div>
        </div>
    </div>
    <div class="linha-pontilhada"></div>

    <div class="row">
        <div class="box" style="flex: 1.1; display: flex; flex-direction: row; align-items: center; gap: 8px; padding: 4px 6px;">
            ${logoSrc ? `<div style="max-width: 80px; max-height: 65px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><img src="${logoSrc}" style="max-width: 80px; max-height: 60px; object-fit: contain;"></div>` : ''}
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                <div style="font-size: 10.5px; font-weight: bold; line-height: 1.1;">${escapeHtml(emitRazao)}</div>
                ${emitFantasia ? `<div style="font-size: 8.5px; font-weight: bold; color: #444;">${escapeHtml(emitFantasia)}</div>` : ''}
                <div class="box-val-normal" style="margin-top: 2px;">${escapeHtml(emitLogr)}, ${escapeHtml(emitNro)} - ${escapeHtml(emitBairro)}</div>
                <div class="box-val-normal">${escapeHtml(emitMun)} - ${emitUf} - CEP: ${escapeHtml(emitCep)}</div>
                ${emitFone ? `<div class="box-val-normal">FONE: ${escapeHtml(emitFone)}</div>` : ''}
            </div>
        </div>

        <div class="box border-l-0" style="width: 145px; text-align: center; padding: 4px 2px;">
            <div style="font-size: 14px; font-weight: 900; letter-spacing: 1px;">DANFE</div>
            <div style="font-size: 6.5px; line-height: 1;">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
            <div class="row" style="margin: 4px auto 2px auto; justify-content: center; align-items: center; gap: 4px;">
                <div style="font-size: 7px; text-align: left; line-height: 1.1;">0 - ENTRADA<br>1 - SAÍDA</div>
                <div style="border: 1px solid #000; font-size: 11px; font-weight: bold; width: 18px; height: 18px; line-height: 18px; text-align: center;">${tpNF}</div>
            </div>
            <div style="font-size: 8.5px; font-weight: bold; margin-top: 2px;">Nº ${numeroNota}</div>
            <div style="font-size: 8px; font-weight: bold;">SÉRIE: ${serie}</div>
            <div style="font-size: 7px;">FOLHA: 1/1</div>
        </div>

        <div class="box border-l-0" style="flex: 1.3; text-align: center; padding: 3px 4px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="width: 100%; margin: 1px 0;">${barcodeSvg}</div>
            <div class="box-title" style="text-align: left; margin-top: 1px;">CHAVE DE ACESSO</div>
            <div style="font-size: 8px; font-weight: bold; letter-spacing: 0.4px; word-break: break-all;">${chaveFmt}</div>
            <div style="font-size: 6.5px; margin-top: 2px; color: #333; line-height: 1;">
                Consulta de autenticidade no portal nacional da NF-e<br>
                <span style="text-decoration: underline;">www.nfe.fazenda.gov.br/portal</span> ou no site da Sefaz Autorizadora
            </div>
        </div>
    </div>

    <div class="row">
        <div class="box border-t-0" style="flex: 2;">
            <span class="box-title">NATUREZA DA OPERAÇÃO</span>
            <div class="box-val">${escapeHtml(naturezaOp)}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1.8;">
            <span class="box-title">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
            <div class="box-val">${escapeHtml(protocolo)} - ${dataEmissao}</div>
        </div>
    </div>

    <div class="row">
        <div class="box border-t-0" style="flex: 1;">
            <span class="box-title">INSCRIÇÃO ESTADUAL</span>
            <div class="box-val">${escapeHtml(emitIe)}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">INSC. ESTADUAL DO SUBST. TRIB.</span>
            <div class="box-val">${escapeHtml(emitIeSt || '-')}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">CNPJ</span>
            <div class="box-val">${escapeHtml(emitCnpj)}</div>
        </div>
    </div>

    <div class="section-header">DESTINATÁRIO / REMETENTE</div>
    <div class="row">
        <div class="box" style="flex: 2.5;">
            <span class="box-title">NOME / RAZÃO SOCIAL</span>
            <div class="box-val">${escapeHtml(destNome)}</div>
        </div>
        <div class="box border-l-0" style="flex: 1.2;">
            <span class="box-title">CNPJ / CPF</span>
            <div class="box-val">${escapeHtml(destDoc)}</div>
        </div>
        <div class="box border-l-0" style="width: 80px;">
            <span class="box-title">DATA DA EMISSÃO</span>
            <div class="box-val" style="text-align: center;">${dataApenas}</div>
        </div>
    </div>
    <div class="row">
        <div class="box border-t-0" style="flex: 2;">
            <span class="box-title">ENDEREÇO</span>
            <div class="box-val-normal">${escapeHtml(destLogr)}, ${escapeHtml(destNro)}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">BAIRRO / DISTRITO</span>
            <div class="box-val-normal">${escapeHtml(destBairro)}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="width: 70px;">
            <span class="box-title">CEP</span>
            <div class="box-val-normal">${escapeHtml(destCep || '74000-000')}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="width: 80px;">
            <span class="box-title">DATA SAÍDA/ENTRADA</span>
            <div class="box-val" style="text-align: center;">${dataApenas}</div>
        </div>
    </div>
    <div class="row">
        <div class="box border-t-0" style="flex: 1.5;">
            <span class="box-title">MUNICÍPIO</span>
            <div class="box-val-normal">${escapeHtml(destMun)}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">FONE / FAX</span>
            <div class="box-val-normal">${escapeHtml(destFone || '-')}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="width: 30px; text-align: center;">
            <span class="box-title">UF</span>
            <div class="box-val">${destUf}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">INSCRIÇÃO ESTADUAL</span>
            <div class="box-val-normal">${escapeHtml(destIe)}</div>
        </div>
        <div class="box border-t-0 border-l-0" style="width: 80px;">
            <span class="box-title">HORA DA SAÍDA</span>
            <div class="box-val" style="text-align: center;">${horaApenas || '12:00:00'}</div>
        </div>
    </div>

    <div class="section-header">FATURA / DUPLICATA / FORMA DE PAGAMENTO</div>
    ${linhasFatura}

    <div class="section-header">CÁLCULO DO IMPOSTO</div>
    <div class="row">
        <div class="box" style="flex: 1;">
            <span class="box-title">BASE DE CÁLCULO DO ICMS</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-l-0" style="flex: 1;">
            <span class="box-title">VALOR DO ICMS</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-l-0" style="flex: 1;">
            <span class="box-title">BASE DE CÁLC. ICMS ST</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-l-0" style="flex: 1;">
            <span class="box-title">VALOR DO ICMS ST</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-l-0" style="flex: 1.2;">
            <span class="box-title">VALOR TOTAL DOS PRODUTOS</span>
            <div class="box-val" style="text-align: right;">${totalNota}</div>
        </div>
    </div>
    <div class="row">
        <div class="box border-t-0" style="flex: 1;">
            <span class="box-title">VALOR DO FRETE</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">VALOR DO SEGURO</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">DESCONTO</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">OUTRAS DESPESAS</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1;">
            <span class="box-title">VALOR DO IPI</span>
            <div class="box-val" style="text-align: right;">0,00</div>
        </div>
        <div class="box border-t-0 border-l-0" style="flex: 1.2; background: #fafafa;">
            <span class="box-title">VALOR TOTAL DA NOTA</span>
            <div class="box-val" style="text-align: right; font-size: 10px;">R$ ${totalNota}</div>
        </div>
    </div>

    <div class="section-header">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
    <div class="row">
        <div class="box" style="flex: 2;">
            <span class="box-title">RAZÃO SOCIAL</span>
            <div class="box-val-normal">O MESMO / RETIRADA NO LOCAL</div>
        </div>
        <div class="box border-l-0" style="width: 130px;">
            <span class="box-title">FRETE POR CONTA</span>
            <div class="box-val">9 - SEM OCORRÊNCIA</div>
        </div>
        <div class="box border-l-0" style="width: 70px;">
            <span class="box-title">CÓDIGO ANTT</span>
            <div class="box-val-normal">-</div>
        </div>
        <div class="box border-l-0" style="width: 70px;">
            <span class="box-title">PLACA VEÍCULO</span>
            <div class="box-val-normal">-</div>
        </div>
        <div class="box border-l-0" style="width: 30px; text-align: center;">
            <span class="box-title">UF</span>
            <div class="box-val-normal">${emitUf}</div>
        </div>
        <div class="box border-l-0" style="flex: 1.2;">
            <span class="box-title">CNPJ / CPF</span>
            <div class="box-val-normal">-</div>
        </div>
    </div>

    <div class="section-header">DADOS DO PRODUTO / SERVIÇO</div>
    <table class="tabela-itens">
        <thead>
            <tr>
                <th style="width: 50px; text-align: center;">CÓDIGO</th>
                <th>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                <th style="width: 45px; text-align: center;">NCM/SH</th>
                <th style="width: 35px; text-align: center;">CST</th>
                <th style="width: 35px; text-align: center;">CFOP</th>
                <th style="width: 25px; text-align: center;">UN</th>
                <th style="width: 40px; text-align: right;">QTD.</th>
                <th style="width: 50px; text-align: right;">V. UNIT.</th>
                <th style="width: 55px; text-align: right;">V. TOTAL</th>
                <th style="width: 45px; text-align: right;">BC ICMS</th>
                <th style="width: 45px; text-align: right;">V. ICMS</th>
                <th style="width: 30px; text-align: center;">ALÍQ.</th>
            </tr>
        </thead>
        <tbody>
            ${itensTr}
        </tbody>
    </table>

    <div class="section-header">DADOS ADICIONAIS</div>
    <div class="row">
        <div class="box" style="flex: 2; min-height: 55px;">
            <span class="box-title">INFORMAÇÕES COMPLEMENTARES</span>
            <div class="box-val-normal" style="line-height: 1.2; font-size: 7px;">
                DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.<br>
                NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI/ICMS.<br>
                ${isDevolucao ? `<strong>NF-E DE DEVOLUÇÃO / ENTRADA</strong> - Emitida em estorno de operação comercial.<br>Ref. Chave de Acesso Original: <strong>${escapeHtml(nota?.chave_original || v?.nfce?.chave_nfe || v?.nfe?.chave_nfe || '')}</strong><br>` : ''}
                ${v?.id ? `Identificador da Venda: ${v.id} | ` : ''}Vendedor: ${escapeHtml(v?.vendedor || 'BALCÃO')}<br>
                ${v?.observacoes ? `Observações: ${escapeHtml(v.observacoes)}<br>` : ''}
                Documento emitido através do sistema FC-Gestão - SEFAZ Direto.
            </div>
        </div>
        <div class="box border-l-0" style="flex: 1; min-height: 55px;">
            <span class="box-title">RESERVADO AO FISCO</span>
            <div class="box-val-normal"></div>
        </div>
    </div>

    <script>
        function dispararImpressao() {
            setTimeout(function() { window.print(); }, 250);
        }
        if (document.readyState === 'complete') {
            dispararImpressao();
        } else {
            window.addEventListener('load', dispararImpressao);
        }
    </script>
</body>
</html>`;
}
window.gerarHtmlDanfeNFeA4 = gerarHtmlDanfeNFeA4;

// ==============================================================
// LAYOUT DO DANFE NFC-e (MOD 65) - BOBINA TÉRMICA 80MM
// ==============================================================
function gerarHtmlDanfeNFCe80mm(v, nota, emp, qrImgSrc) {
    const chave = String(nota?.chave_nfe || nota?.chave_nfce || v?.fiscal_chave || '').replace(/\D/g, '');
    const chaveFmt = chave ? chave.replace(/(\d{4})/g, '$1 ').trim() : 'EM PROCESSAMENTO';
    const logoSrc = emp?.logo || emp?.logoBase64 || v?.empresaLogo || (typeof db !== 'undefined' && db?.config?.empresa?.logo) || '';
    const isContingencia = Boolean(nota?.contingencia || nota?.tpEmis === '9' || v?.fiscal_contingencia || v?.status_fiscal === 'contingencia' || (chave && chave.length >= 35 && chave.charAt(34) === '9'));

    const itensList = v?.itens || v?.produtos || [];
    const itensHtml = itensList.map((it, i) => {
        const qtd = Number(it.quantidade || it.qtd || 1);
        const preco = Number(it.preco || it.precoUnitario || 0);
        return `
        <tr>
            <td style="font-size:10px; padding:2px 0;">${i+1} ${escapeHtml(it.nome || it.descricao || 'Produto')}</td>
            <td style="font-size:10px; text-align:right;">${qtd} ${escapeHtml(it.unidade || 'UN')}</td>
            <td style="font-size:10px; text-align:right;">${preco.toFixed(2)}</td>
            <td style="font-size:10px; text-align:right; font-weight:bold;">${(qtd * preco).toFixed(2)}</td>
        </tr>
        `;
    }).join('');

    const infoPagNFCe = extrairPagamentosNota(v, nota);
    const totalNotaNFCe = Number(v?.totalLiquido || v?.tot || v?.valorLiquido || v?.total || 0).toFixed(2);

    const linhasPagamentosNFCe = (infoPagNFCe.pagamentos && infoPagNFCe.pagamentos.length > 0)
        ? infoPagNFCe.pagamentos.map(p => `
        <div style="display:flex; justify-content:space-between; font-size:10px; padding: 1px 0;">
            <span>${escapeHtml(p.nome)}</span>
            <span>${Number(p.valor || totalNotaNFCe).toFixed(2)}</span>
        </div>`).join('')
        : `
        <div style="display:flex; justify-content:space-between; font-size:10px; padding: 1px 0;">
            <span>${escapeHtml(infoPagNFCe.textoResumo || 'Dinheiro')}</span>
            <span>${totalNotaNFCe}</span>
        </div>`;

    const trocoHtmlNFCe = (infoPagNFCe.troco > 0.001) ? `
        <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:bold; padding: 1px 0; border-top: 1px dotted #000; margin-top: 2px;">
            <span>Troco R$</span>
            <span>${Number(infoPagNFCe.troco).toFixed(2)}</span>
        </div>` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>DANFE NFC-e - Nº ${nota?.numero || v?.id}</title>
    <style>
        @page { margin: 2mm; size: 80mm auto; }
        body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; width: 72mm; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .border-b { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
        .border-t { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; }
        .qr { text-align: center; margin: 8px 0; }
        .qr img { width: 140px; height: 140px; }
    </style>
</head>
<body>
    <div class="text-center border-b">
        ${logoSrc ? `<div style="margin-bottom: 6px;"><img src="${logoSrc}" style="max-height: 52px; max-width: 140px; object-fit: contain;"></div>` : ''}
        <div class="font-bold" style="font-size: 13px;">${escapeHtml(emp?.razaoSocial || emp?.nome || 'EMPRESA EMISSORA')}</div>
        ${emp?.nomeFantasia ? `<div style="font-size: 10px;">${escapeHtml(emp.nomeFantasia)}</div>` : ''}
        <div style="font-size: 10px;">CNPJ: ${emp?.cnpj || ''} - IE: ${emp?.ie || 'ISENTO'}</div>
        <div style="font-size: 9px;">${escapeHtml(emp?.logradouro || emp?.rua || '')}, ${escapeHtml(emp?.numero || 'S/N')} - ${escapeHtml(emp?.bairro || '')}, ${escapeHtml(emp?.cidade || '')} - ${(emp?.uf || 'GO').toUpperCase()}</div>
    </div>

    ${isContingencia ? `
    <div style="border: 2px solid #000; padding: 4px; margin: 4px 0; text-align: center; font-weight: bold; background: #fff;">
        <div style="font-size: 13px; letter-spacing: 0.5px;">EMITIDA EM CONTINGÊNCIA</div>
        <div style="font-size: 9.5px; margin-top: 2px;">Pendente de autorização pelo Fisco</div>
    </div>` : ''}

    <div class="text-center font-bold border-b" style="padding: 2px 0;">
        DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
        <div style="font-size: 9px; font-weight: normal;">Não permite aproveitamento de crédito de ICMS</div>
    </div>

    <table>
        <thead>
            <tr style="border-bottom: 1px solid #000; font-size: 9px;">
                <th style="text-align:left;">ITEM/DESC</th>
                <th style="text-align:right;">QTD</th>
                <th style="text-align:right;">UNIT</th>
                <th style="text-align:right;">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            ${itensHtml}
        </tbody>
    </table>

    <div class="border-t">
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:12px; margin-bottom: 4px;">
            <span>VALOR TOTAL R$</span>
            <span>${totalNotaNFCe}</span>
        </div>
        <div style="font-size:10px; font-weight:bold; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 3px; display:flex; justify-content:space-between;">
            <span>FORMA DE PAGAMENTO</span>
            <span>VALOR PAGO R$</span>
        </div>
        ${linhasPagamentosNFCe}
        ${trocoHtmlNFCe}
    </div>

    <div class="border-t text-center" style="font-size: 10px;">
        <div>${isContingencia ? 'EMISSÃO EM CONTINGÊNCIA' : 'EMISSÃO NORMAL'} | AMBIENTE: ${(nota?.ambiente || emp?.ambienteFiscal || 'producao').toUpperCase()}</div>
        <div>Número: <strong>${nota?.numero || '1'}</strong> - Série: <strong>${nota?.serie || '1'}</strong></div>
        <div>Emissão: ${nota?.data_emissao ? new Date(nota.data_emissao).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
        <div>Protocolo: <strong>${isContingencia && (!nota?.protocolo || nota?.protocolo === 'AUTORIZADO') ? 'EMISSÃO EM CONTINGÊNCIA' : (nota?.protocolo || 'AUTORIZADO')}</strong></div>
    </div>

    <div class="border-t text-center" style="font-size: 9px;">
        <div>CHAVE DE ACESSO</div>
        <div class="font-bold" style="letter-spacing: 0.5px; word-break: break-all;">${chaveFmt}</div>
    </div>

    ${qrImgSrc ? `
    <div class="qr border-t">
        <div>Consulte pela Chave de Acesso em:</div>
        <div style="font-size:8px; word-break:break-all;">${(emp?.uf || 'GO').toUpperCase() === 'GO' ? 'https://www.sefaz.go.gov.br/nfce/consulta' : `https://www.fazenda.${(emp?.uf||'sp').toLowerCase()}.gov.br/nfce/consulta`}</div>
        <img src="${qrImgSrc}" alt="QR Code SEFAZ">
        <div style="font-size: 8px;">Consulte via Leitor de QR Code</div>
    </div>` : ''}

    <div class="text-center" style="font-size: 9px; margin-top: 4px;">
        CONSUMIDOR: ${v?.clienteNome || 'Consumidor Não Identificado'}<br>
        ${v?.clienteDoc ? `CPF/CNPJ: ${v.clienteDoc}<br>` : ''}
        Tributos Totais Incidentes (Lei Federal 12.741/2012)
    </div>

    <script>
        function dispararImpressao() {
            setTimeout(function() { window.print(); }, 250);
        }
        if (document.readyState === 'complete') {
            dispararImpressao();
        } else {
            window.addEventListener('load', dispararImpressao);
        }
    </script>
</body>
</html>`;
}
window.gerarHtmlDanfeNFCe80mm = gerarHtmlDanfeNFCe80mm;

async function imprimirDanfeNativo(vendaOrId, tipo = 'NFC-e') {
    if (typeof showToast === 'function') showToast('Preparando DANFE para impressão...', 'info');

    const v = await obterVendaFiscal(vendaOrId);
    if (!v) {
        if (typeof showToast === 'function') showToast('Venda não encontrada para impressão fiscal.', 'error');
        else alert('Venda não encontrada para impressão fiscal.');
        return;
    }

    const isDev = (tipo === 'NF-e Devolução' || tipo === 'devolucao');
    const isNFe = isDev || (tipo === 'NF-e' || tipo === 'nfe' || tipo === '55');
    const nota = isDev ? (v.nfe_devolucao || v.nfe || {}) : (isNFe ? (v.nfe || {}) : (v.nfce || {}));
    const emp = (typeof db !== 'undefined' && db.config?.empresa) ? db.config.empresa : {};
    const chave = nota.chave_nfe || nota.chave_nfce || v.fiscal_chave || '';
    const qrCodeUrl = nota.qr_code_url || v.fiscal_qrcode_url || (chave ? `https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=${chave}` : '');
    const qrImgSrc = qrCodeUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCodeUrl)}` : '';

    let html = '';
    if (isNFe) {
        html = gerarHtmlDanfeNFeA4(v, nota, emp);
    } else {
        html = gerarHtmlDanfeNFCe80mm(v, nota, emp, qrImgSrc);
    }

    if (!html) {
        if (typeof showToast === 'function') showToast('Erro ao gerar layout da DANFE.', 'error');
        else alert('Erro ao gerar layout da DANFE.');
        return;
    }

    const winW = isNFe ? 850 : 450;
    const winH = isNFe ? 950 : 700;

    // 1. Tenta abrir janela popup
    let printWin = null;
    try {
        printWin = window.open('', '_blank', `width=${winW},height=${winH},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`);
    } catch (e) {
        console.warn('Falha ao abrir popup de impressão:', e);
    }

    if (printWin && !printWin.closed) {
        try {
            printWin.document.open();
            printWin.document.write(html);
            printWin.document.close();
            setTimeout(() => {
                try {
                    printWin.focus();
                    printWin.print();
                } catch (err) {
                    console.warn('Erro ao disparar print na janela popup:', err);
                }
            }, 300);
            return;
        } catch (e) {
            console.warn('Erro ao manipular popup de impressão fiscal:', e);
        }
    }

    // 2. Fallback Iframe se popup foi bloqueada pelo navegador
    let iframe = document.getElementById('iframe-impressao-fiscal-global');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'iframe-impressao-fiscal-global';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
    }

    const docIframe = iframe.contentWindow?.document || iframe.contentDocument;
    if (docIframe) {
        try {
            docIframe.open();
            docIframe.write(html);
            docIframe.close();
            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (err) {
                    console.warn('Erro ao disparar print no iframe:', err);
                }
            }, 350);
            return;
        } catch (err) {
            console.warn('Falha no doc.write do iframe, usando srcdoc:', err);
        }
    }

    iframe.srcdoc = html;
    iframe.onload = () => {
        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                if (typeof showToast === 'function') showToast('Erro ao imprimir. Por favor, autorize pop-ups no navegador.', 'warning');
                else alert('Erro ao imprimir. Por favor, autorize pop-ups no navegador.');
            }
        }, 350);
    };
}

async function baixarXmlNativo(vendaOrId, tipo = 'NFC-e') {
    const v = await obterVendaFiscal(vendaOrId);
    if (!v) {
        if (typeof showToast === 'function') showToast('Venda não encontrada para baixar XML.', 'error');
        else alert('Venda não encontrada para baixar XML.');
        return;
    }
    const isNFe = (tipo === 'NF-e' || tipo === 'nfe' || tipo === '55');
    const nota = isNFe ? (v.nfe || {}) : (v.nfce || {});
    const xml = nota.xml_conteudo || v.fiscal_xml || (v.nfce?.xml_conteudo) || (v.nfe?.xml_conteudo);
    if (!xml) {
        if (typeof showToast === 'function') showToast('Conteúdo do arquivo XML não encontrado no banco de dados.', 'warning');
        else alert('Conteúdo do arquivo XML não encontrado no banco de dados.');
        return;
    }
    const chave = nota.chave_nfe || nota.chave_nfce || v.fiscal_chave || (isNFe ? v.nfe?.chave_nfe : v.nfce?.chave_nfe) || `nota_${v.id}`;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chave}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('Download do XML concluído!', 'success');
}

window.imprimirDanfeNativo = imprimirDanfeNativo;
window.imprimirDanfeNativoGlobal = imprimirDanfeNativo;
window.baixarXmlNativo = baixarXmlNativo;
window.baixarXmlNativoGlobal = baixarXmlNativo;



// =======================================================
// GERENCIADOR DE OPCOES PERSONALIZADAS (MOVEIS E ESTOFADOS)
// Disponivel em todas as telas: PDV, Produtos, Configuracoes, Orcamentos
// =======================================================
window.categoriaOpcaoPersAtiva = 'madeiras';

window.getPersonalizacaoConfig = function() {
    if (!window.db) window.db = {};
    if (!window.db.config) window.db.config = {};
    if (!window.db.config.personalizacao) {
        window.db.config.personalizacao = {
            madeiras: ['MDF Naval', 'MDF Cru', 'Madeira Maciça (Jequitibá)', 'Madeira Maciça (Angelim)', 'Compensado Naval'],
            cores_madeira: ['Natural / Verniz Fosco', 'Natural / Verniz Brilho', 'Freijó', 'Castanho / Nogueira', 'Imbuia', 'Preto Fosco', 'Branco Acetinado', 'Off White'],
            tecidos: ['Suede Tradicional', 'Suede Animale', 'Linho Puro', 'Bouclé', 'Couro Sintético (Courino)', 'Veludo Molhado', 'Facto Impermeável'],
            cores_estofado: ['Bege Claro / Areia', 'Cinza Claro', 'Cinza Chumbo', 'Terracota', 'Verde Oliva', 'Azul Marinho', 'Preto', 'Off-White']
        };
    }
    return window.db.config.personalizacao;
};

window.salvarConfiguracaoPersonalizacaoNoBanco = async function() {
    try {
        const pers = window.getPersonalizacaoConfig();
        if (typeof window.getEmpresaRef === 'function') {
            await window.getEmpresaRef().collection('configuracoes').doc('config').set({
                personalizacao: pers
            }, { merge: true });
        }
        if (typeof window.FCCache !== 'undefined' && window.db && window.db.config) {
            window.FCCache.set('fc_moveis_config', window.db.config);
        }
        console.log('Opcoes de personalizacao sincronizadas com o banco!');
    } catch (err) {
        console.error('Erro ao sincronizar personalizacao:', err);
    }
};

window.abrirModalOpcoesPersonalizadas = function(catInicial) {
    if (catInicial) window.categoriaOpcaoPersAtiva = catInicial;
    const modal = document.getElementById('modal-opcoes-personalizadas');
    if (modal) modal.classList.remove('hidden');
    window.alternarAbaOpcoesPersonalizacao(window.categoriaOpcaoPersAtiva || 'madeiras');
};

window.fecharModalOpcoesPersonalizadas = function() {
    const modal = document.getElementById('modal-opcoes-personalizadas');
    if (modal) modal.classList.add('hidden');
    // Atualiza selects abertos se o modal de personalizacao do item estiver aberto
    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao();
    }
};

window.alternarAbaOpcoesPersonalizacao = function(cat) {
    window.categoriaOpcaoPersAtiva = cat;
    
    // Atualiza botoes da aba
    ['madeiras', 'cores_madeira', 'tecidos', 'cores_estofado'].forEach(k => {
        const btn = document.getElementById('aba-pers-btn-' + k);
        if (btn) {
            if (k === cat) {
                btn.className = 'py-2 px-3 rounded-lg font-bold text-xs transition border flex items-center justify-center gap-1.5 bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs';
            } else {
                btn.className = 'py-2 px-3 rounded-lg font-bold text-xs transition border flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
            }
        }
    });

    const labelMap = {
        madeiras: 'Adicionar Tipo de Madeira (Ex: MDF Naval, Madeira Maciça, Cedro):',
        cores_madeira: 'Adicionar Cor / Acabamento da Madeira (Ex: Freijó, Imbuia, Verniz Fosco):',
        tecidos: 'Adicionar Tipo de Tecido / Estofado (Ex: Linho Puro, Bouclé, Suede, Couro):',
        cores_estofado: 'Adicionar Cor do Tecido (Ex: Areia, Terracota, Cinza Chumbo):'
    };

    const lbl = document.getElementById('label-nova-opcao-pers');
    if (lbl) lbl.innerText = labelMap[cat] || 'Adicionar Opção:';

    const input = document.getElementById('input-nova-opcao-pers');
    if (input) {
        input.value = '';
        input.focus();
    }

    window.renderizarListaTagsOpcoesPers();
};

window.renderizarListaTagsOpcoesPers = function() {
    const cat = window.categoriaOpcaoPersAtiva || 'madeiras';
    const pers = window.getPersonalizacaoConfig();
    const lista = pers[cat] || [];
    
    const countEl = document.getElementById('contador-opcoes-pers');
    if (countEl) countEl.innerText = lista.length + (lista.length === 1 ? ' cadastrada' : ' cadastradas');

    const container = document.getElementById('lista-opcoes-pers-tags');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = '<div class="text-slate-400 text-xs py-4 text-center w-full">Nenhuma opção cadastrada nesta categoria. Adicione a primeira acima!</div>';
        return;
    }

    container.innerHTML = lista.map((item, idx) => {
        const val = typeof item === 'string' ? item : (item.nome || '');
        return `<span class="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs group hover:border-amber-400 dark:hover:border-amber-500 transition">
            <span>${val}</span>
            <button type="button" onclick="removerOpcaoPersonalizacao('${cat}', ${idx})" class="text-slate-400 hover:text-red-500 transition p-0.5 rounded" title="Excluir opção">
                <i class="fa-solid fa-xmark text-xs"></i>
            </button>
        </span>`;
    }).join('');
};

window.adicionarOpcaoPersonalizacaoAtiva = async function() {
    const cat = window.categoriaOpcaoPersAtiva || 'madeiras';
    const input = document.getElementById('input-nova-opcao-pers');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
        if (typeof showToast === 'function') showToast('Digite o nome da opção a cadastrar', 'info');
        return;
    }

    const pers = window.getPersonalizacaoConfig();
    if (!pers[cat]) pers[cat] = [];

    // Checar duplicidade
    const jaExiste = pers[cat].some(opt => (typeof opt === 'string' ? opt : opt.nome).toLowerCase() === val.toLowerCase());
    if (jaExiste) {
        if (typeof showToast === 'function') showToast('Esta opção já está cadastrada!', 'error');
        return;
    }

    pers[cat].push(val);
    input.value = '';
    window.renderizarListaTagsOpcoesPers();
    await window.salvarConfiguracaoPersonalizacaoNoBanco();

    if (typeof showToast === 'function') showToast('Opção adicionada com sucesso!', 'success');

    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao(cat, val);
    }
};

window.removerOpcaoPersonalizacao = async function(cat, idx) {
    const pers = window.getPersonalizacaoConfig();
    if (!pers[cat] || !pers[cat][idx]) return;
    const nome = typeof pers[cat][idx] === 'string' ? pers[cat][idx] : pers[cat][idx].nome;
    
    pers[cat].splice(idx, 1);
    window.renderizarListaTagsOpcoesPers();
    await window.salvarConfiguracaoPersonalizacaoNoBanco();

    if (typeof showToast === 'function') showToast(`Opção "${nome}" removida.`, 'info');

    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao();
    }
};

window.cadastrarOpcaoRapida = function(cat) {
    const nomesAmigaveis = {
        madeiras: 'Tipo de Madeira',
        cores_madeira: 'Cor / Acabamento da Madeira',
        tecidos: 'Tipo de Estofado / Tecido',
        cores_estofado: 'Cor do Estofado'
    };
    const titulo = nomesAmigaveis[cat] || 'Opção';
    const nova = prompt(`Cadastrar novo ${titulo}:\n(Ficará salvo no sistema para futuras vendas)`);
    if (!nova || !nova.trim()) return;

    const val = nova.trim();
    const pers = window.getPersonalizacaoConfig();
    if (!pers[cat]) pers[cat] = [];

    const jaExiste = pers[cat].some(opt => (typeof opt === 'string' ? opt : opt.nome).toLowerCase() === val.toLowerCase());
    if (!jaExiste) {
        pers[cat].push(val);
        window.salvarConfiguracaoPersonalizacaoNoBanco();
    }

    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao(cat, val);
    }

    if (typeof showToast === 'function') showToast(`"${val}" adicionado às opções!`, 'success');
};

// =======================================================
// MOTOR UNIVERSAL DE EXPORTAÇÃO E RELATÓRIOS (EXCEL, WORD, PDF)
// Suporte completo em todas as páginas:
// Produtos, Vendas, Clientes, Funcionários, Fornecedores, Compras, Marketing, etc.
// =======================================================

(function() {
    function obterDadosEmpresa() {
        const conf = (window.db && window.db.config) ? window.db.config : {};
        const emp = conf.empresa || {};
        return {
            nome: emp.nome || emp.fantasia || 'FC Móveis e Interiores',
            fantasia: emp.fantasia || emp.nome || 'FC Móveis',
            cnpj: emp.cnpj || emp.doc || '',
            telefone: emp.telefone || emp.wpp || emp.whatsapp || '',
            email: emp.email || '',
            cidade: emp.cidade || '',
            uf: emp.uf || '',
            endereco: emp.endereco || emp.rua || ''
        };
    }

    function formatarMoedaLocal(valor) {
        if (typeof formatMoney === 'function') {
            try { return formatMoney(valor); } catch(e){}
        }
        const n = Number(valor) || 0;
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatarDataHoraAtual() {
        const d = new Date();
        return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // ----------------------------------------------------
    // 1. EXPORTADOR PARA EXCEL (.XLS / HTML Spreadsheet)
    // ----------------------------------------------------
    window.exportarParaExcel = function(opts) {
        try {
            opts = opts || {};
            const emp = obterDadosEmpresa();
            const titulo = opts.titulo || 'Relatório Gerencial';
            const subtitulo = opts.subtitulo || '';
            const nomeArquivo = (opts.nomeArquivo || 'Relatorio').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const dataHora = formatarDataHoraAtual();

            let colunas = opts.colunas || [];
            let dados = opts.dados || [];

            // Se recebeu tabelaId e não recebeu dados estruturados, extrai da tabela DOM
            if ((!colunas.length || !dados.length) && opts.tabelaId) {
                const tabela = document.getElementById(opts.tabelaId);
                if (tabela) {
                    const extraido = extrairDadosDeTabelaDOM(tabela);
                    colunas = extraido.colunas;
                    dados = extraido.dados;
                }
            }

            if (!dados.length) {
                if (typeof showToast === 'function') showToast('Nenhum dado encontrado para exportar.', 'warning');
                return;
            }

            let thsHtml = colunas.map(c => 
                `<th style="background-color:#0f172a; color:#ffffff; font-weight:bold; border:0.5pt solid #94a3b8; padding:8px 12px; text-align:${c.align || 'left'}; font-size:11pt;">${c.label}</th>`
            ).join('');

            let trsHtml = dados.map((row, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                const tds = colunas.map(c => {
                    const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '';
                    let align = c.align || (c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : 'left');
                    let msoFormat = '';
                    if (c.tipo === 'moeda') msoFormat = 'mso-number-format:"\\0022R$\\0022\\ #\\,##0\\.00";';
                    else if (c.tipo === 'numero') msoFormat = 'mso-number-format:"#,##0";';
                    else msoFormat = 'mso-number-format:"\\@";';

                    return `<td style="border:0.5pt solid #cbd5e1; padding:6px 10px; background-color:${bg}; text-align:${align}; ${msoFormat} font-size:10pt;">${val}</td>`;
                }).join('');
                return `<tr>${tds}</tr>`;
            }).join('');

            let resumoHtml = '';
            if (opts.totais) {
                resumoHtml = `<tr><td colspan="${colunas.length}" style="background-color:#e2e8f0; font-weight:bold; padding:8px 10px; border:0.5pt solid #94a3b8; font-size:10pt;">${opts.totais}</td></tr>`;
            }

            const excelHTML = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
                    <!--[if gte mso 9]>
                    <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>${(titulo || 'Planilha').substring(0, 30)}</x:Name>
                            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                        </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                    </xml>
                    <![endif]-->
                    <style>
                        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
                        table { border-collapse: collapse; width: 100%; }
                    </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <td colspan="${colunas.length}" style="font-size:15pt; font-weight:bold; color:#0f172a; padding:10px 0;">${emp.nome}</td>
                        </tr>
                        <tr>
                            <td colspan="${colunas.length}" style="font-size:12pt; font-weight:bold; color:#2563eb; padding-bottom:4px;">${titulo}</td>
                        </tr>
                        <tr>
                            <td colspan="${colunas.length}" style="font-size:9pt; color:#64748b; padding-bottom:12px;">Gerado em: ${dataHora} ${subtitulo ? ' • Filtro: ' + subtitulo : ''} • Total de registros: ${dados.length}</td>
                        </tr>
                        <tr></tr>
                        <thead><tr>${thsHtml}</tr></thead>
                        <tbody>${trsHtml}</tbody>
                        ${resumoHtml ? `<tfoot>${resumoHtml}</tfoot>` : ''}
                    </table>
                </body>
                </html>
            `;

            const blob = new Blob(['\uFEFF' + excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${nomeArquivo}_${Date.now()}.xls`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            if (typeof showToast === 'function') showToast('Planilha Excel gerada com sucesso!', 'success');
        } catch(err) {
            console.error('Erro ao exportar Excel:', err);
            if (typeof showToast === 'function') showToast('Erro ao exportar Excel.', 'error');
        }
    };

    // ----------------------------------------------------
    // 2. EXPORTADOR PARA WORD (.DOC)
    // ----------------------------------------------------
    window.exportarParaWord = function(opts) {
        try {
            opts = opts || {};
            const emp = obterDadosEmpresa();
            const titulo = opts.titulo || 'Relatório Gerencial';
            const subtitulo = opts.subtitulo || '';
            const nomeArquivo = (opts.nomeArquivo || 'Relatorio').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const dataHora = formatarDataHoraAtual();

            let colunas = opts.colunas || [];
            let dados = opts.dados || [];

            if ((!colunas.length || !dados.length) && opts.tabelaId) {
                const tabela = document.getElementById(opts.tabelaId);
                if (tabela) {
                    const extraido = extrairDadosDeTabelaDOM(tabela);
                    colunas = extraido.colunas;
                    dados = extraido.dados;
                }
            }

            let tabelaHtml = '';
            if (opts.htmlConteudo) {
                tabelaHtml = `<div style="margin-top:15pt; line-height:1.6;">${opts.htmlConteudo}</div>`;
            } else if (dados.length > 0) {
                let ths = colunas.map(c => 
                    `<th style="background-color:#1e293b; color:#ffffff; font-weight:bold; border:1pt solid #94a3b8; padding:6pt 8pt; text-align:${c.align || 'left'}; font-size:9.5pt;">${c.label}</th>`
                ).join('');

                let trs = dados.map((row, idx) => {
                    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const tds = colunas.map(c => {
                        const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '';
                        const align = c.align || (c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : 'left');
                        return `<td style="border:1pt solid #cbd5e1; padding:5pt 7pt; background-color:${bg}; text-align:${align}; font-size:9pt; vertical-align:middle;">${val}</td>`;
                    }).join('');
                    return `<tr>${tds}</tr>`;
                }).join('');

                let tfoot = '';
                if (opts.totais) {
                    tfoot = `<tfoot><tr><td colspan="${colunas.length}" style="background-color:#e2e8f0; font-weight:bold; padding:7pt 8pt; border:1pt solid #94a3b8; font-size:9.5pt;">${opts.totais}</td></tr></tfoot>`;
                }

                tabelaHtml = `
                    <table style="border-collapse:collapse; width:100%; margin-top:12pt; font-family:Calibri, Arial, sans-serif;">
                        <thead><tr>${ths}</tr></thead>
                        <tbody>${trs}</tbody>
                        ${tfoot}
                    </table>
                `;
            } else {
                if (typeof showToast === 'function') showToast('Nenhum dado encontrado para exportar.', 'warning');
                return;
            }

            const wordHTML = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <title>${titulo}</title>
                    <style>
                        @page { size: A4; margin: 20mm 15mm; }
                        body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.4; }
                        .doc-header { border-bottom: 2pt solid #2563eb; padding-bottom: 8pt; margin-bottom: 12pt; }
                        .company-name { font-size: 16pt; font-weight: bold; color: #0f172a; margin: 0; }
                        .company-sub { font-size: 9pt; color: #64748b; margin: 2pt 0 0 0; }
                        .doc-title { font-size: 15pt; font-weight: bold; color: #1e40af; margin-top: 10pt; margin-bottom: 3pt; }
                        .doc-meta { font-size: 9pt; color: #64748b; margin-bottom: 12pt; }
                        .doc-footer { margin-top: 25pt; border-top: 1pt solid #cbd5e1; padding-top: 8pt; font-size: 8pt; color: #94a3b8; text-align: center; }
                        .kpi-box { background-color: #f1f5f9; border-left: 3pt solid #2563eb; padding: 6pt 10pt; margin: 8pt 0; font-size: 9.5pt; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="doc-header">
                        <table style="border:none; margin:0; width:100%;">
                            <tr style="border:none;">
                                <td style="border:none; padding:0;">
                                    <p class="company-name">${emp.nome}</p>
                                    <p class="company-sub">${emp.cnpj ? 'CNPJ: ' + emp.cnpj + ' • ' : ''}${emp.telefone ? 'Tel: ' + emp.telefone : ''}</p>
                                </td>
                                <td style="border:none; padding:0; text-align:right; vertical-align:top;">
                                    <p style="font-size:9pt; font-weight:bold; color:#2563eb; margin:0;">FC GESTÃO</p>
                                    <p style="font-size:8pt; color:#64748b; margin:0;">${dataHora}</p>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="doc-title">${titulo}</div>
                    <div class="doc-meta">
                        <strong>Emissão:</strong> ${dataHora}
                        ${subtitulo ? ` • <strong>Filtro:</strong> ${subtitulo}` : ''}
                        ${dados.length ? ` • <strong>Total:</strong> ${dados.length} registros` : ''}
                    </div>

                    ${opts.totais ? `<div class="kpi-box">${opts.totais}</div>` : ''}

                    ${tabelaHtml}

                    <div class="doc-footer">
                        Documento gerado eletronicamente pelo Sistema FC Gestão em ${dataHora}. Confidencial e de uso interno.
                    </div>
                </body>
                </html>
            `;

            const blob = new Blob(['\uFEFF' + wordHTML], { type: 'application/msword;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${nomeArquivo}_${Date.now()}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            if (typeof showToast === 'function') showToast('Documento Word gerado com sucesso!', 'success');
        } catch(err) {
            console.error('Erro ao exportar Word:', err);
            if (typeof showToast === 'function') showToast('Erro ao exportar Word.', 'error');
        }
    };

    // ----------------------------------------------------
    // 3. EXPORTADOR PARA PDF / PREVIEW DE IMPRESSÃO PROFISSIONAL
    // ----------------------------------------------------
    window.exportarParaPDF = function(opts) {
        try {
            opts = opts || {};
            const emp = obterDadosEmpresa();
            const titulo = opts.titulo || 'Relatório Gerencial';
            const subtitulo = opts.subtitulo || '';
            const nomeArquivo = (opts.nomeArquivo || 'Relatorio').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const orientacao = opts.orientacao || 'portrait'; // portrait | landscape
            const dataHora = formatarDataHoraAtual();

            let colunas = opts.colunas || [];
            let dados = opts.dados || [];

            if ((!colunas.length || !dados.length) && opts.tabelaId) {
                const tabela = document.getElementById(opts.tabelaId);
                if (tabela) {
                    const extraido = extrairDadosDeTabelaDOM(tabela);
                    colunas = extraido.colunas;
                    dados = extraido.dados;
                }
            }

            let conteudoCorpo = '';
            if (opts.htmlConteudo) {
                conteudoCorpo = `<div class="p-6 bg-white rounded-xl shadow-sm border border-slate-200">${opts.htmlConteudo}</div>`;
            } else if (dados.length > 0) {
                let ths = colunas.map(c => 
                    `<th class="p-2.5 bg-slate-900 text-white font-bold text-[10px] md:text-xs uppercase border border-slate-700 text-${c.align || 'left'}">${c.label}</th>`
                ).join('');

                let trs = dados.map((row, idx) => {
                    const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const tds = colunas.map(c => {
                        const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '';
                        const align = c.align || (c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : 'left');
                        return `<td class="p-2 border border-slate-200 text-${align} text-xs text-slate-800">${val}</td>`;
                    }).join('');
                    return `<tr class="${bg}">${tds}</tr>`;
                }).join('');

                let tfoot = '';
                if (opts.totais) {
                    tfoot = `<tfoot class="bg-slate-100 font-bold border-t-2 border-slate-300"><tr><td colspan="${colunas.length}" class="p-2.5 text-xs text-slate-800">${opts.totais}</td></tr></tfoot>`;
                }

                conteudoCorpo = `
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse border border-slate-300">
                            <thead><tr>${ths}</tr></thead>
                            <tbody>${trs}</tbody>
                            ${tfoot}
                        </table>
                    </div>
                `;
            } else {
                if (typeof showToast === 'function') showToast('Nenhum dado encontrado para gerar PDF.', 'warning');
                return;
            }

            const win = window.open('', '_blank');
            if (!win) {
                if (typeof showToast === 'function') showToast('O navegador bloqueou a abertura do PDF. Permita pop-ups.', 'error');
                return;
            }

            win.document.open();
            win.document.write(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="utf-8">
                    <title>${titulo} - ${emp.nome}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                    <style>
                        @page {
                            margin: 10mm 8mm;
                            size: A4 ${orientacao};
                        }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            background-color: #f8fafc;
                            color: #0f172a;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        @media print {
                            .no-print { display: none !important; }
                            body { background-color: #ffffff !important; padding: 0 !important; }
                            .print-container { max-width: none !important; width: 100% !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
                            table { page-break-inside: auto; }
                            tr { page-break-inside: avoid; page-break-after: auto; }
                            thead { display: table-header-group; }
                            tfoot { display: table-footer-group; }
                        }
                    </style>
                </head>
                <body class="p-4 md:p-8">
                    <!-- BARRA DE AÇÕES FLUTUANTE (NÃO SAI NA IMPRESSÃO) -->
                    <div class="no-print max-w-5xl mx-auto mb-6 bg-slate-900 text-white p-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between border border-slate-700">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-rose-600/30 text-rose-400 border border-rose-500/40 flex items-center justify-center font-bold">
                                <i class="fa-solid fa-file-pdf text-base"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-sm leading-tight">${titulo}</h3>
                                <p class="text-[11px] text-slate-400">${dados.length ? dados.length + ' registros' : 'Relatório formatado'} • Pronto para impressão</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.print()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer">
                                <i class="fa-solid fa-print"></i> Imprimir / Salvar PDF
                            </button>
                            <button onclick="window.close()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer">
                                Fechar
                            </button>
                        </div>
                    </div>

                    <!-- FOLHA DO RELATÓRIO A4 -->
                    <div class="print-container max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                        <!-- CABEÇALHO DA EMPRESA -->
                        <div class="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-4">
                            <div>
                                <h1 class="text-xl md:text-2xl font-black text-slate-900 tracking-tight">${emp.nome}</h1>
                                <p class="text-xs text-slate-500 mt-0.5">
                                    ${emp.cnpj ? 'CNPJ: ' + emp.cnpj + ' • ' : ''}
                                    ${emp.telefone ? 'Contato: ' + emp.telefone + ' • ' : ''}
                                    ${emp.cidade ? emp.cidade + '/' + emp.uf : ''}
                                </p>
                            </div>
                            <div class="text-right">
                                <span class="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">FC Gestão</span>
                                <p class="text-[11px] text-slate-500 mt-1 font-mono">${dataHora}</p>
                            </div>
                        </div>

                        <!-- TÍTULO E METADADOS DO RELATÓRIO -->
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div>
                                <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <i class="fa-solid fa-file-lines text-blue-600"></i> ${titulo}
                                </h2>
                                ${subtitulo ? `<p class="text-xs text-slate-500 mt-0.5">${subtitulo}</p>` : ''}
                            </div>
                            ${dados.length ? `<span class="text-xs font-bold bg-white text-slate-700 px-3 py-1 rounded-lg border border-slate-200 shadow-xs">${dados.length} itens listados</span>` : ''}
                        </div>

                        ${opts.totais ? `<div class="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">${opts.totais}</div>` : ''}

                        <!-- CONTEÚDO DO RELATÓRIO (TABELA OU TEXTO) -->
                        ${conteudoCorpo}

                        <!-- RODAPÉ DA FOLHA -->
                        <div class="mt-8 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                            <span>Documento gerado via FC Gestão Empresarial</span>
                            <span>Página 1 de 1</span>
                        </div>
                    </div>

                    <script>
                        // Auto-print após carregamento dos estilos
                        window.onload = function() {
                            setTimeout(() => {
                                window.focus();
                                window.print();
                            }, 800);
                        };
                    </script>
                </body>
                </html>
            `);
            win.document.close();

        } catch(err) {
            console.error('Erro ao gerar PDF:', err);
            if (typeof showToast === 'function') showToast('Erro ao gerar PDF.', 'error');
        }
    };

    // Helper para extrair dados limpos de qualquer elemento <table> DOM
    function extrairDadosDeTabelaDOM(tabela) {
        const colunas = [];
        const dados = [];
        if (!tabela) return { colunas, dados };

        const ths = tabela.querySelectorAll('thead th');
        const indicesValidos = [];

        ths.forEach((th, idx) => {
            // Ignora colunas de ações, botões, checkbox ou marcadas com .print:hidden/.no-export
            if (th.classList.contains('print:hidden') || th.classList.contains('no-export') || th.innerText.toLowerCase().includes('ação') || th.innerText.toLowerCase().includes('ações') || th.innerText.trim() === '') {
                return;
            }
            const key = 'col_' + idx;
            indicesValidos.push(idx);
            colunas.push({
                key: key,
                label: th.innerText.trim(),
                align: th.classList.contains('text-right') ? 'right' : (th.classList.contains('text-center') ? 'center' : 'left'),
                tipo: th.innerText.toLowerCase().includes('valor') || th.innerText.toLowerCase().includes('preço') || th.innerText.toLowerCase().includes('custo') || th.innerText.toLowerCase().includes('total') ? 'moeda' : 'texto'
            });
        });

        const trs = tabela.querySelectorAll('tbody tr');
        trs.forEach(tr => {
            if (tr.innerText.includes('Nenhum') || tr.innerText.includes('Carregando')) return;
            const tds = tr.querySelectorAll('td');
            if (!tds.length) return;
            const obj = {};
            let preenchido = false;

            indicesValidos.forEach((colIdx, i) => {
                if (tds[colIdx]) {
                    const texto = tds[colIdx].innerText.trim().replace(/\s+/g, ' ');
                    obj[colunas[i].key] = texto;
                    if (texto) preenchido = true;
                }
            });

            if (preenchido) dados.push(obj);
        });

        return { colunas, dados };
    }

    // ----------------------------------------------------
    // 4. DISPATCHER GERAL: window.puxarRelatorio(modulo, formato, opcoes)
    // ----------------------------------------------------
    window.puxarRelatorio = function(modulo, formato, opts) {
        opts = opts || {};
        formato = (formato || 'excel').toLowerCase(); // 'excel' | 'word' | 'pdf'
        modulo = (modulo || '').toLowerCase();

        let configExport = null;

        // 4.1 PRODUTOS E ESTOQUE
        if (modulo === 'produtos') {
            const lista = window.produtosFiltradosAtuais || (window.db && Array.isArray(window.db.produtos) ? window.db.produtos : []);
            let totalCusto = 0;
            let totalVenda = 0;
            let totalPecas = 0;

            const dados = lista.map(p => {
                const qtd = Number(p.estoque) || 0;
                const custo = Number(p.custo) || 0;
                const preco = Number(p.preco) || 0;
                totalPecas += qtd;
                totalCusto += (qtd * custo);
                totalVenda += (qtd * preco);

                const margem = custo > 0 ? (((preco - custo) / custo) * 100).toFixed(1) + '%' : '-';
                let status = 'Ativo';
                if (p.ativo === false) status = 'Inativo';
                else if (qtd <= 0) status = 'Estoque Zerado';
                else if (qtd <= Number(p.min || 0)) status = 'Alerta / Baixo';

                return {
                    codigo: p.codigo || p.ean || p.id || '-',
                    nome: p.nome || 'Sem Nome',
                    categoria: p.categoria || '-',
                    marca: p.marca || '-',
                    custo: formatarMoedaLocal(custo),
                    preco: formatarMoedaLocal(preco),
                    margem: margem,
                    estoque: `${qtd} ${p.unidade || 'UN'}`,
                    status: status
                };
            });

            configExport = {
                titulo: 'Relatório Geral de Produtos & Estoque',
                subtitulo: 'Catálogo de Produtos Cadastrados e Saldo em Almoxarifado',
                nomeArquivo: 'Relatorio_Produtos_Estoque',
                orientacao: 'landscape',
                colunas: [
                    { key: 'codigo', label: 'Cód/EAN', align: 'left', tipo: 'texto' },
                    { key: 'nome', label: 'Nome do Produto', align: 'left', tipo: 'texto' },
                    { key: 'categoria', label: 'Categoria', align: 'left', tipo: 'texto' },
                    { key: 'marca', label: 'Marca', align: 'left', tipo: 'texto' },
                    { key: 'custo', label: 'Custo', align: 'right', tipo: 'moeda' },
                    { key: 'preco', label: 'Preço Venda', align: 'right', tipo: 'moeda' },
                    { key: 'margem', label: 'Margem', align: 'center', tipo: 'texto' },
                    { key: 'estoque', label: 'Estoque', align: 'right', tipo: 'numero' },
                    { key: 'status', label: 'Situação', align: 'center', tipo: 'texto' }
                ],
                dados: dados,
                totais: `Total de Itens: ${dados.length} • Saldo Total de Peças: ${totalPecas} un • Patrimônio em Estoque: Custo: ${formatarMoedaLocal(totalCusto)} | Venda Estimada: ${formatarMoedaLocal(totalVenda)}`
            };
        }

        // 4.2 CLIENTES
        else if (modulo === 'clientes') {
            const lista = window.clientesFiltradosAtuais || (window.db && Array.isArray(window.db.clientes) ? window.db.clientes : []);
            const dados = lista.map(c => {
                const end = [c.rua || c.endereco || '', c.numero ? 'nº ' + c.numero : '', c.bairro || ''].filter(Boolean).join(', ');
                const cidUf = [c.cidade || '', c.uf || ''].filter(Boolean).join(' - ');
                return {
                    nome: c.nome || 'Sem Nome',
                    doc: c.doc || c.cpf || c.cnpj || '-',
                    contato: c.wpp || c.whatsapp || c.telefone || '-',
                    email: c.email || '-',
                    cidade_uf: cidUf || '-',
                    endereco: end || '-',
                    limite: c.limite_credito ? formatarMoedaLocal(c.limite_credito) : '-'
                };
            });

            configExport = {
                titulo: 'Relatório Cadastral de Clientes',
                subtitulo: 'Relação de Clientes, Contatos e Endereços',
                nomeArquivo: 'Relatorio_Clientes',
                orientacao: 'landscape',
                colunas: [
                    { key: 'nome', label: 'Nome / Razão Social', align: 'left', tipo: 'texto' },
                    { key: 'doc', label: 'CPF / CNPJ', align: 'left', tipo: 'texto' },
                    { key: 'contato', label: 'WhatsApp / Telefone', align: 'left', tipo: 'texto' },
                    { key: 'email', label: 'E-mail', align: 'left', tipo: 'texto' },
                    { key: 'cidade_uf', label: 'Cidade / UF', align: 'left', tipo: 'texto' },
                    { key: 'endereco', label: 'Endereço', align: 'left', tipo: 'texto' },
                    { key: 'limite', label: 'Limite de Crédito', align: 'right', tipo: 'moeda' }
                ],
                dados: dados,
                totais: `Total de Clientes Cadastrados: ${dados.length}`
            };
        }

        // 4.3 FUNCIONÁRIOS / COLABORADORES
        else if (modulo === 'funcionarios') {
            const lista = window.funcionariosFiltradosAtuais || (window.db && Array.isArray(window.db.funcionarios) ? window.db.funcionarios : []);
            const dados = lista.map(f => {
                let perm = 'Padrão';
                if (f.isAdmin) perm = 'Acesso Total (Admin)';
                else if (f.perm_vendas_op) perm = 'Operador de Vendas';

                return {
                    nome: f.nome || 'Sem Nome',
                    cargo: f.cargo || 'Colaborador',
                    doc: f.doc || f.cpf || '-',
                    contato: f.wpp || f.telefone || '-',
                    email: f.email || '-',
                    pix: f.chave_pix || f.pix || '-',
                    salario: f.salario_base ? formatarMoedaLocal(f.salario_base) : (f.salario ? formatarMoedaLocal(f.salario) : '-'),
                    permissoes: perm
                };
            });

            configExport = {
                titulo: 'Quadro de Colaboradores & Funcionários',
                subtitulo: 'Lista de Funcionários, Cargos e Informações de Acesso',
                nomeArquivo: 'Relatorio_Funcionarios',
                orientacao: 'landscape',
                colunas: [
                    { key: 'nome', label: 'Nome do Colaborador', align: 'left', tipo: 'texto' },
                    { key: 'cargo', label: 'Cargo / Função', align: 'left', tipo: 'texto' },
                    { key: 'doc', label: 'CPF / Doc', align: 'left', tipo: 'texto' },
                    { key: 'contato', label: 'WhatsApp / Telefone', align: 'left', tipo: 'texto' },
                    { key: 'email', label: 'E-mail de Login', align: 'left', tipo: 'texto' },
                    { key: 'pix', label: 'Chave PIX', align: 'left', tipo: 'texto' },
                    { key: 'salario', label: 'Salário Base', align: 'right', tipo: 'moeda' },
                    { key: 'permissoes', label: 'Nível de Permissão', align: 'center', tipo: 'texto' }
                ],
                dados: dados,
                totais: `Total de Colaboradores: ${dados.length}`
            };
        }

        // 4.4 FORNECEDORES
        else if (modulo === 'fornecedores') {
            const lista = window.fornecedoresFiltradosAtuais || (window.db && Array.isArray(window.db.fornecedores) ? window.db.fornecedores : []);
            const dados = lista.map(f => {
                const cidUf = [f.cidade || '', f.uf || ''].filter(Boolean).join(' - ');
                return {
                    nome: f.nome || f.razao_social || 'Sem Razão Social',
                    fantasia: f.fantasia || f.nome_fantasia || '-',
                    doc: f.doc || f.cnpj || '-',
                    ie: f.ie || '-',
                    contato: f.contato || f.responsavel || '-',
                    telefone: f.wpp || f.telefone || '-',
                    email: f.email || '-',
                    cidade_uf: cidUf || '-'
                };
            });

            configExport = {
                titulo: 'Relatório Geral de Fornecedores',
                subtitulo: 'Catálogo de Parceiros e Fornecedores Homologados',
                nomeArquivo: 'Relatorio_Fornecedores',
                orientacao: 'landscape',
                colunas: [
                    { key: 'nome', label: 'Razão Social', align: 'left', tipo: 'texto' },
                    { key: 'fantasia', label: 'Nome Fantasia', align: 'left', tipo: 'texto' },
                    { key: 'doc', label: 'CNPJ', align: 'left', tipo: 'texto' },
                    { key: 'ie', label: 'Inscr. Estadual', align: 'left', tipo: 'texto' },
                    { key: 'contato', label: 'Pessoa Contato', align: 'left', tipo: 'texto' },
                    { key: 'telefone', label: 'WhatsApp / Telefone', align: 'left', tipo: 'texto' },
                    { key: 'email', label: 'E-mail Comercial', align: 'left', tipo: 'texto' },
                    { key: 'cidade_uf', label: 'Cidade / UF', align: 'left', tipo: 'texto' }
                ],
                dados: dados,
                totais: `Total de Fornecedores Cadastrados: ${dados.length}`
            };
        }

        // 4.5 COMPRAS
        else if (modulo === 'compras') {
            const lista = window.comprasFiltradasAtuais || (window.db && Array.isArray(window.db.compras) ? window.db.compras : []);
            let totalGasto = 0;

            const dados = lista.map(c => {
                const total = Number(c.totalNF) || 0;
                totalGasto += total;

                const dataEntrada = c.data ? (c.data.includes('T') ? c.data.split('T')[0].split('-').reverse().join('/') : c.data) : '-';
                const dataEmissao = c.dataEmissao ? (c.dataEmissao.includes('T') ? c.dataEmissao.split('T')[0].split('-').reverse().join('/') : c.dataEmissao) : '-';
                const tipo = c.numeroNF === 'S/N' || !c.numeroNF ? 'Manual' : 'XML NF-e';

                return {
                    data_entrada: dataEntrada,
                    data_emissao: dataEmissao,
                    fornecedor: c.fornecedor || 'Não Informado',
                    numero_nf: c.numeroNF || 'S/N',
                    tipo: tipo,
                    valor: formatarMoedaLocal(total)
                };
            });

            configExport = {
                titulo: 'Relatório de Compras & Entradas de Mercadoria',
                subtitulo: 'Histórico de Aquisições e Notas Fiscais Recebidas',
                nomeArquivo: 'Relatorio_Compras',
                orientacao: 'portrait',
                colunas: [
                    { key: 'data_entrada', label: 'Data Entrada', align: 'center', tipo: 'texto' },
                    { key: 'data_emissao', label: 'Data Emissão', align: 'center', tipo: 'texto' },
                    { key: 'fornecedor', label: 'Fornecedor', align: 'left', tipo: 'texto' },
                    { key: 'numero_nf', label: 'NF / Ref', align: 'center', tipo: 'texto' },
                    { key: 'tipo', label: 'Origem', align: 'center', tipo: 'texto' },
                    { key: 'valor', label: 'Valor Total', align: 'right', tipo: 'moeda' }
                ],
                dados: dados,
                totais: `Total de Compras: ${dados.length} • Montante Gasto: ${formatarMoedaLocal(totalGasto)}`
            };
        }

        // 4.6 VENDAS
        else if (modulo === 'vendas') {
            const lista = window.vendasFiltradasAtuais || (window.db && Array.isArray(window.db.vendas) ? window.db.vendas : []);
            let totalFaturado = 0;

            const dados = lista.map(v => {
                const total = Number(v.tot !== undefined ? v.tot : (v.total_liquido !== undefined ? v.total_liquido : (v.total || v.valor || 0))) || 0;
                totalFaturado += total;

                let dataFmt = '-';
                if (v.data) {
                    dataFmt = typeof formatData === 'function' ? formatData(v.data).replace(',', '') : v.data.replace('T', ' ').substring(0, 16);
                }

                let itensResumo = '-';
                if (Array.isArray(v.itens) && v.itens.length > 0) {
                    itensResumo = v.itens.map(i => `${i.qtd || 1}x ${i.nome || i.produto || ''}`).join(', ');
                } else if (v.descricao) {
                    itensResumo = v.descricao;
                }

                const pedStr = v.numeroPedido ? '#' + String(v.numeroPedido).padStart(4, '0') : (v.id ? String(v.id).substring(0, 10).toUpperCase() : '-');

                return {
                    data: dataFmt,
                    pedido: pedStr,
                    cliente: v.clienteNome || v.cliente_nome || v.cliente || 'Consumidor Final',
                    pagamento: v.pag || v.forma_pagamento || v.formaPagamento || v.pagamento || 'Diversos',
                    itens: itensResumo,
                    total: formatarMoedaLocal(total)
                };
            });

            configExport = {
                titulo: 'Relatório Gerencial de Vendas e Operações',
                subtitulo: 'Histórico Completo de Pedidos, Clientes e Recebimentos',
                nomeArquivo: 'Relatorio_Vendas_Operacoes',
                orientacao: 'landscape',
                colunas: [
                    { key: 'data', label: 'Data/Hora', align: 'center', tipo: 'texto' },
                    { key: 'pedido', label: 'Pedido / ID', align: 'center', tipo: 'texto' },
                    { key: 'cliente', label: 'Cliente', align: 'left', tipo: 'texto' },
                    { key: 'pagamento', label: 'Forma Pagamento', align: 'left', tipo: 'texto' },
                    { key: 'itens', label: 'Itens da Venda', align: 'left', tipo: 'texto' },
                    { key: 'total', label: 'Valor Líquido', align: 'right', tipo: 'moeda' }
                ],
                dados: dados,
                totais: `Total de Vendas: ${dados.length} • Faturamento Total: ${formatarMoedaLocal(totalFaturado)}`
            };
        }

        // 4.7 MARKETING (LEMBRETES WHATSAPP)
        else if (modulo === 'marketing' || modulo === 'lembretes') {
            const clientesBase = window.todosClientes || (window.db && Array.isArray(window.db.clientes) ? window.db.clientes : []);
            const lista = window.lembretesFiltradosAtuais || clientesBase.filter(c => c.lembrete_wpp === true);

            const dados = lista.map(c => {
                let status = 'Pendente';
                if (typeof formatarDataHoje === 'function' && c.lembrete_last_sent === formatarDataHoje()) {
                    status = 'Enviado Hoje';
                }
                return {
                    cliente: c.nome || 'Sem Nome',
                    whatsapp: c.wpp ? (typeof formatarCelular === 'function' ? formatarCelular(c.wpp) : c.wpp) : 'Sem número',
                    mensagem: c.lembrete_msg || 'Mensagem Padrão',
                    status: status
                };
            });

            configExport = {
                titulo: 'Relatório de Marketing & Lembretes de WhatsApp',
                subtitulo: 'Lista de Clientes com Automação de Lembretes Recorrentes',
                nomeArquivo: 'Relatorio_Marketing_Lembretes',
                orientacao: 'portrait',
                colunas: [
                    { key: 'cliente', label: 'Nome do Cliente', align: 'left', tipo: 'texto' },
                    { key: 'whatsapp', label: 'WhatsApp', align: 'left', tipo: 'texto' },
                    { key: 'mensagem', label: 'Mensagem Configurada', align: 'left', tipo: 'texto' },
                    { key: 'status', label: 'Status Envio', align: 'center', tipo: 'texto' }
                ],
                dados: dados,
                totais: `Total de Lembretes Configurados: ${dados.length}`
            };
        }

        // 4.8 EXPORTAÇÃO DIRETA POR ID DE TABELA DOM
        else if (modulo.startsWith('tabela-') || document.getElementById(modulo)) {
            const tabId = modulo.startsWith('tabela-') ? modulo : modulo;
            configExport = {
                titulo: opts.titulo || 'Relatório Gerencial',
                subtitulo: opts.subtitulo || '',
                nomeArquivo: opts.nomeArquivo || 'Exportacao_Tabela',
                tabelaId: tabId
            };
        }

        // Se não conseguiu montar configuração, tenta fallback pela tabela da página
        if (!configExport) {
            console.warn('Módulo de exportação não identificado:', modulo);
            if (typeof showToast === 'function') showToast('Módulo não identificado para exportação.', 'warning');
            return;
        }

        // Aplica o formato solicitado
        if (formato === 'word' || formato === 'doc') {
            window.exportarParaWord(configExport);
        } else if (formato === 'pdf') {
            window.exportarParaPDF(configExport);
        } else {
            window.exportarParaExcel(configExport);
        }
    };

    // Helper específico para exportar o texto gerado pela IA no Marketing
    window.exportarMarketingIAConsultoria = function(formato) {
        formato = (formato || 'word').toLowerCase();
        const container = document.getElementById('ia-resultado-container');
        if (!container || !container.innerText.trim() || container.innerText.includes('Preencha os dados')) {
            if (typeof showToast === 'function') showToast('Gere primeiro uma consultoria de IA antes de exportar.', 'warning');
            return;
        }

        const nicho = document.getElementById('ia-nicho')?.value || '';
        const objetivo = document.getElementById('ia-objetivo')?.value || '';
        const html = container.innerHTML;

        const config = {
            titulo: 'Consultoria de Marketing Digital - Ideias & Copywriting',
            subtitulo: (nicho ? `Nicho: ${nicho}` : '') + (objetivo ? ` • Objetivo: ${objetivo}` : ''),
            nomeArquivo: 'Marketing_IA_' + (nicho ? nicho.replace(/\s+/g, '_') : 'Consultoria'),
            htmlConteudo: html
        };

        if (formato === 'pdf') {
            window.exportarParaPDF(config);
        } else if (formato === 'excel') {
            window.exportarParaExcel({
                titulo: config.titulo,
                subtitulo: config.subtitulo,
                nomeArquivo: config.nomeArquivo,
                colunas: [{ key: 'conteudo', label: 'Consultoria e Estratégia de Conteúdo' }],
                dados: [{ conteudo: container.innerText }]
            });
        } else {
            window.exportarParaWord(config);
        }
    };

})();


