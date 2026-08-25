// marketing.js - Lógica para os Lembretes Diários de WhatsApp

let unsubscribeClientes = null;
let todosClientes = [];

document.addEventListener('DOMContentLoaded', function() {
    // Aguardar autenticação do Firebase no global.js para carregar dados
    const authInterval = setInterval(() => {
        if (typeof window.currentUserInfo !== 'undefined' && window.currentUserInfo !== null) {
            clearInterval(authInterval);
            carregarClientesELembretes();
        }
    }, 500);
});

window.onload = () => { if (typeof initGlobalData === 'function') initGlobalData(); };

function carregarClientesELembretes() {
    if (unsubscribeClientes) unsubscribeClientes();
    
    showToast("Carregando lembretes...", "info");
    
    unsubscribeClientes = firestore.collection('clientes')
        .onSnapshot((snap) => {
            todosClientes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Renderiza tabela e opções do select
            renderTabelaLembretes();
            popularSelectClientes();
            
        }, (error) => {
            console.error("Erro ao carregar clientes:", error);
            showToast("Erro ao carregar clientes. Verifique permissões.", "error");
        });
}

function renderTabelaLembretes() {
    const tbody = document.getElementById('tabela-lembretes');
    if (!tbody) return;
    
    // Filtra apenas os clientes que têm o lembrete de WhatsApp ativo
    const lembretes = todosClientes.filter(c => c.lembrete_wpp === true);
    
    if (lembretes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">Nenhum lembrete de WhatsApp configurado.</td></tr>`;
        return;
    }
    
    let html = '';
    lembretes.forEach(c => {
        const wpp = c.wpp ? formatarCelular(c.wpp) : '<span class="text-red-400">Sem número</span>';
        const msgCurta = c.lembrete_msg ? (c.lembrete_msg.length > 50 ? c.lembrete_msg.substring(0, 50) + '...' : c.lembrete_msg) : 'Sem mensagem configurada';
        
        // Verifica se já foi enviado hoje (apenas para exibir um badge amigável)
        const hojeStr = formatarDataHoje();
        const enviadoHoje = (c.lembrete_last_sent === hojeStr);
        const statusBadge = enviadoHoje 
            ? `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold"><i class="fa-solid fa-check mr-1"></i>Enviado Hoje</span>`
            : `<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold"><i class="fa-regular fa-clock mr-1"></i>Pendente Hoje</span>`;
            
        let link = '#';
        if (c.wpp) {
            let nCelular = c.wpp.replace(/\D/g, '');
            link = `https://wa.me/55${nCelular}`;
            if (c.lembrete_msg) link += `?text=` + encodeURIComponent(c.lembrete_msg);
        }
            
        html += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-700">
                <td class="p-3 font-medium text-slate-800 dark:text-slate-200">
                    <i class="fa-solid fa-user text-slate-400 mr-2"></i> ${c.nome}
                </td>
                <td class="p-3">${wpp}</td>
                <td class="p-3 text-slate-500 italic">"${msgCurta}"</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button onclick="enviarWhatsAppMarketing('${c.id}', '${link}')" class="text-emerald-500 hover:bg-emerald-50 p-2 rounded-lg transition-colors" title="Enviar Mensagem Agora" ${!c.wpp ? 'disabled opacity-50 cursor-not-allowed' : ''}><i class="fa-brands fa-whatsapp text-lg"></i></button>
                    <button onclick="editarLembrete('${c.id}')" class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors ml-1" title="Editar Lembrete"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="removerLembrete('${c.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors ml-1" title="Remover Lembrete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function popularSelectClientes() {
    const select = document.getElementById('lemb-cli-select');
    if (!select) return;
    
    let html = '<option value="">-- Selecione o Cliente --</option>';
    
    // Ordena alfabeticamente
    const ordenados = [...todosClientes].sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));
    
    ordenados.forEach(c => {
        const flag = c.lembrete_wpp ? ' (Já possui lembrete)' : '';
        html += `<option value="${c.id}">${c.nome}${flag}</option>`;
    });
    
    select.innerHTML = html;
}

// ==========================================
// MODAL DE NOVO/EDITAR LEMBRETE
// ==========================================

function abrirModalNovoLembrete() {
    document.getElementById('lemb-cli-id').value = '';
    document.getElementById('lemb-cli-select').value = '';
    document.getElementById('lemb-cli-select').disabled = false;
    document.getElementById('lemb-wpp-preview-container').classList.add('hidden');
    document.getElementById('lemb-wpp-preview').value = '';
    document.getElementById('lemb-msg').value = '';
    document.getElementById('lemb-ativo').checked = true;
    
    const modal = document.getElementById('modal-lembrete');
    modal.classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('modal-lembrete-content').classList.remove('translate-x-full');
    }, 10);
}

function fecharModalLembrete() {
    const modal = document.getElementById('modal-lembrete');
    document.getElementById('modal-lembrete-content').classList.add('translate-x-full');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function editarLembrete(id) {
    const c = todosClientes.find(x => x.id === id);
    if (!c) return;
    
    document.getElementById('lemb-cli-id').value = id;
    document.getElementById('lemb-cli-select').value = id;
    document.getElementById('lemb-cli-select').disabled = true; // Não deixa trocar o cliente na edição
    
    aoSelecionarClienteLembrete(); // Atualiza preview do wpp
    
    document.getElementById('lemb-msg').value = c.lembrete_msg || '';
    document.getElementById('lemb-ativo').checked = c.lembrete_wpp === true;
    
    const modal = document.getElementById('modal-lembrete');
    modal.classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('modal-lembrete-content').classList.remove('translate-x-full');
    }, 10);
}

// Globalizar funções para onClick do HTML
window.abrirModalNovoLembrete = abrirModalNovoLembrete;
window.fecharModalLembrete = fecharModalLembrete;
window.editarLembrete = editarLembrete;
window.aoSelecionarClienteLembrete = aoSelecionarClienteLembrete;
window.preencherMsgPadrao = preencherMsgPadrao;
window.salvarLembrete = salvarLembrete;
window.removerLembrete = removerLembrete;
window.enviarWhatsAppMarketing = enviarWhatsAppMarketing;

function enviarWhatsAppMarketing(clienteId, link) {
    if (!clienteId || link === '#') return;
    
    const hojeStr = formatarDataHoje();
    
    firestore.collection('clientes').doc(clienteId).set({
        lembrete_last_sent: hojeStr
    }, { merge: true }).then(() => {
        // Atualiza cache local e força re-render para ver o check "Enviado Hoje"
        const c = todosClientes.find(x => x.id === clienteId);
        if (c) c.lembrete_last_sent = hojeStr;
        renderTabelaLembretes();
        
        window.open(link, '_blank');
    }).catch(e => {
        console.error('Erro ao registrar lembrete WPP:', e);
        showToast('Erro ao atualizar banco de dados.', 'error');
    });
}

function aoSelecionarClienteLembrete() {
    const id = document.getElementById('lemb-cli-select').value;
    const c = todosClientes.find(x => x.id === id);
    const container = document.getElementById('lemb-wpp-preview-container');
    const preview = document.getElementById('lemb-wpp-preview');
    
    if (c) {
        container.classList.remove('hidden');
        preview.value = c.wpp ? formatarCelular(c.wpp) : 'CLIENTE SEM NÚMERO CADASTRADO';
        if (!c.wpp) preview.classList.add('text-red-500');
        else preview.classList.remove('text-red-500');
        
        // Se já tem lembrete ativo e não estamos editando, puxa a mensagem pra edição
        if (c.lembrete_wpp && document.getElementById('lemb-cli-id').value === '') {
            document.getElementById('lemb-msg').value = c.lembrete_msg || '';
            document.getElementById('lemb-ativo').checked = c.lembrete_wpp === true;
        }
    } else {
        container.classList.add('hidden');
        preview.value = '';
    }
}

function preencherMsgPadrao() {
    const textarea = document.getElementById('lemb-msg');
    textarea.value = "Bom dia! Tudo bem? Aqui é da FC Móveis.\n\nPassando para avisar da nossa promoção de hoje: ";
    textarea.focus();
}

async function salvarLembrete() {
    let id = document.getElementById('lemb-cli-id').value;
    if (!id) {
        id = document.getElementById('lemb-cli-select').value;
    }
    
    if (!id) return showToast('Selecione um cliente!', 'error');
    
    const msg = document.getElementById('lemb-msg').value.trim();
    if (!msg) return showToast('A mensagem não pode ficar vazia!', 'error');
    
    const ativo = document.getElementById('lemb-ativo').checked;
    
    try {
        await firestore.collection('clientes').doc(id).set({
            lembrete_wpp: ativo,
            lembrete_msg: msg
        }, { merge: true });
        
        showToast('Lembrete configurado com sucesso!', 'success');
        fecharModalLembrete();
    } catch (e) {
        console.error('Erro ao salvar lembrete:', e);
        showToast('Erro ao salvar no banco de dados.', 'error');
    }
}

async function removerLembrete(id) {
    if (!confirm('Deseja excluir este lembrete? O cliente não será excluído, apenas o lembrete diário será desativado.')) return;
    
    try {
        await firestore.collection('clientes').doc(id).set({
            lembrete_wpp: false,
            lembrete_msg: ''
        }, { merge: true });
        
        showToast('Lembrete removido!', 'success');
    } catch (e) {
        console.error('Erro ao remover lembrete:', e);
        showToast('Erro ao remover.', 'error');
    }
}

function formatarCelular(n) {
    if (!n) return n;
    const clean = n.replace(/\D/g, '');
    if (clean.length === 11) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
    } else if (clean.length === 10) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,6)}-${clean.substring(6)}`;
    }
    return n;
}

function formatarDataHoje() {
    const hj = new Date();
    const y = hj.getFullYear();
    const m = String(hj.getMonth() + 1).padStart(2, '0');
    const d = String(hj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
