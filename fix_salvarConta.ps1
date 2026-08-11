$c = [System.IO.File]::ReadAllText("financeiro.js", [System.Text.Encoding]::UTF8)

$newFunction = @"
function salvarConta() {
    const idExistente = document.getElementById('conta-id').value;
    const tipo = document.getElementById('conta-tipo').value; 
    const pessoa = getPessoaFinalConta(); 
    const valorOriginal = parseFloat(document.getElementById('conta-valor').value); 
    const vencBase = document.getElementById('conta-vencimento').value;
    
    if(!pessoa || isNaN(valorOriginal) || !vencBase) return showToast('Preencha Favorecido, Vencimento e Valor!', 'error'); 
    
    const valorFin = calcularValorFinalFormulario();
    
    const recorrencia = document.getElementById('conta-recorrencia').value;
    const isEdicao = !!idExistente;
    const qtdLancamentos = (recorrencia === 'UNICA' || isEdicao) ? 1 : (parseInt(document.getElementById('conta-qtd-recorrencia').value) || 1);
    const refBase = document.getElementById('conta-ref').value || 'Avulso';

    let contasGeradas = 0;
    const batch = firestore.batch();

    for(let i = 0; i < qtdLancamentos; i++) {
        let dataVenc = new Date(vencBase + 'T12:00:00');
        
        if (recorrencia === 'MENSAL') dataVenc.setMonth(dataVenc.getMonth() + i);
        if (recorrencia === 'ANUAL') dataVenc.setFullYear(dataVenc.getFullYear() + i);
        if (recorrencia === 'SEMANAL') dataVenc.setDate(dataVenc.getDate() + (i * 7));
        if (recorrencia === 'QUINZENAL') dataVenc.setDate(dataVenc.getDate() + (i * 15));

        let refFinal = refBase;
        if (qtdLancamentos > 1) refFinal += `" ("` + (i+1) + `"/""` + qtdLancamentos + `")"`;

        const contaObj = {
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
            batch.set(ref, contaObj, { merge: true });
        } else {
            const ref = firestore.collection('financeiro').doc();
            batch.set(ref, contaObj);
            contasGeradas++;
        }
    }

    // Auto-register new fornecedor/cliente if typed manually
    const _selFinal = document.getElementById('conta-pessoa-select');
    const _inpFinal = document.getElementById('conta-pessoa');
    const _selValFinal = _selFinal ? _selFinal.value : '';
    const _inpValFinal = _inpFinal ? _inpFinal.value.trim() : '';
    const tipoContaFinal = document.getElementById('conta-tipo').value;
    if (_selValFinal === '__novo__' && _inpValFinal) {
        if (tipoContaFinal === 'DESPESA') {
            if (!(db.fornecedores || []).find(f => f.nome && f.nome.toLowerCase() === _inpValFinal.toLowerCase())) {
                const _fRef = firestore.collection('fornecedores').doc();
                batch.set(_fRef, { nome: _inpValFinal, doc: '', cnpj: '', telefone: '' });
            }
        } else {
            if (!(db.clientes || []).find(c => (c.nome||c.razaoSocial||'').toLowerCase() === _inpValFinal.toLowerCase())) {
                const _cRef = firestore.collection('clientes').doc();
                batch.set(_cRef, { nome: _inpValFinal, telefone: '', email: '', doc: '' });
            }
        }
    }

    batch.commit().then(() => {
        fecharModalConta(); 
        renderFinAbas(tipo === 'RECEITA' ? 'receber' : 'pagar'); 
        
        if (isEdicao) {
            showToast('Título Atualizado!', 'success');
        } else {
            if (qtdLancamentos > 1) showToast(contasGeradas + ' Títulos gerados!', 'success');
            else showToast('Título Salvo!', 'success');
        }
    }).catch(e => {
        console.error(e);
        showToast('Erro ao salvar conta.', 'error');
    });
}
"@

$c = [System.Text.RegularExpressions.Regex]::Replace($c, "(?s)function salvarConta\(\) \{.*?showToast\('Erro ao salvar conta\.', 'error'\);\s*\}\);?\s*\}", $newFunction)
[System.IO.File]::WriteAllText("financeiro.js", $c, [System.Text.Encoding]::UTF8)

