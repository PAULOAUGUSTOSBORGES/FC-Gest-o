// ==========================================================================
// FC-CACHE.JS — Repositório Local Persistente (IndexedDB) & Sincronização
// FC-Gestão · Versão 2.0 (Offline-First / Repositório Persistente)
// ==========================================================================
// 1. Armazena a base de dados completa localmente no PC e Celular (IndexedDB).
// 2. Carregamento instantâneo (< 20ms) de qualquer tela a partir do repositório local.
// 3. Reduz drasticamente as buscas e leituras no Firebase Firestore.
// 4. Sincronização sob demanda com botão no topo do cabeçalho.
// 5. Prevenção total contra duplicidade de vendas e transações (idempotência por UUID).
// ==========================================================================

(function () {
    'use strict';

    const DB_NAME = 'FC_GESTAO_LOCAL';
    const DB_VERSION = 1;
    const PREFIX = 'fc_repo_';
    const SESSION_PREFIX = 'fc_cache_';

    const PRINCIPAIS_COLECOES = [
        'produtos',
        'clientes',
        'fornecedores',
        'funcionarios',
        'categorias',
        'vendas',
        'financeiro',
        'compras',
        'movimentacoes',
        'notas_avulsas',
        'notas_devolucao',
        'notas_servico',
        'caixa_fechamentos'
    ];

    // TTL de segurança (em ms) apenas para fallback de sincronização automática leve se desejado
    const TTL = {
        'produtos':       30 * 60 * 1000,
        'clientes':       30 * 60 * 1000,
        'fornecedores':   60 * 60 * 1000,
        'funcionarios':   60 * 60 * 1000,
        'categorias':     60 * 60 * 1000,
        'vendas':         10 * 60 * 1000,
        'financeiro':     10 * 60 * 1000,
        'compras':        15 * 60 * 1000,
        'movimentacoes':  10 * 60 * 1000,
        'fc_moveis_config': 60 * 60 * 1000,
        'fc_moveis_caixa':   2 * 60 * 1000,
    };

    // Cache síncrono em memória estritamente isolado por empresa para resposta instantânea (< 1ms)
    const _memoriaPorEmpresa = {};
    const _listeners = {};
    const _syncStateListeners = [];
    let _isSyncing = false;
    let _dbPromise = null;

    // ----------------------------------------------------------------------
    // 1. Camada de IndexedDB (Armazenamento Persistente de Longo Prazo)
    // ----------------------------------------------------------------------

    function _obterEmpresaId() {
        try {
            return localStorage.getItem('fc_empresa_ativa') || '';
        } catch (e) {
            return '';
        }
    }

    function _getMemoria() {
        const empId = _obterEmpresaId() || '__sem_empresa__';
        if (!_memoriaPorEmpresa[empId]) {
            _memoriaPorEmpresa[empId] = {};
        }
        return _memoriaPorEmpresa[empId];
    }

    // Normaliza nomes legados de coleção/doc para compatibilidade
    function _normalizarColecao(col) {
        if (col === 'fc_moveis_config' || col === 'configuracoes') return 'config';
        if (col === 'fc_moveis_caixa') return 'caixa';
        return col;
    }

    // Proxy para _memoria que roteia automaticamente para a empresa ativa
    const _memoria = new Proxy({}, {
        get: function(target, prop) {
            const mem = _getMemoria();
            const norm = _normalizarColecao(prop);
            return mem[norm] !== undefined ? mem[norm] : mem[prop];
        },
        set: function(target, prop, value) {
            const mem = _getMemoria();
            const norm = _normalizarColecao(prop);
            mem[norm] = value;
            if (norm !== prop) mem[prop] = value;
            return true;
        },
        deleteProperty: function(target, prop) {
            const mem = _getMemoria();
            const norm = _normalizarColecao(prop);
            delete mem[norm];
            delete mem[prop];
            return true;
        },
        has: function(target, prop) {
            const mem = _getMemoria();
            const norm = _normalizarColecao(prop);
            return (norm in mem) || (prop in mem);
        },
        ownKeys: function() {
            return Object.keys(_getMemoria());
        },
        getOwnPropertyDescriptor: function(target, prop) {
            return Object.getOwnPropertyDescriptor(_getMemoria(), prop);
        }
    });

    function _chave(colecao) {
        const norm = _normalizarColecao(colecao);
        const empId = _obterEmpresaId();
        return empId ? (empId + '_' + norm) : norm;
    }

    function _abrirIndexedDB() {
        if (_dbPromise) return _dbPromise;

        _dbPromise = new Promise(function (resolve, reject) {
            if (typeof window === 'undefined' || !window.indexedDB) {
                console.warn('[FCRepo] IndexedDB não suportado neste navegador. Usando fallback de memória/storage.');
                return resolve(null);
            }

            try {
                const req = window.indexedDB.open(DB_NAME, DB_VERSION);

                req.onupgradeneeded = function (event) {
                    const db = event.target.result;

                    // Store de coleções locais completas
                    if (!db.objectStoreNames.contains('colecoes')) {
                        db.createObjectStore('colecoes', { keyPath: 'chave' });
                    }

                    // Store da fila de mutações pendentes (vendas offline, etc.)
                    if (!db.objectStoreNames.contains('fila_pendente')) {
                        const filaStore = db.createObjectStore('fila_pendente', { keyPath: 'uuid' });
                        filaStore.createIndex('empId', 'empId', { unique: false });
                        filaStore.createIndex('colecao', 'colecao', { unique: false });
                        filaStore.createIndex('status', 'status', { unique: false });
                    }

                    // Store de metadados gerais (última sincronização, timestamps)
                    if (!db.objectStoreNames.contains('metadados')) {
                        db.createObjectStore('metadados', { keyPath: 'chave' });
                    }
                };

                req.onsuccess = function (event) {
                    resolve(event.target.result);
                };

                req.onerror = function (event) {
                    console.warn('[FCRepo] Erro ao abrir IndexedDB:', event.target.error);
                    resolve(null); // Fallback suave para não quebrar o sistema
                };
            } catch (err) {
                console.warn('[FCRepo] Falha catastrófica ao inicializar IndexedDB:', err);
                resolve(null);
            }
        });

        return _dbPromise;
    }

    async function _idbSalvarColecao(colecao, dados) {
        try {
            const db = await _abrirIndexedDB();
            if (!db) return false;

            const chave = _chave(colecao);
            const empId = _obterEmpresaId();

            return new Promise(function (resolve) {
                try {
                    const tx = db.transaction('colecoes', 'readwrite');
                    const store = tx.objectStore('colecoes');
                    store.put({
                        chave: chave,
                        empId: empId,
                        colecao: colecao,
                        dados: dados,
                        ts: Date.now()
                    });
                    tx.oncomplete = function () { resolve(true); };
                    tx.onerror = function () { resolve(false); };
                } catch (e) {
                    resolve(false);
                }
            });
        } catch (e) {
            return false;
        }
    }

    async function _idbLerColecao(colecao) {
        try {
            const db = await _abrirIndexedDB();
            if (!db) return null;

            const chave = _chave(colecao);

            return new Promise(function (resolve) {
                try {
                    const tx = db.transaction('colecoes', 'readonly');
                    const store = tx.objectStore('colecoes');
                    const req = store.get(chave);
                    req.onsuccess = function () {
                        resolve(req.result ? req.result.dados : null);
                    };
                    req.onerror = function () { resolve(null); };
                } catch (e) {
                    resolve(null);
                }
            });
        } catch (e) {
            return null;
        }
    }

    async function _idbEnfileirar(colecao, docId, operacao, dados) {
        try {
            const db = await _abrirIndexedDB();
            if (!db) return false;

            const empId = _obterEmpresaId();
            // Identificador único composto: previne duplicidade garantindo chave primária exata
            const uuid = `${empId}_${colecao}_${docId}`;

            return new Promise(function (resolve) {
                try {
                    const tx = db.transaction('fila_pendente', 'readwrite');
                    const store = tx.objectStore('fila_pendente');
                    store.put({
                        uuid: uuid,
                        empId: empId,
                        colecao: colecao,
                        docId: String(docId),
                        operacao: operacao || 'set', // 'set', 'update', 'delete'
                        dados: dados || {},
                        status: 'pendente',
                        criadoEm: new Date().toISOString()
                    });
                    tx.oncomplete = function () {
                        _atualizarBadgePendencias();
                        resolve(true);
                    };
                    tx.onerror = function () { resolve(false); };
                } catch (e) {
                    resolve(false);
                }
            });
        } catch (e) {
            return false;
        }
    }

    async function _idbRemoverDaFila(colecao, docId) {
        try {
            const db = await _abrirIndexedDB();
            if (!db) return false;

            const empId = _obterEmpresaId();
            const uuid = `${empId}_${colecao}_${docId}`;

            return new Promise(function (resolve) {
                try {
                    const tx = db.transaction('fila_pendente', 'readwrite');
                    const store = tx.objectStore('fila_pendente');
                    store.delete(uuid);
                    tx.oncomplete = function () {
                        _atualizarBadgePendencias();
                        resolve(true);
                    };
                    tx.onerror = function () { resolve(false); };
                } catch (e) {
                    resolve(false);
                }
            });
        } catch (e) {
            return false;
        }
    }

    async function _idbListarFila() {
        try {
            const db = await _abrirIndexedDB();
            if (!db) return [];

            const empId = _obterEmpresaId();

            return new Promise(function (resolve) {
                try {
                    const tx = db.transaction('fila_pendente', 'readonly');
                    const store = tx.objectStore('fila_pendente');
                    const req = store.getAll();
                    req.onsuccess = function () {
                        const todos = req.result || [];
                        const filtrados = todos.filter(item => item.empId === empId);
                        resolve(filtrados);
                    };
                    req.onerror = function () { resolve([]); };
                } catch (e) {
                    resolve([]);
                }
            });
        } catch (e) {
            return [];
        }
    }

    async function _idbSalvarMeta(chave, valor) {
        try {
            const db = await _abrirIndexedDB();
            if (!db) return false;

            return new Promise(function (resolve) {
                try {
                    const tx = db.transaction('metadados', 'readwrite');
                    const store = tx.objectStore('metadados');
                    store.put({ chave: chave, valor: valor, ts: Date.now() });
                    tx.oncomplete = function () { resolve(true); };
                    tx.onerror = function () { resolve(false); };
                } catch (e) {
                    resolve(false);
                }
            });
        } catch (e) {
            return false;
        }
    }

    async function _idbLerMeta(chave) {
        try {
            const db = await _abrirIndexedDB();
            if (!db) return null;

            return new Promise(function (resolve) {
                try {
                    const tx = db.transaction('metadados', 'readonly');
                    const store = tx.objectStore('metadados');
                    const req = store.get(chave);
                    req.onsuccess = function () {
                        resolve(req.result ? req.result.valor : null);
                    };
                    req.onerror = function () { resolve(null); };
                } catch (e) {
                    resolve(null);
                }
            });
        } catch (e) {
            return null;
        }
    }

    // ----------------------------------------------------------------------
    // 2. Camada de Memória e SessionStorage Síncrono (Acesso Imediato < 1ms)
    // ----------------------------------------------------------------------

    function _sessionChave(colecao) {
        return SESSION_PREFIX + _chave(colecao);
    }

    function _salvarSession(colecao, dados) {
        try {
            if (typeof sessionStorage === 'undefined') return;

            let dadosParaSalvar = dados;
            // Otimização: remove fotos pesadas em base64 do cache de produtos do sessionStorage
            if (colecao === 'produtos' && Array.isArray(dados)) {
                dadosParaSalvar = dados.map(p => {
                    let copy = null;
                    if (p.foto && typeof p.foto === 'string' && p.foto.length > 500) {
                        copy = copy || Object.assign({}, p);
                        delete copy.foto;
                    }
                    if (p.fotos && Array.isArray(p.fotos)) {
                        copy = copy || Object.assign({}, p);
                        delete copy.fotos;
                    }
                    return copy || p;
                });
            }

            const payload = JSON.stringify({
                ts: Date.now(),
                dados: dadosParaSalvar
            });
            if (payload.length < 4 * 1024 * 1024) {
                sessionStorage.setItem(_sessionChave(colecao), payload);
            }
        } catch (e) {}
    }

    function _lerSession(colecao) {
        try {
            if (typeof sessionStorage === 'undefined') return null;
            const raw = sessionStorage.getItem(_sessionChave(colecao));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed ? parsed.dados : null;
        } catch (e) {
            return null;
        }
    }

    // Pré-carrega de imediato da sessionStorage para memória se disponível
    PRINCIPAIS_COLECOES.forEach(function (col) {
        const dados = _lerSession(col);
        if (dados !== null) {
            _memoria[col] = dados;
        }
    });
    const cfgInit = _lerSession('fc_moveis_config');
    if (cfgInit) _memoria['fc_moveis_config'] = cfgInit;
    const cxInit = _lerSession('fc_moveis_caixa');
    if (cxInit) _memoria['fc_moveis_caixa'] = cxInit;

    // ----------------------------------------------------------------------
    // 3. Notificação de Listeners & Gestão de Estado
    // ----------------------------------------------------------------------

    function _notificarListeners(colecao, dados) {
        if (!_listeners[colecao]) return;
        _listeners[colecao].forEach(function (cb) {
            try {
                cb(dados);
            } catch (err) {
                console.error(`[FCRepo] Erro no listener da coleção "${colecao}":`, err);
            }
        });
    }

    function _notificarSyncState(estado) {
        _syncStateListeners.forEach(function (cb) {
            try { cb(estado); } catch (e) {}
        });

        // Evento customizado DOM para componentes independentes
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('fc-sync-state', { detail: estado }));
        }

        // Atualização visual imediata do botão no header
        _atualizarBotaoHeader(estado);
    }

    async function _atualizarBadgePendencias() {
        const fila = await _idbListarFila();
        const total = fila.length;
        const badge = document.getElementById('header-btn-sync-badge');
        if (badge) {
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.classList.remove('hidden');
                badge.title = `${total} alteração(ões) pendente(s) de sincronização`;
            } else {
                badge.classList.add('hidden');
            }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('fc-sync-pendencias', { detail: { total: total } }));
        }
        return total;
    }

    function _atualizarBotaoHeader(estado) {
        const btn = document.getElementById('header-btn-sync');
        const txt = document.getElementById('header-btn-sync-text');
        const icon = document.getElementById('header-btn-sync-icon');

        if (!btn || !txt || !icon) return;

        if (estado && estado.syncing) {
            txt.textContent = 'SINCRONIZANDO...';
            icon.classList.add('fa-spin');
            btn.disabled = true;
            btn.classList.add('opacity-85', 'cursor-wait');
        } else {
            txt.textContent = 'SINCRONIZAR';
            icon.classList.remove('fa-spin');
            btn.disabled = false;
            btn.classList.remove('opacity-85', 'cursor-wait');
        }
    }

    // ----------------------------------------------------------------------
    // 4. Inicialização Assíncrona & Hidratação do Repositório Local
    // ----------------------------------------------------------------------

    async function _carregarTudoDoIndexedDB() {
        const empId = _obterEmpresaId();
        if (!empId) {
            console.log('[FCRepo] Nenhuma empresa ativa definida no momento. Carga do repositório adiada.');
            return;
        }

        try {
            const promessas = PRINCIPAIS_COLECOES.map(async function (col) {
                const dados = await _idbLerColecao(col);
                if (dados !== null && Array.isArray(dados)) {
                    _memoria[col] = dados;
                    if (typeof window.db !== 'undefined') {
                        window.db[col] = dados;
                        if (col === 'produtos' && dados.length > 0) {
                            window._produtosCarregados = true;
                        }
                    }
                    _notificarListeners(col, dados);
                }
            });

            // Carrega docs especiais da empresa ativa
            promessas.push((async function () {
                const cfg = await _idbLerColecao('config');
                if (cfg) {
                    _memoria['config'] = cfg;
                    _memoria['fc_moveis_config'] = cfg;
                    if (typeof window.db !== 'undefined') window.db.config = cfg;
                    _notificarListeners('config', cfg);
                    _notificarListeners('fc_moveis_config', cfg);
                }
            })());

            promessas.push((async function () {
                const cx = await _idbLerColecao('caixa');
                if (cx) {
                    _memoria['caixa'] = cx;
                    _memoria['fc_moveis_caixa'] = cx;
                    if (typeof window.db !== 'undefined') window.db.caixa = cx;
                    _notificarListeners('caixa', cx);
                    _notificarListeners('fc_moveis_caixa', cx);
                }
            })());

            await Promise.all(promessas);
            _atualizarBadgePendencias();
            console.log(`[FCRepo] ⚡ Repositório Local carregado instantaneamente do IndexedDB para a empresa [${empId}].`);

            // Se for a primeira vez neste dispositivo (nunca sincronizado), realiza carga inicial silenciosa
            const ultimaSinc = await _idbLerMeta('ultima_sincronizacao');
            if (!ultimaSinc && !localStorage.getItem('fc_ultima_sincronizacao')) {
                console.log('[FCRepo] 🚀 Primeira inicialização detectada. Baixando banco de dados completo em segundo plano...');
                setTimeout(function () {
                    sincronizarComFirebase(true);
                }, 1000);
            }
        } catch (err) {
            console.warn('[FCRepo] Erro ao carregar do IndexedDB:', err);
        }
    }

    // Dispara carregamento assíncrono em background de imediato apenas se houver empresa ativa
    if (typeof window !== 'undefined' && _obterEmpresaId()) {
        _carregarTudoDoIndexedDB();
    }

    // ----------------------------------------------------------------------
    // 5. Motor de Sincronização Inteligente (PUSH + PULL + Zero Duplicidade)
    // ----------------------------------------------------------------------

    async function sincronizarComFirebase(silencioso) {
        if (_isSyncing) {
            console.warn('[FCRepo] Sincronização já em andamento. Aguarde...');
            return false;
        }

        if (typeof firestore === 'undefined') {
            console.error('[FCRepo] Firestore não disponível para sincronização.');
            if (!silencioso && typeof window.showToast === 'function') {
                window.showToast('Erro: Conexão com Firebase indisponível.', 'error');
            }
            return false;
        }

        _isSyncing = true;
        _notificarSyncState({ syncing: true, progresso: 'Iniciando sincronização...' });

        try {
            let empRef;
            if (typeof window.getEmpresaRef === 'function') {
                empRef = window.getEmpresaRef();
            } else {
                const empId = _obterEmpresaId();
                empRef = firestore.collection('empresas').doc(empId);
            }

            // --------------------------------------------------------------
            // FASE 1: PUSH — Enviar Fila Pendente (Vendas, Atualizações Offline)
            // --------------------------------------------------------------
            const fila = await _idbListarFila();
            if (fila.length > 0) {
                console.log(`[FCRepo] 📤 Enviando ${fila.length} mutação(ões) pendente(s) ao Firebase...`);

                for (let i = 0; i < fila.length; i++) {
                    const item = fila[i];
                    try {
                        let refDoc;
                        if (item.colecao === 'fc_moveis_caixa' || item.colecao === 'caixa') {
                            refDoc = empRef.collection('caixa').doc('caixa_atual');
                        } else if (item.colecao === 'fc_moveis_config' || item.colecao === 'configuracoes') {
                            refDoc = empRef.collection('configuracoes').doc('config');
                        } else {
                            refDoc = empRef.collection(item.colecao).doc(String(item.docId));
                        }

                        if (item.operacao === 'delete') {
                            await refDoc.delete();
                        } else {
                            // Prevenção de conflito de numeração de venda na subida para a nuvem
                            if (item.colecao === 'vendas' && item.dados && item.dados.numeroPedido) {
                                try {
                                    const conflitoSnap = await empRef.collection('vendas')
                                        .where('numeroPedido', '==', item.dados.numeroPedido)
                                        .get();
                                    const outroDoc = conflitoSnap.docs.find(d => d.id !== String(item.docId));
                                    if (outroDoc) {
                                        // Conflito detectado! Renumera para o próximo número livre
                                        const topoSnap = await empRef.collection('vendas').orderBy('numeroPedido', 'desc').limit(1).get();
                                        const topoNum = topoSnap.empty ? 1 : (Number(topoSnap.docs[0].data().numeroPedido) || 0);
                                        const novoNum = topoNum + 1;
                                        const velhoStr = String(item.dados.numeroPedido).padStart(4, '0');
                                        const novoStr = String(novoNum).padStart(4, '0');

                                        console.warn(`[FCRepo] ⚠️ Conflito de numeração evitado na nuvem: Pedido #${velhoStr} readequado para #${novoNumStr}`);

                                        item.dados.numeroPedido = novoNum;
                                        if (item.dados.ref) {
                                            item.dados.ref = item.dados.ref.replace(new RegExp('#' + velhoStr, 'g'), '#' + novoStr);
                                        }
                                        if (typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) {
                                            const vLocal = window.db.vendas.find(x => String(x.id) === String(item.docId));
                                            if (vLocal) vLocal.numeroPedido = novoNum;
                                        }
                                    }
                                } catch (confErr) {
                                    console.warn('[FCRepo] Verificação de conflito de numeração ignorada:', confErr);
                                }
                            }

                            // IDEMPOTÊNCIA TOTAL: .set com { merge: true } garante que o mesmo docId
                            // jamais será duplicado, mesmo que a sincronização seja disparada repetidamente.
                            await refDoc.set(item.dados, { merge: true });
                        }

                        // Remove da fila pendente após envio bem-sucedido
                        await _idbRemoverDaFila(item.colecao, item.docId);
                    } catch (pushErr) {
                        console.error(`[FCRepo] Falha ao enviar item pendente (${item.uuid}):`, pushErr);
                        // Mantém na fila para tentar novamente na próxima sincronização
                    }
                }
            }

            // --------------------------------------------------------------
            // FASE 2: PULL — Baixar Atualizações Remotas do Firestore
            // --------------------------------------------------------------
            console.log('[FCRepo] 📥 Baixando dados atualizados do Firebase Firestore...');

            const pullPromessas = PRINCIPAIS_COLECOES.map(async function (col) {
                try {
                    const snap = await empRef.collection(col).get();
                    const docsRemotos = snap.docs.map(function (doc) {
                        return Object.assign({ id: doc.id }, doc.data());
                    });

                    // Deduplicação estrita via Map por ID único
                    const mapa = new Map();
                    docsRemotos.forEach(function (doc) {
                        if (doc && doc.id) {
                            mapa.set(String(doc.id), doc);
                        }
                    });

                    // Preserva mutações pendentes locais que ainda não foram sincronizadas
                    const filaAtual = await _idbListarFila();
                    filaAtual.filter(f => f.colecao === col).forEach(function (f) {
                        if (f.operacao === 'delete') {
                            mapa.delete(String(f.docId));
                        } else if (f.dados) {
                            mapa.set(String(f.docId), Object.assign({ id: f.docId }, f.dados));
                        }
                    });

                    const deduplicado = Array.from(mapa.values());
                    if (col === 'vendas') {
                        deduplicado.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
                    }

                    // Salva nas 3 camadas: Memória, Session e IndexedDB
                    _memoria[col] = deduplicado;
                    _salvarSession(col, deduplicado);
                    await _idbSalvarColecao(col, deduplicado);

                    if (typeof window.db !== 'undefined') {
                        window.db[col] = deduplicado;
                        if (col === 'produtos') window._produtosCarregados = true;
                    }

                    // Notifica a tela que estiver aberta
                    _notificarListeners(col, deduplicado);
                } catch (colErr) {
                    console.warn(`[FCRepo] Erro ao sincronizar coleção "${col}":`, colErr);
                }
            });

            // Baixa doc de caixa
            pullPromessas.push((async function () {
                try {
                    const cxSnap = await empRef.collection('caixa').doc('caixa_atual').get();
                    if (cxSnap.exists) {
                        const cxData = cxSnap.data();
                        _memoria['fc_moveis_caixa'] = cxData;
                        _salvarSession('fc_moveis_caixa', cxData);
                        await _idbSalvarColecao('fc_moveis_caixa', cxData);
                        if (typeof window.db !== 'undefined') window.db.caixa = cxData;
                        _notificarListeners('fc_moveis_caixa', cxData);
                    }
                } catch (e) {}
            })());

            // Baixa doc de configurações
            pullPromessas.push((async function () {
                try {
                    const cfgSnap = await empRef.collection('configuracoes').doc('config').get();
                    if (cfgSnap.exists) {
                        const cfgData = cfgSnap.data();
                        _memoria['fc_moveis_config'] = cfgData;
                        _salvarSession('fc_moveis_config', cfgData);
                        await _idbSalvarColecao('fc_moveis_config', cfgData);
                        if (typeof window.db !== 'undefined') window.db.config = cfgData;
                        _notificarListeners('fc_moveis_config', cfgData);
                    }
                } catch (e) {}
            })());

            await Promise.all(pullPromessas);

            // --------------------------------------------------------------
            // FASE 3: Conclusão e Feedback
            // --------------------------------------------------------------
            const agoraIso = new Date().toISOString();
            await _idbSalvarMeta('ultima_sincronizacao', agoraIso);
            try {
                localStorage.setItem('fc_ultima_sincronizacao', agoraIso);
            } catch (e) {}

            await _atualizarBadgePendencias();

            _isSyncing = false;
            _notificarSyncState({ syncing: false, sucesso: true, timestamp: agoraIso });

            console.log('[FCRepo] ✅ Sincronização com Firebase concluída com sucesso!');

            if (!silencioso && typeof window.showToast === 'function') {
                window.showToast('Banco de dados sincronizado com sucesso!', 'success');
            }

            return true;
        } catch (errGeral) {
            console.error('[FCRepo] Erro durante a sincronização:', errGeral);
            _isSyncing = false;
            _notificarSyncState({ syncing: false, erro: errGeral.message });

            if (!silencioso && typeof window.showToast === 'function') {
                window.showToast('Erro ao sincronizar. Seus dados continuam salvos no dispositivo.', 'warning');
            }
            return false;
        }
    }

    // ----------------------------------------------------------------------
    // 6. API Pública: window.FCCache (Compatibilidade Retroativa Total)
    // ----------------------------------------------------------------------

    window.FCCache = {
        /**
         * Verifica se o cache da coleção existe e está pronto
         */
        isValido: function (colecao) {
            const val = _memoria[colecao];
            if (val !== undefined && val !== null) {
                if (Array.isArray(val)) return true;
                if (typeof val === 'object') return true;
            }
            const sess = _lerSession(colecao);
            return sess !== null;
        },

        /**
         * Obtém dados síncronos da coleção
         */
        get: function (colecao) {
            if (_memoria[colecao] !== undefined) {
                return _memoria[colecao];
            }
            const sess = _lerSession(colecao);
            if (sess !== null) {
                _memoria[colecao] = sess;
                return sess;
            }
            return null;
        },

        /**
         * Grava dados na memória, session e persiste no IndexedDB
         */
        set: function (colecao, dados) {
            _memoria[colecao] = dados;
            _salvarSession(colecao, dados);
            _idbSalvarColecao(colecao, dados);
        },

        /**
         * Invalida uma coleção do repositório
         */
        invalidar: function (colecao) {
            delete _memoria[colecao];
            try {
                sessionStorage.removeItem(_sessionChave(colecao));
            } catch (e) {}
            _idbSalvarColecao(colecao, null);
        },

        /**
         * Limpa todo o repositório local
         */
        invalidarTudo: async function () {
            Object.keys(_memoriaPorEmpresa).forEach(k => delete _memoriaPorEmpresa[k]);
            try {
                const chaves = Object.keys(sessionStorage).filter(k => k.startsWith(SESSION_PREFIX));
                chaves.forEach(k => sessionStorage.removeItem(k));
            } catch (e) {}
            try {
                const db = await _abrirIndexedDB();
                if (db) {
                    const tx = db.transaction(['colecoes', 'fila_pendente', 'metadados'], 'readwrite');
                    tx.objectStore('colecoes').clear();
                    tx.objectStore('fila_pendente').clear();
                    tx.objectStore('metadados').clear();
                }
            } catch (idbErr) {
                console.warn('[FCRepo] Erro ao limpar IndexedDB em invalidarTudo:', idbErr);
            }
            console.log('[FCRepo] Repositório e IndexedDB limpos completamente.');
        },

        /**
         * Estatísticas de uso do repositório local
         */
        stats: async function () {
            const fila = await _idbListarFila();
            const meta = await _idbLerMeta('ultima_sincronizacao');
            const stats = {};

            PRINCIPAIS_COLECOES.forEach(col => {
                const dados = _memoria[col] || [];
                stats[col] = {
                    quantidade: Array.isArray(dados) ? dados.length : (dados ? 1 : 0),
                    emMemoria: !!_memoria[col]
                };
            });

            console.group('[FCRepo] Status do Repositório Local (IndexedDB)');
            console.table(stats);
            console.log('Pendências na fila:', fila.length);
            console.log('Última sincronização:', meta || localStorage.getItem('fc_ultima_sincronizacao') || 'Nunca');
            console.groupEnd();
            return { colecoes: stats, pendencias: fila.length, ultimaSinc: meta };
        },

        /**
         * Enfileira uma mutação pendente (para vendas ou cadastros offline)
         */
        enfileirarOperacao: function (colecao, docId, operacao, dados) {
            return _idbEnfileirar(colecao, docId, operacao, dados);
        },

        /**
         * Salva otimisticamente um item: atualiza memória viva, cache local e enfileira na fila offline
         */
        salvarOtimista: async function (colecao, docId, dados, operacao = 'set') {
            const idStr = String(docId);
            // 1. Atualiza memória global window.db
            if (typeof window.db !== 'undefined' && Array.isArray(window.db[colecao])) {
                const idx = window.db[colecao].findIndex(x => String(x.id) === idStr);
                if (idx >= 0) {
                    window.db[colecao][idx] = Object.assign({}, window.db[colecao][idx], dados, { id: docId });
                } else {
                    window.db[colecao].unshift(Object.assign({ id: docId }, dados));
                }
            }
            // 2. Atualiza memória interna _memoria, session e IndexedDB
            if (Array.isArray(_memoria[colecao])) {
                const idx = _memoria[colecao].findIndex(x => String(x.id) === idStr);
                if (idx >= 0) {
                    _memoria[colecao][idx] = Object.assign({}, _memoria[colecao][idx], dados, { id: docId });
                } else {
                    _memoria[colecao].unshift(Object.assign({ id: docId }, dados));
                }
                _salvarSession(colecao, _memoria[colecao]);
                await _idbSalvarColecao(colecao, _memoria[colecao]);
            }
            // 3. Enfileira operação na fila pendente para garantir persistência offline e contra concorrência
            await _idbEnfileirar(colecao, docId, operacao, dados);
            _atualizarBadgePendencias();
        },

        /**
         * Remove da fila pendente após confirmação de gravação
         */
        removerDaFila: function (colecao, docId) {
            return _idbRemoverDaFila(colecao, docId);
        },

        /**
         * Atualiza ou insere um item nas camadas de cache (memória, session e IndexedDB)
         */
        atualizarItem: async function (colecao, docId, dados) {
            const idStr = String(docId);
            if (typeof window.db !== 'undefined' && Array.isArray(window.db[colecao])) {
                const idx = window.db[colecao].findIndex(x => String(x.id) === idStr);
                if (idx >= 0) {
                    window.db[colecao][idx] = Object.assign({}, window.db[colecao][idx], dados, { id: docId });
                } else {
                    window.db[colecao].unshift(Object.assign({ id: docId }, dados));
                }
            }
            if (Array.isArray(_memoria[colecao])) {
                const idx = _memoria[colecao].findIndex(x => String(x.id) === idStr);
                if (idx >= 0) {
                    _memoria[colecao][idx] = Object.assign({}, _memoria[colecao][idx], dados, { id: docId });
                } else {
                    _memoria[colecao].unshift(Object.assign({ id: docId }, dados));
                }
                _salvarSession(colecao, _memoria[colecao]);
                await _idbSalvarColecao(colecao, _memoria[colecao]);
            }
            _notificarListeners(colecao, _memoria[colecao] || (window.db ? window.db[colecao] : []));
        },

        /**
         * Remove um item das camadas de cache (memória, session e IndexedDB)
         */
        removerItem: async function (colecao, docId) {
            const idStr = String(docId);
            if (typeof window.db !== 'undefined' && Array.isArray(window.db[colecao])) {
                window.db[colecao] = window.db[colecao].filter(x => String(x.id) !== idStr);
            }
            if (Array.isArray(_memoria[colecao])) {
                _memoria[colecao] = _memoria[colecao].filter(x => String(x.id) !== idStr);
                _salvarSession(colecao, _memoria[colecao]);
                await _idbSalvarColecao(colecao, _memoria[colecao]);
            }
            await _idbRemoverDaFila(colecao, docId);
            _notificarListeners(colecao, _memoria[colecao] || (window.db ? window.db[colecao] : []));
        },

        /**
         * Retorna se a sincronização está em andamento
         */
        isSyncing: function () {
            return _isSyncing;
        },

        /**
         * Retorna total de itens pendentes na fila
         */
        obterTotalPendentes: function () {
            return _atualizarBadgePendencias();
        },

        /**
         * Retorna data da última sincronização
         */
        obterUltimaSincronizacao: function () {
            return _idbLerMeta('ultima_sincronizacao');
        },

        /**
         * Dispara a sincronização sob demanda
         */
        sincronizarComFirebase: function (silencioso) {
            return sincronizarComFirebase(silencioso);
        },

        /**
         * Registra observador de mudanças no estado da sincronização
         */
        onSyncStateChange: function (callback) {
            if (typeof callback === 'function') {
                _syncStateListeners.push(callback);
            }
        },

        /**
         * Força recarregamento de todas as coleções do IndexedDB para memória
         */
        carregarTudoDoIndexedDB: function () {
            return _carregarTudoDoIndexedDB();
        }
    };

    // ----------------------------------------------------------------------
    // 7. Numeração de Pedido Segura (Prevenção Total de Conflito de Numeração)
    // ----------------------------------------------------------------------
    window.obterProximoNumeroPedidoSeguro = async function () {
        let maxLocal = 0;
        if (typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) {
            maxLocal = window.db.vendas.reduce((max, v) => Math.max(max, Number(v.numeroPedido) || 0), 0);
        }
        if (Array.isArray(_memoria['vendas'])) {
            const maxMem = _memoria['vendas'].reduce((max, v) => Math.max(max, Number(v.numeroPedido) || 0), 0);
            maxLocal = Math.max(maxLocal, maxMem);
        }

        // Verifica na fila pendente local
        let maxFila = 0;
        try {
            const fila = await _idbListarFila();
            fila.forEach(item => {
                if (item.colecao === 'vendas' && item.dados && item.dados.numeroPedido) {
                    maxFila = Math.max(maxFila, Number(item.dados.numeroPedido) || 0);
                }
            });
        } catch (e) {}

        // Se estiver online, consulta o maior número real no Firestore
        let maxRemoto = 0;
        if (navigator.onLine && typeof firestore !== 'undefined') {
            try {
                let empRef = (typeof window.getEmpresaRef === 'function') ? window.getEmpresaRef() : firestore.collection('empresas').doc(_obterEmpresaId());
                const snap = await empRef.collection('vendas').orderBy('numeroPedido', 'desc').limit(1).get();
                if (!snap.empty) {
                    maxRemoto = Number(snap.docs[0].data().numeroPedido) || 0;
                }
            } catch (err) {
                console.warn('[FCRepo] Maior número do Firestore indisponível offline:', err);
            }
        }

        const proximo = Math.max(maxLocal, maxFila, maxRemoto) + 1;
        console.log(`[FCRepo] 🔢 Próximo Pedido Calculado: #${proximo} (Local: ${maxLocal}, Fila: ${maxFila}, Nuvem: ${maxRemoto})`);
        return proximo;
    };
    window.FCCache.obterProximoNumeroPedido = window.obterProximoNumeroPedidoSeguro;

    // ----------------------------------------------------------------------
    // 8. Revalidação e Atualização Remota em Segundo Plano (Stale-While-Revalidate)
    // ----------------------------------------------------------------------
    const _ultimaAtualizacaoRemota = {};

    function _buscarAtualizacaoRemota(colecao, opcoes) {
        if (typeof firestore === 'undefined' || !navigator.onLine) return;

        // Throttle de 2 segundos para evitar rajadas na mesma coleção
        const agora = Date.now();
        if (_ultimaAtualizacaoRemota[colecao] && (agora - _ultimaAtualizacaoRemota[colecao]) < 2000) {
            return;
        }
        _ultimaAtualizacaoRemota[colecao] = agora;

        let ref;
        if (typeof window.getEmpresaRef === 'function') {
            ref = window.getEmpresaRef().collection(colecao);
        } else {
            ref = firestore.collection(colecao);
        }
        if (opcoes && typeof opcoes.query === 'function') {
            ref = opcoes.query(ref);
        }

        ref.get().then(async function (snap) {
            const docsRemotos = snap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));

            // Mescla com itens locais pendentes para NUNCA perder vendas feitas offline
            const fila = await _idbListarFila();
            const pendentesDestaCol = fila.filter(item => item.colecao === colecao);

            const mapa = new Map();
            // 1. Dados remotos da nuvem
            docsRemotos.forEach(d => { if (d && d.id) mapa.set(String(d.id), d); });
            // 2. Mescla pendências locais (têm prioridade visual)
            pendentesDestaCol.forEach(p => {
                if (p.operacao === 'delete') {
                    mapa.delete(String(p.docId));
                } else if (p.dados) {
                    mapa.set(String(p.docId), Object.assign({ id: p.docId }, p.dados));
                }
            });

            const dadosCompletos = Array.from(mapa.values());
            if (colecao === 'vendas') {
                dadosCompletos.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
            }

            _memoria[colecao] = dadosCompletos;
            _salvarSession(colecao, dadosCompletos);
            _idbSalvarColecao(colecao, dadosCompletos);
            if (typeof window.db !== 'undefined') {
                window.db[colecao] = dadosCompletos;
                if (colecao === 'produtos') window._produtosCarregados = true;
            }

            // Notifica listeners com a lista COMPLETA de vendas/produtos
            _notificarListeners(colecao, dadosCompletos);
        }).catch(function (err) {
            console.warn(`[FCRepo] Não foi possível atualizar "${colecao}" da nuvem (modo offline mantido):`, err);
        });
    }

    // ----------------------------------------------------------------------
    // 9. fcListenCollection — Wrapper com Entrega Instantânea e Lista Completa
    // ----------------------------------------------------------------------
    window.fcListenCollection = function (colecao, callback, opcoes) {
        opcoes = opcoes || {};

        if (typeof callback !== 'function') {
            return function () {};
        }

        // Registra o listener para receber atualizações quando ocorrer sincronização
        if (!_listeners[colecao]) {
            _listeners[colecao] = [];
        }
        _listeners[colecao].push(callback);

        // 1. Tenta servir da memória imediatamente (síncrono, 0ms)
        const emMemoria = _memoria[colecao];
        if (emMemoria !== undefined && emMemoria !== null && !opcoes.semCache) {
            try {
                callback(emMemoria);
            } catch (e) {
                console.error('[FCRepo] Erro ao servir da memória para "' + colecao + '":', e);
            }
            // Dispara revalidação em background para sempre garantir que a lista completa venha da nuvem
            _buscarAtualizacaoRemota(colecao, opcoes);
        } else {
            // 2. Tenta ler do IndexedDB (assíncrono, ~15ms)
            _idbLerColecao(colecao).then(function (dadosIdb) {
                if (dadosIdb !== null && !opcoes.semCache) {
                    _memoria[colecao] = dadosIdb;
                    try {
                        callback(dadosIdb);
                    } catch (e) {
                        console.error('[FCRepo] Erro ao servir do IndexedDB para "' + colecao + '":', e);
                    }
                    _buscarAtualizacaoRemota(colecao, opcoes);
                } else {
                    _buscarAtualizacaoRemota(colecao, opcoes);
                }
            });
        }

        // Se a chamada exigir explicitamente escuta em tempo real (opções.realtime === true)
        let unsubFirestore = null;
        if (opcoes.realtime && typeof firestore !== 'undefined') {
            let ref;
            if (typeof window.getEmpresaRef === 'function') {
                ref = window.getEmpresaRef().collection(colecao);
            } else {
                ref = firestore.collection(colecao);
            }
            if (typeof opcoes.query === 'function') {
                ref = opcoes.query(ref);
            }
            unsubFirestore = ref.onSnapshot(function (snap) {
                const dados = snap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));
                _memoria[colecao] = dados;
                _salvarSession(colecao, dados);
                _idbSalvarColecao(colecao, dados);
                try {
                    callback(dados);
                } catch (e) {}
            }, function (err) {
                console.error('[FCRepo] Erro no listener realtime de "' + colecao + '":', err);
            });
        }

        // Função para cancelar o listener
        return function unsubscribe() {
            if (_listeners[colecao]) {
                const idx = _listeners[colecao].indexOf(callback);
                if (idx >= 0) _listeners[colecao].splice(idx, 1);
            }
            if (typeof unsubFirestore === 'function') {
                unsubFirestore();
            }
        };
    };

    // ----------------------------------------------------------------------
    // 8. fcListenDoc — Wrapper para Documentos Únicos (Caixa, Config)
    // ----------------------------------------------------------------------
    window.fcListenDoc = function (colecao, docId, callback, semCache) {
        if (typeof callback !== 'function') return function () {};

        // Normalização estrita para subcoleções multi-tenant da empresa ativa
        let normalCol = colecao;
        let normalDoc = docId;
        if (colecao === 'fc_moveis' && (docId === 'config' || docId === 'config_loja')) {
            normalCol = 'configuracoes';
            normalDoc = 'config';
        } else if (colecao === 'fc_moveis' && docId === 'caixa') {
            normalCol = 'caixa';
            normalDoc = 'caixa_atual';
        } else if (colecao === 'config') {
            normalCol = 'configuracoes';
            normalDoc = 'config';
        }

        const cacheKey = normalCol + '_' + normalDoc;

        if (!_listeners[cacheKey]) {
            _listeners[cacheKey] = [];
        }
        _listeners[cacheKey].push(callback);

        // 1. Entrega instantânea da memória isolada da empresa ativa se existir
        if (!semCache && _memoria[cacheKey] !== undefined && _memoria[cacheKey] !== null) {
            try {
                callback(_memoria[cacheKey]);
            } catch (e) {}
        } else if (!semCache) {
            // Tenta sessionStorage ou IndexedDB
            const sess = _lerSession(cacheKey);
            if (sess !== null) {
                _memoria[cacheKey] = sess;
                try { callback(sess); } catch (e) {}
            } else {
                _idbLerColecao(cacheKey).then(function (dadosIdb) {
                    if (dadosIdb !== null && !semCache) {
                        _memoria[cacheKey] = dadosIdb;
                        try { callback(dadosIdb); } catch (e) {}
                    }
                });
            }
        }

        // 2. Conecta listener em tempo real garantindo o escopo da empresa ativa
        let unsubFirestore = null;
        if (typeof firestore !== 'undefined') {
            let ref;
            if (typeof window.getEmpresaRef === 'function') {
                if (normalCol === 'caixa' && normalDoc === 'caixa_atual') {
                    ref = typeof window.obterCaixaDocRef === 'function' ? window.obterCaixaDocRef() : window.getEmpresaRef().collection('caixa').doc('caixa_atual');
                } else {
                    ref = window.getEmpresaRef().collection(normalCol).doc(normalDoc);
                }
            } else {
                const empId = _obterEmpresaId();
                if (empId) {
                    ref = firestore.collection('empresas').doc(empId).collection(normalCol).doc(normalDoc);
                } else {
                    ref = firestore.collection(normalCol).doc(normalDoc);
                }
            }

            try {
                unsubFirestore = ref.onSnapshot(function (doc) {
                    const dados = doc.exists ? doc.data() : null;
                    _memoria[cacheKey] = dados;
                    _salvarSession(cacheKey, dados);
                    _idbSalvarColecao(cacheKey, dados);
                    if (normalCol === 'configuracoes' && normalDoc === 'config' && typeof window.db !== 'undefined' && dados) {
                        window.db.config = { ...window.db.config, ...dados };
                    }
                    if (normalCol === 'caixa' && normalDoc === 'caixa_atual' && typeof window.db !== 'undefined' && dados) {
                        window.db.caixa = dados;
                    }
                    try { callback(dados); } catch (e) {}
                }, function (err) {
                    console.warn('[FCRepo] Erro no listener do doc ' + cacheKey + ':', err);
                });
            } catch (errSnap) {
                console.warn('[FCRepo] Falha ao iniciar snapshot do doc ' + cacheKey + ':', errSnap);
            }
        }

        return function unsubscribe() {
            if (_listeners[cacheKey]) {
                const idx = _listeners[cacheKey].indexOf(callback);
                if (idx >= 0) _listeners[cacheKey].splice(idx, 1);
            }
            if (typeof unsubFirestore === 'function') {
                unsubFirestore();
            }
        };
    };

    // Alias global para compatibilidade retroativa com telas que chamam fcListen
    window.fcListen = window.fcListenCollection;

    // ----------------------------------------------------------------------
    // 9. Hidratação Instantânea de `window.db`
    // ----------------------------------------------------------------------
    if (typeof window.db !== 'undefined' && _obterEmpresaId()) {
        PRINCIPAIS_COLECOES.forEach(function (col) {
            if (window.FCCache.isValido(col)) {
                const dados = window.FCCache.get(col);
                if (dados !== null) {
                    window.db[col] = dados;
                    if (col === 'produtos' && Array.isArray(dados) && dados.length > 0) {
                        window._produtosCarregados = true;
                    }
                }
            }
        });
        if (window.FCCache.isValido('config')) {
            const cfg = window.FCCache.get('config');
            if (cfg) window.db.config = cfg;
        }
        if (window.FCCache.isValido('caixa')) {
            const cx = window.FCCache.get('caixa');
            if (cx) window.db.caixa = cx;
        }
    }

    // Inicializa contador visual de pendências após o DOM carregar
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                _atualizarBadgePendencias();
            });
        } else {
            _atualizarBadgePendencias();
        }
    }

    console.log('[FCRepo] 🚀 Repositório Local Offline-First FC-Gestão ativo. Use FCCache.stats() para diagnóstico.');
})();
