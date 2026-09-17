// ==========================================
// MASTER.JS - Lógica Exclusiva do Portal do Fundador SaaS
// Fundador: pauloaugusto.silvaborges@gmail.com
// ==========================================

const EMAILS_MASTER = [
    'pauloaugusto.silvaborges@gmail.com',
    'fabricadecoresgoiania@gmail.com'
];

let listaLojas = [];
let buscaAtual = '';
let filtroStatusAtual = 'todos';

// Toast do Portal Master
function showToast(msg, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const cores = {
        success: 'bg-emerald-500 text-slate-950 border-emerald-400',
        error: 'bg-red-500 text-white border-red-400',
        info: 'bg-amber-500 text-slate-950 border-amber-400'
    };

    const icones = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info'
    };

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-bold transition-all transform duration-300 translate-y-2 opacity-0 ${cores[tipo] || cores.info}`;
    toast.innerHTML = `<i class="fa-solid ${icones[tipo] || icones.info} text-sm"></i> <span>${msg}</span>`;

    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Inicialização e Verificação de Sessão
window.addEventListener('load', () => {
    const isLoginPage = window.location.pathname.includes('login.html');

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            if (!isLoginPage) window.location.href = 'login.html';
            return;
        }

        const email = (user.email || '').toLowerCase();
        const isMaster = EMAILS_MASTER.includes(email);

        if (!isMaster) {
            if (!isLoginPage) {
                alert('Acesso negado: Este portal é restrito exclusivamente ao Fundador do SaaS.');
                await firebase.auth().signOut();
                window.location.href = 'login.html';
            }
            return;
        }

        // Se estiver no login e já for master, entra no painel
        if (isLoginPage) {
            window.location.href = 'index.html';
            return;
        }

        // Exibe nome e email no painel
        const elNome = document.getElementById('master-nome-display');
        const elEmail = document.getElementById('master-email-display');
        if (elNome) elNome.innerText = user.displayName || 'Paulo Augusto';
        if (elEmail) elEmail.innerText = email;

        await carregarTodasAsLojasMaster();
    });
});

// Ação de Login no Portal
async function fazerLoginMaster(e) {
    if (e) e.preventDefault();

    const email = document.getElementById('master-email').value.trim().toLowerCase();
    const pass = document.getElementById('master-senha').value;
    const btn = document.getElementById('btn-entrar-master');

    if (!EMAILS_MASTER.includes(email)) {
        showToast('Este e-mail não possui permissão de Fundador do SaaS.', 'error');
        return;
    }

    try {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
        btn.disabled = true;

        await firebase.auth().signInWithEmailAndPassword(email, pass);
        showToast('Login autorizado! Entrando...', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);

    } catch (err) {
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Acessar Painel Master';
        btn.disabled = false;
        console.error(err);
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            showToast('Senha incorreta! Verifique e tente novamente.', 'error');
        } else {
            showToast('Erro ao entrar: ' + err.message, 'error');
        }
    }
}
window.fazerLoginMaster = fazerLoginMaster;

// Ação de Logout
async function fazerLogoutMaster() {
    try {
        await firebase.auth().signOut();
    } catch(e) {}
    window.location.href = 'login.html';
}
window.fazerLogoutMaster = fazerLogoutMaster;

// Carregar Lojas do Banco
async function carregarTodasAsLojasMaster() {
    const corpo = document.getElementById('tabela-lojas-corpo');
    if (!corpo) return;

    const iconRefresh = document.getElementById('btn-icon-refresh');
    if (iconRefresh) iconRefresh.classList.add('fa-spin');

    try {
        const snap = await firebase.firestore().collection('empresas').get();
        const promessas = snap.docs.map(async (doc) => {
            const data = doc.data();
            data.id = doc.id;

            // Busca dados do dono
            let donoInfo = { nome: 'Não informado', email: 'Não informado', telefone: '' };
            if (data.donoUid) {
                try {
                    const uDoc = await firebase.firestore().collection('usuarios').doc(data.donoUid).get();
                    if (uDoc.exists) donoInfo = uDoc.data();
                } catch(e) {}
            }
            data.donoInfo = donoInfo;

            // Se não tiver data de vencimento, define 30 dias após a criação
            if (!data.dataVencimento) {
                const base = data.dataCriacao && data.dataCriacao.toDate ? data.dataCriacao.toDate() : new Date();
                const v = new Date(base);
                v.setDate(v.getDate() + 30);
                data.dataVencimento = v.toISOString().split('T')[0];
            }

            if (data.valorMensalidade === undefined) {
                data.valorMensalidade = 99.00;
            }

            if (!data.whatsapp && donoInfo.telefone) {
                data.whatsapp = donoInfo.telefone;
            }

            return data;
        });

        listaLojas = await Promise.all(promessas);
        atualizarKPIsMaster();
        renderizarTabelaLojasMaster();

    } catch (err) {
        console.error("Erro ao listar lojas:", err);
        corpo.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-10 text-red-400">
                    <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                    <p>Erro ao carregar lojas: ${err.message}</p>
                </td>
            </tr>
        `;
    } finally {
        if (iconRefresh) iconRefresh.classList.remove('fa-spin');
    }
}
window.carregarTodasAsLojasMaster = carregarTodasAsLojasMaster;

function atualizarKPIsMaster() {
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
            if (venc && venc < hoje) atrasadas++;
            else ativas++;
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

function filtrarLojasMaster() {
    const inputBusca = document.getElementById('filtro-busca');
    const selectStatus = document.getElementById('filtro-status');

    buscaAtual = inputBusca ? inputBusca.value.toLowerCase().trim() : '';
    filtroStatusAtual = selectStatus ? selectStatus.value : 'todos';

    renderizarTabelaLojasMaster();
}
window.filtrarLojasMaster = filtrarLojasMaster;

function renderizarTabelaLojasMaster() {
    const corpo = document.getElementById('tabela-lojas-corpo');
    if (!corpo) return;

    const hoje = new Date().toISOString().split('T')[0];

    const filtradas = listaLojas.filter(l => {
        const nome = (l.nomeEmpresa || l.nome || '').toLowerCase();
        const dono = (l.donoInfo?.nome || '').toLowerCase();
        const email = (l.donoInfo?.email || '').toLowerCase();
        const wpp = String(l.whatsapp || '').replace(/\D/g, '');

        const matchBusca = !buscaAtual || nome.includes(buscaAtual) || dono.includes(buscaAtual) || email.includes(buscaAtual) || wpp.includes(buscaAtual);
        const status = l.status || 'ATIVO';
        const matchStatus = filtroStatusAtual === 'todos' || status === filtroStatusAtual;

        return matchBusca && matchStatus;
    });

    if (filtradas.length === 0) {
        corpo.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-12 text-slate-500">
                    <i class="fa-solid fa-store-slash text-3xl mb-2"></i>
                    <p>Nenhuma loja encontrada para o filtro atual.</p>
                </td>
            </tr>
        `;
        return;
    }

    corpo.innerHTML = filtradas.map(loja => {
        const nome = loja.nomeEmpresa || loja.nome || 'Loja Sem Nome';
        const donoNome = loja.donoInfo?.nome || 'Administrador';
        const donoEmail = loja.donoInfo?.email || 'Sem e-mail';
        const wpp = loja.whatsapp || '';
        const plano = loja.plano || 'PRO';
        const valor = Number(loja.valorMensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const venc = loja.dataVencimento || '';
        const status = loja.status || 'ATIVO';

        // Badge Vencimento
        let badgeVenc = '';
        if (venc) {
            const d1 = new Date(hoje);
            const d2 = new Date(venc);
            const diffDias = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));

            if (diffDias < 0) {
                badgeVenc = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Atrasado (${Math.abs(diffDias)}d)</span>`;
            } else if (diffDias <= 5) {
                badgeVenc = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"><i class="fa-solid fa-clock text-[9px]"></i> Vence em ${diffDias}d</span>`;
            } else {
                badgeVenc = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><i class="fa-solid fa-check text-[9px]"></i> Em dia (${diffDias}d)</span>`;
            }
        }

        // Badge Status
        let badgeStatus = '';
        if (status === 'ATIVO') badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🟢 ATIVO</span>`;
        else if (status === 'TRIAL') badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">🟡 TRIAL</span>`;
        else if (status === 'PENDENTE') badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">🟠 PENDENTE</span>`;
        else if (status === 'BLOQUEADO') badgeStatus = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">⛔ BLOQUEADO</span>`;

        const wppLimpo = String(wpp).replace(/\D/g, '');
        const temWpp = wppLimpo.length >= 10;

        return `
            <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="py-4 px-4">
                    <div class="font-extrabold text-white text-base">${nome}</div>
                    <div class="text-xs text-slate-500 font-mono">ID: ${loja.id}</div>
                </td>
                <td class="py-4 px-4">
                    <div class="font-semibold text-slate-200">${donoNome}</div>
                    <div class="text-xs text-slate-400">${donoEmail}</div>
                    ${temWpp ? `<div class="text-xs text-emerald-400 font-medium mt-0.5"><i class="fa-brands fa-whatsapp"></i> ${wpp}</div>` : ''}
                </td>
                <td class="py-4 px-4">
                    <div class="font-black text-emerald-400 text-base">${valor}</div>
                    <div class="text-xs text-slate-400 uppercase font-bold">${plano}</div>
                </td>
                <td class="py-4 px-4">
                    <div class="font-medium text-slate-300">${formatarDataBr(venc)}</div>
                    <div class="mt-1">${badgeVenc}</div>
                </td>
                <td class="py-4 px-4 text-center">
                    ${badgeStatus}
                </td>
                <td class="py-4 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="enviarCobrancaWhatsAppMaster('${loja.id}')" title="Cobrança no WhatsApp" class="w-8 h-8 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all border border-emerald-500/20">
                            <i class="fa-brands fa-whatsapp text-base"></i>
                        </button>
                        <button onclick="abrirEdicaoLojaMaster('${loja.id}')" title="Gerenciar Assinatura" class="w-8 h-8 rounded-xl bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 flex items-center justify-center transition-all border border-blue-500/20">
                            <i class="fa-solid fa-pen-to-square text-sm"></i>
                        </button>
                        ${status === 'BLOQUEADO' ? `
                            <button onclick="alternarBloqueioMaster('${loja.id}', 'ATIVO')" title="Desbloquear Loja" class="w-8 h-8 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all border border-emerald-500/20">
                                <i class="fa-solid fa-lock-open text-sm"></i>
                            </button>
                        ` : `
                            <button onclick="alternarBloqueioMaster('${loja.id}', 'BLOQUEADO')" title="Bloquear Loja" class="w-8 h-8 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-all border border-red-500/20">
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
    const p = dataIso.split('-');
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return dataIso;
}

// Disparo de Cobrança WhatsApp do Paulo Augusto
function enviarCobrancaWhatsAppMaster(empresaId) {
    const loja = listaLojas.find(l => l.id === empresaId);
    if (!loja) return;

    let wpp = loja.whatsapp || '';
    let wppLimpo = String(wpp).replace(/\D/g, '');

    if (!wppLimpo || wppLimpo.length < 10) {
        const novo = prompt('Informe o WhatsApp do cliente com DDD (Ex: 62999999999):', wpp);
        if (!novo) return;
        loja.whatsapp = novo;
        wppLimpo = String(novo).replace(/\D/g, '');
        firebase.firestore().collection('empresas').doc(empresaId).update({ whatsapp: novo }).catch(console.error);
    }

    if (wppLimpo.length === 10 || wppLimpo.length === 11) {
        wppLimpo = '55' + wppLimpo;
    }

    const nomeLoja = loja.nomeEmpresa || loja.nome || 'Loja';
    const valor = Number(loja.valorMensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const venc = formatarDataBr(loja.dataVencimento);

    const mensagem = `Olá, tudo bem? Aqui é o Paulo Augusto, responsável pelo sistema de gestão da sua loja!\n\n` +
        `Passando para lembrar da mensalidade da sua loja *${nomeLoja}* no valor de *${valor}*, com vencimento em *${venc}*.\n\n` +
        `🔑 *Chave PIX:* pauloaugusto.silvaborges@gmail.com\n\n` +
        `Após realizar o pagamento, por gentileza envie o comprovante por aqui para mantermos seu acesso 100% ativo!\n\n` +
        `Qualquer dúvida estou à disposição. Abraços!`;

    window.open(`https://wa.me/${wppLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
}
window.enviarCobrancaWhatsAppMaster = enviarCobrancaWhatsAppMaster;

// Modal de Edição
function abrirEdicaoLojaMaster(empresaId) {
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
window.abrirEdicaoLojaMaster = abrirEdicaoLojaMaster;

function fecharModalEdicao() {
    const modal = document.getElementById('modal-edicao');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalEdicao = fecharModalEdicao;

// Salvar Edição
async function salvarEdicaoEmpresaMaster() {
    const id = document.getElementById('edit-empresa-id').value;
    if (!id) return;

    const nome = document.getElementById('edit-nome-empresa').value.trim();
    const wpp = document.getElementById('edit-whatsapp').value.trim();
    const plano = document.getElementById('edit-plano').value;
    const valor = parseFloat(document.getElementById('edit-valor').value) || 0;
    const venc = document.getElementById('edit-vencimento').value;
    const status = document.getElementById('edit-status').value;

    try {
        await firebase.firestore().collection('empresas').doc(id).set({
            nomeEmpresa: nome,
            whatsapp: wpp,
            plano: plano,
            valorMensalidade: valor,
            dataVencimento: venc,
            status: status,
            ultimaAtualizacaoMaster: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

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
        atualizarKPIsMaster();
        renderizarTabelaLojasMaster();
        showToast('Assinatura salva com sucesso!', 'success');

    } catch (err) {
        console.error("Erro ao salvar:", err);
        showToast('Erro ao salvar: ' + err.message, 'error');
    }
}
window.salvarEdicaoEmpresaMaster = salvarEdicaoEmpresaMaster;

// Bloquear / Desbloquear Loja
async function alternarBloqueioMaster(empresaId, novoStatus) {
    const loja = listaLojas.find(l => l.id === empresaId);
    const nome = loja ? (loja.nomeEmpresa || loja.nome) : 'esta loja';

    const acao = novoStatus === 'BLOQUEADO' ? 'BLOQUEAR o acesso de' : 'DESBLOQUEAR e reativar o acesso de';
    if (!confirm(`Tem certeza que deseja ${acao} ${nome}?`)) return;

    try {
        await firebase.firestore().collection('empresas').doc(empresaId).update({
            status: novoStatus,
            ultimaAtualizacaoMaster: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (loja) loja.status = novoStatus;

        atualizarKPIsMaster();
        renderizarTabelaLojasMaster();
        showToast(`Loja ${novoStatus === 'BLOQUEADO' ? 'bloqueada' : 'ativada'} com sucesso!`, 'success');

    } catch (err) {
        console.error(err);
        showToast('Erro: ' + err.message, 'error');
    }
}
window.alternarBloqueioMaster = alternarBloqueioMaster;

// Modal Nova Loja
function abrirModalNovaLoja() {
    const modal = document.getElementById('modal-nova-loja');
    if (modal) modal.classList.remove('hidden');
}
window.abrirModalNovaLoja = abrirModalNovaLoja;

function fecharModalNovaLoja() {
    const modal = document.getElementById('modal-nova-loja');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalNovaLoja = fecharModalNovaLoja;

// Cadastro Manual de Loja pelo Paulo Augusto
async function cadastrarLojaManual(e) {
    if (e) e.preventDefault();

    const nome = document.getElementById('nova-loja-nome').value.trim();
    const email = document.getElementById('nova-loja-email').value.trim().toLowerCase();
    const senha = document.getElementById('nova-loja-senha').value;
    const wpp = document.getElementById('nova-loja-whatsapp').value.trim();
    const valor = parseFloat(document.getElementById('nova-loja-valor').value) || 99.00;
    const btn = document.getElementById('btn-criar-loja-manual');

    if (!nome || !email || !senha) {
        showToast('Preencha os campos obrigatórios!', 'error');
        return;
    }

    try {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando Loja...';
        btn.disabled = true;

        // Cria o usuário usando uma instância secundária para não deslogar o Paulo Augusto
        let secApp;
        try {
            secApp = firebase.app('SecondaryMaster');
        } catch(e) {
            secApp = firebase.initializeApp(firebaseConfig, 'SecondaryMaster');
        }

        const cred = await secApp.auth().createUserWithEmailAndPassword(email, senha);
        const uid = cred.user.uid;
        await secApp.auth().signOut();

        const empresaId = 'loja_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        const db = firebase.firestore();
        const batch = db.batch();

        // 1. Mapeamento global de usuário
        batch.set(db.collection('usuarios').doc(uid), {
            email: email,
            empresaId: empresaId,
            role: 'admin',
            nome: nome,
            telefone: wpp,
            criadoPorMaster: true,
            dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Data de vencimento em 30 dias
        const venc = new Date();
        venc.setDate(venc.getDate() + 30);
        const dataVencStr = venc.toISOString().split('T')[0];

        // 3. Documento da empresa
        batch.set(db.collection('empresas').doc(empresaId), {
            nomeEmpresa: nome,
            donoUid: uid,
            whatsapp: wpp,
            plano: 'PRO',
            valorMensalidade: valor,
            dataVencimento: dataVencStr,
            status: 'ATIVO',
            dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. Perfil admin na empresa
        batch.set(db.collection('empresas').doc(empresaId).collection('funcionarios').doc(uid), {
            nome: 'Administrador',
            email: email,
            isAdmin: true,
            perm_dashboard: true,
            perm_pdv: true,
            perm_cadastros: true,
            perm_gestao: true,
            perm_config: true,
            status: 'ativo'
        });

        // 5. Configuração e Caixa inicial
        batch.set(db.collection('empresas').doc(empresaId).collection('configuracoes').doc('config'), {
            empresa: { nome: nome, fantasia: nome },
            pdv: { permite_estoque_negativo: false }
        });
        batch.set(db.collection('empresas').doc(empresaId).collection('caixa').doc('caixa_atual'), {
            status: 'fechado', saldo: 0, historico: []
        });

        await batch.commit();

        fecharModalNovaLoja();
        showToast(`Loja "${nome}" criada com sucesso!`, 'success');
        await carregarTodasAsLojasMaster();

    } catch (err) {
        console.error(err);
        showToast('Erro ao criar loja: ' + err.message, 'error');
    } finally {
        btn.innerHTML = 'Criar e Liberar Loja';
        btn.disabled = false;
    }
}
window.cadastrarLojaManual = cadastrarLojaManual;
