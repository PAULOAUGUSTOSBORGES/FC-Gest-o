$file = 'compras.js'
$c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Replace the unsafe contaObj with safe contaObj
$unsafe = @'
        const contaObj = {
            tipo: tipo, 
            pessoa: pessoa, 
            ref: refFinal, 
            categoria: document.getElementById('conta-categoria').value,
            centroCusto: document.getElementById('conta-centro-custo').value,
            contaBancaria: document.getElementById('conta-banco').value,
            dataEmissao: document.getElementById('conta-emissao').value,
            data: dataVenc.toISOString(), 
            competencia: document.getElementById('conta-competencia').value,
            numNF: document.getElementById('conta-num-nf').value,
            numBoleto: document.getElementById('conta-num-boleto').value,
            valor: valorOriginal, 
            acrescimo: parseFloat(document.getElementById('conta-acrescimo').value) || 0,
            desconto: parseFloat(document.getElementById('conta-desconto').value) || 0,
            valorPago: valorFin,
            status: document.getElementById('conta-status').value,
            dataPagamento: document.getElementById('conta-data-pgto').value ? new Date(document.getElementById('conta-data-pgto').value + 'T12:00:00').toISOString() : '',
            metodoPagamento: document.getElementById('conta-metodo').value,
            observacao: document.getElementById('conta-obs').value,
            anexoBase64: document.getElementById('conta-anexo-base64').value,
            ultimaAlteracao: Date.now()
        };
'@

$safe = @'
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
'@

$c = $c.Replace($unsafe, $safe)
[System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)

# Also update cache buster to v=6 to force load!
$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($f in $files) {
    $c2 = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
    $c2 = $c2 -replace '\.js\?v=5', '.js?v=6'
    $c2 = $c2 -replace '\.css\?v=5', '.css?v=6'
    [System.IO.File]::WriteAllText($f, $c2, [System.Text.Encoding]::UTF8)
}
