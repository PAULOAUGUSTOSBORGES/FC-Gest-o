$file = "g:\VERSOES DO SISTEMA\site sistema\financeiro.js"
$content = Get-Content $file -Raw -Encoding UTF8

# We need to restore the logic that was accidentally deleted and inject our new logic
$content = $content -replace '(?s)        if \(statusFilter === ''ATRASADO''\).*?(?=        const isAtrasado = f.status === ''PENDENTE'')', "        if (statusFilter === 'ATRASADO') {
            lista = lista.filter(f => f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime());
        } else if (statusFilter === 'RENEGOCIADO') {
            lista = lista.filter(f => f.status === 'RENEGOCIADO');
        } else {
            lista = lista.filter(f => f.status === statusFilter); 
        }
    }

    if (dataIni) {
        lista = lista.filter(f => f.data.split('T')[0] >= dataIni);
    }
    if (dataFim) {
        lista = lista.filter(f => f.data.split('T')[0] <= dataFim);
    }

    if (periodoFilter !== 'TUDO' && !dataIni && !dataFim) {
        if (periodoFilter === 'MES_ATUAL') {
            const dataHoje = new Date();
            const mesAtual = dataHoje.getMonth();
            const anoAtual = dataHoje.getFullYear();
            lista = lista.filter(f => {
                const dataF = new Date(f.data);
                return dataF.getMonth() === mesAtual && dataF.getFullYear() === anoAtual;
            });
        } else {
            const hoje = new Date().getTime();
            const limiteFuturo = hoje + (parseInt(periodoFilter) * 24 * 60 * 60 * 1000);
            lista = lista.filter(f => new Date(f.data).getTime() <= limiteFuturo);
        }
    }
    
    lista.sort((a, b) => new Date(a.data) - new Date(b.data));
    
    document.getElementById(`tabela-fin-`${prefix}).innerHTML = lista.map(f => {
"

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
