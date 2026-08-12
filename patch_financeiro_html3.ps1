$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
$content = Get-Content $file -Raw -Encoding UTF8

# The block that was just deleted:
$missingBlock = @"
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
"@

$content = $content -replace '(?s)id="filtro-pagar-status".*?onchange="renderFinAbas\(''pagar''\)">', "id=`"filtro-pagar-status`" class=`"bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white`" onchange=`"renderFinAbas('pagar')`">`n" + $missingBlock

$content = $content -replace "Este MÃªs", "Este Mês"
$content = $content -replace "PrÃ³ximos", "Próximos"
$content = $content -replace "HistÃ³rico", "Histórico"

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
