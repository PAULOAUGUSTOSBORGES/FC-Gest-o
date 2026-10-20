// ==============================================================
// MOTOR DE LAYOUT EXPANSIVO & SIDEBAR RETRÁTIL (GLOBAL FC GESTÃO)
// ==============================================================
(function() {
    try {
        if (window.innerWidth >= 768 && localStorage.getItem('fc_layout_expansivo') === 'true') {
            document.documentElement.classList.add('sidebar-recolhida');
            if (document.body) document.body.classList.add('sidebar-recolhida');
        }
    } catch (e) {}
})();

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function validarCPF(cpf) {
    cpf = String(cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.charAt(10));
}
window.validarCPF = validarCPF;

function validarCNPJ(cnpj) {
    cnpj = String(cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1));
}
window.validarCNPJ = validarCNPJ;

function ordenarListaAlfabeticamente(lista, campoOuGetter = 'nome', direcao = 'asc') {
    if (!Array.isArray(lista)) return [];
    return [...lista].sort((a, b) => {
        let valA = a ? (typeof campoOuGetter === 'function' ? campoOuGetter(a) : a[campoOuGetter]) : '';
        let valB = b ? (typeof campoOuGetter === 'function' ? campoOuGetter(b) : b[campoOuGetter]) : '';
        valA = valA !== null && valA !== undefined ? String(valA).trim() : '';
        valB = valB !== null && valB !== undefined ? String(valB).trim() : '';
        const comp = valA.localeCompare(valB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        return direcao === 'desc' ? -comp : comp;
    });
}
window.ordenarListaAlfabeticamente = ordenarListaAlfabeticamente;
window.selecionarProdutoCustoBusca = function(nomeProd) {
    const hiddenId = document.getElementById('relatorio-custo-produto');
    if(!hiddenId) return;
    const produtosDb = (typeof db !== 'undefined' && db.produtos) ? db.produtos : [];
    const prod = produtosDb.find(p => p.nome === nomeProd);
    if(prod) {
        hiddenId.value = prod.id;
    } else {
        hiddenId.value = '';
    }
    if(typeof renderEvolucaoCustos === 'function') {
        renderEvolucaoCustos();
    }
};

// ==========================================
// 1. CONFIGURA??ES DO FIREBASE E SEGURAN?A
// ==========================================
// --- CARREGADOR AUTOMÁTICO DO CLIENTE DE LICENCIAMENTO SAAS MASTER ---
if (typeof document !== 'undefined' && typeof window.consultarLicencaCentral !== 'function') {
    try {
        const s = document.createElement('script');
        const basePath = window.location.pathname.includes('/sistema/') ? '' : 'sistema/';
        s.src = basePath + 'saas_licenca.js';
        document.head.appendChild(s);
    } catch(e) {}
}


// --- GERENCIAMENTO DE SERVICE WORKER & PWA ---
if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    if (window.location.search.includes('limpar_cache=1')) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
            for (let r of regs) r.unregister();
        });
        if (window.caches) {
            caches.keys().then(function(names) {
                for (let n of names) caches.delete(n);
            });
        }
        console.log('[PWA] Cache e Service Worker limpos via URL.');
    } else {
        window.addEventListener('load', function() {
            const swPath = window.location.pathname.includes('/sistema/') ? '../sw.js' : 'sw.js';
            navigator.serviceWorker.register(swPath).catch(function(e) { console.warn('[PWA] SW:', e); });
        });
    }
}
window.limparCacheSistema = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => { for (let r of regs) r.unregister(); });
    }
    if (window.caches) {
        caches.keys().then(names => { for (let n of names) caches.delete(n); });
    }
    localStorage.removeItem('fc_sync_trigger');
    window.location.reload();
};
// ---------------------------------------------

// ==========================================
// MOTOR DE TEMA DO SISTEMA (Dark / Light)
// Sincronização em tempo real entre todas as telas
// Padrão: escuro (dark).
// ==========================================
(function () {
    const tema = localStorage.getItem('fc_theme_sistema') || 'dark';
    const html = document.documentElement;
    const body = document.body;
    if (tema === 'light') {
        html.classList.remove('dark');
        html.classList.add('light');
        html.setAttribute('data-theme', 'light');
        if (body) {
            body.classList.remove('dark');
            body.classList.add('light');
        }
    } else {
        html.classList.add('dark');
        html.classList.remove('light');
        html.setAttribute('data-theme', 'dark');
        if (body) {
            body.classList.add('dark');
            body.classList.remove('light');
        }
    }
})();

function aplicarTemaSistema(tema, broadcast = true) {
    if (tema !== 'dark' && tema !== 'light') {
        tema = 'dark';
    }
    
    const html = document.documentElement;
    const body = document.body;
    if (tema === 'light') {
        html.classList.remove('dark');
        html.classList.add('light');
        html.setAttribute('data-theme', 'light');
        if (body) {
            body.classList.remove('dark');
            body.classList.add('light');
        }
    } else {
        html.classList.add('dark');
        html.classList.remove('light');
        html.setAttribute('data-theme', 'dark');
        if (body) {
            body.classList.add('dark');
            body.classList.remove('light');
        }
    }
    
    localStorage.setItem('fc_theme_sistema', tema);
    _atualizarBotaoTemaSistema();
    
    // Se a tela atual possuir cards de configuração de tema (ex: sistema.html), atualiza-os
    if (typeof window.atualizarCardsTemaTela === 'function') {
        window.atualizarCardsTemaTela(tema);
    }
    
    // Notifica instantaneamente as outras abas/telas do sistema
    if (broadcast) {
        try {
            if ('BroadcastChannel' in window) {
                const bc = new BroadcastChannel('fc_theme_channel');
                bc.postMessage({ tema: tema });
                bc.close();
            }
        } catch (e) { console.error("Erro interno:", e); }
    }
}
window.aplicarTemaSistema = aplicarTemaSistema;

function toggleTemaSistema() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    const novoTema = isDark ? 'light' : 'dark';
    aplicarTemaSistema(novoTema, true);
    
    if (typeof showToast === 'function') {
        showToast(`Tema alterado para Modo ${novoTema === 'dark' ? 'Escuro' : 'Claro'} em todo o sistema!`, 'info');
    }
}
window.toggleTemaSistema = toggleTemaSistema;
window.alternarTemaSistema = toggleTemaSistema;

function _atualizarBotaoTemaSistema() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.sistema-theme-btn-icon').forEach(icon => {
        icon.className = isDark
            ? 'fa-solid fa-moon sistema-theme-btn-icon text-indigo-400'
            : 'fa-solid fa-sun sistema-theme-btn-icon text-amber-500';
    });
    document.querySelectorAll('.sistema-theme-btn-label').forEach(el => {
        el.textContent = isDark ? 'Tema Escuro (Toque p/ Claro)' : 'Tema Claro (Toque p/ Escuro)';
    });
    document.querySelectorAll('#header-btn-tema').forEach(btn => {
        btn.title = isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro';
    });
}

// Ouvinte do evento storage: se o usuário mudar o tema em outra aba, esta aba se atualiza na hora!
window.addEventListener('storage', function (e) {
    if (e.key === 'fc_theme_sistema' && e.newValue) {
        aplicarTemaSistema(e.newValue, false);
    }
});

// Canal Broadcast para sincronização ultrarrápida entre abas abertas
try {
    if ('BroadcastChannel' in window) {
        const bcListen = new BroadcastChannel('fc_theme_channel');
        bcListen.onmessage = function (e) {
            if (e.data && e.data.tema) {
                aplicarTemaSistema(e.data.tema, false);
            }
        };
    }
} catch (e) { console.error("Erro interno:", e); }

// Injeta os botões de tema (no rodapé da sidebar e no topo do header)
document.addEventListener('DOMContentLoaded', function () {
    // 0. Inicialização do Modo Expansivo (Sidebar Retrátil no Desktop)
    try {
        const isExpansivo = window.innerWidth >= 768 && localStorage.getItem('fc_layout_expansivo') === 'true';
        if (isExpansivo) {
            document.body.classList.add('sidebar-recolhida');
            document.documentElement.classList.add('sidebar-recolhida');
        }
        if (typeof atualizarBotoesModoExpansivo === 'function') {
            atualizarBotoesModoExpansivo(isExpansivo);
        }
    } catch(e) {}

    // Injeta botão de recolher no cabeçalho da sidebar no desktop
    const sidebarTop = document.querySelector('#sidebar .p-5.flex.items-center.justify-between');
    if (sidebarTop && !document.getElementById('btn-recolher-sidebar-desktop')) {
        const btnDesktop = document.createElement('button');
        btnDesktop.id = 'btn-recolher-sidebar-desktop';
        btnDesktop.type = 'button';
        btnDesktop.onclick = function(e) {
            e.stopPropagation();
            toggleMenu();
        };
        btnDesktop.className = 'hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0';
        btnDesktop.title = 'Recolher Menu (Modo Expansivo) [Alt+M]';
        btnDesktop.innerHTML = '<i class="fa-solid fa-angles-left text-sm"></i>';
        sidebarTop.appendChild(btnDesktop);
    }

    // 1. Botão no rodapé da Sidebar
    const sidebarBottom = document.querySelector('#sidebar .p-4.border-t');
    if (sidebarBottom && !document.getElementById('btn-tema-sistema')) {
        const isDark = document.documentElement.classList.contains('dark');
        const btn = document.createElement('button');
        btn.id = 'btn-tema-sistema';
        btn.onclick = toggleTemaSistema;
        btn.className = 'w-full flex items-center justify-center gap-2 text-sm font-medium transition-all mt-2 py-2.5 px-3 rounded-xl cursor-pointer shadow-sm';
        btn.title = 'Alternar Modo Escuro / Claro';
        btn.innerHTML = `
            <i class="${isDark ? 'fa-solid fa-moon text-indigo-400' : 'fa-solid fa-sun text-amber-500'} sistema-theme-btn-icon"></i>
            <span class="sistema-theme-btn-label text-xs font-semibold">${isDark ? 'Tema Escuro (Toque p/ Claro)' : 'Tema Claro (Toque p/ Escuro)'}</span>
        `;
        sidebarBottom.prepend(btn);
    }

    // 2. Botão no Header (acesso instantâneo direto no celular e PC sem precisar abrir menu)
    const headerActions = document.getElementById('header-right-actions') || 
        (document.querySelector('header') && document.querySelector('header').children.length > 1 ? document.querySelector('header').lastElementChild : null);
    if (headerActions) { headerActions.classList.add('flex-nowrap', 'shrink-0'); }
    if (headerActions && !document.getElementById('header-btn-tema')) {
        const isDark = document.documentElement.classList.contains('dark');
        const headerBtn = document.createElement('button');
        headerBtn.id = 'header-btn-tema';
        headerBtn.onclick = toggleTemaSistema;
        headerBtn.className = 'w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer shadow-sm';
        headerBtn.title = isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro';
        headerBtn.innerHTML = `<i class="${isDark ? 'fa-solid fa-moon text-indigo-400' : 'fa-solid fa-sun text-amber-500'} sistema-theme-btn-icon"></i>`;
        headerActions.prepend(headerBtn);
    }

    // 3. Botão SINCRONIZAR no Header (Repositório Local com Firebase)
    if (headerActions && !document.getElementById('header-btn-sync')) {
        const syncBtn = document.createElement('button');
        syncBtn.id = 'header-btn-sync';
        syncBtn.type = 'button';
        syncBtn.onclick = function(e) {
            if (window.FCCache && typeof window.FCCache.sincronizarComFirebase === 'function') {
                const forcar = Boolean(e && (e.shiftKey || e.ctrlKey));
                window.FCCache.sincronizarComFirebase(false, { forcarCompleto: forcar });
            } else if (typeof window.showToast === 'function') {
                window.showToast('Repositório local já atualizado.', 'info');
            }
        };
        syncBtn.className = 'h-9 px-2 sm:px-3 flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] sm:text-xs font-bold tracking-wider transition-all cursor-pointer shadow-sm select-none border border-slate-600 shrink-0 relative';
        syncBtn.title = 'Sincronização Delta Inteligente com o Firebase · Segure Shift para forçar carga completa';
        syncBtn.innerHTML = `
            <span id="header-btn-sync-text" class="hidden sm:inline">SINCRONIZAR</span>
            <span id="header-btn-sync-box" class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-white/10 text-white text-xs">
                <i id="header-btn-sync-icon" class="fa-solid fa-arrows-rotate"></i>
            </span>
            <span id="header-btn-sync-badge" class="hidden absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-slate-950 rounded-full shadow-md leading-none border border-slate-900">0</span>
        `;
        headerActions.prepend(syncBtn);
    }

    _atualizarBotaoTemaSistema();
    _iniciarRodapesSistema();
    _destacarMenuAtualGlobal();
});

// Sincronização e destaque automático do item ativo do menu lateral
function _destacarMenuAtualGlobal() {
    try {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const fullPath = window.location.pathname || '';
        let file = fullPath.split('/').pop().split('\\').pop() || '';
        file = file.split('?')[0].split('#')[0].toLowerCase().trim();

        if (!file || file === '' || file === 'sistema') {
            file = 'index.html';
        }

        const navLinks = Array.from(sidebar.querySelectorAll('a.nav-btn, nav a'));
        if (!navLinks.length) return;

        const aliases = {
            'index.html': ['index.html', 'dashboard'],
            'marketing.html': ['marketing.html', 'marketing'],
            'relatorios.html': ['relatorios.html', 'relatorios'],
            'suporte.html': ['suporte.html', 'suporte'],
            'sistema.html': ['sistema.html', 'config', 'sistema'],
            'pdv.html': ['pdv.html', 'pdv'],
            'produtos.html': ['produtos.html', 'produtos'],
            'clientes.html': ['clientes.html', 'clientes'],
            'fornecedores.html': ['fornecedores.html', 'fornecedores'],
            'funcionarios.html': ['funcionarios.html', 'funcionarios'],
            'financeiro.html': ['financeiro.html', 'financeiro'],
            'conciliacao.html': ['conciliacao.html', 'conciliacao'],
            'caixa.html': ['caixa.html', 'caixa'],
            'caixa_loja.html': ['caixa_loja.html', 'caixa_loja'],
            'compras.html': ['compras.html', 'compras'],
            'agenda.html': ['agenda.html', 'agenda'],
            'orcamentos.html': ['orcamentos.html', 'orcamentos'],
            'vendas_operacao.html': ['vendas_operacao.html', 'vendas_operacao'],
            'fiscal.html': ['fiscal.html', 'fiscal']
        };

        const targets = aliases[file] || [file];

        let linkEncontrado = null;

        navLinks.forEach(link => {
            const href = (link.getAttribute('href') || '').toLowerCase().trim();
            const hrefFile = href.split('/').pop().split('\\').pop().split('?')[0].split('#')[0];
            const dataTarget = (link.getAttribute('data-target') || '').toLowerCase().trim();

            const match = targets.some(t => (hrefFile && hrefFile === t) || (dataTarget && dataTarget === t));
            if (match && !linkEncontrado) {
                linkEncontrado = link;
            } else if (!match) {
                link.classList.remove('bg-blue-600', 'bg-sky-600', 'text-white', 'active', 'shadow-md', 'shadow-lg', 'shadow-sky-600/20');
                if (!link.classList.contains('text-emerald-400') && !link.classList.contains('text-sky-400')) {
                    link.classList.add('text-slate-300');
                }
            }
        });

        if (linkEncontrado) {
            linkEncontrado.classList.add('bg-blue-600', 'text-white', 'active');
            linkEncontrado.classList.remove('hover:bg-slate-800', 'text-slate-300', 'text-sky-400');
        }
    } catch (err) {
        console.warn('[Global] Erro ao sincronizar link ativo do menu:', err);
    }
}
window._destacarMenuAtualGlobal = _destacarMenuAtualGlobal;

// --- INJEÇÃO GLOBAL: RODAPÉ DA EMPRESA CRIADORA (PRIMAS TECNOLOGIA) & VERSÃO 1.0 ---
function _obterCaminhoIconePrimas() {
    return window.location.pathname.includes('/sistema/') ? '../icons/icone_primas.png' : './icons/icone_primas.png';
}

function _injetarRodapeConteudo() {
    // Remove qualquer rodapé que possa ter sido injetado anteriormente na sidebar
    const oldSidebarFooter = document.getElementById('sidebar-footer-brand');
    if (oldSidebarFooter) oldSidebarFooter.remove();

    const scrollContainer = document.querySelector('main .overflow-y-auto') || document.querySelector('main > div.flex-1');
    if (!scrollContainer) return;

    // Configura o scrollContainer como flex-col para que o footer fique fixado no fundo
    // mesmo em telas curtas, e vá para o final do scroll após o usuário rolar em telas longas
    scrollContainer.style.setProperty('display', 'flex', 'important');
    scrollContainer.style.setProperty('flex-direction', 'column', 'important');
    scrollContainer.style.setProperty('width', '100%', 'important');

    Array.from(scrollContainer.children).forEach(child => {
        if (child.id !== 'fc-global-page-footer') {
            child.style.setProperty('width', '100%', 'important');
            child.style.setProperty('min-width', '0', 'important');
            child.style.setProperty('flex-shrink', '0', 'important');
            child.style.setProperty('flex-grow', '0', 'important');
        }
    });

    let footer = document.getElementById('fc-global-page-footer');
    if (!footer) {
        const iconePrimas = _obterCaminhoIconePrimas();
        footer = document.createElement('footer');
        footer.id = 'fc-global-page-footer';
        footer.className = 'w-full mt-auto shrink-0 pt-6 pb-2 border-t border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs no-print select-none';
        footer.innerHTML = `
            <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-center sm:text-left">
                <div class="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <span class="font-extrabold text-slate-800 dark:text-slate-200">FC Gestão</span>
                    <span class="text-slate-300 dark:text-slate-700">•</span>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-mono" title="Versão Atual">
                        <i class="fa-solid fa-code-commit text-[10px]"></i> Versão 1.0
                    </span>
                    <span class="text-slate-300 dark:text-slate-700">•</span>
                    <span class="text-[11px] text-slate-500 dark:text-slate-400">Sistema de Gestão Comercial</span>
                </div>
                <div class="flex items-center gap-2 justify-center">
                    <span class="text-[11px] text-slate-500 dark:text-slate-400">Desenvolvido por</span>
                    <a href="https://primas.tech" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 font-extrabold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group" title="Conhecer Primas Tecnologia">
                        <img src="${iconePrimas}" alt="Primas Tecnologia" class="w-4 h-4 rounded object-contain inline-block group-hover:scale-110 transition-transform" onerror="this.style.display='none'">
                        <span>Primas Tecnologia</span>
                    </a>
                </div>
            </div>
        `;
    }

    footer.style.setProperty('margin-top', 'auto', 'important');
    footer.style.setProperty('flex-shrink', '0', 'important');
    footer.style.setProperty('width', '100%', 'important');

    if (scrollContainer.lastElementChild !== footer) {
        scrollContainer.appendChild(footer);
    }
}

function _iniciarRodapesSistema() {
    _injetarRodapeConteudo();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _iniciarRodapesSistema);
} else {
    _iniciarRodapesSistema();
}
window.addEventListener('load', _iniciarRodapesSistema);

// Garante que o rodapé nunca se perca após renderizações dinâmicas
setInterval(function () {
    const sc = document.querySelector('main .overflow-y-auto') || document.querySelector('main > div.flex-1');
    const ft = document.getElementById('fc-global-page-footer');
    if (sc && (!ft || sc.lastElementChild !== ft)) {
        _iniciarRodapesSistema();
    }
}, 1000);



// As credenciais e inicialização do Firebase agora vêm de sistema/config_banco.js

const firestore = firebase.firestore();

// --- INICIO MULTI-TENANT ---
window.getEmpresaRef = function() {
    const empId = localStorage.getItem('fc_empresa_ativa');
    if (!empId) {
        console.error("Nenhuma empresa ativa encontrada no login!");
        // Fallback temporario para nao quebrar em sessoes antigas
        return firestore.collection('empresas').doc('emp_fc_moveis');
    }
    return firestore.collection('empresas').doc(empId);
};
// --- FIM MULTI-TENANT ---

// Interceptar chamadas HTTPS para enviar empId automaticamente para as funções do Backend
if (typeof firebase !== 'undefined' && firebase.functions) {
    const _origFunctions = firebase.functions;
    firebase.functions = function(...args) {
        const fnInstance = _origFunctions.apply(this, args);
        if (fnInstance && !fnInstance._interceptorEmpIdAtivo) {
            const _origCallable = fnInstance.httpsCallable.bind(fnInstance);
            fnInstance.httpsCallable = function(name, options) {
                const callable = _origCallable(name, options);
                return async function(data) {
                    const payload = (typeof data === 'object' && data !== null) ? { ...data } : {};
                    if (!payload.empId) {
                        payload.empId = window.currentEmpresaId || localStorage.getItem('fc_empresa_ativa') || '';
                    }
                    return callable(payload);
                };
            };
            fnInstance._interceptorEmpIdAtivo = true;
        }
        return fnInstance;
    };
}

// ATIVAR MODO OFFLINE (Apenas em ambiente HTTP/HTTPS com servidor)
if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    firestore.enablePersistence({ synchronizeTabs: true })
        .catch(function(err) {
            if (err.code == 'failed-precondition') {
                console.warn("Múltiplas abas abertas. A persistência offline funcionará apenas na primeira aba.");
            } else if (err.code == 'unimplemented') {
                console.warn("Navegador não suporta persistência offline do Firebase.");
            }
        });
}

const auth = firebase.auth();

// Stub Global do DB (para não quebrar as outras telas enquanto são migradas)
var db = {
    produtos: [], categorias: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [],
    financeiro: [], compras: [], funcionarios: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] },
    config: { 
        empresa: { nome: '', fantasia: '', cnpj: '', telefone: '', logo: '' },
        taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } },
        prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 }
    }
};
window.db = db;

// ==========================================
// PRÉ-CARGA DO CACHE: popula o db com dados do
// sessionStorage antes do Firebase responder.
// Isso faz as telas carregarem instantaneamente.
// ==========================================
(function _preCarregarCacheGlobal() {
    // Aguarda o FCCache estar disponível (carregado via <script>)
    // Se ainda não estiver, agenda para quando o DOM estiver pronto
    function tentarPreCarregar() {
        if (typeof window.FCCache === 'undefined') return;
        const colecoesPrincipais = ['produtos', 'clientes', 'fornecedores', 'funcionarios', 'vendas', 'financeiro', 'compras', 'categorias', 'movimentacoes'];
        colecoesPrincipais.forEach(function(col) {
            if (window.FCCache.isValido(col)) {
                const dados = window.FCCache.get(col);
                if (dados !== null) {
                    db[col] = dados;
                    if (col === 'produtos' && Array.isArray(dados) && dados.length > 0) {
                        window._produtosCarregados = true;
                    }
                }
            }
        });
        // Carrega config do cache
        const empAtivaIdPre = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
        if (window.FCCache.isValido('config')) {
            const configCache = window.FCCache.get('config');
            if (configCache) db.config = configCache;
        } else if (empAtivaIdPre === 'emp_fc_moveis' && window.FCCache.isValido('fc_moveis_config')) {
            const configCache = window.FCCache.get('fc_moveis_config');
            if (configCache) db.config = configCache;
        }
        // Carrega caixa do cache
        if (window.FCCache.isValido('caixa')) {
            const caixaCache = window.FCCache.get('caixa');
            if (caixaCache) db.caixa = caixaCache;
        } else if (empAtivaIdPre === 'emp_fc_moveis' && window.FCCache.isValido('fc_moveis_caixa')) {
            const caixaCache = window.FCCache.get('fc_moveis_caixa');
            if (caixaCache) db.caixa = caixaCache;
        }
    }
    // Tenta pré-carregar imediatamente e também ao carregar o DOM
    tentarPreCarregar();
    document.addEventListener('DOMContentLoaded', tentarPreCarregar);
})();
window.currentUserInfo = null;

// ==========================================
// Monitoramento de Conexão (Online/Offline)
// ==========================================
function atualizarBadgeConexao(isOnline) {
    const titleEl = document.getElementById('menu-empresa-nome');
    if (titleEl && titleEl.nextElementSibling) {
        const badge = titleEl.nextElementSibling;
        if (isOnline) {
            badge.innerText = 'Sistema Ativo';
            badge.classList.remove('text-red-400');
            badge.classList.add('text-emerald-400');
        } else {
            badge.innerText = 'Modo Offline';
            badge.classList.remove('text-emerald-400');
            badge.classList.add('text-red-400');
        }
    }
}

window.addEventListener('offline', () => {
    showToast('Você está offline! Modo de trabalho local ativado.', 'warning');
    document.body.classList.add('is-offline');
    atualizarBadgeConexao(false);
});

window.addEventListener('online', () => {
    showToast('Conexão restabelecida! Sincronizando dados...', 'success');
    document.body.classList.remove('is-offline');
    atualizarBadgeConexao(true);
});

// Força checagem na inicialização
if (!navigator.onLine) {
    setTimeout(() => { atualizarBadgeConexao(false); }, 1000);
}

const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
window.formatMoney = formatMoney;

// ==========================================
// FUN??ES DE MÁSCARA DE DINHEIRO
// ==========================================
function applyMoneyMask(el) {
    let raw = String(el.value || '');
    let isNegative = raw.trim().startsWith('-');
    let digits = raw.replace(/\D/g, "");
    if (!digits) digits = "0";
    digits = parseInt(digits, 10).toString();
    digits = digits.padStart(3, '0');
    
    let decimals = digits.slice(-2);
    let integers = digits.slice(0, -2);
    
    integers = integers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    el.value = (isNegative ? "-" : "") + integers + "," + decimals;
}

function parseInputMoney(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    let str = String(val).trim();
    
    if (str.includes(',')) {
        str = str.replace(/\./g, "").replace(",", ".");
    }
    
    let parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

// ==========================================
// MOTOR DE CAIXA INDIVIDUAL POR CONTA DE FUNCIONÁRIO
// ==========================================
window.obterOperadorAtual = function() {
    const user = window.currentUser || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null);
    const uid = user ? user.uid : localStorage.getItem('fc_sessao_uid');
    const nome = window.currentUserInfo?.nome || (user?.email ? user.email.split('@')[0] : 'Operador');
    const email = user ? user.email : '';
    const isAdmin = !!window.currentUserInfo?.isAdmin;
    return { uid, nome, email, isAdmin };
};

window.obterCaixaDocId = function(operadorUid) {
    const op = window.obterOperadorAtual();
    const uid = operadorUid || op.uid;
    return uid ? 'caixa_' + uid : 'caixa_atual';
};

window.obterCaixaDocRef = function(operadorUid) {
    const docId = window.obterCaixaDocId(operadorUid);
    return window.getEmpresaRef().collection('caixa').doc(docId);
};

function formatMoneyInput(val) {
    let num = Number(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

document.addEventListener('input', function(e) {
    if (e.target && e.target.dataset && e.target.dataset.mask === 'money') {
        applyMoneyMask(e.target);
    }
}, true); // Fase de Captura: roda ANTES de qualquer oninput inline nos inputs!

document.addEventListener('change', function(e) {
    if (e.target && e.target.dataset && e.target.dataset.mask === 'money') {
        applyMoneyMask(e.target);
    }
}, true);

document.addEventListener('focusin', function(e) {
    if (e.target && e.target.dataset && e.target.dataset.mask === 'money') {
        applyMoneyMask(e.target);
        if (e.target.value === '0,00' || e.target.value === '' || e.target.value === '0') {
            e.target.select();
        }
    }
}, true);

// Interceptar atribuições de '.value' em inputs de dinheiro para auto-formatar floats
let isMasking = false;
const originalValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
Object.defineProperty(HTMLInputElement.prototype, 'value', {
    set: function(newVal) {
        if (this.type === 'color' && (!newVal || newVal === "")) {
            newVal = "#000000";
        }
        if (this.dataset && this.dataset.mask === 'money' && !isMasking) {
            if (newVal !== '' && newVal !== null && newVal !== undefined) {
                if (typeof newVal === 'number' || !String(newVal).includes(',')) {
                    let parsed = parseFloat(newVal);
                    if (!isNaN(parsed)) newVal = parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
            isMasking = true;
            originalValueSetter.call(this, newVal);
            applyMoneyMask(this);
            isMasking = false;
        } else {
            originalValueSetter.call(this, newVal);
        }
    }
});

// Observer para formatar inputs injetados via innerHTML (ex: tabelas)
const moneyMaskObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { 
                    if (node.dataset && node.dataset.mask === 'money') {
                        if (node.value && !node.value.includes(',')) {
                            let p = parseFloat(node.value);
                            if (!isNaN(p)) node.value = p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                        applyMoneyMask(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('[data-mask="money"]').forEach(el => {
                            if (el.value && !el.value.includes(',')) {
                                let p = parseFloat(el.value);
                                if (!isNaN(p)) el.value = p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                            applyMoneyMask(el);
                        });
                    }
                }
            });
        }
    });
});
moneyMaskObserver.observe(document.body, { childList: true, subtree: true });
const formatData = (isoStr) => {
    if (!isoStr) return '-';
    if (typeof isoStr === 'object' && isoStr.seconds !== undefined) {
        return new Date(isoStr.seconds * 1000).toLocaleString('pt-BR');
    }
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
};
window.formatData = formatData;

function formatarDataParaInputDate(val) {
    if (!val) return '';
    try {
        if (typeof val === 'object' && typeof val.toDate === 'function') {
            return val.toDate().toISOString().split('T')[0];
        }
        if (typeof val === 'object' && val.seconds !== undefined) {
            return new Date(val.seconds * 1000).toISOString().split('T')[0];
        }
        if (val instanceof Date) {
            return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0];
        }
        if (typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        }
        const str = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.split('T')[0].substring(0, 10);
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
            const parts = str.split('/');
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
}
window.formatarDataParaInputDate = formatarDataParaInputDate;

function parseDataGenerica(val) {
    if (!val) return null;
    try {
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        if (typeof val === 'object' && typeof val.toDate === 'function') {
            const d = val.toDate();
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === 'object' && val.seconds !== undefined) {
            const d = new Date(val.seconds * 1000);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === 'string') {
            val = val.trim();
            if (!val) return null;
            // Formato brasileiro DD/MM/YYYY [HH:mm[:ss]]
            const brMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
            if (brMatch) {
                const dia = parseInt(brMatch[1], 10);
                const mes = parseInt(brMatch[2], 10) - 1;
                const ano = parseInt(brMatch[3], 10);
                const hora = brMatch[4] ? parseInt(brMatch[4], 10) : 12;
                const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
                const seg = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
                const d = new Date(ano, mes, dia, hora, min, seg);
                return isNaN(d.getTime()) ? null : d;
            }
            // Formato ISO YYYY-MM-DD puro ou com meia-noite UTC (evita cair no dia anterior no UTC-3)
            const isoDateOnly = val.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/);
            if (isoDateOnly) {
                const ano = parseInt(isoDateOnly[1], 10);
                const mes = parseInt(isoDateOnly[2], 10) - 1;
                const dia = parseInt(isoDateOnly[3], 10);
                const d = new Date(ano, mes, dia, 12, 0, 0);
                return isNaN(d.getTime()) ? null : d;
            }
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
    } catch(e) {
        return null;
    }
    return null;
}
window.parseDataGenerica = parseDataGenerica;

function normalizarTexto(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
window.normalizarTexto = normalizarTexto;

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Evita exibir toasts idênticos repetidos simultaneamente na tela
    const toastsVisiveis = container.querySelectorAll('.toast');
    const msgLimpa = String(msg || '').trim().replace(/\s+/g, ' ');
    for (let el of toastsVisiveis) {
        if (el.textContent.trim().replace(/\s+/g, ' ').includes(msgLimpa)) {
            return;
        }
    }

    const t = document.createElement('div');
    t.className = `toast show ${type}`;
    t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')}"></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ==========================================
// INICIALIZA??O E CONTROLE DE SESS?O
// ==========================================
function initGlobalData(funcaoDeRenderizacaoDaPagina) {
    // Garante persistência permanente da sessão no Firebase Auth
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
        }
    } catch (e) {}

    const isLoginPage = window.location.pathname.toLowerCase().includes('login.html') || window.location.href.toLowerCase().includes('login.html');

    // 0ms Optimistic Pre-Auth Render:
    // Se há sessão local válida para hoje, pré-carrega usuário, empresa e aciona renderização antes do auth do Firebase responder!
    if (!isLoginPage) {
        const hoje = new Date().toDateString();
        const sessaoData = localStorage.getItem('fc_sessao_data');
        const sessaoUid = localStorage.getItem('fc_sessao_uid');
        const empId = localStorage.getItem('fc_empresa_ativa');

        if (sessaoUid && sessaoData === hoje && empId) {
            try {
                // Recupera cache da empresa
                const cacheEmpKey = 'fc_empresa_cache_' + empId;
                const cacheEmpLocal = localStorage.getItem(cacheEmpKey);
                if (cacheEmpLocal) {
                    try { window.currentEmpresaData = JSON.parse(cacheEmpLocal); } catch(e) {}
                }
                const nomeEmpresaAtiva = (window.currentEmpresaData && (window.currentEmpresaData.nomeEmpresa || window.currentEmpresaData.nome)) || localStorage.getItem('fc_nome_empresa_ativa') || (empId === 'emp_fc_moveis' ? 'FC Móveis' : 'Minha Loja');
                if (typeof aplicarIdentidadeVisualGlobal === 'function') {
                    aplicarIdentidadeVisualGlobal();
                }

                // Recupera cache do usuário
                const userCacheKey = 'funcionario_' + sessaoUid;
                let userCache = (typeof window.FCCache !== 'undefined') && window.FCCache.get(userCacheKey);
                if (!userCache) {
                    try {
                        const localU = localStorage.getItem('fc_user_cache_' + sessaoUid);
                        if (localU) userCache = JSON.parse(localU);
                    } catch(e) {}
                }
                if (userCache) {
                    window.currentUserInfo = userCache;
                    if (typeof mostrarNomeUsuarioNoHeader === 'function') {
                        mostrarNomeUsuarioNoHeader(userCache.isAdmin ? 'Admin Master' : `Func.: ${userCache.nome || 'Usuário'}`);
                    }
                    if (typeof aplicarIdentidadeVisualGlobal === 'function') {
                        aplicarIdentidadeVisualGlobal();
                    }
                }

                // Dispara renderização inicial instantânea somente se a rota for permitida
                const rotaPreCheck = typeof window.verificarPermissaoRota === 'function' ? window.verificarPermissaoRota(window.location.pathname, userCache) : { permitido: true };
                if (rotaPreCheck && !rotaPreCheck.permitido) {
                    window.__paginaBloqueadaPorPermissao = true;
                    window.__paginaBloqueadaPorPlano = true;
                    if (rotaPreCheck.bloqueioPlano && typeof window.aplicarBloqueioPlano === 'function') {
                        window.aplicarBloqueioPlano(rotaPreCheck.modulo, rotaPreCheck.nomeModulo);
                    }
                    const main = document.querySelector('main');
                    if (main) {
                        main.style.visibility = 'hidden';
                        main.innerHTML = '';
                    }
                } else if (funcaoDeRenderizacaoDaPagina && !window.__preRenderizadoOtimista) {
                    window.__preRenderizadoOtimista = true;
                    try {
                        funcaoDeRenderizacaoDaPagina();
                    } catch(ePre) {
                        console.warn("Pré-render otimista inicial falhou suavemente:", ePre);
                    }
                }
            } catch (errPre) {
                console.warn("Aviso no pré-render otimista:", errPre);
            }
        }
    }

    auth.onAuthStateChanged(async (user) => {
        window.currentUser = user;
        const isLoginPage = window.location.pathname.toLowerCase().includes('login.html') || window.location.href.toLowerCase().includes('login.html');

        if (!user) {
            if (!isLoginPage) window.location.href = 'login.html';
            return;
        }

function isContaMasterGlobal(email) {
    if (!email) return false;
    const e = email.toLowerCase().trim();
    return e === 'fabricadecoresgoiania@gmail.com' || e === 'pauloaugusto.silvaborges@gmail.com';
}
window.isContaMasterGlobal = isContaMasterGlobal;

        // Se já está logado e abriu a tela de login, vai direto para o sistema
        if (isLoginPage) {
            if (!window._fazendoLogin && !sessionStorage.getItem('fc_google_redirect_pendente')) {
                window.location.href = 'index.html';
            }
            return;
        }

        // Controle de Sessão: encerra EXCLUSIVAMENTE se passar da meia-noite
        const hoje = new Date().toDateString();
        const sessaoData = localStorage.getItem('fc_sessao_data');

        if (sessaoData && sessaoData !== hoje) {
            console.log("Virada da meia-noite detectada. Encerrando sessão do dia anterior...");
            localStorage.removeItem('fc_sessao_data');
            localStorage.removeItem('fc_sessao_uid');
            sessionStorage.setItem('fc_sessao_expirada_msg', 'Meia-noite atingida: sua sessão diária encerrou. Faça login para o novo dia.');
            try { await auth.signOut(); } catch (e) {}
            window.location.href = 'login.html';
            return;
        }

        // Sessão do mesmo dia válida: mantém ativa sem deslogar por inatividade
        const ultimoUid = localStorage.getItem('fc_sessao_uid');
        if (ultimoUid && ultimoUid !== user.uid) {
            console.log("Troca de usuário detectada! Limpando cache do navegador...");
            sessionStorage.clear();
            localStorage.removeItem('fc_empresa_ativa');
        }

        localStorage.setItem('fc_sessao_data', hoje);
        localStorage.setItem('fc_sessao_uid', user.uid);

        // Busca ou valida a empresa deste usuário no Firestore
        let empId = localStorage.getItem('fc_empresa_ativa');
        if (!empId) {
            try {
                const uDoc = await firestore.collection('usuarios').doc(user.uid).get();
                if (uDoc.exists && uDoc.data().empresaId) {
                    empId = uDoc.data().empresaId;
                    localStorage.setItem('fc_empresa_ativa', empId);
                } else if (isContaMasterGlobal(user.email)) {
                    empId = 'emp_fc_moveis';
                    localStorage.setItem('fc_empresa_ativa', empId);
                }
            } catch(e) {
                console.error("Erro ao resolver empresa do usuário:", e);
                if (isContaMasterGlobal(user.email)) {
                    empId = 'emp_fc_moveis';
                    localStorage.setItem('fc_empresa_ativa', empId);
                }
            }
        }

        // 3. Verificação de Bloqueio por Inadimplência e Carregamento de Plano SaaS (Integrado ao SaaS Master)
        if (empId) {
            try {
                let empData = null;
                const cacheEmpKey = 'fc_empresa_cache_' + empId;
                const cacheEmpLocal = localStorage.getItem(cacheEmpKey);
                if (cacheEmpLocal) {
                    try { empData = JSON.parse(cacheEmpLocal); } catch(e) {}
                }

                // Consulta ao servidor central do SaaS Master (carregamento imediato via cache local < 1ms)
                if (typeof window.consultarLicencaCentral === 'function') {
                    empData = await window.consultarLicencaCentral(empId, 'fc_gestao');
                }
                
                // Fallback para o banco local da empresa caso ainda não haja dados
                if (!empData) {
                    const empDoc = await firestore.collection('empresas').doc(empId).get();
                    if (empDoc.exists) empData = empDoc.data();
                }

                if (empData) {
                    window.currentEmpresaData = empData;
                    try { localStorage.setItem(cacheEmpKey, JSON.stringify(empData)); } catch(e) {}
                    const nomeEmpresaAtiva = empData.nomeEmpresa || empData.nome || localStorage.getItem('fc_nome_empresa_ativa') || (empId === 'emp_fc_moveis' ? 'FC Móveis' : 'Minha Loja');
                    localStorage.setItem('fc_nome_empresa_ativa', nomeEmpresaAtiva);

                    // Atualiza imediatamente a identidade no cabeçalho/menu lateral se o elemento existir
                    if (typeof aplicarIdentidadeVisualGlobal === 'function') {
                        aplicarIdentidadeVisualGlobal();
                    }
                    if (document.title && empId !== 'emp_fc_moveis' && document.title.includes('FC Móveis')) {
                        document.title = document.title.replace('FC Móveis', nomeEmpresaAtiva);
                    }

                    // Checagem de expiracao e bloqueio da assinatura / trial
                    const expInfo = typeof window._verificarExpiracaoSaaS === 'function'
                        ? window._verificarExpiracaoSaaS(empData)
                        : (empData.status === 'BLOQUEADO' ? { expirado: true, motivo: 'O acesso da sua empresa foi suspenso por pendencia financeira.' } : { expirado: false });

                    if (expInfo.expirado) {
                        if (typeof window.aplicarBloqueioTotal === 'function') {
                            window.aplicarBloqueioTotal(expInfo.motivo, empData);
                            return;
                        }
                        sessionStorage.clear();
                        localStorage.removeItem('fc_empresa_ativa');
                        alert(expInfo.motivo || 'O acesso da sua empresa esta suspenso temporariamente. Entre em contato com o suporte.');
                        await auth.signOut();
                        window.location.href = 'login.html';
                        return;
                    }

                    // Se estiver em trial valido, exibir o banner de dias restantes
                    if (expInfo.isTrial && typeof window.renderizarBannerTrial === 'function') {
                        window.renderizarBannerTrial(expInfo.diasRestantes, empData);
                    }

                    // Aplica controle real dos modulos contratados pelo plano da loja
                    aplicarControleDeModulosSaaS(empData, user);
                    // Inicia listener em tempo real para detectar mudancas de modulos pelo master
                    if (typeof window.iniciarListenerBloqueioTempoReal === 'function') {
                        window.iniciarListenerBloqueioTempoReal(empId, user.email);
                    }
                }
            } catch (errBloq) {
                console.warn("Aviso ao checar empresa:", errBloq);
            }
        }

        // Inicia monitor para detectar quando der meia-noite
        iniciarMonitorSessaoDiaria();

            // Pré-carrega Config e Permissões do cache para inicialização instantânea
            const configCache = (typeof window.FCCache !== 'undefined') && (window.FCCache.get('config') || window.FCCache.get('fc_moveis_config'));
            if (configCache) db.config = configCache;

            const userCacheKey = 'funcionario_' + user.uid;
            let userCache = (typeof window.FCCache !== 'undefined') && window.FCCache.get(userCacheKey);
            if (!userCache) {
                try {
                    const localU = localStorage.getItem('fc_user_cache_' + user.uid);
                    if (localU) userCache = JSON.parse(localU);
                } catch(e) {}
            }
            if (userCache) window.currentUserInfo = userCache;

            let renderizouImediato = false;
            if (window.currentUserInfo) {
                if (aplicarControleDeAcesso()) return;
                mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);
                aplicarIdentidadeVisualGlobal();
                if (window.__paginaBloqueadaPorPlano || window.__paginaBloqueadaPorPermissao) return;
                if (funcaoDeRenderizacaoDaPagina) {
                    try {
                        funcaoDeRenderizacaoDaPagina();
                        renderizouImediato = true;
                    } catch(e) {
                        console.error("Erro ao renderizar com cache:", e);
                    }
                }
            }

            // Sincronização com Firebase garantindo busca das configurações e permissões mais recentes
            const sincronizarFirebase = async () => {
                try {
                    const empIdAtiva = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
                    const nomeEmpresaPadrao = window.currentEmpresaData?.nomeEmpresa || window.currentEmpresaData?.nome || localStorage.getItem('fc_nome_empresa_ativa') || (empIdAtiva === 'emp_fc_moveis' ? 'FC Móveis' : 'Minha Loja');

                    let confSnap = null;
                    let userSnap = null;
                    try {
                        [confSnap, userSnap] = await Promise.all([
                            window.getEmpresaRef().collection('configuracoes').doc('config').get().catch(e => { console.error("Erro ao carregar config:", e); return null; }),
                            window.getEmpresaRef().collection("funcionarios").doc(user.uid).get().catch(e => { console.error("Erro de permissões:", e); return null; })
                        ]);
                    } catch(eProm) {
                        console.error("Erro ao sincronizar config do Firebase:", eProm);
                    }

                    // Fallback para coleção legada fc_moveis/config caso o doc não exista ou falte logo/empresa
                    if ((!confSnap || !confSnap.exists || !confSnap.data()?.empresa?.logo) && empIdAtiva === 'emp_fc_moveis') {
                        try {
                            const legSnap = await firestore.collection('fc_moveis').doc('config').get();
                            if (legSnap && legSnap.exists && legSnap.data()) {
                                const legDados = legSnap.data();
                                if (!confSnap || !confSnap.exists) {
                                    confSnap = legSnap;
                                } else {
                                    const confDataAtual = confSnap.data() || {};
                                    confSnap = {
                                        exists: true,
                                        data: () => ({
                                            ...legDados,
                                            ...confDataAtual,
                                            empresa: {
                                                ...(legDados.empresa || {}),
                                                ...(confDataAtual.empresa || {})
                                            },
                                            loja: {
                                                ...(legDados.loja || {}),
                                                ...(confDataAtual.loja || {})
                                            }
                                        })
                                    };
                                }
                                window.getEmpresaRef().collection('configuracoes').doc('config').set(confSnap.data(), { merge: true }).catch(() => {});
                            }
                        } catch(eLeg) {
                            console.warn("Aviso ao consultar config legada fc_moveis:", eLeg);
                        }
                    }

                    if (confSnap && confSnap.exists) {
                        const dados = confSnap.data() || {};
                        const empConfig = dados.empresa || {};
                        // Se nome ou fantasia forem vazios ou faltantes, preenche com o nome da loja
                        if (!empConfig.nome || empConfig.nome.trim() === '') {
                            empConfig.nome = nomeEmpresaPadrao;
                        }
                        if (!empConfig.fantasia || empConfig.fantasia.trim() === '') {
                            empConfig.fantasia = nomeEmpresaPadrao;
                        }
                        const baseConfig = {
                            empresa: {
                                nome: nomeEmpresaPadrao,
                                fantasia: nomeEmpresaPadrao,
                                cnpj: '', telefone: '', logo: ''
                            },
                            taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } },
                            prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 },
                            loja: {}
                        };
                        db.config = {
                            ...baseConfig,
                            ...dados,
                            empresa: { ...baseConfig.empresa, ...empConfig },
                            taxas: dados.taxas || baseConfig.taxas,
                            prazos: dados.prazos || baseConfig.prazos,
                            loja: { ...baseConfig.loja, ...(dados.loja || {}) }
                        };

                        // Auto-correção persistente no Firestore se estiver vazio no banco
                        if (!dados.empresa || !dados.empresa.nome || !dados.empresa.fantasia) {
                            window.getEmpresaRef().collection('configuracoes').doc('config').set({
                                empresa: {
                                    nome: nomeEmpresaPadrao,
                                    fantasia: nomeEmpresaPadrao
                                }
                            }, { merge: true }).catch(() => {});
                        }

                        if (typeof window.FCCache !== 'undefined') {
                            window.FCCache.set('config', db.config);
                            if (empIdAtiva === 'emp_fc_moveis') {
                                window.FCCache.set('fc_moveis_config', db.config);
                            }
                        }
                        if (typeof window.ajustarOpcoesOperacaoPDV === 'function') {
                            try { window.ajustarOpcoesOperacaoPDV(); } catch (e) {}
                        }
                        if (typeof window.carregarConfiguracoesNaTela === 'function') {
                            try { window.carregarConfiguracoesNaTela(); } catch (e) {}
                        }
                    } else if (confSnap && !confSnap.exists) {
                        const novaConfig = {
                            empresa: {
                                nome: nomeEmpresaPadrao,
                                fantasia: nomeEmpresaPadrao,
                                cnpj: '', telefone: '', logo: ''
                            },
                            taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } },
                            prazos: { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 },
                            pdv: { permite_estoque_negativo: false }
                        };
                        db.config = novaConfig;
                        await window.getEmpresaRef().collection('configuracoes').doc('config').set(novaConfig).catch(() => {});
                        if (typeof window.FCCache !== 'undefined') {
                            window.FCCache.set('config', db.config);
                            if (empIdAtiva === 'emp_fc_moveis') {
                                window.FCCache.set('fc_moveis_config', db.config);
                            }
                        }
                    }

                    if (userSnap && userSnap.exists) {
                        window.currentUserInfo = userSnap.data();
                        
                        // CORREÇÃO: Garante admin para as contas master
                        if (isContaMasterGlobal(user.email) && !window.currentUserInfo.isAdmin) {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
                            window.currentUserInfo.perm_produtos = true;
                            window.currentUserInfo.perm_clientes = true;
                            window.currentUserInfo.perm_gestao = true;
                            window.currentUserInfo.perm_config = true;
                            
                            window.getEmpresaRef().collection("funcionarios").doc(user.uid).update({
                                isAdmin: true,
                                perm_dashboard: true,
                                perm_pdv: true,
                                perm_cadastros: true,
                                perm_produtos: true,
                                perm_clientes: true,
                                perm_gestao: true,
                                perm_config: true
                            }).catch(e => console.error("Erro ao atualizar admin", e));
                        }
                        
                        if (typeof window.FCCache !== 'undefined') window.FCCache.set(userCacheKey, window.currentUserInfo);
                        try { localStorage.setItem('fc_user_cache_' + user.uid, JSON.stringify(window.currentUserInfo)); } catch(e) {}
                        if (aplicarControleDeAcesso()) return;
                        mostrarNomeUsuarioNoHeader(window.currentUserInfo.isAdmin ? 'Admin Master' : `Func.: ${window.currentUserInfo.nome || 'Usuário'}`);
                    } else if (userSnap && !userSnap.exists) {
                        // Usuário não cadastrado na base de funcionários
                        window.currentUserInfo = { isAdmin: false, perm_dashboard: false, perm_pdv: false, perm_cadastros: false, perm_produtos: false, perm_clientes: false, perm_gestao: false, perm_config: false };
                        
                        // CORREÇÃO: Garante admin na criação do cadastro
                        if (isContaMasterGlobal(user.email)) {
                            window.currentUserInfo.isAdmin = true;
                            window.currentUserInfo.perm_dashboard = true;
                            window.currentUserInfo.perm_pdv = true;
                            window.currentUserInfo.perm_cadastros = true;
                            window.currentUserInfo.perm_produtos = true;
                            window.currentUserInfo.perm_clientes = true;
                            window.currentUserInfo.perm_gestao = true;
                            window.currentUserInfo.perm_config = true;
                        }

                        try {
                            await window.getEmpresaRef().collection('funcionarios').doc(user.uid).set({
                                nome: window.currentUserInfo.isAdmin ? "Administrador" : "NOVO CADASTRO", 
                                email: user.email || '', 
                                isAdmin: window.currentUserInfo.isAdmin,
                                perm_dashboard: window.currentUserInfo.perm_dashboard, 
                                perm_pdv: window.currentUserInfo.perm_pdv, 
                                perm_cadastros: window.currentUserInfo.perm_cadastros,
                                perm_produtos: window.currentUserInfo.perm_produtos,
                                perm_clientes: window.currentUserInfo.perm_clientes,
                                perm_gestao: window.currentUserInfo.perm_gestao, 
                                perm_config: window.currentUserInfo.perm_config, 
                                dataCadastro: new Date().toISOString(), 
                                status: window.currentUserInfo.isAdmin ? 'ATIVO' : 'PENDENTE'
                            });
                        } catch(e) { console.error("Erro ao registrar no banco:", e); }
                        
                        if (!window.currentUserInfo.isAdmin) {
                            const avisoAprovacao = document.createElement('div');
                            avisoAprovacao.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:#eab308; color:black; padding:15px 30px; font-size:16px; font-weight:bold; border-radius:10px; text-align:center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);";
                            avisoAprovacao.innerHTML = "<i class='fa-solid fa-clock'></i> Conta Registrada!<br><span style='font-size:13px; font-weight:normal;'>Aguarde o Administrador liberar suas permiss&otilde;es de acesso.</span>";
                            document.body.appendChild(avisoAprovacao);
                        }
                        aplicarControleDeAcesso();
                    }

                    aplicarIdentidadeVisualGlobal();

                    // Listener em tempo real para permissões do usuário
                    if (!window._listenerFuncionarioAtivo && user && user.uid) {
                        window._listenerFuncionarioAtivo = true;
                        try {
                            window.getEmpresaRef().collection("funcionarios").doc(user.uid).onSnapshot(docSnap => {
                                if (docSnap && docSnap.exists) {
                                    const dadosNovos = docSnap.data();
                                    window.currentUserInfo = dadosNovos;
                                    if (typeof window.FCCache !== 'undefined') window.FCCache.set(userCacheKey, dadosNovos);
                                    if (aplicarControleDeAcesso()) return;
                                    mostrarNomeUsuarioNoHeader(dadosNovos.isAdmin ? 'Admin Master' : `Func.: ${dadosNovos.nome || 'Usuário'}`);
                                }
                            }, errSnap => console.warn("Listener de permissões:", errSnap));
                        } catch(eSnap) {}
                    }

                    // Se não pôde renderizar de imediato por falta de cache, renderiza agora (apenas se página permitida)
                    if (!renderizouImediato && !window.__paginaBloqueadaPorPermissao && !window.__paginaBloqueadaPorPlano && funcaoDeRenderizacaoDaPagina) {
                        funcaoDeRenderizacaoDaPagina();
                    } else if (renderizouImediato && typeof window.carregarConfiguracoesNaTela === 'function') {
                        // Se a tela atual for a de configurações, atualiza os campos com os dados frescos do Firestore
                        window.carregarConfiguracoesNaTela();
                    }
                } catch (err) {
                    console.error("Erro na sincronização Firebase:", err);
                    if (!renderizouImediato && funcaoDeRenderizacaoDaPagina) {
                        aplicarIdentidadeVisualGlobal();
                        funcaoDeRenderizacaoDaPagina();
                    }
                }
            };

            if (!renderizouImediato) {
                await sincronizarFirebase();
            } else {
                sincronizarFirebase().catch(e => console.warn("Aviso na sincronização em background:", e));
            }

            // Sincronização programada (1º login do cliente no dia com internet e horário das 17:30hrs)
            if (window.FCCache && typeof window.FCCache.verificarSincronizacaoAutomatica === 'function') {
                setTimeout(function () {
                    window.FCCache.verificarSincronizacaoAutomatica('login');
                }, 1200);
            }
    });
}

// Monitor de sessão: encerra a sessão SOMENTE caso dê meia-noite
function iniciarMonitorSessaoDiaria() {
    if (window._monitorSessaoIniciado) return;
    window._monitorSessaoIniciado = true;

    const checarMeiaNoite = async () => {
        const isLoginPage = window.location.pathname.toLowerCase().includes('login.html') || window.location.href.toLowerCase().includes('login.html');
        if (isLoginPage) return;

        const user = auth.currentUser;
        if (!user) return;

        const hoje = new Date().toDateString();
        const sessaoData = localStorage.getItem('fc_sessao_data');

        // Se o dia virou (passou de meia-noite):
        if (sessaoData && sessaoData !== hoje) {
            console.warn("Meia-noite atingida. Encerrando sessão diária...");
            localStorage.removeItem('fc_sessao_data');
            localStorage.removeItem('fc_sessao_uid');
            sessionStorage.setItem('fc_sessao_expirada_msg', 'Meia-noite atingida: sua sessão diária encerrou. Por favor, faça login para o novo dia.');
            try { await auth.signOut(); } catch (e) {}
            window.location.href = 'login.html';
        }
    };

    // Checa a cada 30 segundos e ao voltar o foco para a aba se já virou meia-noite
    setInterval(checarMeiaNoite, 30000);
    window.addEventListener('focus', checarMeiaNoite);
}

// Funções auxiliares para checagem granular de permissões
window.checarPermissaoUsuario = function(user, key, fallbackKey) {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (user[key] !== undefined && user[key] !== null) {
        return user[key] === true || user[key] === 'true';
    }
    if (fallbackKey && user[fallbackKey] !== undefined && user[fallbackKey] !== null) {
        return user[fallbackKey] === true || user[fallbackKey] === 'true';
    }
    return false;
};

window.podeCadastrarProdutos = function(user = window.currentUserInfo) {
    return window.checarPermissaoUsuario(user, 'perm_produtos', 'perm_cadastros');
};

window.podeCadastrarClientes = function(user = window.currentUserInfo) {
    return window.checarPermissaoUsuario(user, 'perm_clientes', 'perm_cadastros');
};

window.podeCadastrarFornecedores = function(user = window.currentUserInfo) {
    return window.checarPermissaoUsuario(user, 'perm_fornecedores', 'perm_cadastros');
};

window.podeCadastrarFuncionarios = function(user = window.currentUserInfo) {
    if (!user) return false;
    if (user.isAdmin) return true;
    return window.checarPermissaoUsuario(user, 'perm_funcionarios');
};

window.podeAcessarCadastrosGerais = function(user = window.currentUserInfo) {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (user.perm_cadastros === true || user.perm_cadastros === 'true') return true;
    return window.podeCadastrarProdutos(user) || window.podeCadastrarClientes(user) || window.podeCadastrarFornecedores(user) || window.podeCadastrarFuncionarios(user);
};

window.verificarPermissaoRota = function(rota, user = window.currentUserInfo) {
    if (!user) return { permitido: false, motivo: 'Usuário não autenticado.' };

    const email = (user.email || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.email : '') || '').toLowerCase().trim();
    const isMasterGlobal = email === 'fabricadecoresgoiania@gmail.com' || email === 'pauloaugusto.silvaborges@gmail.com';

    const path = (rota || window.location.pathname).toLowerCase();

    // 0. VERIFICAÇÃO ESTRITA DE MÓDULOS CONTRATADOS NO PLANO SAAS (Não burlável por admin da loja)
    if (!isMasterGlobal) {
        const mapaSaaS = [
            { rotas: ['fiscal.html'], modulo: 'fiscal', nome: 'Emissor Fiscal (NF-e/NFC-e)' },
            { rotas: ['financeiro.html', 'conciliacao.html'], modulo: 'financeiro', nome: 'Financeiro & Fluxo de Caixa' },
            { rotas: ['compras.html'], modulo: 'compras', nome: 'Compras & NF-e XML' },
            { rotas: ['relatorios.html'], modulo: 'relatorios', nome: 'Relatórios & DRE' },
            { rotas: ['agenda.html'], modulo: 'agenda', nome: 'Agenda & Lembretes' },
            { rotas: ['marketing.html'], modulo: 'ia', nome: 'Marketing & IA Comercial' },
            { rotas: ['caixa.html', 'caixa_loja.html'], modulo: 'caixa', nome: 'Caixa Físico & Caixa da Loja' },
            { rotas: ['pdv.html'], modulo: 'pdv', nome: 'Frente de Caixa (PDV)' },
            { rotas: ['vendas_operacao.html', 'vendas_gestao.html', 'orcamentos.html', 'operacao.html'], modulo: 'vendas', nome: 'Vendas & Orçamentos' },
            { rotas: ['produtos.html'], modulo: 'estoque', nome: 'Produtos & Estoque' }
        ];

        let lic = window.currentSaaSLicense || window.currentEmpresaData;
        if (!lic) {
            const empId = localStorage.getItem('fc_empresa_ativa');
            if (empId) {
                try {
                    const c = localStorage.getItem('saas_licenca_' + empId) || localStorage.getItem('fc_empresa_cache_' + empId);
                    if (c) lic = JSON.parse(c);
                } catch(e) {}
            }
        }

        const mods = (lic && lic.modulosLiberados && Array.isArray(lic.modulosLiberados) && lic.modulosLiberados.length > 0)
            ? lic.modulosLiberados
            : window.modulosLiberadosEmpresa;

        if (mods && Array.isArray(mods)) {
            const checar = typeof window.temPermissaoModulo === 'function' ? window.temPermissaoModulo : function(m, list) {
                if (!list || !Array.isArray(list)) return false;
                if (m === 'ia' || m === 'marketing') return list.includes('ia') || list.includes('marketing');
                if (m === 'caixa' || m === 'caixa_loja') return list.includes('caixa') || list.includes('caixa_loja');
                return list.includes(m);
            };

            for (const item of mapaSaaS) {
                const estaNaRota = item.rotas.some(r => path.includes(r));
                if (estaNaRota && !checar(item.modulo, mods)) {
                    return {
                        permitido: false,
                        motivo: `O módulo "${item.nome}" não está incluso no plano da sua loja.`,
                        bloqueioPlano: true,
                        modulo: item.modulo,
                        nomeModulo: item.nome
                    };
                }
            }
        }
    }

    if (user.isAdmin) return { permitido: true };

    const path = (rota || window.location.pathname).toLowerCase();
    const check = (k, fb) => window.checarPermissaoUsuario(user, k, fb);

    // 1. Dashboard / Visão Geral
    if (path.includes('index.html') || path.endsWith('/sistema/') || path.endsWith('/sistema') || path === '' || path === '/') {
        if (!check('perm_dashboard')) {
            return { permitido: false, motivo: 'Acesso Negado ao Dashboard (Visão Geral).' };
        }
        return { permitido: true };
    }

    // 2. Operação
    if (path.includes('pdv.html')) {
        if (!check('perm_pdv')) {
            return { permitido: false, motivo: 'Acesso Negado à Frente de Caixa (PDV).' };
        }
        return { permitido: true };
    }

    if (path.includes('vendas_operacao.html')) {
        if (!check('perm_vendas_op', 'perm_pdv')) {
            return { permitido: false, motivo: 'Acesso Negado ao Histórico de Vendas/Serviços.' };
        }
        return { permitido: true };
    }

    if (path.includes('orcamentos.html')) {
        if (!check('perm_orcamentos', 'perm_pdv')) {
            return { permitido: false, motivo: 'Acesso Negado a Meus Orçamentos.' };
        }
        return { permitido: true };
    }

    if (path.includes('fiscal.html')) {
        if (!check('perm_fiscal', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado ao Emissor Fiscal (NF-e).' };
        }
        return { permitido: true };
    }

    // 3. Cadastros
    if (path.includes('produtos.html')) {
        if (!window.podeCadastrarProdutos(user)) {
            return { permitido: false, motivo: 'Acesso Negado à Área de Cadastro de Produtos.' };
        }
        return { permitido: true };
    }

    if (path.includes('clientes.html')) {
        if (!window.podeCadastrarClientes(user)) {
            return { permitido: false, motivo: 'Acesso Negado à Área de Cadastro de Clientes.' };
        }
        return { permitido: true };
    }

    if (path.includes('fornecedores.html')) {
        if (!window.podeCadastrarFornecedores(user)) {
            return { permitido: false, motivo: 'Acesso Negado ao Cadastro de Fornecedores.' };
        }
        return { permitido: true };
    }

    if (path.includes('funcionarios.html') || path.includes('view=funcionarios')) {
        if (!window.podeCadastrarFuncionarios(user)) {
            return { permitido: false, motivo: 'Acesso Negado ao Cadastro de Funcionários.' };
        }
        return { permitido: true };
    }

    if (path.includes('cadastro.html')) {
        if (!window.podeAcessarCadastrosGerais(user)) {
            return { permitido: false, motivo: 'Acesso Negado aos Cadastros.' };
        }
        return { permitido: true };
    }

    // 4. Caixa da Loja
    if (path.includes('caixa_loja.html')) {
        const permitidoCaixaLoja = user.perm_caixa_loja !== undefined
            ? (user.perm_caixa_loja === true || user.perm_caixa_loja === 'true')
            : (check('perm_caixa') || check('perm_gestao'));
        if (!permitidoCaixaLoja) {
            return { permitido: false, motivo: 'Acesso Negado ao Caixa da Loja.' };
        }
        return { permitido: true };
    }

    // 5. Caixa Físico
    if (path.includes('caixa.html')) {
        const permitidoCaixa = user.perm_caixa !== undefined
            ? (user.perm_caixa === true || user.perm_caixa === 'true')
            : (check('perm_pdv') || check('perm_gestao'));
        if (!permitidoCaixa) {
            return { permitido: false, motivo: 'Acesso Negado ao Caixa Físico.' };
        }
        return { permitido: true };
    }

    // 6. Gestão Financeira
    if (path.includes('financeiro.html') || path.includes('vendas_gestao.html')) {
        if (!check('perm_financeiro', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado ao Financeiro e Gestão de Vendas.' };
        }
        return { permitido: true };
    }

    // 7. Compras
    if (path.includes('compras.html')) {
        if (!check('perm_compras', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado a Compras e XML.' };
        }
        return { permitido: true };
    }

    // 8. Relatórios
    if (path.includes('relatorios.html')) {
        if (!check('perm_relatorios', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado aos Relatórios & DRE.' };
        }
        return { permitido: true };
    }

    // 9. Agenda
    if (path.includes('agenda.html')) {
        if (!check('perm_agenda', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado à Agenda.' };
        }
        return { permitido: true };
    }

    // 10. Marketing
    if (path.includes('marketing.html')) {
        if (!check('perm_marketing', 'perm_gestao')) {
            return { permitido: false, motivo: 'Acesso Negado ao Marketing.' };
        }
        return { permitido: true };
    }

    // 11. Configurações do Sistema
    if (path.includes('sistema.html')) {
        if (!check('perm_config')) {
            return { permitido: false, motivo: 'Acesso Negado às Configurações do Sistema.' };
        }
        return { permitido: true };
    }

    return { permitido: true };
};

window.obterRotaInicialUsuario = function(user = window.currentUserInfo) {
    if (!user) return 'login.html';
    if (user.isAdmin) return 'index.html';

    const check = (k, fb) => window.checarPermissaoUsuario(user, k, fb);

    if (check('perm_dashboard')) return 'index.html';
    if (check('perm_pdv')) return 'pdv.html';
    if (check('perm_vendas_op', 'perm_pdv')) return 'vendas_operacao.html';
    if (check('perm_orcamentos', 'perm_pdv')) return 'orcamentos.html';
    if (check('perm_fiscal', 'perm_gestao')) return 'fiscal.html';
    if (window.podeCadastrarProdutos(user)) return 'produtos.html';
    if (window.podeCadastrarClientes(user)) return 'clientes.html';
    if (window.podeCadastrarFornecedores(user)) return 'fornecedores.html';
    if (window.podeCadastrarFuncionarios(user)) return 'funcionarios.html';
    if (user.perm_caixa_loja !== undefined ? (user.perm_caixa_loja === true || user.perm_caixa_loja === 'true') : (check('perm_caixa') || check('perm_gestao'))) return 'caixa_loja.html';
    if (check('perm_financeiro', 'perm_gestao')) return 'financeiro.html';
    if (user.perm_caixa !== undefined ? (user.perm_caixa === true || user.perm_caixa === 'true') : (check('perm_pdv') || check('perm_gestao'))) return 'caixa.html';
    if (check('perm_compras', 'perm_gestao')) return 'compras.html';
    if (check('perm_relatorios', 'perm_gestao')) return 'relatorios.html';
    if (check('perm_agenda', 'perm_gestao')) return 'agenda.html';
    if (check('perm_marketing', 'perm_gestao')) return 'marketing.html';
    if (check('perm_config')) return 'sistema.html';

    return 'login.html';
};

function esconderSecoesVaziasSidebar() {
    const nav = document.querySelector('aside nav');
    if (!nav) return;
    const titulos = nav.querySelectorAll('p');
    titulos.forEach(p => {
        let el = p.nextElementSibling;
        let temLinkVisivel = false;
        while (el && el.tagName !== 'P') {
            if (el.tagName === 'A' && !el.classList.contains('hidden') && el.style.display !== 'none') {
                temLinkVisivel = true;
                break;
            }
            el = el.nextElementSibling;
        }
        if (!temLinkVisivel) {
            p.classList.add('hidden');
        } else {
            p.classList.remove('hidden');
        }
    });
}

function aplicarControleDeAcesso() {
    if (!window.currentUserInfo) return false;
    const p = window.currentUserInfo;
    const path = window.location.pathname;

    // Se for admin, não bloqueia nada e garante todos os links visíveis
    if (p.isAdmin) {
        document.querySelectorAll('aside a, aside p').forEach(el => el.classList.remove('hidden'));
        return false;
    }

    // 1. Validação da Rota Atual da Página
    const rotaCheck = window.verificarPermissaoRota(path, p);
    if (!rotaCheck.permitido) {
        window.__paginaBloqueadaPorPermissao = true;
        const main = document.querySelector('main');
        if (main) {
            main.style.visibility = 'hidden';
            main.innerHTML = '';
        }
        showToast(rotaCheck.motivo, 'error');

        const rotaDestino = window.obterRotaInicialUsuario(p);
        const pathAtual = window.location.pathname.toLowerCase();
        if (!pathAtual.includes(rotaDestino)) {
            window.location.replace(rotaDestino);
        }
        return true; // Retorna true informando que a página foi bloqueada
    }

    // 2. Controle Dinâmico Completo do Menu Lateral (Sidebar)
    const check = (k, fb) => window.checarPermissaoUsuario(p, k, fb);

    // 2.1 Visão Geral
    document.querySelectorAll('a[href*="index.html"], [data-target="dashboard"]').forEach(el => {
        if (!check('perm_dashboard')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.2 Operação
    document.querySelectorAll('a[href*="pdv.html"], [data-target="pdv"]').forEach(el => {
        if (!check('perm_pdv')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="vendas_operacao.html"], [data-target="vendas_operacao"]').forEach(el => {
        if (!check('perm_vendas_op', 'perm_pdv')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="orcamentos.html"], [data-target="orcamentos"]').forEach(el => {
        if (!check('perm_orcamentos', 'perm_pdv')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="fiscal.html"], [data-target="fiscal"]').forEach(el => {
        if (!check('perm_fiscal', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.3 Cadastros
    document.querySelectorAll('a[href*="produtos.html"], [data-target="produtos"]').forEach(el => {
        if (!window.podeCadastrarProdutos(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="clientes.html"], [data-target="clientes"]').forEach(el => {
        if (!window.podeCadastrarClientes(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="fornecedores.html"], [data-target="fornecedores"]').forEach(el => {
        if (!window.podeCadastrarFornecedores(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="funcionarios.html"], a[href*="view=funcionarios"], [data-target="funcionarios"]').forEach(el => {
        if (!window.podeCadastrarFuncionarios(p)) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.4 Gestão
    document.querySelectorAll('a[href*="financeiro.html"], [data-target="financeiro"], a[href*="vendas_gestao.html"], [data-target="vendas_gestao"]').forEach(el => {
        if (!check('perm_financeiro', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="caixa_loja.html"], [data-target="caixa_loja"]').forEach(el => {
        const permCaixaLoja = p.perm_caixa_loja !== undefined
            ? (p.perm_caixa_loja === true || p.perm_caixa_loja === 'true')
            : (check('perm_caixa') || check('perm_gestao'));
        if (!permCaixaLoja) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="caixa.html"], [data-target="caixa"]').forEach(el => {
        const permCaixa = p.perm_caixa !== undefined
            ? (p.perm_caixa === true || p.perm_caixa === 'true')
            : (check('perm_pdv') || check('perm_gestao'));
        if (!permCaixa) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="compras.html"], [data-target="compras"]').forEach(el => {
        if (!check('perm_compras', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="relatorios.html"], [data-target="relatorios"]').forEach(el => {
        if (!check('perm_relatorios', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="agenda.html"], [data-target="agenda"]').forEach(el => {
        if (!check('perm_agenda', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    document.querySelectorAll('a[href*="marketing.html"], [data-target="marketing"]').forEach(el => {
        if (!check('perm_marketing', 'perm_gestao')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.5 Configurações
    document.querySelectorAll('a[href*="sistema.html"], [data-target="config"]').forEach(el => {
        if (!check('perm_config')) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });

    // 2.6 Esconde títulos de seções vazias no menu
    esconderSecoesVaziasSidebar();

    // 3. Controle de botões no PDV / Operação / Orçamentos
    const btnNovoProd = document.getElementById('btn-pdv-novo-produto');
    if (btnNovoProd) {
        if (!window.podeCadastrarProdutos(p)) {
            btnNovoProd.classList.add('hidden');
        } else {
            btnNovoProd.classList.remove('hidden');
        }
    }

    const btnNovoCli = document.getElementById('btn-pdv-novo-cliente');
    const inputCliBusca = document.getElementById('pdv-cliente-busca');
    if (btnNovoCli) {
        if (!window.podeCadastrarClientes(p)) {
            btnNovoCli.classList.add('hidden');
            if (inputCliBusca) {
                inputCliBusca.classList.remove('rounded-l-lg');
                inputCliBusca.classList.add('rounded-lg');
            }
        } else {
            btnNovoCli.classList.remove('hidden');
            if (inputCliBusca) {
                inputCliBusca.classList.remove('rounded-lg');
                inputCliBusca.classList.add('rounded-l-lg');
            }
        }
    }

    if (typeof window.ajustarOpcoesOperacaoPDV === 'function') {
        try { window.ajustarOpcoesOperacaoPDV(); } catch(eOp) {}
    }

    if (typeof window.renderCarrinho === 'function' && typeof window.cart !== 'undefined' && Array.isArray(window.cart) && window.cart.length > 0) {
        try { window.renderCarrinho(); } catch(eCarrinho) {}
    }

    // 4. Oculta atalhos e botões no Dashboard caso o usuário não tenha permissão
    const btnNovoCliDash = document.querySelector('button[onclick*="clientes.html"]');
    if (btnNovoCliDash && !window.podeCadastrarClientes(p)) btnNovoCliDash.classList.add('hidden');

    const btnNovoProdDash = document.querySelector('button[onclick*="produtos.html"]');
    if (btnNovoProdDash && !window.podeCadastrarProdutos(p)) btnNovoProdDash.classList.add('hidden');

    const btnLancFinDash = document.querySelector('button[onclick*="financeiro.html"]');
    if (btnLancFinDash && !p.perm_gestao) btnLancFinDash.classList.add('hidden');

    const btnPdvDash = document.querySelector('button[onclick*="pdv.html"], a[href*="pdv.html"]');
    if (btnPdvDash && !p.perm_pdv) btnPdvDash.classList.add('hidden');

    // Desativa cliques nos cards de KPI do dashboard para módulos sem permissão
    document.querySelectorAll('[onclick*="financeiro.html"]').forEach(card => {
        if (!p.perm_gestao && card.tagName !== 'BUTTON') {
            card.removeAttribute('onclick');
            card.classList.remove('cursor-pointer');
        }
    });
    document.querySelectorAll('[onclick*="vendas_operacao.html"]').forEach(card => {
        if (!p.perm_pdv && card.tagName !== 'BUTTON') {
            card.removeAttribute('onclick');
            card.classList.remove('cursor-pointer');
        }
    });

    return false;
}

// =======================================================
// CONTROLE REAL DE MÓDULOS CONTRATADOS DO PLANO SAAS
// =======================================================
function aplicarControleDeModulosSaaS(empData, user) {
    if (!empData) return;

    // Respeita estritamente a configuracao de modulos feita no SaaS Master
    const licencaCentral = window.currentSaaSLicense;
    let mods = (licencaCentral && Array.isArray(licencaCentral.modulosLiberados) && licencaCentral.modulosLiberados.length > 0)
        ? licencaCentral.modulosLiberados
        : empData.modulosLiberados;

    if (!mods || !Array.isArray(mods) || mods.length === 0) {
        const plano = (empData.plano || '').toUpperCase();
        if (plano.includes('START') || plano.includes('BASICO') || plano === 'FREE') {
            mods = ['pdv', 'vendas', 'estoque', 'caixa'];
        } else if (plano.includes('BALCAO')) {
            mods = ['pdv', 'vendas', 'estoque', 'caixa'];
        } else if (plano.includes('FISCAL')) {
            mods = ['pdv', 'vendas', 'fiscal', 'estoque', 'caixa'];
        } else if (plano.includes('PRO') || plano.includes('PROFISSIONAL')) {
            mods = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'site'];
        } else if (plano.includes('ENTERPRISE') || plano.includes('ULTRA') || plano.includes('ILIMITADO')) {
            mods = ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'site', 'ia', 'agenda', 'marketing', 'suporte'];
        } else {
            mods = ['pdv', 'vendas', 'estoque', 'caixa', 'financeiro'];
        }
    }
    window.modulosLiberadosEmpresa = mods;

    const path = window.location.pathname.toLowerCase();

    // Mapeamento de paginas para seus modulos obrigatorios no SaaS
    const mapaPaginas = [
        { rotas: ['fiscal.html'],         modulo: 'fiscal',     nome: 'Emissor Fiscal (NF-e/NFC-e)' },
        { rotas: ['financeiro.html'],      modulo: 'financeiro', nome: 'Financeiro & Fluxo de Caixa' },
        { rotas: ['compras.html'],         modulo: 'compras',    nome: 'Compras & NF-e XML' },
        { rotas: ['relatorios.html'],      modulo: 'relatorios', nome: 'Relatorios & DRE' },
        { rotas: ['agenda.html'],          modulo: 'agenda',     nome: 'Agenda & Lembretes' },
        { rotas: ['marketing.html'],       modulo: 'ia',         nome: 'Marketing & IA' },
        { rotas: ['caixa.html', 'caixa_loja.html'], modulo: 'caixa', nome: 'Caixa Fisico & Caixa da Loja' },
        { rotas: ['pdv.html'],             modulo: 'pdv',        nome: 'Frente de Caixa (PDV)' },
        { rotas: ['vendas_operacao.html', 'vendas_gestao.html', 'orcamentos.html', 'operacao.html'], modulo: 'vendas', nome: 'Historico de Vendas & Orcamentos' },
        { rotas: ['produtos.html', 'cadastro.html', 'estoque.html', 'fornecedores.html'], modulo: 'estoque', nome: 'Produtos, Estoque & Cadastros' }
    ];

    // 1. Bloqueia a pagina se o modulo correspondente nao estiver contratado
    const _checar = typeof window.temPermissaoModulo === 'function' ? window.temPermissaoModulo : function(m, l) {
        if (!l || !Array.isArray(l)) return false;
        if (m === 'ia' || m === 'marketing') return l.includes('ia') || l.includes('marketing');
        if (m === 'caixa' || m === 'caixa_loja') return l.includes('caixa') || l.includes('caixa_loja');
        return l.includes(m);
    };
    for (const item of mapaPaginas) {
        const estaNaRota = item.rotas.some(r => path.endsWith('/' + r) || path.endsWith(r));
        if (estaNaRota && !_checar(item.modulo, mods)) {
            window.__paginaBloqueadaPorPlano = true;
            bloquearPaginaPorPlanoSaaS(item.nome, empData.plano || 'Atual', item.modulo);
            return;
        }
    }

    // 2. Bloqueia visualmente os itens da barra lateral
    setTimeout(() => {
        atualizarMenuLateralPorPlanoSaaS(mods);
    }, 100);
}
window.aplicarControleDeModulosSaaS = aplicarControleDeModulosSaaS;

function bloquearPaginaPorPlanoSaaS(nomeModulo, nomePlano, moduloId) {
    window.__paginaBloqueadaPorPlano = true;
    const main = document.querySelector('main');
    if (main) {
        main.style.visibility = 'hidden';
        main.innerHTML = '';
    }

    // Se o cliente SaaS tiver o overlay completo com comparativo de planos, aciona ele
    if (typeof window.aplicarBloqueioPlano === 'function') {
        window.aplicarBloqueioPlano(moduloId || 'modulo', nomeModulo);
        return;
    }

    // Fallback elegante caso saas_licenca.js nao esteja pronto
    const antigo = document.getElementById('fc-saas-overlay-plano');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fc-saas-overlay-plano';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.98); display:flex; align-items:center; justify-content:center; padding:16px; font-family:Inter,system-ui,sans-serif;';
    overlay.innerHTML = `
        <div style="max-width:480px; width:100%; text-align:center; padding:2.5rem 2rem; background:#1e293b; border-radius:1.5rem; border:1px solid #334155; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);">
            <div style="width:72px; height:72px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:1rem; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem; font-size:1.75rem; color:#f59e0b;">
                <i class="fa-solid fa-lock"></i>
            </div>
            <h2 style="color:#f8fafc; font-size:1.35rem; font-weight:900; margin:0 0 0.5rem;">Modulo Nao Habilitado</h2>
            <p style="color:#94a3b8; font-size:0.875rem; margin:0 0 1.5rem; line-height:1.6;">
                O modulo <strong style="color:#fbbf24;">${nomeModulo}</strong> nao faz parte do pacote liberado para a sua loja.
            </p>
            <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
                <a href="index.html" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.65rem 1.5rem; background:#334155; border-radius:0.75rem; color:#f8fafc; font-size:0.8rem; font-weight:700; text-decoration:none;">
                    <i class="fa-solid fa-arrow-left"></i> Voltar ao Painel
                </a>
                <a href="https://wa.me/5562999676874?text=${encodeURIComponent('Ola! Gostaria de fazer o upgrade do plano da minha loja para liberar o modulo ' + nomeModulo)}" target="_blank" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.65rem 1.5rem; background:linear-gradient(135deg,#f59e0b,#eab308); border-radius:0.75rem; color:#0f172a; font-size:0.8rem; font-weight:900; text-decoration:none;">
                    <i class="fa-brands fa-whatsapp"></i> Falar com Suporte
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function atualizarMenuLateralPorPlanoSaaS(modulosLiberados) {
    const checarPerm = typeof window.temPermissaoModulo === 'function' ? window.temPermissaoModulo : function(m, list) {
        if (!list || !Array.isArray(list)) return false;
        if (m === 'ia' || m === 'marketing') return list.includes('ia') || list.includes('marketing');
        if (m === 'caixa' || m === 'caixa_loja') return list.includes('caixa') || list.includes('caixa_loja');
        return list.includes(m);
    };

    const mapaLinks = [
        { href: 'fiscal.html',         modulo: 'fiscal',     nome: 'Emissor Fiscal (NF-e)' },
        { href: 'financeiro.html',      modulo: 'financeiro', nome: 'Financeiro & Contas' },
        { href: 'compras.html',         modulo: 'compras',    nome: 'Compras & NF-e XML' },
        { href: 'caixa.html',           modulo: 'caixa',      nome: 'Caixa Fisico' },
        { href: 'caixa_loja.html',      modulo: 'caixa',      nome: 'Caixa da Loja' },
        { href: 'relatorios.html',      modulo: 'relatorios', nome: 'Relatorios & DRE' },
        { href: 'pdv.html',             modulo: 'pdv',        nome: 'Frente de Caixa (PDV)' },
        { href: 'vendas_operacao.html', modulo: 'vendas',     nome: 'Vendas & Orcamentos' },
        { href: 'vendas_gestao.html',   modulo: 'vendas',     nome: 'Gestao de Vendas' },
        { href: 'orcamentos.html',      modulo: 'vendas',     nome: 'Meus Orcamentos' },
        { href: 'funcionarios.html',    modulo: 'vendas',     nome: 'Funcionarios' },
        { href: 'agenda.html',          modulo: 'agenda',     nome: 'Agenda & Lembretes' },
        { href: 'marketing.html',       modulo: 'ia',         nome: 'Marketing & Lembretes' },
        { href: 'produtos.html',        modulo: 'estoque',    nome: 'Produtos & Servicos' },
        { href: 'clientes.html',        modulo: 'vendas',     nome: 'Clientes' },
        { href: 'fornecedores.html',    modulo: 'estoque',    nome: 'Fornecedores' }
    ];

    mapaLinks.forEach(item => {
        const links = document.querySelectorAll(`aside a[href*="${item.href}"]`);
        links.forEach(link => {
            if (!checarPerm(item.modulo, modulosLiberados)) {
                link.classList.add('opacity-40', 'cursor-not-allowed');
                link.classList.remove('hover:bg-slate-800');
                if (!link.querySelector('.badge-modulo-bloqueado')) {
                    const badge = document.createElement('span');
                    badge.className = 'badge-modulo-bloqueado ml-auto text-[10px] text-amber-400/80 font-bold';
                    badge.innerHTML = '<i class="fa-solid fa-lock text-[9px]"></i>';
                    link.appendChild(badge);
                }
                link.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.aplicarBloqueioPlano === 'function') {
                        window.aplicarBloqueioPlano(item.modulo, item.nome);
                    } else if (typeof showToast === 'function') {
                        showToast(`O modulo ${item.nome} nao esta incluso no plano da sua loja. Fale com a administracao para ativar!`, 'warning');
                    } else {
                        alert(`O modulo ${item.nome} nao esta incluso no plano da sua loja. Fale com a administracao para ativar!`);
                    }
                };
            } else {
                link.classList.remove('opacity-40', 'cursor-not-allowed');
                const badge = link.querySelector('.badge-modulo-bloqueado');
                if (badge) badge.remove();
                link.onclick = null;
            }
        });
    });

    // Tratamento especifico do link da Loja Virtual na barra lateral
    const linksLoja = document.querySelectorAll('aside a[onclick*="abrirMinhaLojaVirtual"]');
    linksLoja.forEach(link => {
        const permitido = checarPerm('site', modulosLiberados);
        if (!permitido) {
            link.classList.add('opacity-40', 'cursor-not-allowed');
            link.classList.remove('hover:bg-slate-800', 'text-emerald-400');
            link.classList.add('text-slate-500');
            link.setAttribute('title', 'Loja Virtual nao inclusa no seu plano atual');
            if (!link.querySelector('.badge-modulo-bloqueado')) {
                const badge = document.createElement('span');
                badge.className = 'badge-modulo-bloqueado ml-auto text-[10px] text-amber-400/80 font-bold';
                badge.innerHTML = '<i class="fa-solid fa-lock text-[9px]"></i>';
                link.appendChild(badge);
            }
            link.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.aplicarBloqueioPlano === 'function') {
                    window.aplicarBloqueioPlano('site', 'Loja Virtual & Catalogo Online');
                } else if (typeof showToast === 'function') {
                    showToast('A Loja Virtual nao esta disponivel no plano atual da sua empresa.', 'warning');
                }
            };
        } else {
            link.classList.remove('opacity-40', 'cursor-not-allowed', 'text-slate-500');
            link.classList.add('text-emerald-400');
            link.removeAttribute('title');
            const badge = link.querySelector('.badge-modulo-bloqueado');
            if (badge) badge.remove();
            link.onclick = (e) => {
                e.preventDefault();
                abrirMinhaLojaVirtual();
            };
        }
    });
}

function mostrarNomeUsuarioNoHeader(nome) {
    try {
        const header = document.querySelector('header');
        if (!header) return;
        
        const rightDiv = document.getElementById('header-right-actions') || 
            (header.children.length > 1 ? header.lastElementChild : null);
        if (rightDiv && rightDiv.classList.contains('flex')) {
            // Localiza apenas avatar que seja filho direto do container direito
            let avatarEl = document.getElementById('user-avatar-icon') || 
                           document.getElementById('header-user-avatar') || 
                           Array.from(rightDiv.children).find(el => el.classList.contains('rounded-full'));
            
            if (!document.getElementById('header-user-name-display')) {
                const nameEl = document.createElement('div');
                nameEl.id = 'header-user-name-display';
                nameEl.className = 'hidden sm:block text-sm font-bold text-slate-700 dark:text-slate-200 mr-2 whitespace-nowrap';
                
                if (avatarEl && avatarEl.parentElement === rightDiv) {
                    rightDiv.insertBefore(nameEl, avatarEl);
                } else {
                    rightDiv.appendChild(nameEl);
                }
            }
            
            const nameDisplay = document.getElementById('header-user-name-display');
            if (nameDisplay) {
                nameDisplay.innerText = nome;
            }
            
            if (avatarEl) {
                const partes = (nome || '').trim().split(' ');
                let sigla = partes[0] ? partes[0].substring(0, 1).toUpperCase() : 'U';
                if (partes.length > 1) sigla += partes[partes.length - 1].substring(0, 1).toUpperCase();
                else if (partes[0].length > 1) sigla += partes[0].substring(1, 2).toUpperCase();
                avatarEl.innerText = sigla;
            }
        }
    } catch (err) {
        console.warn('Erro não-bloqueante ao exibir nome no header:', err);
    }
}

// Intercepta cliques nos links para nao deixar navegar se o modulo SaaS ou permissao estiver bloqueado
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    if (link.hostname !== window.location.hostname) return;

    // 1. CHECAGEM ESTRITA DE MODULOS DO SAAS (Aplica a todos os usuarios da loja)
    if (window.modulosLiberadosEmpresa && Array.isArray(window.modulosLiberadosEmpresa)) {
        const mapaRotasModulos = [
            { rotas: ['fiscal.html'],         modulo: 'fiscal',     nome: 'Emissor Fiscal (NF-e)' },
            { rotas: ['financeiro.html'],      modulo: 'financeiro', nome: 'Financeiro & Contas' },
            { rotas: ['compras.html'],         modulo: 'compras',    nome: 'Compras & NF-e XML' },
            { rotas: ['relatorios.html'],      modulo: 'relatorios', nome: 'Relatorios & DRE' },
            { rotas: ['agenda.html'],          modulo: 'agenda',     nome: 'Agenda & Lembretes' },
            { rotas: ['marketing.html'],       modulo: 'ia',         nome: 'Marketing & IA' },
            { rotas: ['caixa.html'],           modulo: 'caixa',      nome: 'Caixa Fisico' },
            { rotas: ['pdv.html'],             modulo: 'pdv',        nome: 'Frente de Caixa (PDV)' },
            { rotas: ['vendas_operacao.html', 'vendas_gestao.html', 'orcamentos.html'], modulo: 'vendas', nome: 'Vendas & Orcamentos' },
            { rotas: ['produtos.html', 'cadastro.html', 'estoque.html', 'fornecedores.html'], modulo: 'estoque', nome: 'Produtos & Estoque' }
        ];

        const targetPath = link.pathname.toLowerCase();
        const _checarClick = typeof window.temPermissaoModulo === 'function' ? window.temPermissaoModulo : function(m, l) {
            if (!l || !Array.isArray(l)) return false;
            if (m === 'ia' || m === 'marketing') return l.includes('ia') || l.includes('marketing');
            return l.includes(m);
        };
        for (const item of mapaRotasModulos) {
            const estaNaRota = item.rotas.some(r => targetPath.endsWith('/' + r) || targetPath.endsWith(r));
            if (estaNaRota && !_checarClick(item.modulo, window.modulosLiberadosEmpresa)) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.aplicarBloqueioPlano === 'function') {
                    window.aplicarBloqueioPlano(item.modulo, item.nome);
                } else if (typeof showToast === 'function') {
                    showToast(`O modulo ${item.nome} nao esta incluso no plano da sua loja.`, 'warning');
                }
                return;
            }
        }
    }
    
    // Ignora links externos ou vazios
    if (link.hostname !== window.location.hostname) return;
    
    const p = window.currentUserInfo;
    if (!p || p.isAdmin) return; // Se for admin, passa direto

    // Validação estrita e centralizada de rotas para usuários comuns
    const rotaCheck = window.verificarPermissaoRota(link.href, p);
    if (!rotaCheck.permitido) {
        e.preventDefault();
        e.stopPropagation();
        showToast(rotaCheck.motivo, 'error');
    }
});

async function salvarKardex(ref, prodId, prodNome, qtd, tipo) {
    try {
        await window.getEmpresaRef().collection('movimentacoes').add({
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
    // Se houver operações locais pendentes de envio à nuvem, sincroniza antes de deslogar
    if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.enviarFilaPendente === 'function') {
        try { await window.FCCache.enviarFilaPendente(); } catch (e) {}
    }
    localStorage.removeItem('fc_sessao_data');
    localStorage.removeItem('fc_sessao_uid');
    localStorage.removeItem('fc_empresa_ativa');
    sessionStorage.clear();
    // Limpa todo o cache de leitura ao fazer logout para garantir que outro usuário
    // não veja dados em cache do usuário anterior (fila pendente é preservada intacta)
    if (typeof window.FCCache !== 'undefined') {
        try { await window.FCCache.invalidarTudo(); } catch (e) {}
    }
    try {
        await auth.signOut();
    } catch(e) {
        console.error("Erro no signOut:", e);
    }
    window.location.href = 'login.html';
}
window.fazerLogout = fazerLogout;
window.logout = fazerLogout;

// Funções da Loja Virtual Multi-Tenant
window.gerarLinkLojaVirtual = function() {
    const empId = window.currentEmpresaId || localStorage.getItem('fc_empresa_ativa') || '';
    const baseUrl = window.location.href.split('/sistema/')[0] + '/site/index.html';
    return empId ? `${baseUrl}?loja=${encodeURIComponent(empId)}` : baseUrl;
};

window.copiarLinkLojaVirtual = function() {
    if (typeof window.verificarAcessoModulo === 'function' && !window.verificarAcessoModulo('site')) {
        if (typeof window.aplicarBloqueioPlano === 'function') {
            window.aplicarBloqueioPlano('site', 'Loja Virtual & Catalogo Online');
        } else if (typeof showToast === 'function') {
            showToast('A Loja Virtual nao esta disponivel no plano atual da sua empresa.', 'warning');
        }
        return;
    }
    const link = window.gerarLinkLojaVirtual();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            if (typeof showToast === 'function') showToast('Link da sua loja virtual copiado com sucesso!', 'success');
            else alert('Link copiado: ' + link);
        }).catch(() => {
            prompt('Copie o link da sua loja:', link);
        });
    } else {
        prompt('Copie o link da sua loja:', link);
    }
};

window.abrirMinhaLojaVirtual = function() {
    if (typeof window.verificarAcessoModulo === 'function' && !window.verificarAcessoModulo('site')) {
        if (typeof window.aplicarBloqueioPlano === 'function') {
            window.aplicarBloqueioPlano('site', 'Loja Virtual & Catalogo Online');
        } else if (typeof showToast === 'function') {
            showToast('A Loja Virtual nao esta disponivel no plano atual da sua empresa.', 'warning');
        }
        return;
    }
    const link = window.gerarLinkLojaVirtual();
    window.open(link, '_blank');
};

function toggleMenu() {
    const isMobile = window.innerWidth < 768;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    if (isMobile) {
        // Mobile: Gaveta lateral deslizante com backdrop overlay
        const isClosed = sidebar.classList.contains('-translate-x-full');
        if (isClosed) {
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    } else {
        // Desktop: Alterna Modo Expansivo (Recolher / Expandir Menu Lateral)
        const isRecolhido = document.body.classList.toggle('sidebar-recolhida');
        if (isRecolhido) {
            document.documentElement.classList.add('sidebar-recolhida');
        } else {
            document.documentElement.classList.remove('sidebar-recolhida');
        }
        try {
            localStorage.setItem('fc_layout_expansivo', isRecolhido ? 'true' : 'false');
        } catch(e) {}
        if (overlay) overlay.classList.add('hidden');
        document.body.style.overflow = '';
        atualizarBotoesModoExpansivo(isRecolhido);

        // Notifica gráficos, tabelas e janelas para recalcular largura
        setTimeout(function() {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    }
}
window.toggleMenu = toggleMenu;

function atualizarBotoesModoExpansivo(isRecolhido) {
    const btns = document.querySelectorAll('header button[onclick*="toggleMenu"]');
    btns.forEach(function(btn) {
        if (btn) {
            btn.title = isRecolhido 
                ? 'Expandir Menu Lateral [Alt+M]' 
                : 'Recolher Menu (Modo Expansivo) [Alt+M]';
            btn.setAttribute('aria-label', isRecolhido ? 'Expandir Menu Lateral' : 'Recolher Menu (Modo Expansivo)');
            if (isRecolhido) {
                btn.classList.add('btn-menu-expansivo-ativo');
            } else {
                btn.classList.remove('btn-menu-expansivo-ativo');
            }
        }
    });

    const btnSidebarDesktop = document.getElementById('btn-recolher-sidebar-desktop');
    if (btnSidebarDesktop) {
        btnSidebarDesktop.title = isRecolhido ? 'Expandir Menu [Alt+M]' : 'Recolher Menu (Modo Expansivo) [Alt+M]';
    }
}
window.atualizarBotoesModoExpansivo = atualizarBotoesModoExpansivo;

// Atalho global Alt+M para alternar Modo Expansivo no Desktop
document.addEventListener('keydown', function(e) {
    if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleMenu();
    }
});

// Fechamento automático no mobile ao clicar em qualquer item do menu ou tecla Escape
document.addEventListener('click', function(e) {
    const navLink = e.target.closest('#sidebar a.nav-btn, #sidebar a');
    if (navLink && window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            toggleMenu();
        }
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
            toggleMenu();
        }
    }
});

// ==========================================
// MÓDULO: MOTOR DE TEMA E IDENTIDADE DO SISTEMA
// ==========================================
function aplicarIdentidadeVisualGlobal() {
    const elNome = document.getElementById('menu-empresa-nome');
    const elLogo = document.getElementById('menu-logo');
    const elPlaceholder = document.getElementById('menu-logo-placeholder');

    // Recupera dados da empresa ativa (em memória ou cache local)
    const empId = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
    let empresaData = window.currentEmpresaData;
    if (!empresaData && empId) {
        try {
            const cache = localStorage.getItem('fc_empresa_cache_' + empId);
            if (cache) empresaData = JSON.parse(cache);
        } catch (e) {}
    }
    if (!empresaData && window.db && window.db.config && window.db.config.empresa) {
        empresaData = window.db.config.empresa;
    }
    if (!empresaData) {
        empresaData = {};
    }

    // Nome fantasia da empresa logada para personalização de marca (White-Label)
    const nomeExibicao = empresaData.nomeFantasia || empresaData.nome || empresaData.fantasia || empresaData.nomeEmpresa || localStorage.getItem('fc_nome_empresa_ativa') || 'FC Gestão';

    if (elNome) {
        elNome.innerText = nomeExibicao;
        elNome.title = nomeExibicao;
    }

    // Logotipo personalizado da empresa cadastrada ou ícone padrão do sistema
    const logoCustom = empresaData.logo || empresaData.logotipo || empresaData.logoUrl || (window.db && window.db.config && window.db.config.empresa && window.db.config.empresa.logo);
    if (elLogo) {
        const isSubdir = window.location.pathname.includes('/sistema/');
        const defaultLogo = (isSubdir ? '../' : './') + 'icons/icone_oficial.png';
        if (logoCustom && String(logoCustom).trim().length > 5) {
            elLogo.src = logoCustom;
            elLogo.onerror = function() {
                this.onerror = null;
                this.src = defaultLogo;
            };
        } else {
            elLogo.src = defaultLogo;
        }
        elLogo.classList.remove('hidden');
        if (elPlaceholder) elPlaceholder.classList.add('hidden');
    }

    // Aplica o tema salvo pelo usuário (Light ou Dark)
    aplicarTema();

    // Sincroniza destaque do menu lateral para a página atual
    if (typeof _destacarMenuAtualGlobal === 'function') {
        _destacarMenuAtualGlobal();
    }
}

function aplicarTema() {
    const tema = localStorage.getItem('fc_theme_sistema') || (window.db && window.db.config && window.db.config.tema) || 'dark';
    aplicarTemaSistema(tema, false);
}



// ===== FUN??ES GLOBAIS DE IA, CONFIRMA??O E VENDAS =====

window.chamarGemini = async function(prompt) {
    try {
        // 1. Verifica se a loja contratou o módulo de IA no plano
        const user = firebase.auth().currentUser;
        const isMaster = user && (user.email === 'pauloaugusto.silvaborges@gmail.com' || user.email === 'fabricadecoresgoiania@gmail.com');
        const mods = window.modulosLiberadosEmpresa;

        // Se for o Fundador ou Super Admin, liberação total
        // Se for lojista, só bloqueia se modulosLiberados foi carregado e não contém 'ia'
        if (!isMaster && Array.isArray(mods) && mods.length > 0 && !mods.includes('ia')) {
            if (typeof showToast === 'function') {
                showToast("O módulo de Inteligência Artificial não está incluso no plano da sua loja. Fale com a administração para ativar!", 'warning');
            }
            return null;
        }

        // 2. Busca da Chave da API com alta redundância:
        let apiKey = '';
        if (window.currentEmpresaData && window.currentEmpresaData.geminiKey) {
            apiKey = window.currentEmpresaData.geminiKey;
        } else if (typeof db !== 'undefined' && db.config && db.config.empresa && db.config.empresa.geminiKey) {
            apiKey = db.config.empresa.geminiKey;
        }

        // 2.1 Busca na empresa ativa do Firestore
        if (!apiKey && typeof window.getEmpresaRef === 'function') {
            try {
                const empDoc = await window.getEmpresaRef().get();
                if (empDoc.exists && empDoc.data().geminiKey) {
                    apiKey = empDoc.data().geminiKey;
                }
            } catch(e) {}
        }

        // 2.2 Fallback nas configurações legadas (fc_moveis/config)
        if (!apiKey) {
            try {
                const legacySnap = await firebase.firestore().collection('fc_moveis').doc('config').get();
                if (legacySnap.exists) {
                    const lData = legacySnap.data();
                    apiKey = (lData.empresa && lData.empresa.geminiKey) || lData.geminiApiKey || '';
                }
            } catch(e) {}
        }

        const apiKeyOriginal = (apiKey || '').trim();

        // 2.3 Validação da chave (chaves do Google AI Studio possuem ao menos 15 caracteres)
        let chaveValidaGoogle = false;
        if (apiKeyOriginal && apiKeyOriginal.length >= 15) {
            chaveValidaGoogle = true;
            apiKey = apiKeyOriginal;
        }

        // 3. Executa diretamente client-side com os modelos vigentes do Google Gemini
        if (chaveValidaGoogle) {
            const modelosParaTentar = [
                'gemini-3.5-flash-lite',
                'gemini-3.8-flash',
                'gemini-3.5-flash',
                'gemini-flash-latest'
            ];

            for (const modelo of modelosParaTentar) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (txt) return txt;
                    } else if (response.status === 401 || response.status === 403) {
                        console.warn(`[IA] Chave Google Gemini rejeitada (HTTP ${response.status}). Tentando Cloud Function...`);
                        break; // Chave inválida ou sem permissão
                    }
                } catch (e) {
                    // Tenta o próximo modelo
                }
            }
        }

        // 4. Fallback Seguro: Se a chave local falhar ou não existir, processa via Cloud Function (backend com Chave Mestra Global do SaaS)
        try {
            if (typeof firebase !== 'undefined' && firebase.functions) {
                const empIdAtual = (typeof _obterEmpresaId === 'function') ? _obterEmpresaId() : (localStorage.getItem('fc_empresa_ativa') || 'emp_fc_moveis');
                const chamarGeminiFn = firebase.functions().httpsCallable('chamarGemini');
                const res = await chamarGeminiFn({ prompt: prompt, empId: empIdAtual });
                if (res && res.data) return res.data;
            }
        } catch (fnErr) {
            console.warn("[IA] Execução remota via Cloud Function falhou:", fnErr);
        }

        // 5. Se nenhuma via conseguiu processar, informa claramente o usuário
        console.warn("[IA] Chave Gemini não configurada ou serviço indisponível temporariamente.");
        if (typeof showToast === 'function') {
            showToast("A Chave de Inteligência Artificial do Google Gemini ainda não foi configurada ou está temporariamente indisponível.", 'warning');
        }
        return null;
    } catch (e) {
        console.error("Erro ao chamar IA Gemini:", e);
        return null;
    }
};

let callbackConfirmacaoGlobal = null;
window.abrirConfirmacao = function(titulo, msg, callback) {
    callbackConfirmacaoGlobal = callback;
    const modal = document.getElementById('modal-confirmacao');
    if (modal) {
        const titEl = document.getElementById('modal-confirmacao-titulo');
        const msgEl = document.getElementById('modal-confirmacao-msg');
        if (titEl) titEl.innerText = titulo;
        if (msgEl) msgEl.innerText = msg;
        modal.classList.remove('hidden');
    } else {
        if (confirm(`${titulo}\n\n${msg}`)) {
            if (typeof callback === 'function') callback();
        }
    }
};

window.fecharModalConfirmacao = function() {
    const modal = document.getElementById('modal-confirmacao');
    if (modal) modal.classList.add('hidden');
    callbackConfirmacaoGlobal = null;
};

window.executarAcaoConfirmada = function() {
    if (typeof callbackConfirmacaoGlobal === 'function') {
        callbackConfirmacaoGlobal();
    }
    window.fecharModalConfirmacao();
};

window.reimprimirVenda = function(id) {
    const v = (window.db && window.db.vendas) ? window.db.vendas.find(x => String(x.id) === String(id)) : null; 
    if(!v) return showToast('Venda não encontrada.', 'error');
    
    window.vendaAtualImpressao = v;
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const cliEndCompleto = (typeof window.formatarEnderecoCompletoCliente === 'function') 
        ? window.formatarEnderecoCompletoCliente(v) 
        : (v.clienteEnd || '');
    const htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÓVEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: REIMPRESSÃO</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data Original: ${new Date(v.data).toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${v.clienteNome || '-'}</p>${cliEndCompleto && cliEndCompleto !== 'Não informado' ? `<p style="margin: 2px 0;">Endereço Completo: ${cliEndCompleto}</p>` : ''}<p style="margin: 2px 0;">Vendedor: ${v.vendedor || '-'}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${(v.itens || []).map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${typeof formatMoney === 'function' ? formatMoney(i.preco*i.qtd) : (i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total Final: ${typeof formatMoney === 'function' ? formatMoney(v.tot || v.valorLiquido) : (v.tot || v.valorLiquido)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${v.pag || 'Diversos'}</p></div>`;
    
    const printArea = document.getElementById('print-area');
    const modalRecibo = document.getElementById('modal-opcoes-recibo');
    if (printArea && modalRecibo) {
        printArea.innerHTML = htmlRecibo; 
        modalRecibo.classList.remove('hidden');
    } else {
        printHtmlSeguro(htmlRecibo);
    }
};

// ==========================================
// IMPRESSÃO SEGURA BLINDADA CONTRA BLOQUEIO DE POPUP
// ==========================================
window.printHtmlSeguro = function(htmlCompleto) {
    try {
        let printFrame = document.getElementById('fc-iframe-print-seguro');
        if (!printFrame) {
            printFrame = document.createElement('iframe');
            printFrame.id = 'fc-iframe-print-seguro';
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            printFrame.style.zIndex = '-99999';
            printFrame.style.visibility = 'hidden';
            document.body.appendChild(printFrame);
        }
        
        const isThermal = htmlCompleto && (htmlCompleto.includes('80mm') || htmlCompleto.includes('72mm') || htmlCompleto.includes('monospace'));
        const pageCss = isThermal 
            ? `@page { size: 80mm auto; margin: 2mm; } body { margin: 2mm; width: 72mm; }`
            : `@page { size: A4 portrait; margin: 8mm 10mm 10mm 10mm; }
        *, *::before, *::after { box-sizing: border-box !important; }
        html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; background: #fff !important; color: #000 !important; overflow: visible !important; }
        @media print { body { margin: 0 !important; padding: 4mm 6mm !important; width: 100% !important; box-sizing: border-box !important; } }
        .overflow-x-auto, .table-wrapper, .fc-table-wrap { overflow: visible !important; display: block !important; }
        table { width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
        th, td { word-break: break-word !important; }`;

        const paginaHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Impressão</title>
    <style>
        ${pageCss}
        body { font-family: Arial, sans-serif; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
</head>
<body>
    ${htmlCompleto}
    <script>
        window.addEventListener('load', () => {
            setTimeout(() => {
                try {
                    window.focus();
                    window.print();
                } catch(e) {}
            }, 300);
        });
    </` + `script>
</body>
</html>`;

        if ('srcdoc' in printFrame) {
            printFrame.srcdoc = paginaHtml;
        } else {
            const frameDoc = printFrame.contentWindow.document;
            frameDoc.open();
            frameDoc.write(paginaHtml);
            frameDoc.close();
            setTimeout(() => {
                try {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.print();
                } catch(e) {
                    console.warn('Fallback print:', e);
                    window.print();
                }
            }, 350);
        }
    } catch(err) {
        console.error('Falha no print seguro via iframe, tentando fallback:', err);
        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.write(htmlCompleto);
            printWin.document.close();
            printWin.focus();
            printWin.print();
        } else {
            showToast("Permita popups ou visualize o contrato na tela.", "warning");
        }
    }
};

// ==========================================
// FUNÇÕES UNIVERSAIS DE FORMATAÇÃO DE ENDEREÇO COMPLETO DO CLIENTE COM CEP
// ==========================================
window.formatarEnderecoCompletoCliente = function(clienteOuVenda, fallbackContexto) {
    if (!clienteOuVenda && !fallbackContexto) return 'Não informado';
    
    let obj = clienteOuVenda;
    let fallback = fallbackContexto || null;

    if (typeof obj === 'string') {
        const strTrim = obj.trim();
        if (!fallback && (!strTrim || strTrim === 'Não informado')) return 'Não informado';
        if (fallback) {
            obj = fallback;
            if (!obj.clienteEnd) obj.clienteEnd = strTrim;
        } else {
            return strTrim;
        }
    }

    if (!obj || typeof obj !== 'object') return 'Não informado';

    let cliDb = null;
    const cId = obj.clienteId || obj.id || (fallback && (fallback.clienteId || fallback.id));
    const clientesList = (typeof db !== 'undefined' && Array.isArray(db.clientes)) 
        ? db.clientes 
        : ((typeof window.db !== 'undefined' && Array.isArray(window.db.clientes)) ? window.db.clientes : []);

    if (cId && cId !== '0') {
        cliDb = clientesList.find(x => String(x.id || x._id || '').trim() === String(cId).trim());
    }
    if (!cliDb && obj.clienteDoc && obj.clienteDoc !== 'Não informado') {
        const cleanDoc = String(obj.clienteDoc).replace(/\D/g, '');
        if (cleanDoc) {
            cliDb = clientesList.find(x => {
                const d = String(x.doc || x.cpf || x.cnpj || x.cpfCnpj || '').replace(/\D/g, '');
                return d && d === cleanDoc;
            });
        }
    }

    const dest = obj.destinatario || (cliDb && cliDb.destinatario) || obj.cliente || {};

    let rua = (cliDb?.rua || cliDb?.logradouro || cliDb?.endereco || cliDb?.end ||
               dest?.rua || dest?.logradouro || dest?.endereco ||
               obj.clienteRua || obj.rua || obj.logradouro || '').trim();

    let numero = (cliDb?.numero || cliDb?.num ||
                  dest?.numero ||
                  obj.clienteNumero || obj.numero || '').trim();

    let complemento = (cliDb?.complemento || cliDb?.compl ||
                       dest?.complemento ||
                       obj.clienteComplemento || obj.complemento || '').trim();

    let bairro = (cliDb?.bairro ||
                  dest?.bairro ||
                  obj.clienteBairro || obj.bairro || '').trim();

    let cidade = (cliDb?.cidade || cliDb?.municipio ||
                  dest?.cidade || dest?.municipio ||
                  obj.clienteCidade || obj.cidade || '').trim();

    let uf = (cliDb?.uf || cliDb?.estado ||
              dest?.uf || dest?.estado ||
              obj.clienteUf || obj.uf || '').trim().toUpperCase();

    let rawCep = (cliDb?.cep ||
                  dest?.cep ||
                  obj.clienteCep || obj.cep || '').toString().trim();

    let endBase = (obj.clienteEnd && obj.clienteEnd !== 'Não informado') ? String(obj.clienteEnd).trim() : '';

    if (!rua && endBase) {
        rua = endBase;
    }

    if (cidade.includes(' - ')) {
        const parts = cidade.split(' - ');
        cidade = parts[0].trim();
        if (!uf && parts[1]) uf = parts[1].trim().toUpperCase();
    } else if (cidade.includes('/')) {
        const parts = cidade.split('/');
        cidade = parts[0].trim();
        if (!uf && parts[1]) uf = parts[1].trim().toUpperCase();
    }

    let cepFmt = '';
    const cepDigits = rawCep.replace(/\D/g, '');
    if (cepDigits.length === 8) {
        cepFmt = `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`;
    } else if (rawCep) {
        cepFmt = rawCep;
    }

    const partes = [];

    if (rua) {
        let parteRua = rua;
        if (numero && !parteRua.toLowerCase().includes('nº') && !parteRua.toLowerCase().includes('numero') && !parteRua.endsWith(numero)) {
            parteRua += `, nº ${numero}`;
        }
        partes.push(parteRua);
    } else if (endBase) {
        partes.push(endBase);
    }

    if (complemento && !partes.join(', ').toLowerCase().includes(complemento.toLowerCase())) {
        partes.push(complemento);
    }

    if (bairro) {
        const bairroClean = bairro.replace(/^bairro\s+/i, '');
        if (!partes.join(', ').toLowerCase().includes(bairroClean.toLowerCase())) {
            partes.push(`Bairro ${bairroClean}`);
        }
    }

    if (cidade) {
        const cidUfStr = uf ? `${cidade} - ${uf}` : cidade;
        if (!partes.join(', ').toLowerCase().includes(cidade.toLowerCase())) {
            partes.push(cidUfStr);
        }
    }

    if (cepFmt) {
        const strAtual = partes.join(', ');
        if (!strAtual.toLowerCase().includes('cep') && !strAtual.includes(cepFmt)) {
            partes.push(`CEP: ${cepFmt}`);
        }
    }

    if (partes.length > 0) {
        return partes.join(', ');
    }

    if (endBase) {
        if (cepFmt && !endBase.toLowerCase().includes('cep') && !endBase.includes(cepFmt)) {
            return `${endBase}, CEP: ${cepFmt}`;
        }
        return endBase;
    }

    return 'Não informado';
};
window.formatarEnderecoCompleto = window.formatarEnderecoCompletoCliente;

if (typeof window.obterDadosClientePDV !== 'function') {
    window.obterDadosClientePDV = function(cId) {
        const clientesList = (typeof db !== 'undefined' && Array.isArray(db.clientes)) 
            ? db.clientes 
            : ((typeof window.db !== 'undefined' && Array.isArray(window.db.clientes)) ? window.db.clientes : []);
        const c = cId && cId !== "0" ? clientesList.find(x => String(x.id || x._id || '').trim() === String(cId).trim()) : null;
        if(!c) return {
            id: '',
            nome: 'Consumidor Final',
            doc: 'Não informado',
            cpf: '',
            cnpj: '',
            tel: 'Não informado',
            rua: '',
            numero: '',
            complemento: '',
            bairro: '',
            cidade: '',
            uf: '',
            cep: '',
            ibge: '',
            endCompleto: 'Não informado',
            raw: null
        };

        const doc = c.cpfCnpj || c.documento || c.cnpj || c.cpf || c.doc || c.cpf_cnpj || 'Não informado';
        const tel = c.whatsapp || c.wpp || c.celular || c.telefone || c.telefoneFixo || c.tel || 'Não informado';
        const rua = c.rua || c.logradouro || c.endereco || c.end || '';
        const num = c.numero || '';
        const complemento = c.complemento || c.compl || '';
        const bairro = c.bairro || '';
        
        let cidadeLimpa = (c.cidade || '').trim();
        let ufLimpa = (c.uf || '').trim().toUpperCase();
        if (cidadeLimpa.includes(' - ')) {
            const parts = cidadeLimpa.split(' - ');
            cidadeLimpa = parts[0].trim();
            if (!ufLimpa && parts[1]) ufLimpa = parts[1].trim().toUpperCase();
        } else if (cidadeLimpa.includes('/')) {
            const parts = cidadeLimpa.split('/');
            cidadeLimpa = parts[0].trim();
            if (!ufLimpa && parts[1]) ufLimpa = parts[1].trim().toUpperCase();
        }

        const cepLimpo = (c.cep ? String(c.cep).replace(/\D/g, '') : '');
        const ibgeLimpo = (c.ibge || '').trim();
        const endCompleto = window.formatarEnderecoCompletoCliente(c);

        return {
            id: c.id,
            nome: c.nome || c.razaoSocial || 'Consumidor Final',
            doc: doc,
            cpf: (doc.replace(/\D/g, '').length === 11) ? doc.replace(/\D/g, '') : (c.cpf ? c.cpf.replace(/\D/g, '') : ''),
            cnpj: (doc.replace(/\D/g, '').length === 14) ? doc.replace(/\D/g, '') : (c.cnpj ? c.cnpj.replace(/\D/g, '') : ''),
            tel: tel,
            rua: rua,
            numero: num || 'S/N',
            complemento: complemento,
            bairro: bairro,
            cidade: cidadeLimpa,
            uf: ufLimpa,
            cep: cepLimpo,
            ibge: ibgeLimpo,
            endCompleto: endCompleto,
            raw: c
        };
    };
}

// ==========================================
// MOTOR UNIVERSAL DE VISUALIZAÇÃO E IMPRESSÃO DO CONTRATO
// ==========================================
window.abrirModalContrato = function(vendaOuId) {
    let v = vendaOuId;
    if (typeof vendaOuId === 'string' || typeof vendaOuId === 'number') {
        const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
            ? db.vendas 
            : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
        v = todasVendas.find(x => String(x.id) === String(vendaOuId));
    }
    if (!v) {
        showToast("Venda não encontrada para gerar contrato.", "error");
        return;
    }
    window.vendaAtualImpressao = v;
    
    // Obter dados da empresa e cliente
    const empAtivaIdContr = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
    const fallbackNomeContr = (window.currentEmpresaData?.nomeEmpresa) || localStorage.getItem('fc_nome_empresa_ativa') || (empAtivaIdContr === 'emp_fc_moveis' ? 'FC MÓVEIS' : 'MINHA LOJA');
    const emp = (typeof obterDadosEmpresa === 'function') ? obterDadosEmpresa() : { nome: fallbackNomeContr, cnpj: '', end: '', tel: '', logoHtml: '' };
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id || '').slice(-4);
    
    const cliInfo = (typeof obterDadosClientePDV === 'function') ? obterDadosClientePDV(v.clienteId) : (typeof window.obterDadosClientePDV === 'function' ? window.obterDadosClientePDV(v.clienteId) : null);
    const cliNome = (cliInfo && cliInfo.nome !== 'Consumidor Final') ? cliInfo.nome : (v.clienteNome || v.cliente || 'Consumidor Final');
    const cliCpf = (cliInfo && cliInfo.doc !== 'Não informado') ? cliInfo.doc : (v.clienteDoc || 'Não informado');
    const cliTel = (cliInfo && cliInfo.tel !== 'Não informado') ? cliInfo.tel : (v.clienteTel || 'Não informado');
    const cliEndCompleto = window.formatarEnderecoCompletoCliente(v, cliInfo);
    
    // Itens
    let totalDescontoItens = 0;
    let subtotalItensBruto = 0;
    const prodsList = (typeof db !== 'undefined' && Array.isArray(db.produtos)) ? db.produtos : [];
    
    let itensHtml = (v.itens || []).map((i, idx) => {
        const prodDb = prodsList.find(p => String(p.id) === String(i.id));
        const fotoHtml = (prodDb && prodDb.foto) ? `<div style="margin-right: 15px; flex-shrink: 0;"><img src="${prodDb.foto}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;"></div>` : '';
        const qtdItem = Number(i.qtd) || 1;
        const precoUnit = Number(i.preco) || 0;
        const subItemBruto = precoUnit * qtdItem;
        const descItem = Number(i.desconto) || 0;
        const totalItemLiquido = Math.max(0, subItemBruto - descItem);
        subtotalItensBruto += subItemBruto;
        totalDescontoItens += descItem;

        const fm = typeof formatMoney === 'function' ? formatMoney : (x => 'R$ ' + Number(x||0).toFixed(2));
        let valorLinhaHtml = `Valor: ${fm(subItemBruto)}`;
        if (descItem > 0) {
            valorLinhaHtml = `Valor Unitário: ${fm(precoUnit)} x ${qtdItem} = ${fm(subItemBruto)}<br>` +
                             `Desconto do Item: - ${fm(descItem)}<br>` +
                             `Valor com Desconto: ${fm(totalItemLiquido)}`;
        }

        const customTexto = (typeof formatarCustomizacaoContratoTexto === "function") ? formatarCustomizacaoContratoTexto(i.customizacao) : "";

        return `
        <div style="margin-bottom: 15px; display: flex; align-items: flex-start; border-bottom: 1px dashed #e2e8f0; padding-bottom: 12px;">
            ${fotoHtml}
            <div style="flex: 1;">
                <strong style="color: #0f172a;">PRODUTO / SERVIÇO ${idx + 1}</strong><br>
                <strong>Descrição:</strong> ${i.nome || 'Item'} ${i.obsVenda ? ` - Obs: ${i.obsVenda}` : ''}<br>
                ${customTexto ? `${customTexto}<br>` : ''}
                <strong>Quantidade:</strong> ${qtdItem} unidade(s)<br>
                ${valorLinhaHtml}<br>
                <span style="font-size: 12px; color: #64748b;">Situação do produto: ( ) Produto em estoque &nbsp;&nbsp;&nbsp; ( ) Produto sob fabricação</span>
            </div>
        </div>
        `;
    }).join('');

    let dataEntregaFormatada = '___/___/20__';
    const dataEntregaBruta = v.dataEntrega || (v.servicoDetalhes && v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo : '');
    if (dataEntregaBruta) {
        if (dataEntregaBruta.includes('-')) {
            const partes = dataEntregaBruta.split('T')[0].split('-');
            if (partes.length === 3) dataEntregaFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            else dataEntregaFormatada = dataEntregaBruta;
        } else {
            dataEntregaFormatada = dataEntregaBruta;
        }
    }

    const descGeral = Number(v.desconto) || 0;
    const totalDescontoGeral = descGeral + totalDescontoItens;
    const temDescontoNoContrato = totalDescontoGeral > 0;
    const subtotalBruto = (v.subtotal && v.subtotal > 0) ? (v.subtotal + totalDescontoItens) : subtotalItensBruto;
    const fm = typeof formatMoney === 'function' ? formatMoney : (x => 'R$ ' + Number(x||0).toFixed(2));
    const dataEmissao = v.data ? new Date(v.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

    const htmlContrato = `
    <div id="documento-contrato-imprimivel" style="font-family: Arial, sans-serif; color: #000; width: 100%; max-width: 800px; margin: 0 auto; line-height: 1.5; font-size: 13.5px;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 18px;">
            ${emp.logoHtml || ''}
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">${emp.nome}</h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #334155;">CNPJ: ${emp.cnpj || 'Não informado'}<br>Endereço: ${emp.end || 'Não informado'}<br>Telefone / WhatsApp: ${emp.tel || 'Não informado'}</p>
        </div>

        <h2 style="text-align: center; font-size: 17px; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">CONTRATO DE COMPRA E VENDA E SERVIÇOS</h2>
        <p style="text-align: center; font-weight: bold; margin-top: 0; margin-bottom: 18px; color: #1e40af;">PEDIDO Nº ${numPedStr}</p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">1. DADOS DO CLIENTE (COMPRADOR)</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px;">
            <strong>Nome completo:</strong> ${cliNome}<br>
            <strong>CPF/CNPJ:</strong> ${cliCpf}<br>
            <strong>Telefone / WhatsApp:</strong> ${cliTel}<br>
            <strong>Endereço Completo:</strong> ${cliEndCompleto}
        </p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">2. OBJETO DO CONTRATO</h3>
        <p style="margin-top: 0; margin-bottom: 12px; padding-left: 6px;">O presente contrato tem como objeto a venda do(s) produto(s) / serviço(s) descrito(s) abaixo:</p>
        <div style="padding-left: 6px;">${itensHtml || '<p>Sem itens discriminados.</p>'}</div>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; margin-top: 16px; text-transform: uppercase;">3. VALOR TOTAL E PAGAMENTO</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px;">
            ${temDescontoNoContrato ? `<strong>Subtotal:</strong> ${fm(subtotalBruto)}<br>` : ''}
            ${temDescontoNoContrato ? `<strong>Desconto Total:</strong> - ${fm(totalDescontoGeral)}<br>` : ''}
            ${v.frete && Number(v.frete) > 0 ? `<strong>Taxas / Frete (+):</strong> ${fm(v.frete)}<br>` : ''}
            <strong>Valor Total:</strong> <span style="font-size: 15px; font-weight: bold; color: #1e3a8a;">${fm(v.tot || v.total || 0)}</span><br>
            ${v.vendaComEntradaEntrega ? `
            <div style="margin: 8px 0; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 5px; padding: 10px; font-size: 13px;">
                <strong style="color: #1e3a8a; text-transform: uppercase; font-size: 12px;"><i class="fa-solid fa-truck-ramp-box"></i> Condição Acordada: Móveis com Entrada + Saldo na Entrega</strong>
                <div style="margin-top: 6px; padding-bottom: 6px; border-bottom: 1px dashed #cbd5e1;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
                        <span>1. Entrada / Sinal (Pago no Pedido):</span>
                        <span style="color: #15803d;">Total: ${fm(v.valorEntrada)} [QUITADO NO ATO]</span>
                    </div>
                    ${(v.pagamentosEntrada && v.pagamentosEntrada.length > 0)
                        ? v.pagamentosEntrada.map(p => `
                            <div style="display: flex; justify-content: space-between; font-size: 12px; padding-left: 10px; color: #334155;">
                                <span>▪ ${p.metodo}${p.parcelas > 1 ? ' (' + p.parcelas + 'x de ' + fm(p.valor / p.parcelas) + ')' : ''}</span>
                                <strong>${fm(p.valor)}</strong>
                            </div>
                        `).join('')
                        : `
                            <div style="display: flex; justify-content: space-between; font-size: 12px; padding-left: 10px; color: #334155;">
                                <span>▪ ${v.formaEntrada || 'Pago'}${v.parcelasEntrada > 1 ? ' (' + v.parcelasEntrada + 'x de ' + fm(v.valorEntrada / v.parcelasEntrada) + ')' : ''}</span>
                                <strong>${fm(v.valorEntrada)}</strong>
                            </div>
                        `
                    }
                </div>
                <div style="margin-top: 6px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
                        <span>2. Saldo Restante a Pagar na Entrega:</span>
                        <span style="color: #b91c1c;">Total: ${fm(v.saldoEntrega)} ${v.saldoEntregaPago ? '<span style="color: #15803d;">[QUITADO]</span>' : '[PAGAMENTO OBRIGATÓRIO NA ENTREGA]'}</span>
                    </div>
                    ${(v.pagamentosEntrega && v.pagamentosEntrega.length > 0)
                        ? v.pagamentosEntrega.map(p => `
                            <div style="display: flex; justify-content: space-between; font-size: 12px; padding-left: 10px; color: #334155;">
                                <span>▪ ${p.metodo}${p.parcelas > 1 ? ' (' + p.parcelas + 'x de ' + fm(p.valor / p.parcelas) + ' na Maquininha/Entrega)' : ''}</span>
                                <strong>${fm(p.valor)}</strong>
                            </div>
                        `).join('')
                        : `
                            <div style="display: flex; justify-content: space-between; font-size: 12px; padding-left: 10px; color: #334155;">
                                <span>▪ ${v.formaEntregaPrevista || 'Forma combinada'}${v.parcelasEntrega > 1 ? ' (' + v.parcelasEntrega + 'x de ' + fm(v.saldoEntrega / v.parcelasEntrega) + ' na Maquininha/Entrega)' : ''}</span>
                                <strong>${fm(v.saldoEntrega)}</strong>
                            </div>
                        `
                    }
                </div>
            </div>
            ` : ''}
            <strong>Forma de Pagamento:</strong> ${v.pag || 'Conforme acordado'}<br>
            <strong>Data da Operação:</strong> ${dataEmissao}
        </p>

        ${v.vendaComEntradaEntrega ? `
        <h3 style="font-size: 13px; font-weight: bold; background: #fef3c7; color: #92400e; padding: 6px 10px; border: 1.5px solid #f59e0b; margin-bottom: 8px; margin-top: 14px; text-transform: uppercase;">CLÁUSULA DE CONDICIONAMENTO DA ENTREGA AO PAGAMENTO DO SALDO</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding: 8px 10px; text-align: justify; font-size: 12.5px; color: #78350f; background: #fffdf5; border: 1px dashed #fcd34d; border-radius: 4px;">
            Fica expressamente acordado entre as partes que a entrega física do(s) móvel(is) e a respectiva transferência de posse estão <strong>estritamente condicionadas à quitação integral do Saldo Restante no valor de ${fm(v.saldoEntrega)}</strong> no exato momento do recebimento/descarregamento, pela(s) forma(s) ajustada(s) (<strong>${(v.pagamentosEntrega && v.pagamentosEntrega.length > 0) ? v.pagamentosEntrega.map(p => p.metodo + (p.parcelas > 1 ? ' em ' + p.parcelas + 'x de ' + fm(p.valor / p.parcelas) : '') + ' [' + fm(p.valor) + ']').join(' + ') : (v.formaEntregaPrevista || 'conforme combinado') + (v.parcelasEntrega > 1 ? ' em ' + v.parcelasEntrega + 'x de ' + fm(v.saldoEntrega / v.parcelasEntrega) : '')}</strong>). Em caso de recusa, inadimplência ou falta de meios acordados para quitação do saldo no ato da entrega, a equipe transportadora fica desde já autorizada a <strong>reter e retornar a mercadoria</strong> à sede da empresa, respondendo o comprador pelas taxas de reentrega e novo agendamento logístico.
        </p>
        ` : ''}

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">4. PRAZO DE ENTREGA E GARANTIA</h3>
        <p style="margin-top: 0; margin-bottom: 10px; padding-left: 6px; text-align: justify;">O prazo de entrega válido é a <strong>Data Prevista de Entrega Acordada</strong> informada neste pedido. Havendo eventuais imprevistos operacionais, de transporte, fabricação ou intempéries, fica acordado um prazo adicional de tolerância de até 7 (sete) dias corridos.<br>O produto/serviço possui garantia legal de 90 (noventa) dias contra defeitos de fabricação.</p>

        ${dataEntregaFormatada !== '___/___/20__' ? `<p style="margin-top: 6px; font-weight: bold; background-color: #eff6ff; padding: 8px 12px; border-left: 4px solid #2563eb; border-radius: 4px;">Data Prevista de Entrega Acordada: <span style="font-size: 15px; color: #1e3a8a;">${dataEntregaFormatada}</span></p>` : ''}

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; margin-top: 14px; text-transform: uppercase;">5. LOCAL DE ENTREGA</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px;"><strong>Endereço de Entrega:</strong> ${cliEndCompleto}<br><strong>Data Prevista de Entrega:</strong> <span style="font-weight: bold;">${dataEntregaFormatada}</span></p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">6. TRANSPORTE E MONTAGEM</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px;">( ) Entrega realizada pela empresa &nbsp;&nbsp;&nbsp; ( ) Retirada pelo cliente<br>Montagem: ( ) Inclusa &nbsp;&nbsp;&nbsp; ( ) Não inclusa<br>Caso a entrega seja realizada pela empresa, o cliente deve garantir acesso adequado ao local.</p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">7. MEDIDAS E ACESSO AO LOCAL</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px; text-align: justify;">O cliente declara que verificou as medidas do local de instalação e acesso (portas, corredores, elevadores e escadas). Caso o móvel não possa ser entregue ou instalado por falta de espaço ou acesso, a empresa não se responsabiliza por custos adicionais de transporte ou nova entrega.</p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">8. CONFERÊNCIA NO ATO DA ENTREGA</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px; text-align: justify;">O cliente deverá verificar o produto no momento da entrega. Após assinatura do recebimento, entende-se que o produto foi entregue em perfeitas condições.<br><strong>A garantia não cobre:</strong> Mau uso do produto; Danos causados após a entrega; Exposição à umidade excessiva; Sobrecarga de peso; Alterações feitas por terceiros.</p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">9. CANCELAMENTO E ATRASO</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px; text-align: justify;">Pedidos de produtos fabricados sob encomenda não poderão ser cancelados após o início da produção. Caso haja cancelamento após início da fabricação, poderá ser cobrada taxa referente aos custos de produção.<br>Em caso de atraso no pagamento do saldo, poderá ser aplicada multa de 2% sobre o valor devido, além de juros de 1% ao mês.</p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">10. OBSERVAÇÕES DO PEDIDO</h3>
        <p style="margin-top: 0; margin-bottom: 14px; padding-left: 6px;">${v.obs || 'Sem observações adicionais.'}</p>

        <h3 style="font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; margin-bottom: 8px; text-transform: uppercase;">11. ACEITE DAS CONDIÇÕES</h3>
        <p style="margin-top: 0; margin-bottom: 24px; padding-left: 6px;">Ao assinar este contrato, o comprador declara estar ciente e de acordo com todas as condições descritas neste documento.</p>

        <div style="margin-top: 36px; text-align: center; page-break-inside: avoid;">
            <p>Data do Acordo: ${new Date().toLocaleDateString('pt-BR')}</p>
            <div style="display: flex; justify-content: space-between; margin-top: 45px;">
                <div style="width: 45%;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">VENDEDOR / EMPRESA</div>
                    <p style="font-size: 12px; margin-top: 2px;">${v.vendedor ? `Vendedor: ${v.vendedor}<br>` : ''}<strong>${emp.nome}</strong></p>
                </div>
                <div style="width: 45%;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">COMPRADOR(A)</div>
                    <p style="font-size: 12px; margin-top: 2px;">Nome: ${cliNome}</p>
                </div>
            </div>
        </div>
    </div>
    `;

    window._htmlContratoAtual = htmlContrato;
    const modalAntigo = document.getElementById('modal-preview-contrato');
    if (modalAntigo) modalAntigo.remove();

    if (typeof printHtmlSeguro === 'function') {
        printHtmlSeguro(`<div style="width: 100%; max-width: 100%; box-sizing: border-box; margin: 0 auto; padding: 0; background: #fff;">${htmlContrato}</div>`);
    } else {
        window.print();
    }
};

window.fecharModalPreviewContrato = function() {
    const modal = document.getElementById('modal-preview-contrato');
    if (modal) modal.classList.add('hidden');
};

window.imprimirContratoDiretoModal = function() {
    if (window._htmlContratoAtual) {
        if (typeof printHtmlSeguro === 'function') {
            printHtmlSeguro(`<div style="width: 100%; max-width: 100%; box-sizing: border-box; margin: 0 auto; padding: 0; background: #fff;">${window._htmlContratoAtual}</div>`);
        } else {
            window.print();
        }
    }
};

window.imprimirContratoAtual = function() {
    if (window.vendaAtualImpressao) {
        window.abrirModalContrato(window.vendaAtualImpressao);
    } else {
        showToast("Nenhuma venda selecionada para imprimir o contrato.", "error");
    }
};

window.imprimirContratoObj = function(v) {
    if (v) {
        window.abrirModalContrato(v);
    } else {
        showToast("Nenhuma venda selecionada.", "error");
    }
};

window.imprimirContratoById = function(id) {
    window.abrirModalContrato(id);
};
window.abrirOrdemProducao = function(vendaOuId) {
    let v = vendaOuId;
    if (typeof vendaOuId === 'string' || typeof vendaOuId === 'number') {
        const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
            ? db.vendas 
            : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
        v = todasVendas.find(x => String(x.id) === String(vendaOuId));
    }
    if (!v) {
        showToast("Venda não encontrada para gerar a Ordem de Produção.", "error");
        return;
    }
    window.vendaAtualImpressao = v;

    const empAtivaIdContr = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
    const fallbackNomeContr = (window.currentEmpresaData?.nomeEmpresa) || localStorage.getItem('fc_nome_empresa_ativa') || (empAtivaIdContr === 'emp_fc_moveis' ? 'FC MÓVEIS' : 'MINHA LOJA');
    const emp = (typeof obterDadosEmpresa === 'function') ? obterDadosEmpresa() : { nome: fallbackNomeContr, cnpj: '', end: '', tel: '', logoHtml: '' };

    const cliInfo = (typeof obterDadosClientePDV === 'function') ? obterDadosClientePDV(v.clienteId) : (typeof window.obterDadosClientePDV === 'function' ? window.obterDadosClientePDV(v.clienteId) : null);
    const cliNome = (cliInfo && cliInfo.nome && cliInfo.nome !== 'Consumidor Final') ? cliInfo.nome : (v.clienteNome || v.cliente || 'Consumidor Final');
    const cliEndCompleto = window.formatarEnderecoCompletoCliente(v, cliInfo);

    const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : null;
    const vendedorNome = v.vendedorNome || v.vendedor || (opAtual && opAtual.nome) || (window.currentUserInfo && window.currentUserInfo.nome) || 'Atendente';

    const dataVenda = v.data ? new Date(v.data) : new Date();
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const diaStr = String(dataVenda.getDate()).padStart(2, '0');
    const mesStr = meses[dataVenda.getMonth()];
    const anoStr = dataVenda.getFullYear();

    let cidadeEmp = '';
    if (window.db && window.db.config && window.db.config.empresa && window.db.config.empresa.cidade) {
        cidadeEmp = window.db.config.empresa.cidade;
    } else if (emp.end && emp.end.includes('-')) {
        const parts = emp.end.split('-');
        cidadeEmp = parts[parts.length - 1].trim();
    }
    const dataExtenso = `${cidadeEmp ? cidadeEmp + ' ' : ''}${diaStr}, de ${mesStr} de ${anoStr}`;
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id || '').slice(-4);

    const prodsList = (typeof db !== 'undefined' && Array.isArray(db.produtos)) ? db.produtos : [];
    const itens = (v.itens && v.itens.length > 0) ? v.itens : [];

    const blocosItensHtml = itens.map((item, idx) => {
        const prodDb = prodsList.find(p => String(p.id) === String(item.id)) || {};
        const c = item.customizacao || prodDb.customizacaoPadrao || prodDb.customizacao || {};
        const foto = item.foto || prodDb.foto || (prodDb.fotos && prodDb.fotos[0]) || '';

        const linha = prodDb.categoria || prodDb.subcategoria || prodDb.marca || 'Palito';
        const material = c.madeira || 'Eucalipto';
        const acabamento = c.corMadeira || 'Natural';

        let medidaStr = '';
        const m = c.medidas || {};
        const partesMed = [];
        if (m.largura) partesMed.push(`L: ${m.largura}`);
        if (m.altura) partesMed.push(`A: ${m.altura}`);
        if (m.profundidade) partesMed.push(`P: ${m.profundidade}`);
        if (partesMed.length > 0) {
            medidaStr = partesMed.join(' x ');
        } else {
            medidaStr = prodDb.unidade ? `Unidade (${prodDb.unidade})` : '1.30';
        }

        const tecidoStr = [c.estofado, c.corEstofado].filter(Boolean).join(' - ');
        const qtdStr = `(${String(Math.round(item.qtd || 1)).padStart(2, '0')})`;

        const obsLista = [];
        if (c.obsExtra) obsLista.push(c.obsExtra);
        if (item.obsVenda && item.obsVenda !== c.obsExtra) obsLista.push(item.obsVenda);
        const obsStr = obsLista.length > 0 ? obsLista.join('<br>') : 'Padrão de fabricação';

        const fotoHtml = foto ? `
            <div style="text-align: center; margin: 25px auto 10px auto;">
                <img src="${foto}" style="max-height: 420px; max-width: 95%; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
            </div>
        ` : `
            <div style="text-align: center; margin: 25px auto 10px auto; padding: 40px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; color: #94a3b8; font-size: 13px;">
                <i class="fa-solid fa-couch" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
                Foto de referência não anexada ao produto.
            </div>
        `;

        return `
            <div class="bloco-item-op" style="${idx > 0 ? 'page-break-before: always; margin-top: 30px;' : ''}">
                <div style="margin: 20px 0 10px 0; font-size: 13px; line-height: 2;">
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Produto:</span>
                        <span style="flex: 1; font-weight: 700; color: #0f172a;">${item.nome}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Linha:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${linha}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Material:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${material}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Medida:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${medidaStr}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Acabamento:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${acabamento}</span>
                    </div>
                    ${tecidoStr ? `
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Estofado/Tecido:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${tecidoStr}</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Quantidade:</span>
                        <span style="flex: 1; font-weight: 700; color: #0f172a;">${qtdStr}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Observações:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${obsStr}</span>
                    </div>
                </div>

                ${fotoHtml}
            </div>
        `;
    }).join('');

    const logoHtml = emp.logoHtml || (emp.logo ? `<img src="${emp.logo}" style="max-height: 85px; margin-bottom: 8px; object-fit: contain;">` : `<h2 style="margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; color: #475569;">${emp.nome}</h2>`);

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast("Por favor, permita pop-ups para imprimir a Ordem de Produção.", "warning");
        return;
    }

    const wppTexto = encodeURIComponent(`*ORDEM DE PRODUÇÃO #${numPedStr}*\nCliente: ${cliNome}\nVendedora: ${vendedorNome}\nData: ${dataExtenso}`);
    const wppLink = `https://api.whatsapp.com/send?text=${wppTexto}`;

    printWin.document.open();
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Ordem de Produção #${numPedStr}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
                *, *::before, *::after { box-sizing: border-box !important; }
                html, body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: #f1f5f9;
                    margin: 0;
                    padding: 20px;
                    color: #1e293b;
                    width: 100%;
                }
                .barra-acoes {
                    max-width: 800px;
                    margin: 0 auto 15px auto;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .btn-acao {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 700;
                    text-decoration: none;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .btn-wpp { background: #25D366; color: #fff; }
                .btn-wpp:hover { background: #1ea952; }
                .btn-print { background: #0f172a; color: #fff; }
                .btn-print:hover { background: #334155; }
                .folha-a4 {
                    max-width: 800px;
                    width: 100%;
                    margin: 0 auto;
                    background: #ffffff;
                    padding: 30px 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    box-sizing: border-box;
                }
                @media print {
                    html, body { background: #fff !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
                    .barra-acoes { display: none !important; }
                    .folha-a4 { box-shadow: none !important; border: none !important; border-radius: 0 !important; padding: 4mm 8mm !important; margin: 0 auto !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; }
                    .bloco-item-op { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="barra-acoes">
                <a href="${wppLink}" target="_blank" class="btn-acao btn-wpp">
                    <i class="fa-brands fa-whatsapp"></i> Enviar no WhatsApp
                </a>
                <button onclick="window.print()" class="btn-acao btn-print">
                    <i class="fa-solid fa-print"></i> Imprimir / Salvar PDF
                </button>
            </div>

            <div class="folha-a4">
                <div style="text-align: center; margin-bottom: 25px;">
                    ${logoHtml}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                    <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #334155; text-transform: uppercase;">
                        ORDEM DE PRODUÇÃO <span style="font-size: 14px; font-weight: 600; color: #64748b;">#${numPedStr}</span>
                    </h1>
                    <span style="font-size: 12px; font-weight: 500; color: #64748b;">${dataExtenso}</span>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">
                    <div>Cliente: <span style="font-weight: 700; color: #0f172a;">${cliNome}</span></div>
                    <div>Vendedora: <span style="font-weight: 700; color: #0f172a;">${vendedorNome}</span></div>
                </div>
                ${cliEndCompleto && cliEndCompleto !== 'Não informado' ? `<div style="font-size: 12px; margin-bottom: 10px; color: #475569;"><strong>Endereço de Entrega:</strong> ${cliEndCompleto}</div>` : ''}

                <div style="border-top: 1px dashed #cbd5e1; margin: 10px 0 12px 0;"></div>
                <p style="margin: 0 0 15px 0; font-size: 12px; color: #64748b;">Segue informações e foto de referência para a produção dos móveis abaixo.</p>

                ${blocosItensHtml}

                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px dashed #a5f3fc; font-size: 11px; color: #64748b; text-align: center;">
                    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin-bottom: 6px; font-weight: 500;">
                        <span><i class="fa-solid fa-location-dot" style="color: #06b6d4; margin-right: 4px;"></i> ${emp.end}</span>
                        <span><i class="fa-solid fa-phone" style="color: #06b6d4; margin-right: 4px;"></i> ${emp.tel}</span>
                        ${emp.cnpj ? `<span>CNPJ: ${emp.cnpj}</span>` : ''}
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
};

window.imprimirOrdemProducaoAtual = function() {
    if (window.vendaAtualImpressao) {
        window.abrirOrdemProducao(window.vendaAtualImpressao);
    } else {
        showToast("Nenhuma venda selecionada para imprimir a Ordem de Produção.", "error");
    }
};

window.imprimirOrdemProducaoObj = function(v) {
    if (v) {
        window.abrirOrdemProducao(v);
    } else {
        showToast("Nenhuma venda selecionada.", "error");
    }
};

window.imprimirOrdemProducaoById = function(id) {
    window.abrirOrdemProducao(id);
};

// ==========================================
// MOTOR UNIVERSAL DE TERMO DE ENTREGA E RECEBIMENTO
// ==========================================
window.abrirTermoEntrega = function(vendaOuId) {
    let v = vendaOuId;
    if (typeof vendaOuId === 'string' || typeof vendaOuId === 'number') {
        const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
            ? db.vendas 
            : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
        v = todasVendas.find(x => String(x.id) === String(vendaOuId));
    }
    if (!v) {
        showToast("Venda não encontrada para gerar o Termo de Entrega.", "error");
        return;
    }
    window.vendaAtualImpressao = v;

    const empAtivaIdContr = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
    const fallbackNomeContr = (window.currentEmpresaData?.nomeEmpresa) || localStorage.getItem('fc_nome_empresa_ativa') || (empAtivaIdContr === 'emp_fc_moveis' ? 'FC MÓVEIS' : 'MINHA LOJA');
    const emp = (typeof obterDadosEmpresa === 'function') ? obterDadosEmpresa() : { nome: fallbackNomeContr, cnpj: '', end: '', tel: '', logoHtml: '' };

    const cliInfo = (typeof obterDadosClientePDV === 'function') ? obterDadosClientePDV(v.clienteId) : (typeof window.obterDadosClientePDV === 'function' ? window.obterDadosClientePDV(v.clienteId) : null);
    const cliNome = (cliInfo && cliInfo.nome && cliInfo.nome !== 'Consumidor Final') ? cliInfo.nome : (v.clienteNome || v.cliente || 'Consumidor Final');
    const cliCpf = (cliInfo && cliInfo.doc && cliInfo.doc !== 'Não informado') ? cliInfo.doc : (v.clienteDoc || 'Não informado');
    const cliTel = (cliInfo && cliInfo.tel && cliInfo.tel !== 'Não informado') ? cliInfo.tel : (v.clienteTel || 'Não informado');
    const cliEndCompleto = (typeof window.formatarEnderecoCompletoCliente === 'function') ? window.formatarEnderecoCompletoCliente(v, cliInfo) : ((cliInfo && cliInfo.endCompleto !== 'Não informado') ? cliInfo.endCompleto : (v.clienteEnd || 'Não informado'));

    const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : null;
    const vendedorNome = v.vendedorNome || v.vendedor || (opAtual && opAtual.nome) || (window.currentUserInfo && window.currentUserInfo.nome) || 'Atendente';

    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id || '').slice(-4);
    const dataVendaStr = v.data ? new Date(v.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

    // Previsão de entrega acordada
    let dataEntregaFormatada = 'A combinar / Imediata';
    const dataEntregaBruta = v.dataEntrega || (v.servicoDetalhes && v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo : '');
    if (dataEntregaBruta) {
        if (dataEntregaBruta.includes('-')) {
            const partes = dataEntregaBruta.split('T')[0].split('-');
            if (partes.length === 3) dataEntregaFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            else dataEntregaFormatada = dataEntregaBruta;
        } else {
            dataEntregaFormatada = dataEntregaBruta;
        }
    }

    // Identificação Fiscal (NFC-e / NF-e / NFSe se houver)
    let fiscalTipo = '';
    let fiscalNum = '';
    let fiscalSerie = '';
    let fiscalChave = '';
    let fiscalData = '';

    if (v.nfce && (v.nfce.numero || v.nfce.chave_nfe)) {
        fiscalTipo = 'NFC-e (Consumidor Eletrônica)';
        fiscalNum = v.nfce.numero || '-';
        fiscalSerie = v.nfce.serie || '1';
        fiscalChave = v.nfce.chave_nfe || '';
        fiscalData = v.nfce.data_emissao ? new Date(v.nfce.data_emissao).toLocaleDateString('pt-BR') : '';
    } else if (v.nfe && (v.nfe.numero || v.nfe.chave_nfe)) {
        fiscalTipo = 'NF-e (Nota Fiscal Eletrônica)';
        fiscalNum = v.nfe.numero || '-';
        fiscalSerie = v.nfe.serie || '1';
        fiscalChave = v.nfe.chave_nfe || '';
        fiscalData = v.nfe.data_emissao ? new Date(v.nfe.data_emissao).toLocaleDateString('pt-BR') : '';
    } else if (v.nfse && v.nfse.numero) {
        fiscalTipo = 'NFS-e (Serviços Eletrônica)';
        fiscalNum = v.nfse.numero || '-';
        fiscalSerie = '1';
    } else if (v.numeroNF || v.notaFiscal || v.nf) {
        fiscalTipo = 'Nota Fiscal';
        fiscalNum = v.numeroNF || v.notaFiscal || v.nf;
        fiscalChave = v.chaveAcesso || '';
    }

    let blocoFiscalHtml = '';
    if (fiscalNum) {
        blocoFiscalHtml = `
            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 5px 10px; font-size: 10.5px; color: #166534; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                    <strong>DOCUMENTO FISCAL VINCULADO:</strong> ${fiscalTipo} Nº <strong>${fiscalNum}</strong> ${fiscalSerie ? `(Série ${fiscalSerie})` : ''} ${fiscalData ? `&nbsp;|&nbsp; Emitida em: ${fiscalData}` : ''}
                </div>
                ${fiscalChave ? `<div style="font-family: monospace; font-size: 9.5px; color: #15803d; letter-spacing: 0.5px;">Chave: ${fiscalChave}</div>` : ''}
            </div>
        `;
    } else {
        blocoFiscalHtml = `
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 10px; font-size: 10px; color: #475569; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div><strong>DOCUMENTO FISCAL:</strong> Venda Direta / Cupom de Entrega #${numPedStr}</div>
                <div style="font-size: 9.5px; color: #64748b; font-style: italic;">(NF a faturar ou emitida posteriormente conforme legislação)</div>
            </div>
        `;
    }

    // Itens
    const prodsList = (typeof db !== 'undefined' && Array.isArray(db.produtos)) ? db.produtos : [];
    const itens = (v.itens && v.itens.length > 0) ? v.itens : [];
    const linhasItensHtml = itens.map((item, idx) => {
        const prodDb = prodsList.find(p => String(p.id) === String(item.id)) || {};
        const foto = item.foto || prodDb.foto || (prodDb.fotos && prodDb.fotos[0]) || '';
        const qtd = Number(item.qtd) || 1;
        const customTexto = (typeof formatarCustomizacaoContratoTexto === "function") ? formatarCustomizacaoContratoTexto(item.customizacao) : "";
        const obsItem = item.obsVenda ? `<div style="font-size: 9.5px; color: #64748b; font-style: italic; margin-top: 2px;">Obs: ${item.obsVenda}</div>` : '';

        return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 5px 6px; text-align: center; font-weight: bold; width: 32px; color: #475569;">${String(idx + 1).padStart(2, '0')}</td>
            <td style="padding: 5px 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${foto ? `<img src="${foto}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; flex-shrink: 0;">` : ''}
                    <div>
                        <strong style="color: #0f172a; font-size: 11px;">${item.nome || 'Produto/Item'}</strong>
                        ${customTexto ? `<div style="font-size: 9.5px; color: #475569; margin-top: 1px;">${customTexto}</div>` : ''}
                        ${obsItem}
                    </div>
                </div>
            </td>
            <td style="padding: 5px 6px; text-align: center; font-weight: bold; width: 60px; color: #0f172a;">${qtd} un</td>
            <td style="padding: 5px 6px; text-align: center; width: 110px;">
                <span style="border: 1px solid #94a3b8; border-radius: 3px; padding: 2px 6px; font-size: 9.5px; font-weight: bold; color: #0f172a; background: #fff;">
                    [ &nbsp; ] Conforme
                </span>
            </td>
        </tr>
        `;
    }).join('');

    const fm = typeof formatMoney === 'function' ? formatMoney : (x => 'R$ ' + Number(x||0).toFixed(2));
    const totalVenda = Number(v.tot) || 0;
    const formaPagStr = v.pag || 'Conforme Contrato';

    // WhatsApp do cliente
    let numLimpo = cliTel ? String(cliTel).replace(/\D/g, '') : '';
    if (numLimpo && !numLimpo.startsWith('55') && numLimpo.length >= 10) numLimpo = '55' + numLimpo;
    const msgWpp = encodeURIComponent(`Olá, ${cliNome.split(' ')[0]}! Tudo bem? Segue a notificação de entrega do seu *Pedido #${numPedStr}* pela *${emp.nome}*. O termo de recebimento e vistoria segue anexado à mercadoria. Agradecemos a preferência!`);
    const wppLink = numLimpo ? `https://wa.me/${numLimpo}?text=${msgWpp}` : '';

    const logoHtml = emp.logoHtml || (emp.logo ? `<img src="${emp.logo}" style="max-height: 60px; object-fit: contain;">` : `<h2 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #1e293b;">${emp.nome}</h2>`);

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast("Por favor, permita pop-ups para imprimir o Termo de Entrega.", "warning");
        return;
    }

    printWin.document.open();
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Termo de Entrega e Recebimento #${numPedStr}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { size: A4 portrait; margin: 8mm 12mm 12mm 12mm; }
                *, *::before, *::after { box-sizing: border-box !important; word-break: break-word; overflow-wrap: anywhere; }
                html, body {
                    font-family: Arial, Helvetica, sans-serif;
                    background: #f1f5f9;
                    margin: 0;
                    padding: 12px;
                    color: #0f172a;
                    font-size: 10.5px;
                    line-height: 1.32;
                    width: 100%;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .barra-acoes {
                    max-width: 800px;
                    margin: 0 auto 12px auto;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #1e293b;
                    padding: 8px 14px;
                    border-radius: 6px;
                    color: #fff;
                }
                .btn-acao {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 14px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 700;
                    text-decoration: none;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .btn-wpp { background: #25D366; color: #fff; }
                .btn-wpp:hover { background: #1ea952; }
                .btn-print { background: #2563eb; color: #fff; }
                .btn-print:hover { background: #1d4ed8; }
                .folha-a4 {
                    max-width: 800px;
                    width: 100%;
                    margin: 0 auto;
                    background: #ffffff;
                    padding: 16px 20px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.06);
                    box-sizing: border-box;
                }
                .secao-titulo {
                    font-size: 10.5px;
                    font-weight: bold;
                    text-transform: uppercase;
                    background-color: #f1f5f9;
                    padding: 3px 6px;
                    border-left: 3px solid #0f172a;
                    margin: 6px 0 3px 0;
                }
                .grid-info {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 3px 12px;
                    font-size: 10px;
                    padding: 2px 0;
                }
                .grid-full { grid-column: span 2; }
                .label-destaque { font-weight: bold; color: #334155; }
                .clausula-texto {
                    font-size: 9.5px;
                    line-height: 1.32;
                    color: #1e293b;
                    text-align: justify;
                    margin: 2px 0;
                }
                .bloco-juridico {
                    border: 1px solid #cbd5e1;
                    background-color: #fafafa;
                    border-radius: 4px;
                    padding: 5px 8px;
                    margin: 5px 0;
                }
                .campo-ressalva {
                    border: 1px dashed #94a3b8;
                    padding: 4px 8px;
                    background: #fff;
                    border-radius: 4px;
                    margin: 4px 0;
                    font-size: 9.5px;
                }
                .bloco-recebedor {
                    border: 1px solid #0f172a;
                    border-radius: 4px;
                    padding: 5px 8px;
                    margin-top: 5px;
                    background: #fdfdfd;
                }
                .assinaturas-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-top: 18px;
                    text-align: center;
                }
                .linha-assinatura {
                    border-top: 1px solid #0f172a;
                    padding-top: 3px;
                    font-size: 9.5px;
                }
                @media print {
                    html, body { background: #fff !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; color: #000 !important; }
                    .barra-acoes { display: none !important; }
                    .folha-a4 { box-shadow: none !important; border: none !important; border-radius: 0 !important; padding: 4mm 8mm !important; margin: 0 auto !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; }
                    .bloco-juridico { background-color: transparent !important; border-color: #000 !important; }
                    .secao-titulo { background-color: #eeeeee !important; border-left-color: #000 !important; }
                    table { width: 100% !important; table-layout: fixed; }
                }
            </style>
        </head>
        <body>
            <div class="barra-acoes">
                <span style="font-size: 12px; font-weight: bold;">
                    <i class="fa-solid fa-truck-ramp-box" style="color: #34d399; margin-right: 6px;"></i> Termo de Entrega & Recebimento (Pedido #${numPedStr})
                </span>
                <div style="display: flex; gap: 8px;">
                    ${wppLink ? `<a href="${wppLink}" target="_blank" class="btn-acao btn-wpp"><i class="fa-brands fa-whatsapp"></i> Notificar no WhatsApp</a>` : ''}
                    <button onclick="window.print()" class="btn-acao btn-print"><i class="fa-solid fa-print"></i> Imprimir / Salvar PDF</button>
                </div>
            </div>

            <div class="folha-a4">
                <!-- CABEÇALHO -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px;">
                    <div style="flex: 1; padding-right: 15px;">
                        ${logoHtml}
                        <div style="font-size: 10px; color: #334155; margin-top: 2px;">
                            ${emp.cnpj ? `<strong>CNPJ:</strong> ${emp.cnpj} &nbsp;|&nbsp; ` : ''}<strong>Tel/WhatsApp:</strong> ${emp.tel || '-'}<br>
                            ${emp.end ? `<strong>Endereço:</strong> ${emp.end}` : ''}
                        </div>
                    </div>
                    <div style="text-align: right; border-left: 2px solid #e2e8f0; padding-left: 12px; min-width: 220px;">
                        <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: #0f172a;">TERMO DE ENTREGA & RECEBIMENTO</div>
                        <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; margin: 2px 0;">PEDIDO Nº #${numPedStr}</div>
                        <div style="font-size: 9.5px; color: #475569;">Vínculo: <strong>Contrato de Venda Pedido #${numPedStr}</strong></div>
                        <div style="font-size: 9.5px; color: #475569;">Data da Venda: ${dataVendaStr} &nbsp;|&nbsp; Vend: ${vendedorNome}</div>
                    </div>
                </div>

                <!-- BLOCO FISCAL -->
                ${blocoFiscalHtml}

                <!-- 1. DADOS DO COMPRADOR E ENTREGA -->
                <div class="secao-titulo">1. Dados do Comprador e Local de Entrega</div>
                <div class="grid-info">
                    <div><span class="label-destaque">Comprador(a):</span> ${cliNome}</div>
                    <div><span class="label-destaque">CPF / CNPJ:</span> ${cliCpf}</div>
                    <div><span class="label-destaque">Telefone / WhatsApp:</span> ${cliTel}</div>
                    <div><span class="label-destaque">Previsão Acordada no Contrato:</span> <strong>${dataEntregaFormatada}</strong></div>
                    <div class="grid-full"><span class="label-destaque">Endereço de Entrega:</span> ${cliEndCompleto}</div>
                </div>

                <!-- 2. PRODUTOS ENTREGUES -->
                <div class="secao-titulo" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>2. Relação das Mercadorias / Volumes Entregues</span>
                    <span style="font-size: 9px; font-weight: normal; color: #64748b; text-transform: none;">Conferência no ato do descarregamento</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 4px 0 6px 0; font-size: 10.5px;">
                    <thead>
                        <tr style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1;">
                            <th style="padding: 4px; text-align: center; width: 32px; font-size: 9.5px;">Item</th>
                            <th style="padding: 4px; text-align: left; font-size: 9.5px;">Descrição do Produto / Especificação / Acabamento</th>
                            <th style="padding: 4px; text-align: center; width: 60px; font-size: 9.5px;">Qtd</th>
                            <th style="padding: 4px; text-align: center; width: 110px; font-size: 9.5px;">Vistoria Física</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasItensHtml}
                    </tbody>
                </table>

                ${v.vendaComEntradaEntrega ? `
                <!-- ALERTA DE COBRANÇA OBRIGATÓRIA NA ENTREGA -->
                <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; color: #92400e;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #b45309;">
                            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px;"></i> COBRANÇA OBRIGATÓRIA NO ATO DA ENTREGA
                        </span>
                        <span style="font-size: 12px; font-weight: 900; color: #b45309;">
                            SALDO A COBRAR: ${fm(v.saldoEntrega)}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 3px; font-size: 9.5px; border-top: 1px dashed #fcd34d; padding-top: 3px;">
                        <span><strong>Entrada Recebida na Venda:</strong> ${fm(v.valorEntrada)} (${(v.pagamentosEntrada && v.pagamentosEntrada.length > 0) ? v.pagamentosEntrada.map(p => `${p.metodo}${p.parcelas > 1 ? ' ' + p.parcelas + 'x' : ''}`).join(' + ') : (v.formaEntrada || 'Pago')}) - <strong style="color: #16a34a;">QUITADA</strong></span>
                        <span><strong>Status do Saldo:</strong> ${v.saldoEntregaPago ? '<strong style="color: #16a34a;">RECEBIDO / QUITADO</strong>' : '<strong style="color: #dc2626;">PENDENTE DE RECEBIMENTO</strong>'}</span>
                    </div>
                    <div style="margin-top: 3px; font-size: 9.5px;">
                        <strong>Formas Combinadas para Recebimento na Entrega:</strong>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px;">
                            ${(v.pagamentosEntrega && v.pagamentosEntrega.length > 0)
                                ? v.pagamentosEntrega.map(p => `<span style="background: #fff; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 3px;">▪ <strong>${fm(p.valor)}</strong> via ${p.metodo}${p.parcelas > 1 ? ' (' + p.parcelas + 'x de ' + fm(p.valor / p.parcelas) + ')' : ''}</span>`).join('')
                                : `<span style="background: #fff; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 3px;">▪ <strong>${fm(v.saldoEntrega)}</strong> via ${v.formaEntregaPrevista || 'A Combinar'}${v.parcelasEntrega > 1 ? ' (' + v.parcelasEntrega + 'x de ' + fm(v.saldoEntrega / v.parcelasEntrega) + ' na Maquininha)' : ''}</span>`
                            }
                        </div>
                    </div>
                    ${!v.saldoEntregaPago ? `
                    <div style="margin-top: 4px; font-size: 9px; background: #fff; border: 1px solid #fde68a; padding: 4px 6px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <span><strong>Quitação pelo Entregador:</strong> [ &nbsp; ] Saldo recebido em ___/___/20___ &nbsp;|&nbsp; Conferido conforme formas acima</span>
                        <span>Visto do Entregador: ____________________________</span>
                    </div>` : ''}
                </div>
                ` : ''}

                <!-- RESUMO FINANCEIRO VINCULADO -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 8px; font-size: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div><strong>Valor Total do Pedido:</strong> <span style="font-size: 11px; font-weight: bold; color: #0f172a;">${fm(totalVenda)}</span></div>
                    ${v.vendaComEntradaEntrega ? `
                    <div><strong>Entrada Paga:</strong> <span style="color: #16a34a; font-weight: bold;">${fm(v.valorEntrada)} [QUITADA]</span></div>
                    <div><strong>Saldo na Entrega:</strong> <span style="color: ${v.saldoEntregaPago ? '#16a34a' : '#dc2626'}; font-weight: bold;">${fm(v.saldoEntrega)} (${v.saldoEntregaPago ? 'QUITADO' : 'PENDENTE'})</span></div>
                    ` : `<div><strong>Condição de Pagamento:</strong> ${formaPagStr}</div>`}
                </div>

                <!-- 3. DECLARAÇÃO JURÍDICA E QUITAÇÃO -->
                <div class="secao-titulo">3. Declaração de Vistoria, Recebimento e Quitação (Art. 26 da Lei 8.078/90 - CDC)</div>
                <div class="bloco-juridico">
                    <p class="clausula-texto">
                        <strong>CLÁUSULA 1ª (CONFERÊNCIA PRESENCIAL E VÍCIOS APARENTES):</strong>
                        O(A) RECEBEDOR(A) declara que neste ato <strong>conferiu e inspecionou presencialmente</strong> todas as mercadorias discriminadas acima, constatando que os produtos encontram-se em <strong>perfeitas condições físicas, funcionais e estéticas</strong>, livres de quebras, riscos, amassados, lascas, trincas, manchas, avarias de pintura ou tecidos e sem falta de peças/acessórios, correspondendo fielmente às especificações do Pedido de Venda e Contrato vinculado, dando <strong>plena e irrestrita quitação de entrega física</strong> quanto a vícios aparentes e de fácil constatação (Art. 26 do Código de Defesa do Consumidor).
                    </p>
                    <p class="clausula-texto">
                        <strong>CLÁUSULA 2ª (RECEBIMENTO POR TERCEIRO AUTORIZADO):</strong>
                        Caso o recebimento ocorra por cônjuge, familiar, colaborador, prestador de serviço ou encarregado de portaria/recepção no endereço indicado pelo COMPRADOR, este afirma possuir <strong>legítima autorização</strong> para conferir, inspecionar e firmar o presente recebimento com plena eficácia vinculante perante o comprador (Arts. 422 do Código Civil e 248, § 4º do CPC).
                    </p>
                    <p class="clausula-texto">
                        <strong>CLÁUSULA 3ª (MANUSEIO POSTERIOR, TRANSPORTE E MONTAGEM):</strong>
                        A EMPRESA não se responsabiliza por avarias ou quebras provocadas por movimentação interna posterior no imóvel, transporte em escadas/elevadores por terceiros, intempéries/umidade, ou por montagem/instalação efetuada por terceiros não credenciados. Permanece resguardada a garantia legal de 90 dias exclusivamente para eventuais <strong>vícios ocultos de fabricação</strong>, não cobrindo danos resultantes de mau uso, quedas ou sinistros.
                    </p>
                </div>

                <!-- CAMPO DE RESSALVAS -->
                <div class="campo-ressalva">
                    <strong>Ressalvas no ato da entrega (anotar se houver alguma pendência no momento do descarregamento):</strong><br>
                    <div style="display: flex; align-items: flex-end; gap: 12px; margin-top: 3px; width: 100%;">
                        <span style="white-space: nowrap;">[ &nbsp; ] <strong>SEM RESSALVAS.</strong> Produto conferido, entregue 100% perfeito.</span>
                        <div style="display: flex; align-items: flex-end; flex: 1; min-width: 0;">
                            <span style="white-space: nowrap; margin-right: 4px;">[ &nbsp; ] <strong>COM RESSALVA:</strong></span>
                            <span style="border-bottom: 1px solid #475569; flex: 1; height: 12px; min-width: 30px;"></span>
                        </div>
                    </div>
                </div>

                <!-- 4. IDENTIFICAÇÃO DE QUEM RECEBEU E ASSINATURAS -->
                <div class="bloco-recebedor">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; font-size: 10.5px;">
                        <span style="font-weight: bold; text-transform: uppercase;">4. Dados de Quem Recebeu e Quitação</span>
                        <span>Data da Entrega: <strong>___/___/20___</strong> &nbsp;|&nbsp; Hora: <strong>___:___</strong></span>
                    </div>

                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 3px 0 5px 0; font-size: 10px;">
                        <span><strong>Relação com o Comprador:</strong></span>
                        <span>( &nbsp; ) O Próprio Comprador</span>
                        <span>( &nbsp; ) Cônjuge / Familiar</span>
                        <span>( &nbsp; ) Funcionário / Preposto</span>
                        <span>( &nbsp; ) Portaria / Recepção</span>
                        <span>( &nbsp; ) Outro: _____________</span>
                    </div>

                    <div class="grid-info" style="margin-top: 2px;">
                        <div style="display: flex; align-items: flex-end; min-width: 0;">
                            <span class="label-destaque" style="white-space: nowrap; margin-right: 4px;">Nome Legível de Quem Recebeu:</span>
                            <span style="border-bottom: 1px solid #0f172a; flex: 1; height: 12px; min-width: 30px;"></span>
                        </div>
                        <div style="display: flex; align-items: flex-end; min-width: 0;">
                            <span class="label-destaque" style="white-space: nowrap; margin-right: 4px;">CPF ou RG do Recebedor:</span>
                            <span style="border-bottom: 1px solid #0f172a; flex: 1; height: 12px; min-width: 30px;"></span>
                        </div>
                    </div>

                    <!-- ASSINATURAS -->
                    <div class="assinaturas-grid">
                        <div>
                            <div class="linha-assinatura">
                                <strong>ASSINATURA DE QUEM RECEBEU A MERCADORIA</strong>
                            </div>
                            <div style="font-size: 9px; color: #475569; margin-top: 2px;">Declaro ter inspecionado e recebido os produtos em perfeito estado.</div>
                        </div>

                        <div>
                            <div class="linha-assinatura">
                                <strong>ASSINATURA DO ENTREGADOR / EMPRESA</strong>
                            </div>
                            <div style="display: flex; justify-content: center; align-items: flex-end; gap: 4px; font-size: 9px; color: #475569; margin-top: 2px;">
                                <span style="white-space: nowrap;">Nome do Entregador:</span>
                                <span style="border-bottom: 1px solid #0f172a; width: 140px; height: 12px; display: inline-block;"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
};

window.imprimirTermoEntregaAtual = function() {
    if (window.vendaAtualImpressao) {
        window.abrirTermoEntrega(window.vendaAtualImpressao);
    } else {
        showToast("Nenhuma venda selecionada para imprimir o Termo de Entrega.", "error");
    }
};

window.imprimirTermoEntregaObj = function(v) {
    if (v) {
        window.abrirTermoEntrega(v);
    } else {
        showToast("Nenhuma venda selecionada.", "error");
    }
};

window.imprimirTermoEntregaById = function(id) {
    window.abrirTermoEntrega(id);
};

// =========================================================================
// RECEBIMENTO DE SALDO NA ENTREGA (ESPECIAL LOJA DE MÓVEIS)
// Permite quitar o saldo pendente da entrega diretamente pelo Caixa, Vendas ou Gestão
// =========================================================================
window.abrirModalReceberSaldoEntrega = function(vendaOuId) {
    let v = vendaOuId;
    if (typeof vendaOuId === 'string' || typeof vendaOuId === 'number') {
        const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
            ? db.vendas 
            : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
        v = todasVendas.find(x => String(x.id) === String(vendaOuId));
    }
    if (!v) {
        return showToast("Pedido não encontrado para receber o saldo.", "error");
    }

    if (v.saldoEntregaPago) {
        return showToast("O saldo na entrega deste pedido já foi quitado!", "info");
    }

    const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0');
    const cliInfo = (typeof window.obterDadosClientePDV === 'function') ? window.obterDadosClientePDV(v.clienteId) : null;
    const cliNome = (cliInfo && cliInfo.nome !== 'Consumidor Final') ? cliInfo.nome : (v.clienteNome || v.cliente || 'Consumidor Final');
    const cliEnd = (typeof window.formatarEnderecoCompletoCliente === 'function') ? window.formatarEnderecoCompletoCliente(v, cliInfo) : (v.clienteEnd || '');
    const saldoTotal = Number(v.saldoEntrega) || (Number(v.tot || 0) - Number(v.valorEntrada || 0));
    const fm = typeof formatMoney === 'function' ? formatMoney : (x => 'R$ ' + Number(x||0).toFixed(2));
    const formaPrevista = v.formaEntregaPrevista || 'Dinheiro';

    // Cria ou reutiliza o modal no DOM
    let modal = document.getElementById('modal-receber-saldo-entrega-global');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-receber-saldo-entrega-global';
        modal.className = "fixed inset-0 bg-slate-900/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <!-- HEADER -->
            <div class="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 p-4 md:p-5 text-white flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner">
                        <i class="fa-solid fa-truck-ramp-box"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-base md:text-lg">Receber Saldo na Entrega</h3>
                        <p class="text-xs text-amber-100 font-medium">Pedido #${numPedStr} &bull; ${cliNome}</p>
                    </div>
                </div>
                <button type="button" onclick="document.getElementById('modal-receber-saldo-entrega-global').classList.add('hidden')" class="text-white/80 hover:text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>

            <!-- BODY -->
            <div class="p-5 space-y-4">
                <!-- RESUMO DA OPERAÇÃO -->
                <div class="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-600 dark:text-slate-400">Total Geral da Venda:</span>
                        <strong class="font-bold text-slate-800 dark:text-slate-100">${fm(v.tot || 0)}</strong>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-600 dark:text-slate-400">Entrada Já Paga (Sinal):</span>
                        <strong class="text-emerald-600 dark:text-emerald-400 font-bold">${fm(v.valorEntrada || 0)} [QUITADA]</strong>
                    </div>
                    <div class="flex justify-between items-center text-sm pt-2 border-t border-amber-200 dark:border-amber-800">
                        <span class="font-black text-amber-900 dark:text-amber-200 uppercase text-xs">Saldo a Receber Agora:</span>
                        <span class="font-black text-lg text-amber-700 dark:text-amber-400">${fm(saldoTotal)}</span>
                    </div>
                    ${(v.pagamentosEntrega && v.pagamentosEntrega.length > 0) ? `
                    <div class="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 text-xs">
                        <span class="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block mb-1">
                            <i class="fa-solid fa-list-check mr-1"></i> Previsão Acordada para a Entrega:
                        </span>
                        <div class="space-y-1">
                            ${v.pagamentosEntrega.map(p => `
                                <div class="flex justify-between items-center bg-white/70 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg text-xs">
                                    <span class="text-slate-700 dark:text-slate-300 font-medium">▪ ${p.metodo}${p.parcelas > 1 ? ' (' + p.parcelas + 'x)' : ''}</span>
                                    <strong class="text-amber-700 dark:text-amber-400 font-bold">${fm(p.valor)}</strong>
                                </div>
                            `).join('')}
                        </div>
                    </div>` : ''}
                    ${cliEnd && cliEnd !== 'Não informado' ? `
                    <div class="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-amber-100 dark:border-amber-900/30 truncate">
                        <i class="fa-solid fa-location-dot text-amber-600 mr-1"></i>${cliEnd}
                    </div>` : ''}
                </div>

                <!-- FORMA DE PAGAMENTO RECEBIDA -->
                <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        <i class="fa-solid fa-credit-card text-amber-600 mr-1"></i> Forma de Pagamento Recebida pelo Entregador
                    </label>
                    <select id="modal-se-metodo" onchange="const m = this.value; const b = document.getElementById('modal-se-parcelas-box'); if(b){ if(m.includes('Crédito') || m.includes('Boleto') || m.includes('Fiado')) b.classList.remove('hidden'); else b.classList.add('hidden'); }" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none">
                        <option value="Cartão Crédito" ${formaPrevista.includes('Crédito') ? 'selected' : ''}>Cartão Crédito (Maquininha Entrega)</option>
                        <option value="Cartão Débito" ${formaPrevista.includes('Débito') ? 'selected' : ''}>Cartão Débito (Maquininha Entrega)</option>
                        <option value="PIX" ${formaPrevista.includes('PIX') ? 'selected' : ''}>PIX</option>
                        <option value="Dinheiro" ${formaPrevista.includes('Dinheiro') ? 'selected' : ''}>Dinheiro (Espécie)</option>
                        <option value="Boleto" ${formaPrevista.includes('Boleto') ? 'selected' : ''}>Boleto Bancário</option>
                        <option value="Fiado" ${formaPrevista.includes('Fiado') || formaPrevista.includes('Carnê') ? 'selected' : ''}>Fiado / Crediário</option>
                    </select>

                    <div id="modal-se-parcelas-box" class="${(formaPrevista.includes('Crédito') || formaPrevista.includes('Boleto') || formaPrevista.includes('Fiado') || formaPrevista.includes('Carnê')) ? '' : 'hidden'} mt-2.5">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Parcelas na Maquininha / Recebimento
                        </label>
                        <select id="modal-se-parcelas" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500">
                            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n => `<option value="${n}" ${n === (parseInt(v.parcelasEntrega) || 1) ? 'selected' : ''}>${n}x ${n > 1 ? '(' + fm(saldoTotal / n) + ' cada)' : '(À vista na entrega)'}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- VALOR RECEBIDO -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Valor Recebido (R$)
                        </label>
                        <input type="text" id="modal-se-valor" value="${saldoTotal.toFixed(2).replace('.', ',')}" oninput="if(typeof mascaraMoeda==='function') mascaraMoeda(this)" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs md:text-sm font-black text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none text-right">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Data do Recebimento
                        </label>
                        <input type="date" id="modal-se-data" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    </div>
                </div>

                <!-- OBSERVAÇÃO / ENTREGADOR -->
                <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Nome do Entregador / Observações
                    </label>
                    <input type="text" id="modal-se-obs" placeholder="Ex: Entregador João - Recebido via maquininha sem ressalvas" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none">
                </div>
            </div>

            <!-- FOOTER -->
            <div class="bg-slate-50 dark:bg-slate-800/60 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
                <button type="button" onclick="document.getElementById('modal-receber-saldo-entrega-global').classList.add('hidden')" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    Cancelar
                </button>
                <button type="button" id="btn-confirmar-saldo-entrega-global" onclick="window.confirmarRecebimentoSaldoEntregaGlobal('${v.id}')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition flex items-center gap-1.5">
                    <i class="fa-solid fa-check-double"></i> Confirmar Quitação do Saldo
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
};

window.confirmarRecebimentoSaldoEntregaGlobal = async function(vendaId) {
    const btn = document.getElementById('btn-confirmar-saldo-entrega-global');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Registrando quitação...';
    }

    try {
        const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
            ? db.vendas 
            : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
        const v = todasVendas.find(x => String(x.id) === String(vendaId));
        if (!v) throw new Error("Venda não encontrada.");

        const metodo = document.getElementById('modal-se-metodo')?.value || 'Dinheiro';
        const parcelasRec = parseInt(document.getElementById('modal-se-parcelas')?.value) || 1;
        const metodoFormatado = metodo + (parcelasRec > 1 ? ' (' + parcelasRec + 'x)' : '');
        const valDigitado = (typeof parseInputMoney === 'function' && document.getElementById('modal-se-valor'))
            ? parseInputMoney(document.getElementById('modal-se-valor').value)
            : (parseFloat(String(document.getElementById('modal-se-valor')?.value || '0').replace(',', '.')) || 0);
        const valorSaldo = valDigitado > 0 ? valDigitado : (Number(v.saldoEntrega) || (Number(v.tot || 0) - Number(v.valorEntrada || 0)));
        const dataRec = document.getElementById('modal-se-data')?.value || new Date().toISOString().split('T')[0];
        const obsRec = document.getElementById('modal-se-obs')?.value.trim() || '';
        const now = new Date(dataRec + 'T12:00:00').toISOString();

        const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : null;
        const opNome = (opAtual && opAtual.nome) || (window.currentUserInfo && window.currentUserInfo.nome) || 'Operador';
        const opUid = (opAtual && opAtual.uid) || (window.currentUser && window.currentUser.uid) || null;
        const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0');
        const cliNome = v.clienteNome || v.cliente || 'Consumidor';

        const batch = firestore.batch();

        // 1. Atualizar a Venda
        const vendaRef = window.getEmpresaRef().collection('vendas').doc(String(v.id));
        const updateVendaObj = {
            saldoEntregaPago: true,
            status: 'CONCLUIDA',
            dataPagamentoSaldoEntrega: now,
            formaRecebimentoSaldoEntrega: metodoFormatado,
            parcelasRecebidasSaldoEntrega: parcelasRec,
            valorSaldoRecebido: valorSaldo,
            obsSaldoEntrega: obsRec,
            operadorRecebeuSaldo: opNome,
            operadorRecebeuSaldoId: opUid,
            ultimaAlteracao: Date.now()
        };
        batch.set(vendaRef, updateVendaObj, { merge: true });

        // 2. Movimentar o Caixa Ativo (se aberto)
        let cxAtual = (typeof db !== 'undefined' && db.caixa) ? db.caixa : { status: 'FECHADO', saldo: 0, historico: [] };
        let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
        let cxSaldoNovo = cxAtual.saldo || 0;
        const caixaDocId = (typeof window.obterCaixaDocId === 'function') ? window.obterCaixaDocId() : 'caixa_atual';
        const caixaRef = (typeof window.obterCaixaDocRef === 'function') ? window.obterCaixaDocRef() : window.getEmpresaRef().collection('caixa').doc('caixa_atual');

        const descMov = `Saldo na Entrega Pedido #${numPedStr} (${metodoFormatado}) - ${cliNome}${obsRec ? ' [' + obsRec + ']' : ''}`;

        if (metodo === 'Dinheiro') {
            cxSaldoNovo += valorSaldo;
            cxHistoricoNovo.unshift({
                data: now,
                tipo: 'ENTRADA',
                metodo: 'Dinheiro',
                desc: descMov,
                valor: valorSaldo,
                operador: opNome,
                saldoApos: cxSaldoNovo
            });
        } else {
            cxHistoricoNovo.unshift({
                data: now,
                tipo: `ENTRADA (${metodo})`,
                metodo: metodo,
                desc: descMov,
                valor: valorSaldo,
                operador: opNome,
                saldoApos: cxSaldoNovo,
                naoAfetaGaveta: true
            });
        }

        const cxFinalData = { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo.slice(0, 50) };
        batch.set(caixaRef, cxFinalData, { merge: true });

        // Subcoleção permanente 'movimentacoes'
        const movRef = caixaRef.collection('movimentacoes').doc();
        batch.set(movRef, {
            id: movRef.id,
            data: now,
            tipo: metodo === 'Dinheiro' ? 'ENTRADA' : `ENTRADA (${metodo})`,
            metodo: metodo,
            desc: descMov,
            valor: valorSaldo,
            operador: opNome,
            origemVendaId: String(v.id),
            saldoApos: cxSaldoNovo
        });

        // 3. Atualizar Financeiro
        let finAtualizadoLocal = null;
        let finEncontrado = (typeof db !== 'undefined' && Array.isArray(db.financeiro)) 
            ? db.financeiro.find(f => String(f.origemVendaId) === String(v.id) && (f.tipoSub === 'SALDO_ENTREGA' || f.status === 'PENDENTE'))
            : null;

        if (finEncontrado) {
            const finRef = window.getEmpresaRef().collection('financeiro').doc(String(finEncontrado.id));
            const finUpdate = {
                status: 'PAGO',
                dataPagamento: now,
                valorPago: valorSaldo,
                metodoPagamento: metodo,
                obs: obsRec ? `Quitado na entrega: ${obsRec}` : 'Quitado na entrega'
            };
            batch.set(finRef, finUpdate, { merge: true });
            finAtualizadoLocal = { ...finEncontrado, ...finUpdate };
        } else {
            const finRef = window.getEmpresaRef().collection('financeiro').doc();
            const finObj = {
                id: finRef.id,
                ref: `Venda #${numPedStr} - Saldo na Entrega (${metodo})`,
                data: now,
                dataPagamento: now,
                dataVencimento: now,
                pessoa: cliNome,
                wpp: '',
                valor: valorSaldo,
                valorPago: valorSaldo,
                status: 'PAGO',
                tipo: 'RECEITA',
                categoria: 'Vendas',
                metodoPagamento: metodo,
                origemVendaId: String(v.id),
                tipoSub: 'SALDO_ENTREGA',
                operador: opNome
            };
            batch.set(finRef, finObj);
            finAtualizadoLocal = finObj;
        }

        await batch.commit();

        // 4. Atualiza Memória e Cache
        if (typeof db !== 'undefined') {
            db.caixa = cxFinalData;
            const idxV = (db.vendas || []).findIndex(x => String(x.id) === String(v.id));
            if (idxV !== -1) Object.assign(db.vendas[idxV], updateVendaObj);
            if (finAtualizadoLocal && Array.isArray(db.financeiro)) {
                const idxF = db.financeiro.findIndex(f => String(f.id) === String(finAtualizadoLocal.id));
                if (idxF !== -1) db.financeiro[idxF] = finAtualizadoLocal;
                else db.financeiro.unshift(finAtualizadoLocal);
            }
        }

        if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.atualizarItem === 'function') {
            await window.FCCache.atualizarItem('vendas', v.id, updateVendaObj);
            if (finAtualizadoLocal) {
                await window.FCCache.atualizarItem('financeiro', finAtualizadoLocal.id, finAtualizadoLocal);
            }
            if (typeof window.FCCache.set === 'function') {
                window.FCCache.set('caixa', cxFinalData);
                window.FCCache.set('fc_moveis_' + caixaDocId, cxFinalData);
            }
        }

        try {
            localStorage.setItem('fc_sync_trigger', Date.now());
            window.dispatchEvent(new CustomEvent('venda-saldo-entrega-recebido', { detail: { id: v.id, saldo: valorSaldo } }));
        } catch(e) {}

        // Fecha Modal
        const modalEl = document.getElementById('modal-receber-saldo-entrega-global');
        if (modalEl) modalEl.classList.add('hidden');

        showToast(`Saldo na entrega de ${typeof formatMoney === 'function' ? formatMoney(valorSaldo) : 'R$ ' + valorSaldo.toFixed(2)} quitado com sucesso!`, 'success');

        // Atualizar telas ativas
        if (typeof renderVendas === 'function') renderVendas();
        if (typeof renderCaixaDiario === 'function') renderCaixaDiario();
        if (typeof renderVendasPendentesPDV === 'function') renderVendasPendentesPDV();
        if (typeof verDetalhesVenda === 'function' && window._detalheVendaIdAtual === v.id) verDetalhesVenda(v.id);

    } catch(err) {
        console.error("Erro ao receber saldo na entrega:", err);
        showToast("Erro ao gravar recebimento do saldo. Tente novamente.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Confirmar Quitação do Saldo';
        }
    }
};
window.abrirModalReceberRestanteVenda = window.abrirModalReceberSaldoEntrega;
if (!window.abrirModalReceberSaldoEntrega && window.abrirModalReceberRestanteVenda) {
    window.abrirModalReceberSaldoEntrega = window.abrirModalReceberRestanteVenda;
}

// ==========================================
// CÁLCULO DINÂMICO DE MARGEM E PREÇO DE VENDA (GLOBAL)
// ==========================================
function calcularPrecoMargin(quemMudou = 'preco') {
    const custoEl = document.getElementById('prod-custo');
    const margemEl = document.getElementById('prod-margem');
    const precoEl = document.getElementById('prod-preco');
    if (!custoEl || !margemEl || !precoEl) return;

    const parseVal = (typeof parseInputMoney === 'function') 
        ? parseInputMoney 
        : (v => parseFloat(String(v || 0).replace(/[^\d,-]/g, '').replace(',', '.')) || 0);

    const custo = parseVal(custoEl.value);
    const margem = parseVal(margemEl.value);
    const preco = parseVal(precoEl.value);

    if (custo <= 0) return;

    if (quemMudou === 'preco') {
        if (preco > 0) {
            const novaMargem = ((preco - custo) / custo) * 100;
            margemEl.value = novaMargem.toFixed(2);
        }
    } else if (quemMudou === 'margem') {
        const novoPreco = custo * (1 + (margem / 100));
        precoEl.value = (typeof formatMoney === 'function' && precoEl.hasAttribute('data-mask')) 
            ? novoPreco.toFixed(2).replace('.', ',') 
            : novoPreco.toFixed(2);
    } else if (quemMudou === 'custo') {
        if (margem !== 0) {
            const novoPreco = custo * (1 + (margem / 100));
            precoEl.value = (typeof formatMoney === 'function' && precoEl.hasAttribute('data-mask')) 
                ? novoPreco.toFixed(2).replace('.', ',') 
                : novoPreco.toFixed(2);
        } else if (preco > 0) {
            const novaMargem = ((preco - custo) / custo) * 100;
            margemEl.value = novaMargem.toFixed(2);
        }
    }
}
window.calcularPrecoMargin = calcularPrecoMargin;

// ==========================================
// FUNÇÕES AUXILIARES DE ESTORNO DE VENDAS
// ==========================================

// Exclui qualquer lembrete/agendamento vinculado a esta venda no documento configuracoes/config (agenda_eventos)
window.excluirAgendamentoVinculadoVenda = async function(vendaId, numeroPedido) {
    if (!vendaId && !numeroPedido) return;
    try {
        if (typeof window.getEmpresaRef !== 'function') return;
        const configRef = window.getEmpresaRef().collection('configuracoes').doc('config');
        const configSnap = await configRef.get();
        if (!configSnap.exists) return;

        const configData = configSnap.data() || {};
        const agenda = configData.agenda_eventos || {};
        const updatesAgenda = {};
        let encontrou = false;

        const vIdStr = String(vendaId || '');
        const numPedStr = numeroPedido ? String(numeroPedido).padStart(4, '0') : '';
        const numPedRaw = numeroPedido ? String(numeroPedido) : '';

        Object.keys(agenda).forEach(k => {
            const ev = agenda[k];
            if (!ev) return;
            const evVendaId = String(ev.vendaId || '');
            const evNumPed = String(ev.numeroPedido || '');
            const evTitulo = String(ev.titulo || '');

            const matchVendaId = vIdStr && (evVendaId === vIdStr);
            const matchNumPed = (numPedStr || numPedRaw) && (
                evNumPed === numPedStr ||
                evNumPed === numPedRaw ||
                (numPedStr && evTitulo.includes('#' + numPedStr)) ||
                (numPedRaw && evTitulo.includes('#' + numPedRaw))
            );

            if (matchVendaId || matchNumPed) {
                updatesAgenda[`agenda_eventos.${k}`] = firebase.firestore.FieldValue.delete();
                delete agenda[k];
                encontrou = true;
            }
        });

        if (encontrou) {
            await configRef.update(updatesAgenda);
            if (typeof agendaEventsData !== 'undefined' && agendaEventsData) {
                Object.keys(updatesAgenda).forEach(upKey => {
                    const cleanKey = upKey.replace('agenda_eventos.', '');
                    delete agendaEventsData[cleanKey];
                });
            }
            if (typeof window.renderizarTodosEventosAgenda === 'function') {
                try { window.renderizarTodosEventosAgenda(); } catch(e) {}
            }
            if (window.FCCache && typeof window.FCCache.atualizarItem === 'function') {
                window.FCCache.atualizarItem('configuracoes', 'config', { agenda_eventos: agenda });
            }
        }
    } catch (eAgenda) {
        console.warn('[Agendamento] Erro ao remover agendamento vinculado à venda:', eAgenda);
    }
};

// Remove títulos financeiros vinculados a esta venda tanto do Firestore quanto da memória viva e do FCCache (IndexedDB)
window.removerFinanceiroVinculadoVenda = async function(vendaId, numeroPedido, batch) {
    if (!vendaId && !numeroPedido) return [];
    const idsParaDeletar = new Set();
    const docsRefsParaDeletar = [];

    const vIdStr = String(vendaId || '');
    const numPedStr = numeroPedido ? String(numeroPedido).padStart(4, '0') : '';
    const numPedRaw = numeroPedido ? String(numeroPedido) : '';

    try {
        if (typeof window.getEmpresaRef === 'function') {
            const colFin = window.getEmpresaRef().collection('financeiro');

            if (vIdStr) {
                // 1. Por origemVendaId (String)
                const q1 = await colFin.where('origemVendaId', '==', vIdStr).get();
                q1.forEach(d => { idsParaDeletar.add(d.id); docsRefsParaDeletar.push(d.ref); });

                // 2. Por origemVendaId (Number, se aplicável)
                const numVal = Number(vIdStr);
                if (!isNaN(numVal) && String(numVal) === vIdStr) {
                    const q1Num = await colFin.where('origemVendaId', '==', numVal).get();
                    q1Num.forEach(d => { idsParaDeletar.add(d.id); docsRefsParaDeletar.push(d.ref); });
                }

                // 3. Por idVenda (String)
                const q2 = await colFin.where('idVenda', '==', vIdStr).get();
                q2.forEach(d => { idsParaDeletar.add(d.id); docsRefsParaDeletar.push(d.ref); });

                // 4. Por idVenda (Number, se aplicável)
                if (!isNaN(numVal) && String(numVal) === vIdStr) {
                    const q2Num = await colFin.where('idVenda', '==', numVal).get();
                    q2Num.forEach(d => { idsParaDeletar.add(d.id); docsRefsParaDeletar.push(d.ref); });
                }
            }

            // 5. Por número do pedido, se disponível
            if (numPedRaw) {
                const numP = Number(numPedRaw);
                if (!isNaN(numP)) {
                    const qPedNum = await colFin.where('numeroPedido', '==', numP).get();
                    qPedNum.forEach(d => { idsParaDeletar.add(d.id); docsRefsParaDeletar.push(d.ref); });
                }
                const qPedStr = await colFin.where('numeroPedido', '==', numPedRaw).get();
                qPedStr.forEach(d => { idsParaDeletar.add(d.id); docsRefsParaDeletar.push(d.ref); });
            }
        }
    } catch(eFinFirestore) {
        console.warn('[Financeiro] Erro ao consultar Firestore no estorno da venda:', eFinFirestore);
    }

    // 6. Varredura no repositório em memória viva (db.financeiro / window.db.financeiro)
    const listaFinMemoria = (typeof db !== 'undefined' && Array.isArray(db.financeiro))
        ? db.financeiro
        : ((typeof window.db !== 'undefined' && Array.isArray(window.db.financeiro)) ? window.db.financeiro : []);

    listaFinMemoria.forEach(f => {
        if (!f || !f.id) return;
        const fOrigem = String(f.origemVendaId || '');
        const fIdVenda = String(f.idVenda || '');
        const fNumPed = String(f.numeroPedido || '');
        const fRef = String(f.ref || '');

        const matchId = vIdStr && (fOrigem === vIdStr || fIdVenda === vIdStr);
        const matchPedido = (numPedStr || numPedRaw) && (
            (numPedStr && fNumPed === numPedStr) ||
            (numPedRaw && fNumPed === numPedRaw) ||
            (f.categoria === 'Vendas' && (
                (numPedStr && fRef.includes(`Venda #${numPedStr}`)) ||
                (numPedRaw && fRef.includes(`Venda #${numPedRaw}`)) ||
                (numPedStr && fRef.includes(`Pedido #${numPedStr}`)) ||
                (numPedRaw && fRef.includes(`Pedido #${numPedRaw}`)) ||
                (numPedStr && fRef.includes(`#${numPedStr}`)) ||
                (numPedRaw && fRef.includes(`#${numPedRaw}`))
            ))
        );

        if (matchId || matchPedido) {
            idsParaDeletar.add(String(f.id));
            if (typeof window.getEmpresaRef === 'function') {
                docsRefsParaDeletar.push(window.getEmpresaRef().collection('financeiro').doc(String(f.id)));
            }
        }
    });

    // 7. Remove no Firestore: usa o batch recebido ou realiza a exclusão diretamente
    if (batch && docsRefsParaDeletar.length > 0) {
        const refsUnicos = new Map();
        docsRefsParaDeletar.forEach(r => refsUnicos.set(r.path, r));
        refsUnicos.forEach(r => batch.delete(r));
    } else if (docsRefsParaDeletar.length > 0) {
        try {
            const b = firestore.batch();
            const refsUnicos = new Map();
            docsRefsParaDeletar.forEach(r => refsUnicos.set(r.path, r));
            refsUnicos.forEach(r => b.delete(r));
            await b.commit();
        } catch(eCommitFin) {
            console.warn('[Financeiro] Erro ao deletar títulos no Firestore:', eCommitFin);
        }
    }

    // 8. Remove da memória local imediatamente
    if (idsParaDeletar.size > 0) {
        if (typeof db !== 'undefined' && Array.isArray(db.financeiro)) {
            db.financeiro = db.financeiro.filter(f => !idsParaDeletar.has(String(f.id)));
        }
        if (typeof window.db !== 'undefined' && Array.isArray(window.db.financeiro)) {
            window.db.financeiro = window.db.financeiro.filter(f => !idsParaDeletar.has(String(f.id)));
        }

        // 9. Remove do FCCache (IndexedDB e sessionStorage)
        if (typeof window.FCCache !== 'undefined') {
            idsParaDeletar.forEach(fid => {
                if (typeof window.FCCache.removerItem === 'function') {
                    window.FCCache.removerItem('financeiro', fid);
                }
            });
            if (typeof window.FCCache.set === 'function') {
                const finRestante = (typeof db !== 'undefined' && db.financeiro) ? db.financeiro : (window.db && window.db.financeiro);
                if (finRestante) window.FCCache.set('financeiro', finRestante);
            }
        }

        try { localStorage.setItem('fc_sync_trigger', Date.now()); } catch(e) {}
    }

    return Array.from(idsParaDeletar);
};

window.excluirVenda = function(id) {
    const v = (window.db && window.db.vendas) ? window.db.vendas.find(x => String(x.id) === String(id)) : null; 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja excluir este orçamento?' 
        : 'Atenção! Isso fará a exclusão completa desta venda (devolvendo estoque e apagando as parcelas do financeiro). Deseja continuar?';

    window.abrirConfirmacao('Excluir Operação', msg, async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        if(item.id) {
                            const pRef = window.getEmpresaRef().collection('produtos').doc(String(item.id));
                            batch.set(pRef, { estoque: firebase.firestore.FieldValue.increment(Number(item.qtd || 1)) }, { merge: true });
                            
                            const kardexRef = window.getEmpresaRef().collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: 'Estorno (Exclusão) ' + (v.tipo || 'Venda') + ' #' + numPedStr,
                                prodId: item.id,
                                prodNome: item.nome || 'Produto',
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        } 
                    }); 
                }
                
                await window.removerFinanceiroVinculadoVenda(id, v.numeroPedido, batch);
                await window.excluirAgendamentoVinculadoVenda(id, v.numeroPedido);
                
                // Cálculo preciso do montante efetivamente pago em dinheiro
                let valorDinheiroEfetivo = 0;
                if (Array.isArray(v.pagamentos) && v.pagamentos.length > 0) {
                    const pDinheiro = v.pagamentos.find(p => p && (p.metodo === 'Dinheiro' || String(p.metodo).includes('Dinheiro')));
                    if (pDinheiro) {
                        valorDinheiroEfetivo = Number(pDinheiro.valor || 0) - Number(v.troco || 0);
                        if (valorDinheiroEfetivo < 0) valorDinheiroEfetivo = 0;
                    }
                } else if (v.pag && String(v.pag).includes('Dinheiro')) {
                    valorDinheiroEfetivo = Number(v.valorLiquido || v.tot || 0);
                }

                if (valorDinheiroEfetivo > 0) { 
                    let cxAtual = window.db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                    let cxSaldoNovo = (cxAtual.saldo || 0) - valorDinheiroEfetivo;
                    cxHistoricoNovo.unshift({ 
                        data: new Date().toISOString(), 
                        tipo: 'SAIDA', 
                        desc: 'Estorno (Exclusão) ' + (v.tipo || 'Venda') + ' #' + numPedStr, 
                        valor: valorDinheiroEfetivo 
                    });
                    
                    const caixaRef = window.getEmpresaRef().collection('caixa').doc('caixa_atual');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }

            const vendaRef = window.getEmpresaRef().collection('vendas').doc(String(id));
            batch.delete(vendaRef);

            // Atualiza memoria local e cache imediatamente
            if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
                db.vendas = db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) {
                window.db.vendas = window.db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.removerItem === 'function') {
                await window.FCCache.removerItem('vendas', id);
            }

            await batch.commit();

            try {
                const trExcluir = document.querySelector('button[onclick*="excluirVenda(\'' + id + '\')"]')?.closest('tr');
                if (trExcluir) trExcluir.remove();
            } catch(e) {}

            if (typeof renderVendas === 'function') renderVendas();
            if (typeof renderOrcamentos === 'function') renderOrcamentos();
            if (typeof renderVendasPendentesPDV === 'function') renderVendasPendentesPDV();
            window.fecharModalConfirmacao();
            showToast('Operação excluída com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            window.fecharModalConfirmacao();
            showToast('Erro ao excluir a operação.', 'error');
        }
    });
};

// ==========================================
// FUNCOES DE BUSCA CEP E CNPJ GLOBAIS
// ==========================================

window.buscarCEP = function(prefixo) {
    const cepInput = document.getElementById(`${prefixo}-cep`);
    if(!cepInput) return;
    const cep = cepInput.value.replace(/\D/g, '');
    if(cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(res => res.json())
            .then(data => {
                if(!data.erro) {
                    const elEnd = document.getElementById(`${prefixo}-endereco`);
                    const elBai = document.getElementById(`${prefixo}-bairro`);
                    const elCid = document.getElementById(`${prefixo}-cidade`);
                    if(elEnd) elEnd.value = data.logradouro;
                    if(elBai) elBai.value = data.bairro;
                    if(elCid) elCid.value = data.localidade + ' - ' + data.uf;
                }
            })
            .catch(() => {});
    }
};

window.buscarCNPJ = function(prefixo) {
    const docInput = document.getElementById(`${prefixo}-doc`);
    if(!docInput) return;
    const cnpj = docInput.value.replace(/\D/g, '');
    if(cnpj.length === 14) {
        const btnBusca = document.getElementById(`btn-busca-cnpj-${prefixo}`);
        if(btnBusca) {
            const oldHtml = btnBusca.innerHTML;
            btnBusca.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btnBusca.disabled = true;
            
            fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
                .then(res => {
                    if(!res.ok) throw new Error('CNPJ inválido ou API indisponível.');
                    return res.json();
                })
                .then(data => {
                    const elNome = document.getElementById(`${prefixo}-nome`);
                    const elFantasia = document.getElementById(`${prefixo}-fantasia`);
                    const elCep = document.getElementById(`${prefixo}-cep`);
                    const elTel = document.getElementById(`${prefixo}-telefone`);
                    
                    if(elNome) elNome.value = data.razao_social || '';
                    if(elFantasia && data.nome_fantasia) elFantasia.value = data.nome_fantasia;
                    
                    if(elCep && data.cep) {
                        elCep.value = data.cep;
                        // Trigger CEP search
                        window.buscarCEP(prefixo);
                    }
                    
                    if(elTel && data.ddd_telefone_1) {
                        elTel.value = data.ddd_telefone_1;
                    }
                    
                    showToast('Dados do CNPJ preenchidos!', 'success');
                })
                .catch(err => {
                    showToast(err.message, 'error');
                })
                .finally(() => {
                    btnBusca.innerHTML = oldHtml;
                    btnBusca.disabled = false;
                });
        }
    } else {
        showToast('Digite um CNPJ válido com 14 dígitos.', 'error');
    }
};

window.formatarEBuscarDoc = function(input, prefixo) {
    let v = input.value.replace(/\D/g, '');
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
    }
    input.value = v;

    if (v.replace(/\D/g, '').length === 14) {
        if (typeof window.buscarCNPJ === 'function') {
            window.buscarCNPJ(prefixo);
        }
    }
};

// ==========================================
// SUPORTE A PWA & INSTALA??O DE APLICATIVO
// ==========================================
let deferredPwaPrompt = null;

if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    window.addEventListener('load', () => {
        const swPath = window.location.pathname.includes('/sistema/') ? '../sw.js' : './sw.js';
        navigator.serviceWorker.register(swPath)
            .then(reg => console.log('🚀 PWA Service Worker ativo!'))
            .catch(err => console.warn('PWA Service Worker offline/ignorado:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    window.deferredPwaPrompt = e;
    console.log('📱 PWA: Evento de instalação pronto.');
    mostrarBotaoInstalarApp();
});

window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null;
    window.deferredPwaPrompt = null;
    console.log('🎉 PWA: Aplicativo instalado com sucesso!');
    const btn = document.getElementById('btn-instalar-pwa');
    if (btn) btn.remove();
    if (typeof showToast === 'function') {
        showToast('Aplicativo instalado com sucesso!', 'success');
    }
});

function mostrarBotaoInstalarApp() {
    if (document.getElementById('btn-instalar-pwa')) return;
    
    // Se já estiver rodando instalado como App, não precisa mostrar
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    // Procura o container do botão de Sair no menu lateral
    const logoutBtn = document.querySelector('button[onclick*="fazerLogout"]');
    if (logoutBtn && logoutBtn.parentElement) {
        const container = logoutBtn.parentElement;
        const btnInstalar = document.createElement('button');
        btnInstalar.id = 'btn-instalar-pwa';
        btnInstalar.className = 'w-full mb-3 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold py-2.5 px-3 rounded-lg shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] cursor-pointer';
        btnInstalar.innerHTML = '<i class="fa-solid fa-cloud-arrow-down text-sm"></i> Instalar Aplicativo';
        btnInstalar.onclick = window.instalarPWA;
        container.insertBefore(btnInstalar, logoutBtn);
    }
}

window.instalarPWA = async function() {
    if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        const choiceResult = await deferredPwaPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
            console.log('Usuário aceitou instalar o PWA');
            deferredPwaPrompt = null;
            const btn = document.getElementById('btn-instalar-pwa');
            if (btn) btn.remove();
        }
    } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            alert('📱 Como instalar no iPhone / iPad:\n\n1. Toque no botão "Compartilhar" (ícone com quadrado e seta para cima na barra do Safari).\n2. Role para baixo e toque em "Adicionar à Tela de Início".\n3. Toque em "Adicionar" no topo direito.');
        } else {
            alert('📱 Como instalar no Computador ou Android:\n\n1. No Google Chrome ou Microsoft Edge, clique no ícone "Instalar Aplicativo" na barra de endereços (ao lado da estrela de favoritos).\n2. Ou clique nos 3 pontinhos do navegador e escolha "Instalar FC Gestão".');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mostrarBotaoInstalarApp, 1000);
});

// ==========================================
// TABELAS RESPONSIVAS MOBILE (data-label)
// ==========================================
// TABELAS RESPONSIVAS GLOBAIS — .table-wrapper
// Envolve dinamicamente todas as <table> e .list-container
// com <div class="table-wrapper"> para garantir scroll horizontal
// sem cortar preços ou botões de ação na borda direita.
// ==========================================
(function () {
    const SKIP_SELECTORS = [
        '.tabela-itens',          // Recibos térmicos
        '.no-wrap-table',         // Escape manual
        '[data-no-wrap]',         // Escape manual
        '#pdv-carrinho-body',     // Layout próprio do PDV
        '.print-area table'       // Impressão
    ];

    function deveIgnorar(el) {
        if (el.closest('.table-wrapper, .fc-table-wrap')) return true; // Previne duplicidade
        return SKIP_SELECTORS.some(sel => el.matches(sel) || el.closest(sel.replace(' table', '')));
    }

    function wrapElement(el) {
        if (deveIgnorar(el)) return;

        const pai = el.parentElement;
        if (pai && (pai.classList.contains('overflow-x-auto') || pai.classList.contains('table-wrapper'))) {
            pai.classList.add('table-wrapper', 'fc-table-wrap');
            return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'table-wrapper fc-table-wrap';
        pai.insertBefore(wrap, el);
        wrap.appendChild(el);
    }

    function initTableWrappers() {
        document.querySelectorAll('table, .list-container, .tabela-dados').forEach(wrapElement);
    }

    // Executa no DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTableWrappers);
    } else {
        initTableWrappers();
    }

    // Observa dados assíncronos injetados pelo Firebase
    const observer = new MutationObserver(mutations => {
        let hasNew = false;
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1 && (node.tagName === 'TABLE' || node.querySelector?.('table, .list-container'))) {
                    hasNew = true;
                    break;
                }
            }
            if (hasNew) break;
        }
        if (hasNew) initTableWrappers();
    });

    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });

    window.fcWrapTables = initTableWrappers;
})();

// ==========================================
// FUNÇÕES FISCAIS UNIVERSAIS (DANFE & XML NATIVOS - SEFAZ DIRETO)
// ==========================================
async function obterVendaFiscal(vendaOrId) {
    if (vendaOrId && typeof vendaOrId === 'object') return vendaOrId;
    const vId = String(vendaOrId || '');
    if (window.vendaAtualImpressao && (!vId || String(window.vendaAtualImpressao.id) === vId)) {
        return window.vendaAtualImpressao;
    }
    if (typeof vendasGlobais !== 'undefined' && Array.isArray(vendasGlobais)) {
        const found = vendasGlobais.find(x => String(x.id) === vId);
        if (found) return found;
    }
    if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
        const found = db.vendas.find(x => String(x.id) === vId);
        if (found) return found;
    }
    // Verifica notas de devolução
    if (typeof db !== 'undefined' && Array.isArray(db.notasDevolucao)) {
        const found = db.notasDevolucao.find(x => String(x.id) === vId || String(x.vendaId) === vId || x.chave_nfe === vId);
        if (found) {
            return {
                id: vId,
                clienteNome: found.clienteNome || 'Consumidor Final',
                clienteDoc: found.clienteDoc || '',
                tot: Number(found.valor || 0),
                pag: 'Sem Pagamento',
                formaPagamento: 'Sem Pagamento',
                pagamentos: [{ metodo: 'Sem Pagamento', valor: 0 }],
                nfe_devolucao: found
            };
        }
    }
    // Verifica notas avulsas
    if (typeof db !== 'undefined' && Array.isArray(db.notasAvulsas)) {
        const found = db.notasAvulsas.find(x => String(x.id) === vId || x.chave_nfe === vId || String(x.numero) === vId);
        if (found) {
            const formaP = found.formaPagamento || found.pag || (found.pagamentos && found.pagamentos[0]?.metodo) || 'Dinheiro';
            return {
                id: vId,
                clienteNome: found.destinatario?.nome || 'Consumidor Final',
                clienteDoc: found.destinatario?.cpf || found.destinatario?.cnpj || found.destinatario?.doc || '',
                tot: Number(found.totalLiquido !== undefined ? found.totalLiquido : (found.valor || 0)),
                pag: formaP,
                formaPagamento: formaP,
                pagamentos: found.pagamentos || [{ metodo: formaP, valor: Number(found.valor || 0) }],
                nfe: (found.modelo === '55' || String(found.tipo || '').includes('NF-e')) ? found : null,
                nfce: (found.modelo === '65' || String(found.tipo || '').includes('NFC-e')) ? found : null,
                fiscal_xml: found.xml_conteudo || '',
                fiscal_chave: found.chave_nfe || '',
                itens: found.itens || [],
                produtos: found.itens || [],
                rawAvulsa: found
            };
        }
    }
    if (typeof firebase !== 'undefined' && firebase.firestore && vId) {
        try {
            const snap = await firebase.firestore().collection('vendas').doc(vId).get();
            if (snap.exists) return { id: snap.id, ...snap.data() };
            const snapAv = await firebase.firestore().collection('notas_avulsas').doc(vId).get();
            if (snapAv.exists) {
                const found = snapAv.data();
                const formaP = found.formaPagamento || found.pag || (found.pagamentos && found.pagamentos[0]?.metodo) || 'Dinheiro';
                return {
                    id: snapAv.id,
                    clienteNome: found.destinatario?.nome || 'Consumidor Final',
                    clienteDoc: found.destinatario?.cpf || found.destinatario?.cnpj || found.destinatario?.doc || '',
                    tot: Number(found.totalLiquido !== undefined ? found.totalLiquido : (found.valor || 0)),
                    pag: formaP,
                    formaPagamento: formaP,
                    pagamentos: found.pagamentos || [{ metodo: formaP, valor: Number(found.valor || 0) }],
                    nfe: (found.modelo === '55' || String(found.tipo || '').includes('NF-e')) ? found : null,
                    nfce: (found.modelo === '65' || String(found.tipo || '').includes('NFC-e')) ? found : null,
                    fiscal_xml: found.xml_conteudo || '',
                    fiscal_chave: found.chave_nfe || '',
                    itens: found.itens || [],
                    produtos: found.itens || [],
                    rawAvulsa: found
                };
            }
        } catch (e) {
            console.warn('Erro ao buscar venda no Firestore:', e);
        }
    }
    return null;
}

/**
 * Extrai a lista detalhada de pagamentos de uma nota fiscal.
 * Prioridades:
 * 1) Do XML oficial autorizado (tags <detPag> e <vTroco>), garantindo fidelidade 100% à SEFAZ
 * 2) Do array `v.pagamentos` ou `nota.pagamentos`
 * 3) Da string `v.pag` ou `nota.pag` (inclusive com múltiplos pagamentos separados por '+')
 * 4) Dos campos `v.formaPagamento` / `v.pagamento` / `v.metodo`
 * 5) Fallback padrão 'Dinheiro'
 */
function formatarDataBrLocal(d) {
    if (!d) return '';
    try {
        const str = String(d).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const p = str.split('T')[0].split('-');
            return `${p[2]}/${p[1]}/${p[0]}`;
        }
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return str.replace(',', '').trim();
        const dia = String(dt.getDate()).padStart(2, '0');
        const mes = String(dt.getMonth() + 1).padStart(2, '0');
        const ano = dt.getFullYear();
        return `${dia}/${mes}/${ano}`;
    } catch (e) {
        return String(d).replace(',', '').trim();
    }
}

function extrairPagamentosNota(v, nota) {
    try {
        const rawXml = nota?.xml_conteudo || v?.fiscal_xml || v?.nfce?.xml_conteudo || v?.nfe?.xml_conteudo || v?.rawAvulsa?.xml_conteudo || '';
        const xml = typeof rawXml === 'string' ? rawXml : '';
        const totalNota = Number(v?.totalLiquido || v?.tot || v?.valorLiquido || v?.total || nota?.valor || 0);
        const dataEmissaoRaw = nota?.data_emissao || v?.data || new Date().toISOString();
        const dataBaseApenas = formatarDataBrLocal(dataEmissaoRaw);

        const nomesSefaz = {
            '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de Crédito', '04': 'Cartão de Débito',
            '05': 'Crédito Loja', '10': 'Vale Alimentação', '11': 'Vale Refeição', '12': 'Vale Presente',
            '13': 'Vale Combustível', '14': 'Duplicata Mercantil', '15': 'Boleto Bancário',
            '16': 'Depósito Bancário', '17': 'Pagamento Instantâneo (PIX)', '18': 'Transferência Bancária',
            '19': 'Programa de Fidelidade', '20': 'PIX', '90': 'Sem Pagamento', '99': 'Outros'
        };

        // 1. Extrair <dup> do XML se existir
        const dupsXml = [];
        if (xml && xml.includes('<dup>')) {
            const regexDup = /<dup>([\s\S]*?)<\/dup>/g;
            let matchDup;
            while ((matchDup = regexDup.exec(xml)) !== null) {
                const bloco = matchDup[1];
                const nDup = bloco.match(/<nDup>([\s\S]*?)<\/nDup>/)?.[1]?.trim() || '';
                const dVenc = bloco.match(/<dVenc>([\s\S]*?)<\/dVenc>/)?.[1]?.trim() || '';
                const vDup = parseFloat(bloco.match(/<vDup>([\d\.]+)<\/vDup>/)?.[1]) || 0;
                if (vDup > 0 || dVenc) {
                    dupsXml.push({
                        numero: nDup || String(dupsXml.length + 1).padStart(3, '0'),
                        vencimento: dVenc,
                        vencimentoFormatado: formatarDataBrLocal(dVenc),
                        valor: vDup
                    });
                }
            }
        }

        // 2. Extrair <detPag> e <vTroco> do XML
        const detPagsXml = [];
        let trocoXml = 0;
        if (xml && xml.includes('<detPag>')) {
            const regexDetPag = /<detPag>([\s\S]*?)<\/detPag>/g;
            let match;
            while ((match = regexDetPag.exec(xml)) !== null) {
                const bloco = match[1];
                const tPagMatch = bloco.match(/<tPag>(\d+)<\/tPag>/);
                const vPagMatch = bloco.match(/<vPag>([\d\.]+)<\/vPag>/);
                const xPagMatch = bloco.match(/<xPag>([\s\S]*?)<\/xPag>/);
                if (tPagMatch && vPagMatch) {
                    const cod = tPagMatch[1].padStart(2, '0');
                    const val = parseFloat(vPagMatch[1]) || 0;
                    let nome = nomesSefaz[cod] || `Outros (${cod})`;
                    if (cod === '99' && xPagMatch && xPagMatch[1].trim()) {
                        nome = xPagMatch[1].trim();
                    } else if (cod === '17' || cod === '20') {
                        nome = 'PIX';
                    }
                    detPagsXml.push({ codigo: cod, nome, valor: val });
                }
            }
            const trocoMatch = xml.match(/<vTroco>([\d\.]+)<\/vTroco>/);
            if (trocoMatch) trocoXml = parseFloat(trocoMatch[1]) || 0;
        }

        // 3. Obter lista de pagamentos do objeto de venda / nota
        let listaArr = (v?.pagamentos && Array.isArray(v?.pagamentos) && v.pagamentos.length > 0)
            ? v.pagamentos
            : (nota?.pagamentos && Array.isArray(nota?.pagamentos) && nota.pagamentos.length > 0 ? nota.pagamentos : []);

        if (listaArr.length === 0 && v?.condicaoPagamentoVendedor) {
            listaArr = [v.condicaoPagamentoVendedor];
        }

        if (listaArr.length === 0 && (v?.pag || nota?.pag)) {
            const pagStr = String(v?.pag || nota?.pag || '').trim();
            if (pagStr && pagStr !== 'Sem Pagamento') {
                if (pagStr.includes('+')) {
                    const partes = pagStr.split('+').map(s => s.trim()).filter(Boolean);
                    listaArr = partes.map(pt => {
                        const matchVal = pt.match(/\(R\$\s*([\d\.,]+)\)/i);
                        let valor = 0;
                        let nome = pt;
                        if (matchVal) {
                            valor = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.')) || 0;
                            nome = pt.replace(matchVal[0], '').trim();
                        }
                        const matchParc = String(nome).match(/\((\d+)x\)/i) || String(nome).match(/(\d+)x/i);
                        const parcelas = matchParc ? parseInt(matchParc[1]) : 1;
                        return { metodo: nome, valor, parcelas };
                    });
                } else {
                    const matchVal = pagStr.match(/\(R\$\s*([\d\.,]+)\)/i);
                    let valor = totalNota;
                    let nome = pagStr;
                    if (matchVal) {
                        const vParsed = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.'));
                        if (vParsed > 0) valor = vParsed;
                        nome = pagStr.replace(matchVal[0], '').trim();
                    }
                    const matchParc = String(nome).match(/\((\d+)x\)/i) || String(nome).match(/(\d+)x/i);
                    const parcelas = matchParc ? parseInt(matchParc[1]) : 1;
                    listaArr = [{ metodo: nome, valor, parcelas }];
                }
            }
        }

        // 4. Buscar títulos do financeiro vinculados à venda se existirem
        let titulosFinanceiro = [];
        try {
            if (typeof db !== 'undefined' && Array.isArray(db?.financeiro) && (v?.id || v?.numeroPedido)) {
                const vIdStr = String(v?.id || '');
                const numPedStr = String(v?.numeroPedido || v?.id || '');
                titulosFinanceiro = db.financeiro.filter(f => {
                    if (!f) return false;
                    const origemIdStr = String(f.origemVendaId || f.origemId || '');
                    const refStr = typeof f.ref === 'string' ? f.ref : (f.ref !== undefined && f.ref !== null ? String(f.ref) : '');
                    const matchOrigem = vIdStr && origemIdStr === vIdStr;
                    const matchPed = numPedStr && refStr && (refStr.includes('#' + numPedStr) || refStr === numPedStr);
                    const isReceita = f.tipo === 'RECEITA' || !f.tipo;
                    return (matchOrigem || matchPed) && isReceita;
                }).sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));
            }
        } catch (eFin) {
            console.warn('Erro ao filtrar titulos do financeiro:', eFin);
        }

        // 5. Se não achou pagamentos estruturados, mas tem detPagsXml
        if (listaArr.length === 0 && detPagsXml.length > 0) {
            listaArr = detPagsXml.map(dp => ({
                metodo: dp.nome,
                codigo: dp.codigo,
                valor: dp.valor,
                parcelas: 1
            }));
        }

        const pagamentosProcessados = [];
        const faturasProcessadas = [];

        if (listaArr.length > 0) {
            listaArr.forEach((p, pIdx) => {
                if (!p) return;
                let metodoNome = p.metodo || p.forma || p.formaPagamento || p.nome || '';
                if (!metodoNome && detPagsXml[pIdx]) {
                    metodoNome = detPagsXml[pIdx].nome;
                }
                if (!metodoNome) metodoNome = 'Dinheiro';
                metodoNome = String(metodoNome);

                let parcelas = parseInt(p.parcelas) || 0;
                if (!parcelas && p.detalhesParcelas && Array.isArray(p.detalhesParcelas)) {
                    parcelas = p.detalhesParcelas.length;
                }
                if (!parcelas && p.vencimentosPersonalizados && Array.isArray(p.vencimentosPersonalizados)) {
                    parcelas = p.vencimentosPersonalizados.length;
                }
                if (!parcelas) {
                    const matchX = metodoNome.match(/\((\d+)x\)/i) || metodoNome.match(/(\d+)x/i);
                    if (matchX) parcelas = parseInt(matchX[1]);
                }
                if (!parcelas) parcelas = 1;

                const valorTotalMetodo = (parseFloat(p.valor) || 0) || (listaArr.length === 1 ? totalNota : 0);
                const parcelasDetalhes = [];

                if (dupsXml.length > 0 && listaArr.length === 1) {
                    dupsXml.forEach(d => {
                        parcelasDetalhes.push({
                            ...d,
                            metodo: metodoNome
                        });
                    });
                } else if (p.detalhesParcelas && Array.isArray(p.detalhesParcelas) && p.detalhesParcelas.length > 0) {
                    p.detalhesParcelas.forEach((dp, i) => {
                        if (!dp) return;
                        const numStr = String(dp.parcela || i + 1).padStart(3, '0');
                        const dtVenc = dp.vencimento || dp.data || '';
                        const vParc = parseFloat(dp.valor) || (valorTotalMetodo / p.detalhesParcelas.length);
                        parcelasDetalhes.push({
                            numero: numStr,
                            vencimento: dtVenc,
                            vencimentoFormatado: formatarDataBrLocal(dtVenc) || dataBaseApenas,
                            valor: vParc,
                            metodo: metodoNome
                        });
                    });
                } else if (titulosFinanceiro.length > 1 && titulosFinanceiro.length === parcelas) {
                    titulosFinanceiro.forEach((tf, i) => {
                        if (!tf) return;
                        const numStr = String(i + 1).padStart(3, '0');
                        const dtVenc = tf.data || tf.vencimento || '';
                        const vParc = parseFloat(tf.valor) || (valorTotalMetodo / parcelas);
                        parcelasDetalhes.push({
                            numero: numStr,
                            vencimento: dtVenc,
                            vencimentoFormatado: formatarDataBrLocal(dtVenc) || dataBaseApenas,
                            valor: vParc,
                            metodo: metodoNome
                        });
                    });
                } else if (parcelas > 1) {
                    const baseCentavos = Math.floor((valorTotalMetodo / parcelas) * 100) / 100;
                    const restoCentavos = Math.round((valorTotalMetodo - (baseCentavos * parcelas)) * 100) / 100;
                    
                    let dataRef = p.vencimentoBase ? new Date(p.vencimentoBase + 'T12:00:00') : new Date(dataEmissaoRaw);
                    if (isNaN(dataRef.getTime())) dataRef = new Date();

                    for (let i = 1; i <= parcelas; i++) {
                        const numStr = String(i).padStart(3, '0');
                        let dtVenc = '';
                        if (p.vencimentosPersonalizados && p.vencimentosPersonalizados[i - 1]) {
                            dtVenc = p.vencimentosPersonalizados[i - 1];
                        } else {
                            const d = new Date(dataRef);
                            d.setDate(d.getDate() + (30 * (i - 1)));
                            dtVenc = d.toISOString().split('T')[0];
                        }
                        const vParc = (i === 1) ? (baseCentavos + restoCentavos) : baseCentavos;
                        parcelasDetalhes.push({
                            numero: numStr,
                            vencimento: dtVenc,
                            vencimentoFormatado: formatarDataBrLocal(dtVenc) || dataBaseApenas,
                            valor: vParc,
                            metodo: metodoNome
                        });
                    }
                } else {
                    const dtVenc = p.vencimentoBase || (p.vencimentosPersonalizados && p.vencimentosPersonalizados[0]) || '';
                    parcelasDetalhes.push({
                        numero: '001',
                        vencimento: dtVenc,
                        vencimentoFormatado: dtVenc ? formatarDataBrLocal(dtVenc) : dataBaseApenas,
                        valor: valorTotalMetodo,
                        metodo: metodoNome
                    });
                }

                const nomeMetodoComParc = (parcelas > 1 && !metodoNome.includes('x)')) 
                    ? `${metodoNome} (${parcelas}x)` 
                    : metodoNome;

                pagamentosProcessados.push({
                    codigo: p.codigo || (detPagsXml[pIdx]?.codigo) || '',
                    nome: nomeMetodoComParc,
                    metodo: metodoNome,
                    valor: valorTotalMetodo,
                    parcelas: parcelasDetalhes.length,
                    vencimentoBase: p.vencimentoBase || (parcelasDetalhes[0]?.vencimento) || '',
                    detalhesParcelas: parcelasDetalhes
                });

                parcelasDetalhes.forEach(pd => faturasProcessadas.push(pd));
            });
        }

        if (pagamentosProcessados.length === 0) {
            pagamentosProcessados.push({
                codigo: '01',
                nome: 'Dinheiro',
                metodo: 'Dinheiro',
                valor: totalNota,
                parcelas: 1,
                detalhesParcelas: [{
                    numero: '001',
                    vencimento: '',
                    vencimentoFormatado: dataBaseApenas,
                    valor: totalNota,
                    metodo: 'Dinheiro'
                }]
            });
            faturasProcessadas.push({
                numero: '001',
                vencimento: '',
                vencimentoFormatado: dataBaseApenas,
                valor: totalNota,
                metodo: 'Dinheiro'
            });
        }

        const somaPag = pagamentosProcessados.reduce((acc, p) => acc + p.valor, 0);
        const trocoEfetivo = trocoXml > 0 ? trocoXml : (somaPag > totalNota ? (somaPag - totalNota) : 0);
        const temParcelamento = faturasProcessadas.length > 1;

        return {
            pagamentos: pagamentosProcessados,
            faturas: faturasProcessadas,
            parcelas: faturasProcessadas,
            temParcelamento: temParcelamento,
            troco: trocoEfetivo,
            textoResumo: pagamentosProcessados.map(p => p.nome).join(' + ')
        };
    } catch (errGeral) {
        console.error('[extrairPagamentosNota] Falha ao extrair pagamentos da nota:', errGeral);
        const totalNota = Number(v?.totalLiquido || v?.tot || v?.valorLiquido || v?.total || nota?.valor || 0);
        const dataEmissaoRaw = nota?.data_emissao || v?.data || new Date().toISOString();
        const dataBaseApenas = formatarDataBrLocal(dataEmissaoRaw);
        return {
            pagamentos: [{ codigo: '01', nome: 'Dinheiro', metodo: 'Dinheiro', valor: totalNota, parcelas: 1 }],
            faturas: [{ numero: '001', vencimento: '', vencimentoFormatado: dataBaseApenas, valor: totalNota, metodo: 'Dinheiro' }],
            parcelas: [{ numero: '001', vencimento: '', vencimentoFormatado: dataBaseApenas, valor: totalNota, metodo: 'Dinheiro' }],
            temParcelamento: false,
            troco: 0,
            textoResumo: 'Dinheiro'
        };
    }
}
window.extrairPagamentosNota = extrairPagamentosNota;

// ==============================================================
// GERADOR DE CÓDIGO DE BARRAS CODE 128C PARA CHAVE DA NF-e
// Gera SVG vetorial 100% puro, nativo e offline (sem libs externas)
// ==============================================================
function gerarSvgCode128(chave44) {
    const limpo = String(chave44 || '').replace(/\D/g, '');
    if (limpo.length !== 44) return '';

    const patterns = [
        "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
        "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
        "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
        "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
        "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
        "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
        "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
        "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
        "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
        "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
        "114131","311141","411131","211412","211214","211232","2331112"
    ];

    const START_C = 105;
    const STOP = 106;

    let soma = START_C;
    const codigos = [START_C];

    for (let i = 0; i < 44; i += 2) {
        const par = parseInt(limpo.substring(i, i + 2), 10);
        codigos.push(par);
        const peso = (i / 2) + 1;
        soma += par * peso;
    }

    const checksum = soma % 103;
    codigos.push(checksum);
    codigos.push(STOP);

    let modulos = "";
    for (const c of codigos) {
        const p = patterns[c];
        let isBar = true;
        for (let i = 0; i < p.length; i++) {
            const w = parseInt(p[i], 10);
            modulos += (isBar ? "1" : "0").repeat(w);
            isBar = !isBar;
        }
    }

    const svgLargura = modulos.length;
    let svgRects = "";
    let x = 0;
    let barWidth = 0;

    for (let i = 0; i < modulos.length; i++) {
        if (modulos[i] === "1") {
            barWidth++;
        } else {
            if (barWidth > 0) {
                svgRects += `<rect x="${x}" y="0" width="${barWidth}" height="50" fill="#000" />`;
                x += barWidth;
                barWidth = 0;
            }
            x++;
        }
    }
    if (barWidth > 0) {
        svgRects += `<rect x="${x}" y="0" width="${barWidth}" height="50" fill="#000" />`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgLargura} 50" preserveAspectRatio="none" style="width:100%; height:38px; display:block;">${svgRects}</svg>`;
}
window.gerarSvgCode128 = gerarSvgCode128;

// ==============================================================
// LAYOUT OFICIAL DO DANFE NF-e (MOD 55) - PADRÃO A4 RETRATO
// ==============================================================
function gerarHtmlDanfeNFeA4(v, nota, emp) {
    const isDevolucao = Boolean(nota?.isDevolucao || nota?.tipo_devolucao || nota?.chave_original || v?.nfe_devolucao === nota || (typeof nota?.tipo === 'string' && nota.tipo.includes('Devolução')));
    const tpNF = isDevolucao ? '0' : '1';
    const naturezaOp = isDevolucao ? 'DEVOLUÇÃO DE MERCADORIA' : (emp?.naturezaOperacao || 'VENDA DE MERCADORIA');

    const chave = String(nota?.chave_nfe || v?.fiscal_chave || '').replace(/\D/g, '');
    const chaveFmt = chave ? chave.replace(/(\d{4})/g, '$1 ').trim() : '-';
    const barcodeSvg = gerarSvgCode128(chave);

    const numRaw = String(nota?.numero || v?.fiscal_numero || '0').padStart(9, '0');
    const numeroNota = numRaw.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
    const serie = nota?.serie || '1';
    const protocolo = nota?.protocolo || v?.fiscal_protocolo || 'AUTORIZADO';
    const dataEmissaoRaw = nota?.data_emissao || v?.data || new Date().toISOString();
    let dataApenas = '';
    let horaApenas = '';
    let dataEmissao = '';
    try {
        const dtObj = new Date(dataEmissaoRaw);
        if (!isNaN(dtObj.getTime())) {
            const dia = String(dtObj.getDate()).padStart(2, '0');
            const mes = String(dtObj.getMonth() + 1).padStart(2, '0');
            const ano = dtObj.getFullYear();
            const hor = String(dtObj.getHours()).padStart(2, '0');
            const min = String(dtObj.getMinutes()).padStart(2, '0');
            const seg = String(dtObj.getSeconds()).padStart(2, '0');
            dataApenas = `${dia}/${mes}/${ano}`;
            horaApenas = `${hor}:${min}:${seg}`;
            dataEmissao = `${dataApenas} ${horaApenas}`;
        }
    } catch (e) {}
    if (!dataApenas) {
        const dtStr = new Date().toLocaleString('pt-BR').replace(',', '');
        dataApenas = dtStr.split(' ')[0] || '';
        horaApenas = dtStr.split(' ')[1] || '';
        dataEmissao = `${dataApenas} ${horaApenas}`;
    }

    // Emitente
    const logoSrc = emp?.logo || emp?.logoBase64 || v?.empresaLogo || (typeof db !== 'undefined' && db?.config?.empresa?.logo) || '';
    const emitRazao = emp?.razaoSocial || emp?.nome || 'EMPRESA EMISSORA';
    const emitFantasia = emp?.nomeFantasia || emp?.fantasia || '';
    const emitCnpj = emp?.cnpj || '';
    const emitIe = emp?.ie || 'ISENTO';
    const emitIeSt = emp?.ieSt || '';
    const emitLogr = emp?.logradouro || emp?.rua || 'ENDEREÇO DA EMPRESA';
    const emitNro = emp?.numero || 'S/N';
    const emitBairro = emp?.bairro || 'CENTRO';
    const emitMun = emp?.cidade || emp?.municipio || '';
    const emitUf = (emp?.uf || 'GO').toUpperCase();
    const emitCep = emp?.cep || '';
    const emitFone = emp?.telefone || emp?.fone || '';

    // Extração inteligente do Destinatário oficial (prioriza XML autorizado da SEFAZ, nota avulsa, objeto da venda e db.clientes)
    let xmlDest = null;
    const xmlBruto = nota?.xml_conteudo || v?.fiscal_xml || nota?.xml || v?.xml || (nota?.rawAvulsa && nota.rawAvulsa.xml_conteudo) || '';
    if (xmlBruto && typeof xmlBruto === 'string') {
        const mDest = xmlBruto.match(/<dest>([\s\S]*?)<\/dest>/i);
        if (mDest) {
            const bloco = mDest[1];
            const extrairTag = (tag) => {
                const mt = bloco.match(new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`, 'i'));
                return mt ? mt[1].trim() : '';
            };
            xmlDest = {
                nome: extrairTag('xNome'),
                cpf: extrairTag('CPF'),
                cnpj: extrairTag('CNPJ'),
                ie: extrairTag('IE'),
                rua: extrairTag('xLgr'),
                numero: extrairTag('nro'),
                bairro: extrairTag('xBairro'),
                cidade: extrairTag('xMun'),
                uf: extrairTag('UF'),
                cep: extrairTag('CEP'),
                fone: extrairTag('fone')
            };
        }
    }

    const docRaw = xmlDest?.cpf || xmlDest?.cnpj || v?.clienteCpf || v?.clienteCnpj || v?.clienteDoc || v?.cliente?.cpf || v?.cliente?.cnpj || v?.destinatario?.doc || v?.destinatario?.cpf || v?.destinatario?.cnpj || '';
    const docClean = String(docRaw).replace(/\D/g, '');

    // Busca cliente correspondente na base local db.clientes se houver
    let cliDb = null;
    if (typeof db !== 'undefined' && Array.isArray(db.clientes) && db.clientes.length > 0) {
        if (docClean && docClean.length >= 11) {
            cliDb = db.clientes.find(c => {
                const cDoc = String(c.doc || c.cpf || c.cnpj || '').replace(/\D/g, '');
                return cDoc && cDoc === docClean;
            });
        }
        if (!cliDb && v?.clienteId && String(v.clienteId) !== '0') {
            cliDb = db.clientes.find(c => String(c.id || c._id || '').trim() === String(v.clienteId).trim());
        }
    }

    const destObj = v?.destinatario || nota?.destinatario || v?.cliente || cliDb || {};

    const destNome = xmlDest?.nome || destObj?.nome || destObj?.razaoSocial || v?.clienteNome || 'CONSUMIDOR FINAL';
    const destDoc = xmlDest?.cpf || xmlDest?.cnpj || (docClean.length === 14 ? docClean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (docClean.length === 11 ? docClean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : (docRaw || '000.000.000-00')));
    
    let destLogr = xmlDest?.rua || destObj?.rua || destObj?.endereco || destObj?.logradouro || '';
    let destNro = xmlDest?.numero || destObj?.numero || '';
    if (!destLogr && v?.clienteEnd && typeof v.clienteEnd === 'string' && v.clienteEnd !== 'Não informado') {
        const partesEnd = v.clienteEnd.split(',');
        destLogr = partesEnd[0]?.trim() || '';
        if (partesEnd.length > 1 && !destNro) destNro = partesEnd[1]?.trim() || '';
    }
    if (!destLogr) destLogr = 'RUA';
    if (!destNro) destNro = 'S/N';

    const destBairro = xmlDest?.bairro || destObj?.bairro || 'CENTRO';

    let rawCidade = xmlDest?.cidade || destObj?.cidade || destObj?.municipio || '';
    let destUf = (xmlDest?.uf || destObj?.uf || '').toUpperCase().trim();
    if (rawCidade.includes(' - ')) {
        const parts = rawCidade.split(' - ');
        rawCidade = parts[0]?.trim() || '';
        if (!destUf && parts[1]) destUf = parts[1].trim().toUpperCase();
    }
    const destMun = rawCidade || emitMun;
    if (!destUf) destUf = emitUf;

    let destCep = String(xmlDest?.cep || destObj?.cep || '').replace(/\D/g, '');
    if (destCep && destCep.length === 8) {
        destCep = destCep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    }

    const destFone = xmlDest?.fone || destObj?.telefone || destObj?.fone || destObj?.wpp || destObj?.celular || v?.clienteTel || '';
    const destIe = xmlDest?.ie || destObj?.ie || 'ISENTO';

    // Itens
    const itens = v?.itens || v?.produtos || [];
    let totalItens = 0;
    const itensTr = itens.map((it, idx) => {
        const qtd = Number(it.quantidade || it.qtd || 1);
        const preco = Number(it.preco || it.precoUnitario || 0);
        const subtotal = qtd * preco;
        totalItens += subtotal;
        const cod = escapeHtml(it.ean || it.codigo || it.codigoProduto || it.sku || it.codProduto || it.cod || it.id || String(idx + 1));
        const desc = escapeHtml(it.nome || it.descricao || 'PRODUTO');
        const ncm = escapeHtml(it.ncm || '94036000');
        const csosn = escapeHtml(it.csosn || it.cst || '102');
        const cfop = escapeHtml(it.cfop || '5102');
        const un = escapeHtml(it.unidade || 'UN');

        return `
        <tr class="item-row">
            <td style="text-align: center;">${cod}</td>
            <td>${desc}</td>
            <td style="text-align: center;">${ncm}</td>
            <td style="text-align: center;">${csosn}</td>
            <td style="text-align: center;">${cfop}</td>
            <td style="text-align: center;">${un}</td>
            <td style="text-align: right;">${qtd.toFixed(2)}</td>
            <td style="text-align: right;">${preco.toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">${subtotal.toFixed(2)}</td>
            <td style="text-align: right;">0.00</td>
            <td style="text-align: right;">0.00</td>
            <td style="text-align: center;">0.00</td>
        </tr>`;
    }).join('');

    const totalNota = Number(v?.totalLiquido || v?.tot || v?.valorLiquido || v?.total || totalItens || 0).toFixed(2);
    const totalDesc = Number(v?.desconto || 0).toFixed(2);
    const totalProdFmt = Number(totalItens || totalNota).toFixed(2);
    const infoPag = extrairPagamentosNota(v, nota);
    const formaPag = escapeHtml(infoPag.textoResumo || 'Dinheiro');

    const listaFaturas = (infoPag.faturas && infoPag.faturas.length > 0) ? infoPag.faturas : [{
        numero: '001',
        metodo: infoPag.textoResumo || 'Dinheiro',
        vencimentoFormatado: dataApenas,
        valor: Number(totalNota)
    }];

    let linhasFatura = '';
    if (listaFaturas.length <= 4) {
        linhasFatura = listaFaturas.map((f, idx) => {
            const valFmt = Number(f.valor || 0).toFixed(2);
            return `
    <div class="row" style="${idx > 0 ? 'border-top: none;' : ''}">
        <div class="box ${idx > 0 ? 'border-t-0' : ''}" style="flex: 1.2;">
            <span class="box-title">FORMA DE PAGAMENTO</span>
            <div class="box-val">${escapeHtml(f.metodo || formaPag)}</div>
        </div>
        <div class="box ${idx > 0 ? 'border-t-0' : ''} border-l-0" style="flex: 1;">
            <span class="box-title">PARCELA / VENCIMENTO</span>
            <div class="box-val">${f.numero} - ${f.vencimentoFormatado || dataApenas}</div>
        </div>
        <div class="box ${idx > 0 ? 'border-t-0' : ''} border-l-0" style="flex: 1;">
            <span class="box-title">VALOR DA PARCELA</span>
            <div class="box-val">R$ ${valFmt}</div>
        </div>
    </div>`;
        }).join('');
    } else {
        // Para mais de 4 parcelas, exibe em grid compacto de duplicatas para preservar 1 folha A4
        linhasFatura = `
    <div class="row" style="flex-wrap: wrap; display: flex;">
        ${listaFaturas.map((f, idx) => {
            const valFmt = Number(f.valor || 0).toFixed(2);
            const isLeft = (idx % 4) === 0;
            const isTop = idx < 4;
            return `
        <div class="box ${!isLeft ? 'border-l-0' : ''} ${!isTop ? 'border-t-0' : ''}" style="flex: 1 1 24%; min-width: 24%; max-width: 25%; padding: 2px 4px; box-sizing: border-box;">
            <span class="box-title">PARC. ${f.numero} - ${escapeHtml(f.metodo || formaPag)}</span>
            <div class="box-val" style="display: flex; justify-content: space-between; font-size: 8.5px;">
                <span>Venc: <b>${f.vencimentoFormatado || dataApenas}</b></span>
                <span>R$ <b>${valFmt}</b></span>
            </div>
        </div>`;
        }).join('')}
    </div>`;
    }

    const lockSinglePage = itens.length <= 18;

    let obsTexto = (v?.observacoes || v?.observacao || v?.obs || nota?.observacoes || nota?.observacao || nota?.obs || (nota?.rawAvulsa && (nota.rawAvulsa.observacoes || nota.rawAvulsa.obs)) || '').trim();

    if (!obsTexto && xmlBruto && typeof xmlBruto === 'string') {
        const mInf = xmlBruto.match(/<infCpl>([\s\S]*?)<\/infCpl>/i);
        if (mInf && mInf[1]) {
            let textoXml = mInf[1].trim();
            textoXml = textoXml
                .replace(/DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL[\.]?/gi, '')
                .replace(/N[AÃ]O GERA DIREITO A CR[EÉ]DITO FISCAL DE IPI(\/ICMS)?[\.]?/gi, '')
                .replace(/N[AÃ]O GERA DIREITO A CR[EÉ]DITO FISCAL DE IPI[\.]?/gi, '')
                .replace(/N[AÃ]O GERA DIREITO A CR[EÉ]DITO FISCAL[\.]?/gi, '')
                .trim();
            if (textoXml) {
                obsTexto = textoXml;
            }
        }
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>DANFE NF-e Nº ${numeroNota} - ${emitRazao}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 0;
        }
        *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
            color: #000;
            background: #525659;
        }
        .no-print.bar-acoes {
            background: #1e293b;
            color: #fff;
            padding: 8px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 9999;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            font-family: Arial, sans-serif;
        }
        .danfe-page {
            width: 198mm;
            max-width: 100%;
            ${lockSinglePage ? 'height: 280mm; max-height: 280mm;' : ''}
            min-height: 278mm;
            margin: 10px auto;
            background: #fff;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            padding: 0;
        }
        .canhoto { border: 1px solid #000; display: flex; width: 100%; height: 20mm; margin-bottom: 2px; }
        .canhoto-txt { flex: 1; padding: 4px 6px; border-right: 1px solid #000; font-size: 7.5pt; line-height: 1.2; }
        .canhoto-assinatura { width: 250px; padding: 3px 5px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; }
        .canhoto-nfe { width: 95px; text-align: center; padding: 3px 2px; display: flex; flex-direction: column; justify-content: center; }
        .linha-pontilhada { border-bottom: 1px dashed #000; margin: 2px 0 3px 0; }

        .box { border: 1px solid #000; padding: 2px 4px; overflow: hidden; }
        .box-title { font-size: 6pt; text-transform: uppercase; font-weight: bold; display: block; line-height: 1; color: #111; margin-bottom: 1.5px; }
        .box-val { font-size: 8.5pt; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; }
        .box-val-normal { font-size: 8pt; font-weight: normal; line-height: 1.2; }
        .row { display: flex; width: 100%; }
        .border-t-0 { border-top: 0 !important; }
        .border-b-0 { border-bottom: 0 !important; }
        .border-l-0 { border-left: 0 !important; }
        .border-r-0 { border-right: 0 !important; }
        .section-header { font-size: 7.5pt; font-weight: bold; text-transform: uppercase; margin: 3px 0 1px 1px; letter-spacing: 0.2px; }

        .secao-produtos {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            margin-bottom: 2px;
        }
        .tabela-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            border: 1px solid #000;
        }
        table.tabela-itens {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
        }
        table.tabela-itens th {
            font-size: 6.5pt;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            border-right: 1px solid #000;
            padding: 3px 2px;
            background: #e4e4e4;
            text-align: left;
            height: 18px;
        }
        table.tabela-itens th:last-child {
            border-right: 0;
        }
        table.tabela-itens td {
            font-size: 7.5pt;
            border-right: 1px solid #000;
            padding: 2px 3px;
        }
        table.tabela-itens td:last-child {
            border-right: 0;
        }
        table.tabela-itens tr.item-row {
            height: 18px;
        }
        table.tabela-itens tr.item-row td {
            border-bottom: 1px solid #eee;
        }
        table.tabela-itens tr.filler-row {
            height: auto;
        }
        table.tabela-itens tr.filler-row td {
            border-bottom: 0;
            padding: 0;
        }

        .secao-adicionais {
            margin-top: auto;
        }

        .rodape-danfe {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 6.5pt;
            color: #333;
            padding: 2px 2px 0 2px;
            border-top: 1px solid #ccc;
            margin-top: 2px;
        }

        @media print {
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                width: 100% !important;
                height: auto !important;
                min-height: auto !important;
                overflow: visible !important;
            }
            .no-print { display: none !important; }
            .danfe-page {
                width: 198mm !important;
                max-width: 198mm !important;
                ${lockSinglePage ? 'height: 280mm !important; max-height: 280mm !important;' : ''}
                min-height: auto !important;
                margin: 4mm auto !important;
                padding: 0 !important;
                box-shadow: none !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                box-sizing: border-box !important;
            }
        }
    </style>
</head>
<body>
    <div class="no-print bar-acoes">
        <div style="font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
            <span>📄 DANFE NF-e Nº ${numeroNota}</span>
            <span style="font-size: 11px; opacity: 0.8; font-weight: normal;">(A4 Retrato - Página Completa)</span>
        </div>
        <div style="display: flex; gap: 8px;">
            <button onclick="window.print()" style="background: #0284c7; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px;">
                🖨️ Imprimir DANFE
            </button>
            <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">
                ✕ Fechar
            </button>
        </div>
    </div>

    <div class="danfe-page">
        <!-- Topo da página -->
        <div>
            <!-- Canhoto -->
            <div class="canhoto">
                <div class="canhoto-txt">
                    RECEBEMOS DE <strong>${escapeHtml(emitRazao)}</strong> OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO.
                    <div style="margin-top: 6px; font-size: 7pt; color: #555;">EMISSÃO: ${dataEmissao} - DESTINATÁRIO: ${escapeHtml(destNome)} - VALOR TOTAL: R$ ${totalNota}</div>
                </div>
                <div class="canhoto-assinatura">
                    <div class="box-title">DATA DE RECEBIMENTO</div>
                    <div style="height: 15px; border-bottom: 1px solid #000; margin-bottom: 2px;"></div>
                    <div class="box-title">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
                </div>
                <div class="canhoto-nfe">
                    <strong style="font-size: 11pt;">NF-e</strong>
                    <div style="font-size: 9pt; font-weight: bold;">Nº ${numeroNota}</div>
                    <div style="font-size: 8pt;">SÉRIE: ${serie}</div>
                </div>
            </div>
            <div class="linha-pontilhada"></div>

            <!-- Cabeçalho Emitente, Danfe, Chave -->
            <div class="row">
                <div class="box" style="flex: 1.1; display: flex; flex-direction: row; align-items: center; gap: 8px; padding: 4px 6px;">
                    ${logoSrc ? `<div style="max-width: 80px; max-height: 65px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><img src="${logoSrc}" style="max-width: 80px; max-height: 60px; object-fit: contain;"></div>` : ''}
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                        <div style="font-size: 11pt; font-weight: bold; line-height: 1.1;">${escapeHtml(emitRazao)}</div>
                        ${emitFantasia ? `<div style="font-size: 8.5pt; font-weight: bold; color: #444; margin-top: 1px;">${escapeHtml(emitFantasia)}</div>` : ''}
                        <div class="box-val-normal" style="margin-top: 2px;">${escapeHtml(emitLogr)}, ${escapeHtml(emitNro)} - ${escapeHtml(emitBairro)}</div>
                        <div class="box-val-normal">${escapeHtml(emitMun)} - ${emitUf} - CEP: ${escapeHtml(emitCep)}</div>
                        ${emitFone ? `<div class="box-val-normal">FONE: ${escapeHtml(emitFone)}</div>` : ''}
                    </div>
                </div>

                <div class="box border-l-0" style="width: 145px; text-align: center; padding: 4px 2px;">
                    <div style="font-size: 15pt; font-weight: 900; letter-spacing: 1px;">DANFE</div>
                    <div style="font-size: 7pt; line-height: 1;">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
                    <div class="row" style="margin: 4px auto 2px auto; justify-content: center; align-items: center; gap: 4px;">
                        <div style="font-size: 7.5pt; text-align: left; line-height: 1.1;">0 - ENTRADA<br>1 - SAÍDA</div>
                        <div style="border: 1px solid #000; font-size: 12pt; font-weight: bold; width: 20px; height: 20px; line-height: 20px; text-align: center;">${tpNF}</div>
                    </div>
                    <div style="font-size: 9pt; font-weight: bold; margin-top: 2px;">Nº ${numeroNota}</div>
                    <div style="font-size: 8pt; font-weight: bold;">SÉRIE: ${serie}</div>
                    <div style="font-size: 7.5pt;">FOLHA: 1/1</div>
                </div>

                <div class="box border-l-0" style="flex: 1.3; text-align: center; padding: 3px 4px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="width: 100%; margin: 1px 0;">${barcodeSvg}</div>
                    <div class="box-title" style="text-align: left; margin-top: 1px;">CHAVE DE ACESSO</div>
                    <div style="font-size: 8pt; font-weight: bold; letter-spacing: 0.4px; word-break: break-all;">${chaveFmt}</div>
                    <div style="font-size: 6.5pt; margin-top: 2px; color: #333; line-height: 1.1;">
                        Consulta de autenticidade no portal nacional da NF-e<br>
                        <span style="text-decoration: underline;">www.nfe.fazenda.gov.br/portal</span> ou no site da Sefaz Autorizadora
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="box border-t-0" style="flex: 2;">
                    <span class="box-title">NATUREZA DA OPERAÇÃO</span>
                    <div class="box-val">${escapeHtml(naturezaOp)}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1.8;">
                    <span class="box-title">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
                    <div class="box-val">${escapeHtml(protocolo)} - ${dataEmissao}</div>
                </div>
            </div>

            <div class="row">
                <div class="box border-t-0" style="flex: 1;">
                    <span class="box-title">INSCRIÇÃO ESTADUAL</span>
                    <div class="box-val">${escapeHtml(emitIe)}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">INSC. ESTADUAL DO SUBST. TRIB.</span>
                    <div class="box-val">${escapeHtml(emitIeSt || '-')}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">CNPJ</span>
                    <div class="box-val">${escapeHtml(emitCnpj)}</div>
                </div>
            </div>

            <!-- Destinatário / Remetente -->
            <div class="section-header">DESTINATÁRIO / REMETENTE</div>
            <div class="row">
                <div class="box" style="flex: 2.5;">
                    <span class="box-title">NOME / RAZÃO SOCIAL</span>
                    <div class="box-val">${escapeHtml(destNome)}</div>
                </div>
                <div class="box border-l-0" style="flex: 1.2;">
                    <span class="box-title">CNPJ / CPF</span>
                    <div class="box-val">${escapeHtml(destDoc)}</div>
                </div>
                <div class="box border-l-0" style="width: 85px;">
                    <span class="box-title">DATA DA EMISSÃO</span>
                    <div class="box-val" style="text-align: center;">${dataApenas}</div>
                </div>
            </div>
            <div class="row">
                <div class="box border-t-0" style="flex: 2;">
                    <span class="box-title">ENDEREÇO</span>
                    <div class="box-val-normal">${escapeHtml(destLogr)}, ${escapeHtml(destNro)}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">BAIRRO / DISTRITO</span>
                    <div class="box-val-normal">${escapeHtml(destBairro)}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="width: 75px;">
                    <span class="box-title">CEP</span>
                    <div class="box-val-normal">${escapeHtml(destCep || '-')}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="width: 85px;">
                    <span class="box-title">DATA SAÍDA/ENTRADA</span>
                    <div class="box-val" style="text-align: center;">${dataApenas}</div>
                </div>
            </div>
            <div class="row">
                <div class="box border-t-0" style="flex: 1.5;">
                    <span class="box-title">MUNICÍPIO</span>
                    <div class="box-val-normal">${escapeHtml(destMun)}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">FONE / FAX</span>
                    <div class="box-val-normal">${escapeHtml(destFone || '-')}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="width: 35px; text-align: center;">
                    <span class="box-title">UF</span>
                    <div class="box-val">${destUf}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">INSCRIÇÃO ESTADUAL</span>
                    <div class="box-val-normal">${escapeHtml(destIe)}</div>
                </div>
                <div class="box border-t-0 border-l-0" style="width: 85px;">
                    <span class="box-title">HORA DA SAÍDA</span>
                    <div class="box-val" style="text-align: center;">${horaApenas || '12:00:00'}</div>
                </div>
            </div>

            <!-- Fatura / Duplicata -->
            <div class="section-header">FATURA / DUPLICATA / FORMA DE PAGAMENTO</div>
            ${linhasFatura}

            <!-- Impostos -->
            <div class="section-header">CÁLCULO DO IMPOSTO</div>
            <div class="row">
                <div class="box" style="flex: 1;">
                    <span class="box-title">BASE DE CÁLCULO DO ICMS</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-l-0" style="flex: 1;">
                    <span class="box-title">VALOR DO ICMS</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-l-0" style="flex: 1;">
                    <span class="box-title">BASE DE CÁLC. ICMS ST</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-l-0" style="flex: 1;">
                    <span class="box-title">VALOR DO ICMS ST</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-l-0" style="flex: 1.2;">
                    <span class="box-title">VALOR TOTAL DOS PRODUTOS</span>
                    <div class="box-val" style="text-align: right;">${totalProdFmt}</div>
                </div>
            </div>
            <div class="row">
                <div class="box border-t-0" style="flex: 1;">
                    <span class="box-title">VALOR DO FRETE</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">VALOR DO SEGURO</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">DESCONTO</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">OUTRAS DESPESAS</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">VALOR DO IPI</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1.2; background: #fafafa;">
                    <span class="box-title">VALOR TOTAL DA NOTA</span>
                    <div class="box-val" style="text-align: right; font-size: 10pt;">R$ ${totalNota}</div>
                </div>
            </div>

            <!-- Transportador -->
            <div class="section-header">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
            <div class="row">
                <div class="box" style="flex: 2;">
                    <span class="box-title">RAZÃO SOCIAL</span>
                    <div class="box-val-normal">O MESMO / RETIRADA NO LOCAL</div>
                </div>
                <div class="box border-l-0" style="width: 140px;">
                    <span class="box-title">FRETE POR CONTA</span>
                    <div class="box-val">9 - SEM OCORRÊNCIA</div>
                </div>
                <div class="box border-l-0" style="width: 75px;">
                    <span class="box-title">CÓDIGO ANTT</span>
                    <div class="box-val-normal">-</div>
                </div>
                <div class="box border-l-0" style="width: 75px;">
                    <span class="box-title">PLACA VEÍCULO</span>
                    <div class="box-val-normal">-</div>
                </div>
                <div class="box border-l-0" style="width: 35px; text-align: center;">
                    <span class="box-title">UF</span>
                    <div class="box-val-normal">${emitUf}</div>
                </div>
                <div class="box border-l-0" style="flex: 1.2;">
                    <span class="box-title">CNPJ / CPF</span>
                    <div class="box-val-normal">-</div>
                </div>
            </div>
            <div class="row">
                <div class="box border-t-0" style="flex: 1;">
                    <span class="box-title">QUANTIDADE</span>
                    <div class="box-val-normal">1</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">ESPÉCIE</span>
                    <div class="box-val-normal">VOLUMES</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">MARCA</span>
                    <div class="box-val-normal">-</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">NUMERAÇÃO</span>
                    <div class="box-val-normal">-</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">PESO BRUTO</span>
                    <div class="box-val-normal">-</div>
                </div>
                <div class="box border-t-0 border-l-0" style="flex: 1;">
                    <span class="box-title">PESO LÍQUIDO</span>
                    <div class="box-val-normal">-</div>
                </div>
            </div>
        </div>

        <!-- DADOS DO PRODUTO / SERVIÇO (Expande cobrindo todo o meio da página) -->
        <div class="secao-produtos">
            <div class="section-header">DADOS DO PRODUTO / SERVIÇO</div>
            <div class="tabela-container">
                <table class="tabela-itens">
                    <thead>
                        <tr>
                            <th style="width: 80px; text-align: center;">CÓDIGO</th>
                            <th>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                            <th style="width: 50px; text-align: center;">NCM/SH</th>
                            <th style="width: 32px; text-align: center;">CST</th>
                            <th style="width: 32px; text-align: center;">CFOP</th>
                            <th style="width: 25px; text-align: center;">UN</th>
                            <th style="width: 38px; text-align: right;">QTD.</th>
                            <th style="width: 52px; text-align: right;">V. UNIT.</th>
                            <th style="width: 58px; text-align: right;">V. TOTAL</th>
                            <th style="width: 45px; text-align: right;">BC ICMS</th>
                            <th style="width: 45px; text-align: right;">V. ICMS</th>
                            <th style="width: 30px; text-align: center;">ALÍQ.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itensTr}
                        <tr class="filler-row">
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Parte Inferior: ISSQN, Dados Adicionais e Rodapé -->
        <div>
            <!-- Cálculo do ISSQN -->
            <div class="section-header">CÁLCULO DO ISSQN</div>
            <div class="row">
                <div class="box" style="flex: 1;">
                    <span class="box-title">INSCRIÇÃO MUNICIPAL</span>
                    <div class="box-val-normal">-</div>
                </div>
                <div class="box border-l-0" style="flex: 1;">
                    <span class="box-title">VALOR TOTAL DOS SERVIÇOS</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-l-0" style="flex: 1;">
                    <span class="box-title">BASE DE CÁLCULO DO ISSQN</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
                <div class="box border-l-0" style="flex: 1;">
                    <span class="box-title">VALOR DO ISSQN</span>
                    <div class="box-val" style="text-align: right;">0,00</div>
                </div>
            </div>

            <!-- Dados Adicionais -->
            <div class="section-header">DADOS ADICIONAIS</div>
            <div class="row">
                <div class="box" style="flex: 2.2; min-height: 60px;">
                    <span class="box-title">INFORMAÇÕES COMPLEMENTARES</span>
                    <div class="box-val-normal" style="line-height: 1.25; font-size: 7.5pt;">
                        DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.<br>
                        NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI/ICMS.<br>
                        ${isDevolucao ? `<strong>NF-E DE DEVOLUÇÃO / ENTRADA</strong> - Emitida em estorno de operação comercial.<br>Ref. Chave de Acesso Original: <strong>${escapeHtml(nota?.chave_original || v?.nfce?.chave_nfe || v?.nfe?.chave_nfe || '')}</strong><br>` : ''}
                        ${v?.id ? `Identificador da Venda: ${v.id} | ` : ''}Vendedor: ${escapeHtml(v?.vendedor || 'BALCÃO')}<br>
                        ${obsTexto ? `<strong>Observações:</strong> ${escapeHtml(obsTexto)}<br>` : ''}
                        Documento emitido através do sistema FC-Gestão - SEFAZ Direto.
                    </div>
                </div>
                <div class="box border-l-0" style="flex: 1; min-height: 60px;">
                    <span class="box-title">RESERVADO AO FISCO</span>
                    <div class="box-val-normal"></div>
                </div>
            </div>

            <!-- Rodapé Informativo Oficial -->
            <div class="rodape-danfe">
                <span>Documento emitido através do sistema FC-Gestão - SEFAZ Direto.</span>
                <span>DANFE Mod. 55 - Emissão: ${dataEmissao}</span>
            </div>
        </div>
    </div>

    <script>
        function dispararImpressao() {
            setTimeout(function() { window.print(); }, 250);
        }
        if (document.readyState === 'complete') {
            dispararImpressao();
        } else {
            window.addEventListener('load', dispararImpressao);
        }
    </script>
</body>
</html>`;
}
window.gerarHtmlDanfeNFeA4 = gerarHtmlDanfeNFeA4;

// ==============================================================
// LAYOUT DO DANFE NFC-e (MOD 65) - BOBINA TÉRMICA 80MM
// ==============================================================
function gerarHtmlDanfeNFCe80mm(v, nota, emp, qrImgSrc) {
    const chave = String(nota?.chave_nfe || nota?.chave_nfce || v?.fiscal_chave || '').replace(/\D/g, '');
    const chaveFmt = chave ? chave.replace(/(\d{4})/g, '$1 ').trim() : 'EM PROCESSAMENTO';
    const logoSrc = emp?.logo || emp?.logoBase64 || v?.empresaLogo || (typeof db !== 'undefined' && db?.config?.empresa?.logo) || '';
    const isContingencia = Boolean(nota?.contingencia || nota?.tpEmis === '9' || v?.fiscal_contingencia || v?.status_fiscal === 'contingencia' || (chave && chave.length >= 35 && chave.charAt(34) === '9'));

    let obsTextoNFCe = (v?.observacoes || v?.observacao || v?.obs || nota?.observacoes || nota?.observacao || nota?.obs || (nota?.rawAvulsa && (nota.rawAvulsa.observacoes || nota.rawAvulsa.obs)) || '').trim();
    const xmlNfc = nota?.xml_conteudo || v?.fiscal_xml || nota?.xml || v?.xml || '';
    if (!obsTextoNFCe && xmlNfc && typeof xmlNfc === 'string') {
        const mInfN = xmlNfc.match(/<infCpl>([\s\S]*?)<\/infCpl>/i);
        if (mInfN && mInfN[1]) {
            let t = mInfN[1].trim()
                .replace(/DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL[\.]?/gi, '')
                .replace(/N[AÃ]O GERA DIREITO A CR[EÉ]DITO FISCAL DE IPI(\/ICMS)?[\.]?/gi, '')
                .replace(/N[AÃ]O GERA DIREITO A CR[EÉ]DITO FISCAL DE IPI[\.]?/gi, '')
                .replace(/N[AÃ]O GERA DIREITO A CR[EÉ]DITO FISCAL[\.]?/gi, '')
                .trim();
            if (t) obsTextoNFCe = t;
        }
    }

    const itensList = v?.itens || v?.produtos || [];
    const itensHtml = itensList.map((it, i) => {
        const qtd = Number(it.quantidade || it.qtd || 1);
        const preco = Number(it.preco || it.precoUnitario || 0);
        return `
        <tr>
            <td style="font-size:10px; padding:2px 0;">${i+1} ${escapeHtml(it.nome || it.descricao || 'Produto')}</td>
            <td style="font-size:10px; text-align:right;">${qtd} ${escapeHtml(it.unidade || 'UN')}</td>
            <td style="font-size:10px; text-align:right;">${preco.toFixed(2)}</td>
            <td style="font-size:10px; text-align:right; font-weight:bold;">${(qtd * preco).toFixed(2)}</td>
        </tr>
        `;
    }).join('');

    const infoPagNFCe = extrairPagamentosNota(v, nota);
    const totalNotaNFCe = Number(v?.totalLiquido || v?.tot || v?.valorLiquido || v?.total || 0).toFixed(2);

    let linhasPagamentosNFCe = '';
    if (infoPagNFCe.pagamentos && infoPagNFCe.pagamentos.length > 0) {
        linhasPagamentosNFCe = infoPagNFCe.pagamentos.map(p => {
            const valMetodoFmt = Number(p.valor || totalNotaNFCe).toFixed(2);
            let htmlParcs = '';
            if (p.detalhesParcelas && p.detalhesParcelas.length > 1) {
                htmlParcs = p.detalhesParcelas.map(dp => `
                <div style="display:flex; justify-content:space-between; font-size:9px; padding: 1px 0 1px 10px; color: #222;">
                    <span>▪ Parc. ${dp.numero} (${dp.vencimentoFormatado})</span>
                    <span>${Number(dp.valor).toFixed(2)}</span>
                </div>`).join('');
            }
            return `
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:${p.detalhesParcelas && p.detalhesParcelas.length > 1 ? 'bold' : 'normal'}; padding: 2px 0 1px 0;">
                <span>${escapeHtml(p.nome)}</span>
                <span>${valMetodoFmt}</span>
            </div>
            ${htmlParcs}`;
        }).join('');
    } else {
        linhasPagamentosNFCe = `
        <div style="display:flex; justify-content:space-between; font-size:10px; padding: 1px 0;">
            <span>${escapeHtml(infoPagNFCe.textoResumo || 'Dinheiro')}</span>
            <span>${totalNotaNFCe}</span>
        </div>`;
    }

    const trocoHtmlNFCe = (infoPagNFCe.troco > 0.001) ? `
        <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:bold; padding: 1px 0; border-top: 1px dotted #000; margin-top: 2px;">
            <span>Troco R$</span>
            <span>${Number(infoPagNFCe.troco).toFixed(2)}</span>
        </div>` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>DANFE NFC-e - Nº ${nota?.numero || v?.id}</title>
    <style>
        @page { margin: 2mm; size: 80mm auto; }
        body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; width: 72mm; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .border-b { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
        .border-t { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; }
        .qr { text-align: center; margin: 8px 0; }
        .qr img { width: 140px; height: 140px; }
    </style>
</head>
<body>
    <div class="text-center border-b">
        ${logoSrc ? `<div style="margin-bottom: 6px;"><img src="${logoSrc}" style="max-height: 52px; max-width: 140px; object-fit: contain;"></div>` : ''}
        <div class="font-bold" style="font-size: 13px;">${escapeHtml(emp?.razaoSocial || emp?.nome || 'EMPRESA EMISSORA')}</div>
        ${emp?.nomeFantasia ? `<div style="font-size: 10px;">${escapeHtml(emp.nomeFantasia)}</div>` : ''}
        <div style="font-size: 10px;">CNPJ: ${emp?.cnpj || ''} - IE: ${emp?.ie || 'ISENTO'}</div>
        <div style="font-size: 9px;">${escapeHtml(emp?.logradouro || emp?.rua || '')}, ${escapeHtml(emp?.numero || 'S/N')} - ${escapeHtml(emp?.bairro || '')}, ${escapeHtml(emp?.cidade || '')} - ${(emp?.uf || 'GO').toUpperCase()}</div>
    </div>

    ${isContingencia ? `
    <div style="border: 2px solid #000; padding: 4px; margin: 4px 0; text-align: center; font-weight: bold; background: #fff;">
        <div style="font-size: 13px; letter-spacing: 0.5px;">EMITIDA EM CONTINGÊNCIA</div>
        <div style="font-size: 9.5px; margin-top: 2px;">Pendente de autorização pelo Fisco</div>
    </div>` : ''}

    <div class="text-center font-bold border-b" style="padding: 2px 0;">
        DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
        <div style="font-size: 9px; font-weight: normal;">Não permite aproveitamento de crédito de ICMS</div>
    </div>

    <table>
        <thead>
            <tr style="border-bottom: 1px solid #000; font-size: 9px;">
                <th style="text-align:left;">ITEM/DESC</th>
                <th style="text-align:right;">QTD</th>
                <th style="text-align:right;">UNIT</th>
                <th style="text-align:right;">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            ${itensHtml}
        </tbody>
    </table>

    <div class="border-t">
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:12px; margin-bottom: 4px;">
            <span>VALOR TOTAL R$</span>
            <span>${totalNotaNFCe}</span>
        </div>
        <div style="font-size:10px; font-weight:bold; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 3px; display:flex; justify-content:space-between;">
            <span>FORMA DE PAGAMENTO</span>
            <span>VALOR PAGO R$</span>
        </div>
        ${linhasPagamentosNFCe}
        ${trocoHtmlNFCe}
    </div>

    <div class="border-t text-center" style="font-size: 10px;">
        <div>${isContingencia ? 'EMISSÃO EM CONTINGÊNCIA' : 'EMISSÃO NORMAL'} | AMBIENTE: ${(nota?.ambiente || emp?.ambienteFiscal || 'producao').toUpperCase()}</div>
        <div>Número: <strong>${nota?.numero || '1'}</strong> - Série: <strong>${nota?.serie || '1'}</strong></div>
        <div>Emissão: ${nota?.data_emissao ? new Date(nota.data_emissao).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
        <div>Protocolo: <strong>${isContingencia && (!nota?.protocolo || nota?.protocolo === 'AUTORIZADO') ? 'EMISSÃO EM CONTINGÊNCIA' : (nota?.protocolo || 'AUTORIZADO')}</strong></div>
    </div>

    <div class="border-t text-center" style="font-size: 9px;">
        <div>CHAVE DE ACESSO</div>
        <div class="font-bold" style="letter-spacing: 0.5px; word-break: break-all;">${chaveFmt}</div>
    </div>

    ${qrImgSrc ? `
    <div class="qr border-t">
        <div>Consulte pela Chave de Acesso em:</div>
        <div style="font-size:8px; word-break:break-all;">${(emp?.uf || 'GO').toUpperCase() === 'GO' ? 'https://www.sefaz.go.gov.br/nfce/consulta' : `https://www.fazenda.${(emp?.uf||'sp').toLowerCase()}.gov.br/nfce/consulta`}</div>
        <img src="${qrImgSrc}" alt="QR Code SEFAZ">
        <div style="font-size: 8px;">Consulte via Leitor de QR Code</div>
    </div>` : ''}

    ${obsTextoNFCe ? `
    <div class="border-t text-left" style="font-size: 8.5px; padding: 4px 0; word-break: break-word;">
        <strong>OBSERVAÇÕES:</strong><br>${escapeHtml(obsTextoNFCe)}
    </div>` : ''}

    <div class="text-center" style="font-size: 9px; margin-top: 4px;">
        CONSUMIDOR: ${v?.clienteNome || 'Consumidor Não Identificado'}<br>
        ${v?.clienteDoc ? `CPF/CNPJ: ${v.clienteDoc}<br>` : ''}
        Tributos Totais Incidentes (Lei Federal 12.741/2012)
    </div>

    <script>
        function dispararImpressao() {
            setTimeout(function() { window.print(); }, 250);
        }
        if (document.readyState === 'complete') {
            dispararImpressao();
        } else {
            window.addEventListener('load', dispararImpressao);
        }
    </script>
</body>
</html>`;
}
window.gerarHtmlDanfeNFCe80mm = gerarHtmlDanfeNFCe80mm;

async function imprimirDanfeNativo(vendaOrId, tipo = 'NFC-e') {
    try {
        if (typeof showToast === 'function') showToast('Preparando DANFE para impressão...', 'info');

        const v = await obterVendaFiscal(vendaOrId);
        if (!v) {
            if (typeof showToast === 'function') showToast('Venda não encontrada para impressão fiscal.', 'error');
            else alert('Venda não encontrada para impressão fiscal.');
            return;
        }

        const isDev = (tipo === 'NF-e Devolução' || tipo === 'devolucao');
        const isNFe = isDev || (tipo === 'NF-e' || tipo === 'nfe' || tipo === '55');
        const nota = isDev ? (v.nfe_devolucao || v.nfe || {}) : (isNFe ? (v.nfe || {}) : (v.nfce || {}));
        const emp = (typeof db !== 'undefined' && db.config?.empresa) ? db.config.empresa : {};
        const chave = nota.chave_nfe || nota.chave_nfce || v.fiscal_chave || '';
        const qrCodeUrl = nota.qr_code_url || v.fiscal_qrcode_url || (chave ? `https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=${chave}` : '');
        const qrImgSrc = qrCodeUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCodeUrl)}` : '';

        let html = '';
        if (isNFe) {
            html = gerarHtmlDanfeNFeA4(v, nota, emp);
        } else {
            html = gerarHtmlDanfeNFCe80mm(v, nota, emp, qrImgSrc);
        }

        if (!html) {
            if (typeof showToast === 'function') showToast('Erro ao gerar layout da DANFE.', 'error');
            else alert('Erro ao gerar layout da DANFE.');
            return;
        }

        const winW = isNFe ? 850 : 450;
        const winH = isNFe ? 950 : 700;

        // 1. Tenta abrir janela popup
        let printWin = null;
        try {
            printWin = window.open('', '_blank', `width=${winW},height=${winH},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`);
        } catch (e) {
            console.warn('Falha ao abrir popup de impressão:', e);
        }

        if (printWin && !printWin.closed) {
            try {
                printWin.document.open();
                printWin.document.write(html);
                printWin.document.close();
                setTimeout(() => {
                    try {
                        printWin.focus();
                        printWin.print();
                    } catch (err) {
                        console.warn('Erro ao disparar print na janela popup:', err);
                    }
                }, 300);
                return;
            } catch (e) {
                console.warn('Erro ao manipular popup de impressão fiscal:', e);
            }
        }

        // 2. Fallback Iframe com Blob URL (compatível com file:// e https://)
        let iframe = document.getElementById('iframe-impressao-fiscal-global');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'iframe-impressao-fiscal-global';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.visibility = 'hidden';
            document.body.appendChild(iframe);
        }

        try {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            iframe.src = blobUrl;
            iframe.onload = () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                    } catch (err) {
                        console.warn('Erro ao disparar print no iframe via blob:', err);
                    }
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                }, 350);
            };
            return;
        } catch (eBlob) {
            console.warn('Falha ao usar blob URL para iframe, tentando srcdoc:', eBlob);
        }

        iframe.srcdoc = html;
        iframe.onload = () => {
            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (e) {
                    if (typeof showToast === 'function') showToast('Erro ao imprimir. Por favor, autorize pop-ups no navegador.', 'warning');
                    else alert('Erro ao imprimir. Por favor, autorize pop-ups no navegador.');
                }
            }, 350);
        };
    } catch (errGlobal) {
        console.error('Erro na impressão nativa da DANFE:', errGlobal);
        if (typeof showToast === 'function') showToast('Erro ao gerar DANFE: ' + (errGlobal.message || errGlobal), 'error');
        else alert('Erro ao gerar DANFE: ' + (errGlobal.message || errGlobal));
    }
}

async function baixarXmlNativo(vendaOrId, tipo = 'NFC-e') {
    const v = await obterVendaFiscal(vendaOrId);
    if (!v) {
        if (typeof showToast === 'function') showToast('Venda não encontrada para baixar XML.', 'error');
        else alert('Venda não encontrada para baixar XML.');
        return;
    }
    const isNFe = (tipo === 'NF-e' || tipo === 'nfe' || tipo === '55');
    const nota = isNFe ? (v.nfe || {}) : (v.nfce || {});
    const xml = nota.xml_conteudo || v.fiscal_xml || (v.nfce?.xml_conteudo) || (v.nfe?.xml_conteudo);
    if (!xml) {
        if (typeof showToast === 'function') showToast('Conteúdo do arquivo XML não encontrado no banco de dados.', 'warning');
        else alert('Conteúdo do arquivo XML não encontrado no banco de dados.');
        return;
    }
    const chave = nota.chave_nfe || nota.chave_nfce || v.fiscal_chave || (isNFe ? v.nfe?.chave_nfe : v.nfce?.chave_nfe) || `nota_${v.id}`;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chave}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('Download do XML concluído!', 'success');
}

window.imprimirDanfeNativo = imprimirDanfeNativo;
window.imprimirDanfeNativoGlobal = imprimirDanfeNativo;
window.baixarXmlNativo = baixarXmlNativo;
window.baixarXmlNativoGlobal = baixarXmlNativo;



// =======================================================
// GERENCIADOR DE OPCOES PERSONALIZADAS (MOVEIS E ESTOFADOS)
// Disponivel em todas as telas: PDV, Produtos, Configuracoes, Orcamentos
// =======================================================
window.categoriaOpcaoPersAtiva = 'madeiras';

window.getPersonalizacaoConfig = function() {
    if (!window.db) window.db = {};
    if (!window.db.config) window.db.config = {};
    if (!window.db.config.personalizacao) {
        window.db.config.personalizacao = {
            madeiras: ['MDF Naval', 'MDF Cru', 'Madeira Maciça (Jequitibá)', 'Madeira Maciça (Angelim)', 'Compensado Naval'],
            cores_madeira: ['Natural / Verniz Fosco', 'Natural / Verniz Brilho', 'Freijó', 'Castanho / Nogueira', 'Imbuia', 'Preto Fosco', 'Branco Acetinado', 'Off White'],
            tecidos: ['Suede Tradicional', 'Suede Animale', 'Linho Puro', 'Bouclé', 'Couro Sintético (Courino)', 'Veludo Molhado', 'Facto Impermeável'],
            cores_estofado: ['Bege Claro / Areia', 'Cinza Claro', 'Cinza Chumbo', 'Terracota', 'Verde Oliva', 'Azul Marinho', 'Preto', 'Off-White']
        };
    }
    return window.db.config.personalizacao;
};

window.salvarConfiguracaoPersonalizacaoNoBanco = async function() {
    try {
        const pers = window.getPersonalizacaoConfig();
        if (typeof window.getEmpresaRef === 'function') {
            await window.getEmpresaRef().collection('configuracoes').doc('config').set({
                personalizacao: pers
            }, { merge: true });
        }
        if (typeof window.FCCache !== 'undefined' && window.db && window.db.config) {
            window.FCCache.set('fc_moveis_config', window.db.config);
        }
        console.log('Opcoes de personalizacao sincronizadas com o banco!');
    } catch (err) {
        console.error('Erro ao sincronizar personalizacao:', err);
    }
};

window.abrirModalOpcoesPersonalizadas = function(catInicial) {
    if (catInicial) window.categoriaOpcaoPersAtiva = catInicial;
    const modal = document.getElementById('modal-opcoes-personalizadas');
    if (modal) modal.classList.remove('hidden');
    window.alternarAbaOpcoesPersonalizacao(window.categoriaOpcaoPersAtiva || 'madeiras');
};

window.fecharModalOpcoesPersonalizadas = function() {
    const modal = document.getElementById('modal-opcoes-personalizadas');
    if (modal) modal.classList.add('hidden');
    // Atualiza selects abertos se o modal de personalizacao do item estiver aberto
    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao();
    }
};

window.alternarAbaOpcoesPersonalizacao = function(cat) {
    window.categoriaOpcaoPersAtiva = cat;
    
    // Atualiza botoes da aba
    ['madeiras', 'cores_madeira', 'tecidos', 'cores_estofado'].forEach(k => {
        const btn = document.getElementById('aba-pers-btn-' + k);
        if (btn) {
            if (k === cat) {
                btn.className = 'py-2 px-3 rounded-lg font-bold text-xs transition border flex items-center justify-center gap-1.5 bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs';
            } else {
                btn.className = 'py-2 px-3 rounded-lg font-bold text-xs transition border flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
            }
        }
    });

    const labelMap = {
        madeiras: 'Adicionar Tipo de Madeira (Ex: MDF Naval, Madeira Maciça, Cedro):',
        cores_madeira: 'Adicionar Cor / Acabamento da Madeira (Ex: Freijó, Imbuia, Verniz Fosco):',
        tecidos: 'Adicionar Tipo de Tecido / Estofado (Ex: Linho Puro, Bouclé, Suede, Couro):',
        cores_estofado: 'Adicionar Cor do Tecido (Ex: Areia, Terracota, Cinza Chumbo):'
    };

    const lbl = document.getElementById('label-nova-opcao-pers');
    if (lbl) lbl.innerText = labelMap[cat] || 'Adicionar Opção:';

    const input = document.getElementById('input-nova-opcao-pers');
    if (input) {
        input.value = '';
        input.focus();
    }

    window.renderizarListaTagsOpcoesPers();
};

window.renderizarListaTagsOpcoesPers = function() {
    const cat = window.categoriaOpcaoPersAtiva || 'madeiras';
    const pers = window.getPersonalizacaoConfig();
    const lista = pers[cat] || [];
    
    const countEl = document.getElementById('contador-opcoes-pers');
    if (countEl) countEl.innerText = lista.length + (lista.length === 1 ? ' cadastrada' : ' cadastradas');

    const container = document.getElementById('lista-opcoes-pers-tags');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = '<div class="text-slate-400 text-xs py-4 text-center w-full">Nenhuma opção cadastrada nesta categoria. Adicione a primeira acima!</div>';
        return;
    }

    container.innerHTML = lista.map((item, idx) => {
        const val = typeof item === 'string' ? item : (item.nome || '');
        return `<span class="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs group hover:border-amber-400 dark:hover:border-amber-500 transition">
            <span>${val}</span>
            <button type="button" onclick="removerOpcaoPersonalizacao('${cat}', ${idx})" class="text-slate-400 hover:text-red-500 transition p-0.5 rounded" title="Excluir opção">
                <i class="fa-solid fa-xmark text-xs"></i>
            </button>
        </span>`;
    }).join('');
};

window.adicionarOpcaoPersonalizacaoAtiva = async function() {
    const cat = window.categoriaOpcaoPersAtiva || 'madeiras';
    const input = document.getElementById('input-nova-opcao-pers');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
        if (typeof showToast === 'function') showToast('Digite o nome da opção a cadastrar', 'info');
        return;
    }

    const pers = window.getPersonalizacaoConfig();
    if (!pers[cat]) pers[cat] = [];

    // Checar duplicidade
    const jaExiste = pers[cat].some(opt => (typeof opt === 'string' ? opt : opt.nome).toLowerCase() === val.toLowerCase());
    if (jaExiste) {
        if (typeof showToast === 'function') showToast('Esta opção já está cadastrada!', 'error');
        return;
    }

    pers[cat].push(val);
    input.value = '';
    window.renderizarListaTagsOpcoesPers();
    await window.salvarConfiguracaoPersonalizacaoNoBanco();

    if (typeof showToast === 'function') showToast('Opção adicionada com sucesso!', 'success');

    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao(cat, val);
    }
};

window.removerOpcaoPersonalizacao = async function(cat, idx) {
    const pers = window.getPersonalizacaoConfig();
    if (!pers[cat] || !pers[cat][idx]) return;
    const nome = typeof pers[cat][idx] === 'string' ? pers[cat][idx] : pers[cat][idx].nome;
    
    pers[cat].splice(idx, 1);
    window.renderizarListaTagsOpcoesPers();
    await window.salvarConfiguracaoPersonalizacaoNoBanco();

    if (typeof showToast === 'function') showToast(`Opção "${nome}" removida.`, 'info');

    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao();
    }
};

window.cadastrarOpcaoRapida = function(cat) {
    const nomesAmigaveis = {
        madeiras: 'Tipo de Madeira',
        cores_madeira: 'Cor / Acabamento da Madeira',
        tecidos: 'Tipo de Estofado / Tecido',
        cores_estofado: 'Cor do Estofado'
    };
    const titulo = nomesAmigaveis[cat] || 'Opção';
    const nova = prompt(`Cadastrar novo ${titulo}:\n(Ficará salvo no sistema para futuras vendas)`);
    if (!nova || !nova.trim()) return;

    const val = nova.trim();
    const pers = window.getPersonalizacaoConfig();
    if (!pers[cat]) pers[cat] = [];

    const jaExiste = pers[cat].some(opt => (typeof opt === 'string' ? opt : opt.nome).toLowerCase() === val.toLowerCase());
    if (!jaExiste) {
        pers[cat].push(val);
        window.salvarConfiguracaoPersonalizacaoNoBanco();
    }

    if (typeof window.atualizarSelectsModalPersonalizacao === 'function') {
        window.atualizarSelectsModalPersonalizacao(cat, val);
    }

    if (typeof showToast === 'function') showToast(`"${val}" adicionado às opções!`, 'success');
};

// =======================================================
// MOTOR UNIVERSAL DE EXPORTAÇÃO E RELATÓRIOS (EXCEL, WORD, PDF)
// Suporte completo em todas as páginas:
// Produtos, Vendas, Clientes, Funcionários, Fornecedores, Compras, Marketing, etc.
// =======================================================

(function() {
    function obterDadosEmpresa() {
        const conf = (window.db && window.db.config) ? window.db.config : {};
        const emp = conf.empresa || {};
        const empAtivaId = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
        const fallbackNome = (window.currentEmpresaData?.nomeEmpresa) || (window.currentEmpresaData?.nome) || localStorage.getItem('fc_nome_empresa_ativa') || (empAtivaId === 'emp_fc_moveis' ? 'FC Móveis' : 'Minha Loja');
        const nomeFinal = (emp.nome && emp.nome.trim()) ? emp.nome : ((emp.fantasia && emp.fantasia.trim()) ? emp.fantasia : fallbackNome);
        const fantasiaFinal = (emp.fantasia && emp.fantasia.trim()) ? emp.fantasia : ((emp.nome && emp.nome.trim()) ? emp.nome : fallbackNome);
        return {
            nome: nomeFinal,
            fantasia: fantasiaFinal,
            cnpj: emp.cnpj || emp.doc || '',
            telefone: emp.telefone || emp.wpp || emp.whatsapp || '',
            email: emp.email || '',
            cidade: emp.cidade || '',
            uf: emp.uf || '',
            endereco: emp.endereco || emp.rua || ''
        };
    }

    function formatarMoedaLocal(valor) {
        if (typeof formatMoney === 'function') {
            try { return formatMoney(valor); } catch(e){}
        }
        const n = Number(valor) || 0;
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatarDataHoraAtual() {
        const d = new Date();
        return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // ----------------------------------------------------
    // 1. EXPORTADOR PARA EXCEL (.XLS / HTML Spreadsheet)
    // ----------------------------------------------------
    window.exportarParaExcel = function(opts) {
        try {
            opts = opts || {};
            const emp = obterDadosEmpresa();
            const titulo = opts.titulo || 'Relatório Gerencial';
            const subtitulo = opts.subtitulo || '';
            const nomeArquivo = (opts.nomeArquivo || 'Relatorio').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const dataHora = formatarDataHoraAtual();

            let colunas = opts.colunas || [];
            let dados = opts.dados || [];

            // Se recebeu tabelaId e não recebeu dados estruturados, extrai da tabela DOM
            if ((!colunas.length || !dados.length) && opts.tabelaId) {
                const tabela = document.getElementById(opts.tabelaId);
                if (tabela) {
                    const extraido = extrairDadosDeTabelaDOM(tabela);
                    colunas = extraido.colunas;
                    dados = extraido.dados;
                }
            }

            if (!dados.length) {
                if (typeof showToast === 'function') showToast('Nenhum dado encontrado para exportar.', 'warning');
                return;
            }

            let thsHtml = colunas.map(c => 
                `<th style="background-color:#0f172a; color:#ffffff; font-weight:bold; border:0.5pt solid #94a3b8; padding:8px 12px; text-align:${c.align || 'left'}; font-size:11pt;">${c.label}</th>`
            ).join('');

            let trsHtml = dados.map((row, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                const tds = colunas.map(c => {
                    const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '';
                    let align = c.align || (c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : 'left');
                    let msoFormat = '';
                    if (c.tipo === 'moeda') msoFormat = 'mso-number-format:"\\0022R$\\0022\\ #\\,##0\\.00";';
                    else if (c.tipo === 'numero') msoFormat = 'mso-number-format:"#,##0";';
                    else msoFormat = 'mso-number-format:"\\@";';

                    return `<td style="border:0.5pt solid #cbd5e1; padding:6px 10px; background-color:${bg}; text-align:${align}; ${msoFormat} font-size:10pt;">${val}</td>`;
                }).join('');
                return `<tr>${tds}</tr>`;
            }).join('');

            let resumoHtml = '';
            if (opts.totais) {
                resumoHtml = `<tr><td colspan="${colunas.length}" style="background-color:#e2e8f0; font-weight:bold; padding:8px 10px; border:0.5pt solid #94a3b8; font-size:10pt;">${opts.totais}</td></tr>`;
            }

            const excelHTML = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
                    <!--[if gte mso 9]>
                    <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>${(titulo || 'Planilha').substring(0, 30)}</x:Name>
                            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                        </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                    </xml>
                    <![endif]-->
                    <style>
                        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
                        table { border-collapse: collapse; width: 100%; }
                    </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <td colspan="${colunas.length}" style="font-size:15pt; font-weight:bold; color:#0f172a; padding:10px 0;">${emp.nome}</td>
                        </tr>
                        <tr>
                            <td colspan="${colunas.length}" style="font-size:12pt; font-weight:bold; color:#2563eb; padding-bottom:4px;">${titulo}</td>
                        </tr>
                        <tr>
                            <td colspan="${colunas.length}" style="font-size:9pt; color:#64748b; padding-bottom:12px;">Gerado em: ${dataHora} ${subtitulo ? ' • Filtro: ' + subtitulo : ''} • Total de registros: ${dados.length}</td>
                        </tr>
                        <tr></tr>
                        <thead><tr>${thsHtml}</tr></thead>
                        <tbody>${trsHtml}</tbody>
                        ${resumoHtml ? `<tfoot>${resumoHtml}</tfoot>` : ''}
                    </table>
                </body>
                </html>
            `;

            const blob = new Blob(['\uFEFF' + excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${nomeArquivo}_${Date.now()}.xls`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            if (typeof showToast === 'function') showToast('Planilha Excel gerada com sucesso!', 'success');
        } catch(err) {
            console.error('Erro ao exportar Excel:', err);
            if (typeof showToast === 'function') showToast('Erro ao exportar Excel.', 'error');
        }
    };

    // ----------------------------------------------------
    // 2. EXPORTADOR PARA WORD (.DOC)
    // ----------------------------------------------------
    window.exportarParaWord = function(opts) {
        try {
            opts = opts || {};
            const emp = obterDadosEmpresa();
            const titulo = opts.titulo || 'Relatório Gerencial';
            const subtitulo = opts.subtitulo || '';
            const nomeArquivo = (opts.nomeArquivo || 'Relatorio').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const dataHora = formatarDataHoraAtual();

            let colunas = opts.colunas || [];
            let dados = opts.dados || [];

            if ((!colunas.length || !dados.length) && opts.tabelaId) {
                const tabela = document.getElementById(opts.tabelaId);
                if (tabela) {
                    const extraido = extrairDadosDeTabelaDOM(tabela);
                    colunas = extraido.colunas;
                    dados = extraido.dados;
                }
            }

            let tabelaHtml = '';
            if (opts.htmlConteudo) {
                tabelaHtml = `<div style="margin-top:15pt; line-height:1.6;">${opts.htmlConteudo}</div>`;
            } else if (dados.length > 0) {
                let ths = colunas.map(c => 
                    `<th style="background-color:#1e293b; color:#ffffff; font-weight:bold; border:1pt solid #94a3b8; padding:6pt 8pt; text-align:${c.align || 'left'}; font-size:9.5pt;">${c.label}</th>`
                ).join('');

                let trs = dados.map((row, idx) => {
                    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const tds = colunas.map(c => {
                        const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '';
                        const align = c.align || (c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : 'left');
                        return `<td style="border:1pt solid #cbd5e1; padding:5pt 7pt; background-color:${bg}; text-align:${align}; font-size:9pt; vertical-align:middle;">${val}</td>`;
                    }).join('');
                    return `<tr>${tds}</tr>`;
                }).join('');

                let tfoot = '';
                if (opts.totais) {
                    tfoot = `<tfoot><tr><td colspan="${colunas.length}" style="background-color:#e2e8f0; font-weight:bold; padding:7pt 8pt; border:1pt solid #94a3b8; font-size:9.5pt;">${opts.totais}</td></tr></tfoot>`;
                }

                tabelaHtml = `
                    <table style="border-collapse:collapse; width:100%; margin-top:12pt; font-family:Calibri, Arial, sans-serif;">
                        <thead><tr>${ths}</tr></thead>
                        <tbody>${trs}</tbody>
                        ${tfoot}
                    </table>
                `;
            } else {
                if (typeof showToast === 'function') showToast('Nenhum dado encontrado para exportar.', 'warning');
                return;
            }

            const wordHTML = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <title>${titulo}</title>
                    <style>
                        @page { size: A4; margin: 20mm 15mm; }
                        body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.4; }
                        .doc-header { border-bottom: 2pt solid #2563eb; padding-bottom: 8pt; margin-bottom: 12pt; }
                        .company-name { font-size: 16pt; font-weight: bold; color: #0f172a; margin: 0; }
                        .company-sub { font-size: 9pt; color: #64748b; margin: 2pt 0 0 0; }
                        .doc-title { font-size: 15pt; font-weight: bold; color: #1e40af; margin-top: 10pt; margin-bottom: 3pt; }
                        .doc-meta { font-size: 9pt; color: #64748b; margin-bottom: 12pt; }
                        .doc-footer { margin-top: 25pt; border-top: 1pt solid #cbd5e1; padding-top: 8pt; font-size: 8pt; color: #94a3b8; text-align: center; }
                        .kpi-box { background-color: #f1f5f9; border-left: 3pt solid #2563eb; padding: 6pt 10pt; margin: 8pt 0; font-size: 9.5pt; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="doc-header">
                        <table style="border:none; margin:0; width:100%;">
                            <tr style="border:none;">
                                <td style="border:none; padding:0;">
                                    <p class="company-name">${emp.nome}</p>
                                    <p class="company-sub">${emp.cnpj ? 'CNPJ: ' + emp.cnpj + ' • ' : ''}${emp.telefone ? 'Tel: ' + emp.telefone : ''}</p>
                                </td>
                                <td style="border:none; padding:0; text-align:right; vertical-align:top;">
                                    <p style="font-size:9pt; font-weight:bold; color:#2563eb; margin:0;">FC GESTÃO</p>
                                    <p style="font-size:8pt; color:#64748b; margin:0;">${dataHora}</p>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="doc-title">${titulo}</div>
                    <div class="doc-meta">
                        <strong>Emissão:</strong> ${dataHora}
                        ${subtitulo ? ` • <strong>Filtro:</strong> ${subtitulo}` : ''}
                        ${dados.length ? ` • <strong>Total:</strong> ${dados.length} registros` : ''}
                    </div>

                    ${opts.totais ? `<div class="kpi-box">${opts.totais}</div>` : ''}

                    ${tabelaHtml}

                    <div class="doc-footer">
                        Documento gerado eletronicamente pelo Sistema FC Gestão em ${dataHora}. Confidencial e de uso interno.
                    </div>
                </body>
                </html>
            `;

            const blob = new Blob(['\uFEFF' + wordHTML], { type: 'application/msword;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${nomeArquivo}_${Date.now()}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            if (typeof showToast === 'function') showToast('Documento Word gerado com sucesso!', 'success');
        } catch(err) {
            console.error('Erro ao exportar Word:', err);
            if (typeof showToast === 'function') showToast('Erro ao exportar Word.', 'error');
        }
    };

    // ----------------------------------------------------
    // 3. EXPORTADOR PARA PDF / PREVIEW DE IMPRESSÃO PROFISSIONAL
    // ----------------------------------------------------
    window.exportarParaPDF = function(opts) {
        try {
            opts = opts || {};
            const emp = obterDadosEmpresa();
            const titulo = opts.titulo || 'Relatório Gerencial';
            const subtitulo = opts.subtitulo || '';
            const nomeArquivo = (opts.nomeArquivo || 'Relatorio').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const orientacao = opts.orientacao || 'portrait'; // portrait | landscape
            const dataHora = formatarDataHoraAtual();

            let colunas = opts.colunas || [];
            let dados = opts.dados || [];

            if ((!colunas.length || !dados.length) && opts.tabelaId) {
                const tabela = document.getElementById(opts.tabelaId);
                if (tabela) {
                    const extraido = extrairDadosDeTabelaDOM(tabela);
                    colunas = extraido.colunas;
                    dados = extraido.dados;
                }
            }

            let conteudoCorpo = '';
            if (opts.htmlConteudo) {
                conteudoCorpo = `<div class="p-6 bg-white rounded-xl shadow-sm border border-slate-200">${opts.htmlConteudo}</div>`;
            } else if (dados.length > 0) {
                let ths = colunas.map(c => {
                    const wStyle = c.width ? `width: ${c.width};` : '';
                    return `<th style="${wStyle}" class="p-2 bg-slate-900 text-white font-bold text-[10px] md:text-xs uppercase border border-slate-700 text-${c.align || 'left'}">${c.label}</th>`;
                }).join('');

                let trs = dados.map((row, idx) => {
                    const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const tds = colunas.map(c => {
                        const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '';
                        const align = c.align || (c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : 'left');
                        return `<td class="p-2 border border-slate-200 text-${align} text-xs text-slate-800">${val}</td>`;
                    }).join('');
                    return `<tr class="${bg}">${tds}</tr>`;
                }).join('');

                let tfoot = '';
                if (opts.totais) {
                    tfoot = `<tfoot class="bg-slate-100 font-bold border-t-2 border-slate-300"><tr><td colspan="${colunas.length}" class="p-2.5 text-xs text-slate-800">${opts.totais}</td></tr></tfoot>`;
                }

                conteudoCorpo = `
                    <div class="overflow-x-auto print:overflow-visible">
                        <table class="w-full border-collapse border border-slate-300" style="table-layout: fixed; width: 100%;">
                            <thead><tr>${ths}</tr></thead>
                            <tbody>${trs}</tbody>
                            ${tfoot}
                        </table>
                    </div>
                `;
            } else {
                if (typeof showToast === 'function') showToast('Nenhum dado encontrado para gerar PDF.', 'warning');
                return;
            }

            const win = window.open('', '_blank');
            if (!win) {
                if (typeof showToast === 'function') showToast('O navegador bloqueou a abertura do PDF. Permita pop-ups.', 'error');
                return;
            }

            win.document.open();
            win.document.write(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="utf-8">
                    <title>${titulo} - ${emp.nome}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                    <style>
                        @page {
                            margin: 8mm 10mm 10mm 10mm;
                            size: A4 ${orientacao};
                        }
                        *, *::before, *::after {
                            box-sizing: border-box !important;
                        }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            background-color: #f8fafc;
                            color: #0f172a;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            width: 100%;
                            margin: 0;
                            padding: 0;
                        }
                        @media print {
                            .no-print { display: none !important; }
                            html, body {
                                background-color: #ffffff !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                width: 100% !important;
                                max-width: 100% !important;
                            }
                            .print-container {
                                max-width: 100% !important;
                                width: 100% !important;
                                padding: 6mm 8mm !important;
                                margin: 0 auto !important;
                                box-shadow: none !important;
                                border: none !important;
                                box-sizing: border-box !important;
                            }
                            .overflow-x-auto {
                                overflow: visible !important;
                                display: block !important;
                            }
                            table {
                                page-break-inside: auto;
                                width: 100% !important;
                                max-width: 100% !important;
                                table-layout: fixed !important;
                                border-collapse: collapse !important;
                            }
                            th, td {
                                word-break: break-word !important;
                                overflow-wrap: break-word !important;
                            }
                            tr {
                                page-break-inside: avoid;
                                page-break-after: auto;
                            }
                            thead {
                                display: table-header-group;
                            }
                            tfoot {
                                display: table-footer-group;
                            }
                        }
                    </style>
                </head>
                <body class="p-4 md:p-8">
                    <!-- BARRA DE AÇÕES FLUTUANTE (NÃO SAI NA IMPRESSÃO) -->
                    <div class="no-print max-w-5xl mx-auto mb-6 bg-slate-900 text-white p-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between border border-slate-700">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-rose-600/30 text-rose-400 border border-rose-500/40 flex items-center justify-center font-bold">
                                <i class="fa-solid fa-file-pdf text-base"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-sm leading-tight">${titulo}</h3>
                                <p class="text-[11px] text-slate-400">${dados.length ? dados.length + ' registros' : 'Relatório formatado'} • Pronto para impressão</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.print()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer">
                                <i class="fa-solid fa-print"></i> Imprimir / Salvar PDF
                            </button>
                            <button onclick="window.close()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer">
                                Fechar
                            </button>
                        </div>
                    </div>

                    <!-- FOLHA DO RELATÓRIO A4 -->
                    <div class="print-container max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                        <!-- CABEÇALHO DA EMPRESA -->
                        <div class="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-4">
                            <div>
                                <h1 class="text-xl md:text-2xl font-black text-slate-900 tracking-tight">${emp.nome}</h1>
                                <p class="text-xs text-slate-500 mt-0.5">
                                    ${emp.cnpj ? 'CNPJ: ' + emp.cnpj + ' • ' : ''}
                                    ${emp.telefone ? 'Contato: ' + emp.telefone + ' • ' : ''}
                                    ${emp.cidade ? emp.cidade + '/' + emp.uf : ''}
                                </p>
                            </div>
                            <div class="text-right">
                                <span class="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">FC Gestão</span>
                                <p class="text-[11px] text-slate-500 mt-1 font-mono">${dataHora}</p>
                            </div>
                        </div>

                        <!-- TÍTULO E METADADOS DO RELATÓRIO -->
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div>
                                <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <i class="fa-solid fa-file-lines text-blue-600"></i> ${titulo}
                                </h2>
                                ${subtitulo ? `<p class="text-xs text-slate-500 mt-0.5">${subtitulo}</p>` : ''}
                            </div>
                            ${dados.length ? `<span class="text-xs font-bold bg-white text-slate-700 px-3 py-1 rounded-lg border border-slate-200 shadow-xs">${dados.length} itens listados</span>` : ''}
                        </div>

                        ${opts.totais ? `<div class="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">${opts.totais}</div>` : ''}

                        <!-- CONTEÚDO DO RELATÓRIO (TABELA OU TEXTO) -->
                        ${conteudoCorpo}

                        <!-- RODAPÉ DA FOLHA -->
                        <div class="mt-8 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                            <span>Documento gerado via FC Gestão Empresarial</span>
                            <span>Página 1 de 1</span>
                        </div>
                    </div>

                    <script>
                        // Auto-print após carregamento dos estilos
                        window.onload = function() {
                            setTimeout(() => {
                                window.focus();
                                window.print();
                            }, 800);
                        };
                    </script>
                </body>
                </html>
            `);
            win.document.close();

        } catch(err) {
            console.error('Erro ao gerar PDF:', err);
            if (typeof showToast === 'function') showToast('Erro ao gerar PDF.', 'error');
        }
    };

    // Helper para extrair dados limpos de qualquer elemento <table> DOM
    function extrairDadosDeTabelaDOM(tabela) {
        const colunas = [];
        const dados = [];
        if (!tabela) return { colunas, dados };

        const ths = tabela.querySelectorAll('thead th');
        const indicesValidos = [];

        ths.forEach((th, idx) => {
            // Ignora colunas de ações, botões, checkbox ou marcadas com .print:hidden/.no-export
            if (th.classList.contains('print:hidden') || th.classList.contains('no-export') || th.innerText.toLowerCase().includes('ação') || th.innerText.toLowerCase().includes('ações') || th.innerText.trim() === '') {
                return;
            }
            const key = 'col_' + idx;
            indicesValidos.push(idx);
            colunas.push({
                key: key,
                label: th.innerText.trim(),
                align: th.classList.contains('text-right') ? 'right' : (th.classList.contains('text-center') ? 'center' : 'left'),
                tipo: th.innerText.toLowerCase().includes('valor') || th.innerText.toLowerCase().includes('preço') || th.innerText.toLowerCase().includes('custo') || th.innerText.toLowerCase().includes('total') ? 'moeda' : 'texto'
            });
        });

        const trs = tabela.querySelectorAll('tbody tr');
        trs.forEach(tr => {
            if (tr.innerText.includes('Nenhum') || tr.innerText.includes('Carregando')) return;
            const tds = tr.querySelectorAll('td');
            if (!tds.length) return;
            const obj = {};
            let preenchido = false;

            indicesValidos.forEach((colIdx, i) => {
                if (tds[colIdx]) {
                    const texto = tds[colIdx].innerText.trim().replace(/\s+/g, ' ');
                    obj[colunas[i].key] = texto;
                    if (texto) preenchido = true;
                }
            });

            if (preenchido) dados.push(obj);
        });

        return { colunas, dados };
    }

    // ----------------------------------------------------
    // 4. DISPATCHER GERAL: window.puxarRelatorio(modulo, formato, opcoes)
    // ----------------------------------------------------
    window.puxarRelatorio = function(modulo, formato, opts) {
        opts = opts || {};
        formato = (formato || 'excel').toLowerCase(); // 'excel' | 'word' | 'pdf'
        modulo = (modulo || '').toLowerCase();

        let configExport = null;

        // 4.1 PRODUTOS E ESTOQUE
        if (modulo === 'produtos') {
            const lista = window.produtosFiltradosAtuais || (window.db && Array.isArray(window.db.produtos) ? window.db.produtos : []);
            let totalCusto = 0;
            let totalVenda = 0;
            let totalPecas = 0;

            const dados = lista.map(p => {
                const qtd = Number(p.estoque) || 0;
                const custo = Number(p.custo) || 0;
                const preco = Number(p.preco) || 0;
                totalPecas += qtd;
                totalCusto += (qtd * custo);
                totalVenda += (qtd * preco);

                const margem = custo > 0 ? (((preco - custo) / custo) * 100).toFixed(1) + '%' : '-';
                let status = 'Ativo';
                if (p.ativo === false) status = 'Inativo';
                else if (qtd <= 0) status = 'Estoque Zerado';
                else if (qtd <= Number(p.min || 0)) status = 'Alerta / Baixo';

                return {
                    codigo: p.codigo || p.ean || p.id || '-',
                    nome: p.nome || 'Sem Nome',
                    categoria: p.categoria || '-',
                    marca: p.marca || '-',
                    custo: formatarMoedaLocal(custo),
                    preco: formatarMoedaLocal(preco),
                    margem: margem,
                    estoque: `${qtd} ${p.unidade || 'UN'}`,
                    status: status
                };
            });

            configExport = {
                titulo: 'Relatório Geral de Produtos & Estoque',
                subtitulo: 'Catálogo de Produtos Cadastrados e Saldo em Almoxarifado',
                nomeArquivo: 'Relatorio_Produtos_Estoque',
                orientacao: 'landscape',
                colunas: [
                    { key: 'codigo', label: 'Cód/EAN', align: 'left', tipo: 'texto', width: '13%' },
                    { key: 'nome', label: 'Nome do Produto', align: 'left', tipo: 'texto', width: '23%' },
                    { key: 'categoria', label: 'Categoria', align: 'left', tipo: 'texto', width: '12%' },
                    { key: 'marca', label: 'Marca', align: 'left', tipo: 'texto', width: '10%' },
                    { key: 'custo', label: 'Custo', align: 'right', tipo: 'moeda', width: '9%' },
                    { key: 'preco', label: 'Preço Venda', align: 'right', tipo: 'moeda', width: '9%' },
                    { key: 'margem', label: 'Margem', align: 'center', tipo: 'texto', width: '8%' },
                    { key: 'estoque', label: 'Estoque', align: 'right', tipo: 'numero', width: '8%' },
                    { key: 'status', label: 'Situação', align: 'center', tipo: 'texto', width: '8%' }
                ],
                dados: dados,
                totais: `Total de Itens: ${dados.length} • Saldo Total de Peças: ${totalPecas} un • Patrimônio em Estoque: Custo: ${formatarMoedaLocal(totalCusto)} | Venda Estimada: ${formatarMoedaLocal(totalVenda)}`
            };
        }

        // 4.2 CLIENTES
        else if (modulo === 'clientes') {
            const lista = window.clientesFiltradosAtuais || (window.db && Array.isArray(window.db.clientes) ? window.db.clientes : []);
            const dados = lista.map(c => {
                const end = [c.rua || c.endereco || '', c.numero ? 'nº ' + c.numero : '', c.bairro || ''].filter(Boolean).join(', ');
                const cidUf = [c.cidade || '', c.uf || ''].filter(Boolean).join(' - ');
                return {
                    nome: c.nome || 'Sem Nome',
                    doc: c.doc || c.cpf || c.cnpj || '-',
                    contato: c.wpp || c.whatsapp || c.telefone || '-',
                    email: c.email || '-',
                    cidade_uf: cidUf || '-',
                    endereco: end || '-',
                    limite: c.limite_credito ? formatarMoedaLocal(c.limite_credito) : '-'
                };
            });

            configExport = {
                titulo: 'Relatório Cadastral de Clientes',
                subtitulo: 'Relação de Clientes, Contatos e Endereços',
                nomeArquivo: 'Relatorio_Clientes',
                orientacao: 'landscape',
                colunas: [
                    { key: 'nome', label: 'Nome / Razão Social', align: 'left', tipo: 'texto', width: '22%' },
                    { key: 'doc', label: 'CPF / CNPJ', align: 'left', tipo: 'texto', width: '14%' },
                    { key: 'contato', label: 'WhatsApp / Telefone', align: 'left', tipo: 'texto', width: '14%' },
                    { key: 'email', label: 'E-mail', align: 'left', tipo: 'texto', width: '16%' },
                    { key: 'cidade_uf', label: 'Cidade / UF', align: 'left', tipo: 'texto', width: '12%' },
                    { key: 'endereco', label: 'Endereço', align: 'left', tipo: 'texto', width: '12%' },
                    { key: 'limite', label: 'Limite de Crédito', align: 'right', tipo: 'moeda', width: '10%' }
                ],
                dados: dados,
                totais: `Total de Clientes Cadastrados: ${dados.length}`
            };
        }

        // 4.3 FUNCIONÁRIOS / COLABORADORES
        else if (modulo === 'funcionarios') {
            const lista = window.funcionariosFiltradosAtuais || (window.db && Array.isArray(window.db.funcionarios) ? window.db.funcionarios : []);
            const dados = lista.map(f => {
                let perm = 'Padrão';
                if (f.isAdmin) perm = 'Acesso Total (Admin)';
                else if (f.perm_vendas_op) perm = 'Operador de Vendas';

                return {
                    nome: f.nome || 'Sem Nome',
                    cargo: f.cargo || 'Colaborador',
                    doc: f.doc || f.cpf || '-',
                    contato: f.wpp || f.telefone || '-',
                    email: f.email || '-',
                    pix: f.chave_pix || f.pix || '-',
                    salario: f.salario_base ? formatarMoedaLocal(f.salario_base) : (f.salario ? formatarMoedaLocal(f.salario) : '-'),
                    permissoes: perm
                };
            });

            configExport = {
                titulo: 'Quadro de Colaboradores & Funcionários',
                subtitulo: 'Lista de Funcionários, Cargos e Informações de Acesso',
                nomeArquivo: 'Relatorio_Funcionarios',
                orientacao: 'landscape',
                colunas: [
                    { key: 'nome', label: 'Nome do Colaborador', align: 'left', tipo: 'texto' },
                    { key: 'cargo', label: 'Cargo / Função', align: 'left', tipo: 'texto' },
                    { key: 'doc', label: 'CPF / Doc', align: 'left', tipo: 'texto' },
                    { key: 'contato', label: 'WhatsApp / Telefone', align: 'left', tipo: 'texto' },
                    { key: 'email', label: 'E-mail de Login', align: 'left', tipo: 'texto' },
                    { key: 'pix', label: 'Chave PIX', align: 'left', tipo: 'texto' },
                    { key: 'salario', label: 'Salário Base', align: 'right', tipo: 'moeda' },
                    { key: 'permissoes', label: 'Nível de Permissão', align: 'center', tipo: 'texto' }
                ],
                dados: dados,
                totais: `Total de Colaboradores: ${dados.length}`
            };
        }

        // 4.4 FORNECEDORES
        else if (modulo === 'fornecedores') {
            const lista = window.fornecedoresFiltradosAtuais || (window.db && Array.isArray(window.db.fornecedores) ? window.db.fornecedores : []);
            const dados = lista.map(f => {
                const cidUf = [f.cidade || '', f.uf || ''].filter(Boolean).join(' - ');
                return {
                    nome: f.nome || f.razao_social || 'Sem Razão Social',
                    fantasia: f.fantasia || f.nome_fantasia || '-',
                    doc: f.doc || f.cnpj || '-',
                    ie: f.ie || '-',
                    contato: f.contato || f.responsavel || '-',
                    telefone: f.wpp || f.telefone || '-',
                    email: f.email || '-',
                    cidade_uf: cidUf || '-'
                };
            });

            configExport = {
                titulo: 'Relatório Geral de Fornecedores',
                subtitulo: 'Catálogo de Parceiros e Fornecedores Homologados',
                nomeArquivo: 'Relatorio_Fornecedores',
                orientacao: 'landscape',
                colunas: [
                    { key: 'nome', label: 'Razão Social', align: 'left', tipo: 'texto' },
                    { key: 'fantasia', label: 'Nome Fantasia', align: 'left', tipo: 'texto' },
                    { key: 'doc', label: 'CNPJ', align: 'left', tipo: 'texto' },
                    { key: 'ie', label: 'Inscr. Estadual', align: 'left', tipo: 'texto' },
                    { key: 'contato', label: 'Pessoa Contato', align: 'left', tipo: 'texto' },
                    { key: 'telefone', label: 'WhatsApp / Telefone', align: 'left', tipo: 'texto' },
                    { key: 'email', label: 'E-mail Comercial', align: 'left', tipo: 'texto' },
                    { key: 'cidade_uf', label: 'Cidade / UF', align: 'left', tipo: 'texto' }
                ],
                dados: dados,
                totais: `Total de Fornecedores Cadastrados: ${dados.length}`
            };
        }

        // 4.5 COMPRAS
        else if (modulo === 'compras') {
            const lista = window.comprasFiltradasAtuais || (window.db && Array.isArray(window.db.compras) ? window.db.compras : []);
            let totalGasto = 0;

            const dados = lista.map(c => {
                const total = Number(c.totalNF) || 0;
                totalGasto += total;

                const dataEntrada = c.data ? (c.data.includes('T') ? c.data.split('T')[0].split('-').reverse().join('/') : c.data) : '-';
                const dataEmissao = c.dataEmissao ? (c.dataEmissao.includes('T') ? c.dataEmissao.split('T')[0].split('-').reverse().join('/') : c.dataEmissao) : '-';
                const tipo = c.numeroNF === 'S/N' || !c.numeroNF ? 'Manual' : 'XML NF-e';

                return {
                    data_entrada: dataEntrada,
                    data_emissao: dataEmissao,
                    fornecedor: c.fornecedor || 'Não Informado',
                    numero_nf: c.numeroNF || 'S/N',
                    tipo: tipo,
                    valor: formatarMoedaLocal(total)
                };
            });

            configExport = {
                titulo: 'Relatório de Compras & Entradas de Mercadoria',
                subtitulo: 'Histórico de Aquisições e Notas Fiscais Recebidas',
                nomeArquivo: 'Relatorio_Compras',
                orientacao: 'portrait',
                colunas: [
                    { key: 'data_entrada', label: 'Data Entrada', align: 'center', tipo: 'texto', width: '13%' },
                    { key: 'data_emissao', label: 'Data Emissão', align: 'center', tipo: 'texto', width: '13%' },
                    { key: 'fornecedor', label: 'Fornecedor', align: 'left', tipo: 'texto', width: '34%' },
                    { key: 'numero_nf', label: 'NF / Ref', align: 'center', tipo: 'texto', width: '13%' },
                    { key: 'tipo', label: 'Origem', align: 'center', tipo: 'texto', width: '13%' },
                    { key: 'valor', label: 'Valor Total', align: 'right', tipo: 'moeda', width: '14%' }
                ],
                dados: dados,
                totais: `Total de Compras: ${dados.length} • Montante Gasto: ${formatarMoedaLocal(totalGasto)}`
            };
        }

        // 4.6 VENDAS
        else if (modulo === 'vendas') {
            const lista = window.vendasFiltradasAtuais || (window.db && Array.isArray(window.db.vendas) ? window.db.vendas : []);
            let totalFaturado = 0;

            const dados = lista.map(v => {
                const total = Number(v.tot !== undefined ? v.tot : (v.total_liquido !== undefined ? v.total_liquido : (v.total || v.valor || 0))) || 0;
                totalFaturado += total;

                let dataFmt = '-';
                if (v.data) {
                    dataFmt = typeof formatData === 'function' ? formatData(v.data).replace(',', '') : v.data.replace('T', ' ').substring(0, 16);
                }

                let itensResumo = '-';
                if (Array.isArray(v.itens) && v.itens.length > 0) {
                    itensResumo = v.itens.map(i => `${i.qtd || 1}x ${i.nome || i.produto || ''}`).join(', ');
                } else if (v.descricao) {
                    itensResumo = v.descricao;
                }

                const pedStr = v.numeroPedido ? '#' + String(v.numeroPedido).padStart(4, '0') : (v.id ? String(v.id).substring(0, 10).toUpperCase() : '-');

                return {
                    data: dataFmt,
                    pedido: pedStr,
                    cliente: v.clienteNome || v.cliente_nome || v.cliente || 'Consumidor Final',
                    pagamento: v.pag || v.forma_pagamento || v.formaPagamento || v.pagamento || 'Diversos',
                    itens: itensResumo,
                    total: formatarMoedaLocal(total)
                };
            });

            configExport = {
                titulo: 'Relatório Gerencial de Vendas e Operações',
                subtitulo: 'Histórico Completo de Pedidos, Clientes e Recebimentos',
                nomeArquivo: 'Relatorio_Vendas_Operacoes',
                orientacao: 'landscape',
                colunas: [
                    { key: 'data', label: 'Data/Hora', align: 'center', tipo: 'texto', width: '13%' },
                    { key: 'pedido', label: 'Pedido / ID', align: 'center', tipo: 'texto', width: '10%' },
                    { key: 'cliente', label: 'Cliente', align: 'left', tipo: 'texto', width: '20%' },
                    { key: 'pagamento', label: 'Forma Pagamento', align: 'left', tipo: 'texto', width: '14%' },
                    { key: 'itens', label: 'Itens da Venda', align: 'left', tipo: 'texto', width: '31%' },
                    { key: 'total', label: 'Valor Líquido', align: 'right', tipo: 'moeda', width: '12%' }
                ],
                dados: dados,
                totais: `Total de Vendas: ${dados.length} • Faturamento Total: ${formatarMoedaLocal(totalFaturado)}`
            };
        }

        // 4.7 MARKETING (LEMBRETES WHATSAPP)
        else if (modulo === 'marketing' || modulo === 'lembretes') {
            const clientesBase = window.todosClientes || (window.db && Array.isArray(window.db.clientes) ? window.db.clientes : []);
            const lista = window.lembretesFiltradosAtuais || clientesBase.filter(c => c.lembrete_wpp === true);

            const dados = lista.map(c => {
                let status = 'Pendente';
                if (typeof formatarDataHoje === 'function' && c.lembrete_last_sent === formatarDataHoje()) {
                    status = 'Enviado Hoje';
                }
                return {
                    cliente: c.nome || 'Sem Nome',
                    whatsapp: c.wpp ? (typeof formatarCelular === 'function' ? formatarCelular(c.wpp) : c.wpp) : 'Sem número',
                    mensagem: c.lembrete_msg || 'Mensagem Padrão',
                    status: status
                };
            });

            configExport = {
                titulo: 'Relatório de Marketing & Lembretes de WhatsApp',
                subtitulo: 'Lista de Clientes com Automação de Lembretes Recorrentes',
                nomeArquivo: 'Relatorio_Marketing_Lembretes',
                orientacao: 'portrait',
                colunas: [
                    { key: 'cliente', label: 'Nome do Cliente', align: 'left', tipo: 'texto', width: '25%' },
                    { key: 'whatsapp', label: 'WhatsApp', align: 'left', tipo: 'texto', width: '18%' },
                    { key: 'mensagem', label: 'Mensagem Configurada', align: 'left', tipo: 'texto', width: '42%' },
                    { key: 'status', label: 'Status Envio', align: 'center', tipo: 'texto', width: '15%' }
                ],
                dados: dados,
                totais: `Total de Lembretes Configurados: ${dados.length}`
            };
        }

        // 4.8 EXPORTAÇÃO DIRETA POR ID DE TABELA DOM
        else if (modulo.startsWith('tabela-') || document.getElementById(modulo)) {
            const tabId = modulo.startsWith('tabela-') ? modulo : modulo;
            configExport = {
                titulo: opts.titulo || 'Relatório Gerencial',
                subtitulo: opts.subtitulo || '',
                nomeArquivo: opts.nomeArquivo || 'Exportacao_Tabela',
                tabelaId: tabId
            };
        }

        // Se não conseguiu montar configuração, tenta fallback pela tabela da página
        if (!configExport) {
            console.warn('Módulo de exportação não identificado:', modulo);
            if (typeof showToast === 'function') showToast('Módulo não identificado para exportação.', 'warning');
            return;
        }

        // Aplica o formato solicitado
        if (formato === 'word' || formato === 'doc') {
            window.exportarParaWord(configExport);
        } else if (formato === 'pdf') {
            window.exportarParaPDF(configExport);
        } else {
            window.exportarParaExcel(configExport);
        }
    };

    // Helper específico para exportar o texto gerado pela IA no Marketing
    window.exportarMarketingIAConsultoria = function(formato) {
        formato = (formato || 'word').toLowerCase();
        const container = document.getElementById('ia-resultado-container');
        if (!container || !container.innerText.trim() || container.innerText.includes('Preencha os dados')) {
            if (typeof showToast === 'function') showToast('Gere primeiro uma consultoria de IA antes de exportar.', 'warning');
            return;
        }

        const nicho = document.getElementById('ia-nicho')?.value || '';
        const objetivo = document.getElementById('ia-objetivo')?.value || '';
        const html = container.innerHTML;

        const config = {
            titulo: 'Consultoria de Marketing Digital - Ideias & Copywriting',
            subtitulo: (nicho ? `Nicho: ${nicho}` : '') + (objetivo ? ` • Objetivo: ${objetivo}` : ''),
            nomeArquivo: 'Marketing_IA_' + (nicho ? nicho.replace(/\s+/g, '_') : 'Consultoria'),
            htmlConteudo: html
        };

        if (formato === 'pdf') {
            window.exportarParaPDF(config);
        } else if (formato === 'excel') {
            window.exportarParaExcel({
                titulo: config.titulo,
                subtitulo: config.subtitulo,
                nomeArquivo: config.nomeArquivo,
                colunas: [{ key: 'conteudo', label: 'Consultoria e Estratégia de Conteúdo' }],
                dados: [{ conteudo: container.innerText }]
            });
        } else {
            window.exportarParaWord(config);
        }
    };

})();

// ==========================================
// PREFETCH INTELIGENTE DE PÁGINAS (Zero-Delay Navigation)
// Ao passar o mouse ou focar em um link interno do sistema,
// o navegador pré-carrega o HTML no cache HTTP, tornando a navegação instantânea.
// ==========================================
(function _iniciarPrefetchDePaginas() {
    // Se o sistema estiver rodando localmente via file:// (sem servidor HTTP), o prefetch de link não é suportado pelo navegador
    if (window.location.protocol === 'file:' || !window.location.protocol.startsWith('http')) return;

    const urlsPrefetched = new Set();

    function prefetchUrl(url) {
        if (!url || urlsPrefetched.has(url)) return;
        try {
            const parsed = new URL(url, window.location.href);
            if (parsed.origin !== window.location.origin) return;
            if (!parsed.pathname.endsWith('.html')) return;
            if (parsed.pathname === window.location.pathname) return;

            urlsPrefetched.add(url);
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = parsed.pathname;
            link.as = 'document';
            document.head.appendChild(link);
        } catch(e) {}
    }

    function onLinkHover(e) {
        const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (a && a.href) {
            prefetchUrl(a.href);
        }
    }

    document.addEventListener('mouseover', onLinkHover, { passive: true });
    document.addEventListener('touchstart', onLinkHover, { passive: true });
})();


