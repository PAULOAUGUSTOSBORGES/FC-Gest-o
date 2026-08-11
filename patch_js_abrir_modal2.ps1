$jsFiles2 = @("gestao.js", "relatorios.js", "vendas_gestao.js")

# These files have a slightly different array (no 'multa','juros','cartorio' at the end)
$oldArrayLine2 = "    ['pessoa','ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','data-pgto','obs','anexo-base64'].forEach(id => {"

$newArrayLine2 = @'
    preencherContaPessoaSelect(tipo);
    const _selEl = document.getElementById('conta-pessoa-select'); if(_selEl) _selEl.value = '';
    const _wrapEl = document.getElementById('conta-pessoa-novo-wrap'); if(_wrapEl) _wrapEl.classList.add('hidden');
    const _pessoaEl = document.getElementById('conta-pessoa'); if(_pessoaEl) _pessoaEl.value = '';

    ['ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','data-pgto','obs','anexo-base64'].forEach(id => {
'@

foreach ($f in $jsFiles2) {
    if (-not (Test-Path $f)) { Write-Host "Not found: $f"; continue }
    $content = Get-Content -Raw -Path $f

    if ($content.Contains($oldArrayLine2)) {
        $content = $content.Replace($oldArrayLine2, $newArrayLine2)
        Write-Host "  $f - abrirModalConta patched"
    } else {
        Write-Host "  $f - NOT FOUND"
    }

    [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
}
Write-Host "Done!"
