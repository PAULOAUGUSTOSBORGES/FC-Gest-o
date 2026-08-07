$utf8 = New-Object System.Text.UTF8Encoding $false

# 1. Update sistema.html
$html = [System.IO.File]::ReadAllText("g:\site sistema\sistema.html", $utf8)
$htmlSearch = '<div class="col-span-2 md:col-span-4"><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Cart&#227;o de D&#233;bito (%)</label><input type="number" step="0.01" id="tx-deb" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-white"></div>'
# If mojibake exists
$htmlSearchMoji = '<div class="col-span-2 md:col-span-4"><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Carto de Dbito (%)</label><input type="number" step="0.01" id="tx-deb" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-white"></div>'

$htmlRepl = @'
<div class="col-span-2"><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Cart&#227;o de D&#233;bito (%)</label><input type="number" step="0.01" id="tx-deb" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-white"></div>
<div class="col-span-2"><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Custo Fixo por Boleto (R$)</label><input type="number" step="0.01" id="tx-boleto-custo" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-white"></div>
'@
if ($html.Contains($htmlSearchMoji)) {
    $html = $html.Replace($htmlSearchMoji, $htmlRepl)
} else {
    # Match dynamically if exact characters differ
    $idx1 = $html.IndexOf('<div class="col-span-2 md:col-span-4"><label class="text-[10px]')
    if ($idx1 -ge 0) {
        $idx2 = $html.IndexOf('</div>', $idx1)
        if ($idx2 -gt $idx1) {
            $prefix = $html.Substring(0, $idx1)
            $suffix = $html.Substring($idx2 + 6)
            $html = $prefix + $htmlRepl + $suffix
        }
    }
}
[System.IO.File]::WriteAllText("g:\site sistema\sistema.html", $html, $utf8)

# 2. Update sistema.js
$jsSis = [System.IO.File]::ReadAllText("g:\site sistema\sistema.js", $utf8)
$jsSis = $jsSis.Replace(
    "if(document.getElementById('tx-deb'))",
    "if(document.getElementById('tx-boleto-custo')) document.getElementById('tx-boleto-custo').value = db.config.custoBoleto || 0;`r`n        if(document.getElementById('tx-deb'))"
)
$jsSis = $jsSis.Replace(
    "const tDeb = parseFloat(document.getElementById('tx-deb').value) || 0;",
    "db.config.custoBoleto = parseFloat(document.getElementById('tx-boleto-custo').value) || 0;`r`n    const tDeb = parseFloat(document.getElementById('tx-deb').value) || 0;"
)
[System.IO.File]::WriteAllText("g:\site sistema\sistema.js", $jsSis, $utf8)

# 3. Update pdv.js
$jsPdv = [System.IO.File]::ReadAllText("g:\site sistema\pdv.js", $utf8)
$jsPdv = $jsPdv.Replace(
    "let taxaValorTotal = 0;",
    "let taxaValorTotal = 0;`r`n    let custoBoletoTotal = 0;"
)

$pdvSearch = "taxaValorTotal += valorBase * (tx / 100);"
$pdvRepl = @'
taxaValorTotal += valorBase * (tx / 100); 
            if (p.metodo === 'Boleto') {
                const qBoleto = parseInt(p.parcelas) || 1;
                const cBoleto = parseFloat(db.config.custoBoleto) || 0;
                custoBoletoTotal += (qBoleto * cBoleto);
            }
'@
$jsPdv = $jsPdv.Replace($pdvSearch, $pdvRepl)

$jsPdv = $jsPdv.Replace(
    "const valorLiquido = tot - taxaValorTotal;",
    "const valorLiquido = tot - taxaValorTotal - custoBoletoTotal;"
)
$jsPdv = $jsPdv.Replace(
    "taxaValor: taxaValorTotal || 0,",
    "taxaValor: taxaValorTotal || 0,`r`n        taxaBoleto: custoBoletoTotal || 0,"
)
[System.IO.File]::WriteAllText("g:\site sistema\pdv.js", $jsPdv, $utf8)

# 4. Update verDetalhesVenda in vendas_gestao.js and vendas_operacao.js
function Update-VerDetalhesVenda($file) {
    $js = [System.IO.File]::ReadAllText($file, $utf8)
    
    # 1. Calculation update
    $js = $js.Replace(
        "const taxaCartao = Number(v.taxaValor) || 0;",
        "const taxaCartao = Number(v.taxaValor) || 0;`r`n    const taxaBoleto = Number(v.taxaBoleto) || 0;"
    )
    $js = $js.Replace(
        "const lucroLiquido = tot - totalCusto - taxaCartao;",
        "const lucroLiquido = tot - totalCusto - taxaCartao - taxaBoleto;"
    )
    
    # 2. UI update
    $jsSearchUi = @'
        if (taxaCartao > 0) {
            tfootHtml += `
            <tr>
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cart\u00e3o / Despesa</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
            </tr>`;
        }
'@
    $jsReplUi = @'
        if (taxaCartao > 0) {
            tfootHtml += `
            <tr>
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cart\u00e3o / Despesa</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
            </tr>`;
        }
        if (taxaBoleto > 0) {
            tfootHtml += `
            <tr>
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Despesa de Emiss\u00e3o (Boletos)</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaBoleto) : taxaBoleto}</td>
            </tr>`;
        }
'@
    $js = $js.Replace($jsSearchUi, $jsReplUi)
    [System.IO.File]::WriteAllText($file, $js, $utf8)
}

Update-VerDetalhesVenda "g:\site sistema\vendas_gestao.js"
Update-VerDetalhesVenda "g:\site sistema\vendas_operacao.js"

Write-Host "Patch complete."
