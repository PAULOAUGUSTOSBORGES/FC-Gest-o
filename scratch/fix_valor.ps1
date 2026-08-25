$ErrorActionPreference = "Stop"

$folder = "g:\VERSOES DO SISTEMA\site sistema"

$files = @("gestao_v2.js", "vendas_gestao.js", "financeiro.js", "caixa.js", "compras.js", "relatorios_v2.js")

foreach ($file in $files) {
    $filePath = Join-Path $folder $file
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        
        $pattern = "document.getElementById('conta-valor').value = f.valor || 0;"
        $replacement = @"
    let valStr = String(f.valor || 0);
    if (valStr.includes(',')) { valStr = valStr.replace(/\./g, '').replace(',', '.'); }
    document.getElementById('conta-valor').value = parseFloat(valStr) || 0;
"@
        
        $content = $content.Replace($pattern, $replacement)
        
        # In financeiro.js there might be multiple occurrences (one in decodificarLinhaDigitavelBoleto maybe?)
        # Let's ensure it replaces all.
        Set-Content -Path $filePath -Value $content -Encoding UTF8
        Write-Host "Processed $file"
    }
}

# Also bump cache buster again
$timestamp = (Get-Date).Ticks
$htmlFiles = @("gestao.html", "financeiro.html", "caixa.html", "compras.html", "vendas_gestao.html", "relatorios_v2.html")
foreach ($htmlFile in $htmlFiles) {
    $htmlPath = Join-Path $folder $htmlFile
    if (Test-Path $htmlPath) {
        $htmlContent = Get-Content $htmlPath -Raw
        $htmlContent = [regex]::Replace($htmlContent, '\?v=[0-9]+', "?v=$timestamp")
        Set-Content -Path $htmlPath -Value $htmlContent -Encoding UTF8
        Write-Host "Bumped $htmlFile"
    }
}
Write-Output "Done"
