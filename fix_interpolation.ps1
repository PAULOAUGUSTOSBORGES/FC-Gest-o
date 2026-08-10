$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    $regex = '(?s)function renderXMLFinanceiro\(\) \{.*?document\.getElementById\(''xml-total-financeiro''\)\.innerText = formatMoney\(totalLancado\);\s*\}'
    
    $replacement = @'
function renderXMLFinanceiro() {
    const d = window.tempXMLData;
    const container = document.getElementById('xml-financeiro-body');
    if(!container) return;

    let totalLancado = 0;
    container.innerHTML = d.financeiroXML.map((f, i) => {
        totalLancado += f.valor;
        return `
        <div class="flex flex-col sm:flex-row gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-2 md:p-3 rounded-lg border border-amber-200 dark:border-amber-700/50 shadow-sm">
            <input type="text" class="w-full sm:flex-1 bg-transparent text-xs font-bold text-amber-900 dark:text-amber-100 outline-none p-1" value="${f.desc}" onchange="atualizarParcelaXML(${i}, 'desc', this.value)">
            <input type="date" class="w-full sm:w-36 bg-transparent text-xs font-bold text-amber-800 dark:text-amber-200 outline-none p-1" value="${f.venc}" onchange="atualizarParcelaXML(${i}, 'venc', this.value)">
            <input type="number" step="0.01" class="w-full sm:w-28 text-right bg-transparent text-sm font-black text-red-600 dark:text-red-400 outline-none p-1" value="${f.valor.toFixed(2)}" onchange="atualizarParcelaXML(${i}, 'valor', this.value)">
            <button onclick="removeParcelaXML(${i})" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>
        `;
    }).join('');

    document.getElementById('xml-total-financeiro').innerText = formatMoney(totalLancado);
}
'@
    
    if ($content -match $regex) {
        $content = $content -replace $regex, $replacement
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Fixed renderXMLFinanceiro in $($file.Name)"
    }
}
