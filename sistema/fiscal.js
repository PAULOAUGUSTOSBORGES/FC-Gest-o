// ==========================================
// FISCAL.JS - GESTÃO COMPLETA DE NOTAS FISCAIS (NF-e & NFC-e)
// ==========================================

let notasFiscaisArray = [];
let notaEmCancelamento = null;
let notaEmCCe = null;
let unsubscribeVendas = null;

function inicializarFiscal() {
    atualizarBadgeAmbiente();

    // Listener para configurações da empresa
    const _listenDoc = (typeof window.fcListenDoc === 'function') ? window.fcListenDoc : function(col, id, cb) {
        return firestore.collection(col).doc(id).onSnapshot(doc => cb(doc.exists ? doc.data() : null));
    };

    _listenDoc('fc_moveis', 'config', function(dados) {
        if (dados && dados.empresa) {
            db.config = { ...db.config, empresa: { ...(db.config?.empresa || {}), ...dados.empresa, ambienteFiscal: 'producao' } };
            if (dados.empresa.ambienteFiscal !== 'producao') {
                firestore.collection('fc_moveis').doc('config').set({ empresa: { ambienteFiscal: 'producao' } }, { merge: true }).catch(console.error);
            }
            atualizarBadgeAmbiente();
            
            // Atualiza os inputs de numeração manual
            const elNFCe = document.getElementById('input-prox-nfce');
            if (elNFCe && document.activeElement !== elNFCe) {
                elNFCe.value = dados.empresa.proximoNumeroNFCe || 1;
            }
            const elNFe = document.getElementById('input-prox-nfe');
            if (elNFe && document.activeElement !== elNFe) {
                elNFe.value = dados.empresa.proximoNumeroNFe || 1;
            }
        }
    });

    // Conectar listener de vendas
    const _listenCol = (typeof window.fcListen === 'function') ? window.fcListen : function(col, cb) {
        return firestore.collection(col).onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };

    unsubscribeVendas = _listenCol('vendas', function(vendas) {
        db.vendas = vendas || [];
        processarNotasFiscais();
        renderNotasFiscais();
    });

    // Contador de caracteres na justificativa de cancelamento
    const txtJust = document.getElementById('cancelar-justificativa');
    if (txtJust) {
        txtJust.addEventListener('input', () => {
            const count = txtJust.value.trim().length;
            const elCount = document.getElementById('cancelar-char-count');
            if (elCount) {
                elCount.innerText = `${count} / 15 caracteres mínimos`;
                elCount.className = count >= 15 ? 'text-[10px] text-emerald-500 font-bold mt-1' : 'text-[10px] text-red-500 font-bold mt-1';
            }
        });
    }
}

window.addEventListener('load', () => { 
    initGlobalData(inicializarFiscal); 
});

// ==========================================
// ATUALIZAÇÃO DE AMBIENTE (PROD / HOMOLOG)
// ==========================================
function atualizarBadgeAmbiente() {
    const el = document.getElementById('badge-ambiente-fiscal');
    if (!el) return;
    const amb = (db.config?.empresa?.ambienteFiscal || 'producao').toLowerCase();
    if (amb === 'producao') {
        el.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1';
        el.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i> Produção SEFAZ';
    } else {
        el.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1';
        el.innerHTML = '<i class="fa-solid fa-vial text-amber-600"></i> Homologação (Testes)';
    }
}

// ==========================================
// CONFIGURAÇÃO MANUAL DE NÚMEROS DE NOTA
// ==========================================
async function salvarProxNumero(tipo) {
    const campo = tipo === 'NFCe' ? 'proximoNumeroNFCe' : 'proximoNumeroNFe';
    const inputId = tipo === 'NFCe' ? 'input-prox-nfce' : 'input-prox-nfe';
    const val = parseInt(document.getElementById(inputId)?.value);
    
    if (isNaN(val) || val <= 0) {
        toast('Número inválido!', 'red');
        return;
    }

    try {
        await firestore.collection('fc_moveis').doc('config').set({
            empresa: {
                [campo]: val
            }
        }, { merge: true });
        toast(`Próximo número ${tipo} atualizado para ${val}!`, 'green');
    } catch (err) {
        console.error('Erro ao salvar número:', err);
        toast('Erro ao atualizar número.', 'red');
    }
}

// ==========================================
// PROCESSAMENTO E EXTRAÇÃO DAS NOTAS FISCAIS
// ==========================================
function processarNotasFiscais() {
    notasFiscaisArray = [];
    const vendas = db.vendas || [];

    vendas.forEach(v => {
        // Se tem NFC-e
        if (v.nfce) {
            notasFiscaisArray.push({
                vendaId: v.id,
                numeroPedido: v.numeroPedido,
                tipo: 'NFC-e',
                modelo: '65',
                data: v.nfce.data_emissao || v.data,
                numero: v.nfce.numero || '-',
                serie: v.nfce.serie || '1',
                chave: v.nfce.chave_nfe || '',
                protocolo: v.nfce.protocolo || '',
                clienteNome: v.clienteNome || 'Consumidor Final',
                clienteDoc: v.clienteDoc || '',
                valor: Number(v.tot || v.valorLiquido || 0),
                status: (v.status_fiscal === 'cancelado_interno' || v.nfce.status_sefaz === 'cancelado_interno' ? 'cancelado_interno' : (v.nfce.status_sefaz || v.status_fiscal || 'autorizado')).toLowerCase(),
                mensagemSefaz: v.nfce.mensagem_sefaz || '',
                danfeUrl: v.nfce.danfe_url_completa || '',
                xmlUrl: v.nfce.xml_url_completa || '',
                xmlConteudo: v.nfce.xml_conteudo || v.fiscal_xml || '',
                qrCodeUrl: v.nfce.qr_code_url || v.fiscal_qrcode_url || '',
                ambiente: v.nfce.ambiente || (String(v.fiscal_xml || v.nfce.xml_conteudo || '').includes('<tpAmb>2</tpAmb>') ? 'homologacao' : 'producao'),
                motor: v.nfce.motor || v.fiscal_motor || 'sefaz_direto',
                rawVenda: v
            });
        }

        // Se tem NF-e
        if (v.nfe) {
            notasFiscaisArray.push({
                vendaId: v.id,
                numeroPedido: v.numeroPedido,
                tipo: 'NF-e',
                modelo: '55',
                data: v.nfe.data_emissao || v.data,
                numero: v.nfe.numero || '-',
                serie: v.nfe.serie || '1',
                chave: v.nfe.chave_nfe || '',
                protocolo: v.nfe.protocolo || '',
                clienteNome: v.clienteNome || 'Cliente',
                clienteDoc: v.clienteDoc || '',
                valor: Number(v.tot || v.valorLiquido || 0),
                status: (v.status_fiscal === 'cancelado_interno' || v.nfe.status_sefaz === 'cancelado_interno' ? 'cancelado_interno' : (v.nfe.status_sefaz || v.status_fiscal || 'autorizado')).toLowerCase(),
                mensagemSefaz: v.nfe.mensagem_sefaz || '',
                danfeUrl: v.nfe.danfe_url_completa || '',
                xmlUrl: v.nfe.xml_url_completa || '',
                xmlConteudo: v.nfe.xml_conteudo || v.fiscal_xml || '',
                cce: v.nfe.cce || null,
                ambiente: v.nfe.ambiente || (String(v.fiscal_xml || v.nfe.xml_conteudo || '').includes('<tpAmb>2</tpAmb>') ? 'homologacao' : 'producao'),
                motor: v.nfe.motor || v.fiscal_motor || 'sefaz_direto',
                rawVenda: v
            });
        }
    });

    // Ordenar pelas mais recentes
    notasFiscaisArray.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
}

// ==========================================
// RENDERIZAÇÃO E FILTROS DA TABELA
// ==========================================
function renderNotasFiscais() {
    const tbody = document.getElementById('tabela-notas-body');
    if (!tbody) return;

    const termo = (document.getElementById('busca-fiscal')?.value || '').toLowerCase().trim();
    const filtroTipo = document.getElementById('filtro-tipo-fiscal')?.value || 'TODOS';
    const filtroStatus = document.getElementById('filtro-status-fiscal')?.value || 'TODOS';
    const filtroPeriodo = document.getElementById('filtro-periodo-fiscal')?.value || 'este_mes';

    const agora = new Date();
    let dIni = null;
    let dFim = null;

    if (filtroPeriodo === 'este_mes') {
        dIni = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
        dFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59).getTime();
    } else if (filtroPeriodo === 'mes_passado') {
        dIni = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).getTime();
        dFim = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).getTime();
    } else if (filtroPeriodo === 'ultimos_30') {
        dIni = agora.getTime() - (30 * 24 * 60 * 60 * 1000);
        dFim = agora.getTime();
    }

    let filtradas = notasFiscaisArray.filter(n => {
        // Filtro de data
        if (dIni && dFim && n.data) {
            const tNota = new Date(n.data).getTime();
            if (tNota < dIni || tNota > dFim) return false;
        }

        // Filtro de tipo
        if (filtroTipo === 'NFE' && n.tipo !== 'NF-e') return false;
        if (filtroTipo === 'NFCE' && n.tipo !== 'NFC-e') return false;

        // Filtro de status
        if (filtroStatus === 'AUTORIZADO' && n.status !== 'autorizado') return false;
        if (filtroStatus === 'CONTINGENCIA' && n.status !== 'contingencia') return false;
        if (filtroStatus === 'CANCELADO' && (n.status !== 'cancelado' && n.status !== 'cancelado_interno')) return false;
        if (filtroStatus === 'PROCESSANDO' && n.status !== 'processando') return false;
        if (filtroStatus === 'ERRO' && (n.status === 'autorizado' || n.status === 'contingencia' || n.status === 'cancelado' || n.status === 'cancelado_interno' || n.status === 'processando')) return false;

        // Filtro de texto
        if (termo) {
            const matchCli = String(n.clienteNome || '').toLowerCase().includes(termo);
            const matchDoc = String(n.clienteDoc || '').includes(termo);
            const matchNum = String(n.numero || '').includes(termo);
            const matchChave = String(n.chave || '').includes(termo);
            const matchPed = String(n.numeroPedido || '').includes(termo);
            if (!matchCli && !matchDoc && !matchNum && !matchChave && !matchPed) return false;
        }

        return true;
    });

    atualizarKPIs(filtradas);

    if (filtradas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-8 text-center text-slate-400">
                    <i class="fa-solid fa-file-circle-xmark text-3xl mb-2 block opacity-40"></i>
                    Nenhuma nota fiscal encontrada com os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtradas.map(n => {
        const dataFmt = n.data ? new Date(n.data).toLocaleString('pt-BR') : '-';
        const isNFe = n.tipo === 'NF-e';
        const badgeMod = isNFe 
            ? `<span class="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap"><i class="fa-solid fa-file-invoice"></i> NF-e (55)</span>`
            : `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap"><i class="fa-solid fa-store"></i> NFC-e (65)</span>`;

        const isHomol = n.ambiente === 'homologacao';
        let badgeStatus = '';
        if (n.status === 'autorizado') {
            badgeStatus = isHomol 
                ? `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]" title="Nota emitida em ambiente de Homologação (Testes SEFAZ) - Sem valor legal na base nacional."><i class="fa-solid fa-flask"></i> Teste (Homologação)</span>`
                : `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-circle-check"></i> Autorizada</span>`;
        } else if (n.status === 'contingencia') {
            badgeStatus = `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]" title="NFC-e emitida em contingência off-line. Pendente de autorização pela SEFAZ."><i class="fa-solid fa-triangle-exclamation"></i> Contingência</span>`;
        } else if (n.status === 'cancelado') {
            badgeStatus = `<span class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-ban"></i> Cancelada (SEFAZ)</span>`;
        } else if (n.status === 'cancelado_interno') {
            badgeStatus = `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]" title="Cancelada administrativamente no sistema (Prazo SEFAZ expirado)"><i class="fa-solid fa-file-excel"></i> Cancelada (Interno)</span>`;
        } else if (n.status === 'processando') {
            badgeStatus = `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-spinner fa-spin"></i> Processando</span>`;
        } else {
            const msgLimpa = (n.mensagemSefaz || 'Rejeição na SEFAZ').replace(/"/g, '&quot;');
            const encMsg = encodeURIComponent(n.mensagemSefaz || 'Erro retornado pela SEFAZ durante a validação da nota.');
            badgeStatus = `<button type="button" onclick="mostrarErroSefaz('${encMsg}')" title="${msgLimpa}" class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-sm"><i class="fa-solid fa-circle-exclamation text-red-500"></i> ${n.status === 'erro_autorizacao' ? 'Rejeitada' : n.status.toUpperCase()}</button>`;
        }

        const chaveAbrev = n.chave ? `${n.chave.slice(0, 6)}...${n.chave.slice(-6)}` : '-';
        const btnCopiarChave = n.chave ? `<button onclick="navigator.clipboard.writeText('${n.chave}'); showToast('Chave copiada!', 'success');" class="text-slate-400 hover:text-blue-500 ml-1" title="Copiar Chave Completa"><i class="fa-regular fa-copy"></i></button>` : '';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <td class="p-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">${dataFmt}</td>
                <td class="p-3">${badgeMod}</td>
                <td class="p-3 font-mono font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">Nº ${n.numero} <span class="text-[10px] text-slate-400 font-normal">(Série ${n.serie})</span></td>
                <td class="p-3">
                    <strong class="text-slate-800 dark:text-slate-100 block max-w-[180px] truncate">${n.clienteNome}</strong>
                    <span class="text-[10px] text-slate-400 font-mono">${n.clienteDoc || 'Consumidor'}</span>
                </td>
                <td class="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    ${chaveAbrev} ${btnCopiarChave}
                </td>
                <td class="p-3 text-right font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    ${typeof formatMoney === 'function' ? formatMoney(n.valor) : `R$ ${n.valor.toFixed(2)}`}
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    ${badgeStatus}
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1.5">
                        ${n.danfeUrl 
                            ? `<a href="${n.danfeUrl}" target="_blank" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Imprimir / Visualizar DANFE (PDF)"><i class="fa-solid fa-print"></i> DANFE</a>` 
                            : (n.status === 'autorizado' || n.status === 'contingencia' ? `<button onclick="imprimirDanfeNativo('${n.vendaId}', '${n.tipo}')" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Imprimir DANFE"><i class="fa-solid fa-print"></i> DANFE</button>` : '')}
                        
                        ${n.xmlUrl 
                            ? `<a href="${n.xmlUrl}" target="_blank" download class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Baixar Arquivo XML"><i class="fa-solid fa-code"></i> XML</a>` 
                            : (n.xmlConteudo || n.status === 'autorizado' || n.status === 'contingencia' ? `<button onclick="baixarXmlNativo('${n.vendaId}', '${n.tipo}')" class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Baixar Arquivo XML"><i class="fa-solid fa-code"></i> XML</button>` : '')}
                        
                        ${n.status === 'contingencia' ? `
                            <button onclick="transmitirNotaContingencia('${n.vendaId}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="Transmitir NFC-e em Contingência para a SEFAZ">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Transmitir
                            </button>
                        ` : ''}

                        ${((n.status !== 'autorizado' && n.status !== 'contingencia') || isHomol) ? `
                            <button onclick="reemitirNota('${n.vendaId}', '${n.tipo}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="${isHomol ? 'Emitir esta nota agora na SEFAZ Oficial (Produção com Valor Legal)' : 'Reemitir com a nova numeração na SEFAZ'}">
                                <i class="fa-solid fa-paper-plane"></i> ${isHomol ? 'Emitir Oficial' : 'Reemitir'}
                            </button>
                        ` : ''}

                        <button onclick="consultarSefaz('${n.vendaId}', '${n.tipo}')" class="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 p-1.5" title="Sincronizar Status SEFAZ"><i class="fa-solid fa-arrows-rotate"></i></button>
                        
                        ${isNFe && n.status === 'autorizado' && !isHomol ? `<button onclick="abrirModalCCe('${n.vendaId}', '${n.numero}')" class="text-indigo-500 hover:text-indigo-700 p-1.5" title="Carta de Correção (CC-e)"><i class="fa-solid fa-file-pen"></i></button>` : ''}
                        
                        ${n.status === 'autorizado' && !isHomol ? `<button onclick="abrirModalCancelamento('${n.vendaId}', '${n.tipo}', '${n.numero}')" class="text-red-500 hover:text-red-700 p-1.5" title="Cancelar Nota na SEFAZ"><i class="fa-solid fa-ban"></i></button>` : ''}

                        ${((n.status !== 'autorizado' && n.status !== 'contingencia' && n.status !== 'cancelado') || isHomol) ? `
                            <button onclick="excluirNotaFiscal('${n.vendaId}', '${n.tipo}')" class="text-red-400 hover:text-red-600 p-1.5" title="Excluir registro desta nota do sistema">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
        `;
    }).join('');
}

function filtrarNotasFiscais() {
    renderNotasFiscais();
}

function mudarPeriodoFiscal() {
    renderNotasFiscais();
}

// ==========================================
// ATUALIZAÇÃO DOS CARDS / KPIS
// ==========================================
function atualizarKPIs(lista) {
    const totalNotas = lista.length;
    const totalValor = lista.filter(n => n.status === 'autorizado').reduce((acc, n) => acc + n.valor, 0);

    const nfes = lista.filter(n => n.tipo === 'NF-e');
    const valorNfe = nfes.filter(n => n.status === 'autorizado').reduce((acc, n) => acc + n.valor, 0);

    const nfces = lista.filter(n => n.tipo === 'NFC-e');
    const valorNfce = nfces.filter(n => n.status === 'autorizado').reduce((acc, n) => acc + n.valor, 0);

    const canceladas = lista.filter(n => n.status === 'cancelado' || n.status === 'erro' || (typeof n.status === 'string' && n.status.includes('erro'))).length;

    const elTotal = document.getElementById('kpi-total-notas'); if (elTotal) elTotal.innerText = totalNotas;
    const elTotVal = document.getElementById('kpi-total-valor'); if (elTotVal) elTotVal.innerText = typeof formatMoney === 'function' ? formatMoney(totalValor) : `R$ ${totalValor.toFixed(2)}`;

    const elNfe = document.getElementById('kpi-total-nfe'); if (elNfe) elNfe.innerText = nfes.length;
    const elNfeVal = document.getElementById('kpi-nfe-valor'); if (elNfeVal) elNfeVal.innerText = typeof formatMoney === 'function' ? formatMoney(valorNfe) : `R$ ${valorNfe.toFixed(2)}`;

    const elNfce = document.getElementById('kpi-total-nfce'); if (elNfce) elNfce.innerText = nfces.length;
    const elNfceVal = document.getElementById('kpi-nfce-valor'); if (elNfceVal) elNfceVal.innerText = typeof formatMoney === 'function' ? formatMoney(valorNfce) : `R$ ${valorNfce.toFixed(2)}`;

    const elCanc = document.getElementById('kpi-total-canceladas'); if (elCanc) elCanc.innerText = canceladas;
}

// ==========================================
// CONSULTA / ATUALIZAÇÃO DE STATUS SEFAZ
// ==========================================
async function consultarSefaz(vendaId, tipo) {
    const nota = notasFiscaisArray.find(n => String(n.vendaId) === String(vendaId));
    if (nota && (nota.motor === 'sefaz_direto' || !nota.danfeUrl)) {
        if (nota.status === 'autorizado') {
            return showToast(`Nota Nº ${nota.numero} autorizada pela SEFAZ! Chave: ${nota.chave ? nota.chave.slice(0, 8) + '...' : ''}`, 'success');
        } else {
            if (nota.mensagemSefaz) {
                mostrarErroSefaz(encodeURIComponent(nota.mensagemSefaz));
            } else {
                showToast('Utilize o botão "Reemitir" para transmitir a nota novamente à SEFAZ.', 'info');
            }
            return;
        }
    }

    showToast(`Consultando SEFAZ para ${tipo}...`, 'info');
    try {
        const consultarFunc = firebase.functions().httpsCallable('consultarStatusNota');
        const res = await consultarFunc({ vendaId, tipo: tipo.toLowerCase().replace('-', '') });
        showToast(`Status SEFAZ: ${res.data.data?.status_sefaz || 'Atualizado'}`, 'success');
    } catch (e) {
        console.error(e);
        showToast(`Erro na consulta: ${e.message}`, 'error');
    }
}

// ==========================================
// REEMISSÃO DE NOTA FISCAL (SEFAZ DIRETO)
// ==========================================
async function reemitirNota(vendaId, tipo) {
    const isNFe = tipo === 'NF-e' || tipo === 'nfe' || tipo === '55';
    const tipoFuncao = isNFe ? 'emitirNFe' : 'emitirNFCe';
    const labelTipo = isNFe ? 'NF-e (Modelo 55)' : 'NFC-e (Modelo 65)';

    showToast(`Transmitindo ${labelTipo} à SEFAZ... aguarde.`, 'info');
    const overlay = document.getElementById('overlay-comunicando-sefaz');
    if (overlay) overlay.classList.remove('hidden');
    if (overlay) overlay.classList.add('flex');

    try {
        const emitirFunc = firebase.functions().httpsCallable(tipoFuncao);
        const resp = await emitirFunc({ vendaId });
        const res = resp.data;

        if (res && res.success) {
            showToast(`${labelTipo} Nº ${res.data?.numero || ''} autorizada com sucesso pela SEFAZ!`, 'success');
        } else {
            const motivo = res?.message || 'Nota rejeitada pela SEFAZ.';
            showToast(`Rejeição SEFAZ: ${motivo}`, 'error');
            mostrarErroSefaz(encodeURIComponent(motivo));
        }
        processarNotasFiscais();
        renderNotasFiscais();
    } catch (e) {
        console.error("Erro ao reemitir nota:", e);
        let msg = e.message || 'Erro na comunicação com a SEFAZ.';
        try {
            const parsed = JSON.parse(msg);
            if (parsed.mensagem_sefaz) msg = parsed.mensagem_sefaz;
            else if (parsed.erros && parsed.erros.length > 0) msg = parsed.erros[0].mensagem;
        } catch(err) {}
        showToast(`Erro na emissão: ${msg}`, 'error');
    } finally {
        if (overlay) overlay.classList.add('hidden');
        if (overlay) overlay.classList.remove('flex');
    }
}
window.reemitirNota = reemitirNota;

async function transmitirNotaContingencia(vendaId) {
    showToast('Transmitindo NFC-e em contingência à SEFAZ... aguarde.', 'info');
    const overlay = document.getElementById('overlay-comunicando-sefaz');
    if (overlay) overlay.classList.remove('hidden');
    if (overlay) overlay.classList.add('flex');

    try {
        const func = firebase.functions().httpsCallable('transmitirNFCeContingencia');
        const resp = await func({ vendaId });
        const res = resp.data;

        if (res && res.success) {
            showToast(res.message || 'NFC-e autorizada com sucesso pela SEFAZ!', 'success');
            if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
                const v = db.vendas.find(x => String(x.id) === String(vendaId));
                if (v) {
                    v.status_fiscal = 'autorizado';
                    if (v.nfce) {
                        v.nfce.status_sefaz = 'autorizado';
                        if (res.protocolo) v.nfce.protocolo = res.protocolo;
                    }
                }
            }
        } else {
            showToast(res?.message || 'Falha ao autorizar nota na SEFAZ.', 'error');
        }
        processarNotasFiscais();
        renderNotasFiscais();
    } catch (e) {
        console.error("Erro ao transmitir contingência:", e);
        let msg = e.message || 'Erro na comunicação com a SEFAZ.';
        try {
            const parsed = JSON.parse(msg);
            if (parsed.mensagem_sefaz) msg = parsed.mensagem_sefaz;
            else if (parsed.erros && parsed.erros.length > 0) msg = parsed.erros[0].mensagem;
        } catch(err) {}
        showToast(`Erro na autorização: ${msg}`, 'error');
        mostrarErroSefaz(encodeURIComponent(msg));
    } finally {
        if (overlay) overlay.classList.add('hidden');
        if (overlay) overlay.classList.remove('flex');
    }
}
window.transmitirNotaContingencia = transmitirNotaContingencia;

// ==========================================
// EXIBIÇÃO DE DETALHES DE REJEIÇÃO SEFAZ
// ==========================================
function mostrarErroSefaz(msgEnc) {
    const msg = decodeURIComponent(msgEnc || '');
    const modal = document.getElementById('modal-detalhes-erro-sefaz');
    if (modal) {
        const p = document.getElementById('texto-erro-sefaz');
        if (p) p.innerText = msg;
        modal.classList.remove('hidden');
    } else {
        alert(`Detalhes da Rejeição SEFAZ:\n\n${msg}`);
    }
}
window.mostrarErroSefaz = mostrarErroSefaz;

function atualizarTabelaFiscal() {
    processarNotasFiscais();
    renderNotasFiscais();
    showToast('Lista de notas fiscais sincronizada!', 'success');
}
window.atualizarTabelaFiscal = atualizarTabelaFiscal;

// ==========================================
// CANCELAMENTO DE NOTA FISCAL
// ==========================================
function abrirModalCancelamento(vendaId, tipo, numero) {
    notaEmCancelamento = { vendaId, tipo, numero };
    const elInfo = document.getElementById('cancelar-info-nota');
    if (elInfo) elInfo.innerHTML = `<strong>${tipo.toUpperCase()} Nº ${numero}</strong> (Venda ID: ${vendaId})`;
    
    const txt = document.getElementById('cancelar-justificativa');
    if (txt) txt.value = '';
    const elCount = document.getElementById('cancelar-char-count');
    if (elCount) elCount.innerText = '0 / 15 caracteres';

    document.getElementById('modal-cancelar-nota').classList.remove('hidden');
}

function fecharModalCancelamento() {
    document.getElementById('modal-cancelar-nota').classList.add('hidden');
    notaEmCancelamento = null;
}

async function confirmarCancelamentoNota(forcarInterno = false) {
    if (!notaEmCancelamento) return;
    const just = document.getElementById('cancelar-justificativa')?.value.trim();
    if (!just || just.length < 15) {
        return showToast('A justificativa deve ter no mínimo 15 caracteres!', 'error');
    }

    const btn = document.getElementById(forcarInterno ? 'btn-cancelar-interno' : 'btn-confirmar-cancelar');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    }

    try {
        const cancelarFunc = firebase.functions().httpsCallable('cancelarNotaFiscal');
        const res = await cancelarFunc({
            vendaId: notaEmCancelamento.vendaId,
            tipo: notaEmCancelamento.tipo.toLowerCase().replace('-', ''),
            justificativa: just,
            forcarInterno: forcarInterno
        });

        if (res.data?.canceladoInterno || forcarInterno) {
            showToast('Nota cancelada administrativamente no sistema!', 'success');
        } else {
            showToast('Nota fiscal cancelada com sucesso na SEFAZ!', 'success');
        }
        fecharModalCancelamento();
        if (typeof carregarNotasFiscais === 'function') {
            await carregarNotasFiscais();
        }
    } catch (e) {
        console.error('Erro no cancelamento:', e);
        let msg = e.message || '';
        try {
            const parsed = JSON.parse(msg);
            if (parsed.mensagem_sefaz) msg = parsed.mensagem_sefaz;
            else if (parsed.erros && parsed.erros.length > 0) msg = parsed.erros[0].mensagem;
        } catch(err) {}

        const isPrazoExpirado = msg.includes('501') || msg.toLowerCase().includes('prazo de cancelamento superior');
        if (isPrazoExpirado && !forcarInterno) {
            const confirmaInterno = confirm(
                `A SEFAZ rejeitou o cancelamento pois o prazo regulamentar expirou (30 minutos para NFC-e / 24h para NF-e perante a Receita Estadual).\n\n` +
                `Deseja registrar o cancelamento administrativamente no sistema para estornar o financeiro e atualizar o estoque?`
            );
            if (confirmaInterno) {
                return confirmarCancelamentoNota(true);
            }
        }

        showToast(`Erro ao cancelar: ${msg}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// ==========================================
// CARTA DE CORREÇÃO (CC-e)
// ==========================================
function abrirModalCCe(vendaId, numero) {
    notaEmCCe = { vendaId, numero };
    const elInfo = document.getElementById('cce-info-nota');
    if (elInfo) elInfo.innerHTML = `<strong>NF-e (Mod 55) Nº ${numero}</strong> (Venda ID: ${vendaId})`;

    const txt = document.getElementById('cce-texto');
    if (txt) txt.value = '';

    document.getElementById('modal-cce-nota').classList.remove('hidden');
}

function fecharModalCCe() {
    document.getElementById('modal-cce-nota').classList.add('hidden');
    notaEmCCe = null;
}

async function confirmarCartaCorrecao() {
    if (!notaEmCCe) return;
    const correcao = document.getElementById('cce-texto')?.value.trim();
    if (!correcao || correcao.length < 15) {
        return showToast('O texto da correção deve ter no mínimo 15 caracteres!', 'error');
    }

    const btn = document.getElementById('btn-confirmar-cce');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try {
        const cceFunc = firebase.functions().httpsCallable('cartaCorrecaoNFe');
        await cceFunc({
            vendaId: notaEmCCe.vendaId,
            correcao: correcao
        });
        showToast('Carta de Correção transmitida com sucesso à SEFAZ!', 'success');
        fecharModalCCe();
    } catch (e) {
        console.error(e);
        showToast(`Erro ao transmitir CC-e: ${e.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Transmitir CC-e';
    }
}

// ==========================================
// EXPORTAÇÃO EM LOTE DOS XMLS (ZIP PARA CONTADOR)
// ==========================================
async function baixarLoteMensalXML() {
    if (typeof JSZip === 'undefined') {
        return showToast('Biblioteca de compactação não carregada.', 'error');
    }

    const notasComXml = notasFiscaisArray.filter(n => n.xmlUrl && (n.status === 'autorizado' || n.status === 'cancelado'));
    if (notasComXml.length === 0) {
        return showToast('Nenhuma nota fiscal com XML disponível para exportação.', 'info');
    }

    const btn = document.getElementById('btn-exportar-lote');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando ZIP...';
    }

    showToast(`Baixando ${notasComXml.length} arquivo(s) XML...`, 'info');

    try {
        const zip = new JSZip();
        let baixados = 0;

        for (const n of notasComXml) {
            try {
                const resp = await fetch(n.xmlUrl);
                if (resp.ok) {
                    const xmlText = await resp.text();
                    const nomeArquivo = `${n.tipo}_${n.numero}_${n.chave || n.vendaId}.xml`;
                    zip.file(nomeArquivo, xmlText);
                    baixados++;
                }
            } catch (err) {
                console.warn(`Erro ao baixar XML da nota ${n.numero}:`, err);
            }
        }

        if (baixados === 0) {
            throw new Error('Não foi possível fazer download dos arquivos XML da SEFAZ.');
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const urlBlob = URL.createObjectURL(content);

        const a = document.createElement('a');
        a.href = urlBlob;
        const dataHoje = new Date().toISOString().split('T')[0];
        a.download = `Notas_Fiscais_FC_Moveis_${dataHoje}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(urlBlob);

        showToast(`Pacote com ${baixados} XML(s) gerado com sucesso!`, 'success');

    } catch (e) {
        console.error(e);
        showToast(`Erro ao gerar ZIP de XMLs: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-zipper text-sm"></i> Baixar Lote XML (ZIP)';
        }
    }
}

// ==========================================
// FATURAR VENDA PENDENTE DO HISTÓRICO
// ==========================================
function abrirModalEmitirAvulsa() {
    renderVendasParaFaturar();
    document.getElementById('modal-selecionar-venda').classList.remove('hidden');
}

function renderVendasParaFaturar() {
    const lista = document.getElementById('lista-vendas-avulsas');
    if (!lista) return;

    const termo = (document.getElementById('busca-venda-avulsa')?.value || '').toLowerCase().trim();
    const vendasSemNota = (db.vendas || []).filter(v => !v.nfe && !v.nfce && v.tipo !== 'ORÇAMENTO');

    let filtradas = vendasSemNota;
    if (termo) {
        filtradas = filtradas.filter(v => 
            String(v.clienteNome || '').toLowerCase().includes(termo) ||
            String(v.numeroPedido || '').includes(termo) ||
            String(v.id || '').includes(termo)
        );
    }

    filtradas.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    if (filtradas.length === 0) {
        lista.innerHTML = '<p class="text-center text-slate-400 py-6">Nenhuma venda pendente encontrada.</p>';
        return;
    }

    lista.innerHTML = filtradas.slice(0, 30).map(v => {
        const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0');
        const dataStr = v.data ? new Date(v.data).toLocaleDateString('pt-BR') : '-';
        const valorFmt = typeof formatMoney === 'function' ? formatMoney(v.tot || 0) : `R$ ${(v.tot || 0).toFixed(2)}`;

        return `
            <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 hover:border-blue-500 transition-colors">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-mono font-bold text-slate-800 dark:text-slate-100 text-xs">#${numPedStr}</span>
                        <span class="text-[10px] text-slate-400">${dataStr}</span>
                    </div>
                    <p class="font-bold text-slate-700 dark:text-slate-200 text-xs mt-0.5">${v.clienteNome || 'Consumidor Final'}</p>
                    <span class="text-[11px] font-black text-emerald-600">${valorFmt}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="emitirNotaDireta('${v.id}', 'nfce', false)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded text-[11px] transition-colors flex items-center gap-1" title="Emitir NFC-e Online">
                        <i class="fa-solid fa-store"></i> NFC-e
                    </button>
                    <button onclick="emitirNotaDireta('${v.id}', 'nfce', true)" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1.5 rounded text-[11px] transition-colors flex items-center gap-1" title="Emitir NFC-e em Contingência Off-line">
                        <i class="fa-solid fa-triangle-exclamation"></i> Contingência
                    </button>
                    <button onclick="emitirNotaDireta('${v.id}', 'nfe')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded text-[11px] transition-colors flex items-center gap-1" title="Emitir NF-e Completa (Mod 55)">
                        <i class="fa-solid fa-file-invoice"></i> NF-e
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function emitirNotaDireta(vendaId, tipo, contingencia = false) {
    // Se modo contingência estiver ativado no toggle, força contingência em NFC-e
    if (tipo === 'nfce' && !contingencia) {
        contingencia = localStorage.getItem('fc_modo_contingencia') === 'true';
    }
    const label = contingencia ? 'NFC-e em CONTINGÊNCIA' : tipo.toUpperCase();
    showToast(`Processando ${label}...`, 'info');
    const overlay = document.getElementById('overlay-comunicando-sefaz');
    if (overlay) overlay.classList.remove('hidden');
    if (overlay) overlay.classList.add('flex');

    try {
        const func = firebase.functions().httpsCallable(tipo === 'nfce' ? 'emitirNFCe' : 'emitirNFe');
        const res = await func({ vendaId, contingencia: Boolean(contingencia) });
        showToast(res.data?.message || `${label} emitida com sucesso!`, 'success');
        document.getElementById('modal-selecionar-venda').classList.add('hidden');
        processarNotasFiscais();
        renderNotasFiscais();
    } catch (e) {
        console.error(e);
        let msg = e.message;
        try {
            const parsed = JSON.parse(msg);
            if (parsed.mensagem_sefaz) msg = parsed.mensagem_sefaz;
            else if (parsed.erros && parsed.erros.length > 0) msg = parsed.erros[0].mensagem;
        } catch(err) {}
        showToast(`Erro ao emitir ${label}: ${msg}`, 'error');
    } finally {
        if (overlay) overlay.classList.add('hidden');
        if (overlay) overlay.classList.remove('flex');
    }
}

// ==========================================
// IMPRESSÃO E DOWNLOAD NATIVOS (SEFAZ DIRETO)
// ==========================================
async function obterVendaParaImpressao(vendaId) {
    let v = null;
    if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
        v = db.vendas.find(x => String(x.id) === String(vendaId));
    }
    if (!v && typeof notasFiscaisArray !== 'undefined' && Array.isArray(notasFiscaisArray)) {
        v = notasFiscaisArray.find(x => String(x.vendaId) === String(vendaId))?.rawVenda;
    }
    if (!v && typeof vendasGlobais !== 'undefined' && Array.isArray(vendasGlobais)) {
        v = vendasGlobais.find(x => String(x.id) === String(vendaId));
    }
    if (!v && typeof window.vendaAtualImpressao !== 'undefined' && window.vendaAtualImpressao?.id === vendaId) {
        v = window.vendaAtualImpressao;
    }
    if (!v && typeof firestore !== 'undefined') {
        try {
            const doc = await firestore.collection('vendas').doc(String(vendaId)).get();
            if (doc.exists) {
                v = { id: doc.id, ...doc.data() };
            }
        } catch (err) {
            console.warn('Erro ao buscar venda no Firestore:', err);
        }
    }
    return v;
}

async function baixarXmlNativo(vendaId, tipo = 'NFC-e') {
    const v = await obterVendaParaImpressao(vendaId);
    if (!v) {
        showToast('Venda não encontrada.', 'error');
        return;
    }
    const xml = v.fiscal_xml || v.nfce?.xml_conteudo || v.nfe?.xml_conteudo || '';
    if (!xml) {
        showToast('Conteúdo do arquivo XML não encontrado no banco de dados.', 'warning');
        return;
    }
    const chave = v.fiscal_chave || v.nfce?.chave_nfe || v.nfe?.chave_nfe || `nota_${vendaId}`;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chave}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Download do XML concluído!', 'success');
}
window.baixarXmlNativo = baixarXmlNativo;

async function imprimirDanfeNativo(vendaId, tipo = 'NFC-e') {
    const v = await obterVendaParaImpressao(vendaId);
    if (!v) {
        showToast('Venda não encontrada.', 'error');
        return;
    }
    const isNFe = (tipo === 'NF-e' || tipo === 'nfe' || tipo === '55');
    const nota = isNFe ? (v.nfe || {}) : (v.nfce || {});
    const emp = db.config?.empresa || {};
    const chave = nota?.chave_nfe || v.fiscal_chave || '';
    const qrCodeUrl = nota?.qr_code_url || v.fiscal_qrcode_url || (chave ? `https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=${chave}` : '');
    const qrImgSrc = qrCodeUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCodeUrl)}` : '';

    let html = '';
    if (isNFe && typeof window.gerarHtmlDanfeNFeA4 === 'function') {
        html = window.gerarHtmlDanfeNFeA4(v, nota, emp);
    } else if (typeof window.gerarHtmlDanfeNFCe80mm === 'function') {
        html = window.gerarHtmlDanfeNFCe80mm(v, nota, emp, qrImgSrc);
    } else if (typeof gerarHtmlDanfeNFeA4 === 'function' && isNFe) {
        html = gerarHtmlDanfeNFeA4(v, nota, emp);
    } else if (typeof gerarHtmlDanfeNFCe80mm === 'function') {
        html = gerarHtmlDanfeNFCe80mm(v, nota, emp, qrImgSrc);
    }

    if (!html) {
        showToast('Erro ao gerar layout de impressão.', 'error');
        return;
    }

    // Cria Blob URL para compatibilidade total com o protocolo file:// e HTTP
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    // Abre janela popup de impressão com a URL do Blob
    let printWin = null;
    try {
        const winW = isNFe ? 850 : 450;
        const winH = isNFe ? 950 : 700;
        printWin = window.open(blobUrl, '_blank', `width=${winW},height=${winH}`);
    } catch (e) {
        console.warn('Popup bloqueado ou não suportado:', e);
    }

    if (printWin) {
        return;
    }

    // Fallback caso popups estejam bloqueados: imprime usando iframe invisível com srcdoc
    let iframe = document.getElementById('iframe-impressao-fiscal');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'iframe-impressao-fiscal';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }
    
    iframe.srcdoc = html;
    iframe.onload = () => {
        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                showToast('Erro ao imprimir. Por favor, autorize pop-ups no navegador.', 'warning');
            }
        }, 300);
    };
}
window.imprimirDanfeNativo = imprimirDanfeNativo;

// ==========================================
// TOGGLE MODO CONTINGÊNCIA
// ==========================================
function toggleModoContingencia() {
    const atual = localStorage.getItem('fc_modo_contingencia') === 'true';
    const novo = !atual;
    localStorage.setItem('fc_modo_contingencia', String(novo));
    atualizarBotaoContingencia();
    if (novo) {
        showToast('⚠️ Modo Contingência ATIVADO — NFC-e serão emitidas off-line.', 'warning');
    } else {
        showToast('✅ Modo Contingência DESATIVADO — NFC-e serão transmitidas normalmente.', 'success');
    }
}

function atualizarBotaoContingencia() {
    const btn = document.getElementById('btn-toggle-contingencia');
    const label = document.getElementById('label-contingencia');
    if (!btn) return;
    const ativo = localStorage.getItem('fc_modo_contingencia') === 'true';
    if (ativo) {
        btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all duration-200 bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-md';
        if (label) label.textContent = 'Contingência: ON';
    } else {
        btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all duration-200 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600';
        if (label) label.textContent = 'Contingência: OFF';
    }
}

window.toggleModoContingencia = toggleModoContingencia;
window.atualizarBotaoContingencia = atualizarBotaoContingencia;

// Inicializa o botão ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(atualizarBotaoContingencia, 300);
});

// ==========================================
// EXCLUIR NOTA FISCAL (REJEITADAS / ERRO)
// ==========================================
async function excluirNotaFiscal(vendaId, tipo) {
    const confirmar = confirm(`Deseja excluir o registro desta ${tipo || 'nota'} rejeitada do sistema?\n\nEssa ação remove apenas o registro fiscal — a venda continua ativa.`);
    if (!confirmar) return;

    try {
        const vendaRef = firestore.collection('vendas').doc(String(vendaId));
        const snap = await vendaRef.get();

        if (!snap.exists) {
            showToast('Venda não encontrada no banco de dados.', 'error');
            return;
        }

        const venda = snap.data();
        const updates = {};

        // Remove campos fiscais NFC-e
        if (venda.nfce) {
            updates.nfce = firebase.firestore.FieldValue.delete();
        }
        // Remove campos fiscais NF-e
        if (venda.nfe) {
            updates.nfe = firebase.firestore.FieldValue.delete();
        }
        // Limpa status fiscal
        updates.status_fiscal = firebase.firestore.FieldValue.delete();
        updates.fiscal_numero = firebase.firestore.FieldValue.delete();
        updates.fiscal_chave = firebase.firestore.FieldValue.delete();
        updates.fiscal_xml = firebase.firestore.FieldValue.delete();
        updates.fiscal_contingencia = firebase.firestore.FieldValue.delete();

        await vendaRef.update(updates);

        // Atualiza cache local
        if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
            const idx = db.vendas.findIndex(x => String(x.id) === String(vendaId));
            if (idx !== -1) {
                db.vendas.splice(idx, 1);
            }
        }

        showToast('Registro fiscal excluído. A venda continua ativa.', 'success');
        processarNotasFiscais();
        renderNotasFiscais();
    } catch (e) {
        console.error('Erro ao excluir nota fiscal:', e);
        showToast('Erro ao excluir: ' + (e.message || 'Tente novamente.'), 'error');
    }
}

window.excluirNotaFiscal = excluirNotaFiscal;
