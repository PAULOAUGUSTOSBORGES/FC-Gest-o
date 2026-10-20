// Função para os avisos na tela
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const t = document.createElement('div');
    t.className = "toast show " + type;
    t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')}"></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// URL Oficial do Portal de Planos e Ativação da Primas Tecnologia
const URL_PORTAL_PRIMAS = 'https://primas.tech';

function isContaMaster(email) {
    if (!email) return false;
    const e = email.toLowerCase().trim();
    return e === 'fabricadecoresgoiania@gmail.com' || e === 'pauloaugusto.silvaborges@gmail.com';
}
window.isContaMaster = isContaMaster;

let modoAtual = 'login';

function alternarModoAuth(modo) {
    modoAtual = modo;
    const tabLogin = document.getElementById('tab-login');
    const tabCadastro = document.getElementById('tab-cadastro');
    const formLogin = document.getElementById('form-login');
    const formCadastro = document.getElementById('form-cadastro-trial');
    const divisorSocial = document.getElementById('divisor-social');
    const btnGoogle = document.getElementById('btn-google');
    const esqueciSenhaLink = document.getElementById('esqueci-senha-link');
    const subtitulo = document.getElementById('subtitulo-form');

    if (modo === 'cadastro') {
        if (tabCadastro) tabCadastro.className = 'flex-1 pb-2.5 font-bold text-sm text-amber-500 border-b-2 border-amber-500 transition-colors cursor-pointer flex items-center justify-center gap-1.5';
        if (tabLogin) tabLogin.className = 'flex-1 pb-2.5 font-bold text-sm text-slate-400 border-b-2 border-transparent hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer';
        if (formLogin) formLogin.classList.add('hidden');
        if (formCadastro) formCadastro.classList.remove('hidden');
        if (divisorSocial) divisorSocial.classList.add('hidden');
        if (btnGoogle) btnGoogle.classList.add('hidden');
        if (esqueciSenhaLink) esqueciSenhaLink.classList.add('hidden');
        if (subtitulo) subtitulo.innerText = 'Crie sua loja e ganhe 7 dias de teste grátis';
    } else {
        if (tabLogin) tabLogin.className = 'flex-1 pb-2.5 font-bold text-sm text-blue-600 border-b-2 border-blue-600 transition-colors cursor-pointer';
        if (tabCadastro) tabCadastro.className = 'flex-1 pb-2.5 font-bold text-sm text-slate-400 border-b-2 border-transparent hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5';
        if (formLogin) formLogin.classList.remove('hidden');
        if (formCadastro) formCadastro.classList.add('hidden');
        if (divisorSocial) divisorSocial.classList.remove('hidden');
        if (btnGoogle) btnGoogle.classList.remove('hidden');
        if (esqueciSenhaLink) esqueciSenhaLink.classList.remove('hidden');
        if (subtitulo) subtitulo.innerText = 'Portal de Acesso para Lojistas e Funcionários';
    }
}
window.alternarModoAuth = alternarModoAuth;

// CADASTRO AUTOMÁTICO DE NOVO CLIENTE COM 7 DIAS GRÁTIS (TRIAL)
async function fazerCadastroGratuitoTrial() {
    const nomeEmpresa = (document.getElementById('cad-nome-empresa')?.value || '').trim();
    const responsavel = (document.getElementById('cad-responsavel')?.value || '').trim();
    const whatsapp = (document.getElementById('cad-whatsapp')?.value || '').trim();
    const email = (document.getElementById('cad-email')?.value || '').trim().toLowerCase();
    const senha = (document.getElementById('cad-senha')?.value || '');

    if (!nomeEmpresa) return showToast('Informe o nome da sua loja ou empresa.', 'warning');
    if (!responsavel) return showToast('Informe seu nome ou do responsável.', 'warning');
    if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) return showToast('Informe um número de WhatsApp válido.', 'warning');
    if (!email || !email.includes('@')) return showToast('Informe um e-mail válido.', 'warning');
    if (!senha || senha.length < 6) return showToast('A senha deve ter no mínimo 6 caracteres.', 'warning');

    const btn = document.getElementById('btn-cad-trial');
    const txtOrig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando sua loja...'; }

    try {
        // 1. Criar usuário no Firebase Authentication
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, senha);
        const user = cred.user;

        // 2. Definir vencimento estrito de 7 dias a partir de agora
        const agora = new Date();
        const venc7Dias = new Date(agora.getTime() + (7 * 24 * 60 * 60 * 1000));
        venc7Dias.setHours(23, 59, 59, 999);
        const vencStr = venc7Dias.toISOString().split('T')[0];

        const empresaId = 'emp_' + user.uid.substring(0, 10);
        const db = firebase.firestore();
        const batch = db.batch();

        // 3. Documento da Empresa (Multi-tenant) com 7 dias de Trial Grátis
        const empRef = db.collection('empresas').doc(empresaId);
        batch.set(empRef, {
            donoUid: user.uid,
            nomeEmpresa: nomeEmpresa,
            nome: nomeEmpresa,
            responsavel: responsavel,
            whatsapp: whatsapp,
            telefone: whatsapp,
            emailAcesso: email,
            status: 'TRIAL',
            plano: 'FREE',
            nomePlano: 'Período de Avaliação (7 Dias)',
            pago: false,
            dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
            dataVencimento: firebase.firestore.Timestamp.fromDate(venc7Dias),
            dataVencimentoStr: vencStr,
            sistemaId: 'fc_gestao',
            modulosLiberados: ['pdv', 'vendas', 'produtos', 'clientes', 'fornecedores', 'financeiro', 'caixa', 'compras', 'relatorios', 'suporte']
        });

        // 4. Mapeamento Global de Usuário
        const userRef = db.collection('usuarios').doc(user.uid);
        batch.set(userRef, {
            email: email,
            nome: responsavel,
            empresaId: empresaId,
            ativo: true,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 5. Configurações Iniciais da Loja
        const configRef = empRef.collection('configuracoes').doc('config');
        batch.set(configRef, {
            empresa: {
                nome: nomeEmpresa,
                fantasia: nomeEmpresa,
                telefone: whatsapp,
                email: email
            },
            pdv: { permite_estoque_negativo: false }
        });

        // 6. Funcionário Admin com Acesso Completo
        const funcRef = empRef.collection('funcionarios').doc(user.uid);
        batch.set(funcRef, {
            nome: responsavel,
            email: email,
            isAdmin: true,
            perm_gestao: true,
            perm_fiscal: true,
            perm_operacao: true,
            perm_pdv: true,
            ativo: true,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Grava todas as coleções de uma só vez (atômico)
        await batch.commit();

        // Configura sessão local
        localStorage.setItem('fc_empresa_ativa', empresaId);
        localStorage.setItem('fc_nome_empresa_ativa', nomeEmpresa);
        localStorage.setItem('fc_sessao_data', agora.toDateString());
        localStorage.setItem('fc_sessao_uid', user.uid);

        showToast('🎉 Loja criada com sucesso! Seus 7 dias grátis estão ativos.', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1200);

    } catch (err) {
        console.error('[Cadastro] Erro ao cadastrar:', err);
        let msg = err.message;
        if (err.code === 'auth/email-already-in-use') {
            msg = 'Este e-mail já está cadastrado. Faça login na aba "Entrar" ou use a recuperação de senha.';
        }
        showToast(msg, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = txtOrig; }
    }
}
window.fazerCadastroGratuitoTrial = fazerCadastroGratuitoTrial;

// Máscara dinâmica para o campo WhatsApp/Telefone
document.addEventListener('DOMContentLoaded', () => {
    const telInput = document.getElementById('login-telefone');
    if (telInput) {
        telInput.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 6) {
                e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
            } else if (v.length > 2) {
                e.target.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
            } else if (v.length > 0) {
                e.target.value = `(${v}`;
            } else {
                e.target.value = '';
            }
        });
    }
});


function acaoPrincipal() {
    // Verificação de segurança: garante que o Firebase está carregado
    if (typeof firebase === 'undefined' || !firebase.auth) {
        alert('O sistema ainda está carregando. Aguarde um momento e tente novamente.');
        return;
    }
    if (modoAtual === 'login') fazerLogin();
    else fazerCadastro();
}
// Expõe globalmente para o onclick do HTML funcionar em todos os navegadores (incluindo mobile)
window.acaoPrincipal = acaoPrincipal;

// ==========================================
// SEGURANCA: CONTROLE DE TENTATIVAS DE LOGIN (ANTI BRUTE-FORCE)
// ==========================================
const LIMITE_TENTATIVAS_LOGIN = 5;
const TEMPO_BLOQUEIO_LOGIN_MS = 15 * 60 * 1000; // 15 minutos

function obterChaveTentativasLogin(email) {
    const limpo = (email || '').toLowerCase().trim();
    try { return 'fc_bruteforce_' + btoa(limpo).replace(/=/g, ''); }
    catch(e) { return 'fc_bruteforce_' + limpo.replace(/[^a-z0-9]/g, ''); }
}

function verificarBloqueioLogin(email) {
    try {
        const chave = obterChaveTentativasLogin(email);
        const raw = localStorage.getItem(chave);
        if (!raw) return true;
        const dados = JSON.parse(raw);
        if (dados.bloqueadoAte && dados.bloqueadoAte > Date.now()) {
            const minutos = Math.ceil((dados.bloqueadoAte - Date.now()) / 60000);
            showToast('Acesso temporariamente bloqueado (' + minutos + ' min restantes) por excesso de tentativas incorretas.', 'error');
            return false;
        }
        if (dados.bloqueadoAte && dados.bloqueadoAte <= Date.now()) {
            localStorage.removeItem(chave);
        }
    } catch (e) {
        console.warn('Erro ao verificar bloqueio de login:', e);
    }
    return true;
}

function registrarFalhaLogin(email, forcarBloqueio = false) {
    try {
        const chave = obterChaveTentativasLogin(email);
        const raw = localStorage.getItem(chave);
        let dados = raw ? JSON.parse(raw) : { tentativas: 0, inicio: Date.now() };

        if (Date.now() - (dados.inicio || 0) > 60 * 60 * 1000) {
            dados = { tentativas: 0, inicio: Date.now() };
        }

        dados.tentativas = (dados.tentativas || 0) + 1;
        dados.ultimoErro = Date.now();

        if (forcarBloqueio || dados.tentativas >= LIMITE_TENTATIVAS_LOGIN) {
            dados.bloqueadoAte = Date.now() + TEMPO_BLOQUEIO_LOGIN_MS;
            localStorage.setItem(chave, JSON.stringify(dados));
            showToast('Muitas tentativas incorretas! Acesso temporariamente suspenso por 15 minutos por seguranca.', 'error');
        } else {
            localStorage.setItem(chave, JSON.stringify(dados));
            const restantes = LIMITE_TENTATIVAS_LOGIN - dados.tentativas;
            if (restantes <= 2) {
                showToast('Aviso: Senha incorreta! Restam ' + restantes + ' tentativa(s) antes do bloqueio temporario.', 'warning');
            } else {
                showToast('E-mail não encontrado ou senha incorreta!', 'error');
            }
        }
    } catch (e) {
        console.warn('Erro ao registrar falha de login:', e);
        showToast('E-mail nao encontrado ou senha incorreta!', 'error');
    }
}

function limparTentativasLogin(email) {
    try {
        const chave = obterChaveTentativasLogin(email);
        localStorage.removeItem(chave);
    } catch (e) {}
}

async function fazerLogin() {
    const u = (document.getElementById('login-user').value || '').trim();
    const p = document.getElementById('login-pass').value;
    
    if (!u || !p) {
        showToast('Preencha os campos de e-mail e senha!', 'error');
        return;
    }

    const btn = document.getElementById('btn-acao');
    
    try {
        window._fazendoLogin = true;
        if (btn) { btn.innerText = 'Aguarde...'; btn.disabled = true; }

        // Garantir persistência LOCAL (sessão salva no celular)
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (persErr) {
            console.warn('Persistência LOCAL fallback:', persErr);
        }

        const cred = await firebase.auth().signInWithEmailAndPassword(u, p);

        if (!cred || !cred.user) {
            throw new Error('Nenhum dado de usuário retornado.');
        }

        const hoje = new Date().toDateString();
        localStorage.setItem('fc_sessao_data', hoje);
        localStorage.setItem('fc_sessao_uid', cred.user.uid);

        // Limpa cache de outra conta
        sessionStorage.clear();
        if (typeof window.FCCache !== 'undefined') {
            try { await window.FCCache.invalidarTudo(); } catch(e) {}
        }
        if (!isContaMaster(cred.user.email)) {
            localStorage.removeItem('fc_moveis_config');
            localStorage.removeItem('fc_moveis_caixa');
            localStorage.removeItem('fc_moveis_produtos');
        }

        // Buscar empresa do usuário
        let empId = null;
        try {
            const userDoc = await firebase.firestore().collection('usuarios').doc(cred.user.uid).get();
            if (userDoc.exists && userDoc.data().empresaId) {
                empId = userDoc.data().empresaId;
                localStorage.setItem('fc_empresa_ativa', empId);
            } else if (isContaMaster(cred.user.email)) {
                empId = 'emp_fc_moveis';
                localStorage.setItem('fc_empresa_ativa', empId);
                localStorage.setItem('fc_nome_empresa_ativa', 'FC Móveis');
            } else {
                // Fallback: buscar por e-mail caso o usuário tenha sido cadastrado com ID customizado
                const snapEmail = await firebase.firestore().collection('usuarios').where('email', '==', cred.user.email).limit(1).get();
                if (!snapEmail.empty && snapEmail.docs[0].data().empresaId) {
                    empId = snapEmail.docs[0].data().empresaId;
                    localStorage.setItem('fc_empresa_ativa', empId);
                    try {
                        await firebase.firestore().collection('usuarios').doc(cred.user.uid).set({
                            ...snapEmail.docs[0].data(),
                            uid: cred.user.uid
                        }, { merge: true });
                    } catch(eMerge) {}
                } else {
                    showToast('Conta sem loja vinculada. Entre em contato com o suporte.', 'error');
                    await firebase.auth().signOut();
                    window._fazendoLogin = false;
                    if (btn) { btn.innerText = 'Entrar no Sistema'; btn.disabled = false; }
                    return;
                }
            }
        } catch(e) {
            if (isContaMaster(cred.user.email)) {
                empId = 'emp_fc_moveis';
                localStorage.setItem('fc_empresa_ativa', empId);
                localStorage.setItem('fc_nome_empresa_ativa', 'FC Móveis');
            } else {
                showToast('Erro ao identificar sua loja: ' + e.message, 'error');
                await firebase.auth().signOut();
                window._fazendoLogin = false;
                if (btn) { btn.innerText = 'Entrar no Sistema'; btn.disabled = false; }
                return;
            }
        }

        // Verificar status da empresa (bloqueio/pendência)
        if (empId && !isContaMaster(cred.user.email)) {
            try {
                const empDoc = await firebase.firestore().collection('empresas').doc(empId).get();
                if (empDoc.exists) {
                    const empData = empDoc.data();
                    const nomeEmp = empData.nomeEmpresa || empData.nome || 'Minha Loja';
                    localStorage.setItem('fc_nome_empresa_ativa', nomeEmp);

                    const statusEmp = empData.status;
                    if (statusEmp === 'PENDENTE_PAGAMENTO' || statusEmp === 'BLOQUEADO') {
                        // Permite a entrada no sistema para que o motor de licença saas_licenca.js
                        // renderize a tela de bloqueio com o botão de pagamento do Mercado Pago e PIX direto.
                        console.log('[Login] Empresa com pendência/bloqueio detectada. Direcionando para regularização no sistema.');
                    }
                }
            } catch (errCheck) {
                console.warn('Falha na checagem de status da empresa:', errCheck);
            }
        }

        // Definir rota inicial baseada nas permissões do usuário
        let rotaInicial = 'index.html';
        try {
            if (empId && cred.user) {
                const funcDoc = await firebase.firestore().collection('empresas').doc(empId).collection('funcionarios').doc(cred.user.uid).get();
                if (funcDoc.exists) {
                    const uData = funcDoc.data();
                    if (typeof window.obterRotaInicialUsuario === 'function') {
                        rotaInicial = window.obterRotaInicialUsuario(uData);
                    } else {
                        if (uData.isAdmin || uData.perm_dashboard) rotaInicial = 'index.html';
                        else if (uData.perm_pdv) rotaInicial = 'pdv.html';
                        else if (uData.perm_vendas_op) rotaInicial = 'vendas_operacao.html';
                        else if (uData.perm_orcamentos) rotaInicial = 'orcamentos.html';
                        else if (uData.perm_produtos) rotaInicial = 'produtos.html';
                        else if (uData.perm_clientes) rotaInicial = 'clientes.html';
                        else if (uData.perm_fornecedores) rotaInicial = 'fornecedores.html';
                        else if (uData.perm_financeiro || uData.perm_gestao) rotaInicial = 'financeiro.html';
                        else if (uData.perm_caixa) rotaInicial = 'caixa.html';
                        else if (uData.perm_compras) rotaInicial = 'compras.html';
                        else if (uData.perm_relatorios) rotaInicial = 'relatorios.html';
                        else if (uData.perm_agenda) rotaInicial = 'agenda.html';
                        else if (uData.perm_marketing) rotaInicial = 'marketing.html';
                        else if (uData.perm_fiscal) rotaInicial = 'fiscal.html';
                        else if (uData.perm_config) rotaInicial = 'sistema.html';
                    }
                }
            }
        } catch(eRota) {
            console.warn('Aviso rota inicial:', eRota);
        }

        showToast('Acesso liberado! Entrando...', 'success');
        try { sessionStorage.setItem('fc_recem_logado', 'true'); } catch(e) {}
        setTimeout(() => { window.location.href = rotaInicial; }, 600);

    } catch (e) {
        window._fazendoLogin = false;
        if (btn) { btn.innerText = 'Entrar no Sistema'; btn.disabled = false; }

        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials' || e.code === 'auth/wrong-password') {
            try {
                const methods = await firebase.auth().fetchSignInMethodsForEmail(u);
                if (methods && methods.includes('google.com') && !methods.includes('password')) {
                    showToast('Esta conta usa o Google. Clique em "Entrar com Google".', 'warning');
                    return;
                }
            } catch (errMethods) {
                console.warn('Verificação de provedores:', errMethods);
            }
            showToast('E-mail não encontrado ou senha incorreta!', 'error');
        } else if (e.code === 'auth/network-request-failed') {
            showToast('Sem conexão com a internet. Verifique sua rede e tente novamente.', 'error');
        } else if (e.code === 'auth/too-many-requests') {
            registrarFalhaLogin(u, true);
        } else {
            showToast('Erro ao entrar: ' + (e.message || e.code || 'Erro desconhecido'), 'error');
            console.error('Erro login:', e);
        }
    }
}

async function fazerCadastro() {
    window.location.href = `${URL_PORTAL_PRIMAS}/acesso.html?sistema=fc_gestao`;
}

// Detecta se o dispositivo é mobile/tablet
// Detecta se o ambiente é PWA (Standalone/App instalado) ou dispositivo móvel/tablet
function isPwaOuDispositivoMovel() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.navigator.standalone === true
        || document.referrer.includes('android-app://');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
    return Boolean(isStandalone || isMobile);
}

async function finalizarLoginGoogle(user) {
    const db = firebase.firestore();
    const hoje = new Date().toDateString();
    localStorage.setItem('fc_sessao_data', hoje);
    localStorage.setItem('fc_sessao_uid', user.uid);
    sessionStorage.clear();
    sessionStorage.removeItem('fc_google_redirect_pendente');
    if (typeof window.FCCache !== 'undefined') {
        try { await window.FCCache.invalidarTudo(); } catch(e) {}
    }

    let empresaId = null;

    // 1. Verificar se o usuário já tem registro global por UID
    try {
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().empresaId) {
            empresaId = userDoc.data().empresaId;
        }
    } catch(eDoc) {
        console.warn("Erro ao buscar usuario por UID:", eDoc);
    }

    // 2. Fallback exclusivo para contas master
    if (!empresaId && isContaMaster(user.email)) {
        empresaId = 'emp_fc_moveis';
    }

    // 3. Fallback: procurar por email cadastrado previamente
    if (!empresaId && user.email) {
        try {
            const snapEmail = await db.collection('usuarios').where('email', '==', user.email).limit(1).get();
            if (!snapEmail.empty) {
                const dadosExistentes = snapEmail.docs[0].data();
                if (dadosExistentes.empresaId) {
                    empresaId = dadosExistentes.empresaId;
                    await db.collection('usuarios').doc(user.uid).set({
                        ...dadosExistentes,
                        googleUid: user.uid,
                        email: user.email,
                        nome: user.displayName || dadosExistentes.nome || 'Usuário',
                        dataVinculoGoogle: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            }
        } catch(eEmail) {
            console.warn("Aviso ao buscar por email:", eEmail);
        }
    }

    if (!empresaId) {
        showToast('Nenhuma assinatura ativa encontrada para este e-mail. Redirecionando para os planos...', 'warning');
        await firebase.auth().signOut();
        localStorage.removeItem('fc_sessao_data');
        localStorage.removeItem('fc_sessao_uid');
        localStorage.removeItem('fc_empresa_ativa');
        sessionStorage.clear();
        window._fazendoLogin = false;
        setTimeout(() => {
            window.location.href = `${URL_PORTAL_PRIMAS}/acesso.html?sistema=fc_gestao`;
        }, 2000);
        return;
    }

    localStorage.setItem('fc_empresa_ativa', empresaId);
    if (empresaId === 'emp_fc_moveis') {
        localStorage.setItem('fc_nome_empresa_ativa', 'FC Móveis');
    }

    // Verificar se a empresa está com status BLOQUEADO ou PENDENTE_PAGAMENTO
    if (empresaId && !isContaMaster(user.email)) {
        try {
            const empDoc = await db.collection('empresas').doc(empresaId).get();
            if (empDoc.exists) {
                const statusEmp = empDoc.data().status;
                const nomeEmp = empDoc.data().nomeEmpresa || empDoc.data().nome || 'Minha Loja';
                localStorage.setItem('fc_nome_empresa_ativa', nomeEmp);
                if (statusEmp === 'PENDENTE_PAGAMENTO' || statusEmp === 'BLOQUEADO') {
                    // Permite a entrada no sistema para que o saas_licenca.js renderize o bloqueio
                    // com a opção de pagamento via Mercado Pago e PIX direto para auto-desbloqueio.
                    console.log('[Login Google] Empresa com pendência/bloqueio detectada. Direcionando para regularização no sistema.');
                }
            }
        } catch (errCheck) {
            console.warn("Falha na checagem de status da empresa:", errCheck);
        }
    }

    let rotaInicial = 'index.html';
    try {
        const funcDoc = await db.collection('empresas').doc(empresaId).collection('funcionarios').doc(user.uid).get();
        if (funcDoc.exists) {
            const uData = funcDoc.data();
            if (typeof window.obterRotaInicialUsuario === 'function') {
                rotaInicial = window.obterRotaInicialUsuario(uData);
            }
        }
    } catch(eRota) {
        console.warn('Aviso rota inicial:', eRota);
    }

    showToast('Login com Google realizado com sucesso! Entrando...', 'success');
    try { sessionStorage.setItem('fc_recem_logado', 'true'); } catch(e) {}
    setTimeout(() => { window.location.href = rotaInicial; }, 500);
}

// Processa o resultado do redirect do Google (necessário quando o navegador usa redirect)
let _redirectGoogleEmAndamento = false;

async function tratarUsuarioLogadoGoogle(user) {
    if (!user || _redirectGoogleEmAndamento) return;
    _redirectGoogleEmAndamento = true;
    sessionStorage.removeItem('fc_google_redirect_pendente');
    window._fazendoLogin = true;
    const btnGoogle = document.getElementById('btn-google');
    const txtGoogle = document.getElementById('txt-btn-google');
    if (btnGoogle) btnGoogle.disabled = true;
    if (txtGoogle) txtGoogle.innerText = 'Conta verificada! Entrando...';
    await finalizarLoginGoogle(user);
}

// Processa o resultado do redirect do Google (PWA e Mobile)
async function processarRedirectResult() {
    if (!sessionStorage.getItem('fc_google_redirect_pendente')) return;

    const btnGoogle = document.getElementById('btn-google');
    const txtGoogle = document.getElementById('txt-btn-google');
    if (btnGoogle) btnGoogle.disabled = true;
    if (txtGoogle) txtGoogle.innerText = 'Conectando ao Google...';

    try {
        const cred = await firebase.auth().getRedirectResult();
        if (cred && cred.user) {
            await tratarUsuarioLogadoGoogle(cred.user);
            return;
        }
        if (firebase.auth().currentUser) {
            await tratarUsuarioLogadoGoogle(firebase.auth().currentUser);
            return;
        }
    } catch (e) {
        sessionStorage.removeItem('fc_google_redirect_pendente');
        window._fazendoLogin = false;
        if (btnGoogle) btnGoogle.disabled = false;
        if (txtGoogle) txtGoogle.innerText = 'Entrar com Google';
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/redirect-cancelled-by-user') {
            showToast('Login com Google cancelado.', 'info');
        } else if (e.code && e.code !== 'auth/no-auth-event') {
            showToast('Erro ao entrar com Google: ' + (e.message || e), 'error');
            console.error('Erro Google getRedirectResult:', e);
        }
    }
}

// Listener para capturar o retorno de redirect do Google assim que o Firebase autenticar
if (typeof firebase !== 'undefined' && firebase.auth) {
    try {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user && sessionStorage.getItem('fc_google_redirect_pendente')) {
                await tratarUsuarioLogadoGoogle(user);
            }
        });
    } catch(errAuth) {
        console.warn('Aviso no listener auth login:', errAuth);
    }
}

// Inicializa a escuta de sessão para redirecionar automaticamente quando logar
window.addEventListener('load', async () => {
    const msgExpirada = sessionStorage.getItem('fc_sessao_expirada_msg');
    if (msgExpirada) {
        showToast(msgExpirada, 'info');
        sessionStorage.removeItem('fc_sessao_expirada_msg');
    }
    // Processa retorno do redirect do Google (mobile) de forma segura
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await processarRedirectResult();
        }
    } catch(errRedir) {
        console.warn('Erro ao processar redirect Google:', errRedir);
    }
    try {
        if (typeof initGlobalData === 'function') {
            initGlobalData();
        }
    } catch(errInit) {
        console.warn('Erro em initGlobalData:', errInit);
    }
});

// Listener adicional para mobile para garantir que o formulário submeta
document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            acaoPrincipal();
        });
    }
});

window.esqueciSenha = async function() {
    const email = document.getElementById('login-user')?.value?.trim();
    if (!email) {
        if (typeof showToast === 'function') showToast('Digite seu e-mail no campo acima para recuperar a senha.', 'warning');
        else alert('Digite seu e-mail no campo acima para recuperar a senha.');
        return;
    }
    try {
        await firebase.auth().sendPasswordResetEmail(email);
        if (typeof showToast === 'function') showToast('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.', 'success');
        else alert('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.');
    } catch(err) {
        console.error(err);
        const msg = err.code === 'auth/user-not-found' ? 'E-mail não cadastrado.' : 'Erro ao enviar e-mail de recuperação.';
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
    }
};

async function fazerLoginGoogle() {
    const btnGoogle = document.getElementById('btn-google');
    const txtGoogle = document.getElementById('txt-btn-google');
    const textoOriginal = txtGoogle ? txtGoogle.innerText : 'Entrar com Google';
    
    try {
        window._fazendoLogin = true;

        if (window.location.protocol === 'file:') {
            showToast('O login com Google exige acesso via servidor local ou nuvem.', 'error');
            alert('Atenção:\n\nO Google não permite autenticação quando a página é aberta diretamente como arquivo local (file:///).\n\nAbra pelo servidor local (localhost:8080) ou pelo link na nuvem.');
            if (btnGoogle) btnGoogle.disabled = false;
            if (txtGoogle) txtGoogle.innerText = textoOriginal;
            window._fazendoLogin = false;
            return;
        }

        if (btnGoogle) btnGoogle.disabled = true;
        if (txtGoogle) txtGoogle.innerText = 'Conectando ao Google...';

        // Garantir persistência LOCAL antes de iniciar autenticação
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (persErr) {
            console.warn('Persistência LOCAL Google:', persErr);
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        // Em PWA (Standalone/App instalado) ou dispositivos móveis:
        // O navegador Chromium isola janelas filhas e bloqueia popups cruzadas (abre tela branca travada).
        // Nesses ambientes, o signInWithRedirect é o método nativo recomendado.
        if (isPwaOuDispositivoMovel()) {
            if (txtGoogle) txtGoogle.innerText = 'Redirecionando para o Google...';
            sessionStorage.setItem('fc_google_redirect_pendente', '1');
            await firebase.auth().signInWithRedirect(provider);
            return;
        }

        // Em abas comuns de desktop, tenta signInWithPopup com fallback robusto
        let cred;
        try {
            cred = await firebase.auth().signInWithPopup(provider);
        } catch (popupErr) {
            console.warn('Tentativa popup Google falhou, acionando fallback redirect:', popupErr);
            // Se o popup foi bloqueado, cancelado ou não suportado, faz fallback automático para redirect
            if (popupErr.code === 'auth/popup-blocked' || 
                popupErr.code === 'auth/cancelled-popup-request' || 
                popupErr.code === 'auth/operation-not-supported-in-this-environment' ||
                popupErr.code === 'auth/internal-error') {
                if (txtGoogle) txtGoogle.innerText = 'Redirecionando para o Google...';
                sessionStorage.setItem('fc_google_redirect_pendente', '1');
                await firebase.auth().signInWithRedirect(provider);
                return;
            }
            throw popupErr;
        }

        if (!cred || !cred.user) {
            throw new Error('Nenhum dado de usuário retornado pelo Google.');
        }

        await finalizarLoginGoogle(cred.user);

    } catch (e) {
        window._fazendoLogin = false;
        if (btnGoogle) btnGoogle.disabled = false;
        if (txtGoogle) txtGoogle.innerText = textoOriginal;

        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
            showToast('Login com Google cancelado.', 'info');
        } else if (e.code === 'auth/popup-blocked') {
            showToast('Pop-up bloqueado. Redirecionando para o Google...', 'info');
            sessionStorage.setItem('fc_google_redirect_pendente', '1');
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await firebase.auth().signInWithRedirect(provider);
        } else if (e.code === 'auth/operation-not-supported-in-this-environment') {
            showToast('O login com Google requer acesso via HTTP/HTTPS ou Servidor Local (localhost).', 'warning');
        } else if (e.code === 'auth/account-exists-with-different-credential') {
            showToast('Já existe uma conta com este e-mail usando outro método de login.', 'error');
        } else {
            showToast('Erro ao entrar com Google: ' + (e.message || e.code || e), 'error');
            console.error('Erro Google Auth:', e);
        }
    }
}
window.fazerLoginGoogle = fazerLoginGoogle;

// Auto-redirecionar para Primas.tech caso acesse com parâmetros de cadastro/trial (?tab=cadastro ou ?tab=register)
(function inicializarAbaLoginViaUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = (urlParams.get('tab') || '').toLowerCase();
        if (tab === 'cadastro' || tab === 'register' || tab === 'criar' || tab === 'trial') {
            window.location.href = `${URL_PORTAL_PRIMAS}/acesso.html?sistema=fc_gestao`;
            return;
        }
    } catch (e) {
        console.warn('Erro ao processar parâmetros de URL no login:', e);
    }
})();

