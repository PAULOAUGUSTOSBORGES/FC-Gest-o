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

// ==========================================
// CONFIGURAÇÃO PÚBLICA DA LOJA (VITRINE)
// O doc 'configuracoes/config' contém dados sensíveis (CSC fiscal, API keys)
// e só pode ser lido por usuários logados da empresa. O site público lê
// 'configuracoes/loja_publica', espelhado automaticamente por Cloud Function
// (functions/loja_publica.js) apenas com os campos da vitrine.
// Nunca lança erro: retorna { loja, empresa } ou null.
// ==========================================
async function carregarConfigPublicaLoja(empresaId) {
    const db = firebase.firestore();
    const tentar = async (ref) => {
        try {
            const snap = await ref.get();
            return snap.exists ? (snap.data() || {}) : null;
        } catch (err) {
            console.warn('[Loja] Sem acesso a', ref.path, '-', err.code || err.message);
            return null;
        }
    };

    const configs = db.collection('empresas').doc(empresaId).collection('configuracoes');
    // 1) Doc público oficial
    let data = await tentar(configs.doc('loja_publica'));
    // 2) Compatibilidade: doc completo (só funciona enquanto a regra antiga estiver ativa)
    if (!data) data = await tentar(configs.doc('config'));

    if (!data) return null;
    return { loja: data.loja || {}, empresa: data.empresa || {} };
}
window.carregarConfigPublicaLoja = carregarConfigPublicaLoja;
