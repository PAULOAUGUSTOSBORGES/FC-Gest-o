$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Find the start and end of the block we need to replace
$startTag = "<!-- SUB-ABA CONTAS A RECEBER -->"
$endTag = "<!-- SUB-ABA CONTAS A PAGAR -->"

$startIndex = $content.IndexOf($startTag)
$endIndex = $content.IndexOf($endTag)

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    # Extract everything before and after the bad block
    $before = $content.Substring(0, $startIndex)
    $after = $content.Substring($endIndex)
    
    $goodBlock = @"
<!-- SUB-ABA CONTAS A RECEBER -->
                    <div id="fin-area-receber" class="fin-area hidden space-y-4 md:space-y-6">
                        <div class="flex flex-col lg:flex-row justify-between items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-3 md:gap-4">
                            <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto flex-1">
                                <div class="relative w-full sm:w-64">
                                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-3.5 text-slate-400 text-sm"></i>
                                    <input type="text" id="busca-fin-receber" placeholder="Buscar Cliente, Ref ou Data..." class="w-full pl-10 pr-4 py-2 md:py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-blue-500 dark:text-white" oninput="renderFinAbas('receber')">
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
                                <button onclick="imprimirArea('print-area-receber')" class="flex-1 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:bg-slate-700 px-4 py-2 md:py-2.5 rounded-lg text-sm transition-colors" title="Imprimir"><i class="fa-solid fa-print"></i></button>
                                <button onclick="exportarExcel('tabela-fin-receber-export', 'Recebimentos')" class="flex-1 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:bg-slate-700 px-4 py-2 md:py-2.5 rounded-lg text-sm transition-colors" title="Exportar Excel"><i class="fa-solid fa-file-excel"></i></button>
                                <button onclick="abrirModalConta('RECEBER')" class="w-full lg:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"><i class="fa-solid fa-plus"></i> Nova Receita</button>
                            </div>
                        </div>
                        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden" id="print-area-receber">
                            <div class="overflow-x-auto custom-scrollbar">
                                <table class="w-full text-left min-w-[700px]" id="tabela-fin-receber-export">
                                    <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                                        <tr><th class="p-3">Vencimento</th><th class="p-3">Cliente / Pagador</th><th class="p-3">Ref/Categoria</th><th class="p-3 text-right">Valor Final</th><th class="p-3 text-center">Status</th><th class="p-3 text-center print:hidden">Ações Avançadas</th></tr>
                                    </thead>
                                    <tbody id="tabela-fin-receber" class="divide-y divide-slate-100 text-xs md:text-sm"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    
"@
    $newContent = $before + $goodBlock + $after
    [System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "Success"
} else {
    Write-Host "Failed to find boundaries"
}
