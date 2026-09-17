// ==========================================================================
// MASTER.JS - Painel do Fundador SaaS (Sistema Master Independente)
// Gestão de Lojas, Dossiê Completo, Catálogo de Planos e Emissor de Contratos
// Fundador: pauloaugusto.silvaborges@gmail.com
// ==========================================================================

const EMAILS_MASTER = [
    'pauloaugusto.silvaborges@gmail.com',
    'fabricadecoresgoiania@gmail.com'
];

let listaLojas = [];
let listaPlanos = [];
let buscaAtual = '';
let filtroStatusAtual = 'todos';
let viewAtual = 'lojas';
let lojaDossieAtual = null;

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
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

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-bold transition-all transform duration-300 translate-y-2 opacity-0 ${cores[tipo] || cores.info}`;
    toast.innerHTML = `<i class="fa-solid ${icones[tipo] || icones.info} text-sm"></i> <span>${msg}</span>`;

    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
window.showToast = showToast;

// ==========================================
// UTILITÁRIO: COPIAR PARA ÁREA DE TRANSFERÊNCIA
// ==========================================
function copiarTexto(txt, msg = 'Copiado para a área de transferência!') {
    if (!txt) {
        showToast('Nada para copiar!', 'info');
        return;
    }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(txt).then(() => {
            showToast(msg, 'success');
        }).catch(() => {
            copiarTextoFallback(txt, msg);
        });
    } else {
        copiarTextoFallback(txt, msg);
    }
}
function copiarTextoFallback(txt, msg) {
    const inp = document.createElement('textarea');
    inp.value = txt;
    inp.style.position = 'fixed';
    inp.style.opacity = '0';
    document.body.appendChild(inp);
    inp.focus();
    inp.select();
    try {
        document.execCommand('copy');
        showToast(msg, 'success');
    } catch(e) {
        showToast('Não foi possível copiar automaticamente.', 'error');
    }
    document.body.removeChild(inp);
}
window.copiarTexto = copiarTexto;


// ==========================================
// INICIALIZAÇÃO E SESSÃO DO FUNDADOR
// ==========================================
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

        if (isLoginPage) {
            window.location.href = 'index.html';
            return;
        }

        // Exibe nome e e-mail
        const elNome = document.getElementById('master-nome-display');
        const elEmail = document.getElementById('master-email-display');
        if (elNome) elNome.innerText = user.displayName || 'Paulo Augusto';
        if (elEmail) elEmail.innerText = email;

        // Carrega dados iniciais do SaaS
        await carregarPlanosMaster();
        await carregarTodasAsLojasMaster();
        navegarMaster('lojas');
    });
});

// Ação de Login
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
        showToast('Login autorizado! Entrando no portal...', 'success');
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

// ==========================================
// NAVEGAÇÃO ENTRE MÓDULOS (SPA MASTER)
// ==========================================
function navegarMaster(view) {
    viewAtual = view;

    const views = ['lojas', 'planos', 'contratos'];
    views.forEach(v => {
        const elView = document.getElementById(`view-${v}`);
        const elBtn = document.getElementById(`nav-btn-${v}`);
        if (elView) elView.classList.add('hidden');
        if (elBtn) {
            elBtn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 text-slate-300 transition-colors';
        }
    });

    const activeView = document.getElementById(`view-${view}`);
    const activeBtn = document.getElementById(`nav-btn-${view}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all bg-amber-500/15 text-amber-400 border border-amber-500/30';
    }

    // Atualiza cabeçalho
    const elTitulo = document.getElementById('header-titulo-view');
    const elAcoes = document.getElementById('header-acoes-view');

    if (view === 'lojas') {
        if (elTitulo) elTitulo.innerHTML = '<i class="fa-solid fa-chart-pie text-amber-400"></i> Gestão de Lojas & Assinaturas';
        if (elAcoes) {
            elAcoes.innerHTML = `
                <button onclick="carregarTodasAsLojasMaster()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-2">
                    <i class="fa-solid fa-arrows-rotate" id="btn-icon-refresh"></i> Atualizar
                </button>
                <button onclick="abrirModalNovaLoja()" class="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2">
                    <i class="fa-solid fa-plus"></i> Nova Loja
                </button>
            `;
        }
    } else if (view === 'planos') {
        if (elTitulo) elTitulo.innerHTML = '<i class="fa-solid fa-layer-group text-blue-400"></i> Catálogo de Planos do SaaS';
        if (elAcoes) {
            elAcoes.innerHTML = `
                <button onclick="carregarPlanosMaster()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-2">
                    <i class="fa-solid fa-arrows-rotate"></i> Atualizar
                </button>
                <button onclick="abrirModalPlano()" class="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                    <i class="fa-solid fa-plus"></i> Novo Plano
                </button>
            `;
        }
    } else if (view === 'contratos') {
        if (elTitulo) elTitulo.innerHTML = '<i class="fa-solid fa-file-contract text-purple-400"></i> Emissor de Contratos SaaS (A4)';
        if (elAcoes) {
            elAcoes.innerHTML = `
                <button onclick="imprimirContratoA4()" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2">
                    <i class="fa-solid fa-print"></i> Imprimir / PDF
                </button>
            `;
        }
        popularSelectEmpresasContrato();
    }
}
window.navegarMaster = navegarMaster;

// ==========================================
// MÓDULO 1: GESTÃO DE LOJAS & ASSINATURAS
// ==========================================
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

            // Busca dados cadastrais da empresa
            let configEmpresa = {};
            try {
                const cfgDoc = await firebase.firestore().collection('empresas').doc(doc.id).collection('configuracoes').doc('config').get();
                if (cfgDoc.exists && cfgDoc.data().empresa) {
                    configEmpresa = cfgDoc.data().empresa;
                }
            } catch(e) {}
            data.configEmpresa = configEmpresa;

            // Busca dados do responsável / dono
            let donoInfo = { nome: 'Não informado', email: 'Não informado', telefone: '' };
            if (data.donoUid) {
                try {
                    const uDoc = await firebase.firestore().collection('usuarios').doc(data.donoUid).get();
                    if (uDoc.exists) donoInfo = uDoc.data();
                } catch(e) {}
            }
            data.donoInfo = donoInfo;

            // Validação de Vencimento e Valores
            if (!data.dataVencimento) {
                const base = data.dataCriacao && data.dataCriacao.toDate ? data.dataCriacao.toDate() : new Date();
                const v = new Date(base);
                v.setDate(v.getDate() + 30);
                data.dataVencimento = v.toISOString().split('T')[0];
            }

            if (data.valorMensalidade === undefined) {
                data.valorMensalidade = 99.00;
            }

            if (!data.whatsapp) {
                data.whatsapp = configEmpresa.telefone || donoInfo.telefone || '';
            }

            // Credenciais e Chaves de Integração
            data.emailAcesso = data.emailAcesso || donoInfo.email || '';
            data.senhaAcesso = data.senhaAcesso || '';
            data.geminiKey = data.geminiKey || configEmpresa.geminiKey || '';

            // Módulos liberados (se não houver personalização, herda módulos padrão do plano)
            if (!data.modulosLiberados || !Array.isArray(data.modulosLiberados) || data.modulosLiberados.length === 0) {
                const planoObj = listaPlanos.find(p => p.id === data.plano || p.id === 'plano_' + String(data.plano).toLowerCase()) || PLANOS_PADRAO[1];
                data.modulosLiberados = planoObj ? [...planoObj.modulos] : ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site'];
            }

            return data;
        });

        listaLojas = await Promise.all(promessas);
        atualizarKPIsMaster();
        renderizarTabelaLojasMaster();
        popularSelectEmpresasContrato();

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
        const razao = (l.configEmpresa?.nome || '').toLowerCase();
        const cnpj = (l.configEmpresa?.cnpj || l.cnpj || '').toLowerCase();
        const dono = (l.donoInfo?.nome || '').toLowerCase();
        const email = (l.donoInfo?.email || '').toLowerCase();
        const wpp = String(l.whatsapp || '').replace(/\D/g, '');

        const matchBusca = !buscaAtual || nome.includes(buscaAtual) || razao.includes(buscaAtual) || cnpj.includes(buscaAtual) || dono.includes(buscaAtual) || email.includes(buscaAtual) || wpp.includes(buscaAtual);
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
        const razao = loja.configEmpresa?.nome || '';
        const cnpj = loja.configEmpresa?.cnpj || loja.cnpj || '';
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
                    ${razao && razao !== nome ? `<div class="text-xs text-slate-400 truncate max-w-xs">${razao}</div>` : ''}
                    <div class="text-[11px] text-slate-500 font-mono mt-0.5">${cnpj ? 'CNPJ: ' + cnpj : 'ID: ' + loja.id}</div>
                </td>
                <td class="py-4 px-4">
                    <div class="font-semibold text-slate-200">${donoNome}</div>
                    <div class="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                        <i class="fa-solid fa-user text-[10px] text-slate-500"></i>
                        <span>${loja.emailAcesso || donoEmail}</span>
                        ${(loja.emailAcesso || donoEmail) && (loja.emailAcesso || donoEmail) !== 'Sem e-mail' ? `
                            <button onclick="copiarTexto('${loja.emailAcesso || donoEmail}', 'E-mail copiado!')" title="Copiar e-mail" class="text-slate-500 hover:text-amber-400 transition-colors">
                                <i class="fa-solid fa-copy text-[10px]"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="text-xs font-mono text-amber-300/90 flex items-center gap-1.5 mt-1">
                        <i class="fa-solid fa-key text-[10px] text-slate-500"></i>
                        <span id="pass-loja-${loja.id}" data-oculta="true">••••••••</span>
                        <button onclick="toggleVisualizarSenhaLoja('${loja.id}')" title="Ver / Ocultar Senha" class="text-slate-400 hover:text-amber-400 transition-colors">
                            <i class="fa-solid fa-eye text-[11px]" id="olho-loja-${loja.id}"></i>
                        </button>
                        ${loja.senhaAcesso ? `
                            <button onclick="copiarTexto('${loja.senhaAcesso}', 'Senha copiada!')" title="Copiar Senha" class="text-slate-400 hover:text-amber-400 transition-colors">
                                <i class="fa-solid fa-copy text-[11px]"></i>
                            </button>
                        ` : ''}
                        <button onclick="abrirModalRedefinirSenha('${loja.id}')" title="Alterar Senha do Cliente" class="text-[10px] font-sans font-bold bg-slate-800/80 hover:bg-slate-700 text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded border border-slate-700/80 transition-colors ml-1">
                            <i class="fa-solid fa-pen"></i> Alterar
                        </button>
                    </div>
                    ${temWpp ? `<div class="text-xs text-emerald-400 font-medium mt-1"><i class="fa-brands fa-whatsapp"></i> ${wpp}</div>` : ''}
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
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="abrirDossieEmpresa('${loja.id}')" title="Dossiê / Ficha Completa da Empresa" class="w-8 h-8 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center transition-all border border-amber-500/20">
                            <i class="fa-solid fa-id-card text-sm"></i>
                        </button>
                        <button onclick="gerarContratoParaLoja('${loja.id}')" title="Emitir Contrato SaaS" class="w-8 h-8 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 text-purple-400 flex items-center justify-center transition-all border border-purple-500/20">
                            <i class="fa-solid fa-file-contract text-sm"></i>
                        </button>
                        <button onclick="enviarCobrancaWhatsAppMaster('${loja.id}')" title="Cobrança no WhatsApp" class="w-8 h-8 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all border border-emerald-500/20">
                            <i class="fa-brands fa-whatsapp text-base"></i>
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

// ==========================================
// MÓDULO 2: DOSSIÊ COMPLETO DA EMPRESA & GESTÃO DE ACESSO
// ==========================================
let dossieSenhaVisivel = false;

function toggleVisualizarSenhaLoja(lojaId) {
    const el = document.getElementById(`pass-loja-${lojaId}`);
    const icone = document.getElementById(`olho-loja-${lojaId}`);
    const loja = listaLojas.find(l => l.id === lojaId);
    if (!el || !loja) return;

    const isOculta = el.getAttribute('data-oculta') !== 'false';
    if (isOculta) {
        el.innerText = loja.senhaAcesso || '(Não salva)';
        el.setAttribute('data-oculta', 'false');
        if (icone) {
            icone.classList.remove('fa-eye');
            icone.classList.add('fa-eye-slash');
        }
    } else {
        el.innerText = '••••••••';
        el.setAttribute('data-oculta', 'true');
        if (icone) {
            icone.classList.remove('fa-eye-slash');
            icone.classList.add('fa-eye');
        }
    }
}
window.toggleVisualizarSenhaLoja = toggleVisualizarSenhaLoja;

function toggleVisualizarSenhaDossie() {
    dossieSenhaVisivel = !dossieSenhaVisivel;
    const el = document.getElementById('dossie-cred-senha');
    const icone = document.getElementById('dossie-cred-olho');
    if (!el) return;

    if (dossieSenhaVisivel) {
        el.innerText = lojaDossieAtual?.senhaAcesso || '(Não salva)';
        if (icone) {
            icone.classList.remove('fa-eye');
            icone.classList.add('fa-eye-slash');
        }
    } else {
        el.innerText = '••••••••';
        if (icone) {
            icone.classList.remove('fa-eye-slash');
            icone.classList.add('fa-eye');
        }
    }
}
window.toggleVisualizarSenhaDossie = toggleVisualizarSenhaDossie;

function copiarSenhaDossie() {
    if (!lojaDossieAtual || !lojaDossieAtual.senhaAcesso) {
        showToast('Esta loja ainda não possui senha registrada.', 'info');
        return;
    }
    copiarTexto(lojaDossieAtual.senhaAcesso, 'Senha copiada com sucesso!');
}
window.copiarSenhaDossie = copiarSenhaDossie;

function abrirModalRedefinirSenha(empresaId) {
    const targetId = empresaId || (lojaDossieAtual ? lojaDossieAtual.id : null);
    const loja = listaLojas.find(l => l.id === targetId) || lojaDossieAtual;
    if (!loja) return;

    const modal = document.getElementById('modal-redefinir-senha');
    const inputId = document.getElementById('redefinir-empresa-id');
    const txtNome = document.getElementById('redefinir-loja-nome');
    const txtEmail = document.getElementById('redefinir-loja-email');
    const inputSenha = document.getElementById('redefinir-nova-senha');

    if (inputId) inputId.value = loja.id;
    if (txtNome) txtNome.innerText = loja.nomeEmpresa || loja.nome || 'Loja';
    const emailLogin = loja.emailAcesso || loja.donoInfo?.email || '';
    if (txtEmail) txtEmail.innerText = emailLogin;
    if (inputSenha) inputSenha.value = '';

    if (modal) modal.classList.remove('hidden');
}
window.abrirModalRedefinirSenha = abrirModalRedefinirSenha;

function fecharModalRedefinirSenha() {
    const modal = document.getElementById('modal-redefinir-senha');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalRedefinirSenha = fecharModalRedefinirSenha;

function gerarSenhaAleatoria() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const inputSenha = document.getElementById('redefinir-nova-senha');
    if (inputSenha) {
        inputSenha.value = pass;
        inputSenha.focus();
    }
}
window.gerarSenhaAleatoria = gerarSenhaAleatoria;

async function confirmarRedefinirSenhaMaster(e) {
    if (e) e.preventDefault();
    const inputId = document.getElementById('redefinir-empresa-id');
    const inputSenha = document.getElementById('redefinir-nova-senha');
    const btn = document.getElementById('btn-salvar-nova-senha');

    if (!inputId || !inputSenha) return;
    const empresaId = inputId.value;
    const novaSenha = inputSenha.value.trim();

    if (novaSenha.length < 6) {
        showToast('A senha deve conter no mínimo 6 caracteres!', 'error');
        return;
    }

    const loja = listaLojas.find(l => l.id === empresaId);
    if (!loja) return;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...';
        }

        const emailLogin = loja.emailAcesso || loja.donoInfo?.email;
        const senhaAntiga = loja.senhaAcesso;

        // 1. Tentar sincronizar via Firebase Auth secundário caso senha antiga seja conhecida
        if (emailLogin && senhaAntiga) {
            try {
                let secApp;
                try {
                    secApp = firebase.app('SecondaryMaster');
                } catch(e) {
                    secApp = firebase.initializeApp(firebaseConfig, 'SecondaryMaster');
                }
                const cred = await secApp.auth().signInWithEmailAndPassword(emailLogin, senhaAntiga);
                await cred.user.updatePassword(novaSenha);
                await secApp.auth().signOut();
                console.log("Senha sincronizada com Firebase Auth com sucesso!");
            } catch(authErr) {
                console.warn("Aviso ao sincronizar Auth secundário:", authErr);
            }
        }

        // 2. Salva a nova senha na collection empresas/{empresaId}
        await firebase.firestore().collection('empresas').doc(empresaId).set({
            senhaAcesso: novaSenha,
            ultimaAlteracaoSenha: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 3. Atualiza na memória
        loja.senhaAcesso = novaSenha;
        if (lojaDossieAtual && lojaDossieAtual.id === empresaId) {
            lojaDossieAtual.senhaAcesso = novaSenha;
            const credSenha = document.getElementById('dossie-cred-senha');
            if (credSenha && dossieSenhaVisivel) credSenha.innerText = novaSenha;
        }

        fecharModalRedefinirSenha();
        renderizarTabelaLojasMaster();
        showToast(`Senha da loja "${loja.nomeEmpresa || loja.nome}" redefinida com sucesso!`, 'success');

    } catch (err) {
        console.error("Erro ao redefinir senha:", err);
        showToast('Erro ao redefinir senha: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Salvar Nova Senha';
        }
    }
}
window.confirmarRedefinirSenhaMaster = confirmarRedefinirSenhaMaster;

function toggleVerGeminiDossie() {
    const inp = document.getElementById('dossie-emp-gemini-key');
    const icone = document.getElementById('olho-gemini-dossie');
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icone) { icone.classList.remove('fa-eye'); icone.classList.add('fa-eye-slash'); }
    } else {
        inp.type = 'password';
        if (icone) { icone.classList.remove('fa-eye-slash'); icone.classList.add('fa-eye'); }
    }
}
window.toggleVerGeminiDossie = toggleVerGeminiDossie;

function selecionarPlanoNoDossie(planoId) {
    const plano = listaPlanos.find(p => p.id === planoId) || PLANOS_PADRAO.find(p => p.id === planoId || p.id === 'plano_' + String(planoId).toLowerCase());
    if (plano) {
        const inputValor = document.getElementById('dossie-ass-valor');
        if (inputValor && plano.preco !== undefined) {
            inputValor.value = Number(plano.preco).toFixed(2);
        }

        const mods = plano.modulos || ['pdv', 'vendas', 'estoque'];
        const listaMods = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'ia', 'suporte'];
        listaMods.forEach(m => {
            const chk = document.getElementById(`dossie-mod-${m}`);
            if (chk) chk.checked = mods.includes(m);
        });
        showToast(`Módulos padrão do plano "${plano.nome}" aplicados!`, 'info');
    }
}
window.selecionarPlanoNoDossie = selecionarPlanoNoDossie;

async function abrirDossieEmpresa(empresaId) {
    const loja = listaLojas.find(l => l.id === empresaId);
    if (!loja) return;

    lojaDossieAtual = loja;

    // Cabeçalho do modal
    const elTitulo = document.getElementById('dossie-empresa-titulo');
    const elId = document.getElementById('dossie-empresa-id');
    const elBadge = document.getElementById('dossie-empresa-status-badge');
    const inputId = document.getElementById('dossie-input-empresa-id');

    if (elTitulo) elTitulo.innerText = loja.nomeEmpresa || loja.nome || 'Loja Sem Nome';
    if (elId) elId.innerText = `ID: ${loja.id}`;
    if (inputId) inputId.value = loja.id;

    const status = loja.status || 'ATIVO';
    if (elBadge) {
        elBadge.innerText = status;
        elBadge.className = status === 'BLOQUEADO'
            ? 'px-2.5 py-0.5 rounded-full text-xs font-black bg-red-500/15 text-red-400 border border-red-500/30'
            : 'px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    }

    // Card de Credenciais de Acesso
    dossieSenhaVisivel = false;
    const credEmail = document.getElementById('dossie-cred-email');
    const credSenha = document.getElementById('dossie-cred-senha');
    const credOlho = document.getElementById('dossie-cred-olho');
    if (credEmail) credEmail.innerText = loja.emailAcesso || loja.donoInfo?.email || 'Sem login';
    if (credSenha) credSenha.innerText = '••••••••';
    if (credOlho) { credOlho.classList.add('fa-eye'); credOlho.classList.remove('fa-eye-slash'); }

    // Carrega dados fiscais e cadastrais
    const emp = loja.configEmpresa || {};
    document.getElementById('dossie-cad-razao').value = emp.nome || loja.nomeEmpresa || '';
    document.getElementById('dossie-cad-fantasia').value = emp.fantasia || loja.nomeEmpresa || '';
    document.getElementById('dossie-cad-cnpj').value = emp.cnpj || loja.cnpj || '';
    document.getElementById('dossie-cad-ie').value = emp.ie || '';
    document.getElementById('dossie-cad-crt').value = emp.crt || '1';
    document.getElementById('dossie-cad-cep').value = emp.cep || '';
    document.getElementById('dossie-cad-rua').value = emp.rua || '';
    document.getElementById('dossie-cad-numero').value = emp.numero || '';
    document.getElementById('dossie-cad-bairro').value = emp.bairro || '';
    document.getElementById('dossie-cad-cidade').value = emp.cidade || '';
    document.getElementById('dossie-cad-uf').value = emp.uf || 'GO';
    document.getElementById('dossie-cad-whatsapp').value = loja.whatsapp || emp.telefone || '';
    document.getElementById('dossie-cad-telefone').value = emp.telefone || '';

    // Carrega dados da assinatura
    atualizarSelectsDePlanos();
    let planoId = loja.plano || 'plano_pro';
    if (!listaPlanos.some(p => p.id === planoId)) {
        const match = listaPlanos.find(p => p.id.toLowerCase() === planoId.toLowerCase() || p.id.toLowerCase() === ('plano_' + planoId.toLowerCase()));
        if (match) planoId = match.id;
        else if (listaPlanos.length > 0) planoId = listaPlanos[0].id;
    }
    document.getElementById('dossie-ass-plano').value = planoId;
    document.getElementById('dossie-ass-valor').value = loja.valorMensalidade !== undefined ? loja.valorMensalidade : 99.00;
    document.getElementById('dossie-ass-vencimento').value = loja.dataVencimento || '';
    document.getElementById('dossie-ass-status').value = status;

    // Carrega Módulos Liberados de Verdade
    const modulosPadrao = (listaPlanos.find(p => p.id === planoId) || PLANOS_PADRAO[1])?.modulos || ['pdv', 'vendas', 'fiscal', 'estoque'];
    const modulosAtivos = Array.isArray(loja.modulosLiberados) && loja.modulosLiberados.length > 0 ? loja.modulosLiberados : modulosPadrao;
    const listaMods = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'ia', 'suporte'];
    listaMods.forEach(m => {
        const chk = document.getElementById(`dossie-mod-${m}`);
        if (chk) chk.checked = modulosAtivos.includes(m);
    });

    // Carrega Chave Gemini Individual da Loja
    const inpGemini = document.getElementById('dossie-emp-gemini-key');
    if (inpGemini) {
        inpGemini.value = loja.geminiKey || emp.geminiKey || '';
        inpGemini.type = 'password';
        const olhoG = document.getElementById('olho-gemini-dossie');
        if (olhoG) { olhoG.classList.add('fa-eye'); olhoG.classList.remove('fa-eye-slash'); }
    }

    // Abre na primeira aba
    trocarAbaDossie('cadastral');

    // Carrega lista de funcionários
    await carregarUsuariosDossie(loja.id);

    const modal = document.getElementById('modal-dossie-empresa');
    if (modal) modal.classList.remove('hidden');
}
window.abrirDossieEmpresa = abrirDossieEmpresa;

function fecharModalDossie() {
    const modal = document.getElementById('modal-dossie-empresa');
    if (modal) modal.classList.add('hidden');
    lojaDossieAtual = null;
}
window.fecharModalDossie = fecharModalDossie;

function trocarAbaDossie(aba) {
    const abas = ['cadastral', 'assinatura', 'usuarios', 'contrato'];
    abas.forEach(a => {
        const div = document.getElementById(`dossie-aba-${a}`);
        const btn = document.getElementById(`tab-btn-${a}`);
        if (div) div.classList.add('hidden');
        if (btn) {
            btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all';
        }
    });

    const divAtiva = document.getElementById(`dossie-aba-${aba}`);
    const btnAtivo = document.getElementById(`tab-btn-${aba}`);
    if (divAtiva) divAtiva.classList.remove('hidden');
    if (btnAtivo) {
        btnAtivo.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-amber-500 text-slate-950 shadow-sm';
    }
}
window.trocarAbaDossie = trocarAbaDossie;

// Salvar dados cadastrais e fiscais da empresa
async function salvarDadosCadastraisEmpresa(e) {
    if (e) e.preventDefault();
    if (!lojaDossieAtual) return;

    const id = lojaDossieAtual.id;
    const razao = document.getElementById('dossie-cad-razao').value.trim();
    const fantasia = document.getElementById('dossie-cad-fantasia').value.trim();
    const cnpj = document.getElementById('dossie-cad-cnpj').value.trim();
    const ie = document.getElementById('dossie-cad-ie').value.trim();
    const crt = document.getElementById('dossie-cad-crt').value;
    const cep = document.getElementById('dossie-cad-cep').value.trim();
    const rua = document.getElementById('dossie-cad-rua').value.trim();
    const numero = document.getElementById('dossie-cad-numero').value.trim();
    const bairro = document.getElementById('dossie-cad-bairro').value.trim();
    const cidade = document.getElementById('dossie-cad-cidade').value.trim();
    const uf = document.getElementById('dossie-cad-uf').value.trim().toUpperCase();
    const wpp = document.getElementById('dossie-cad-whatsapp').value.trim();
    const tel = document.getElementById('dossie-cad-telefone').value.trim();

    try {
        const empDados = {
            nome: razao,
            fantasia: fantasia,
            cnpj: cnpj,
            ie: ie,
            crt: crt,
            cep: cep,
            rua: rua,
            numero: numero,
            bairro: bairro,
            cidade: cidade,
            uf: uf,
            telefone: tel || wpp
        };

        const db = firebase.firestore();
        const batch = db.batch();

        // 1. Atualiza no doc principal da empresa
        batch.set(db.collection('empresas').doc(id), {
            nomeEmpresa: fantasia || razao,
            whatsapp: wpp,
            cnpj: cnpj,
            ultimaAtualizacaoMaster: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. Atualiza nas configurações da empresa
        batch.set(db.collection('empresas').doc(id).collection('configuracoes').doc('config'), {
            empresa: empDados
        }, { merge: true });

        await batch.commit();

        // Atualiza memória
        lojaDossieAtual.nomeEmpresa = fantasia || razao;
        lojaDossieAtual.whatsapp = wpp;
        lojaDossieAtual.cnpj = cnpj;
        lojaDossieAtual.configEmpresa = empDados;

        atualizarKPIsMaster();
        renderizarTabelaLojasMaster();
        showToast('Dados cadastrais da empresa salvos com sucesso!', 'success');

    } catch (err) {
        console.error("Erro ao salvar cadastro:", err);
        showToast('Erro ao salvar: ' + err.message, 'error');
    }
}
window.salvarDadosCadastraisEmpresa = salvarDadosCadastraisEmpresa;

// Salvar assinatura pelo dossiê
async function salvarAssinaturaPeloDossie(e) {
    if (e) e.preventDefault();
    if (!lojaDossieAtual) return;

    const id = lojaDossieAtual.id;
    const plano = document.getElementById('dossie-ass-plano').value;
    const valor = parseFloat(document.getElementById('dossie-ass-valor').value) || 0;
    const venc = document.getElementById('dossie-ass-vencimento').value;
    const status = document.getElementById('dossie-ass-status').value;

    const listaMods = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'ia', 'suporte'];
    const modulosLiberados = listaMods.filter(m => document.getElementById(`dossie-mod-${m}`)?.checked);
    const geminiKey = document.getElementById('dossie-emp-gemini-key')?.value.trim() || '';

    try {
        const db = firebase.firestore();
        const batch = db.batch();

        // 1. Grava no documento da empresa
        batch.set(db.collection('empresas').doc(id), {
            plano: plano,
            valorMensalidade: valor,
            dataVencimento: venc,
            status: status,
            modulosLiberados: modulosLiberados,
            geminiKey: geminiKey,
            ultimaAtualizacaoMaster: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. Sincroniza geminiKey nas configurações internas da empresa
        batch.set(db.collection('empresas').doc(id).collection('configuracoes').doc('config'), {
            empresa: {
                geminiKey: geminiKey
            }
        }, { merge: true });

        await batch.commit();

        lojaDossieAtual.plano = plano;
        lojaDossieAtual.valorMensalidade = valor;
        lojaDossieAtual.dataVencimento = venc;
        lojaDossieAtual.status = status;
        lojaDossieAtual.modulosLiberados = modulosLiberados;
        lojaDossieAtual.geminiKey = geminiKey;
        if (!lojaDossieAtual.configEmpresa) lojaDossieAtual.configEmpresa = {};
        lojaDossieAtual.configEmpresa.geminiKey = geminiKey;

        // Atualiza na lista de lojas
        const idx = listaLojas.findIndex(l => l.id === id);
        if (idx >= 0) {
            listaLojas[idx] = { ...lojaDossieAtual };
        }

        const elBadge = document.getElementById('dossie-empresa-status-badge');
        if (elBadge) {
            elBadge.innerText = status;
            elBadge.className = status === 'BLOQUEADO'
                ? 'px-2.5 py-0.5 rounded-full text-xs font-black bg-red-500/15 text-red-400 border border-red-500/30'
                : 'px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
        }

        atualizarKPIsMaster();
        renderizarTabelaLojasMaster();
        showToast('Assinatura e permissões da loja salvas com sucesso!', 'success');

    } catch (err) {
        console.error("Erro ao salvar assinatura:", err);
        showToast('Erro: ' + err.message, 'error');
    }
}
window.salvarAssinaturaPeloDossie = salvarAssinaturaPeloDossie;

// Carregar equipe/usuários da empresa
async function carregarUsuariosDossie(empresaId) {
    const corpo = document.getElementById('dossie-lista-usuarios-corpo');
    const badgeQtd = document.getElementById('dossie-qtd-usuarios');
    if (!corpo) return;

    try {
        const snap = await firebase.firestore().collection('empresas').doc(empresaId).collection('funcionarios').get();
        const usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (badgeQtd) badgeQtd.innerText = usuarios.length;

        if (usuarios.length === 0) {
            corpo.innerHTML = `
                <tr>
                    <td colspan="4" class="py-6 text-center text-slate-500">
                        Nenhum colaborador adicional cadastrado nesta loja.
                    </td>
                </tr>
            `;
            return;
        }

        corpo.innerHTML = usuarios.map(u => {
            const isAdmin = u.isAdmin === true || u.isAdmin === 'true';
            return `
                <tr class="hover:bg-slate-800/40">
                    <td class="py-2.5 px-3 font-bold text-white">${u.nome || 'Sem Nome'}</td>
                    <td class="py-2.5 px-3 font-mono text-slate-300">${u.email || 'Sem E-mail'}</td>
                    <td class="py-2.5 px-3">
                        ${isAdmin ? '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">Admin</span>' : '<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Colaborador</span>'}
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        <span class="text-emerald-400 font-bold">● Ativo</span>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Erro ao carregar usuários:", err);
        corpo.innerHTML = `
            <tr>
                <td colspan="4" class="py-4 text-center text-red-400">
                    Não foi possível carregar a equipe: ${err.message}
                </td>
            </tr>
        `;
    }
}

function irParaContratosDaEmpresa() {
    if (!lojaDossieAtual) return;
    const id = lojaDossieAtual.id;
    fecharModalDossie();
    gerarContratoParaLoja(id);
}
window.irParaContratosDaEmpresa = irParaContratosDaEmpresa;

// ==========================================
// MÓDULO 3: GESTÃO DE PLANOS DO SAAS
// ==========================================
const PLANOS_PADRAO = [
    {
        id: 'plano_start',
        nome: 'Start (Frente de Caixa)',
        preco: 59.90,
        ciclo: 'mensal',
        usuarios: 'Até 2 Usuários',
        produtos: 'Até 500 Produtos',
        descricao: 'Perfeito para pequenos negócios que precisam de agilidade no caixa e vendas rápidas.',
        modulos: ['pdv', 'vendas', 'estoque', 'suporte'],
        destaque: false,
        ativo: true
    },
    {
        id: 'plano_pro',
        nome: 'Profissional (Gestão Completa)',
        preco: 99.90,
        ciclo: 'mensal',
        usuarios: 'Até 5 Usuários',
        produtos: 'Produtos Ilimitados',
        descricao: 'Gestão completa com emissão fiscal (NF-e/NFC-e), financeiro avançado e catálogo online.',
        modulos: ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'suporte'],
        destaque: true,
        ativo: true
    },
    {
        id: 'plano_enterprise',
        nome: 'Enterprise (Ilimitado + IA)',
        preco: 179.90,
        ciclo: 'mensal',
        usuarios: 'Usuários Ilimitados',
        produtos: 'Produtos Ilimitados',
        descricao: 'A suíte definitiva com relatórios de IA Gemini, multi-acesso liberado e suporte dedicado VIP.',
        modulos: ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'ia', 'suporte'],
        destaque: false,
        ativo: true
    }
];

async function carregarPlanosMaster() {
    try {
        const snap = await firebase.firestore().collection('planos_saas').get();
        if (snap.empty) {
            // Inicializa planos padrão no banco
            const batch = firebase.firestore().batch();
            PLANOS_PADRAO.forEach(p => {
                const ref = firebase.firestore().collection('planos_saas').doc(p.id);
                batch.set(ref, p);
            });
            await batch.commit();
            listaPlanos = [...PLANOS_PADRAO];
        } else {
            listaPlanos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        renderizarGridPlanosMaster();
        atualizarSelectsDePlanos();

    } catch (err) {
        console.error("Erro ao carregar planos:", err);
        listaPlanos = [...PLANOS_PADRAO];
        renderizarGridPlanosMaster();
        atualizarSelectsDePlanos();
    }
}
window.carregarPlanosMaster = carregarPlanosMaster;

function renderizarGridPlanosMaster() {
    const grid = document.getElementById('grid-planos');
    if (!grid) return;

    if (listaPlanos.length === 0) {
        grid.innerHTML = `
            <div class="col-span-3 text-center py-16 text-slate-500">
                <i class="fa-solid fa-layer-group text-4xl mb-3"></i>
                <p>Nenhum plano cadastrado. Clique no botão "+ Novo Plano" para criar.</p>
            </div>
        `;
        return;
    }

    const nomesModulos = {
        pdv: 'Frente de Caixa (PDV)',
        vendas: 'Vendas & Orçamentos',
        fiscal: 'Emissor NF-e / NFC-e',
        estoque: 'Controle de Estoque & Kardex',
        financeiro: 'Financeiro & Fluxo de Caixa',
        site: 'Loja / Catálogo Online',
        ia: 'Relatórios IA Gemini',
        suporte: 'Suporte WhatsApp VIP'
    };

    grid.innerHTML = listaPlanos.map(plano => {
        const valorFmt = Number(plano.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const mods = plano.modulos || [];

        return `
            <div class="bg-[#0f172a] rounded-3xl p-6 border ${plano.destaque ? 'border-amber-500/50 shadow-amber-500/10' : 'border-slate-800'} shadow-2xl flex flex-col justify-between relative overflow-hidden">
                ${plano.destaque ? `
                    <div class="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-lg">
                        Mais Popular
                    </div>
                ` : ''}

                <div>
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <h4 class="text-xl font-extrabold text-white">${plano.nome}</h4>
                        ${plano.ativo !== false ? '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Ativo</span>' : '<span class="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">Inativo</span>'}
                    </div>

                    <p class="text-xs text-slate-400 mb-5 min-h-[32px]">${plano.descricao || ''}</p>

                    <div class="mb-6 flex items-baseline gap-1.5">
                        <span class="text-4xl font-black text-white">${valorFmt}</span>
                        <span class="text-xs font-semibold text-slate-400">/${plano.ciclo || 'mês'}</span>
                    </div>

                    <div class="space-y-2 py-4 border-y border-slate-800 text-xs">
                        <div class="flex items-center gap-2 font-bold text-slate-200">
                            <i class="fa-solid fa-users text-blue-400 w-4 text-center"></i> ${plano.usuarios || 'Usuários Ilimitados'}
                        </div>
                        <div class="flex items-center gap-2 font-bold text-slate-200">
                            <i class="fa-solid fa-boxes-stacked text-purple-400 w-4 text-center"></i> ${plano.produtos || 'Produtos Ilimitados'}
                        </div>
                    </div>

                    <div class="py-4 space-y-2">
                        <p class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Módulos Inclusos:</p>
                        <ul class="space-y-1.5 text-xs text-slate-300">
                            ${Object.keys(nomesModulos).map(modKey => {
                                const tem = mods.includes(modKey);
                                return `
                                    <li class="flex items-center gap-2 ${tem ? 'text-slate-200' : 'text-slate-600 line-through'}">
                                        <i class="fa-solid ${tem ? 'fa-check text-emerald-400' : 'fa-xmark text-slate-600'} text-xs w-4 text-center"></i>
                                        ${nomesModulos[modKey]}
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>
                </div>

                <div class="pt-5 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button onclick="editarPlanoMaster('${plano.id}')" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    <button onclick="excluirPlanoMaster('${plano.id}')" class="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 flex items-center justify-center transition-all">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function atualizarSelectsDePlanos() {
    const selects = ['dossie-ass-plano', 'nova-loja-plano'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;

        const valAtual = sel.value;
        sel.innerHTML = listaPlanos.map(p => {
            const preco = Number(p.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return `<option value="${p.id}">${p.nome} (${preco})</option>`;
        }).join('');

        if (valAtual && listaPlanos.some(p => p.id === valAtual)) {
            sel.value = valAtual;
        } else if (listaPlanos.length > 0) {
            sel.value = listaPlanos[0].id;
        }
    });
}

function atualizarValorPorPlanoSelecionado(planoId, targetInputId) {
    const input = document.getElementById(targetInputId);
    if (!input) return;

    const p = listaPlanos.find(x => x.id === planoId);
    if (p && p.preco !== undefined) {
        input.value = Number(p.preco).toFixed(2);
    }
}
window.atualizarValorPorPlanoSelecionado = atualizarValorPorPlanoSelecionado;

function abrirModalPlano(plano = null) {
    const modal = document.getElementById('modal-plano');
    const titulo = document.getElementById('modal-plano-titulo');
    if (!modal) return;

    document.getElementById('plano-form-id').value = plano ? plano.id : '';
    document.getElementById('plano-form-nome').value = plano ? plano.nome : '';
    document.getElementById('plano-form-preco').value = plano ? plano.preco : '';
    document.getElementById('plano-form-ciclo').value = plano ? (plano.ciclo || 'mensal') : 'mensal';
    document.getElementById('plano-form-usuarios').value = plano ? (plano.usuarios || '') : '5 Usuários';
    document.getElementById('plano-form-produtos').value = plano ? (plano.produtos || '') : 'Ilimitado';
    document.getElementById('plano-form-desc').value = plano ? (plano.descricao || '') : '';
    document.getElementById('plano-form-destaque').checked = plano ? Boolean(plano.destaque) : false;
    document.getElementById('plano-form-ativo').checked = plano ? (plano.ativo !== false) : true;

    const mods = plano ? (plano.modulos || []) : ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'suporte'];
    const chkKeys = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'ia', 'suporte'];
    chkKeys.forEach(k => {
        const el = document.getElementById(`mod-${k}`);
        if (el) el.checked = mods.includes(k);
    });

    if (titulo) {
        titulo.innerHTML = plano ? '<i class="fa-solid fa-pen-to-square text-blue-400"></i> Editar Plano SaaS' : '<i class="fa-solid fa-layer-group text-blue-400"></i> Cadastrar Novo Plano';
    }

    modal.classList.remove('hidden');
}
window.abrirModalPlano = abrirModalPlano;

function fecharModalPlano() {
    const modal = document.getElementById('modal-plano');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalPlano = fecharModalPlano;

function editarPlanoMaster(planoId) {
    const p = listaPlanos.find(x => x.id === planoId);
    if (p) abrirModalPlano(p);
}
window.editarPlanoMaster = editarPlanoMaster;

async function salvarPlanoMaster(e) {
    if (e) e.preventDefault();

    let id = document.getElementById('plano-form-id').value;
    const nome = document.getElementById('plano-form-nome').value.trim();
    const preco = parseFloat(document.getElementById('plano-form-preco').value) || 0;
    const ciclo = document.getElementById('plano-form-ciclo').value;
    const usuarios = document.getElementById('plano-form-usuarios').value.trim();
    const produtos = document.getElementById('plano-form-produtos').value.trim();
    const desc = document.getElementById('plano-form-desc').value.trim();
    const destaque = document.getElementById('plano-form-destaque').checked;
    const ativo = document.getElementById('plano-form-ativo').checked;

    const modulos = [];
    const chkKeys = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site', 'ia', 'suporte'];
    chkKeys.forEach(k => {
        const el = document.getElementById(`mod-${k}`);
        if (el && el.checked) modulos.push(k);
    });

    if (!id) {
        id = 'plano_' + Date.now().toString(36);
    }

    const payload = {
        id: id,
        nome: nome,
        preco: preco,
        ciclo: ciclo,
        usuarios: usuarios,
        produtos: produtos,
        descricao: desc,
        modulos: modulos,
        destaque: destaque,
        ativo: ativo,
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await firebase.firestore().collection('planos_saas').doc(id).set(payload, { merge: true });

        const idx = listaPlanos.findIndex(x => x.id === id);
        if (idx !== -1) listaPlanos[idx] = payload;
        else listaPlanos.push(payload);

        fecharModalPlano();
        renderizarGridPlanosMaster();
        atualizarSelectsDePlanos();
        showToast('Plano salvo com sucesso!', 'success');

    } catch (err) {
        console.error("Erro ao salvar plano:", err);
        showToast('Erro ao salvar plano: ' + err.message, 'error');
    }
}
window.salvarPlanoMaster = salvarPlanoMaster;

async function excluirPlanoMaster(planoId) {
    const p = listaPlanos.find(x => x.id === planoId);
    if (!p) return;

    if (!confirm(`Tem certeza que deseja excluir o plano "${p.nome}"?`)) return;

    try {
        await firebase.firestore().collection('planos_saas').doc(planoId).delete();
        listaPlanos = listaPlanos.filter(x => x.id !== planoId);
        renderizarGridPlanosMaster();
        atualizarSelectsDePlanos();
        showToast('Plano excluído com sucesso!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir: ' + err.message, 'error');
    }
}
window.excluirPlanoMaster = excluirPlanoMaster;

// ==========================================
// MÓDULO 4: CONTRATOS & TERMOS (A4 JURÍDICO)
// ==========================================
function popularSelectEmpresasContrato() {
    const sel = document.getElementById('contrato-select-empresa');
    if (!sel) return;

    const valAtual = sel.value;
    sel.innerHTML = '<option value="">Selecione uma empresa...</option>' + listaLojas.map(l => {
        const nome = l.nomeEmpresa || l.nome || 'Loja';
        const doc = l.configEmpresa?.cnpj || l.cnpj || l.id;
        return `<option value="${l.id}">${nome} (${doc})</option>`;
    }).join('');

    if (valAtual && listaLojas.some(l => l.id === valAtual)) {
        sel.value = valAtual;
    }
}

function gerarContratoParaLoja(empresaId) {
    navegarMaster('contratos');
    const sel = document.getElementById('contrato-select-empresa');
    if (sel) {
        sel.value = empresaId;
        selecionarEmpresaParaContrato();
    }
}
window.gerarContratoParaLoja = gerarContratoParaLoja;

function selecionarEmpresaParaContrato() {
    const sel = document.getElementById('contrato-select-empresa');
    const container = document.getElementById('area-impressao-contrato');
    if (!sel || !container) return;

    const empresaId = sel.value;
    if (!empresaId) {
        container.innerHTML = `
            <div class="text-center py-16 text-slate-400 font-sans">
                <i class="fa-solid fa-file-contract text-4xl text-slate-300 mb-3"></i>
                <p class="text-base font-medium text-slate-600">Selecione uma empresa acima para visualizar e gerar o contrato formal de prestação de serviços SaaS.</p>
            </div>
        `;
        return;
    }

    const loja = listaLojas.find(l => l.id === empresaId);
    if (!loja) return;

    const emp = loja.configEmpresa || {};
    const razaoSocial = emp.nome || loja.nomeEmpresa || 'EMPRESA CONTRATANTE';
    const nomeFantasia = emp.fantasia || loja.nomeEmpresa || razaoSocial;
    const cnpj = emp.cnpj || loja.cnpj || '00.000.000/0000-00';
    const ie = emp.ie || 'ISENTO';
    const endereco = `${emp.rua || 'Logradouro'}, Nº ${emp.numero || 'S/N'}, ${emp.bairro || 'Bairro'}, ${emp.cidade || 'Cidade'} - ${emp.uf || 'GO'}, CEP: ${emp.cep || '74000-000'}`;
    const responsavel = loja.donoInfo?.nome || 'Representante Legal';
    const emailDono = loja.donoInfo?.email || 'contato@empresa.com';
    const whatsapp = loja.whatsapp || emp.telefone || '(00) 00000-0000';

    const planoKey = loja.plano || 'PRO';
    const planoObj = listaPlanos.find(p => p.id === planoKey || p.nome.toUpperCase().includes(planoKey.toUpperCase())) || { nome: planoKey, ciclo: 'mensal', usuarios: '5 Usuários', produtos: 'Ilimitado' };
    const valorNum = Number(loja.valorMensalidade || 99.00);
    const valorFmt = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataVenc = formatarDataBr(loja.dataVencimento);
    const diaVenc = loja.dataVencimento ? loja.dataVencimento.split('-')[2] : '10';

    // Data de emissão por extenso
    const hoje = new Date();
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

    container.innerHTML = `
        <div class="space-y-6 text-justify">
            <!-- CABEÇALHO DO CONTRATO -->
            <div class="text-center border-b-2 border-slate-900 pb-4">
                <h1 class="text-lg md:text-xl font-bold uppercase tracking-wider">CONTRATO DE LICENÇA DE USO DE SOFTWARE (SaaS) E PRESTAÇÃO DE SERVIÇOS</h1>
                <p class="text-xs uppercase text-slate-600 mt-1 font-sans">Instrumento Particular de Contratação Tecnológica e Gestão Empresarial</p>
            </div>

            <!-- PARTES -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">1. DAS PARTES CONTRATANTES</h2>
                <p class="mb-2">
                    <strong>CONTRATADA:</strong> <strong>PAULO AUGUSTO SILVA BORGES / SAAS MASTER TECNOLOGIA</strong>, com sede e foro na Comarca de Goiânia - GO, titular e desenvolvedor da plataforma em nuvem, contato administrativo e chave PIX: <strong>pauloaugusto.silvaborges@gmail.com</strong>.
                </p>
                <p>
                    <strong>CONTRATANTE:</strong> <strong>${razaoSocial}</strong> (Nome Fantasia: <em>${nomeFantasia}</em>), inscrita no CNPJ/CPF sob nº <strong>${cnpj}</strong>, Inscrição Estadual: <strong>${ie}</strong>, com sede em: <strong>${endereco}</strong>, neste ato representada por <strong>${responsavel}</strong>, e-mail: <strong>${emailDono}</strong>, WhatsApp: <strong>${whatsapp}</strong>.
                </p>
            </div>

            <!-- OBJETO -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">2. CLÁUSULA PRIMEIRA - DO OBJETO</h2>
                <p>
                    O presente instrumento tem como objeto a concessão, pela CONTRATADA à CONTRATANTE, de licença temporária, intransferível e não exclusiva de uso da plataforma web de gestão empresarial e operacional <strong>SaaS Master / FC Gestão</strong>, incluindo armazenamento em nuvem, módulos contratados, manutenção preventiva e atualizações contínuas.
                </p>
            </div>

            <!-- PLANO E RECURSOS -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">3. CLÁUSULA SEGUNDA - DO PLANO E RECURSOS CONTRATADOS</h2>
                <p>
                    A CONTRATANTE adere expressamente ao <strong>PLANO ${planoObj.nome.toUpperCase()}</strong>, contemplando:
                </p>
                <ul class="list-disc pl-6 my-2 space-y-1 font-sans text-xs">
                    <li>Acesso operacional via web em computadores, tablets e smartphones;</li>
                    <li>Capacidade de usuários autorizados: <strong>${planoObj.usuarios || 'Conforme especificação do plano'}</strong>;</li>
                    <li>Limite de produtos e cadastros: <strong>${planoObj.produtos || 'Ilimitado'}</strong>;</li>
                    <li>Módulos inclusos: Frente de Caixa (PDV), Emissão Fiscal (NF-e/NFC-e), Gestão Financeira, Estoque e Catálogo Digital.</li>
                </ul>
            </div>

            <!-- PREÇO E PAGAMENTO -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">4. CLÁUSULA TERCEIRA - DO PREÇO E FORMA DE PAGAMENTO</h2>
                <p>
                    Pela prestação dos serviços e licença de uso, a CONTRATANTE pagará à CONTRATADA o valor mensal fixo de <strong>${valorFmt} (${valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</strong>.
                </p>
                <p class="mt-1">
                    <strong>Parágrafo Primeiro:</strong> O vencimento da mensalidade ocorrerá todo <strong>dia ${diaVenc}</strong> de cada mês, sendo o pagamento realizado preferencialmente via <strong>PIX para a chave: pauloaugusto.silvaborges@gmail.com</strong>.
                </p>
            </div>

            <!-- INADIMPLÊNCIA E BLOQUEIO -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">5. CLÁUSULA QUARTA - DA SUSPENSÃO POR INADIMPLÊNCIA</h2>
                <p>
                    O não pagamento da mensalidade no vencimento sujeitará a CONTRATANTE a aviso preventivo de cobrança. Ultrapassado o prazo de <strong>10 (dez) dias corridos de tolerância</strong>, a CONTRATADA reserva-se o direito de suspender temporariamente o acesso de todos os logins da empresa ao sistema, mantendo os dados preservados em segurança até a devida regularização financeira.
                </p>
            </div>

            <!-- DISPONIBILIDADE E SUPORTE -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">6. CLÁUSULA QUINTA - DO NÍVEL DE SERVIÇO (SLA) E SUPORTE</h2>
                <p>
                    A CONTRATADA assegura a disponibilidade média da plataforma de 99,0% ao mês, bem como rotinas diárias de backup de segurança em servidores de alta confiabilidade. O suporte técnico é prestado em horário comercial via WhatsApp e canais digitais.
                </p>
            </div>

            <!-- LGPD E CONFIDENCIALIDADE -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">7. CLÁUSULA SEXTA - DA PROTEÇÃO DE DADOS (LGPD)</h2>
                <p>
                    As partes comprometem-se ao cumprimento irrestrito da Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018). Todas as informações financeiras, fiscais e de clientes cadastradas pela CONTRATANTE são de sua exclusiva titularidade e confidencialidade.
                </p>
            </div>

            <!-- VIGÊNCIA E RESCISÃO -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">8. CLÁUSULA SÉTIMA - DA VIGÊNCIA E RESCISÃO</h2>
                <p>
                    O presente contrato vigora por prazo indeterminado. Qualquer das partes poderá rescindi-lo a qualquer momento, sem imposição de multa rescisória, mediante aviso prévio e formal por escrito com antecedência mínima de 30 (trinta) dias.
                </p>
            </div>

            <!-- FORO -->
            <div>
                <h2 class="font-bold uppercase text-sm border-b border-slate-300 pb-1 mb-2">9. CLÁUSULA OITAVA - DO FORO</h2>
                <p>
                    Para dirimir quaisquer controvérsias oriundas deste instrumento, as partes elegem o Foro da Comarca de Goiânia, Estado de Goiás, com renúncia expressa a qualquer outro.
                </p>
            </div>

            <!-- DATA E ASSINATURAS -->
            <div class="pt-6 border-t border-slate-300 text-center font-sans space-y-8">
                <p class="font-semibold text-slate-800">Goiânia - GO, ${dataExtenso}.</p>

                <div class="grid grid-cols-2 gap-8 pt-8">
                    <div>
                        <div class="border-t-2 border-slate-900 mx-auto w-4/5 pt-1"></div>
                        <p class="font-bold text-xs uppercase">PAULO AUGUSTO SILVA BORGES</p>
                        <p class="text-[10px] text-slate-600">CONTRATADA (SaaS Master Tecnologia)</p>
                    </div>
                    <div>
                        <div class="border-t-2 border-slate-900 mx-auto w-4/5 pt-1"></div>
                        <p class="font-bold text-xs uppercase">${responsavel}</p>
                        <p class="text-[10px] text-slate-600">CONTRATANTE (${nomeFantasia})</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-8 pt-4 text-[10px] text-slate-500">
                    <div>Testemunha 1: ____________________________</div>
                    <div>Testemunha 2: ____________________________</div>
                </div>
            </div>
        </div>
    `;
}
window.selecionarEmpresaParaContrato = selecionarEmpresaParaContrato;

// Disparo de Impressão / PDF do Contrato (A4 nativo)
function imprimirContratoA4() {
    const sel = document.getElementById('contrato-select-empresa');
    if (!sel || !sel.value) {
        showToast('Selecione uma empresa antes de imprimir o contrato.', 'info');
        return;
    }
    window.print();
}
window.imprimirContratoA4 = imprimirContratoA4;

// Enviar Contrato no WhatsApp do Cliente
function enviarContratoWhatsApp() {
    const sel = document.getElementById('contrato-select-empresa');
    if (!sel || !sel.value) {
        showToast('Selecione uma empresa primeiro.', 'info');
        return;
    }

    const loja = listaLojas.find(l => l.id === sel.value);
    if (!loja) return;

    let wpp = loja.whatsapp || '';
    let wppLimpo = String(wpp).replace(/\D/g, '');

    if (!wppLimpo || wppLimpo.length < 10) {
        wpp = prompt('Informe o WhatsApp do cliente para enviar o termo (DDD + número):', wpp);
        if (!wpp) return;
        wppLimpo = String(wpp).replace(/\D/g, '');
    }

    if (wppLimpo.length === 10 || wppLimpo.length === 11) {
        wppLimpo = '55' + wppLimpo;
    }

    const nomeLoja = loja.nomeEmpresa || loja.nome || 'Loja';
    const plano = loja.plano || 'PRO';
    const valor = Number(loja.valorMensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const msg = `Olá! Segue o resumo do *Termo de Adesão e Licença de Uso SaaS* da sua empresa *${nomeLoja}*:\n\n` +
        `📦 *Plano Contratado:* ${plano}\n` +
        `💰 *Valor da Mensalidade:* ${valor}\n` +
        `🔑 *Chave PIX Oficial:* pauloaugusto.silvaborges@gmail.com\n` +
        `📄 *Status do Acesso:* 🟢 Liberado\n\n` +
        `O seu contrato formal de prestação de serviços foi emitido pelo nosso sistema e encontra-se registrado. Qualquer dúvida jurídica ou operacional estamos à disposição!`;

    window.open(`https://wa.me/${wppLimpo}?text=${encodeURIComponent(msg)}`, '_blank');
}
window.enviarContratoWhatsApp = enviarContratoWhatsApp;

// Copiar texto puro do contrato
function copiarTextoContrato() {
    const container = document.getElementById('area-impressao-contrato');
    if (!container) return;

    const texto = container.innerText;
    navigator.clipboard.writeText(texto).then(() => {
        showToast('Texto do contrato copiado para a área de transferência!', 'success');
    }).catch(() => {
        showToast('Erro ao copiar texto.', 'error');
    });
}
window.copiarTextoContrato = copiarTextoContrato;

// ==========================================
// MÓDULO 5: CADASTRO MANUAL DE NOVA LOJA
// ==========================================
function abrirModalNovaLoja() {
    atualizarSelectsDePlanos();
    const modal = document.getElementById('modal-nova-loja');
    if (modal) modal.classList.remove('hidden');
}
window.abrirModalNovaLoja = abrirModalNovaLoja;

function fecharModalNovaLoja() {
    const modal = document.getElementById('modal-nova-loja');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalNovaLoja = fecharModalNovaLoja;

async function cadastrarLojaManual(e) {
    if (e) e.preventDefault();

    const nome = document.getElementById('nova-loja-nome').value.trim();
    const email = document.getElementById('nova-loja-email').value.trim().toLowerCase();
    const senha = document.getElementById('nova-loja-senha').value;
    const wpp = document.getElementById('nova-loja-whatsapp').value.trim();
    const plano = document.getElementById('nova-loja-plano').value || 'plano_pro';
    const valor = parseFloat(document.getElementById('nova-loja-valor').value) || 99.00;
    const cnpj = document.getElementById('nova-loja-cnpj').value.trim();
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
        const planoObj = listaPlanos.find(p => p.id === plano || p.id === 'plano_' + String(plano).toLowerCase()) || PLANOS_PADRAO[1];
        const modsIniciais = planoObj.modulos || ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'site'];

        batch.set(db.collection('empresas').doc(empresaId), {
            nomeEmpresa: nome,
            donoUid: uid,
            whatsapp: wpp,
            cnpj: cnpj,
            plano: plano,
            valorMensalidade: valor,
            dataVencimento: dataVencStr,
            status: 'ATIVO',
            emailAcesso: email,
            senhaAcesso: senha,
            modulosLiberados: modsIniciais,
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

        // 5. Configuração cadastral e Caixa inicial
        batch.set(db.collection('empresas').doc(empresaId).collection('configuracoes').doc('config'), {
            empresa: {
                nome: nome,
                fantasia: nome,
                cnpj: cnpj,
                telefone: wpp
            },
            pdv: { permite_estoque_negativo: false }
        });
        batch.set(db.collection('empresas').doc(empresaId).collection('caixa').doc('caixa_atual'), {
            status: 'fechado', saldo: 0, historico: []
        });

        await batch.commit();

        fecharModalNovaLoja();
        showToast(`Loja "${nome}" criada e liberada com sucesso!`, 'success');
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

// ==========================================
// MÓDULO 5: CONFIGURAÇÃO GLOBAL DO SAAS (GEMINI AI MASTER)
// ==========================================
function toggleVerGeminiGlobal() {
    const inp = document.getElementById('config-global-gemini-key');
    const icone = document.getElementById('olho-gemini-global');
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icone) { icone.classList.remove('fa-eye'); icone.classList.add('fa-eye-slash'); }
    } else {
        inp.type = 'password';
        if (icone) { icone.classList.remove('fa-eye-slash'); icone.classList.add('fa-eye'); }
    }
}
window.toggleVerGeminiGlobal = toggleVerGeminiGlobal;

async function abrirModalConfigGlobalSaaS() {
    const modal = document.getElementById('modal-config-global-saas');
    const inputKey = document.getElementById('config-global-gemini-key');
    const divResult = document.getElementById('resultado-teste-ia-global');
    if (divResult) divResult.classList.add('hidden');

    try {
        const doc = await firebase.firestore().collection('saas_config').doc('master').get();
        if (doc.exists && doc.data().geminiKeyMaster) {
            if (inputKey) inputKey.value = doc.data().geminiKeyMaster;
        } else if (inputKey) {
            inputKey.value = '';
        }
    } catch(err) {
        console.warn("Aviso ao carregar saas_config/master:", err);
    }

    if (modal) modal.classList.remove('hidden');
}
window.abrirModalConfigGlobalSaaS = abrirModalConfigGlobalSaaS;

function fecharModalConfigGlobalSaaS() {
    const modal = document.getElementById('modal-config-global-saas');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalConfigGlobalSaaS = fecharModalConfigGlobalSaaS;

async function testarChaveIAGlobal() {
    const inputKey = document.getElementById('config-global-gemini-key');
    const divResult = document.getElementById('resultado-teste-ia-global');
    if (!inputKey || !divResult) return;

    const key = inputKey.value.trim();
    if (!key) {
        showToast('Insira uma chave do Google Gemini para testar!', 'error');
        return;
    }

    divResult.className = 'p-3 rounded-xl text-xs bg-purple-950/50 border border-purple-800 text-purple-300 flex items-center gap-2';
    divResult.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando à API do Google Gemini AI Studio...';
    divResult.classList.remove('hidden');

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Diga apenas: 'Conexão validada com sucesso!'" }] }]
            })
        });

        const data = await resp.json();
        if (resp.ok && data.candidates && data.candidates.length > 0) {
            const resposta = data.candidates[0]?.content?.parts?.[0]?.text || 'OK';
            divResult.className = 'p-3 rounded-xl text-xs bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 space-y-1';
            divResult.innerHTML = `
                <div class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> Chave Válida e Operacional!</div>
                <div class="text-[11px] text-slate-300">Retorno da IA: "<em>${resposta.trim()}</em>"</div>
            `;
            showToast('Chave testada com sucesso!', 'success');
        } else {
            const erroMsg = data.error?.message || 'Chave rejeitada pela Google.';
            divResult.className = 'p-3 rounded-xl text-xs bg-red-950/50 border border-red-500/40 text-red-300 space-y-1';
            divResult.innerHTML = `
                <div class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-xmark"></i> Falha na Validação Google</div>
                <div class="text-[11px] text-red-200">${erroMsg}</div>
            `;
            showToast('Chave inválida ou bloqueada pela Google!', 'error');
        }
    } catch(err) {
        divResult.className = 'p-3 rounded-xl text-xs bg-red-950/50 border border-red-500/40 text-red-300 space-y-1';
        divResult.innerHTML = `
            <div class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation"></i> Erro de Rede</div>
            <div class="text-[11px] text-red-200">${err.message}</div>
        `;
        showToast('Erro ao testar chave: ' + err.message, 'error');
    }
}
window.testarChaveIAGlobal = testarChaveIAGlobal;

async function salvarConfigGlobalSaaSMaster(e) {
    if (e) e.preventDefault();
    const inputKey = document.getElementById('config-global-gemini-key');
    const btn = document.getElementById('btn-salvar-config-global');
    if (!inputKey) return;

    const key = inputKey.value.trim();
    if (!key) {
        showToast('Insira a chave do Google Gemini!', 'error');
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gravando Chave Mestra...';
        }

        await firebase.firestore().collection('saas_config').doc('master').set({
            geminiKeyMaster: key,
            atualizadoPor: 'pauloaugusto.silvaborges@gmail.com',
            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        fecharModalConfigGlobalSaaS();
        showToast('Chave Mestra Global de IA configurada com sucesso para todo o SaaS!', 'success');
    } catch (err) {
        console.error("Erro ao salvar chave global:", err);
        showToast('Erro ao salvar configuração: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Salvar Chave Global';
        }
    }
}
window.salvarConfigGlobalSaaSMaster = salvarConfigGlobalSaaSMaster;

