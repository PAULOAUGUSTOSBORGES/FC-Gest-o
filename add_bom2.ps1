$content = Get-Content 'fix_all_chars.ps1' -Raw -Encoding UTF8
$utf8BOM = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText('g:\site sistema\fix_all_chars_bom.ps1', $content, $utf8BOM)
