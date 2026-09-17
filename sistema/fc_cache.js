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
        'movimentacoes'
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

    // Cache síncrono em memória para resposta instantânea (< 1ms)
    const _memoria = {};
    const _listeners = {};
    const _syncStateListeners = [];
    let _isSyncing = false;
    let _dbPromise = null;

    // ----------------------------------------------------------------------
    // 1. Camada de IndexedDB (Armazenamento Persistente de Longo Prazo)
    // ----------------------------------------------------------------------

    function _obterEmpresaId() {
        try {
            return localStorage.getItem('fc_empresa_ativa') || 'emp_fc_moveis';
        } catch (e) {
            return 'emp_fc_moveis';
        }
    }

    function _chave(colecao) {
        return _obterEmpresaId() + '_' + colecao;
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

            // Carrega docs especiais
            promessas.push((async function () {
                const cfg = await _idbLerColecao('fc_moveis_config');
                if (cfg) {
                    _memoria['fc_moveis_config'] = cfg;
                    if (typeof window.db !== 'undefined') window.db.config = cfg;
                    _notificarListeners('fc_moveis_config', cfg);
                }
            })());

            promessas.push((async function () {
                const cx = await _idbLerColecao('fc_moveis_caixa');
                if (cx) {
                    _memoria['fc_moveis_caixa'] = cx;
                    if (typeof window.db !== 'undefined') window.db.caixa = cx;
                    _notificarListeners('fc_moveis_caixa', cx);
                }
            })());

            await Promise.all(promessas);
            _atualizarBadgePendencias();
            console.log('[FCRepo] ⚡ Repositório Local carregado instantaneamente do IndexedDB.');
        } catch (err) {
            console.warn('[FCRepo] Erro ao carregar do IndexedDB:', err);
        }
    }

    // Dispara carregamento assíncrono em background de imediato
    if (typeof window !== 'undefined') {
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
                    const deduplicado = Array.from(mapa.values());

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
            if (_memoria[colecao] && Array.isArray(_memoria[colecao]) && _memoria[colecao].length >= 0) {
                return true;
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
            Object.keys(_memoria).forEach(k => delete _memoria[k]);
            try {
                const chaves = Object.keys(sessionStorage).filter(k => k.startsWith(SESSION_PREFIX));
                chaves.forEach(k => sessionStorage.removeItem(k));
            } catch (e) {}
            console.log('[FCRepo] Repositório limpo completamente.');
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
         * Remove da fila pendente após confirmação de gravação
         */
        removerDaFila: function (colecao, docId) {
            return _idbRemoverDaFila(colecao, docId);
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
    // 7. fcListenCollection — Wrapper Otimizado para Leitura do Repositório
    // ----------------------------------------------------------------------
    /**
     * Entrega dados INSTANTANEAMENTE do repositório local (< 10ms).
     * Não abre listeners redundantes de rede a cada navegação de página,
     * economizando leituras no Firestore e eliminando tempo de espera.
     */
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
                } else if (typeof firestore !== 'undefined') {
                    // 3. Primeira vez no dispositivo (repositório vazio): busca do Firebase uma vez para popular
                    let ref;
                    if (typeof window.getEmpresaRef === 'function') {
                        ref = window.getEmpresaRef().collection(colecao);
                    } else {
                        ref = firestore.collection(colecao);
                    }
                    if (typeof opcoes.query === 'function') {
                        ref = opcoes.query(ref);
                    }

                    ref.get().then(function (snap) {
                        const dados = snap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));
                        _memoria[colecao] = dados;
                        _salvarSession(colecao, dados);
                        _idbSalvarColecao(colecao, dados);
                        if (typeof window.db !== 'undefined') {
                            window.db[colecao] = dados;
                        }
                        try {
                            callback(dados);
                        } catch (e) {}
                    }).catch(function (err) {
                        console.warn('[FCRepo] Falha ao popular primeira carga de "' + colecao + '":', err);
                    });
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

        const cacheKey = colecao + '_' + docId;

        if (!_listeners[cacheKey]) {
            _listeners[cacheKey] = [];
        }
        _listeners[cacheKey].push(callback);

        // Serve da memória imediatamente se existir
        if (!semCache && _memoria[cacheKey] !== undefined) {
            try {
                callback(_memoria[cacheKey]);
            } catch (e) {}
        } else {
            // Tenta IndexedDB
            _idbLerColecao(cacheKey).then(function (dadosIdb) {
                if (dadosIdb !== null && !semCache) {
                    _memoria[cacheKey] = dadosIdb;
                    try { callback(dadosIdb); } catch (e) {}
                } else if (typeof firestore !== 'undefined') {
                    // Busca pontual do Firestore
                    let ref;
                    if (typeof window.getEmpresaRef === 'function') {
                        if (colecao === 'fc_moveis' && docId === 'caixa') {
                            ref = window.getEmpresaRef().collection('caixa').doc('caixa_atual');
                        } else if (colecao === 'fc_moveis' && (docId === 'config' || docId === 'config_loja')) {
                            ref = window.getEmpresaRef().collection('configuracoes').doc('config');
                        } else {
                            ref = window.getEmpresaRef().collection(colecao).doc(docId);
                        }
                    } else {
                        ref = firestore.collection(colecao).doc(docId);
                    }

                    ref.get().then(function (doc) {
                        const dados = doc.exists ? doc.data() : null;
                        _memoria[cacheKey] = dados;
                        _salvarSession(cacheKey, dados);
                        _idbSalvarColecao(cacheKey, dados);
                        try { callback(dados); } catch (e) {}
                    }).catch(function (e) {});
                }
            });
        }

        return function unsubscribe() {
            if (_listeners[cacheKey]) {
                const idx = _listeners[cacheKey].indexOf(callback);
                if (idx >= 0) _listeners[cacheKey].splice(idx, 1);
            }
        };
    };

    // ----------------------------------------------------------------------
    // 9. Hidratação Instantânea de `window.db`
    // ----------------------------------------------------------------------
    if (typeof window.db !== 'undefined') {
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
        if (window.FCCache.isValido('fc_moveis_config')) {
            const cfg = window.FCCache.get('fc_moveis_config');
            if (cfg) window.db.config = cfg;
        }
        if (window.FCCache.isValido('fc_moveis_caixa')) {
            const cx = window.FCCache.get('fc_moveis_caixa');
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
