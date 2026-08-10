$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $updated = $false
    
    $find1 = 'html \+= <option value=" \+ prod\.id \+ "> \+ prod\.nome \+  \(Estoque:  \+ prod\.estoque \+ \)</option>;'
    $rep1 = 'html += "<option value=\"" + prod.id + "\">" + prod.nome + " (Estoque: " + prod.estoque + ")</option>";'
    if ($content -match $find1) {
        $content = $content -replace $find1, $rep1
        $updated = $true
    }
    
    $find2 = 'html \+= <option value=" \+ p\.id \+ "> \+ p\.nome \+  \(Estoque:  \+ p\.estoque \+ \)</option>;'
    $rep2 = 'html += "<option value=\"" + p.id + "\">" + p.nome + " (Estoque: " + p.estoque + ")</option>";'
    if ($content -match $find2) {
        $content = $content -replace $find2, $rep2
        $updated = $true
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Fixed syntax in $($file.Name)"
    }
}
