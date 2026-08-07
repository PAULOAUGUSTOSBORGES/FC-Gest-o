$files = Get-ChildItem -Path "g:\site sistema" -Include *.html, *.js, *.css -Recurse

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$c = [char]0xFFFD

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)
    
    $content = $content.Replace("Opera$c$co", "Operação")
    $content = $content.Replace("opera$c$co", "operação")
    $content = $content.Replace("OPERA$c$cO", "OPERAÇÃO")
    $content = $content.Replace("Hist$crico", "Histórico")
    $content = $content.Replace("F$csico", "Físico")
    $content = $content.Replace("Relat$crios", "Relatórios")
    $content = $content.Replace("Or$camentos", "Orçamentos")
    $content = $content.Replace("Configura$c$ces", "Configurações")
    $content = $content.Replace("A$c$co", "Ação")
    $content = $content.Replace("a$c$co", "ação")
    $content = $content.Replace("Gest$co", "Gestão")
    $content = $content.Replace("Funcion$crios", "Funcionários")
    
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A7)", "$([char]0x00E7)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A1)", "$([char]0x00E1)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A2)", "$([char]0x00E2)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A3)", "$([char]0x00E3)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A4)", "$([char]0x00E4)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A9)", "$([char]0x00E9)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00AA)", "$([char]0x00EA)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00AD)", "$([char]0x00ED)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00B3)", "$([char]0x00F3)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00B4)", "$([char]0x00F4)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00B5)", "$([char]0x00F5)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00BA)", "$([char]0x00FA)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0081)", "$([char]0x00C1)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0082)", "$([char]0x00C2)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0083)", "$([char]0x00C3)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0084)", "$([char]0x00C4)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0089)", "$([char]0x00C9)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x008A)", "$([char]0x00CA)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x008D)", "$([char]0x00CD)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0093)", "$([char]0x00D3)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0094)", "$([char]0x00D4)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0095)", "$([char]0x00D5)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x009A)", "$([char]0x00DA)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0087)", "$([char]0x00C7)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A0)", "$([char]0x00E0)")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0080)", "$([char]0x00C0)")
    $content = $content.Replace("$([char]0x00C2)$([char]0x00BA)", "$([char]0x00BA)")
    $content = $content.Replace("$([char]0x00C2)$([char]0x00AA)", "$([char]0x00AA)")

    if ($content -ne [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)) {
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
        Write-Host "Fixed encoding in $($f.Name)"
    }
}
Write-Host "Done!"
