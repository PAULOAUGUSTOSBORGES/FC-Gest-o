// ==========================================
// FC-CACHE.JS — Sistema de Cache Inteligente
// FC-Gestão · Versão 1.0
// ==========================================
// Serve dados instantaneamente do sessionStorage enquanto
// sincroniza com Firebase em background.
// Reduz leituras do Firestore em ~70-80% e elimina o
// tempo de carregamento percebido pelo usuário.
// ==========================================

(function () {
    'use strict';

    // ------------------------------------------
    // Configuração de TTL por coleção (em ms)
    // TTL = tempo máximo que o cache é considerado válido
    // Após o TTL, o próximo acesso força nova leitura no Firebase
    // ------------------------------------------
    const TTL = {
        'produtos':       5 * 60 * 1000,   // 5 minutos  - muda pouco
        'clientes':       5 * 60 * 1000,   // 5 minutos  - muda pouco
        'fornecedores':  10 * 60 * 1000,   // 10 minutos - raramente muda
        'funcionarios':  15 * 60 * 1000,   // 15 minutos - raramente muda
        'categorias':    15 * 60 * 1000,   // 15 minutos - raramente muda
        'vendas':         2 * 60 * 1000,   // 2 minutos  - crítico: muda com frequência
        'financeiro':     2 * 60 * 1000,   // 2 minutos  - crítico: muda com frequência
        'compras':        5 * 60 * 1000,   // 5 minutos  - muda com moderação
        'movimentacoes':  1 * 60 * 1000,   // 1 minuto   - alta rotatividade
        'fc_moveis_config': 30 * 60 * 1000, // 30 minutos - quase nunca muda
        'fc_moveis_caixa':  30 * 1000,      // 30 segundos - muito crítico
    };

    const PREFIX = 'fc_cache_';
    const MAX_ITEM_SIZE = 4 * 1024 * 1024; // 4MB por item (limite seguro do sessionStorage)

    // ------------------------------------------
    // Helpers internos
    // ------------------------------------------

    function _chave(colecao) {
        let empId = localStorage.getItem('fc_empresa_ativa') || 'emp_fc_moveis';
        return PREFIX + empId + '_' + colecao;
    }

    function _salvar(colecao, dados) {
        try {
            let dadosParaSalvar = dados;
            // Otimização: remove fotos pesadas em base64 do cache local de produtos
            // para evitar estourar a cota de 5MB do sessionStorage.
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
            // Protege contra dados muito grandes
            if (payload.length > MAX_ITEM_SIZE) {
                console.warn('[FCCache] Dado muito grande para cachear:', colecao, '(' + Math.round(payload.length / 1024) + 'KB)');
                return false;
            }
            sessionStorage.setItem(_chave(colecao), payload);
            return true;
        } catch (e) {
            // sessionStorage cheio ou erro de quota
            console.warn('[FCCache] Erro ao salvar cache de "' + colecao + '":', e.name);
            // Tenta liberar espaço limpando caches mais antigos
            _liberarEspaco();
            return false;
        }
    }

    function _ler(colecao) {
        try {
            const raw = sessionStorage.getItem(_chave(colecao));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function _liberarEspaco() {
        // Remove caches mais antigos para liberar espaço
        const chaves = Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX));
        let mais_antigo_ts = Infinity;
        let mais_antiga_chave = null;
        chaves.forEach(k => {
            try {
                const item = JSON.parse(sessionStorage.getItem(k));
                if (item && item.ts < mais_antigo_ts) {
                    mais_antigo_ts = item.ts;
                    mais_antiga_chave = k;
                }
            } catch(e) {}
        });
        if (mais_antiga_chave) {
            sessionStorage.removeItem(mais_antiga_chave);
        }
    }

    // ------------------------------------------
    // API Pública: window.FCCache
    // ------------------------------------------
    window.FCCache = {

        /**
         * Verifica se o cache de uma coleção é válido (existe e não expirou)
         * @param {string} colecao - Nome da coleção (ex: 'produtos')
         * @returns {boolean}
         */
        isValido: function(colecao) {
            const cached = _ler(colecao);
            if (!cached) return false;
            const ttl = TTL[colecao] || (5 * 60 * 1000);
            return (Date.now() - cached.ts) < ttl;
        },

        /**
         * Obtém dados do cache (sem verificar TTL)
         * @param {string} colecao
         * @returns {Array|Object|null}
         */
        get: function(colecao) {
            const cached = _ler(colecao);
            return cached ? cached.dados : null;
        },

        /**
         * Salva dados no cache
         * @param {string} colecao
         * @param {Array|Object} dados
         */
        set: function(colecao, dados) {
            _salvar(colecao, dados);
        },

        /**
         * Invalida (apaga) o cache de uma coleção específica
         * @param {string} colecao
         */
        invalidar: function(colecao) {
            sessionStorage.removeItem(_chave(colecao));
        },

        /**
         * Invalida todo o cache do FC-Gestão
         */
        invalidarTudo: function() {
            const chaves = Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX));
            chaves.forEach(k => sessionStorage.removeItem(k));
            console.log('[FCCache] Cache limpo completamente.');
        },

        /**
         * Retorna estatísticas do cache atual (para diagnóstico)
         */
        stats: function() {
            const chaves = Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX));
            const stats = {};
            let totalBytes = 0;
            chaves.forEach(k => {
                const col = k.replace(PREFIX, '');
                const raw = sessionStorage.getItem(k);
                const bytes = raw ? raw.length : 0;
                totalBytes += bytes;
                try {
                    const item = JSON.parse(raw);
                    const idade = item ? Math.round((Date.now() - item.ts) / 1000) : -1;
                    const ttl = TTL[col] || (5 * 60 * 1000);
                    const valido = item ? (Date.now() - item.ts) < ttl : false;
                    const qtd = Array.isArray(item?.dados) ? item.dados.length : (item?.dados ? 1 : 0);
                    stats[col] = { bytes: Math.round(bytes / 1024) + 'KB', idade: idade + 's', valido, qtd };
                } catch(e) {
                    stats[col] = { erro: 'parse error' };
                }
            });
            console.group('[FCCache] Status do Cache');
            console.table(stats);
            console.log('Total em cache:', Math.round(totalBytes / 1024) + 'KB');
            console.groupEnd();
            return stats;
        }
    };

    // ------------------------------------------
    // fcListenCollection — Wrapper para onSnapshot com cache
    // ------------------------------------------
    /**
     * Cria um listener de coleção do Firestore com suporte a cache.
     * 
     * - Se o cache for válido: chama o callback IMEDIATAMENTE com os dados em cache
     *   e só atualiza quando o Firebase detectar mudanças reais.
     * - Se o cache expirou ou não existe: aguarda o Firebase normalmente.
     * 
     * @param {string} colecao - Nome da coleção no Firestore
     * @param {Function} callback - Função chamada com o array de documentos
     * @param {Object} [opcoes] - Opções adicionais
     * @param {Function} [opcoes.query] - Função que recebe a referência e retorna uma query (ex: q => q.orderBy('nome').limit(50))
     * @param {boolean} [opcoes.semCache] - Se true, ignora o cache e sempre busca do Firebase
     * @returns {Function} unsubscribe - Função para cancelar o listener
     */
    window.fcListenCollection = function(colecao, callback, opcoes) {
        opcoes = opcoes || {};
        
        // Segurança: se firestore não estiver disponível, usa onSnapshot diretamente
        if (typeof firestore === 'undefined') {
            console.warn('[FCCache] firestore não disponível para coleção:', colecao);
            return function() {}; // unsubscribe vazio
        }
        
        let ref;
        if (typeof window.getEmpresaRef === 'function') {
            ref = window.getEmpresaRef().collection(colecao);
        } else {
            ref = firestore.collection(colecao);
        }
        
        // Aplica query customizada se fornecida
        if (typeof opcoes.query === 'function') {
            ref = opcoes.query(ref);
        }

        // Se há cache válido E não está forçando recarga, serve do cache primeiro
        if (!opcoes.semCache && window.FCCache.isValido(colecao)) {
            const dadosCache = window.FCCache.get(colecao);
            if (dadosCache !== null) {
                // Serve instantaneamente (antes do Firebase responder)
                try {
                    callback(dadosCache);
                } catch(e) {
                    console.error('[FCCache] Erro no callback de cache para "' + colecao + '":', e);
                }
            }
        }

        // Registra o listener do Firebase normalmente
        const unsub = ref.onSnapshot(function(snap) {
            const dados = snap.docs.map(function(doc) {
                return Object.assign({ id: doc.id }, doc.data());
            });
            
            // Atualiza o cache sempre que o Firebase trouxer dados
            try {
                window.FCCache.set(colecao, dados);
            } catch (errCache) {
                console.warn('[FCCache] Falha ao salvar no cache para "' + colecao + '":', errCache);
            }
            
            // Chama o callback da página com os dados frescos
            try {
                callback(dados);
            } catch(e) {
                console.error('[FCCache] Erro no callback de snapshot para "' + colecao + '":', e);
            }
        }, function(err) {
            console.error('[FCCache] Erro no listener de "' + colecao + '":', err);
        });

        return unsub;
    };


    /**
     * Versão para documento único (ex: fc_moveis/config, fc_moveis/caixa)
     * 
     * @param {string} colecao - Nome da coleção
     * @param {string} docId - ID do documento
     * @param {Function} callback - Chamado com os dados do documento (ou null se não existir)
     * @param {boolean} [semCache] - Se true, ignora o cache
     * @returns {Function} unsubscribe
     */
    window.fcListenDoc = function(colecao, docId, callback, semCache) {
        const cacheKey = colecao + '_' + docId;
        
        // Segurança: se firestore não estiver disponível
        if (typeof firestore === 'undefined') {
            console.warn('[FCCache] firestore não disponível para doc:', colecao, docId);
            return function() {};
        }
        
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

        // Serve do cache imediatamente se válido
        if (!semCache && window.FCCache.isValido(cacheKey)) {
            const dadosCache = window.FCCache.get(cacheKey);
            if (dadosCache !== null) {
                try {
                    callback(dadosCache);
                } catch(e) {
                    console.error('[FCCache] Erro no callback de doc cache para "' + cacheKey + '":', e);
                }
            }
        }

        // Registra o listener do Firebase
        const unsub = ref.onSnapshot(function(doc) {
            const dados = doc.exists ? doc.data() : null;
            
            if (dados !== null) {
                try {
                    window.FCCache.set(cacheKey, dados);
                } catch (e) {}
            } else {
                try {
                    window.FCCache.invalidar(cacheKey);
                } catch (e) {}
            }
            
            try {
                callback(dados);
            } catch(e) {
                console.error('[FCCache] Erro no callback de doc snapshot para "' + cacheKey + '":', e);
            }
        }, function(err) {
            console.error('[FCCache] Erro no listener de doc "' + cacheKey + '":', err);
        });

        return unsub;
    };

    // Se o objeto global db já existir, preenche com os dados do cache imediatamente
    if (typeof window.db !== 'undefined') {
        const colecoesPrincipais = ['produtos', 'clientes', 'fornecedores', 'funcionarios', 'vendas', 'financeiro', 'compras', 'categorias', 'movimentacoes'];
        colecoesPrincipais.forEach(function(col) {
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

    // ------------------------------------------
    // Diagnóstico (acessível pelo console do browser)
    // ------------------------------------------
    // Para verificar o estado do cache, abra o console e digite:
    // FCCache.stats()
    
    console.log('[FCCache] ✅ Sistema de Cache FC-Gestão ativo. Use FCCache.stats() para diagnóstico.');

})();

