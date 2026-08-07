$files = Get-ChildItem -Path "g:\site sistema" -Include *.html, *.js, *.css -Recurse
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)
    
    $orig = $content
    
    $content = $content.Replace("Gestão", "Gest")
    $content = $content.Replace("Orçamentos", "Or")
    $content = $content.Replace("Relatórios", "Relat")
    $content = $content.Replace("Físico", "F")
    $content = $content.Replace("Histórico", "Hist")
    
    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
        Write-Host "Reverted disaster in $($f.Name)"
    }
}
Write-Host "Disaster averted!"
