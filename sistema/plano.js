// =======================================================================
// PLANO.JS - MOTOR DE GESTÃO DE ASSINATURA, TRIAL E RENOVAÇÃO ONLINE
// Integrado ao SaaS Central, Firebase Firestore e Mercado Pago Checkout Pro
// =======================================================================

(function() {
    let unsubscribeEmpresaListener = null;
    let empresaAtualId = null;
    let cicloCobrancaAtual = 'mensal'; // 'mensal' ou 'anual'

    function alternarCicloCobranca(novoCiclo) {
        cicloCobrancaAtual = novoCiclo;
        const btnMensal = document.getElementById('btn-ciclo-mensal');
        const btnAnual = document.getElementById('btn-ciclo-anual');
        if (novoCiclo === 'anual') {
            if (btnAnual) {
                btnAnual.className = 'px-6 py-2 rounded-xl text-xs font-extrabold transition-all bg-emerald-600 text-white shadow-md flex items-center gap-1.5 cursor-pointer';
            }
            if (btnMensal) {
                btnMensal.className = 'px-6 py-2 rounded-xl text-xs font-extrabold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer';
            }
        } else {
            if (btnMensal) {
                btnMensal.className = 'px-6 py-2 rounded-xl text-xs font-extrabold transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm cursor-pointer';
            }
            if (btnAnual) {
                btnAnual.className = 'px-6 py-2 rounded-xl text-xs font-extrabold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1.5 cursor-pointer';
            }
        }
        if (dadosEmpresaAtual) {
            renderizarCardsPlanos(dadosEmpresaAtual);
        }
    }
    window.alternarCicloCobranca = alternarCicloCobranca;
    let dadosEmpresaAtual = null;

    // Catálogo completo de planos e seus recursos
        // Catálogo completo de planos sincronizado rigorosamente com o SaaS Central (fcgestao-testes)
    let CATALOGO_PLANOS = [
        {
            id: 'plano_start',
            chave: 'START',
            nome: 'Start Express (PDV Direto)',
            preco: 'R$ 69,90',
            precoNum: 69.90,
            descricao: 'Perfeito para microempresas e MEIs com caixa único de atendimento ágil, recebendo e finalizando a venda diretamente no PDV.',
            cor: 'slate',
            destaque: false,
            badgeModelo: 'PDV Direto',
            usuariosBadge: 'Até 2 Usuários',
            produtosBadge: 'Até 500 Produtos',
            recursos: [
                'Frente de Caixa (PDV Direto) Rápido',
                'Controle de Vendas & Estoque',
                'Cadastro de Produtos e Clientes',
                'Até 2 Usuários Simultâneos',
                'Impressão Térmica 80mm/58mm'
            ]
        },
        {
            id: 'plano_balcao_caixa',
            chave: 'VAREJO_BALCAO',
            nome: 'Varejo Balcão (Pré-Venda + Caixa Central)',
            preco: 'R$ 99,90',
            precoNum: 99.90,
            descricao: 'Novo Modelo de Negócio: vendedores atendem e geram pré-vendas/pedidos no balcão e o cliente efetua o pagamento no Caixa Central.',
            cor: 'blue',
            destaque: false,
            badgeModelo: 'Pré-Venda + Caixa Central',
            usuariosBadge: 'Até 4 Usuários (Vendedores + Caixa)',
            produtosBadge: 'Produtos Ilimitados',
            recursos: [
                'Tudo do Start Express',
                'Pré-Venda no Balcão + Caixa Central Separado',
                'Até 4 Usuários (Vendedores + Caixa)',
                'Orçamentos com Impressão Térmica / PDF',
                'Gestão de Comissões de Vendedores'
            ]
        },
        {
            id: 'plano_fiscal',
            chave: 'FISCAL',
            nome: 'Fiscal & Vendas',
            preco: 'R$ 139,99',
            precoNum: 139.99,
            descricao: 'Ideal para comércios que precisam emitir notas fiscais eletrônicas com rapidez e segurança tributária, operando com PDV Direto ou Pré-Venda.',
            cor: 'cyan',
            destaque: false,
            badgeModelo: 'PDV Direto & Pré-Venda',
            usuariosBadge: 'Até 3 Usuários',
            produtosBadge: 'Produtos Ilimitados',
            recursos: [
                'Tudo do Varejo Balcão',
                'Emissor Fiscal Próprio SEFAZ (NFC-e e NF-e)',
                'Emissão Nativa sem Custos Extras',
                'Importação de XML de Fornecedor',
                'Certificado Digital A1 Integrado',
                'Armazenamento Seguro de XMLs'
            ]
        },
        {
            id: 'plano_pro',
            chave: 'PRO',
            nome: 'Profissional (Gestão & Financeiro)',
            preco: 'R$ 199,99',
            precoNum: 199.99,
            descricao: 'O equilíbrio perfeito: emissão fiscal, gestão financeira completa, DRE, compras XML, catálogo online e escolha flexível entre PDV Direto ou Pré-venda com Caixa.',
            cor: 'amber',
            destaque: true,
            badge: 'MAIS ESCOLHIDO',
            badgeModelo: 'PDV Direto & Caixa Central',
            usuariosBadge: 'Até 6 Usuários',
            produtosBadge: 'Produtos Ilimitados',
            recursos: [
                'Tudo do Fiscal & Vendas',
                'Financeiro Completo: DRE, Contas a Pagar/Receber',
                'Entrada de Notas por XML de Fornecedor',
                'Módulo de Móveis: Montagem & Entrega',
                'Tabelas de Preço Múltiplas & Orçamentos',
                'Catálogo Online de Produtos Integrado',
                'Até 6 Usuários com Permissões por Perfil'
            ]
        },
        {
            id: 'plano_enterprise',
            chave: 'ENTERPRISE',
            nome: 'Enterprise (Gestão + IA Gemini)',
            preco: 'R$ 249,90',
            precoNum: 249.90,
            descricao: 'Pacote avançado com inteligência artificial generativa comercial, relatórios preditivos, suporte a múltiplos PDVs de balcão e caixas centrais.',
            cor: 'purple',
            destaque: false,
            badgeModelo: 'PDV Direto & Caixa Central',
            usuariosBadge: 'Até 10 Usuários',
            produtosBadge: 'Produtos Ilimitados',
            recursos: [
                'Tudo do Plano Profissional',
                'Inteligência Artificial Gemini Comercial',
                'Análises Preditivas de Giro e Compras',
                'Até 10 Usuários Simultâneos',
                'Múltiplos Caixas e Frente de Loja',
                'Relatórios Gerenciais Avançados (Curva ABC, Kardex)',
                'Suporte VIP via Vídeo e WhatsApp'
            ]
        },
        {
            id: 'plano_ultra',
            chave: 'ULTRA',
            nome: 'Ultra Completo (Grandes Lojas)',
            preco: 'R$ 310,99',
            precoNum: 310.99,
            descricao: 'A suíte total definitiva: 100% de todos os módulos liberados, multiusuários ilimitados, fluxo flexível (PDV Direto ou Caixa Central), IA Gemini irrestrita e suporte VIP 24/7.',
            cor: 'emerald',
            destaque: false,
            badgeModelo: 'PDV Direto & Caixa Central',
            usuariosBadge: 'Usuários Ilimitados',
            produtosBadge: 'Produtos Ilimitados',
            recursos: [
                'Suíte 100% Irrestrita e Sem Limites',
                'Emissão Nativa NFC-e e NF-e (SEFAZ)',
                'Usuários e Produtos ILIMITADOS',
                'Multi-Lojas e Filiais Centralizadas',
                'IA Gemini Ilimitada para Toda a Equipe',
                'Todos os Relatórios do SaaS Liberados',
                'Gerente de Conta Dedicado 24/7'
            ]
        }
    ];

    // Consulta assíncrona ao banco central do SaaS (fcgestao-testes) para sincronizar preços e novos planos em tempo real
    async function sincronizarPlanosComSaaSCentral() {
        try {
            let sDb = null;
            if (typeof firebase !== 'undefined' && firebase.apps) {
                let appSaas = firebase.apps.find(a => a.name === 'saasCentral' || a.name === 'saasMasterApp');
                if (!appSaas) {
                    const saasConfig = {
                        apiKey: "AIzaSyAvaDdhJSFP6WKs8UFRvlQmNGFlc1ZKgFk",
                        authDomain: "fcgestao-testes.firebaseapp.com",
                        projectId: "fcgestao-testes"
                    };
                    appSaas = firebase.initializeApp(saasConfig, 'saasMasterApp');
                }
                if (appSaas) sDb = appSaas.firestore();
            }
            if (!sDb && typeof window.obterInstanciaSaaS === 'function') {
                sDb = window.obterInstanciaSaaS();
            }
            if (!sDb) return;
            const snap = await sDb.collection('planos_saas').get();
            if (!snap.empty) {
                snap.forEach(doc => {
                    const data = doc.data();
                    const pLocal = CATALOGO_PLANOS.find(p => p.id === doc.id || (p.nome && p.nome.toLowerCase().includes(doc.id.replace('plano_', ''))));
                    if (pLocal && data.preco !== undefined) {
                        pLocal.precoNum = Number(data.preco);
                        pLocal.preco = 'R$ ' + pLocal.precoNum.toFixed(2).replace('.', ',');
                        if (data.nome) pLocal.nome = data.nome;
                        if (data.descricao) pLocal.descricao = data.descricao;
                        if (data.usuarios) pLocal.usuariosBadge = data.usuarios;
                    }
                });
                if (dadosEmpresaAtual) renderizarCardsPlanos(dadosEmpresaAtual);
            }
        } catch(e) {
            console.warn('[Plano] Conexão remota SaaS:', e.message);
        }
    }
    setTimeout(() => sincronizarPlanosComSaaSCentral().catch(() => {}), 1500);

    document.addEventListener('DOMContentLoaded', () => {
        inicializarTelaPlano();
    });

    async function inicializarTelaPlano() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(inicializarTelaPlano, 200);
            return;
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            const db = firebase.firestore();
            empresaAtualId = localStorage.getItem('fc_empresa_ativa');

            if (!empresaAtualId) {
                try {
                    const uDoc = await db.collection('usuarios').doc(user.uid).get();
                    if (uDoc.exists && uDoc.data().empresaId) {
                        empresaAtualId = uDoc.data().empresaId;
                        localStorage.setItem('fc_empresa_ativa', empresaAtualId);
                    }
                } catch(e) {}
            }

            if (!empresaAtualId) {
                empresaAtualId = 'empresa_padrao';
            }

            // Atualiza dados de suporte e PIX da interface
            if (typeof window.obterDadosPagamentoSaaS === 'function') {
                const dadosPag = window.obterDadosPagamentoSaaS();
                const chaveInput = document.getElementById('campo-chave-pix');
                const titularLabel = document.getElementById('pix-titular-label');
                if (chaveInput && dadosPag.pixChave) chaveInput.value = dadosPag.pixChave;
                if (titularLabel && dadosPag.pixTitular) titularLabel.innerText = dadosPag.pixTitular;
            }

            iniciarMonitoramentoTempoReal(empresaAtualId);
        });
    }

    // Monitoramento em tempo real do Firestore: se pagar no Mercado Pago, a tela atualiza na hora!
    function iniciarMonitoramentoTempoReal(empresaId) {
        if (unsubscribeEmpresaListener) {
            unsubscribeEmpresaListener();
        }

        const db = firebase.firestore();
        unsubscribeEmpresaListener = db.collection('empresas').doc(empresaId).onSnapshot((doc) => {
            if (!doc.exists) return;
            const data = doc.data();
            data.id = doc.id;
            
            const mudouStatusParaAtivo = dadosEmpresaAtual && dadosEmpresaAtual.pago !== true && data.pago === true;
            dadosEmpresaAtual = data;
            window.currentEmpresaData = data;
            window.currentSaaSLicense = data;

            renderizarPainelPlano(data);
            renderizarCardsPlanos(data);

            if (mudouStatusParaAtivo) {
                if (typeof showToast === 'function') {
                    showToast('🎉 Pagamento confirmado pelo Mercado Pago! Seu plano foi renovado com sucesso.', 'success');
                }
                const overlay = document.getElementById('fc-saas-overlay-bloqueio');
                if (overlay) overlay.remove();
            }
        }, (err) => {
            console.warn('[Plano] Erro no listener em tempo real:', err.message);
        });
    }

    function parseDataVencimento(empData) {
        if (!empData) return null;
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

        // Se for trial e não tiver vencimento, 7 dias a partir da criação
        if (!dataVenc || isNaN(dataVenc.getTime())) {
            let base = new Date();
            if (empData.dataCriacao && empData.dataCriacao.toDate) {
                base = empData.dataCriacao.toDate();
            }
            dataVenc = new Date(base.getTime() + (7 * 24 * 60 * 60 * 1000));
            dataVenc.setHours(23, 59, 59, 999);
        }

        return { dataVenc, isTrial };
    }

    function renderizarPainelPlano(empData) {
        const { dataVenc, isTrial } = parseDataVencimento(empData);
        const agora = new Date();
        const diffMs = dataVenc ? (dataVenc.getTime() - agora.getTime()) : 0;
        const diasRestantes = isTrial
            ? Math.min(7, Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24))))
            : Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const estaExpirado = diffMs < 0 || empData.status === 'BLOQUEADO';

        // Elementos DOM
        const elTipoBadge = document.getElementById('badge-tipo-assinatura');
        const elStatusBadge = document.getElementById('badge-status-operacional');
        const elTituloPlano = document.getElementById('titulo-nome-plano');
        const elDescricaoTempo = document.getElementById('descricao-status-tempo');
        const elDataInicio = document.getElementById('info-data-inicio');
        const elDataVenc = document.getElementById('info-data-vencimento');
        const elFormaPag = document.getElementById('info-forma-pagamento');
        const elNumeroDias = document.getElementById('contador-numero-dias');
        const elLabelDias = document.getElementById('contador-label-dias');
        const elBarraProgresso = document.getElementById('barra-progresso-tempo');
        const elPercentualTexto = document.getElementById('percentual-tempo-texto');
        const elBoxUrgencia = document.getElementById('box-aviso-urgencia');
        const elMenuBadge = document.getElementById('menu-badge-tempo');

        // Nome do Plano
        const nomePlano = empData.nomePlano || empData.plano || (isTrial ? 'Avaliação Gratuita (Trial)' : 'Start Express');
        if (elTituloPlano) elTituloPlano.innerText = nomePlano;

        // Datas
        if (elDataInicio) {
            let dIni = empData.dataCriacao ? (empData.dataCriacao.toDate ? empData.dataCriacao.toDate() : new Date(empData.dataCriacao)) : agora;
            elDataInicio.innerText = dIni.toLocaleDateString('pt-BR');
        }
        if (elDataVenc) {
            elDataVenc.innerText = dataVenc ? dataVenc.toLocaleDateString('pt-BR') : 'Sem expiração';
        }
        if (elFormaPag) {
            elFormaPag.innerText = empData.formaPagamento === 'MERCADO_PAGO' ? 'Mercado Pago (Online)' : (empData.pago ? 'PIX Direto' : (isTrial ? 'Período Grátis 7 Dias' : 'Pendente'));
        }

        // Tipo de Assinatura Badge
        if (elTipoBadge) {
            if (isTrial) {
                elTipoBadge.className = 'text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5';
                elTipoBadge.innerHTML = '<i class="fa-solid fa-sparkles text-amber-400"></i> Período de Avaliação (Trial 7 Dias)';
            } else {
                elTipoBadge.className = 'text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5';
                elTipoBadge.innerHTML = '<i class="fa-solid fa-crown text-blue-400"></i> Assinatura Mensal Ativa';
            }
        }

        // Status Operacional
        if (elStatusBadge) {
            if (estaExpirado) {
                elStatusBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1';
                elStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400"></span> Expirado';
            } else {
                elStatusBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1';
                elStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ativo';
            }
        }

        // Contador e Barra de Progresso
        const totalDiasCiclo = isTrial ? 7 : 30;
        let pct = 0;

        if (estaExpirado) {
            if (elNumeroDias) {
                elNumeroDias.innerText = '0';
                elNumeroDias.className = 'text-4xl md:text-5xl font-black text-red-500 tracking-tight leading-none my-1';
            }
            if (elLabelDias) elLabelDias.innerText = 'plano expirado';
            if (elDescricaoTempo) elDescricaoTempo.innerHTML = '<strong class="text-red-400">Seu período de acesso terminou!</strong> Escolha um plano abaixo para liberar imediatamente o seu sistema.';
            if (elBarraProgresso) {
                elBarraProgresso.style.width = '100%';
                elBarraProgresso.className = 'bg-red-500 h-full rounded-full transition-all duration-500';
            }
            if (elPercentualTexto) elPercentualTexto.innerText = 'Assinatura vencida';
            if (elBoxUrgencia) elBoxUrgencia.classList.remove('hidden');
            if (elMenuBadge) {
                elMenuBadge.innerText = 'Expirado';
                elMenuBadge.className = 'ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30';
            }
        } else {
            const diasExibidos = Math.max(0, diasRestantes);
            pct = Math.min(100, Math.max(5, Math.round((diasExibidos / totalDiasCiclo) * 100)));

            if (elNumeroDias) {
                elNumeroDias.innerText = diasExibidos;
                elNumeroDias.className = diasExibidos <= 3 ? 'text-4xl md:text-5xl font-black text-amber-400 tracking-tight leading-none my-1' : 'text-4xl md:text-5xl font-black text-emerald-400 tracking-tight leading-none my-1';
            }
            if (elLabelDias) {
                elLabelDias.innerText = diasExibidos === 1 ? 'dia restante' : 'dias restantes';
            }

            if (elDescricaoTempo) {
                if (isTrial) {
                    elDescricaoTempo.innerHTML = `Você está no período de teste gratuito com acesso total a todos os recursos. Restam <strong class="text-amber-400 font-extrabold whitespace-nowrap">${diasExibidos} ${diasExibidos === 1 ? 'dia' : 'dias'}</strong> para o término da avaliação.`;
                } else {
                    elDescricaoTempo.innerHTML = `Sua assinatura está regular e liberada. Próxima data de renovação prevista para <strong class="text-emerald-400 font-extrabold">${dataVenc ? dataVenc.toLocaleDateString('pt-BR') : ''}</strong>.`;
                }
            }

            if (elBarraProgresso) {
                elBarraProgresso.style.width = pct + '%';
                elBarraProgresso.className = diasExibidos <= 3
                    ? 'bg-gradient-to-r from-red-500 to-amber-500 h-full rounded-full transition-all duration-500'
                    : 'bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500';
            }
            if (elPercentualTexto) {
                elPercentualTexto.innerText = `${pct}% do período ainda disponível`;
            }

            if (elBoxUrgencia) {
                if (diasExibidos <= 3) {
                    elBoxUrgencia.classList.remove('hidden');
                } else {
                    elBoxUrgencia.classList.add('hidden');
                }
            }

            if (elMenuBadge) {
                elMenuBadge.innerText = `${diasExibidos}d`;
                elMenuBadge.className = diasExibidos <= 3
                    ? 'ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            }
        }

        // Atualiza link de WhatsApp com mensagem contextualizada
        const btnWhats = document.getElementById('btn-whats-comprovante');
        if (btnWhats) {
            const nomeLoja = empData.nomeEmpresa || empData.nome || 'Minha Loja';
            const txt = encodeURIComponent(`Olá! Gostaria de falar sobre a renovação/plano da minha loja "${nomeLoja}" (ID: ${empData.id || empresaAtualId}).`);
            const zapNum = (window.obterDadosPagamentoSaaS && window.obterDadosPagamentoSaaS().whatsapp) || '5562999676874';
            btnWhats.href = `https://wa.me/${zapNum.replace(/\D/g, '')}?text=${txt}`;
        }
    }

            function renderizarCardsPlanos(empData) {
        const grid = document.getElementById('grid-planos-saas');
        if (!grid) return;

        const isAnual = cicloCobrancaAtual === 'anual';
        const planoAtualStr = (empData.plano || empData.nomePlano || '').toUpperCase();

        grid.innerHTML = CATALOGO_PLANOS.map(p => {
            const precoBase = p.precoNum;
            const desconto = isAnual ? 20 : 0;
            const precoMensalEquiv = isAnual ? (precoBase * 0.8) : precoBase;
            const precoAnualTotal = (precoMensalEquiv * 12);
            
            const precoExibido = 'R$ ' + precoMensalEquiv.toFixed(2).replace('.', ',');
            const infoAnualHtml = isAnual 
                ? `<div class="mt-1 text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                     <i class="fa-solid fa-tag"></i> 20% OFF aplicado (R$ ${precoAnualTotal.toFixed(2).replace('.', ',')} /ano)
                   </div>`
                : '';

            const isPlanoAtual = planoAtualStr.includes(p.chave) || planoAtualStr.includes(p.nome.toUpperCase().split(' ')[0]);
            const borda = p.destaque 
                ? 'border-amber-500/80 shadow-lg shadow-amber-500/10' 
                : (isPlanoAtual ? 'border-blue-500 shadow-md' : 'border-slate-200 dark:border-slate-700/80');
            const bgBadgeDestaque = p.badge 
                ? `<span class="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow">${p.badge}</span>` 
                : '';
            const badgeAtual = isPlanoAtual 
                ? `<span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-2">Plano Atual</span>` 
                : '';

            const recursosHtml = p.recursos.map(rec => `
                <li class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <i class="fa-solid fa-check text-emerald-500 text-xs shrink-0"></i>
                    <span>${rec}</span>
                </li>
            `).join('');

            const valorCobrado = isAnual ? precoAnualTotal.toFixed(2) : precoBase.toFixed(2);
            const nomeCobrado = isAnual ? `${p.nome} (Anual - 20% OFF)` : p.nome;

            return `
                <div class="relative rounded-2xl bg-white dark:bg-slate-800 border-2 ${borda} p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                    ${bgBadgeDestaque}
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-base font-black text-slate-900 dark:text-white flex items-center leading-tight">
                                ${p.nome} ${badgeAtual}
                            </h4>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 min-h-[36px] leading-relaxed">${p.descricao}</p>

                        <!-- BADGES DO MODELO E CAPACIDADE -->
                        <div class="flex flex-wrap gap-1.5 mb-4">
                            ${p.usuariosBadge ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><i class="fa-solid fa-user-group text-[9px] mr-1"></i>${p.usuariosBadge}</span>` : ''}
                            ${p.produtosBadge ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"><i class="fa-solid fa-box text-[9px] mr-1"></i>${p.produtosBadge}</span>` : ''}
                            ${p.badgeModelo ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800"><i class="fa-solid fa-cash-register text-[9px] mr-1"></i>${p.badgeModelo}</span>` : ''}
                        </div>

                        <div class="mb-5 pb-5 border-b border-slate-100 dark:border-slate-700">
                            <span class="text-3xl font-black text-slate-900 dark:text-white">${precoExibido}</span>
                            <span class="text-xs text-slate-400 font-semibold">/mês</span>
                            ${infoAnualHtml}
                        </div>

                        <ul class="space-y-2.5 mb-6">
                            ${recursosHtml}
                        </ul>
                    </div>

                    <div class="pt-2 space-y-2">
                        <!-- BOTÃO OFICIAL DE CHECKOUT PRO DO MERCADO PAGO -->
                        <button type="button" onclick="contratarPlanoMercadoPago('${nomeCobrado}', '${valorCobrado}')" class="w-full bg-[#009ee3] hover:bg-[#0082ba] active:scale-[0.98] text-white font-extrabold text-xs py-3 px-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-bolt text-amber-300"></i> ${isAnual ? 'Pagar Anual com 20% OFF' : 'Pagar Online com Mercado Pago'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Dispara a contratação / renovação via Mercado Pago
    async function contratarPlanoMercadoPago(nomePlano, valorNumerico) {
        if (typeof window.iniciarPagamentoMercadoPagoSaaS === 'function') {
            await window.iniciarPagamentoMercadoPagoSaaS(nomePlano, valorNumerico);
        } else {
            alert('Gerando link seguro com o Mercado Pago...');
        }
    }
    window.contratarPlanoMercadoPago = contratarPlanoMercadoPago;

    function rolarParaPlanos() {
        const el = document.getElementById('secao-planos-escolha');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    window.rolarParaPlanos = rolarParaPlanos;

    function recarregarDadosPlano() {
        if (empresaAtualId) {
            iniciarMonitoramentoTempoReal(empresaAtualId);
            if (typeof showToast === 'function') showToast('Status atualizado em tempo real.', 'info');
        }
    }
    window.recarregarDadosPlano = recarregarDadosPlano;

    function copiarChavePixSaaS() {
        const campo = document.getElementById('campo-chave-pix');
        if (!campo) return;
        campo.select();
        navigator.clipboard.writeText(campo.value).then(() => {
            if (typeof showToast === 'function') {
                showToast('Chave PIX copiada para a área de transferência!', 'success');
            } else {
                alert('Chave PIX copiada!');
            }
        });
    }
    window.copiarChavePixSaaS = copiarChavePixSaaS;

})();
