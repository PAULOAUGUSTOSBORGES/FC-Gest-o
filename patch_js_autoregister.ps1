$jsFiles = @("financeiro.js", "compras.js", "gestao.js", "relatorios.js", "vendas_gestao.js")

# Insert auto-register logic before batch.commit()
$oldCommit = "    batch.commit().then(() => {"
$newCommit = @'
    // Auto-register new fornecedor/cliente if typed manually
    const _selFinal = document.getElementById('conta-pessoa-select');
    const _inpFinal = document.getElementById('conta-pessoa');
    const _selValFinal = _selFinal ? _selFinal.value : '';
    const _inpValFinal = _inpFinal ? _inpFinal.value.trim() : '';
    const tipoContaFinal = document.getElementById('conta-tipo').value;
    if ((_selValFinal === '' || _selValFinal === '__novo__') && _inpValFinal) {
        if (tipoContaFinal === 'DESPESA') {
            if (!(db.fornecedores || []).find(f => f.nome && f.nome.toLowerCase() === _inpValFinal.toLowerCase())) {
                const _fRef = firestore.collection('fornecedores').doc();
                batch.set(_fRef, { nome: _inpValFinal, doc: '', cnpj: '', telefone: '' });
            }
        } else {
            if (!(db.clientes || []).find(c => (c.nome||c.razaoSocial||'').toLowerCase() === _inpValFinal.toLowerCase())) {
                const _cRef = firestore.collection('clientes').doc();
                batch.set(_cRef, { nome: _inpValFinal, telefone: '', email: '', doc: '' });
            }
        }
    }

    batch.commit().then(() => {
'@

foreach ($f in $jsFiles) {
    if (-not (Test-Path $f)) { Write-Host "Not found: $f"; continue }
    $content = Get-Content -Raw -Path $f

    if ($content.Contains($oldCommit) -and -not $content.Contains('Auto-register new fornecedor')) {
        $content = $content.Replace($oldCommit, $newCommit)
        Write-Host "  $f - auto-register patched"
    } else {
        Write-Host "  $f - skipped (already patched or not found)"
    }

    [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
}
Write-Host "Done!"
