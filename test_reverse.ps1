$ErrorActionPreference = "Stop"

$utf8 = [System.Text.Encoding]::UTF8
$ansi = [System.Text.Encoding]::GetEncoding(1252)

function Get-AnsiMangled($text) {
    $bytes = $utf8.GetBytes($text)
    return $ansi.GetString($bytes)
}

$content = Get-Content 'vendas_operacao.html' -Raw -Encoding UTF8
$original = $content

$badSpace1 = Get-AnsiMangled " é "
$badSpace2 = Get-AnsiMangled ">é<"
$badSpace3 = Get-AnsiMangled " é"

$content = $content.Replace($badSpace1, "  ")
$content = $content.Replace($badSpace2, "><")
$content = $content.Replace($badSpace3, " ")

# Also reverse the "ação" injection
$badAcao = Get-AnsiMangled "ação"
$content = $content.Replace($badAcao, "ao")

Write-Host $content.Substring(0, 300)
