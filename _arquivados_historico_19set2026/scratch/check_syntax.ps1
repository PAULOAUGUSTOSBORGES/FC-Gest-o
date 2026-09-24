param()
$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o"
$files = @(
    "global.js",
    "sistema\fc_cache.js",
    "sistema\pdv.js",
    "sistema\estoque.js",
    "sistema\produtos.js",
    "sistema\clientes.js",
    "sistema\caixa.js",
    "sistema\compras.js",
    "sistema\financeiro.js",
    "sistema\relatorios_v2.js",
    "sistema\vendas_gestao.js"
)

$hasError = $false
foreach ($f in $files) {
    $fullPath = Join-Path $baseDir $f
    $out = & node --check $fullPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: $f"
        Write-Host $out
        $hasError = $true
    } else {
        Write-Host "OK: $f"
    }
}
if (-not $hasError) {
    Write-Host ""
    Write-Host "TODOS OK - nenhum erro de sintaxe encontrado!"
}
