// ==========================================
// CONFIGURAÇÃO CENTRAL DE BANCO DE DADOS (FIREBASE)
// ==========================================

// CHAVE MESTRA:
// Mude para TRUE quando estiver desenvolvendo no seu computador.
// Mude para FALSE quando for dar o 'firebase deploy' para os clientes usarem.
const MODO_TESTES = true;

// ==========================================
// CREDENCIAIS DA PRODUÇÃO (BANCO REAL)
// ==========================================
const BANCO_OFICIAL = {
    apiKey: "AIzaSyDIlmd3zUTof-lwxyT7j3UxmenPKs_sMJg",
    authDomain: "lojafc-a31f9.firebaseapp.com",
    projectId: "lojafc-a31f9",
    storageBucket: "lojafc-a31f9.firebasestorage.app",
    messagingSenderId: "221558052645",
    appId: "1:221558052645:web:ed942d019727a472096ccc"
};

// ==========================================
// CREDENCIAIS DE TESTE (HOMOLOGAÇÃO)
// ==========================================
const BANCO_TESTES = {
    apiKey: "AIzaSyAvaDdhJSFP6WKs8UFRvlQmNGFlc1ZKgFk",
    authDomain: "fcgestao-testes.firebaseapp.com",
    projectId: "fcgestao-testes",
    storageBucket: "fcgestao-testes.firebasestorage.app",
    messagingSenderId: "126917183785",
    appId: "1:126917183785:web:32cdc3fd9b8e1064658f38",
    measurementId: "G-G08C2WPKYP"
};

// ==========================================
// INICIALIZAÇÃO AUTOMÁTICA
// ==========================================
const firebaseConfig = MODO_TESTES ? BANCO_TESTES : BANCO_OFICIAL;

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log(`🔥 Firebase Conectado! MODO: ${MODO_TESTES ? '🛑 TESTES (Isolado)' : '✅ OFICIAL (Produção)'}`);
} else if (typeof firebase === 'undefined') {
    console.error("Firebase SDK não foi carregado antes do config_banco.js");
}
