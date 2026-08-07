# fix_kardex_orphans.ps1
$base = 'g:\site sistema'

$arquivos = Get-ChildItem -Path $base -Filter "*.js" -File | Where-Object { 
    $_.Name -notmatch "^(fix_|cleanup|refactor|test|remove_)" 
}

$fragmento = ");`r`n    } catch (e) {`r`n        console.error(`"Erro ao salvar Kardex`", e);`r`n    }`r`n}"

$totalCorrigidos = 0

foreach ($file in $arquivos) {
    $path = $file.FullName
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $original = $content
    
    $content = $content.Replace($fragmento, "")
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "CORRIGIDO: $($file.Name)" -ForegroundColor Green
        $totalCorrigidos++
    }
}

Write-Host ""
Write-Host "=== Total de arquivos corrigidos: $totalCorrigidos ===" -ForegroundColor Cyan
