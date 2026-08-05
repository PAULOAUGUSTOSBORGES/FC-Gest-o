$ErrorActionPreference = "Stop"

function Extract-View {
    param(
        [string]$HtmlContent,
        [string]$ViewName
    )
    
    $viewId = "id=""view-$ViewName"""
    $startIdx = $HtmlContent.IndexOf($viewId)
    if ($startIdx -eq -1) { return $null }
    
    # Encontra o inicio da div
    $divStart = $HtmlContent.LastIndexOf("<div", $startIdx)
    
    # Contagem de tags para encontrar o final da div principal
    $tagCount = 0
    $i = $divStart
    $endIdx = -1
    
    while ($i -lt $HtmlContent.Length) {
        $nextDivStart = $HtmlContent.IndexOf("<div", $i)
        $nextDivEnd = $HtmlContent.IndexOf("</div", $i)
        
        if ($nextDivStart -ne -1 -and $nextDivStart -lt $nextDivEnd) {
            $tagCount++
            $i = $nextDivStart + 4
        } elseif ($nextDivEnd -ne -1) {
            $tagCount--
            $i = $nextDivEnd + 5
            if ($tagCount -eq 0) {
                $endIdx = $HtmlContent.IndexOf(">", $i) + 1
                break
            }
        } else {
            break
        }
    }
    
    if ($endIdx -ne -1) {
        $extracted = $HtmlContent.Substring($divStart, $endIdx - $divStart)
        
        # Corrige class hidden para active
        $extracted = $extracted -replace 'class="([^"]*)hidden([^"]*)"', 'class="$1active$2"'
        if ($extracted -match 'view-section' -and $extracted -notmatch 'active') {
            $extracted = $extracted -replace 'class="', 'class="active '
        }
        return $extracted
    }
    return $null
}

$filesToProcess = @(
    @{ Html = 'cadastro.html'; Js = 'cadastro.js'; Views = @('produtos', 'clientes', 'fornecedores', 'funcionarios', 'estoque') },
    @{ Html = 'gestao.html'; Js = 'gestao.js'; Views = @('financeiro', 'compras', 'relatorios') },
    @{ Html = 'operacao.html'; Js = 'operacao.js'; Views = @('pdv', 'orcamentos') }
)

foreach ($cfg in $filesToProcess) {
    if (-not (Test-Path $cfg.Html) -or -not (Test-Path $cfg.Js)) {
        Write-Host "Skipping $($cfg.Html)"
        continue
    }
    
    $htmlContent = Get-Content -Path $cfg.Html -Raw -Encoding UTF8
    $jsContent = Get-Content -Path $cfg.Js -Raw -Encoding UTF8
    
    $extractedViews = @{}
    foreach ($view in $cfg.Views) {
        $ext = Extract-View -HtmlContent $htmlContent -ViewName $view
        if ($ext) {
            $extractedViews[$view] = $ext
        }
    }
    
    foreach ($view in $cfg.Views) {
        if (-not $extractedViews.ContainsKey($view)) {
            Write-Host "View $view not found in $($cfg.Html)"
            continue
        }
        
        $newHtml = $htmlContent
        foreach ($otherView in $cfg.Views) {
            if ($otherView -ne $view -and $extractedViews.ContainsKey($otherView)) {
                $newHtml = $newHtml.Replace($extractedViews[$otherView], "")
            }
        }
        
        $newHtml = $newHtml.Replace("<script src=""$($cfg.Js)""></script>", "<script src=""$view.js""></script>")
        $newHtml = $newHtml -replace "<title>.*?</title>", "<title>FC Móveis - $( $view.ToUpper() )</title>"
        
        # Remove multiple empty lines
        $newHtml = $newHtml -replace '(?m)^\s*$', ""
        
        [IO.File]::WriteAllText("$PWD\$view.html", $newHtml, [System.Text.Encoding]::UTF8)
        
        $newJs = $jsContent
        
        # JS modifications
        if ($cfg.Js -eq 'operacao.js') {
            $newJs = $newJs -replace "const view = urlParams\.get\('view'\) \|\| 'pdv';\s*mudarVisaoLocal\(view\);", "mudarVisaoLocal('$view');"
        } else {
            # cadastro.js / gestao.js
            $newJs = $newJs -replace "const urlParams = new URLSearchParams\(window\.location\.search\);\s*const view = urlParams\.get\('view'\);\s*mudarVisaoLocal\(view \|\| '.*?'\);", "mudarVisaoLocal('$view');"
            $newJs = $newJs -replace "const urlParams = new URLSearchParams\(window\.location\.search\);\s*const view = urlParams\.get\('view'\) \|\| '.*?';\s*mudarVisaoLocal\(view\);", "mudarVisaoLocal('$view');"
        }
        
        [IO.File]::WriteAllText("$PWD\$view.js", $newJs, [System.Text.Encoding]::UTF8)
        Write-Host "Created $view.html and $view.js"
    }
}

$allHtmlFiles = Get-ChildItem -Filter *.html
$replacements = @(
    @{ Old = 'cadastro.html?view=produtos'; New = 'produtos.html' },
    @{ Old = 'cadastro.html?view=clientes'; New = 'clientes.html' },
    @{ Old = 'cadastro.html?view=fornecedores'; New = 'fornecedores.html' },
    @{ Old = 'cadastro.html?view=funcionarios'; New = 'funcionarios.html' },
    @{ Old = 'cadastro.html?view=estoque'; New = 'estoque.html' },
    @{ Old = 'gestao.html?view=financeiro'; New = 'financeiro.html' },
    @{ Old = 'gestao.html?view=compras'; New = 'compras.html' },
    @{ Old = 'gestao.html?view=relatorios'; New = 'relatorios.html' },
    @{ Old = 'operacao.html?view=pdv'; New = 'pdv.html' },
    @{ Old = 'operacao.html?view=orcamentos'; New = 'orcamentos.html' },
    @{ Old = 'operacao.html?view=historico'; New = 'vendas_operacao.html' },
    @{ Old = 'gestao.html?view=vendas'; New = 'vendas_gestao.html' }
)

foreach ($file in $allHtmlFiles) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $changed = $false
    
    foreach ($rep in $replacements) {
        if ($content.Contains($rep.Old)) {
            $content = $content.Replace($rep.Old, $rep.New)
            $changed = $true
        }
    }
    
    if ($changed) {
        [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Updated links in $($file.Name)"
    }
}

Write-Host "Refactoring completed successfully."
