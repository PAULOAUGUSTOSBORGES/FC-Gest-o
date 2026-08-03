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
    produtos: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [],
    financeiro: [], compras: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] },
    config: { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } } }
};

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

            // SEMPRE aplica o tema e inicializa a página
            aplicarIdentidadeVisualGlobal();

            if (funcaoDeRenderizacaoDaPagina) {
                funcaoDeRenderizacaoDaPagina();
            }
        }
    });
}

function salvarKardex(ref, prodId, prodNome, qtd, tipo) {
    console.warn("salvarKardex obsoleto");
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