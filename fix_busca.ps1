$file = 'produtos.html'
$c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$tableBlock = '<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full text-left border-collapse min-w-[700px]">'

$newCode = '<!-- Filtros -->
                    <div class="flex flex-col sm:flex-row gap-3 mb-4 mt-6">
                        <div class="flex-1 relative">
                            <i class="fa-solid fa-search absolute left-3 top-3.5 text-slate-400"></i>
                            <input type="text" id="busca-produto-lista" placeholder="Buscar produto por nome, código, EAN ou marca..." class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 shadow-sm" onkeyup="renderProdutos()">
                        </div>
                        <select id="filtro-prod-status" class="w-full sm:w-48 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 shadow-sm" onchange="renderProdutos()">
                            <option value="todos">Todos os Estoques</option>
                            <option value="ok">Estoque OK</option>
                            <option value="alerta">Estoque Baixo</option>
                            <option value="zerado">Estoque Zerado</option>
                        </select>
                    </div>

                    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div class="overflow-x-auto custom-scrollbar">
                            <table class="w-full text-left border-collapse min-w-[700px]">'

$c = $c.Replace($tableBlock, $newCode)
[System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
