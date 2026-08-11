$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    # Update cache buster to force browsers to load the fixed scripts
    $c = $c -replace '\.js\?v=4', '.js?v=5'
    $c = $c -replace '\.css\?v=4', '.css?v=5'
    $c = $c -replace '\.js\?v=\d+', '.js?v=5'
    $c = $c -replace '\.css\?v=\d+', '.css?v=5'

    [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
}
