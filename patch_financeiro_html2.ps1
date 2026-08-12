$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
$content = Get-Content $file -Raw -Encoding UTF8

$bad = @"
                                </div>
                                <div class="flex gap-2 w-full sm:w-auto flex-wrap">
                                <button onclick="imprimirArea('print-area-pagar')" class="flex-1 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:bg-slate-700 px-4 py-2 md:py-2.5 rounded-lg text-sm transition-colors" title="Imprimir"><i class="fa-solid fa-print"></i></button>
"@

$good = @"
                                </div>
                                <div class="flex gap-2 w-full sm:w-auto flex-wrap">
                                    <select id="filtro-pagar-status" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('pagar')">
                                        <option value="TODOS">Todos os Status</option>
                                        <option value="PENDENTE" selected>Em Aberto / A Pagar</option>
                                        <option value="PAGO">Pago</option>
                                        <option value="ATRASADO">Vencido / Atrasado</option>
                                        <option value="RENEGOCIADO">Renegociado</option>
                                    </select>
                                    <select id="filtro-pagar-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('pagar')">
                                        <option value="MES_ATUAL" selected>Este Mês</option>
                                        <option value="30">Próximos 30 dias</option>
                                        <option value="90">Próximos 90 dias</option>
                                        <option value="TUDO">Histórico Completo</option>
                                    </select>
                                    <input type="date" id="filtro-pagar-ini" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('pagar')" title="Data Inicial">
                                    <input type="date" id="filtro-pagar-fim" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('pagar')" title="Data Final">
                                </div>
                            </div>
                            <div class="flex gap-2 w-full lg:w-auto">
                                <button onclick="imprimirArea('print-area-pagar')" class="flex-1 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:bg-slate-700 px-4 py-2 md:py-2.5 rounded-lg text-sm transition-colors" title="Imprimir"><i class="fa-solid fa-print"></i></button>
"@

$content = $content.Replace($bad.Replace("`r`n", "`n"), $good.Replace("`r`n", "`n"))
$content = $content.Replace($bad.Replace("`n", "`r`n"), $good.Replace("`n", "`r`n"))

$oldReceber = @"
                                    <select id="filtro-receber-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')">
                                        <option value="30" selected>Próximos 30 dias</option>
"@

$newReceber = @"
                                    <select id="filtro-receber-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')">
                                        <option value="MES_ATUAL" selected>Este Mês</option>
                                        <option value="30">Próximos 30 dias</option>
"@

$content = $content.Replace($oldReceber.Replace("`r`n", "`n"), $newReceber.Replace("`r`n", "`n"))
$content = $content.Replace($oldReceber.Replace("`n", "`r`n"), $newReceber.Replace("`n", "`r`n"))

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
