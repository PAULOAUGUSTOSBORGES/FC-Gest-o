Copy-Item "gestao.html" -Destination "financeiro.html" -Force
$c = [System.IO.File]::ReadAllText("$pwd\financeiro.html", [System.Text.Encoding]::UTF8)
$c = $c.Replace("gestao.js", "financeiro.js")
[System.IO.File]::WriteAllText("$pwd\financeiro.html", $c, [System.Text.Encoding]::UTF8)
