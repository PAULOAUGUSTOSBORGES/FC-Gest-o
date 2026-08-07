$files = Get-ChildItem -Path "g:\site sistema" -Include *.html, *.js, *.css -Recurse
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)
    
    $orig = $content
    
    $content = $content.Replace("Gest$([char]0x00E3)o", "Gest")
    $content = $content.Replace("Or$([char]0x00E7)amentos", "Or")
    $content = $content.Replace("Relat$([char]0x00F3)rios", "Relat")
    $content = $content.Replace("F$([char]0x00ED)sico", "F")
    $content = $content.Replace("Hist$([char]0x00F3)rico", "Hist")
    
    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
        Write-Host "Reverted disaster in $($f.Name)"
    }
}
Write-Host "Disaster averted!"
