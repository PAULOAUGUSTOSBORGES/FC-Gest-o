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
// 1. CONFIGURAÃ‡Ã•ES DO FIREBASE E SEGURANÃ‡A
// ==========================================

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
// SincronizaÃ§Ã£o em tempo real entre todas as telas
// PadrÃ£o: escuro (dark).
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
    
    // Se a tela atual possuir cards de configuraÃ§Ã£o de tema (ex: sistema.html), atualiza-os
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

// Ouvinte do evento storage: se o usuÃ¡rio mudar o tema em outra aba, esta aba se atualiza na hora!
window.addEventListener('storage', function (e) {
    if (e.key === 'fc_theme_sistema' && e.newValue) {
        aplicarTemaSistema(e.newValue, false);
    }
});

// Canal Broadcast para sincronizaÃ§Ã£o ultrarrÃ¡pida entre abas abertas
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

// Injeta os botÃµes de tema (no rodapÃ© da sidebar e no topo do header)
document.addEventListener('DOMContentLoaded', function () {
    // 1. BotÃ£o no rodapÃ© da Sidebar
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

    // 2. BotÃ£o no Header (acesso instantÃ¢neo direto no celular e PC sem precisar abrir menu)
    const headerActions = document.querySelector('header .flex.items-center.gap-2, header .flex.items-center.gap-4');
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

    _atualizarBotaoTemaSistema();
});



// As credenciais e inicializaÃ§Ã£o do Firebase agora vÃªm de sistema/config_banco.js
const firestore = firebase.firestore();

// ATIVAR MODO OFFLINE (Apenas em ambiente HTTP/HTTPS com servidor)
if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    firestore.enablePersistence({ synchronizeTabs: true })
        .catch(function(err) {
            if (err.code == 'failed-precondition') {
                console.warn("MÃºltiplas abas abertas. A persistÃªncia offline funcionarÃ¡ apenas na primeira aba.");
            } else if (err.code == 'unimplemented') {
                console.warn("Navegador nÃ£o suporta persistÃªncia offline do Firebase.");
            }
        });
}

const auth = firebase.auth();

// Stub Global do DB (para nÃ£o quebrar as outras telas enquanto sÃ£o migradas)
let db = {
    produtos: [], categorias: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [],
    financeiro: [], compras: [], funcionarios: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] },
    config: { 
        empresa: { nome: 'FC MÃ³veis e Interiores', fantasia: 'FC MÃ³veis' },
        taxas: { 'Dinheiro': 0, 'PIX': 0, 'CartÃ£o DÃ©bito': 1.99, 'Boleto': 0, 'Fiado': 0, 'CartÃ£o CrÃ©dito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } },
        prazos: { 'Fiado': 30, 'Boleto': 30, 'CartÃ£o CrÃ©dito': 1, 'CartÃ£o DÃ©bito': 1 }
    }
};

// ==========================================
// PRÃ‰-CARGA DO CACHE: popula o db com dados do
// sessionStorage antes do Firebase responder.
// Isso faz as telas carregarem instantaneamente.
// ==========================================
(function _preCarregarCacheGlobal() {
    // Aguarda o FCCache estar disponÃ­vel (carregado via <script>)
    // Se ainda nÃ£o estiver, agenda para quando o DOM estiver pronto
    function tentarPreCarregar() {
        if (typeof window.FCCache === 'undefined') return;
        const colecoesPrincipais = ['produtos', 'clientes', 'fornecedores', 'funcionarios', 'vendas', 'financeiro', 'compras', 'categorias', 'movimentacoes'];
        colecoesPrincipais.forEach(function(col) {
            if (window.FCCache.isValido(col)) {
                const dados = window.FCCache.get(col);
                if (dados !== null) db[col] = dados;
            }
        });
        // Carrega config do cache
        if (window.FCCache.isValido('fc_moveis_config')) {
            const configCache = window.FCCache.get('fc_moveis_config');
            if (configCache) db.config = configCache;
        }
        // Carrega caixa do cache
        if (window.FCCache.isValido('fc_moveis_caixa')) {
            const caixaCache = window.FCCache.get('fc_moveis_caixa');
            if (caixaCache) db.caixa = caixaCache;
        }
    }
    // Tenta prÃ©-carregar imediatamente e tambÃ©m ao carregar o DOM
    tentarPreCarregar();
    document.addEventListener('DOMContentLoaded', tentarPreCarregar);
})();
window.currentUserInfo = null;

// ==========================================
// Monitoramento de ConexÃ£o (Online/Offline)
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
    showToast('VocÃª estÃ¡ offline! Modo de trabalho local ativado.', 'warning');
    document.body.classList.add('is-offline');
    atualizarBadgeConexao(false);
});

window.addEventListener('online', () => {
    showToast('ConexÃ£o restabelecida! Sincronizando dados...', 'success');
    document.body.classList.remove('is-offline');
    atualizarBadgeConexao(true);
});

// ForÃ§a checagem na inicializaÃ§Ã£o
if (!navigator.onLine) {
    setTimeout(() => { atualizarBadgeConexao(false); }, 1000);
}

const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ==========================================
// FUNÃ‡Ã•ES DE MÃSCARA DE DINHEIRO
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

// Interceptar atribuiÃ§Ãµes de '.value' em inputs de dinheiro para auto-formatar floats
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
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
};

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
// INICIALIZAÃ‡ÃƒO E CONTROLE DE SESSÃƒO
// ==========================================
function initGlobalData(funcaoDeRenderizacaoDaPagina) {
    auth.onAuthStateChanged(async (user) => {
        const isLoginPage = window.location.pathname.toLowerCase().includes('login.html') || window.location.href.toLowerCase().includes('login.html');

        if (!user) {
            if (!isLoginPage) window.location.href = 'login.html';
        } else {
            const hoje = new Date().toDateString();
            const sessaoData = localStorage.getItem('fc_sessao_data');
            const sessaoUid = localStorage.getItem('fc_sessao_uid');

            if (isLoginPage) {
                // Se estiver na tela de login:
                if (window._fazendoLogin || (sessaoData === hoje && sessaoUid === user.uid)) {
                    // SessÃ£o vÃ¡lida de hoje ou acabou de clicar em entrar: valida e vai para o index
                    localStorage.setItem('fc_sessao_data', hoje);
                    localStorage.setItem('fc_sessao_uid', user.uid);
                    window.location.href = 'index.html';
                    return;
                } else {
                    // SessÃ£o antiga do dia anterior ao abrir a tela de login: desloga para forÃ§ar digitar a senha
                    try { await auth.signOut(); } catch (e) { console.error("Erro interno:", e); }
                    localStorage.removeItem('fc_sessao_data');
                    localStorage.removeItem('fc_sessao_uid');
                    return;
                }
            }

            // Se NÃƒO for a tela de login, valida se a sessÃ£o Ã© do dia de hoje
            if (!sessaoData || sessaoData !== hoje || sessaoUid !== user.uid) {
                console.warn("SessÃ£o diÃ¡ria expirada ou inexistente para hoje. Solicitando novo login...");
                localStorage.removeItem('fc_sessao_data');
                localStorage.removeItem('fc_sessao_uid');
                sessionStorage.setItem('fc_sessao_expirada_msg', 'Sua sessÃ£o diÃ¡ria expirou. Por favor, faÃ§a login novamente.');
                try { await auth.signOut(); } catch (e) { console.error("Erro interno:", e); }
                window.location.href = 'login.html';
                return;
            }

            // Inicia monitor para expirar caso o dia vire com a aba aberta
            iniciarMonitorSessaoDiaria();

            // PrÃ©-carrega Config e PermissÃµes do cache para inicializaÃ§Ã£o instantÃ¢nea
            const configCache = (typeof window.FCCache !== 'undefined') && window.FCCache.get('fc_moveis_config');
            if (configCache) db.config = configCache;

            const userCacheKey = 'funcionario_' + user.uid;
            const userCache = (typeof window.FCCache !== 'undefined') && window.FCCache.get(userCacheKey);
            if (userCache) window.currentUserInfo = userCache;

            let renderizouImediato = false;
            if (window.currentUserInfo) {
                aplicarControleDeAcesso();
                mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'UsuÃ¡rio'}`);
                aplicarIdentidadeVisualGlobal();
                if (funcaoDeRenderizacaoDaPagina) {
                    try {
                        funcaoDeRenderizacaoDaPagina();
                        renderizouImediato = true;
                    } catch(e) {
                        console.error("Erro ao renderizar com cache:", e);
                    }
                }
            }

            // SincronizaÃ§Ã£o paralela com Firebase (em background se jÃ¡ renderizou do cache)
            const sincronizarFirebase = async () => {
                try {
                    const [confSnap, userSnap] = await Promise.all([
                        firestore.collection("fc_moveis").doc("config").get().catch(e => { console.error("Erro ao carregar config:", e); return null; }),
                        firestore.collection("funcionarios").doc(user.uid).get().catch(e => { console.error("Erro de permissÃµes:", e); return null; })
                    ]);

                    if (confSnap && confSnap.exists) {
                        const dados = confSnap.data();
                        db.config = {
                            ...db.config,
                            ...dados,
                            empresa: { ...(db.config?.empresa || {}), ...(dados.empresa || {}) },
                            taxas: dados.taxas || db.config?.taxas,
                            prazos: dados.prazos || db.config?.prazos,
                            loja: { ...(db.config?.loja || {}), ...(dados.loja || {}) }
                        };
                        if (typeof window.FCCache !== 'undefined') window.FCCache.set('fc_moveis_config', db.config);
                    } else if (confSnap && !confSnap.exists) {
                        await firestore.collection("fc_moveis").doc("config").set(db.config).catch(() => {});
                    }

                    if (userSnap && userSnap.exists) {
                        window.currentUserInfo = userSnap.data();
                        
                        // CORREÃ‡ÃƒO: Garante admin para o email correto
                        if (user.email === 'fabricadecoresgoiania@gmail.com' && !window.currentUserInfo.isAdmin) {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
                            window.currentUserInfo.perm_gestao = true;
                            window.currentUserInfo.perm_config = true;
                            
                            firestore.collection("funcionarios").doc(user.uid).update({
                                isAdmin: true,
                                perm_dashboard: true,
                                perm_pdv: true,
                                perm_cadastros: true,
                                perm_gestao: true,
                                perm_config: true
                            }).catch(e => console.error("Erro ao atualizar admin", e));
                        }
                        
                        if (typeof window.FCCache !== 'undefined') window.FCCache.set(userCacheKey, window.currentUserInfo);
                        aplicarControleDeAcesso();
                        mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'UsuÃ¡rio'}`);
                    } else if (userSnap && !userSnap.exists) {
                        // UsuÃ¡rio nÃ£o cadastrado na base de funcionÃ¡rios
                        window.currentUserInfo = { isAdmin: false, perm_dashboard: false, perm_pdv: false, perm_cadastros: false, perm_gestao: false, perm_config: false };
                        
                        // CORREÃ‡ÃƒO: Garante admin na criaÃ§Ã£o do cadastro
                        if (user.email === 'fabricadecoresgoiania@gmail.com') {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
                            window.currentUserInfo.perm_gestao = true;
                            window.currentUserInfo.perm_config = true;
                        }

                        try {
                            await firestore.collection('funcionarios').doc(user.uid).set({
                                nome: window.currentUserInfo.isAdmin ? "Administrador" : "NOVO CADASTRO", 
                                email: user.email || '', 
                                isAdmin: window.currentUserInfo.isAdmin,
                                perm_dashboard: window.currentUserInfo.perm_dashboard, 
                                perm_pdv: window.currentUserInfo.perm_pdv, 
                                perm_cadastros: window.currentUserInfo.perm_cadastros,
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

                    // Se nÃ£o pÃ´de renderizar de imediato por falta de cache, renderiza agora
                    if (!renderizouImediato && funcaoDeRenderizacaoDaPagina) {
                        funcaoDeRenderizacaoDaPagina();
                    } else if (renderizouImediato && typeof window.carregarConfiguracoesNaTela === 'function') {
                        // Se a tela atual for a de configuraÃ§Ãµes, atualiza os campos com os dados frescos do Firestore
                        window.carregarConfiguracoesNaTela();
                    }
                } catch (err) {
                    console.error("Erro na sincronizaÃ§Ã£o Firebase:", err);
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
        }
    });
}

// Monitor para encerrar a sessÃ£o caso a meia-noite seja cruzada com a aba aberta
function iniciarMonitorSessaoDiaria() {
    if (window._monitorSessaoIniciado) return;
    window._monitorSessaoIniciado = true;

    const checarViradaDoDia = async () => {
        const isLoginPage = window.location.pathname.includes('login.html');
        if (isLoginPage) return;

        const user = auth.currentUser;
        if (!user) return;

        const hoje = new Date().toDateString();
        const sessaoData = localStorage.getItem('fc_sessao_data');

        if (sessaoData && sessaoData !== hoje) {
            console.warn("Virada do dia detectada. Encerrando sessÃ£o diÃ¡ria...");
            localStorage.removeItem('fc_sessao_data');
            localStorage.removeItem('fc_sessao_uid');
            sessionStorage.setItem('fc_sessao_expirada_msg', 'O dia virou e sua sessÃ£o diÃ¡ria expirou. Por favor, faÃ§a login novamente.');
            try { await auth.signOut(); } catch (e) { console.error("Erro interno:", e); }
            window.location.href = 'login.html';
        }
    };

    setInterval(checarViradaDoDia, 30000);
    window.addEventListener('focus', checarViradaDoDia);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checarViradaDoDia();
    });
}

function aplicarControleDeAcesso() {
    if (!window.currentUserInfo) return;
    const p = window.currentUserInfo;
    const path = window.location.pathname;
    
    // Se for admin, nÃ£o bloqueia nada
    if (p.isAdmin) return;

    // 1. Bloqueio de Acesso com Alerta Visual
    let bloqueado = false;
    let mensagemBloqueio = '';

    const isIndex = path.includes('index.html') || path.endsWith('/') || path === '';
    
    if (isIndex && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (VisÃ£o Geral).';
    } else if ((path.includes('cadastro.html') || path.includes('produtos.html') || path.includes('clientes.html') || path.includes('fornecedores.html')) && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if (path.includes('funcionarios.html')) {
        // A aba de funcionÃ¡rios Ã© bloqueada para todos que nÃ£o sÃ£o Admin Master
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar FuncionÃ¡rios.';
    } else if ((path.includes('vendas_gestao.html') || path.includes('financeiro.html') || path.includes('relatorios.html') || path.includes('compras.html')) && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado Ã  GestÃ£o Financeira.';
    } else if ((path.includes('operacao.html') || path.includes('pdv.html') || path.includes('vendas_operacao.html') || path.includes('orcamentos.html') || path.includes('caixa.html')) && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (path.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado Ã s ConfiguraÃ§Ãµes do Sistema.';
    }

    if (bloqueado) {
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center p-6 animate-[pop_0.3s_ease-out]">
                    <div class="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
                        <i class="fa-solid fa-lock text-5xl"></i>
                    </div>
                    <h2 class="text-3xl font-black text-slate-800 dark:text-white mb-2">Acesso Restrito</h2>
                    <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto">${mensagemBloqueio}</p>
                    <button onclick="window.history.back()" class="mt-8 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md">
                          <i class="fa-solid fa-arrow-left mr-2"></i> Voltar
                      </button>
                      <button onclick="firebase.auth().signOut().then(() => window.location.href='login.html')" class="mt-8 ml-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md">
                          <i class="fa-solid fa-right-from-bracket mr-2"></i> Sair / Trocar Conta
                      </button>
                </div>
            `;
        }
        showToast(mensagemBloqueio, 'error');
        // Impede que os botÃµes do dashboard funcionem se ele for clicado (ex: index.html)
        document.querySelectorAll('.view-section').forEach(el => el.remove());
    }

    // 2. Se for admin master, mostra aba de funcionÃ¡rios. SenÃ£o, esconde SÃ“ a aba de funcionÃ¡rios do menu lateral
    if (!p.isAdmin) {
        document.querySelectorAll('a[href*="view=funcionarios"], [data-target="funcionarios"]').forEach(el => el.classList.add('hidden'));
    }
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

// Intercepta cliques nos links para nÃ£o deixar a tela piscar (navegar) se nÃ£o tiver permissÃ£o
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    
    // Ignora links externos ou vazios
    if (link.hostname !== window.location.hostname) return;
    
    const p = window.currentUserInfo;
    if (!p || p.isAdmin) return; // Se for admin, passa direto
    
    let bloqueado = false;
    let mensagemBloqueio = '';
    
    // Checa as regras do link de destino
    if (link.href.includes('cadastro.html') && link.href.includes('view=funcionarios')) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar FuncionÃ¡rios.';
    } else if (link.href.includes('cadastro.html') && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if ((link.href.includes('vendas_gestao.html') || link.href.includes('financeiro.html') || link.href.includes('relatorios.html') || link.href.includes('compras.html')) && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado Ã  GestÃ£o Financeira.';
    } else if (link.href.includes('operacao.html') && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (link.href.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado Ã s ConfiguraÃ§Ãµes do Sistema.';
    } else if ((link.href.endsWith('index.html') || link.pathname === '/') && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (VisÃ£o Geral).';
    }
    
    if (bloqueado) {
        e.preventDefault(); // Impede o navegador de ir pra pÃ¡gina!
        showToast(mensagemBloqueio, 'error');
    }
});

async function salvarKardex(ref, prodId, prodNome, qtd, tipo) {
    try {
        await firestore.collection('movimentacoes').add({
            data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo
        });
    } catch (e) {
        console.error("Erro ao salvar Kardex", e);
    }
}

function saveDB() {
    console.warn("saveDB obsoleto: Use salvamento direto nas coleÃ§Ãµes do Firestore");
}

async function fazerLogout() {
    localStorage.removeItem('fc_sessao_data');
    localStorage.removeItem('fc_sessao_uid');
    // Limpa todo o cache ao fazer logout para garantir que outro usuÃ¡rio
    // nÃ£o veja dados em cache do usuÃ¡rio anterior
    if (typeof window.FCCache !== 'undefined') {
        window.FCCache.invalidarTudo();
    }
    try {
        await auth.signOut();
    } catch(e) {
        console.error("Erro no signOut:", e);
    }
    window.location.href = 'login.html';
}

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
// MÃ“DULO: MOTOR DE TEMA E IDENTIDADE DA EMPRESA
// ==========================================
function aplicarIdentidadeVisualGlobal() {
    if (!db) return;

    const elNome = document.getElementById('menu-empresa-nome');
    const elLogo = document.getElementById('menu-logo');
    const elPlaceholder = document.getElementById('menu-logo-placeholder');

    const emp = (db.config && db.config.empresa) ? db.config.empresa : {};
    const nomeEmpresa = emp.fantasia || emp.nome || 'FC MÃ³veis';

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

    // Aplica o tema salvo pelo usuÃ¡rio (Light ou Dark)
    aplicarTema();
}

function aplicarTema() {
    const tema = localStorage.getItem('fc_theme_sistema') || (window.db && window.db.config && window.db.config.tema) || 'dark';
    aplicarTemaSistema(tema, false);
}



// ===== FUNÃ‡Ã•ES GLOBAIS DE IA, CONFIRMAÃ‡ÃƒO E VENDAS =====

window.chamarGemini = async function(prompt) {
    try {
        let apiKey = '';
        try {
            const docSnap = await firebase.firestore().collection('fc_moveis').doc('config').get();
            if (docSnap.exists) {
                const config = docSnap.data();
                apiKey = (config.empresa && config.empresa.geminiKey) || config.geminiApiKey || '';
            }
        } catch (e) {
            console.warn("Aviso: NÃ£o foi possÃ­vel obter a chave do Firestore.", e);
        }

        if (!apiKey) {
            throw new Error("Chave API do Gemini nÃ£o configurada.");
        }

        const modelosParaTentar = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
        let lastErrorText = "";
        
        for (const modelo of modelosParaTentar) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
                }
            } catch (e) {
                // Tenta o prÃ³ximo
            }
        }
        return null;
    } catch (e) {
        console.error("Erro ao chamar IA Gemini:", e);
        return null; // Retorna nulo para que quem chamou possa tratar (mostrar erro na tela)
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
    if(!v) return showToast('Venda nÃ£o encontrada.', 'error');
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÃ“VEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">OperaÃ§Ã£o: REIMPRESSÃƒO</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data Original: ${new Date(v.data).toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${v.clienteNome || '-'}</p><p style="margin: 2px 0;">Vendedor: ${v.vendedor || '-'}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${(v.itens || []).map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${typeof formatMoney === 'function' ? formatMoney(i.preco*i.qtd) : (i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total Final: ${typeof formatMoney === 'function' ? formatMoney(v.tot || v.valorLiquido) : (v.tot || v.valorLiquido)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${v.pag || 'Diversos'}</p></div>`;
    
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
    if(!v) return showToast('Venda nÃ£o encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÃ‡AMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja excluir este orÃ§amento?' 
        : 'AtenÃ§Ã£o! Isso farÃ¡ a exclusÃ£o completa desta venda (devolvendo estoque e apagando as parcelas do financeiro). Deseja continuar?';

    window.abrirConfirmacao('Excluir OperaÃ§Ã£o', msg, async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (window.db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            const pRef = firestore.collection('produtos').doc(String(p.id));
                            batch.update(pRef, { estoque: firebase.firestore.FieldValue.increment(Number(item.qtd || 1)) });
                            
                            const kardexRef = firestore.collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: 'Estorno (ExclusÃ£o) ' + (v.tipo || 'Venda') + ' #' + numPedStr,
                                prodId: p.id,
                                prodNome: p.nome,
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        } 
                    }); 
                }
                
                const finQuery = await firestore.collection('financeiro').where('origemVendaId', '==', String(id)).get();
                finQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                // CÃ¡lculo preciso do montante efetivamente pago em dinheiro
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
                        desc: 'Estorno (ExclusÃ£o) ' + (v.tipo || 'Venda') + ' #' + numPedStr, 
                        valor: valorDinheiroEfetivo 
                    });
                    
                    const caixaRef = firestore.collection('fc_moveis').doc('caixa');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }

            const vendaRef = firestore.collection('vendas').doc(String(id));
            batch.delete(vendaRef);

            await batch.commit();
            window.fecharModalConfirmacao();
            showToast('OperaÃ§Ã£o excluÃ­da com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            window.fecharModalConfirmacao();
            showToast('Erro ao excluir a operaÃ§Ã£o.', 'error');
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
                    if(!res.ok) throw new Error('CNPJ invÃ¡lido ou API indisponÃ­vel.');
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
        showToast('Digite um CNPJ vÃ¡lido com 14 dÃ­gitos.', 'error');
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
// SUPORTE A PWA & INSTALAÃ‡ÃƒO DE APLICATIVO
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
    console.log('ðŸ“² PWA: Evento de instalaÃ§Ã£o pronto.');
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
    
    // Se jÃ¡ estiver rodando instalado como App, nÃ£o precisa mostrar
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    // Procura o container do botÃ£o de Sair no menu lateral
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
            console.log('UsuÃ¡rio aceitou instalar o PWA');
            deferredPwaPrompt = null;
            const btn = document.getElementById('btn-instalar-pwa');
            if (btn) btn.remove();
        }
    } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            alert('ðŸ“² Como instalar no iPhone / iPad:\n\n1. Toque no botÃ£o "Compartilhar" (Ã­cone com quadrado e seta para cima na barra do Safari).\n2. Role para baixo e toque em "Adicionar Ã  Tela de InÃ­cio".\n3. Toque em "Adicionar" no topo direito.');
        } else {
            alert('ðŸ“² Como instalar no Computador ou Android:\n\n1. No Google Chrome ou Microsoft Edge, clique no Ã­cone "Instalar Aplicativo" na barra de endereÃ§os (ao lado da estrela de favoritos).\n2. Ou clique nos 3 pontinhos do navegador e escolha "Instalar FC GestÃ£o".');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mostrarBotaoInstalarApp, 1000);
});

// ==========================================
// TABELAS RESPONSIVAS MOBILE (data-label)
// Injeta atributo data-label em cada <td> com base
// no cabeÃ§alho correspondente da coluna, para que
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

// Observa mutaÃ§Ãµes no DOM para aplicar labels automaticamente
// quando as tabelas sÃ£o preenchidas via JS assÃ­ncrono
(function() {
    const observer = new MutationObserver(() => {
        if (window.innerWidth <= 640) {
            initResponsiveTables();
        }
    });
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        if (window.innerWidth <= 640) initResponsiveTables();
    });
})();


// ==========================================
// CONFIGURAÇÃO DE LOGOUT AUTOMÁTICO (Inatividade)
// ==========================================
(function() {
    let TEMPO_INATIVIDADE = 30 * 60 * 1000; // 30 minutos
    let timeoutInatividade;

    function resetarTimer() {
        clearTimeout(timeoutInatividade);
        timeoutInatividade = setTimeout(() => {
            if (sessionStorage.getItem('erp_auth_master')) {
                console.log('Deslogando por inatividade...');
                if (typeof showToast === 'function') {
                    showToast('Sessão encerrada por inatividade.', 'warning');
                }
                if (typeof fazerLogout === 'function') {
                    fazerLogout();
                }
            }
        }, TEMPO_INATIVIDADE);
    }

    window.addEventListener('load', () => {
        if (!window.location.pathname.includes('login.html')) {
            document.addEventListener('mousemove', resetarTimer, { passive: true });
            document.addEventListener('keypress', resetarTimer, { passive: true });
            document.addEventListener('click', resetarTimer, { passive: true });
            document.addEventListener('scroll', resetarTimer, { passive: true });
            document.addEventListener('touchstart', resetarTimer, { passive: true });
            resetarTimer();
        }
    });
})();


