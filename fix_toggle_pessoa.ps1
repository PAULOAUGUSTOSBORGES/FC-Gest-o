$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    # Fix the broken function call caused by greedy regex
    $c = [System.Text.RegularExpressions.Regex]::Replace($c, 'toggleCont.*?essoaInput', 'toggleContaPessoaInput')

    [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
}
