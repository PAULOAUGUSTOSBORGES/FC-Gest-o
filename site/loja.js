// ==============================================================
// LOJA.JS - CATÁLOGO ONLINE & LOJA VIRTUAL ULTRA RÁPIDA
// Otimizado com Cache IndexedDB, REST Seletivo e Renderização Fluida
// ==============================================================

// Roteamento Multi-Tenant da Loja Virtual
const urlParamsSite = new URLSearchParams(window.location.search);
const empresaAtivaSite = urlParamsSite.get('loja') || urlParamsSite.get('empresa') || 'emp_fc_moveis';
window.empresaAtivaSite = empresaAtivaSite;

let lojaConfig = {};
let produtos = [];
let subcategoriasUnicas = new Set();
let subcategoriaAtiva = 'Todas';
let termoBusca = '';

// Paginação e Renderização Progressiva
const ITENS_POR_PAGINA = 24;
let paginaAtual = 1;
let produtosFiltradosCache = [];
let loaderEscondido = false;

// ==========================================
// TEMA DARK / LIGHT DO SITE
// Usa inline styles para garantir independência
// total do tema do sistema operacional.
// ==========================================

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

    html.style.backgroundColor = t.body.background;
    html.style.color = t.body.color;
    if (document.body) {
        document.body.style.backgroundColor = t.body.background;
        document.body.style.color = t.body.color;
    }

    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.backgroundColor = t.navbar.background;
        navbar.style.borderBottomColor = t.navbar.borderColor;
    }

    ['hero-section', 'categorias-section', 'produtos', 'sobre', 'contact-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.backgroundColor = t.sectionBg;
    });

    document.querySelectorAll('.product-card, [class*="rounded-xl"], [class*="rounded-2xl"]').forEach(el => {
        if (el.closest('#navbar') || el.closest('.theme-toggle-icon')) return;
        if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
        el.style.backgroundColor = t.cards.background;
        el.style.borderColor = t.cards.borderColor;
    });

    document.querySelectorAll('input, select').forEach(el => {
        el.style.backgroundColor = t.input.background;
        el.style.borderColor = t.input.borderColor;
        el.style.color = t.input.color;
    });

    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
        el.style.color = t.body.color;
    });

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

(function() {
    const tema = localStorage.getItem('fc_theme_site') || 'dark';
    document.documentElement.setAttribute('data-theme', tema);
    if (tema === 'light') { document.documentElement.classList.remove('dark'); }
    else { document.documentElement.classList.add('dark'); }
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

// ==========================================
// MOTOR DE CACHE INDEXEDDB DO CATÁLOGO
// Carregamento instantâneo (< 50ms) offline/online
// ==========================================

const DB_CATALOGO_NAME = 'FC_Catalogo_DB';
const DB_CATALOGO_STORE = 'catalogo';
const DB_KEY_PRODUTOS = 'produtos_' + empresaAtivaSite;
const DB_KEY_CONFIG = 'config_' + empresaAtivaSite;

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
window.obterCacheCatalogo = obterCacheCatalogo;

async function salvarCacheCatalogo(chave, dados) {
    try {
        const db = await abrirBancoCatalogo();
        if (!db) return;
        const tx = db.transaction(DB_CATALOGO_STORE, 'readwrite');
        const store = tx.objectStore(DB_CATALOGO_STORE);
        store.put(dados, chave);
    } catch (e) {}
}
window.salvarCacheCatalogo = salvarCacheCatalogo;

function esconderLoaderSite() {
    if (loaderEscondido) return;
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            if (loader) loader.classList.add('hidden');
        }, 400);
    }
    loaderEscondido = true;
}
window.esconderLoaderSite = esconderLoaderSite;

// ==========================================
// PARSER REST FIRESTORE ULTRA-RÁPIDO
// ==========================================

function converterDocFirestoreRest(doc) {
    if (!doc || !doc.fields) return null;
    const obj = { id: doc.name.split('/').pop() };
    for (const [key, val] of Object.entries(doc.fields)) {
        if ('stringValue' in val) obj[key] = val.stringValue;
        else if ('integerValue' in val) obj[key] = Number(val.integerValue);
        else if ('doubleValue' in val) obj[key] = Number(val.doubleValue);
        else if ('booleanValue' in val) obj[key] = val.booleanValue;
        else if ('arrayValue' in val) {
            obj[key] = (val.arrayValue.values || []).map(v => {
                if ('stringValue' in v) return v.stringValue;
                if ('integerValue' in v) return Number(v.integerValue);
                if ('doubleValue' in v) return Number(v.doubleValue);
                if ('booleanValue' in v) return v.booleanValue;
                return v;
            });
        }
        else if ('mapValue' in val) obj[key] = val.mapValue.fields || {};
        else if ('nullValue' in val) obj[key] = null;
        else if ('timestampValue' in val) obj[key] = val.timestampValue;
    }
    return obj;
}

// ==========================================
// INICIALIZAÇÃO DA LOJA (STALE-WHILE-REVALIDATE)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initLoja();
    atualizarIconesTema();
});

async function initLoja() {
    // Configura WhatsApp e contatos imediatamente com fallback seguro para não travar cliques rápidos
    setupContatos({ telefone: '62981111011' });

    // Timeout de segurança absoluto: NUNCA deixa a tela travada no loader por mais de 3.5 segundos
    const timeoutSeguranca = setTimeout(() => {
        console.warn("[Site] Timeout de segurança do loader acionado.");
        esconderLoaderSite();
    }, 3500);

    try {
        // 1. CARREGAMENTO IMEDIATO DO CACHE LOCAL (< 50ms)
        const [cacheConfig, cacheProdutos] = await Promise.all([
            obterCacheCatalogo(DB_KEY_CONFIG),
            obterCacheCatalogo(DB_KEY_PRODUTOS)
        ]);

        if (cacheConfig && cacheConfig.loja) {
            lojaConfig = cacheConfig.loja || {};
            aplicarConfiguracoes(cacheConfig.empresa || {});
        }

        if (cacheProdutos && Array.isArray(cacheProdutos.produtos) && cacheProdutos.produtos.length > 0) {
            produtos = cacheProdutos.produtos;
            extrairSubcategorias();
            renderizarCategorias();
            renderProdutos();
            esconderLoaderSite();
            clearTimeout(timeoutSeguranca);
        }

        // 2. CARREGAR CONFIGURAÇÕES PÚBLICAS ATUALIZADAS
        // (Lê 'configuracoes/loja_publica', espelhado seguro para vitrine)
        const configPublicaPromise = carregarConfigPublicaLoja(empresaAtivaSite).then(conf => {
            if (conf) {
                lojaConfig = conf.loja || {};
                if (lojaConfig.ativa === false) {
                    esconderLoaderSite();
                    clearTimeout(timeoutSeguranca);
                    const inativa = document.getElementById('loja-inativa');
                    if (inativa) {
                        const h1 = inativa.querySelector('h1');
                        const p = inativa.querySelector('p');
                        if (h1) h1.innerText = 'Loja Temporariamente Indisponível';
                        if (p) p.innerText = 'Esta loja não está ativada no momento. Por favor, volte mais tarde.';
                        inativa.classList.remove('hidden');
                    }
                    return null;
                }
                salvarCacheCatalogo(DB_KEY_CONFIG, conf);
                aplicarConfiguracoes(conf.empresa);
            }
            return conf;
        }).catch(err => {
            console.warn("[Site] Aviso ao carregar config pública:", err);
            return null;
        });

        // 3. CARREGAR PRODUTOS ATUALIZADOS DO FIRESTORE (REST Seletivo ou SDK)
        const produtosPromise = carregarProdutos();

        // Aguarda ambas as sincronizações em segundo plano
        await Promise.all([configPublicaPromise, produtosPromise]);

        esconderLoaderSite();
        clearTimeout(timeoutSeguranca);
        setupUI();

    } catch (error) {
        console.error("Erro ao inicializar a loja:", error);
        esconderLoaderSite();
        clearTimeout(timeoutSeguranca);
        
        if (!produtos || produtos.length === 0) {
            const container = document.getElementById('produtos-container');
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-20 col-span-full">
                        <i class="fa-solid fa-triangle-exclamation text-5xl text-amber-500 mb-4"></i>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">Instabilidade na Conexão</h3>
                        <p class="text-gray-500 dark:text-slate-400 mb-6">Não foi possível carregar os produtos no momento. Verifique sua internet.</p>
                        <button type="button" onclick="window.location.reload()" class="px-6 py-2.5 bg-brand text-white font-bold rounded-xl shadow hover:bg-brand-dark transition-colors cursor-pointer">
                            Tentar Novamente
                        </button>
                    </div>
                `;
            }
        }
    }
}

// ==========================================
// CONFIGURAÇÕES DA EMPRESA E VITRINE
// ==========================================

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
    if (document.getElementById('nav-title')) {
        document.getElementById('nav-title').innerHTML = `<i class="fa-solid fa-store text-brand mr-2"></i> ${nomeLoja}`;
    }
    if (document.getElementById('footer-title')) document.getElementById('footer-title').innerText = nomeLoja;
    if (document.getElementById('footer-slogan')) document.getElementById('footer-slogan').innerText = sloganLoja;
    
    if (document.getElementById('hero-title')) document.getElementById('hero-title').innerText = lojaConfig['banner-titulo'] || 'Transforme seu Espaço';
    if (document.getElementById('hero-subtitle')) document.getElementById('hero-subtitle').innerText = lojaConfig['banner-subtitulo'] || sloganLoja;
    if (document.getElementById('hero-btn-text')) document.getElementById('hero-btn-text').innerText = lojaConfig['btn-cta'] || 'Ver Produtos';

    if (document.getElementById('section-produtos-title')) document.getElementById('section-produtos-title').innerText = lojaConfig['titulo-produtos'] || 'Nossos Produtos';
    if (document.getElementById('section-sobre-title')) document.getElementById('section-sobre-title').innerText = lojaConfig['titulo-sobre'] || 'Sobre Nós';
    if (document.getElementById('loja-descricao-text')) document.getElementById('loja-descricao-text').innerText = lojaConfig.descricao || 'Bem-vindo à nossa loja online! Aqui você encontra os melhores produtos.';

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

function setupContatos(empresaConfig = {}) {
    window.empresaConfigAtiva = empresaConfig;
    const wpp = (lojaConfig && lojaConfig.whatsapp) || empresaConfig.telefone || '62981111011';
    const msgPadrao = (lojaConfig && lojaConfig['whatsapp-msg']) || 'Olá! Vim pelo site da FC Móveis e gostaria de mais informações.';
    const linkWpp = gerarUrlWhatsApp(wpp, msgPadrao);

    const navWpp = document.getElementById('nav-whatsapp');
    const navWppMobile = document.getElementById('nav-whatsapp-mobile');
    if (navWpp) {
        navWpp.href = linkWpp;
        navWpp.setAttribute('target', '_blank');
        navWpp.setAttribute('rel', 'noopener noreferrer');
        navWpp.onclick = (e) => abrirWhatsAppLoja(e);
    }
    if (navWppMobile) {
        navWppMobile.href = linkWpp;
        navWppMobile.setAttribute('target', '_blank');
        navWppMobile.setAttribute('rel', 'noopener noreferrer');
        navWppMobile.onclick = (e) => abrirWhatsAppLoja(e);
    }

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
            socialContainer.innerHTML += `<a href="${linkWpp}" target="_blank" rel="noopener noreferrer" onclick="abrirWhatsAppLoja(event)" class="w-10 h-10 rounded-full bg-gray-800 dark:bg-slate-800 flex items-center justify-center text-gray-400 hover:bg-[#25D366] hover:text-white transition-colors cursor-pointer" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
        }
    }

    const contactContainer = document.getElementById('contact-info');
    if (contactContainer) {
        contactContainer.innerHTML = '';
        if (wpp) {
            contactContainer.innerHTML += `<li class="flex items-start gap-3"><i class="fa-brands fa-whatsapp mt-1 text-brand"></i><a href="${linkWpp}" target="_blank" rel="noopener noreferrer" onclick="abrirWhatsAppLoja(event)" class="hover:text-brand transition-colors cursor-pointer">${formatarTelefone(wpp)}</a></li>`;
        }
        const endereco = [empresaConfig.rua, empresaConfig.numero, empresaConfig.bairro, empresaConfig.cidade, empresaConfig.uf].filter(Boolean).join(', ');
        if (endereco) {
            let mapsLink = lojaConfig.maps || `https://maps.google.com/?q=${encodeURIComponent(endereco)}`;
            contactContainer.innerHTML += `<li class="flex items-start gap-3"><i class="fa-solid fa-location-dot mt-1 text-brand"></i><a href="${mapsLink}" target="_blank" class="hover:text-brand transition-colors">${endereco}</a></li>`;
        }
    }
}

// ==========================================
// CARREGAMENTO OTIMIZADO DE PRODUTOS
// 1) REST Seletivo (economiza 65% de dados)
// 2) Fallback para SDK Firestore
// ==========================================

async function carregarProdutos() {
    let novosProdutos = null;

    // 1) Tentativa Rápida via Firestore REST com Field Mask
    // Projeta apenas os campos exibidos no catálogo.
    // Ignora a lista 'fotos' (fotos secundárias), cortando de 10.5MB para ~3.8MB!
    try {
        const cfg = (typeof firebaseConfig !== 'undefined') ? firebaseConfig : null;
        if (cfg && cfg.projectId && cfg.apiKey) {
            const endpoint = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/empresas/${encodeURIComponent(empresaAtivaSite)}:runQuery?key=${cfg.apiKey}`;
            const controller = new AbortController();
            const timerAbort = setTimeout(() => controller.abort(), 6000);

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    structuredQuery: {
                        select: {
                            fields: [
                                { fieldPath: 'nome' },
                                { fieldPath: 'preco' },
                                { fieldPath: 'categoria' },
                                { fieldPath: 'subcategoria' },
                                { fieldPath: 'estoque' },
                                { fieldPath: 'destaque' },
                                { fieldPath: 'legenda' },
                                { fieldPath: 'foto' },
                                { fieldPath: 'exibirLoja' },
                                { fieldPath: 'ativo' }
                            ]
                        },
                        from: [{ collectionId: 'produtos' }],
                        where: {
                            fieldFilter: {
                                field: { fieldPath: 'exibirLoja' },
                                op: 'EQUAL',
                                value: { booleanValue: true }
                            }
                        }
                    }
                })
            });
            clearTimeout(timerAbort);

            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data)) {
                    novosProdutos = [];
                    data.forEach(item => {
                        if (!item.document) return;
                        const p = converterDocFirestoreRest(item.document);
                        if (p && p.ativo !== false && p.exibirLoja === true) {
                            novosProdutos.push(p);
                        }
                    });
                }
            }
        }
    } catch (errRest) {
        console.warn("[Site] REST rápido ignorado/abortado, usando SDK Firestore:", errRest.message || errRest);
    }

    // 2) Fallback Seguro para SDK do Firestore
    if (!novosProdutos) {
        try {
            const snap = await firebase.firestore()
                .collection('empresas').doc(empresaAtivaSite)
                .collection('produtos')
                .where('exibirLoja', '==', true)
                .get();

            novosProdutos = [];
            snap.forEach(doc => {
                const p = doc.data() || {};
                p.id = doc.id;
                if (p.ativo !== false && p.exibirLoja === true) {
                    novosProdutos.push(p);
                }
            });
        } catch (errSdk) {
            console.error("[Site] Erro ao carregar produtos via SDK Firestore:", errSdk);
        }
    }

    if (novosProdutos && novosProdutos.length > 0) {
        produtos = novosProdutos;
        salvarCacheCatalogo(DB_KEY_PRODUTOS, { produtos, timestamp: Date.now() });
        extrairSubcategorias();
        renderizarCategorias();
        renderProdutos();
    }
}

// ==========================================
// CATEGORIAS & FILTROS
// ==========================================

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
    const name = (catName || '').toLowerCase();
    if (name.includes('banqueta') || name.includes('mocho')) return 'fa-solid fa-chair';
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
    
    let html = '';
    
    // Botão "Todas"
    const isTodasAtiva = subcategoriaAtiva === 'Todas';
    html += `
        <div class="flex flex-col items-center gap-3 cursor-pointer group shrink-0" onclick="selecionarSubcategoria('Todas')">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/80 flex items-center justify-center text-3xl transition-all shadow-[0_4px_20px_-5px_rgba(0,0,0,0.08)] dark:shadow-none group-hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.15)] group-hover:-translate-y-1 ${isTodasAtiva ? 'ring-2 ring-brand ring-offset-4 dark:ring-offset-slate-900 text-brand' : 'text-gray-400 dark:text-slate-400 group-hover:text-brand dark:group-hover:text-brand-light'}">
                <i class="fa-solid fa-border-all"></i>
            </div>
            <span class="text-sm font-medium ${isTodasAtiva ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-slate-200'}">Todas</span>
        </div>
    `;

    // Renderiza cada Subcategoria diretamente
    const listaOrdenada = Array.from(subcategoriasUnicas).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    
    listaOrdenada.forEach(sub => {
        const icone = getCategoryIcon(sub);
        const isAtiva = subcategoriaAtiva === sub;
        
        html += `
            <div class="flex flex-col items-center gap-3 cursor-pointer group shrink-0" onclick="selecionarSubcategoria('${sub.replace(/'/g, "\\'")}')">
                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/80 flex items-center justify-center text-3xl transition-all shadow-[0_4px_20px_-5px_rgba(0,0,0,0.08)] dark:shadow-none group-hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.15)] group-hover:-translate-y-1 ${isAtiva ? 'ring-2 ring-brand ring-offset-4 dark:ring-offset-slate-900 text-brand' : 'text-gray-400 dark:text-slate-400 group-hover:text-brand dark:group-hover:text-brand-light'}">
                    <i class="${icone}"></i>
                </div>
                <span class="text-sm font-medium ${isAtiva ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-slate-200'}">${sub}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function selecionarSubcategoria(sub) {
    subcategoriaAtiva = sub;
    renderizarCategorias();
    renderProdutos(true);
}
window.selecionarSubcategoria = selecionarSubcategoria;
window.filtrarSubcategoria = selecionarSubcategoria;

// ==========================================
// RENDERIZAÇÃO DE PRODUTOS & PAGINAÇÃO
// Substitui innerHTML += em loop por render em lote
// ==========================================

function criarCardProduto(p) {
    const temEstoque = p.estoque > 0 || !p.hasOwnProperty('estoque');
    const fotoUrl = p.foto || (p.fotos && Array.isArray(p.fotos) && p.fotos.length > 0 ? p.fotos[0] : '') || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg==';
    
    let legendaHtml = '';
    if (p.legenda) {
        legendaHtml = `<p class="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 mb-2 line-clamp-2 leading-relaxed">${p.legenda}</p>`;
    }

    const destaqueHtml = p.destaque ? `<div class="absolute top-3 right-3 bg-brand text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md z-10 flex items-center gap-1 backdrop-blur-sm"><i class="fa-solid fa-star text-[10px]"></i> Destaque</div>` : '';
    const estoqueBadge = !temEstoque ? `<div class="absolute top-3 left-3 bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md z-10 flex items-center gap-1.5 backdrop-blur-sm"><i class="fa-solid fa-clock text-[10px]"></i> Sob Encomenda</div>` : '';

    const rotuloCategoria = p.subcategoria && p.subcategoria.trim() !== '' ? p.subcategoria.trim() : (p.categoria || 'Geral');
    const paramLoja = (empresaAtivaSite && empresaAtivaSite !== 'emp_fc_moveis') ? `&loja=${encodeURIComponent(empresaAtivaSite)}` : '';

    return `
    <a href="produto.html?id=${p.id}${paramLoja}" class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-slate-950/50 border border-gray-100 dark:border-slate-700/80 overflow-hidden product-card flex flex-col h-full relative group transition-all duration-300 block">
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
            
            <div class="product-card-btn mt-4 w-full font-bold py-2.5 sm:py-3 px-4 rounded-xl text-center flex items-center justify-center gap-2 border shadow-sm text-sm">
                <span>Ver Detalhes</span>
                <i class="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
            </div>
        </div>
    </a>
    `;
}

function renderProdutos(resetarPagina = true) {
    const container = document.getElementById('produtos-container');
    const empty = document.getElementById('produtos-empty');
    const badgeFiltro = document.getElementById('filtro-ativo-badge');
    const textoFiltro = document.getElementById('filtro-ativo-texto');
    const subTituloSecao = document.getElementById('section-produtos-sub');
    const btnMaisContainer = document.getElementById('produtos-carregar-mais-container');
    const btnMaisTexto = document.getElementById('btn-carregar-mais-texto');
    
    if (!container) return;

    if (resetarPagina) {
        paginaAtual = 1;
    }
    
    // Filtragem por Subcategoria e Busca
    produtosFiltradosCache = produtos.filter(p => {
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

    // Ordena: destaques primeiro, depois alfabético
    produtosFiltradosCache.sort((a, b) => {
        if (a.destaque && !b.destaque) return -1;
        if (!a.destaque && b.destaque) return 1;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' });
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
        subTituloSecao.innerText = `Mostrando ${produtosFiltradosCache.length} ${produtosFiltradosCache.length === 1 ? 'produto' : 'produtos'}`;
    }

    if (produtosFiltradosCache.length === 0) {
        container.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        if (btnMaisContainer) btnMaisContainer.classList.add('hidden');
        return;
    }
    
    if (empty) empty.classList.add('hidden');

    // Paginação fluida: renderiza apenas a fatia visível para poupar memória e evitar travamento
    const totalExibir = paginaAtual * ITENS_POR_PAGINA;
    const itensExibidos = produtosFiltradosCache.slice(0, totalExibir);

    // OTIMIZAÇÃO CRÍTICA: Geração de HTML em uma única operação (sem innerHTML += em loop!)
    container.innerHTML = itensExibidos.map(p => criarCardProduto(p)).join('');

    // Controle do Botão "Carregar Mais"
    if (btnMaisContainer) {
        const restantes = produtosFiltradosCache.length - itensExibidos.length;
        if (restantes > 0) {
            btnMaisContainer.classList.remove('hidden');
            if (btnMaisTexto) {
                btnMaisTexto.innerText = `Carregar Mais Produtos (${restantes} restantes)`;
            }
        } else {
            btnMaisContainer.classList.add('hidden');
        }
    }
}

function carregarMaisProdutos() {
    paginaAtual++;
    renderProdutos(false);
}
window.carregarMaisProdutos = carregarMaisProdutos;

function limparFiltrosLoja() {
    subcategoriaAtiva = 'Todas';
    termoBusca = '';
    
    const inp1 = document.getElementById('busca-loja');
    const inp2 = document.getElementById('busca-loja-mobile');
    if (inp1) inp1.value = '';
    if (inp2) inp2.value = '';
    
    renderizarCategorias();
    renderProdutos(true);
}
window.limparFiltrosLoja = limparFiltrosLoja;

// ==========================================
// CONFIGURAÇÃO DE EVENTOS DA UI
// ==========================================

function setupUI() {
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

    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) {
            if (window.scrollY > 10) {
                nav.classList.add('shadow-md');
            } else {
                nav.classList.remove('shadow-md');
            }
        }
    }, { passive: true });

    // Busca com debounce leve
    let debounceBusca;
    const handleBusca = (e) => {
        clearTimeout(debounceBusca);
        const val = e.target.value.toLowerCase().trim();
        debounceBusca = setTimeout(() => {
            termoBusca = val;
            const desktopInput = document.getElementById('busca-loja');
            const mobileInput = document.getElementById('busca-loja-mobile');
            if (desktopInput && desktopInput !== e.target) desktopInput.value = e.target.value;
            if (mobileInput && mobileInput !== e.target) mobileInput.value = e.target.value;
            renderProdutos(true);
        }, 150);
    };

    const buscaInput = document.getElementById('busca-loja');
    if (buscaInput) {
        buscaInput.addEventListener('input', handleBusca);
    }
    
    const buscaInputMobile = document.getElementById('busca-loja-mobile');
    if (buscaInputMobile) {
        buscaInputMobile.addEventListener('input', handleBusca);
    }

    // Auto-carregamento suave no scroll usando IntersectionObserver
    if ('IntersectionObserver' in window) {
        const loadMoreTarget = document.getElementById('produtos-carregar-mais-container');
        if (loadMoreTarget) {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0] && entries[0].isIntersecting) {
                    if (!loadMoreTarget.classList.contains('hidden')) {
                        carregarMaisProdutos();
                    }
                }
            }, { rootMargin: '350px' });
            observer.observe(loadMoreTarget);
        }
    }
}

// Helpers
function formatarTelefone(tel) {
    tel = String(tel).replace(/\D/g, '');
    if (tel.length === 11) {
        return tel.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (tel.length === 10) {
        return tel.replace(/^(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return tel;
}

function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}
