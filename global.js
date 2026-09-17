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
let db = {
    produtos: [], categorias: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [],
    financeiro: [], compras: [], funcionarios: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] },
    config: { 
        empresa: { nome: 'FC Móveis e Interiores', fantasia: 'FC Móveis' },
        taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } },
        prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 }
    }
};

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

        // 3. Verificação de Bloqueio por Inadimplência
        if (empId && user.email !== 'fabricadecoresgoiania@gmail.com') {
            try {
                const empDoc = await firestore.collection('empresas').doc(empId).get();
                if (empDoc.exists && empDoc.data().status === 'BLOQUEADO') {
                    sessionStorage.clear();
                    localStorage.removeItem('fc_empresa_ativa');
                    alert('O acesso da sua empresa está suspenso temporariamente por pendência financeira. Entre em contato com o suporte.');
                    await auth.signOut();
                    window.location.href = 'login.html';
                    return;
                }
            } catch (errBloq) {
                console.warn("Aviso ao checar bloqueio de empresa:", errBloq);
            }
        }

        // Inicia monitor para detectar quando der meia-noite
        iniciarMonitorSessaoDiaria();

            // Pré-carrega Config e Permissões do cache para inicialização instantânea
            const configCache = (typeof window.FCCache !== 'undefined') && window.FCCache.get('fc_moveis_config');
            if (configCache) db.config = configCache;

            const userCacheKey = 'funcionario_' + user.uid;
            const userCache = (typeof window.FCCache !== 'undefined') && window.FCCache.get(userCacheKey);
            if (userCache) window.currentUserInfo = userCache;

            let renderizouImediato = false;
            if (window.currentUserInfo) {
                aplicarControleDeAcesso();
                mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);
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

            // Sincronização paralela com Firebase (em background se já renderizou do cache)
            const sincronizarFirebase = async () => {
                try {
                    const [confSnap, userSnap] = await Promise.all([
                        window.getEmpresaRef().collection('configuracoes').doc('config').get().catch(e => { console.error("Erro ao carregar config:", e); return null; }),
                        window.getEmpresaRef().collection("funcionarios").doc(user.uid).get().catch(e => { console.error("Erro de permissões:", e); return null; })
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
                        await window.getEmpresaRef().collection('configuracoes').doc('config').set(db.config).catch(() => {});
                    }

                    if (userSnap && userSnap.exists) {
                        window.currentUserInfo = userSnap.data();
                        
                        // CORRE??O: Garante admin para o email correto
                        if (user.email === 'fabricadecoresgoiania@gmail.com' && !window.currentUserInfo.isAdmin) {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
                            window.currentUserInfo.perm_gestao = true;
                            window.currentUserInfo.perm_config = true;
                            
                            window.getEmpresaRef().collection("funcionarios").doc(user.uid).update({
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
                        mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);
                    } else if (userSnap && !userSnap.exists) {
                        // Usuário não cadastrado na base de funcionários
                        window.currentUserInfo = { isAdmin: false, perm_dashboard: false, perm_pdv: false, perm_cadastros: false, perm_gestao: false, perm_config: false };
                        
                        // CORRE??O: Garante admin na criação do cadastro
                        if (user.email === 'fabricadecoresgoiania@gmail.com') {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
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

                    // Se não pôde renderizar de imediato por falta de cache, renderiza agora
                    if (!renderizouImediato && funcaoDeRenderizacaoDaPagina) {
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

function aplicarControleDeAcesso() {
    if (!window.currentUserInfo) return;
    const p = window.currentUserInfo;
    const path = window.location.pathname;
    
    // Se for admin, não bloqueia nada
    if (p.isAdmin) return;

    // 1. Bloqueio de Acesso com Alerta Visual
    let bloqueado = false;
    let mensagemBloqueio = '';

    const isIndex = path.includes('index.html') || path.endsWith('/') || path === '';
    
    if (isIndex && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (Visão Geral).';
    } else if ((path.includes('cadastro.html') || path.includes('produtos.html') || path.includes('clientes.html') || path.includes('fornecedores.html')) && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if (path.includes('funcionarios.html')) {
        // A aba de funcionários é bloqueada para todos que não são Admin Master
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar Funcionários.';
    } else if ((path.includes('vendas_gestao.html') || path.includes('financeiro.html') || path.includes('relatorios.html') || path.includes('compras.html')) && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado à Gestão Financeira.';
    } else if ((path.includes('operacao.html') || path.includes('pdv.html') || path.includes('vendas_operacao.html') || path.includes('orcamentos.html') || path.includes('caixa.html')) && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (path.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado às Configurações do Sistema.';
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
        // Impede que os botões do dashboard funcionem se ele for clicado (ex: index.html)
        document.querySelectorAll('.view-section').forEach(el => el.remove());
    }

    // 2. Se for admin master, mostra aba de funcionários. Senão, esconde S? a aba de funcionários do menu lateral
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

// Intercepta cliques nos links para não deixar a tela piscar (navegar) se não tiver permissão
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
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar Funcionários.';
    } else if (link.href.includes('cadastro.html') && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if ((link.href.includes('vendas_gestao.html') || link.href.includes('financeiro.html') || link.href.includes('relatorios.html') || link.href.includes('compras.html')) && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado à Gestão Financeira.';
    } else if (link.href.includes('operacao.html') && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (link.href.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado às Configurações do Sistema.';
    } else if ((link.href.endsWith('index.html') || link.pathname === '/') && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (Visão Geral).';
    }
    
    if (bloqueado) {
        e.preventDefault(); // Impede o navegador de ir pra página!
        showToast(mensagemBloqueio, 'error');
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
        window.FCCache.invalidarTudo();
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
    const empId = localStorage.getItem('fc_empresa_ativa') || 'emp_fc_moveis';
    const baseUrl = window.location.href.split('/sistema/')[0] + '/site/index.html';
    return `${baseUrl}?loja=${encodeURIComponent(empId)}`;
};

window.copiarLinkLojaVirtual = function() {
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
        let apiKey = '';
        try {
            const docSnap = await firebase.firestore().collection('fc_moveis').doc('config').get();
            if (docSnap.exists) {
                const config = docSnap.data();
                apiKey = (config.empresa && config.empresa.geminiKey) || config.geminiApiKey || '';
            }
        } catch (e) {
            console.warn("Aviso: Não foi possível obter a chave do Firestore.", e);
        }

        if (!apiKey) {
            throw new Error("Chave API do Gemini não configurada.");
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
                // Tenta o próximo
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

            await batch.commit();
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

