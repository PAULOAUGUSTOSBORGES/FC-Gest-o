# fix_syntax_errors_v2.ps1 - Corrige TODOS os fragmentos de codigo orfaos

$base = 'g:\site sistema'

# Todos os arquivos JS que podem ter o fragmento ); orfao
$todosArquivos = Get-ChildItem -Path $base -Filter "*.js" -File | Where-Object { 
    $_.Name -notmatch "^(fix_|cleanup|refactor|test|remove_)" 
}

$totalCorrigidos = 0

foreach ($file in $todosArquivos) {
    $path = $file.FullName
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $original = $content
    
    # Padrao 1: fragmento "); " orfao com CRLF
    $content = $content.Replace("`r`n); `r`n}", "")
    
    # Padrao 2: fragmento ".catch(kardex)" orfao com CRLF  
    $content = $content.Replace("`r`n).catch(e => console.error(`"Erro ao salvar kardex:`", e));`r`n}", "")
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "CORRIGIDO: $($file.Name)" -ForegroundColor Green
        $totalCorrigidos++
    }
}

Write-Host ""
Write-Host "=== Total de arquivos corrigidos: $totalCorrigidos ===" -ForegroundColor Cyan
