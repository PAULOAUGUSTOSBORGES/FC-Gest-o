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

// ==========================================
// ABA NAVIGATION
// ==========================================
window.mudarAbaMarketing = function(aba) {
    document.getElementById('aba-lembretes').classList.add('hidden');
    document.getElementById('aba-ia').classList.add('hidden');
    if (document.getElementById('aba-historico')) document.getElementById('aba-historico').classList.add('hidden');
    
    document.getElementById('tab-lembretes').classList.remove('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
    document.getElementById('tab-lembretes').classList.add('border-transparent', 'text-slate-500');
    
    document.getElementById('tab-ia').classList.remove('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
    document.getElementById('tab-ia').classList.add('border-transparent', 'text-slate-500');
    
    if (document.getElementById('tab-historico')) {
        document.getElementById('tab-historico').classList.remove('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        document.getElementById('tab-historico').classList.add('border-transparent', 'text-slate-500');
    }

    if (aba === 'lembretes') {
        document.getElementById('aba-lembretes').classList.remove('hidden');
        document.getElementById('tab-lembretes').classList.add('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        document.getElementById('tab-lembretes').classList.remove('border-transparent', 'text-slate-500');
    } else if (aba === 'ia') {
        document.getElementById('aba-ia').classList.remove('hidden');
        document.getElementById('tab-ia').classList.add('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        document.getElementById('tab-ia').classList.remove('border-transparent', 'text-slate-500');
    } else if (aba === 'historico') {
        if (document.getElementById('aba-historico')) document.getElementById('aba-historico').classList.remove('hidden');
        if (document.getElementById('tab-historico')) {
            document.getElementById('tab-historico').classList.add('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
            document.getElementById('tab-historico').classList.remove('border-transparent', 'text-slate-500');
        }
        if (typeof carregarHistoricoMarketing === 'function') {
            carregarHistoricoMarketing();
        }
    }
};

// ==========================================
// INTEGRAÇÃO GEMINI IA
// ==========================================
window.gerarMarketingIA = async function() {
    const nicho = document.getElementById('ia-nicho').value.trim();
    const objetivo = document.getElementById('ia-objetivo').value.trim();
    
    if (!nicho || !objetivo) {
        showToast('Preencha o nicho e o objetivo para gerar ideias.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btn-gerar-ia');
    const resultadoContainer = document.getElementById('ia-resultado-container');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando (Aguarde)...';
    
    resultadoContainer.innerHTML = '<div class="flex flex-col items-center justify-center text-blue-500 mt-10"><i class="fa-solid fa-spinner fa-spin text-4xl mb-3"></i><p>A Inteligência Artificial está escrevendo...</p></div>';

    try {
        // 1. Busca a chave da API no banco de dados
        const docSnap = await firestore.collection('fc_moveis').doc('config').get();
        let apiKey = '';
        if (docSnap.exists) {
            const config = docSnap.data();
            if (config.empresa && config.empresa.geminiKey) {
                apiKey = config.empresa.geminiKey;
            }
        }
        
        if (!apiKey) {
            resultadoContainer.innerHTML = `
                <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    <p class="font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Chave da API não encontrada.</p>
                    <p class="text-sm mt-2">Você precisa configurar a chave do Gemini no menu <b>Sistema -> Configurações</b> para usar esta funcionalidade.</p>
                </div>`;
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Gerar Ideias e Textos';
            return;
        }

        // 2. Monta o Prompt para a IA
        const promptText = `Atue como um Assessor de Marketing Digital Especialista.
Meu nicho de atuação é: "${nicho}".
O objetivo desta campanha/postagem é: "${objetivo}".

Preciso que você crie 3 opções de ideias para postagem nas redes sociais (Instagram/Facebook/WhatsApp).
Para cada ideia, forneça:
1. Formato (Ex: Reels, Carrossel, Imagem Única, Texto WhatsApp)
2. Sugestão Visual (O que deve aparecer na imagem ou vídeo)
3. Copy (Texto completo da postagem usando gatilhos mentais e chamadas para ação claras)
4. Hashtags recomendadas.

Formate a resposta em HTML limpo. Use <h3> para os títulos das ideias, <p> para os textos, <strong> para negrito e <ul><li> para listas. Não use markdown de código na saída, apenas o HTML puro.`;

        // Lista de modelos recomendados pela API (começando pelo recomendado gemini-3.6-flash, e caindo para versões "lite" se os servidores estiverem cheios)
        const modelosParaTentar = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
        let response = null;
        let lastErrorText = "";
        
        for (const modelo of modelosParaTentar) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
                });
                
                if (response.ok) {
                    break; // Sucesso, sai do loop
                } else {
                    lastErrorText = await response.text();
                    // Se o erro for de demanda (high demand) ou limite (429), tenta o próximo modelo
                    if (response.status === 503 || response.status === 429) {
                        continue;
                    }
                    break; // Outro tipo de erro, sai e mostra pro usuário
                }
            } catch (e) {
                lastErrorText = e.toString();
                // erro de rede, tenta o próximo
            }
        }

        if (!response || !response.ok) {
            let errMsg = "Erro desconhecido ou Servidores do Google sobrecarregados.";
            try {
                const errJson = JSON.parse(lastErrorText);
                if (errJson.error && errJson.error.message) errMsg = errJson.error.message;
            } catch(e) {
                if (lastErrorText) errMsg = lastErrorText;
            }
            
            let modelosDisp = "";
            try {
                const mResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                if (mResp.ok) {
                    const mJson = await mResp.json();
                    if(mJson.models) {
                        modelosDisp = "<br><br><strong>Modelos disponíveis nesta chave:</strong><br>" + mJson.models.filter(m => m.name.includes("gemini")).map(m => m.name.replace('models/','')).join(', ');
                    }
                }
            } catch(e) {}
            
            resultadoContainer.innerHTML = `
            <div class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-4">
                <strong><i class="fa-solid fa-triangle-exclamation mr-2"></i>Erro ao consultar IA.</strong><br><br>
                ${errMsg}${modelosDisp}<br><br>
                Os servidores do Google Gemini podem estar sobrecarregados. Tente novamente em alguns minutos.
            </div>`;
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Gerar Ideias e Textos';
            return;
        }

        const data = await response.json();
        // 4. Extrai a resposta
        let textResult = data.candidates[0].content.parts[0].text;
        const modeloUsado = data.model || 'Gemini IA'; // Extrai o modelo que retornou o sucesso
        
        // Remove blocos de markdown html se a IA colocar
        textResult = textResult.replace(/```html/g, '').replace(/```/g, '');
        
        // Adiciona um aviso discreto sobre o modelo no rodapé do resultado
        const infoModeloHtml = `<div class="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 text-right italic"><i class="fa-solid fa-microchip mr-1"></i> Respondido por ${modeloUsado.replace('models/', '')}</div>`;
        
        resultadoContainer.innerHTML = textResult + infoModeloHtml;
        
        // --- 5. Salva no Banco de Dados para Histórico ---
        try {
            await firestore.collection('marketing_historico').add({
                nicho: nicho,
                objetivo: objetivo,
                resultado_html: textResult,
                modelo: modeloUsado.replace('models/', ''),
                data_geracao: new Date().toISOString()
            });
            console.log("Consultoria salva no histórico com sucesso.");
        } catch(errHistorico) {
            console.error("Erro ao salvar histórico de marketing:", errHistorico);
            // não interrompe o fluxo principal se apenas falhar para salvar
        }
        
        showToast('Consultoria gerada com sucesso!', 'success');

    } catch (e) {
        console.error("Erro Marketing IA:", e);
        
        // Se for erro de modelo, vamos tentar buscar a lista de modelos permitidos para esta chave
        let modelosPermitidosHtml = '';
        if (e.message && e.message.includes("is not found")) {
            try {
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                const listResp = await fetch(listUrl);
                if (listResp.ok) {
                    const listData = await listResp.json();
                    const modelosText = listData.models
                        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
                        .map(m => m.name.replace('models/', ''))
                        .join(', ');
                    modelosPermitidosHtml = `<p class="text-sm mt-3 font-bold">Modelos disponíveis para sua chave:</p><p class="text-xs mt-1 text-slate-700 bg-red-100 p-2 rounded">${modelosText || 'Nenhum modelo encontrado'}</p>`;
                }
            } catch (listErr) {
                console.error("Erro ao listar modelos", listErr);
            }
        }

        resultadoContainer.innerHTML = `
            <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                <p class="font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Erro ao consultar IA.</p>
                <p class="text-sm mt-2">${e.message}</p>
                ${modelosPermitidosHtml}
                <p class="text-sm mt-3">Tente verificar sua chave da API ou criar uma nova chave em outro projeto.</p>
            </div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Gerar Ideias e Textos';
    }
};

// ==========================================
// ABA HISTÓRICO DE CONSULTORIAS IA
// ==========================================
let todosHistoricosIA = [];

async function carregarHistoricoMarketing() {
    const container = document.getElementById('historico-container');
    if (!container) return;
    
    container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Carregando histórico e limpando itens antigos...</div>`;
    
    try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 30); // 30 dias atrás
        
        // Busca todos
        const snapshot = await firestore.collection('marketing_historico')
            .orderBy('data_geracao', 'desc')
            .get();
            
        todosHistoricosIA = [];
        let html = '';
        
        // Lógica de Exclusão Automática (30 dias)
        const batch = firestore.batch();
        let itemsDeletados = 0;
        
        snapshot.docs.forEach(doc => {
            const hist = { id: doc.id, ...doc.data() };
            const dataHist = new Date(hist.data_geracao);
            
            if (dataHist < dataLimite) {
                // Item é mais velho que 30 dias -> APAGAR DA NUVEM
                batch.delete(doc.ref);
                itemsDeletados++;
            } else {
                // Item é válido -> MANTER E MOSTRAR
                todosHistoricosIA.push(hist);
            }
        });
        
        // Se achou lixo velho, comita a limpeza na nuvem
        if (itemsDeletados > 0) {
            await batch.commit();
            console.log(`🗑️ Limpeza de Histórico: ${itemsDeletados} consultorias velhas apagadas.`);
        }
        
        // Renderiza na tela
        if (todosHistoricosIA.length === 0) {
            container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">Nenhuma consultoria encontrada nos últimos 30 dias.</div>`;
            return;
        }
        
        todosHistoricosIA.forEach(hist => {
            const d = new Date(hist.data_geracao);
            const dataStr = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            const objCurto = hist.objetivo.length > 80 ? hist.objetivo.substring(0, 80) + '...' : hist.objetivo;
            const nomeModelo = hist.modelo ? hist.modelo : 'IA';
            
            html += `
                <div class="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-full hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-3">
                        <span class="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">${hist.nicho}</span>
                        <span class="text-[10px] text-slate-400 font-medium"><i class="fa-solid fa-microchip mr-1"></i> ${nomeModelo}</span>
                    </div>
                    
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm mb-2 flex-1">"${objCurto}"</h4>
                    
                    <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <span class="text-[11px] text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> ${dataStr}</span>
                        <button onclick="verDetalhesHistorico('${hist.id}')" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-bold flex items-center gap-1 transition-colors">
                            Ler <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        container.innerHTML = `<div class="col-span-full p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl">Erro ao carregar histórico. Verifique a conexão.</div>`;
    }
}

window.verDetalhesHistorico = function(id) {
    const hist = todosHistoricosIA.find(h => h.id === id);
    if (!hist) return;
    
    document.getElementById('modal-hist-nicho').innerText = hist.nicho;
    document.getElementById('modal-hist-objetivo').innerText = hist.objetivo;
    document.getElementById('modal-hist-texto').innerHTML = hist.resultado_html;
    
    const d = new Date(hist.data_geracao);
    document.getElementById('modal-hist-data').innerText = `Gerado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    
    document.getElementById('modal-historico').classList.remove('hidden');
    // Adiciona delay para a animação de entrada
    setTimeout(() => {
        document.getElementById('modal-historico').classList.add('opacity-100');
        document.getElementById('modal-historico-content').classList.remove('scale-95');
        document.getElementById('modal-historico-content').classList.add('scale-100');
    }, 10);
};

window.fecharModalHistorico = function() {
    document.getElementById('modal-historico').classList.remove('opacity-100');
    document.getElementById('modal-historico-content').classList.remove('scale-100');
    document.getElementById('modal-historico-content').classList.add('scale-95');
    
    setTimeout(() => {
        document.getElementById('modal-historico').classList.add('hidden');
    }, 300);
};
