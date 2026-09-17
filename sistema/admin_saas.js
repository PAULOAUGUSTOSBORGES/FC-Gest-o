// ==========================================
// ADMIN_SAAS.JS - Painel Super Admin (Gestão de Clientes e Mensalidades)
// Exclusivo para: fabricadecoresgoiania@gmail.com
// ==========================================

let listaLojas = [];
let filtroAtual = 'todos';
let buscaAtual = '';

// Proteção de Acesso ao Painel
window.addEventListener('load', () => {
    initGlobalData(async () => {
        const user = firebase.auth().currentUser;
        if (!user || user.email !== 'fabricadecoresgoiania@gmail.com') {
            alert('Acesso restrito ao Administrador Geral do Sistema.');
            window.location.href = 'index.html';
            return;
        }
        await carregarTodasAsLojas();
    });
});

async function carregarTodasAsLojas() {
    const corpo = document.getElementById('tabela-lojas-corpo');
    if (!corpo) return;

    const iconRefresh = document.getElementById('btn-icon-refresh');
    if (iconRefresh) iconRefresh.classList.add('fa-spin');

    try {
        const snap = await firestore.collection('empresas').get();
        const promessas = snap.docs.map(async (doc) => {
            const data = doc.data();
            data.id = doc.id;

            // Busca dados do dono se disponível
            let donoInfo = { nome: 'Não informado', email: 'Não informado' };
            if (data.donoUid) {
                try {
                    const uDoc = await firestore.collection('usuarios').doc(data.donoUid).get();
                    if (uDoc.exists) {
                        donoInfo = uDoc.data();
                    }
                } catch(e) {}
            }
            data.donoInfo = donoInfo;

            // Se não tiver vencimento definido, assume 30 dias a partir da criação
            if (!data.dataVencimento) {
                const baseData = data.dataCriacao && data.dataCriacao.toDate ? data.dataCriacao.toDate() : new Date();
                const venc = new Date(baseData);
                venc.setDate(venc.getDate() + 30);
                data.dataVencimento = venc.toISOString().split('T')[0];
            }

            if (!data.valorMensalidade && data.valorMensalidade !== 0) {
                data.valorMensalidade = 99.00; // Valor padrão sugerido
            }

            if (!data.whatsapp && donoInfo.telefone) {
                data.whatsapp = donoInfo.telefone;
            }

            return data;
        });

        listaLojas = await Promise.all(promessas);
        atualizarKPIs();
        renderizarTabelaLojas();

    } catch (e) {
        console.error("Erro ao listar lojas do SaaS:", e);
        corpo.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-red-400">
                    <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                    <p>Erro ao carregar lista de lojas: ${e.message}</p>
                </td>
            </tr>
        `;
    } finally {
        if (iconRefresh) iconRefresh.classList.remove('fa-spin');
    }
}
window.recarregarLojas = carregarTodasAsLojas;

function atualizarKPIs() {
    const hoje = new Date().toISOString().split('T')[0];
    let total = listaLojas.length;
    let ativas = 0;
    let atrasadas = 0;
    let mrr = 0;

    listaLojas.forEach(loja => {
        const status = loja.status || 'ATIVO';
        const venc = loja.dataVencimento || '';
        const valor = Number(loja.valorMensalidade || 0);

        if (status === 'ATIVO') {
            if (venc && venc < hoje) {
                atrasadas++;
            } else {
                ativas++;
            }
            mrr += valor;
        } else if (status === 'PENDENTE') {
            atrasadas++;
        } else if (status === 'TRIAL') {
            if (venc && venc < hoje) atrasadas++;
            else ativas++;
        }
    });

    const elTotal = document.getElementById('kpi-total-lojas');
    const elAtivas = document.getElementById('kpi-lojas-ativas');
    const elAtrasadas = document.getElementById('kpi-lojas-atrasadas');
    const elMrr = document.getElementById('kpi-faturamento-mrr');

    if (elTotal) elTotal.innerText = total;
    if (elAtivas) elAtivas.innerText = ativas;
    if (elAtrasadas) elAtrasadas.innerText = atrasadas;
    if (elMrr) elMrr.innerText = mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function filtrarLojas() {
    const inputBusca = document.getElementById('filtro-busca');
    const selectStatus = document.getElementById('filtro-status');

    buscaAtual = inputBusca ? inputBusca.value.toLowerCase().trim() : '';
    filtroAtual = selectStatus ? selectStatus.value : 'todos';

    renderizarTabelaLojas();
}
window.filtrarLojas = filtrarLojas;

function renderizarTabelaLojas() {
    const corpo = document.getElementById('tabela-lojas-corpo');
    if (!corpo) return;

    const hoje = new Date().toISOString().split('T')[0];

    const lojasFiltradas = listaLojas.filter(loja => {
        const nome = (loja.nomeEmpresa || loja.nome || '').toLowerCase();
        const email = (loja.donoInfo?.email || '').toLowerCase();
        const resp = (loja.donoInfo?.nome || '').toLowerCase();
        const wpp = String(loja.whatsapp || '').replace(/\D/g, '');

        const matchBusca = !buscaAtual || 
            nome.includes(buscaAtual) || 
            email.includes(buscaAtual) || 
            resp.includes(buscaAtual) || 
            wpp.includes(buscaAtual);

        const status = loja.status || 'ATIVO';
        let matchStatus = true;

        if (filtroAtual !== 'todos') {
            matchStatus = status === filtroAtual;
        }

        return matchBusca && matchStatus;
    });

    if (lojasFiltradas.length === 0) {
        corpo.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-10 text-slate-400">
                    <i class="fa-solid fa-store-slash text-2xl mb-2"></i>
                    <p>Nenhuma loja encontrada para este filtro.</p>
                </td>
            </tr>
        `;
        return;
    }

    corpo.innerHTML = lojasFiltradas.map(loja => {
        const nome = loja.nomeEmpresa || loja.nome || 'Loja Sem Nome';
        const donoNome = loja.donoInfo?.nome || 'Administrador';
        const donoEmail = loja.donoInfo?.email || 'Sem e-mail';
        const wpp = loja.whatsapp || '';
        const plano = loja.plano || 'PRO';
        const valor = Number(loja.valorMensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const venc = loja.dataVencimento || '';
        const status = loja.status || 'ATIVO';

        // Análise de Vencimento e Dias
        let badgeVenc = '';
        let diasDiff = 0;
        if (venc) {
            const d1 = new Date(hoje);
            const d2 = new Date(venc);
            const diffTime = d2 - d1;
            diasDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diasDiff < 0) {
                badgeVenc = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Atrasado (${Math.abs(diasDiff)}d)</span>`;
            } else if (diasDiff <= 5) {
                badgeVenc = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"><i class="fa-solid fa-clock text-[9px]"></i> Vence em ${diasDiff}d</span>`;
            } else {
                badgeVenc = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><i class="fa-solid fa-check text-[9px]"></i> Em dia (${diasDiff}d)</span>`;
            }
        }

        // Badge de Status
        let badgeStatus = '';
        if (status === 'ATIVO') {
            badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🟢 ATIVO</span>`;
        } else if (status === 'TRIAL') {
            badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">🟡 TRIAL</span>`;
        } else if (status === 'PENDENTE') {
            badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">🟠 PENDENTE</span>`;
        } else if (status === 'BLOQUEADO') {
            badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">⛔ BLOQUEADO</span>`;
        }

        // Formatação do link do WhatsApp
        const wppLimpo = String(wpp).replace(/\D/g, '');
        const temWpp = wppLimpo.length >= 10;

        return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="py-4 px-4">
                    <div class="font-bold text-slate-900 dark:text-white">${nome}</div>
                    <div class="text-xs text-slate-400 font-mono">ID: ${loja.id}</div>
                </td>
                <td class="py-4 px-4">
                    <div class="font-medium text-slate-800 dark:text-slate-200">${donoNome}</div>
                    <div class="text-xs text-slate-400">${donoEmail}</div>
                    ${temWpp ? `<div class="text-xs text-emerald-400 mt-0.5"><i class="fa-brands fa-whatsapp"></i> ${wpp}</div>` : ''}
                </td>
                <td class="py-4 px-4">
                    <div class="font-extrabold text-emerald-500">${valor}</div>
                    <div class="text-xs text-slate-400 font-semibold uppercase">${plano}</div>
                </td>
                <td class="py-4 px-4">
                    <div class="font-medium text-slate-700 dark:text-slate-300">${formatarDataBr(venc)}</div>
                    <div class="mt-1">${badgeVenc}</div>
                </td>
                <td class="py-4 px-4 text-center">
                    ${badgeStatus}
                </td>
                <td class="py-4 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="enviarCobrancaWhatsApp('${loja.id}')" title="Cobrar no WhatsApp" class="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-colors">
                            <i class="fa-brands fa-whatsapp text-base"></i>
                        </button>
                        <button onclick="abrirEdicaoLoja('${loja.id}')" title="Editar Assinatura" class="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-colors">
                            <i class="fa-solid fa-pen-to-square text-sm"></i>
                        </button>
                        ${status === 'BLOQUEADO' ? `
                            <button onclick="alternarBloqueio('${loja.id}', 'ATIVO')" title="Desbloquear Loja" class="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-colors">
                                <i class="fa-solid fa-lock-open text-sm"></i>
                            </button>
                        ` : `
                            <button onclick="alternarBloqueio('${loja.id}', 'BLOQUEADO')" title="Bloquear Acesso" class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors">
                                <i class="fa-solid fa-lock text-sm"></i>
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function formatarDataBr(dataIso) {
    if (!dataIso) return 'Não definida';
    const partes = dataIso.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataIso;
}

// Disparo da mensagem no WhatsApp
function enviarCobrancaWhatsApp(empresaId) {
    const loja = listaLojas.find(l => l.id === empresaId);
    if (!loja) return;

    let wpp = loja.whatsapp || '';
    let wppLimpo = String(wpp).replace(/\D/g, '');

    if (!wppLimpo || wppLimpo.length < 10) {
        const novoWpp = prompt('Informe o número de WhatsApp do cliente com DDD (Ex: 62999999999):', wpp);
        if (!novoWpp) return;
        loja.whatsapp = novoWpp;
        wppLimpo = String(novoWpp).replace(/\D/g, '');
        firestore.collection('empresas').doc(empresaId).update({ whatsapp: novoWpp }).catch(console.error);
    }

    if (wppLimpo.length === 10 || wppLimpo.length === 11) {
        wppLimpo = '55' + wppLimpo;
    }

    const nomeLoja = loja.nomeEmpresa || loja.nome || 'Loja';
    const valor = Number(loja.valorMensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const venc = formatarDataBr(loja.dataVencimento);

    const mensagem = `Olá, tudo bem? Aqui é do suporte do seu sistema de gestão!\n\n` +
        `Passando para lembrar da mensalidade da sua loja *${nomeLoja}* no valor de *${valor}*, com vencimento em *${venc}*.\n\n` +
        `🔑 *Chave PIX:* fabricadecoresgoiania@gmail.com\n\n` +
        `Após realizar o pagamento, por gentileza envie o comprovante por aqui para mantermos seu acesso 100% ativo!\n\n` +
        `Qualquer dúvida estamos à disposição. Abraços!`;

    const url = `https://wa.me/${wppLimpo}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}
window.enviarCobrancaWhatsApp = enviarCobrancaWhatsApp;

// Abertura do Modal de Edição
function abrirEdicaoLoja(empresaId) {
    const loja = listaLojas.find(l => l.id === empresaId);
    if (!loja) return;

    document.getElementById('edit-empresa-id').value = loja.id;
    document.getElementById('edit-nome-empresa').value = loja.nomeEmpresa || loja.nome || '';
    document.getElementById('edit-whatsapp').value = loja.whatsapp || '';
    document.getElementById('edit-plano').value = loja.plano || 'PRO';
    document.getElementById('edit-valor').value = loja.valorMensalidade !== undefined ? loja.valorMensalidade : 99.00;
    document.getElementById('edit-vencimento').value = loja.dataVencimento || '';
    document.getElementById('edit-status').value = loja.status || 'ATIVO';

    const modal = document.getElementById('modal-edicao');
    if (modal) modal.classList.remove('hidden');
}
window.abrirEdicaoLoja = abrirEdicaoLoja;

function fecharModalEdicao() {
    const modal = document.getElementById('modal-edicao');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalEdicao = fecharModalEdicao;

// Salvar Edição de Assinatura
async function salvarEdicaoEmpresa() {
    const id = document.getElementById('edit-empresa-id').value;
    if (!id) return;

    const nome = document.getElementById('edit-nome-empresa').value.trim();
    const wpp = document.getElementById('edit-whatsapp').value.trim();
    const plano = document.getElementById('edit-plano').value;
    const valor = parseFloat(document.getElementById('edit-valor').value) || 0;
    const venc = document.getElementById('edit-vencimento').value;
    const status = document.getElementById('edit-status').value;

    try {
        await firestore.collection('empresas').doc(id).set({
            nomeEmpresa: nome,
            whatsapp: wpp,
            plano: plano,
            valorMensalidade: valor,
            dataVencimento: venc,
            status: status,
            ultimaAtualizacaoMaster: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Atualiza localmente
        const idx = listaLojas.findIndex(l => l.id === id);
        if (idx !== -1) {
            listaLojas[idx].nomeEmpresa = nome;
            listaLojas[idx].whatsapp = wpp;
            listaLojas[idx].plano = plano;
            listaLojas[idx].valorMensalidade = valor;
            listaLojas[idx].dataVencimento = venc;
            listaLojas[idx].status = status;
        }

        fecharModalEdicao();
        atualizarKPIs();
        renderizarTabelaLojas();
        showToast('Assinatura atualizada com sucesso!', 'success');

    } catch (e) {
        console.error("Erro ao atualizar empresa:", e);
        showToast('Erro ao salvar: ' + e.message, 'error');
    }
}
window.salvarEdicaoEmpresa = salvarEdicaoEmpresa;

// Alternar Bloqueio / Desbloqueio Rápido
async function alternarBloqueio(empresaId, novoStatus) {
    const loja = listaLojas.find(l => l.id === empresaId);
    const nome = loja ? (loja.nomeEmpresa || loja.nome) : 'esta loja';

    const acao = novoStatus === 'BLOQUEADO' ? 'BLOQUEAR o acesso de' : 'DESBLOQUEAR e reativar o acesso de';
    if (!confirm(`Tem certeza que deseja ${acao} ${nome}?`)) {
        return;
    }

    try {
        await firestore.collection('empresas').doc(empresaId).update({
            status: novoStatus,
            ultimaAtualizacaoMaster: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (loja) loja.status = novoStatus;

        atualizarKPIs();
        renderizarTabelaLojas();
        showToast(`Loja ${novoStatus === 'BLOQUEADO' ? 'bloqueada' : 'ativada'} com sucesso!`, 'success');

    } catch (e) {
        console.error("Erro ao alterar status:", e);
        showToast('Erro: ' + e.message, 'error');
    }
}
window.alternarBloqueio = alternarBloqueio;
