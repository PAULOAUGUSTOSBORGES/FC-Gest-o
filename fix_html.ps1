$gestaoPath = "g:\VERSOES DO SISTEMA\site sistema\gestao.html"
$relatoriosPath = "g:\VERSOES DO SISTEMA\site sistema\relatorios.html"

# Ler gestao.html puro
$content = Get-Content $gestaoPath -Raw -Encoding UTF8

$target = "<!-- Evolução de Custos por Produto (NOVO) -->"
$panels = @"
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
"@

# Injetar os painéis no conteúdo base se não existir
if (-not $content.Contains("Despesas por Categoria e Centro de Custo")) {
    $content = $content.Replace($target, $panels)
}

# Salvar o gestao.html
Set-Content -Path $gestaoPath -Value $content -Encoding UTF8
Write-Host "gestao.html corrigido e atualizado"

# Preparar o relatorios.html (trocar a aba ativa)
$relatoriosContent = $content

$activeClass = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white shadow-lg shadow-blue-500/30'
$inactiveClass = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800 text-slate-300'

# Achar e substituir as classes no nav-gestao e nav-relatorios
# Fica mais fácil usar regex ou replace direto da tag

$navGestaoOld = '<a href="gestao.html" id="nav-gestao" class="' + $activeClass + '" data-target="gestao"><i class="fa-solid fa-briefcase w-5 text-center"></i> Gestão</a>'
$navGestaoNew = '<a href="gestao.html" id="nav-gestao" class="' + $inactiveClass + '" data-target="gestao"><i class="fa-solid fa-briefcase w-5 text-center"></i> Gestão</a>'

$navRelOld = '<a href="relatorios.html" id="nav-relatorios" class="' + $inactiveClass + '" data-target="relatorios"><i class="fa-solid fa-chart-line w-5 text-center"></i> Relatórios & DRE</a>'
$navRelNew = '<a href="relatorios.html" id="nav-relatorios" class="' + $activeClass + '" data-target="relatorios"><i class="fa-solid fa-chart-line w-5 text-center"></i> Relatórios & DRE</a>'

$relatoriosContent = $relatoriosContent.Replace($navGestaoOld, $navGestaoNew)
$relatoriosContent = $relatoriosContent.Replace($navRelOld, $navRelNew)

Set-Content -Path $relatoriosPath -Value $relatoriosContent -Encoding UTF8
Write-Host "relatorios.html restaurado e atualizado"
