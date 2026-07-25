// Função para os avisos na tela
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast show ${type}`;
    t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')}"></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// Verifica se já está logado e pula a tela de login
window.onload = () => {
    if (sessionStorage.getItem('erp_auth_master') === 'true') {
        window.location.href = 'index.html';
    }
}

// Faz a validação e envia para o index
function fazerLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    if(u === 'admin' && p === '123') {
        // Salva o "crachá" na sessão do navegador
        sessionStorage.setItem('erp_auth_master', 'true');
        showToast('Acesso liberado! Redirecionando...', 'success');
        
        // Redireciona para o sistema
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    } else { 
        showToast('Credenciais incorretas!', 'error'); 
    }
}