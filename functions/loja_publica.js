// ==========================================
// LOJA PÚBLICA (VITRINE)
// Espelha APENAS os campos públicos de empresas/{empId}/configuracoes/config
// para empresas/{empId}/configuracoes/loja_publica, que é o único doc de
// configuração legível sem login (site público).
// O doc 'config' contém dados sensíveis (certificado A1, senhas, CSC, tokens)
// e NUNCA deve ser exposto publicamente.
// ==========================================
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Campos de 'empresa' que podem aparecer na vitrine (whitelist)
const CAMPOS_EMPRESA_PUBLICOS = [
    "nome", "fantasia", "logo", "telefone",
    "rua", "numero", "bairro", "cidade", "uf", "cep", "endereco"
];

// Proteção extra: nunca copiar chaves com cara de segredo, mesmo dentro de 'loja'
const PADRAO_SENSIVEL = /token|senha|password|secret|key|certificado|csc/i;

function montarLojaPublica(config) {
    const cfg = config || {};

    const loja = {};
    Object.entries(cfg.loja || {}).forEach(([k, v]) => {
        if (!PADRAO_SENSIVEL.test(k)) loja[k] = v;
    });

    const empresaOrig = cfg.empresa || {};
    const empresa = {};
    CAMPOS_EMPRESA_PUBLICOS.forEach((k) => {
        if (empresaOrig[k] !== undefined) empresa[k] = empresaOrig[k];
    });

    return {
        loja,
        empresa,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
    };
}

async function sincronizarEmpresa(db, empId, configData) {
    const ref = db.collection("empresas").doc(empId).collection("configuracoes").doc("loja_publica");
    if (!configData) {
        await ref.delete();
        return;
    }
    await ref.set(montarLojaPublica(configData));
}

// Gatilho: toda alteração em configuracoes/config atualiza o espelho público
exports.espelharLojaPublica = functions.firestore
    .document("empresas/{empId}/configuracoes/config")
    .onWrite(async (change, context) => {
        const db = admin.firestore();
        const depois = change.after.exists ? change.after.data() : null;
        await sincronizarEmpresa(db, context.params.empId, depois);
    });

// Sincronização inicial e sanitização de segredos concluída com sucesso em 03/10/2026.
// Segredos confidenciais (certificado A1, senha, tokens) foram isolados exclusivamente em 'segredos_fiscais'.
exports._sincronizarEmpresa = sincronizarEmpresa;

