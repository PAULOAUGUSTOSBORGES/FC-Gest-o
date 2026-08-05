$content = Get-Content 'undo.ps1' -Raw -Encoding UTF8
$utf8BOM = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText('g:\site sistema\undo_bom.ps1', $content, $utf8BOM)
