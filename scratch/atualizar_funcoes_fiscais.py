import re

filepath = r"g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\functions\index.js"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. emitirNFCe
old_nfce_start = """exports.emitirNFCe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const funcSnap = await empresaRef.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NFC-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const vendaSnap = await empresaRef.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await empresaRef.collection("configuracoes").doc("config").get();
        const config = configSnap.data();"""

new_nfce_start = """exports.emitirNFCe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    let empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const hasPerm = await verificarPermissaoUsuario(empresaRef, context.auth.uid, ['isAdmin', 'perm_pdv', 'perm_gestao']);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NFC-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);"""

if old_nfce_start in content:
    content = content.replace(old_nfce_start, new_nfce_start)
    print("emitirNFCe start updated")
else:
    print("WARNING: old_nfce_start not found")

# replace empresaRef.collection("vendas").doc(String(vendaId)).set in emitirNFCe
old_nfce_save = """        await empresaRef.collection("vendas").doc(String(vendaId)).set({
            nfce: dadosRetorno,"""
new_nfce_save = """        await vendaRef.set({
            nfce: dadosRetorno,"""
if old_nfce_save in content:
    content = content.replace(old_nfce_save, new_nfce_save, 1)
    print("emitirNFCe save updated")
else:
    print("WARNING: old_nfce_save not found")

# 2. transmitirNFCeContingencia
old_trans_start = """exports.transmitirNFCeContingencia = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const funcSnap = await empresaRef.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para transmitir nota.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        const vendaSnap = await empresaRef.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await empresaRef.collection("configuracoes").doc("config").get();
        const config = configSnap.data();"""

new_trans_start = """exports.transmitirNFCeContingencia = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    let empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const hasPerm = await verificarPermissaoUsuario(empresaRef, context.auth.uid, ['isAdmin', 'perm_pdv', 'perm_gestao']);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para transmitir nota.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);"""

if old_trans_start in content:
    content = content.replace(old_trans_start, new_trans_start)
    print("transmitirNFCeContingencia start updated")
else:
    print("WARNING: old_trans_start not found")

old_trans_save = """            await empresaRef.collection("vendas").doc(String(vendaId)).set({
                nfce: nfceAtualizada,"""
new_trans_save = """            await vendaRef.set({
                nfce: nfceAtualizada,"""
if old_trans_save in content:
    content = content.replace(old_trans_save, new_trans_save, 1)
    print("transmitirNFCeContingencia save updated")
else:
    print("WARNING: old_trans_save not found")

# 3. emitirNFe
old_nfe_start = """exports.emitirNFe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const funcSnap = await empresaRef.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NF-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const vendaSnap = await empresaRef.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await empresaRef.collection("configuracoes").doc("config").get();
        const config = configSnap.data();"""

new_nfe_start = """exports.emitirNFe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    let empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const hasPerm = await verificarPermissaoUsuario(empresaRef, context.auth.uid, ['isAdmin', 'perm_pdv', 'perm_gestao']);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NF-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);"""

if old_nfe_start in content:
    content = content.replace(old_nfe_start, new_nfe_start)
    print("emitirNFe start updated")
else:
    print("WARNING: old_nfe_start not found")

old_nfe_save = """        await empresaRef.collection("vendas").doc(String(vendaId)).set({
            nfe: dadosRetorno,"""
new_nfe_save = """        await vendaRef.set({
            nfe: dadosRetorno,"""
if old_nfe_save in content:
    content = content.replace(old_nfe_save, new_nfe_save, 1)
    print("emitirNFe save updated")
else:
    print("WARNING: old_nfe_save not found")

# 4. cancelarNotaFiscal
old_canc_venda = """        // 1. Tenta buscar na coleção 'vendas'
        if (vendaId) {
            const vendaSnap = await empresaRef.collection("vendas").doc(String(vendaId)).get();
            if (vendaSnap.exists) {
                targetDoc = vendaSnap.data();
                targetRef = vendaSnap.ref;
                targetCollection = "vendas";
            }
        }"""

new_canc_venda = """        // 1. Tenta buscar na coleção 'vendas'
        if (vendaId) {
            const loc = await localizarVendaEConfig(vendaId, empId);
            if (loc.vendaSnap.exists) {
                targetDoc = loc.vendaSnap.data();
                targetRef = loc.vendaRef;
                targetCollection = "vendas";
                empresaRef = loc.empresaRef;
            }
        }"""

if old_canc_venda in content:
    content = content.replace(old_canc_venda, new_canc_venda)
    print("cancelarNotaFiscal venda lookup updated")
else:
    print("WARNING: old_canc_venda not found")

# 5. reverterCancelamentoInterno
old_rev_venda = """        const vendaRef = empresaRef.collection('vendas').doc(String(vendaId));
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError('not-found', 'Venda não encontrada.');
        const v = vendaSnap.data();"""

new_rev_venda = """        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError('not-found', 'Venda não encontrada.');
        const v = vendaSnap.data();"""

if old_rev_venda in content:
    content = content.replace(old_rev_venda, new_rev_venda)
    print("reverterCancelamentoInterno updated")
else:
    print("WARNING: old_rev_venda not found")

# 6. consultarStatusNota
old_cons_venda = """        const vendaSnap = await empresaRef.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();"""

new_cons_venda = """        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();"""

if old_cons_venda in content:
    content = content.replace(old_cons_venda, new_cons_venda)
    print("consultarStatusNota updated")
else:
    print("WARNING: old_cons_venda not found")

# 7. cartaCorrecaoNFe
old_cce_start = """        const vendaSnap = await empresaRef.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await empresaRef.collection("configuracoes").doc("config").get();
        const empresa = configSnap.data()?.empresa || {};"""

new_cce_start = """        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);
        const empresa = config.empresa || {};"""

if old_cce_start in content:
    content = content.replace(old_cce_start, new_cce_start)
    print("cartaCorrecaoNFe start updated")
else:
    print("WARNING: old_cce_start not found")

old_cce_save = """            await empresaRef.collection("vendas").doc(String(vendaId)).set({
                nfe: {
                    ...(venda.nfe || {}),
                    cce: dadosCCe
                }
            }, { merge: true });"""

new_cce_save = """            await vendaRef.set({
                nfe: {
                    ...(venda.nfe || {}),
                    cce: dadosCCe
                }
            }, { merge: true });"""

if old_cce_save in content:
    content = content.replace(old_cce_save, new_cce_save)
    print("cartaCorrecaoNFe save updated")
else:
    print("WARNING: old_cce_save not found")

# 8. emitirDevolucaoVenda
old_dev_start = """        // Buscar venda e configurações
        const vendaSnap = await empresaRef.collection('vendas').doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError('not-found', 'Venda não encontrada.');
        const venda = vendaSnap.data();

        const configSnap = await empresaRef.collection('configuracoes').doc('config').get();
        const empresa = configSnap.data()?.empresa;"""

new_dev_start = """        // Buscar venda e configurações
        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError('not-found', 'Venda não encontrada.');
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);
        const empresa = config.empresa;"""

if old_dev_start in content:
    content = content.replace(old_dev_start, new_dev_start)
    print("emitirDevolucaoVenda start updated")
else:
    print("WARNING: old_dev_start not found")

old_dev_save = """        await empresaRef.collection('vendas').doc(String(vendaId)).set(updateVenda, { merge: true });"""
new_dev_save = """        await vendaRef.set(updateVenda, { merge: true });"""
if old_dev_save in content:
    content = content.replace(old_dev_save, new_dev_save)
    print("emitirDevolucaoVenda save updated")
else:
    print("WARNING: old_dev_save not found")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Finished saving updated index.js")
