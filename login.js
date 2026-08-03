// Função para os avisos na tela
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast show ${type}`;
    t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')}"></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// Faz a validação usando Firebase Auth
async function fazerLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    if(!u || !p) {
        showToast('Preencha os campos de e-mail e senha!', 'error');
        return;
    }
    
    try {
        await firebase.auth().signInWithEmailAndPassword(u, p);
        showToast('Acesso liberado! Redirecionando...', 'success');
        // O redirecionamento será automático via listener no global.js
    } catch (e) { 
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
            try {
                // Tenta criar a conta automaticamente se não existir
                await firebase.auth().createUserWithEmailAndPassword(u, p);
                showToast('Nova conta criada e acesso liberado!', 'success');
            } catch (err) {
                showToast('Erro ao criar conta ou credenciais inválidas!', 'error'); 
                console.error(err);
            }
        } else {
            showToast('Erro de login: ' + e.message, 'error'); 
            console.error(e);
        }
    }
}

// Inicializa a escuta de sessão para redirecionar automaticamente quando logar
window.onload = () => { initGlobalData(); };