$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content

        $content = $content.Replace("Opera$([char]0xFFFD)$([char]0x01DC)o", "Operação")
        $content = $content.Replace("opera$([char]0xFFFD)$([char]0x01DC)o", "operação")
        
        $content = $content.Replace("Opera$([char]0xFFFD)ǜo", "Operação")
        $content = $content.Replace("opera$([char]0xFFFD)ǜo", "operação")

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed Opera in $($file.Name)"
        }
    } catch { }
}
