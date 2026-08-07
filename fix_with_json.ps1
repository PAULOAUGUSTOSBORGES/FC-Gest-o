$map = Get-Content -Raw "g:\site sistema\map.json" -Encoding UTF8 | ConvertFrom-Json
$files = Get-ChildItem -Path "g:\site sistema" -Include *.html, *.js, *.css -File -Recurse

foreach ($file in $files) {
    if ($file.Name -match "map.json") { continue }
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $changed = $false
    
    foreach ($property in $map.PSObject.Properties) {
        $key = $property.Name
        $val = $property.Value
        if ($content.Contains($key)) {
            $content = $content.Replace($key, $val)
            $changed = $true
        }
    }
    
    if ($changed) {
        Write-Host "Fixed: $($file.Name)"
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    }
}
