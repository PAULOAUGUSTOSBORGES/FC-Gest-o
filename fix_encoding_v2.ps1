$replacements = [ordered]@{
    [char]0xC3 + [char]0xA1 = 'á';
    [char]0xC3 + [char]0xA2 = 'â';
    [char]0xC3 + [char]0xA3 = 'ã';
    [char]0xC3 + [char]0xA4 = 'ä';
    [char]0xC3 + [char]0xA9 = 'é';
    [char]0xC3 + [char]0xAA = 'ê';
    [char]0xC3 + [char]0xAD = 'í';
    [char]0xC3 + [char]0xB3 = 'ó';
    [char]0xC3 + [char]0xB4 = 'ô';
    [char]0xC3 + [char]0xB5 = 'õ';
    [char]0xC3 + [char]0xBA = 'ú';
    [char]0xC3 + [char]0xA7 = 'ç';
    [char]0xC3 + [char]0x81 = 'Á';
    [char]0xC3 + [char]0x82 = 'Â';
    [char]0xC3 + [char]0x83 = 'Ã';
    [char]0xC3 + [char]0x84 = 'Ä';
    [char]0xC3 + [char]0x89 = 'É';
    [char]0xC3 + [char]0x8A = 'Ê';
    [char]0xC3 + [char]0x8D = 'Í';
    [char]0xC3 + [char]0x93 = 'Ó';
    [char]0xC3 + [char]0x94 = 'Ô';
    [char]0xC3 + [char]0x95 = 'Õ';
    [char]0xC3 + [char]0x9A = 'Ú';
    [char]0xC3 + [char]0x87 = 'Ç';
    [char]0xC3 + [char]0xA0 = 'à';
    [char]0xC3 + [char]0x80 = 'À';
    [char]0xC2 + [char]0xBA = 'º';
    [char]0xC2 + [char]0xAA = 'ª';
    "Ã§Ã£o" = "ção";
    "Ã§Ãµes" = "ções";
}

$files = Get-ChildItem -Path "g:\site sistema" -Include *.html, *.js, *.css -Recurse

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($f in $files) {
    # Read as UTF-8
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)
    
    $changed = $false
    
    # Run specific regexes first for the broken ï¿½ sequences
    $content = $content -replace "Operaï¿½ï¿½o", "Operação"
    $content = $content -replace "operaï¿½ï¿½o", "operação"
    $content = $content -replace "OPERAï¿½ï¿½O", "OPERAÇÃO"
    $content = $content -replace "Histï¿½rico", "Histórico"
    $content = $content -replace "Fï¿½sico", "Físico"
    $content = $content -replace "Relatï¿½rios", "Relatórios"
    $content = $content -replace "Orï¿½amentos", "Orçamentos"
    $content = $content -replace "Configuraï¿½ï¿½es", "Configurações"
    $content = $content -replace "Aï¿½ï¿½o", "Ação"
    $content = $content -replace "aï¿½ï¿½o", "ação"
    $content = $content -replace "Gestï¿½o", "Gestão"
    $content = $content -replace "Funcionï¿½rios", "Funcionários"
    
    foreach ($key in $replacements.Keys) {
        if ($content.Contains($key)) {
            $content = $content.Replace($key, $replacements[$key])
            $changed = $true
        }
    }
    
    # Verify if any specific literal remains
    $content = $content.Replace("OperaÃ§Ã£o", "Operação")
    
    if ($changed -or $content -ne [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)) {
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
        Write-Host "Fixed: $($f.Name)"
    }
}
