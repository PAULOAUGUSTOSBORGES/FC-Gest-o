$jsFiles = @("financeiro.js", "compras.js", "gestao.js", "relatorios.js", "vendas_gestao.js")

# The exact line that starts the array in abrirModalConta
$oldArrayLine = "    ['pessoa','ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','multa','juros','data-pgto','obs','anexo-base64','cartorio','juros','multa'].forEach(id => {"

$newArrayLine = @'
    preencherContaPessoaSelect(tipo);
    const _selEl = document.getElementById('conta-pessoa-select'); if(_selEl) _selEl.value = '';
    const _wrapEl = document.getElementById('conta-pessoa-novo-wrap'); if(_wrapEl) _wrapEl.classList.add('hidden');
    const _pessoaEl = document.getElementById('conta-pessoa'); if(_pessoaEl) _pessoaEl.value = '';

    ['ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','multa','juros','data-pgto','obs','anexo-base64','cartorio','juros','multa'].forEach(id => {
'@

foreach ($f in $jsFiles) {
    if (-not (Test-Path $f)) { Write-Host "Not found: $f"; continue }
    $content = Get-Content -Raw -Path $f

    if ($content.Contains($oldArrayLine)) {
        $content = $content.Replace($oldArrayLine, $newArrayLine)
        Write-Host "  $f - abrirModalConta patched"
    } else {
        Write-Host "  $f - abrirModalConta NOT FOUND (already patched?)"
    }

    [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
}

Write-Host "Done!"
