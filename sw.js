// ==============================================================
// SERVICE WORKER - FC GESTÃO PWA
// Cache inteligente, carregamento ultra-rápido e suporte Offline
// ==============================================================

const CACHE_NAME = 'fc-gestao-cache-v6';

// Arquivos do App Shell para pré-armazenamento em cache
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/tailwind-built.css',
    '/global.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/favicon.png',
    '/icons/icon.svg',
    '/sistema/config_banco.js',
    '/sistema/index.html',
    '/sistema/index.js',
    '/sistema/login.html',
    '/sistema/login.js',
    '/sistema/pdv.html',
    '/sistema/pdv.js',
    '/sistema/vendas_operacao.html',
    '/sistema/vendas_operacao.js',
    '/sistema/vendas_gestao.html',
    '/sistema/vendas_gestao.js',
    '/sistema/orcamentos.html',
    '/sistema/orcamentos.js',
    '/sistema/produtos.html',
    '/sistema/produtos.js',
    '/sistema/clientes.html',
    '/sistema/clientes.js',
    '/sistema/fornecedores.html',
    '/sistema/fornecedores.js',
    '/sistema/funcionarios.html',
    '/sistema/funcionarios.js',
    '/sistema/financeiro.html',
    '/sistema/financeiro.js',
    '/sistema/caixa.html',
    '/sistema/caixa.js',
    '/sistema/compras.html',
    '/sistema/compras.js',
    '/sistema/relatorios.html',
    '/sistema/relatorios_v2.js',
    '/sistema/estoque.html',
    '/sistema/estoque.js',
    '/sistema/agenda.html',
    '/sistema/agenda.js',
    '/sistema/marketing.html',
    '/sistema/marketing.js',
    '/sistema/sistema.html',
    '/sistema/sistema.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pré-carregando App Shell');
            // Usamos addAll tolerante a falhas individuais
            return Promise.allSettled(
                SHELL_ASSETS.map((url) =>
                    fetch(url)
                        .then((res) => {
                            if (res.ok) return cache.put(url, res);
                        })
                        .catch((err) => {
                            console.warn('[Service Worker] Falha ao pré-cachear:', url, err);
                        })
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// Ativação e Limpeza de caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    // REMOVE TODOS OS CACHES (KILL SWITCH)
                    console.log('[Service Worker] Removendo cache:', name);
                    return caches.delete(name);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia de Interceptação de Requisições
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Ignora chamadas que não sejam GET ou que sejam de APIs do Firebase/Firestore
    if (request.method !== 'GET') return;
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('firebaseinstallations.googleapis.com') ||
        url.hostname.includes('securetoken.googleapis.com') ||
        url.protocol.startsWith('chrome-extension')
    ) {
        return; // Deixa o SDK do Firebase lidar nativamente com a sua própria persistência offline
    }

    // Para navegações de página (HTML): Rede primeiro, fallback para o cache
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        return caches.match('/sistema/index.html').then(idxResp => {
                            return idxResp || Response.error();
                        });
                    });
                })
        );
        return;
    }

    // Para arquivos estáticos (JS, CSS, Imagens, Fontes, CDN): Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch((err) => {
                    // Se falhar a rede e não tiver no cache, retorna Response.error() para evitar o TypeError de 'undefined'
                    throw err;
                });

            return cachedResponse || fetchPromise.catch(() => Response.error());
        })
    );
});
