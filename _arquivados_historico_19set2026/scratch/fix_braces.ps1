param()
# Verifica e corrige o duplo }} nos arquivos modificados

$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"
$arquivos = @('compras.js', 'vendas_gestao.js', 'caixa.js', 'relatorios_v2.js', 'financeiro.js', 'pdv.js')

foreach ($arquivo in $arquivos) {
    $path = Join-Path $baseDir $arquivo
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    
    $fixCount = 0
    
    # Procura pelo padrão problemático: });
    # seguido por }} em vez de }
    # Padrão: qualquer linha com }); depois }} na próxima linha
    
    # Verifica se tem o problema
    if ($content.Contains("});`n}}") -or $content.Contains("});`r`n}}")) {
        $content = $content.Replace("});`r`n}}", "});`r`n}")
        $content = $content.Replace("});`n}}", "});`n}")
        $fixCount++
    }
    
    if ($fixCount -gt 0) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "CORRIGIDO: $arquivo"
    } else {
        Write-Host "OK: $arquivo"
    }
}

Write-Host "Concluido!"
