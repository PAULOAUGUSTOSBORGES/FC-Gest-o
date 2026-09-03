document.addEventListener('DOMContentLoaded', () => {
    initLoja();
    atualizarIconesTema();
});

let lojaConfig = {};
let produtos = [];
let subcategoriasUnicas = new Set();
let subcategoriaAtiva = 'Todas';
let termoBusca = '';

// ==========================================
// TEMA DARK / LIGHT DO SITE
// Usa inline styles para garantir independência
// total do tema do sistema operacional.
// ==========================================

// Cores para cada tema
const SITE_TEMAS = {
    dark: {
        body: { background: '#0f172a', color: '#f1f5f9' },
        navbar: { background: 'rgba(15,23,42,0.97)', borderColor: '#1e293b' },
        cards: { background: '#1e293b', borderColor: '#334155' },
        input: { background: '#1e293b', borderColor: '#334155', color: '#f1f5f9' },
        sectionBg: '#0f172a',
        categoryCircle: '#1e293b',
        categoryText: '#94a3b8',
    },
    light: {
        body: { background: '#f8fafc', color: '#1e293b' },
        navbar: { background: 'rgba(255,255,255,0.97)', borderColor: '#f1f5f9' },
        cards: { background: '#ffffff', borderColor: '#e2e8f0' },
        input: { background: '#f1f5f9', borderColor: '#e2e8f0', color: '#1e293b' },
        sectionBg: '#f8fafc',
        categoryCircle: '#ffffff',
        categoryText: '#64748b',
    }
};

function _aplicarTemaNoDOM(tema) {
    const t = SITE_TEMAS[tema] || SITE_TEMAS.dark;
    const html = document.documentElement;

    // HTML/Body
    html.style.backgroundColor = t.body.background;
    html.style.color = t.body.color;
    document.body.style.backgroundColor = t.body.background;
    document.body.style.color = t.body.color;

    // Navbar
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.backgroundColor = t.navbar.background;
        navbar.style.borderBottomColor = t.navbar.borderColor;
    }

    // Seções e containers principais
    ['hero-section', 'categorias-section', 'produtos', 'sobre', 'contact-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.backgroundColor = t.sectionBg;
    });

    // Cards de produto
    document.querySelectorAll('.product-card, [class*="rounded-xl"], [class*="rounded-2xl"]').forEach(el => {
        if (el.closest('#navbar') || el.closest('.theme-toggle-icon')) return;
        if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
        el.style.backgroundColor = t.cards.background;
        el.style.borderColor = t.cards.borderColor;
    });

    // Inputs
    document.querySelectorAll('input, select').forEach(el => {
        el.style.backgroundColor = t.input.background;
        el.style.borderColor = t.input.borderColor;
        el.style.color = t.input.color;
    });

    // Textos de títulos e parágrafos
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
        el.style.color = t.body.color;
    });

    // Loader e fundo de tela cheia
    const loader = document.getElementById('loader');
    if (loader) loader.style.backgroundColor = t.body.background;
    const lojaInativa = document.getElementById('loja-inativa');
    if (lojaInativa) lojaInativa.style.backgroundColor = t.body.background;
}

function toggleTemaSite() {
    const html = document.documentElement;
    const temaAtual = html.getAttribute('data-theme') || 'dark';
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', novoTema);
    if (novoTema === 'dark') { html.classList.add('dark'); }
    else { html.classList.remove('dark'); }

    localStorage.setItem('fc_theme_site', novoTema);
    _aplicarTemaNoDOM(novoTema);
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
    const statusText = document.getElementById('theme-status-text');
    if (statusText) statusText.innerText = isDark ? 'Escuro' : 'Claro';
}
window.atualizarIconesTema = atualizarIconesTema;

// Aplicar tema ao carregar o JS (garante consistência mesmo sem DOMContentLoaded do head)
(function() {
    const tema = localStorage.getItem('fc_theme_site') || 'dark';
    document.documentElement.setAttribute('data-theme', tema);
    if (tema === 'light') { document.documentElement.classList.remove('dark'); }
    else { document.documentElement.classList.add('dark'); }
    // Aplica no DOM assim que possível
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            _aplicarTemaNoDOM(tema);
            atualizarIconesTema(tema === 'dark');
        });
    } else {
        _aplicarTemaNoDOM(tema);
        atualizarIconesTema(tema === 'dark');
    }
})();


async function initLoja() {
    try {
        // 1. Carregar Configurações da Loja
        const configSnap = await firebase.firestore().collection('fc_moveis').doc('config').get();
        if (configSnap.exists) {
            const data = configSnap.data();
            lojaConfig = data.loja || {};
            
            // Verifica se a loja está desativada explicitamente
            if (lojaConfig.ativa === false) {
                esconderLoaderSite();
                const inativa = document.getElementById('loja-inativa');
                if (inativa) inativa.classList.remove('hidden');
                return;
            }

            aplicarConfiguracoes(data.empresa);
        } else {
            console.warn("Configurações não encontradas.");
        }

        // 2. Carregar Produtos
        await carregarProdutos();

        // 3. Esconder Loader
        esconderLoaderSite();

        // 4. Setup Eventos da UI
        setupUI();

    } catch (error) {
        console.error("Erro ao inicializar a loja:", error);
        esconderLoaderSite();
        
        const container = document.getElementById('produtos-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-20 col-span-full">
                    <i class="fa-solid fa-triangle-exclamation text-5xl text-red-400 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">Erro de Conexão</h3>
                    <p class="text-gray-500 dark:text-slate-400">Não foi possível carregar os produtos. Verifique sua conexão com a internet e tente novamente.</p>
                </div>
            `;
        }
    }
}

function esconderLoaderSite() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('opacity-0');
        setTimeout(() => {
            if (loader) loader.classList.add('hidden');
        }, 500);
    }
}

function aplicarConfiguracoes(empresaConfig = {}) {
    // Cores
    const cor = lojaConfig['cor-primaria-hex'] || lojaConfig['cor-primaria'] || '#2563eb';
    document.documentElement.style.setProperty('--brand-color', cor);
    document.documentElement.style.setProperty('--brand-color-dark', adjustColor(cor, -20));
    document.documentElement.style.setProperty('--brand-color-light', adjustColor(cor, 90));

    // Textos Principais
    const nomeLoja = lojaConfig.nome || empresaConfig.nome || 'Nossa Loja';
    const sloganLoja = lojaConfig.slogan || 'Qualidade e Conforto para sua Casa';
    
    document.title = nomeLoja + ' | Loja Online';
    if(document.getElementById('nav-title')) {
        document.getElementById('nav-title').innerHTML = `<i class="fa-solid fa-store text-brand mr-2"></i> ${nomeLoja}`;
    }
    if(document.getElementById('footer-title')) document.getElementById('footer-title').innerText = nomeLoja;
    if(document.getElementById('footer-slogan')) document.getElementById('footer-slogan').innerText = sloganLoja;
    
    if(document.getElementById('hero-title')) document.getElementById('hero-title').innerText = lojaConfig['banner-titulo'] || 'Transforme seu Espaço';
    if(document.getElementById('hero-subtitle')) document.getElementById('hero-subtitle').innerText = lojaConfig['banner-subtitulo'] || sloganLoja;
    if(document.getElementById('hero-btn-text')) document.getElementById('hero-btn-text').innerText = lojaConfig['btn-cta'] || 'Ver Produtos';

    if(document.getElementById('section-produtos-title')) document.getElementById('section-produtos-title').innerText = lojaConfig['titulo-produtos'] || 'Nossos Produtos';
    if(document.getElementById('section-sobre-title')) document.getElementById('section-sobre-title').innerText = lojaConfig['titulo-sobre'] || 'Sobre Nós';
    if(document.getElementById('loja-descricao-text')) document.getElementById('loja-descricao-text').innerText = lojaConfig.descricao || 'Bem-vindo à nossa loja online! Aqui você encontra os melhores produtos.';

    const ano = new Date().getFullYear();
    const elFoot = document.getElementById('footer-copyright');
    if (elFoot) elFoot.innerHTML = lojaConfig.rodape || `&copy; ${ano} ${nomeLoja}. Todos os direitos reservados.`;


    // Logo
    if (empresaConfig.logo) {
        const logoNav = document.getElementById('nav-logo');
        const logoFooter = document.getElementById('footer-logo');
        if (logoNav) {
            logoNav.src = empresaConfig.logo;
            logoNav.classList.remove('hidden');
        }
        if (logoFooter) {
            logoFooter.src = empresaConfig.logo;
            logoFooter.classList.remove('hidden');
        }
    }

    // Contatos e Redes Sociais
    setupContatos(empresaConfig);
}

function setupContatos(empresaConfig) {
    const wpp = lojaConfig.whatsapp || empresaConfig.telefone || '';
    const msgPadrão = encodeURIComponent(lojaConfig['whatsapp-msg'] || 'Olá! Vim pelo site e gostaria de mais informações.');
    
    let linkWpp = '#';
    if (wpp) {
        const numeroLimpo = String(wpp).replace(/\D/g, '');
        if (numeroLimpo.length >= 10) {
            linkWpp = `https://wa.me/55${numeroLimpo}?text=${msgPadrão}`;
        }
    }

    const navWpp = document.getElementById('nav-whatsapp');
    const navWppMobile = document.getElementById('nav-whatsapp-mobile');
    if (navWpp) navWpp.href = linkWpp;
    if (navWppMobile) navWppMobile.href = linkWpp;

    function formatarUrlSocial(valor, rede) {
        if (!valor) return '';
        let url = String(valor).trim();
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        url = url.replace(/^@/, '');
        if (rede === 'facebook') {
            if (url.startsWith('facebook.com/') || url.startsWith('www.facebook.com/')) return 'https://' + url;
            return `https://facebook.com/${url}`;
        }
        if (rede === 'instagram') {
            if (url.startsWith('instagram.com/') || url.startsWith('www.instagram.com/')) return 'https://' + url;
            return `https://instagram.com/${url}`;
        }
        return url;
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
            socialContainer.innerHTML += `<a href="${linkWpp}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gray-800 dark:bg-slate-800 flex items-center justify-center text-gray-400 hover:bg-[#25D366] hover:text-white transition-colors" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
        }
    }

    const contactContainer = document.getElementById('contact-info');
    if (contactContainer) {
        contactContainer.innerHTML = '';
        if (wpp) {
            contactContainer.innerHTML += `<li class="flex items-start gap-3"><i class="fa-brands fa-whatsapp mt-1 text-brand"></i><span>${formatarTelefone(wpp)}</span></li>`;
        }
        const endereco = [empresaConfig.rua, empresaConfig.numero, empresaConfig.bairro, empresaConfig.cidade, empresaConfig.uf].filter(Boolean).join(', ');
        if (endereco) {
            let mapsLink = lojaConfig.maps || `https://maps.google.com/?q=${encodeURIComponent(endereco)}`;
            contactContainer.innerHTML += `<li class="flex items-start gap-3"><i class="fa-solid fa-location-dot mt-1 text-brand"></i><a href="${mapsLink}" target="_blank" class="hover:text-brand transition-colors">${endereco}</a></li>`;
        }
    }
}

async function carregarProdutos() {
    try {
        const snap = await firebase.firestore().collection('produtos').get();
        produtos = [];
        
        snap.forEach(doc => {
            const p = doc.data();
            p.id = doc.id;
            if (p.ativo !== false && p.exibirLoja === true) {
                produtos.push(p);
            }
        });

        extrairSubcategorias();
        renderizarCategorias();
        renderProdutos();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
    }
}

function extrairSubcategorias() {
    subcategoriasUnicas.clear();
    produtos.forEach(p => {
        const sub = (p.subcategoria && p.subcategoria.trim() !== '') 
            ? p.subcategoria.trim() 
            : (p.categoria && p.categoria.trim() !== '' ? p.categoria.trim() : 'Geral');
        subcategoriasUnicas.add(sub);
    });
}

function getCategoryIcon(catName) {
    const name = catName.toLowerCase();
    if (name.includes('banqueta') || name.includes('mocho') || name.includes('banqueta')) return 'fa-solid fa-chair';
    if (name.includes('cadeira')) return 'fa-solid fa-chair';
    if (name.includes('mesa') || name.includes('bistr') || name.includes('bristo') || name.includes('sala')) return 'fa-solid fa-table';
    if (name.includes('sof') || name.includes('poltrona') || name.includes('puff')) return 'fa-solid fa-couch';
    if (name.includes('cama') || name.includes('colch') || name.includes('quarto')) return 'fa-solid fa-bed';
    if (name.includes('arm') || name.includes('guarda') || name.includes('rack') || name.includes('painel')) return 'fa-solid fa-box-archive';
    if (name.includes('eletr') || name.includes('tv')) return 'fa-solid fa-tv';
    if (name.includes('cozinha') || name.includes('balc')) return 'fa-solid fa-kitchen-set';
    if (name.includes('banh')) return 'fa-solid fa-bath';
    if (name.includes('decor') || name.includes('tapete') || name.includes('espelho')) return 'fa-solid fa-leaf';
    if (name.includes('roupa')) return 'fa-solid fa-shirt';
    if (name.includes('tênis') || name.includes('calc')) return 'fa-solid fa-shoe-prints';
    return 'fa-solid fa-tags';
}

function renderizarCategorias() {
    const container = document.getElementById('categorias-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Botão "Todas"
    const divTodas = document.createElement('div');
    divTodas.className = 'flex flex-col items-center gap-3 cursor-pointer group shrink-0';
    divTodas.onclick = () => { 
        subcategoriaAtiva = 'Todas'; 
        renderizarCategorias(); 
        renderProdutos(); 
    };
    
    divTodas.innerHTML = `
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/80 flex items-center justify-center text-3xl transition-all shadow-[0_4px_20px_-5px_rgba(0,0,0,0.08)] dark:shadow-none group-hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.15)] group-hover:-translate-y-1 ${subcategoriaAtiva === 'Todas' ? 'ring-2 ring-brand ring-offset-4 dark:ring-offset-slate-900 text-brand' : 'text-gray-400 dark:text-slate-400 group-hover:text-brand dark:group-hover:text-brand-light'}">
            <i class="fa-solid fa-border-all"></i>
        </div>
        <span class="text-sm font-medium ${subcategoriaAtiva === 'Todas' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-slate-200'}">Todas</span>
    `;
    container.appendChild(divTodas);

    // Renderiza cada Subcategoria diretamente como categoria de exploração
    Array.from(subcategoriasUnicas).sort().forEach(sub => {
        const div = document.createElement('div');
        div.className = 'flex flex-col items-center gap-3 cursor-pointer group shrink-0';
        div.onclick = () => { 
            subcategoriaAtiva = sub; 
            renderizarCategorias(); 
            renderProdutos(); 
        };
        
        const icone = getCategoryIcon(sub);
        const isAtiva = subcategoriaAtiva === sub;
        
        div.innerHTML = `
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/80 flex items-center justify-center text-3xl transition-all shadow-[0_4px_20px_-5px_rgba(0,0,0,0.08)] dark:shadow-none group-hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.15)] group-hover:-translate-y-1 ${isAtiva ? 'ring-2 ring-brand ring-offset-4 dark:ring-offset-slate-900 text-brand' : 'text-gray-400 dark:text-slate-400 group-hover:text-brand dark:group-hover:text-brand-light'}">
                <i class="${icone}"></i>
            </div>
            <span class="text-sm font-medium ${isAtiva ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-slate-200'}">${sub}</span>
        `;
        container.appendChild(div);
    });
}

function criarCardProduto(p) {
    const temEstoque = p.estoque > 0 || !p.hasOwnProperty('estoque');
    const fotoUrl = (p.fotos && Array.isArray(p.fotos) && p.fotos.length > 0 ? p.fotos[0] : p.foto) || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg==';
    
    let legendaHtml = '';
    if (p.legenda) {
        legendaHtml = `<p class="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 mb-2 line-clamp-2 leading-relaxed">${p.legenda}</p>`;
    }

    const destaqueHtml = p.destaque ? `<div class="absolute top-3 right-3 bg-brand text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md z-10 flex items-center gap-1 backdrop-blur-sm"><i class="fa-solid fa-star text-[10px]"></i> Destaque</div>` : '';
    const estoqueBadge = !temEstoque ? `<div class="absolute top-3 left-3 bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md z-10 flex items-center gap-1.5 backdrop-blur-sm"><i class="fa-solid fa-clock text-[10px]"></i> Sob Encomenda</div>` : '';

    const rotuloCategoria = p.subcategoria && p.subcategoria.trim() !== '' ? p.subcategoria.trim() : (p.categoria || 'Geral');

    return `
    <a href="produto.html?id=${p.id}" class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-slate-950/50 border border-gray-100 dark:border-slate-700/80 overflow-hidden product-card flex flex-col h-full relative group transition-all duration-300 block">
        ${destaqueHtml}
        ${estoqueBadge}
        
        <div class="aspect-square bg-gray-50 dark:bg-slate-900/50 overflow-hidden relative flex items-center justify-center">
            <img src="${fotoUrl}" alt="${p.nome}" loading="lazy" decoding="async" class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500">
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors duration-300"></div>
        </div>
        
        <div class="p-5 sm:p-6 flex flex-col flex-grow">
            <div class="text-[11px] font-bold text-brand dark:text-blue-400 uppercase tracking-wider mb-1.5">${rotuloCategoria}</div>
            <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug group-hover:text-brand dark:group-hover:text-brand-light transition-colors mb-1">${p.nome}</h3>
            ${legendaHtml}
            <div class="flex-grow"></div>
            
            <div class="mt-4 w-full bg-gray-50 dark:bg-slate-700/50 group-hover:bg-brand dark:group-hover:bg-brand text-gray-700 dark:text-slate-200 group-hover:text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl text-center transition-all duration-200 flex items-center justify-center gap-2 border border-gray-100 dark:border-slate-700 group-hover:border-brand shadow-sm text-sm">
                <span>Ver Detalhes</span>
                <i class="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
            </div>
        </div>
    </a>
    `;
}

function renderProdutos() {
    const container = document.getElementById('produtos-container');
    const empty = document.getElementById('produtos-empty');
    const badgeFiltro = document.getElementById('filtro-ativo-badge');
    const textoFiltro = document.getElementById('filtro-ativo-texto');
    const subTituloSecao = document.getElementById('section-produtos-sub');
    
    if (!container) return;
    container.innerHTML = '';
    
    // Filtragem diretamente por Subcategoria e Busca
    let produtosFiltrados = produtos.filter(p => {
        const sub = (p.subcategoria && p.subcategoria.trim() !== '') 
            ? p.subcategoria.trim() 
            : (p.categoria && p.categoria.trim() !== '' ? p.categoria.trim() : 'Geral');
        
        const matchSubcategoria = subcategoriaAtiva === 'Todas' || sub === subcategoriaAtiva;
        const matchBusca = termoBusca === '' || 
            (p.nome && p.nome.toLowerCase().includes(termoBusca)) || 
            (p.legenda && p.legenda.toLowerCase().includes(termoBusca)) ||
            (p.subcategoria && p.subcategoria.toLowerCase().includes(termoBusca)) ||
            (p.categoria && p.categoria.toLowerCase().includes(termoBusca));

        return matchSubcategoria && matchBusca;
    });

    // Atualiza badge e status de filtro ativo
    const temFiltroAtivo = subcategoriaAtiva !== 'Todas' || termoBusca !== '';
    if (badgeFiltro && textoFiltro) {
        if (temFiltroAtivo) {
            let partes = [];
            if (subcategoriaAtiva !== 'Todas') partes.push(`Categoria: ${subcategoriaAtiva}`);
            if (termoBusca !== '') partes.push(`Busca: "${termoBusca}"`);
            
            textoFiltro.innerText = partes.join(' | ');
            badgeFiltro.classList.remove('hidden');
        } else {
            badgeFiltro.classList.add('hidden');
        }
    }

    if (subTituloSecao) {
        subTituloSecao.innerText = `Mostrando ${produtosFiltrados.length} ${produtosFiltrados.length === 1 ? 'produto' : 'produtos'}`;
    }

    if (produtosFiltrados.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    
    if (empty) empty.classList.add('hidden');
    
    // Ordena: destaques primeiro, depois alfabético
    produtosFiltrados.sort((a, b) => {
        if (a.destaque && !b.destaque) return -1;
        if (!a.destaque && b.destaque) return 1;
        return a.nome.localeCompare(b.nome);
    });

    produtosFiltrados.forEach(p => {
        container.innerHTML += criarCardProduto(p);
    });
}

function limparFiltrosLoja() {
    subcategoriaAtiva = 'Todas';
    termoBusca = '';
    
    const inp1 = document.getElementById('busca-loja');
    const inp2 = document.getElementById('busca-loja-mobile');
    if (inp1) inp1.value = '';
    if (inp2) inp2.value = '';
    
    renderizarCategorias();
    renderProdutos();
}
window.limparFiltrosLoja = limparFiltrosLoja;

function setupUI() {
    // Mobile menu toggle
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    
    if (btn && menu) {
        btn.addEventListener('click', () => {
            menu.classList.toggle('hidden');
        });

        const links = menu.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.add('hidden');
            });
        });
    }

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) {
            if (window.scrollY > 10) {
                nav.classList.add('shadow-md');
            } else {
                nav.classList.remove('shadow-md');
            }
        }
    });

    // Busca
    const handleBusca = (e) => {
        termoBusca = e.target.value.toLowerCase().trim();
        
        const desktopInput = document.getElementById('busca-loja');
        const mobileInput = document.getElementById('busca-loja-mobile');
        
        if (desktopInput && desktopInput !== e.target) desktopInput.value = e.target.value;
        if (mobileInput && mobileInput !== e.target) mobileInput.value = e.target.value;
        
        renderProdutos();
    };

    const buscaInput = document.getElementById('busca-loja');
    if (buscaInput) {
        buscaInput.addEventListener('input', handleBusca);
    }
    
    const buscaInputMobile = document.getElementById('busca-loja-mobile');
    if (buscaInputMobile) {
        buscaInputMobile.addEventListener('input', handleBusca);
    }
}

// Helpers
function formatarTelefone(tel) {
    tel = String(tel).replace(/\D/g, '');
    if(tel.length === 11) {
        return tel.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if(tel.length === 10) {
        return tel.replace(/^(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return tel;
}

function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}
