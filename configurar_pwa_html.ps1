# Script para injetar tags PWA e limpar formatação em todos os arquivos HTML
$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) { $root = (Get-Location).Path }

Write-Host "Iniciando configuração de PWA em todos os arquivos HTML..." -ForegroundColor Cyan

$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -Recurse
$updatedCount = 0

foreach ($file in $htmlFiles) {
    if ($file.FullName -match "\\\.") { continue }

    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content

    # Limpa possíveis `n inseridos acidentalmente
    $content = $content.Replace("`r`n``n", "`r`n")
    $content = $content.Replace("``n", "`r`n")

    # Calcula caminho relativo para a raiz
    $relPath = $file.FullName.Substring($root.Length).TrimStart('\', '/')
    $depth = ($relPath -split '[\\/]').Length - 1
    $prefix = if ($depth -eq 0) { "./" } elseif ($depth -eq 1) { "../" } else { "../../" }

    $manifestTag = "<link rel=`"manifest`" href=`"$prefix" + "manifest.json`">"
    $metaThemeTag = "<meta name=`"theme-color`" content=`"#0f172a`">"
    $metaMobileCapable = "<meta name=`"mobile-web-app-capable`" content=`"yes`">"
    $metaAppleCapable = "<meta name=`"apple-mobile-web-app-capable`" content=`"yes`">"
    $metaAppleStatus = "<meta name=`"apple-mobile-web-app-status-bar-style`" content=`"black-translucent`">"
    $metaAppleTitle = "<meta name=`"apple-mobile-web-app-title`" content=`"FC Gestão`">"
    $appleIconTag = "<link rel=`"apple-touch-icon`" href=`"$prefix" + "icons/icon-apple-touch.png`">"
    $faviconTag = "<link rel=`"icon`" type=`"image/png`" href=`"$prefix" + "icons/favicon.png`">"

    $pwaBlock = @"
    <!-- PWA Configurações e Ícones -->
    $manifestTag
    $metaThemeTag
    $metaMobileCapable
    $metaAppleCapable
    $metaAppleStatus
    $metaAppleTitle
    $appleIconTag
    $faviconTag
"@

    # Se ainda não tem manifest.json no HTML
    if ($content -notmatch 'rel="manifest"') {
        # Insere logo após o <meta name="viewport" ...>
        if ($content -match '<meta name="viewport"[^>]*>') {
            $content = $content -replace '(<meta name="viewport"[^>]*>)', "`$1`r`n$pwaBlock"
        } elseif ($content -match '<head[^>]*>') {
            $content = $content -replace '(<head[^>]*>)', "`$1`r`n$pwaBlock"
        }
    }

    if ($content -cne $original) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $updatedCount++
        Write-Host "Atualizado: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "Finalizado! $updatedCount arquivos HTML configurados para PWA." -ForegroundColor Cyan
