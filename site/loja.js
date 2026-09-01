document.addEventListener('DOMContentLoaded', () => {
    initLoja();
});

let lojaConfig = {};
let produtos = [];
let categoriasUnicas = new Set();
let categoriaAtiva = 'Todas';
let termoBusca = '';

async function initLoja() {
    try {
        // 1. Carregar Configurações da Loja
        const configSnap = await firebase.firestore().collection('fc_moveis').doc('config').get();
        if (configSnap.exists) {
            const data = configSnap.data();
            lojaConfig = data.loja || {};
            
            // Verifica se a loja está desativada explicitamente
            if (lojaConfig.ativa === false) {
                document.getElementById('loader').classList.add('opacity-0');
                setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
                document.getElementById('loja-inativa').classList.remove('hidden');
                return; // Para a execução se a loja estiver inativa
            }

            aplicarConfiguracoes(data.empresa);
        } else {
            console.warn("Configurações não encontradas.");
        }

        // 2. Carregar Produtos
        await carregarProdutos();

        // 3. Esconder Loader
        document.getElementById('loader').classList.add('opacity-0');
        setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);

        // 4. Setup Eventos da UI
        setupUI();

    } catch (error) {
        console.error("Erro ao inicializar a loja:", error);
        document.getElementById('loader').classList.add('opacity-0');
        setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
        
        // Exibir mensagem de erro básica
        const container = document.getElementById('produtos-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-20">
                    <i class="fa-solid fa-triangle-exclamation text-5xl text-red-400 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Erro de Conexão</h3>
                    <p class="text-gray-500">Não foi possível carregar os produtos. Verifique sua conexão com a internet e tente novamente.</p>
                </div>
            `;
        }
    }
}

function aplicarConfiguracoes(empresaConfig = {}) {
    // Cores
    const cor = lojaConfig['cor-primaria-hex'] || lojaConfig['cor-primaria'] || '#2563eb';
    document.documentElement.style.setProperty('--brand-color', cor);
    
    // Calcula uma versão um pouco mais escura e mais clara para hover e fundos
    // (Simplificado, ideal seria usar uma função de manipulação de cor real)
    document.documentElement.style.setProperty('--brand-color-dark', adjustColor(cor, -20));
    document.documentElement.style.setProperty('--brand-color-light', adjustColor(cor, 90));

    // Textos Principais
    const nomeLoja = lojaConfig.nome || empresaConfig.nome || 'Nossa Loja';
    const sloganLoja = lojaConfig.slogan || 'Qualidade e Conforto para sua Casa';
    
    document.title = nomeLoja + ' | Loja Online';
    if(document.getElementById('nav-title')) document.getElementById('nav-title').innerText = nomeLoja;
    if(document.getElementById('footer-title')) document.getElementById('footer-title').innerText = nomeLoja;
    if(document.getElementById('footer-slogan')) document.getElementById('footer-slogan').innerText = sloganLoja;
    
    if(document.getElementById('hero-title')) document.getElementById('hero-title').innerText = lojaConfig['banner-titulo'] || 'Transforme seu Espaço';
    if(document.getElementById('hero-subtitle')) document.getElementById('hero-subtitle').innerText = lojaConfig['banner-subtitulo'] || sloganLoja;
    if(document.getElementById('hero-btn-text')) document.getElementById('hero-btn-text').innerText = lojaConfig['btn-cta'] || 'Ver Produtos';

    if(document.getElementById('section-produtos-title')) document.getElementById('section-produtos-title').innerText = lojaConfig['titulo-produtos'] || 'Nossos Produtos';
    if(document.getElementById('section-sobre-title')) document.getElementById('section-sobre-title').innerText = lojaConfig['titulo-sobre'] || 'Sobre Nós';
    if(document.getElementById('loja-descricao-text')) document.getElementById('loja-descricao-text').innerText = lojaConfig.descricao || 'Bem-vindo à nossa loja online! Aqui você encontra os melhores produtos.';

    const ano = new Date().getFullYear();
    document.getElementById('footer-copyright').innerHTML = lojaConfig.rodape || `&copy; ${ano} ${nomeLoja}. Todos os direitos reservados.`;

    // Logo
    if (empresaConfig.logo) {
        const logoNav = document.getElementById('nav-logo');
        const logoFooter = document.getElementById('footer-logo');
        logoNav.src = empresaConfig.logo;
        logoNav.classList.remove('hidden');
        logoFooter.src = empresaConfig.logo;
        logoFooter.classList.remove('hidden');
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

    // Atualiza links do WhatsApp
    document.getElementById('nav-whatsapp').href = linkWpp;
    document.getElementById('nav-whatsapp-mobile').href = linkWpp;

    // Redes Sociais Footer
    const socialContainer = document.getElementById('social-links');
    socialContainer.innerHTML = '';
    
    if (lojaConfig.instagram) {
        const user = String(lojaConfig.instagram).replace('@', '');
        socialContainer.innerHTML += `<a href="https://instagram.com/${user}" target="_blank" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-brand hover:text-white transition-colors"><i class="fa-brands fa-instagram"></i></a>`;
    }
    if (lojaConfig.facebook) {
        socialContainer.innerHTML += `<a href="https://facebook.com/${lojaConfig.facebook}" target="_blank" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-brand hover:text-white transition-colors"><i class="fa-brands fa-facebook-f"></i></a>`;
    }
    if (wpp) {
        socialContainer.innerHTML += `<a href="${linkWpp}" target="_blank" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#25D366] hover:text-white transition-colors"><i class="fa-brands fa-whatsapp"></i></a>`;
    }

    // Informações de Contato Footer
    const contactContainer = document.getElementById('contact-info');
    contactContainer.innerHTML = '';
    
    if (wpp) {
        contactContainer.innerHTML += `<li class="flex items-start gap-3"><i class="fa-brands fa-whatsapp mt-1 text-gray-500"></i><span>${formatarTelefone(wpp)}</span></li>`;
    }
    
    const endereco = [empresaConfig.rua, empresaConfig.numero, empresaConfig.bairro, empresaConfig.cidade, empresaConfig.uf].filter(Boolean).join(', ');
    if (endereco) {
        let mapsLink = lojaConfig.maps || `https://maps.google.com/?q=${encodeURIComponent(endereco)}`;
        contactContainer.innerHTML += `<li class="flex items-start gap-3"><i class="fa-solid fa-location-dot mt-1 text-gray-500"></i><a href="${mapsLink}" target="_blank" class="hover:text-brand transition-colors">${endereco}</a></li>`;
    }
}

async function carregarProdutos() {
    try {
        const snap = await firebase.firestore().collection('produtos').get();
        produtos = [];
        
        snap.forEach(doc => {
            const p = doc.data();
            p.id = doc.id;
            // Filtra apenas produtos ativos e com a flag exibirLoja = true
            if (p.ativo !== false && p.exibirLoja === true) {
                produtos.push(p);
            }
        });

        extrairCategorias();
        renderizarCategorias();
        renderProdutos();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
    }
}

function extrairCategorias() {
    categoriasUnicas.clear();
    produtos.forEach(p => {
        const cat = (p.categoria && p.categoria.trim() !== '') ? p.categoria.trim() : 'Geral';
        categoriasUnicas.add(cat);
    });
}

function getCategoryIcon(catName) {
    const name = catName.toLowerCase();
    if (name.includes('cama')) return 'fa-solid fa-bed';
    if (name.includes('sof')) return 'fa-solid fa-couch';
    if (name.includes('mesa')) return 'fa-solid fa-table';
    if (name.includes('cadeira')) return 'fa-solid fa-chair';
    if (name.includes('arm')) return 'fa-solid fa-box-archive';
    if (name.includes('eletr') || name.includes('tv')) return 'fa-solid fa-tv';
    if (name.includes('cozinha')) return 'fa-solid fa-kitchen-set';
    if (name.includes('banh')) return 'fa-solid fa-bath';
    if (name.includes('decor')) return 'fa-solid fa-leaf';
    if (name.includes('roupa')) return 'fa-solid fa-shirt';
    if (name.includes('tênis') || name.includes('calc')) return 'fa-solid fa-shoe-prints';
    return 'fa-solid fa-tags';
}

function renderizarCategorias() {
    const container = document.getElementById('categorias-container');
    container.innerHTML = '';
    
    // Todas
    const divTodas = document.createElement('div');
    divTodas.className = 'flex flex-col items-center gap-3 cursor-pointer group shrink-0';
    divTodas.onclick = () => { categoriaAtiva = 'Todas'; renderizarCategorias(); renderProdutos(); };
    
    divTodas.innerHTML = `
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white flex items-center justify-center text-3xl transition-all shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] group-hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.15)] group-hover:-translate-y-1 ${categoriaAtiva === 'Todas' ? 'ring-2 ring-brand ring-offset-4 text-brand' : 'text-gray-400 group-hover:text-brand'}">
            <i class="fa-solid fa-border-all"></i>
        </div>
        <span class="text-sm font-medium ${categoriaAtiva === 'Todas' ? 'text-gray-900 font-bold' : 'text-gray-500 group-hover:text-gray-900'}">Todas</span>
    `;
    container.appendChild(divTodas);

    Array.from(categoriasUnicas).sort().forEach(cat => {
        const div = document.createElement('div');
        div.className = 'flex flex-col items-center gap-3 cursor-pointer group shrink-0';
        div.onclick = () => { categoriaAtiva = cat; renderizarCategorias(); renderProdutos(); };
        
        const icone = getCategoryIcon(cat);
        
        div.innerHTML = `
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white flex items-center justify-center text-3xl transition-all shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] group-hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.15)] group-hover:-translate-y-1 ${categoriaAtiva === cat ? 'ring-2 ring-brand ring-offset-4 text-brand' : 'text-gray-400 group-hover:text-brand'}">
                <i class="${icone}"></i>
            </div>
            <span class="text-sm font-medium ${categoriaAtiva === cat ? 'text-gray-900 font-bold' : 'text-gray-500 group-hover:text-gray-900'}">${cat}</span>
        `;
        container.appendChild(div);
    });
}

function criarCardProduto(p) {
    const temEstoque = p.estoque > 0 || !p.hasOwnProperty('estoque');
    const fotoUrl = p.foto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg==';
    
    let legendaHtml = '';
    if (p.legenda) {
        legendaHtml = `<p class="text-sm text-gray-500 mt-1 mb-2 line-clamp-2">${p.legenda}</p>`;
    }

    const destaqueHtml = p.destaque ? `<div class="absolute top-4 right-4 bg-brand text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-10"><i class="fa-solid fa-star mr-1"></i> Destaque</div>` : '';
    const estoqueBadge = !temEstoque ? `<div class="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-10">Esgotado</div>` : '';

    return `
    <a href="produto.html?id=${p.id}" class="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden product-card flex flex-col h-full relative group transition-all duration-300 block">
        ${destaqueHtml}
        ${estoqueBadge}
        
        <div class="aspect-square bg-gray-50 overflow-hidden relative">
            <img src="${fotoUrl}" alt="${p.nome}" class="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ${!temEstoque ? 'grayscale' : ''}">
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-all duration-300"></div>
        </div>
        
        <div class="p-6 flex flex-col flex-grow">
            <div class="text-xs font-bold text-brand uppercase tracking-wider mb-2">${p.categoria || 'Geral'}</div>
            <h3 class="text-lg font-bold text-gray-900 leading-tight ${p.legenda ? '' : 'mb-2 flex-grow'} group-hover:text-brand transition-colors">${p.nome}</h3>
            ${legendaHtml}
            ${p.legenda ? '<div class="flex-grow"></div>' : ''}
            
            <div class="mt-4 flex items-end justify-between">
                <div>
                    <!-- Preço removido -->
                </div>
            </div>
            
            <div class="mt-6 w-full bg-gray-50 group-hover:bg-brand text-gray-600 group-hover:text-white font-bold py-3 px-4 rounded-xl text-center transition-colors flex items-center justify-center gap-2 border border-gray-100 group-hover:border-brand">
                <span>Ver Detalhes</span>
                <i class="fa-solid fa-arrow-right text-sm"></i>
            </div>
        </div>
    </a>
    `;
}

function renderProdutos() {
    const container = document.getElementById('produtos-container');
    const empty = document.getElementById('produtos-empty');
    
    container.innerHTML = '';
    
    // Filtragem
    let produtosFiltrados = produtos.filter(p => {
        const cat = (p.categoria && p.categoria.trim() !== '') ? p.categoria.trim() : 'Geral';
        const matchCategoria = categoriaAtiva === 'Todas' || cat === categoriaAtiva;
        const matchBusca = p.nome.toLowerCase().includes(termoBusca) || cat.toLowerCase().includes(termoBusca);
        return matchCategoria && matchBusca;
    });

    if (produtosFiltrados.length === 0) {
        if(empty) empty.classList.remove('hidden');
        return;
    }
    
    if(empty) empty.classList.add('hidden');
    
    // Ordena: destaques primeiro, depois nome
    produtosFiltrados.sort((a, b) => {
        if (a.destaque && !b.destaque) return -1;
        if (!a.destaque && b.destaque) return 1;
        return a.nome.localeCompare(b.nome);
    });

    produtosFiltrados.forEach(p => {
        container.innerHTML += criarCardProduto(p);
    });
}

function setupUI() {
    // Mobile menu toggle
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    
    btn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });

    // Fechar menu ao clicar em link
    const links = menu.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.add('hidden');
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 10) {
            nav.classList.add('shadow-sm');
        } else {
            nav.classList.remove('shadow-sm');
        }
    });

    // Busca
    const handleBusca = (e) => {
        termoBusca = e.target.value.toLowerCase();
        
        // Sincroniza os dois inputs
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

