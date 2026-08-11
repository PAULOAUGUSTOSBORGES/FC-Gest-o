$files = Get-ChildItem "*.js" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    if ($c -match 'function salvarConta\(\)') {
        # Match anything from the loop start down to "const ref = firestore"
        $pattern = '(?s)for\(let i = 0; i < qtdLancamentos; i\+\+\) \{\s+const ref = firestore\.collection\(''financeiro''\)\.doc\(String\(idExistente\)\);'
        
        # If it doesn't match the broken pattern, try matching the unsafe contaObj pattern itself to replace it
        $pattern2 = '(?s)const contaObj = \{\s*tipo: tipo,\s*pessoa: pessoa,\s*ref: refFinal,\s*categoria: document\.getElementById\(''conta-categoria''\)\.value,\s*centroCusto: document\.getElementById\(''conta-centro-custo''\)\.value,\s*contaBancaria: document\.getElementById\(''conta-banco''\)\.value,\s*dataEmissao: document\.getElementById\(''conta-emissao''\)\.value,\s*data: dataVenc\.toISOString\(\),\s*competencia: document\.getElementById\(''conta-competencia''\)\.value,\s*numNF: document\.getElementById\(''conta-num-nf''\)\.value,\s*numBoleto: document\.getElementById\(''conta-num-boleto''\)\.value,\s*valor: valorOriginal,\s*acrescimo: parseFloat\(document\.getElementById\(''conta-acrescimo''\)\.value\) \|\| 0,\s*desconto: parseFloat\(document\.getElementById\(''conta-desconto''\)\.value\) \|\| 0,\s*valorPago: valorFin,\s*status: document\.getElementById\(''conta-status''\)\.value,\s*dataPagamento: document\.getElementById\(''conta-data-pgto''\)\.value \? new Date\(document\.getElementById\(''conta-data-pgto''\)\.value \+ ''T12:00:00''\)\.toISOString\(\) : '''',\s*metodoPagamento: document\.getElementById\(''conta-metodo''\)\.value,\s*observacao: document\.getElementById\(''conta-obs''\)\.value,\s*anexoBase64: document\.getElementById\(''conta-anexo-base64''\)\.value,\s*ultimaAlteracao: Date\.now\(\)\s*\};'

        $safeContaObj = @'
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

        if ($c -match $pattern2) {
            $c = [System.Text.RegularExpressions.Regex]::Replace($c, $pattern2, $safeContaObj)
            [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
        }
    }
}
