$files = Get-ChildItem -Path "g:\site sistema" -Include *.html, *.js, *.css -File -Recurse

$replacements = [ordered]@{
    'Ã§Ã£o' = 'ção'
    'Ã§Ãµes' = 'ções'
    'Ã§' = 'ç'
    'Ã¡' = 'á'
    'Ã¢' = 'â'
    'Ã£' = 'ã'
    'Ã©' = 'é'
    'Ãª' = 'ê'
    'Ã­' = 'í'
    'Ã³' = 'ó'
    'Ã´' = 'ô'
    'Ãµ' = 'õ'
    'Ãº' = 'ú'
    'Ã‡' = 'Ç'
    'Ãƒ' = 'Ã'
    'Ã•' = 'Õ'
    'Ã‰' = 'É'
    'Ã“' = 'Ó'
    'Ãš' = 'Ú'
    'Ã‚' = 'Â'
}

foreach ($file in $files) {
    if ($file.Name -match 'fix_mojibake') { continue }
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $changed = $false
    foreach ($key in $replacements.Keys) {
        if ($content.Contains($key)) {
            $content = $content.Replace($key, $replacements[$key])
            $changed = $true
        }
    }
    if ($changed) {
        Write-Host "Fixed: $($file.Name)"
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    }
}
