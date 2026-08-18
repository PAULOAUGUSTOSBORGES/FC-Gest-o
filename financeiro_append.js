
// ==========================================
// TRANSFERÊNCIAS ENTRE CONTAS / BANCOS
// ==========================================
function abrirModalTransferenciaFin() {
    const valEl = document.getElementById('transf-fin-valor');
    const obsEl = document.getElementById('transf-fin-obs');
    const origEl = document.getElementById('transf-fin-origem');
    const destEl = document.getElementById('transf-fin-destino');
    
    if (valEl) valEl.value = '';
    if (obsEl) obsEl.value = '';
    if (origEl) origEl.value = 'Caixa Físico';
    if (destEl) destEl.value = 'Conta Corrente Principal';
    
    const modal = document.getElementById('modal-transferencia-fin');
    if (modal) modal.classList.remove('hidden');
    if (valEl) setTimeout(() => valEl.focus(), 100);
}

function fecharModalTransferenciaFin() {
    const modal = document.getElementById('modal-transferencia-fin');
    if (modal) modal.classList.add('hidden');
}

async function confirmarTransferenciaFin() {
    const origem = document.getElementById('transf-fin-origem')?.value || 'Caixa Físico';
    const destino = document.getElementById('transf-fin-destino')?.value || 'Conta Corrente Principal';
    const valor = parseFloat(document.getElementById('transf-fin-valor')?.value) || 0;
    const obs = document.getElementById('transf-fin-obs')?.value.trim() || '';

    if (valor <= 0) return showToast('Informe um valor válido para a transferência!', 'error');
    if (origem === destino) return showToast('A conta de origem e destino não podem ser iguais!', 'error');

    const batch = firestore.batch();
    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
    let cxSaldoNovo = cxAtual.saldo || 0;
    let atualizouCaixa = false;

    if (origem === 'Caixa Físico') {
        if (cxAtual.status !== 'ABERTO') return showToast('O Caixa Físico está fechado!', 'error');
        if (valor > cxSaldoNovo) return showToast('Saldo insuficiente!', 'error');
        cxSaldoNovo -= valor;
        cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: 'Transferência para ' + destino + (obs ? ' (' + obs + ')' : ''), valor: valor });
        atualizouCaixa = true;
    }

    if (destino === 'Caixa Físico') {
        if (cxAtual.status !== 'ABERTO') return showToast('O Caixa Físico está fechado!', 'error');
        cxSaldoNovo += valor;
        cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: 'Transferência de ' + origem + (obs ? ' (' + obs + ')' : ''), valor: valor });
        atualizouCaixa = true;
    }

    if (atualizouCaixa) {
        batch.set(firestore.collection('fc_moveis').doc('caixa'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
    }

    const transfRef = firestore.collection('financeiro').doc();
    const transfObj = {
        tipo: 'TRANSFERENCIA',
        origem: origem,
        destino: destino,
        pessoa: origem + ' ➔ ' + destino,
        ref: 'Transf: ' + origem + ' ➔ ' + destino,
        categoria: 'Transferência Entre Contas',
        centroCusto: 'Operacional',
        contaBancaria: destino,
        valor: valor,
        valorPago: valor,
        status: 'CONCLUIDA',
        observacao: obs,
        data: new Date().toISOString(),
        dataPagamento: new Date().toISOString(),
        metodoPagamento: 'Transferência Interna',
        ultimaAlteracao: Date.now()
    };
    batch.set(transfRef, transfObj);

    try {
        await batch.commit();
        fecharModalTransferenciaFin();
        renderTransferenciasFin();
        showToast('Transferência realizada!', 'success');
    } catch (e) {
        showToast('Erro ao transferir.', 'error');
    }
}

function renderTransferenciasFin() {
    const tbody = document.getElementById('tabela-transferencias-body');
    if (!tbody || !db.financeiro) return;
    const transferencias = db.financeiro.filter(f => f.tipo === 'TRANSFERENCIA' || f.categoria === 'Transferência Entre Contas').sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    if (transferencias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">Nenhuma transferência.</td></tr>';
        return;
    }

    tbody.innerHTML = transferencias.map(t => {
        const dataFmt = t.data ? formatData(t.data) : '-';
        const origemDestino = t.origem && t.destino ? t.origem + ' <i class="fa-solid fa-arrow-right mx-1 text-xs"></i> ' + t.destino : (t.pessoa || t.ref);
        return '<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-3 text-xs">' + dataFmt + '</td><td class="p-3 text-xs font-bold">' + origemDestino + '</td><td class="p-3 text-xs">' + (t.observacao || '-') + '</td><td class="p-3 text-right font-black text-sm">' + formatMoney(t.valor || 0) + '</td><td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700">CONCLUÍDA</span></td><td class="p-3 text-center"><button onclick="excluirTransferenciaFin(\'' + t.id + '\')" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></td></tr>';
    }).join('');
}

async function excluirTransferenciaFin(id) {
    const t = db.financeiro?.find(x => String(x.id) === String(id));
    if (!t) return;

    abrirConfirmacao('Cancelar', 'Cancelar transferência de ' + formatMoney(t.valor) + '?', async () => {
        const batch = firestore.batch();
        if (t.origem === 'Caixa Físico' || t.destino === 'Caixa Físico') {
            let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
            let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
            let cxSaldoNovo = cxAtual.saldo || 0;
            if (t.origem === 'Caixa Físico') {
                cxSaldoNovo += (t.valor || 0);
                cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: 'Estorno Transf: para ' + t.destino, valor: t.valor });
            } else if (t.destino === 'Caixa Físico') {
                cxSaldoNovo -= (t.valor || 0);
                cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: 'Estorno Transf: de ' + t.origem, valor: t.valor });
            }
            batch.set(firestore.collection('fc_moveis').doc('caixa'), { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
        }
        batch.delete(firestore.collection('financeiro').doc(String(id)));
        try {
            await batch.commit();
            renderTransferenciasFin();
            showToast('Transferência estornada!', 'success');
        } catch (e) {
            showToast('Erro ao estornar.', 'error');
        }
    });
}

// ==========================================
// OFX
// ==========================================
window.extratoOFXAtual = null;

function processarArquivoOFX(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    showToast('Lendo arquivo OFX bancário...', 'info');
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const buffer = e.target.result;
            let rawText = '';
            try {
                const decUtf8 = new TextDecoder('utf-8', { fatal: false });
                rawText = decUtf8.decode(buffer);
                if (/CHARSET\s*:\s*(1252|ISO-8859-1|WIN)/i.test(rawText) || rawText.includes('\uFFFD')) {
                    rawText = new TextDecoder('iso-8859-1').decode(buffer);
                }
            } catch (errDec) {
                rawText = new TextDecoder('iso-8859-1').decode(buffer);
            }
            const extrato = parseOFXContent(rawText);
            if (!extrato || !extrato.transacoes || extrato.transacoes.length === 0) return showToast('Sem transações', 'warning');
            window.extratoOFXAtual = extrato;
            cruzarOFXComFinanceiro();
            renderConciliacaoOFX();
            showToast('Lido com sucesso!', 'success');
        } catch (err) {
            showToast('Erro ao processar OFX', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function parseOFXContent(rawText) {
    const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    function extrairTag(bloco, tag) {
        const regex = new RegExp('<' + tag + '>([^<\\n\\r]+)', 'i');
        const match = bloco.match(regex);
        return match ? match[1].trim() : '';
    }
    const org = extrairTag(text, 'ORG') || extrairTag(text, 'FID');
    const bankId = extrairTag(text, 'BANKID');
    const acctId = extrairTag(text, 'ACCTID');
    let bancoNome = org || bankId || 'Banco';
    
    // Simplifica a regex para não travar
    const regexBloco = /<\s*STMTTRN\s*>([\s\S]*?)(?=<\s*\/\s*STMTTRN\s*>|<\s*STMTTRN\s*>|<\s*\/\s*BANKTRANLIST\s*>|$)/gi;
    const transacoes = [];
    let matchBloco;
    let idx = 0;
    while ((matchBloco = regexBloco.exec(text)) !== null) {
        const bloco = matchBloco[1];
        if (!bloco.trim()) continue;
        const trnType = extrairTag(bloco, 'TRNTYPE').toUpperCase();
        let dtPostedRaw = extrairTag(bloco, 'DTPOSTED');
        let trnAmtRaw = extrairTag(bloco, 'TRNAMT');
        const fitId = extrairTag(bloco, 'FITID');
        let memo = extrairTag(bloco, 'MEMO') || extrairTag(bloco, 'NAME') || '';
        let dataIso = '';
        const matchData = dtPostedRaw.match(/(\d{4})(\d{2})(\d{2})/);
        if (matchData) dataIso = matchData[1] + '-' + matchData[2] + '-' + matchData[3];
        else dataIso = new Date().toISOString().split('T')[0];
        const valorNum = parseFloat(trnAmtRaw.replace(',', '.')) || 0;
        if (valorNum === 0 && !memo) continue;
        const isCredito = valorNum > 0 || trnType === 'CREDIT' || trnType === 'DEP';
        transacoes.push({
            index: idx++,
            fitid: fitId || "ofx_" + Date.now() + "_" + idx,
            tipoFin: isCredito ? 'RECEITA' : 'DESPESA',
            isCredito: isCredito,
            data: dataIso,
            valor: Math.abs(valorNum),
            memo: memo,
            matchDoc: null,
            statusMatch: 'SEM_MATCH',
            conciliadoSucesso: false
        });
    }
    return { banco: bancoNome, conta: acctId, transacoes: transacoes };
}

function cruzarOFXComFinanceiro() {
    if (!window.extratoOFXAtual) return;
    const financeiro = db.financeiro || [];
    window.extratoOFXAtual.transacoes.forEach(t => {
        if (t.conciliadoSucesso) return;
        const jaConciliadoFitid = financeiro.find(f => f.fitid === t.fitid && f.status === 'PAGO');
        if (jaConciliadoFitid) { t.statusMatch = 'JA_CONCILIADO'; t.matchDoc = jaConciliadoFitid; return; }
        const candidatos = financeiro.filter(f => f.status !== 'CANCELADO' && (f.tipo === t.tipoFin || (!f.tipo && t.tipoFin==='RECEITA')));
        const matchExatoPendente = candidatos.find(f => f.status === 'PENDENTE' && Math.abs((f.valor||0)-t.valor)<=0.05);
        if (matchExatoPendente) { t.statusMatch = 'MATCH_EXATO'; t.matchDoc = matchExatoPendente; return; }
        const matchExatoPago = candidatos.find(f => f.status === 'PAGO' && Math.abs((f.valorPago||f.valor||0)-t.valor)<=0.05);
        if (matchExatoPago) { t.statusMatch = 'JA_CONCILIADO'; t.matchDoc = matchExatoPago; return; }
        t.statusMatch = 'SEM_MATCH';
        t.matchDoc = null;
    });
}

function renderConciliacaoOFX() {
    const area = document.getElementById('fin-area-conciliacao');
    const resumoPainel = document.getElementById('ofx-resumo-painel');
    const tabelaWrap = document.getElementById('ofx-tabela-wrap');
    const tbody = document.getElementById('ofx-tabela-body');

    if (!tbody || !window.extratoOFXAtual || !window.extratoOFXAtual.transacoes || window.extratoOFXAtual.transacoes.length === 0) {
        if (resumoPainel) resumoPainel.classList.add('hidden');
        if (tabelaWrap) tabelaWrap.classList.add('hidden');
        return;
    }

    cruzarOFXComFinanceiro();

    const extrato = window.extratoOFXAtual;
    const transacoes = extrato.transacoes;

    if (resumoPainel) {
        resumoPainel.classList.remove('hidden');
        const creditos = transacoes.filter(t => t.isCredito).reduce((acc, t) => acc + t.valor, 0);
        const debitos = transacoes.filter(t => !t.isCredito).reduce((acc, t) => acc + t.valor, 0);
        const bNomeEl = document.getElementById('ofx-banco-nome');
        if (bNomeEl) bNomeEl.innerText = extrato.banco;
        const cTotEl = document.getElementById('ofx-total-creditos');
        if (cTotEl) cTotEl.innerText = formatMoney(creditos);
        const dTotEl = document.getElementById('ofx-total-debitos');
        if (dTotEl) dTotEl.innerText = formatMoney(debitos);
        const rTotEl = document.getElementById('ofx-total-registros');
        if (rTotEl) rTotEl.innerText = transacoes.length + ' transações';
    }

    if (tabelaWrap) tabelaWrap.classList.remove('hidden');

    tbody.innerHTML = window.extratoOFXAtual.transacoes.map((t, idx) => {
        const dataFmt = t.data.split('-').reverse().join('/');
        const corValor = t.isCredito ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
        const sinalValor = t.isCredito ? '+ ' : '- ';
        const checkInput = (!t.conciliadoSucesso && t.statusMatch !== 'JA_CONCILIADO') ? '<input type="checkbox" class="ofx-item-check" data-idx="' + idx + '" checked>' : '<input type="checkbox" disabled>';
        
        let acaoHtml = '';
        let matchTexto = '';
        let statusBadge = '';

        if (t.statusMatch === 'JA_CONCILIADO') {
            matchTexto = '<span class="text-slate-500 font-medium">Baixado no sistema</span>';
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800"><i class="fa-solid fa-circle-check"></i> CONCILIADO</span>';
            acaoHtml = '<span class="text-emerald-600 font-bold text-xs"><i class="fa-solid fa-check"></i> Pronto</span>';
        } else if (t.statusMatch === 'MATCH_EXATO') {
            matchTexto = '<span class="font-bold text-emerald-700">' + t.matchDoc.pessoa + '</span>';
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">MATCH ENCONTRADO</span>';
            acaoHtml = '<button onclick="conciliarItemOFX(' + idx + ')" class="bg-emerald-600 text-white font-bold px-2 py-1 rounded text-xs"><i class="fa-solid fa-check"></i> Conciliar</button>';
        } else {
            matchTexto = '<span class="text-slate-400 italic">Não identificado</span>';
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">NOVO LANÇAMENTO</span>';
            acaoHtml = '<button onclick="criarEConciliarItemOFX(' + idx + ')" class="bg-blue-600 text-white font-bold px-2 py-1 rounded text-xs"><i class="fa-solid fa-plus"></i> Lançar & Baixar</button>';
        }
        return '<tr class="hover:bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700"><td class="p-3 text-center">' + checkInput + '</td><td class="p-3 text-xs">' + dataFmt + '</td><td class="p-3 text-xs font-bold">' + t.memo + '</td><td class="p-3 text-right font-black ' + corValor + '">' + sinalValor + formatMoney(t.valor) + '</td><td class="p-3 text-xs">' + matchTexto + '</td><td class="p-3 text-center">' + statusBadge + '</td><td class="p-3 text-center">' + acaoHtml + '</td></tr>';
    }).join('');
}

let ofxItemAtualIdx = null;

function conciliarItemOFX(idx) {
    abrirModalConciliacaoOFX(idx, true);
}

function criarEConciliarItemOFX(idx) {
    abrirModalConciliacaoOFX(idx, false);
}

function abrirModalConciliacaoOFX(idx, temMatch) {
    if (!window.extratoOFXAtual || !window.extratoOFXAtual.transacoes[idx]) return;
    const item = window.extratoOFXAtual.transacoes[idx];
    const docMatch = item.matchDoc;
    ofxItemAtualIdx = idx;

    document.getElementById('ofx-modal-ext-data').innerText = item.data.split('-').reverse().join('/');
    document.getElementById('ofx-modal-ext-desc').innerText = item.memo || '-';
    document.getElementById('ofx-modal-ext-valor').innerText = formatMoney(item.valor);

    if (temMatch && docMatch) {
        document.getElementById('ofx-modal-match-area').classList.remove('hidden');
        document.getElementById('ofx-modal-match-pessoa').innerText = docMatch.pessoa || docMatch.ref || '-';
        document.getElementById('ofx-modal-match-data').innerText = docMatch.data ? formatData(docMatch.data).split(' ')[0] : '-';
        document.getElementById('ofx-modal-match-valor').innerText = formatMoney(docMatch.valor);
        
        document.getElementById('ofx-modal-tipo-wrap').classList.add('hidden');
        document.getElementById('ofx-modal-tipo').value = docMatch.tipo || (item.isCredito ? 'RECEITA' : 'DESPESA');
        document.getElementById('ofx-modal-pessoa').value = docMatch.pessoa || '';
    } else {
        document.getElementById('ofx-modal-match-area').classList.add('hidden');
        document.getElementById('ofx-modal-tipo-wrap').classList.remove('hidden');
        document.getElementById('ofx-modal-tipo').value = item.isCredito ? 'RECEITA' : 'DESPESA';
        document.getElementById('ofx-modal-pessoa').value = item.memo || (item.isCredito ? 'Recebimento Bancário' : 'Despesa Bancária');
    }

    ofxModalAtualizarCategorias();
    
    if (temMatch && docMatch) {
        document.getElementById('ofx-modal-categoria').value = docMatch.categoria || '';
    } else {
        document.getElementById('ofx-modal-categoria').value = item.isCredito ? 'Outras Receitas' : 'Outras Despesas';
    }

    document.getElementById('ofx-modal-data-pgto').value = item.data;
    document.getElementById('ofx-modal-valor-pago').value = item.valor.toFixed(2);
    document.getElementById('ofx-modal-metodo').value = 'Transferência';
    document.getElementById('ofx-modal-conta-bancaria').value = window.extratoOFXAtual.banco || 'Conta Bancária';
    
    let obsDefault = 'Conciliado via OFX em ' + new Date().toLocaleDateString('pt-BR') + ' (Ref: ' + item.memo + ')';
    if (temMatch && docMatch && docMatch.observacao) {
        obsDefault = docMatch.observacao + '\n' + obsDefault;
    }
    document.getElementById('ofx-modal-obs').value = obsDefault;

    document.getElementById('modal-conciliacao-ofx').classList.remove('hidden');
}

function fecharModalConciliacaoOFX() {
    document.getElementById('modal-conciliacao-ofx').classList.add('hidden');
    ofxItemAtualIdx = null;
}

function ofxModalAtualizarCategorias() {
    const tipo = document.getElementById('ofx-modal-tipo').value;
    const catSelect = document.getElementById('ofx-modal-categoria');
    const cats = tipo === 'RECEITA' ? categoriasReceber : categoriasPagar;
    catSelect.innerHTML = cats.map(c => '<option value="' + c + '">' + c + '</option>').join('');
}

async function confirmarConciliacaoModalOFX() {
    if (ofxItemAtualIdx === null) return;
    const item = window.extratoOFXAtual.transacoes[ofxItemAtualIdx];
    const docMatch = item.matchDoc;
    const isNovo = !docMatch || (item.statusMatch === 'SEM_MATCH');

    const tipo = document.getElementById('ofx-modal-tipo').value;
    const pessoa = document.getElementById('ofx-modal-pessoa').value.trim();
    const categoria = document.getElementById('ofx-modal-categoria').value;
    const dataPgto = document.getElementById('ofx-modal-data-pgto').value;
    const valorPago = parseFloat(document.getElementById('ofx-modal-valor-pago').value);
    const metodo = document.getElementById('ofx-modal-metodo').value;
    const contaBancaria = document.getElementById('ofx-modal-conta-bancaria').value.trim();
    const obs = document.getElementById('ofx-modal-obs').value;

    if (!pessoa) return showToast('Preencha o Favorecido.', 'error');
    if (!dataPgto) return showToast('Preencha a Data.', 'error');
    if (isNaN(valorPago) || valorPago <= 0) return showToast('Preencha um Valor válido.', 'error');

    const batch = firestore.batch();
    
    if (isNovo) {
        const finRef = firestore.collection('financeiro').doc();
        const novoDoc = {
            tipo: tipo,
            pessoa: pessoa,
            ref: 'OFX: ' + (item.memo || 'Lançamento'),
            categoria: categoria,
            centroCusto: 'Operacional',
            contaBancaria: contaBancaria,
            valor: valorPago,
            valorPago: valorPago,
            status: 'PAGO',
            data: new Date(dataPgto + 'T12:00:00').toISOString(),
            dataPagamento: new Date(dataPgto + 'T12:00:00').toISOString(),
            metodoPagamento: metodo,
            fitid: item.fitid || '',
            observacao: obs,
            ultimaAlteracao: Date.now()
        };
        batch.set(finRef, novoDoc);
        item.matchDoc = { id: finRef.id, ...novoDoc };
    } else {
        const finRef = firestore.collection('financeiro').doc(String(docMatch.id));
        batch.update(finRef, {
            pessoa: pessoa,
            categoria: categoria,
            status: 'PAGO',
            valorPago: valorPago,
            metodoPagamento: metodo,
            contaBancaria: contaBancaria,
            dataPagamento: new Date(dataPgto + 'T12:00:00').toISOString(),
            fitid: item.fitid || '',
            observacao: obs,
            ultimaAlteracao: Date.now()
        });
    }

    try {
        await batch.commit();
        item.conciliadoSucesso = true;
        item.statusMatch = 'JA_CONCILIADO';
        fecharModalConciliacaoOFX();
        renderConciliacaoOFX();
        showToast(isNovo ? 'Criado e conciliado!' : 'Conciliado!', 'success');
    } catch (e) {
        showToast('Erro ao gravar.', 'error');
    }
}

function toggleTodosOFX(checked) {
    document.querySelectorAll('.ofx-item-check:not(:disabled)').forEach(cb => { cb.checked = checked; });
}

async function conciliarLoteOFX() {
    if (!window.extratoOFXAtual || !window.extratoOFXAtual.transacoes) return;
    const checkboxes = document.querySelectorAll('.ofx-item-check:checked');
    if (checkboxes.length === 0) return showToast('Selecione ao menos um!', 'warning');
    
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.idx));
    const bancoNome = window.extratoOFXAtual.banco || 'Conta Bancária';
    const batch = firestore.batch();
    let totalConciliados = 0;

    indices.forEach(idx => {
        const item = window.extratoOFXAtual.transacoes[idx];
        if (!item || item.conciliadoSucesso || item.statusMatch === 'JA_CONCILIADO') return;
        if (item.matchDoc && (item.statusMatch === 'MATCH_EXATO' || item.statusMatch === 'MATCH_PROVAVEL')) {
            const finRef = firestore.collection('financeiro').doc(String(item.matchDoc.id));
            batch.update(finRef, {
                status: 'PAGO',
                valorPago: item.valor,
                metodoPagamento: 'Extrato OFX (' + bancoNome + ')',
                contaBancaria: bancoNome,
                dataPagamento: new Date(item.data + 'T12:00:00').toISOString(),
                fitid: item.fitid || '',
                observacao: (item.matchDoc.observacao ? item.matchDoc.observacao + '\n' : '') + 'Conciliado via OFX',
                ultimaAlteracao: Date.now()
            });
            item.conciliadoSucesso = true;
            item.statusMatch = 'JA_CONCILIADO';
            totalConciliados++;
        } else if (item.statusMatch === 'SEM_MATCH') {
            const finRef = firestore.collection('financeiro').doc();
            const novoDoc = {
                tipo: item.tipoFin,
                pessoa: item.memo || (item.isCredito ? 'Recebimento Bancário' : 'Despesa Bancária'),
                ref: 'OFX: ' + (item.memo || 'Lançamento'),
                categoria: item.isCredito ? 'Outras Receitas' : 'Outras Despesas',
                centroCusto: 'Operacional',
                contaBancaria: bancoNome,
                valor: item.valor,
                valorPago: item.valor,
                status: 'PAGO',
                data: new Date(item.data + 'T12:00:00').toISOString(),
                dataPagamento: new Date(item.data + 'T12:00:00').toISOString(),
                metodoPagamento: 'Extrato OFX (' + bancoNome + ')',
                fitid: item.fitid || '',
                observacao: 'Criado via Extrato OFX',
                ultimaAlteracao: Date.now()
            };
            batch.set(finRef, novoDoc);
            item.conciliadoSucesso = true;
            item.statusMatch = 'JA_CONCILIADO';
            item.matchDoc = { id: finRef.id, ...novoDoc };
            totalConciliados++;
        }
    });

    if (totalConciliados === 0) return;
    try {
        await batch.commit();
        renderConciliacaoOFX();
        showToast(totalConciliados + ' lançamentos conciliados!', 'success');
    } catch (e) {
        showToast('Erro ao processar.', 'error');
    }
}

window.abrirModalTransferenciaFin = abrirModalTransferenciaFin;
window.fecharModalTransferenciaFin = fecharModalTransferenciaFin;
window.confirmarTransferenciaFin = confirmarTransferenciaFin;
window.renderTransferenciasFin = renderTransferenciasFin;
window.excluirTransferenciaFin = excluirTransferenciaFin;

window.processarArquivoOFX = processarArquivoOFX;
window.parseOFXContent = parseOFXContent;
window.cruzarOFXComFinanceiro = cruzarOFXComFinanceiro;
window.renderConciliacaoOFX = renderConciliacaoOFX;
window.conciliarItemOFX = conciliarItemOFX;
window.criarEConciliarItemOFX = criarEConciliarItemOFX;
window.conciliarLoteOFX = conciliarLoteOFX;
window.toggleTodosOFX = toggleTodosOFX;

window.abrirModalConciliacaoOFX = abrirModalConciliacaoOFX;
window.fecharModalConciliacaoOFX = fecharModalConciliacaoOFX;
window.ofxModalAtualizarCategorias = ofxModalAtualizarCategorias;
window.confirmarConciliacaoModalOFX = confirmarConciliacaoModalOFX;
