$files = Get-ChildItem -Path "." -Include "*.html", "*.js", "*.rules" -Recurse
$map = @(
    @("$([char]0x00C3)$([char]0x00A1)", "$([char]0x00E1)"),
    @("$([char]0x00C3)$([char]0x00A2)", "$([char]0x00E2)"),
    @("$([char]0x00C3)$([char]0x00A3)", "$([char]0x00E3)"),
    @("$([char]0x00C3)$([char]0x00A7)", "$([char]0x00E7)"),
    @("$([char]0x00C3)$([char]0x00A9)", "$([char]0x00E9)"),
    @("$([char]0x00C3)$([char]0x00AA)", "$([char]0x00EA)"),
    @("$([char]0x00C3)$([char]0x00AD)", "$([char]0x00ED)"),
    @("$([char]0x00C3)$([char]0x00B3)", "$([char]0x00F3)"),
    @("$([char]0x00C3)$([char]0x00B4)", "$([char]0x00F4)"),
    @("$([char]0x00C3)$([char]0x00B5)", "$([char]0x00F5)"),
    @("$([char]0x00C3)$([char]0x00BA)", "$([char]0x00FA)"),
    @("$([char]0x00C3)$([char]0x20AC)", "$([char]0x00C0)"),
    @("$([char]0x00C3)$([char]0x0081)", "$([char]0x00C1)"),
    @("$([char]0x00C3)$([char]0x201A)", "$([char]0x00C2)"),
    @("$([char]0x00C3)$([char]0x0192)", "$([char]0x00C3)"),
    @("$([char]0x00C3)$([char]0x2021)", "$([char]0x00C7)"),
    @("$([char]0x00C3)$([char]0x2030)", "$([char]0x00C9)"),
    @("$([char]0x00C3)$([char]0x0160)", "$([char]0x00CA)"),
    @("$([char]0x00C3)$([char]0x008D)", "$([char]0x00CD)"),
    @("$([char]0x00C3)$([char]0x201C)", "$([char]0x00D3)"),
    @("$([char]0x00C3)$([char]0x201D)", "$([char]0x00D4)"),
    @("$([char]0x00C3)$([char]0x2022)", "$([char]0x00D5)"),
    @("$([char]0x00C3)$([char]0x0161)", "$([char]0x00DA)"),
    @("$([char]0x00C3)$([char]0x00A0)", "$([char]0x00E0)")
)


foreach ($file in $files) {
    if ($file.Name -eq "auto_fix.ps1" -or $file.Name -match "fix_encoding") { continue }
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $changed = $false
    foreach ($pair in $map) {
        $key = $pair[0]
        $val = $pair[1]
        if ($content.Contains($key)) {
            $content = $content.Replace($key, $val)
            $changed = $true
        }
    }
    
    if ($changed) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        Write-Output "Corrigido: $($file.Name)"
    }
}
