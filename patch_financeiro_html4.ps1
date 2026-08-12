$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
$content = Get-Content $file -Raw -Encoding UTF8

$badReceber = @"
                                </div>
                                <div class="flex gap-2 w-full sm:w-auto flex-wrap">
                                    <select id="filtro-receber-status" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')">
                            <div class="flex gap-2 w-full lg:w-auto">
"@

$goodReceber = @"
                                </div>
                                <div class="flex gap-2 w-full sm:w-auto flex-wrap">
                                    <select id="filtro-receber-status" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')">
                                        <option value="TODOS">Todos os Status</option>
                                        <option value="PENDENTE" selected>Em Aberto / Pendente</option>
                                        <option value="PAGO">Recebido / Pago</option>
                                        <option value="ATRASADO">Vencido / Atrasado</option>
                                        <option value="CANCELADO">Cancelado</option>
                                    </select>
                                    <select id="filtro-receber-periodo" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')">
                                        <option value="MES_ATUAL" selected>Este Mês</option>
                                        <option value="30">Próximos 30 dias</option>
                                        <option value="90">Próximos 90 dias</option>
                                        <option value="TUDO">Histórico Completo</option>
                                    </select>
                                    <input type="date" id="filtro-receber-ini" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')" title="Data Inicial">
                                    <input type="date" id="filtro-receber-fim" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm rounded-lg px-2 md:px-3 py-2 md:py-2.5 outline-none focus:border-blue-500 flex-1 dark:text-white" onchange="renderFinAbas('receber')" title="Data Final">
                                </div>
                            </div>
                            <div class="flex gap-2 w-full lg:w-auto">
"@

$content = $content.Replace($badReceber.Replace("`r`n", "`n"), $goodReceber.Replace("`r`n", "`n"))
$content = $content.Replace($badReceber.Replace("`n", "`r`n"), $goodReceber.Replace("`n", "`r`n"))

$badPagar = @"
                                        <option value="MES_ATUAL" selected>Este MÃªs</option>
                                        <option value="30">PrÃ³ximos 30 dias</option>
                                        <option value="90">PrÃ³ximos 90 dias</option>
                                        <option value="TUDO">HistÃ³rico Completo</option>
"@

$goodPagar = @"
                                        <option value="MES_ATUAL" selected>Este Mês</option>
                                        <option value="30">Próximos 30 dias</option>
                                        <option value="90">Próximos 90 dias</option>
                                        <option value="TUDO">Histórico Completo</option>
"@

$content = $content.Replace($badPagar.Replace("`r`n", "`n"), $goodPagar.Replace("`r`n", "`n"))
$content = $content.Replace($badPagar.Replace("`n", "`r`n"), $goodPagar.Replace("`n", "`r`n"))

$content = $content -replace "Este MÃªs", "Este Mês"
$content = $content -replace "PrÃ³ximos", "Próximos"
$content = $content -replace "HistÃ³rico", "Histórico"

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
