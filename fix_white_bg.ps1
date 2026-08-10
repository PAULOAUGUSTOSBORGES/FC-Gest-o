$htmlFiles = Get-ChildItem -Path . -Filter *.html -File
foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $updated = $false
    
    # Fix bright background on "Composição de Frete Extra"
    $oldFrete = 'class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm mb-4"'
    $newFrete = 'class="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 shadow-sm mb-4"'
    if ($content.Contains($oldFrete)) {
        $content = $content.Replace($oldFrete, $newFrete)
        $updated = $true
    }
    
    # Fix bright background on "Lançamentos Financeiros (Boletos)"
    $oldBoleto = 'class="bg-amber-50 rounded-xl shadow-sm border border-amber-200 mb-4 p-4"'
    $newBoleto = 'class="bg-amber-50 dark:bg-amber-900/20 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800 mb-4 p-4"'
    if ($content.Contains($oldBoleto)) {
        $content = $content.Replace($oldBoleto, $newBoleto)
        $updated = $true
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Updated HTML $($file.Name)"
    }
}
