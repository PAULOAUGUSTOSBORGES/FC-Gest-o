$content = Get-Content compras.js -Raw -Encoding UTF8
$lines = $content -split "`n"
$depth = 0
for ($i=0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    # rough count
    # ignore quotes and comments for a very rough estimate?
    # actually let's just print lines around where depth goes negative
    $depth += ($line.ToCharArray() | Where-Object { $_ -eq '{' }).Count
    $depth -= ($line.ToCharArray() | Where-Object { $_ -eq '}' }).Count
    if ($depth -lt 0) {
        Write-Host "Possible extra closing brace at line $($i+1): $line"
        $depth = 0 # reset to keep going
    }
}
