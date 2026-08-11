$c = [System.IO.File]::ReadAllText("financeiro.js", [System.Text.Encoding]::UTF8)

$bad_code = "        const contaObj = {
            tipo: tipo, 
            acrescimo: parseFloat(document.getElementById('conta-acrescimo').value) || 0,"

$good_code = "        const contaObj = {
            tipo: tipo, 
            pessoa: pessoa, 
            ref: refFinal, 
            categoria: document.getElementById('conta-categoria') ? document.getElementById('conta-categoria').value : '',
            centroCusto: document.getElementById('conta-centro-custo') ? document.getElementById('conta-centro-custo').value : '',
            contaBancaria: document.getElementById('conta-banco') ? document.getElementById('conta-banco').value : '',
            dataEmissao: document.getElementById('conta-emissao') ? document.getElementById('conta-emissao').value : '',
            data: dataVenc.toISOString(), 
            dataCartorio: document.getElementById('conta-cartorio') ? document.getElementById('conta-cartorio').value : '',
            multaPerc: parseFloat(document.getElementById('conta-multa') ? document.getElementById('conta-multa').value : 0) || 0,
            jurosMesPerc: parseFloat(document.getElementById('conta-juros') ? document.getElementById('conta-juros').value : 0) || 0, 
            competencia: document.getElementById('conta-competencia') ? document.getElementById('conta-competencia').value : '',
            numNF: document.getElementById('conta-num-nf') ? document.getElementById('conta-num-nf').value : '',
            numBoleto: document.getElementById('conta-num-boleto') ? document.getElementById('conta-num-boleto').value : '',
            valor: valorOriginal, 
            acrescimo: parseFloat(document.getElementById('conta-acrescimo').value) || 0,"

$c = $c.Replace($bad_code, $good_code)
[System.IO.File]::WriteAllText("financeiro.js", $c, [System.Text.Encoding]::UTF8)
