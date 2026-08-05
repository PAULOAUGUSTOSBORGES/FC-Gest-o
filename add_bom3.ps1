$content = Get-Content 'fix_links.ps1' -Raw -Encoding UTF8
$utf8BOM = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText('g:\site sistema\fix_links.ps1', $content, $utf8BOM)
