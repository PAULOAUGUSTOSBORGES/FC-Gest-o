$path = "g:\VERSOES DO SISTEMA\site sistema\relatorios.html"
$content = Get-Content $path -Raw -Encoding UTF8

$badBlock = @"
                                </h3>
                                <div id="bi-top-clientes" class="space-y-3"></div>
                            </div>
                            <!-- Evolução de Custos por Produto (NOVO) -->
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 md:col-span-2">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
"@

# Since replace_file_content merged it, we have:
$currentMerged = @"
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span>Top Clientes</span>
                                    <button onclick="abrirInfoRelatorio('top_clientes')" class="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer print:hidden" title="EntendAçõeste relatório"><i class="fa-solid fa-circle-question"></i></button>
                                    <span><i class="fa-solid fa-arrow-trend-up mr-1"></i> Evolução e Histórico de Custo por Produto</span>
                                    <button onclick="abrirInfoRelatorio('evolucao_custos')" class="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer print:hidden" title="EntendAçõeste relatório"><i class="fa-solid fa-circle-question"></i></button>
                                </h3>
"@

$goodBlock = @"
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span>Top Clientes</span>
                                    <button onclick="abrirInfoRelatorio('top_clientes')" class="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer print:hidden" title="EntendAçõeste relatório"><i class="fa-solid fa-circle-question"></i></button>
                                </h3>
                                <div id="bi-top-clientes" class="space-y-3"></div>
                            </div>

                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-truck"></i> Top Fornecedores (Gastos)</span>
                                    <button onclick="abrirInfoRelatorio('top_fornecedores')" class="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer print:hidden" title="EntendAçõeste relatório"><i class="fa-solid fa-circle-question"></i></button>
                                </h3>
                                <div id="bi-top-fornecedores" class="space-y-3"></div>
                            </div>

                            <!-- Despesas por Categoria e Centro de Custo -->
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-tags text-slate-400 mr-2"></i> Despesas por Categoria</span>
                                </h3>
                                <div id="bi-despesas-categoria" class="space-y-3"></div>
                            </div>
                            
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-building text-slate-400 mr-2"></i> Despesas por Centro de Custo</span>
                                </h3>
                                <div id="bi-despesas-centro-custo" class="space-y-3"></div>
                            </div>

                            <!-- Evolução de Custos por Produto (NOVO) -->
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 md:col-span-2">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-arrow-trend-up mr-1"></i> Evolução e Histórico de Custo por Produto</span>
                                    <button onclick="abrirInfoRelatorio('evolucao_custos')" class="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer print:hidden" title="EntendAçõeste relatório"><i class="fa-solid fa-circle-question"></i></button>
                                </h3>
"@

$content = $content.Replace($currentMerged, $goodBlock)
Set-Content -Path $path -Value $content -Encoding UTF8
Write-Host "relatorios.html patched"

$pathGestao = "g:\VERSOES DO SISTEMA\site sistema\gestao.html"
$contentGestao = Get-Content $pathGestao -Raw -Encoding UTF8

$gestaoTarget = @"
                            <!-- Evolução de Custos por Produto (NOVO) -->
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 md:col-span-2">
"@

$gestaoNew = @"
                            <!-- Despesas por Categoria e Centro de Custo -->
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-tags text-slate-400 mr-2"></i> Despesas por Categoria</span>
                                </h3>
                                <div id="bi-despesas-categoria" class="space-y-3"></div>
                            </div>
                            
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-building text-slate-400 mr-2"></i> Despesas por Centro de Custo</span>
                                </h3>
                                <div id="bi-despesas-centro-custo" class="space-y-3"></div>
                            </div>

                            <!-- Evolução de Custos por Produto (NOVO) -->
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 md:col-span-2">
"@

if (-not $contentGestao.Contains("Despesas por Categoria e Centro de Custo")) {
    $contentGestao = $contentGestao.Replace($gestaoTarget, $gestaoNew)
    Set-Content -Path $pathGestao -Value $contentGestao -Encoding UTF8
    Write-Host "gestao.html patched"
}
