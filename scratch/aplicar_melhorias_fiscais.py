import re
import subprocess
import os

filepath = r"g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\functions\index.js"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Helper blocks to add before emitirNFCe
helpers = '''// ==========================================
// HELPERS MULTI-TENANT & FALLBACK FISCAL
// ==========================================
async function localizarVendaEConfig(vendaId, empId) {
    const id = String(vendaId).trim();
    let empresaRef = db.collection('empresas').doc(empId || 'emp_fc_moveis');
    
    // 1. Tenta na subcolecao da empresa
    let vendaSnap = await empresaRef.collection("vendas").doc(id).get();
    if (vendaSnap.exists) {
        return { vendaSnap, empresaRef, vendaRef: vendaSnap.ref };
    }
    
    // 2. Tenta na raiz (legado)
    const raizSnap = await db.collection("vendas").doc(id).get();
    if (raizSnap.exists) {
        return { vendaSnap: raizSnap, empresaRef, vendaRef: raizSnap.ref };
    }
    
    // 3. Tenta em collectionGroup('vendas') em caso de empId divergente ou nao especificado
    try {
        const cgSnap = await db.collectionGroup("vendas").where(admin.firestore.FieldPath.documentId(), "==", id).limit(1).get();
        if (!cgSnap.empty) {
            const foundSnap = cgSnap.docs[0];
            const parentEmp = foundSnap.ref.parent ? foundSnap.ref.parent.parent : null;
            if (parentEmp) {
                empresaRef = parentEmp;
            }
            return { vendaSnap: foundSnap, empresaRef, vendaRef: foundSnap.ref };
        }
    } catch (e) {
        console.warn("[localizarVendaEConfig] Aviso na busca collectionGroup:", e.message);
    }
    
    return { vendaSnap, empresaRef, vendaRef: empresaRef.collection("vendas").doc(id) };
}

async function verificarPermissaoUsuario(empresaRef, uid, tiposPermissao = ['isAdmin', 'perm_pdv', 'perm_gestao']) {
    try {
        const funcSnap = await empresaRef.collection("funcionarios").doc(uid).get();
        if (funcSnap.exists) {
            const d = funcSnap.data() || {};
            if (tiposPermissao.some(p => Boolean(d[p]))) return true;
        }
    } catch (e) {}

    try {
        const raizFuncSnap = await db.collection("funcionarios").doc(uid).get();
        if (raizFuncSnap.exists) {
            const d = raizFuncSnap.data() || {};
            if (tiposPermissao.some(p => Boolean(d[p]))) return true;
        }
    } catch (e) {}

    return false;
}

async function obterConfigEmpresaComFallback(empresaRef) {
    let configSnap = await empresaRef.collection("configuracoes").doc("config").get();
    let config = configSnap.data() || {};
    
    // Se a empresa nao tiver os dados fiscais / certificado, busca na empresa padrao ou na raiz
    if (!config.empresa || !config.empresa.certificadoBase64) {
        try {
            const padraoSnap = await db.collection("empresas").doc("emp_fc_moveis").collection("configuracoes").doc("config").get();
            if (padraoSnap.exists && padraoSnap.data()?.empresa?.certificadoBase64) {
                config = { ...padraoSnap.data(), ...config, empresa: { ...(padraoSnap.data().empresa || {}), ...(config.empresa || {}) } };
            }
        } catch (e) {}
    }
    
    if (!config.empresa || !config.empresa.certificadoBase64) {
        try {
            const raizConfigSnap = await db.collection("configuracoes").doc("config").get();
            if (raizConfigSnap.exists && raizConfigSnap.data()?.empresa?.certificadoBase64) {
                config = { ...raizConfigSnap.data(), ...config, empresa: { ...(raizConfigSnap.data().empresa || {}), ...(config.empresa || {}) } };
            }
        } catch (e) {}
    }
    
    return config;
}

'''

target_marker = "// 1. EMISSÃO DE NFC-e (CUPOM FISCAL / MOD 65)"
if target_marker in content and "async function localizarVendaEConfig" not in content:
    content = content.replace(target_marker, helpers + target_marker)
    print("Helpers inserted.")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Saved.")
