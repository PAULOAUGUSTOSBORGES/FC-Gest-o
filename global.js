// ==========================================
// 1. CONFIGURAÇÕES DO FIREBASE E SEGURANÇA
// ==========================================

// Motor de Tema Instantâneo (Sempre escuro)
(function () {
    document.documentElement.classList.add('dark');
})();

const firebaseConfig = {
    apiKey: "AIzaSyDIlmd3zUTof-lwxyT7j3UxmenPKs_sMJg",
    authDomain: "lojafc-a31f9.firebaseapp.com",
    projectId: "lojafc-a31f9",
    storageBucket: "lojafc-a31f9.firebasestorage.app",
    messagingSenderId: "221558052645",
    appId: "1:221558052645:web:ed942d019727a472096ccc"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();
const auth = firebase.auth();

// Stub Global do DB (para não quebrar as outras telas enquanto são migradas)
let db = {
    produtos: [], categorias: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [],
    financeiro: [], compras: [], funcionarios: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] },
    config: { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } } }
};
window.currentUserInfo = null;

const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatData = (isoStr) => new Date(isoStr).toLocaleString('pt-BR');

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
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
            if (isLoginPage) {
                window.location.href = 'index.html';
                return;
            }

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
                                                                // UsuÃ¡rio nÃ£o estÃ¡ na tabela (nova conta criada)
                      console.warn("UsuÃ¡rio nÃ£o cadastrado na base de funcionÃ¡rios.");
                      
                      try {
                          await firestore.collection('funcionarios').doc(user.uid).set({
                              nome: "NOVO CADASTRO", email: user.email || '', isAdmin: false,
                              perm_dashboard: false, perm_pdv: false, perm_cadastros: false,
                              perm_gestao: false, perm_config: false, dataCadastro: new Date().toISOString(), status: 'PENDENTE'
                          });
                      } catch(e) { console.error("Erro ao registrar no banco:", e); }
                      
                      const avisoAprovacao = document.createElement('div');
                      avisoAprovacao.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:#eab308; color:black; padding:15px 30px; font-size:16px; font-weight:bold; border-radius:10px; text-align:center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);";
                      avisoAprovacao.innerHTML = "<i class='fa-solid fa-clock'></i> Conta Registrada!<br><span style='font-size:13px; font-weight:normal;'>Aguarde o Administrador liberar suas permissÃµes de acesso.</span>";
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
    } else if (path.includes('cadastro.html') && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if (path.includes('cadastro.html') && window.location.search.includes('view=funcionarios')) {
        // A aba de funcionários é bloqueada para todos que não são Admin Master
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar Funcionários.';
    } else if (path.includes('gestao.html') && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado à Gestão Financeira.';
    } else if (path.includes('operacao.html') && !p.perm_pdv) {
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
    } else if (link.href.includes('gestao.html') && !p.perm_gestao) {
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

// Fim da função


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
    await auth.signOut();
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
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

// Removido o listener de preferência de cores do sistema, pois o tema é fixo.



