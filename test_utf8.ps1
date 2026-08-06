function Is-Utf8 {
    param([byte[]]$bytes)
    try {
        $utf8 = New-Object System.Text.UTF8Encoding $false, $true
        $utf8.GetString($bytes) | Out-Null
        return $true
    } catch {
        return $false
    }
}
$global = [System.IO.File]::ReadAllBytes('g:\site sistema\global.js')
$op = [System.IO.File]::ReadAllBytes('g:\site sistema\operacao.js')
Write-Host "global.js is UTF8: $((Is-Utf8 $global))"
Write-Host "operacao.js is UTF8: $((Is-Utf8 $op))"
