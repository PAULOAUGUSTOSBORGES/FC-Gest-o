# ==============================================================
# Sistema de Build e Gestão de Cache (Sem Bundler)
# Este script resolve o problema do navegador salvar arquivos .js
# e .css antigos em cache. 
# Uso: Dê um duplo-clique sempre que for mandar pra nuvem.
# ==============================================================

$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) { $root = (Get-Location).Path }

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " FC GESTAO - GERADOR DE VERSOES (CACHE BUSTING)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Procurando arquivos HTML..." -ForegroundColor Yellow

# Gera um numero de versão único baseado na data e hora (ex: 20260826143000)
$versao = Get-Date -Format "yyyyMMddHHmmss"
$cacheString = "?v=$versao"

Write-Host "Nova Versao de Cache Gerada: $versao" -ForegroundColor Green

$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -Recurse

$arquivosAtualizados = 0

foreach ($file in $htmlFiles) {
    # Ignora pastas ocultas (como .git)
    if ($file.FullName -match "\\\.") { continue }

    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $originalContent = $content

    # Substitui a versão em scripts: src="arquivo.js?v=QUALQUERCOISA" por src="arquivo.js?v=NOVA_VERSAO"
    # e links css: href="estilo.css?v=QUALQUERCOISA"
    
    # Expressões regulares robustas para pegar js e css
    $content = $content -replace '(\.js\?v=)\d+', "`$1$versao"
    $content = $content -replace '(\.css\?v=)\d+', "`$1$versao"

    # Caso existam arquivos que AINDA não tem ?v=, adiciona pela primeira vez (ex: src="script.js" -> src="script.js?v=...")
    # Isso requer cuidado para não quebrar links externos, focando apenas em arquivos .js e .css locais
    # Padrão: src="nome.js" ou href="nome.css"
    $content = [regex]::Replace($content, 'src="([^"]+\.js)"', {
        param($match)
        if ($match.Groups[1].Value -match '\?') { return $match.Value } # Já tem ?
        if ($match.Groups[1].Value -match '^http') { return $match.Value } # Link externo
        return 'src="' + $match.Groups[1].Value + $cacheString + '"'
    })

    $content = [regex]::Replace($content, 'href="([^"]+\.css)"', {
        param($match)
        if ($match.Groups[1].Value -match '\?') { return $match.Value }
        if ($match.Groups[1].Value -match '^http') { return $match.Value }
        return 'href="' + $match.Groups[1].Value + $cacheString + '"'
    })

    if ($content -cne $originalContent) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $arquivosAtualizados++
    }
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Concluido! $arquivosAtualizados arquivos HTML atualizados." -ForegroundColor Green
Write-Host "Sempre que voce publicar na nuvem, o navegador dos seus clientes"
Write-Host "baixara automaticamente a nova versao."
Write-Host "Pressione qualquer tecla para sair..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
