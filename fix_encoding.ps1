$files = Get-ChildItem -Path "." -Include "*.html", "*.js", "*.rules" -Recurse
$map = @{
    "$([char]0x00C3)$([char]0x00A1)" = "á"
    "$([char]0x00C3)$([char]0x00A2)" = "â"
    "$([char]0x00C3)$([char]0x00A3)" = "ã"
    "$([char]0x00C3)$([char]0x00A7)" = "ç"
    "$([char]0x00C3)$([char]0x00A9)" = "é"
    "$([char]0x00C3)$([char]0x00AA)" = "ê"
    "$([char]0x00C3)$([char]0x00AD)" = "í"
    "$([char]0x00C3)$([char]0x00B3)" = "ó"
    "$([char]0x00C3)$([char]0x00B4)" = "ô"
    "$([char]0x00C3)$([char]0x00B5)" = "õ"
    "$([char]0x00C3)$([char]0x00BA)" = "ú"
    "$([char]0x00C3)$([char]0x20AC)" = "À"
    "$([char]0x00C3)$([char]0x0081)" = "Á"
    "$([char]0x00C3)$([char]0x201A)" = "Â"
    "$([char]0x00C3)$([char]0x0192)" = "Ã"
    "$([char]0x00C3)$([char]0x2021)" = "Ç"
    "$([char]0x00C3)$([char]0x2030)" = "É"
    "$([char]0x00C3)$([char]0x0160)" = "Ê"
    "$([char]0x00C3)$([char]0x008D)" = "Í"
    "$([char]0x00C3)$([char]0x201C)" = "Ó"
    "$([char]0x00C3)$([char]0x201D)" = "Ô"
    "$([char]0x00C3)$([char]0x2022)" = "Õ"
    "$([char]0x00C3)$([char]0x0161)" = "Ú"
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    foreach ($key in $map.Keys) {
        $content = $content.Replace($key, $map[$key])
    }
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
}
Write-Host "Replaced encodings!"
