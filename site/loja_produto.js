let lojaConfig = {};
let produtoUrlId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Pegar o ID da URL e a Loja Ativa
    const urlParams = new URLSearchParams(window.location.search);
    produtoUrlId = urlParams.get('id');
    const empresaAtivaSite = urlParams.get('loja') || urlParams.get('empresa') || 'emp_fc_moveis';
    window.empresaAtivaSite = empresaAtivaSite;

    // Atualiza links de voltar para manter a loja ativa
    document.querySelectorAll('a[href="index.html"], a[href="./index.html"]').forEach(link => {
        if (empresaAtivaSite !== 'emp_fc_moveis') {
            link.href = `index.html?loja=${encodeURIComponent(empresaAtivaSite)}`;
        }
    });

    if (!produtoUrlId) {
        mostrarNaoEncontrado();
        return;
    }

    initProduto();
    atualizarIconesTema();
});

// ==========================================
// TEMA DARK / LIGHT DO SITE (produto.html)
// Reutiliza _aplicarTemaNoDOM se disponível,
// ou aplica inline styles diretamente.
// ==========================================
function toggleTemaSite() {
    const html = document.documentElement;
    const temaAtual = html.getAttribute('data-theme') || 'dark';
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', novoTema);
    if (novoTema === 'dark') { html.classList.add('dark'); }
    else { html.classList.remove('dark'); }
    localStorage.setItem('fc_theme_site', novoTema);
    // Inline styles para garantir que funcione independente do Tailwind/OS
    const bg = novoTema === 'dark' ? '#0f172a' : '#f8fafc';
    const fg = novoTema === 'dark' ? '#f1f5f9' : '#1e293b';
    html.style.backgroundColor = bg;
    html.style.color = fg;
    document.body.style.backgroundColor = bg;
    document.body.style.color = fg;
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.backgroundColor = novoTema === 'dark' ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)';
    }
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => el.style.color = fg);
    atualizarIconesTema(novoTema === 'dark');
}
window.toggleTemaSite = toggleTemaSite;

function atualizarIconesTema(isDark) {
    if (isDark === undefined) {
        isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    }
    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
        icon.className = isDark
            ? 'fa-solid fa-sun theme-toggle-icon text-amber-400 text-lg'
            : 'fa-solid fa-moon theme-toggle-icon text-slate-600 text-lg';
    });
}
window.atualizarIconesTema = atualizarIconesTema;

// Aplica tema ao iniciar
(function() {
    const tema = localStorage.getItem('fc_theme_site') || 'dark';
    const html = document.documentElement;
    html.setAttribute('data-theme', tema);
    if (tema === 'light') { html.classList.remove('dark'); }
    else { html.classList.add('dark'); }
    const bg = tema === 'dark' ? '#0f172a' : '#f8fafc';
    const fg = tema === 'dark' ? '#f1f5f9' : '#1e293b';
    html.style.backgroundColor = bg;
    html.style.color = fg;
    document.body && (document.body.style.backgroundColor = bg);
    document.body && (document.body.style.color = fg);
})();


// Suporte a cache IndexedDB para abertura instantânea do produto
const DB_CATALOGO_NAME = 'FC_Catalogo_DB';
const DB_CATALOGO_STORE = 'catalogo';

function abrirBancoCatalogo() {
    return new Promise((resolve) => {
        if (!('indexedDB' in window)) return resolve(null);
        try {
            const req = indexedDB.open(DB_CATALOGO_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(DB_CATALOGO_STORE)) {
                    db.createObjectStore(DB_CATALOGO_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function obterCacheCatalogo(chave) {
    try {
        const db = await abrirBancoCatalogo();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(DB_CATALOGO_STORE, 'readonly');
            const store = tx.objectStore(DB_CATALOGO_STORE);
            const req = store.get(chave);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

async function initProduto() {
    // Timeout de segurança: NUNCA deixa a tela travada no loader por mais de 3.5 segundos
    const timeoutSeguranca = setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('opacity-0', 'pointer-events-none');
    }, 3500);

    try {
        const empresaAtiva = window.empresaAtivaSite || 'emp_fc_moveis';

        // 1. Abertura Instantânea com Cache Local se disponível
        const [cacheConfig, cacheProdutos] = await Promise.all([
            obterCacheCatalogo('config_' + empresaAtiva),
            obterCacheCatalogo('produtos_' + empresaAtiva)
        ]);

        if (cacheConfig && cacheConfig.loja) {
            lojaConfig = cacheConfig.loja || {};
            aplicarConfiguracoesLoja(cacheConfig.empresa || {});
        }

        if (cacheProdutos && Array.isArray(cacheProdutos.produtos)) {
            const prodCache = cacheProdutos.produtos.find(x => x.id === produtoUrlId);
            if (prodCache) {
                renderizarProduto(prodCache);
                clearTimeout(timeoutSeguranca);
            }
        }

        // 2. Carrega Configuração Pública da Vitrine
        const configPublicaPromise = carregarConfigPublicaLoja(empresaAtiva).then(conf => {
            if (conf) {
                lojaConfig = conf.loja || {};
                aplicarConfiguracoesLoja(conf.empresa || {});
            }
        });

        // 3. Carrega o Documento Completo do Produto (com galeria fotos)
        const prodDoc = await firebase.firestore()
            .collection('empresas').doc(empresaAtiva)
            .collection('produtos').doc(produtoUrlId)
            .get();
        
        await configPublicaPromise;
        clearTimeout(timeoutSeguranca);

        if (!prodDoc || !prodDoc.exists) {
            mostrarNaoEncontrado();
            return;
        }

        const produto = prodDoc.data();
        produto.id = prodDoc.id;

        // Verifica se é pra exibir
        if (produto.ativo === false || produto.exibirLoja === false) {
            mostrarNaoEncontrado();
            return;
        }

        renderizarProduto(produto);

    } catch (error) {
        console.error("Erro ao carregar produto:", error);
        clearTimeout(timeoutSeguranca);
        mostrarNaoEncontrado();
    }
}

function formatarUrlSocial(valor, rede) {
    if (!valor) return '';
    let url = String(valor).trim();
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    url = url.replace(/^@/, '');
    if (rede === 'facebook') {
        if (url.startsWith('facebook.com/') || url.startsWith('www.facebook.com/')) {
            return 'https://' + url;
        }
        return `https://facebook.com/${url}`;
    }
    if (rede === 'instagram') {
        if (url.startsWith('instagram.com/') || url.startsWith('www.instagram.com/')) {
            return 'https://' + url;
        }
        return `https://instagram.com/${url}`;
    }
    return url;
}

function formatarNumeroWhatsApp(num) {
    if (!num) return '5562981111011';
    let limpo = String(num).replace(/\D/g, '');
    if (!limpo) return '5562981111011';
    if (limpo.length === 10 || limpo.length === 11) {
        return '55' + limpo;
    }
    return limpo;
}
window.formatarNumeroWhatsApp = formatarNumeroWhatsApp;

function gerarUrlWhatsApp(numero, mensagem) {
    const numLimpo = formatarNumeroWhatsApp(numero || (lojaConfig && lojaConfig.whatsapp) || '62981111011');
    const msg = encodeURIComponent(mensagem || (lojaConfig && lojaConfig['whatsapp-msg']) || 'Olá! Vim pelo site da FC Móveis e gostaria de mais informações.');
    return `https://wa.me/${numLimpo}?text=${msg}`;
}
window.gerarUrlWhatsApp = gerarUrlWhatsApp;

function abrirWhatsAppLoja(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const wpp = (lojaConfig && lojaConfig.whatsapp) || (window.empresaConfigAtiva && window.empresaConfigAtiva.telefone) || '62981111011';
    const msg = (lojaConfig && lojaConfig['whatsapp-msg']) || 'Olá! Vim pelo site da FC Móveis e gostaria de mais informações.';
    const url = gerarUrlWhatsApp(wpp, msg);
    window.open(url, '_blank', 'noopener,noreferrer');
}
window.abrirWhatsAppLoja = abrirWhatsAppLoja;

function aplicarConfiguracoesLoja(empresaConfig = {}) {
    window.lojaConfig = lojaConfig;
    window.empresaConfigAtiva = empresaConfig;
    const cor = lojaConfig['cor-primaria-hex'] || lojaConfig['cor-primaria'] || '#2563eb';
    document.documentElement.style.setProperty('--brand-color', cor);
    
    const adjustColorHex = (color, amount) => {
        return '#' + color.replace(/^#/, '').replace(/../g, c => ('0'+Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).substr(-2));
    };
    
    document.documentElement.style.setProperty('--brand-color-dark', adjustColorHex(cor, -20));
    document.documentElement.style.setProperty('--brand-color-light', adjustColorHex(cor, 90));
    
    if (empresaConfig.logo) {
        const logo = document.getElementById('nav-logo');
        if (logo) {
            logo.src = empresaConfig.logo;
            logo.classList.remove('hidden');
        }
    }
    
    if (lojaConfig.nome) {
        const titles = [document.getElementById('nav-title'), document.getElementById('footer-title')];
        titles.forEach(t => { if(t) t.innerText = lojaConfig.nome; });
        document.title = lojaConfig.nome + ' | Detalhes do Produto';
    }
    
    if (lojaConfig.slogan) {
        const slogan = document.getElementById('footer-slogan');
        if (slogan) slogan.innerText = lojaConfig.slogan;
    }

    const footCop = document.getElementById('footer-copyright');
    if (footCop) {
        footCop.innerText = `© ${new Date().getFullYear()} ${lojaConfig.nome || 'Nossa Loja'}. Todos os direitos reservados.`;
    }

    // WhatsApp Navbar e Footer
    const wpp = lojaConfig.whatsapp || empresaConfig.telefone || '62981111011';
    const msgPadrao = lojaConfig['whatsapp-msg'] || 'Olá! Vim pelo site da FC Móveis e gostaria de mais informações.';
    const linkWpp = gerarUrlWhatsApp(wpp, msgPadrao);

    const navWpp = document.getElementById('nav-whatsapp');
    if (navWpp) {
        navWpp.href = linkWpp;
        navWpp.setAttribute('target', '_blank');
        navWpp.setAttribute('rel', 'noopener noreferrer');
        navWpp.onclick = (e) => abrirWhatsAppLoja(e);
    }

    const socialContainer = document.getElementById('social-links');
    if (socialContainer) {
        socialContainer.innerHTML = '';
        if (lojaConfig.instagram) {
            const instaUrl = formatarUrlSocial(lojaConfig.instagram, 'instagram');
            socialContainer.innerHTML += `<a href="${instaUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gray-800 dark:bg-slate-800 flex items-center justify-center text-gray-400 hover:bg-brand hover:text-white transition-colors" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`;
        }
        if (lojaConfig.facebook) {
            const fbUrl = formatarUrlSocial(lojaConfig.facebook, 'facebook');
            socialContainer.innerHTML += `<a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gray-800 dark:bg-slate-800 flex items-center justify-center text-gray-400 hover:bg-brand hover:text-white transition-colors" title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>`;
        }
        if (wpp) {
            socialContainer.innerHTML += `<a href="${linkWpp}" target="_blank" rel="noopener noreferrer" onclick="abrirWhatsAppLoja(event)" class="w-10 h-10 rounded-full bg-gray-800 dark:bg-slate-800 flex items-center justify-center text-gray-400 hover:bg-[#25D366] hover:text-white transition-colors cursor-pointer" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
        }
    }
}

function mostrarNaoEncontrado() {
    document.getElementById('loader').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('produto-not-found').classList.remove('hidden');
    document.getElementById('produto-detalhes').classList.add('hidden');
}

let fotosProduto = [];
let fotoAtualIndex = 0;

function renderizarProduto(p) {
    // Esconde loader
    setTimeout(() => {
        document.getElementById('loader').classList.add('opacity-0', 'pointer-events-none');
    }, 500);

    // Mostra Detalhes
    document.getElementById('produto-detalhes').classList.remove('hidden');

    const catStr = p.categoria || 'Geral';
    const subStr = p.subcategoria && p.subcategoria.trim() !== '' ? p.subcategoria.trim() : '';

    // Breadcrumb
    document.getElementById('bread-categoria').innerText = catStr;
    const breadSubItem = document.getElementById('bread-subcategoria-item');
    const breadSubText = document.getElementById('bread-subcategoria');
    if (subStr && breadSubItem && breadSubText) {
        breadSubText.innerText = subStr;
        breadSubItem.classList.remove('hidden');
    } else if (breadSubItem) {
        breadSubItem.classList.add('hidden');
    }
    document.getElementById('bread-nome').innerText = p.nome;

    // Categoria e Subcategoria Tags
    document.getElementById('prod-categoria').innerText = catStr;
    const tagSub = document.getElementById('prod-subcategoria-tag');
    if (tagSub) {
        if (subStr) {
            tagSub.innerText = subStr;
            tagSub.classList.remove('hidden');
        } else {
            tagSub.classList.add('hidden');
        }
    }

    document.getElementById('prod-nome').innerText = p.nome;


    if (p.legenda) {
        const leg = document.getElementById('prod-legenda');
        leg.innerText = p.legenda;
        leg.classList.remove('hidden');
    }

    // Configura Lista de Fotos
    if (p.fotos && Array.isArray(p.fotos) && p.fotos.length > 0) {
        fotosProduto = p.fotos.filter(f => !!f);
    } else if (p.foto) {
        fotosProduto = [p.foto];
    } else {
        fotosProduto = ['data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg=='];
    }

    fotoAtualIndex = 0;
    atualizarFotoPrincipal();
    renderizarThumbnails();

    if (p.destaque) {
        document.getElementById('prod-badge-destaque').classList.remove('hidden');
    }

    const temEstoque = p.estoque > 0 || !p.hasOwnProperty('estoque');
    const btn = document.getElementById('btn-comprar');
    const badgeSobEncomenda = document.getElementById('badge-sob-encomenda');
    const txtSemEstoque = document.getElementById('txt-sem-estoque');
    const imgPrincipal = document.getElementById('prod-foto');
    
    if (imgPrincipal) {
        imgPrincipal.classList.remove('grayscale');
    }
    
    if (temEstoque) {
        if (badgeSobEncomenda) badgeSobEncomenda.classList.add('hidden');
        if (txtSemEstoque) txtSemEstoque.classList.add('hidden');
        
        btn.className = 'w-full bg-brand hover:bg-brand-dark text-white text-lg font-bold py-4 px-6 rounded-2xl text-center transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-brand/30 transform hover:-translate-y-1 active:scale-[0.98]';
        btn.innerHTML = '<i class="fa-solid fa-cart-plus text-2xl"></i> Adicionar ao Carrinho';
        btn.onclick = () => {
            adicionarAoCarrinho(p, 1);
        };
    } else {
        if (badgeSobEncomenda) badgeSobEncomenda.classList.remove('hidden');
        if (txtSemEstoque) txtSemEstoque.classList.add('hidden');
        
        btn.className = 'w-full bg-amber-600 hover:bg-amber-700 text-white text-lg font-bold py-4 px-6 rounded-2xl text-center transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-amber-600/30 transform hover:-translate-y-1 active:scale-[0.98]';
        btn.innerHTML = '<i class="fa-solid fa-clock text-2xl"></i> Encomendar no Carrinho';
        btn.onclick = () => {
            adicionarAoCarrinho(p, 1);
        };
    }
}

function atualizarFotoPrincipal() {
    const imgEl = document.getElementById('prod-foto');
    if (!imgEl) return;
    
    const fotoSrc = fotosProduto[fotoAtualIndex] || '';
    imgEl.src = fotoSrc;

    // Setas de navegação
    const btnPrev = document.getElementById('btn-foto-prev');
    const btnNext = document.getElementById('btn-foto-next');
    
    if (fotosProduto.length > 1) {
        if (btnPrev) { btnPrev.classList.remove('hidden'); btnPrev.classList.add('flex'); }
        if (btnNext) { btnNext.classList.remove('hidden'); btnNext.classList.add('flex'); }
    } else {
        if (btnPrev) btnPrev.classList.add('hidden');
        if (btnNext) btnNext.classList.add('hidden');
    }
}

function renderizarThumbnails() {
    const container = document.getElementById('prod-galeria-thumbs');
    if (!container) return;

    if (fotosProduto.length <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = fotosProduto.map((foto, idx) => {
        const isAtiva = idx === fotoAtualIndex;
        return `
        <button type="button" onclick="selecionarFotoGaleria(${idx})" class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all p-0.5 bg-white dark:bg-slate-800 ${isAtiva ? 'border-brand ring-2 ring-brand/40 scale-105 shadow-md' : 'border-gray-200 dark:border-slate-700 opacity-60 hover:opacity-100 hover:border-gray-400 dark:hover:border-slate-500'}">
            <img src="${foto}" alt="Foto ${idx + 1}" class="w-full h-full object-cover rounded-lg">
        </button>`;
    }).join('');
}

function selecionarFotoGaleria(index) {
    if (index >= 0 && index < fotosProduto.length) {
        fotoAtualIndex = index;
        atualizarFotoPrincipal();
        renderizarThumbnails();
    }
}

function mudarFotoGaleria(direcao) {
    if (fotosProduto.length <= 1) return;
    fotoAtualIndex = (fotoAtualIndex + direcao + fotosProduto.length) % fotosProduto.length;
    atualizarFotoPrincipal();
    renderizarThumbnails();
}

function abrirModalZoomSite(src) {
    const modal = document.getElementById('modal-zoom-site');
    const img = document.getElementById('modal-zoom-img');
    if (!modal || !img) return;
    img.src = src || (fotosProduto[fotoAtualIndex] || '');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalZoomSite() {
    const modal = document.getElementById('modal-zoom-site');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.selecionarFotoGaleria = selecionarFotoGaleria;
window.mudarFotoGaleria = mudarFotoGaleria;
window.abrirModalZoomSite = abrirModalZoomSite;
window.fecharModalZoomSite = fecharModalZoomSite;
