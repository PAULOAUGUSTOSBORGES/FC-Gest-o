$files = Get-ChildItem -Path "g:\site sistema" -Include *.js -File -Recurse

$regex_async = [regex]::new("(?s)async function salvarKardex.*?\}")
$regex_sync = [regex]::new("(?s)function salvarKardex.*?\}")

foreach ($file in $files) {
    if ($file.Name -match "global.js") { continue }
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $new_content = $content
    
    if ($new_content -match $regex_async) {
        $new_content = $regex_async.Replace($new_content, "")
    }
    if ($new_content -match $regex_sync) {
        $new_content = $regex_sync.Replace($new_content, "")
    }
    
    if ($new_content -ne $content) {
        Write-Host "Removed salvarKardex from: $($file.Name)"
        [System.IO.File]::WriteAllText($file.FullName, $new_content, [System.Text.Encoding]::UTF8)
    }
}
