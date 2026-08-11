$content = Get-Content -Raw 'compras.js'
$open = ($content.ToCharArray() | Where-Object { $_ -eq '{' }).Count
$close = ($content.ToCharArray() | Where-Object { $_ -eq '}' }).Count
Write-Host "Open braces: $open"
Write-Host "Close braces: $close"
