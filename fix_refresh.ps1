$ErrorActionPreference = "Stop"

$jsFixes = @(
    @{ File = 'financeiro.js'; View = 'financeiro' },
    @{ File = 'relatorios.js'; View = 'relatorios' }
)

foreach ($item in $jsFixes) {
    if (Test-Path $item.File) {
        $content = Get-Content -Path $item.File -Raw -Encoding UTF8
        
        # Replace refreshCurrentView
        $content = $content -replace "(?s)(function refreshCurrentView\(\)\s*\{.*?let view = urlParams\.get\('view'\);\s*if \(\!view\) view = ').*?(';\s*mudarVisaoLocal\(view\);\s*\})", "`$1$($item.View)`$2"
        
        [IO.File]::WriteAllText("$PWD\$($item.File)", $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed JS: $($item.File)"
    }
}
