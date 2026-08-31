// ==========================================
// FIREBASE-SITE.JS
// Configuração do Firebase exclusiva para o SITE PÚBLICO (Loja Online)
// NÃO redireciona visitantes para o login.
// NÃO requer autenticação.
// ==========================================

// As credenciais e inicialização do Firebase agora vêm de ../sistema/config_banco.js


// Helpers globais necessários para o site
const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
window.formatMoney = formatMoney;
