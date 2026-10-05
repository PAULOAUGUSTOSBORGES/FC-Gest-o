// ==========================================================================
// SAAS_LICENCA.JS - CLIENTE UNIVERSAL DE LICENCIAMENTO MULTI-SISTEMAS
// Conecta ao banco central do SaaS Master para validar licença e módulos
// Compatível com FC-Gestão, FC-Food, FC-Barber e qualquer novo aplicativo
// ==========================================================================

(function() {
    const SAAS_CONFIG = {
        apiKey: "AIzaSyAvaDdhJSFP6WKs8UFRvlQmNGFlc1ZKgFk",
        authDomain: "fcgestao-testes.firebaseapp.com",
        projectId: "fcgestao-testes",
        storageBucket: "fcgestao-testes.firebasestorage.app",
        messagingSenderId: "126917183785",
        appId: "1:126917183785:web:32cdc3fd9b8e1064658f38"
    };

    // Número do WhatsApp de suporte (formato internacional sem +)
    const SUPORTE_WHATSAPP = '5562999676874';

    // Mapeamento completo: módulo → nome legível
    const NOMES_MODULOS = {
        pdv:        'Frente de Caixa (PDV)',
        vendas:     'Vendas & Orçamentos',
        fiscal:     'Emissor Fiscal (NF-e/NFC-e)',
        estoque:    'Controle de Estoque & Produtos',
        financeiro: 'Financeiro & Fluxo de Caixa',
        relatorios: 'Central de Relatórios Gerenciais',
        caixa:      'Caixa da Loja / Central & Caixas PDV',
        compras:    'Compras & NF-e XML',
        site:       'Loja Virtual & Catálogo Online',
        ia:         'Inteligência Artificial (IA Gemini Comercial)',
        agenda:     'Agenda & Compromissos',
        marketing:  'Marketing & Lembretes',
        suporte:    'Suporte VIP WhatsApp'
    };

    // Planos padrão — espelha PLANOS_PADRAO do master.js
    const PLANOS_INFO = {
        'plano_start':        { nome: 'Start Express (PDV Direto)',             preco: 'R$ 69,90/mês',  cor: '#64748b' },
        'plano_balcao_caixa': { nome: 'Varejo Balcão (Pré-Venda + Caixa)',      preco: 'R$ 99,90/mês',  cor: '#3b82f6' },
        'plano_fiscal':       { nome: 'Fiscal & Vendas',                        preco: 'R$ 119,90/mês', cor: '#0ea5e9' },
        'plano_pro':          { nome: 'Profissional',                           preco: 'R$ 169,90/mês', cor: '#f59e0b' },
        'plano_enterprise':   { nome: 'Enterprise',                             preco: 'R$ 249,90/mês', cor: '#8b5cf6' },
        'plano_ultra':        { nome: 'Ultra Completo',                         preco: 'R$ 349,90/mês', cor: '#10b981' },
        'START':              { nome: 'Start Express',                         preco: 'R$ 69,90/mês',  cor: '#64748b' },
        'BALCAO_CAIXA':       { nome: 'Varejo Balcão',                         preco: 'R$ 99,90/mês',  cor: '#3b82f6' },
        'BALCAO':             { nome: 'Varejo Balcão',                         preco: 'R$ 99,90/mês',  cor: '#3b82f6' },
        'VAREJO_BALCAO':      { nome: 'Varejo Balcão',                         preco: 'R$ 99,90/mês',  cor: '#3b82f6' },
        'FISCAL':             { nome: 'Fiscal & Vendas',                        preco: 'R$ 119,90/mês', cor: '#0ea5e9' },
        'PRO':                { nome: 'Profissional',                           preco: 'R$ 169,90/mês', cor: '#f59e0b' },
        'ENTERPRISE':         { nome: 'Enterprise',                             preco: 'R$ 249,90/mês', cor: '#8b5cf6' },
        'ULTRA':              { nome: 'Ultra Completo',                         preco: 'R$ 349,90/mês', cor: '#10b981' },
        'FREE':               { nome: 'Gratuito (Trial)',                       preco: 'Trial',         cor: '#64748b' }
    };

    // Tabela comparativa de módulos por plano para exibir no overlay (do mais caro para o mais barato)
    const TABELA_PLANOS = [
        {
            id: 'plano_ultra',
            nome: 'Ultra Completo',
            preco: 'R$ 349,90',
            cor: 'emerald',
            modulos: ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'agenda', 'site', 'ia', 'marketing', 'suporte']
        },
        {
            id: 'plano_enterprise',
            nome: 'Enterprise',
            preco: 'R$ 249,90',
            cor: 'purple',
            modulos: ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'agenda', 'site', 'ia', 'marketing', 'suporte']
        },
        {
            id: 'plano_pro',
            nome: 'Profissional',
            preco: 'R$ 169,90',
            cor: 'amber',
            destaque: true,
            modulos: ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'agenda', 'site', 'suporte']
        },
        {
            id: 'plano_fiscal',
            nome: 'Fiscal',
            preco: 'R$ 119,90',
            cor: 'cyan',
            modulos: ['pdv', 'vendas', 'fiscal', 'estoque', 'caixa', 'suporte']
        },
        {
            id: 'plano_balcao_caixa',
            nome: 'Varejo Balcão',
            preco: 'R$ 99,90',
            cor: 'blue',
            modulos: ['pdv', 'vendas', 'estoque', 'caixa', 'suporte']
        },
        {
            id: 'plano_start',
            nome: 'Start Express',
            preco: 'R$ 69,90',
            cor: 'slate',
            modulos: ['pdv', 'vendas', 'estoque', 'caixa', 'suporte']
        }
    ];

    // -----------------------------------------------------------------------
    // CATÁLOGO DE RELATÓRIOS — IDs únicos de cada relatório da tela relatorios.html
    // Estes IDs são usados pelo controle granular por plano.
    // -----------------------------------------------------------------------
    const CATALOGO_RELATORIOS = [
        { id: 'rel_dre',               nome: 'DRE - Demonstrativo de Resultado',       icone: 'fa-table-columns',    categoria: 'Financeiro & Gestão' },
        { id: 'rel_raio_x',            nome: 'Raio-X Executivo & Ponto de Equilíbrio',  icone: 'fa-chart-line',       categoria: 'Financeiro & Gestão' },
        { id: 'rel_despesas',          nome: 'Despesas por Centro de Custo',           icone: 'fa-money-bill-wave',  categoria: 'Financeiro & Gestão' },
        { id: 'rel_evolucao_custos',   nome: 'Evolução de Custos & Inflação',          icone: 'fa-arrow-trend-up',   categoria: 'Financeiro & Gestão' },

        { id: 'rel_top_produtos',      nome: 'Top Produtos Mais Vendidos',             icone: 'fa-ranking-star',     categoria: 'Vendas & Clientes' },
        { id: 'rel_top_clientes',      nome: 'Top Clientes (Ranking)',                 icone: 'fa-users',            categoria: 'Vendas & Clientes' },
        { id: 'rel_historico_vendas',  nome: 'Histórico Analítico de Vendas',          icone: 'fa-receipt',          categoria: 'Vendas & Clientes' },
        { id: 'rel_comissao',          nome: 'Comissão Detalhada de Vendedores',       icone: 'fa-hand-holding-dollar', categoria: 'Vendas & Clientes' },
        { id: 'rel_vendedores',        nome: 'Desempenho & Metas de Vendedores',       icone: 'fa-user-tie',         categoria: 'Vendas & Clientes' },
        { id: 'rel_mapa_calor',        nome: 'Mapa de Calor de Vendas (Horários)',     icone: 'fa-fire',             categoria: 'Vendas & Clientes' },

        { id: 'rel_curva_abc',         nome: 'Curva ABC de Produtos & Lucro',          icone: 'fa-chart-pie',        categoria: 'Estoque & Compras' },
        { id: 'rel_kardex',            nome: 'Ficha Kardex (Movimentação de Estoque)', icone: 'fa-warehouse',       categoria: 'Estoque & Compras' },
        { id: 'rel_top_compras',       nome: 'Top Compras por Produto & Valor',        icone: 'fa-boxes-stacked',    categoria: 'Estoque & Compras' },
        { id: 'rel_top_fornecedores',   nome: 'Top Fornecedores & Prazos',              icone: 'fa-truck',            categoria: 'Estoque & Compras' },
        { id: 'rel_sugestor_compras',  nome: 'Sugestor Inteligente de Reposição',      icone: 'fa-cart-plus',        categoria: 'Estoque & Compras' },

        { id: 'rel_ia_assistente',     nome: 'Análise Preditiva & Insights IA (Gemini)', icone: 'fa-robot',          categoria: 'Inteligência Artificial' }
    ];

    // Relatórios padrão por plano (fallback quando o admin não configurou no Master)
    const RELATORIOS_POR_PLANO_PADRAO = {
        plano_ultra:        ['rel_ia_assistente','rel_dre','rel_raio_x','rel_top_produtos','rel_top_clientes','rel_top_compras','rel_top_fornecedores','rel_despesas','rel_curva_abc','rel_kardex','rel_historico_vendas','rel_comissao','rel_vendedores','rel_sugestor_compras','rel_evolucao_custos','rel_mapa_calor'],
        plano_enterprise:   ['rel_ia_assistente','rel_dre','rel_raio_x','rel_top_produtos','rel_top_clientes','rel_top_compras','rel_top_fornecedores','rel_despesas','rel_curva_abc','rel_kardex','rel_historico_vendas','rel_comissao','rel_vendedores','rel_sugestor_compras','rel_evolucao_custos','rel_mapa_calor'],
        plano_pro:          ['rel_dre','rel_raio_x','rel_top_produtos','rel_top_clientes','rel_top_compras','rel_top_fornecedores','rel_despesas','rel_curva_abc','rel_kardex','rel_historico_vendas','rel_comissao','rel_vendedores','rel_sugestor_compras','rel_evolucao_custos'],
        plano_fiscal:       ['rel_dre','rel_top_produtos','rel_historico_vendas','rel_comissao'],
        plano_balcao_caixa: ['rel_top_produtos','rel_historico_vendas','rel_vendedores','rel_comissao'],
        plano_start:        ['rel_top_produtos','rel_historico_vendas','rel_comissao'],
    };

    let saasApp = null;
    let saasDb = null;
    let _bloqueioOnSnapshotUnsub = null;

    // -----------------------------------------------------------------------
    // CONEXÃO COM O BANCO CENTRAL DO SAAS
    // -----------------------------------------------------------------------
    function obterInstanciaSaaS() {
        if (saasDb) return saasDb;
        if (typeof firebase === 'undefined') return null;

        try {
            if (!SAAS_CONFIG.apiKey || SAAS_CONFIG.apiKey.includes('COLE_')) return null;

            const appExistente = firebase.apps.find(a => a.name === 'saasLicenseApp');
            if (appExistente) {
                saasApp = appExistente;
            } else {
                saasApp = firebase.initializeApp(SAAS_CONFIG, 'saasLicenseApp');
            }
            saasDb = saasApp.firestore();
            return saasDb;
        } catch (e) {
            console.warn('[SaaS Licença] Conexão remota indisponível:', e.message);
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // CONSULTA DE LICENÇA CENTRAL
    // -----------------------------------------------------------------------
    async function consultarLicencaCentral(empresaId, sistemaId = 'fc_gestao', forcarRemoto = false) {
        const cacheKey = `saas_licenca_${empresaId}`;
        const cacheLocal = localStorage.getItem(cacheKey);
        let licencaCached = null;
        if (cacheLocal) {
            try { licencaCached = JSON.parse(cacheLocal); } catch(e) {}
        }

        // CARREGAMENTO INSTANTÂNEO (< 1ms): Se a licença já estiver salva em cache local,
        // retorna imediatamente para que a tela abra sem nenhum delay de rede!
        if (licencaCached && !forcarRemoto) {
            const expInfo = _verificarExpiracao(licencaCached);
            licencaCached._expInfo = expInfo;
            window.currentSaaSLicense = licencaCached;

            if (expInfo.expirado) {
                aplicarBloqueioTotal(expInfo.motivo, licencaCached);
            } else if (expInfo.isTrial) {
                renderizarBannerTrial(expInfo.diasRestantes, licencaCached);
            } else {
                removerBannerTrial();
            }

            // Revalidação assíncrona em segundo plano após 2.5s para não disputar banda com a abertura da página
            const agora = Date.now();
            const ultimoCheck = licencaCached._cacheTimestamp || 0;
            if (agora - ultimoCheck > 10 * 60 * 1000) {
                setTimeout(() => {
                    consultarLicencaCentral(empresaId, sistemaId, true).catch(() => {});
                }, 2500);
            }

            return licencaCached;
        }

        const sDb = obterInstanciaSaaS();
        if (!sDb) {
            return licencaCached || _licencaFallback(sistemaId);
        }

        try {
            const docSnap = await sDb.collection('empresas').doc(empresaId).get();
            if (docSnap.exists) {
                const dados = docSnap.data();
                dados.id = docSnap.id;
                // SEMPRE usa modulosLiberados diretamente do Firestore (fonte da verdade)
                // Se modulosLiberados estiver definido no doc, usa ele. Caso contrario, resolve pelo plano.
                if (!dados.modulosLiberados || !Array.isArray(dados.modulosLiberados)) {
                    dados.modulosLiberados = _resolverModulos(dados);
                }
                console.log('[SaaS Licenca] Licenca carregada para ' + empresaId + ':', {
                    plano: dados.plano,
                    status: dados.status,
                    modulos: dados.modulosLiberados,
                    banco: 'fcgestao-testes'
                });
                // Invalida cache local se o servidor tiver dados mais recentes
                const ultimaAtualServidor = dados.ultimaAtualizacaoMaster ? dados.ultimaAtualizacaoMaster.toMillis() : 0;
                if (licencaCached) {
                    const ultimaAtualCache = licencaCached._cacheTimestamp || 0;
                    if (ultimaAtualServidor > ultimaAtualCache) {
                        console.log('[SaaS Licenca] Cache local invalidado - servidor tem dados mais recentes');
                    }
                }
                dados._cacheTimestamp = Date.now();
                const expInfo = _verificarExpiracao(dados);
                dados._expInfo = expInfo;
                localStorage.setItem(cacheKey, JSON.stringify(dados));
                window.currentSaaSLicense = dados;

                if (expInfo.expirado) {
                    aplicarBloqueioTotal(expInfo.motivo, dados);
                } else if (expInfo.isTrial) {
                    renderizarBannerTrial(expInfo.diasRestantes, dados);
                } else {
                    removerBannerTrial();
                }

                return dados;
            } else if (licencaCached) {
                const expInfo = _verificarExpiracao(licencaCached);
                licencaCached._expInfo = expInfo;
                window.currentSaaSLicense = licencaCached;

                if (expInfo.expirado) {
                    aplicarBloqueioTotal(expInfo.motivo, licencaCached);
                } else if (expInfo.isTrial) {
                    renderizarBannerTrial(expInfo.diasRestantes, licencaCached);
                } else {
                    removerBannerTrial();
                }

                return licencaCached;
            }
        } catch (err) {
            console.warn('[SaaS Licença] Erro ao consultar servidor central:', err);
            if (licencaCached) {
                const expInfo = _verificarExpiracao(licencaCached);
                licencaCached._expInfo = expInfo;
                window.currentSaaSLicense = licencaCached;

                if (expInfo.expirado) {
                    aplicarBloqueioTotal(expInfo.motivo, licencaCached);
                } else if (expInfo.isTrial) {
                    renderizarBannerTrial(expInfo.diasRestantes, licencaCached);
                } else {
                    removerBannerTrial();
                }

                return licencaCached;
            }
        }

        return _licencaFallback(sistemaId);
    }

    // -----------------------------------------------------------------------
    // RESOLVE MÓDULOS BASEADO NO PLANO SE NÃO FORAM DEFINIDOS MANUALMENTE
    // -----------------------------------------------------------------------
    function _resolverModulos(empData) {
        if (empData.modulosLiberados && Array.isArray(empData.modulosLiberados) && empData.modulosLiberados.length > 0) {
            return empData.modulosLiberados;
        }
        const plano = (empData.plano || '').toLowerCase();
        if (plano.includes('ultra') || plano.includes('completo') || plano.includes('ilimitado')) {
            return ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'agenda', 'site', 'ia', 'marketing', 'suporte'];
        } else if (plano.includes('enterprise')) {
            return ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'agenda', 'site', 'ia', 'marketing', 'suporte'];
        } else if (plano.includes('pro') || plano.includes('profissional')) {
            return ['pdv', 'vendas', 'fiscal', 'estoque', 'financeiro', 'caixa', 'compras', 'relatorios', 'agenda', 'site', 'suporte'];
        } else if (plano.includes('fiscal')) {
            return ['pdv', 'vendas', 'fiscal', 'estoque', 'caixa', 'suporte'];
        } else if (plano.includes('balcao') || plano.includes('caixa_central')) {
            return ['pdv', 'vendas', 'estoque', 'caixa', 'suporte'];
        } else if (plano.includes('start') || plano.includes('basico') || plano === 'free') {
            return ['pdv', 'vendas', 'estoque', 'caixa', 'suporte'];
        }
        return ['pdv', 'vendas', 'estoque', 'caixa', 'suporte'];
    }

    // -----------------------------------------------------------------------
    // LICENÇA FALLBACK PARA MODO OFFLINE / SEM CONEXÃO COM SAAS
    // -----------------------------------------------------------------------
    function _licencaFallback(sistemaId) {
        // FALLBACK RESTRITIVO: se nao conseguir conectar ao SaaS, usa o cache local.
        // Se nao houver cache, concede apenas acesso basico (PDV + Vendas + Estoque).
        // Isso garante que um cliente bloqueado nao ganhe acesso total por falha de conexao.
        const empresaId = localStorage.getItem('fc_empresa_ativa') || '';
        if (empresaId) {
            const cacheKey = 'saas_licenca_' + empresaId;
            const cacheRaw = localStorage.getItem(cacheKey);
            if (cacheRaw) {
                try {
                    const cached = JSON.parse(cacheRaw);
                    if (cached && Array.isArray(cached.modulosLiberados)) {
                        console.warn('[SaaS Licenca] Usando cache local como fallback para:', empresaId);
                        return cached;
                    }
                } catch(e) {}
            }
        }
        console.warn('[SaaS Licenca] Sem conexao e sem cache - aplicando acesso minimo restritivo');
        return {
            status: 'ATIVO',
            plano: 'start',
            sistemaId: sistemaId,
            modulosLiberados: ['pdv', 'vendas', 'estoque'],
            origem: 'fallback_offline_restritivo'
        };
    }

    // -----------------------------------------------------------------------
    // VERIFICAÇÃO ESTRITA DE MÓDULOS (Respeita 100% as caixas marcadas no SaaS)
    // -----------------------------------------------------------------------
    function temPermissaoModulo(modulo, mods) {
        if (!mods || !Array.isArray(mods)) return false;
        // IA e Marketing referem-se a mesma funcionalidade contratada no SaaS
        if (modulo === 'ia' || modulo === 'marketing') {
            return mods.includes('ia') || mods.includes('marketing');
        }
        // Caixa físico e Caixa da Loja pertencem à mesma permissão de caixa
        if (modulo === 'caixa' || modulo === 'caixa_loja') {
            return mods.includes('caixa') || mods.includes('caixa_loja');
        }
        return mods.includes(modulo);
    }

    // -----------------------------------------------------------------------
    // VERIFICA SE UM MÓDULO ESTÁ LIBERADO PARA A EMPRESA ATUAL
    // -----------------------------------------------------------------------
    function verificarAcessoModulo(modulo) {
        const licenca = window.currentSaaSLicense || window.currentEmpresaData;
        if (!licenca) return true; // Permissivo enquanto não carregou

        const mods = licenca.modulosLiberados || _resolverModulos(licenca);
        return temPermissaoModulo(modulo, mods);
    }

    function _isSuperAdmin(email) {
        return false; // Sem bypass na loja: respeita estritamente o que foi configurado no SaaS
    }

    // -----------------------------------------------------------------------
    // OVERLAY DE BLOQUEIO POR PLANO (módulo não incluso)
    // -----------------------------------------------------------------------
    function aplicarBloqueioPlano(moduloId, tituloModuloOverride) {
        const licenca = window.currentSaaSLicense || window.currentEmpresaData || {};
        const nomeModulo = tituloModuloOverride || NOMES_MODULOS[moduloId] || moduloId;
        const planoId = (licenca.plano || 'FREE').toLowerCase().replace(/\s+/g, '_');
        const planoInfo = PLANOS_INFO[licenca.plano] || PLANOS_INFO[planoId] || { nome: licenca.plano || 'Atual', preco: '', cor: '#64748b' };
        const nomePlano = planoInfo.nome;

        // Remove overlay antigo se existir
        const antigo = document.getElementById('fc-saas-overlay-plano');
        if (antigo) antigo.remove();

        const overlay = document.createElement('div');
        overlay.id = 'fc-saas-overlay-plano';

        const tabelaHtml = TABELA_PLANOS.map(p => {
            const temModulo = temPermissaoModulo(moduloId, p.modulos);
            const isAtual = planoId.includes(p.id.replace('plano_', '')) || (licenca.plano || '').toUpperCase().includes(p.nome.toUpperCase().split(' ')[0]);
            const destaque = p.destaque ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-700/50 bg-slate-800/50';
            const corNome = p.cor === 'amber' ? 'text-amber-400' : (p.cor === 'purple' ? 'text-purple-400' : 'text-slate-300');
            const badgeAtual = isAtual ? `<span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-1">Atual</span>` : '';
            return `
                <div class="rounded-xl border ${destaque} p-3 flex flex-col gap-1 min-w-[120px]">
                    <div class="text-xs font-black ${corNome} flex items-center gap-1">${p.nome}${badgeAtual}</div>
                    <div class="text-[11px] text-slate-400 font-semibold">${p.preco}<span class="text-slate-600">/mês</span></div>
                    <div class="mt-1">
                        ${temModulo
                            ? `<div class="flex items-center gap-1 text-[11px] text-emerald-400 font-bold"><i class="fa-solid fa-check text-[9px]"></i> Incluído</div>`
                            : `<div class="flex items-center gap-1 text-[11px] text-slate-500 font-medium"><i class="fa-solid fa-xmark text-[9px]"></i> Não incluído</div>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        const msgWpp = encodeURIComponent(`Olá! Gostaria de fazer o upgrade do meu plano para liberar o módulo "${nomeModulo}".`);

        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15,23,42,0.97);
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
            font-family: 'Inter', system-ui, sans-serif;
        `;

        overlay.innerHTML = `
            <div style="max-width:520px; width:100%; text-align:center; padding: 2rem 1.5rem; background: #1e293b; border-radius: 1.5rem; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);">
                
                <!-- Ícone -->
                <div style="width:72px;height:72px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:1rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:1.75rem;color:#f59e0b;">
                    <i class="fa-solid fa-lock"></i>
                </div>

                <!-- Título -->
                <h2 style="color:#f8fafc;font-size:1.25rem;font-weight:900;margin:0 0 0.5rem;">Módulo não disponível no seu plano</h2>
                <p style="color:#94a3b8;font-size:0.8rem;margin:0 0 1.25rem;line-height:1.6;">
                    O módulo <strong style="color:#fbbf24;font-weight:700;">${nomeModulo}</strong> não está incluso no plano
                    <strong style="color:#f8fafc;">${nomePlano}</strong> da sua loja.
                    Faça o upgrade para desbloquear este e outros recursos.
                </p>

                <!-- Tabela de Planos -->
                <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.5rem;">
                    ${tabelaHtml}
                </div>

                <!-- Botões -->
                <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
                    <a href="index.html" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.25rem;background:#334155;border-radius:0.625rem;color:#cbd5e1;font-size:0.75rem;font-weight:700;text-decoration:none;border:1px solid #475569;transition:all .2s;">
                        <i class="fa-solid fa-arrow-left"></i> Voltar ao Painel
                    </a>
                    <a href="https://wa.me/${SUPORTE_WHATSAPP}?text=${msgWpp}" target="_blank" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.25rem;background:linear-gradient(135deg,#f59e0b,#eab308);border-radius:0.625rem;color:#0f172a;font-size:0.75rem;font-weight:900;text-decoration:none;box-shadow:0 4px 15px rgba(245,158,11,0.25);transition:all .2s;">
                        <i class="fa-brands fa-whatsapp" style="font-size:0.9rem;"></i> Falar com Suporte para Upgrade
                    </a>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Oculta o conteúdo da página por baixo (evita scroll/interação)
        const main = document.querySelector('main');
        if (main) main.style.visibility = 'hidden';
    }

    // -----------------------------------------------------------------------
    // -----------------------------------------------------------------------
    // VERIFICAÇÃO DE EXPIRAÇÃO (Trial 7 dias e Mensalidades)
    // -----------------------------------------------------------------------
    function _verificarExpiracao(empData) {
        if (!empData) return { expirado: false, diasRestantes: 999, isTrial: false };

        // Bypass de segurança para fundadores
        const emailAtual = typeof firebase !== 'undefined' && firebase.auth().currentUser ? (firebase.auth().currentUser.email || '').toLowerCase() : '';
        if (emailAtual === 'pauloaugusto.silvaborges@gmail.com' || emailAtual === 'fabricadecoresgoiania@gmail.com') {
            return { expirado: false, diasRestantes: 999, isTrial: false };
        }

        if (empData.status === 'BLOQUEADO') {
            return {
                expirado: true,
                motivo: 'O acesso à sua loja foi temporariamente suspenso pelo administrador.',
                diasRestantes: -1,
                isTrial: false
            };
        }

        let dataVenc = null;
        if (empData.dataVencimento) {
            if (typeof empData.dataVencimento === 'string') {
                const parts = empData.dataVencimento.split('T')[0].split('-');
                if (parts.length === 3) {
                    dataVenc = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59);
                } else {
                    dataVenc = new Date(empData.dataVencimento);
                }
            } else if (empData.dataVencimento.toDate && typeof empData.dataVencimento.toDate === 'function') {
                dataVenc = empData.dataVencimento.toDate();
                dataVenc.setHours(23, 59, 59, 999);
            } else if (empData.dataVencimento instanceof Date) {
                dataVenc = new Date(empData.dataVencimento);
                dataVenc.setHours(23, 59, 59, 999);
            }
        }

        const isTrial = empData.status === 'TRIAL' || (empData.plano || '').toUpperCase() === 'FREE';

        // Se não houver dataVencimento explícita e for TRIAL, calcula 7 dias a partir da criação
        if (!dataVenc || isNaN(dataVenc.getTime())) {
            if (isTrial) {
                let base = new Date();
                if (empData.dataCriacao && empData.dataCriacao.toDate) {
                    base = empData.dataCriacao.toDate();
                }
                dataVenc = new Date(base.getTime() + (7 * 24 * 60 * 60 * 1000));
                dataVenc.setHours(23, 59, 59, 999);
            }
        }

        if (dataVenc && !isNaN(dataVenc.getTime())) {
            const agora = new Date();
            const diffMs = dataVenc.getTime() - agora.getTime();
            const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            if (diffMs < 0) {
                const motivo = isTrial
                    ? 'Seu período de teste gratuito de 7 dias chegou ao fim. Ative seu plano para continuar operando sua loja sem interrupções.'
                    : 'A sua assinatura mensal expirou. Regularize o pagamento via PIX para reativar seu acesso imediatamente.';
                return {
                    expirado: true,
                    motivo: motivo,
                    diasRestantes: diasRestantes,
                    dataVenc: dataVenc,
                    isTrial: isTrial
                };
            } else {
                return {
                    expirado: false,
                    diasRestantes: Math.max(0, diasRestantes),
                    dataVenc: dataVenc,
                    isTrial: isTrial
                };
            }
        }

        return { expirado: false, diasRestantes: 999, isTrial: isTrial };
    }

    // -----------------------------------------------------------------------
    // BANNER DE CONTAGEM REGRESSIVA DO TRIAL (Topo da Tela)
    // -----------------------------------------------------------------------
    function renderizarBannerTrial(diasRestantes, licenca) {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => renderizarBannerTrial(diasRestantes, licenca));
            return;
        }

        if (document.getElementById('fc-saas-overlay-bloqueio')) return;

        let banner = document.getElementById('fc-saas-trial-banner');
        const dias = Math.max(0, diasRestantes);
        const textoDias = dias === 0 ? 'Último dia de teste!' : (dias === 1 ? 'Resta apenas 1 dia de avaliação' : `Restam ${dias} dias de teste gratuito`);

        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'fc-saas-trial-banner';
            banner.style.cssText = `
                position: sticky; top: 0; left: 0; right: 0; z-index: 9998;
                background: linear-gradient(90deg, #d97706, #f59e0b, #d97706);
                color: #0f172a; padding: 6px 16px;
                display: flex; align-items: center; justify-content: space-between;
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 0.75rem; font-weight: 800;
                box-shadow: 0 2px 10px rgba(245, 158, 11, 0.35);
            `;
            document.body.prepend(banner);
        }

        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <span style="background:rgba(15,23,42,0.15);padding:2px 8px;border-radius:12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.05em;color:#0f172a;border:1px solid rgba(15,23,42,0.2);">
                    <i class="fa-solid fa-clock-rotate-left"></i> Modo Avaliação
                </span>
                <span>${textoDias} — Aproveite todos os recursos da sua loja!</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <button onclick="window.abrirModalContratarPlano && window.abrirModalContratarPlano()" style="background:#0f172a;color:#fbbf24;border:none;padding:4px 12px;border-radius:6px;font-size:0.7rem;font-weight:900;cursor:pointer;display:flex;align-items:center;gap:0.3rem;transition:all .2s;">
                    <i class="fa-solid fa-crown"></i> Ativar Assinatura
                </button>
            </div>
        `;
    }

    function removerBannerTrial() {
        const banner = document.getElementById('fc-saas-trial-banner');
        if (banner) banner.remove();
    }

    // -----------------------------------------------------------------------
    // MODAL DE CONTRATAÇÃO DE PLANOS & PAGAMENTO PIX
    // -----------------------------------------------------------------------
    function abrirModalContratarPlano() {
        const antigo = document.getElementById('fc-saas-modal-contratar');
        if (antigo) antigo.remove();

        const modal = document.createElement('div');
        modal.id = 'fc-saas-modal-contratar';
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15,23,42,0.85); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            padding: 16px; font-family: 'Inter', system-ui, sans-serif;
        `;

        const cardsPlanosHtml = TABELA_PLANOS.map(p => `
            <div style="background:#1e293b;border:1px solid ${p.destaque ? '#f59e0b' : '#334155'};border-radius:0.75rem;padding:0.75rem;display:flex;flex-direction:column;justify-content:space-between;min-width:130px;flex:1;">
                <div>
                    <div style="font-size:0.75rem;font-weight:900;color:${p.destaque ? '#fbbf24' : '#f8fafc'};">${p.nome}</div>
                    <div style="font-size:0.85rem;font-weight:900;color:#4ade80;margin:0.25rem 0;">${p.preco}<span style="font-size:0.65rem;color:#94a3b8;">/mês</span></div>
                </div>
                <a href="https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent('Olá! Gostaria de contratar o plano ' + p.nome + ' (' + p.preco + '/mês) para minha loja.')}" target="_blank" style="margin-top:0.5rem;padding:0.4rem 0.5rem;background:${p.destaque ? '#f59e0b' : '#334155'};color:${p.destaque ? '#0f172a' : '#f8fafc'};border-radius:0.5rem;font-size:0.68rem;font-weight:800;text-decoration:none;text-align:center;display:block;">
                    Escolher
                </a>
            </div>
        `).join('');

        modal.innerHTML = `
            <div style="max-width:540px;width:100%;background:#0f172a;border:1px solid #334155;border-radius:1.5rem;padding:1.75rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);position:relative;">
                <button onclick="document.getElementById('fc-saas-modal-contratar').remove()" style="position:absolute;top:1rem;right:1rem;background:transparent;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;">
                    <i class="fa-solid fa-xmark"></i>
                </button>

                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
                    <div style="width:42px;height:42px;border-radius:12px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);display:flex;align-items:center;justify-content:center;color:#fbbf24;font-size:1.2rem;">
                        <i class="fa-solid fa-crown"></i>
                    </div>
                    <div>
                        <h3 style="color:#f8fafc;font-size:1.1rem;font-weight:900;margin:0;">Planos & Assinatura</h3>
                        <p style="color:#94a3b8;font-size:0.72rem;margin:0;">Escolha o plano ideal para a sua operação</p>
                    </div>
                </div>

                <div style="display:flex;gap:0.5rem;overflow-x:auto;padding-bottom:0.5rem;margin-bottom:1.25rem;">
                    ${cardsPlanosHtml}
                </div>

                <div style="background:#1e293b;border:1px solid #334155;border-radius:1rem;padding:0.9rem;margin-bottom:1.25rem;">
                    <div style="font-size:0.72rem;font-weight:800;color:#38bdf8;margin-bottom:0.4rem;"><i class="fa-brands fa-pix"></i> Chave PIX Oficial (Ativação Imediata)</div>
                    <div style="display:flex;align-items:center;justify-content:space-between;background:#0f172a;border:1px solid #475569;border-radius:0.5rem;padding:0.5rem 0.75rem;">
                        <span style="font-family:monospace;font-size:0.8rem;color:#f8fafc;font-weight:700;">62993341774</span>
                        <button type="button" onclick="navigator.clipboard.writeText('62993341774').then(()=>{ this.innerText='Copiado!'; setTimeout(()=>this.innerText='Copiar', 2000); })" style="padding:0.3rem 0.6rem;background:#38bdf8;border:none;border-radius:0.4rem;color:#0f172a;font-size:0.68rem;font-weight:800;cursor:pointer;">
                            Copiar
                        </button>
                    </div>
                    <div style="font-size:0.68rem;color:#94a3b8;margin-top:0.4rem;">
                        Paulo Augusto Silva Borges • Envie o comprovante pelo WhatsApp para liberação imediata.
                    </div>
                </div>

                <div style="display:flex;gap:0.5rem;">
                    <a href="https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent('Olá! Quero tirar dúvidas sobre a assinatura do sistema.')}" target="_blank" style="flex:1;padding:0.65rem;background:#22c55e;color:white;border-radius:0.75rem;font-size:0.78rem;font-weight:900;text-decoration:none;text-align:center;display:flex;align-items:center;justify-content:center;gap:0.4rem;">
                        <i class="fa-brands fa-whatsapp text-sm"></i> Falar com Suporte WhatsApp
                    </a>
                    <button onclick="document.getElementById('fc-saas-modal-contratar').remove()" style="padding:0.65rem 1rem;background:#334155;color:#cbd5e1;border:none;border-radius:0.75rem;font-size:0.75rem;font-weight:700;cursor:pointer;">
                        Fechar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // -----------------------------------------------------------------------
    // OVERLAY DE BLOQUEIO TOTAL COM PAGAMENTO PIX DIRETO (Trial Expirado / Inadimplência)
    // -----------------------------------------------------------------------
    function aplicarBloqueioTotal(motivo, licenca) {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => aplicarBloqueioTotal(motivo, licenca));
            return;
        }

        licenca = licenca || window.currentSaaSLicense || window.currentEmpresaData || {};
        const antigo = document.getElementById('fc-saas-overlay-bloqueio');
        if (antigo) antigo.remove();

        // Remove também banner de trial quando bloqueado
        removerBannerTrial();

        const overlay = document.createElement('div');
        overlay.id = 'fc-saas-overlay-bloqueio';

        const isTrialExpirado = (licenca.status === 'TRIAL' || (licenca.plano || '').toUpperCase() === 'FREE');
        const titulo = isTrialExpirado ? 'Período de Teste Concluído' : 'Acesso Suspenso - Mensalidade';
        const msgMotivo = motivo || (isTrialExpirado 
            ? 'Seu período de avaliação de 7 dias terminou. Ative seu plano para continuar vendendo.' 
            : 'O acesso à sua loja está temporariamente suspenso por pendência na mensalidade.');

        const chavePix = '62993341774';
        const chavePixEmail = 'fabricadecoresgoiania@gmail.com';
        const nomeEmpresa = licenca.nomeEmpresa || licenca.nome || 'Minha Loja';
        const plano = licenca.plano || 'Start Express';
        const valorSugerido = licenca.valorMensalidade ? `R$ ${Number(licenca.valorMensalidade).toFixed(2).replace('.', ',')}` : 'R$ 99,90';

        const msgWpp = encodeURIComponent(`Olá! Gostaria de ativar/renovar o sistema para a minha loja "${nomeEmpresa}" (Plano: ${plano}, Valor: ${valorSugerido}). Segue o comprovante do PIX:`);

        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 999999;
            background: rgba(15,23,42,0.98);
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
            overflow-y: auto;
            font-family: 'Inter', system-ui, sans-serif;
        `;

        overlay.innerHTML = `
            <div style="max-width:480px;width:100%;text-align:center;padding:2.2rem 1.8rem;background:#1e293b;border-radius:1.5rem;border:1px solid #ef444450;box-shadow:0 25px 60px -12px rgba(0,0,0,0.85);margin:auto;">
                
                <!-- Ícone -->
                <div style="width:72px;height:72px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:1.8rem;color:#ef4444;">
                    <i class="fa-solid fa-lock"></i>
                </div>

                <!-- Título -->
                <h2 style="color:#f8fafc;font-size:1.35rem;font-weight:900;margin:0 0 0.5rem;">⛔ ${titulo}</h2>
                <p style="color:#cbd5e1;font-size:0.83rem;line-height:1.6;margin:0 0 1.25rem;">${msgMotivo}</p>

                <!-- Box de Pagamento PIX Direto -->
                <div style="background:#0f172a;border:1px solid #334155;border-radius:1rem;padding:1rem;margin-bottom:1.5rem;text-align:left;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                        <span style="font-size:0.75rem;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:0.05em;"><i class="fa-brands fa-pix"></i> Pagamento Rápido via PIX</span>
                        <span style="font-size:0.8rem;font-weight:900;color:#4ade80;">${valorSugerido}<span style="font-size:0.68rem;color:#94a3b8;font-weight:600;">/mês</span></span>
                    </div>

                    <div style="background:#1e293b;border:1px solid #475569;border-radius:0.75rem;padding:0.6rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.5rem;">
                        <div style="overflow:hidden;">
                            <div style="font-size:0.65rem;color:#94a3b8;font-weight:600;">Chave PIX (Telefone Celular):</div>
                            <div style="font-size:0.85rem;font-family:monospace;font-weight:700;color:#f8fafc;" id="fc-pix-key-val">${chavePix}</div>
                        </div>
                        <button type="button" onclick="navigator.clipboard.writeText('${chavePix}').then(()=>{ this.innerHTML='<i class=\\'fa-solid fa-check\\'></i> Copiado!'; setTimeout(()=>this.innerHTML='<i class=\\'fa-solid fa-copy\\'></i> Copiar', 2000); })" style="padding:0.45rem 0.8rem;background:#38bdf8;border:none;border-radius:0.5rem;color:#0f172a;font-size:0.72rem;font-weight:800;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:0.35rem;">
                            <i class="fa-solid fa-copy"></i> Copiar
                        </button>
                    </div>

                    <div style="font-size:0.7rem;color:#94a3b8;line-height:1.4;">
                        👤 <strong>Titular:</strong> Paulo Augusto Silva Borges<br>
                        🔑 <strong>Chave alternativa (E-mail):</strong> ${chavePixEmail}
                    </div>
                </div>

                <!-- Botões de Ação -->
                <div style="display:flex;flex-direction:column;gap:0.65rem;align-items:center;">
                    <a href="https://wa.me/${SUPORTE_WHATSAPP}?text=${msgWpp}" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.75rem 1.5rem;width:100%;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:0.75rem;color:white;font-size:0.82rem;font-weight:900;text-decoration:none;box-shadow:0 4px 15px rgba(34,197,94,0.3);">
                        <i class="fa-brands fa-whatsapp" style="font-size:1.1rem;"></i> Enviar Comprovante no WhatsApp
                    </a>
                    
                    <button onclick="window.__fcSaasRevalidar && window.__fcSaasRevalidar()" style="display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.6rem 1.5rem;background:#334155;border:1px solid #475569;border-radius:0.625rem;color:#f1f5f9;font-size:0.75rem;font-weight:700;cursor:pointer;width:100%;">
                        <i class="fa-solid fa-rotate-right"></i> Já realizei o pagamento — Verificar Acesso
                    </button>

                    <button onclick="firebase.auth().signOut().then(()=>window.location.href='login.html')" style="display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;padding:0.45rem 1rem;background:transparent;border:none;color:#64748b;font-size:0.72rem;font-weight:500;cursor:pointer;">
                        <i class="fa-solid fa-right-from-bracket"></i> Sair / Trocar de conta
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        const main = document.querySelector('main');
        if (main) main.style.visibility = 'hidden';
    }

    // -----------------------------------------------------------------------
    // LISTENER EM TEMPO REAL — Detecta bloqueio, expiração ou renovação instantânea
    // -----------------------------------------------------------------------
    function iniciarListenerBloqueioTempoReal(empresaId, userEmail) {
        if (_isSuperAdmin(userEmail)) return; // Super admins: sem listener
        if (_bloqueioOnSnapshotUnsub) {
            try { _bloqueioOnSnapshotUnsub(); } catch(e) {}
        }

        const sDb = obterInstanciaSaaS();
        if (!sDb) return;

        try {
            _bloqueioOnSnapshotUnsub = sDb.collection('empresas').doc(empresaId).onSnapshot((snap) => {
                if (!snap.exists) return;
                const dados = snap.data();
                const statusAtual = dados.status || 'ATIVO';

                // Atualiza licença em memória
                const licAtual = window.currentSaaSLicense || {};
                const novaLicenca = { ...licAtual, ...dados, id: empresaId };
                if (!dados.modulosLiberados || !Array.isArray(dados.modulosLiberados)) {
                    novaLicenca.modulosLiberados = _resolverModulos(novaLicenca);
                } else {
                    novaLicenca.modulosLiberados = dados.modulosLiberados;
                }

                const expInfo = _verificarExpiracao(novaLicenca);
                novaLicenca._expInfo = expInfo;

                const modsAnterior = JSON.stringify(licAtual.modulosLiberados || []);
                const modsNovos = JSON.stringify(novaLicenca.modulosLiberados || []);
                const modulosMudaram = modsAnterior !== modsNovos;
                window.currentSaaSLicense = novaLicenca;
                window.currentEmpresaData = novaLicenca;
                localStorage.setItem(`saas_licenca_${empresaId}`, JSON.stringify(novaLicenca));

                // Aplica bloqueio total em tempo real se status mudou ou se venceu
                if (statusAtual === 'BLOQUEADO' || expInfo.expirado) {
                    const overlayBloq = document.getElementById('fc-saas-overlay-bloqueio');
                    if (!overlayBloq) {
                        aplicarBloqueioTotal(expInfo.motivo, novaLicenca);
                    }
                } else {
                    // Remove overlay de bloqueio se foi reativado
                    const overlayBloq = document.getElementById('fc-saas-overlay-bloqueio');
                    if (overlayBloq) {
                        overlayBloq.remove();
                        const main = document.querySelector('main');
                        if (main) main.style.visibility = 'visible';
                        if (typeof showToast === 'function') showToast('✅ Acesso reativado com sucesso!', 'success');
                    }

                    if (expInfo.isTrial) {
                        renderizarBannerTrial(expInfo.diasRestantes, novaLicenca);
                    } else {
                        removerBannerTrial();
                    }

                    // Reaplica controle de módulos em tempo real se o master alterou os módulos
                    if (modulosMudaram) {
                        if (typeof window.atualizarMenuLateralPorPlanoSaaS === 'function') {
                            window.atualizarMenuLateralPorPlanoSaaS(novaLicenca.modulosLiberados);
                        }
                        if (typeof window.aplicarControleDeModulosSaaS === 'function') {
                            const userAtual = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
                            if (userAtual) window.aplicarControleDeModulosSaaS(novaLicenca, userAtual);
                            if (typeof window.aplicarControleAcessoRelatoriosPorPlano === 'function') window.aplicarControleAcessoRelatoriosPorPlano();
                        }
                        // Verifica se a página atual agora está bloqueada
                        const pathAtual = window.location.pathname.toLowerCase();
                        const paginasModulos = [
                            { rotas: ['fiscal.html'],         modulo: 'fiscal' },
                            { rotas: ['financeiro.html'],      modulo: 'financeiro' },
                            { rotas: ['compras.html'],         modulo: 'compras' },
                            { rotas: ['relatorios.html'],      modulo: 'relatorios' },
                            { rotas: ['agenda.html'],          modulo: 'agenda' },
                            { rotas: ['marketing.html'],       modulo: 'ia' },
                            { rotas: ['caixa.html', 'caixa_loja.html'], modulo: 'caixa' },
                            { rotas: ['pdv.html'],             modulo: 'pdv' },
                            { rotas: ['vendas_operacao.html', 'vendas_gestao.html', 'orcamentos.html'], modulo: 'vendas' },
                        ];
                        for (const item of paginasModulos) {
                            const estaNaRota = item.rotas.some(r => pathAtual.endsWith('/' + r) || pathAtual.endsWith(r));
                            if (estaNaRota && !temPermissaoModulo(item.modulo, novaLicenca.modulosLiberados)) {
                                if (typeof showToast === 'function') showToast('⚠️ Seu acesso a esta área foi removido pelo administrador.', 'warning');
                                setTimeout(() => window.location.href = 'index.html', 2500);
                                break;
                            }
                        }
                    }
                }
            }, (err) => {
                console.warn('[SaaS Licença] onSnapshot erro:', err.message);
            });
        } catch(e) {
            console.warn('[SaaS Licença] Falha ao iniciar listener:', e.message);
        }
    }

    // -----------------------------------------------------------------------
    // REVALIDAÇÃO MANUAL (botão "Já realizei o pagamento")
    // -----------------------------------------------------------------------
    window.__fcSaasRevalidar = async function() {
        const empresaId = localStorage.getItem('fc_empresa_ativa');
        if (!empresaId) return;

        const overlay = document.getElementById('fc-saas-overlay-bloqueio');
        const btnRevalidar = overlay ? overlay.querySelector('button[onclick*="__fcSaasRevalidar"]') : null;
        if (btnRevalidar) {
            btnRevalidar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
        }

        const licenca = await consultarLicencaCentral(empresaId, 'fc_gestao');
        const expInfo = _verificarExpiracao(licenca);

        if (licenca && licenca.status !== 'BLOQUEADO' && !expInfo.expirado) {
            if (overlay) overlay.remove();
            const main = document.querySelector('main');
            if (main) main.style.visibility = 'visible';
            if (typeof showToast === 'function') showToast('✅ Acesso reativado! Recarregando...', 'success');
            setTimeout(() => window.location.reload(), 1200);
        } else {
            if (btnRevalidar) {
                btnRevalidar.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Já realizei o pagamento — Verificar Acesso';
            }
            if (typeof showToast === 'function') showToast('Pagamento ainda não confirmado no sistema. Envie o comprovante via WhatsApp.', 'error');
            else alert('Pagamento ainda não confirmado no sistema. Envie o comprovante via WhatsApp para liberação imediata.');
        }
    };

    // -----------------------------------------------------------------------
    // CONTROLE GRANULAR DE RELATÓRIOS POR PLANO
    // -----------------------------------------------------------------------

    /**
     * Retorna a lista de IDs de relatórios permitidos para a licença atual.
     * Prioridade:
     *   1. licenca.relatoriosPermitidos   — configurado manualmente no Painel Master
     *   2. plano_saas.relatoriosPermitidos — herdado do documento do plano no Firestore
     *   3. RELATORIOS_POR_PLANO_PADRAO    — fallback estático por tipo de plano
     *   4. todos os relatórios            — se plano não identificado (permissivo enquanto carrega)
     */
    function obterRelatoriosPermitidos(licenca) {
        licenca = licenca || window.currentSaaSLicense || window.currentEmpresaData;
        if (!licenca) {
            // Ainda não carregou: retorna todos (permissivo temporário)
            return CATALOGO_RELATORIOS.map(r => r.id);
        }

        // 1. Override direto no documento da empresa (Master configurou individualmente)
        if (licenca.relatoriosPermitidos && Array.isArray(licenca.relatoriosPermitidos)) {
            return licenca.relatoriosPermitidos;
        }

        // 2. Tenta resolver pelo plano
        const planoId = (licenca.plano || '').toLowerCase().replace(/\s+/g, '_');

        // Mapeia variações de nome para chave padrão
        let chave = null;
        if (planoId.includes('ultra') || planoId.includes('completo') || planoId.includes('ilimitado')) chave = 'plano_ultra';
        else if (planoId.includes('enterprise')) chave = 'plano_enterprise';
        else if (planoId.includes('pro') || planoId.includes('profissional')) chave = 'plano_pro';
        else if (planoId.includes('fiscal')) chave = 'plano_fiscal';
        else if (planoId.includes('balcao')) chave = 'plano_balcao_caixa';
        else if (planoId.includes('start') || planoId.includes('basico') || planoId === 'free') chave = 'plano_start';
        else {
            // Tenta matching direto (ex: 'plano_pro', 'plano_start')
            chave = Object.keys(RELATORIOS_POR_PLANO_PADRAO).find(k => planoId.includes(k.replace('plano_', ''))) || null;
        }

        if (chave && RELATORIOS_POR_PLANO_PADRAO[chave]) {
            return RELATORIOS_POR_PLANO_PADRAO[chave];
        }

        // 3. Se o plano tiver o módulo de relatórios completo (relatorios), libera tudo
        const mods = licenca.modulosLiberados || _resolverModulos(licenca);
        if (mods.includes('relatorios')) {
            return CATALOGO_RELATORIOS.map(r => r.id);
        }

        // 4. Acesso mínimo
        return ['rel_top_produtos', 'rel_historico_vendas'];
    }

    /**
     * Verifica se um relatório específico está liberado.
     * @param {string} relatorioId - ex: 'rel_dre', 'rel_ia_assistente'
     * @param {object} [licenca] - opcional, usa window.currentSaaSLicense se omitido
     * @returns {boolean}
     */
    function verificarAcessoRelatorio(relatorioId, licenca) {
        const permitidos = obterRelatoriosPermitidos(licenca);
        return permitidos.includes(relatorioId);
    }

    // -----------------------------------------------------------------------
    // CONTROLE DE LIMITE DE USUÁRIOS POR PLANO
    // -----------------------------------------------------------------------
    function obterLimiteUsuarios(licenca) {
        licenca = licenca || window.currentSaaSLicense || window.currentEmpresaData || {};

        // 1. Limite configurado explicitamente no documento da empresa ou plano
        if (licenca.limiteUsuarios !== undefined && licenca.limiteUsuarios !== null && licenca.limiteUsuarios !== '') {
            const raw = String(licenca.limiteUsuarios).trim();
            if (/ilimitad/i.test(raw)) {
                return { limite: 999999, ilimitado: true, planoNome: licenca.plano || 'Ilimitado' };
            }
            const num = parseInt(raw.replace(/\D+/g, ''), 10);
            if (!isNaN(num) && num > 0) {
                return { limite: num, ilimitado: false, planoNome: licenca.plano || 'Personalizado' };
            }
        }

        // 2. Fallback baseado no plano padrão
        const plano = (licenca.plano || '').toLowerCase();
        let limite = 2; // Default start
        let ilimitado = false;
        let planoNome = 'Start Express';

        if (plano.includes('ultra') || plano.includes('completo') || plano.includes('ilimitado')) {
            limite = 999999;
            ilimitado = true;
            planoNome = 'Ultra Completo';
        } else if (plano.includes('enterprise')) {
            limite = 10;
            planoNome = 'Enterprise';
        } else if (plano.includes('pro') || plano.includes('profissional')) {
            limite = 5;
            planoNome = 'Profissional';
        } else if (plano.includes('fiscal')) {
            limite = 3;
            planoNome = 'Fiscal & Vendas';
        } else if (plano.includes('balcao')) {
            limite = 4;
            planoNome = 'Varejo Balcão';
        } else {
            limite = 2;
            planoNome = 'Start Express';
        }

        return { limite: limite, ilimitado: ilimitado, planoNome: planoNome };
    }

    function verificarLimiteUsuarios(totalAtual, licenca) {
        const info = obterLimiteUsuarios(licenca);
        const atual = typeof totalAtual === 'number' ? totalAtual : 0;
        const permitido = info.ilimitado || atual < info.limite;
        return {
            permitido: permitido,
            atual: atual,
            limite: info.limite,
            ilimitado: info.ilimitado,
            plano: info.planoNome,
            restantes: Math.max(0, info.limite - atual)
        };
    }

    function exibirModalLimiteUsuarios(limiteInfo) {
        const antigo = document.getElementById('modal-limite-usuarios-saas');
        if (antigo) antigo.remove();

        const planoNome = (limiteInfo && limiteInfo.plano) || 'Atual';
        const limite = (limiteInfo && limiteInfo.limite) || 2;
        const atual = (limiteInfo && limiteInfo.atual) || limite;
        const msgWpp = encodeURIComponent(`Olá! Atingi o limite de ${limite} usuários no plano "${planoNome}" da minha loja no FC-Gestão e gostaria de fazer upgrade para adicionar mais colaboradores.`);

        const modal = document.createElement('div');
        modal.id = 'modal-limite-usuarios-saas';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl animate-fade-in relative">
                <button onclick="document.getElementById('modal-limite-usuarios-saas').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl mx-auto mb-4">
                    <i class="fa-solid fa-user-lock"></i>
                </div>
                <span class="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
                    Limite do Plano Atingido
                </span>
                <h3 class="text-xl font-black text-white mb-2">Limite de Usuários Atingido</h3>
                <p class="text-slate-300 text-sm mb-4 leading-relaxed">
                    Sua conta no plano <strong class="text-amber-400 font-bold">${planoNome}</strong> já atingiu o limite contratado de 
                    <strong class="text-white font-black">${limite} ${limite === 1 ? 'usuário' : 'usuários'}</strong> (atualmente <strong class="text-amber-300">${atual}</strong> cadastrados).
                </p>
                <div class="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 mb-5 text-left flex items-center gap-3">
                    <i class="fa-solid fa-circle-info text-blue-400 text-lg"></i>
                    <p class="text-xs text-slate-300">Faça o upgrade do seu plano para liberar mais acessos individuais e manter sua equipe sincronizada!</p>
                </div>
                <div class="flex flex-col gap-2">
                    <a href="https://wa.me/${SUPORTE_WHATSAPP}?text=${msgWpp}" target="_blank" class="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2">
                        <i class="fa-brands fa-whatsapp text-base"></i> Fazer Upgrade no WhatsApp
                    </a>
                    <button onclick="document.getElementById('modal-limite-usuarios-saas').remove()" class="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all">
                        Fechar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // -----------------------------------------------------------------------
    // CONTROLE DE MODELO OPERACIONAL DO PDV (Fluxo de Venda)
    // -----------------------------------------------------------------------
    function obterFluxoPDV(licenca) {
        licenca = licenca || window.currentSaaSLicense || window.currentEmpresaData || {};
        if (licenca.fluxoPDV) return licenca.fluxoPDV;
        const plano = (licenca.plano || '').toLowerCase();
        if (plano.includes('start')) return 'direto';
        if (plano.includes('balcao')) return 'caixa';
        return 'ambos';
    }

    // -----------------------------------------------------------------------
    // EXPORTS GLOBAIS
    // -----------------------------------------------------------------------
    window.consultarLicencaCentral = consultarLicencaCentral;
    window.obterInstanciaSaaS = obterInstanciaSaaS;
    window.verificarAcessoModulo = verificarAcessoModulo;
    window.temPermissaoModulo = temPermissaoModulo;
    window.aplicarBloqueioPlano = aplicarBloqueioPlano;
    window.aplicarBloqueioTotal = aplicarBloqueioTotal;
    window.iniciarListenerBloqueioTempoReal = iniciarListenerBloqueioTempoReal;
    window.SAAS_CONFIG = SAAS_CONFIG;
    window.SAAS_NOMES_MODULOS = NOMES_MODULOS;
    window._resolverModulosSaaS = _resolverModulos;
    window.SAAS_CATALOGO_RELATORIOS = CATALOGO_RELATORIOS;
    window.SAAS_RELATORIOS_POR_PLANO_PADRAO = RELATORIOS_POR_PLANO_PADRAO;
    window.obterRelatoriosPermitidos = obterRelatoriosPermitidos;
    window.verificarAcessoRelatorio = verificarAcessoRelatorio;
    window.obterLimiteUsuarios = obterLimiteUsuarios;
    window.verificarLimiteUsuarios = verificarLimiteUsuarios;
    window.exibirModalLimiteUsuarios = exibirModalLimiteUsuarios;
    window.obterFluxoPDV = obterFluxoPDV;
    window._verificarExpiracaoSaaS = _verificarExpiracao;
    window.renderizarBannerTrial = renderizarBannerTrial;
    window.removerBannerTrial = removerBannerTrial;
    window.abrirModalContratarPlano = abrirModalContratarPlano;
})();
