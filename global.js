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
// 1. CONFIGURAÇÕES DO FIREBASE E SEGURANÇA
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

// Motor de Tema Instantâneo (Sempre escuro)
(function () {
    document.documentElement.classList.add('dark');
})();

// As credenciais e inicialização do Firebase agora vêm de sistema/config_banco.js
const firestore = firebase.firestore();

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
        taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } },
        prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 }
    }
};
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
// FUNÇÕES DE MÁSCARA DE DINHEIRO
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
// INICIALIZAÇÃO E CONTROLE DE SESSÃO
// ==========================================
function initGlobalData(funcaoDeRenderizacaoDaPagina) {
    auth.onAuthStateChanged(async (user) => {
        const isLoginPage = window.location.pathname.includes('login.html');

        if (!user) {
            if (!isLoginPage) window.location.href = 'login.html';
        } else {
            const hoje = new Date().toLocaleDateString('pt-BR');
            const sessaoData = localStorage.getItem('fc_sessao_data');
            const sessaoUid = localStorage.getItem('fc_sessao_uid');

            if (isLoginPage) {
                // Se estiver na tela de login mas a sessão diária já for válida hoje, vai para o index
                if (sessaoData === hoje && sessaoUid === user.uid) {
                    window.location.href = 'index.html';
                    return;
                } else {
                    // Sessão expirada/antiga: desloga para exigir que digite a senha
                    try { await auth.signOut(); } catch(e) {}
                    localStorage.removeItem('fc_sessao_data');
                    localStorage.removeItem('fc_sessao_uid');
                    return;
                }
            }

            // Se NÃO for a tela de login, valida se a sessão é do dia de hoje
            if (!sessaoData || sessaoData !== hoje || sessaoUid !== user.uid) {
                console.warn("Sessão diária expirada ou inexistente para hoje. Solicitando novo login...");
                localStorage.removeItem('fc_sessao_data');
                localStorage.removeItem('fc_sessao_uid');
                sessionStorage.setItem('fc_sessao_expirada_msg', 'Sua sessão diária expirou. Por favor, faça login novamente.');
                try { await auth.signOut(); } catch(e) {}
                window.location.href = 'login.html';
                return;
            }

            // Inicia monitor para expirar caso o dia vire com a aba aberta
            iniciarMonitorSessaoDiaria();

            try {
                const confSnap = await firestore.collection("fc_moveis").doc("config").get();
                if (confSnap.exists) {
                    db.config = confSnap.data();
                } else {
                    await firestore.collection("fc_moveis").doc("config").set(db.config);
                }
            } catch (error) {
                console.error("Erro ao carregar config:", error);
                showToast("Aviso: Erro ao carregar configurações. Usando padrão. (" + error.code + ")", "error");
            }

            // RBAC - CONTROLE DE ACESSO
            try {
                const userSnap = await firestore.collection("funcionarios").doc(user.uid).get();
                if (userSnap.exists) {
                    window.currentUserInfo = userSnap.data();
                } else {
                    // Usuário não está na tabela (nova conta criada)
                    console.warn("Usuário não cadastrado na base de funcionários.");
                    window.currentUserInfo = { isAdmin: false, perm_dashboard: false, perm_pdv: false, perm_cadastros: false, perm_gestao: false, perm_config: false };
                    
                    try {
                        await firestore.collection('funcionarios').doc(user.uid).set({
                            nome: "NOVO CADASTRO", email: user.email || '', isAdmin: false,
                            perm_dashboard: false, perm_pdv: false, perm_cadastros: false,
                            perm_gestao: false, perm_config: false, dataCadastro: new Date().toISOString(), status: 'PENDENTE'
                        });
                    } catch(e) { console.error("Erro ao registrar no banco:", e); }
                    
                    const avisoAprovacao = document.createElement('div');
                    avisoAprovacao.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:#eab308; color:black; padding:15px 30px; font-size:16px; font-weight:bold; border-radius:10px; text-align:center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);";
                    avisoAprovacao.innerHTML = "<i class='fa-solid fa-clock'></i> Conta Registrada!<br><span style='font-size:13px; font-weight:normal;'>Aguarde o Administrador liberar suas permiss&otilde;es de acesso.</span>";
                    document.body.appendChild(avisoAprovacao);
                }
                aplicarControleDeAcesso();
                mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);

            } catch (err) {
                console.error("Erro de permissões:", err);
            }

            // SEMPRE aplica o tema e inicializa a página
            aplicarIdentidadeVisualGlobal();

            if (funcaoDeRenderizacaoDaPagina) {
                funcaoDeRenderizacaoDaPagina();
            }
        }
    });
}

// Monitor para encerrar a sessão caso a meia-noite seja cruzada com a aba aberta
function iniciarMonitorSessaoDiaria() {
    if (window._monitorSessaoIniciado) return;
    window._monitorSessaoIniciado = true;

    const checarViradaDoDia = async () => {
        const isLoginPage = window.location.pathname.includes('login.html');
        if (isLoginPage) return;

        const user = auth.currentUser;
        if (!user) return;

        const hoje = new Date().toLocaleDateString('pt-BR');
        const sessaoData = localStorage.getItem('fc_sessao_data');

        if (sessaoData && sessaoData !== hoje) {
            console.warn("Virada do dia detectada. Encerrando sessão diária...");
            localStorage.removeItem('fc_sessao_data');
            localStorage.removeItem('fc_sessao_uid');
            sessionStorage.setItem('fc_sessao_expirada_msg', 'O dia virou e sua sessão diária expirou. Por favor, faça login novamente.');
            try { await auth.signOut(); } catch(e) {}
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

    // 2. Se for admin master, mostra aba de funcionários. Senão, esconde SÓ a aba de funcionários do menu lateral
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
        await firestore.collection('movimentacoes').add({
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
// MÓDULO: MOTOR DE TEMA E IDENTIDADE DA EMPRESA
// ==========================================
function aplicarIdentidadeVisualGlobal() {
    if (!db || !db.config) return;

    if (db.config.empresa) {
        const elNome = document.getElementById('menu-empresa-nome');
        const elLogo = document.getElementById('menu-logo');
        const elPlaceholder = document.getElementById('menu-logo-placeholder');

        if (elNome && db.config.empresa.nome) {
            elNome.innerText = db.config.empresa.nome;
        }

        if (elLogo && elPlaceholder && db.config.empresa.logo) {
            elLogo.src = db.config.empresa.logo;
            elLogo.classList.remove('hidden');
            elPlaceholder.classList.add('hidden');
        }
    }

    // O tema agora é fixo e sempre escuro
    aplicarTema();
}

function aplicarTema() {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('tema-escuro');
}


// ===== FUNÇÕES GLOBAIS DE IA, CONFIRMAÇÃO E VENDAS =====

window.chamarGemini = async function(prompt) {
    try {
        const configGemini = (window.db && window.db.config && window.db.config.geminiApiKey) ? window.db.config.geminiApiKey : null;
        if (configGemini) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${configGemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                return data.candidates[0].content.parts[0].text;
            }
        }
        // Retorno padrão elegante para descrição de produtos
        return "Produto de excelente acabamento, matéria-prima selecionada e alta durabilidade, projetado para proporcionar conforto e sofisticação ao ambiente.";
    } catch (e) {
        console.warn("Erro ao chamar IA Gemini:", e);
        return "Produto de alta qualidade e durabilidade com design moderno.";
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
    const htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÓVEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: REIMPRESSÃO</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data Original: ${new Date(v.data).toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${v.clienteNome || '-'}</p><p style="margin: 2px 0;">Vendedor: ${v.vendedor || '-'}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${(v.itens || []).map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${typeof formatMoney === 'function' ? formatMoney(i.preco*i.qtd) : (i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total Final: ${typeof formatMoney === 'function' ? formatMoney(v.tot || v.valorLiquido) : (v.tot || v.valorLiquido)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${v.pag || 'Diversos'}</p></div>`;
    
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

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
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
                            const pRef = firestore.collection('produtos').doc(String(p.id));
                            batch.update(pRef, { estoque: firebase.firestore.FieldValue.increment(Number(item.qtd || 1)) });
                            
                            const kardexRef = firestore.collection('movimentacoes').doc();
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
                
                const finQuery = await firestore.collection('financeiro').where('origemVendaId', '==', String(id)).get();
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
                    
                    const caixaRef = firestore.collection('fc_moveis').doc('caixa');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }

            const vendaRef = firestore.collection('vendas').doc(String(id));
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
// SUPORTE A PWA & INSTALAÇÃO DE APLICATIVO
// ==========================================
let deferredPwaPrompt = null;

if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    window.addEventListener('load', () => {
        const swPath = window.location.pathname.includes('/sistema/') ? '../sw.js' : './sw.js';
        navigator.serviceWorker.register(swPath)
            .then(reg => console.log('🚀 PWA Service Worker ativo!'))
            .catch(err => console.warn('PWA Service Worker offline/ignorado:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    window.deferredPwaPrompt = e;
    console.log('📲 PWA: Evento de instalação pronto.');
    mostrarBotaoInstalarApp();
});

window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null;
    window.deferredPwaPrompt = null;
    console.log('🎉 PWA: Aplicativo instalado com sucesso!');
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
            alert('📲 Como instalar no iPhone / iPad:\n\n1. Toque no botão "Compartilhar" (ícone com quadrado e seta para cima na barra do Safari).\n2. Role para baixo e toque em "Adicionar à Tela de Início".\n3. Toque em "Adicionar" no topo direito.');
        } else {
            alert('📲 Como instalar no Computador ou Android:\n\n1. No Google Chrome ou Microsoft Edge, clique no ícone "Instalar Aplicativo" na barra de endereços (ao lado da estrela de favoritos).\n2. Ou clique nos 3 pontinhos do navegador e escolha "Instalar FC Gestão".');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mostrarBotaoInstalarApp, 1000);
});


