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
// 'configuracoes/loja_publica', espelhado automaticamente por Cloud Function.
// Usa REST rápido com fallback para SDK e cache padrão.
// ==========================================

function _parseCamposRest(fields) {
    if (!fields) return {};
    const res = {};
    for (const [k, v] of Object.entries(fields)) {
        if ('stringValue' in v) res[k] = v.stringValue;
        else if ('booleanValue' in v) res[k] = v.booleanValue;
        else if ('integerValue' in v) res[k] = Number(v.integerValue);
        else if ('doubleValue' in v) res[k] = Number(v.doubleValue);
        else if ('mapValue' in v) res[k] = _parseCamposRest(v.mapValue.fields);
        else if ('arrayValue' in v) res[k] = (v.arrayValue.values || []).map(x => x.stringValue || x.integerValue || x);
    }
    return res;
}

async function carregarConfigPublicaLoja(empresaId) {
    empresaId = empresaId || 'emp_fc_moveis';

    // 1) Tentativa Rápida via Firestore REST (150ms sem depender de WebChannel)
    try {
        const cfg = (typeof firebaseConfig !== 'undefined') ? firebaseConfig : null;
        if (cfg && cfg.projectId && cfg.apiKey) {
            const endpoint = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/empresas/${encodeURIComponent(empresaId)}/configuracoes/loja_publica?key=${cfg.apiKey}`;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 4000);
            const resp = await fetch(endpoint, { signal: ctrl.signal });
            clearTimeout(timer);
            if (resp.ok) {
                const doc = await resp.json();
                if (doc && doc.fields) {
                    const parsed = _parseCamposRest(doc.fields);
                    return { loja: parsed.loja || {}, empresa: parsed.empresa || {} };
                }
            }
        }
    } catch (eRest) {
        console.warn('[Loja] REST config ignorado, usando SDK:', eRest.message || eRest);
    }

    // 2) Fallback para Firestore SDK
    try {
        const db = firebase.firestore();
        const snap = await db.collection('empresas').doc(empresaId).collection('configuracoes').doc('loja_publica').get();
        if (snap.exists) {
            const data = snap.data() || {};
            return { loja: data.loja || {}, empresa: data.empresa || {} };
        }
    } catch (errSdk) {
        console.warn('[Loja] Sem acesso via SDK a loja_publica:', errSdk.code || errSdk.message);
    }

    // 3) Fallback Seguro Padrão para a FC Móveis
    if (empresaId === 'emp_fc_moveis') {
        return {
            loja: {
                nome: "FC Móveis Interiores",
                whatsapp: "62981111011",
                "whatsapp-msg": "Olá! Estava navegando na loja virtual da FC Móveis e gostaria de ajuda para escolher a mobília ideal.",
                ativa: true,
                "cor-primaria-hex": "#022c03"
            },
            empresa: {
                nome: "FC Móveis Interiores",
                telefone: "62981111011"
            }
        };
    }

    return null;
}
window.carregarConfigPublicaLoja = carregarConfigPublicaLoja;
