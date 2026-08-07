$base = "g:\site sistema"
$files = Get-ChildItem -Path $base -Filter "*.js" -File

$CORRECT_HEADER = @"
function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar';
    if (!document.getElementById('tabela-fin-' + prefix)) return;
    if (!db.financeiro) return;
    
    const statusFilterEl = document.getElementById('filtro-' + prefix + '-status');
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'TODOS';
    
    const periodoFilterEl = document.getElementById('filtro-' + prefix + '-periodo');
    const periodoFilter = periodoFilterEl ? periodoFilterEl.value : 'TUDO';
    
    const buscaEl = document.getElementById('busca-fin-' + prefix);
    const termoBusca = buscaEl ? buscaEl.value.toLowerCase() : '';
    
    const dataIniEl = document.getElementById('filtro-' + prefix + '-ini');
    const dataIni = dataIniEl ? dataIniEl.value : '';
    
    const dataFimEl = document.getElementById('filtro-' + prefix + '-fim');
    const dataFim = dataFimEl ? dataFimEl.value : '';
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    if (termoBusca) {
"@

$CORRECT_TRY = @"
    try {
        await firestore.collection('fc_moveis').doc('caixa').set({ ...cxAtual, status: novoStatus, saldo: novoSaldo, historico: cxHistoricoNovo }, { merge: true });
        fecharModalCaixa(); renderCaixaDiario(); showToast('Operação realizada com sucesso!', 'success');
    } catch(err) { console.error(err); showToast('Erro ao registrar caixa.', 'error'); }
}
"@

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    $changed = $false

    # Fix renderTitulos
    $regexRT = '(?s)function renderTitulos\(tipo\)\s*\{.*?if\s*\(\s*termoBusca\s*\)\s*\{'
    if ($content -match $regexRT) {
        # check if it actually has the unprintable chars by checking if it's missing 'tabela-fin-'
        if ($content -notmatch "'tabela-fin-'") {
            $content = $content -replace $regexRT, $CORRECT_HEADER
            $changed = $true
            Write-Host "Fixed renderTitulos in $($f.Name)"
        }
    }

    # Fix duplicate injection in caixa logic
    $regexDup = '(?s)(\s*try \{)\r?\n\s*if \(!document\.getElementById\(''caixa-saldo-display''\)\) return;.*?async function confirmarMovCaixa\(\).*?catch\(err\) \{ console\.error\(err\); showToast\(''Erro ao registrar caixa\.'', ''error''\); \}\r?\n\}'
    if ($content -match $regexDup) {
        $content = $content -replace $regexDup, $CORRECT_TRY
        $changed = $true
        Write-Host "Fixed confirmarMovCaixa duplicate in $($f.Name)"
    }

    if ($changed) {
        [System.IO.File]::WriteAllText($f.FullName, $content, (New-Object System.Text.UTF8Encoding $false))
    }
}
