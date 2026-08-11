$text = "NÃ£o"
$win1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8 = [System.Text.Encoding]::UTF8

$bytes = $win1252.GetBytes($text)
Write-Host "Bytes:"
foreach ($b in $bytes) { Write-Host "$b" }

$recoveredText = $utf8.GetString($bytes)
Write-Host "Recovered bytes:"
$b2 = $utf8.GetBytes($recoveredText)
foreach ($b in $b2) { Write-Host "$b" }

[System.IO.File]::WriteAllText("$(Get-Location)\test_out2.txt", $recoveredText, $utf8)
