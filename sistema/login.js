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

let modoAtual = 'login';

function mudarAbaLogin(modo) {
    if (modo === 'register') {
        window.location.href = 'https://isabella.tech/acesso.html?sistema=fc_gestao';
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
    if (modoAtual === 'login') fazerLogin();
    else fazerCadastro();
}

async function fazerLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    if(!u || !p) {
        showToast('Preencha os campos de e-mail e senha!', 'error');
        return;
    }
    
    try {
        window._fazendoLogin = true;
        const btn = document.getElementById('btn-acao');
        btn.innerText = 'Aguarde...'; btn.disabled = true;
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (persErr) {
            console.warn('Persistência LOCAL fallback:', persErr);
        }
        const cred = await firebase.auth().signInWithEmailAndPassword(u, p);
        if (cred && cred.user) {
            const hoje = new Date().toDateString();
            localStorage.setItem('fc_sessao_data', hoje);
            localStorage.setItem('fc_sessao_uid', cred.user.uid);
            
            // Limpa qualquer resíduo de cache de outra conta
            sessionStorage.clear();
            if (typeof window.FCCache !== 'undefined') {
                try { await window.FCCache.invalidarTudo(); } catch(e) {}
            }

            // Buscar empresa do usuario
            try {
                const userDoc = await firebase.firestore().collection('usuarios').doc(cred.user.uid).get();
                if (userDoc.exists && userDoc.data().empresaId) {
                    localStorage.setItem('fc_empresa_ativa', userDoc.data().empresaId);
                } else if (cred.user.email === 'fabricadecoresgoiania@gmail.com') {
                    // Fallback exclusivo para a conta master
                    localStorage.setItem('fc_empresa_ativa', 'emp_fc_moveis');
                } else {
                    console.error("Usuário sem empresa registrada.");
                    showToast('Conta sem loja vinculada. Crie uma nova conta.', 'error');
                    await firebase.auth().signOut();
                    window._fazendoLogin = false;
                    btn.innerText = 'Entrar'; btn.disabled = false;
                    return;
                }
            } catch(e) {
                console.error("Erro ao buscar empresa do usuario", e);
                if (cred.user.email === 'fabricadecoresgoiania@gmail.com') {
                    localStorage.setItem('fc_empresa_ativa', 'emp_fc_moveis');
                } else {
                    showToast('Erro ao identificar sua loja: ' + e.message, 'error');
                    await firebase.auth().signOut();
                    window._fazendoLogin = false;
                    btn.innerText = 'Entrar'; btn.disabled = false;
                    return;
                }
            }

            // Verificar se a empresa está com acesso bloqueado
            const empAtivaFinal = localStorage.getItem('fc_empresa_ativa');
            if (empAtivaFinal && cred.user.email !== 'fabricadecoresgoiania@gmail.com') {
                try {
                    const empDoc = await firebase.firestore().collection('empresas').doc(empAtivaFinal).get();
                    if (empDoc.exists) {
                        const statusEmp = empDoc.data().status;
                        if (statusEmp === 'PENDENTE_PAGAMENTO') {
                            await firebase.auth().signOut();
                            localStorage.removeItem('fc_empresa_ativa');
                            sessionStorage.clear();
                            window._fazendoLogin = false;
                            btn.innerText = 'Entrar'; btn.disabled = false;
                            showToast('A ativação da sua loja está pendente de pagamento.', 'warning');
                            setTimeout(() => { window.location.href = 'https://isabella.tech/cadastro.html'; }, 2000);
                            return;
                        } else if (statusEmp === 'BLOQUEADO') {
                            await firebase.auth().signOut();
                            localStorage.removeItem('fc_empresa_ativa');
                            sessionStorage.clear();
                            window._fazendoLogin = false;
                            btn.innerText = 'Entrar'; btn.disabled = false;
                            showToast('O acesso desta empresa está temporariamente bloqueado por pendência financeira. Contate o suporte.', 'error');
                            return;
                        }
                    }
                } catch (errCheck) {
                    console.warn("Falha na checagem de status da empresa:", errCheck);
                }
            }
        }
        let rotaInicial = 'index.html';
        try {
            const empAtivaFinal = localStorage.getItem('fc_empresa_ativa');
            if (empAtivaFinal && cred && cred.user) {
                const funcDoc = await firebase.firestore().collection('empresas').doc(empAtivaFinal).collection('funcionarios').doc(cred.user.uid).get();
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
        window.location.href = rotaInicial;
    } catch (e) { 
        window._fazendoLogin = false;
        document.getElementById('btn-acao').innerText = 'Entrar'; document.getElementById('btn-acao').disabled = false;
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials' || e.code === 'auth/wrong-password') {
            try {
                const methods = await firebase.auth().fetchSignInMethodsForEmail(u);
                if (methods && methods.includes('google.com') && !methods.includes('password')) {
                    showToast('Esta conta foi criada com o Google e não possui senha de texto cadastrada.', 'warning');
                    const querCriar = confirm(
                        'Esta conta foi acessada pelo Google e ainda não tem uma senha definida no sistema.\n\n' +
                        '• Para entrar agora: clique no botão "Entrar com Google".\n' +
                        '• Deseja receber um e-mail para criar uma senha e poder entrar das duas formas?'
                    );
                    if (querCriar) {
                        await firebase.auth().sendPasswordResetEmail(u);
                        showToast('E-mail enviado! Abra sua caixa de entrada para criar sua senha.', 'success');
                    }
                    return;
                }
            } catch (errMethods) {
                console.warn('Verificação de provedores:', errMethods);
            }
            showToast('E-mail não encontrado ou senha incorreta!', 'error');
        } else {
            showToast('Erro de login: ' + e.message, 'error'); 
            console.error(e);
        }
    }
}

async function fazerCadastro() {
    window.location.href = 'https://isabella.tech/acesso.html?sistema=fc_gestao';
}

// Inicializa a escuta de sessão para redirecionar automaticamente quando logar
window.addEventListener('load', () => {
    const msgExpirada = sessionStorage.getItem('fc_sessao_expirada_msg');
    if (msgExpirada) {
        showToast(msgExpirada, 'info');
        sessionStorage.removeItem('fc_sessao_expirada_msg');
    }
    initGlobalData();
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
            showToast('O login com Google não funciona abrindo o arquivo direto (file://). Abra pelo servidor local (localhost:8080) ou pelo link na nuvem.', 'error');
            alert('Atenção:\n\nO Google não permite autenticação quando a página é aberta diretamente como arquivo local (file:///).\n\nPara funcionar no seu computador:\n1. Abra a pasta do sistema e execute o "INICIAR_SISTEMA.bat".\n2. O sistema abrirá em http://localhost:8080/ onde o login com Google funciona perfeitamente!');
            if (btnGoogle) btnGoogle.disabled = false;
            if (txtGoogle) txtGoogle.innerText = textoOriginal;
            window._fazendoLogin = false;
            return;
        }

        if (btnGoogle) btnGoogle.disabled = true;
        if (txtGoogle) txtGoogle.innerText = 'Conectando ao Google...';
        
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (persErr) {
            console.warn('Persistência LOCAL fallback:', persErr);
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const cred = await firebase.auth().signInWithPopup(provider);
        if (!cred || !cred.user) {
            throw new Error('Nenhum dado de usuário retornado pelo Google.');
        }

        const user = cred.user;
        const db = firebase.firestore();
        const hoje = new Date().toDateString();
        localStorage.setItem('fc_sessao_data', hoje);
        localStorage.setItem('fc_sessao_uid', user.uid);

        // Limpa resíduos de cache
        sessionStorage.clear();
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

        // 2. Fallback exclusivo da conta master
        if (!empresaId && user.email === 'fabricadecoresgoiania@gmail.com') {
            empresaId = 'emp_fc_moveis';
        }

        // 3. Fallback: procurar por email cadastrado previamente (ex: funcionário criado pelo admin)
        if (!empresaId && user.email) {
            try {
                const snapEmail = await db.collection('usuarios').where('email', '==', user.email).limit(1).get();
                if (!snapEmail.empty) {
                    const dadosExistentes = snapEmail.docs[0].data();
                    if (dadosExistentes.empresaId) {
                        empresaId = dadosExistentes.empresaId;
                        // Vincula o UID do Google para futuros acessos
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

        // 4. Se ainda não possui empresa vinculada: não permite auto-criação de trial grátis sem plano contratado
        if (!empresaId) {
            showToast('Nenhuma assinatura ativa encontrada para este e-mail. Redirecionando para os planos...', 'warning');
            await firebase.auth().signOut();
            localStorage.removeItem('fc_sessao_data');
            localStorage.removeItem('fc_sessao_uid');
            localStorage.removeItem('fc_empresa_ativa');
            sessionStorage.clear();
            window._fazendoLogin = false;
            if (btnGoogle) btnGoogle.disabled = false;
            if (txtGoogle) txtGoogle.innerText = textoOriginal;
            setTimeout(() => {
                window.location.href = 'https://isabella.tech/acesso.html?sistema=fc_gestao';
            }, 2000);
            return;
        }

        localStorage.setItem('fc_empresa_ativa', empresaId);

        // Verificar se a empresa está com status BLOQUEADO ou PENDENTE_PAGAMENTO
        if (empresaId && user.email !== 'fabricadecoresgoiania@gmail.com') {
            try {
                const empDoc = await db.collection('empresas').doc(empresaId).get();
                if (empDoc.exists) {
                    const statusEmp = empDoc.data().status;
                    if (statusEmp === 'PENDENTE_PAGAMENTO') {
                        await firebase.auth().signOut();
                        localStorage.removeItem('fc_empresa_ativa');
                        sessionStorage.clear();
                        window._fazendoLogin = false;
                        if (btnGoogle) btnGoogle.disabled = false;
                        if (txtGoogle) txtGoogle.innerText = textoOriginal;
                        showToast('A ativação da sua loja está pendente de pagamento.', 'warning');
                        setTimeout(() => {
                            window.location.href = 'https://isabella.tech/cadastro.html';
                        }, 2000);
                        return;
                    } else if (statusEmp === 'BLOQUEADO') {
                        await firebase.auth().signOut();
                        localStorage.removeItem('fc_empresa_ativa');
                        sessionStorage.clear();
                        window._fazendoLogin = false;
                        if (btnGoogle) btnGoogle.disabled = false;
                        if (txtGoogle) txtGoogle.innerText = textoOriginal;
                        showToast('O acesso desta empresa está temporariamente bloqueado por pendência financeira. Contate o suporte.', 'error');
                        return;
                    }
                }
            } catch (errCheck) {
                console.warn("Falha na checagem de status da empresa:", errCheck);
            }
        }

        // Definir rota inicial com base nas permissões
        let rotaInicial = 'index.html';
        try {
            const funcDoc = await db.collection('empresas').doc(empresaId).collection('funcionarios').doc(user.uid).get();
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
        } catch(eRota) {
            console.warn('Aviso rota inicial:', eRota);
        }

        showToast('Login com Google realizado com sucesso! Entrando...', 'success');
        setTimeout(() => { window.location.href = rotaInicial; }, 500);

    } catch (e) {
        window._fazendoLogin = false;
        if (btnGoogle) btnGoogle.disabled = false;
        if (txtGoogle) txtGoogle.innerText = textoOriginal;

        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
            showToast('Login com Google cancelado.', 'info');
        } else if (e.code === 'auth/popup-blocked') {
            showToast('O navegador bloqueou a janela pop-up do Google. Permita pop-ups para continuar.', 'error');
        } else if (e.code === 'auth/operation-not-supported-in-this-environment') {
            showToast('O Google exige acesso via servidor (http://localhost ou nuvem). Não funciona via file://.', 'error');
        } else if (e.code === 'auth/account-exists-with-different-credential') {
            showToast('Já existe uma conta com este e-mail usando outro método de login.', 'error');
        } else {
            showToast('Erro ao entrar com Google: ' + (e.message || e), 'error');
            console.error('Erro Google Auth:', e);
        }
    }
}
window.fazerLoginGoogle = fazerLoginGoogle;

// Auto-redirecionar para Isabella.tech caso acesse com parâmetros de cadastro/trial (?tab=cadastro ou ?tab=register)
(function inicializarAbaLoginViaUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = (urlParams.get('tab') || '').toLowerCase();
        if (tab === 'cadastro' || tab === 'register' || tab === 'criar' || tab === 'trial') {
            window.location.href = 'https://isabella.tech/acesso.html?sistema=fc_gestao';
            return;
        }
    } catch (e) {
        console.warn('Erro ao processar parâmetros de URL no login:', e);
    }
})();

