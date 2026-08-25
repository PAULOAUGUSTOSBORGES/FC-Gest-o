$ErrorActionPreference = "Stop"
$folder = "g:\VERSOES DO SISTEMA\site sistema"

$files = @("gestao.html", "financeiro.html", "caixa.html", "compras.html", "vendas_gestao.html", "relatorios_v2.html")
$timestamp = (Get-Date).Ticks

foreach ($htmlFile in $files) {
    $filePath = Join-Path $folder $htmlFile
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        # Replace ?v=123123 with ?v=NEW_TIMESTAMP
        $newContent = [regex]::Replace($content, '\?v=[0-9]+', "?v=$timestamp")
        Set-Content -Path $filePath -Value $newContent -Encoding UTF8
        Write-Host "Bumped cache buster in $htmlFile to v=$timestamp"
    }
}
Write-Output "Cache busters updated."
