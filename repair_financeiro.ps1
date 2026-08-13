$content = Get-Content financeiro.html -Raw -Encoding UTF8

$brokenString = @"
                            <h3 class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Fluxo 90 Dias (Proj)</h3>
                        <div class="flex flex-col lg:flex-row justify-between items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-3 md:gap-4">
"@

$fixedString = @"
                            <h3 class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Fluxo 90 Dias (Proj)</h3>
                            <p class="text-xl font-black text-purple-600 mt-1" id="dash-fluxo-90">R$ 0,00</p>
                        </div>
                        <div class="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl border border-red-200 dark:border-red-800 shadow-sm flex flex-col justify-center">
                            <h3 class="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">InadimplÃªncia (Atrasos)</h3>
                            <p class="text-xl font-black text-red-600 dark:text-red-500 mt-1" id="dash-inadimplencia">R$ 0,00</p>
                        </div>
                    </div>

                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100 hidden md:block">GestÃ£o de Contas</h2>
                        <div class="flex gap-2">
                            <!-- Toggle View -->
                            <div class="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm w-full md:w-auto overflow-x-auto custom-scrollbar">
                                <button onclick="mudarVisualizacaoFin('lista')" id="fin-view-lista" class="px-3 py-1.5 rounded-md text-sm font-bold bg-blue-600 text-white transition-colors whitespace-nowrap"><i class="fa-solid fa-list mr-1"></i> Lista</button>
                                <button onclick="mudarVisualizacaoFin('calendario')" id="fin-view-calendario" class="px-3 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap"><i class="fa-regular fa-calendar mr-1"></i> CalendÃ¡rio</button>
                            </div>
                            <!-- Abas Pagar/Receber -->
                            <div id="fin-abas-container" class="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm w-full md:w-auto overflow-x-auto custom-scrollbar">
                                <button onclick="renderFinAbas('receber')" id="fin-tab-receber" class="px-4 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap">Contas a Receber</button>
                                <button onclick="renderFinAbas('pagar')" id="fin-tab-pagar" class="px-4 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap">Contas a Pagar</button>
                            </div>
                        </div>
                    </div>

                    <!-- MODO CALENDÃRIO -->
                    <div id="fin-area-calendario" class="fin-area hidden bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 w-full">
                        <div class="flex gap-4 mb-4 flex-wrap">
                            <div class="flex items-center gap-2 text-sm"><span class="w-3 h-3 rounded-full bg-emerald-500"></span><span class="text-slate-600 dark:text-slate-300">Contas a Receber</span></div>
                            <div class="flex items-center gap-2 text-sm"><span class="w-3 h-3 rounded-full bg-red-500"></span><span class="text-slate-600 dark:text-slate-300">Contas a Pagar</span></div>
                        </div>
                        <div id="fin-calendar" class="w-full min-h-[500px]"></div>
                    </div>

                    <!-- SUB-ABA CONTAS A RECEBER -->
                    <div id="fin-area-receber" class="fin-area hidden space-y-4 md:space-y-6">
                        <div class="flex flex-col lg:flex-row justify-between items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-3 md:gap-4">
"@

# Fix Windows CRLF to allow matching
$brokenString = $brokenString -replace "`r`n", "`n"
$content = $content -replace "`r`n", "`n"
$content = $content.Replace($brokenString, $fixedString)

# Fallback for line endings if different
if ($content -notmatch "id=`"dash-fluxo-90`"") {
    $brokenString2 = $brokenString -replace "`n", "`r`n"
    $content = $content -replace "`n", "`r`n"
    $content = $content.Replace($brokenString2, $fixedString)
}

Set-Content financeiro.html $content -Encoding UTF8
