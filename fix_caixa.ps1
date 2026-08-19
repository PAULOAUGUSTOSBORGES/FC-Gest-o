$ErrorActionPreference = "Stop"

$filePath = "g:\VERSOES DO SISTEMA\site sistema\caixa.js"
$content = Get-Content $filePath -Raw

# Replace onSnapshot
$targetSnapshot = @"
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
"@
$replacementSnapshot = @"
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    firestore.collection('funcionarios').onSnapshot(snap => {
        db.funcionarios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
"@
$content = $content.Replace($targetSnapshot, $replacementSnapshot)

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
Write-Output "Fix applied to caixa.js successfully"
