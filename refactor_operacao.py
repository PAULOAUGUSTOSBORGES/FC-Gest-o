import re

with open("operacao.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. inicializarOperacao
content = re.sub(
    r"function inicializarOperacao\(\) \{.*?mudarVisaoLocal\(view\);\n\}",
    """function inicializarOperacao() {
    aplicarIdentidadeVisualNoMenu(); 
    
    firestore.collection('produtos').onSnapshot(snap => {
        db.produtos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    firestore.collection('clientes').onSnapshot(snap => {
        db.clientes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        atualizarListaClientesPDV();
    });
    firestore.collection('vendas').onSnapshot(snap => {
        db.vendas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const v = document.getElementById('view-vendas');
        const o = document.getElementById('view-orcamentos');
        if(v && v.classList.contains('active')) renderVendas();
        if(o && o.classList.contains('active')) renderOrcamentos();
    });
    firestore.collection('fc_moveis').doc('caixa').onSnapshot(doc => {
        if(doc.exists) db.caixa = doc.data();
        else db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
        const badgeCaixa = document.getElementById('pdv-status-caixa');
        if (badgeCaixa) prepararPDV();
    });
    firestore.collection('financeiro').onSnapshot(snap => {
        db.financeiro = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'pdv'; 
    mudarVisaoLocal(view);
}""",
    content,
    flags=re.DOTALL
)

# 2. salvarKardex
content = re.sub(
    r"function salvarKardex\(ref, prodId, prodNome, qtd, tipo\) \{.*?\}\); \n\}",
    """function salvarKardex(ref, prodId, prodNome, qtd, tipo) { 
    firestore.collection('movimentacoes').add({ 
        data: new Date().toISOString(), 
        ref: ref || '', 
        prodId: prodId || '', 
        prodNome: prodNome || 'Produto', 
        qtd: qtd || 0, 
        tipo: tipo || 'AJUSTE' 
    }).catch(e => console.error("Erro ao salvar kardex:", e));
}""",
    content,
    flags=re.DOTALL
)

# 3. salvarClienteRapido
content = re.sub(
    r"function salvarClienteRapido\(\) \{.*?showToast\('Cliente cadastrado e selecionado!', 'success'\);\n\}",
    """async function salvarClienteRapido() {
    const nome = document.getElementById('cli-rapido-nome').value.trim();
    if(!nome) return showToast('Nome do cliente é obrigatório!', 'error');

    const novoCliente = {
        nome: nome,
        wpp: document.getElementById('cli-rapido-wpp').value.trim(),
        documento: document.getElementById('cli-rapido-doc').value.trim(),
        dataCadastro: new Date().toISOString()
    };

    try {
        const docRef = await firestore.collection('clientes').add(novoCliente);
        fecharModalClienteRapido();
        atualizarListaClientesPDV(docRef.id);
        showToast('Cliente cadastrado e selecionado!', 'success');
    } catch(err) {
        console.error(err);
        showToast('Erro ao cadastrar cliente.', 'error');
    }
}""",
    content,
    flags=re.DOTALL
)

# 4. salvarProdutoRapido
content = re.sub(
    r"function salvarProdutoRapido\(\) \{.*?showToast\('Produto cadastrado e adicionado!', 'success'\);\n\}",
    """async function salvarProdutoRapido() {
    const nomeEl = document.getElementById('prod-nome');
    const precoEl = document.getElementById('prod-preco');
    if(!nomeEl || !precoEl) return showToast('Erro no formulário.', 'error');
    const nome = nomeEl.value.trim(); const preco = parseFloat(precoEl.value);
    if(!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

    const ean = document.getElementById('prod-ean') ? document.getElementById('prod-ean').value : '';
    const marca = document.getElementById('prod-marca') ? document.getElementById('prod-marca').value : '';
    const custo = document.getElementById('prod-custo') ? parseFloat(document.getElementById('prod-custo').value) : 0;
    const estoque = document.getElementById('prod-estoque') ? parseInt(document.getElementById('prod-estoque').value) : 0;
    const foto = document.getElementById('prod-foto-base64') ? document.getElementById('prod-foto-base64').value : '';

    const p = {
        nome: nome, preco: preco, ean: ean, marca: marca, categoria: 'Geral', unidade: 'Un', custo: custo || 0, margem: 0, estoque: estoque || 0, min: 1, ativo: true, obs: '', foto: foto
    };

    try {
        const docRef = await firestore.collection('produtos').add(p);
        p.id = docRef.id;
        if(p.estoque > 0) salvarKardex('Estoque Inicial PDV', p.id, p.nome, p.estoque, 'INICIAL'); 
        fecharModalProduto(); 
        processarAdicaoProduto(p); 
        showToast('Produto cadastrado e adicionado!', 'success');
    } catch(err) {
        console.error(err);
        showToast('Erro ao cadastrar produto.', 'error');
    }
}""",
    content,
    flags=re.DOTALL
)

# 5. finalizarVendaMultipla header and return values
content = content.replace("function finalizarVendaMultipla() {", "async function finalizarVendaMultipla() {")

# Replace the save block in finalizarVendaMultipla
finalizar_block_target = """    if (!isOrcamento) { 
        cart.forEach(item => { 
            const p = (db.produtos || []).find(x => String(x.id) === String(item.id)); 
            if(p) { 
                p.estoque -= item.qtd; 
                salvarKardex(`${tipoVenda} #${numPedStr}`, p.id, p.nome, -(item.qtd || 1), tipoVenda); 
            } 
        }); 
    }

    if(!db.vendas) db.vendas = [];
    const itensLimpados = cart.map(i => { return { id: i.id || '', nome: i.nome || '', preco: i.preco || 0, custo: i.custo || 0, qtd: i.qtd || 1, obsVenda: i.obsVenda || '' }; });

    const novaVendaObj = { 
        id: vendaId, 
        numeroPedido: numeroPedido, 
        data: dataIso, 
        clienteId: cId || '', 
        clienteNome: cliInfo.nome || '', 
        clienteDoc: cliInfo.doc,
        clienteTel: cliInfo.tel,
        clienteEnd: cliInfo.endCompleto,
        subtotal: sub || 0, 
        frete: frete || 0, 
        desconto: desc || 0, 
        tot: tot || 0, 
        taxaValor: taxaValorTotal || 0, 
        valorLiquido: valorLiquido || 0, 
        custoTotal: custoTotal || 0, 
        lucroReal: lucroReal || 0, 
        pag: pagTexto || '', 
        vendedor: vend || '', 
        obs: obsTexto || '', 
        tipo: tipoVenda, 
        servicoDetalhes: isServico ? { prazo: osPrazo, garantia: osGarantia, desc: osDesc, fotos: osFotosParaSalvar } : null, 
        itens: itensLimpados 
    };
    
    db.vendas.unshift(novaVendaObj);
    
    if (!isOrcamento) {
        if(!db.financeiro) db.financeiro = []; 
        if(!db.caixa) db.caixa = { status: 'ABERTO', saldo: 0, historico: [] }; 
        if(!db.caixa.historico) db.caixa.historico = [];
        
        pagamentosVendaAtual.forEach((p, idx) => {
            let valorParaCaixa = p.valor || 0; 
            if(p.metodo === 'Dinheiro' && valorTroco > 0) { 
                valorParaCaixa -= valorTroco; 
                if(valorParaCaixa < 0) valorParaCaixa = 0; 
            }
            
            if(valorParaCaixa > 0) {
                let pRef = `${tipoVenda} #${numPedStr} (${p.metodo || ''}${(p.parcelas || 1) > 1 ? ' '+p.parcelas+'x' : ''})`;
                
                if(p.metodo === 'Fiado' || p.metodo === 'Boleto') { 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    let dataBase = p.vencimentoBase ? new Date(p.vencimentoBase + 'T12:00:00') : new Date(); 
                    if(!p.vencimentoBase) dataBase.setDate(dataBase.getDate() + 30); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        let dataVencParc = new Date(dataBase); 
                        dataVencParc.setDate(dataVencParc.getDate() + (30 * (i - 1))); 
                        db.financeiro.unshift({ id: Date.now()+idx+i, ref: `${pRef} [${i}/${p.parcelas}]`, data: dataVencParc.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas' }); 
                    } 
                } else if (p.metodo && (String(p.metodo).includes('Crédito') || String(p.metodo).includes('Débito'))) { 
                    let dataAmanha = new Date(); 
                    dataAmanha.setDate(dataAmanha.getDate() + 1); 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        db.financeiro.unshift({ id: Date.now()+idx+i, ref: `${pRef} [${i}/${p.parcelas}]`, data: dataAmanha.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo }); 
                    } 
                } else if (p.metodo === 'Dinheiro' || p.metodo === 'PIX') { 
                    db.financeiro.unshift({ id: Date.now()+idx, ref: pRef, data: dataIso, pessoa: cliInfo.nome, wpp: '', valor: valorParaCaixa, status: 'PAGO', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, dataPagamento: dataIso }); 
                    if(p.metodo === 'Dinheiro') { 
                        db.caixa.saldo += valorParaCaixa; 
                        db.caixa.historico.unshift({ data: dataIso, tipo: 'ENTRADA', desc: pRef, valor: valorParaCaixa }); 
                    } 
                }
            }
        });
    }

    saveDB();"""

finalizar_block_replacement = """    const batch = firestore.batch();
    
    // Preparar Venda
    const vendaRef = isEdicao ? firestore.collection('vendas').doc(String(vendaId)) : firestore.collection('vendas').doc();
    const idFinalVenda = vendaRef.id;

    if (!isOrcamento) { 
        cart.forEach(item => { 
            const p = (db.produtos || []).find(x => String(x.id) === String(item.id)); 
            if(p) { 
                const pRef = firestore.collection('produtos').doc(String(p.id));
                batch.update(pRef, { estoque: (p.estoque || 0) - item.qtd });
                
                const kardexRef = firestore.collection('movimentacoes').doc();
                batch.set(kardexRef, {
                    data: new Date().toISOString(),
                    ref: `${tipoVenda} #${numPedStr}`,
                    prodId: p.id,
                    prodNome: p.nome,
                    qtd: -(item.qtd || 1),
                    tipo: tipoVenda
                });
            } 
        }); 
    }

    const itensLimpados = cart.map(i => { return { id: i.id || '', nome: i.nome || '', preco: i.preco || 0, custo: i.custo || 0, qtd: i.qtd || 1, obsVenda: i.obsVenda || '' }; });

    const novaVendaObj = { 
        numeroPedido: numeroPedido, 
        data: dataIso, 
        clienteId: cId || '', 
        clienteNome: cliInfo.nome || '', 
        clienteDoc: cliInfo.doc,
        clienteTel: cliInfo.tel,
        clienteEnd: cliInfo.endCompleto,
        subtotal: sub || 0, 
        frete: frete || 0, 
        desconto: desc || 0, 
        tot: tot || 0, 
        taxaValor: taxaValorTotal || 0, 
        valorLiquido: valorLiquido || 0, 
        custoTotal: custoTotal || 0, 
        lucroReal: lucroReal || 0, 
        pag: pagTexto || '', 
        vendedor: vend || '', 
        obs: obsTexto || '', 
        tipo: tipoVenda, 
        servicoDetalhes: isServico ? { prazo: osPrazo, garantia: osGarantia, desc: osDesc, fotos: osFotosParaSalvar } : null, 
        itens: itensLimpados 
    };
    
    batch.set(vendaRef, novaVendaObj, { merge: true });
    
    if (!isOrcamento) {
        let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
        let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
        let cxSaldoNovo = cxAtual.saldo || 0;
        
        pagamentosVendaAtual.forEach((p, idx) => {
            let valorParaCaixa = p.valor || 0; 
            if(p.metodo === 'Dinheiro' && valorTroco > 0) { 
                valorParaCaixa -= valorTroco; 
                if(valorParaCaixa < 0) valorParaCaixa = 0; 
            }
            
            if(valorParaCaixa > 0) {
                let pRef = `${tipoVenda} #${numPedStr} (${p.metodo || ''}${(p.parcelas || 1) > 1 ? ' '+p.parcelas+'x' : ''})`;
                
                if(p.metodo === 'Fiado' || p.metodo === 'Boleto') { 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    let dataBase = p.vencimentoBase ? new Date(p.vencimentoBase + 'T12:00:00') : new Date(); 
                    if(!p.vencimentoBase) dataBase.setDate(dataBase.getDate() + 30); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        let dataVencParc = new Date(dataBase); 
                        dataVencParc.setDate(dataVencParc.getDate() + (30 * (i - 1))); 
                        
                        const finRef = firestore.collection('financeiro').doc();
                        batch.set(finRef, { ref: `${pRef} [${i}/${p.parcelas}]`, data: dataVencParc.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', origemVendaId: idFinalVenda }); 
                    } 
                } else if (p.metodo && (String(p.metodo).includes('Crédito') || String(p.metodo).includes('Débito'))) { 
                    let dataAmanha = new Date(); 
                    dataAmanha.setDate(dataAmanha.getDate() + 1); 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        const finRef = firestore.collection('financeiro').doc();
                        batch.set(finRef, { ref: `${pRef} [${i}/${p.parcelas}]`, data: dataAmanha.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, origemVendaId: idFinalVenda }); 
                    } 
                } else if (p.metodo === 'Dinheiro' || p.metodo === 'PIX') { 
                    const finRef = firestore.collection('financeiro').doc();
                    batch.set(finRef, { ref: pRef, data: dataIso, pessoa: cliInfo.nome, wpp: '', valor: valorParaCaixa, status: 'PAGO', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, dataPagamento: dataIso, origemVendaId: idFinalVenda }); 
                    
                    if(p.metodo === 'Dinheiro') { 
                        cxSaldoNovo += valorParaCaixa; 
                        cxHistoricoNovo.unshift({ data: dataIso, tipo: 'ENTRADA', desc: pRef, valor: valorParaCaixa }); 
                    } 
                }
            }
        });
        
        const caixaRef = firestore.collection('fc_moveis').doc('caixa');
        batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
    }

    try {
        await batch.commit();
    } catch(err) {
        console.error("Erro ao salvar no firestore: ", err);
        return showToast("Erro ao salvar operação no banco de dados.", "error");
    }"""

content = content.replace(finalizar_block_target, finalizar_block_replacement)

# 6. excluirVenda and editarVenda
excluir_target = """function excluirVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento ? 'Deseja excluir este Orçamento do histórico permanentemente?' : 'Devolver estoque e apagar parcelas/caixa desta operação?';
    
    abrirConfirmacao('Confirmar Exclusão', msg, () => {
        try {
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            p.estoque += Number(item.qtd || 1); 
                            salvarKardex(`Estorno ${v.tipo} #${numPedStr}`, p.id, p.nome, Number(item.qtd || 1), 'ESTORNO'); 
                        } 
                    }); 
                }
                
                db.financeiro = (db.financeiro || []).filter(f => f.ref ? !String(f.ref).includes(`#${numPedStr}`) : true);
                
                if(v.pag && typeof v.pag === 'string' && v.pag.includes('Dinheiro')) { 
                    if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] }; 
                    if(!db.caixa.historico) db.caixa.historico = []; 
                    db.caixa.saldo -= (Number(v.valorLiquido) || 0); 
                    db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno ${v.tipo} #${numPedStr}`, valor: (Number(v.valorLiquido) || 0) }); 
                }
            }
            db.vendas = db.vendas.filter(x => String(x.id) !== String(id)); 
            saveDB(); 
            if(isOrcamento) renderOrcamentos(); else renderVendas(); 
            showToast('Registro excluído com sucesso!', 'success');
        } catch (err) { 
            console.error(err); 
            showToast('Erro ao excluir registro.', 'error'); 
        }
    });
}"""

excluir_replacement = """function excluirVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento ? 'Deseja excluir este Orçamento do histórico permanentemente?' : 'Devolver estoque e apagar parcelas/caixa desta operação?';
    
    abrirConfirmacao('Confirmar Exclusão', msg, async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            const pRef = firestore.collection('produtos').doc(String(p.id));
                            batch.update(pRef, { estoque: (p.estoque || 0) + Number(item.qtd || 1) });
                            
                            const kardexRef = firestore.collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: `Estorno ${v.tipo} #${numPedStr}`,
                                prodId: p.id,
                                prodNome: p.nome,
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        } 
                    }); 
                }
                
                const finQuery = await firestore.collection('financeiro').where('origemVendaId', '==', String(id)).get();
                finQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                if(v.pag && typeof v.pag === 'string' && v.pag.includes('Dinheiro')) { 
                    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                    let cxSaldoNovo = (cxAtual.saldo || 0) - (Number(v.valorLiquido) || 0);
                    cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno ${v.tipo} #${numPedStr}`, valor: (Number(v.valorLiquido) || 0) });
                    
                    const caixaRef = firestore.collection('fc_moveis').doc('caixa');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }
            
            const vendaRef = firestore.collection('vendas').doc(String(id));
            batch.delete(vendaRef);
            
            await batch.commit();
            
            if(isOrcamento) renderOrcamentos(); else renderVendas(); 
            showToast('Registro excluído com sucesso!', 'success');
        } catch (err) { 
            console.error(err); 
            showToast('Erro ao excluir registro.', 'error'); 
        }
    });
}"""

content = content.replace(excluir_target, excluir_replacement)

editar_target = """function editarVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja carregar este orçamento de volta no PDV para editar?' 
        : 'Atenção! Isso fará o ESTORNO automático desta venda (devolvendo estoque e apagando as parcelas) e carregará todos os itens no PDV para você editar e re-finalizar. Deseja continuar?';

    abrirConfirmacao('Editar Operação', msg, () => {
        try {
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            p.estoque += Number(item.qtd || 1); 
                            salvarKardex(`Estorno de Edição ${v.tipo} #${numPedStr}`, p.id, p.nome, Number(item.qtd || 1), 'ESTORNO'); 
                        } 
                    }); 
                }
                
                db.financeiro = (db.financeiro || []).filter(f => f.ref ? !String(f.ref).includes(`#${numPedStr}`) : true);
                
                if(v.pag && typeof v.pag === 'string' && String(v.pag).includes('Dinheiro')) { 
                    if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] }; 
                    if(!db.caixa.historico) db.caixa.historico = []; 
                    db.caixa.saldo -= (Number(v.valorLiquido) || 0); 
                    db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno (Edição) ${v.tipo} #${numPedStr}`, valor: (Number(v.valorLiquido) || 0) }); 
                }
            }

            db.vendas = db.vendas.filter(x => String(x.id) !== String(id)); 
            saveDB();"""

editar_replacement = """function editarVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja carregar este orçamento de volta no PDV para editar?' 
        : 'Atenção! Isso fará o ESTORNO automático desta venda (devolvendo estoque e apagando as parcelas) e carregará todos os itens no PDV para você editar e re-finalizar. Deseja continuar?';

    abrirConfirmacao('Editar Operação', msg, async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            const pRef = firestore.collection('produtos').doc(String(p.id));
                            batch.update(pRef, { estoque: (p.estoque || 0) + Number(item.qtd || 1) });
                            
                            const kardexRef = firestore.collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: `Estorno de Edição ${v.tipo} #${numPedStr}`,
                                prodId: p.id,
                                prodNome: p.nome,
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        } 
                    }); 
                }
                
                const finQuery = await firestore.collection('financeiro').where('origemVendaId', '==', String(id)).get();
                finQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                if(v.pag && typeof v.pag === 'string' && String(v.pag).includes('Dinheiro')) { 
                    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                    let cxSaldoNovo = (cxAtual.saldo || 0) - (Number(v.valorLiquido) || 0);
                    cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno (Edição) ${v.tipo} #${numPedStr}`, valor: (Number(v.valorLiquido) || 0) });
                    
                    const caixaRef = firestore.collection('fc_moveis').doc('caixa');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }

            const vendaRef = firestore.collection('vendas').doc(String(id));
            batch.delete(vendaRef);
            
            await batch.commit();"""

content = content.replace(editar_target, editar_replacement)

with open("operacao.js", "w", encoding="utf-8") as f:
    f.write(content)
print("Operacao.js refactored successfully.")
