$files = @("g:\VERSOES DO SISTEMA\site sistema\gestao.js", "g:\VERSOES DO SISTEMA\site sistema\relatorios.js")
foreach ($file in $files) {
    $content = Get-Content -Path $file -Raw -Encoding UTF8
    
    # 1. Add rankingFavorecidos declaration
    $target1 = 'const rankingCentros = {};'
    $replace1 = $target1 + "`ni`   const rankingFavorecidos = {};"
    if (-not $content.Contains("const rankingFavorecidos = {};")) {
        $content = $content -replace [regex]::Escape($target1), $replace1
    }

    # 2. Add rankingFavorecidos sum logic
    $target2 = 'const val = parseFloat(f.valor || 0);'
    $replace2 = $target2 + "`n`n        const pessoa = f.pessoa || 'Sem Nome / Não Informado';`n        if (!rankingFavorecidos[pessoa]) rankingFavorecidos[pessoa] = 0;`n        rankingFavorecidos[pessoa] += val;"
    if (-not $content.Contains("rankingFavorecidos[pessoa] += val;")) {
        $content = $content -replace [regex]::Escape($target2), $replace2
    }

    # 3. Add rankingFavorecidos rendering
    $target3 = 'const ctcEl = document.getElementById('bi-despesas-centro-custo');'
    $replace3 = @"
    const favEl = document.getElementById('bi-despesas-favorecido');
    if (favEl) {
        if (Object.keys(rankingFavorecidos).length > 0) {
            favEl.innerHTML = Object.keys(rankingFavorecidos)
                .map(k => ({nome: k, val: rankingFavorecidos[k]}))
                .sort((a,b) => b.val - a.val)
                .map((c, i) => `<div class="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1"><span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200">${i+1}. ${c.nome}</span><span class="font-bold text-indigo-500 dark:text-indigo-400">${formatMoney(c.val)}</span></div>`)
                .join('');
        } else {
            favEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhuma despesa no período</div>';
        }
    }
    
"@  + $target3
    if (-not $content.Contains("bi-despesas-favorecido")) {
        $content = $content -replace [regex]::Escape($target3), $replace3
    }

    Set-Content -Path $file -Value $content -Encoding UTF8
    Write-Host "Atualizado Javascript em $file"
}