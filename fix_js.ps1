$content = Get-Content financeiro.js -Raw -Encoding UTF8
$idx = $content.LastIndexOf("// ====== INÍCIO CALENDÁRIO ======")
if ($idx -gt 0) {
    $content = $content.Substring(0, $idx)
    Set-Content financeiro.js $content -Encoding UTF8
}
