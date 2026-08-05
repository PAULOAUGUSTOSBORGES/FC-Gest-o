$c = Get-Content 'vendas_operacao.html' -Raw -Encoding UTF8
$index = $c.IndexOf("vendas_operaca")
if ($index -ge 0) {
    $chars = $c.Substring($index, 20).ToCharArray()
    foreach($ch in $chars) {
        Write-Host ("{0:X4} - {1}" -f [int]$ch, $ch)
    }
}
