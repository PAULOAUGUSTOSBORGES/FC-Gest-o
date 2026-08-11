$file = 'compras.js'
$c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$broken = @'
    for(let i = 0; i < qtdLancamentos; i++) {
            const ref = firestore.collection('financeiro').doc(String(idExistente));
'@

$fixed = @'
    for(let i = 0; i < qtdLancamentos; i++) {
        let dataVenc = new Date(vencBase + 'T12:00:00');
        
        if (recorrencia === 'MENSAL') dataVenc.setMonth(dataVenc.getMonth() + i);
        if (recorrencia === 'ANUAL') dataVenc.setFullYear(dataVenc.getFullYear() + i);
        if (recorrencia === 'SEMANAL') dataVenc.setDate(dataVenc.getDate() + (i * 7));
        if (recorrencia === 'QUINZENAL') dataVenc.setDate(dataVenc.getDate() + (i * 15));

        let refFinal = refBase;
        if (qtdLancamentos > 1) refFinal += ` (${i+1}/${qtdLancamentos})`;

        const contaObj = {
            tipo: tipo, 
            pessoa: pessoa, 
            ref: refFinal, 
            categoria: document.getElementById('conta-categoria') ? document.getElementById('conta-categoria').value : '',
            centroCusto: document.getElementById('conta-centro-custo') ? document.getElementById('conta-centro-custo').value : '',
            contaBancaria: document.getElementById('conta-banco') ? document.getElementById('conta-banco').value : '',
            dataEmissao: document.getElementById('conta-emissao') ? document.getElementById('conta-emissao').value : '',
            data: dataVenc.toISOString(), 
            competencia: document.getElementById('conta-competencia') ? document.getElementById('conta-competencia').value : '',
            numNF: document.getElementById('conta-num-nf') ? document.getElementById('conta-num-nf').value : '',
            numBoleto: document.getElementById('conta-num-boleto') ? document.getElementById('conta-num-boleto').value : '',
            valor: valorOriginal, 
            acrescimo: parseFloat(document.getElementById('conta-acrescimo') ? document.getElementById('conta-acrescimo').value : 0) || 0,
            desconto: parseFloat(document.getElementById('conta-desconto') ? document.getElementById('conta-desconto').value : 0) || 0,
            valorPago: valorFin,
            status: document.getElementById('conta-status') ? document.getElementById('conta-status').value : 'PENDENTE',
            dataPagamento: (document.getElementById('conta-data-pgto') && document.getElementById('conta-data-pgto').value) ? new Date(document.getElementById('conta-data-pgto').value + 'T12:00:00').toISOString() : '',
            metodoPagamento: document.getElementById('conta-metodo') ? document.getElementById('conta-metodo').value : '',
            observacao: document.getElementById('conta-obs') ? document.getElementById('conta-obs').value : '',
            anexoBase64: document.getElementById('conta-anexo-base64') ? document.getElementById('conta-anexo-base64').value : '',
            ultimaAlteracao: Date.now()
        };

        if (isEdicao) {
            const ref = firestore.collection('financeiro').doc(String(idExistente));
'@

$c = $c.Replace($broken, $fixed)
[System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)

# Now, bump the cache buster just to be absolutely sure the user's browser gets it
$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($f in $files) {
    $c2 = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
    $c2 = $c2 -replace '\.js\?v=6', '.js?v=7'
    $c2 = $c2 -replace '\.css\?v=6', '.css?v=7'
    [System.IO.File]::WriteAllText($f, $c2, [System.Text.Encoding]::UTF8)
}
