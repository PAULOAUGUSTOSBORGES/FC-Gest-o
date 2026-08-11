$files = @("financeiro.html", "gestao.html", "compras.html", "relatorios.html", "vendas_gestao.html")

foreach ($f in $files) {
    if (Test-Path $f) {
        $c = [System.IO.File]::ReadAllText("$pwd\$f", [System.Text.Encoding]::UTF8)
        $c = [System.Text.RegularExpressions.Regex]::Replace($c, 'Referente .*? NF', 'Referente à NF')
        $c = $c.Replace("SerÃ¡ cadastrado automaticamente ao salvar.", "Será cadastrado automaticamente ao salvar.")
        [System.IO.File]::WriteAllText("$pwd\$f", $c, [System.Text.Encoding]::UTF8)
    }
}
