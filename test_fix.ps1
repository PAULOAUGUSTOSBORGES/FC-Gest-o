$content = Get-Content 'vendas_operacao.html' -Raw -Encoding UTF8
$content = $content.Replace("Ã©", "")
$content = $content.Replace("Ǹ", "")
Write-Host $content.Substring(0, 200)
