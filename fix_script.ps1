$ErrorActionPreference = "Stop"
$vendas = Get-Content "vendas_operacao.html" -Raw -Encoding UTF8
$vendas = $vendas -replace '<script src="operacao.js"></script>', '<script src="vendas_operacao.js"></script>'
[IO.File]::WriteAllText("$PWD\vendas_operacao.html", $vendas, [System.Text.Encoding]::UTF8)
Write-Host "Replaced operacao.js with vendas_operacao.js"
