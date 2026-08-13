$file = "g:\VERSOES DO SISTEMA\site sistema\index.js"
$content = Get-Content $file -Raw -Encoding UTF8
$lines = $content -split "`r?`n"

$start = -1
$end = -1

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "let totalPago = receber\.filter.*'PAGO'.*") {
        $start = $i
    }
}

for ($i = $start + 1; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "window\.onload = \(\) => \{") {
        $end = $i
        break
    }
}

if ($start -ne -1 -and $end -ne -1) {
    $before = $lines[0..$start]
    $after = $lines[$end..($lines.Length - 1)]
    
    $injection = @(
        "    let totalAtrasado = receber.filter(c => c.status === 'PENDENTE' && c.data && new Date(c.data).getTime() < hoje).reduce((a,b) => a + (Number(b.valor) || 0), 0);",
        "    let totalPendenteDia = receber.filter(c => c.status === 'PENDENTE' && c.data && new Date(c.data).getTime() >= hoje).reduce((a,b) => a + (Number(b.valor) || 0), 0);",
        "",
        "    chartInadimplencia.updateSeries([",
        "        { name: 'Recebidos', data: [totalPago] },",
        "        { name: 'Em Atraso', data: [totalAtrasado] },",
        "        { name: 'A Vencer', data: [totalPendenteDia] }",
        "    ]);",
        "}",
        ""
    )
    
    $newLines = $before + $injection + $after
    $newContent = $newLines -join "`r`n"
    Set-Content -Path $file -Value $newContent -Encoding UTF8
    Write-Host "Fixed index.js, removed lines from $($start + 1) to $($end - 1)"
} else {
    Write-Host "Could not find start or end bounds"
}
