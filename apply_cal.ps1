$content = Get-Content gestao.html -Raw -Encoding UTF8

# Add imports to head
$headInject = @"
    <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>
    <style>
        .fc-theme-standard .fc-scrollgrid { border-color: #e2e8f0; }
        .dark .fc-theme-standard .fc-scrollgrid { border-color: #334155; }
        .fc-theme-standard td, .fc-theme-standard th { border-color: #e2e8f0; }
        .dark .fc-theme-standard td, .dark .fc-theme-standard th { border-color: #334155; }
        .dark .fc-day-today { background-color: rgba(59, 130, 246, 0.1) !important; }
        .dark .fc-col-header-cell { background-color: #1e293b; color: #f8fafc; padding: 10px 0; }
        .fc-col-header-cell { background-color: #f8fafc; color: #334155; padding: 10px 0; }
        .dark .fc-button-primary { background-color: #3b82f6 !important; border-color: #2563eb !important; }
        .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 700; }
        .dark .fc-daygrid-day-number { color: #cbd5e1; }
        .fc-daygrid-day-number { color: #475569; font-weight: 600; padding: 4px 8px !important; }
        
        .dark .fc-popover { background-color: #1e293b !important; border-color: #334155 !important; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
        .dark .fc-popover-header { background-color: #0f172a !important; color: #f8fafc !important; }
        .dark .fc-popover-title { color: #f8fafc !important; font-weight: bold; }
        .dark .fc-popover-close { color: #94a3b8 !important; opacity: 1; }
        .dark .fc-more-popover .fc-popover-body { background-color: #1e293b !important; }
        .dark .fc-daygrid-more-link { color: #60a5fa !important; font-weight: bold; }
        .fc-daygrid-more-link { color: #2563eb !important; font-weight: bold; }
    </style>
</head>
"@
$content = $content -replace "</head>", $headInject

# Add Calendar UI
$targetUI = @"
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100 hidden md:block">Gestão de Contas</h2>
                        <div class="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm w-full md:w-auto overflow-x-auto custom-scrollbar">
                            <button onclick="renderFinAbas('receber')" id="fin-tab-receber" class="px-4 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap">Contas a Receber</button>
                            <button onclick="renderFinAbas('pagar')" id="fin-tab-pagar" class="px-4 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap">Contas a Pagar</button>
                        </div>
                    </div>
"@

$newUI = @"
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100 hidden md:block">Gestão de Contas</h2>
                        <div class="flex gap-2">
                            <!-- Toggle View -->
                            <div class="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm w-full md:w-auto overflow-x-auto custom-scrollbar">
                                <button onclick="mudarVisualizacaoFin('lista')" id="fin-view-lista" class="px-3 py-1.5 rounded-md text-sm font-bold bg-blue-600 text-white transition-colors whitespace-nowrap"><i class="fa-solid fa-list mr-1"></i> Lista</button>
                                <button onclick="mudarVisualizacaoFin('calendario')" id="fin-view-calendario" class="px-3 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap"><i class="fa-regular fa-calendar mr-1"></i> Calendário</button>
                            </div>
                            <!-- Abas Pagar/Receber -->
                            <div id="fin-abas-container" class="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm w-full md:w-auto overflow-x-auto custom-scrollbar">
                                <button onclick="renderFinAbas('receber')" id="fin-tab-receber" class="px-4 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap">Contas a Receber</button>
                                <button onclick="renderFinAbas('pagar')" id="fin-tab-pagar" class="px-4 py-1.5 rounded-md text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap">Contas a Pagar</button>
                            </div>
                        </div>
                    </div>

                    <!-- MODO CALENDÁRIO -->
                    <div id="fin-area-calendario" class="fin-area hidden bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 w-full">
                        <div class="flex gap-4 mb-4 flex-wrap">
                            <div class="flex items-center gap-2 text-sm"><span class="w-3 h-3 rounded-full bg-emerald-500"></span><span class="text-slate-600 dark:text-slate-300">Contas a Receber</span></div>
                            <div class="flex items-center gap-2 text-sm"><span class="w-3 h-3 rounded-full bg-red-500"></span><span class="text-slate-600 dark:text-slate-300">Contas a Pagar</span></div>
                        </div>
                        <div id="fin-calendar" class="w-full min-h-[500px]"></div>
                    </div>
"@

$content = $content.Replace($targetUI, $newUI)

# Bust cache
$content = $content -replace "gestao_v2.js\?v=11", "financeiro.js?v=15"
$content = $content -replace "financeiro.js\?v=11", "financeiro.js?v=15"
$content = $content -replace "financeiro.js\?v=12", "financeiro.js?v=15"
$content = $content -replace "financeiro.js\?v=13", "financeiro.js?v=15"
$content = $content -replace "financeiro.js\?v=14", "financeiro.js?v=15"

Set-Content gestao.html $content -Encoding UTF8
