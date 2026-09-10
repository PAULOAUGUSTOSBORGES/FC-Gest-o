$ErrorActionPreference = "Stop"
$folder = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"

# Helper function to bump version
function Bump-Version($htmlFile, $jsFile) {
    $filePath = Join-Path $folder $htmlFile
    if (Test-Path $filePath) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $timestamp = (Get-Date).Ticks
        $escaped = [regex]::Escape($jsFile)
        $pattern = "$escaped\?v=[0-9]+"
        $replacement = "$jsFile`?v=$timestamp"
        $newContent = $content -replace $pattern, $replacement
        [System.IO.File]::WriteAllText($filePath, $newContent, $utf8NoBom)
        Write-Host "Bumped $jsFile in $htmlFile to v=$timestamp"
    }
}

Bump-Version "gestao.html" "gestao_v2.js"
Bump-Version "financeiro.html" "financeiro.js"
Bump-Version "caixa.html" "caixa.js"
Bump-Version "compras.html" "compras.js"
Bump-Version "vendas_gestao.html" "vendas_gestao.js"
Bump-Version "relatorios_v2.html" "relatorios_v2.js"
Bump-Version "produtos.html" "produtos.js"
Bump-Version "cadastro.html" "cadastro.js"
Bump-Version "index.html" "index.js"

Write-Output "Cache busters updated."

