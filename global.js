// ==========================================
// 1. TRAVA DE SEGURANÇA E CONFIGURAÇÕES GERAIS
// ==========================================
if (sessionStorage.getItem('erp_auth_master') !== 'true') {
    window.location.href = 'login.html'; 
}

// Configuração do Firebase
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

// Variáveis Globais do Banco de Dados
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
// INICIALIZAÇÃO UNIVERSAL E INJETOR WHITE LABEL
// ==========================================
async function initGlobalData(funcaoDeRenderizacaoDaPagina) {
    try {
        const docRef = firestore.collection("fc_moveis").doc("banco_principal");
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            db = docSnap.data();
            if(!db.movimentacoes) db.movimentacoes = [];
            if(!db.financeiro) db.financeiro = [];
            if(!db.fornecedores) db.fornecedores = [];
            if(!db.compras) db.compras = [];
            if(!db.vendas) db.vendas = [];
            if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
            if(!db.config || !db.config.taxas) { 
                db.config = { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } } }; 
            }
        } else { 
            await docRef.set(db); 
        }
        
        // APLICA IDENTIDADE VISUAL E TEMA ASSIM QUE O BANCO CARREGA
        aplicarIdentidadeVisualGlobal();

        // Executa a função específica da página (ex: renderizar produtos, gráficos)
        if(funcaoDeRenderizacaoDaPagina) {
            funcaoDeRenderizacaoDaPagina();
        }

    } catch (error) { 
        showToast("Erro ao conectar com a nuvem.", "error"); 
        console.error(error);
    }
}

function salvarKardex(ref, prodId, prodNome, qtd, tipo) { 
    if(!db.movimentacoes) db.movimentacoes = [];
    db.movimentacoes.unshift({ id: Date.now() + Math.random(), data: new Date().toISOString(), ref: ref || '', prodId: prodId || '', prodNome: prodNome || 'Produto', qtd: qtd || 0, tipo: tipo || 'AJUSTE' }); 
}

function saveDB() { 
    firestore.collection("fc_moveis").doc("banco_principal").set(db).catch(e => showToast("Falha ao salvar dados.", "error")); 
}

function fazerLogout() { 
    sessionStorage.removeItem('erp_auth_master'); 
    window.location.href = 'login.html'; 
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

    // 1. Injeta Nome e Logo no Menu Lateral
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

    // 2. Decide Qual Tema Usar (Claro, Escuro ou Automático)
    let temaFinal = db.config.tema || 'claro';
    if (temaFinal === 'auto') {
        // Puxa do Windows, Mac, Android ou iOS a cor do sistema atual
        temaFinal = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
    }

    // 3. Aplica o Tema Escuro com a Trava do Menu Cinza
    let styleEl = document.getElementById('estilo-tema-escuro');
    
    if (temaFinal === 'escuro') {
        document.documentElement.classList.add('tema-escuro');
        if (!styleEl) {
            const style = document.createElement('style');
            style.id = 'estilo-tema-escuro';
            style.innerHTML = `
                .tema-escuro { filter: invert(0.92) hue-rotate(180deg); background-color: #111; } 
                .tema-escuro img, .tema-escuro video, .tema-escuro iframe { filter: invert(1) hue-rotate(180deg); }
                
                /* TRAVA MÁGICA: Reverte a cor do menu lateral para manter o Cinza Escuro e os botões corretos */
                .tema-escuro aside { filter: invert(1) hue-rotate(180deg); }
                .tema-escuro aside img { filter: none !important; }
            `;
            document.head.appendChild(style);
        }
    } else {
        document.documentElement.classList.remove('tema-escuro');
        if (styleEl) styleEl.remove();
    }
}

// Fica escutando se o usuário mudar o celular/PC de claro para escuro (para o modo Automático)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (db.config && db.config.tema === 'auto') {
        aplicarIdentidadeVisualGlobal();
    }
});