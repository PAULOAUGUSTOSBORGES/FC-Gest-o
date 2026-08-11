$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($f in $files) {
    $c2 = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
    $c2 = $c2 -replace '\.js\?v=7', '.js?v=8'
    $c2 = $c2 -replace '\.css\?v=7', '.css?v=8'
    [System.IO.File]::WriteAllText($f, $c2, [System.Text.Encoding]::UTF8)
}
