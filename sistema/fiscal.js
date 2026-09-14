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
            db.config = { ...db.config, empresa: { ...(db.config?.empresa || {}), ...dados.empresa } };
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
    const amb = (db.config?.empresa?.ambienteFiscal || 'homologacao').toLowerCase();
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
                status: (v.nfce.status_sefaz || v.status_fiscal || 'autorizado').toLowerCase(),
                mensagemSefaz: v.nfce.mensagem_sefaz || '',
                danfeUrl: v.nfce.danfe_url_completa || (v.nfce.caminho_danfe ? `https://api.focusnfe.com.br${v.nfce.caminho_danfe}` : ''),
                xmlUrl: v.nfce.xml_url_completa || (v.nfce.caminho_xml_nota_fiscal ? `https://api.focusnfe.com.br${v.nfce.caminho_xml_nota_fiscal}` : ''),
                xmlConteudo: v.nfce.xml_conteudo || v.fiscal_xml || '',
                qrCodeUrl: v.nfce.qr_code_url || v.fiscal_qrcode_url || '',
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
                status: (v.nfe.status_sefaz || v.status_fiscal || 'autorizado').toLowerCase(),
                mensagemSefaz: v.nfe.mensagem_sefaz || '',
                danfeUrl: v.nfe.danfe_url_completa || (v.nfe.caminho_danfe ? `https://api.focusnfe.com.br${v.nfe.caminho_danfe}` : ''),
                xmlUrl: v.nfe.xml_url_completa || (v.nfe.caminho_xml_nota_fiscal ? `https://api.focusnfe.com.br${v.nfe.caminho_xml_nota_fiscal}` : ''),
                xmlConteudo: v.nfe.xml_conteudo || v.fiscal_xml || '',
                cce: v.nfe.cce || null,
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
        if (filtroStatus === 'CANCELADO' && n.status !== 'cancelado') return false;
        if (filtroStatus === 'PROCESSANDO' && n.status !== 'processando') return false;
        if (filtroStatus === 'ERRO' && (n.status === 'autorizado' || n.status === 'cancelado' || n.status === 'processando')) return false;

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

        let badgeStatus = '';
        if (n.status === 'autorizado') {
            badgeStatus = `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-circle-check"></i> Autorizada</span>`;
        } else if (n.status === 'cancelado') {
            badgeStatus = `<span class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-ban"></i> Cancelada</span>`;
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
                            : (n.status === 'autorizado' ? `<button onclick="imprimirDanfeNativo('${n.vendaId}', '${n.tipo}')" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Imprimir DANFE"><i class="fa-solid fa-print"></i> DANFE</button>` : '')}
                        
                        ${n.xmlUrl 
                            ? `<a href="${n.xmlUrl}" target="_blank" download class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Baixar Arquivo XML"><i class="fa-solid fa-code"></i> XML</a>` 
                            : (n.xmlConteudo || n.status === 'autorizado' ? `<button onclick="baixarXmlNativo('${n.vendaId}', '${n.tipo}')" class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Baixar Arquivo XML"><i class="fa-solid fa-code"></i> XML</button>` : '')}
                        
                        ${n.status !== 'autorizado' ? `
                            <button onclick="reemitirNota('${n.vendaId}', '${n.tipo}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="Reemitir com a nova numeração na SEFAZ">
                                <i class="fa-solid fa-paper-plane"></i> Reemitir
                            </button>
                        ` : ''}

                        <button onclick="consultarSefaz('${n.vendaId}', '${n.tipo}')" class="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 p-1.5" title="Sincronizar Status SEFAZ"><i class="fa-solid fa-arrows-rotate"></i></button>
                        
                        ${isNFe && n.status === 'autorizado' ? `<button onclick="abrirModalCCe('${n.vendaId}', '${n.numero}')" class="text-indigo-500 hover:text-indigo-700 p-1.5" title="Carta de Correção (CC-e)"><i class="fa-solid fa-file-pen"></i></button>` : ''}
                        
                        ${n.status === 'autorizado' ? `<button onclick="abrirModalCancelamento('${n.vendaId}', '${n.tipo}', '${n.numero}')" class="text-red-500 hover:text-red-700 p-1.5" title="Cancelar Nota na SEFAZ"><i class="fa-solid fa-ban"></i></button>` : ''}
                    </div>
                </td>
            </tr>
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

async function confirmarCancelamentoNota() {
    if (!notaEmCancelamento) return;
    const just = document.getElementById('cancelar-justificativa')?.value.trim();
    if (!just || just.length < 15) {
        return showToast('A justificativa deve ter no mínimo 15 caracteres!', 'error');
    }

    const btn = document.getElementById('btn-confirmar-cancelar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelando...';

    try {
        const cancelarFunc = firebase.functions().httpsCallable('cancelarNotaFiscal');
        await cancelarFunc({
            vendaId: notaEmCancelamento.vendaId,
            tipo: notaEmCancelamento.tipo.toLowerCase().replace('-', ''),
            justificativa: just
        });
        showToast('Nota fiscal cancelada com sucesso na SEFAZ!', 'success');
        fecharModalCancelamento();
    } catch (e) {
        console.error(e);
        let msg = e.message;
        try {
            const parsed = JSON.parse(msg);
            if (parsed.mensagem_sefaz) msg = parsed.mensagem_sefaz;
            else if (parsed.erros && parsed.erros.length > 0) msg = parsed.erros[0].mensagem;
        } catch(err) {}
        showToast(`Erro ao cancelar: ${msg}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-ban"></i> Transmitir Cancelamento';
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
                    <button onclick="emitirNotaDireta('${v.id}', 'nfce')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded text-[11px] transition-colors flex items-center gap-1">
                        <i class="fa-solid fa-store"></i> NFC-e
                    </button>
                    <button onclick="emitirNotaDireta('${v.id}', 'nfe')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded text-[11px] transition-colors flex items-center gap-1">
                        <i class="fa-solid fa-file-invoice"></i> NF-e
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function emitirNotaDireta(vendaId, tipo) {
    showToast(`Transmitindo ${tipo.toUpperCase()} à SEFAZ...`, 'info');
    const overlay = document.getElementById('overlay-comunicando-sefaz');
    if (overlay) overlay.classList.remove('hidden');
    if (overlay) overlay.classList.add('flex');

    try {
        const func = firebase.functions().httpsCallable(tipo === 'nfce' ? 'emitirNFCe' : 'emitirNFe');
        const res = await func({ vendaId });
        showToast(`${tipo.toUpperCase()} transmitida com sucesso!`, 'success');
        document.getElementById('modal-selecionar-venda').classList.add('hidden');
    } catch (e) {
        console.error(e);
        let msg = e.message;
        try {
            const parsed = JSON.parse(msg);
            if (parsed.mensagem_sefaz) msg = parsed.mensagem_sefaz;
            else if (parsed.erros && parsed.erros.length > 0) msg = parsed.erros[0].mensagem;
        } catch(err) {}
        showToast(`Erro ao emitir ${tipo.toUpperCase()}: ${msg}`, 'error');
    } finally {
        if (overlay) overlay.classList.add('hidden');
        if (overlay) overlay.classList.remove('flex');
    }
}

// ==========================================
// IMPRESSÃO E DOWNLOAD NATIVOS (SEFAZ DIRETO)
// ==========================================
function baixarXmlNativo(vendaId, tipo = 'NFC-e') {
    const v = (typeof vendasGlobais !== 'undefined' ? vendasGlobais.find(x => x.id === vendaId) : null) 
        || (typeof window.vendaAtualImpressao !== 'undefined' && window.vendaAtualImpressao?.id === vendaId ? window.vendaAtualImpressao : null);
    if (!v) {
        if (typeof window.baixarXmlNativo === 'function') return window.baixarXmlNativo(vendaId, tipo);
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

function imprimirDanfeNativo(vendaId, tipo = 'NFC-e') {
    const v = (typeof vendasGlobais !== 'undefined' ? vendasGlobais.find(x => x.id === vendaId) : null)
        || (typeof window.vendaAtualImpressao !== 'undefined' && window.vendaAtualImpressao?.id === vendaId ? window.vendaAtualImpressao : null);
    if (!v) {
        if (typeof window.imprimirDanfeNativo === 'function') return window.imprimirDanfeNativo(vendaId, tipo);
        showToast('Venda não encontrada.', 'error');
        return;
    }
    const isNFe = (tipo === 'NF-e' || tipo === '55');
    const nota = isNFe ? v.nfe : v.nfce;
    const emp = db.config?.empresa || {};
    const chave = nota?.chave_nfe || v.fiscal_chave || '';
    const chaveFmt = chave.replace(/(\d{4})/g, '$1 ').trim();
    const qrCodeUrl = nota?.qr_code_url || v.fiscal_qrcode_url || `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${chave}`;
    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCodeUrl)}`;

    const printWin = window.open('', '_blank', 'width=460,height=700');
    if (!printWin) {
        showToast('Por favor, autorize pop-ups para imprimir o DANFE.', 'warning');
        return;
    }

    const itensHtml = (v.itens || v.produtos || []).map((it, i) => {
        const qtd = Number(it.quantidade || it.qtd || 1);
        const preco = Number(it.preco || it.precoUnitario || 0);
        return `
        <tr>
            <td style="font-size:10px; padding:2px 0;">${i+1} ${it.nome || it.descricao || 'Produto'}</td>
            <td style="font-size:10px; text-align:right;">${qtd} ${it.unidade || 'UN'}</td>
            <td style="font-size:10px; text-align:right;">${preco.toFixed(2)}</td>
            <td style="font-size:10px; text-align:right; font-weight:bold;">${(qtd * preco).toFixed(2)}</td>
        </tr>
    `;
    }).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>DANFE ${isNFe ? 'NF-e' : 'NFC-e'} - Nº ${nota?.numero || v.id}</title>
        <style>
            @page { margin: 2mm; size: ${isNFe ? 'A4 portrait' : '80mm auto'}; }
            body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; width: ${isNFe ? '180mm' : '72mm'}; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .border-b { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
            .border-t { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; }
            .qr { text-align: center; margin: 8px 0; }
            .qr img { width: 140px; height: 140px; }
        </style>
    </head>
    <body>
        <div class="text-center border-b">
            <div class="font-bold" style="font-size: 13px;">${emp.nome || 'EMPRESA COMERCIAL'}</div>
            <div>CNPJ: ${emp.cnpj || ''} - IE: ${emp.ie || ''}</div>
            <div>${emp.rua || ''}, ${emp.numero || ''} - ${emp.cidade || ''}/${emp.uf || ''}</div>
        </div>

        <div class="text-center font-bold border-b" style="padding: 2px 0;">
            DANFE ${isNFe ? 'NF-e - Documento Auxiliar da Nota Fiscal Eletrônica' : 'NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica'}
            <div style="font-size: 9px; font-weight: normal;">Não permite aproveitamento de crédito de ICMS</div>
        </div>

        <table>
            <thead>
                <tr style="border-bottom: 1px solid #000; font-size: 9px;">
                    <th style="text-align:left;">ITEM/DESC</th>
                    <th style="text-align:right;">QTD</th>
                    <th style="text-align:right;">UNIT</th>
                    <th style="text-align:right;">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                ${itensHtml}
            </tbody>
        </table>

        <div class="border-t">
            <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:12px;">
                <span>VALOR TOTAL R$</span>
                <span>${Number(v.tot || v.valorLiquido || 0).toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:10px;">
                <span>Forma de Pagamento</span>
                <span>${v.formaPagamento || v.pagamento || 'Dinheiro'}</span>
            </div>
        </div>

        <div class="border-t text-center" style="font-size: 10px;">
            <div>ÁREA DE MENSAGEM FISCAL</div>
            <div>Número: <strong>${nota?.numero || ''}</strong> - Série: <strong>${nota?.serie || '1'}</strong></div>
            <div>Emissão: ${nota?.data_emissao ? new Date(nota.data_emissao).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
            <div>Protocolo de Autorização: <strong>${nota?.protocolo || 'AUTORIZADO'}</strong></div>
        </div>

        <div class="border-t text-center" style="font-size: 9px;">
            <div>CHAVE DE ACESSO</div>
            <div class="font-bold" style="letter-spacing: 0.5px; word-break: break-all;">${chaveFmt}</div>
        </div>

        ${!isNFe ? `
        <div class="qr border-t">
            <div>Consulte pela Chave de Acesso em:</div>
            <div style="font-size:8px; word-break:break-all;">https://www.fazenda.${(emp.uf||'sp').toLowerCase()}.gov.br/nfce/consulta</div>
            <img src="${qrImgSrc}" alt="QR Code SEFAZ">
            <div style="font-size: 8px;">Consulte via Leitor de QR Code</div>
        </div>
        ` : ''}

        <div class="border-t text-center" style="font-size: 9px;">
            <div>CONSUMIDOR: ${v.clienteNome || 'Consumidor Não Identificado'}</div>
            ${v.clienteDoc ? `<div>CPF/CNPJ: ${v.clienteDoc}</div>` : ''}
        </div>

        <script>
            window.onload = function() {
                window.print();
            };
        </script>
    </body>
    </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
}
window.imprimirDanfeNativo = imprimirDanfeNativo;

