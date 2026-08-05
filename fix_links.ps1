$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content

        $content = $content.Replace('vendas_operação.html', 'vendas_operacao.html')
        $content = $content.Replace('vendas_operação.js', 'vendas_operacao.js')
        $content = $content.Replace('operação.html', 'operacao.html')
        $content = $content.Replace('operação.js', 'operacao.js')
        
        # also any other files I might have broken?
        # compras.html, produtos.html, etc. didn't have opera.{1,4}o in their names
        
        # also data-target="vendas_operação" should be data-target="vendas_operacao"
        $content = $content.Replace('data-target="vendas_operação"', 'data-target="vendas_operacao"')
        $content = $content.Replace('id="view-vendas_operação"', 'id="view-vendas_operacao"')

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed links in $($file.Name)"
        }
    } catch { }
}
