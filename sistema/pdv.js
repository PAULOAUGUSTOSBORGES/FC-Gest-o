// ==========================================
// OPERACAO.JS - SISTEMA 100% WHITE LABEL E BLINDADO
// ==========================================

let cart = [];
let html5QrCode = null; 
let acaoConfirmacaoPendente = null;
let pagamentosVendaAtual = [];
let pdvTotalAtual = 0; 
let osFotosArray = []; 
window.vendaEmEdicao = null; 
window.vendaAtualImpressao = null;
window._pdvCarregandoInicial = true;
setTimeout(() => { window._pdvCarregandoInicial = false; }, 3000);

// ==========================================
// PROTECAO ANTI-VENDA DUPLICADA
// Impede multiplos cliques no botao Finalizar
// ==========================================
// ==========================================
// CONFIGURAÇÕES E CÁLCULO DE MARGEM MÍNIMA / ALERTA DE LUCRO NO PDV
// ==========================================
function obterMargemMinimaConfigurada() {
    if (window.db && window.db.config && window.db.config.pdvMargemMinima !== undefined) {
        return Math.max(0, Number(window.db.config.pdvMargemMinima));
    }
    return 15; // Padrão 15%
}

function obterAcaoAlertaMargem() {
    if (window.db && window.db.config && window.db.config.pdvAcaoAlertaMargem) {
        return window.db.config.pdvAcaoAlertaMargem;
    }
    return 'alerta';
}

function calcularMargemLucroItem(item, rateioDescGlobal = 0) {
    const qtd = Number(item.qtd) || 1;
    const precoUnit = (typeof parseInputMoney === 'function') 
        ? parseInputMoney(item.preco) 
        : (parseFloat(String(item.preco || 0).replace(',', '.')) || 0);
    const custoUnit = (typeof parseInputMoney === 'function') 
        ? parseInputMoney(item.custo) 
        : (parseFloat(String(item.custo || 0).replace(',', '.')) || 0);
    const descItem = (typeof parseInputMoney === 'function') 
        ? parseInputMoney(item.desconto) 
        : (parseFloat(String(item.desconto || 0).replace(',', '.')) || 0);
    
    const rateioNum = Number(rateioDescGlobal) || 0;
    const totalDesconto = descItem + rateioNum;
    const precoTotalVenda = Math.max(0, (precoUnit * qtd) - totalDesconto);
    const custoTotal = custoUnit * qtd;
    const lucro = precoTotalVenda - custoTotal;
    
    let perc = 0;
    if (custoTotal > 0) {
        perc = (lucro / custoTotal) * 100;
    } else if (precoTotalVenda > 0) {
        perc = 100;
    }

    const precoBase = (typeof parseInputMoney === 'function' && item.precoOriginal !== undefined) 
        ? parseInputMoney(item.precoOriginal) 
        : precoUnit;
    const temDesconto = (totalDesconto > 0.001) || (precoUnit < precoBase - 0.001);

    return {
        qtd,
        precoUnit,
        custoUnit,
        descItem,
        descontoTotal: totalDesconto,
        temDesconto,
        precoTotalVenda,
        custoTotal,
        lucro,
        perc: Number(perc.toFixed(2))
    };
}
window.obterMargemMinimaConfigurada = obterMargemMinimaConfigurada;
window.obterAcaoAlertaMargem = obterAcaoAlertaMargem;
window.calcularMargemLucroItem = calcularMargemLucroItem;

let isProcessingVenda = false;
let vendaIdempotencyKey = null;
let _vendaLockTimestamp = 0;
let _vendaSafetyTimeout = null;

/** Gera uma nova chave unica de idempotencia para a sessao de venda atual */
function gerarIdempotencyKey() {
    const uid = (window.currentUser && window.currentUser.uid) ? window.currentUser.uid : 'anonimo';
    vendaIdempotencyKey = uid + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    return vendaIdempotencyKey;
}

/** Libera o botao de finalizar e reseta a flag de processamento */
function liberarBotaoFinalizar() {
    isProcessingVenda = false;
    _vendaLockTimestamp = 0;
    if (_vendaSafetyTimeout) {
        clearTimeout(_vendaSafetyTimeout);
        _vendaSafetyTimeout = null;
    }
    vendaIdempotencyKey = null;
    const btn = document.getElementById('btn-finalizar-venda');
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-wait');
        if (typeof atualizarResumoPagamentosVenda === 'function') atualizarResumoPagamentosVenda();
    }
}
window.liberarBotaoFinalizar = liberarBotaoFinalizar;

function obterDataHojeLocalYYYYMMDD() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Evita o "piscar" da tela carregando as abas instantaneamente antes do Firebase
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'pdv';
    if (typeof mudarVisaoLocal === 'function') mudarVisaoLocal(view);
    const elDataVenda = document.getElementById('pdv-data');
    if (elDataVenda && !elDataVenda.value) {
        elDataVenda.value = obterDataHojeLocalYYYYMMDD();
    }
});

// ==========================================
// 1. MOTOR INTELIGENTE: IDENTIDADE DA EMPRESA E CLIENTE
// ==========================================
function obterDadosEmpresa() {
    const defaultName = 'Empresa Não Cadastrada';
    const defaultCnpj = '00.000.000/0000-00';
    const defaultTel = '(00) 0000-0000';
    const defaultEnd = 'Endereço não informado nas configurações';
    
    if (db && db.config && db.config.empresa) {
        return {
            nome: db.config.empresa.nome || defaultName,
            cnpj: db.config.empresa.cnpj || defaultCnpj,
            tel: db.config.empresa.telefone || defaultTel,
            end: db.config.empresa.endereco || defaultEnd,
            logoHtml: db.config.empresa.logo ? `<img src="${db.config.empresa.logo}" style="max-height: 80px; margin-bottom: 10px; border-radius: 8px; object-fit: contain;">` : ''
        };
    }
    return { nome: defaultName, cnpj: defaultCnpj, tel: defaultTel, end: defaultEnd, logoHtml: '' };
}

function aplicarIdentidadeVisualNoMenu() {
    if (typeof aplicarIdentidadeVisualGlobal === 'function') {
        aplicarIdentidadeVisualGlobal();
        return;
    }
    const empNomeEl = document.getElementById('menu-empresa-nome');
    const logoImg = document.getElementById('menu-logo');
    const logoPlaceholder = document.getElementById('menu-logo-placeholder');

    const emp = (window.db && window.db.config && window.db.config.empresa) ? window.db.config.empresa : {};
    const empIdAtiva = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : localStorage.getItem('fc_empresa_ativa');
    const fallbackNome = (window.currentEmpresaData?.nomeEmpresa) || (window.currentEmpresaData?.nome) || localStorage.getItem('fc_nome_empresa_ativa') || 'Minha Loja';
    const nomeEmp = emp.fantasia || emp.nome || fallbackNome;

    if (empNomeEl) empNomeEl.innerText = nomeEmp;

    let logoSrc = emp.logo || (window.currentEmpresaData && window.currentEmpresaData.logo) || '';
    if (!logoSrc && empIdAtiva) {
        try {
            const c = JSON.parse(localStorage.getItem('fc_empresa_cache_' + empIdAtiva) || '{}');
            logoSrc = c.logo || '';
        } catch(e) {}
    }
    if (!logoSrc) {
        logoSrc = localStorage.getItem('fc_logo_empresa_ativa') || '';
    }

    if (logoImg && logoPlaceholder) {
        if (logoSrc && typeof logoSrc === 'string' && logoSrc.trim()) {
            logoImg.src = logoSrc;
            logoImg.classList.remove('hidden');
            logoPlaceholder.classList.add('hidden');
            logoImg.onerror = function() {
                logoImg.classList.add('hidden');
                logoPlaceholder.classList.remove('hidden');
            };
        } else {
            logoImg.classList.add('hidden');
            logoPlaceholder.classList.remove('hidden');
        }
    }
}

function obterDadosClientePDV(cId) {
    const c = cId && cId !== "0" && db.clientes ? db.clientes.find(x => String(x.id) === String(cId)) : null;
    if(!c) return { nome: 'Consumidor Final', doc: 'Não informado', tel: 'Não informado', endCompleto: 'Não informado', rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', ibge: '' };
    
    const doc = c.cpfCnpj || c.documento || c.cnpj || c.cpf || c.doc || c.cpf_cnpj || 'Não informado';
    const tel = c.whatsapp || c.wpp || c.celular || c.telefone || c.telefoneFixo || c.tel || 'Não informado';
    
    const rua = c.rua || c.logradouro || c.endereco || c.end || '';
    const num = c.numero ? ', ' + c.numero : '';
    const endCompleto = rua ? (rua + num) : 'Não informado';

    let cidadeLimpa = (c.cidade || '').trim();
    let ufLimpa = (c.uf || '').trim();
    if (cidadeLimpa.includes(' - ')) {
        const parts = cidadeLimpa.split(' - ');
        cidadeLimpa = parts[0].trim();
        if (!ufLimpa && parts[1]) ufLimpa = parts[1].trim();
    } else if (cidadeLimpa.includes('/')) {
        const parts = cidadeLimpa.split('/');
        cidadeLimpa = parts[0].trim();
        if (!ufLimpa && parts[1]) ufLimpa = parts[1].trim();
    }
    let ibgeLimpo = (c.ibge || '').trim();
    const cepLimpo = (c.cep ? String(c.cep).replace(/\D/g, '') : '');
    if ((!ibgeLimpo || ibgeLimpo === '5208707') && (cidadeLimpa.toUpperCase() === 'FORMOSA' || cepLimpo.startsWith('7380') || cepLimpo.startsWith('7381'))) {
        ibgeLimpo = '5208004';
    }
    if (!ufLimpa && (cidadeLimpa.toUpperCase() === 'FORMOSA' || cepLimpo.startsWith('738'))) {
        ufLimpa = 'GO';
    }
    
    return {
        id: c.id,
        nome: c.nome || c.razaoSocial || 'Consumidor Final',
        doc: doc,
        cpf: (doc.replace(/\D/g, '').length === 11) ? doc.replace(/\D/g, '') : (c.cpf ? c.cpf.replace(/\D/g, '') : ''),
        cnpj: (doc.replace(/\D/g, '').length === 14) ? doc.replace(/\D/g, '') : (c.cnpj ? c.cnpj.replace(/\D/g, '') : ''),
        tel: tel,
        rua: rua,
        numero: c.numero || 'S/N',
        endCompleto: endCompleto,
        bairro: c.bairro || '',
        cidade: cidadeLimpa,
        uf: ufLimpa,
        cep: cepLimpo,
        ibge: ibgeLimpo,
        raw: c
    };
}

// ==========================================
// 2. INICIALIZAÇÃO E NAVEGAÇÃO
// ==========================================
function mudarVisaoLocal(viewId) {
    if (typeof window.salvarEstadoPDV === 'function') {
        window.salvarEstadoPDV();
    }

    document.querySelectorAll('.view-section').forEach(el => { 
        el.classList.add('hidden'); 
        el.classList.remove('active'); 
    });
    
    const viewTarget = document.getElementById(`view-${viewId}`);
    if(viewTarget) {
        viewTarget.classList.remove('hidden');
        viewTarget.classList.add('active');
    }
    
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => { 
        btn.classList.remove('bg-blue-600', 'text-white'); 
        btn.classList.add('text-slate-300'); 
    });
    
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
    if (activeBtn) { 
        activeBtn.classList.remove('text-slate-300'); 
        activeBtn.classList.add('bg-blue-600', 'text-white'); 
    }
    
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }
    
    if (viewId === 'pdv') {
        prepararPDV();
    }
    if (viewId === 'vendas') renderVendas();
    if (viewId === 'orcamentos') renderOrcamentos();
}

function inicializarOperacao() {
    if (window.__paginaBloqueadaPorPermissao || (typeof window.verificarPermissaoRota === 'function' && !window.verificarPermissaoRota(window.location.pathname).permitido)) {
        console.warn('Bloqueando execução: usuário sem permissão para esta rota.');
        return;
    }
    aplicarIdentidadeVisualNoMenu(); 
    
    // Cache inteligente: serve dados instantaneamente do sessionStorage
    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb, opts) {
        let ref = (typeof window.getEmpresaRef === 'function') ? window.getEmpresaRef().collection(col) : firestore.collection(col);
        if (opts && typeof opts.query === 'function') ref = opts.query(ref);
        return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    const _listenDoc = (typeof window.fcListenDoc === 'function') ? window.fcListenDoc : function(col, id, cb) {
        let ref = (typeof window.getEmpresaRef === 'function') ? window.getEmpresaRef().collection(col).doc(id) : firestore.collection(col).doc(id);
        return ref.onSnapshot(doc => cb(doc.exists ? doc.data() : null));
    };

    _listen('produtos', function(dados) {
        db.produtos = dados;
    });
    _listen('clientes', function(dados) {
        db.clientes = dados;
        atualizarListaClientesPDV();
    }, { realtime: true });
    _listen('vendas', function(dados) {
        db.vendas = dados;
        const v = document.getElementById('view-vendas');
        const o = document.getElementById('view-orcamentos');
        if(v && v.classList.contains('active')) renderVendas();
        if(o && o.classList.contains('active')) renderOrcamentos();
        
        // Auto-edicao vinda de outras paginas
        const editId = sessionStorage.getItem('autoEditVendaId');
        if(editId) {
            sessionStorage.removeItem('autoEditVendaId');
            executarEstornoEEdicao(editId);
        }
    });
    // Caixa: sempre ativo pois é crítico (saldo em tempo real)
    _listenDoc('caixa', 'caixa_atual', function(data) {
        db.caixa = data || { status: 'FECHADO', saldo: 0, historico: [] };
        const badgeCaixa = document.getElementById('pdv-status-caixa');
        if (badgeCaixa) prepararPDV();
    });

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function(u) {
            if (u) {
                const targetRef = (typeof window.obterCaixaDocRef === 'function') ? window.obterCaixaDocRef() : window.getEmpresaRef().collection('caixa').doc('caixa_atual');
                targetRef.onSnapshot(function(doc) {
                    db.caixa = (doc && doc.exists) ? doc.data() : { status: 'FECHADO', saldo: 0, historico: [] };
                    const badgeCaixa = document.getElementById('pdv-status-caixa');
                    if (badgeCaixa) prepararPDV();
                }, function(err) {
                    console.warn('Erro ao escutar caixa do operador no PDV:', err);
                });
            }
        });
    }
    _listen('financeiro', function(dados) {
        db.financeiro = dados;
    });
    _listen('funcionarios', function(dados) {
        db.funcionarios = dados;
        atualizarVendedoresPDV();
    }, { realtime: true });
    _listenDoc('configuracoes', 'config', function(dados) {
        if (dados) {
            db.config = { ...(db.config || {}), ...dados };
            if (typeof ajustarOpcoesOperacaoPDV === 'function') ajustarOpcoesOperacaoPDV();
            aplicarIdentidadeVisualNoMenu();
        }
    }, { realtime: true });

    const urlParams = new URLSearchParams(window.location.search);
    mudarVisaoLocal('pdv');
}

window.addEventListener('load', () => { initGlobalData(inicializarOperacao); });

// ==========================================
// 3. FUNÇÕES GENÉRICAS E KARDEX
// ==========================================
function abrirConfirmacao(titulo, mensagem, acao) { 
    document.getElementById('modal-confirm-title').innerText = titulo; 
    document.getElementById('modal-confirm-msg').innerText = mensagem; 
    acaoConfirmacaoPendente = acao; 
    document.getElementById('modal-confirmacao').classList.remove('hidden'); 
    document.getElementById('modal-confirm-btn').onclick = function() { 
        if (acaoConfirmacaoPendente) acaoConfirmacaoPendente(); 
        fecharModalConfirmacao(); 
    }; 
}

function fecharModalConfirmacao() { 
    document.getElementById('modal-confirmacao').classList.add('hidden'); 
    acaoConfirmacaoPendente = null; 
    document.getElementById('modal-confirm-btn').onclick = null; 
}

function abrirZoom(src) { 
    if(!src) return; 
    document.getElementById('zoom-img-src').src = src; 
    document.getElementById('modal-zoom').classList.remove('hidden'); 
}

function fecharZoom() { 
    document.getElementById('modal-zoom').classList.add('hidden'); 
    document.getElementById('zoom-img-src').src = ''; 
}

function abrirZoomCart(index) { 
    if(cart[index] && cart[index].foto) abrirZoom(cart[index].foto); 
}


// ==========================================
// 4. CADASTRO E BUSCA DE CLIENTE RÁPIDO NO PDV
// ==========================================
function selecionarClientePDV(clienteOuId, silencioso = false) {
    let c = null;
    if (typeof clienteOuId === 'object' && clienteOuId !== null) {
        c = clienteOuId;
    } else if (clienteOuId && clienteOuId !== '0') {
        const idStr = String(clienteOuId).trim();
        c = (db.clientes || []).find(x => String(x.id || x._id || '').trim() === idStr);
        if (!c && window._ultimoClienteSelecionado && String(window._ultimoClienteSelecionado.id || window._ultimoClienteSelecionado._id || '').trim() === idStr) {
            c = window._ultimoClienteSelecionado;
        }
    }

    const hiddenId = document.getElementById('pdv-cliente');
    const inputBusca = document.getElementById('pdv-cliente-busca');
    const dropdown = document.getElementById('pdv-cliente-resultados');
    const vendSelect = document.getElementById('pdv-vendedor');

    if (dropdown) dropdown.classList.add('hidden');

    // Desvinculação explícita para Consumidor Final
    if (clienteOuId === null || clienteOuId === undefined || clienteOuId === '0' || clienteOuId === 0) {
        window._clientePendentePDV = null;
        window._ultimoClienteSelecionado = null;
        if (hiddenId) hiddenId.value = '0';
        if (inputBusca) inputBusca.value = '';
        if (vendSelect && !vendSelect.dataset.usuarioAlterou) vendSelect.value = 'Balcão';
        esconderCardClientePDV();
        if (!silencioso && typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
        return;
    }

    // Se passou um ID mas o cadastro de clientes ainda não carregou do Firebase:
    if (!c) {
        const idStr = String(clienteOuId).trim();
        if (idStr && idStr !== '0') {
            window._clientePendentePDV = idStr;
            if (hiddenId) hiddenId.value = idStr;
        }
        return;
    }

    // Cliente encontrado: registra dados ativos
    window._ultimoClienteSelecionado = c;
    window._clientePendentePDV = String(c.id || c._id || '').trim();
    if (hiddenId) hiddenId.value = c.id || c._id || '';
    if (inputBusca) inputBusca.value = c.nome || '';

    // Renderiza card com dados completos do cliente no topo do PDV
    renderizarCardClientePDV(c);

    if (c.vendedor && String(c.vendedor).trim()) {
        const vendedorNome = String(c.vendedor).trim();
        if (vendSelect) {
            if (typeof atualizarVendedoresPDV === 'function') {
                atualizarVendedoresPDV();
            }

            let opt = Array.from(vendSelect.options).find(o => 
                o.value.trim().toLowerCase() === vendedorNome.toLowerCase() ||
                o.textContent.replace(/^Vend:\s*/i, '').trim().toLowerCase() === vendedorNome.toLowerCase()
            );

            if (!opt) {
                opt = document.createElement('option');
                opt.value = vendedorNome;
                opt.textContent = `Vend: ${vendedorNome}`;
                vendSelect.appendChild(opt);
            }

            const vendedorAnterior = (vendSelect.value || '').replace(/^Vend:\s*/i, '').trim().toLowerCase();
            const novoVendedor = opt.value.trim().toLowerCase();
            const nomeSemPrefixo = vendedorNome.toLowerCase();
            const mudouVendedor = (vendedorAnterior !== novoVendedor && vendedorAnterior !== nomeSemPrefixo);

            vendSelect.value = opt.value;

            // Só notifica se não for silencioso, se o vendedor realmente mudou e não estiver na carga inicial da página
            if (!silencioso && mudouVendedor && !window._pdvCarregandoInicial && typeof showToast === 'function') {
                showToast(`Vendedor "${vendedorNome}" preenchido automaticamente pelo cadastro do cliente.`, 'info');
            }
        }
    }

    // Salva o estado imediatamente para que a navegação nunca perca o cliente selecionado
    if (typeof window.salvarEstadoPDV === 'function') {
        window.salvarEstadoPDV();
    }
}
window.selecionarClientePDV = selecionarClientePDV;

function esconderCardClientePDV() {
    const card = document.getElementById('pdv-cliente-info-card');
    if (card) {
        card.classList.add('hidden');
    }
    const btnDeb = document.getElementById('btn-pdv-ver-debitos');
    if (btnDeb) btnDeb.classList.add('hidden');
    window._ultimoClienteSelecionado = null;
    window._clienteDebitosAtual = null;
    window._titulosPendentesClienteAtual = [];
}
window.esconderCardClientePDV = esconderCardClientePDV;

function renderizarCardClientePDV(c) {
    if (!c) {
        esconderCardClientePDV();
        return;
    }
    const card = document.getElementById('pdv-cliente-info-card');
    if (!card) return;

    // Nome
    const elNome = document.getElementById('pdv-card-cli-nome');
    if (elNome) elNome.textContent = c.nome || 'Cliente Selecionado';

    // Documento (CPF / CNPJ)
    const docLimpo = (c.doc || c.cpfCnpj || c.documento || '').trim();
    const elDoc = document.getElementById('pdv-card-cli-doc');
    const badgeDoc = document.getElementById('pdv-card-cli-doc-badge');
    if (elDoc) {
        if (docLimpo) {
            const numApenas = docLimpo.replace(/\D/g, '');
            let docFmt = docLimpo;
            if (numApenas.length === 11) {
                docFmt = numApenas.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            } else if (numApenas.length === 14) {
                docFmt = numApenas.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            }
            elDoc.textContent = docFmt;
            if (badgeDoc) badgeDoc.classList.remove('hidden');
        } else {
            elDoc.textContent = 'Sem documento';
            if (badgeDoc) badgeDoc.classList.remove('hidden');
        }
    }

    // Telefone / WhatsApp com formatação (DD) 00000-0000
    const foneRaw = (c.wpp || c.telefone || c.fixo || '').trim();
    const linkFone = document.getElementById('pdv-card-cli-fone-link');
    const wrapFone = document.getElementById('pdv-card-cli-fone-wrap');
    if (linkFone && wrapFone) {
        if (foneRaw) {
            const digitos = foneRaw.replace(/\D/g, '');
            let foneFormatado = foneRaw;
            if (digitos.length === 11) {
                foneFormatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
            } else if (digitos.length === 10) {
                foneFormatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
            }
            linkFone.textContent = foneFormatado;
            if (digitos.length >= 10) {
                const ddi = digitos.length <= 11 ? '55' : '';
                linkFone.href = `https://wa.me/${ddi}${digitos}`;
                linkFone.title = 'Clique para abrir conversa no WhatsApp';
            } else {
                linkFone.href = `tel:${digitos}`;
                linkFone.title = 'Ligar para este número';
            }
            wrapFone.classList.remove('hidden');
        } else {
            linkFone.textContent = 'Sem telefone';
            linkFone.removeAttribute('href');
            wrapFone.classList.remove('hidden');
        }
    }

    // Endereço Completo
    let cepFmt = (c.cep || '').trim();
    const cepDigitos = cepFmt.replace(/\D/g, '');
    if (cepDigitos.length === 8) {
        cepFmt = `${cepDigitos.slice(0, 5)}-${cepDigitos.slice(5)}`;
    }
    const partesEnd = [
        c.rua, 
        c.numero ? `nº ${c.numero}` : '', 
        c.complemento, 
        c.bairro, 
        c.cidade ? `${c.cidade}${c.uf ? ' - ' + c.uf : ''}` : '', 
        cepFmt ? `CEP ${cepFmt}` : ''
    ].filter(Boolean);
    const endCompleto = partesEnd.length > 0 ? partesEnd.join(', ') : (c.endereco || 'Sem endereço informado');
    const elEnd = document.getElementById('pdv-card-cli-end');
    const wrapEnd = document.getElementById('pdv-card-cli-end-wrap');
    if (elEnd && wrapEnd) {
        elEnd.textContent = endCompleto;
        wrapEnd.title = endCompleto;
    }

    // Vendedor
    const elVend = document.getElementById('pdv-card-cli-vend');
    if (elVend) {
        elVend.textContent = c.vendedor ? `Vend: ${c.vendedor}` : 'Balcão';
    }

    // Situação Financeira (débitos em aberto no db.financeiro com alto contraste)
    const elFin = document.getElementById('pdv-card-cli-status-financeiro');
    if (elFin) {
        const idStr = String(c.id || c._id || '').trim();
        const nomeLower = (c.nome || '').trim().toLowerCase();
        const docClean = String(c.doc || c.cpfCnpj || c.documento || '').replace(/\D/g, '');
        const titulosPendentes = (db.financeiro || []).filter(f => {
            if (!f) return false;
            const isReceita = f.tipo === 'RECEITA' || f.tipo === 'RECEBER';
            const isPendente = f.status === 'PENDENTE' || f.status === 'ATRASADO';
            if (!isReceita || !isPendente) return false;
            if (idStr && f.clienteId && String(f.clienteId).trim() === idStr) return true;
            const fPessoa = String(f.pessoa || f.clienteNome || '').trim().toLowerCase();
            if (fPessoa && fPessoa === nomeLower) return true;
            if (docClean && docClean.length >= 8) {
                const fDoc = String(f.doc || f.cpfCnpj || f.cpf || '').replace(/\D/g, '');
                if (fDoc && fDoc === docClean) return true;
            }
            return false;
        });

        window._ultimoClienteSelecionado = c;
        window._clienteDebitosAtual = c;
        window._titulosPendentesClienteAtual = titulosPendentes;

        const btnDebCard = document.getElementById('btn-pdv-ver-debitos');

        const totalDebito = titulosPendentes.reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
        if (totalDebito > 0) {
            const valorFmt = typeof formatMoney === 'function' ? formatMoney(totalDebito) : `R$ ${totalDebito.toFixed(2)}`;
            elFin.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-lg pdv-card-cli-status-debito shadow-2xs cursor-pointer transition-all hover:scale-[1.02] active:scale-95';
            elFin.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${titulosPendentes.length} débito(s) em aberto: ${valorFmt} <i class="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-80 ml-0.5"></i>`;
            elFin.title = 'Clique para ver detalhes do saldo devedor';
            elFin.onclick = (e) => {
                if (e) e.stopPropagation();
                abrirModalDebitosClientePDV(c);
            };
            if (btnDebCard) btnDebCard.classList.remove('hidden');
        } else {
            elFin.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-lg pdv-card-cli-status-ok shadow-2xs cursor-pointer transition-all hover:scale-[1.02] active:scale-95';
            elFin.innerHTML = '<i class="fa-solid fa-circle-check text-[10px]"></i> Sem débitos pendentes';
            elFin.title = 'Cliente sem débitos pendentes. Clique para conferir situação.';
            elFin.onclick = (e) => {
                if (e) e.stopPropagation();
                abrirModalDebitosClientePDV(c);
            };
            if (btnDebCard) btnDebCard.classList.add('hidden');
        }
    }

    // Observações
    const wrapObs = document.getElementById('pdv-card-cli-obs-wrap');
    const elObs = document.getElementById('pdv-card-cli-obs');
    if (wrapObs && elObs) {
        if (c.obs && c.obs.trim()) {
            elObs.textContent = c.obs.trim();
            wrapObs.classList.remove('hidden');
        } else {
            wrapObs.classList.add('hidden');
        }
    }

    card.classList.remove('hidden');
}
window.renderizarCardClientePDV = renderizarCardClientePDV;

// ==========================================
// DETALHES DE DÉBITOS DO CLIENTE (PDV)
// ==========================================
window._filtroDebitosAtivo = 'TODOS';
window._titulosDebitosModalCache = [];
window._clienteDebitosModalCache = null;

function formatarTelefoneBR(foneRaw) {
    if (!foneRaw) return 'Sem telefone informado';
    let digitos = String(foneRaw).replace(/\D/g, '');
    if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
        digitos = digitos.slice(2);
    }
    if (digitos.length === 11) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
    } else if (digitos.length === 10) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
    } else if (digitos.length === 9) {
        return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
    } else if (digitos.length === 8) {
        return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
    }
    return foneRaw;
}

function formatarReferenciaTitulo(f) {
    let ref = String(f.ref || f.descricao || f.desc || '').trim();
    const vendaId = f.origemVendaId || f.vendaId;
    
    // Tenta encontrar a venda correspondente em db.vendas
    let vendaObj = null;
    if (vendaId && window.db && Array.isArray(window.db.vendas)) {
        vendaObj = window.db.vendas.find(v => String(v.id || '').trim() === String(vendaId).trim());
    }

    let numPedidoStr = '';
    if (vendaObj) {
        numPedidoStr = vendaObj.numeroPedido ? `#${String(vendaObj.numeroPedido).padStart(4, '0')}` : `#${String(vendaObj.id || '').slice(-4)}`;
    } else if (vendaId) {
        numPedidoStr = `#${String(vendaId).slice(-4)}`;
    }

    // Se a referência for vazia ou inválida tipo "[/]" ou "[ / ]"
    if (!ref || ref === '[/]' || ref === '[ / ]' || ref === '[]' || ref.startsWith('[/') || ref.endsWith('/]')) {
        if (numPedidoStr) {
            ref = `Venda ${numPedidoStr} (Crediário / Fiado)`;
        } else {
            ref = 'Parcela em Aberto (Crediário)';
        }
    } else {
        // Se a referência contiver um ID Firestore longo em hexadecimal/alfanumérico (#pljZxFsWKC2nbmaG0gLa), limpa
        if (numPedidoStr && /#[a-zA-Z0-9_-]{10,}/.test(ref)) {
            ref = ref.replace(/#[a-zA-Z0-9_-]{10,}/, numPedidoStr);
        }
    }

    return {
        titulo: ref,
        numPedido: numPedidoStr,
        vendaObj: vendaObj
    };
}

function filtrarTabelaDebitosPDV(filtro) {
    window._filtroDebitosAtivo = filtro || 'TODOS';
    
    ['todos', 'vencidos', 'avencer'].forEach(tab => {
        const btn = document.getElementById(`tab-deb-${tab}`);
        if (btn) {
            if (tab.toUpperCase() === window._filtroDebitosAtivo.toUpperCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });

    renderizarLinhasTabelaDebitos();
}
window.filtrarTabelaDebitosPDV = filtrarTabelaDebitosPDV;

function renderizarLinhasTabelaDebitos() {
    const tbody = document.getElementById('modal-deb-tabela-corpo');
    const ttotal = document.getElementById('modal-deb-tabela-total');
    const contador = document.getElementById('modal-deb-tabela-contador');
    if (!tbody) return;

    const todos = window._titulosDebitosModalCache || [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const obterDataVenc = (f) => {
        const raw = f.dataVencimento || f.data || f.vencimento || f.dataEmissao;
        if (!raw) return null;
        if (typeof raw === 'object' && raw.seconds !== undefined) return new Date(raw.seconds * 1000);
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    };

    let lista = todos;
    if (window._filtroDebitosAtivo === 'VENCIDOS') {
        lista = todos.filter(f => {
            const d = obterDataVenc(f);
            if (!d) return false;
            const dc = new Date(d);
            dc.setHours(0, 0, 0, 0);
            return dc < hoje;
        });
    } else if (window._filtroDebitosAtivo === 'AVENCER') {
        lista = todos.filter(f => {
            const d = obterDataVenc(f);
            if (!d) return true;
            const dc = new Date(d);
            dc.setHours(0, 0, 0, 0);
            return dc >= hoje;
        });
    }

    const fm = typeof formatMoney === 'function' ? formatMoney : (val => `R$ ${Number(val || 0).toFixed(2)}`);
    const somaFiltrada = lista.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);

    if (ttotal) ttotal.textContent = fm(somaFiltrada);
    if (contador) contador.textContent = `${lista.length} de ${todos.length} título(s)`;

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-10 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mb-2">
                            <i class="fa-solid fa-filter-circle-xmark"></i>
                        </div>
                        <h4 class="font-bold text-sm text-slate-700 dark:text-slate-200">Nenhum título encontrado neste filtro</h4>
                        <p class="text-xs text-slate-400 max-w-xs mt-0.5">Selecione a aba "Todos" para visualizar todas as parcelas deste cliente.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lista.map((f, idx) => {
        const d = obterDataVenc(f);
        let badgeVenc = '';
        let dataFmt = '--/--/----';

        if (d) {
            dataFmt = d.toLocaleDateString('pt-BR');
            const dComp = new Date(d);
            dComp.setHours(0, 0, 0, 0);
            const diffDias = Math.round((dComp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDias < 0) {
                const absDias = Math.abs(diffDias);
                badgeVenc = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25"><i class="fa-solid fa-clock-rotate-left text-[9px]"></i> Atrasado há ${absDias} ${absDias === 1 ? 'dia' : 'dias'}</span>`;
            } else if (diffDias === 0) {
                badgeVenc = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"><i class="fa-solid fa-hourglass-half text-[9px]"></i> Vence hoje!</span>`;
            } else {
                badgeVenc = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"><i class="fa-regular fa-calendar-check text-[9px]"></i> Vence em ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}</span>`;
            }
        } else {
            badgeVenc = `<span class="text-slate-400 text-[10px]">Data não inf.</span>`;
        }

        const infoRef = formatarReferenciaTitulo(f);
        const descPrincipal = infoRef.titulo;

        const subDescPartes = [];
        if (infoRef.numPedido) subDescPartes.push(`Pedido ${infoRef.numPedido}`);
        else if (f.origemVendaId) subDescPartes.push(`Venda #${String(f.origemVendaId).slice(-4)}`);
        if (f.categoria) subDescPartes.push(f.categoria);
        if (f.obs) subDescPartes.push(f.obs);
        const subDesc = subDescPartes.join(' • ');

        // Forma de pagamento com ícone
        const formaOriginal = String(f.metodoPagamento || f.metodo || f.contaBancaria || 'A Prazo / Crediário').trim();
        let iconeForma = 'fa-solid fa-receipt text-amber-500';
        if (formaOriginal.toLowerCase().includes('boleto')) iconeForma = 'fa-solid fa-barcode text-purple-500';
        else if (formaOriginal.toLowerCase().includes('cheque')) iconeForma = 'fa-solid fa-money-check text-blue-500';
        else if (formaOriginal.toLowerCase().includes('promiss')) iconeForma = 'fa-solid fa-file-signature text-rose-500';
        else if (formaOriginal.toLowerCase().includes('pix')) iconeForma = 'fa-brands fa-pix text-teal-500';

        const docExtra = [f.numNF ? `NF: ${f.numNF}` : '', f.numBoleto ? `Bol: ${f.numBoleto}` : ''].filter(Boolean).join(' | ');

        const isAtrasado = badgeVenc.includes('Atrasado') || f.status === 'ATRASADO';
        const statusBadge = isAtrasado
            ? `<span class="inline-flex items-center gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider border border-rose-500/30">ATRASADO</span>`
            : `<span class="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider border border-emerald-500/30">NO PRAZO</span>`;

        const safeDescPrincipal = typeof escapeHtml === 'function' ? escapeHtml(descPrincipal) : descPrincipal;
        const safeSubDesc = typeof escapeHtml === 'function' ? escapeHtml(subDesc) : subDesc;
        const safeFormaPgto = typeof escapeHtml === 'function' ? escapeHtml(formaOriginal) : formaOriginal;
        const safeDocExtra = typeof escapeHtml === 'function' ? escapeHtml(docExtra) : docExtra;

        return `
            <tr class="transition-colors">
                <td class="p-3.5 pl-4">
                    <div class="font-extrabold text-sm text-slate-900 dark:text-slate-100">${dataFmt}</div>
                    <div class="mt-1">${badgeVenc}</div>
                </td>
                <td class="p-3.5">
                    <div class="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">${safeDescPrincipal}</div>
                    ${subDesc ? `<div class="text-[11px] text-slate-400 dark:text-slate-400 truncate max-w-sm mt-0.5">${safeSubDesc}</div>` : ''}
                </td>
                <td class="p-3.5">
                    <div class="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <i class="${iconeForma}"></i> <span>${safeFormaPgto}</span>
                    </div>
                    ${docExtra ? `<div class="text-[10px] text-slate-400 font-mono mt-0.5">${safeDocExtra}</div>` : ''}
                </td>
                <td class="p-3.5 text-center">
                    ${statusBadge}
                </td>
                <td class="p-3.5 pr-4 text-right">
                    <span class="font-black text-base text-rose-600 dark:text-rose-400">${fm(f.valor)}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function abrirModalDebitosClientePDV(clienteParam) {
    const modal = document.getElementById('modal-debitos-cliente');
    if (!modal) return;

    let c = clienteParam || window._clienteDebitosAtual || window._ultimoClienteSelecionado;
    if (!c && window.db && window.db.clientes) {
        const hiddenId = document.getElementById('pdv-cliente');
        const cId = hiddenId ? hiddenId.value : null;
        if (cId) {
            c = window.db.clientes.find(x => String(x.id || x._id || '').trim() === String(cId).trim());
        }
    }

    if (!c) {
        if (typeof showToast === 'function') {
            showToast('Nenhum cliente selecionado no momento.', 'warning');
        }
        return;
    }

    const idStr = String(c.id || c._id || '').trim();
    const nomeLower = (c.nome || '').trim().toLowerCase();
    const docClean = String(c.doc || c.cpfCnpj || c.documento || '').replace(/\D/g, '');

    // Busca atualizada em db.financeiro
    const titulos = (db.financeiro || []).filter(f => {
        if (!f) return false;
        const isReceita = f.tipo === 'RECEITA' || f.tipo === 'RECEBER';
        const isPendente = f.status === 'PENDENTE' || f.status === 'ATRASADO';
        if (!isReceita || !isPendente) return false;
        if (idStr && f.clienteId && String(f.clienteId).trim() === idStr) return true;
        const fPessoa = String(f.pessoa || f.clienteNome || '').trim().toLowerCase();
        if (fPessoa && fPessoa === nomeLower) return true;
        if (docClean && docClean.length >= 8) {
            const fDoc = String(f.doc || f.cpfCnpj || f.cpf || '').replace(/\D/g, '');
            if (fDoc && fDoc === docClean) return true;
        }
        return false;
    });

    const obterDataVenc = (f) => {
        const raw = f.dataVencimento || f.data || f.vencimento || f.dataEmissao;
        if (!raw) return null;
        if (typeof raw === 'object' && raw.seconds !== undefined) return new Date(raw.seconds * 1000);
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    };

    // Ordena do mais antigo / vencido para o mais futuro
    titulos.sort((a, b) => {
        const da = obterDataVenc(a);
        const dbDate = obterDataVenc(b);
        if (!da && !dbDate) return 0;
        if (!da) return 1;
        if (!dbDate) return -1;
        return da.getTime() - dbDate.getTime();
    });

    window._clienteDebitosModalCache = c;
    window._titulosDebitosModalCache = titulos;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let somaTotal = 0;
    let somaVencidos = 0;
    let qtdVencidos = 0;
    let somaAVencer = 0;
    let qtdAVencer = 0;

    titulos.forEach(f => {
        const v = Number(f.valor) || 0;
        somaTotal += v;
        const d = obterDataVenc(f);
        if (d) {
            const dComp = new Date(d);
            dComp.setHours(0, 0, 0, 0);
            if (dComp < hoje) {
                qtdVencidos++;
                somaVencidos += v;
            } else {
                qtdAVencer++;
                somaAVencer += v;
            }
        } else {
            qtdAVencer++;
            somaAVencer += v;
        }
    });

    const fm = typeof formatMoney === 'function' ? formatMoney : (val => `R$ ${Number(val || 0).toFixed(2)}`);

    // Atualiza cabeçalho do cliente
    const elNome = document.getElementById('modal-deb-cli-nome');
    if (elNome) elNome.textContent = c.nome || 'Cliente Selecionado';

    const elDoc = document.getElementById('modal-deb-cli-doc');
    if (elDoc) {
        const docLimpo = (c.doc || c.cpfCnpj || c.documento || '').trim();
        let docFmt = docLimpo;
        const numApenas = docLimpo.replace(/\D/g, '');
        if (numApenas.length === 11) {
            docFmt = numApenas.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (numApenas.length === 14) {
            docFmt = numApenas.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        elDoc.innerHTML = `<i class="fa-solid fa-id-card text-slate-400"></i> ${docFmt || 'Sem documento'}`;
    }

    const foneRaw = (c.wpp || c.telefone || c.fixo || '').trim();
    const foneFmt = formatarTelefoneBR(foneRaw);
    const elFone = document.getElementById('modal-deb-cli-fone');
    const elFoneLink = document.getElementById('modal-deb-cli-fone-link');
    if (elFone) elFone.textContent = foneFmt;
    if (elFoneLink) {
        const digitos = foneRaw.replace(/\D/g, '');
        if (digitos.length >= 10) {
            const ddi = digitos.length <= 11 ? '55' : '';
            elFoneLink.href = `https://wa.me/${ddi}${digitos}`;
            elFoneLink.classList.remove('hidden');
        } else {
            elFoneLink.href = '#';
            if (!foneRaw) elFoneLink.classList.add('hidden');
        }
    }

    const elTag = document.getElementById('modal-deb-tag-total');
    if (elTag) {
        elTag.textContent = titulos.length > 0 ? `${titulos.length} débito(s)` : 'Sem débitos';
    }

    const elStatusTag = document.getElementById('modal-deb-cli-status-tag');
    if (elStatusTag) {
        if (titulos.length > 0) {
            elStatusTag.className = 'px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5 shadow-2xs';
            elStatusTag.innerHTML = qtdVencidos > 0 
                ? `<i class="fa-solid fa-triangle-exclamation"></i> ${qtdVencidos} Título(s) Vencido(s)` 
                : `<i class="fa-solid fa-clock text-amber-500"></i> ${titulos.length} Parcela(s) Pendente(s)`;
        } else {
            elStatusTag.className = 'px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-2xs';
            elStatusTag.innerHTML = `<i class="fa-solid fa-circle-check"></i> Situação Regular`;
        }
    }

    // KPIs
    const elKpiTotal = document.getElementById('modal-deb-kpi-total');
    if (elKpiTotal) elKpiTotal.textContent = fm(somaTotal);

    const elKpiVencidosVal = document.getElementById('modal-deb-kpi-vencidos-val');
    if (elKpiVencidosVal) elKpiVencidosVal.textContent = fm(somaVencidos);

    const elKpiVencidosQtd = document.getElementById('modal-deb-kpi-vencidos-qtd');
    if (elKpiVencidosQtd) elKpiVencidosQtd.textContent = `${qtdVencidos} ${qtdVencidos === 1 ? 'título vencido' : 'títulos vencidos'}`;

    const elKpiAVencerVal = document.getElementById('modal-deb-kpi-avencer-val');
    if (elKpiAVencerVal) elKpiAVencerVal.textContent = fm(somaAVencer);

    const elKpiAVencerQtd = document.getElementById('modal-deb-kpi-avencer-qtd');
    if (elKpiAVencerQtd) elKpiAVencerQtd.textContent = `${qtdAVencer} ${qtdAVencer === 1 ? 'título no prazo' : 'títulos no prazo'}`;

    const elKpiQtd = document.getElementById('modal-deb-kpi-qtd');
    if (elKpiQtd) elKpiQtd.textContent = `${titulos.length} ${titulos.length === 1 ? 'parcela' : 'parcelas'}`;

    const elKpiMedia = document.getElementById('modal-deb-kpi-media');
    if (elKpiMedia) {
        const media = titulos.length > 0 ? (somaTotal / titulos.length) : 0;
        elKpiMedia.textContent = `Média: ${fm(media)} / título`;
    }

    // Badges nas abas de filtro
    const bTodos = document.getElementById('badge-tab-todos');
    if (bTodos) bTodos.textContent = String(titulos.length);

    const bVencidos = document.getElementById('badge-tab-vencidos');
    if (bVencidos) bVencidos.textContent = String(qtdVencidos);

    const bAVencer = document.getElementById('badge-tab-avencer');
    if (bAVencer) bAVencer.textContent = String(qtdAVencer);

    // Inicializa tabela no filtro Todos
    window._filtroDebitosAtivo = 'TODOS';
    ['todos', 'vencidos', 'avencer'].forEach(tab => {
        const btn = document.getElementById(`tab-deb-${tab}`);
        if (btn) {
            if (tab === 'todos') btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    renderizarLinhasTabelaDebitos();

    // Prepara texto para copiar e link WhatsApp
    let resumoTexto = `📋 EXTRATO DE DÉBITOS DO CLIENTE\n`;
    resumoTexto += `Cliente: ${c.nome || 'Consumidor'}\n`;
    if (c.doc || c.cpfCnpj) resumoTexto += `Documento: ${c.doc || c.cpfCnpj}\n`;
    resumoTexto += `Total em Aberto: ${fm(somaTotal)} (${titulos.length} parcela(s))\n`;
    if (qtdVencidos > 0) resumoTexto += `Atenção: ${qtdVencidos} parcela(s) já vencida(s) somando ${fm(somaVencidos)}\n`;
    resumoTexto += `----------------------------------------\n`;
    titulos.forEach((f, i) => {
        const d = obterDataVenc(f);
        const dataFmt = d ? d.toLocaleDateString('pt-BR') : 'Sem data';
        const info = formatarReferenciaTitulo(f);
        resumoTexto += `${i + 1}. ${info.titulo} | Venc: ${dataFmt} | Valor: ${fm(f.valor)}\n`;
    });
    resumoTexto += `----------------------------------------\n`;
    resumoTexto += `Emitido via FC Móveis e Interiores - PDV`;

    window._resumoDebitosTextoAtual = resumoTexto;

    // WhatsApp
    const btnWpp = document.getElementById('modal-deb-btn-wpp');
    if (btnWpp) {
        const digitosFone = (c.wpp || c.telefone || '').replace(/\D/g, '');
        if (digitosFone.length >= 10 && titulos.length > 0) {
            const ddi = digitosFone.length <= 11 ? '55' : '';
            const msgWpp = `Olá, *${c.nome}*! Tudo bem?\n\nPassando para enviar o extrato de débitos pendentes em aberto junto à *FC Móveis*:\n\n*Total em Aberto:* ${fm(somaTotal)} (${titulos.length} parcela(s))\n${qtdVencidos > 0 ? `*Em atraso:* ${qtdVencidos} parcela(s) (${fm(somaVencidos)})\n` : ''}\nFicamos à disposição para qualquer dúvida ou para combinarmos a quitação. Muito obrigado!`;
            btnWpp.href = `https://wa.me/${ddi}${digitosFone}?text=${encodeURIComponent(msgWpp)}`;
            btnWpp.classList.remove('hidden');
        } else {
            btnWpp.classList.add('hidden');
        }
    }

    modal.classList.remove('hidden');
}
window.abrirModalDebitosClientePDV = abrirModalDebitosClientePDV;

function fecharModalDebitosClientePDV() {
    const modal = document.getElementById('modal-debitos-cliente');
    if (modal) modal.classList.add('hidden');
}
window.fecharModalDebitosClientePDV = fecharModalDebitosClientePDV;

function copiarResumoDebitosPDV() {
    if (!window._resumoDebitosTextoAtual) {
        if (typeof showToast === 'function') showToast('Nenhum dado de débito para copiar.', 'warning');
        return;
    }
    const txt = window._resumoDebitosTextoAtual;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
            if (typeof showToast === 'function') showToast('Extrato copiado para a área de transferência!', 'success');
        }).catch(() => {
            copiarTextoFallbackPDV(txt);
        });
    } else {
        copiarTextoFallbackPDV(txt);
    }
}
window.copiarResumoDebitosPDV = copiarResumoDebitosPDV;

function copiarTextoFallbackPDV(texto) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        if (typeof showToast === 'function') showToast('Extrato copiado para a área de transferência!', 'success');
    } catch (e) {
        if (typeof showToast === 'function') showToast('Não foi possível copiar automaticamente.', 'error');
    }
    if (ta.parentNode) ta.parentNode.removeChild(ta);
}

function desvincularClientePDV() {
    selecionarClientePDV(null);
    if (typeof showToast === 'function') {
        showToast('Cliente desvinculado. Operação definida para Consumidor Final.', 'info');
    }
}
window.desvincularClientePDV = desvincularClientePDV;

function editarClienteSelecionadoPDV() {
    const hiddenId = document.getElementById('pdv-cliente');
    const cId = hiddenId ? hiddenId.value : '0';
    if (!cId || cId === '0') return;
    const c = (db.clientes || []).find(x => String(x.id || x._id || '') === String(cId));
    if (c) {
        abrirModalClienteRapido(c);
    }
}
window.editarClienteSelecionadoPDV = editarClienteSelecionadoPDV;

function autoSelecionarClientePorNome() {
    const inputBusca = document.getElementById('pdv-cliente-busca');
    const hiddenId = document.getElementById('pdv-cliente');
    if (!inputBusca) return;
    const txt = inputBusca.value.trim().toLowerCase();
    const idAtual = hiddenId ? String(hiddenId.value || '0').trim() : '0';

    if (!txt) {
        if (idAtual && idAtual !== '0') {
            selecionarClientePDV(null, false);
        }
        return;
    }

    if (idAtual && idAtual !== '0') {
        const atual = (db.clientes || []).find(x => String(x.id || x._id || '').trim() === idAtual) ||
                      (window._ultimoClienteSelecionado && String(window._ultimoClienteSelecionado.id || window._ultimoClienteSelecionado._id || '').trim() === idAtual ? window._ultimoClienteSelecionado : null);
        if (atual && (atual.nome || '').trim().toLowerCase() === txt) return;
    }
    const exato = (db.clientes || []).find(x => (x.nome || '').trim().toLowerCase() === txt);
    if (exato) {
        selecionarClientePDV(exato);
        return;
    }
    const parcial = (db.clientes || []).find(x => (x.nome || '').trim().toLowerCase().startsWith(txt));
    if (parcial) {
        selecionarClientePDV(parcial);
    }
}
window.autoSelecionarClientePorNome = autoSelecionarClientePorNome;

function autoSelecionarPrimeiroCliente() {
    const dropdown = document.getElementById('pdv-cliente-resultados');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        const divs = dropdown.querySelectorAll('div');
        if (divs.length > 1 && divs[1].onclick) {
            divs[1].onclick();
            return;
        } else if (divs.length === 1 && divs[0].onclick) {
            divs[0].onclick();
            return;
        }
    }
    autoSelecionarClientePorNome();
}
window.autoSelecionarPrimeiroCliente = autoSelecionarPrimeiroCliente;

function atualizarListaClientesPDV(selecionarId = null, silencioso = true) {
    const hiddenId = document.getElementById('pdv-cliente');
    const atualId = hiddenId ? hiddenId.value : '0';
    const targetId = (selecionarId && selecionarId !== '0') 
        ? selecionarId 
        : ((atualId && atualId !== '0') ? atualId : (window._clientePendentePDV || null));
        
    if (targetId && targetId !== '0') {
        selecionarClientePDV(targetId, silencioso);
    }
}

function filtrarClientesPDV(termo) {
    const dropdown = document.getElementById('pdv-cliente-resultados');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    const lista = db.clientes || [];
    const busca = termo ? String(termo).trim().toLowerCase() : '';
    
    let filtrados = lista;
    if (busca) {
        filtrados = lista.filter(c => 
            (c.nome && c.nome.toLowerCase().includes(busca)) || 
            (c.wpp && c.wpp.includes(busca)) || 
            (c.documento && c.documento.includes(busca)) ||
            (c.doc && c.doc.includes(busca)) ||
            (c.cpfCnpj && c.cpfCnpj.includes(busca))
        );
    }

    if (typeof ordenarListaAlfabeticamente === 'function') {
        filtrados = ordenarListaAlfabeticamente(filtrados, 'nome');
    } else {
        filtrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }

    const divConsumidor = document.createElement('div');
    divConsumidor.className = 'p-3 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900';
    divConsumidor.innerHTML = `<i class="fa-solid fa-user text-slate-400 mr-2"></i>Consumidor Final (Padrão)`;
    divConsumidor.onclick = () => {
        selecionarClientePDV(null);
    };
    dropdown.appendChild(divConsumidor);

    filtrados.forEach(c => {
        const div = document.createElement('div');
        div.className = 'p-3 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 text-sm flex flex-col transition-colors';
        
        const docs = c.cpfCnpj || c.documento || c.doc || 'Sem documento';
        const fone = c.wpp || c.telefone || 'Sem telefone';
        const end = c.endereco || c.cidade || 'Sem endereço';
        const vendBadge = c.vendedor ? `<span class="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded whitespace-nowrap font-bold"><i class="fa-solid fa-user-tie mr-1"></i>Vend: ${c.vendedor}</span>` : '';
        
        div.innerHTML = `
            <div class="flex flex-col">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-slate-800 dark:text-slate-100">${c.nome}</span>
                    ${vendBadge}
                </div>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] text-slate-500 dark:text-slate-400">
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded whitespace-nowrap"><i class="fa-solid fa-id-card mr-1 text-slate-400"></i>${docs}</span>
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded whitespace-nowrap"><i class="fa-brands fa-whatsapp mr-1 text-emerald-500"></i>${fone}</span>
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[200px]" title="${end}"><i class="fa-solid fa-location-dot mr-1 text-slate-400"></i>${end}</span>
                </div>
            </div>
        `;
        div.onclick = () => {
            selecionarClientePDV(c);
        };
        dropdown.appendChild(div);
    });

    dropdown.classList.remove('hidden');
}

function abrirModalClienteRapido(c = null) {
    if (typeof window.podeCadastrarClientes === 'function' && !window.podeCadastrarClientes()) {
        showToast('Acesso Negado: Você não tem permissão para cadastrar clientes.', 'error');
        return;
    }
    const isEdit = !!(c && (c.id || c._id));
    document.getElementById('cli-id').value = isEdit ? (c.id || c._id || '') : '';
    document.getElementById('cli-nome').value = isEdit ? (c.nome || '') : '';
    document.getElementById('cli-doc').value = isEdit ? (c.doc || c.cpfCnpj || c.documento || '') : '';
    document.getElementById('cli-rg').value = isEdit ? (c.rg || '') : '';
    document.getElementById('cli-nasc').value = isEdit ? (c.nasc || '') : '';
    document.getElementById('cli-wpp').value = isEdit ? (c.wpp || '') : '';
    document.getElementById('cli-fixo').value = isEdit ? (c.fixo || c.telefone || '') : '';
    document.getElementById('cli-email').value = isEdit ? (c.email || '') : '';
    const selVend = document.getElementById('cli-vendedor');
    if (selVend) {
        const vendedores = (db.funcionarios || [])
            .filter(f => f.vendedor === 'SIM' || f.vendedor === 'Sim' || f.vendedor === true || f.cargo === 'Vendedor')
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        let html = '<option value="">Sem Vendedor Fixo (Padrão: Balcão)</option>';
        vendedores.forEach(v => {
            html += `<option value="${v.nome}">${v.nome}</option>`;
        });
        selVend.innerHTML = html;
        selVend.value = isEdit ? (c.vendedor || '') : '';
    }
    document.getElementById('cli-cep').value = isEdit ? (c.cep || '') : '';
    document.getElementById('cli-rua').value = isEdit ? (c.rua || '') : '';
    document.getElementById('cli-numero').value = isEdit ? (c.numero || '') : '';
    document.getElementById('cli-complemento').value = isEdit ? (c.complemento || '') : '';
    document.getElementById('cli-bairro').value = isEdit ? (c.bairro || '') : '';
    document.getElementById('cli-cidade').value = isEdit ? (c.cidade || '') : '';
    document.getElementById('cli-ibge').value = isEdit ? (c.ibge || '') : '';
    document.getElementById('cli-obs').value = isEdit ? (c.obs || '') : '';
    document.getElementById('cli-historico-body').innerHTML = '<tr><td colspan="4" class="text-center p-4 text-slate-400">Nenhum histórico</td></tr>';
    
    document.getElementById('modal-cliente-title').innerText = isEdit ? 'Editar Dados do Cliente' : 'Novo Cliente';
    abaModal('cli', 'dados');
    document.getElementById('modal-cliente').classList.remove('hidden');
}

function fecharModalCliente() {
    document.getElementById('modal-cliente').classList.add('hidden');
}

async function buscarCEP(prefix) {
    const el = document.getElementById(`${prefix}-cep`); if (!el) return; let cep = el.value.replace(/\D/g, ''); if (cep.length !== 8) return;
    try { let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); let data = await res.json(); if (!data.erro) { document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.localidade} - ${data.uf}`; } } catch (e) { console.error("Erro interno:", e); }
}

async function buscarCNPJ(prefix) {
    const elDoc = document.getElementById(`${prefix}-doc`); if (!elDoc) return; let cnpj = elDoc.value.replace(/\D/g, ''); if (cnpj.length !== 14) return showToast('Digite os 14 números do CNPJ', 'error');
    showToast('Consultando Receita...', 'info');
    try {
        let res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); let data = await res.json();
        if (data.razao_social) { document.getElementById(`${prefix}-nome`).value = data.razao_social || ''; document.getElementById(`${prefix}-wpp`).value = data.ddd_telefone_1 || ''; document.getElementById(`${prefix}-cep`).value = data.cep || ''; document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.municipio || ''} - ${data.uf || ''}`; showToast('Empresa Importada!', 'success'); }
    } catch (e) { showToast('Serviço indisponível.', 'error'); }
}

async function salvarCliente() {
    if (typeof window.podeCadastrarClientes === 'function' && !window.podeCadastrarClientes()) {
        showToast('Acesso Negado: Você não tem permissão para cadastrar clientes.', 'error');
        return;
    }
    const id = document.getElementById('cli-id').value;
    const nome = document.getElementById('cli-nome').value.trim();
    if(!nome) return showToast('Nome Completo / Razão Social é obrigatório!', 'error');

    const dados = {
        nome: nome,
        doc: document.getElementById('cli-doc').value.trim(),
        rg: document.getElementById('cli-rg').value.trim(),
        nasc: document.getElementById('cli-nasc').value.trim(),
        wpp: document.getElementById('cli-wpp').value.trim(),
        fixo: document.getElementById('cli-fixo').value.trim(),
        email: document.getElementById('cli-email').value.trim(),
        vendedor: document.getElementById('cli-vendedor') ? document.getElementById('cli-vendedor').value.trim() : '',
        cep: document.getElementById('cli-cep').value.trim(),
        rua: document.getElementById('cli-rua').value.trim(),
        numero: document.getElementById('cli-numero').value.trim(),
        complemento: document.getElementById('cli-complemento').value.trim(),
        bairro: document.getElementById('cli-bairro').value.trim(),
        cidade: document.getElementById('cli-cidade').value.trim(),
        ibge: document.getElementById('cli-ibge').value.trim(),
        obs: document.getElementById('cli-obs').value.trim()
    };

    try {
        let finalId = id;
        if (id) {
            await window.getEmpresaRef().collection('clientes').doc(String(id)).set(dados, { merge: true });
            if (Array.isArray(db.clientes)) {
                const idx = db.clientes.findIndex(x => String(x.id || x._id || '') === String(id));
                if (idx >= 0) db.clientes[idx] = { id: String(id), ...dados };
            }
            showToast('Cliente atualizado com sucesso!', 'success');
        } else {
            dados.dataCadastro = new Date().toISOString();
            const docRef = await window.getEmpresaRef().collection('clientes').add(dados);
            finalId = docRef.id;
            if (Array.isArray(db.clientes)) {
                db.clientes.push({ id: finalId, ...dados });
            }
            showToast('Cliente cadastrado e selecionado!', 'success');
        }
        fecharModalCliente();
        atualizarListaClientesPDV(finalId);
    } catch(err) {
        console.error(err);
        showToast('Erro ao salvar cliente.', 'error');
    }
}

// ==========================================
function abaModal(prefix, nomeAba) {
    const modalId = `#modal-${prefix === 'cli' ? 'cliente' : (prefix === 'forn' ? 'fornecedor' : 'produto')}`;
    document.querySelectorAll(`${modalId} .aba-conteudo`).forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
    document.getElementById(`${prefix}-aba-${nomeAba}`).classList.remove('hidden'); 
    document.getElementById(`${prefix}-aba-${nomeAba}`).classList.add('active');
    document.querySelectorAll(`[id^="${prefix}-btn-"]`).forEach(el => { 
        el.classList.remove('border-blue-600', 'text-blue-600'); 
        el.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400'); 
    });
    const btnAtivo = document.getElementById(`${prefix}-btn-${nomeAba}`);
    if (btnAtivo) {
        btnAtivo.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400'); 
        btnAtivo.classList.add('border-blue-600', 'text-blue-600');
    }
}

function abrirModalProduto(id = null) {
    if (typeof window.podeCadastrarProdutos === 'function' && !window.podeCadastrarProdutos()) {
        showToast('Acesso Negado: Você não tem permissão para cadastrar ou editar produtos.', 'error');
        return;
    }
    const divAcao = document.getElementById('div-acao-vinculo-xml'); if(divAcao) divAcao.classList.add('hidden');
    const titleEl = document.getElementById('modal-produto-title');
    abaModal('prod', 'dados');
    if (id) {
        const p = db.produtos.find(x => String(x.id) === String(id));
        if (p) {
            if (titleEl) titleEl.innerText = 'Editar Produto';
            document.getElementById('prod-id').value = p.id;
            document.getElementById('prod-nome').value = p.nome || '';
            const eanEl = document.getElementById('prod-ean'); if (eanEl) eanEl.value = p.ean || '';
            const marcaEl = document.getElementById('prod-marca'); if (marcaEl) marcaEl.value = p.marca || '';
            const precoEl = document.getElementById('prod-preco'); if (precoEl) precoEl.value = p.preco || 0;
            const custoEl = document.getElementById('prod-custo'); if (custoEl) custoEl.value = p.custo || 0;
            const estoqueEl = document.getElementById('prod-estoque'); if (estoqueEl) estoqueEl.value = p.estoque || 0;
            
            const ncmEl = document.getElementById('prod-ncm'); if (ncmEl) ncmEl.value = p.ncm || '';
            const cfopEl = document.getElementById('prod-cfop'); if (cfopEl) cfopEl.value = p.cfop || '';
            const csosnEl = document.getElementById('prod-csosn'); if (csosnEl) csosnEl.value = p.csosn || '';
            const origemEl = document.getElementById('prod-origem'); if (origemEl) origemEl.value = p.origem || '0';
            const cestEl = document.getElementById('prod-cest'); if (cestEl) cestEl.value = p.cest || '';

            const fotoInput = document.getElementById('prod-foto-base64');
            const preview = document.getElementById('preview-foto');
            const textoSemFoto = document.getElementById('texto-sem-foto');
            if (p.foto) {
                if (fotoInput) fotoInput.value = p.foto;
                if (preview) { preview.src = p.foto; preview.classList.remove('hidden'); }
                if (textoSemFoto) textoSemFoto.classList.add('hidden');
            } else {
                if (fotoInput) fotoInput.value = '';
                if (preview) { preview.src = ''; preview.classList.add('hidden'); }
                if (textoSemFoto) textoSemFoto.classList.remove('hidden');
            }
            document.getElementById('modal-produto').classList.remove('hidden');
            return;
        }
    }
    
    if (titleEl) titleEl.innerText = 'Cadastrar Rápido';
    document.getElementById('prod-id').value = '';
    const ids = ['prod-nome', 'prod-ean', 'prod-marca', 'prod-preco', 'prod-foto-base64', 'prod-ncm', 'prod-cfop', 'prod-csosn', 'prod-cest'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const origemEl = document.getElementById('prod-origem'); if (origemEl) origemEl.value = '0';
    const custoEl = document.getElementById('prod-custo'); if (custoEl) custoEl.value = '0';
    const estoqueEl = document.getElementById('prod-estoque'); if (estoqueEl) estoqueEl.value = '0';
    const preview = document.getElementById('preview-foto'); if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    const textoSemFoto = document.getElementById('texto-sem-foto'); if (textoSemFoto) textoSemFoto.classList.remove('hidden');
    document.getElementById('modal-produto').classList.remove('hidden');
}

function fecharModalProduto() { document.getElementById('modal-produto').classList.add('hidden'); }

function processarFoto(event) {
    const file = event.target.files[0]; if (!file) return; 
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image(); 
        img.onload = function() {
            const canvas = document.createElement('canvas'); 
            let w = img.width, h = img.height; 
            const MAX = 300;
            if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const preview = document.getElementById('preview-foto');
            if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
            const textoSemFoto = document.getElementById('texto-sem-foto');
            if (textoSemFoto) textoSemFoto.classList.add('hidden');
            const inputBase64 = document.getElementById('prod-foto-base64');
            if(inputBase64) inputBase64.value = dataUrl;
        }; 
        img.src = e.target.result;
    }; 
    reader.readAsDataURL(file);
}

async function salvarProdutoRapido() {
    if (typeof window.podeCadastrarProdutos === 'function' && !window.podeCadastrarProdutos()) {
        showToast('Acesso Negado: Você não tem permissão para cadastrar ou editar produtos.', 'error');
        return;
    }
    const idEl = document.getElementById('prod-id');
    const nomeEl = document.getElementById('prod-nome');
    const precoEl = document.getElementById('prod-preco');
    if(!nomeEl || !precoEl) return showToast('Erro no formulário.', 'error');
    const nome = nomeEl.value.trim(); const preco = parseInputMoney(precoEl.value);
    if(!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

    const ean = document.getElementById('prod-ean') ? document.getElementById('prod-ean').value : '';
    const marca = document.getElementById('prod-marca') ? document.getElementById('prod-marca').value : '';
    const custo = document.getElementById('prod-custo') ? parseInputMoney(document.getElementById('prod-custo').value) : 0;
    const estoque = document.getElementById('prod-estoque') ? parseInputMoney(document.getElementById('prod-estoque').value) : 0;
    const foto = document.getElementById('prod-foto-base64') ? document.getElementById('prod-foto-base64').value : '';

    const ncm = document.getElementById('prod-ncm') ? document.getElementById('prod-ncm').value : '';
    const cfop = document.getElementById('prod-cfop') ? document.getElementById('prod-cfop').value : '';
    const csosn = document.getElementById('prod-csosn') ? document.getElementById('prod-csosn').value : '';
    const origem = document.getElementById('prod-origem') ? document.getElementById('prod-origem').value : '0';
    const cest = document.getElementById('prod-cest') ? document.getElementById('prod-cest').value : '';

    const pId = idEl ? idEl.value : '';

    try {
        if (pId) {
            const p = { nome: nome, preco: preco, ean: ean, marca: marca, custo: custo || 0, estoque: estoque || 0, foto: foto, ncm: ncm, cfop: cfop, csosn: csosn, origem: origem, cest: cest };
            await window.getEmpresaRef().collection('produtos').doc(pId).update(p);
            p.id = pId;
            const dbIndex = db.produtos.findIndex(x => String(x.id) === String(pId));
            if (dbIndex >= 0) db.produtos[dbIndex] = { ...db.produtos[dbIndex], ...p };
            
            cart.forEach((cItem, i) => {
                if (String(cItem.id) === String(pId)) {
                    cart[i].nome = p.nome;
                    cart[i].preco = p.preco;
                    cart[i].foto = p.foto;
                }
            });
            renderCarrinho();
            fecharModalProduto();
            showToast('Produto atualizado!', 'success');
        } else {
            const p = {
                nome: nome, preco: preco, ean: ean, marca: marca, categoria: 'Geral', unidade: 'Un', custo: custo || 0, margem: 0, estoque: estoque || 0, min: 1, ativo: true, obs: '', foto: foto,
                ncm: ncm, cfop: cfop, csosn: csosn, origem: origem, cest: cest
            };
            const docRef = await window.getEmpresaRef().collection('produtos').add(p);
            p.id = docRef.id;
            if(p.estoque > 0) salvarKardex('Estoque Inicial PDV', p.id, p.nome, p.estoque, 'INICIAL'); 
            fecharModalProduto(); 
            processarAdicaoProduto(p); 
            showToast('Produto cadastrado e adicionado!', 'success');
        }
    } catch(err) {
        console.error(err);
        showToast('Erro ao salvar produto.', 'error');
    }
}

// ==========================================
// 6. FOTOS DA ORDEM DE SERVIÇO
// ==========================================
function processarMultiplasFotosOS(event) {
    const files = event.target.files; if (!files || files.length === 0) return;
    Array.from(files).forEach(file => { 
        const reader = new FileReader(); 
        reader.onload = function(e) { 
            const img = new Image(); 
            img.onload = function() { 
                const canvas = document.createElement('canvas'); let w = img.width, h = img.height; const MAX = 600; 
                if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } } 
                canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h); 
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8); osFotosArray.push(dataUrl); renderizarFotosOS(); 
            }; 
            img.src = e.target.result; 
        }; 
        reader.readAsDataURL(file); 
    });
    event.target.value = '';
}

function renderizarFotosOS() { 
    const grid = document.getElementById('os-fotos-preview-grid'); if (!grid) return; 
    if (osFotosArray.length === 0) { grid.classList.add('hidden'); grid.innerHTML = ''; return; } 
    grid.classList.remove('hidden'); 
    grid.innerHTML = osFotosArray.map((foto, idx) => `
        <div class="relative w-14 h-14 border border-purple-300 rounded overflow-hidden shadow-sm group">
            <div class="w-full h-full bg-cover bg-center cursor-zoom-in" style="background-image: url('${foto}')" onclick="abrirZoom('${foto}')"></div>
            <button onclick="removerFotoOS('${idx}')" class="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `).join(''); 
}
function removerFotoOS(index) { osFotosArray.splice(index, 1); renderizarFotosOS(); }

// ==========================================
// 7. MOTORES DE IMPRESSÃO E PDF (BLINDADOS)
// ==========================================
function printHtmlSeguro(htmlCompleto) {
    showToast("Preparando documento para Impressão...", "info");
    
    const printWin = window.open('', '', 'width=800,height=600');
    if (!printWin) {
        showToast("Por favor, permita popups para imprimir.", "warning");
        return;
    }
    
    const doc = printWin.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impressão</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { margin: 10mm; }
                body { font-family: Arial, sans-serif; background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .print\\\\:hidden { display: none !important; }
                table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
            </style>
        </head>
        <body class="bg-white dark:bg-slate-800 p-4">
            ${htmlCompleto}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => { 
        printWin.focus(); 
        printWin.print(); 
        // Janela continua aberta para o usuário observar o documento
    }, 1500);
}

function imprimirArea(areaId) {
    let empNome = "Relatório Oficial do Sistema";
    if (db && db.config && db.config.empresa && db.config.empresa.nome) empNome = db.config.empresa.nome;
    let logoHtml = "";
    if (db && db.config && db.config.empresa && db.config.empresa.logo) logoHtml = `<img src="${db.config.empresa.logo}" style="max-height: 60px; margin-bottom: 10px; border-radius: 8px;">`;
    const element = document.getElementById(areaId);
    if(!element) return showToast("Área de impressão não encontrada.", "error");
    const printContent = element.innerHTML; 
    const htmlCompleto = `<div style="padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #000;"><div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">${logoHtml}<h2 style="font-size: 20px; font-weight: bold; margin: 5px 0; text-transform: uppercase;">${empNome}</h2><p style="margin: 0; font-size: 12px; color: #555;">Documento Gerencial Oficial</p></div>${printContent}</div>`; 
    printHtmlSeguro(htmlCompleto);
}

function printAction(type) { 
    const area = document.getElementById('print-area'); if(!area) return;
    const printContent = area.innerHTML; 
    const widthStyle = type === 'thermal' ? 'width: 80mm; font-size: 12px; font-family: monospace; padding: 2mm; margin: 0 auto;' : 'width: 210mm; font-size: 14px; font-family: Arial, sans-serif; padding: 15mm; margin: 0 auto;'; 
    const htmlCompleto = `<div style="${widthStyle} background: #fff; color: #000;">${printContent}</div>`; 
    printHtmlSeguro(htmlCompleto);
}

function baixarPDF(areaId, filename) {
    const element = document.getElementById(areaId); 
    if(!element) return showToast("Erro: Área do PDF não encontrada.", "error");

    const printContent = element.innerHTML; 
    
    const win = window.open('', '_blank');
    if (!win) {
        return showToast("O bloqueador de pop-ups bloqueou o PDF. Permita pop-ups neste site.", "error");
    }

    win.document.open();
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${filename || 'Documento'}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { margin: 15mm; size: A4; }
                body { font-family: Arial, sans-serif; background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 20px; max-width: 1000px; margin: 0 auto; }
                .print\\:hidden { display: none !important; }
                table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
                
                @media print {
                    body { padding: 0; max-width: none; }
                }
            </style>
        </head>
        <body class="bg-white text-black">
            ${printContent}
            
            <script>
                // Executa a impressão quando tudo carregar
                setTimeout(() => {
                    window.focus();
                    window.print();
                }, 1000);
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

function downloadPDF(areaId, filename) { baixarPDF(areaId, filename); }

function exportarExcel(tabelaId, filename) {
    let table = document.getElementById(tabelaId); if(!table) return showToast('Tabela não encontrada.', 'error');
    let rows = table.querySelectorAll('tr'); let csv = [];
    for (let i = 0; i < rows.length; i++) { let row = [], cols = rows[i].querySelectorAll('td:not(.print\\:hidden), th:not(.print\\:hidden)'); for (let j = 0; j < cols.length; j++) { row.push('"' + cols[j].innerText.replace(/"/g, '""').trim() + '"'); } csv.push(row.join(';')); }
    let csvFile = new Blob(["\uFEFF"+csv.join('\n')], {type: 'text/csv;charset=utf-8;'});
    let link = document.createElement("a"); link.href = window.URL.createObjectURL(csvFile); link.setAttribute("download", filename + "_" + Date.now() + ".csv");
    document.body.appendChild(link); link.click(); showToast('Excel exportado!', 'success');
}

// ==========================================
// 8. GERADOR DE CONTRATO E WHATSAPP 
// ==========================================
function imprimirContratoAtual() {
    if (window.vendaAtualImpressao) { 
        imprimirContratoObj(window.vendaAtualImpressao); 
    } else { 
        showToast("Nenhuma venda selecionada para imprimir o contrato.", "error"); 
    }
}
window.imprimirContratoAtual = imprimirContratoAtual;

function imprimirContratoById(id) { 
    const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
        ? db.vendas 
        : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
    const v = todasVendas.find(x => String(x.id) === String(id)); 
    if (v) {
        window.vendaAtualImpressao = v;
        imprimirContratoObj(v); 
    } else {
        showToast("Venda não encontrada para imprimir o contrato.", "error");
    }
}
window.imprimirContratoById = imprimirContratoById;

function imprimirOrdemProducaoAtual() {
    if (window.vendaAtualImpressao) { 
        imprimirOrdemProducaoObj(window.vendaAtualImpressao); 
    } else { 
        showToast("Nenhuma venda selecionada para imprimir a Ordem de Produção.", "error"); 
    }
}
window.imprimirOrdemProducaoAtual = imprimirOrdemProducaoAtual;

function imprimirOrdemProducaoById(id) { 
    const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
        ? db.vendas 
        : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
    const v = todasVendas.find(x => String(x.id) === String(id)); 
    if (v) {
        window.vendaAtualImpressao = v;
        imprimirOrdemProducaoObj(v); 
    } else {
        showToast("Venda não encontrada para imprimir a Ordem de Produção.", "error");
    }
}
window.imprimirOrdemProducaoById = imprimirOrdemProducaoById;

// CORREÇÃO: Variável cliTel e Telefone do Whatsapp blindados!
function enviarPDFWhatsApp(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error');

    const cliInfo = obterDadosClientePDV(v.clienteId);
    
    // Prioriza dados cadastrais atualizados do cliente caso ele tenha sido editado
    const cliNome = (cliInfo && cliInfo.nome !== 'Consumidor Final') ? cliInfo.nome : (v.clienteNome || 'Consumidor Final');
    const cliCpf = (cliInfo && cliInfo.doc !== 'Não informado') ? cliInfo.doc : (v.clienteDoc || 'Não informado');
    const cliTel = (cliInfo && cliInfo.tel !== 'Não informado') ? cliInfo.tel : (v.clienteTel || ''); 
    const cliEndCompleto = (cliInfo && cliInfo.endCompleto !== 'Não informado') ? cliInfo.endCompleto : (v.clienteEnd || 'Não informado');
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    
    let numLimpo = cliTel.replace(/\D/g, '');

    if (!numLimpo || numLimpo.length < 10) {
        return showToast('O cliente não possui um número de WhatsApp válido cadastrado na ficha.', 'error');
    }
    if (!numLimpo.startsWith('55')) numLimpo = '55' + numLimpo; 

    const emp = obterDadosEmpresa(); 
    
    const isOrcamento = v.tipo === 'ORÇAMENTO';
    const isServico = v.tipo === 'SERVIÇO';
    let tituloRecibo = 'CUPOM NÃO FISCAL - SEM VALOR LEGAL'; 
    if (isOrcamento) tituloRecibo = 'ORÇAMENTO - VÁLIDO POR 7 DIAS'; 
    else if (isServico) tituloRecibo = 'RECIBO DE PRESTAÇÃO DE SERVIÇO';

    let fotosHtml = '';
    if (isServico && v.servicoDetalhes) {
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) {
            fotosHtml = `<div style="margin-top: 10px;"><strong>Fotos de Referência (Estado Inicial):</strong><br><div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" style="height: 120px; border-radius: 4px; border: 1px solid #d8b4fe;">`).join('')}</div></div>`;
        } else if (v.servicoDetalhes.foto) {
            fotosHtml = `<div style="margin-top: 10px;"><strong>Foto de Referência (Estado Inicial):</strong><br><img src="${v.servicoDetalhes.foto}" style="max-height: 150px; border-radius: 4px; border: 1px solid #d8b4fe; margin-top: 5px;"></div>`;
        }
    }

    const htmlRecibo = `
    <div id="print-area-whatsapp" style="font-family: Arial, sans-serif; color: #000; width: 100%; max-width: 800px; margin: 0 auto; padding: 10px; background-color: #fff;">
        <div style="border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; text-align: center;">
            ${emp.logoHtml}
            <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900;">${emp.nome}</h1>
            <p style="margin: 5px 0; font-size: 13px;">CNPJ: ${emp.cnpj}<br>${emp.end}<br>Tel: ${emp.tel} | Vend: ${v.vendedor || '-'}</p>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 900; border: 2px solid #000; display: inline-block; padding: 6px 15px; border-radius: 4px;">${tituloRecibo}</h2>
        ${isLancarCaixa ? '<div style="margin-top: 10px; font-weight: 900; font-size: 14px; background: #fef3c7; border: 2px solid #d97706; padding: 8px; border-radius: 6px; color: #92400e;">>>> APRESENTE ESTA COMANDA NO CAIXA PARA EFETUAR O PAGAMENTO <<<</div>' : ''}
        </div>
        
        <div style="display: flex; justify-content: space-between; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-bottom: 20px; font-size: 13px;">
            <div>
                <strong>DADOS DO CLIENTE</strong><br>
                Nome: ${cliNome}<br>
                CPF/CNPJ: ${cliCpf}<br>
                Telefone: ${cliTel || 'Não Informado'}<br>
                Endereço: ${cliEndCompleto}
            </div>
            <div style="text-align: right; border-left: 1px solid #ccc; padding-left: 15px;">
                <strong>DADOS DA OPERAÇÃO</strong><br>
                Nº: #${numPedStr}<br>
                Data Orig: ${v.data ? new Date(v.data).toLocaleString('pt-BR') : '-'}<br>
                ${(v.dataEntrega || (v.servicoDetalhes && v.servicoDetalhes.prazo)) ? `Previsão Entrega: <strong>${(v.dataEntrega || v.servicoDetalhes.prazo).includes('-') ? (v.dataEntrega || v.servicoDetalhes.prazo).split('-').reverse().join('/') : (v.dataEntrega || v.servicoDetalhes.prazo)}</strong><br>` : ''}
                Op: VIA WHATSAPP
            </div>
        </div>

        ${isServico && v.servicoDetalhes ? `
        <div style="border: 1px solid #6b21a8; border-radius: 5px; padding: 12px; margin-bottom: 20px; font-size: 13px; background-color: #faf5ff;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #d8b4fe; padding-bottom: 5px; color: #6b21a8; text-transform: uppercase;">Dados da Ordem de Serviço</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 150px;"><strong>Previsão de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'Não informada'}</div>
                <div style="flex: 1; min-width: 150px;"><strong>Garantia do Serviço:</strong> ${v.servicoDetalhes.garantia || 'Não informada'}</div>
            </div>
            ${v.servicoDetalhes.desc ? `<div><strong>Escopo / Defeito:</strong><br>${v.servicoDetalhes.desc}</div>` : ''}
            ${fotosHtml}
        </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #000;">
                    <th style="padding: 8px; text-align: left;">Descrição do Item</th>
                    <th style="padding: 8px; text-align: center;">Qtd</th>
                    <th style="padding: 8px; text-align: right;">V. Unit</th>
                    <th style="padding: 8px; text-align: center;">Desc.</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${(v.itens || []).map(i => {
                    let pFoto = i.foto;
                    if (!pFoto && typeof db !== 'undefined' && db.produtos) {
                        let prod = db.produtos.find(px => String(px.id) === String(i.id));
                        if (prod && prod.foto) pFoto = prod.foto;
                    }
                    return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${pFoto ? `<img src="${pFoto}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid #ccc; flex-shrink: 0;">` : ''}
                                <div>
                                    <strong>${i.nome || 'Produto/Serviço'}</strong>
                                    ${i.obsVenda ? `<br><span style="font-size: 11px; color: #475569; font-style: italic;">Obs: ${i.obsVenda}</span>` : ''}
                                </div>
                            </div>
                        </td>
                        <td style="padding: 8px; text-align: center;">${i.qtd || 1}</td>
                        <td style="padding: 8px; text-align: right;">${typeof formatMoney==='function'?formatMoney(i.preco || 0):(i.preco || 0)}</td>
                        <td style="padding: 8px; text-align: center; white-space: nowrap;">${(i.desconto && i.desconto > 0) ? '- '+(typeof formatMoney==='function'?formatMoney(i.desconto):i.desconto) : '-'}</td>
                        <td style="padding: 8px; text-align: right; font-weight: bold;">${formatMoney(((i.preco || 0) * (i.qtd || 1)) - (i.desconto || 0))}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 20px; font-size: 13px;">
            <div style="flex: 1; min-width: 280px; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-right: 5px; margin-bottom: 5px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">${isOrcamento ? 'PREVISÃO DE PAGAMENTO' : 'PAGAMENTOS REGISTRADOS'}</h3>
                ${v.pag !== '' ? `<p style="margin: 5px 0 0 0;">${v.pag}</p>` : '<p style="font-style: italic; color: #555;">Nenhum pagamento registrado no orçamento.</p>'}
            </div>
            <div style="flex: 1; min-width: 280px; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-left: 5px; margin-bottom: 5px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">RESUMO DOS VALORES</h3>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Subtotal:</span> <span>${formatMoney(v.subtotal || 0)}</span></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Taxas / Desloc (+):</span> <span>${formatMoney(v.frete || 0)}</span></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Descontos (-):</span> <span>-${formatMoney(v.desconto || 0)}</span></div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #000; font-size: 16px; font-weight: bold;"><span>TOTAL GERAL:</span> <span>${formatMoney(v.tot || 0)}</span></div>
            </div>
        </div>
        
        ${v.obs ? `
        <div style="border: 1px solid #000; border-radius: 5px; padding: 12px; margin-bottom: 30px; font-size: 13px; background-color: #f8fafc;">
            <strong>Observações Gerais do Pedido:</strong><br>
            ${v.obs}
        </div>
        ` : ''}

        <div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-size: 13px;">
            <div style="width: 40%;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">Assinatura do Cliente</div>
                <div style="font-size: 11px; margin-top: 3px; color: #475569;">${isOrcamento ? 'Reconheço o orçamento acima' : (isServico ? 'Aprovo a execução do serviço.' : 'Declaro ter recebido os itens acima.')}</div>
            </div>
            <div style="width: 40%;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">Assinatura da Empresa</div>
                <div style="font-size: 11px; margin-top: 3px; color: #475569; font-weight: bold;">${emp.nome}</div>
            </div>
        </div>
    </div>
    `;
    
    let divWhatsApp = document.getElementById('wpp-pdf-container');
    if (!divWhatsApp) {
        divWhatsApp = document.createElement('div');
        divWhatsApp.id = 'wpp-pdf-container';
        divWhatsApp.style.position = 'absolute';
        divWhatsApp.style.left = '-9999px'; 
        divWhatsApp.style.top = '0';
        document.body.appendChild(divWhatsApp);
    }
    divWhatsApp.innerHTML = htmlRecibo;

    const nomeEmpresa = emp.nome || 'nossa loja';
    const primeiroNomeCli = cliNome.split(' ')[0];
    let mensagem = isOrcamento
        ? `Olá, ${primeiroNomeCli}! Tudo bem? Segue em anexo o seu *Orçamento (Pedido #${numPedStr})* gerado pela *${nomeEmpresa}*. Qualquer dúvida, estou à disposição!`
        : `Olá, ${primeiroNomeCli}! Tudo bem? Segue em anexo o recibo da sua operação *(Pedido #${numPedStr})* na *${nomeEmpresa}*. Agradecemos a preferência!`;

    const filename = isOrcamento ? `Orcamento_${numPedStr}` : `Recibo_Pedido_${numPedStr}`;
    const wppLink = `https://wa.me/${numLimpo}?text=${encodeURIComponent(mensagem)}`;
    
    // Abre UMA aba com o PDF + botão de WhatsApp (navegador só permite 1 pop-up por clique)
    const winPDF = window.open('', '_blank');
    if (!winPDF) {
        return showToast('Bloqueador de pop-ups! Permita pop-ups neste site.', 'error');
    }
    
    winPDF.document.open();
    winPDF.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${filename}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { margin: 15mm; size: A4; }
                body { font-family: Arial, sans-serif; background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 20px; max-width: 900px; margin: 0 auto; }
                .barra-acoes { 
                    position: sticky; top: 0; z-index: 100; background: #1e293b; padding: 12px 20px; 
                    display: flex; gap: 10px; justify-content: center; align-items: center;
                    margin: -20px -20px 20px -20px; border-radius: 0;
                }
                .btn-wpp { 
                    background: #25D366; color: #fff; border: none; padding: 12px 24px; 
                    border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; 
                    display: flex; align-items: center; gap: 8px; text-decoration: none;
                }
                .btn-wpp:hover { background: #1ebd5a; }
                .btn-pdf { 
                    background: #dc2626; color: #fff; border: none; padding: 12px 24px; 
                    border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                }
                .btn-pdf:hover { background: #b91c1c; }
                @media print { 
                    body { padding: 0; max-width: none; }
                    .barra-acoes { display: none !important; } 
                }
            </style>
        </head>
        <body>
            <div class="barra-acoes">
                <a href="${wppLink}" target="_blank" class="btn-wpp">
                    <i class="fa-brands fa-whatsapp" style="font-size: 20px;"></i> Abrir WhatsApp
                </a>
                <button onclick="window.print()" class="btn-pdf">
                    <i class="fa-solid fa-file-pdf" style="font-size: 20px;"></i> Salvar PDF
                </button>
            </div>
            ${htmlRecibo}
        </body>
        </html>
    `);
    winPDF.document.close();
    
    showToast('Aba aberta! Use os botões para enviar no WhatsApp e salvar o PDF.', 'success');
}

function imprimirContratoObj(v) {
    if(!v) return;
    const emp = obterDadosEmpresa();
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    
    const cliInfo = obterDadosClientePDV(v.clienteId);
    const cliNome = (cliInfo && cliInfo.nome !== 'Consumidor Final') ? cliInfo.nome : (v.clienteNome || 'Consumidor Final');
    const cliCpf = (cliInfo && cliInfo.doc !== 'Não informado') ? cliInfo.doc : (v.clienteDoc || 'Não informado');
    const cliTel = (cliInfo && cliInfo.tel !== 'Não informado') ? cliInfo.tel : (v.clienteTel || 'Não informado');
    const cliEndCompleto = (cliInfo && cliInfo.endCompleto !== 'Não informado') ? cliInfo.endCompleto : (v.clienteEnd || 'Não informado');

    let totalDescontoItens = 0;
    let subtotalItensBruto = 0;
    let itensHtml = (v.itens || []).map((i, idx) => {
        const prodDb = (db.produtos || []).find(p => String(p.id) === String(i.id));
        const fotoHtml = prodDb && prodDb.foto ? `<div style="margin-right: 15px; flex-shrink: 0;"><img src="${prodDb.foto}" style="width: 90px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;"></div>` : '';
        const qtdItem = i.qtd || 1;
        const precoUnit = i.preco || 0;
        const subItemBruto = precoUnit * qtdItem;
        const descItem = Number(i.desconto) || 0;
        const totalItemLiquido = Math.max(0, subItemBruto - descItem);
        subtotalItensBruto += subItemBruto;
        totalDescontoItens += descItem;

        let valorLinhaHtml = `Valor: ${formatMoney(subItemBruto)}`;
        if (descItem > 0) {
            valorLinhaHtml = `Valor Unitário: ${formatMoney(precoUnit)} x ${qtdItem} = ${formatMoney(subItemBruto)}<br>` +
                             `Desconto do Item: - ${formatMoney(descItem)}<br>` +
                             `Valor com Desconto: ${formatMoney(totalItemLiquido)}`;
        }

        return `
        <div style="margin-bottom: 15px; display: flex; align-items: flex-start; border-bottom: 1px dashed #eee; padding-bottom: 10px;">
            ${fotoHtml}
            <div style="flex: 1;">
                <strong>PRODUTO/SERVIÇO ${idx + 1}</strong><br>
                Descrição: ${i.nome} ${i.obsVenda ? ` - Obs: ${i.obsVenda}` : ''}<br>${typeof formatarCustomizacaoContratoTexto === "function" ? formatarCustomizacaoContratoTexto(i.customizacao) : ""}
                Quantidade: ${qtdItem} unidade(s)<br>
                ${valorLinhaHtml}<br>
                Situação do produto: ( ) Produto em estoque &nbsp;&nbsp;&nbsp; ( ) Produto sob fabricação
            </div>
        </div>
        `;
    }).join('');

    let dataEntregaFormatada = '___/___/20__';
    const dataEntregaBruta = v.dataEntrega || (v.servicoDetalhes && v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo : '');
    if (dataEntregaBruta) {
        if (dataEntregaBruta.includes('-')) {
            const partes = dataEntregaBruta.split('T')[0].split('-');
            if (partes.length === 3) {
                dataEntregaFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            } else {
                dataEntregaFormatada = dataEntregaBruta;
            }
        } else {
            dataEntregaFormatada = dataEntregaBruta;
        }
    }
    const prazoOs = dataEntregaFormatada;
    const dataEmissaoOperação = v.data ? new Date(v.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

    const descGeral = Number(v.desconto) || 0;
    const totalDescontoGeral = descGeral + totalDescontoItens;
    const temDescontoNoContrato = totalDescontoGeral > 0;
    const subtotalBruto = (v.subtotal && v.subtotal > 0) ? (v.subtotal + totalDescontoItens) : subtotalItensBruto;

    const html = `
    <div style="font-family: Arial, sans-serif; color: #000; width: 100%; max-width: 800px; margin: 0 auto; line-height: 1.5; font-size: 14px;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
            ${emp.logoHtml}
            <h1 style="margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase;">${emp.nome}</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px;">CNPJ: ${emp.cnpj}<br>Endereço: ${emp.end}<br>Telefone / WhatsApp: ${emp.tel}</p>
        </div>

        <h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 5px;">CONTRATO DE COMPRA E VENDA E SERVIÇOS</h2>
        <p style="text-align: center; font-weight: bold; margin-top: 0; margin-bottom: 20px;">PEDIDO Nº ${numPedStr}</p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">DADOS DO CLIENTE (COMPRADOR)</h3>
        <p style="margin-top: 0;">
            <strong>Nome completo:</strong> ${cliNome}<br>
            <strong>CPF/CNPJ:</strong> ${cliCpf}<br>
            <strong>Telefone / WhatsApp:</strong> ${cliTel}<br>
            <strong>Endereço:</strong> ${cliEndCompleto}
        </p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">OBJETO DO CONTRATO</h3>
        <p style="margin-top: 0; margin-bottom: 15px;">O presente contrato tem como objeto a venda do(s) produto(s) / serviço(s) descrito(s) abaixo:</p>
        ${itensHtml}

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px; margin-top: 20px;">VALOR TOTAL DA COMPRA</h3>
        <p style="margin-top: 0;">
            ${temDescontoNoContrato ? `<strong>Subtotal:</strong> ${formatMoney(subtotalBruto)}<br>` : ''}
            ${temDescontoNoContrato ? `<strong>Desconto Total:</strong> - ${formatMoney(totalDescontoGeral)}<br>` : ''}
            ${v.frete && Number(v.frete) > 0 ? `<strong>Taxas / Frete (+):</strong> ${formatMoney(v.frete)}<br>` : ''}
            <strong>Valor total:</strong> ${formatMoney(v.tot)}<br>
            <strong>Forma de pagamento registrada:</strong> ${v.pag || '_________________________________'}<br>
            <strong>Data da Operação:</strong> ${dataEmissaoOperação}
        </p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">PRAZO DE ENTREGA E GARANTIA</h3>
        <p style="margin-top: 0; text-align: justify;">O prazo de entrega válido é a <strong>Data Prevista de Entrega Acordada</strong> informada neste pedido. Havendo eventuais imprevistos operacionais, de transporte, fabricação ou intempéries, fica acordado um prazo adicional de tolerância de até 7 (sete) dias corridos.<br>O produto/serviço possui garantia legal de 90 (noventa) dias contra defeitos de fabricação.</p>

        ${dataEntregaFormatada !== '___/___/20__' ? `<p style="margin-top: 8px; font-weight: bold; background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #2563eb; border-radius: 2px;">Data Prevista de Entrega Acordada: <span style="font-size: 15px; color: #1e3a8a;">${dataEntregaFormatada}</span></p>` : ''}

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">LOCAL DE ENTREGA</h3>
        <p style="margin-top: 0;"><strong>Endereço:</strong> ${cliEndCompleto}<br><strong>Data prevista de entrega:</strong> <span style="font-weight: bold; ${dataEntregaFormatada !== '___/___/20__' ? 'color: #1e3a8a; font-size: 15px;' : ''}">${dataEntregaFormatada}</span></p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">TRANSPORTE E MONTAGEM</h3>
        <p style="margin-top: 0;">( ) Entrega realizada pela empresa &nbsp;&nbsp;&nbsp; ( ) Retirada pelo cliente<br>Montagem: ( ) Inclusa &nbsp;&nbsp;&nbsp; ( ) Não inclusa<br>Caso a entrega seja realizada pela empresa, o cliente deve garantir acesso adequado ao local.</p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">MEDIDAS E ACESSO AO LOCAL</h3>
        <p style="margin-top: 0; text-align: justify;">O cliente declara que verificou as medidas do local de instalação e acesso (portas, corredores, elevadores e escadas). Caso o móvel não possa ser entregue ou instalado por falta de espaço ou acesso, a empresa não se responsabiliza por custos adicionais de transporte ou nova entrega.</p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">CONFERÊNCIA NO ATO DA ENTREGA</h3>
        <p style="margin-top: 0; text-align: justify;">O cliente deverá verificar o produto no momento da entrega. Após assinatura do recebimento, entende-se que o produto foi entregue em perfeitas condições.<br><strong>A garantia não cobre:</strong> Mau uso do produto; Danos causados após a entrega; Exposição à umidade excessiva; Sobrecarga de peso; Alterações feitas por terceiros.</p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">CANCELAMENTO E ATRASO</h3>
        <p style="margin-top: 0; text-align: justify;">Pedidos de produtos fabricados sob encomenda não poderão ser cancelados após o início da produção. Caso haja cancelamento após início da fabricação, poderá ser cobrada taxa referente aos custos de produção.<br>Em caso de atraso no pagamento do saldo, poderá ser aplicada multa de 2% sobre o valor devido, além de juros de 1% ao mês.</p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">OBSERVAÇÕES DO PEDIDO</h3>
        <p style="margin-top: 0;">${v.obs || 'Sem observação.'}</p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">ACEITE DAS CONDIÇÕES</h3>
        <p style="margin-top: 0;">Ao assinar este contrato, o comprador declara estar ciente e de acordo com todas as condições descritas neste documento.</p>

        <div style="margin-top: 40px; text-align: center; page-break-inside: avoid;">
            <p>Data do Acordo: ${new Date().toLocaleDateString('pt-BR')}</p>
            <div style="display: flex; justify-content: space-between; margin-top: 50px;">
                <div style="width: 45%;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">VENDEDOR / EMPRESA</div>
                    <p style="font-size: 12px; margin-top: 2px;">${v.vendedor ? `Vendedor: ${v.vendedor}<br>` : ''}<strong>${emp.nome}</strong></p>
                </div>
                <div style="width: 45%;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">COMPRADOR(A)</div>
                    <p style="font-size: 12px; margin-top: 2px;">Nome: ${cliNome}</p>
                </div>
            </div>
        </div>
    </div>
    `;

    printHtmlSeguro(`<div style="width: 210mm; margin: 0 auto; padding: 15mm; background: #fff;">${html}</div>`);
}

function imprimirOrdemProducaoObj(v) {
    if (!v) return;
    const emp = (typeof obterDadosEmpresa === 'function') ? obterDadosEmpresa() : { nome: 'Empresa', tel: '', end: '', cnpj: '', logoHtml: '' };

    const cliInfo = (typeof obterDadosClientePDV === 'function') ? obterDadosClientePDV(v.clienteId) : {};
    const cliNome = (cliInfo && cliInfo.nome && cliInfo.nome !== 'Consumidor Final') ? cliInfo.nome : (v.clienteNome || 'Consumidor Final');

    const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : null;
    const vendedorNome = v.vendedorNome || v.vendedor || (opAtual && opAtual.nome) || (window.currentUserInfo && window.currentUserInfo.nome) || 'Atendente';

    // Data por extenso (ex: "Goiânia 05, de Setembro de 2026")
    const dataVenda = v.data ? new Date(v.data) : new Date();
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const diaStr = String(dataVenda.getDate()).padStart(2, '0');
    const mesStr = meses[dataVenda.getMonth()];
    const anoStr = dataVenda.getFullYear();

    let cidadeEmp = '';
    if (window.db && window.db.config && window.db.config.empresa && window.db.config.empresa.cidade) {
        cidadeEmp = window.db.config.empresa.cidade;
    } else if (emp.end && emp.end.includes('-')) {
        const parts = emp.end.split('-');
        cidadeEmp = parts[parts.length - 1].trim();
    }
    const dataExtenso = `${cidadeEmp ? cidadeEmp + ' ' : ''}${diaStr}, de ${mesStr} de ${anoStr}`;
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id || '').slice(-4);

    const prodsDb = (window.db && Array.isArray(window.db.produtos)) ? window.db.produtos : [];
    const itens = (v.itens && v.itens.length > 0) ? v.itens : [];
    
    const blocosItensHtml = itens.map((item, idx) => {
        const prodDb = prodsDb.find(p => String(p.id) === String(item.id)) || {};
        const c = item.customizacao || prodDb.customizacaoPadrao || prodDb.customizacao || {};
        const foto = item.foto || prodDb.foto || (prodDb.fotos && prodDb.fotos[0]) || '';

        const linha = prodDb.categoria || prodDb.subcategoria || prodDb.marca || 'Palito';
        const material = c.madeira || 'Eucalipto';
        const acabamento = c.corMadeira || 'Natural';

        let medidaStr = '';
        const m = c.medidas || {};
        const partesMed = [];
        if (m.largura) partesMed.push(`L: ${m.largura}`);
        if (m.altura) partesMed.push(`A: ${m.altura}`);
        if (m.profundidade) partesMed.push(`P: ${m.profundidade}`);
        if (partesMed.length > 0) {
            medidaStr = partesMed.join(' x ');
        } else {
            medidaStr = prodDb.unidade ? `Unidade (${prodDb.unidade})` : '1.30';
        }

        const tecidoStr = [c.estofado, c.corEstofado].filter(Boolean).join(' - ');
        const qtdStr = `(${String(Math.round(item.qtd || 1)).padStart(2, '0')})`;

        const obsLista = [];
        if (c.obsExtra) obsLista.push(c.obsExtra);
        if (item.obsVenda && item.obsVenda !== c.obsExtra) obsLista.push(item.obsVenda);
        const obsStr = obsLista.length > 0 ? obsLista.join('<br>') : 'Padrão de fabricação';

        const fotoHtml = foto ? `
            <div style="text-align: center; margin: 25px auto 10px auto;">
                <img src="${foto}" style="max-height: 420px; max-width: 95%; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
            </div>
        ` : `
            <div style="text-align: center; margin: 25px auto 10px auto; padding: 40px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; color: #94a3b8; font-size: 13px;">
                <i class="fa-solid fa-couch" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
                Foto de referência não anexada ao produto.
            </div>
        `;

        return `
            <div class="bloco-item-op" style="${idx > 0 ? 'page-break-before: always; margin-top: 30px;' : ''}">
                <div style="margin: 20px 0 10px 0; font-size: 13px; line-height: 2;">
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Produto:</span>
                        <span style="flex: 1; font-weight: 700; color: #0f172a;">${item.nome}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Linha:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${linha}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Material:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${material}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Medida:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${medidaStr}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Acabamento:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${acabamento}</span>
                    </div>
                    ${tecidoStr ? `
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Estofado/Tecido:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${tecidoStr}</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Quantidade:</span>
                        <span style="flex: 1; font-weight: 700; color: #0f172a;">${qtdStr}</span>
                    </div>
                    <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding: 4px 0;">
                        <span style="width: 140px; color: #64748b; font-weight: 500;">Observações:</span>
                        <span style="flex: 1; font-weight: 600; color: #1e293b;">${obsStr}</span>
                    </div>
                </div>

                ${fotoHtml}
            </div>
        `;
    }).join('');

    const logoHtml = emp.logoHtml || (emp.logo ? `<img src="${emp.logo}" style="max-height: 85px; margin-bottom: 8px; object-fit: contain;">` : `<h2 style="margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; color: #475569;">${emp.nome}</h2>`);

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast("Por favor, permita pop-ups para imprimir a Ordem de Produção.", "warning");
        return;
    }

    const wppTexto = encodeURIComponent(`*ORDEM DE PRODUÇÃO #${numPedStr}*\nCliente: ${cliNome}\nVendedora: ${vendedorNome}\nData: ${dataExtenso}`);
    const wppLink = `https://api.whatsapp.com/send?text=${wppTexto}`;

    printWin.document.open();
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Ordem de Produção #${numPedStr}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { size: A4; margin: 12mm 15mm; }
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: #f1f5f9;
                    margin: 0;
                    padding: 20px;
                    color: #1e293b;
                }
                .barra-acoes {
                    max-width: 800px;
                    margin: 0 auto 15px auto;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .btn-acao {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 700;
                    text-decoration: none;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .btn-wpp { background: #25D366; color: #fff; }
                .btn-wpp:hover { background: #1ea952; }
                .btn-print { background: #0f172a; color: #fff; }
                .btn-print:hover { background: #334155; }
                .folha-a4 {
                    max-width: 800px;
                    margin: 0 auto;
                    background: #ffffff;
                    padding: 35px 45px;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                }
                @media print {
                    body { background: #fff !important; padding: 0 !important; }
                    .barra-acoes { display: none !important; }
                    .folha-a4 { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; max-width: none !important; }
                    .bloco-item-op { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="barra-acoes">
                <a href="${wppLink}" target="_blank" class="btn-acao btn-wpp">
                    <i class="fa-brands fa-whatsapp"></i> Enviar no WhatsApp
                </a>
                <button onclick="window.print()" class="btn-acao btn-print">
                    <i class="fa-solid fa-print"></i> Imprimir / Salvar PDF
                </button>
            </div>

            <div class="folha-a4">
                <!-- Cabeçalho com Logo -->
                <div style="text-align: center; margin-bottom: 25px;">
                    ${logoHtml}
                </div>

                <!-- Título e Data -->
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                    <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #334155; text-transform: uppercase;">
                        ORDEM DE PRODUÇÃO <span style="font-size: 14px; font-weight: 600; color: #64748b;">#${numPedStr}</span>
                    </h1>
                    <span style="font-size: 12px; font-weight: 500; color: #64748b;">${dataExtenso}</span>
                </div>

                <!-- Cliente e Vendedora -->
                <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 12px;">
                    <div>Cliente: <span style="font-weight: 700; color: #0f172a;">${cliNome}</span></div>
                    <div>Vendedora: <span style="font-weight: 700; color: #0f172a;">${vendedorNome}</span></div>
                </div>

                <!-- Linha pontilhada e introdução -->
                <div style="border-top: 1px dashed #cbd5e1; margin: 10px 0 12px 0;"></div>
                <p style="margin: 0 0 15px 0; font-size: 12px; color: #64748b;">Segue informações e foto de referência para a produção dos móveis abaixo.</p>

                <!-- Itens / Móveis -->
                ${blocosItensHtml}

                <!-- Rodapé da Empresa -->
                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px dashed #a5f3fc; font-size: 11px; color: #64748b; text-align: center;">
                    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin-bottom: 6px; font-weight: 500;">
                        <span><i class="fa-solid fa-location-dot" style="color: #06b6d4; margin-right: 4px;"></i> ${emp.end}</span>
                        <span><i class="fa-solid fa-phone" style="color: #06b6d4; margin-right: 4px;"></i> ${emp.tel}</span>
                        ${emp.cnpj ? `<span>CNPJ: ${emp.cnpj}</span>` : ''}
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
}
window.imprimirOrdemProducaoObj = imprimirOrdemProducaoObj;

// ==========================================
// 9. LEITOR DE CÓDIGO DE BARRAS
// ==========================================
function abrirLeitorCamera() { 
    document.getElementById('modal-leitor-codigo').classList.remove('hidden'); 
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader"); 
    
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, onScanSuccess)
    .catch(err => { 
        showToast("Erro ao acessar a câmera.", "error"); 
        fecharLeitorCamera(); 
    }); 
}

function fecharLeitorCamera() { 
    document.getElementById('modal-leitor-codigo').classList.add('hidden'); 
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.log(err)); 
    }
}

function onScanSuccess(decodedText) { 
    fecharLeitorCamera(); 
    const buscaInput = document.getElementById('pdv-produto-busca');
    const codigoLido = String(decodedText).trim();
    buscaInput.value = codigoLido; 
    const prod = db.produtos.find(x => (String(x.ean) === codigoLido || String(x.id) === codigoLido) && x.ativo !== false); 
    
    if(prod) { 
        processarAdicaoProduto(prod); 
        showToast('Código lido com sucesso!', 'success'); 
    } else { 
        showToast('Produto não encontrado pelo código.', 'error'); 
    } 
    buscaInput.value = ''; 
}

// ==========================================
// 10. PDV E CARRINHO DE COMPRAS
// ==========================================
function ajustarOpcoesOperacaoPDV() {
    const opSelect = document.getElementById('pdv-operacao'); 
    if (!opSelect) return;

    const user = window.currentUserInfo;
    const isAdmin = !user || !!user.isAdmin;

    // Resolução do Fluxo Operacional: SaaS vs Configuração da Loja
    const fluxoPlano = (typeof window.SaaSLicenca !== 'undefined' && typeof window.SaaSLicenca.obterFluxoPDV === 'function')
        ? window.SaaSLicenca.obterFluxoPDV(window.saasLicencaAtual)
        : ((window.saasLicencaAtual && window.saasLicencaAtual.fluxoPDV) || 'ambos');

    const fluxoConfig = (window.db && window.db.config && window.db.config.fluxoPDV) || 'ambos';
    const fluxoEfetivo = (fluxoPlano === 'ambos') ? fluxoConfig : fluxoPlano;

    let podeLancarCaixa = isAdmin || (typeof window.checarPermissaoUsuario === 'function' ? window.checarPermissaoUsuario(user, 'perm_pdv_lancar_caixa', 'perm_pdv') : true);
    let podeVendaBalcao = isAdmin || (typeof window.checarPermissaoUsuario === 'function' ? window.checarPermissaoUsuario(user, 'perm_pdv_venda_balcao', 'perm_pdv') : true);
    const podeOrcamentos = isAdmin || (typeof window.checarPermissaoUsuario === 'function' ? window.checarPermissaoUsuario(user, 'perm_orcamentos', 'perm_pdv') : true);
    const podeServico = isAdmin || podeLancarCaixa || podeVendaBalcao;

    // Regras estritas do fluxo operacional:
    if (fluxoEfetivo === 'caixa') {
        // Pré-Venda obrigatória para Caixa Central
        podeVendaBalcao = false;
    } else if (fluxoEfetivo === 'direto') {
        // Venda Balcão direta obrigatória no PDV
        podeLancarCaixa = false;
    }

    const optMap = {
        'Venda': podeLancarCaixa,
        'Orçamento': podeOrcamentos,
        'Serviço': podeServico,
        'VendaBalcao': podeVendaBalcao
    };

    let valorValido = false;
    let primeiroValido = null;

    // Operação padrão preferida da loja
    const operacaoPadraoConfig = (window.db && window.db.config && window.db.config.pdvOperacaoPadrao !== undefined)
        ? window.db.config.pdvOperacaoPadrao
        : (fluxoEfetivo === 'direto' ? 'VendaBalcao' : 'Venda');

    const placeholderOpt = document.getElementById('pdv-operacao-placeholder');
    if (placeholderOpt) {
        if (operacaoPadraoConfig === 'nenhum') {
            placeholderOpt.classList.remove('hidden');
            placeholderOpt.style.display = '';
            placeholderOpt.disabled = true;
        } else {
            placeholderOpt.classList.add('hidden');
            placeholderOpt.style.display = 'none';
        }
    }

    Array.from(opSelect.options).forEach(opt => {
        if (opt.id === 'pdv-operacao-placeholder') return;
        const permitido = optMap[opt.value] !== false;
        opt.disabled = !permitido;
        if (!permitido) {
            opt.classList.add('hidden');
            opt.style.display = 'none';
        } else {
            opt.classList.remove('hidden');
            opt.style.display = '';
            if (!primeiroValido) primeiroValido = opt.value;
            if (opt.value === opSelect.value) valorValido = true;
        }
    });

    if (operacaoPadraoConfig === 'nenhum' && !opSelect.dataset.usuarioAlterou) {
        opSelect.value = '';
        atualizarResumoPagamentosVenda();
        togglePanelServico();
    } else if (!valorValido && primeiroValido) {
        opSelect.value = (optMap[operacaoPadraoConfig] ? operacaoPadraoConfig : primeiroValido);
        atualizarResumoPagamentosVenda();
        togglePanelServico();
    } else if (valorValido && !opSelect.dataset.usuarioAlterou && optMap[operacaoPadraoConfig] && opSelect.value !== operacaoPadraoConfig) {
        opSelect.value = operacaoPadraoConfig;
        atualizarResumoPagamentosVenda();
        togglePanelServico();
    }
}
window.ajustarOpcoesOperacaoPDV = ajustarOpcoesOperacaoPDV;

function prepararPDV() {
    if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
    
    const opSelect = document.getElementById('pdv-operacao'); 
    if(opSelect) { 
        opSelect.addEventListener('change', () => { 
            opSelect.dataset.usuarioAlterou = 'true';
            atualizarResumoPagamentosVenda(); 
            togglePanelServico(); 
        }); 
    }
    
    ajustarOpcoesOperacaoPDV();
    if (typeof atualizarVendedoresPDV === 'function') atualizarVendedoresPDV();
    atualizarListaClientesPDV();
    const badgeMargemTopo = document.getElementById('pdv-badge-margem-min');
    if (badgeMargemTopo) badgeMargemTopo.innerText = (typeof obterMargemMinimaConfigurada === 'function' ? obterMargemMinimaConfigurada() : 15) + '%';
    
    document.getElementById('pdv-busca-resultados').classList.add('hidden'); 
    document.getElementById('pdv-produto-busca').value = '';
    
    const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : null;
    const opNome = (opAtual && opAtual.nome) || (window.currentUserInfo && window.currentUserInfo.nome) || (window.currentUser && window.currentUser.displayName) || '';
    const opSufixo = opNome ? ' (' + opNome + ')' : '';

    const badgeCaixa = document.getElementById('pdv-status-caixa');
    if (badgeCaixa) {
        if(db.caixa.status === 'ABERTO') { 
            badgeCaixa.className = "bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; 
            badgeCaixa.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Caixa Aberto' + opSufixo; 
        } else { 
            badgeCaixa.className = "bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; 
            badgeCaixa.innerHTML = '<i class="fa-solid fa-lock mr-1"></i> Caixa Fechado' + opSufixo; 
        }
    }
    
    togglePanelServico();
    
    const elDataEntPdv = document.getElementById('pdv-data-entrega');
    const elOsPrazoPdv = document.getElementById('os-prazo');
    if (elDataEntPdv && elOsPrazoPdv && !elDataEntPdv._syncAttached) {
        elDataEntPdv._syncAttached = true;
        elDataEntPdv.addEventListener('change', () => {
            if (!elOsPrazoPdv.value) elOsPrazoPdv.value = elDataEntPdv.value;
        });
        elOsPrazoPdv.addEventListener('change', () => {
            if (!elDataEntPdv.value) elDataEntPdv.value = elOsPrazoPdv.value;
        });
    }

    const camposAutoSalvar = ['pdv-obs', 'pdv-desconto', 'pdv-frete', 'pdv-vendedor', 'pdv-operacao', 'pdv-data', 'pdv-data-entrega'];
    camposAutoSalvar.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el._pdvAutoSalvarAttached) {
            el._pdvAutoSalvarAttached = true;
            el.addEventListener('change', () => { if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV(); });
            el.addEventListener('input', () => { if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV(); });
        }
    });
}

function togglePanelServico() {
    const op = document.getElementById('pdv-operacao'); 
    const panel = document.getElementById('panel-servico');
    
    if (op && panel) { 
        if (op.value === 'Serviço') { 
            panel.classList.remove('hidden'); 
            panel.classList.add('flex'); 
        } else { 
            panel.classList.add('hidden'); 
            panel.classList.remove('flex'); 
        } 
    }
}

let _debouncePdvTimer = null;
function debouncedFiltrarProdutosPDV(termo) {
    if (_debouncePdvTimer) clearTimeout(_debouncePdvTimer);
    _debouncePdvTimer = setTimeout(() => {
        filtrarProdutosPDV(termo);
    }, 150);
}
window.debouncedFiltrarProdutosPDV = debouncedFiltrarProdutosPDV;

function filtrarProdutosPDV(termo) {
    const dropdown = document.getElementById('pdv-busca-resultados'); 
    if (!dropdown) return; 
    
    dropdown.innerHTML = '';
    const listaProdutos = db.produtos || []; 
    const busca = termo ? String(termo).trim().toLowerCase() : '';
    
    let produtosFiltrados = busca === '' ? listaProdutos : listaProdutos.filter(p => { 
        if (p.ativo === false) return false;
        return (
            (p.nome && String(p.nome).toLowerCase().includes(busca)) ||
            (p.ean && String(p.ean).toLowerCase().includes(busca)) ||
            (p.marca && String(p.marca).toLowerCase().includes(busca)) ||
            (p.categoria && String(p.categoria).toLowerCase().includes(busca)) ||
            (p.subcategoria && String(p.subcategoria).toLowerCase().includes(busca)) ||
            (p.ncm && String(p.ncm).toLowerCase().includes(busca)) ||
            (p.id && String(p.id).toLowerCase().includes(busca)) ||
            (p.obs && String(p.obs).toLowerCase().includes(busca))
        );
    });
    
    if (typeof ordenarListaAlfabeticamente === 'function') {
        produtosFiltrados = ordenarListaAlfabeticamente(produtosFiltrados, 'nome');
    } else {
        produtosFiltrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }

    const limitados = produtosFiltrados.slice(0, 50);
    if (limitados.length === 0) { 
        dropdown.classList.add('hidden'); 
        return; 
    }
    
    limitados.forEach(prod => {
        if(prod.ativo === false) return; 
        
        const div = document.createElement('div'); 
        div.className = 'p-2.5 sm:p-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer border-b border-slate-100 dark:border-slate-700/60 text-sm flex items-center justify-between gap-3 transition-colors';
        
        const precoNum = (typeof parseInputMoney === 'function') 
            ? parseInputMoney(prod.preco) 
            : (parseFloat(String(prod.preco || 0).replace(',', '.')) || 0);
        const precoFormatado = Number(precoNum).toFixed(2).replace('.', ','); 
        const nomeProd = prod.nome || 'Produto Sem Nome';
        
        const fHtml = prod.foto 
            ? `<img src="${prod.foto}" onclick="event.stopPropagation(); abrirZoom(this.src)" class="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 cursor-zoom-in hover:opacity-80 transition" title="Ver foto">` 
            : `<div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs shrink-0 border border-slate-200 dark:border-slate-700/60"><i class="fa-regular fa-image"></i></div>`;
        
        const isServicoProd = prod.tipo === 'servico' || prod.categoria === 'Serviço' || prod.categoria === 'Servicos' || prod.categoria === 'Serviços';
        let badgeEstoque = '';
        if (isServicoProd) {
            badgeEstoque = `<span class="badge-estoque-servico whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 shadow-xs"><i class="fa-solid fa-wrench text-[9px]"></i> Serviço</span>`;
        } else {
            const qtdEstoque = (typeof parseInputMoney === 'function') 
                ? parseInputMoney(prod.estoque) 
                : (parseFloat(String(prod.estoque || 0).replace(',', '.')) || 0);
            const estoqueMin = (typeof parseInputMoney === 'function') 
                ? parseInputMoney(prod.minimo) 
                : (parseFloat(String(prod.minimo || 1).replace(',', '.')) || 1);

            if (qtdEstoque <= 0) {
                badgeEstoque = `<span class="badge-estoque-zerado whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-xs"><i class="fa-solid fa-circle-xmark text-[9px]"></i> Esgotado (${qtdEstoque})</span>`;
            } else if (qtdEstoque <= estoqueMin) {
                badgeEstoque = `<span class="badge-estoque-baixo whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-xs"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Estoque baixo: ${qtdEstoque}</span>`;
            } else {
                badgeEstoque = `<span class="badge-estoque-ok whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 shadow-xs"><i class="fa-solid fa-boxes-stacked text-[9px]"></i> ${qtdEstoque} em estoque</span>`;
            }
        }

        div.innerHTML = `
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="flex-shrink-0">${fHtml}</div>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate" title="${nomeProd}">${nomeProd}</span>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                        ${badgeEstoque}
                        ${prod.ean ? `<span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1"><i class="fa-solid fa-barcode text-[9px]"></i> ${prod.ean}</span>` : ''}
                        ${prod.marca ? `<span class="text-[10px] text-slate-400 dark:text-slate-500">• ${prod.marca}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="text-right shrink-0 pl-2">
                <span class="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm sm:text-base font-mono tracking-tight">R$ ${precoFormatado}</span>
            </div>
        `;
        div.onclick = () => { 
            processarAdicaoProduto(prod); 
            document.getElementById('pdv-produto-busca').value = ''; 
            dropdown.classList.add('hidden'); 
            document.getElementById('pdv-produto-busca').focus(); 
        }; 
        dropdown.appendChild(div);
    });
    
    dropdown.classList.remove('hidden');
}

function buscarProdutoPorEAN(termo) {
    if (_debouncePdvTimer) clearTimeout(_debouncePdvTimer);
    if (!termo) return;
    const busca = String(termo).trim();
    if (busca === '') return;
    
    const listaProdutos = db.produtos || [];
    const produto = listaProdutos.find(p => (String(p.ean) === busca || String(p.id) === busca) && p.ativo !== false);
    
    if (produto) {
        processarAdicaoProduto(produto);
        document.getElementById('pdv-produto-busca').value = '';
        const dropdown = document.getElementById('pdv-busca-resultados');
        if (dropdown) dropdown.classList.add('hidden');
        document.getElementById('pdv-produto-busca').focus();
    } else {
        showToast('Produto não encontrado com este código de barras!', 'error');
    }
}
window.buscarProdutoPorEAN = buscarProdutoPorEAN;

document.addEventListener('click', function(event) { 
    const dropdown = document.getElementById('pdv-busca-resultados'); 
    if (dropdown && !event.target.closest('#pdv-produto-busca') && !event.target.closest('#pdv-busca-resultados')) {
        dropdown.classList.add('hidden'); 
    }
    const dropdownCli = document.getElementById('pdv-cliente-resultados'); 
    if (dropdownCli && !event.target.closest('#pdv-cliente-busca') && !event.target.closest('#pdv-cliente-resultados')) {
        dropdownCli.classList.add('hidden'); 
    }
});

function processarAdicaoProduto(p) { 
    const op = document.getElementById('pdv-operacao') ? document.getElementById('pdv-operacao').value : 'Venda'; 
    const isOrcamento = op === 'Orçamento';
    const idx = cart.findIndex(i => String(i.id) === String(p.id)); 
    
    if(idx >= 0) { 
        cart[idx].qtd++; 
        if(!isOrcamento && cart[idx].qtd > (p.estoque || 0)) {
            showToast(`Estoque NEGATIVO! Restam ${p.estoque || 0}.`, 'info'); 
        }
    } else { 
        const precoProd = (typeof parseInputMoney === 'function') 
            ? parseInputMoney(p.preco) 
            : (parseFloat(String(p.preco || 0).replace(',', '.')) || 0);
        const custoProd = (typeof parseInputMoney === 'function') 
            ? parseInputMoney(p.custo) 
            : (parseFloat(String(p.custo || 0).replace(',', '.')) || 0);
        const estoqueProd = (typeof parseInputMoney === 'function') 
            ? parseInputMoney(p.estoque) 
            : (parseFloat(String(p.estoque || 0).replace(',', '.')) || 0);

        let persPadrao = null;
        if (p.customizacaoPadrao) {
            persPadrao = JSON.parse(JSON.stringify(p.customizacaoPadrao));
        } else if (p.customizacao) {
            persPadrao = JSON.parse(JSON.stringify(p.customizacao));
        }

        cart.push({ 
            id: p.id || '', 
            nome: p.nome || 'Produto', 
            preco: precoProd, 
            precoOriginal: precoProd,
            custo: custoProd, 
            estoque: estoqueProd, 
            desconto: 0,
            qtd: 1, 
            foto: p.foto || '', 
            obsVenda: '',
            customizacao: persPadrao
        }); 
        if(!isOrcamento && estoqueProd < 1) {
            showToast(`Estoque NEGATIVO!`, 'info'); 
        }
    } 
    renderCarrinho(); 
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
}

function pdvMudarObsItem(i, val) { 
    if (cart[i]) cart[i].obsVenda = val || ''; 
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
}

function renderCarrinho() {
    window.cart = cart;
    const margemMin = obterMargemMinimaConfigurada();
    const subGeral = cart.reduce((acc, it) => acc + (((it.preco || 0) * (it.qtd || 1)) - (it.desconto || 0)), 0);
    const descGlobalTotal = (typeof parseInputMoney === 'function' && document.getElementById('pdv-desconto')) 
        ? (parseInputMoney(document.getElementById('pdv-desconto').value) || 0) 
        : 0;

    document.getElementById('pdv-carrinho-body').innerHTML = cart.map((item, i) => { 
        const fHtml = item.foto ? `<img src="${item.foto}" onclick="event.stopPropagation(); abrirZoom(this.src)" class="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 mx-auto cursor-zoom-in hover:opacity-80 transition img-zoom-trigger" title="Ver foto em tela cheia">` : `<div class="w-10 h-10 mx-auto rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs border border-slate-200 dark:border-slate-700"><i class="fa-regular fa-image"></i></div>`; 

        const prodDb = (db.produtos || []).find(p => String(p.id) === String(item.id));
        const itemEstoque = prodDb ? (prodDb.estoque !== undefined ? prodDb.estoque : 0) : (item.estoque !== undefined ? item.estoque : null);
        const subItem = Math.max(0, ((item.preco || 0) * (item.qtd || 1)) - (item.desconto || 0));
        const rateioDesc = (subGeral > 0 && descGlobalTotal > 0) ? (subItem / subGeral) * descGlobalTotal : 0;
        const infoLucro = calcularMargemLucroItem(item, rateioDesc);
        
        // SÓ ALERTA SE O USUÁRIO ESTIVER APLICANDO DESCONTO E O LUCRO FICAR ABAIXO DO MÍNIMO!
        const alertaMargem = (margemMin > 0 && infoLucro.temDesconto && infoLucro.custoTotal > 0 && infoLucro.perc < margemMin);

        let badgeEstoqueHtml = '';
        if (itemEstoque !== null && itemEstoque !== undefined) {
            const numEst = (typeof parseInputMoney === 'function') ? parseInputMoney(itemEstoque) : Number(itemEstoque);
            if (numEst <= 0) {
                badgeEstoqueHtml = `<span class="badge-estoque-zerado whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 shadow-xs ml-1"><i class="fa-solid fa-circle-xmark text-[9px]"></i> Sem estoque</span>`;
            } else {
                badgeEstoqueHtml = `<span class="badge-estoque-ok whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 shadow-xs ml-1"><i class="fa-solid fa-box text-[9px]"></i> Estoque: ${numEst}</span>`;
            }
        }

        const badgeAlertaMargemHtml = alertaMargem
            ? `<div class="alerta-margem-pdv mt-1.5 px-2 py-0.5 rounded inline-flex items-center gap-1.5 text-[11px] font-bold shadow-xs whitespace-nowrap max-w-full overflow-hidden text-ellipsis">
                   <i class="fa-solid fa-triangle-exclamation text-amber-500 text-xs shrink-0"></i>
                   <span>Desconto ultrapassa o limite permitido</span>
               </div>`
            : '';

        const inputDescClass = alertaMargem
            ? "w-20 text-right border-2 border-amber-400 dark:border-amber-500 rounded-lg p-1.5 font-bold text-amber-600 dark:text-amber-300 outline-none focus:border-amber-500 bg-amber-50 dark:bg-amber-950/40 shadow-xs"
            : "w-20 text-right border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-bold text-red-500 dark:text-red-400 outline-none focus:border-red-500 bg-white dark:bg-slate-800";

        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-800/80 ${alertaMargem ? 'bg-amber-50/20 dark:bg-amber-950/15' : ''}">
            <td class="py-2.5 text-center">${fHtml}</td>
            <td class="py-2.5 text-slate-800 dark:text-slate-100 font-medium">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm leading-snug">${item.nome}</span>
                    ${badgeEstoqueHtml}
                    ${(item.id && (typeof window.podeCadastrarProdutos === 'function' ? window.podeCadastrarProdutos() : true)) ? `<button type="button" onclick="abrirModalProduto('${item.id}')" class="text-slate-400 hover:text-blue-500 transition-colors ml-0.5 p-0.5" title="Editar Cadastro do Produto"><i class="fa-solid fa-pencil text-[11px]"></i></button>` : ''}
                </div>
                ${badgeAlertaMargemHtml}
                <div class="flex items-center gap-1.5 mt-1.5">
                    <input type="text" placeholder="Obs rapida..." value="${item.obsVenda || ''}" onchange="pdvMudarObsItem(${i}, this.value)" class="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[10px] outline-none focus:border-blue-400 placeholder:text-slate-300 dark:text-white">
                    <button type="button" onclick="abrirModalPersonalizacao(${i})" class="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition ${item.customizacao ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 hover:text-amber-700'}" title="Personalizar Madeira, Tecido e Medidas"><i class="fa-solid fa-couch"></i> ${item.customizacao ? 'Personalizado' : 'Personalizar'}</button>
                </div>
                ${typeof formatarResumoCustomizacaoHtml === 'function' ? formatarResumoCustomizacaoHtml(item.customizacao) : ''}
            </td>
            <td class="py-2.5 text-center">
                <div class="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 border border-slate-300 dark:border-slate-600">
                    <button type="button" onclick="pdvAlterarQtdRelativa(${i}, -1)" class="w-6 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-xs font-black transition active:scale-95" title="Diminuir 1">-</button>
                    <input type="number" step="any" min="0.001" value="${Math.abs(Number(item.qtd) - Math.round(Number(item.qtd))) < 0.005 ? Math.round(Number(item.qtd)) : item.qtd}" onchange="pdvMudarQtd(${i}, this.value)" class="w-12 text-center bg-white dark:bg-slate-800 dark:text-white border-0 font-bold text-xs p-1 outline-none rounded mx-0.5 shadow-inner">
                    <button type="button" onclick="pdvAlterarQtdRelativa(${i}, 1)" class="w-6 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-xs font-black transition active:scale-95" title="Aumentar 1">+</button>
                </div>
            </td>
            <td class="py-2.5 text-right"><input type="text" data-mask="money" inputmode="numeric" value="${Number(item.preco).toFixed(2)}" onchange="pdvMudarPreco(${i}, this.value)" class="w-20 text-right border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 bg-white dark:bg-slate-800 dark:text-white"></td>
            <td class="py-2.5 text-right"><input type="text" data-mask="money" inputmode="numeric" value="${Number(item.desconto || 0).toFixed(2)}" onchange="pdvMudarDescontoItem(${i}, this.value)" class="${inputDescClass}"></td>
            <td class="py-2.5 text-right font-bold text-slate-800 dark:text-slate-100 font-mono">${formatMoney(((item.preco || 0) * (item.qtd || 1)) - (item.desconto || 0))}</td>
            <td class="py-2.5 text-center"><button onclick="cart.splice(${i},1); renderCarrinho(); if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();" class="text-red-500 hover:text-red-700 p-2 transition-colors"><i class="fa-solid fa-trash text-base"></i></button></td>
        </tr>`;
    }).join(''); 
    pdvAtualizarTotais();
}

function pdvAlterarQtdRelativa(i, delta) {
    if (!cart[i]) return;
    let atual = Number(cart[i].qtd) || 1;
    // Se estiver muito próximo de um inteiro (ex: 1.001), arredonda antes de somar/subtrair
    if (Math.abs(atual - Math.round(atual)) < 0.005) {
        atual = Math.round(atual);
    }
    let nova = atual + delta;
    if (Math.abs(nova - Math.round(nova)) < 0.005) {
        nova = Math.round(nova);
    } else {
        nova = Math.round(nova * 1000) / 1000;
    }
    nova = Math.max(0.001, nova);
    pdvMudarQtd(i, nova);
}

function pdvMudarQtd(i, n) { 
    if (!cart[i]) return;
    const op = document.getElementById('pdv-operacao') ? document.getElementById('pdv-operacao').value : 'Venda'; 
    const isOrcamento = op === 'Orçamento'; 
    
    let parsed = 1;
    if (typeof n === 'number') {
        parsed = n;
    } else {
        const clean = String(n || '').trim().replace(',', '.');
        parsed = parseFloat(clean);
        if (isNaN(parsed) && typeof parseInputMoney === 'function') {
            parsed = parseInputMoney(n);
        }
    }
    let novaQtd = Math.max(0.001, (!isNaN(parsed) && parsed > 0) ? parsed : 1); 
    if (Math.abs(novaQtd - Math.round(novaQtd)) < 0.005) {
        novaQtd = Math.round(novaQtd);
    } else {
        novaQtd = Math.round(novaQtd * 1000) / 1000;
    }
    cart[i].qtd = novaQtd; 
    
    const p = (db.produtos || []).find(x => String(x.id) === String(cart[i].id)); 
    if(!isOrcamento && p && novaQtd > (p.estoque || 0)) {
        showToast(`Estoque NEGATIVO! Restam ${p.estoque || 0}.`, 'info'); 
    }
    renderCarrinho(); 
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
}

function pdvMudarPreco(i, val) { 
    const novoPreco = parseInputMoney(val); 
    if(!isNaN(novoPreco) && novoPreco >= 0) { 
        cart[i].preco = novoPreco; 
    } 
    pdvAtualizarTotais(); 
    renderCarrinho(); 
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
}

function pdvLimpar() { 
    cart = []; 
    if (document.getElementById('pdv-desconto')) document.getElementById('pdv-desconto').value = 0; 
    if (document.getElementById('pdv-frete')) document.getElementById('pdv-frete').value = 0; 
    
    if(document.getElementById('pdv-obs')) {
        document.getElementById('pdv-obs').value = ''; 
    }
    if(document.getElementById('pdv-data')) {
        document.getElementById('pdv-data').value = typeof obterDataHojeLocalYYYYMMDD === 'function' ? obterDataHojeLocalYYYYMMDD() : new Date().toISOString().split('T')[0];
    }
    if(document.getElementById('pdv-data-entrega')) {
        document.getElementById('pdv-data-entrega').value = '';
    }
    if(document.getElementById('pdv-produto-busca')) {
        document.getElementById('pdv-produto-busca').value = '';
    }
    if(document.getElementById('pdv-valor-atual')) {
        document.getElementById('pdv-valor-atual').value = '0';
    }
    if(document.getElementById('pdv-obs-venda-rapida')) {
        document.getElementById('pdv-obs-venda-rapida').value = '';
    }
    if(document.getElementById('pdv-metodo-atual')) {
        document.getElementById('pdv-metodo-atual').value = 'Dinheiro';
    }
    if(document.getElementById('pdv-parcelas-atual')) {
        document.getElementById('pdv-parcelas-atual').value = '1';
    }
    if(document.getElementById('os-prazo')) { 
        document.getElementById('os-prazo').value = ''; 
        document.getElementById('os-garantia').value = ''; 
        document.getElementById('os-desc').value = ''; 
        osFotosArray = []; 
        renderizarFotosOS(); 
    } 
    pagamentosVendaAtual = []; 
    window.vendaEmEdicao = null; 
    window.vendaIdempotencyKey = null;
    isProcessingVenda = false;

    // Reset completo do cliente para Consumidor Final (oculta card de dados)
    selecionarClientePDV(null, true);
    
    const vendSelect = document.getElementById('pdv-vendedor');
    if (vendSelect) {
        delete vendSelect.dataset.usuarioAlterou;
        vendSelect.value = 'Balcão';
    }

    const opSelect = document.getElementById('pdv-operacao');
    if (opSelect) {
        delete opSelect.dataset.usuarioAlterou;
        ajustarOpcoesOperacaoPDV();
    }

    // Limpa rascunho persistido para evitar restauração indevida de venda finalizada
    try {
        localStorage.removeItem('pdvState');
    } catch(e) {
        console.warn('Aviso: falha ao limpar pdvState do localStorage:', e);
    }

    renderCarrinho(); 
    pdvAtualizarTotais();
    if (typeof atualizarResumoPagamentosVenda === 'function') {
        atualizarResumoPagamentosVenda();
    }
    liberarBotaoFinalizar();
}

function pdvMudarDescontoItem(i, n) { 
    if (!cart[i]) return;
    cart[i].desconto = Math.max(0, parseInputMoney(n) || 0); 
    const margemMin = obterMargemMinimaConfigurada();
    if (margemMin > 0 && cart[i].custo > 0) {
        const inf = calcularMargemLucroItem(cart[i], 0);
        if (inf.perc < margemMin) {
            showToast(`⚠️ Atenção: Desconto deixa o lucro de "${cart[i].nome}" em ${inf.perc.toFixed(1)}% (Abaixo do mínimo de ${margemMin}%)!`, 'warning');
        }
    }
    renderCarrinho(); 
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
}

function pdvAtualizarTotais() { 
    const sub = cart.reduce((acc, i) => acc + (((i.preco || 0) * (i.qtd || 1)) - (i.desconto || 0)), 0); 
    let frete = parseInputMoney(document.getElementById('pdv-frete').value) || 0; 
    let desc = parseInputMoney(document.getElementById('pdv-desconto').value) || 0; 
    
    if(desc > (sub + frete)) desc = sub + frete; 
    const tot = sub + frete - desc; 
    
    document.getElementById('pdv-subtotal').innerText = formatMoney(sub); 
    document.getElementById('pdv-total').innerText = formatMoney(tot); 
    const mobBadge = document.getElementById('pdv-mobile-total-badge');
    if (mobBadge) mobBadge.innerText = formatMoney(tot);
    const mobBar = document.getElementById('pdv-mobile-quickbar');
    if (mobBar) {
        if (cart && cart.length > 0) mobBar.classList.remove('hidden');
        else mobBar.classList.add('hidden');
    } 
    const totalQtd = cart.reduce((a,b) => a + (Number(b.qtd) || 1), 0);
    const qtdFormatada = Math.abs(totalQtd - Math.round(totalQtd)) < 0.005 ? Math.round(totalQtd) : parseFloat(totalQtd.toFixed(3));
    const rotuloItens = qtdFormatada === 1 ? 'item' : 'itens';
    document.getElementById('pdv-qtd-itens').innerText = `${qtdFormatada} ${rotuloItens}`; 
    
    pdvTotalAtual = tot; 
    atualizarResumoPagamentosVenda(); 

    // Atualiza badge de lucro mínimo no cabeçalho do PDV
    const badgeMin = document.getElementById('pdv-badge-margem-min');
    if (badgeMin) badgeMin.innerText = obterMargemMinimaConfigurada() + '%';

    // Verificação de margem e alertas de lucro no PDV
    const margemMin = obterMargemMinimaConfigurada();
    let algumItemAbaixo = false;
    let piorItem = null;

    cart.forEach(it => {
        const subItem = Math.max(0, ((it.preco || 0) * (it.qtd || 1)) - (it.desconto || 0));
        const rateio = (sub > 0 && desc > 0) ? (subItem / sub) * desc : 0;
        const inf = calcularMargemLucroItem(it, rateio);
        if (margemMin > 0 && inf.temDesconto && inf.custoTotal > 0 && inf.perc < margemMin) {
            algumItemAbaixo = true;
            if (!piorItem || inf.perc < piorItem.perc) {
                piorItem = { nome: it.nome, perc: inf.perc, lucro: inf.lucro };
            }
        }
    });

    const alertaGlobalEl = document.getElementById('pdv-alerta-margem-global');
    const alertaGlobalMsg = document.getElementById('pdv-alerta-margem-msg');
    if (alertaGlobalEl) {
        if (cart.length > 0 && algumItemAbaixo) {
            alertaGlobalEl.classList.remove('hidden');
            if (alertaGlobalMsg && piorItem) {
                alertaGlobalMsg.innerHTML = `O desconto aplicado no item <strong>${piorItem.nome}</strong> ultrapassa o limite permitido.`;
            }
        } else {
            alertaGlobalEl.classList.add('hidden');
        }
    }

    return { sub, desc, frete, tot }; 
}

// ==========================================
// 11. MÚLTIPLOS PAGAMENTOS E FINALIZAÇÃO
// ==========================================
function verificarParcelasPagamento() { 
    const metodo = document.getElementById('pdv-metodo-atual').value; 
    const selParc = document.getElementById('pdv-parcelas-atual'); 
    const inpVenc = document.getElementById('pdv-vencimento-atual'); 
    const contDatas = document.getElementById('pdv-datas-parcelas');
    
    if(metodo === 'Cartão Crédito' || metodo === 'Boleto' || metodo === 'Fiado' || metodo === 'Cartão Débito') { 
        selParc.classList.remove('hidden'); 
    } else { 
        selParc.classList.add('hidden'); 
        selParc.value = '1'; 
    } 
    
    const parcelas = parseInt(selParc.value) || 1;
    
    if(metodo === 'Boleto' || metodo === 'Fiado' || metodo === 'Cartão Débito') { 
        inpVenc.classList.add('hidden'); 
        if (contDatas) {
            contDatas.classList.remove('hidden');
            renderizarInputsDatasParcelas(parcelas);
        }
    } else { 
        inpVenc.classList.add('hidden'); 
        inpVenc.value = ''; 
        if (contDatas) contDatas.classList.add('hidden');
    } 
}

function renderizarInputsDatasParcelas(qtd) {
    const contDatas = document.getElementById('pdv-datas-parcelas');
    if (!contDatas) return;
    
    let existingDates = [];
    for (let i = 1; i <= 12; i++) {
        const el = document.getElementById(`pdv-data-parc-${i}`);
        if (el && el.value) {
            existingDates.push(el.value);
        }
    }
    
    contDatas.innerHTML = '';
    
    const metodo = document.getElementById('pdv-metodo-atual').value;
    const prazoPadrao = (db.config && db.config.prazos && db.config.prazos[metodo] !== undefined) ? parseInt(db.config.prazos[metodo]) : 30;
    
    let baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + prazoPadrao);
    
    for (let i = 1; i <= qtd; i++) {
        let valDate = '';
        if (existingDates[i-1]) {
            valDate = existingDates[i-1];
        } else {
            let d = new Date(baseDate);
            if (i > 1 && existingDates[0]) {
                d = new Date(existingDates[0] + 'T12:00:00');
            }
            d.setDate(d.getDate() + (prazoPadrao * (i - 1)));
            valDate = d.toISOString().split('T')[0];
        }
        
        contDatas.innerHTML += `
        <div class="flex items-center gap-2">
            <span class="text-[10px] md:text-xs font-bold text-slate-500 w-12 md:w-16">Parc. ${i}</span>
            <input type="date" id="pdv-data-parc-${i}" value="${valDate}" 
                   class="flex-1 bg-amber-50 border border-amber-300 p-2 rounded-lg text-xs font-bold text-amber-800 outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-white" 
                   onchange="if(${i} === 1) recalcularDatasParcelas(${qtd})">
        </div>`;
    }
}

function recalcularDatasParcelas(qtd) {
    const dataPrimeiraEl = document.getElementById('pdv-data-parc-1');
    if (!dataPrimeiraEl || !dataPrimeiraEl.value) return;
    
    const metodo = document.getElementById('pdv-metodo-atual').value;
    const prazoPadrao = (db.config && db.config.prazos && db.config.prazos[metodo] !== undefined) ? parseInt(db.config.prazos[metodo]) : 30;
    
    const baseDate = new Date(dataPrimeiraEl.value + 'T12:00:00');
    
    for (let i = 2; i <= qtd; i++) {
        const el = document.getElementById(`pdv-data-parc-${i}`);
        if (el) {
            let d = new Date(baseDate);
            d.setDate(d.getDate() + (prazoPadrao * (i - 1)));
            el.value = d.toISOString().split('T')[0];
        }
    }
}

function atualizarResumoPagamentosVenda() {
    const opSelect = document.getElementById('pdv-operacao'); 
    const op = opSelect ? opSelect.value : 'Venda';
    const isOrcamento = op === 'Orçamento'; 
    const isServico = op === 'Serviço'; 
    const isVendaBalcao = op === 'VendaBalcao';
    const isLancarCaixa = (op === 'Venda' || isServico) && !isVendaBalcao;

    const avisoLancar = document.getElementById('pdv-aviso-lancar-caixa');
    if (avisoLancar) {
        if (isLancarCaixa) {
            avisoLancar.classList.remove('hidden');
        } else {
            avisoLancar.classList.add('hidden');
        }
    }

    const lista = document.getElementById('lista-pagamentos-adicionados'); 
    if(!lista) return;
    
    let totalVendaFinal = pdvTotalAtual; 
    lista.innerHTML = ''; 
    let totalPago = 0;
    
    if (pagamentosVendaAtual.length === 0) { 
        if (isOrcamento) {
            lista.innerHTML = '<div class="text-xs text-slate-400 text-center mt-4 italic">Orçamentos não exigem pagamentos prévios.</div>';
        } else if (isLancarCaixa) {
            lista.innerHTML = '<div class="text-xs text-slate-400 text-center mt-3 italic bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700"><i class="fa-solid fa-arrow-down mr-1 text-blue-500"></i>Clique no botão abaixo para lançar para o Caixa Físico. O pagamento será registrado lá.</div>';
        } else {
            lista.innerHTML = '<div class="text-xs text-slate-400 text-center mt-4 italic">Nenhum pagamento inserido.</div>';
        }
    } else { 
        pagamentosVendaAtual.forEach((pag, index) => { 
            totalPago += pag.valor; 
            let corMetodo = pag.metodo === 'Dinheiro' ? 'text-emerald-700' : 'text-blue-700'; 
            let txtParc = pag.parcelas > 1 ? `(${pag.parcelas}x)` : ''; 
            let txtVenc = (pag.metodo === 'Boleto' || pag.metodo === 'Fiado') && pag.vencimentoBase ? `<span class="text-[10px] text-amber-600 block">1º Venc: ${pag.vencimentoBase.split('-').reverse().join('/')}</span>` : ''; 
            
            lista.innerHTML += `
            <div class="flex justify-between items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-xs shadow-sm mb-2">
                <div>
                    <span class="font-bold uppercase ${corMetodo}"><i class="fa-solid fa-check mr-1"></i> ${pag.metodo} ${txtParc}</span>${txtVenc}
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-black text-slate-700 dark:text-slate-200">R$ ${pag.valor.toFixed(2).replace('.', ',')}</span>
                    <button onclick="removerPagamentoVenda('${index}')" class="text-red-400 hover:text-red-600 p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`; 
        }); 
    }
    
    totalVendaFinal = Math.round(totalVendaFinal * 100) / 100; 
    totalPago = Math.round(totalPago * 100) / 100; 
    
    let falta = totalVendaFinal - totalPago; 
    let troco = 0; 
    
    if (falta <= 0) { 
        troco = Math.abs(falta); 
        falta = 0; 
    }
    
    document.getElementById('pdv-falta').innerText = formatMoney(falta); 
    document.getElementById('pdv-troco').innerText = formatMoney(troco);
    
    const inputAtual = document.getElementById('pdv-valor-atual'); 
    if (inputAtual) { 
        inputAtual.value = falta > 0 ? falta.toFixed(2) : ''; 
    }
    
    const btnFinalizar = document.getElementById('btn-finalizar-venda');
    if (btnFinalizar) { 
        if (isOrcamento && totalVendaFinal > 0) { 
            btnFinalizar.disabled = false; 
            btnFinalizar.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-emerald-500', 'hover:bg-emerald-600'); 
            btnFinalizar.classList.add('active:scale-95', 'bg-blue-600', 'hover:bg-blue-700'); 
            btnFinalizar.innerHTML = window.vendaEmEdicao ? '<i class="fa-solid fa-file-invoice"></i> SALVAR ORÇAMENTO EDITADO' : '<i class="fa-solid fa-file-invoice"></i> GERAR ORÇAMENTO COMPLETO'; 
        } else if (isLancarCaixa && totalVendaFinal > 0) {
            btnFinalizar.disabled = false; 
            btnFinalizar.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-blue-600', 'hover:bg-blue-700'); 
            btnFinalizar.classList.add('active:scale-95', 'bg-emerald-600', 'hover:bg-emerald-700'); 
            btnFinalizar.innerHTML = window.vendaEmEdicao ? '<i class="fa-solid fa-paper-plane"></i> ATUALIZAR PEDIDO NO CAIXA' : (isServico ? '<i class="fa-solid fa-handshake"></i> LANÇAR SERVIÇO P/ O CAIXA' : '<i class="fa-solid fa-paper-plane"></i> LANÇAR VENDA P/ O CAIXA (F9)'); 
        } else if (isVendaBalcao && totalPago >= totalVendaFinal && totalVendaFinal > 0) { 
            btnFinalizar.disabled = false; 
            btnFinalizar.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-blue-600', 'hover:bg-blue-700'); 
            btnFinalizar.classList.add('active:scale-95', 'bg-emerald-600', 'hover:bg-emerald-700'); 
            btnFinalizar.innerHTML = window.vendaEmEdicao ? '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA EDITADA' : '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA NO BALCÃO'; 
        } else { 
            btnFinalizar.disabled = true; 
            btnFinalizar.classList.add('opacity-50', 'cursor-not-allowed'); 
            btnFinalizar.classList.remove('active:scale-95'); 
            if (!op) {
                btnFinalizar.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> SELECIONE A OPERAÇÃO';
            } else if (isOrcamento) {
                btnFinalizar.innerHTML = '<i class="fa-solid fa-file-invoice"></i> GERAR ORÇAMENTO COMPLETO';
            } else if (isVendaBalcao) {
                btnFinalizar.innerHTML = '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA NO BALCÃO';
            } else {
                btnFinalizar.innerHTML = '<i class="fa-solid fa-paper-plane"></i> LANÇAR VENDA P/ O CAIXA (F9)';
            }
            btnFinalizar.classList.remove('bg-blue-600', 'hover:bg-blue-700'); 
            btnFinalizar.classList.add('bg-emerald-500', 'hover:bg-emerald-600'); 
        } 
    }
}
function adicionarPagamentoVenda() { 
    const metodo = document.getElementById('pdv-metodo-atual').value || ''; 
    const inputValor = document.getElementById('pdv-valor-atual'); 
    const parcelas = parseInt(document.getElementById('pdv-parcelas-atual').value) || 1; 
    const valor = parseInputMoney(inputValor.value); 
    
    if (!valor || valor <= 0) return showToast("Digite um valor numérico válido para o pagamento.", "error"); 
    
    let vencimentosPersonalizados = [];
    if (metodo === 'Boleto' || metodo === 'Fiado' || metodo === 'Cartão Débito' || metodo === 'Cartão Crédito') {
        for (let i = 1; i <= parcelas; i++) {
            const el = document.getElementById(`pdv-data-parc-${i}`);
            if (el && el.value) {
                vencimentosPersonalizados.push(el.value);
            }
        }
    }
    
    let vencimentoBase = vencimentosPersonalizados.length > 0 ? vencimentosPersonalizados[0] : '';
    
    pagamentosVendaAtual.push({ metodo, valor, parcelas, vencimentoBase, vencimentosPersonalizados }); 
    atualizarResumoPagamentosVenda(); 
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
    inputValor.focus(); 
}

function removerPagamentoVenda(index) { 
    pagamentosVendaAtual.splice(index, 1); 
    atualizarResumoPagamentosVenda(); 
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
}

async function finalizarVendaMultipla() {
    const agora = Date.now();
    // === PROTECAO ANTI-VENDA DUPLICADA (Camada 1: flag de processamento com expiração automática) ===
    if (isProcessingVenda && (agora - _vendaLockTimestamp) < 6000) {
        showToast('Aguarde... A venda está sendo processada.', 'warning');
        return;
    }
    isProcessingVenda = true;
    _vendaLockTimestamp = agora;

    // Timeout de segurança absoluta: nunca deixa o PDV bloqueado por mais de 8s
    if (_vendaSafetyTimeout) clearTimeout(_vendaSafetyTimeout);
    _vendaSafetyTimeout = setTimeout(() => {
        if (isProcessingVenda) {
            console.warn('[PDV] Desbloqueio de segurança automático acionado.');
            liberarBotaoFinalizar();
        }
    }, 8000);

    try {
        // Gera chave de idempotencia unica para esta tentativa de venda
        const chaveIdempotencia = gerarIdempotencyKey();

        // Bloqueia o botao imediatamente com estado de loading
        const btnFinalizar = document.getElementById('btn-finalizar-venda');
        const textoOriginalBtn = btnFinalizar ? btnFinalizar.innerHTML : '';
        if (btnFinalizar) {
            btnFinalizar.disabled = true;
            btnFinalizar.classList.add('opacity-75', 'cursor-wait');
            btnFinalizar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aguarde...';
        }

        const op = document.getElementById('pdv-operacao') ? document.getElementById('pdv-operacao').value : '';
        if (!op) {
            liberarBotaoFinalizar();
            return showToast('Por favor, selecione o tipo de operação (Venda, Orçamento, Serviço ou Venda Balcão).', 'warning');
        }
    const isOrcamento = op === 'Orçamento'; 
    const isServico = op === 'Serviço';
    const isVendaBalcao = op === 'VendaBalcao';
    const isLancarCaixa = (op === 'Venda' || isServico) && !isVendaBalcao;
    
    // Validação de conformidade com o Fluxo Operacional do Plano SaaS / Configuração
    const fluxoPlano = (typeof window.SaaSLicenca !== 'undefined' && typeof window.SaaSLicenca.obterFluxoPDV === 'function')
        ? window.SaaSLicenca.obterFluxoPDV(window.saasLicencaAtual)
        : ((window.saasLicencaAtual && window.saasLicencaAtual.fluxoPDV) || 'ambos');
    const fluxoConfig = (window.db && window.db.config && window.db.config.fluxoPDV) || 'ambos';
    const fluxoEfetivo = (fluxoPlano === 'ambos') ? fluxoConfig : fluxoPlano;

    if (fluxoEfetivo === 'caixa' && isVendaBalcao) {
        liberarBotaoFinalizar();
        return showToast('O modelo operacional contratado ou configurado exige lançar as vendas para o Caixa Central.', 'warning');
    }
    if (fluxoEfetivo === 'direto' && isLancarCaixa && op === 'Venda') {
        liberarBotaoFinalizar();
        return showToast('O modelo operacional contratado ou configurado exige recebimento direto no PDV.', 'warning');
    }

    const user = window.currentUserInfo;
    const isAdmin = !user || !!user.isAdmin;

    if (!isAdmin && typeof window.checarPermissaoUsuario === 'function') {
        if (isLancarCaixa && !window.checarPermissaoUsuario(user, 'perm_pdv_lancar_caixa', 'perm_pdv')) {
            liberarBotaoFinalizar();
            return showToast('Você não tem permissão para lançar vendas para o Caixa. Solicite ao administrador.', 'error');
        }
        if (isVendaBalcao && !window.checarPermissaoUsuario(user, 'perm_pdv_venda_balcao', 'perm_pdv')) {
            liberarBotaoFinalizar();
            return showToast('Você não tem permissão para finalizar vendas no Balcão (PDV). Solicite ao administrador.', 'error');
        }
        if (isOrcamento && !window.checarPermissaoUsuario(user, 'perm_orcamentos', 'perm_pdv')) {
            liberarBotaoFinalizar();
            return showToast('Você não tem permissão para gerar orçamentos. Solicite ao administrador.', 'error');
        }
    }

    let tipoVenda = 'VENDA'; 
    if (isOrcamento) tipoVenda = 'ORÇAMENTO'; 
    if (isServico) tipoVenda = 'SERVIÇO';
    
    if(cart.length === 0) { liberarBotaoFinalizar(); return showToast('Nenhum item na operação!', 'error'); }

    // === VERIFICAÇÃO DE MARGEM MÍNIMA DE LUCRO / ALERTA DE DESCONTO ===
    const margemMinima = (typeof obterMargemMinimaConfigurada === 'function') ? obterMargemMinimaConfigurada() : 15;
    const acaoMargem = (typeof obterAcaoAlertaMargem === 'function') ? obterAcaoAlertaMargem() : 'alerta';
    let itensComLucroBaixo = [];
    
    if (margemMinima > 0 && !isOrcamento) {
        const subTot = cart.reduce((acc, it) => acc + (((it.preco || 0) * (it.qtd || 1)) - (it.desconto || 0)), 0);
        const descGlobal = (typeof parseInputMoney === 'function' && document.getElementById('pdv-desconto')) 
            ? (parseInputMoney(document.getElementById('pdv-desconto').value) || 0) 
            : 0;
        
        cart.forEach(it => {
            const subItem = Math.max(0, ((it.preco || 0) * (it.qtd || 1)) - (it.desconto || 0));
            const rateio = (subTot > 0 && descGlobal > 0) ? (subItem / subTot) * descGlobal : 0;
            const inf = calcularMargemLucroItem(it, rateio);
            if (inf.temDesconto && inf.custoTotal > 0 && inf.perc < margemMinima) {
                itensComLucroBaixo.push({ nome: it.nome, perc: inf.perc, custo: inf.custoUnit, lucro: inf.lucro });
            }
        });
    }

    if (itensComLucroBaixo.length > 0 && !window._margemBaixaAutorizada) {
        liberarBotaoFinalizar();
        if (acaoMargem === 'bloquear') {
            return showToast(`Finalização bloqueada! O item "${itensComLucroBaixo[0].nome}" ultrapassou o limite de desconto permitido. Ajuste o desconto para continuar.`, 'error');
        } else {
            const nomesItens = itensComLucroBaixo.map(x => `"${x.nome}"`).join(', ');
            abrirConfirmacao(
                'Atenção: Desconto Excessivo!',
                `O desconto aplicado no(s) produto(s) ${nomesItens} ultrapassa o limite permitido configurado no sistema. Deseja autorizar e concluir esta venda mesmo assim?`,
                function() {
                    window._margemBaixaAutorizada = true;
                    finalizarVendaMultipla();
                }
            );
            return;
        }
    }
    window._margemBaixaAutorizada = false;
    
    if (isVendaBalcao) { 
        if(pagamentosVendaAtual.length === 0) { liberarBotaoFinalizar(); return showToast('Insira ao menos um pagamento para venda com recebimento direto no balcão!', 'error');  }
        if(!db.caixa || db.caixa.status !== 'ABERTO') { 
            liberarBotaoFinalizar(); 
            const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : null;
            const opNome = (opAtual && opAtual.nome) ? 'de ' + opAtual.nome : 'do operador';
            return showToast('O seu Caixa (' + opNome + ') está FECHADO. Abra o caixa em Caixa Físico antes de vender direto.', 'error');  
        }
    }

    // === PROTECAO ANTI-VENDA DUPLICADA ===
    // Chave de idempotencia e flag local garantem unicidade sem travar com requisicao de rede blocking.


    const { sub, desc, frete, tot } = pdvAtualizarTotais(); 
    const custoTotal = cart.reduce((acc, i) => acc + ((i.custo || 0) * (i.qtd || 1)), 0);
    
    // Se o pedido é lançado p/ o Caixa e a lista de pagamentos está vazia (o vendedor não clicou em '+'),
    // captura automaticamente a condição que o vendedor selecionou na tela (Método, Parcelas, Vencimentos)
    if (isLancarCaixa && pagamentosVendaAtual.length === 0) {
        const metodoAtual = document.getElementById('pdv-metodo-atual') ? document.getElementById('pdv-metodo-atual').value : 'Dinheiro';
        const selParc = document.getElementById('pdv-parcelas-atual');
        const parcelasAtual = selParc ? (parseInt(selParc.value) || 1) : 1;
        let vencimentosPersonalizados = [];
        if (metodoAtual === 'Boleto' || metodoAtual === 'Fiado' || metodoAtual === 'Cartão Débito' || metodoAtual === 'Cartão Crédito') {
            for (let i = 1; i <= parcelasAtual; i++) {
                const el = document.getElementById(`pdv-data-parc-${i}`);
                if (el && el.value) {
                    vencimentosPersonalizados.push(el.value);
                }
            }
        }
        const vencBaseInput = document.getElementById('pdv-vencimento-atual');
        let vencimentoBase = vencimentosPersonalizados.length > 0 ? vencimentosPersonalizados[0] : (vencBaseInput && vencBaseInput.value ? vencBaseInput.value : '');

        pagamentosVendaAtual.push({
            metodo: metodoAtual,
            valor: tot,
            parcelas: parcelasAtual,
            vencimentoBase: vencimentoBase,
            vencimentosPersonalizados: vencimentosPersonalizados
        });
    }

    const condicaoVendedor = (pagamentosVendaAtual && pagamentosVendaAtual.length > 0) ? pagamentosVendaAtual[0] : null;

    let totalPago = pagamentosVendaAtual.reduce((acc, p) => acc + (p.valor || 0), 0); 
    let valorTroco = totalPago > tot ? (totalPago - tot) : 0;
    
    const pagTexto = isOrcamento && pagamentosVendaAtual.length === 0 ? 'Orçamento (Sem Pagamento Exigido)' : pagamentosVendaAtual.map(p => `${p.metodo || ''} ${(p.parcelas || 1) > 1 ? '('+p.parcelas+'x)' : ''} (${formatMoney(p.valor || 0)})`).join(' + ');
    
    let taxaValorTotal = 0;
    if (!isOrcamento) { 
        pagamentosVendaAtual.forEach(p => { 
            let tx = 0; 
            if (db.config && db.config.taxas) { 
                if (String(p.metodo).includes('Crédito')) { 
                    let pNum = p.parcelas > 12 ? 12 : p.parcelas; 
                    tx = (db.config.taxas['Cartão Crédito'] && db.config.taxas['Cartão Crédito'][pNum]) ? db.config.taxas['Cartão Crédito'][pNum] : 0; 
                } else { 
                    tx = db.config.taxas[p.metodo] || 0; 
                } 
            } 
            let valorBase = p.valor || 0; 
            if(p.metodo === 'Dinheiro' && valorTroco > 0) { 
                valorBase -= valorTroco; 
                if(valorBase < 0) valorBase = 0; 
            } 
            taxaValorTotal += valorBase * (tx / 100); 
        }); 
    }

    const valorLiquido = tot - taxaValorTotal; 
    const lucroReal = isOrcamento ? 0 : valorLiquido - custoTotal;
    
    const emp = obterDadosEmpresa();

    const cId = document.getElementById('pdv-cliente').value || '0'; 
    const cliInfo = obterDadosClientePDV(cId);
    
    const vend = document.getElementById('pdv-vendedor').value || ''; 
    const obsElement = document.getElementById('pdv-obs'); 
    const obsTexto = obsElement && obsElement.value ? obsElement.value.trim() : ''; 
    
    const isEdicao = window.vendaEmEdicao != null;
    const vendaId = isEdicao ? window.vendaEmEdicao.id : Date.now();

    const elDataVenda = document.getElementById('pdv-data');
    const dataEscolhida = elDataVenda && elDataVenda.value ? elDataVenda.value.trim() : '';
    const temDataEdicao = isEdicao && window.vendaEmEdicao && window.vendaEmEdicao.data && !(window.vendaEmEdicao.tipo === 'ORÇAMENTO' && tipoVenda !== 'ORÇAMENTO');

    let dataIso = new Date().toISOString();
    if (dataEscolhida) {
        if (temDataEdicao && window.vendaEmEdicao.data.startsWith(dataEscolhida)) {
            dataIso = window.vendaEmEdicao.data;
        } else {
            const partesData = dataEscolhida.split('-');
            if (partesData.length === 3) {
                const ano = parseInt(partesData[0], 10);
                const mes = parseInt(partesData[1], 10) - 1;
                const dia = parseInt(partesData[2], 10);
                const agora = new Date();
                const dFinal = new Date(ano, mes, dia, agora.getHours(), agora.getMinutes(), agora.getSeconds());
                dataIso = !isNaN(dFinal.getTime()) ? dFinal.toISOString() : new Date().toISOString();
            }
        }
    } else if (temDataEdicao) {
        dataIso = window.vendaEmEdicao.data;
    }
    
    let numeroPedido = 1;
    if (isEdicao && window.vendaEmEdicao && window.vendaEmEdicao.numeroPedido) {
        numeroPedido = window.vendaEmEdicao.numeroPedido;
    } else if (typeof window.obterProximoNumeroPedidoSeguro === 'function') {
        numeroPedido = await window.obterProximoNumeroPedidoSeguro();
    } else {
        numeroPedido = (db.vendas || []).reduce((max, v) => Math.max(max, Number(v.numeroPedido) || 0), 0) + 1;
    }
    const numPedStr = String(numeroPedido).padStart(4, '0');

    const osPrazo = document.getElementById('os-prazo') ? document.getElementById('os-prazo').value : '';
    const elDataEnt = document.getElementById('pdv-data-entrega');
    const dataEntregaInput = elDataEnt ? elDataEnt.value : '';
    const dataEntregaFinal = dataEntregaInput || osPrazo || '';
    const dataEntregaFormatadaRecibo = dataEntregaFinal ? (dataEntregaFinal.includes('-') ? dataEntregaFinal.split('-').reverse().join('/') : dataEntregaFinal) : ''; 
    const osGarantia = document.getElementById('os-garantia') ? document.getElementById('os-garantia').value : ''; 
    const osDesc = document.getElementById('os-desc') ? document.getElementById('os-desc').value.trim() : ''; 
    const osFotosParaSalvar = [...osFotosArray]; 
    
    const tituloRecibo = isOrcamento ? 'ORÇAMENTO - VÁLIDO POR 7 DIAS' : (isLancarCaixa ? 'COMANDA DE CONFERÊNCIA / PEDIDO P/ O CAIXA' : (isServico ? 'ORDEM DE PRESTAÇÃO DE SERVIÇO' : 'CUPOM NÃO FISCAL - SEM VALOR LEGAL'));
    
    let htmlRecibo = `
    <div style="font-family: Arial, sans-serif; color: #000; max-width: 800px; margin: 0 auto; padding: 10px;">
        <div style="border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; text-align: center;">
            ${emp.logoHtml}
            <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900;">${emp.nome}</h1>
            <p style="margin: 5px 0; font-size: 13px;">CNPJ: ${emp.cnpj}<br>${emp.end}<br>Tel: ${emp.tel} | Vend: ${vend}</p>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 900; border: 2px solid #000; display: inline-block; padding: 6px 15px; border-radius: 4px;">${tituloRecibo}</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-bottom: 20px; font-size: 13px;">
            <div>
                <strong>DADOS DO CLIENTE</strong><br>
                Nome: ${cliInfo.nome}<br>
                CPF/CNPJ: ${cliInfo.doc}<br>
                Telefone: ${cliInfo.tel}<br>
                Endereço: ${cliInfo.endCompleto}
            </div>
            <div style="text-align: right; border-left: 1px solid #ccc; padding-left: 15px;">
                <strong>DADOS DA OPERAÇÃO</strong><br>
                Nº: #${numPedStr}<br>
                Data Orig: ${dataIso ? new Date(dataIso).toLocaleString('pt-BR') : '-'}<br>

                ${dataEntregaFormatadaRecibo ? `Previsão Entrega: <strong>${dataEntregaFormatadaRecibo}</strong><br>` : ''}

                Op: VENDA PDV
            </div>
        </div>

        ${isServico ? `
        <div style="border: 1px solid #6b21a8; border-radius: 5px; padding: 12px; margin-bottom: 20px; font-size: 13px; background-color: #faf5ff;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #d8b4fe; padding-bottom: 5px; color: #6b21a8; text-transform: uppercase;">Dados da Ordem de Serviço</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 150px;"><strong>Previsão de Entrega:</strong> ${osPrazo ? osPrazo.split('-').reverse().join('/') : 'Não informada'}</div>
                <div style="flex: 1; min-width: 150px;"><strong>Garantia do Serviço:</strong> ${osGarantia || 'Não informada'}</div>
            </div>
            ${osDesc ? `<div><strong>Escopo / Defeito:</strong><br>${osDesc}</div>` : ''}
            ${osFotosParaSalvar.length > 0 ? `<div style="margin-top: 10px;"><strong>Fotos de Referência (Estado Inicial):</strong><br><div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;">${osFotosParaSalvar.map(f => `<img src="${f}" style="height: 120px; border-radius: 4px; border: 1px solid #d8b4fe;">`).join('')}</div></div>` : ''}
        </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #000;">
                    <th style="padding: 8px; text-align: left;">Descrição do Item</th>
                    <th style="padding: 8px; text-align: center;">Qtd</th>
                    <th style="padding: 8px; text-align: right;">V. Unit</th>
                    <th style="padding: 8px; text-align: center;">Desc.</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${cart.map(i => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${i.foto ? `<img src="${i.foto}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid #ccc; flex-shrink: 0;">` : ''}
                                <div>
                                    <strong>${i.nome || 'Produto/Serviço'}</strong>
                                    ${i.obsVenda ? `<br><span style="font-size: 11px; color: #475569; font-style: italic;">Obs: ${i.obsVenda}</span>` : ''}
                                </div>
                            </div>
                        </td>
                        <td style="padding: 8px; text-align: center;">${i.qtd || 1}</td>
                        <td style="padding: 8px; text-align: right;">${typeof formatMoney==='function'?formatMoney(i.preco || 0):(i.preco || 0)}</td>
                        <td style="padding: 8px; text-align: center; white-space: nowrap;">${(i.desconto && i.desconto > 0) ? '- '+(typeof formatMoney==='function'?formatMoney(i.desconto):i.desconto) : '-'}</td>
                        <td style="padding: 8px; text-align: right; font-weight: bold;">${formatMoney(((i.preco || 0) * (i.qtd || 1)) - (i.desconto || 0))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 20px; font-size: 13px;">
            <div style="flex: 1; min-width: 280px; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-right: 5px; margin-bottom: 5px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">${isOrcamento ? 'PREVISÃO DE PAGAMENTO' : (isLancarCaixa ? 'PREVISÃO DE PAGAMENTO (A RECEBER NO CAIXA)' : 'PAGAMENTOS REGISTRADOS')}</h3>
                ${pagTexto !== 'Orçamento (Sem Pagamento Exigido)' ? pagamentosVendaAtual.map(p => `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>▪ ${p.metodo} ${p.parcelas > 1 ? `(${p.parcelas}x)` : ''}</span> <strong>${formatMoney(p.valor)}</strong></div>`).join('') : '<p style="font-style: italic; color: #555;">Nenhum pagamento registrado no orçamento.</p>'}
                ${valorTroco > 0 && !isOrcamento ? `<div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #000;"><span>Troco Devolvido:</span> <strong style="color: red;">${formatMoney(valorTroco)}</strong></div>` : ''}
            </div>
            <div style="flex: 1; min-width: 280px; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-left: 5px; margin-bottom: 5px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">RESUMO DOS VALORES</h3>
                ${(function(){
                    const grossSub = cart.reduce((a, i) => a + ((i.preco || 0) * (i.qtd || 1)), 0);
                    const itemDesc = cart.reduce((a, i) => a + (i.desconto || 0), 0);
                    const totalDesc = desc + itemDesc;
                    return `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Subtotal:</span> <span>${formatMoney(grossSub)}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Taxas / Desloc (+):</span> <span>${formatMoney(frete)}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Descontos (-):</span> <span>-${formatMoney(totalDesc)}</span></div>
                    `;
                })()}
                <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #000; font-size: 16px; font-weight: bold;"><span>TOTAL GERAL:</span> <span>${formatMoney(tot)}</span></div>
            </div>
        </div>
        
        ${obsTexto ? `
        <div style="border: 1px solid #000; border-radius: 5px; padding: 12px; margin-bottom: 30px; font-size: 13px; background-color: #f8fafc;">
            <strong>Observações Gerais do Pedido:</strong><br>
            ${obsTexto}
        </div>
        ` : ''}

        <div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-size: 13px;">
            <div style="width: 40%;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">Assinatura do Cliente</div>
                <div style="font-size: 11px; margin-top: 3px; color: #475569;">${isOrcamento ? 'Reconheço o orçamento acima' : (isServico ? 'Aprovo a execução do serviço.' : 'Declaro ter recebido os itens acima.')}</div>
            </div>
            <div style="width: 40%;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">Assinatura da Empresa</div>
                <div style="font-size: 11px; margin-top: 3px; color: #475569; font-weight: bold;">${emp.nome}</div>
            </div>
        </div>
    </div>
    </div>
    `;

    const batch = firestore.batch();
    
    // Preparar Venda
    const vendaRef = isEdicao ? window.getEmpresaRef().collection('vendas').doc(String(vendaId)) : window.getEmpresaRef().collection('vendas').doc();
    const idFinalVenda = vendaRef.id;

    if (!isOrcamento) { 
        let prodsAlterados = false;
        cart.forEach(item => { 
            const p = (db.produtos || []).find(x => String(x.id) === String(item.id)); 
            if(p) { 
                const pRef = window.getEmpresaRef().collection('produtos').doc(String(p.id));
                batch.update(pRef, { estoque: firebase.firestore.FieldValue.increment(-Number(item.qtd || 1)) });
                
                // Abatimento de estoque local imediato no modo economia
                const qtdItemVendida = Number(item.qtd || 1);
                p.estoque = (Number(p.estoque) || 0) - qtdItemVendida;
                prodsAlterados = true;

                if (window.FCCache && typeof window.FCCache.enfileirarOperacao === 'function') {
                    window.FCCache.enfileirarOperacao('produtos', p.id, 'set', p);
                }

                const kardexRef = window.getEmpresaRef().collection('movimentacoes').doc();
                const kardexObj = {
                    id: kardexRef.id,
                    data: new Date().toISOString(),
                    ref: `${tipoVenda} #${numPedStr}`,
                    prodId: p.id,
                    prodNome: p.nome,
                    qtd: -qtdItemVendida,
                    tipo: tipoVenda
                };
                batch.set(kardexRef, kardexObj);

                if (window.FCCache && typeof window.FCCache.enfileirarOperacao === 'function') {
                    window.FCCache.enfileirarOperacao('movimentacoes', kardexObj.id, 'set', kardexObj);
                }
                if (Array.isArray(db.movimentacoes)) {
                    db.movimentacoes.unshift(kardexObj);
                }
            } 
        }); 
        if (prodsAlterados && window.FCCache && typeof window.FCCache.set === 'function') {
            window.FCCache.set('produtos', db.produtos);
        }
    }

    const itensLimpados = cart.map(i => {
        const p = (db.produtos || []).find(x => String(x.id) === String(i.id)) || {};
        return {
            id: i.id || '',
            nome: i.nome || '',
            preco: i.preco || 0,
            custo: i.custo || 0,
            qtd: i.qtd || 1,
            obsVenda: i.obsVenda || '',
              customizacao: i.customizacao || null,
            foto: i.foto || '',
            desconto: i.desconto || 0,
            ncm: p.ncm || i.ncm || '',
            cfop: p.cfop || i.cfop || '5102',
            csosn: p.csosn || i.csosn || '102',
            origem: p.origem || i.origem || '0',
            unidade: p.unidade || i.unidade || 'UN',
            cest: p.cest || i.cest || ''
        };
    });

    const statusFinalVenda = isOrcamento ? 'ORCAMENTO' : (isLancarCaixa ? 'AGUARDANDO_PAGAMENTO' : 'CONCLUIDA');
    const novaVendaObj = { 
        id: idFinalVenda,
        numeroPedido: numeroPedido, 
        data: dataIso, 
        clienteId: cId || '', 
        clienteNome: cliInfo.nome || '', 
        clienteDoc: cliInfo.doc || 'Não informado',
        clienteCpf: cliInfo.cpf || '',
        clienteCnpj: cliInfo.cnpj || '',
        clienteTel: cliInfo.tel || 'Não informado',
        clienteEnd: cliInfo.endCompleto || 'Não informado',
        clienteRua: cliInfo.rua || '',
        clienteNumero: cliInfo.numero || '',
        clienteBairro: cliInfo.bairro || '',
        clienteCidade: cliInfo.cidade || '',
        clienteUf: cliInfo.uf || '',
        clienteCep: cliInfo.cep || '',
        clienteIbge: cliInfo.ibge || '',
        cliente: cliInfo.raw ? { ...cliInfo.raw } : null,
        destinatario: cliInfo.raw ? {
            nome: cliInfo.nome,
            doc: cliInfo.doc,
            cpf: cliInfo.cpf,
            cnpj: cliInfo.cnpj,
            rua: cliInfo.rua,
            numero: cliInfo.numero,
            bairro: cliInfo.bairro,
            cidade: cliInfo.cidade,
            uf: cliInfo.uf,
            cep: cliInfo.cep,
            ibge: cliInfo.ibge
        } : null,
        subtotal: sub || 0, 
        frete: frete || 0, 
        desconto: desc || 0, 
        tot: tot || 0, 
        taxaValor: taxaValorTotal || 0, 
        valorLiquido: valorLiquido || 0, 
        custoTotal: custoTotal || 0, 
        condicaoPagamentoVendedor: condicaoVendedor ? JSON.parse(JSON.stringify(condicaoVendedor)) : null,
        pag: isLancarCaixa 
            ? (condicaoVendedor ? `Aguardando Pagamento no Caixa (${condicaoVendedor.metodo}${condicaoVendedor.parcelas > 1 ? ' ' + condicaoVendedor.parcelas + 'x' : ''})` : 'Aguardando Pagamento no Caixa') 
            : (pagTexto || ''), 
        pagamentos: pagamentosVendaAtual ? JSON.parse(JSON.stringify(pagamentosVendaAtual)) : [],
        vendedor: vend || '', 
        operador: (window.currentUserInfo && window.currentUserInfo.nome) || (window.currentUser && (window.currentUser.displayName || window.currentUser.email)) || 'Operador',
        operadorId: (window.currentUser && window.currentUser.uid) || '',
        caixaId: (typeof window.obterCaixaDocId === 'function') ? window.obterCaixaDocId() : 'caixa_atual',
        obs: obsTexto || '', 
        status: statusFinalVenda,
        origem: 'PDV',
        tipo: tipoVenda || 'VENDA',
        dataEntrega: dataEntregaFinal || '', 
        servicoDetalhes: isServico ? { prazo: dataEntregaFinal || osPrazo || '', garantia: osGarantia || '', desc: osDesc || '', fotos: osFotosParaSalvar || [] } : null, 
        itens: itensLimpados,
        idempotencyKey: chaveIdempotencia || null,
        estoqueBaixado: !isOrcamento
    };
    
    batch.set(vendaRef, novaVendaObj, { merge: true });

    const novosLancamentosFinanceiro = [];
    if (!isOrcamento && isVendaBalcao) {
        let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
        let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
        let cxSaldoNovo = cxAtual.saldo || 0;
        const opNomeVenda = (window.currentUserInfo && window.currentUserInfo.nome) || (window.currentUser && (window.currentUser.displayName || window.currentUser.email)) || 'Operador';
        
        pagamentosVendaAtual.forEach((p, idx) => {
            let valorParaCaixa = p.valor || 0; 
            if(p.metodo === 'Dinheiro' && valorTroco > 0) { 
                valorParaCaixa -= valorTroco; 
                if(valorParaCaixa < 0) valorParaCaixa = 0; 
            }
            
            if(valorParaCaixa > 0) {
                let pRef = `${tipoVenda} #${numPedStr} (${p.metodo || ''}${(p.parcelas || 1) > 1 ? ' '+p.parcelas+'x' : ''})`;
                let prazoMetodo = (db.config && db.config.prazos && db.config.prazos[p.metodo] !== undefined) ? parseInt(db.config.prazos[p.metodo]) : 30;
                
                if(p.metodo === 'Fiado' || p.metodo === 'Boleto') { 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    let dataBase = p.vencimentoBase ? new Date(p.vencimentoBase + 'T12:00:00') : new Date(dataIso); 
                    if(!p.vencimentoBase) dataBase.setDate(dataBase.getDate() + prazoMetodo); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        let dataVencParc = new Date(dataBase); 
                        if (p.vencimentosPersonalizados && p.vencimentosPersonalizados[i-1]) {
                            dataVencParc = new Date(p.vencimentosPersonalizados[i-1] + 'T12:00:00');
                        } else {
                            dataVencParc.setDate(dataVencParc.getDate() + (prazoMetodo * (i - 1))); 
                        }
                        
                        const finRef = window.getEmpresaRef().collection('financeiro').doc();
                        const finDados = { id: finRef.id, ref: `${pRef} [${i}/${p.parcelas || 1}]`, data: dataVencParc.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', origemVendaId: idFinalVenda };
                        batch.set(finRef, finDados);
                        novosLancamentosFinanceiro.push(finDados);
                    } 
                } else if (p.metodo && (String(p.metodo).includes('Crédito') || String(p.metodo).includes('Débito'))) { 
                    let prazoCartao = (db.config && db.config.prazos && db.config.prazos[p.metodo] !== undefined) ? parseInt(db.config.prazos[p.metodo]) : 30;
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        let dataVencParc = new Date(dataIso);
                        dataVencParc.setDate(dataVencParc.getDate() + (prazoCartao * i));
                        const finRef = window.getEmpresaRef().collection('financeiro').doc();
                        const finDados = { id: finRef.id, ref: `${pRef} [${i}/${p.parcelas || 1}]`, data: dataVencParc.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, origemVendaId: idFinalVenda };
                        batch.set(finRef, finDados);
                        novosLancamentosFinanceiro.push(finDados);
                    } 
                } else if (p.metodo === 'Dinheiro' || p.metodo === 'PIX') { 
                    const finRef = window.getEmpresaRef().collection('financeiro').doc();
                    const finDados = { id: finRef.id, ref: pRef, data: dataIso, pessoa: cliInfo.nome, wpp: '', valor: valorParaCaixa, status: 'PAGO', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, dataPagamento: dataIso, origemVendaId: idFinalVenda };
                    batch.set(finRef, finDados);
                    novosLancamentosFinanceiro.push(finDados);
                }

                let descMov = pRef;
                if (cliInfo.nome && cliInfo.nome !== 'Consumidor Final') {
                    descMov += ' - ' + cliInfo.nome;
                }

                if(p.metodo === 'Dinheiro') { 
                    cxSaldoNovo += valorParaCaixa; 
                    cxHistoricoNovo.unshift({ 
                        data: dataIso, 
                        tipo: 'ENTRADA', 
                        metodo: 'Dinheiro',
                        desc: descMov, 
                        valor: valorParaCaixa,
                        operador: opNomeVenda,
                        saldoApos: cxSaldoNovo
                    }); 
                } else {
                    cxHistoricoNovo.unshift({ 
                        data: dataIso, 
                        tipo: 'ENTRADA (' + (p.metodo || 'OUTROS') + ')', 
                        metodo: p.metodo,
                        desc: descMov, 
                        valor: valorParaCaixa,
                        operador: opNomeVenda,
                        saldoApos: cxSaldoNovo,
                        naoAfetaGaveta: true
                    }); 
                }
            }
        });
        
        const caixaRef = (typeof window.obterCaixaDocRef === 'function') 
            ? window.obterCaixaDocRef() 
            : window.getEmpresaRef().collection('caixa').doc('caixa_atual');
        
        // Garante que o documento 'caixa_atual' nunca ultrapasse o limite de 1MB mantendo os 50 registros mais recentes no resumo
        const historicoResumo = cxHistoricoNovo.slice(0, 50);
        const cxFinalData = { ...cxAtual, saldo: cxSaldoNovo, historico: historicoResumo };
        batch.set(caixaRef, cxFinalData, { merge: true });

        // Salva os lançamentos individuais na subcoleção permanente 'movimentacoes' do caixa
        pagamentosVendaAtual.forEach(p => {
            let valorMov = p.valor || 0;
            if (p.metodo === 'Dinheiro' && valorTroco > 0) valorMov = Math.max(0, valorMov - valorTroco);
            if (valorMov > 0) {
                const movRef = caixaRef.collection('movimentacoes').doc();
                batch.set(movRef, {
                    id: movRef.id,
                    data: dataIso,
                    tipo: p.metodo === 'Dinheiro' ? 'ENTRADA' : `ENTRADA (${p.metodo || 'OUTROS'})`,
                    metodo: p.metodo || 'Dinheiro',
                    desc: `${tipoVenda} #${numPedStr} - ${cliInfo.nome || 'Consumidor'}`,
                    valor: valorMov,
                    operador: opNomeVenda,
                    origemVendaId: idFinalVenda,
                    saldoApos: cxSaldoNovo
                });
            }
        });

        // Atualiza repositório e cache local do caixa imediatamente
        db.caixa = cxFinalData;
        if (typeof FCCache !== 'undefined' && typeof FCCache.set === 'function') {
            const cacheKey = (typeof window.obterCaixaDocId === 'function') ? 'fc_moveis_' + window.obterCaixaDocId() : 'fc_moveis_caixa';
            FCCache.set(cacheKey, cxFinalData);
            FCCache.set('caixa', cxFinalData);
            if (typeof window.FCCache.enfileirarOperacao === 'function') {
                window.FCCache.enfileirarOperacao('caixa', 'caixa_atual', 'set', cxFinalData);
            }
        }
    }

    // Registra imediatamente no repositório local preservando todas as vendas já existentes
    const vendasExistentes = (window.FCCache && window.FCCache.get('vendas')) || (window.db && window.db.vendas) || [];
    const mapaVendas = new Map();
    if (Array.isArray(vendasExistentes)) {
        vendasExistentes.forEach(v => { if (v && v.id) mapaVendas.set(String(v.id), v); });
    }
    mapaVendas.set(String(idFinalVenda), novaVendaObj);
    const listaCompletaVendas = Array.from(mapaVendas.values());
    listaCompletaVendas.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    if (typeof window.db !== 'undefined') {
        window.db.vendas = listaCompletaVendas;
    }
    if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function') {
        window.FCCache.set('vendas', listaCompletaVendas);
        if (typeof window.FCCache.enfileirarOperacao === 'function') {
            window.FCCache.enfileirarOperacao('vendas', idFinalVenda, 'set', novaVendaObj);
        }
    }

    // Persistência e enfileiramento das parcelas financeiras geradas pela venda
    if (novosLancamentosFinanceiro.length > 0) {
        if (typeof db !== 'undefined') {
            db.financeiro = [...(db.financeiro || []), ...novosLancamentosFinanceiro];
        }
        if (typeof window.FCCache !== 'undefined') {
            const finExistentes = window.FCCache.get('financeiro') || [];
            window.FCCache.set('financeiro', [...finExistentes, ...novosLancamentosFinanceiro]);
            if (typeof window.FCCache.enfileirarOperacao === 'function') {
                novosLancamentosFinanceiro.forEach(fItem => {
                    window.FCCache.enfileirarOperacao('financeiro', fItem.id, 'set', fItem);
                });
            }
        }
    }

    if (window.FCCache && typeof window.FCCache.isModoEconomia === 'function' && window.FCCache.isModoEconomia()) {
        console.log('[PDV] Venda registrada no repositório local (Modo Economia). Enfileirada para sincronização.');
        if (typeof showToast === 'function') {
            showToast('Venda registrada com sucesso! (Salva localmente. Clique em SINCRONIZAR quando desejar enviar à nuvem)', 'success');
        }
    } else {
        try {
            const commitPromise = batch.commit();
            const commitTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout batch.commit Firestore')), 4000));
            await Promise.race([commitPromise, commitTimeout]);
            if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.removerDaFila === 'function') {
                window.FCCache.removerDaFila('vendas', idFinalVenda);
                novosLancamentosFinanceiro.forEach(fItem => {
                    window.FCCache.removerDaFila('financeiro', fItem.id);
                });
            }
        } catch(err) {
            console.warn('Aviso: Operacao salva no repositorio local (pendente de sincronizacao com Firebase):', err);
            if (typeof showToast === 'function') {
                showToast('Operacao salva no dispositivo! Sera sincronizada assim que voce clicar em SINCRONIZAR.', 'info');
            }
        }
    }
        window.vendaEmEdicao = null;
    window.vendaAtualImpressao = novaVendaObj;
    
    document.getElementById('print-area').innerHTML = htmlRecibo; 
    document.getElementById('modal-opcoes-recibo').classList.remove('hidden'); 
    
    // Configura container de emissão fiscal e botões do comprovante
    const fContainer = document.getElementById('fiscal-container');
    const btnContrato = document.getElementById('btn-recibo-contrato');
    const mHeader = document.getElementById('modal-recibo-header');
    const mIcone = document.getElementById('modal-recibo-icone');
    const mTitulo = document.getElementById('modal-recibo-titulo');
    const mSub = document.getElementById('modal-recibo-subtitulo');
    const txtBobina = document.getElementById('txt-recibo-bobina');
    const btnBobina = document.getElementById('btn-recibo-bobina');
    const btnA4 = document.getElementById('btn-recibo-a4');
    const btnPdf = document.getElementById('btn-recibo-pdf');

    if (isLancarCaixa) {
        // Quando é para ir no caixa, só quer o pedidinho!
        if (fContainer) fContainer.classList.add('hidden');
        if (btnContrato) btnContrato.classList.add('hidden');

        if (mHeader) mHeader.className = "bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white text-center shrink-0";
        if (mIcone) mIcone.className = "fa-solid fa-cash-register text-4xl mb-1";
        if (mTitulo) mTitulo.textContent = `Pedido #${numPedStr} Enviado ao Caixa`;
        if (mSub) {
            mSub.textContent = "Apresente a comanda / pedidinho no caixa para pagamento";
            mSub.classList.remove('hidden');
        }

        if (txtBobina) txtBobina.textContent = "Imprimir Pedidinho (Bobina)";
        if (btnBobina) {
            btnBobina.className = "col-span-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-600/30 transition-all";
        }
        if (btnA4) {
            btnA4.className = "col-span-1 w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs";
        }
        if (btnPdf) {
            btnPdf.className = "col-span-1 w-full bg-slate-700 hover:bg-slate-800 text-white p-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs";
        }

        // Auto-print do pedidinho (bobina) imediato
        try {
            printAction('thermal');
        } catch(e) {
            console.warn('Auto print pedidinho:', e);
        }
    } else {
        if (btnContrato) btnContrato.classList.remove('hidden');
        if (mHeader) mHeader.className = "bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white text-center shrink-0 shadow-sm";
        if (mIcone) mIcone.className = "fa-solid fa-circle-check text-4xl mb-1";
        if (mTitulo) mTitulo.textContent = isOrcamento ? "Orçamento Gerado" : "Documento Gerado";
        if (mSub) mSub.classList.add('hidden');

        if (txtBobina) txtBobina.textContent = "Recibo Bobina";
        if (btnBobina) {
            btnBobina.className = "btn-recibo-bobina w-full p-2.5 md:p-3 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all text-xs active:scale-95 cursor-pointer";
        }
        if (btnA4) {
            btnA4.className = "w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 md:p-3 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all text-xs active:scale-95 cursor-pointer shadow-sm shadow-blue-600/20";
        }
        if (btnPdf) {
            btnPdf.className = "w-full bg-red-600 hover:bg-red-700 text-white p-2.5 md:p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs";
        }

        if (fContainer) {
            if (!isOrcamento && db.config?.empresa?.fiscalAtivo !== false) {
                fContainer.classList.remove('hidden');
                const fStatus = document.getElementById('fiscal-status-container');
                if (fStatus) { fStatus.classList.add('hidden'); fStatus.innerHTML = ''; }
                const podeNfce = (typeof window.temPermissaoNotaFiscal === 'function') ? window.temPermissaoNotaFiscal('nfce') : true;
                const podeNfe = (typeof window.temPermissaoNotaFiscal === 'function') ? window.temPermissaoNotaFiscal('nfe') : true;
                const podeNfse = (typeof window.temPermissaoNotaFiscal === 'function') ? window.temPermissaoNotaFiscal('nfse') : true;

                const bNfce = document.getElementById('btn-emitir-nfce'); 
                if (bNfce) { bNfce.disabled = false; bNfce.style.display = podeNfce ? '' : 'none'; }
                const bNfe = document.getElementById('btn-emitir-nfe'); 
                if (bNfe) { bNfe.disabled = false; bNfe.style.display = podeNfe ? '' : 'none'; }
                const empIdAtivo = window.currentEmpresaId || localStorage.getItem('fc_empresa_ativa') || '';
                const isFc = (empIdAtivo === 'emp_fc_moveis' || !empIdAtivo || String(db.config?.empresa?.cnpj || '').includes('37638679'));
                const nfseHabilitada = podeNfse && (db.config?.empresa?.habilitarNFSe !== undefined ? Boolean(db.config?.empresa?.habilitarNFSe) : isFc);
                const bNfse = document.getElementById('btn-emitir-nfse');
                if (bNfse) {
                    bNfse.disabled = false;
                    bNfse.style.display = nfseHabilitada ? '' : 'none';
                }
            } else {
                fContainer.classList.add('hidden');
            }
        }
    } 
    
    // Configurar campos do lembrete de pós-venda na agenda
    const inputLembreteData = document.getElementById('pdv-lembrete-data');
    if (inputLembreteData) {
        const hojeStr = new Date().toISOString().split('T')[0];
        inputLembreteData.value = dataEntregaFinal || hojeStr;
    }
    const inputLembreteHora = document.getElementById('pdv-lembrete-hora');
    if (inputLembreteHora) inputLembreteHora.value = '';
    const inputLembreteObs = document.getElementById('pdv-lembrete-obs');
    if (inputLembreteObs) inputLembreteObs.value = '';
    const radioEntrega = document.querySelector('input[name="pdv-lembrete-tipo"][value="ENTREGA"]');
    if (radioEntrega) radioEntrega.checked = true;
    const badgeStatus = document.getElementById('badge-lembrete-status');
    if (badgeStatus) badgeStatus.classList.add('hidden');
    const btnSalvarLembrete = document.getElementById('btn-salvar-lembrete-pdv');
    if (btnSalvarLembrete) {
        btnSalvarLembrete.disabled = false;
        btnSalvarLembrete.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Salvar Lembrete na Agenda';
        btnSalvarLembrete.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
        btnSalvarLembrete.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }

    pdvLimpar(); 
    showToast(isOrcamento ? "Orçamento completo gerado com sucesso!" : (isLancarCaixa ? ("Pedido #" + numPedStr + " lançado para o Caixa com sucesso!") : "Venda registrada com sucesso!"), "success");
    } catch (errGeral) {
        console.error('[PDV] Erro crítico ao finalizar venda:', errGeral);
        showToast('Erro ao processar venda: ' + (errGeral.message || 'Tente novamente'), 'error');
    } finally {
        liberarBotaoFinalizar();
    }
}

async function salvarLembretePDV() {
    const dataStr = document.getElementById('pdv-lembrete-data')?.value;
    if (!dataStr) {
        return showToast("Selecione a data para o lembrete.", "warning");
    }

    const tipoEl = document.querySelector('input[name="pdv-lembrete-tipo"]:checked');
    const tipo = tipoEl ? tipoEl.value : 'ENTREGA';
    const horaStr = document.getElementById('pdv-lembrete-hora')?.value || '';
    const obsLembrete = document.getElementById('pdv-lembrete-obs')?.value.trim() || '';

    const venda = window.vendaAtualImpressao || {};
    const numPedStr = venda.numeroPedido ? String(venda.numeroPedido).padStart(4, '0') : '';
    const clienteNome = venda.clienteNome || 'Cliente';
    const clienteTel = venda.clienteTel || '';
    const clienteEnd = venda.clienteEnd || '';
    const totalFormatado = formatMoney(venda.tot || 0);

    const tipoLabel = tipo === 'ENTREGA' ? 'Entrega' : 'Cobrança';
    const cor = tipo === 'ENTREGA' ? '#10b981' : '#f59e0b';

    let titulo = `[${tipoLabel.toUpperCase()}] Pedido #${numPedStr || '-'} - ${clienteNome}`;
    
    let inicio = dataStr;
    let diaInteiro = true;
    if (horaStr) {
        inicio = `${dataStr}T${horaStr}:00`;
        diaInteiro = false;
    }

    let descricao = `Lembrete de ${tipoLabel}:\n`;
    descricao += `• Pedido: #${numPedStr || '-'}\n`;
    descricao += `• Cliente: ${clienteNome}\n`;
    if (clienteTel && clienteTel !== 'Não informado') descricao += `• Telefone: ${clienteTel}\n`;
    if (clienteEnd && clienteEnd !== 'Não informado') descricao += `• Endereço: ${clienteEnd}\n`;
    descricao += `• Valor Total: ${totalFormatado}\n`;
    if (venda.pag) descricao += `• Pagamento: ${venda.pag}\n`;
    if (obsLembrete) descricao += `• Detalhes/Obs: ${obsLembrete}\n`;

    const newId = 'lembrete_' + Date.now();
    const eventoData = {
        titulo: titulo,
        inicio: inicio,
        diaInteiro: diaInteiro,
        descricao: descricao,
        cor: cor,
        tipoLembrete: tipo,
        vendaId: venda.id || '',
        numeroPedido: numPedStr,
        clienteNome: clienteNome,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    const btnSalvar = document.getElementById('btn-salvar-lembrete-pdv');
    const badge = document.getElementById('badge-lembrete-status');
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agendando...';
    }

    try {
        await window.getEmpresaRef().collection('configuracoes').doc('config').set({
            agenda_eventos: {
                [newId]: eventoData
            }
        }, { merge: true });

        showToast(`Lembrete de ${tipoLabel} agendado na Agenda!`, "success");

        if (btnSalvar) {
            btnSalvar.innerHTML = '<i class="fa-solid fa-circle-check"></i> Agendado com Sucesso!';
            btnSalvar.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            btnSalvar.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
        }
        if (badge) {
            badge.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Erro ao salvar lembrete:", err);
        showToast("Erro ao agendar lembrete: " + err.message, "error");
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Tentar Novamente';
        }
    }
}

function fecharModalOpcoesRecibo() { 
    document.getElementById('modal-opcoes-recibo').classList.add('hidden'); 
    document.getElementById('fiscal-status-container').classList.add('hidden');
    document.getElementById('fiscal-status-container').innerHTML = '';
    // Garante PDV 100% resetado e pronto para o próximo cliente
    pdvLimpar();
    const buscaProd = document.getElementById('pdv-produto-busca');
    if (buscaProd) buscaProd.focus();
}



async function emitirNota(tipo) {
    if (typeof window.temPermissaoNotaFiscal === 'function' && !window.temPermissaoNotaFiscal(tipo)) {
        return showToast(`Seu plano atual não possui permissão para emitir ${String(tipo || '').toUpperCase()}. Fale com o suporte!`, "warning");
    }
    if(!window.vendaAtualImpressao || !window.vendaAtualImpressao.id) {
        return showToast("Erro: Venda não identificada.", "error");
    }
    
    const btnNfce = document.getElementById('btn-emitir-nfce');
    const btnNfe = document.getElementById('btn-emitir-nfe');
    const btnNfse = document.getElementById('btn-emitir-nfse');
    const statusContainer = document.getElementById('fiscal-status-container');
    
    if (tipo === 'nfse') {
        const vId = window.vendaAtualImpressao.id;
        showToast('Abrindo Módulo Fiscal para emissão da NFS-e...', 'info');
        setTimeout(() => {
            window.location.href = `fiscal.html?nfse_venda=${encodeURIComponent(vId)}`;
        }, 400);
        return;
    }

    if (btnNfce) btnNfce.disabled = true;
    if (btnNfe) btnNfe.disabled = true;
    if (btnNfse) btnNfse.disabled = true;
    if (statusContainer) {
        statusContainer.classList.remove('hidden');
        statusContainer.classList.remove('border-red-500', 'bg-red-50', 'border-emerald-500', 'bg-emerald-50', 'border-amber-500', 'bg-amber-50');
        statusContainer.classList.add('border-blue-500', 'bg-blue-50');
        statusContainer.innerHTML = `<p class="text-blue-700 font-bold animate-pulse text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Transmitindo ${tipo === 'nfce' ? 'NFC-e' : 'NF-e'} à SEFAZ... aguarde.</p>`;
    }

    try {
        const empIdAtual = window.currentEmpresaId || localStorage.getItem('fc_empresa_ativa') || '';
        
        // Garante persistência da venda no Firestore antes de acionar a SEFAZ
        if (window.vendaAtualImpressao && window.vendaAtualImpressao.id) {
            try {
                const empRef = (typeof window.getEmpresaRef === 'function') ? window.getEmpresaRef() : firestore.collection('empresas').doc(empIdAtual || 'emp_fc_moveis');
                await empRef.collection('vendas').doc(String(window.vendaAtualImpressao.id)).set(window.vendaAtualImpressao, { merge: true });
                if (window.FCCache && typeof window.FCCache.removerDaFila === 'function') {
                    window.FCCache.removerDaFila('vendas', window.vendaAtualImpressao.id);
                }
            } catch (syncErr) {
                console.warn('[Venda/Fiscal] Aviso ao sincronizar venda antes da emissão SEFAZ:', syncErr);
            }
        }

        const emitirFunc = firebase.functions().httpsCallable(tipo === 'nfce' ? 'emitirNFCe' : 'emitirNFe');
        const response = await emitirFunc({ 
            vendaId: window.vendaAtualImpressao.id,
            empId: empIdAtual,
            vendaDados: window.vendaAtualImpressao
        });
        const res = response.data;
        const d = res.data || {};
        
        if (window.vendaAtualImpressao) {
            window.vendaAtualImpressao[tipo === 'nfce' ? 'nfce' : 'nfe'] = d;
            window.vendaAtualImpressao.status_fiscal = d.status_sefaz;
            if (d.chave_nfe || d.chave_nfce) window.vendaAtualImpressao.fiscal_chave = d.chave_nfe || d.chave_nfce;
            if (d.xml_conteudo) window.vendaAtualImpressao.fiscal_xml = d.xml_conteudo;
            if (d.qr_code_url) window.vendaAtualImpressao.fiscal_qrcode_url = d.qr_code_url;
        }

        if (statusContainer) {
            statusContainer.classList.remove('border-blue-500', 'bg-blue-50');
            statusContainer.classList.add('border-emerald-500', 'bg-emerald-50');
            
            const linkDanfe = d.danfe_url_completa || '';
            const linkXml = d.xml_url_completa || '';
            const numNota = d.numero ? ` Nº ${d.numero}` : '';
            const statusTexto = (d.status_sefaz || 'autorizado').toUpperCase();
            const vendaId = window.vendaAtualImpressao ? (window.vendaAtualImpressao.id || '') : '';
            const isSefazDireto = true;

            let botoesFiscais = '';
            if (linkDanfe) {
                botoesFiscais += `<a href="${linkDanfe}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs inline-flex items-center gap-1 shadow-sm transition-colors"><i class="fa-solid fa-print"></i> Imprimir DANFE</a>`;
            } else if (isSefazDireto) {
                botoesFiscais += `<button type="button" onclick="imprimirDanfeNativo('${vendaId}', '${tipo}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"><i class="fa-solid fa-print"></i> Imprimir DANFE</button>`;
            }

            if (linkXml) {
                botoesFiscais += `<a href="${linkXml}" target="_blank" download class="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold text-xs inline-flex items-center gap-1 shadow-sm transition-colors"><i class="fa-solid fa-download"></i> Baixar XML</a>`;
            } else if (isSefazDireto) {
                botoesFiscais += `<button type="button" onclick="baixarXmlNativo('${vendaId}', '${tipo}')" class="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold text-xs inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"><i class="fa-solid fa-download"></i> Baixar XML</button>`;
            }
            
            statusContainer.innerHTML = `
                <div class="text-center">
                    <p class="text-emerald-700 font-bold text-xs mb-1.5"><i class="fa-solid fa-circle-check mr-1"></i> ${tipo.toUpperCase()}${numNota} (${statusTexto})</p>
                    <div class="flex flex-wrap items-center justify-center gap-2 mt-2">
                        ${botoesFiscais}
                    </div>
                </div>
            `;
        }
        showToast(`${tipo.toUpperCase()} emitida com sucesso!`, "success");

    } catch (error) {
        console.error("Erro na emissão fiscal:", error);
        if (statusContainer) {
            statusContainer.classList.remove('border-blue-500', 'bg-blue-50');
            statusContainer.classList.add('border-red-500', 'bg-red-50');
            
            let errorMsg = error.message;
            try {
                const parsed = JSON.parse(errorMsg);
                if(parsed.erros && parsed.erros.length > 0) {
                    errorMsg = parsed.erros[0].mensagem || parsed.erros[0].codigo;
                } else if (parsed.mensagem_sefaz) {
                    errorMsg = parsed.mensagem_sefaz;
                }
            } catch (e) {}
            
            statusContainer.innerHTML = `<p class="text-red-700 font-bold text-xs text-left"><i class="fa-solid fa-circle-exclamation mr-1"></i> Falha na SEFAZ: ${errorMsg}</p>`;
        }
        
        if (btnNfce) btnNfce.disabled = false;
        if (btnNfe) btnNfe.disabled = false;
    }
}

// ==========================================
// 12. HISTÓRICO VENDAS E ORÇAMENTOS
// ==========================================
function renderVendas() {
    const tabelaBody = document.getElementById('tabela-vendas-body');
    if (!tabelaBody) return;

    const buscaEl = document.getElementById('busca-vendas'); 
    const dataIniEl = document.getElementById('filtro-vendas-ini'); 
    const dataFimEl = document.getElementById('filtro-vendas-fim'); 
    const pgtoEl = document.getElementById('filtro-vendas-pgto'); 
    const tipoEl = document.getElementById('filtro-vendas-tipo');
    
    const termo = buscaEl && buscaEl.value ? String(buscaEl.value).toLowerCase().trim() : ''; 
    const dataIni = dataIniEl ? dataIniEl.value : ''; 
    const dataFim = dataFimEl ? dataFimEl.value : ''; 
    const pgto = pgtoEl ? pgtoEl.value : 'TODOS'; 
    const tipoFiltro = tipoEl ? tipoEl.value : 'TODOS';
    
    let filtrados = db.vendas || [];
    filtrados = filtrados.filter(v => v.tipo !== 'ORÇAMENTO');
    
    if (tipoFiltro === 'VENDAS') filtrados = filtrados.filter(v => v.tipo === 'VENDA' || !v.tipo);
    if (tipoFiltro === 'SERVIÇOS') filtrados = filtrados.filter(v => v.tipo === 'SERVIÇO');
    if (termo) filtrados = filtrados.filter(v => (v.clienteNome && String(v.clienteNome).toLowerCase().includes(termo)) || (v.numeroPedido && String(v.numeroPedido).includes(termo)) || (v.vendedor && String(v.vendedor).toLowerCase().includes(termo)));
    if (pgto !== 'TODOS') filtrados = filtrados.filter(v => v.pag && String(v.pag).includes(pgto));
    if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() >= dIni); }
    if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() <= dFim); }
    
    filtrados.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));

    let totalLucro = 0;
    
    document.getElementById('tabela-vendas-body').innerHTML = filtrados.map(v => {
        try {
            const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0'); 
            
            const dataRender = v.data && typeof formatData === 'function' ? formatData(v.data).replace(',', '') : (v.data || '-'); 
            const clienteRender = v.clienteNome || 'Desconhecido'; 
            const vendRender = v.vendedor || '-'; 
            const pagRender = v.pag || '-';
            
            const badgeTipo = v.tipo === 'SERVIÇO' ? `<span class="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1 whitespace-nowrap">SERVIÇO</span><br>` : `<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1 whitespace-nowrap">VENDA</span><br>`;
            
            return `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                <td class="p-3 text-slate-500 dark:text-slate-400 text-xs">${dataRender}</td>
                <td class="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">${badgeTipo}#${numPedStr}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${clienteRender}${(v.dataEntrega || (v.servicoDetalhes && v.servicoDetalhes.prazo)) ? `<br><span class="text-[10px] text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1 mt-0.5"><i class="fa-solid fa-truck text-[9px]"></i> Entrega: ${(v.dataEntrega || v.servicoDetalhes.prazo).includes('-') ? (v.dataEntrega || v.servicoDetalhes.prazo).split('-').reverse().join('/') : (v.dataEntrega || v.servicoDetalhes.prazo)}</span>` : ''} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
                <td class="p-3"><span class="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">${pagRender}</span></td>
                <td class="p-3 text-right font-black text-slate-700 dark:text-slate-200">${typeof formatMoney === 'function' ? formatMoney(v.tot || 0) : (v.tot || 0)}</td>
                <td class="p-3 text-center flex flex-wrap justify-center gap-1 print:hidden">
                    <button onclick="verDetalhesVenda('${v.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:bg-blue-900/30 bg-blue-50 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="reimprimirVenda('${v.id}')" class="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Imprimir/PDF"><i class="fa-solid fa-print"></i></button>
                    <button onclick="enviarPDFWhatsApp('${v.id}')" class="text-emerald-500 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Enviar PDF no WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                    <button onclick="editarVenda('${v.id}')" class="text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Editar / Reabrir no PDV"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirVenda('${v.id}')" class="text-red-500 hover:text-red-800 bg-red-50 dark:bg-red-900/30 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        } catch (e) { console.error(e); return ''; }
    }).join('') || '<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum registro encontrado com os filtros atuais.</td></tr>';
}

function renderOrcamentos() {
    const tabelaBody = document.getElementById('tabela-orcamentos-body');
    if (!tabelaBody) return;

    const buscaEl = document.getElementById('busca-orcamentos'); 
    const dataIniEl = document.getElementById('filtro-orcamentos-ini'); 
    const dataFimEl = document.getElementById('filtro-orcamentos-fim');
    
    const termo = buscaEl && buscaEl.value ? String(buscaEl.value).toLowerCase().trim() : ''; 
    const dataIni = dataIniEl ? dataIniEl.value : ''; 
    const dataFim = dataFimEl ? dataFimEl.value : ''; 
    
    let filtrados = db.vendas || []; 
    // Exibe orçamentos e também vendas lançadas aguardando pagamento no caixa
    filtrados = filtrados.filter(v => (v.tipo === 'ORÇAMENTO' || v.tipo === 'ORCAMENTO' || v.status === 'AGUARDANDO_PAGAMENTO'));
    
    if (termo) filtrados = filtrados.filter(v => (v.clienteNome && String(v.clienteNome).toLowerCase().includes(termo)) || (v.numeroPedido && String(v.numeroPedido).includes(termo)) || (v.vendedor && String(v.vendedor).toLowerCase().includes(termo)));
    if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() >= dIni); }
    if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() <= dFim); }
    
    if (termo) {
        if (typeof ordenarListaAlfabeticamente === 'function') {
            filtrados = ordenarListaAlfabeticamente(filtrados, v => v.clienteNome || '');
        } else {
            filtrados.sort((a, b) => (a.clienteNome || '').localeCompare(b.clienteNome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
        }
    } else {
        filtrados.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));
    }

    let totalOrcamentos = 0;
    
    document.getElementById('tabela-orcamentos-body').innerHTML = filtrados.map(v => {
        try {
            const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0'); 
            totalOrcamentos += (Number(v.tot) || 0);
            
            const dataRender = v.data && typeof formatData === 'function' ? formatData(v.data).replace(',', '') : (v.data || '-'); 
            const clienteRender = v.clienteNome || 'Desconhecido'; 
            const vendRender = v.vendedor || '-'; 
            const qtdItens = v.itens ? v.itens.reduce((acc, i) => acc + (i.qtd||1), 0) : 0;
            
            const badgeStatus = v.status === 'AGUARDANDO_PAGAMENTO'
                ? '<span class="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><i class="fa-solid fa-clock"></i> No Caixa</span>'
                : '<span class="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><i class="fa-solid fa-file-invoice"></i> Orçamento</span>';

            return `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                <td class="p-3 text-slate-500 dark:text-slate-400 text-xs">${dataRender}</td>
                <td class="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">#${numPedStr}<br>${badgeStatus}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${clienteRender}${(v.dataEntrega || (v.servicoDetalhes && v.servicoDetalhes.prazo)) ? `<br><span class="text-[10px] text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1 mt-0.5"><i class="fa-solid fa-truck text-[9px]"></i> Entrega: ${(v.dataEntrega || v.servicoDetalhes.prazo).includes('-') ? (v.dataEntrega || v.servicoDetalhes.prazo).split('-').reverse().join('/') : (v.dataEntrega || v.servicoDetalhes.prazo)}</span>` : ''} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
                <td class="p-3 text-center"><span class="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold">${qtdItens} itens</span></td>
                <td class="p-3 text-right font-black text-slate-700 dark:text-slate-200">${typeof formatMoney === 'function' ? formatMoney(v.tot || 0) : (v.tot || 0)}</td>
                <td class="p-3 text-center flex flex-wrap justify-center gap-1 print:hidden">
                    <button onclick="verDetalhesVenda('${v.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="reimprimirVenda('${v.id}')" class="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:bg-slate-700 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Imprimir/PDF"><i class="fa-solid fa-print"></i></button>
                    <button onclick="enviarPDFWhatsApp('${v.id}')" class="text-emerald-500 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Enviar PDF no WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                    <button onclick="editarVenda('${v.id}')" class="text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Editar / Carregar PDV"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirVenda('${v.id}')" class="text-red-500 hover:text-red-800 bg-red-50 dark:bg-red-900/30 px-2 py-1.5 rounded font-bold text-xs transition-colors" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        } catch (e) { console.error(e); return ''; }
    }).join('') || '<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum orçamento encontrado com os filtros atuais.</td></tr>';
    
    if (document.getElementById('orcamentos-total-filtros')) {
        document.getElementById('orcamentos-total-filtros').innerText = `Valor Total em Orçamentos: ${typeof formatMoney === 'function' ? formatMoney(totalOrcamentos) : totalOrcamentos}`;
    }
}

function verDetalhesVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    const isGestao = window.location.href.includes('gestao');
    
    const subtitleEl = document.querySelector('#modal-detalhes-venda p.text-slate-400.uppercase');
    if (subtitleEl) {
        subtitleEl.innerText = isGestao ? 'Vis\u00e3o Gerencial de Custos e Lucros' : 'Vis\u00e3o Detalhada';
    }
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    let tipoTexto = v.tipo || 'VENDA';
    
    document.getElementById('det-venda-cliente').innerText = v.clienteNome || 'Desconhecido'; 
    document.getElementById('det-venda-data').innerText = `${v.data ? formatData(v.data).split(' ')[0] : '-'} | #${numPedStr}`; 
    document.getElementById('det-venda-pag').innerText = tipoTexto === 'OR\u00c7AMENTO' ? 'Or\u00e7amento' : (v.pag || '-'); 
    
    let osInfoHtml = '';
    if (tipoTexto === 'SERVI\u00c7O' && v.servicoDetalhes) {
        let galeriaHtml = '';
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) { 
            galeriaHtml = `<p class="mt-2"><strong>Fotos de Refer\u00eancia:</strong></p><div class="flex gap-2 flex-wrap mt-1">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" onclick="abrirZoom('${f}')" class="h-20 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`).join('')}</div>`; 
        } else if (v.servicoDetalhes.foto) { 
            galeriaHtml = `<p class="mt-2"><strong>Foto de Refer\u00eancia:</strong></p><img src="${v.servicoDetalhes.foto}" onclick="abrirZoom('${v.servicoDetalhes.foto}')" class="mt-1 h-24 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`; 
        }
        osInfoHtml = `
            <div class="mt-4 bg-purple-50 dark:bg-purple-900/20 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800/50 text-xs md:text-sm text-purple-900 dark:text-purple-200">
                <h4 class="font-bold mb-2 uppercase text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800/50 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Servi\u00e7o</h4>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <p><strong>Prazo de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'N\u00e3o informado'}</p>
                    <p><strong>Garantia:</strong> ${v.servicoDetalhes.garantia || 'Nenhuma'}</p>
                </div>
                <p class="mb-2"><strong>Escopo / Diagn\u00f3stico:</strong><br> ${v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}</p>
                ${galeriaHtml}
            </div>`;
    }
    
    let entregaInfoModal = '';
    const dEntVal = v.dataEntrega || (v.servicoDetalhes ? v.servicoDetalhes.prazo : '');
    if (dEntVal) {
        const dEntFormat = dEntVal.includes('-') ? dEntVal.split('-').reverse().join('/') : dEntVal;
        entregaInfoModal = `<div class="mt-3 bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2"><i class="fa-solid fa-truck-fast text-blue-600 dark:text-blue-400 text-sm"></i> <strong>Previsão de Entrega:</strong> <span class="font-bold text-sm text-blue-700 dark:text-blue-300">${dEntFormat}</span></div>`;
    }
    
    document.getElementById('det-venda-obs').innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observação geral vinculada a esta venda.</span>') + entregaInfoModal + osInfoHtml;
    
    let totalCusto = 0;
    document.getElementById('det-venda-itens').innerHTML = (v.itens || []).map(i => {
        const preco = Number(i.preco) || 0;
        const qtd = Number(i.qtd) || 1;
        const custo = Number(i.custo) || 0;
        
        const subTot = preco * qtd;
        const subCusto = custo * qtd;
        const lucroSub = subTot - subCusto;
        const margemSub = subTot > 0 ? ((lucroSub / subTot) * 100) : 0;
        
        totalCusto += subCusto;
        
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors group">
            <td class="p-4 border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${i.nome || 'Produto/Serviço'}</div>
                ${i.obsVenda ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md"><i class="fa-solid fa-note-sticky mr-1"></i>${i.obsVenda}</div>` : ''}
            </td>
            <td class="p-4 text-center border-b border-slate-100 dark:border-slate-800/50">
                <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700">${qtd}</span>
            </td>
            <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-black text-slate-700 dark:text-slate-300 text-sm">${typeof formatMoney === 'function' ? formatMoney(preco) : preco}</div>
                ${isGestao ? `<div class="text-[10px] text-red-500/80 dark:text-red-400/80 font-bold mt-0.5 bg-red-50 dark:bg-red-900/20 inline-block px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800/30">Custo: ${typeof formatMoney === 'function' ? formatMoney(custo) : custo}</div>` : ''}
            </td>
            <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-black text-slate-800 dark:text-white text-sm">${typeof formatMoney === 'function' ? formatMoney(subTot) : subTot}</div>
                ${isGestao ? `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub} <span class="text-blue-500">(${margemSub.toFixed(1)}%)</span></div>` : ''}
            </td>
        </tr>`;
    }).join('');
    
    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const taxaBoleto = Number(v.taxaBoleto) || 0;
    const totalDespesas = taxaCartao + taxaBoleto;
    const custoGeral = totalCusto + totalDespesas;
    const lucroLiquido = tot - custoGeral;
    const margemLiquidaReal = tot > 0 ? ((lucroLiquido / tot) * 100) : 0;
    const markupReal = custoGeral > 0 ? ((lucroLiquido / custoGeral) * 100) : 0;
    
    const tfootEl = document.querySelector('#det-venda-tfoot');
    if (tfootEl) {
        let tfootHtml = '';
        if (isGestao) {
            tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Custo Total (Produtos)</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : totalCusto}</td>
                </tr>
            `;
            if (taxaCartao > 0) {
                tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cartão / Despesa</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
                </tr>`;
            }
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
                </tr>
                <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro Líquido Real</td>
                    <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
                </tr>
                <tr class="bg-emerald-50/40 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-800/30">
                    <td colspan="3" class="p-3 text-right font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Margem de Lucro Real / Markup</td>
                    <td class="p-3 text-right font-black text-sm">
                        <span class="bg-emerald-100 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded font-black text-xs">${margemLiquidaReal.toFixed(2)}% Margem</span>
                        <span class="text-[11px] text-blue-600 dark:text-blue-400 font-bold ml-1">(${markupReal.toFixed(2)}% MKP)</span>
                    </td>
                </tr>
            `;
        } else {
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Total Geral</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
                </tr>
            `;
        }
        tfootEl.innerHTML = tfootHtml;
    }
    document.getElementById('modal-detalhes-venda').classList.remove('hidden');
}

function fecharModalDetalhesVenda() { 
    const m = document.getElementById('modal-detalhes-venda');
    if (m) m.classList.add('hidden'); 
}

async function executarEstornoEEdicao(id) {
    const v = (db.vendas || []).find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    try {
        const batch = firestore.batch();
        const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
        
        if(!isOrcamento) {
            if(v.itens && v.itens.length > 0) {
                v.itens.forEach(item => {
                    if(item.id) {
                        const pRef = window.getEmpresaRef().collection('produtos').doc(String(item.id));
                        batch.set(pRef, { estoque: firebase.firestore.FieldValue.increment(Number(item.qtd || 1)) }, { merge: true });
                        
                        const kardexRef = window.getEmpresaRef().collection('movimentacoes').doc();
                        batch.set(kardexRef, {
                            data: new Date().toISOString(),
                            ref: `Estorno (Edição) ${v.tipo || 'Venda'} #${numPedStr}`,
                            prodId: item.id,
                            prodNome: item.nome || 'Produto',
                            qtd: Number(item.qtd || 1),
                            tipo: 'ESTORNO'
                        });
                    }
                });
            }
            
            // Remove títulos vinculados no Firestore e limpa memória viva (db.financeiro) e IndexedDB (FCCache)
            if (typeof window.removerFinanceiroVinculadoVenda === 'function') {
                await window.removerFinanceiroVinculadoVenda(id, v.numeroPedido, batch);
            } else {
                const finQuery = await window.getEmpresaRef().collection('financeiro').where('origemVendaId', '==', String(id)).get();
                finQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }

            // Remove agendamento / lembrete vinculado à venda na Agenda (agenda_eventos)
            if (typeof window.excluirAgendamentoVinculadoVenda === 'function') {
                await window.excluirAgendamentoVinculadoVenda(id, v.numeroPedido);
            }
            
            // Estorno de Caixa Físico Preciso (Apenas dinheiro em espécie)
            let valorDinheiroEfetivo = 0;
            if (Array.isArray(v.pagamentos) && v.pagamentos.length > 0) {
                const pDinheiro = v.pagamentos.find(p => p && (p.metodo === 'Dinheiro' || String(p.metodo).includes('Dinheiro')));
                if (pDinheiro) {
                    valorDinheiroEfetivo = Number(pDinheiro.valor || 0) - Number(v.troco || 0);
                    if (valorDinheiroEfetivo < 0) valorDinheiroEfetivo = 0;
                }
            } else if (v.pag && typeof v.pag === 'string' && String(v.pag).includes('Dinheiro') && !String(v.pag).includes('+')) {
                valorDinheiroEfetivo = Number(v.tot || v.valorLiquido || 0);
            }

            if (valorDinheiroEfetivo > 0) {
                let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                let cxSaldoNovo = (cxAtual.saldo || 0) - valorDinheiroEfetivo;
                cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno (Edição) ${v.tipo || 'Venda'} #${numPedStr}`, valor: valorDinheiroEfetivo });
                
                const targetOpUid = v.operadorId || (window.currentUser && window.currentUser.uid) || null;
                const caixaRef = (typeof window.obterCaixaDocRef === 'function') 
                    ? window.obterCaixaDocRef(targetOpUid) 
                    : window.getEmpresaRef().collection('caixa').doc('caixa_atual');
                batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
            }
        } else {
            // Em orçamentos, garante que qualquer agendamento vinculado também seja removido
            if (typeof window.excluirAgendamentoVinculadoVenda === 'function') {
                await window.excluirAgendamentoVinculadoVenda(id, v.numeroPedido);
            }
        }
        if (!isOrcamento) {
            const vendaRef = window.getEmpresaRef().collection('vendas').doc(String(id));
            batch.delete(vendaRef);
            
            // Remove da memória local e cache imediatamente
            if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
                db.vendas = db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) {
                window.db.vendas = window.db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.removerItem === 'function') {
                await window.FCCache.removerItem('vendas', id);
            }
            await batch.commit();
        } 

        pdvLimpar(); 
        
        // Em vez de usar mudarVisaoLocal que falha em app multi-page, garantimos estar na página certa
        if(window.location.pathname.indexOf('pdv.html') === -1) {
            window.location.href = 'pdv.html';
            return;
        }
        
        window.vendaEmEdicao = {
            id: v.id,
            data: v.data,
            numeroPedido: v.numeroPedido
        };
        
        const opSelect = document.getElementById('pdv-operacao');
        if(opSelect) opSelect.value = v.tipo === 'ORÇAMENTO' ? 'Orçamento' : (v.tipo === 'SERVIÇO' ? 'Serviço' : 'Venda');
        togglePanelServico();
        
        setTimeout(() => {
            const hiddenCli = document.getElementById('pdv-cliente');
            const buscaCli = document.getElementById('pdv-cliente-busca');
            if(hiddenCli && buscaCli) {
                hiddenCli.value = v.clienteId || '0';
                if (v.clienteId && v.clienteId !== '0') {
                    const cEncontrado = db.clientes.find(cli => String(cli.id) === String(v.clienteId));
                    buscaCli.value = cEncontrado ? cEncontrado.nome : (v.clienteNome || '');
                } else {
                    buscaCli.value = '';
                }
            }
            
            const vendSelect = document.getElementById('pdv-vendedor');
            if(vendSelect && v.vendedor) vendSelect.value = v.vendedor;

            const elFrete = document.getElementById('pdv-frete');
            if(elFrete) elFrete.value = v.frete || 0;
            
            const elDesc = document.getElementById('pdv-desconto');
            if(elDesc) elDesc.value = v.desconto || 0;
            
            const obsEl = document.getElementById('pdv-obs');
            if(obsEl) obsEl.value = v.obs || '';

            const elDataVenda = document.getElementById('pdv-data');
            if (elDataVenda && v.data) {
                try {
                    const dV = new Date(v.data);
                    const y = dV.getFullYear();
                    const m = String(dV.getMonth() + 1).padStart(2, '0');
                    const d = String(dV.getDate()).padStart(2, '0');
                    elDataVenda.value = `${y}-${m}-${d}`;
                } catch (_) {
                    elDataVenda.value = (v.data || '').split('T')[0] || '';
                }
            }

            const elDataEntrega = document.getElementById('pdv-data-entrega');
            if(elDataEntrega) {
                elDataEntrega.value = v.dataEntrega || (v.servicoDetalhes ? v.servicoDetalhes.prazo : '') || '';
            }

            if(v.tipo === 'SERVIÇO' && v.servicoDetalhes) {
                if(document.getElementById('os-prazo')) document.getElementById('os-prazo').value = v.servicoDetalhes.prazo || '';
                if(document.getElementById('os-garantia')) document.getElementById('os-garantia').value = v.servicoDetalhes.garantia || '';
                if(document.getElementById('os-desc')) document.getElementById('os-desc').value = v.servicoDetalhes.desc || '';
                osFotosArray = v.servicoDetalhes.fotos ? [...v.servicoDetalhes.fotos] : [];
                renderizarFotosOS();
            }

            cart = (v.itens || []).map(i => {
                const pBD = (db.produtos || []).find(prod => String(prod.id) === String(i.id));
                return {
                    id: i.id,
                    nome: i.nome,
                    preco: (i.preco !== undefined ? i.preco : (i.precoFinal !== undefined ? i.precoFinal : (i.precoBase || 0))),
                    custo: (i.custo !== undefined ? i.custo : (i.precoCusto || 0)),
                    qtd: i.qtd || 1,
                    obsVenda: i.obsVenda || '',
                    foto: pBD ? (pBD.foto || '') : ''
                };
            });

            pagamentosVendaAtual = [];
            pdvAtualizarTotais();
            renderCarrinho();
            if (typeof mudarVisaoLocal === 'function') mudarVisaoLocal('pdv');

            showToast('Dados carregados no PDV. Modifique e finalize!', 'success');
        }, 100);

    } catch (err) { 
        console.error(err); 
        showToast('Erro ao carregar venda para edição.', 'error'); 
    }
}

function editarVenda(id) {
    const v = (db.vendas || []).find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja carregar este orçamento de volta no PDV para editar?' 
        : 'Atenção! Isso fará o ESTORNO automático desta venda (devolvendo estoque e apagando as parcelas) e carregará todos os itens no PDV para você editar e re-finalizar. Deseja continuar?';

    abrirConfirmacao('Editar Operação', msg, () => {
        if(window.location.pathname.indexOf('pdv.html') > -1) {
            executarEstornoEEdicao(id);
        } else {
            sessionStorage.setItem('autoEditVendaId', id);
            window.location.href = 'pdv.html';
        }
    });
}


function excluirVenda(id) {
    const v = (db.vendas || []).find(x => String(x.id) === String(id));
    if (!v) return showToast('Venda não encontrada.', 'error');

    abrirConfirmacao('Excluir Operação e Estornar', 'Isso fará o estorno dos produtos ao estoque e removerá as parcelas do Financeiro. Deseja continuar?', async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);

            if (v.tipo !== 'ORÇAMENTO') {
                if (v.itens && v.itens.length > 0) {
                    v.itens.forEach(item => {
                        if (item.id) {
                            const pRef = window.getEmpresaRef().collection('produtos').doc(String(item.id));
                            batch.set(pRef, { estoque: firebase.firestore.FieldValue.increment(Number(item.qtd || 1)) }, { merge: true });
                            
                            const kardexRef = window.getEmpresaRef().collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: `Estorno Venda #${numPedStr}`,
                                prodId: item.id,
                                prodNome: item.nome || 'Produto',
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        }
                    });
                }

                // Remove títulos financeiros vinculados no Firestore e atualiza memória e FCCache
                if (typeof window.removerFinanceiroVinculadoVenda === 'function') {
                    await window.removerFinanceiroVinculadoVenda(id, v.numeroPedido, batch);
                } else {
                    const finQuery = await window.getEmpresaRef().collection('financeiro').where('origemVendaId', '==', String(id)).get();
                    finQuery.docs.forEach(doc => batch.delete(doc.ref));
                }

                // Remove agendamento vinculado à venda na Agenda de eventos
                if (typeof window.excluirAgendamentoVinculadoVenda === 'function') {
                    await window.excluirAgendamentoVinculadoVenda(id, v.numeroPedido);
                }

                let valorDinheiroEfetivo = 0;
                if (Array.isArray(v.pagamentos) && v.pagamentos.length > 0) {
                    const pDinheiro = v.pagamentos.find(p => p && (p.metodo === 'Dinheiro' || String(p.metodo).includes('Dinheiro')));
                    if (pDinheiro) {
                        valorDinheiroEfetivo = Number(pDinheiro.valor || 0) - Number(v.troco || 0);
                        if (valorDinheiroEfetivo < 0) valorDinheiroEfetivo = 0;
                    }
                } else if (v.pag && typeof v.pag === 'string' && String(v.pag).includes('Dinheiro') && !String(v.pag).includes('+')) {
                    valorDinheiroEfetivo = Number(v.tot || v.valorLiquido || 0);
                }

                if (valorDinheiroEfetivo > 0) {
                    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                    let cxSaldoNovo = (cxAtual.saldo || 0) - valorDinheiroEfetivo;
                    cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno Venda #${numPedStr}`, valor: valorDinheiroEfetivo });
                    const targetOpUid = v.operadorId || (window.currentUser && window.currentUser.uid) || null;
                    const caixaRef = (typeof window.obterCaixaDocRef === 'function') 
                        ? window.obterCaixaDocRef(targetOpUid) 
                        : window.getEmpresaRef().collection('caixa').doc('caixa_atual');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            } else {
                if (typeof window.excluirAgendamentoVinculadoVenda === 'function') {
                    await window.excluirAgendamentoVinculadoVenda(id, v.numeroPedido);
                }
            }

            const vendaRef = window.getEmpresaRef().collection('vendas').doc(String(id));
            batch.delete(vendaRef);

            // Atualiza repositório local imediatamente
            if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
                db.vendas = db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) {
                window.db.vendas = window.db.vendas.filter(x => String(x.id) !== String(id));
            }
            if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.removerItem === 'function') {
                await window.FCCache.removerItem('vendas', id);
            }

            try {
                await batch.commit();
                if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.removerDaFila === 'function') {
                    window.FCCache.removerDaFila('vendas', id);
                }
            } catch (commitErr) {
                console.warn("Aviso: Exclusão gravada localmente no dispositivo (pendente de sincronização):", commitErr);
            }

            showToast('Operação excluída e estornada com sucesso!', 'success');
            if (typeof carregarVendas === 'function') carregarVendas();
            if (typeof fecharModalDetalhesVenda === 'function') fecharModalDetalhesVenda();
        } catch (err) {
            console.error(err);
            showToast('Erro ao excluir operação.', 'error');
        }
    });
}

function reimprimirVenda(id) {
    const v = (db.vendas || []).find(x => String(x.id) === String(id));
    if (!v) return showToast('Venda não encontrada.', 'error');
    window.vendaAtualImpressao = v;
    if (typeof imprimirRecibo === 'function') {
        imprimirRecibo(v);
    }
}

function atualizarVendedoresPDV() {
    const select = document.getElementById('pdv-vendedor');
    if (!select) return;
    
    const selectedValue = select.value;
    
    // Filtra funcionários vendedores de forma abrangente
    const vendedores = (db.funcionarios || [])
        .filter(f => (f.vendedor && String(f.vendedor).toUpperCase() === 'SIM') || f.vendedor === true || (f.cargo && String(f.cargo).toLowerCase().includes('vendedor')))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        
    let html = `<option value="Balcão">Vend: Balcão</option>`;
    
    const nomesAdicionados = new Set(['balcão', 'balcao']);
    
    vendedores.forEach(v => {
        if (v && v.nome && !nomesAdicionados.has(v.nome.trim().toLowerCase())) {
            nomesAdicionados.add(v.nome.trim().toLowerCase());
            html += `<option value="${v.nome.trim()}">Vend: ${v.nome.trim()}</option>`;
        }
    });

    // Se houver um valor selecionado anteriormente que não esteja nos funcionários, preserva-o
    if (selectedValue && !nomesAdicionados.has(selectedValue.trim().toLowerCase())) {
        html += `<option value="${selectedValue.trim()}">Vend: ${selectedValue.trim()}</option>`;
    }
    
    select.innerHTML = html;
    
    // Tenta restaurar o valor selecionado
    if (selectedValue) {
        select.value = selectedValue;
        if (select.selectedIndex === -1) {
            select.value = 'Balcão';
        }
    }
}





// ==========================================
// PERSISTÊNCIA DE ESTADO DO PDV (LOCALSTORAGE)
// ==========================================
function confirmarLimparPDV() {
    const temDados = (typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) ||
                     (typeof pagamentosVendaAtual !== 'undefined' && Array.isArray(pagamentosVendaAtual) && pagamentosVendaAtual.length > 0) ||
                     (document.getElementById('pdv-cliente') && document.getElementById('pdv-cliente').value !== '0');
    if (temDados) {
        if (!confirm('Deseja realmente cancelar esta venda e limpar todos os dados do PDV?')) {
            return;
        }
    }
    pdvLimpar();
    if (typeof showToast === 'function') {
        showToast('PDV limpo com sucesso!', 'info');
    }
}
window.confirmarLimparPDV = confirmarLimparPDV;

window.salvarEstadoPDV = function() {
    // PROTEÇÃO CRÍTICA: Não salva nem limpa se o estado inicial da página ainda não terminou de ser restaurado
    if (!window._pdvEstadoCarregado) return;

    try {
        const cId = document.getElementById('pdv-cliente') ? document.getElementById('pdv-cliente').value : '0';
        const temCarrinho = typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0;
        const temPag = typeof pagamentosVendaAtual !== 'undefined' && Array.isArray(pagamentosVendaAtual) && pagamentosVendaAtual.length > 0;
        const temCliente = cId && cId !== '0';
        const temObs = document.getElementById('pdv-obs') && document.getElementById('pdv-obs').value.trim() !== '';
        const temEdicao = window.vendaEmEdicao != null;

        // Se o PDV não possui dados em aberto (está limpo), remove qualquer rascunho persistido
        if (!temCarrinho && !temPag && !temCliente && !temObs && !temEdicao) {
            localStorage.removeItem('pdvState');
            return;
        }

        // Sanitiza clienteCache como objeto simples e seguro para JSON
        let cliCache = null;
        let rawCli = (window._ultimoClienteSelecionado && String(window._ultimoClienteSelecionado.id || window._ultimoClienteSelecionado._id || '') === String(cId)) ? window._ultimoClienteSelecionado : null;
        if (!rawCli && temCliente && window.db && window.db.clientes) {
            rawCli = window.db.clientes.find(x => String(x.id || x._id || '').trim() === String(cId).trim()) || null;
        }
        if (rawCli) {
            cliCache = {
                id: String(rawCli.id || rawCli._id || cId).trim(),
                nome: rawCli.nome || '',
                doc: rawCli.doc || rawCli.cpfCnpj || rawCli.documento || '',
                cpfCnpj: rawCli.cpfCnpj || rawCli.doc || rawCli.documento || '',
                documento: rawCli.documento || rawCli.doc || rawCli.cpfCnpj || '',
                wpp: rawCli.wpp || rawCli.telefone || rawCli.fixo || '',
                telefone: rawCli.telefone || rawCli.wpp || rawCli.fixo || '',
                fixo: rawCli.fixo || '',
                rua: rawCli.rua || '',
                numero: rawCli.numero || '',
                complemento: rawCli.complemento || '',
                bairro: rawCli.bairro || '',
                cidade: rawCli.cidade || '',
                uf: rawCli.uf || '',
                cep: rawCli.cep || '',
                endereco: rawCli.endereco || '',
                vendedor: rawCli.vendedor || '',
                obs: rawCli.obs || ''
            };
        }

        // Sanitiza cart como lista de itens serializáveis puros
        const cartSanitizado = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart.map(it => ({
            id: it.id || '',
            nome: it.nome || 'Produto',
            preco: Number(it.preco) || 0,
            precoOriginal: Number(it.precoOriginal) || Number(it.preco) || 0,
            custo: Number(it.custo) || 0,
            estoque: it.estoque !== undefined ? Number(it.estoque) : 0,
            desconto: Number(it.desconto) || 0,
            qtd: Number(it.qtd) || 1,
            foto: it.foto || '',
            obsVenda: it.obsVenda || '',
            customizacao: it.customizacao ? JSON.parse(JSON.stringify(it.customizacao)) : undefined
        })) : [];

        // Sanitiza pagamentos
        const pagamentosSanitizados = (typeof pagamentosVendaAtual !== 'undefined' && Array.isArray(pagamentosVendaAtual)) ? pagamentosVendaAtual.map(p => ({
            metodo: p.metodo || 'Dinheiro',
            valor: Number(p.valor) || 0,
            parcelas: Number(p.parcelas) || 1,
            vencimentoBase: p.vencimentoBase || '',
            vencimentosPersonalizados: Array.isArray(p.vencimentosPersonalizados) ? [...p.vencimentosPersonalizados] : []
        })) : [];

        const estado = {
            cart: cartSanitizado,
            pagamentos: pagamentosSanitizados,
            clienteId: cId,
            clienteBusca: document.getElementById('pdv-cliente-busca') ? document.getElementById('pdv-cliente-busca').value : (cliCache ? cliCache.nome : ''),
            clienteCache: cliCache,
            vendedorId: document.getElementById('pdv-vendedor') ? document.getElementById('pdv-vendedor').value : '',
            observacao: document.getElementById('pdv-obs') ? document.getElementById('pdv-obs').value : '',
            dataVenda: document.getElementById('pdv-data') ? document.getElementById('pdv-data').value : '',
            dataEntrega: document.getElementById('pdv-data-entrega') ? document.getElementById('pdv-data-entrega').value : '',
            desconto: document.getElementById('pdv-desconto') ? document.getElementById('pdv-desconto').value : '0',
            frete: document.getElementById('pdv-frete') ? document.getElementById('pdv-frete').value : '0',
            operacao: document.getElementById('pdv-operacao') ? document.getElementById('pdv-operacao').value : '',
            vendaEmEdicao: window.vendaEmEdicao ? {
                id: window.vendaEmEdicao.id,
                data: window.vendaEmEdicao.data,
                numeroPedido: window.vendaEmEdicao.numeroPedido
            } : null
        };
        localStorage.setItem('pdvState', JSON.stringify(estado));
    } catch (e) {
        console.error("Erro interno ao salvar estado do PDV:", e);
    }
};

window.carregarEstadoPDV = function() {
    if (window._pdvEstadoCarregando) return;
    window._pdvEstadoCarregando = true;
    try {
        const saved = localStorage.getItem('pdvState');
        if (!saved) {
            window._pdvEstadoCarregado = true;
            return;
        }

        const estado = JSON.parse(saved);
        if (!estado || typeof estado !== 'object') {
            window._pdvEstadoCarregado = true;
            return;
        }

        const temConteudo = (estado.cart && Array.isArray(estado.cart) && estado.cart.length > 0) || 
                            (estado.clienteId && estado.clienteId !== '0') ||
                            (estado.pagamentos && Array.isArray(estado.pagamentos) && estado.pagamentos.length > 0) ||
                            (estado.observacao && estado.observacao.trim()) ||
                            (estado.vendaEmEdicao != null);

        if (!temConteudo) {
            window._pdvEstadoCarregado = true;
            return;
        }

        // REGRA DE OURO: NUNCA SOBRESCREVE DADOS SE JÁ HOUVER ITENS NA MEMÓRIA
        if (typeof cart !== 'undefined') {
            if (!Array.isArray(cart) || cart.length === 0) {
                if (Array.isArray(estado.cart) && estado.cart.length > 0) {
                    cart = estado.cart;
                }
            }
        }

        if (typeof pagamentosVendaAtual !== 'undefined') {
            if (!Array.isArray(pagamentosVendaAtual) || pagamentosVendaAtual.length === 0) {
                if (Array.isArray(estado.pagamentos) && estado.pagamentos.length > 0) {
                    pagamentosVendaAtual = estado.pagamentos;
                }
            }
        }

        if (estado.vendaEmEdicao) {
            window.vendaEmEdicao = estado.vendaEmEdicao;
        }

        if (document.getElementById('pdv-operacao') && estado.operacao) {
            document.getElementById('pdv-operacao').value = estado.operacao;
            document.getElementById('pdv-operacao').dataset.usuarioAlterou = 'true';
        }
        if (document.getElementById('pdv-vendedor') && estado.vendedorId) {
            document.getElementById('pdv-vendedor').value = estado.vendedorId;
            document.getElementById('pdv-vendedor').dataset.usuarioAlterou = 'true';
        }
        if (document.getElementById('pdv-obs') && estado.observacao) {
            document.getElementById('pdv-obs').value = estado.observacao;
        }
        if (document.getElementById('pdv-data')) {
            const hojeLocal = (typeof obterDataHojeLocalYYYYMMDD === 'function') 
                ? obterDataHojeLocalYYYYMMDD() 
                : new Date().toISOString().split('T')[0];
            if (window.vendaEmEdicao && estado.dataVenda) {
                document.getElementById('pdv-data').value = estado.dataVenda;
            } else if (estado.dataVenda && estado.dataVenda === hojeLocal) {
                document.getElementById('pdv-data').value = estado.dataVenda;
            } else {
                // Nova venda sempre recebe a data de hoje para não herdar rascunho de dias anteriores
                document.getElementById('pdv-data').value = hojeLocal;
            }
        }
        if (document.getElementById('pdv-data-entrega') && estado.dataEntrega) {
            document.getElementById('pdv-data-entrega').value = estado.dataEntrega;
        }
        if (document.getElementById('pdv-desconto') && estado.desconto) {
            document.getElementById('pdv-desconto').value = estado.desconto;
        }
        if (document.getElementById('pdv-frete') && estado.frete) {
            document.getElementById('pdv-frete').value = estado.frete;
        }

        // Restaura o cliente e o card completo de imediato
        if (estado.clienteId && estado.clienteId !== '0') {
            window._clientePendentePDV = String(estado.clienteId).trim();
            const hiddenId = document.getElementById('pdv-cliente');
            const inputBusca = document.getElementById('pdv-cliente-busca');
            if (hiddenId) hiddenId.value = estado.clienteId;
            if (inputBusca) inputBusca.value = estado.clienteBusca || (estado.clienteCache ? estado.clienteCache.nome : '');

            if (estado.clienteCache) {
                window._ultimoClienteSelecionado = estado.clienteCache;
                renderizarCardClientePDV(estado.clienteCache);
            } else if (window.db && window.db.clientes) {
                const c = window.db.clientes.find(x => String(x.id || x._id || '').trim() === String(estado.clienteId).trim());
                if (c) {
                    window._ultimoClienteSelecionado = c;
                    renderizarCardClientePDV(c);
                }
            }
        }

        if (typeof renderCarrinho === 'function') renderCarrinho();
        if (typeof atualizarResumoPagamentosVenda === 'function') atualizarResumoPagamentosVenda();
        
        const btnFinalizar = document.getElementById('btn-finalizar-venda');
        if (btnFinalizar && window.vendaEmEdicao) {
            btnFinalizar.innerHTML = '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA EDITADA';
        }
    } catch(e) {
        console.error('Erro ao restaurar estado do PDV:', e);
    } finally {
        window._pdvEstadoCarregado = true;
        window._pdvEstadoCarregando = false;
    }
};

setInterval(() => {
    if (document.getElementById('view-pdv') && document.getElementById('view-pdv').classList.contains('active')) {
        if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
    }
}, 1000);

window.addEventListener('beforeunload', () => {
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
});

function inicializarRestauracaoPDV() {
    if (window._pdvEstadoCarregado) return;
    if (typeof window.carregarEstadoPDV === 'function') {
        window.carregarEstadoPDV();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarRestauracaoPDV);
} else {
    inicializarRestauracaoPDV();
}

// Delegação de eventos para zoom de imagens (evita problema com URLs especiais do Firebase no onclick inline)
document.addEventListener('click', function(e) {
    const img = e.target.closest('.img-zoom-trigger');
    if (img && img.dataset.zoomSrc) {
        e.stopPropagation();
        abrirZoom(img.dataset.zoomSrc);
    }
});

// NOVO: Funções auxiliares para Vínculo de XML
function alternarAcaoVinculoXML() {
    const acao = document.getElementById('prod-acao-vinculo').value;
    if(acao === 'VINCULAR') {
        document.getElementById('div-vinculo-busca').classList.remove('hidden');
    } else {
        document.getElementById('div-vinculo-busca').classList.add('hidden');
        document.getElementById('prod-id').value = '';
    }
}

function preencherVinculoXML() {
    const id = document.getElementById('prod-vinculo-select').value;
    if(id) {
        const prod = db.produtos.find(p => String(p.id) === String(id));
        if(prod) {
            document.getElementById('prod-id').value = prod.id;
            document.getElementById('prod-nome').value = prod.nome;
            document.getElementById('prod-ean').value = prod.ean || '';
            document.getElementById('prod-margem').value = (prod.custo > 0 && prod.preco > 0) ? (((prod.preco - prod.custo) / prod.custo) * 100).toFixed(2) : (prod.margem || 50).toFixed(2);
            if(typeof calcularPrecoMargin === 'function') {
                calcularPrecoMargin('margem');
            }
        }
    }
}



function selecionarProdutoVinculoXML(id, nome) {
    document.getElementById('prod-vinculo-select').value = id;
    document.getElementById('prod-vinculo-search').value = nome;
    ocultarListaProdutosXMLBusca();
    preencherVinculoXML(); 
}

function filtrarProdutosXMLBusca() {
    const termo = document.getElementById('prod-vinculo-search').value.toLowerCase();
    const lista = document.getElementById('prod-vinculo-lista');
    lista.classList.remove('hidden');
    let html = '';
    const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
    let count = 0;
    sorted.forEach(p => {
        if(p.nome.toLowerCase().includes(termo) || (p.ean && p.ean.includes(termo))) {
            count++;
            if(count <= 50) {
                html += '<li onclick="selecionarProdutoVinculoXML(\'' + p.id + '\', \'' + p.nome.replace(/'/g, "\\'") + '\')" class="p-2 border-b border-slate-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer"><div class="font-bold text-xs">' + p.nome + '</div><div class="text-[10px] text-slate-500">Estoque: ' + p.estoque + ' | EAN: ' + (p.ean || 'S/N') + '</div></li>';
            }
        }
    });
    if(count === 0) html = '<li class="p-2 text-xs text-slate-500">Nenhum produto encontrado.</li>';
    lista.innerHTML = html;
}

function mostrarListaProdutosXMLBusca() { filtrarProdutosXMLBusca(); }
function ocultarListaProdutosXMLBusca() { document.getElementById('prod-vinculo-lista').classList.add('hidden'); }


// Expondo globalmente para evitar erros de escopo
window.obterDadosEmpresa = obterDadosEmpresa;
window.aplicarIdentidadeVisualNoMenu = aplicarIdentidadeVisualNoMenu;
window.obterDadosClientePDV = obterDadosClientePDV;
window.mudarVisaoLocal = mudarVisaoLocal;
window.abrirConfirmacao = abrirConfirmacao;
window.fecharModalConfirmacao = fecharModalConfirmacao;
window.abrirZoom = abrirZoom;
window.fecharZoom = fecharZoom;
window.abrirZoomCart = abrirZoomCart;
window.atualizarListaClientesPDV = atualizarListaClientesPDV;
window.filtrarClientesPDV = filtrarClientesPDV;
window.abrirModalClienteRapido = abrirModalClienteRapido;
window.fecharModalCliente = fecharModalCliente;
window.abaModal = abaModal;
window.abrirModalProduto = abrirModalProduto;
window.fecharModalProduto = fecharModalProduto;
window.processarFoto = processarFoto;
window.processarMultiplasFotosOS = processarMultiplasFotosOS;
window.renderizarFotosOS = renderizarFotosOS;
window.removerFotoOS = removerFotoOS;
window.printHtmlSeguro = printHtmlSeguro;
window.imprimirArea = imprimirArea;
window.printAction = printAction;
window.baixarPDF = baixarPDF;
window.downloadPDF = downloadPDF;
window.exportarExcel = exportarExcel;
window.imprimirContratoAtual = imprimirContratoAtual;
window.imprimirContratoById = imprimirContratoById;

function imprimirOrdemProducaoAtual() {
    if (window.vendaAtualImpressao) { 
        imprimirOrdemProducaoObj(window.vendaAtualImpressao); 
    } else { 
        showToast("Nenhuma venda selecionada para imprimir a Ordem de Produção.", "error"); 
    }
}
window.imprimirOrdemProducaoAtual = imprimirOrdemProducaoAtual;

function imprimirOrdemProducaoById(id) { 
    const todasVendas = (typeof db !== 'undefined' && Array.isArray(db.vendas)) 
        ? db.vendas 
        : ((typeof window.db !== 'undefined' && Array.isArray(window.db.vendas)) ? window.db.vendas : []);
    const v = todasVendas.find(x => String(x.id) === String(id)); 
    if (v) {
        window.vendaAtualImpressao = v;
        imprimirOrdemProducaoObj(v); 
    } else {
        showToast("Venda não encontrada para imprimir a Ordem de Produção.", "error");
    }
}
window.imprimirOrdemProducaoById = imprimirOrdemProducaoById;
window.enviarPDFWhatsApp = enviarPDFWhatsApp;
window.imprimirContratoObj = imprimirContratoObj;
window.abrirLeitorCamera = abrirLeitorCamera;
window.fecharLeitorCamera = fecharLeitorCamera;
window.onScanSuccess = onScanSuccess;
window.prepararPDV = prepararPDV;
window.togglePanelServico = togglePanelServico;
window.filtrarProdutosPDV = filtrarProdutosPDV;
window.processarAdicaoProduto = processarAdicaoProduto;
window.pdvMudarObsItem = pdvMudarObsItem;
window.renderCarrinho = renderCarrinho;
window.pdvMudarQtd = pdvMudarQtd;
window.pdvAlterarQtdRelativa = pdvAlterarQtdRelativa;
window.pdvMudarPreco = pdvMudarPreco;
window.pdvLimpar = pdvLimpar;
window.pdvMudarDescontoItem = pdvMudarDescontoItem;
window.pdvAtualizarTotais = pdvAtualizarTotais;
window.verificarParcelasPagamento = verificarParcelasPagamento;
window.renderizarInputsDatasParcelas = renderizarInputsDatasParcelas;
window.recalcularDatasParcelas = recalcularDatasParcelas;
window.atualizarResumoPagamentosVenda = atualizarResumoPagamentosVenda;
window.adicionarPagamentoVenda = adicionarPagamentoVenda;
window.removerPagamentoVenda = removerPagamentoVenda;
window.fecharModalOpcoesRecibo = fecharModalOpcoesRecibo;
window.renderVendas = renderVendas;
window.renderOrcamentos = renderOrcamentos;
window.verDetalhesVenda = verDetalhesVenda;
window.fecharModalDetalhesVenda = fecharModalDetalhesVenda;
window.editarVenda = editarVenda;
window.atualizarVendedoresPDV = atualizarVendedoresPDV;
window.alternarAcaoVinculoXML = alternarAcaoVinculoXML;
window.preencherVinculoXML = preencherVinculoXML;
window.selecionarProdutoVinculoXML = selecionarProdutoVinculoXML;
window.filtrarProdutosXMLBusca = filtrarProdutosXMLBusca;
window.mostrarListaProdutosXMLBusca = mostrarListaProdutosXMLBusca;
window.ocultarListaProdutosXMLBusca = ocultarListaProdutosXMLBusca;





// =======================================================
// CONTROLE DO MODAL DE PERSONALIZACAO DE MOVEIS E ESTOFADOS
// =======================================================
window.atualizarSelectsModalPersonalizacao = function(catAlterada, valorSelecionar) {
    const persConfig = (typeof window.getPersonalizacaoConfig === 'function') 
        ? window.getPersonalizacaoConfig() 
        : ((window.db && window.db.config && window.db.config.personalizacao) || {});

    const popularSelect = (idSelect, lista, selecionado) => {
        const sel = document.getElementById(idSelect);
        if (!sel) return;
        const valorAtual = selecionado !== undefined ? selecionado : sel.value;
        let html = '<option value="">(Padrão / Não se aplica)</option>';
        (lista || []).forEach(opt => {
            const val = typeof opt === 'string' ? opt : (opt.nome || '');
            const isSel = (valorAtual && valorAtual === val) ? 'selected' : '';
            html += `<option value="${val}" ${isSel}>${val}</option>`;
        });
        if (valorAtual && !(lista || []).some(o => (typeof o === 'string' ? o : o.nome) === valorAtual)) {
            html += `<option value="${valorAtual}" selected>${valorAtual}</option>`;
        }
        sel.innerHTML = html;
    };

    const selMadeira = document.getElementById('modal-pers-madeira');
    const selCorMadeira = document.getElementById('modal-pers-cor-madeira');
    const selEstofado = document.getElementById('modal-pers-estofado');
    const selCorEstofado = document.getElementById('modal-pers-cor-estofado');

    if (selMadeira) popularSelect('modal-pers-madeira', persConfig.madeiras, catAlterada === 'madeiras' ? valorSelecionar : selMadeira.value);
    if (selCorMadeira) popularSelect('modal-pers-cor-madeira', persConfig.cores_madeira, catAlterada === 'cores_madeira' ? valorSelecionar : selCorMadeira.value);
    if (selEstofado) popularSelect('modal-pers-estofado', persConfig.tecidos, catAlterada === 'tecidos' ? valorSelecionar : selEstofado.value);
    if (selCorEstofado) popularSelect('modal-pers-cor-estofado', persConfig.cores_estofado, catAlterada === 'cores_estofado' ? valorSelecionar : selCorEstofado.value);
};

window.abrirModalPersonalizacao = function(idx) {
    const currentCart = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart : (window.cart || []);
    if (!currentCart || !currentCart[idx]) {
        console.error('Item não encontrado no carrinho para personalizar. Índice:', idx);
        return;
    }
    const item = currentCart[idx];
    
    const idxInput = document.getElementById('modal-pers-item-idx');
    if (idxInput) idxInput.value = idx;

    const nomeEl = document.getElementById('modal-pers-prod-nome');
    if (nomeEl) nomeEl.innerText = item.nome || 'Produto';
    
    const fotoDiv = document.getElementById('modal-pers-prod-foto');
    if (fotoDiv) {
        if (item.foto) {
            fotoDiv.innerHTML = `<img src="${item.foto}" class="w-full h-full object-cover">`;
        } else {
            fotoDiv.innerHTML = `<i class="fa-solid fa-couch text-lg text-amber-600"></i>`;
        }
    }

    const persConfig = (typeof window.getPersonalizacaoConfig === 'function')
        ? window.getPersonalizacaoConfig()
        : ((window.db && window.db.config && window.db.config.personalizacao) || {});

    const popularSelect = (idSelect, lista, selecionado) => {
        const sel = document.getElementById(idSelect);
        if (!sel) return;
        let html = '<option value="">(Padrão / Não se aplica)</option>';
        (lista || []).forEach(opt => {
            const val = typeof opt === 'string' ? opt : (opt.nome || '');
            const isSel = (selecionado && selecionado === val) ? 'selected' : '';
            html += `<option value="${val}" ${isSel}>${val}</option>`;
        });
        if (selecionado && !(lista || []).some(o => (typeof o === 'string' ? o : o.nome) === selecionado)) {
            html += `<option value="${selecionado}" selected>${selecionado}</option>`;
        }
        sel.innerHTML = html;
    };

    const c = item.customizacao || {};
    popularSelect('modal-pers-madeira', persConfig.madeiras, c.madeira || '');
    popularSelect('modal-pers-cor-madeira', persConfig.cores_madeira, c.corMadeira || '');
    popularSelect('modal-pers-estofado', persConfig.tecidos, c.estofado || '');
    popularSelect('modal-pers-cor-estofado', persConfig.cores_estofado, c.corEstofado || '');

    const m = c.medidas || {};
    const medL = document.getElementById('modal-pers-med-l');
    const medA = document.getElementById('modal-pers-med-a');
    const medP = document.getElementById('modal-pers-med-p');
    const obsEl = document.getElementById('modal-pers-obs');
    if (medL) medL.value = m.largura || '';
    if (medA) medA.value = m.altura || '';
    if (medP) medP.value = m.profundidade || '';
    if (obsEl) obsEl.value = c.obsExtra || '';

    const modal = document.getElementById('modal-personalizacao-item');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            const fTarget = document.getElementById('modal-pers-madeira');
            if (fTarget) fTarget.focus();
        }, 50);
    }
};

window.fecharModalPersonalizacao = function() {
    const modal = document.getElementById('modal-personalizacao-item');
    if (modal) modal.classList.add('hidden');
};

window.salvarPersonalizacaoItem = function() {
    const currentCart = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart : (window.cart || []);
    const idxInput = document.getElementById('modal-pers-item-idx');
    const idx = idxInput ? parseInt(idxInput.value, 10) : NaN;
    if (isNaN(idx) || !currentCart || !currentCart[idx]) return;

    const madeira = (document.getElementById('modal-pers-madeira')?.value || '').trim();
    const corMadeira = (document.getElementById('modal-pers-cor-madeira')?.value || '').trim();
    const estofado = (document.getElementById('modal-pers-estofado')?.value || '').trim();
    const corEstofado = (document.getElementById('modal-pers-cor-estofado')?.value || '').trim();
    const medL = (document.getElementById('modal-pers-med-l')?.value || '').trim();
    const medA = (document.getElementById('modal-pers-med-a')?.value || '').trim();
    const medP = (document.getElementById('modal-pers-med-p')?.value || '').trim();
    const obsExtra = (document.getElementById('modal-pers-obs')?.value || '').trim();

    const temDados = madeira || corMadeira || estofado || corEstofado || medL || medA || medP || obsExtra;

    if (temDados) {
        currentCart[idx].customizacao = {
            madeira: madeira,
            corMadeira: corMadeira,
            estofado: estofado,
            corEstofado: corEstofado,
            medidas: {
                largura: medL,
                altura: medA,
                profundidade: medP
            },
            obsExtra: obsExtra
        };
    } else {
        delete currentCart[idx].customizacao;
    }

    window.fecharModalPersonalizacao();
    if (typeof renderCarrinho === 'function') renderCarrinho();
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
    if (typeof showToast === 'function') showToast('Personalização aplicada ao item!', 'success');
};

window.removerPersonalizacaoItem = function() {
    const currentCart = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart : (window.cart || []);
    const idxInput = document.getElementById('modal-pers-item-idx');
    const idx = idxInput ? parseInt(idxInput.value, 10) : NaN;
    if (!isNaN(idx) && currentCart && currentCart[idx]) {
        delete currentCart[idx].customizacao;
    }
    window.fecharModalPersonalizacao();
    if (typeof renderCarrinho === 'function') renderCarrinho();
    if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
    if (typeof showToast === 'function') showToast('Personalização removida.', 'info');
};

function formatarResumoCustomizacaoHtml(c) {
    if (!c) return '';
    const badges = [];
    if (c.madeira || c.corMadeira) {
        const txt = [c.madeira, c.corMadeira].filter(Boolean).join(' - ');
        badges.push(`<span class="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-tree text-[9px]"></i> ${txt}</span>`);
    }
    if (c.estofado || c.corEstofado) {
        const txt = [c.estofado, c.corEstofado].filter(Boolean).join(' - ');
        badges.push(`<span class="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 px-1.5 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-rug text-[9px]"></i> ${txt}</span>`);
    }
    const m = c.medidas || {};
    const partesMed = [];
    if (m.largura) partesMed.push(`L:${m.largura}`);
    if (m.altura) partesMed.push(`A:${m.altura}`);
    if (m.profundidade) partesMed.push(`P:${m.profundidade}`);
    if (partesMed.length > 0) {
        badges.push(`<span class="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-1.5 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-ruler-combined text-[9px]"></i> ${partesMed.join(' x ')}</span>`);
    }
    if (c.obsExtra) {
        badges.push(`<span class="inline-flex items-center gap-1 bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-semibold" title="Obs do Móvel: ${c.obsExtra}"><i class="fa-solid fa-note-sticky text-[9px] text-amber-600"></i> Obs Móvel: ${c.obsExtra}</span>`);
    }
    if (badges.length === 0) return '';
    return `<div class="flex flex-wrap gap-1 mt-1">${badges.join('')}</div>`;
}

function formatarCustomizacaoContratoTexto(c) {
    if (!c) return '';
    const linhas = [];
    if (c.madeira || c.corMadeira) {
        const part = [];
        if (c.madeira) part.push(`Madeira: <strong>${c.madeira}</strong>`);
        if (c.corMadeira) part.push(`Acabamento/Cor: <strong>${c.corMadeira}</strong>`);
        linhas.push(part.join(' | '));
    }
    if (c.estofado || c.corEstofado) {
        const part = [];
        if (c.estofado) part.push(`Estofado/Tecido: <strong>${c.estofado}</strong>`);
        if (c.corEstofado) part.push(`Cor: <strong>${c.corEstofado}</strong>`);
        linhas.push(part.join(' | '));
    }
    const m = c.medidas || {};
    const medArr = [];
    if (m.largura) medArr.push(`Largura: ${m.largura}`);
    if (m.altura) medArr.push(`Altura: ${m.altura}`);
    if (m.profundidade) medArr.push(`Profundidade: ${m.profundidade}`);
    if (medArr.length > 0) {
        linhas.push(`Medidas: <strong>${medArr.join(' x ')}</strong>`);
    }
    if (c.obsExtra) {
        linhas.push(`Detalhes/Extras: <strong>${c.obsExtra}</strong>`);
    }
    if (linhas.length === 0) return '';
    return `<div style="margin-top: 4px; padding: 4px 8px; background: #fafafa; border-left: 3px solid #d97706; font-size: 11px; color: #333;">${linhas.join('<br>')}</div>`;
}


// =========================================================================
// RELATÓRIO DO PDV & RESUMO DE OPERAÇÃO
// =========================================================================
window.abrirModalRelatorioPDV = function() {
    const modal = document.getElementById('modal-relatorio-pdv');
    if (!modal) return;

    const hoje = new Date();
    const hojeStr = hoje.toLocaleDateString('pt-BR');
    const dStart = new Date(hoje); dStart.setHours(0,0,0,0);
    const dEnd = new Date(hoje); dEnd.setHours(23,59,59,999);

    const todas = Array.isArray(db.vendas) ? db.vendas : [];
    const deHoje = todas.filter(v => {
        if (!v || !v.data) return false;
        const vd = new Date(v.data);
        return vd >= dStart && vd <= dEnd;
    });

    const vendasHoje = deHoje.filter(v => v.tipo !== 'ORÇAMENTO' && v.status !== 'CANCELADA');
    const orcamentosHoje = deHoje.filter(v => v.tipo === 'ORÇAMENTO' && v.status !== 'CANCELADA');

    const totalVendas = vendasHoje.reduce((acc, v) => acc + Number(v.tot || v.subtotal || 0), 0);
    const totalOrcamentos = orcamentosHoje.reduce((acc, v) => acc + Number(v.tot || v.subtotal || 0), 0);
    const totalGeral = totalVendas + totalOrcamentos;

    const elQtdVendas = document.getElementById('relatorio-pdv-qtd-vendas');
    const elTotVendas = document.getElementById('relatorio-pdv-total-vendas');
    const elQtdOrc = document.getElementById('relatorio-pdv-qtd-orcamentos');
    const elTotOrc = document.getElementById('relatorio-pdv-total-orcamentos');
    const elTotGeral = document.getElementById('relatorio-pdv-total-geral');
    const elDataExtenso = document.getElementById('relatorio-pdv-data-extenso');
    const elSub = document.getElementById('relatorio-pdv-subtitulo');
    const corpoTabela = document.getElementById('relatorio-pdv-tabela-corpo');

    const opAtual = (typeof window.obterOperadorAtual === 'function') ? window.obterOperadorAtual() : null;
    const opNome = (opAtual && opAtual.nome) || (window.currentUserInfo && window.currentUserInfo.nome) || 'Atendente';

    if (elSub) elSub.textContent = `Operador: ${opNome} | Data: ${hojeStr}`;
    if (elDataExtenso) elDataExtenso.textContent = hojeStr;

    if (elQtdVendas) elQtdVendas.textContent = vendasHoje.length;
    if (elTotVendas) elTotVendas.textContent = typeof formatMoney === 'function' ? formatMoney(totalVendas) : 'R$ ' + totalVendas.toFixed(2);
    if (elQtdOrc) elQtdOrc.textContent = orcamentosHoje.length;
    if (elTotOrc) elTotOrc.textContent = typeof formatMoney === 'function' ? formatMoney(totalOrcamentos) : 'R$ ' + totalOrcamentos.toFixed(2);
    if (elTotGeral) elTotGeral.textContent = typeof formatMoney === 'function' ? formatMoney(totalGeral) : 'R$ ' + totalGeral.toFixed(2);

    if (corpoTabela) {
        if (deHoje.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Nenhuma operação realizada hoje no PDV.</td></tr>';
        } else {
            deHoje.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));
            corpoTabela.innerHTML = deHoje.map(v => {
                const hora = v.data ? new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
                const numPed = '#' + String(v.numeroPedido || v.id || '0').padStart(4, '0');
                const tipo = v.tipo || 'VENDA';
                const cli = v.clienteNome || v.cliente || 'Consumidor Final';
                const st = v.status || 'CONCLUIDA';
                const tot = Number(v.tot || v.subtotal || 0);

                let badgeCor = 'bg-slate-100 text-slate-700';
                if (st === 'CONCLUIDA' || st === 'PAGO') badgeCor = 'bg-emerald-100 text-emerald-800';
                else if (st === 'AGUARDANDO_PAGAMENTO' || st === 'PENDENTE') badgeCor = 'bg-amber-100 text-amber-800';
                else if (st === 'ORCAMENTO') badgeCor = 'bg-blue-100 text-blue-800';
                else if (st === 'CANCELADA') badgeCor = 'bg-red-100 text-red-800';

                return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td class="p-2.5 font-mono text-slate-400">${hora}</td>
                        <td class="p-2.5 font-bold font-mono text-slate-700 dark:text-slate-200">${numPed} <span class="text-[9px] font-sans font-semibold text-slate-400">(${tipo})</span></td>
                        <td class="p-2.5 truncate max-w-[140px] text-slate-800 dark:text-slate-200" title="${cli}">${cli}</td>
                        <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase ${badgeCor}">${st.replace('_', ' ')}</span></td>
                        <td class="p-2.5 text-right font-black text-slate-800 dark:text-slate-100">${typeof formatMoney === 'function' ? formatMoney(tot) : 'R$ ' + tot.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    modal.classList.remove('hidden');
};

window.fecharModalRelatorioPDV = function() {
    const modal = document.getElementById('modal-relatorio-pdv');
    if (modal) modal.classList.add('hidden');
};

window.imprimirRelatorioPDV = function() {
    const emp = (typeof obterDadosEmpresa === 'function') ? obterDadosEmpresa() : { nome: 'FC Gestão', cnpj: '', tel: '', end: '' };
    const hoje = new Date();
    const hojeStr = hoje.toLocaleDateString('pt-BR');
    const dStart = new Date(hoje); dStart.setHours(0,0,0,0);
    const dEnd = new Date(hoje); dEnd.setHours(23,59,59,999);

    const todas = Array.isArray(db.vendas) ? db.vendas : [];
    const deHoje = todas.filter(v => {
        if (!v || !v.data) return false;
        const vd = new Date(v.data);
        return vd >= dStart && vd <= dEnd;
    });

    const vendasHoje = deHoje.filter(v => v.tipo !== 'ORÇAMENTO' && v.status !== 'CANCELADA');
    const orcamentosHoje = deHoje.filter(v => v.tipo === 'ORÇAMENTO' && v.status !== 'CANCELADA');
    const totalVendas = vendasHoje.reduce((acc, v) => acc + Number(v.tot || v.subtotal || 0), 0);
    const totalOrcamentos = orcamentosHoje.reduce((acc, v) => acc + Number(v.tot || v.subtotal || 0), 0);

    const htmlRelatorio = `
        <div style="font-family: Arial, sans-serif; color: #000; padding: 15px; max-width: 600px; margin: 0 auto; font-size: 12px;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px;">
                <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">${emp.nome}</h2>
                <h3 style="margin: 4px 0 0 0; font-size: 14px;">RELATÓRIO DIÁRIO DE OPERAÇÃO DO PDV</h3>
                <p style="margin: 2px 0; font-size: 11px;">Data: ${hojeStr} | Emissão: ${hoje.toLocaleTimeString('pt-BR')}</p>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border: 1px solid #000; padding: 10px; border-radius: 4px;">
                <div>
                    <strong>Total Pedidos / Vendas:</strong> ${vendasHoje.length}<br>
                    <strong>Valor Vendas:</strong> ${typeof formatMoney === 'function' ? formatMoney(totalVendas) : 'R$ ' + totalVendas.toFixed(2)}
                </div>
                <div style="text-align: right;">
                    <strong>Total Orçamentos:</strong> ${orcamentosHoje.length}<br>
                    <strong>Valor Orçamentos:</strong> ${typeof formatMoney === 'function' ? formatMoney(totalOrcamentos) : 'R$ ' + totalOrcamentos.toFixed(2)}
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
                <thead>
                    <tr style="border-bottom: 1px solid #000; background: #eee;">
                        <th style="padding: 5px; text-align: left;">Hora</th>
                        <th style="padding: 5px; text-align: left;">Pedido</th>
                        <th style="padding: 5px; text-align: left;">Cliente</th>
                        <th style="padding: 5px; text-align: center;">Status</th>
                        <th style="padding: 5px; text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${deHoje.map(v => `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 4px 5px;">${v.data ? new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                            <td style="padding: 4px 5px; font-weight: bold;">#${String(v.numeroPedido || v.id || '0').padStart(4, '0')} (${v.tipo || 'VENDA'})</td>
                            <td style="padding: 4px 5px;">${v.clienteNome || v.cliente || 'Consumidor'}</td>
                            <td style="padding: 4px 5px; text-align: center;">${v.status || 'CONCLUIDA'}</td>
                            <td style="padding: 4px 5px; text-align: right; font-weight: bold;">${typeof formatMoney === 'function' ? formatMoney(v.tot || v.subtotal || 0) : 'R$ ' + Number(v.tot || 0).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (typeof printHtmlSeguro === 'function') {
        printHtmlSeguro(htmlRelatorio, `Relatorio_PDV_${hojeStr.replace(/\//g, '-')}`);
    } else {
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(htmlRelatorio);
            win.document.close();
            win.focus();
            win.print();
        }
    }
};

// ==========================================
// FUNÇÕES DO MODAL DE CONFIGURAÇÃO RÁPIDA DE MARGEM NO PDV
// ==========================================
function abrirModalConfigMargemPDV() {
    const modal = document.getElementById('modal-config-margem-pdv');
    if (!modal) return;
    const inpMargem = document.getElementById('modal-pdv-margem-input');
    const inpAcao = document.getElementById('modal-pdv-acao-input');
    if (inpMargem) inpMargem.value = obterMargemMinimaConfigurada();
    if (inpAcao) inpAcao.value = obterAcaoAlertaMargem();
    modal.classList.remove('hidden');
}

function fecharModalConfigMargemPDV() {
    const modal = document.getElementById('modal-config-margem-pdv');
    if (modal) modal.classList.add('hidden');
}

async function salvarConfigMargemRapidaPDV() {
    const inpMargem = document.getElementById('modal-pdv-margem-input');
    const inpAcao = document.getElementById('modal-pdv-acao-input');
    const novaMargem = Math.max(0, parseFloat(inpMargem ? inpMargem.value : 15) || 0);
    const novaAcao = inpAcao ? inpAcao.value : 'alerta';

    if (!window.db.config) window.db.config = {};
    window.db.config.pdvMargemMinima = novaMargem;
    window.db.config.pdvAcaoAlertaMargem = novaAcao;

    try {
        if (typeof window.getEmpresaRef === 'function') {
            await window.getEmpresaRef().collection('configuracoes').doc('config').set({
                pdvMargemMinima: novaMargem,
                pdvAcaoAlertaMargem: novaAcao
            }, { merge: true });
        }
        if (typeof window.FCCache !== 'undefined') {
            window.FCCache.set('config', window.db.config);
            window.FCCache.set('configuracoes_config', window.db.config);
            window.FCCache.set('fc_moveis_config', window.db.config);
        }
        fecharModalConfigMargemPDV();
        const badge = document.getElementById('pdv-badge-margem-min');
        if (badge) badge.innerText = novaMargem + '%';
        renderCarrinho();
        pdvAtualizarTotais();
        showToast('Margem mínima do PDV atualizada para ' + novaMargem + '% com sucesso!', 'success');
    } catch(e) {
        console.error('Erro ao salvar configuração rápida de margem:', e);
        showToast('Erro ao salvar configuração no banco de dados.', 'error');
    }
}
window.abrirModalConfigMargemPDV = abrirModalConfigMargemPDV;
window.fecharModalConfigMargemPDV = fecharModalConfigMargemPDV;
window.salvarConfigMargemRapidaPDV = salvarConfigMargemRapidaPDV;

function pdvVerificarAlertaDescontoGlobal() {
    const margemMin = obterMargemMinimaConfigurada();
    if (margemMin <= 0 || !cart || cart.length === 0) return;
    const sub = cart.reduce((acc, i) => acc + (((i.preco || 0) * (i.qtd || 1)) - (i.desconto || 0)), 0);
    const desc = (typeof parseInputMoney === 'function' && document.getElementById('pdv-desconto')) ? (parseInputMoney(document.getElementById('pdv-desconto').value) || 0) : 0;
    if (desc <= 0) return;

    let piorItem = null;
    cart.forEach(it => {
        const subItem = Math.max(0, ((it.preco || 0) * (it.qtd || 1)) - (it.desconto || 0));
        const rateio = (sub > 0 && desc > 0) ? (subItem / sub) * desc : 0;
        const inf = calcularMargemLucroItem(it, rateio);
        if (inf.temDesconto && inf.custoTotal > 0 && inf.perc < margemMin) {
            if (!piorItem || inf.perc < piorItem.perc) piorItem = { nome: it.nome, perc: inf.perc };
        }
    });

    if (piorItem) {
        showToast(`⚠️ Atenção: O desconto aplicado em "${piorItem.nome}" ultrapassa o limite permitido!`, 'warning');
    }
}
window.pdvVerificarAlertaDescontoGlobal = pdvVerificarAlertaDescontoGlobal;

// Atalhos Ergonômicos de Teclado no PDV (F1, F2, F3, F4, F9, Esc)
if (!window._listenerPdvAtalhosAttached) {
    window._listenerPdvAtalhosAttached = true;
    window.addEventListener('keydown', function(e) {
        const viewPdv = document.getElementById('view-pdv');
        const isPdvVisivel = !viewPdv || (!viewPdv.classList.contains('hidden') && viewPdv.offsetParent !== null);
        if (!isPdvVisivel) return;

        // F1: Busca de Cliente
        if (e.key === 'F1') {
            e.preventDefault();
            const buscaCli = document.getElementById('pdv-cliente-busca');
            if (buscaCli) { buscaCli.focus(); buscaCli.select(); }
        }
        // F2: Busca de Produto / Leitor de Código de Barras
        else if (e.key === 'F2') {
            e.preventDefault();
            const buscaProd = document.getElementById('busca-produto-pdv');
            if (buscaProd) { buscaProd.focus(); buscaProd.select(); }
        }
        // F3: Desconto Global
        else if (e.key === 'F3') {
            e.preventDefault();
            const descInput = document.getElementById('pdv-desconto');
            if (descInput) { descInput.focus(); descInput.select(); }
        }
        // F4: Cancelar / Limpar Carrinho
        else if (e.key === 'F4') {
            e.preventDefault();
            if (typeof pdvLimpar === 'function' && Array.isArray(cart) && cart.length > 0) {
                if (typeof abrirConfirmacao === 'function') {
                    abrirConfirmacao('Limpar Carrinho (F4)', 'Deseja realmente esvaziar todos os itens do carrinho?', pdvLimpar);
                } else if (confirm('Deseja realmente esvaziar o carrinho?')) {
                    pdvLimpar();
                }
            }
        }
        // F9: Lançar / Finalizar Venda
        else if (e.key === 'F9') {
            const btnFinalizar = document.getElementById('btn-finalizar-venda');
            if (btnFinalizar && !btnFinalizar.disabled) {
                e.preventDefault();
                btnFinalizar.click();
            }
        }
        // Esc: Fechar modais abertos e retornar foco ao leitor
        else if (e.key === 'Escape') {
            const modaisAbertos = document.querySelectorAll('[id^="modal-"]:not(.hidden), #modal-confirmacao:not(.hidden)');
            if (modaisAbertos.length > 0) {
                modaisAbertos.forEach(m => m.classList.add('hidden'));
                const buscaProd = document.getElementById('busca-produto-pdv');
                if (buscaProd) setTimeout(() => buscaProd.focus(), 100);
            }
        }
    });

    // Auto-recuperação de foco no leitor de código de barras
    document.addEventListener('click', function(e) {
        const viewPdv = document.getElementById('view-pdv');
        const isPdvVisivel = !viewPdv || (!viewPdv.classList.contains('hidden') && viewPdv.offsetParent !== null);
        if (!isPdvVisivel) return;

        // Se nenhum modal estiver aberto e o clique não foi em outro input/select/textarea
        const modalAberto = document.querySelector('[id^="modal-"]:not(.hidden)');
        if (!modalAberto && e.target && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) {
            const buscaProd = document.getElementById('busca-produto-pdv');
            if (buscaProd && document.activeElement !== buscaProd) {
                buscaProd.focus();
            }
        }
    });
}

// ==========================================
// IMPORTAÇÃO DE PEDIDOS DA LOJA VIRTUAL / SITE
// ==========================================
function carregarPedidoDoSite(pedido) {
    if (!pedido || !pedido.itens || !Array.isArray(pedido.itens) || pedido.itens.length === 0) {
        if (typeof showToast === 'function') showToast('Pedido do site inválido ou sem itens.', 'error');
        return;
    }
    
    // Limpar carrinho atual ou confirmar se já houver itens
    if (cart.length > 0) {
        if (!confirm('O carrinho do PDV já possui itens. Deseja substituir pelos itens do pedido do site?')) {
            return;
        }
    }
    
    cart = [];
    pedido.itens.forEach(it => {
        const prodDb = (window.db && window.db.produtos) ? window.db.produtos.find(p => String(p.id) === String(it.id)) : null;
        cart.push({
            id: it.id || (prodDb ? prodDb.id : ('prod_' + Date.now())),
            nome: it.nome || (prodDb ? prodDb.nome : 'Produto'),
            preco: Number(it.preco) || (prodDb ? Number(prodDb.precoVenda || prodDb.preco || 0) : 0),
            custo: prodDb ? Number(prodDb.precoCusto || prodDb.custo || 0) : 0,
            desconto: Number(it.desconto) || 0,
            qtd: Number(it.qtd) || 1,
            foto: it.foto || (prodDb ? prodDb.foto : '') || '',
            obsVenda: it.obs || (pedido.numero ? `Site #${pedido.numero}` : 'Pedido Loja Virtual'),
            ncm: prodDb ? (prodDb.ncm || '') : '',
            cfop: prodDb ? (prodDb.cfop || '') : '',
            csosn: prodDb ? (prodDb.csosn || '') : '',
            origem: prodDb ? (prodDb.origem || '0') : '0',
            unidade: prodDb ? (prodDb.unidade || 'UN') : 'UN'
        });
    });

    window.cart = cart;
    if (typeof renderCarrinho === 'function') renderCarrinho();

    // Preenche cliente se houver
    if (pedido.cliente) {
        const cNome = typeof pedido.cliente === 'string' ? pedido.cliente : (pedido.cliente.nome || '');
        const inputBusca = document.getElementById('pdv-cliente-busca');
        if (inputBusca && cNome) {
            inputBusca.value = cNome;
            if (typeof autoSelecionarClientePorNome === 'function') {
                autoSelecionarClientePorNome();
            }
        }
    }

    // Observação do pedido
    const obsEl = document.getElementById('pdv-obs');
    if (obsEl && (pedido.observacoes || pedido.numero)) {
        obsEl.value = `[Pedido Site ${pedido.numero ? '#' + pedido.numero : ''}] ${pedido.observacoes || ''}`.trim();
    }

    if (typeof showToast === 'function') {
        showToast(`Pedido ${pedido.numero ? '#' + pedido.numero : ''} importado para o PDV com sucesso!`, 'success');
    }
}
window.carregarPedidoDoSite = carregarPedidoDoSite;

