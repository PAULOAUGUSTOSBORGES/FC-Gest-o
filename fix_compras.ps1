$ErrorActionPreference = "Stop"

function Fix-HtmlFile {
    param($FilePath)
    if (-Not (Test-Path $FilePath)) { return }
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    
    # The garbage HTML pattern
    $pattern = "(?s)\s*<th class=`"p-4 text-center`">Tipo</th>\s*<th class=`"p-4 text-right`">Valor Total</th>\s*<th class=`"p-4 text-center print:hidden`">Ações</th>\s*</tr>\s*</thead>\s*<tbody id=`"tabela-compras-hist`".*?</tbody>\s*</table>\s*</div>\s*</div>\s*</div>"
    
    if ($content -match $pattern) {
        $content = $content -replace $pattern, ""
        [IO.File]::WriteAllText("$PWD\$FilePath", $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed garbage in $FilePath"
    }
}

Fix-HtmlFile "financeiro.html"
Fix-HtmlFile "relatorios.html"
Fix-HtmlFile "vendas_gestao.html"
Fix-HtmlFile "gestao.html"

# Create compras.html based on financeiro.html (cleaned)
$finContent = Get-Content "financeiro.html" -Raw -Encoding UTF8

$comprasView = @"
                <!-- COMPRAS E NF-E -->
                <div id="view-compras" class="view-section active max-w-7xl mx-auto space-y-6">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Compras & NF-e XML</h2>
                        <div class="flex gap-2">
                            <button onclick="abrirModalCompraManual()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm"><i class="fa-solid fa-plus"></i> Compra Manual</button>
                            <button onclick="abrirModalXML()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm"><i class="fa-solid fa-file-code"></i> Importar XML</button>
                        </div>
                    </div>

                    <div class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 items-end">
                        <div class="flex-1 min-w-[200px]">
                            <label class="text-xs font-bold text-slate-500 mb-1 block">Buscar</label>
                            <input type="text" id="busca-compras" oninput="renderComprasHist()" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Fornecedor, NF...">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-500 mb-1 block">Início</label>
                            <input type="date" id="filtro-compras-ini" onchange="renderComprasHist()" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 rounded-lg text-sm outline-none">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-500 mb-1 block">Fim</label>
                            <input type="date" id="filtro-compras-fim" onchange="renderComprasHist()" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 rounded-lg text-sm outline-none">
                        </div>
                    </div>

                    <div class="flex justify-between items-center bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span class="font-bold text-slate-700 dark:text-slate-300 text-sm" id="compras-total-filtros">Total Gasto: R`$ 0,00</span>
                    </div>

                    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full text-left min-w-[700px]">
                                <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th class="p-4">Data</th>
                                        <th class="p-4">Fornecedor</th>
                                        <th class="p-4">NF / Ref</th>
                                        <th class="p-4 text-center">Tipo</th>
                                        <th class="p-4 text-right">Valor Total</th>
                                        <th class="p-4 text-center print:hidden">Ações</th>
                                    </tr>
                                </thead>
                                <tbody id="tabela-compras-hist" class="divide-y divide-slate-100 text-xs md:text-sm"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
"@

# We need to extract the part before view-financeiro and after view-financeiro
$startFin = $finContent.IndexOf('<div id="view-financeiro"')
$endFin = $finContent.IndexOf('<!-- RELATÓRIOS GERENCIAIS E BI -->')

if ($endFin -eq -1) {
    # Try another marker
    $endFin = $finContent.IndexOf('<div id="view-relatorios"')
}

if ($startFin -ne -1 -and $endFin -ne -1) {
    $part1 = $finContent.Substring(0, $startFin)
    $part3 = $finContent.Substring($endFin)
    
    $comprasHtml = $part1 + $comprasView + "`n`n" + $part3
    $comprasHtml = $comprasHtml -replace '<title>.*?FINANCEIRO.*?</title>', '<title>FC Móveis - COMPRAS</title>'
    $comprasHtml = $comprasHtml -replace '<script src="financeiro.js"></script>', '<script src="compras.js"></script>'
    
    [IO.File]::WriteAllText("$PWD\compras.html", $comprasHtml, [System.Text.Encoding]::UTF8)
    Write-Host "Created compras.html"
} else {
    Write-Host "Could not find markers to create compras.html"
}

# Create compras.js
if (Test-Path "financeiro.js") {
    $jsContent = Get-Content "financeiro.js" -Raw -Encoding UTF8
    $jsContent = $jsContent -replace "let view = urlParams.get\('view'\);\s*if \(\!view\) view = 'financeiro';", "let view = urlParams.get('view'); if (!view) view = 'compras';"
    $jsContent = $jsContent -replace "const view = urlParams.get\('view'\) \|\| 'financeiro';", "const view = urlParams.get('view') || 'compras';"
    [IO.File]::WriteAllText("$PWD\compras.js", $jsContent, [System.Text.Encoding]::UTF8)
    Write-Host "Created compras.js"
}
