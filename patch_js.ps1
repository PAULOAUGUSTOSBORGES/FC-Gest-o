$jsInjection = @"

    let despesas = db.financeiro ? db.financeiro.filter(f => f.tipo === 'DESPESA' && f.status !== 'CANCELADO') : [];
    if (periodo) {
        despesas = despesas.filter(f => {
            const dataF = new Date(f.data);
            return dataF >= periodo.inicio && dataF <= periodo.fim;
        });
    }
    
    const rankingCategorias = {};
    const rankingCentros = {};
    
    despesas.forEach(f => {
        const cat = f.categoria || 'Sem Categoria';
        const ctc = f.centroCusto || 'Sem Centro de Custo';
        const val = parseFloat(f.valor || 0);
        
        if (!rankingCategorias[cat]) rankingCategorias[cat] = 0;
        rankingCategorias[cat] += val;
        
        if (!rankingCentros[ctc]) rankingCentros[ctc] = 0;
        rankingCentros[ctc] += val;
    });
    
    const catEl = document.getElementById('bi-despesas-categoria');
    if (catEl) {
        if (Object.keys(rankingCategorias).length > 0) {
            catEl.innerHTML = Object.keys(rankingCategorias)
                .map(k => ({nome: k, val: rankingCategorias[k]}))
                .sort((a,b) => b.val - a.val)
                .map((c, i) => `<div class="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1"><span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200">${i+1}. ${c.nome}</span><span class="font-bold text-red-500 dark:text-red-400">${formatMoney(c.val)}</span></div>`)
                .join('');
        } else {
            catEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhuma despesa no período</div>';
        }
    }
    
    const ctcEl = document.getElementById('bi-despesas-centro-custo');
    if (ctcEl) {
        if (Object.keys(rankingCentros).length > 0) {
            ctcEl.innerHTML = Object.keys(rankingCentros)
                .map(k => ({nome: k, val: rankingCentros[k]}))
                .sort((a,b) => b.val - a.val)
                .map((c, i) => `<div class="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-1"><span class="truncate pr-2 font-medium text-slate-700 dark:text-slate-200">${i+1}. ${c.nome}</span><span class="font-bold text-amber-600 dark:text-amber-400">${formatMoney(c.val)}</span></div>`)
                .join('');
        } else {
            ctcEl.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm italic text-center py-2">Nenhuma despesa no período</div>';
        }
    }
"@

$targetStr = "    const qtdCompras = compras.length;"

foreach ($file in @("g:\VERSOES DO SISTEMA\site sistema\relatorios.js", "g:\VERSOES DO SISTEMA\site sistema\gestao.js")) {
    $content = Get-Content $file -Raw -Encoding UTF8
    if (-not $content.Contains("bi-despesas-categoria")) {
        $content = $content.Replace($targetStr, $jsInjection + "`n" + $targetStr)
        Set-Content -Path $file -Value $content -Encoding UTF8
        Write-Host "$file patched"
    } else {
        Write-Host "$file already patched"
    }
}
