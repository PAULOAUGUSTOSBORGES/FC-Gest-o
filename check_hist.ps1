$c = Get-Content 'vendas_operacao.html' -Raw -Encoding UTF8
$index = $c.IndexOf("Hist")
if ($index -ge 0) {
    $chars = $c.Substring($index, 15).ToCharArray()
    foreach($ch in $chars) {
        Write-Host ("{0:X4} - {1}" -f [int]$ch, $ch)
    }
}
