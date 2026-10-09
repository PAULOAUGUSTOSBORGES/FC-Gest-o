// ==============================================================
// SERVICE WORKER - FC GESTÃO PWA
// Cache inteligente, carregamento ultra-rápido e suporte Offline
// ==============================================================

const CACHE_NAME = 'fc-gestao-cache-v20261009181930';

// Arquivos do App Shell para pré-armazenamento em cache
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/favicon.ico',
    '/style.css',
    '/tailwind-built.css',
    '/global.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/favicon.png',
    '/icons/icon.svg',
    '/icons/icone_primas.png',
    '/icons/logo_primas.png',
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
    '/sistema/fiscal.html',
    '/sistema/fiscal.js',
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
    '/sistema/conciliacao.html',
    '/sistema/conciliacao.js',
    '/sistema/conciliacao.css',
    '/sistema/caixa.html',
    '/sistema/caixa.js',
    '/sistema/caixa_loja.html',
    '/sistema/caixa_loja.js',
    '/sistema/compras.html',
    '/sistema/compras.js',
    '/sistema/relatorios.html',
    '/sistema/relatorios_v2.js',
    '/sistema/agenda.html',
    '/sistema/agenda.js',
    '/sistema/marketing.html',
    '/sistema/marketing.js',
    '/sistema/sistema.html',
    '/sistema/sistema.js',
    '/sistema/suporte.html',
    '/sistema/suporte.js',
    '/sistema/operacao.html',
    '/sistema/operacao.js',
    '/sistema/fc_cache.js',
    '/sistema/tabela_ncm.js',
    '/sistema/ncm_helper.js'
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
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[Service Worker] Removendo cache antigo:', name);
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

    // Ignora chamadas que não sejam GET ou que não sejam HTTP/HTTPS (extensões do browser, chrome-extension://, etc.)
    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    // Ignora chamadas de APIs do Firebase/Firestore/Google (persistência nativa offline do Firebase)
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('firebaseinstallations.googleapis.com') ||
        url.hostname.includes('securetoken.googleapis.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('google.com')
    ) {
        return;
    }

    // Para navegações de página (HTML): Rede primeiro, fallback resiliente para cache
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)).catch(() => {});
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // 1. Tenta correspondência exata do request
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) return cachedResponse;

                    // 2. Tenta pelo pathname exato (sem query string)
                    const pathnameResponse = await caches.match(url.pathname);
                    if (pathnameResponse) return pathnameResponse;

                    // 3. Fallback para index do sistema
                    const idxSistema = await caches.match('/sistema/index.html');
                    if (idxSistema) return idxSistema;

                    // 4. Fallback para raiz
                    const idxRoot = await caches.match('/index.html');
                    if (idxRoot) return idxRoot;

                    // 5. Fallback seguro amigável
                    return new Response(
                        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline - FC Gestão</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Modo Offline</h2><p>Página não encontrada no cache local. Conecte-se à internet para carregá-la.</p><button onclick="window.location.reload()" style="padding:10px 20px;border-radius:8px;background:#2563eb;color:#fff;border:none;cursor:pointer;">Tentar Novamente</button></body></html>',
                        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                    );
                })
        );
        return;
    }

    // Para arquivos estáticos (JS, CSS, Imagens, Fontes, CDN): Stale-While-Revalidate resiliente
    event.respondWith(
        caches.match(request).then(async (cachedResponse) => {
            // Inicia o fetch em segundo plano para revalidar
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)).catch(() => {});
                    }
                    return networkResponse;
                })
                .catch(() => null); // Silencia o erro da rede para nunca gerar 'Uncaught (in promise) TypeError: Failed to fetch'

            if (cachedResponse) {
                // Retorna do cache instantaneamente enquanto a revalidação ocorre em background
                return cachedResponse;
            }

            // Não estava no cache por URL completa: aguarda a rede
            const networkResponse = await fetchPromise;
            if (networkResponse) {
                return networkResponse;
            }

            // Se a rede falhou e não tinha no cache com query string, tenta achar sem query string
            const fallbackCached = await caches.match(url.pathname);
            if (fallbackCached) {
                return fallbackCached;
            }

            // Retorna 204 No Content para não sujar o console com erros vermelhos de 404
            return new Response(null, { status: 204, statusText: 'No Content' });
        })
    );
});
