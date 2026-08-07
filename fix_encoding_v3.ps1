$files = Get-ChildItem -Path "g:\site sistema" -Include *.html, *.js, *.css -Recurse

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)
    
    # "ï¿½" -> U+FFFD
    $content = $content.Replace("Opera$([char]0xFFFD)$([char]0xFFFD)o", "Operação")
    $content = $content.Replace("opera$([char]0xFFFD)$([char]0xFFFD)o", "operação")
    $content = $content.Replace("OPERA$([char]0xFFFD)$([char]0xFFFD)O", "OPERAÇÃO")
    $content = $content.Replace("Hist$([char]0xFFFD)rico", "Histórico")
    $content = $content.Replace("F$([char]0xFFFD)sico", "Físico")
    $content = $content.Replace("Relat$([char]0xFFFD)rios", "Relatórios")
    $content = $content.Replace("Or$([char]0xFFFD)amentos", "Orçamentos")
    $content = $content.Replace("Configura$([char]0xFFFD)$([char]0xFFFD)es", "Configurações")
    $content = $content.Replace("A$([char]0xFFFD)$([char]0xFFFD)o", "Ação")
    $content = $content.Replace("a$([char]0xFFFD)$([char]0xFFFD)o", "ação")
    $content = $content.Replace("Gest$([char]0xFFFD)o", "Gestão")
    $content = $content.Replace("Funcion$([char]0xFFFD)rios", "Funcionários")
    
    # "Ã§Ã£o" etc
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A7)$([char]0x00C3)$([char]0x00A3)o", "ção")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A7)$([char]0x00C3)$([char]0x00B5)es", "ções")
    
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A1)", "á")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A2)", "â")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A3)", "ã")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A4)", "ä")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A9)", "é")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00AA)", "ê")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00AD)", "í")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00B3)", "ó")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00B4)", "ô")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00B5)", "õ")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00BA)", "ú")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A7)", "ç")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0081)", "Á")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0082)", "Â")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0083)", "Ã")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0084)", "Ä")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0089)", "É")
    $content = $content.Replace("$([char]0x00C3)$([char]0x008A)", "Ê")
    $content = $content.Replace("$([char]0x00C3)$([char]0x008D)", "Í")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0093)", "Ó")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0094)", "Ô")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0095)", "Õ")
    $content = $content.Replace("$([char]0x00C3)$([char]0x009A)", "Ú")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0087)", "Ç")
    $content = $content.Replace("$([char]0x00C3)$([char]0x00A0)", "à")
    $content = $content.Replace("$([char]0x00C3)$([char]0x0080)", "À")
    $content = $content.Replace("$([char]0x00C2)$([char]0x00BA)", "º")
    $content = $content.Replace("$([char]0x00C2)$([char]0x00AA)", "ª")
    
    if ($content -ne [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)) {
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
        Write-Host "Fixed encoding in $($f.Name)"
    }
}
