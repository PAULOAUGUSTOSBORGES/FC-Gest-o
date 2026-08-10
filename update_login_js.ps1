$loginJsPath = ".\login.js"
$content = Get-Content $loginJsPath -Raw -Encoding UTF8

$newLoginJs = @"
// Função para os avisos na tela
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const t = document.createElement('div');
    t.className = `"toast show `" + type;
    t.innerHTML = `<i class="fa-solid `" + (type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')) + `"></i> `" + msg;
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

    if (modo === 'login') {
        tabLogin.className = 'flex-1 pb-2 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
        tabRegister.className = 'flex-1 pb-2 font-bold text-slate-400 border-b-2 border-transparent transition-colors hover:text-slate-600 dark:hover:text-slate-300';
        btnAcao.innerText = 'Entrar';
        subtitulo.innerText = 'Acesso ao sistema integrado';
    } else {
        tabRegister.className = 'flex-1 pb-2 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
        tabLogin.className = 'flex-1 pb-2 font-bold text-slate-400 border-b-2 border-transparent transition-colors hover:text-slate-600 dark:hover:text-slate-300';
        btnAcao.innerText = 'Criar Conta';
        subtitulo.innerText = 'Crie sua conta para solicitar acesso';
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
        const btn = document.getElementById('btn-acao');
        btn.innerText = 'Aguarde...'; btn.disabled = true;
        await firebase.auth().signInWithEmailAndPassword(u, p);
        showToast('Acesso liberado! Redirecionando...', 'success');
        // O redirecionamento será automático via listener no global.js
    } catch (e) { 
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
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    if(!u || !p) {
        showToast('Preencha os campos de e-mail e senha!', 'error');
        return;
    }

    if(p.length < 6) {
        showToast('A senha deve ter no mínimo 6 caracteres!', 'error');
        return;
    }
    
    try {
        const btn = document.getElementById('btn-acao');
        btn.innerText = 'Aguarde...'; btn.disabled = true;
        await firebase.auth().createUserWithEmailAndPassword(u, p);
        showToast('Conta criada com sucesso! Redirecionando...', 'success');
        // O redirecionamento será automático via listener no global.js
    } catch (e) { 
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
window.onload = () => { initGlobalData(); };
"@

Set-Content -Path $loginJsPath -Value $newLoginJs -Encoding UTF8
Write-Host "Updated login.js"
