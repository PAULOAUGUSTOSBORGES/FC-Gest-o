$ErrorActionPreference = "Stop"
$folder = "g:\VERSOES DO SISTEMA\site sistema"

# Helper function to bump version
function Bump-Version($htmlFile, $jsFile) {
    $filePath = Join-Path $folder $htmlFile
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        # Search for .js?v=XX and replace with a random timestamp so it's always fresh
        $timestamp = (Get-Date).Ticks
        $pattern = "\Q$jsFile\E\?v=[0-9]+"
        $replacement = "$jsFile`?v=$timestamp"
        $newContent = $content -replace $pattern, $replacement
        Set-Content -Path $filePath -Value $newContent -Encoding UTF8
        Write-Host "Bumped $jsFile in $htmlFile to v=$timestamp"
    }
}

Bump-Version "gestao.html" "gestao_v2.js"
Bump-Version "financeiro.html" "financeiro.js"
Bump-Version "caixa.html" "caixa.js"
Bump-Version "compras.html" "compras.js"
Bump-Version "vendas_gestao.html" "vendas_gestao.js"
Bump-Version "relatorios_v2.html" "relatorios_v2.js"

Write-Output "Cache busters updated."
