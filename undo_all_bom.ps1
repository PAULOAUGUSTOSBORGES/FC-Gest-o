function Get-Mangled($text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    return [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
}

$words = @(
    "Operação", "operação",
    "Atenção", "atenção",
    "Cód", "cód",
    "Câmera", "câmera",
    "CONFIRMAÇÃO", "confirmação",
    "CONTEÚDO", "conteúdo",
    "dígitos", "Dígitos",
    "EMISSÃO", "emissão",
    "Móveis", "móveis",
    "ORÇAMENTO", "orçamento",
    "ORÇAMENTOS", "orçamentos",
    "Padrão", "padrão",
    "Razão", "razão",
    "RÁPIDO", "rápido",
    "Será", "será",
    "SERVIÇO", "serviço",
    "SERVIÇOS", "serviços",
    "Histórico", "histórico",
    "Ação", "ação",
    "Ações", "ações"
)

$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content

        foreach ($word in $words) {
            $mangled = Get-Mangled $word
            $content = $content.Replace($mangled, $word)
        }

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed in $($file.Name)"
        }
    } catch { }
}
