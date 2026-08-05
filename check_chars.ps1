$content = Get-Content 'vendas_operacao.html' -Raw -Encoding UTF8
$index = $content.IndexOf("nav-btn")
$chars = $content.Substring($index, 20).ToCharArray()
foreach($ch in $chars) {
    Write-Host ("{0:X4} - {1}" -f [int]$ch, $ch)
}
