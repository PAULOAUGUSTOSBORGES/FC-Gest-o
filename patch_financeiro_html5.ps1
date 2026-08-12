$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
$content = Get-Content $file -Raw -Encoding UTF8

$bad = @"
                    <!-- SUB-ABA CONTAS A PAGAR -->
                    <div id="fin-area-pagar" class="fin-area hidden space-y-4 md:space-y-6">
                        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden" id="print-area-pagar">
"@

$good = @"
                    <!-- SUB-ABA CONTAS A PAGAR -->
                    <div id="fin-area-pagar" class="fin-area hidden space-y-4 md:space-y-6">
                        <div class="flex flex-col lg:flex-row justify-between items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-3 md:gap-4">
                            <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto flex-1">
                                <div class="relative w-full sm:w-64">
                                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-3.5 text-slate-400 text-sm"></i>
                                    <input type="text" id="busca-fin-pagar" placeholder="Buscar Fornecedor, Ref ou Data..." class="w-full pl-10 pr-4 py-2 md:py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-blue-500 dark:text-white" oninput="renderFinAbas('pagar')">
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
                                <button onclick="exportarExcel('tabela-fin-pagar-export', 'Pagamentos')" class="flex-1 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:bg-slate-700 px-4 py-2 md:py-2.5 rounded-lg text-sm transition-colors" title="Exportar Excel"><i class="fa-solid fa-file-excel"></i></button>
                                <button onclick="abrirModalConta('PAGAR')" class="w-full lg:w-auto bg-red-500 hover:bg-red-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"><i class="fa-solid fa-plus"></i> Nova Despesa</button>
                            </div>
                        </div>
                        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden" id="print-area-pagar">
"@

$content = $content.Replace($bad.Replace("`r`n", "`n"), $good.Replace("`r`n", "`n"))
$content = $content.Replace($bad.Replace("`n", "`r`n"), $good.Replace("`n", "`r`n"))

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
