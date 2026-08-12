// ==========================================
// 1. CONFIGURAÇÕES DO FIREBASE E SEGURANÇA
// ==========================================

// Motor de Tema Instantâneo (Sempre escuro)
(function () {
    document.documentElement.classList.add('dark');
})();

const firebaseConfig = {
    apiKey: "AIzaSyDIlmd3zUTof-lwxyT7j3UxmenPKs_sMJg",
    authDomain: "lojafc-a31f9.firebaseapp.com",
    projectId: "lojafc-a31f9",
    storageBucket: "lojafc-a31f9.firebasestorage.app",
    messagingSenderId: "221558052645",
    appId: "1:221558052645:web:ed942d019727a472096ccc"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();
const auth = firebase.auth();

// Stub Global do DB (para não quebrar as outras telas enquanto são migradas)
let db = {
    produtos: [], categorias: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [],
    financeiro: [], compras: [], funcionarios: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] },
    config: { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } } }
};
window.currentUserInfo = null;

const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatData = (isoStr) => new Date(isoStr).toLocaleString('pt-BR');

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast show ${type}`;
    t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')}"></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ==========================================
// INICIALIZAÇÃO E CONTROLE DE SESSÃO
// ==========================================
function initGlobalData(funcaoDeRenderizacaoDaPagina) {
    auth.onAuthStateChanged(async (user) => {
        const isLoginPage = window.location.pathname.includes('login.html');

        if (!user) {
            if (!isLoginPage) window.location.href = 'login.html';
        } else {
            if (isLoginPage) {
                window.location.href = 'index.html';
                return;
            }

            try {
                const confSnap = await firestore.collection("fc_moveis").doc("config").get();
                if (confSnap.exists) {
                    db.config = confSnap.data();
                } else {
                    await firestore.collection("fc_moveis").doc("config").set(db.config);
                }
            } catch (error) {
                console.error("Erro ao carregar config:", error);
                showToast("Aviso: Erro ao carregar configurações. Usando padrão. (" + error.code + ")", "error");
            }

            // RBAC - CONTROLE DE ACESSO
            try {
                const userSnap = await firestore.collection("funcionarios").doc(user.uid).get();
                if (userSnap.exists) {
                    window.currentUserInfo = userSnap.data();
                } else {
                                                                                      // Usuário não está na tabela (nova conta criada)
                      console.warn("Usuário não cadastrado na base de funcionários.");
                      window.currentUserInfo = { isAdmin: false, perm_dashboard: false, perm_pdv: false, perm_cadastros: false, perm_gestao: false, perm_config: false };
                      
                      try {
                          await firestore.collection('funcionarios').doc(user.uid).set({
                              nome: "NOVO CADASTRO", email: user.email || '', isAdmin: false,
                              perm_dashboard: false, perm_pdv: false, perm_cadastros: false,
                              perm_gestao: false, perm_config: false, dataCadastro: new Date().toISOString(), status: 'PENDENTE'
                          });
                      } catch(e) { console.error("Erro ao registrar no banco:", e); }
                      
                      const avisoAprovacao = document.createElement('div');
                      avisoAprovacao.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:#eab308; color:black; padding:15px 30px; font-size:16px; font-weight:bold; border-radius:10px; text-align:center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);";
                      avisoAprovacao.innerHTML = "<i class='fa-solid fa-clock'></i> Conta Registrada!<br><span style='font-size:13px; font-weight:normal;'>Aguarde o Administrador liberar suas permiss&otilde;es de acesso.</span>";
                      document.body.appendChild(avisoAprovacao);
                }
                aplicarControleDeAcesso();
                mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);

            } catch (err) {
                console.error("Erro de permissões:", err);
            }

            // SEMPRE aplica o tema e inicializa a página
            aplicarIdentidadeVisualGlobal();

            if (funcaoDeRenderizacaoDaPagina) {
                funcaoDeRenderizacaoDaPagina();
            }
        }
    });
}

function aplicarControleDeAcesso() {
    if (!window.currentUserInfo) return;
    const p = window.currentUserInfo;
    const path = window.location.pathname;
    
    // Se for admin, não bloqueia nada
    if (p.isAdmin) return;

    // 1. Bloqueio de Acesso com Alerta Visual
    let bloqueado = false;
    let mensagemBloqueio = '';

    const isIndex = path.includes('index.html') || path.endsWith('/') || path === '';
    
    if (isIndex && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (Visão Geral).';
    } else if ((path.includes('cadastro.html') || path.includes('produtos.html') || path.includes('clientes.html') || path.includes('fornecedores.html')) && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if (path.includes('funcionarios.html')) {
        // A aba de funcionários é bloqueada para todos que não são Admin Master
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar Funcionários.';
    } else if ((path.includes('gestao.html') || path.includes('vendas_gestao.html') || path.includes('financeiro.html') || path.includes('relatorios.html') || path.includes('compras.html')) && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado à Gestão Financeira.';
    } else if ((path.includes('operacao.html') || path.includes('pdv.html') || path.includes('vendas_operacao.html') || path.includes('orcamentos.html') || path.includes('caixa.html')) && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (path.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado às Configurações do Sistema.';
    }

    if (bloqueado) {
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center p-6 animate-[pop_0.3s_ease-out]">
                    <div class="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
                        <i class="fa-solid fa-lock text-5xl"></i>
                    </div>
                    <h2 class="text-3xl font-black text-slate-800 dark:text-white mb-2">Acesso Restrito</h2>
                    <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto">${mensagemBloqueio}</p>
                    <button onclick="window.history.back()" class="mt-8 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md">
                          <i class="fa-solid fa-arrow-left mr-2"></i> Voltar
                      </button>
                      <button onclick="firebase.auth().signOut().then(() => window.location.href='login.html')" class="mt-8 ml-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md">
                          <i class="fa-solid fa-right-from-bracket mr-2"></i> Sair / Trocar Conta
                      </button>
                </div>
            `;
        }
        showToast(mensagemBloqueio, 'error');
        // Impede que os botões do dashboard funcionem se ele for clicado (ex: index.html)
        document.querySelectorAll('.view-section').forEach(el => el.remove());
    }

    // 2. Se for admin master, mostra aba de funcionários. Senão, esconde SÓ a aba de funcionários do menu lateral
    if (!p.isAdmin) {
        document.querySelectorAll('a[href*="view=funcionarios"], [data-target="funcionarios"]').forEach(el => el.classList.add('hidden'));
    }
}

function mostrarNomeUsuarioNoHeader(nome) {
    const header = document.querySelector('header');
    if (!header) return;
    
    const rightDiv = header.lastElementChild;
    if (rightDiv && rightDiv.classList.contains('flex')) {
        if (!document.getElementById('header-user-name-display')) {
            const nameEl = document.createElement('div');
            nameEl.id = 'header-user-name-display';
            nameEl.className = 'hidden sm:block text-sm font-bold text-slate-700 dark:text-slate-200 mr-2';
            rightDiv.insertBefore(nameEl, rightDiv.lastElementChild);
        }
        document.getElementById('header-user-name-display').innerText = nome;
        
        const avatarEl = rightDiv.lastElementChild;
        if (avatarEl && avatarEl.classList.contains('rounded-full')) {
            const partes = nome.split(' ');
            let sigla = partes[0].substring(0, 1).toUpperCase();
            if (partes.length > 1) sigla += partes[1].substring(0, 1).toUpperCase();
            else if (partes[0].length > 1) sigla += partes[0].substring(1, 2).toUpperCase();
            avatarEl.innerText = sigla;
        }
    }
}

// Intercepta cliques nos links para não deixar a tela piscar (navegar) se não tiver permissão
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    
    // Ignora links externos ou vazios
    if (link.hostname !== window.location.hostname) return;
    
    const p = window.currentUserInfo;
    if (!p || p.isAdmin) return; // Se for admin, passa direto
    
    let bloqueado = false;
    let mensagemBloqueio = '';
    
    // Checa as regras do link de destino
    if (link.href.includes('cadastro.html') && link.href.includes('view=funcionarios')) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar Funcionários.';
    } else if (link.href.includes('cadastro.html') && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if (link.href.includes('gestao.html') && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado à Gestão Financeira.';
    } else if (link.href.includes('operacao.html') && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (link.href.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado às Configurações do Sistema.';
    } else if ((link.href.endsWith('index.html') || link.pathname === '/') && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (Visão Geral).';
    }
    
    if (bloqueado) {
        e.preventDefault(); // Impede o navegador de ir pra página!
        showToast(mensagemBloqueio, 'error');
    }
});

// Fim da função


async function salvarKardex(ref, prodId, prodNome, qtd, tipo) {
    try {
        await firestore.collection('movimentacoes').add({
            data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo
        });
    } catch (e) {
        console.error("Erro ao salvar Kardex", e);
    }
}

function saveDB() {
    console.warn("saveDB obsoleto: Use salvamento direto nas coleções do Firestore");
}

async function fazerLogout() {
    await auth.signOut();
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

// ==========================================
// MÓDULO: MOTOR DE TEMA E IDENTIDADE DA EMPRESA
// ==========================================
function aplicarIdentidadeVisualGlobal() {
    if (!db || !db.config) return;

    if (db.config.empresa) {
        const elNome = document.getElementById('menu-empresa-nome');
        const elLogo = document.getElementById('menu-logo');
        const elPlaceholder = document.getElementById('menu-logo-placeholder');

        if (elNome && db.config.empresa.nome) {
            elNome.innerText = db.config.empresa.nome;
        }

        if (elLogo && elPlaceholder && db.config.empresa.logo) {
            elLogo.src = db.config.empresa.logo;
            elLogo.classList.remove('hidden');
            elPlaceholder.classList.add('hidden');
        }
    }

    // O tema agora é fixo e sempre escuro
    aplicarTema();
}

function aplicarTema() {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('tema-escuro');
}

// Removido o listener de preferência de cores do sistema, pois o tema é fixo.






// ===== FUNÇÕES GLOBAIS DE VENDAS (Adicionadas para corrigir erro de botões de Ações) =====

window.reimprimirVenda = function(id) {
    const v = window.db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error');
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÓVEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: REIMPRESSÃO</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data Original: ${new Date(v.data).toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${v.clienteNome}</p><p style="margin: 2px 0;">Vendedor: ${v.vendedor || '-'}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${(v.itens || []).map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${typeof formatMoney === 'function' ? formatMoney(i.preco*i.qtd) : (i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total Final: ${typeof formatMoney === 'function' ? formatMoney(v.tot) : v.tot}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${v.pag}</p></div>`;
    
    document.getElementById('print-area').innerHTML = htmlRecibo; 
    document.getElementById('modal-opcoes-recibo').classList.remove('hidden');
};

window.excluirVenda = function(id) {
    const v = window.db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja excluir este orçamento?' 
        : 'Atenção! Isso fará a exclusão completa desta venda (devolvendo estoque e apagando as parcelas do financeiro). Deseja continuar?';

    abrirConfirmacao('Excluir Operação', msg, async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (window.db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            const pRef = firestore.collection('produtos').doc(String(p.id));
                            batch.update(pRef, { estoque: (p.estoque || 0) + Number(item.qtd || 1) });
                            
                            const kardexRef = firestore.collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: 'Estorno (Exclusão) ' + (v.tipo || 'Venda') + ' #' + numPedStr,
                                prodId: p.id,
                                prodNome: p.nome,
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        } 
                    }); 
                }
                
                const finQuery = await firestore.collection('financeiro').where('origemVendaId', '==', String(id)).get();
                finQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                if(v.pag && typeof v.pag === 'string' && String(v.pag).includes('Dinheiro')) { 
                    let cxAtual = window.db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                    let cxSaldoNovo = (cxAtual.saldo || 0) - (Number(v.valorLiquido) || 0);
                    cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: 'Estorno (Exclusão) ' + (v.tipo || 'Venda') + ' #' + numPedStr, valor: (Number(v.valorLiquido) || 0) });
                    
                    const caixaRef = firestore.collection('fc_moveis').doc('caixa');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }

            const vendaRef = firestore.collection('vendas').doc(String(id));
            batch.delete(vendaRef);

            await batch.commit();
            fecharModalConfirmacao();
            showToast('Operação excluída com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            fecharModalConfirmacao();
            showToast('Erro ao excluir a operação.', 'error');
        }
    });
};
