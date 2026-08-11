$files = Get-ChildItem "*.html", "*.js" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    # Fix the font-awesome issue
    $c = $c -replace 'font-Açõesome', 'font-awesome'
    $c = $c -replace 'font-A..esome', 'font-awesome'
    
    # Fix the missing initializer syntax error caused by Mojibake in JS variable names
    $c = [System.Text.RegularExpressions.Regex]::Replace($c, 'qtdLan.amentos', 'qtdLancamentos')
    
    # Fix the string concatenation typo in financeiro.js and others
    $c = $c -replace '"/"" \+ qtdLancamentos', '"/" + qtdLancamentos'
    
    # Any stray 'SuGestão' back to 'Sugestão' (case sensitive)
    $c = $c -creplace 'SuGestão', 'Sugestão'

    [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
}
