$text = "NÃ£o (Ãšnica) DESCRIÃ‡ÃƒO DA DESPESA/RECEITA"
$win1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8 = [System.Text.Encoding]::UTF8

$originalBytes = $win1252.GetBytes($text)
$recoveredText = $utf8.GetString($originalBytes)

Write-Host "Recovered: $recoveredText"
