$htmlFiles = Get-ChildItem -Path . -Filter *.html -File
foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $updated = $false
    
    # Fix the table bleeding by adding overflow-y-auto and increasing max height
    $oldDiv = '<div class="overflow-x-auto max-h-64 custom-scrollbar">'
    $newDiv = '<div class="overflow-auto max-h-[400px] custom-scrollbar">'
    if ($content.Contains($oldDiv)) {
        $content = $content.Replace($oldDiv, $newDiv)
        $updated = $true
    }
    
    # Fix the dark mode text color for Custo Final
    $oldTh = 'text-right w-24 text-indigo-700"'
    $newTh = 'text-right w-24 text-indigo-700 dark:text-indigo-400"'
    if ($content.Contains($oldTh)) {
        $content = $content.Replace($oldTh, $newTh)
        $updated = $true
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Updated HTML $($file.Name)"
    }
}

$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $updated = $false
    
    # Fix the finance rows layout and colors
    $oldRenderFinanceiro = '(?s)function renderXMLFinanceiro\(\) \{.*?document\.getElementById\(''xml-total-financeiro''\)\.innerText = formatMoney\(totalLancado\);\s*\}'
    
    $newRenderFinanceiro = @"
function renderXMLFinanceiro() {
    const d = window.tempXMLData;
    const container = document.getElementById('xml-financeiro-body');
    if(!container) return;

    let totalLancado = 0;
    container.innerHTML = d.financeiroXML.map((f, i) => {
        totalLancado += f.valor;
        return \`
        <div class="flex flex-col sm:flex-row gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-2 md:p-3 rounded-lg border border-amber-200 dark:border-amber-700/50 shadow-sm">
            <input type="text" class="w-full sm:flex-1 bg-transparent text-xs font-bold text-amber-900 dark:text-amber-100 outline-none p-1" value="\${f.desc}" onchange="atualizarParcelaXML(\${i}, 'desc', this.value)">
            <input type="date" class="w-full sm:w-36 bg-transparent text-xs font-bold text-amber-800 dark:text-amber-200 outline-none p-1" value="\${f.venc}" onchange="atualizarParcelaXML(\${i}, 'venc', this.value)">
            <input type="number" step="0.01" class="w-full sm:w-28 text-right bg-transparent text-sm font-black text-red-600 dark:text-red-400 outline-none p-1" value="\${f.valor.toFixed(2)}" onchange="atualizarParcelaXML(\${i}, 'valor', this.value)">
            <button onclick="removeParcelaXML(\${i})" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>
        \`;
    }).join('');

    document.getElementById('xml-total-financeiro').innerText = formatMoney(totalLancado);
}
"@
    
    if ($content -match $oldRenderFinanceiro) {
        $content = $content -replace $oldRenderFinanceiro, $newRenderFinanceiro
        $updated = $true
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Updated JS $($file.Name)"
    }
}
