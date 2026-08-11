$content = Get-Content -Path 'compras.js' -Raw

$startStr = "    compraManualItens.forEach(item => {"
$endStr = "    batch.set(compraRef, { "

$newContent2 = @"
    if (!apenasValor) {
        compraManualItens.forEach(item => {
            const pDB = db.produtos.find(x => String(x.id) === String(item.prodId));
            if(!pDB) return;
            
            let pesoValor = (item.qtd * item.custoUnit) / totais.totalProdutos;
            let freteRateado = totais.frete * pesoValor;
            let custoRateadoFinal = item.custoUnit + (freteRateado / item.qtd);
            
            pDB.estoque += item.qtd;
            pDB.custo = custoRateadoFinal;
            pDB.preco = custoRateadoFinal * (1 + ((pDB.margem || 0) / 100));
            
            totalQtd += item.qtd;
            
            batch.update(firestore.collection('produtos').doc(String(pDB.id)), {
                estoque: pDB.estoque, custo: pDB.custo, preco: pDB.preco
            });
            
            const kRef = firestore.collection('movimentacoes').doc();
            batch.set(kRef, { data: new Date().toISOString(), ref: \`Compra Man. \${refPed} (\${fornecedorFinal})\`, produtoId: pDB.id, produtoNome: pDB.nome, qtd: item.qtd, tipo: 'ENTRADA COMPRA' });
            
            itensRateadosParaSalvar.push({
                idMatch: pDB.id, nome: pDB.nome, qCom: item.qtd, custoFinal: custoRateadoFinal, vTotalItemNaNota: (item.qtd * item.custoUnit) + freteRateado, custoUnitOriginal: item.custoUnit 
            });
        });
    }

    const idCompra = isEdicao ? idEdit : Date.now();
    const compraRef = firestore.collection('compras').doc(String(idCompra));
    batch.set(compraRef, { 
"@

$idx1 = $content.IndexOf($startStr)
$idx2 = $content.IndexOf($endStr, $idx1)

if ($idx1 -ge 0 -and $idx2 -ge 0) {
    $content = $content.Substring(0, $idx1) + $newContent2 + $content.Substring($idx2 + $endStr.Length)
    [System.IO.File]::WriteAllText("$(Get-Location)\compras.js", $content, [System.Text.Encoding]::UTF8)
    Write-Host "Success"
} else {
    Write-Host "Failed to find boundaries"
}
