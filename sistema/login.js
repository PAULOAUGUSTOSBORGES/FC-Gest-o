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
    const inputResponsavel = document.getElementById('login-responsavel');
    const inputTelefone = document.getElementById('login-telefone');
    const inputCidade = document.getElementById('login-cidade');
    const esqueciSenhaLink = document.getElementById('esqueci-senha-link');
    const txtBtnGoogle = document.getElementById('txt-btn-google');
    const badgeTrial = document.getElementById('badge-trial');

    const toggleCamposCadastro = (mostrar) => {
        [inputEmpresa, inputResponsavel, inputTelefone, inputCidade].forEach(el => {
            if (el) {
                if (mostrar) el.classList.remove('hidden');
                else el.classList.add('hidden');
            }
        });
    };

    if (modo === 'login') {
        if (tabLogin) tabLogin.className = 'flex-1 pb-2 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
        if (tabRegister) tabRegister.className = 'flex-1 pb-2 font-bold text-slate-400 border-b-2 border-transparent transition-colors hover:text-slate-600 dark:hover:text-slate-300';
        if (btnAcao) btnAcao.innerText = 'Entrar';
        if (subtitulo) subtitulo.innerText = 'Acesso ao sistema integrado';
        toggleCamposCadastro(false);
        if (esqueciSenhaLink) esqueciSenhaLink.classList.remove('hidden');
        if (txtBtnGoogle) txtBtnGoogle.innerText = 'Entrar com Google';
        if (badgeTrial) badgeTrial.classList.add('hidden');
    } else {
        if (tabRegister) tabRegister.className = 'flex-1 pb-2 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
        if (tabLogin) tabLogin.className = 'flex-1 pb-2 font-bold text-slate-400 border-b-2 border-transparent transition-colors hover:text-slate-600 dark:hover:text-slate-300';
        if (btnAcao) btnAcao.innerText = 'Começar Teste Grátis (7 Dias)';
        if (subtitulo) subtitulo.innerText = 'Preencha seus dados para ativar sua loja';
        toggleCamposCadastro(true);
        if (esqueciSenhaLink) esqueciSenhaLink.classList.add('hidden');
        if (txtBtnGoogle) txtBtnGoogle.innerText = 'Cadastrar com Google';
        if (badgeTrial) badgeTrial.classList.remove('hidden');
    }
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
                    if (empDoc.exists && empDoc.data().status === 'BLOQUEADO') {
                        await firebase.auth().signOut();
                        localStorage.removeItem('fc_empresa_ativa');
                        sessionStorage.clear();
                        window._fazendoLogin = false;
                        btn.innerText = 'Entrar'; btn.disabled = false;
                        showToast('O acesso desta empresa está temporariamente bloqueado por pendência financeira. Contate o suporte.', 'error');
                        return;
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
    const nomeEmpresaInput = document.getElementById('login-empresa');
    const responsavelInput = document.getElementById('login-responsavel');
    const telefoneInput = document.getElementById('login-telefone');
    const cidadeInput = document.getElementById('login-cidade');
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;

    const nomeEmpresa = nomeEmpresaInput ? nomeEmpresaInput.value.trim() : '';
    const nomeResponsavel = responsavelInput ? responsavelInput.value.trim() : '';
    const telefone = telefoneInput ? telefoneInput.value.trim() : '';
    const cidade = cidadeInput ? cidadeInput.value.trim() : '';
    
    if (!nomeEmpresa) {
        showToast('Preencha o nome da sua Loja/Empresa!', 'error');
        return;
    }

    if (!nomeResponsavel) {
        showToast('Preencha o seu nome completo (Responsável)!', 'error');
        return;
    }

    const telNumeros = telefone.replace(/\D/g, '');
    if (!telefone || telNumeros.length < 10) {
        showToast('Preencha seu WhatsApp/Telefone de contato com DDD!', 'error');
        return;
    }

    if (!cidade) {
        showToast('Preencha sua Cidade e Estado (Ex: Goiânia - GO)!', 'error');
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
        sessionStorage.clear();
        localStorage.removeItem('fc_empresa_ativa');
        if (typeof window.FCCache !== 'undefined') {
            try { await window.FCCache.invalidarTudo(); } catch(e) {}
        }

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
                nome: nomeResponsavel,
                telefone: telefone,
                whatsapp: telefone,
                cidade: cidade,
                empresaId: empresaId,
                role: 'admin',
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Criar o documento da empresa (Trial 7 dias com dados completos de contato)
            const vencTrial = new Date();
            vencTrial.setDate(vencTrial.getDate() + 7);
            const dataVencTrialStr = vencTrial.toISOString().split('T')[0];

            batch.set(db.collection('empresas').doc(empresaId), {
                nomeEmpresa: nomeEmpresa,
                responsavel: nomeResponsavel,
                telefone: telefone,
                whatsapp: telefone,
                cidade: cidade,
                donoUid: uid,
                emailAcesso: u,
                status: 'TRIAL',
                plano: 'FREE',
                dataVencimento: dataVencTrialStr,
                modulosLiberados: ['pdv', 'vendas', 'estoque'],
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Criar o perfil de funcionario admin dentro da empresa
            batch.set(db.collection('empresas').doc(empresaId).collection('funcionarios').doc(uid), {
                nome: nomeResponsavel,
                email: u,
                telefone: telefone,
                whatsapp: telefone,
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
                    responsavel: nomeResponsavel,
                    cnpj: '',
                    telefone: telefone,
                    whatsapp: telefone,
                    logo: '',
                    cep: '',
                    rua: '',
                    numero: '',
                    bairro: '',
                    cidade: cidade,
                    uf: ''
                },
                taxas: {
                    'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0,
                    'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
                },
                prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 },
                pdv: {
                    permite_estoque_negativo: false
                },
                loja: {
                    ativa: false,
                    nome: nomeEmpresa,
                    whatsapp: telefone
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

            // Sincronizar com o SaaS Master (banco central de licenças: fcgestao-testes)
            try {
                const sDb = typeof window.obterInstanciaSaaS === 'function' ? window.obterInstanciaSaaS() : null;
                if (sDb) {
                    await sDb.collection('empresas').doc(empresaId).set({
                        id: empresaId,
                        nome: nomeEmpresa,
                        nomeEmpresa: nomeEmpresa,
                        responsavel: nomeResponsavel,
                        donoNome: nomeResponsavel,
                        telefone: telefone,
                        whatsapp: telefone,
                        cidade: cidade,
                        donoUid: uid,
                        emailAcesso: u,
                        status: 'TRIAL',
                        plano: 'FREE',
                        sistemaId: 'fc_gestao',
                        valorMensalidade: 99.00,
                        dataVencimento: dataVencTrialStr,
                        diasTrial: 7,
                        modulosLiberados: ['pdv', 'vendas', 'estoque'],
                        dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
                        origemCadastro: 'auto_cadastro_erp'
                    });
                    console.log('👑 [SaaS Master Sync] Nova empresa registrada no banco central fcgestao-testes com contatos completos:', empresaId);
                }
            } catch (errSaaS) {
                console.warn('[SaaS Master Sync] Registro central será sincronizado posteriormente:', errSaaS.message);
            }

            const hoje = new Date().toDateString();
            localStorage.setItem('fc_sessao_data', hoje);
            localStorage.setItem('fc_sessao_uid', uid);
            localStorage.setItem('fc_empresa_ativa', empresaId);
            
            showToast('Loja criada com sucesso! 7 dias de teste grátis liberados.', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 800);
            return;
        }
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

        // 4. Se ainda não possui empresa vinculada: onboarding de nova loja
        if (!empresaId) {
            let nomeEmpresa = document.getElementById('login-empresa')?.value?.trim();
            if (!nomeEmpresa) {
                const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : '';
                const sugestao = primeiroNome ? `Loja de ${primeiroNome}` : 'Minha Loja';
                nomeEmpresa = window.prompt('Para finalizar seu cadastro com o Google, digite o nome da sua Loja/Empresa:', sugestao);
                if (nomeEmpresa) nomeEmpresa = nomeEmpresa.trim();
            }

            if (!nomeEmpresa) {
                showToast('Cadastro cancelado. O nome da loja é necessário para criar a conta.', 'info');
                await firebase.auth().signOut();
                localStorage.removeItem('fc_sessao_data');
                localStorage.removeItem('fc_sessao_uid');
                window._fazendoLogin = false;
                if (btnGoogle) btnGoogle.disabled = false;
                if (txtGoogle) txtGoogle.innerText = textoOriginal;
                return;
            }

            if (txtGoogle) txtGoogle.innerText = 'Criando Loja...';
            empresaId = 'loja_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

            const batch = db.batch();

            // 1. Criar o documento global do usuario
            batch.set(db.collection('usuarios').doc(user.uid), {
                email: user.email,
                nome: user.displayName || 'Administrador',
                empresaId: empresaId,
                role: 'admin',
                provedor: 'google',
                foto: user.photoURL || '',
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Criar o documento da empresa (Trial 7 dias)
            const vencTrialGoogle = new Date();
            vencTrialGoogle.setDate(vencTrialGoogle.getDate() + 7);
            const dataVencTrialGoogleStr = vencTrialGoogle.toISOString().split('T')[0];

            batch.set(db.collection('empresas').doc(empresaId), {
                nomeEmpresa: nomeEmpresa,
                donoUid: user.uid,
                emailAcesso: user.email,
                provedor: 'google',
                status: 'TRIAL',
                plano: 'FREE',
                dataVencimento: dataVencTrialGoogleStr,
                modulosLiberados: ['pdv', 'vendas', 'estoque'],
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Criar o perfil de funcionario admin dentro da empresa
            batch.set(db.collection('empresas').doc(empresaId).collection('funcionarios').doc(user.uid), {
                nome: user.displayName || 'Administrador',
                email: user.email,
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
                    cnpj: '',
                    telefone: user.phoneNumber || '',
                    logo: user.photoURL || '',
                    cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: ''
                },
                taxas: {
                    'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0,
                    'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
                },
                prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 },
                pdv: {
                    permite_estoque_negativo: false
                },
                loja: {
                    ativa: false,
                    nome: nomeEmpresa
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

            // Sincronizar com o SaaS Master (banco central de licenças: fcgestao-testes)
            try {
                const sDb = typeof window.obterInstanciaSaaS === 'function' ? window.obterInstanciaSaaS() : null;
                if (sDb) {
                    await sDb.collection('empresas').doc(empresaId).set({
                        id: empresaId,
                        nome: nomeEmpresa,
                        nomeEmpresa: nomeEmpresa,
                        donoUid: user.uid,
                        emailAcesso: user.email,
                        status: 'TRIAL',
                        plano: 'FREE',
                        sistemaId: 'fc_gestao',
                        valorMensalidade: 99.00,
                        dataVencimento: dataVencTrialGoogleStr,
                        diasTrial: 7,
                        modulosLiberados: ['pdv', 'vendas', 'estoque'],
                        dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
                        origemCadastro: 'auto_cadastro_google'
                    });
                    console.log('👑 [SaaS Master Sync Google] Nova empresa registrada no SaaS Master:', empresaId);
                }
            } catch (errSaaS) {
                console.warn('[SaaS Master Sync Google] Registro central será sincronizado posteriormente:', errSaaS.message);
            }
        }

        localStorage.setItem('fc_empresa_ativa', empresaId);

        // Verificar se a empresa está com acesso bloqueado
        if (empresaId && user.email !== 'fabricadecoresgoiania@gmail.com') {
            try {
                const empDoc = await db.collection('empresas').doc(empresaId).get();
                if (empDoc.exists && empDoc.data().status === 'BLOQUEADO') {
                    await firebase.auth().signOut();
                    localStorage.removeItem('fc_empresa_ativa');
                    sessionStorage.clear();
                    window._fazendoLogin = false;
                    if (btnGoogle) btnGoogle.disabled = false;
                    if (txtGoogle) txtGoogle.innerText = textoOriginal;
                    showToast('O acesso desta empresa está temporariamente bloqueado por pendência financeira. Contate o suporte.', 'error');
                    return;
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

// Auto-selecionar aba de cadastro/trial via parâmetro de URL (?tab=cadastro ou ?tab=register)
(function inicializarAbaLoginViaUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = (urlParams.get('tab') || '').toLowerCase();
        if (tab === 'cadastro' || tab === 'register' || tab === 'criar' || tab === 'trial') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => mudarAbaLogin('register'));
            } else {
                mudarAbaLogin('register');
            }
        }
        const empresaParam = urlParams.get('empresa') || urlParams.get('loja');
        if (empresaParam) {
            const aplicarEmpresa = () => {
                const inputEmpresa = document.getElementById('login-empresa');
                if (inputEmpresa) inputEmpresa.value = decodeURIComponent(empresaParam);
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', aplicarEmpresa);
            } else {
                aplicarEmpresa();
            }
        }
    } catch (e) {
        console.warn('Erro ao processar parâmetros de URL no login:', e);
    }
})();

