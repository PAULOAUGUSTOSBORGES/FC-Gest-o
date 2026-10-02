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

function mudarAbaLogin(modo) {
    if (modo === 'register') {
        window.location.href = `${URL_PORTAL_PRIMAS}/acesso.html?sistema=fc_gestao`;
        return;
    }
    modoAtual = 'login';
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const btnAcao = document.getElementById('btn-acao');
    const subtitulo = document.getElementById('subtitulo-form');
    const esqueciSenhaLink = document.getElementById('esqueci-senha-link');
    const txtBtnGoogle = document.getElementById('txt-btn-google');
    const badgeTrial = document.getElementById('badge-trial');

    if (tabLogin) tabLogin.className = 'flex-1 pb-2 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
    if (tabRegister) tabRegister.className = 'flex-1 pb-2 font-bold text-slate-400 border-b-2 border-transparent transition-colors hover:text-slate-600 dark:hover:text-slate-300';
    if (btnAcao) btnAcao.innerText = 'Entrar';
    if (subtitulo) subtitulo.innerText = 'Acesso ao sistema integrado';
    if (esqueciSenhaLink) esqueciSenhaLink.classList.remove('hidden');
    if (txtBtnGoogle) txtBtnGoogle.innerText = 'Entrar com Google';
    if (badgeTrial) badgeTrial.classList.add('hidden');
}

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
                    if (statusEmp === 'PENDENTE_PAGAMENTO') {
                        await firebase.auth().signOut();
                        localStorage.removeItem('fc_empresa_ativa');
                        sessionStorage.clear();
                        window._fazendoLogin = false;
                        if (btn) { btn.innerText = 'Entrar no Sistema'; btn.disabled = false; }
                        showToast('A ativação da sua loja está pendente de pagamento.', 'warning');
                        setTimeout(() => { window.location.href = `${URL_PORTAL_PRIMAS}/cadastro.html`; }, 2000);
                        return;
                    } else if (statusEmp === 'BLOQUEADO') {
                        await firebase.auth().signOut();
                        localStorage.removeItem('fc_empresa_ativa');
                        sessionStorage.clear();
                        window._fazendoLogin = false;
                        if (btn) { btn.innerText = 'Entrar no Sistema'; btn.disabled = false; }
                        showToast('O acesso desta empresa está temporariamente bloqueado. Contate o suporte.', 'error');
                        return;
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
            showToast('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 'error');
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
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
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
                if (statusEmp === 'PENDENTE_PAGAMENTO') {
                    await firebase.auth().signOut();
                    localStorage.removeItem('fc_empresa_ativa');
                    sessionStorage.clear();
                    window._fazendoLogin = false;
                    showToast('A ativação da sua loja está pendente de pagamento.', 'warning');
                    setTimeout(() => {
                        window.location.href = `${URL_PORTAL_PRIMAS}/cadastro.html`;
                    }, 2000);
                    return;
                } else if (statusEmp === 'BLOQUEADO') {
                    await firebase.auth().signOut();
                    localStorage.removeItem('fc_empresa_ativa');
                    sessionStorage.clear();
                    window._fazendoLogin = false;
                    showToast('O acesso desta empresa está temporariamente bloqueado por pendência financeira. Contate o suporte.', 'error');
                    return;
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
    setTimeout(() => { window.location.href = rotaInicial; }, 500);
}

// Processa o resultado do redirect do Google (necessário quando o navegador usa redirect)
async function processarRedirectResult() {
    try {
        const cred = await firebase.auth().getRedirectResult();
        if (!cred || !cred.user) {
            if (firebase.auth().currentUser && sessionStorage.getItem('fc_google_redirect_pendente')) {
                window._fazendoLogin = true;
                await finalizarLoginGoogle(firebase.auth().currentUser);
                return;
            }
            sessionStorage.removeItem('fc_google_redirect_pendente');
            return;
        }
        window._fazendoLogin = true;
        await finalizarLoginGoogle(cred.user);
    } catch (e) {
        sessionStorage.removeItem('fc_google_redirect_pendente');
        window._fazendoLogin = false;
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/redirect-cancelled-by-user') {
            showToast('Login com Google cancelado.', 'info');
        } else if (e.code && e.code !== 'auth/no-auth-event') {
            showToast('Erro ao entrar com Google: ' + (e.message || e), 'error');
            console.error('Erro Google getRedirectResult:', e);
        }
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

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        let cred;
        try {
            // Executa popup imediatamente no clique do usuário (sem await prévio, evitando bloqueio do navegador)
            cred = await firebase.auth().signInWithPopup(provider);
        } catch (popupErr) {
            console.warn('Tentativa popup Google:', popupErr);
            // Se o navegador bloqueou o popup ou não suporta popup (ex: PWA / webview móvel restrita), faz fallback para redirect
            if (popupErr.code === 'auth/popup-blocked' || 
                popupErr.code === 'auth/cancelled-popup-request' || 
                popupErr.code === 'auth/operation-not-supported-in-this-environment') {
                if (txtGoogle) txtGoogle.innerText = 'Redirecionando...';
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
            showToast('O navegador bloqueou a janela pop-up do Google. Permita pop-ups para continuar.', 'error');
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

