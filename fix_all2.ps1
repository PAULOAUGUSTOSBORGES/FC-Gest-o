$content = Get-Content -Path 'compras.js' -Raw

$startStr = "async function salvarCompraManual() {"
$endStr = "function renderComprasHist() {"

$newCode = @'
async function salvarCompraManual() {
    const idEdit = document.getElementById('compra-manual-id').value;
    const isEdicao = !!idEdit;

    const fornSel = document.getElementById('compra-manual-fornecedor').value;
    const fornAvulso = document.getElementById('compra-manual-forn-avulso').value.trim();
    const fornecedorFinal = fornAvulso || fornSel;
    
    if(!fornecedorFinal) return showToast("Informe o fornecedor!", "error");
    
    const dataCompra = document.getElementById('compra-manual-data').value;
    const refPed = document.getElementById('compra-manual-ref').value || 'S/N';
    
    const apenasValor = document.getElementById('compra-manual-apenas-valor')?.checked;
    const totais = calcularTotaisCompraManual();
    
    if(totais.totalGeral <= 0) return showToast("Valor total deve ser maior que zero!", "error");
    
    if(!apenasValor) {
        if(compraManualItens.length === 0) return showToast("Adicione itens válidos!", "error");
        for(let i=0; i<compraManualItens.length; i++) {
            if(!compraManualItens[i].prodId) return showToast("Selecione os produtos em todas as linhas!", "error");
        }
    }

    const batch = firestore.batch();

    if (isEdicao) {
        const cAntiga = db.compras.find(x => String(x.id) === String(idEdit));
        if (cAntiga) {
            if(cAntiga.itens && cAntiga.itens.length > 0) {
                cAntiga.itens.forEach(item => {
                    if (item.idMatch) {
                        const pDB = db.produtos.find(x => String(x.id) === String(item.idMatch));
                        if (pDB) {
                            pDB.estoque -= item.qCom;
                            batch.update(firestore.collection('produtos').doc(String(pDB.id)), { estoque: pDB.estoque });
                            const kRef = firestore.collection('movimentacoes').doc();
                            batch.set(kRef, { data: new Date().toISOString(), ref: `Estorno Edição Compra ${cAntiga.numeroNF}`, produtoId: pDB.id, produtoNome: pDB.nome, qtd: -item.qCom, tipo: 'ESTORNO COMPRA' });
                        }
                    }
                });
            }
            try {
                const snapFin = await firestore.collection('financeiro').where('tipo', '==', 'DESPESA').get();
                snapFin.docs.forEach(doc => {
                    const finData = doc.data();
                    if (finData.ref && String(finData.ref).includes(cAntiga.numeroNF) && cAntiga.numeroNF !== 'S/N') {
                        batch.delete(doc.ref);
                    }
                });
            } catch(e) { console.error('Erro ao buscar financeiro atrelado:', e); }
        }
    }

    let totalQtd = 0;
    let itensRateadosParaSalvar = [];

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
            batch.set(kRef, { data: new Date().toISOString(), ref: `Compra Man. ${refPed} (${fornecedorFinal})`, produtoId: pDB.id, produtoNome: pDB.nome, qtd: item.qtd, tipo: 'ENTRADA COMPRA' });
            
            itensRateadosParaSalvar.push({
                idMatch: pDB.id, nome: pDB.nome, qCom: item.qtd, custoFinal: custoRateadoFinal, vTotalItemNaNota: (item.qtd * item.custoUnit) + freteRateado, custoUnitOriginal: item.custoUnit 
            });
        });
    }

    const idCompra = isEdicao ? idEdit : Date.now();
    const compraRef = firestore.collection('compras').doc(String(idCompra));
    batch.set(compraRef, { 
        id: idCompra, numeroNF: refPed, data: new Date(dataCompra + 'T12:00:00').toISOString(), fornecedor: fornecedorFinal, cnpj: '', 
        totalNF: totais.totalGeral, freteExtra: totais.frete, qtdTotal: totalQtd, itens: itensRateadosParaSalvar 
    }, { merge: true });

    if(document.getElementById('compra-manual-gerar-financeiro').checked && !isEdicao) {
        const finRef = firestore.collection('financeiro').doc();
        batch.set(finRef, { ref: `Compra: ${refPed}`, data: new Date(dataCompra + 'T12:00:00').toISOString(), pessoa: fornecedorFinal, valor: totais.totalGeral, status: 'PENDENTE', tipo: 'DESPESA', categoria: 'Fornecedores / Compras' });
    }

    if(fornAvulso && !db.fornecedores.find(f => f.nome.toLowerCase() === fornAvulso.toLowerCase())) {
        const fornRef = firestore.collection('fornecedores').doc();
        batch.set(fornRef, { nome: fornAvulso, doc: '', cnpj: '', telefone: '' });
    }

    try {
        await batch.commit();
        fecharModalCompraManual(); renderComprasHist(); renderFinAbas('pagar');
        showToast(isEdicao ? "Compra atualizada com sucesso!" : "Compra Manual lançada com sucesso!", "success");
    } catch(err) { console.error(err); showToast('Erro', 'error'); }
}

'@

$idx1 = $content.IndexOf($startStr)
$idx2 = $content.IndexOf($endStr, $idx1)

if ($idx1 -ge 0 -and $idx2 -ge 0) {
    $content = $content.Substring(0, $idx1) + $newCode + $content.Substring($idx2)
    [System.IO.File]::WriteAllText("$(Get-Location)\compras.js", $content, [System.Text.Encoding]::UTF8)
    Write-Host "Success"
} else {
    Write-Host "Failed to find boundaries"
}
