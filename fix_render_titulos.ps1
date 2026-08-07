$files = Get-ChildItem -Path "g:\site sistema" -Include *.js -File -Recurse

$correct_header = @"
function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar';
    if (!document.getElementById(`tabela-fin-` + prefix)) return;
    if (!db.financeiro) return;
    
    const statusFilterEl = document.getElementById(`filtro-` + prefix + `-status`);
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'TODOS';
    
    const periodoFilterEl = document.getElementById(`filtro-` + prefix + `-periodo`);
    const periodoFilter = periodoFilterEl ? periodoFilterEl.value : 'TUDO';
    
    const buscaEl = document.getElementById(`busca-fin-` + prefix);
    const termoBusca = buscaEl ? buscaEl.value.toLowerCase() : '';
    
    const dataIniEl = document.getElementById(`filtro-` + prefix + `-ini`);
    const dataIni = dataIniEl ? dataIniEl.value : '';
    
    const dataFimEl = document.getElementById(`filtro-` + prefix + `-fim`);
    const dataFim = dataFimEl ? dataFimEl.value : '';
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    if (termoBusca) {
"@

$regex = [regex]::new("function renderTitulos\(tipo\)\s*\{.*?if\s*\(\s*termoBusca\s*\)\s*\{", [System.Text.RegularExpressions.RegexOptions]::Singleline)

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    if ($content -match $regex) {
        $new_content = $regex.Replace($content, $correct_header)
        if ($new_content -ne $content) {
            Write-Host "Fixed renderTitulos in: $($file.Name)"
            [System.IO.File]::WriteAllText($file.FullName, $new_content, [System.Text.Encoding]::UTF8)
        }
    }
}
