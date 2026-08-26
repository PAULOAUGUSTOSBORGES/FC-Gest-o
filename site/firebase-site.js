// ==========================================
// FIREBASE-SITE.JS
// Configuração do Firebase exclusiva para o SITE PÚBLICO (Loja Online)
// NÃO redireciona visitantes para o login.
// NÃO requer autenticação.
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyDIlmd3zUTof-lwxyT7j3UxmenPKs_sMJg",
    authDomain: "lojafc-a31f9.firebaseapp.com",
    projectId: "lojafc-a31f9",
    storageBucket: "lojafc-a31f9.firebasestorage.app",
    messagingSenderId: "221558052645",
    appId: "1:221558052645:web:ed942d019727a472096ccc"
};

// Inicializa o Firebase apenas se ainda não foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}


// Helpers globais necessários para o site
const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
window.formatMoney = formatMoney;
