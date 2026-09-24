$ErrorActionPreference = "Stop"

$filePath = "g:\VERSOES DO SISTEMA\site sistema\vendas_gestao.js"
$content = Get-Content $filePath -Raw

# Replace onSnapshot
$targetSnapshot = @"
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
"@
$replacementSnapshot = @"
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    firestore.collection('funcionarios').onSnapshot(snap => {
        db.funcionarios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
"@
$content = $content.Replace($targetSnapshot, $replacementSnapshot)

# In case it doesn't have tentarRefresh():
$targetSnapshot2 = @"
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
"@
$replacementSnapshot2 = @"
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    firestore.collection('funcionarios').onSnapshot(snap => {
        db.funcionarios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
"@
$content = $content.Replace($targetSnapshot2, $replacementSnapshot2)

# Replace preencherContaPessoaSelect
$targetSelect = @"
    const lista = tipo === 'RECEBER'
        ? (db.clientes || []).map(c => c.nome || c.razaoSocial || '')
        : (db.fornecedores || []).map(f => f.nome || f.razaoSocial || '');
"@
$replacementSelect = @"
    const lista = tipo === 'RECEBER'
        ? (db.clientes || []).map(c => c.nome || c.razaoSocial || '')
        : [...(db.fornecedores || []), ...(db.funcionarios || [])].map(f => f.nome || f.razaoSocial || '');
"@
$content = $content.Replace($targetSelect, $replacementSelect)

Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Output "Fix applied to vendas_gestao.js successfully"
