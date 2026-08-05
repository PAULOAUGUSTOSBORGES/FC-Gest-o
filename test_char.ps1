$content = Get-Content 'vendas_operacao.html' -Raw -Encoding UTF8
$bad = [string]([char]0x00C3) + [string]([char]0x00A9)
$content = $content.Replace($bad, "")
Write-Host $content.Substring(0, 300)
