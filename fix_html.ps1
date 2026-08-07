$base = 'g:\site sistema'
$htmlFiles = Get-ChildItem -Path $base -Filter '*.html' -File

foreach ($f in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    $viewName = $f.BaseName
    
    if ($content -match 'id="view-') {
        # Para todos os class="view-section ...", garantir que tenham "hidden" e não tenham "active"
        $content = [regex]::Replace($content, 'class="view-section([^"]*)"', {
            param($m)
            $c = $m.Groups[1].Value
            $c = $c -replace '\bactive\b', ''
            if ($c -notmatch '\bhidden\b') { $c += ' hidden' }
            $c = $c -replace '\s+', ' '
            return 'class="view-section ' + $c.Trim() + '"'
        })
        
        # Agora para a section específica do arquivo atual, remover "hidden" e colocar "active"
        $pattern = 'id="view-' + $viewName + '" class="view-section([^"]*)"'
        $content = [regex]::Replace($content, $pattern, {
            param($m)
            $c = $m.Groups[1].Value
            $c = $c -replace '\bhidden\b', ''
            if ($c -notmatch '\bactive\b') { $c += ' active' }
            $c = $c -replace '\s+', ' '
            return 'id="view-' + $viewName + '" class="view-section ' + $c.Trim() + '"'
        })
        
        [System.IO.File]::WriteAllText($f.FullName, $content, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "Processado HTML: $($f.Name)" -ForegroundColor Green
    }
}
Write-Host "Concluído"
