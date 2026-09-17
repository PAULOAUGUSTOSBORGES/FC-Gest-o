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
    modoAtual = modo;
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const btnAcao = document.getElementById('btn-acao');
    const subtitulo = document.getElementById('subtitulo-form');
    const inputEmpresa = document.getElementById('login-empresa');
    const esqueciSenhaLink = document.getElementById('esqueci-senha-link');

    if (modo === 'login') {
        if (tabLogin) tabLogin.className = 'flex-1 pb-2 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
        if (tabRegister) tabRegister.className = 'flex-1 pb-2 font-bold text-slate-400 border-b-2 border-transparent transition-colors hover:text-slate-600 dark:hover:text-slate-300';
        if (btnAcao) btnAcao.innerText = 'Entrar';
        if (subtitulo) subtitulo.innerText = 'Acesso ao sistema integrado';
        if (inputEmpresa) inputEmpresa.classList.add('hidden');
        if (esqueciSenhaLink) esqueciSenhaLink.classList.remove('hidden');
    } else {
        if (tabRegister) tabRegister.className = 'flex-1 pb-2 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
        if (tabLogin) tabLogin.className = 'flex-1 pb-2 font-bold text-slate-400 border-b-2 border-transparent transition-colors hover:text-slate-600 dark:hover:text-slate-300';
        if (btnAcao) btnAcao.innerText = 'Criar Conta';
        if (subtitulo) subtitulo.innerText = 'Crie sua conta para solicitar acesso';
        if (inputEmpresa) inputEmpresa.classList.remove('hidden');
        if (esqueciSenhaLink) esqueciSenhaLink.classList.add('hidden');
    }
}

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
            
            // Buscar empresa do usuario
            try {
                const userDoc = await firebase.firestore().collection('usuarios').doc(cred.user.uid).get();
                if (userDoc.exists && userDoc.data().empresaId) {
                    localStorage.setItem('fc_empresa_ativa', userDoc.data().empresaId);
                } else {
                    // Fallback
                    localStorage.setItem('fc_empresa_ativa', 'emp_fc_moveis');
                }
            } catch(e) {
                console.error("Erro ao buscar empresa do usuario", e);
                localStorage.setItem('fc_empresa_ativa', 'emp_fc_moveis');
            }
        }
        showToast('Acesso liberado! Entrando...', 'success');
        window.location.href = 'index.html';
    } catch (e) { 
        window._fazendoLogin = false;
        document.getElementById('btn-acao').innerText = 'Entrar'; document.getElementById('btn-acao').disabled = false;
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials' || e.code === 'auth/wrong-password') {
            showToast('E-mail não encontrado ou senha incorreta!', 'error');
        } else {
            showToast('Erro de login: ' + e.message, 'error'); 
            console.error(e);
        }
    }
}

async function fazerCadastro() {
    const nomeEmpresaInput = document.getElementById('login-empresa');
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const nomeEmpresa = nomeEmpresaInput ? nomeEmpresaInput.value.trim() : '';
    
    if (!nomeEmpresa) {
        showToast('Preencha o nome da sua Loja/Empresa!', 'error');
        return;
    }

    if(!u || !p) {
        showToast('Preencha os campos de e-mail e senha!', 'error');
        return;
    }

    if(p.length < 6) {
        showToast('A senha deve ter no mínimo 6 caracteres!', 'error');
        return;
    }
    
    try {
        window._fazendoLogin = true;
        const btn = document.getElementById('btn-acao');
        btn.innerText = 'Criando Loja...'; btn.disabled = true;
        
        const cred = await firebase.auth().createUserWithEmailAndPassword(u, p);
        if (cred && cred.user) {
            const uid = cred.user.uid;
            // Gerar empresaId unico
            const empresaId = 'loja_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            
            const db = firebase.firestore();
            const batch = db.batch();
            
            // 1. Criar o documento global do usuario
            batch.set(db.collection('usuarios').doc(uid), {
                email: u,
                empresaId: empresaId,
                role: 'admin',
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Criar o documento da empresa
            batch.set(db.collection('empresas').doc(empresaId), {
                nomeEmpresa: nomeEmpresa,
                donoUid: uid,
                status: 'TRIAL',
                plano: 'FREE',
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Criar o perfil de funcionario admin dentro da empresa
            batch.set(db.collection('empresas').doc(empresaId).collection('funcionarios').doc(uid), {
                nome: 'Administrador',
                email: u,
                isAdmin: true,
                perm_dashboard: true,
                perm_pdv: true,
                perm_cadastros: true,
                perm_gestao: true,
                perm_config: true,
                status: 'ativo'
            });

            // 4. Configuracao inicial basica
            batch.set(db.collection('empresas').doc(empresaId).collection('configuracoes').doc('config'), {
                empresa: {
                    nome: nomeEmpresa,
                    fantasia: nomeEmpresa,
                    cnpj: ''
                },
                pdv: {
                    permite_estoque_negativo: false
                }
            });

            // 5. Caixa zerado
            batch.set(db.collection('empresas').doc(empresaId).collection('caixa').doc('caixa_atual'), {
                status: 'fechado',
                saldo: 0,
                historico: [],
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();

            const hoje = new Date().toDateString();
            localStorage.setItem('fc_sessao_data', hoje);
            localStorage.setItem('fc_sessao_uid', uid);
            localStorage.setItem('fc_empresa_ativa', empresaId);
        }
        showToast('Loja criada com sucesso! Entrando...', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    } catch (e) { 
        window._fazendoLogin = false;
        document.getElementById('btn-acao').innerText = 'Criar Conta'; document.getElementById('btn-acao').disabled = false;
        if (e.code === 'auth/email-already-in-use') {
            showToast('Este e-mail já possui uma conta. Vá para a aba Entrar.', 'error');
        } else {
            showToast('Erro ao criar conta: ' + e.message, 'error'); 
            console.error(e);
        }
    }
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
