param()
# Adiciona <script src="fc_cache.js"> após global.js em todos os HTMLs do /sistema

$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"

# HTMLs que usam os módulos com cache (todos os que têm inicializarXxx)
$htmlsAlvos = @(
    "estoque.html",
    "produtos.html",
    "clientes.html",
    "pdv.html",
    "caixa.html",
    "compras.html",
    "financeiro.html",
    "relatorios.html",
    "vendas_gestao.html",
    "operacao.html",
    "orcamentos.html",
    "vendas_operacao.html",
    "gestao.html",
    "index.html",
    "funcionarios.html",
    "fornecedores.html",
    "sistema.html"
)

$globalJsTag = '<script src="../global.js?v=20260903174117"></script>'
$fcCacheTag  = '<script src="fc_cache.js?v=20260908000001"></script>'

$count = 0
foreach ($html in $htmlsAlvos) {
    $path = Join-Path $baseDir $html
    if (-not (Test-Path $path)) {
        Write-Host "IGNORANDO (não encontrado): $html"
        continue
    }
    
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    
    # Verifica se o fc_cache.js já foi adicionado
    if ($content.Contains("fc_cache.js")) {
        Write-Host "IGNORANDO (já tem fc_cache): $html"
        continue
    }
    
    # Verifica se tem o global.js
    if (-not $content.Contains($globalJsTag)) {
        Write-Host "IGNORANDO (padrão global.js não encontrado): $html"
        continue
    }
    
    # Adiciona fc_cache.js APÓS global.js
    $newContent = $content.Replace($globalJsTag, $globalJsTag + "`r`n    " + $fcCacheTag)
    [System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "OK: $html"
    $count++
}

Write-Host ""
Write-Host "Total atualizado: $count arquivos HTML"
Write-Host "Concluido!"
