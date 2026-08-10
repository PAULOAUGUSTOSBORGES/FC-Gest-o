$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    $regex = '(?s)\}[ \t\r\n]*fecharModalProduto\(\); renderTelaConferenciaXML\(\); showToast\(''Ficha salva para a importa.*?''\);[ \t\r\n]*\}'
    
    if ($content -match $regex) {
        $content = $content -replace $regex, '}'
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Fixed leftover block in $($file.Name)"
    }
}
