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

    // Listener para notas fiscais de serviço (NFS-e)
    _listenCol('notas_servico', function(nfs) {
        db.notasServico = nfs || [];
        processarNotasFiscais();
        renderNotasFiscais();
    });

    // Listener para notas fiscais de devolução / estorno
    _listenCol('notas_devolucao', function(devs) {
        db.notasDevolucao = devs || [];
        processarNotasFiscais();
        renderNotasFiscais();
    });

    // Listener para clientes (puxar dados cadastrados em notas avulsas)
    _listenCol('clientes', function(clientes) {
        db.clientes = clientes || [];
        if (typeof popularDatalistsAvulsa === 'function') popularDatalistsAvulsa();
    });

    // Listener para produtos / estoque (puxar dados cadastrados em notas avulsas)
    _listenCol('produtos', function(produtos) {
        db.produtos = produtos || [];
        if (typeof popularDatalistsAvulsa === 'function') popularDatalistsAvulsa();
        if (typeof popularDatalistsDevolucaoCompra === 'function') popularDatalistsDevolucaoCompra();
    });

    // Listener para fornecedores (puxar dados para devolução de compra à indústria)
    _listenCol('fornecedores', function(fornecedores) {
        db.fornecedores = fornecedores || [];
        if (typeof popularDatalistsDevolucaoCompra === 'function') popularDatalistsDevolucaoCompra();
    });

    // Auto-limpeza silenciosa de tentativas rejeitadas do banco
    try {
        if (typeof firebase !== 'undefined' && firebase.functions) {
            const fnLimpar = firebase.functions().httpsCallable('limparDevolucoesRejeitadas');
            fnLimpar().then(res => {
                if (res.data?.removidas > 0 || res.data?.vendasCorrigidas > 0) {
                    console.log('[Fiscal] Limpeza concluída:', res.data.message);
                }
            }).catch(() => {});
        }
    } catch(e) {}

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
    if (amb === 'contingencia') {
        el.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-600 flex items-center gap-1 animate-pulse';
        el.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-600 dark:text-amber-400"></i> CONTINGÊNCIA SEFAZ';
    } else if (amb === 'producao') {
        el.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1';
        el.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i> Produção SEFAZ';
    } else {
        el.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1';
        el.innerHTML = '<i class="fa-solid fa-vial text-blue-600"></i> Homologação (Testes)';
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
        // Só é estornada se a devolução foi EFETIVAMENTE AUTORIZADA na SEFAZ
        const devObj = (v.nfe_devolucao && v.nfe_devolucao.status_sefaz === 'autorizado')
            ? v.nfe_devolucao
            : (db.notasDevolucao || []).find(nd => String(nd.vendaId) === String(v.id) && nd.status_sefaz === 'autorizado');

        const isEstornada = Boolean(devObj && devObj.status_sefaz === 'autorizado');

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
                status: isEstornada ? 'devolvido' : (v.status_fiscal === 'cancelado_interno' || v.nfce.status_sefaz === 'cancelado_interno' ? 'cancelado_interno' : (v.nfce.status_sefaz || (v.status_fiscal !== 'devolvido' ? v.status_fiscal : 'autorizado') || 'autorizado')).toLowerCase(),
                mensagemSefaz: isEstornada ? `Estornada perante a SEFAZ pela NF-e de Devolução Nº ${devObj?.numero || ''}` : (v.nfce.mensagem_sefaz || ''),
                danfeUrl: v.nfce.danfe_url_completa || '',
                xmlUrl: v.nfce.xml_url_completa || '',
                xmlConteudo: v.nfce.xml_conteudo || v.fiscal_xml || '',
                qrCodeUrl: v.nfce.qr_code_url || v.fiscal_qrcode_url || '',
                ambiente: v.nfce.ambiente || (String(v.fiscal_xml || v.nfce.xml_conteudo || '').includes('<tpAmb>2</tpAmb>') ? 'homologacao' : 'producao'),
                motor: v.nfce.motor || v.fiscal_motor || 'sefaz_direto',
                estornadaPorDevolucao: isEstornada,
                chaveDevolucao: devObj?.chave_nfe || '',
                numeroDevolucao: devObj?.numero || '',
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
                status: isEstornada ? 'devolvido' : (v.status_fiscal === 'cancelado_interno' || v.nfe.status_sefaz === 'cancelado_interno' ? 'cancelado_interno' : (v.nfe.status_sefaz || (v.status_fiscal !== 'devolvido' ? v.status_fiscal : 'autorizado') || 'autorizado')).toLowerCase(),
                mensagemSefaz: isEstornada ? `Estornada perante a SEFAZ pela NF-e de Devolução Nº ${devObj?.numero || ''}` : (v.nfe.mensagem_sefaz || ''),
                danfeUrl: v.nfe.danfe_url_completa || '',
                xmlUrl: v.nfe.xml_url_completa || '',
                xmlConteudo: v.nfe.xml_conteudo || v.fiscal_xml || '',
                cce: v.nfe.cce || null,
                ambiente: v.nfe.ambiente || (String(v.fiscal_xml || v.nfe.xml_conteudo || '').includes('<tpAmb>2</tpAmb>') ? 'homologacao' : 'producao'),
                motor: v.nfe.motor || v.fiscal_motor || 'sefaz_direto',
                estornadaPorDevolucao: isEstornada,
                chaveDevolucao: devObj?.chave_nfe || '',
                numeroDevolucao: devObj?.numero || '',
                rawVenda: v
            });
        }

        // Se tem NF-e de Devolução EFETIVAMENTE AUTORIZADA emitida para esta venda
        if (devObj && devObj.status_sefaz === 'autorizado') {
            const pedRef = v.numeroPedido ? `#${String(v.numeroPedido).padStart(4, '0')}` : `#${String(v.id).slice(-4)}`;
            notasFiscaisArray.push({
                vendaId: v.id,
                numeroPedido: v.numeroPedido,
                tipo: 'NF-e Devolução',
                modelo: '55',
                data: devObj.data_emissao || devObj.criadoEm || v.data,
                numero: devObj.numero || '-',
                serie: devObj.serie || '1',
                chave: devObj.chave_nfe || '',
                protocolo: devObj.protocolo || '',
                clienteNome: `${v.clienteNome || 'Consumidor Final'} (Devolução Venda ${pedRef})`,
                clienteDoc: v.clienteDoc || '',
                valor: Number(devObj.valor || v.tot || v.valorLiquido || 0),
                status: 'autorizado',
                mensagemSefaz: devObj.mensagem_sefaz || 'NF-e de Devolução Autorizada na SEFAZ',
                danfeUrl: devObj.danfe_url_completa || devObj.danfeUrl || '',
                xmlUrl: devObj.xml_url_completa || devObj.xmlUrl || '',
                xmlConteudo: devObj.xml_conteudo || '',
                ambiente: devObj.ambiente || 'producao',
                motor: devObj.motor || 'sefaz_direto',
                isDevolucao: true,
                chaveOriginal: devObj.chave_original || '',
                rawVenda: v
            });
        }

        // Se tem NFS-e na venda
        if (v.nfse) {
            notasFiscaisArray.push({
                vendaId: v.id,
                numeroPedido: v.numeroPedido,
                tipo: 'NFS-e',
                modelo: 'NFS-e',
                data: v.nfse.data_emissao || v.data,
                numero: v.nfse.numero || '-',
                serie: v.nfse.serie || '1',
                chave: v.nfse.codigo_verificacao || v.nfse.chave || '',
                protocolo: v.nfse.codigo_verificacao || '',
                clienteNome: v.nfse.tomador?.nome || v.clienteNome || 'Tomador do Serviço',
                clienteDoc: v.nfse.tomador?.doc || v.clienteDoc || '',
                valor: Number(v.nfse.valor || v.tot || 0),
                status: (v.nfse.status || 'autorizado').toLowerCase(),
                mensagemSefaz: 'NFS-e Autorizada',
                danfeUrl: '',
                xmlUrl: '',
                xmlConteudo: v.nfse.xml_conteudo || '',
                rawVenda: v
            });
        }
    });

    // Notas de devolução registradas na coleção notas_devolucao
    (db.notasDevolucao || []).forEach(nd => {
        // Ignorar tentativas rejeitadas ou sem autorização SEFAZ
        if (nd.status_sefaz !== 'autorizado') return;
        if (nd.chave_nfe && notasFiscaisArray.some(x => x.chave === nd.chave_nfe)) return;
        if (nd.vendaId && notasFiscaisArray.some(x => String(x.vendaId) === String(nd.vendaId) && x.isDevolucao)) return;
        notasFiscaisArray.push({
            vendaId: nd.vendaId || nd.id,
            numeroPedido: nd.vendaId,
            tipo: 'NF-e Devolução',
            modelo: '55',
            data: nd.data_emissao || nd.criadoEm,
            numero: nd.numero || '-',
            serie: nd.serie || '1',
            chave: nd.chave_nfe || '',
            protocolo: nd.protocolo || '',
            clienteNome: nd.clienteNome || `Devolução (${nd.tipo_devolucao || 'Operação'})`,
            clienteDoc: nd.clienteDoc || '',
            valor: Number(nd.valor || 0),
            status: 'autorizado',
            mensagemSefaz: nd.mensagem_sefaz || 'NF-e de Devolução Autorizada na SEFAZ',
            danfeUrl: nd.danfe_url_completa || nd.danfeUrl || '',
            xmlUrl: nd.xml_url_completa || nd.xmlUrl || '',
            xmlConteudo: nd.xml_conteudo || '',
            ambiente: nd.ambiente || 'producao',
            motor: nd.motor || 'sefaz_direto',
            isDevolucao: true,
            chaveOriginal: nd.chave_original || '',
            rawDevolucao: nd
        });
    });

    // NFS-e avulsas emitidas pelo painel
    (db.notasServico || []).forEach(ns => {
        if (ns.vendaId && notasFiscaisArray.some(x => String(x.vendaId) === String(ns.vendaId) && x.tipo === 'NFS-e')) {
            return;
        }
        notasFiscaisArray.push({
            vendaId: ns.vendaId || ns.id,
            numeroPedido: ns.numero,
            tipo: 'NFS-e',
            modelo: 'NFS-e',
            data: ns.data_emissao || ns.criadoEm,
            numero: ns.numero || '-',
            serie: ns.serie || '1',
            chave: ns.codigo_verificacao || ns.chave || '',
            protocolo: ns.codigo_verificacao || '',
            clienteNome: ns.tomador?.nome || 'Tomador do Serviço',
            clienteDoc: ns.tomador?.doc || '',
            valor: Number(ns.valor || 0),
            status: (ns.status || 'autorizado').toLowerCase(),
            mensagemSefaz: 'NFS-e Autorizada',
            danfeUrl: '',
            xmlUrl: '',
            xmlConteudo: ns.xml_conteudo || '',
            rawServico: ns
        });
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
        if (filtroTipo === 'NFSE' && n.tipo !== 'NFS-e') return false;
        if (filtroTipo === 'DEVOLUCAO' && !n.isDevolucao && !n.estornadaPorDevolucao && n.status !== 'devolvido') return false;

        // Filtro de status
        if (filtroStatus === 'AUTORIZADO' && n.status !== 'autorizado' && !n.isDevolucao) return false;
        if (filtroStatus === 'DEVOLVIDO' && n.status !== 'devolvido' && !n.isDevolucao && !n.estornadaPorDevolucao) return false;
        if (filtroStatus === 'CONTINGENCIA' && n.status !== 'contingencia') return false;
        if (filtroStatus === 'CANCELADO' && (n.status !== 'cancelado' && n.status !== 'cancelado_interno')) return false;
        if (filtroStatus === 'PROCESSANDO' && n.status !== 'processando') return false;
        if (filtroStatus === 'ERRO' && (n.status === 'autorizado' || n.status === 'contingencia' || n.status === 'cancelado' || n.status === 'cancelado_interno' || n.status === 'processando' || n.status === 'devolvido' || n.isDevolucao)) return false;

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
        const isNFSe = n.tipo === 'NFS-e';
        const isDev = n.isDevolucao || n.tipo === 'NF-e Devolução';
        const badgeMod = isNFSe 
            ? `<span class="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap"><i class="fa-solid fa-screwdriver-wrench"></i> NFS-e (Serviço)</span>`
            : (isDev
                ? `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap"><i class="fa-solid fa-rotate-left"></i> Devolução (55)</span>`
                : (isNFe 
                    ? `<span class="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap"><i class="fa-solid fa-file-invoice"></i> NF-e (55)</span>`
                    : `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap"><i class="fa-solid fa-store"></i> NFC-e (65)</span>`));

        const isHomol = n.ambiente === 'homologacao';
        let badgeStatus = '';
        if (n.status === 'devolvido' || n.estornadaPorDevolucao) {
            badgeStatus = `<span class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px]" title="Venda estornada perante a SEFAZ via NF-e de Devolução Nº ${n.numeroDevolucao || ''}"><i class="fa-solid fa-rotate-left"></i> Estornada (Devolvida)</span>`;
        } else if (n.status === 'autorizado') {
            if (isDev) {
                badgeStatus = `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-circle-check"></i> Autorizada (Devolução)</span>`;
            } else {
                badgeStatus = isHomol 
                    ? `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]" title="Nota emitida em ambiente de Homologação (Testes SEFAZ) - Sem valor legal na base nacional."><i class="fa-solid fa-flask"></i> Teste (Homologação)</span>`
                    : `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-circle-check"></i> Autorizada</span>`;
            }
        } else if (n.status === 'contingencia') {
            badgeStatus = `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]" title="NFC-e emitida em contingência off-line. Pendente de autorização pela SEFAZ."><i class="fa-solid fa-triangle-exclamation"></i> Contingência</span>`;
        } else if (n.status === 'cancelado') {
            badgeStatus = `<span class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-ban"></i> Cancelada (SEFAZ)</span>`;
        } else if (n.status === 'cancelado_interno') {
            badgeStatus = `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]" title="Cancelamento apenas interno sem transmissão para a SEFAZ. Use o botão de Devolução (laranja) para estornar oficialmente na SEFAZ."><i class="fa-solid fa-triangle-exclamation"></i> Cancelada (Interno - Pendente SEFAZ)</span>`;
        } else if (n.status === 'processando') {
            badgeStatus = `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-spinner fa-spin"></i> Processando</span>`;
        } else {
            const msgLimpa = (n.mensagemSefaz || 'Rejeição na SEFAZ').replace(/"/g, '&quot;');
            const encMsg = encodeURIComponent(n.mensagemSefaz || 'Erro retornado pela SEFAZ durante a validação da nota.');
            badgeStatus = `<button type="button" onclick="mostrarErroSefaz('${encMsg}')" title="${msgLimpa}" class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-sm"><i class="fa-solid fa-circle-exclamation text-red-500"></i> ${n.status === 'erro_autorizacao' ? 'Rejeitada' : n.status.toUpperCase()}</button>`;
        }

        const chaveAbrev = n.chave ? `${n.chave.slice(0, 6)}...${n.chave.slice(-6)}` : '-';
        const btnCopiarChave = n.chave ? `<button onclick="navigator.clipboard.writeText('${n.chave}'); showToast('Chave copiada!', 'success');" class="text-slate-400 hover:text-blue-500 ml-1" title="Copiar Chave Completa"><i class="fa-regular fa-copy"></i></button>` : '';

        const vRaw = n.rawVenda || (db.vendas || []).find(x => String(x.id) === String(n.vendaId));
        const numPedFmt = vRaw?.numeroPedido ? `#${String(vRaw.numeroPedido).padStart(4, '0')}` : (vRaw?.numero ? `#${String(vRaw.numero).padStart(4, '0')}` : (n.numeroPedido ? `#${String(n.numeroPedido).padStart(4, '0')}` : `#${String(n.vendaId || '0').slice(-6)}`));

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <td class="p-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">${dataFmt}</td>
                <td class="p-3">${badgeMod}</td>
                <td class="p-3 font-mono text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    <div class="font-bold">Nº ${n.numero} <span class="text-[10px] text-slate-400 font-normal">(Série ${n.serie})</span></div>
                    <div class="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1"><i class="fa-solid fa-receipt text-[10px]"></i> Pedido ${numPedFmt}</div>
                </td>
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
                        ${isNFSe ? `
                            <button onclick="imprimirDanfse('${n.numero}', '${n.vendaId}')" class="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/60 px-2.5 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="Imprimir / Visualizar Espelho da NFS-e"><i class="fa-solid fa-print"></i> Imprimir NFS-e</button>
                        ` : `
                            ${isDev ? `
                                <button onclick="imprimirDanfeNativo('${n.vendaId}', 'NF-e Devolução')" class="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="Imprimir DANFE da Devolução (A4)"><i class="fa-solid fa-print"></i> DANFE</button>
                                <button onclick="baixarXmlNativo('${n.vendaId}', 'NF-e Devolução')" class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="Baixar Arquivo XML da Devolução"><i class="fa-solid fa-code"></i> XML</button>
                            ` : `
                                ${n.danfeUrl 
                                    ? `<a href="${n.danfeUrl}" target="_blank" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Imprimir / Visualizar DANFE (PDF)"><i class="fa-solid fa-print"></i> DANFE</a>` 
                                    : (n.status === 'autorizado' || n.status === 'contingencia' || n.status === 'devolvido' ? `<button onclick="imprimirDanfeNativo('${n.vendaId}', '${n.tipo}')" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Imprimir DANFE"><i class="fa-solid fa-print"></i> DANFE</button>` : '')}
                                
                                ${n.xmlUrl 
                                    ? `<a href="${n.xmlUrl}" target="_blank" download class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Baixar Arquivo XML"><i class="fa-solid fa-code"></i> XML</a>` 
                                    : (n.xmlConteudo || n.status === 'autorizado' || n.status === 'contingencia' || n.status === 'devolvido' ? `<button onclick="baixarXmlNativo('${n.vendaId}', '${n.tipo}')" class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1" title="Baixar Arquivo XML"><i class="fa-solid fa-code"></i> XML</button>` : '')}
                            `}
                        `}
                        
                        ${(n.estornadaPorDevolucao || n.status === 'devolvido') ? `
                            <span class="text-[10px] text-purple-700 dark:text-purple-300 font-bold px-2 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded flex items-center gap-1" title="Estornada pela NF-e Devolução Nº ${n.numeroDevolucao || ''}"><i class="fa-solid fa-check-double text-emerald-500"></i> Estornada</span>
                        ` : ''}

                        ${n.status === 'contingencia' ? `
                            <button onclick="transmitirNotaContingencia('${n.vendaId}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="Transmitir NFC-e em Contingência para a SEFAZ">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Transmitir
                            </button>
                        ` : ''}

                        ${((n.status !== 'autorizado' && n.status !== 'contingencia' && n.status !== 'devolvido') || isHomol) && !isNFSe && !isDev ? `
                            <button onclick="reemitirNota('${n.vendaId}', '${n.tipo}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm" title="${isHomol ? 'Emitir esta nota agora na SEFAZ Oficial (Produção com Valor Legal)' : 'Reemitir com a nova numeração na SEFAZ'}">
                                <i class="fa-solid fa-paper-plane"></i> ${isHomol ? 'Emitir Oficial' : 'Reemitir'}
                            </button>
                        ` : ''}

                        ${!isNFSe && !isDev ? `<button onclick="consultarSefaz('${n.vendaId}', '${n.tipo}')" class="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 p-1.5" title="Sincronizar Status SEFAZ"><i class="fa-solid fa-arrows-rotate"></i></button>` : ''}
                        
                        ${isNFe && n.status === 'autorizado' && !isDev && !isHomol ? `<button onclick="abrirModalCCe('${n.vendaId}', '${n.numero}')" class="text-indigo-500 hover:text-indigo-700 p-1.5" title="Carta de Correção (CC-e)"><i class="fa-solid fa-file-pen"></i></button>` : ''}
                        
                        ${(isNFe || n.tipo === 'NFC-e') && (n.status === 'autorizado' || n.status === 'cancelado_interno') && !n.estornadaPorDevolucao && n.status !== 'devolvido' && !isDev && !isHomol ? `<button onclick="abrirModalDevolucaoVenda('${n.vendaId}', '${n.chave || ''}')" class="text-orange-500 hover:text-orange-700 p-1.5" title="Emitir NF-e de Devolução / Estorno na SEFAZ (Ref. ${n.tipo})"><i class="fa-solid fa-rotate-left"></i></button>` : ''}

                        ${n.status === 'cancelado_interno' ? `<button onclick="reverterCancelamentoInterno('${n.vendaId}', '${n.tipo}')" class="text-emerald-500 hover:text-emerald-700 p-1.5" title="Restaurar para Autorizada (Vincular à SEFAZ via Devolução)"><i class="fa-solid fa-arrow-rotate-left"></i></button>` : ''}

                        ${n.status === 'autorizado' && !isDev && !n.estornadaPorDevolucao && !isHomol ? `<button onclick="abrirModalCancelamento('${n.vendaId}', '${n.tipo}', '${n.numero}')" class="text-red-500 hover:text-red-700 p-1.5" title="Cancelar Nota na SEFAZ"><i class="fa-solid fa-ban"></i></button>` : ''}

                        ${((n.status !== 'autorizado' && n.status !== 'contingencia' && n.status !== 'cancelado' && n.status !== 'devolvido') || isHomol) && !isDev ? `
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

    const nfes = lista.filter(n => (n.tipo === 'NF-e' || n.modelo === '55') && !n.isDevolucao);
    const valorNfe = nfes.filter(n => n.status === 'autorizado' || n.status === 'devolvido' || n.estornadaPorDevolucao).reduce((acc, n) => acc + (n.valor || 0), 0);

    const nfces = lista.filter(n => (n.tipo === 'NFC-e' || n.modelo === '65') && !n.isDevolucao);
    const valorNfce = nfces.filter(n => n.status === 'autorizado' || n.status === 'devolvido' || n.estornadaPorDevolucao || n.status === 'contingencia').reduce((acc, n) => acc + (n.valor || 0), 0);

    const nfses = lista.filter(n => n.tipo === 'NFS-e');
    const valorNfse = nfses.filter(n => n.status === 'autorizado').reduce((acc, n) => acc + (n.valor || 0), 0);

    // Contagem e valor de Devoluções / Estornos
    const devEmitidas = lista.filter(n => n.isDevolucao || n.tipo === 'NF-e Devolução');
    const devOriginais = lista.filter(n => (n.status === 'devolvido' || n.estornadaPorDevolucao) && !n.isDevolucao && n.tipo !== 'NF-e Devolução');

    const chavesDev = new Set();
    let countDev = 0;
    let valDev = 0;

    devEmitidas.forEach(n => {
        countDev++;
        valDev += (n.valor || 0);
        if (n.vendaId) chavesDev.add(String(n.vendaId));
        if (n.chaveOriginal) chavesDev.add(String(n.chaveOriginal));
    });

    devOriginais.forEach(n => {
        if (!chavesDev.has(String(n.vendaId)) && !chavesDev.has(String(n.chave))) {
            countDev++;
            valDev += (n.valor || 0);
        }
    });

    const totalValorVendas = valorNfe + valorNfce + valorNfse;
    const totalValor = totalValorVendas > 0 ? totalValorVendas : valDev;

    const canceladas = lista.filter(n => n.status === 'cancelado' || n.status === 'cancelado_interno' || n.status === 'erro' || (typeof n.status === 'string' && n.status.includes('erro'))).length;

    const elTotal = document.getElementById('kpi-total-notas'); if (elTotal) elTotal.innerText = totalNotas;
    const elTotVal = document.getElementById('kpi-total-valor'); if (elTotVal) elTotVal.innerText = typeof formatMoney === 'function' ? formatMoney(totalValor) : `R$ ${totalValor.toFixed(2)}`;

    const elNfe = document.getElementById('kpi-total-nfe'); if (elNfe) elNfe.innerText = nfes.length;
    const elNfeVal = document.getElementById('kpi-nfe-valor'); if (elNfeVal) elNfeVal.innerText = typeof formatMoney === 'function' ? formatMoney(valorNfe) : `R$ ${valorNfe.toFixed(2)}`;

    const elNfce = document.getElementById('kpi-total-nfce'); if (elNfce) elNfce.innerText = nfces.length;
    const elNfceVal = document.getElementById('kpi-nfce-valor'); if (elNfceVal) elNfceVal.innerText = typeof formatMoney === 'function' ? formatMoney(valorNfce) : `R$ ${valorNfce.toFixed(2)}`;

    const elDev = document.getElementById('kpi-total-devolucoes'); if (elDev) elDev.innerText = countDev;
    const elDevVal = document.getElementById('kpi-devolucoes-valor'); if (elDevVal) elDevVal.innerText = typeof formatMoney === 'function' ? formatMoney(valDev) : `R$ ${valDev.toFixed(2)}`;

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

async function confirmarCancelamentoNota() {
    if (!notaEmCancelamento) return;
    const just = document.getElementById('cancelar-justificativa')?.value.trim();
    if (!just || just.length < 15) {
        return showToast('A justificativa deve ter no mínimo 15 caracteres!', 'error');
    }

    const btn = document.getElementById('btn-confirmar-cancelar');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelando na SEFAZ...';
    }

    try {
        const cancelarFunc = firebase.functions().httpsCallable('cancelarNotaFiscal');
        await cancelarFunc({
            vendaId: notaEmCancelamento.vendaId,
            tipo: notaEmCancelamento.tipo.toLowerCase().replace('-', ''),
            justificativa: just
        });

        showToast('Nota fiscal cancelada com sucesso na SEFAZ!', 'success');
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

        const isPrazoExpirado = msg.includes('501') || msg.toLowerCase().includes('prazo de cancelamento superior') || msg.toLowerCase().includes('prazo regulamentar') || msg.toLowerCase().includes('prazo legal');
        if (isPrazoExpirado) {
            const vId = notaEmCancelamento.vendaId;
            const ch = notaEmCancelamento.chave || '';
            fecharModalCancelamento();

            const abrirDev = confirm(
                `A SEFAZ rejeitou o cancelamento direto pois o prazo regulamentar expirou (30 minutos para NFC-e / 24h para NF-e).\n\n` +
                `Para estornar esta operação com vínculo oficial perante a SEFAZ, a Receita Estadual exige a emissão de uma NF-e de Devolução / Estorno de Venda.\n\n` +
                `Deseja abrir o formulário de Devolução na SEFAZ agora?`
            );
            if (abrirDev) {
                abrirModalDevolucaoVenda(vId, ch);
            }
            return;
        }

        showToast(`Erro ao cancelar na SEFAZ: ${msg}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

async function reverterCancelamentoInterno(vendaId, tipo) {
    if (!confirm('Deseja restaurar esta nota para "Autorizada na SEFAZ"? Isso remove a marcação de cancelamento interno e permite emitir a NF-e de Devolução com vínculo oficial na SEFAZ.')) {
        return;
    }
    try {
        showToast('Restaurando status da nota...', 'info');
        const reverterFunc = firebase.functions().httpsCallable('reverterCancelamentoInterno');
        const res = await reverterFunc({ vendaId, tipo });
        showToast(res.data?.message || 'Status restaurado com sucesso!', 'success');
        if (typeof carregarNotasFiscais === 'function') {
            await carregarNotasFiscais();
        }
    } catch (e) {
        console.error('Erro ao reverter status:', e);
        showToast(`Erro ao restaurar: ${e.message}`, 'error');
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
function extrairXmlString(n) {
    if (n.xmlConteudo && typeof n.xmlConteudo === 'string' && n.xmlConteudo.trim().startsWith('<')) {
        return n.xmlConteudo.trim();
    }
    const v = n.rawVenda || (db.vendas || []).find(x => String(x.id) === String(n.vendaId));
    if (v) {
        if (n.isDevolucao && v.nfe_devolucao?.xml_conteudo && v.nfe_devolucao.xml_conteudo.trim().startsWith('<')) {
            return v.nfe_devolucao.xml_conteudo.trim();
        }
        if (v.nfe?.xml_conteudo && v.nfe.xml_conteudo.trim().startsWith('<')) {
            return v.nfe.xml_conteudo.trim();
        }
        if (v.nfce?.xml_conteudo && v.nfce.xml_conteudo.trim().startsWith('<')) {
            return v.nfce.xml_conteudo.trim();
        }
        if (v.fiscal_xml && typeof v.fiscal_xml === 'string' && v.fiscal_xml.trim().startsWith('<')) {
            return v.fiscal_xml.trim();
        }
    }
    const nd = n.rawDevolucao || (db.notasDevolucao || []).find(x => String(x.vendaId) === String(n.vendaId) || (x.chave_nfe && x.chave_nfe === n.chave));
    if (nd && nd.xml_conteudo && nd.xml_conteudo.trim().startsWith('<')) {
        return nd.xml_conteudo.trim();
    }
    if (n.rawServico?.xml_conteudo && n.rawServico.xml_conteudo.trim().startsWith('<')) {
        return n.rawServico.xml_conteudo.trim();
    }
    return null;
}

async function baixarLoteMensalXML() {
    if (typeof JSZip === 'undefined') {
        return showToast('Biblioteca de compactação (JSZip) não carregada.', 'error');
    }

    const lista = (typeof notasFiscaisArray !== 'undefined' && notasFiscaisArray.length > 0)
        ? notasFiscaisArray
        : [];

    const btn = document.getElementById('btn-exportar-lote');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compactando XMLs...';
    }

    try {
        const zip = new JSZip();
        let baixados = 0;
        const processadas = new Set();

        for (const n of lista) {
            // Ignora apenas cancelamentos internos e erros sem autorização SEFAZ
            if (n.status === 'cancelado_interno' || n.status === 'erro' || n.status === 'erro_autorizacao') continue;

            let xmlText = extrairXmlString(n);

            if (!xmlText && n.xmlUrl) {
                try {
                    const resp = await fetch(n.xmlUrl);
                    if (resp.ok) xmlText = await resp.text();
                } catch (err) {
                    console.warn(`Erro ao buscar XML remoto da nota ${n.numero}:`, err);
                }
            }

            if (xmlText && xmlText.trim().startsWith('<')) {
                const tipoLimpo = (n.tipo || 'Nota').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
                const numLimpo = String(n.numero || 'SN').replace(/[^0-9]/g, '');
                const chaveOuId = n.chave ? n.chave : `venda_${n.vendaId || '0'}`;
                const nomeArquivo = `${tipoLimpo}_N${numLimpo}_${chaveOuId}.xml`;

                if (!processadas.has(nomeArquivo)) {
                    processadas.add(nomeArquivo);
                    zip.file(nomeArquivo, xmlText);
                    baixados++;
                }
            }
        }

        if (baixados === 0) {
            return showToast('Nenhuma nota fiscal com XML disponível para exportação.', 'info');
        }

        showToast(`Gerando pacote ZIP com ${baixados} arquivo(s) XML...`, 'info');
        const content = await zip.generateAsync({ type: 'blob' });
        const urlBlob = URL.createObjectURL(content);

        const a = document.createElement('a');
        a.href = urlBlob;
        const dataHoje = new Date().toISOString().split('T')[0];
        a.download = `Lote_XML_Notas_Fiscais_${dataHoje}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(urlBlob);

        showToast(`Download concluído: ${baixados} XML(s) empacotados com sucesso!`, 'success');

    } catch (e) {
        console.error('Erro ao gerar ZIP de XMLs:', e);
        showToast(`Erro ao gerar ZIP de XMLs: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<i class="fa-solid fa-file-zipper text-sm"></i> Baixar Lote XML (ZIP)';
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

    // Suporte adicional para notas de devolução da coleção notas_devolucao
    const notaDev = (db.notasDevolucao || []).find(nd => String(nd.vendaId) === String(vendaId) || String(nd.id) === String(vendaId) || nd.chave_nfe === String(vendaId));
    if (notaDev) {
        if (!v) {
            v = {
                id: vendaId,
                clienteNome: notaDev.clienteNome || 'Consumidor Final',
                clienteDoc: notaDev.clienteDoc || '',
                tot: Number(notaDev.valor || 0),
                nfe_devolucao: notaDev
            };
        } else if (!v.nfe_devolucao) {
            v.nfe_devolucao = notaDev;
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
    const isDev = (tipo === 'NF-e Devolução' || tipo === 'devolucao');
    const xml = isDev 
        ? (v.nfe_devolucao?.xml_conteudo || v.fiscal_xml || '') 
        : (v.fiscal_xml || v.nfce?.xml_conteudo || v.nfe?.xml_conteudo || '');
    if (!xml) {
        showToast('Conteúdo do arquivo XML não encontrado no banco de dados.', 'warning');
        return;
    }
    const chave = isDev 
        ? (v.nfe_devolucao?.chave_nfe || `devolucao_${vendaId}`) 
        : (v.fiscal_chave || v.nfce?.chave_nfe || v.nfe?.chave_nfe || `nota_${vendaId}`);
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
    const isDev = (tipo === 'NF-e Devolução' || tipo === 'devolucao');
    const isNFe = isDev || (tipo === 'NF-e' || tipo === 'nfe' || tipo === '55');
    const nota = isDev ? (v.nfe_devolucao || v.nfe || {}) : (isNFe ? (v.nfe || {}) : (v.nfce || {}));
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

// ==========================================
// MODAL — DEVOLUÇÃO DE VENDA
// ==========================================
let _devolucaoVendaId = null;
let _devolucaoChaveOriginal = null;

function abrirModalDevolucaoVenda(vendaId, chaveOriginal) {
    _devolucaoVendaId = vendaId;
    _devolucaoChaveOriginal = chaveOriginal;

    const nota = notasFiscaisArray.find(n => String(n.vendaId) === String(vendaId));
    const modal = document.getElementById('modal-devolucao-venda');
    if (!modal) return showToast('Modal de devolução não encontrado.', 'error');

    const venda = (db.vendas || []).find(v => String(v.id) === String(vendaId));
    const numPedFmt = venda?.numeroPedido ? `#${String(venda.numeroPedido).padStart(4, '0')}` : (venda?.numero ? `#${String(venda.numero).padStart(4, '0')}` : (nota?.numeroPedido ? `#${String(nota.numeroPedido).padStart(4, '0')}` : `#${String(vendaId || '0').slice(-6)}`));

    if (!_devolucaoChaveOriginal) {
        _devolucaoChaveOriginal = nota?.chave || venda?.nfce?.chave_nfe || venda?.nfe?.chave_nfe || '';
    }

    const spanNota = modal.querySelector('#dev-venda-info-nota');
    if (spanNota) spanNota.textContent = `Venda ${numPedFmt} — ${nota?.tipo || 'Nota'} Nº ${nota?.numero || '-'}`;
    const itens = venda?.itens || venda?.produtos || [];
    const tbody = modal.querySelector('#dev-venda-itens');
    if (tbody) {
        tbody.innerHTML = itens.length === 0
            ? '<tr><td colspan="4" class="text-center text-slate-400 py-4">Nenhum item encontrado na venda.</td></tr>'
            : itens.map((it, idx) => `
                <tr class="border-b border-slate-200 dark:border-slate-700">
                    <td class="p-2"><input type="checkbox" class="dev-item-check w-4 h-4 accent-orange-500" data-idx="${idx}" checked></td>
                    <td class="p-2 text-sm font-medium text-slate-800 dark:text-slate-200">${it.nome || it.descricao || 'Produto'}</td>
                    <td class="p-2 text-sm text-slate-600 dark:text-slate-400 text-right">${parseFloat(it.qtd || it.quantidade || 1).toFixed(2)}</td>
                    <td class="p-2"><input type="number" class="dev-item-qtd w-20 text-right border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" data-idx="${idx}" min="0.01" step="0.01" max="${parseFloat(it.qtd || it.quantidade || 1)}" value="${parseFloat(it.qtd || it.quantidade || 1).toFixed(2)}"></td>
                </tr>
            `).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalDevolucaoVenda() {
    const modal = document.getElementById('modal-devolucao-venda');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function confirmarDevolucaoVenda() {
    const obs = document.getElementById('dev-venda-obs')?.value?.trim() || '';
    const modal = document.getElementById('modal-devolucao-venda');
    const checkboxes = modal?.querySelectorAll('.dev-item-check:checked') || [];

    if (checkboxes.length === 0) return showToast('Selecione ao menos 1 item para devolver.', 'error');

    const venda = (db.vendas || []).find(v => String(v.id) === String(_devolucaoVendaId));
    const todosItens = venda?.itens || venda?.produtos || [];

    const itensParaDevolucao = Array.from(checkboxes).map(cb => {
        const idx = parseInt(cb.dataset.idx);
        const qtdInput = modal.querySelector(`.dev-item-qtd[data-idx="${idx}"]`);
        const qtdDevolvida = parseFloat(qtdInput?.value || 1);
        const itemOriginal = { ...todosItens[idx] };
        itemOriginal.qtd = qtdDevolvida;
        itemOriginal.quantidade = qtdDevolvida;
        return itemOriginal;
    });

    const btn = document.getElementById('btn-confirmar-devolucao-venda');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Emitindo...'; }
    showToast('Emitindo NF-e de Devolução...', 'info');

    try {
        const fn = firebase.functions().httpsCallable('emitirDevolucaoVenda');
        const res = await fn({
            vendaId: _devolucaoVendaId,
            chaveOriginal: _devolucaoChaveOriginal,
            itensParaDevolucao,
            observacoes: obs
        });
        showToast(res.data?.message || 'Devolução autorizada!', 'success');
        fecharModalDevolucaoVenda();

        // Atualização imediata em memória local para refletir na tabela instantaneamente
        if (res.data?.data) {
            const devData = res.data.data;
            const vLocal = (db.vendas || []).find(v => String(v.id) === String(_devolucaoVendaId));
            if (vLocal) {
                vLocal.nfe_devolucao = devData;
                vLocal.status_fiscal = 'devolvido';
                if (vLocal.nfce) vLocal.nfce.estornada_por_devolucao = devData.chave_nfe || true;
                if (vLocal.nfe) vLocal.nfe.estornada_por_devolucao = devData.chave_nfe || true;
            }
            if (!db.notasDevolucao) db.notasDevolucao = [];
            db.notasDevolucao.unshift({
                ...devData,
                vendaId: String(_devolucaoVendaId),
                tipo_devolucao: 'venda',
                criadoEm: new Date().toISOString()
            });
        }
        processarNotasFiscais();
        renderNotasFiscais();
    } catch (e) {
        console.error(e);
        showToast('Erro na devolução: ' + (e.message || 'Tente novamente.'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Emitir Devolução'; }
    }
}

// ==========================================
// MODAL — DEVOLUÇÃO DE COMPRA AO FORNECEDOR / INDÚSTRIA
// Suporta Leitura de XML ou Preenchimento Manual
// ==========================================
let _devCompraItens = [];

function abrirModalDevolucaoCompra() {
    const modal = document.getElementById('modal-devolucao-compra');
    if (!modal) return showToast('Modal de devolução de compra não encontrado.', 'error');

    _devCompraItens = [];
    renderItensDevolucaoCompra();
    popularDatalistsDevolucaoCompra();

    // Limpar campos de fornecedor e chave
    ['dev-compra-chave', 'dev-compra-forn-doc', 'dev-compra-forn-nome', 'dev-compra-forn-rua', 'dev-compra-forn-numero', 'dev-compra-forn-bairro', 'dev-compra-forn-cidade', 'dev-compra-forn-cep', 'dev-compra-forn-ie', 'dev-compra-obs', 'dev-compra-busca-forn', 'dev-compra-busca-prod'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const elUf = document.getElementById('dev-compra-forn-uf');
    if (elUf) elUf.value = (db.config?.empresa?.uf || 'GO').toUpperCase();

    const elNat = document.getElementById('dev-compra-nat-op');
    if (elNat) elNat.value = 'DEVOLUCAO DE COMPRA PARA COMERCIALIZACAO';

    const inputXml = document.getElementById('dev-compra-input-xml');
    if (inputXml) inputXml.value = '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalDevolucaoCompra() {
    const modal = document.getElementById('modal-devolucao-compra');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function popularDatalistsDevolucaoCompra() {
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s || ''));

    // Datalist de Fornecedores
    const dlForn = document.getElementById('lista-fornecedores-datalist');
    if (dlForn && Array.isArray(db.fornecedores)) {
        dlForn.innerHTML = db.fornecedores.map(f => {
            const doc = f.cnpj || f.cpf || f.doc || '';
            const sub = [doc, f.cidade, f.uf].filter(Boolean).join(' - ');
            return `<option value="${esc(f.nome || f.razaoSocial || '')}">${esc(sub)}</option>`;
        }).join('');
    }

    // Datalist de Produtos
    const dlProd = document.getElementById('lista-produtos-devolucao-datalist');
    if (dlProd && Array.isArray(db.produtos)) {
        dlProd.innerHTML = db.produtos.map(p => {
            const preco = Number(p.custo || p.precoCusto || p.preco || 0);
            const sub = [p.ncm ? 'NCM ' + p.ncm : '', preco > 0 ? `Custo: R$ ${preco.toFixed(2)}` : ''].filter(Boolean).join(' - ');
            return `<option value="${esc(p.nome || '')}">${esc(sub)}</option>`;
        }).join('');
    }
}

function selecionarFornecedorDevolucao(valor) {
    if (!valor || !Array.isArray(db.fornecedores) || db.fornecedores.length === 0) return;
    const termo = valor.trim().toLowerCase();
    const limpoDoc = termo.replace(/\D/g, '');

    const f = db.fornecedores.find(item => {
        const fNome = (item.nome || item.razaoSocial || '').trim().toLowerCase();
        const fDoc = (item.cnpj || item.cpf || item.doc || '').replace(/\D/g, '');
        return fNome === termo || (limpoDoc.length >= 11 && fDoc === limpoDoc);
    });

    if (!f) return;

    if (document.getElementById('dev-compra-forn-nome')) document.getElementById('dev-compra-forn-nome').value = f.nome || f.razaoSocial || '';
    if (document.getElementById('dev-compra-forn-doc')) document.getElementById('dev-compra-forn-doc').value = f.cnpj || f.cpf || f.doc || '';
    if (document.getElementById('dev-compra-forn-rua')) document.getElementById('dev-compra-forn-rua').value = f.rua || f.endereco || f.logradouro || '';
    if (document.getElementById('dev-compra-forn-numero')) document.getElementById('dev-compra-forn-numero').value = f.numero || 'S/N';
    if (document.getElementById('dev-compra-forn-bairro')) document.getElementById('dev-compra-forn-bairro').value = f.bairro || '';
    if (document.getElementById('dev-compra-forn-cidade')) document.getElementById('dev-compra-forn-cidade').value = f.cidade || '';
    if (document.getElementById('dev-compra-forn-uf')) document.getElementById('dev-compra-forn-uf').value = (f.uf || 'GO').toUpperCase();
    if (document.getElementById('dev-compra-forn-cep')) document.getElementById('dev-compra-forn-cep').value = f.cep || '';
    if (document.getElementById('dev-compra-forn-ie')) document.getElementById('dev-compra-forn-ie').value = f.ie || f.inscricaoEstadual || '';

    showToast(`Fornecedor "${f.nome || f.razaoSocial}" selecionado!`, 'success');
}

function selecionarProdutoDevolucaoCompra(valor) {
    if (!valor || !Array.isArray(db.produtos) || db.produtos.length === 0) return;
    const termo = valor.trim().toLowerCase();

    const prod = db.produtos.find(p => {
        const pNome = (p.nome || '').trim().toLowerCase();
        const pEan = (p.ean || '').trim().toLowerCase();
        return pNome === termo || (termo.length >= 6 && pEan === termo);
    });

    if (!prod) return;

    if (document.getElementById('dev-compra-item-nome')) document.getElementById('dev-compra-item-nome').value = prod.nome || '';
    if (document.getElementById('dev-compra-item-preco')) {
        const custo = Number(prod.custo || prod.precoCusto || prod.preco || 0);
        document.getElementById('dev-compra-item-preco').value = custo > 0 ? custo.toFixed(2) : '';
    }
    if (document.getElementById('dev-compra-item-ncm') && prod.ncm) {
        document.getElementById('dev-compra-item-ncm').value = String(prod.ncm).replace(/\D/g, '');
    }
}

// Leitura e extração do XML de NF-e da Indústria / Fornecedor
function processarXMLDevolucaoCompra(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(e.target.result, "text/xml");

            const getStringSafe = (context, tag) => {
                const node = context ? context.getElementsByTagName(tag)[0] : null;
                return node ? node.textContent.trim() : '';
            };
            const getFloatSafe = (context, tag) => {
                const node = context ? context.getElementsByTagName(tag)[0] : null;
                if (!node || !node.textContent) return 0;
                const v = parseFloat(node.textContent.replace(',', '.'));
                return isNaN(v) ? 0 : v;
            };

            // 1. Chave de Acesso Original da NF-e
            const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
            let chave = '';
            if (infNFe && infNFe.getAttribute("Id")) {
                chave = infNFe.getAttribute("Id").replace(/\D/g, '');
            }
            if (!chave) {
                const chNFeNode = xmlDoc.getElementsByTagName("chNFe")[0];
                if (chNFeNode) chave = chNFeNode.textContent.replace(/\D/g, '');
            }
            if (chave && document.getElementById('dev-compra-chave')) {
                document.getElementById('dev-compra-chave').value = chave;
            }

            // 2. Dados do Fornecedor / Indústria (Emitente da nota de origem)
            const emit = xmlDoc.getElementsByTagName("emit")[0];
            if (emit) {
                const nome = getStringSafe(emit, "xNome");
                const cnpj = getStringSafe(emit, "CNPJ") || getStringSafe(emit, "CPF");
                const ie = getStringSafe(emit, "IE");

                const enderEmit = emit.getElementsByTagName("enderEmit")[0];
                const rua = getStringSafe(enderEmit, "xLgr");
                const numero = getStringSafe(enderEmit, "nro") || "S/N";
                const bairro = getStringSafe(enderEmit, "xBairro");
                const cidade = getStringSafe(enderEmit, "xMun");
                const uf = (getStringSafe(enderEmit, "UF") || "GO").toUpperCase();
                const cep = getStringSafe(enderEmit, "CEP");

                if (document.getElementById('dev-compra-forn-nome')) document.getElementById('dev-compra-forn-nome').value = nome;
                if (document.getElementById('dev-compra-forn-doc')) document.getElementById('dev-compra-forn-doc').value = cnpj;
                if (document.getElementById('dev-compra-forn-rua')) document.getElementById('dev-compra-forn-rua').value = rua;
                if (document.getElementById('dev-compra-forn-numero')) document.getElementById('dev-compra-forn-numero').value = numero;
                if (document.getElementById('dev-compra-forn-bairro')) document.getElementById('dev-compra-forn-bairro').value = bairro;
                if (document.getElementById('dev-compra-forn-cidade')) document.getElementById('dev-compra-forn-cidade').value = cidade;
                if (document.getElementById('dev-compra-forn-uf')) document.getElementById('dev-compra-forn-uf').value = uf;
                if (document.getElementById('dev-compra-forn-cep')) document.getElementById('dev-compra-forn-cep').value = cep;
                if (document.getElementById('dev-compra-forn-ie')) document.getElementById('dev-compra-forn-ie').value = ie;
            }

            // 3. Extrair lista de produtos da nota
            const detNodes = xmlDoc.getElementsByTagName("det");
            _devCompraItens = [];

            for (let i = 0; i < detNodes.length; i++) {
                const prod = detNodes[i].getElementsByTagName("prod")[0];
                if (!prod) continue;
                const nome = getStringSafe(prod, "xProd");
                const cEAN = getStringSafe(prod, "cEAN");
                const cProd = getStringSafe(prod, "cProd");
                const ncm = getStringSafe(prod, "NCM") || "94036000";
                const qCom = getFloatSafe(prod, "qCom") || 1;
                const vUnCom = getFloatSafe(prod, "vUnCom") || (getFloatSafe(prod, "vProd") / qCom);
                const uCom = getStringSafe(prod, "uCom") || "UN";

                _devCompraItens.push({
                    selecionado: true,
                    nome: nome,
                    quantidadeOriginal: qCom,
                    quantidade: qCom,
                    preco: vUnCom,
                    ncm: ncm,
                    unidade: uCom,
                    codigo: cProd || cEAN || ''
                });
            }

            renderItensDevolucaoCompra();
            showToast(`XML processado com sucesso! ${_devCompraItens.length} produtos carregados.`, 'success');

        } catch (err) {
            console.error("Erro ao processar XML de devolução:", err);
            showToast("Erro ao ler o arquivo XML da NF-e. Verifique se é um XML válido.", "error");
        }
    };
    reader.readAsText(file);
}

function adicionarItemDevolucaoCompraManual() {
    const nome = document.getElementById('dev-compra-item-nome')?.value?.trim();
    const quantidade = parseFloat(document.getElementById('dev-compra-item-qtd')?.value || '1');
    const preco = parseFloat(document.getElementById('dev-compra-item-preco')?.value || '0');
    const ncm = (document.getElementById('dev-compra-item-ncm')?.value?.trim() || '94036000').replace(/\D/g, '');

    if (!nome) return showToast('Informe o nome do produto a devolver.', 'error');
    if (!preco || preco <= 0) return showToast('Informe o valor unitário.', 'error');
    if (!quantidade || quantidade <= 0) return showToast('Informe a quantidade.', 'error');

    _devCompraItens.push({
        selecionado: true,
        nome,
        quantidadeOriginal: quantidade,
        quantidade,
        preco,
        ncm: ncm || '94036000',
        unidade: 'UN',
        codigo: ''
    });

    renderItensDevolucaoCompra();

    ['dev-compra-item-nome', 'dev-compra-item-preco', 'dev-compra-busca-prod'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const elQtd = document.getElementById('dev-compra-item-qtd');
    if (elQtd) elQtd.value = '1';
    document.getElementById('dev-compra-item-nome')?.focus();
}

function toggleItemDevolucaoCompra(idx, selecionado) {
    if (_devCompraItens[idx]) {
        _devCompraItens[idx].selecionado = selecionado;
        atualizarTotalDevolucaoCompra();
    }
}

function toggleAllItensDevolucaoCompra(selecionado) {
    _devCompraItens.forEach(it => it.selecionado = selecionado);
    renderItensDevolucaoCompra();
}

function alterarQtdItemDevolucaoCompra(idx, novaQtd) {
    const qtd = parseFloat(novaQtd);
    if (!isNaN(qtd) && qtd > 0 && _devCompraItens[idx]) {
        _devCompraItens[idx].quantidade = qtd;
        atualizarTotalDevolucaoCompra();
    }
}

function removerItemDevolucaoCompra(idx) {
    _devCompraItens.splice(idx, 1);
    renderItensDevolucaoCompra();
}

function atualizarTotalDevolucaoCompra() {
    const itensAtivos = _devCompraItens.filter(it => it.selecionado);
    const total = itensAtivos.reduce((acc, it) => acc + (parseFloat(it.quantidade) * parseFloat(it.preco)), 0);

    const elTotal = document.getElementById('dev-compra-total');
    if (elTotal) elTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

    const elCount = document.getElementById('dev-compra-itens-count');
    if (elCount) elCount.textContent = `${itensAtivos.length} de ${_devCompraItens.length} itens selecionados`;
}

function renderItensDevolucaoCompra() {
    const tbody = document.getElementById('dev-compra-itens-tbody');
    if (!tbody) return;

    if (_devCompraItens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-400 py-4">Nenhum produto adicionado. Carregue o XML ou adicione manualmente acima.</td></tr>`;
        atualizarTotalDevolucaoCompra();
        return;
    }

    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s || ''));

    tbody.innerHTML = _devCompraItens.map((it, idx) => {
        const subtotal = (parseFloat(it.quantidade) * parseFloat(it.preco)).toFixed(2);
        return `
            <tr class="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td class="p-2 text-center">
                    <input type="checkbox" class="w-4 h-4 accent-amber-500 rounded cursor-pointer" ${it.selecionado ? 'checked' : ''} onchange="toggleItemDevolucaoCompra(${idx}, this.checked)">
                </td>
                <td class="p-2 font-medium text-slate-800 dark:text-slate-200">
                    <div class="font-bold text-xs">${esc(it.nome)}</div>
                    <span class="text-[10px] text-slate-400">${it.unidade ? 'UNID: ' + esc(it.unidade) : ''} ${it.quantidadeOriginal ? '| Orig: ' + it.quantidadeOriginal : ''}</span>
                </td>
                <td class="p-2 text-right">
                    <input type="number" step="0.01" min="0.01" value="${parseFloat(it.quantidade).toFixed(2)}" class="w-20 text-right border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold" onchange="alterarQtdItemDevolucaoCompra(${idx}, this.value)">
                </td>
                <td class="p-2 text-right font-mono text-slate-600 dark:text-slate-300">
                    R$ ${parseFloat(it.preco).toFixed(2).replace('.', ',')}
                </td>
                <td class="p-2 text-right font-bold font-mono text-amber-600 dark:text-amber-400">
                    R$ ${subtotal.replace('.', ',')}
                </td>
                <td class="p-2 text-center font-mono text-[11px] text-slate-400">
                    ${esc(it.ncm || '94036000')}
                </td>
                <td class="p-2 text-center">
                    <button type="button" onclick="removerItemDevolucaoCompra(${idx})" class="text-rose-500 hover:text-rose-700 p-1" title="Remover Item">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    atualizarTotalDevolucaoCompra();
}

async function emitirDevolucaoCompraModal() {
    const itensSelecionados = _devCompraItens.filter(it => it.selecionado);
    if (itensSelecionados.length === 0) {
        return showToast('Selecione ao menos 1 item para devolução.', 'error');
    }

    const fornNome = document.getElementById('dev-compra-forn-nome')?.value?.trim();
    const fornDoc = (document.getElementById('dev-compra-forn-doc')?.value || '').replace(/\D/g, '');
    const chaveOriginal = (document.getElementById('dev-compra-chave')?.value || '').replace(/\D/g, '');
    const natOp = document.getElementById('dev-compra-nat-op')?.value?.trim() || 'DEVOLUCAO DE COMPRA PARA COMERCIALIZACAO';
    const obs = document.getElementById('dev-compra-obs')?.value?.trim() || '';

    if (!fornNome) return showToast('Informe a Razão Social ou Nome do Fornecedor / Indústria.', 'error');
    if (!fornDoc || (fornDoc.length !== 14 && fornDoc.length !== 11)) {
        return showToast('Informe um CNPJ (14 dígitos) ou CPF válido para o Fornecedor.', 'error');
    }

    const fornecedorDados = {
        nome: fornNome,
        razaoSocial: fornNome,
        cnpj: fornDoc.length === 14 ? fornDoc : '',
        cpf: fornDoc.length === 11 ? fornDoc : '',
        doc: fornDoc,
        rua: document.getElementById('dev-compra-forn-rua')?.value?.trim() || '',
        numero: document.getElementById('dev-compra-forn-numero')?.value?.trim() || 'S/N',
        bairro: document.getElementById('dev-compra-forn-bairro')?.value?.trim() || '',
        cidade: document.getElementById('dev-compra-forn-cidade')?.value?.trim() || '',
        uf: (document.getElementById('dev-compra-forn-uf')?.value?.trim() || 'GO').toUpperCase(),
        cep: (document.getElementById('dev-compra-forn-cep')?.value || '').replace(/\D/g, ''),
        ie: document.getElementById('dev-compra-forn-ie')?.value?.trim() || ''
    };

    const itensParaEnvio = itensSelecionados.map(it => ({
        nome: it.nome,
        descricao: it.nome,
        quantidade: parseFloat(it.quantidade),
        qtd: parseFloat(it.quantidade),
        preco: parseFloat(it.preco),
        precoUnitario: parseFloat(it.preco),
        ncm: String(it.ncm || '94036000').replace(/\D/g, ''),
        unidade: it.unidade || 'UN',
        csosn: '102',
        origem: '0'
    }));

    const btn = document.getElementById('btn-confirmar-devolucao-compra');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transmitindo à SEFAZ...';
    }

    const overlay = document.getElementById('overlay-comunicando-sefaz');
    if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }

    showToast('Transmitindo NF-e de Devolução de Compra à SEFAZ...', 'info');

    try {
        const fn = firebase.functions().httpsCallable('emitirDevolucaoCompra');
        const res = await fn({
            chaveOriginal: chaveOriginal || null,
            destinatarioDados: fornecedorDados,
            itensParaDevolucao: itensParaEnvio,
            observacoes: obs,
            naturezaOperacao: natOp
        });

        const dataRet = res.data?.data;
        showToast(res.data?.message || 'NF-e de Devolução de Compra autorizada na SEFAZ!', 'success');
        fecharModalDevolucaoCompra();

        if (dataRet) {
            if (!db.notasDevolucao) db.notasDevolucao = [];
            db.notasDevolucao.unshift({
                ...dataRet,
                tipo_devolucao: 'compra',
                clienteNome: `${fornecedorDados.nome} (Devolução Compra)`,
                clienteDoc: fornecedorDados.doc,
                valor: itensParaEnvio.reduce((acc, it) => acc + it.quantidade * it.preco, 0),
                criadoEm: new Date().toISOString()
            });
        }

        processarNotasFiscais();
        renderNotasFiscais();

    } catch (e) {
        console.error("Erro ao emitir devolução de compra:", e);
        let msg = e.message || 'Erro na comunicação com a SEFAZ.';
        showToast('Falha na emissão: ' + msg, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Emitir NF-e de Devolução (SEFAZ)';
        }
        if (overlay) { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }
    }
}

// ==========================================
// MODAL — NOTA AVULSA COMPLETA (SEM VENDA NO SISTEMA)
// ==========================================
let _avulsaItens = [];

function popularDatalistsAvulsa() {
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s || ''));

    // Datalist de Clientes
    const dlCli = document.getElementById('lista-clientes-datalist');
    if (dlCli && Array.isArray(db.clientes)) {
        dlCli.innerHTML = db.clientes.map(c => {
            const docLimpo = c.doc || c.cpf || c.cnpj || '';
            const sub = [docLimpo, c.cidade].filter(Boolean).join(' - ');
            return `<option value="${esc(c.nome || '')}">${esc(sub)}</option>`;
        }).join('');
    }

    // Datalist de Produtos
    const dlProd = document.getElementById('lista-produtos-datalist');
    if (dlProd && Array.isArray(db.produtos)) {
        dlProd.innerHTML = db.produtos.map(p => {
            const preco = Number(p.preco || p.precoVenda || p.valor || 0);
            const sub = [p.ncm ? 'NCM ' + p.ncm : '', preco > 0 ? `R$ ${preco.toFixed(2)}` : ''].filter(Boolean).join(' - ');
            return `<option value="${esc(p.nome || '')}">${esc(sub)}</option>`;
        }).join('');
    }
}

function selecionarClienteAvulsa(valor) {
    if (!valor || !Array.isArray(db.clientes) || db.clientes.length === 0) return;
    const termo = valor.trim().toLowerCase();
    const limpoDoc = termo.replace(/\D/g, '');

    const cli = db.clientes.find(c => {
        const cNome = (c.nome || '').trim().toLowerCase();
        const cDoc = (c.doc || c.cpf || c.cnpj || '').replace(/\D/g, '');
        return cNome === termo || (limpoDoc.length >= 11 && cDoc === limpoDoc);
    });

    if (!cli) return;

    if (document.getElementById('avulsa-dest-nome')) {
        document.getElementById('avulsa-dest-nome').value = cli.nome || '';
    }
    if (document.getElementById('avulsa-dest-doc')) {
        document.getElementById('avulsa-dest-doc').value = cli.doc || cli.cpf || cli.cnpj || '';
    }
    if (document.getElementById('avulsa-dest-rua')) {
        document.getElementById('avulsa-dest-rua').value = cli.rua || cli.endereco || cli.logradouro || '';
    }
    if (document.getElementById('avulsa-dest-numero')) {
        document.getElementById('avulsa-dest-numero').value = cli.numero || 'S/N';
    }
    if (document.getElementById('avulsa-dest-bairro')) {
        document.getElementById('avulsa-dest-bairro').value = cli.bairro || '';
    }

    let cid = cli.cidade || '';
    let uf = cli.uf || '';
    if (cid.includes(' - ')) {
        const parts = cid.split(' - ');
        cid = parts[0].trim();
        if (!uf && parts[1]) uf = parts[1].trim();
    }
    if (document.getElementById('avulsa-dest-cidade')) {
        document.getElementById('avulsa-dest-cidade').value = cid || 'Goiânia';
    }
    if (document.getElementById('avulsa-dest-uf')) {
        document.getElementById('avulsa-dest-uf').value = (uf || 'GO').toUpperCase();
    }
    if (document.getElementById('avulsa-dest-cep') && cli.cep) {
        document.getElementById('avulsa-dest-cep').value = cli.cep;
    }
    showToast(`Cliente "${cli.nome}" selecionado!`, 'success');
}

function selecionarProdutoAvulsa(valor) {
    if (!valor || !Array.isArray(db.produtos) || db.produtos.length === 0) return;
    const termo = valor.trim().toLowerCase();

    const prod = db.produtos.find(p => {
        const pNome = (p.nome || '').trim().toLowerCase();
        const pEan = (p.ean || '').trim().toLowerCase();
        return pNome === termo || (termo.length >= 6 && pEan === termo);
    });

    if (!prod) return;

    if (document.getElementById('avulsa-item-nome')) {
        document.getElementById('avulsa-item-nome').value = prod.nome || '';
    }
    if (document.getElementById('avulsa-item-preco')) {
        const preco = Number(prod.preco || prod.precoVenda || prod.valor || 0);
        document.getElementById('avulsa-item-preco').value = preco > 0 ? preco.toFixed(2) : '';
    }
    if (document.getElementById('avulsa-item-ncm') && prod.ncm) {
        document.getElementById('avulsa-item-ncm').value = String(prod.ncm).replace(/\D/g, '');
    }
    if (document.getElementById('avulsa-item-cfop') && prod.cfop) {
        document.getElementById('avulsa-item-cfop').value = String(prod.cfop).replace(/\D/g, '');
    }
    showToast(`Produto "${prod.nome}" carregado!`, 'success');
}

function abrirModalNotaAvulsa() {
    _avulsaItens = [];
    const modal = document.getElementById('modal-nota-avulsa');
    if (!modal) return showToast('Modal de nota avulsa não encontrado.', 'error');

    // Limpar campos
    modal.querySelectorAll('input, textarea').forEach(el => { el.value = ''; });
    renderAvulsaItens();
    popularDatalistsAvulsa();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalNotaAvulsa() {
    const modal = document.getElementById('modal-nota-avulsa');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function renderAvulsaItens() {
    const tbody = document.getElementById('avulsa-itens-lista');
    if (!tbody) return;
    if (_avulsaItens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 py-4 text-sm">Nenhum item adicionado.</td></tr>';
        return;
    }
    tbody.innerHTML = _avulsaItens.map((it, i) => `
        <tr class="border-b border-slate-200 dark:border-slate-700 text-sm">
            <td class="p-2">${it.nome}</td>
            <td class="p-2 text-right">${parseFloat(it.quantidade).toFixed(2)}</td>
            <td class="p-2 text-right">R$ ${parseFloat(it.preco).toFixed(2)}</td>
            <td class="p-2 text-center font-mono text-xs">${it.ncm || '-'}</td>
            <td class="p-2 text-center font-mono text-xs">${it.cfop || '5102'}</td>
            <td class="p-2 text-center"><button onclick="removerAvulsaItem(${i})" class="text-red-400 hover:text-red-600 p-1"><i class="fa-solid fa-trash-can text-xs"></i></button></td>
        </tr>
    `).join('');
    // Atualizar total
    const total = _avulsaItens.reduce((acc, it) => acc + parseFloat(it.quantidade) * parseFloat(it.preco), 0);
    const elTotal = document.getElementById('avulsa-total');
    if (elTotal) elTotal.textContent = `R$ ${total.toFixed(2)}`;
}

function adicionarAvulsaItem() {
    const nome = document.getElementById('avulsa-item-nome')?.value?.trim();
    const quantidade = parseFloat(document.getElementById('avulsa-item-qtd')?.value || '1');
    const preco = parseFloat(document.getElementById('avulsa-item-preco')?.value || '0');
    const ncm = document.getElementById('avulsa-item-ncm')?.value?.trim() || '94036000';
    const cfop = document.getElementById('avulsa-item-cfop')?.value?.trim() || '5102';

    if (!nome) return showToast('Informe a descrição do produto/serviço.', 'error');
    if (!preco || preco <= 0) return showToast('Informe o valor unitário.', 'error');
    if (!quantidade || quantidade <= 0) return showToast('Informe a quantidade.', 'error');

    _avulsaItens.push({ nome, quantidade, preco, ncm, cfop, csosn: '102', origem: '0', unidade: 'UN' });
    renderAvulsaItens();

    // Limpar campos de item
    ['avulsa-item-nome', 'avulsa-item-preco', 'avulsa-busca-produto'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const elQtd = document.getElementById('avulsa-item-qtd');
    if (elQtd) elQtd.value = '1';
    document.getElementById('avulsa-item-nome')?.focus();
}

function removerAvulsaItem(idx) {
    _avulsaItens.splice(idx, 1);
    renderAvulsaItens();
}

async function emitirNotaAvulsaModal() {
    if (_avulsaItens.length === 0) return showToast('Adicione pelo menos 1 item.', 'error');

    const tipo = document.getElementById('avulsa-tipo')?.value || 'nfe';
    const nome = document.getElementById('avulsa-dest-nome')?.value?.trim() || 'CONSUMIDOR FINAL';
    const doc = (document.getElementById('avulsa-dest-doc')?.value || '').replace(/\D/g, '');
    const rua = document.getElementById('avulsa-dest-rua')?.value?.trim() || '';
    const numero = document.getElementById('avulsa-dest-numero')?.value?.trim() || 'S/N';
    const bairro = document.getElementById('avulsa-dest-bairro')?.value?.trim() || '';
    const cidade = document.getElementById('avulsa-dest-cidade')?.value?.trim() || '';
    const uf = (document.getElementById('avulsa-dest-uf')?.value?.trim() || 'GO').toUpperCase();
    const cep = (document.getElementById('avulsa-dest-cep')?.value || '').replace(/\D/g, '');
    const formaPag = document.getElementById('avulsa-forma-pag')?.value || 'Dinheiro';
    const naturezaOperacao = document.getElementById('avulsa-nat-op')?.value?.trim() || 'VENDA DE MERCADORIA';
    const observacoes = document.getElementById('avulsa-obs')?.value?.trim() || '';

    if (tipo === 'nfe' && (!doc || (doc.length !== 11 && doc.length !== 14))) {
        return showToast('NF-e exige destinatário com CPF (11 dígitos) ou CNPJ (14 dígitos).', 'error');
    }

    const totalNota = _avulsaItens.reduce((acc, it) => acc + parseFloat(it.quantidade) * parseFloat(it.preco), 0);

    const destinatario = {
        nome,
        cpf: doc.length === 11 ? doc : '',
        cnpj: doc.length === 14 ? doc : '',
        doc,
        rua, numero, bairro, cidade, uf, cep
    };

    const btn = document.getElementById('btn-emitir-nota-avulsa');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Emitindo...'; }
    showToast('Emitindo nota avulsa...', 'info');

    try {
        const fn = firebase.functions().httpsCallable('emitirNotaAvulsa');
        const res = await fn({
            tipo,
            destinatario,
            itens: _avulsaItens,
            pagamentos: [{ metodo: formaPag, valor: totalNota }],
            naturezaOperacao,
            observacoes
        });
        showToast(res.data?.message || 'Nota avulsa emitida com sucesso!', 'success');
        fecharModalNotaAvulsa();
    } catch (e) {
        console.error(e);
        showToast('Erro ao emitir nota avulsa: ' + (e.message || 'Tente novamente.'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Emitir Nota'; }
    }
}

// ==========================================
// MODAL — EMISSÃO DE NFS-e (SERVIÇOS)
// ==========================================
function abrirModalNFSe(vendaId = null) {
    const modal = document.getElementById('modal-emitir-nfse');
    if (!modal) return showToast('Modal de NFS-e não encontrado.', 'error');

    // Limpar campos
    ['nfse-tomador-doc', 'nfse-tomador-nome', 'nfse-tomador-email', 'nfse-tomador-tel', 'nfse-tomador-rua', 'nfse-servico-valor', 'nfse-servico-desc', 'nfse-obs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const emp = db.config?.empresa || {};
    if (document.getElementById('nfse-tomador-cidade')) document.getElementById('nfse-tomador-cidade').value = emp.cidade || 'Goiânia';
    if (document.getElementById('nfse-tomador-uf')) document.getElementById('nfse-tomador-uf').value = emp.uf || 'GO';
    if (document.getElementById('nfse-servico-aliq')) document.getElementById('nfse-servico-aliq').value = '2.00';

    // Se veio vinculado a uma venda de serviço
    if (vendaId) {
        const v = (db.vendas || []).find(x => String(x.id) === String(vendaId));
        if (v) {
            if (document.getElementById('nfse-tomador-doc')) document.getElementById('nfse-tomador-doc').value = v.clienteDoc || v.clienteCpf || '';
            if (document.getElementById('nfse-tomador-nome')) document.getElementById('nfse-tomador-nome').value = v.clienteNome || '';
            if (document.getElementById('nfse-servico-valor')) document.getElementById('nfse-servico-valor').value = parseFloat(v.tot || v.valorLiquido || 0).toFixed(2);
            const itens = v.itens || v.produtos || [];
            const desc = itens.map(i => `${i.nome || i.descricao || 'Serviço'} (qtd: ${i.qtd || 1})`).join('; ') || 'Prestação de serviços';
            if (document.getElementById('nfse-servico-desc')) document.getElementById('nfse-servico-desc').value = desc;
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalNFSe() {
    const modal = document.getElementById('modal-emitir-nfse');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function emitirNFSeModal() {
    const doc = (document.getElementById('nfse-tomador-doc')?.value || '').replace(/\D/g, '');
    const nome = document.getElementById('nfse-tomador-nome')?.value?.trim() || 'Tomador do Serviço';
    const email = document.getElementById('nfse-tomador-email')?.value?.trim() || '';
    const tel = document.getElementById('nfse-tomador-tel')?.value?.trim() || '';
    const rua = document.getElementById('nfse-tomador-rua')?.value?.trim() || '';
    const cidade = document.getElementById('nfse-tomador-cidade')?.value?.trim() || 'Goiânia';
    const uf = (document.getElementById('nfse-tomador-uf')?.value?.trim() || 'GO').toUpperCase();

    const itemListaServico = document.getElementById('nfse-servico-item')?.value || '14.01';
    const valor = parseFloat(document.getElementById('nfse-servico-valor')?.value || 0);
    const aliqIss = parseFloat(document.getElementById('nfse-servico-aliq')?.value || 2.0);
    const desc = document.getElementById('nfse-servico-desc')?.value?.trim();
    const issRetido = document.getElementById('nfse-servico-iss-retido')?.value === 'sim';
    const obs = document.getElementById('nfse-obs')?.value?.trim() || '';

    if (!desc) return showToast('Preencha a discriminação dos serviços prestados.', 'error');
    if (!valor || valor <= 0) return showToast('Informe um valor válido para o serviço.', 'error');

    const btn = document.getElementById('btn-emitir-nfse-modal');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Emitindo NFS-e...'; }
    showToast('Processando e registrando NFS-e...', 'info');

    try {
        const fn = firebase.functions().httpsCallable('emitirNFSe');
        const res = await fn({
            tomador: { doc, nome, email, telefone: tel, rua, cidade, uf },
            servico: {
                itemListaServico,
                descricao: desc,
                valor,
                aliquotaIss: aliqIss,
                issRetido
            },
            observacoes: obs
        });

        showToast(res.data?.message || 'NFS-e emitida com sucesso!', 'success');
        fecharModalNFSe();
        processarNotasFiscais();
        renderNotasFiscais();
    } catch (e) {
        console.error('Erro ao emitir NFS-e:', e);
        showToast('Erro ao emitir NFS-e: ' + (e.message || 'Tente novamente.'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Emitir NFS-e'; }
    }
}

// Impressão e Visualização do Espelho da NFS-e
function imprimirDanfse(numero, vendaId) {
    const nota = notasFiscaisArray.find(n => (String(n.numero) === String(numero) && n.tipo === 'NFS-e') || (String(n.vendaId) === String(vendaId) && n.tipo === 'NFS-e'));
    const emp = db.config?.empresa || {};
    const valorFmt = typeof formatMoney === 'function' ? formatMoney(nota?.valor || 0) : `R$ ${(nota?.valor || 0).toFixed(2)}`;
    const dataFmt = nota?.data ? new Date(nota.data).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');

    const htmlEspelho = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>NFS-e Nº ${nota?.numero || numero} - Espelho Oficial</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; color: #111; }
                .box { border: 1px solid #333; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
                .header h1 { margin: 0; font-size: 16px; text-transform: uppercase; }
                .header h2 { margin: 4px 0 0 0; font-size: 13px; color: #555; }
                .title { font-weight: bold; background: #eee; padding: 4px 8px; margin-top: 0; font-size: 12px; border-radius: 2px; }
                table { width: 100%; border-collapse: collapse; margin-top: 6px; }
                td { padding: 4px; vertical-align: top; }
                .destaque { font-weight: bold; font-size: 14px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 15px;">
                <button onclick="window.print()" style="padding: 8px 16px; background: #7c3aed; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Imprimir NFS-e</button>
            </div>
            <div class="header">
                <h1>PREFEITURA MUNICIPAL DE ${String(emp.cidade || 'GOIÂNIA').toUpperCase()}</h1>
                <h2>SECRETARIA MUNICIPAL DE FINANÇAS — NOTA FISCAL DE SERVIÇOS ELETRÔNICA (NFS-e)</h2>
            </div>
            <div class="box">
                <table>
                    <tr>
                        <td width="33%"><strong>NÚMERO DA NFS-e:</strong> <span class="destaque">${nota?.numero || numero}</span></td>
                        <td width="33%"><strong>DATA DE EMISSÃO:</strong> ${dataFmt}</td>
                        <td width="34%"><strong>CÓD. VERIFICAÇÃO:</strong> <span class="destaque">${nota?.chave || nota?.protocolo || 'AUTORIZADA'}</span></td>
                    </tr>
                </table>
            </div>
            <div class="box">
                <div class="title">PRESTADOR DE SERVIÇOS</div>
                <table>
                    <tr>
                        <td><strong>Razão Social:</strong> ${emp.razaoSocial || emp.nome || 'EMPRESA'}</td>
                        <td><strong>CNPJ:</strong> ${emp.cnpj || '-'}</td>
                        <td><strong>Insc. Municipal:</strong> ${emp.im || 'ISENTO'}</td>
                    </tr>
                    <tr>
                        <td colspan="3"><strong>Endereço:</strong> ${emp.rua || ''}, ${emp.numero || ''} - ${emp.bairro || ''}, ${emp.cidade || ''}/${emp.uf || ''}</td>
                    </tr>
                </table>
            </div>
            <div class="box">
                <div class="title">TOMADOR DE SERVIÇOS (CLIENTE)</div>
                <table>
                    <tr>
                        <td><strong>Nome / Razão Social:</strong> ${nota?.clienteNome || 'Consumidor'}</td>
                        <td><strong>CPF / CNPJ:</strong> ${nota?.clienteDoc || '-'}</td>
                    </tr>
                </table>
            </div>
            <div class="box">
                <div class="title">DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS</div>
                <div style="padding: 10px 4px; min-height: 80px; white-space: pre-wrap;">${nota?.rawServico?.discriminacao || nota?.mensagemSefaz || 'Prestação de serviços'}</div>
            </div>
            <div class="box">
                <div class="title">VALOR TOTAL E TRIBUTOS</div>
                <table>
                    <tr>
                        <td><strong>VALOR TOTAL DOS SERVIÇOS:</strong></td>
                        <td align="right" class="destaque">${valorFmt}</td>
                    </tr>
                    <tr>
                        <td>Alíquota ISS Simples Nacional:</td>
                        <td align="right">2,00%</td>
                    </tr>
                </table>
            </div>
            <div style="text-align: center; font-size: 10px; color: #777; margin-top: 20px;">
                Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI/ICMS.
            </div>
        </body>
        </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
        w.document.write(htmlEspelho);
        w.document.close();
    }
}

// Expor funções para os botões HTML (onclick)
window.abrirModalEmitirAvulsa = abrirModalEmitirAvulsa;
window.renderVendasParaFaturar = renderVendasParaFaturar;
window.emitirNotaDireta = emitirNotaDireta;
window.baixarLoteMensalXML = baixarLoteMensalXML;
window.popularDatalistsAvulsa = popularDatalistsAvulsa;
window.selecionarClienteAvulsa = selecionarClienteAvulsa;
window.selecionarProdutoAvulsa = selecionarProdutoAvulsa;
window.abrirModalDevolucaoVenda = abrirModalDevolucaoVenda;
window.fecharModalDevolucaoVenda = fecharModalDevolucaoVenda;
window.confirmarDevolucaoVenda = confirmarDevolucaoVenda;
window.abrirModalNotaAvulsa = abrirModalNotaAvulsa;
window.fecharModalNotaAvulsa = fecharModalNotaAvulsa;
window.adicionarAvulsaItem = adicionarAvulsaItem;
window.removerAvulsaItem = removerAvulsaItem;
window.emitirNotaAvulsaModal = emitirNotaAvulsaModal;
window.abrirModalNFSe = abrirModalNFSe;
window.fecharModalNFSe = fecharModalNFSe;
window.emitirNFSeModal = emitirNFSeModal;
window.imprimirDanfse = imprimirDanfse;
window.filtrarNotasFiscais = filtrarNotasFiscais;
window.mudarPeriodoFiscal = mudarPeriodoFiscal;
window.salvarProxNumero = salvarProxNumero;
window.atualizarTabelaFiscal = atualizarTabelaFiscal;
window.abrirModalDevolucaoCompra = abrirModalDevolucaoCompra;
window.fecharModalDevolucaoCompra = fecharModalDevolucaoCompra;
window.selecionarFornecedorDevolucao = selecionarFornecedorDevolucao;
window.selecionarProdutoDevolucaoCompra = selecionarProdutoDevolucaoCompra;
window.processarXMLDevolucaoCompra = processarXMLDevolucaoCompra;
window.adicionarItemDevolucaoCompraManual = adicionarItemDevolucaoCompraManual;
window.toggleItemDevolucaoCompra = toggleItemDevolucaoCompra;
window.toggleAllItensDevolucaoCompra = toggleAllItensDevolucaoCompra;
window.alterarQtdItemDevolucaoCompra = alterarQtdItemDevolucaoCompra;
window.removerItemDevolucaoCompra = removerItemDevolucaoCompra;
window.emitirDevolucaoCompraModal = emitirDevolucaoCompraModal;

