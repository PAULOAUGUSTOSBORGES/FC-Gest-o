$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$content = $content.Replace("Este MÃªs", "Este Mês")
$content = $content.Replace("PrÃ³ximos", "Próximos")
$content = $content.Replace("HistÃ³rico", "Histórico")

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
