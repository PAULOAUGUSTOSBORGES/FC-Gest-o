$files = @("compras.js", "financeiro.js", "gestao.js")
foreach ($file in $files) {
    if (Test-Path $file) {
        $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
        
        # Replace the mangled variables directly matching 'qtdLan' and 'amentos'
        $c = [System.Text.RegularExpressions.Regex]::Replace($c, 'qtdLan.*?amentos', 'qtdLancamentos')
        
        [System.IO.File]::WriteAllText((Get-Item $file).FullName, $c, [System.Text.Encoding]::UTF8)
    }
}
