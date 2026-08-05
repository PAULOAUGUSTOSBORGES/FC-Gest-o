$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content

        $content = [regex]::Replace($content, 'Opera[^\x20-\x7E]+o', 'Operação')
        $content = [regex]::Replace($content, 'opera[^\x20-\x7E]+o', 'operação')
        $content = [regex]::Replace($content, 'M[^\x20-\x7E]+veis', 'Móveis')
        $content = [regex]::Replace($content, 'm[^\x20-\x7E]+veis', 'móveis')
        
        # If there are any stray "??", wait we don't have literal "??"
        # Let's fix the few remaining that might have failed because of case or something:
        $content = [regex]::Replace($content, 'Aten[^\x20-\x7E]+o', 'Atenção')
        $content = [regex]::Replace($content, 'aten[^\x20-\x7E]+o', 'atenção')

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed in $($file.Name)"
        }
    } catch { }
}
