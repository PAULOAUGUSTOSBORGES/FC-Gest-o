$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
$content = Get-Content $file -Raw -Encoding UTF8

$oldReceber = @"
                                    <select id="filtro-receber-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')">
                                        <option value="30" selected>Próximos 30 dias</option>
"@

$newReceber = @"
                                    <select id="filtro-receber-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')">
                                        <option value="MES_ATUAL" selected>Este Mês</option>
                                        <option value="30">Próximos 30 dias</option>
"@

$oldPagar = @"
                                    <select id="filtro-pagar-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('pagar')">
                                        <option value="30" selected>Próximos 30 dias</option>
"@

$newPagar = @"
                                    <select id="filtro-pagar-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('pagar')">
                                        <option value="MES_ATUAL" selected>Este Mês</option>
                                        <option value="30">Próximos 30 dias</option>
"@


$content = $content.Replace($oldReceber.Replace("`r`n", "`n"), $newReceber.Replace("`r`n", "`n"))
$content = $content.Replace($oldReceber.Replace("`n", "`r`n"), $newReceber.Replace("`n", "`r`n"))

$content = $content.Replace($oldPagar.Replace("`r`n", "`n"), $newPagar.Replace("`r`n", "`n"))
$content = $content.Replace($oldPagar.Replace("`n", "`r`n"), $newPagar.Replace("`n", "`r`n"))

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
