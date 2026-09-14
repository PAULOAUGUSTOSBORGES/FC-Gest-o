// ==========================================
// SISTEMA.JS - Lógica de Configurações, Tema, Empresa e Taxas 1 a 12x
// ==========================================

function inicializarSistema() {
    // 1. Tenta preencher a tela imediatamente com o que já estiver no db.config
    carregarConfiguracoesNaTela();

    // 2. Conecta listener em tempo real com suporte a cache para fc_moveis/config:
    // Se o cache for válido, o callback roda na mesma hora.
    // Assim que o Firestore sincronizar ou mudar, a tela se atualiza automaticamente!
    const _listenDoc = (typeof window.fcListenDoc === 'function') ? window.fcListenDoc : function(col, id, cb) {
        return firestore.collection(col).doc(id).onSnapshot(doc => cb(doc.exists ? doc.data() : null));
    };

    _listenDoc('fc_moveis', 'config', function(dados) {
        if (dados) {
            db.config = {
                ...db.config,
                ...dados,
                empresa: { ...(db.config?.empresa || {}), ...(dados.empresa || {}) },
                taxas: dados.taxas || db.config?.taxas,
                prazos: dados.prazos || db.config?.prazos,
                loja: { ...(db.config?.loja || {}), ...(dados.loja || {}) }
            };
            if (typeof window.FCCache !== 'undefined') {
                window.FCCache.set('fc_moveis_config', db.config);
            }
            carregarConfiguracoesNaTela();
            if (typeof aplicarIdentidadeVisualGlobal === 'function') {
                aplicarIdentidadeVisualGlobal();
            }
        }
    });

    carregarCategorias();
    
    // Configura sincronização do color picker
    const picker = document.getElementById('loja-cor-primaria');
    const hex = document.getElementById('loja-cor-primaria-hex');
    if (picker && hex) {
        picker.addEventListener('input', (e) => {
            hex.value = e.target.value;
        });
    }
    
    // Auto-fix for string booleans in the database that break Firestore rules
    if (window.currentUserInfo && typeof window.currentUserInfo.isAdmin === 'string') {
        const uid = firebase.auth().currentUser.uid;
        firestore.collection("funcionarios").doc(uid).update({
            isAdmin: window.currentUserInfo.isAdmin === 'true',
            perm_cadastros: window.currentUserInfo.perm_cadastros === 'true' || window.currentUserInfo.perm_cadastros === true
        }).catch(console.error);
    }
}

window.addEventListener('load', () => { initGlobalData(inicializarSistema); });

// ==========================================
// FUNÇÕES DE UI E CORES
// ==========================================
window.sincronizarCor = function(input) {
    const picker = document.getElementById('loja-cor-primaria');
    let val = input.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (picker && val.match(/^#[0-9a-fA-F]{6}$/)) {
        picker.value = val;
    }
};

// ==========================================
// SELEÇÃO DE TEMA DO SISTEMA (CONFIGURAÇÃO)
// ==========================================
window.selecionarTemaSistema = function(tema) {
    if (tema !== 'dark' && tema !== 'light') tema = 'dark';
    
    // Aplicação síncrona imediata no DOM para feedback instantâneo
    const html = document.documentElement;
    const body = document.body;
    if (tema === 'light') {
        html.classList.remove('dark');
        html.classList.add('light');
        html.setAttribute('data-theme', 'light');
        if (body) { body.classList.remove('dark'); body.classList.add('light'); }
    } else {
        html.classList.add('dark');
        html.classList.remove('light');
        html.setAttribute('data-theme', 'dark');
        if (body) { body.classList.add('dark'); body.classList.remove('light'); }
    }
    localStorage.setItem('fc_theme_sistema', tema);
    
    // Chama o motor global para propagar para outras abas e atualizar botões
    if (typeof aplicarTemaSistema === 'function') {
        aplicarTemaSistema(tema, true);
    }
    
    atualizarCardsTemaTela(tema);
    if (typeof showToast === 'function') {
        showToast(`Modo ${tema === 'dark' ? 'Escuro' : 'Claro'} ativado em todo o sistema!`, 'success');
    }
};


window.atualizarCardsTemaTela = function(tema) {
    if (!tema) tema = localStorage.getItem('fc_theme_sistema') || 'dark';
    
    const cardDark = document.getElementById('card-tema-dark');
    const cardLight = document.getElementById('card-tema-light');
    const badgeDark = document.getElementById('badge-tema-dark');
    const badgeLight = document.getElementById('badge-tema-light');
    
    if (!cardDark || !cardLight) return;
    
    if (tema === 'dark') {
        cardDark.className = "relative border-2 border-blue-500 bg-blue-50/10 dark:bg-blue-950/40 ring-2 ring-blue-500 rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between";
        cardLight.className = "relative border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col justify-between opacity-75 hover:opacity-100";
        if (badgeDark) badgeDark.classList.remove('hidden');
        if (badgeLight) badgeLight.classList.add('hidden');
    } else {
        cardLight.className = "relative border-2 border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500 rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between";
        cardDark.className = "relative border-2 border-slate-200 dark:border-slate-700 bg-slate-900 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col justify-between opacity-75 hover:opacity-100";
        if (badgeLight) badgeLight.classList.remove('hidden');
        if (badgeDark) badgeDark.classList.add('hidden');
    }
};


// ==========================================
// BUSCA AUTOMÁTICA DE CNPJ NA RECEITA
// ==========================================
async function formatarEBuscarCNPJ(input) {
    if (!input) input = document.getElementById('emp-cnpj');
    if (!input) return;

    // Aplica máscara visual
    let valor = input.value.replace(/\D/g, '');
    if (valor.length > 14) valor = valor.slice(0, 14);
    
    let mascarado = valor;
    if (valor.length > 2) mascarado = valor.replace(/^(\d{2})(\d)/, "$1.$2");
    if (valor.length > 5) mascarado = mascarado.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    if (valor.length > 8) mascarado = mascarado.replace(/\.(\d{3})(\d)/, ".$1/$2");
    if (valor.length > 12) mascarado = mascarado.replace(/(\d{4})(\d)/, "$1-$2");
    
    input.value = mascarado;

    // Se tiver 14 números, faz a busca na API
    if (valor.length === 14) {
        showToast('Buscando CNPJ na Receita Federal...', 'info');
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${valor}`);
            if (response.ok) {
                const data = await response.json();
                
                // Preenche Razão Social e Nome Fantasia
                const elRazao = document.getElementById('emp-nome');
                const elFantasia = document.getElementById('emp-fantasia');
                if (elRazao) elRazao.value = data.razao_social || data.nome_fantasia || '';
                if (elFantasia) elFantasia.value = data.nome_fantasia || data.razao_social || '';
                
                // Preenche Telefone com DDD
                if (data.ddd_telefone_1 && document.getElementById('emp-telefone')) {
                    document.getElementById('emp-telefone').value = data.ddd_telefone_1;
                }
                
                // Preenche Endereço formatado e outros campos
                if (data.cep && document.getElementById('emp-cep')) document.getElementById('emp-cep').value = data.cep;
                if (data.logradouro && document.getElementById('emp-rua')) document.getElementById('emp-rua').value = data.logradouro;
                if (data.numero && document.getElementById('emp-numero')) document.getElementById('emp-numero').value = data.numero;
                if (data.bairro && document.getElementById('emp-bairro')) document.getElementById('emp-bairro').value = data.bairro;
                if (data.municipio && document.getElementById('emp-cidade')) document.getElementById('emp-cidade').value = data.municipio;
                if (data.uf && document.getElementById('emp-uf')) document.getElementById('emp-uf').value = data.uf;
                if (data.codigo_municipio_ibge && document.getElementById('emp-ibge')) document.getElementById('emp-ibge').value = data.codigo_municipio_ibge;
                
                showToast('Dados da empresa puxados com sucesso!', 'success');
            } else {
                showToast('CNPJ não encontrado na base.', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Erro ao consultar CNPJ. Digite manualmente.', 'error');
        }
    }
}
window.formatarEBuscarCNPJ = formatarEBuscarCNPJ;

async function buscarCEPEmpresa(input) {
    if (!input) input = document.getElementById('emp-cep');
    if (!input) return;
    let cep = input.value.replace(/\D/g, '');
    if (cep.length > 8) cep = cep.slice(0, 8);
    if (cep.length > 5) input.value = cep.replace(/^(\d{5})(\d)/, "$1-$2");
    else input.value = cep;
    
    if (cep.length === 8) {
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
            if (res.ok) {
                const data = await res.json();
                if (data.street && document.getElementById('emp-rua')) document.getElementById('emp-rua').value = data.street;
                if (data.neighborhood && document.getElementById('emp-bairro')) document.getElementById('emp-bairro').value = data.neighborhood;
                if (data.city && document.getElementById('emp-cidade')) document.getElementById('emp-cidade').value = data.city;
                if (data.state && document.getElementById('emp-uf')) document.getElementById('emp-uf').value = data.state;
                if (document.getElementById('emp-numero')) document.getElementById('emp-numero').focus();
                showToast('Endereço preenchido pelo CEP!', 'success');
            }
        } catch(e) { console.error("Erro ao buscar CEP:", e); }
    }
}
window.buscarCEPEmpresa = buscarCEPEmpresa;

function carregarConfiguracoesNaTela() {
    if (!db.config) db.config = {};
    if (!db.config.empresa) db.config.empresa = { nome: 'FC Móveis e Interiores', fantasia: 'FC Móveis' };

    // Carrega Tema Ativo nos Cards de Configuração
    const temaSalvo = localStorage.getItem('fc_theme_sistema') || (db.config && db.config.tema) || 'dark';
    atualizarCardsTemaTela(temaSalvo);

    // Carrega Dados da Empresa
    const emp = db.config.empresa;
    const mapaCampos = [
        { prop: 'nome', id: 'emp-nome' },
        { prop: 'fantasia', id: 'emp-fantasia' },
        { prop: 'cnpj', id: 'emp-cnpj' },
        { prop: 'telefone', id: 'emp-telefone' },
        { prop: 'cep', id: 'emp-cep' },
        { prop: 'rua', id: 'emp-rua' },
        { prop: 'numero', id: 'emp-numero' },
        { prop: 'bairro', id: 'emp-bairro' },
        { prop: 'cidade', id: 'emp-cidade' },
        { prop: 'uf', id: 'emp-uf' },
        { prop: 'ibge', id: 'emp-ibge' },
        { prop: 'ie', id: 'emp-ie' },
        { prop: 'im', id: 'emp-im' },
        { prop: 'crt', id: 'emp-crt' },
        { prop: 'cscToken', id: 'emp-csc-token' },
        { prop: 'cscId', id: 'emp-csc-id' },
        { prop: 'focusToken', id: 'emp-focus-token' },
        { prop: 'ambienteFiscal', id: 'emp-fiscal-ambiente', default: 'homologacao' },
        { prop: 'serieNFe', id: 'emp-serie-nfe', default: '1' },
        { prop: 'serieNFCe', id: 'emp-serie-nfce', default: '1' },
        { prop: 'naturezaOperacao', id: 'emp-natureza-operacao', default: 'VENDA DE MERCADORIA' },
        { prop: 'geminiKey', id: 'emp-gemini-key' }
    ];

    mapaCampos.forEach(({ prop, id, default: defVal }) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = emp[prop] !== undefined ? emp[prop] : (defVal || '');
        }
    });

    if (document.getElementById('emp-fiscal-ativo')) {
        document.getElementById('emp-fiscal-ativo').checked = emp.fiscalAtivo !== false;
    }

    if (document.getElementById('emp-logo-base64')) {
        document.getElementById('emp-logo-base64').value = emp.logo || '';
    }
    
    if (emp.logo && document.getElementById('emp-logo-preview')) {
        document.getElementById('emp-logo-preview').src = emp.logo;
        document.getElementById('emp-logo-preview').classList.remove('hidden');
        if (document.getElementById('emp-logo-text')) {
            document.getElementById('emp-logo-text').classList.add('hidden');
        }
    }

    // Carrega Prazos Padrão
    if (db.config.prazos) {
        const setPrazo = (id, field, def) => {
            const el = document.getElementById(id);
            if (el) el.value = db.config.prazos[field] !== undefined ? db.config.prazos[field] : def;
        };
        setPrazo('prazo-fiado', 'Fiado', 30);
        setPrazo('prazo-boleto', 'Boleto', 30);
        const pCred = db.config.prazos['Cartão Crédito'] !== undefined ? db.config.prazos['Cartão Crédito'] : (db.config.prazos['Cartao Credito'] !== undefined ? db.config.prazos['Cartao Credito'] : 1);
        const elPCred = document.getElementById('prazo-credito');
        if (elPCred) elPCred.value = pCred;

        const pDeb = db.config.prazos['Cartão Débito'] !== undefined ? db.config.prazos['Cartão Débito'] : (db.config.prazos['Cartao Debito'] !== undefined ? db.config.prazos['Cartao Debito'] : 1);
        const elPDeb = document.getElementById('prazo-debito');
        if (elPDeb) elPDeb.value = pDeb;
    }

    // Carrega as 12 Taxas Separadas
    if (db.config.taxas) {
        if (document.getElementById('tx-boleto-custo')) {
            const valBoleto = db.config.custoBoleto !== undefined ? db.config.custoBoleto : 0;
            document.getElementById('tx-boleto-custo').value = typeof formatMoneyInput === 'function' ? formatMoneyInput(valBoleto) : valBoleto;
        }
        const txDeb = db.config.taxas['Cartão Débito'] !== undefined ? db.config.taxas['Cartão Débito'] : db.config.taxas['Cartao Debito'];
        if (document.getElementById('tx-deb') && txDeb !== undefined) {
            document.getElementById('tx-deb').value = typeof formatMoneyInput === 'function' ? formatMoneyInput(txDeb) : txDeb;
        }
        const txCred = db.config.taxas['Cartão Crédito'] || db.config.taxas['Cartao Credito'];
        if (txCred) {
            for (let i = 1; i <= 12; i++) {
                const elTaxa = document.getElementById('tx-c' + i);
                if (elTaxa) {
                    const valCred = txCred[i] !== undefined ? txCred[i] : (txCred[String(i)] !== undefined ? txCred[String(i)] : 0);
                    elTaxa.value = typeof formatMoneyInput === 'function' ? formatMoneyInput(valCred) : valCred;
                }
            }
        }
    }

    // Carrega Dados da Loja
    if (db.config.loja) {
        if (document.getElementById('loja-ativa')) {
            document.getElementById('loja-ativa').checked = db.config.loja.ativa !== false;
        }
        ['nome', 'slogan', 'descricao', 'banner-titulo', 'banner-subtitulo', 'btn-cta', 'cor-primaria', 'cor-primaria-hex', 'titulo-produtos', 'titulo-sobre', 'rodape', 'whatsapp', 'whatsapp-msg', 'instagram', 'facebook', 'maps'].forEach(campo => {
            const el = document.getElementById('loja-' + campo);
            if (el) {
                el.value = db.config.loja[campo] || '';
            }
        });
        if (db.config.loja['cor-primaria']) {
            const picker = document.getElementById('loja-cor-primaria');
            const hex = document.getElementById('loja-cor-primaria-hex');
            if (picker) picker.value = db.config.loja['cor-primaria'];
            if (hex) hex.value = db.config.loja['cor-primaria'];
        }
    }
}
window.carregarConfiguracoesNaTela = carregarConfiguracoesNaTela;

function processarLogoEmpresa(event) {
    const file = event.target.files[0]; if(!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image(); img.onload = function() {
            const canvas = document.createElement('canvas'); let w = img.width, h = img.height; const MAX = 300; 
            if(w > h) { if(w > MAX) { h *= MAX/w; w = MAX; } } else { if(h > MAX) { w *= MAX/h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/png', 0.9);
            
            document.getElementById('emp-logo-base64').value = dataUrl;
            document.getElementById('emp-logo-preview').src = dataUrl;
            document.getElementById('emp-logo-preview').classList.remove('hidden');
            document.getElementById('emp-logo-text').classList.add('hidden');
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
}

async function salvarConfiguracoes() {
    if(!db.config) db.config = {};
    
    const temaEscolhido = localStorage.getItem('fc_theme_sistema') || 'dark';
    db.config.tema = temaEscolhido;
    db.config.aparencia = { tema: temaEscolhido };

    db.config.empresa = {
        nome: document.getElementById('emp-nome') ? document.getElementById('emp-nome').value.trim() : '',
        fantasia: document.getElementById('emp-fantasia') ? document.getElementById('emp-fantasia').value.trim() : '',
        cnpj: document.getElementById('emp-cnpj') ? document.getElementById('emp-cnpj').value.trim() : '',
        telefone: document.getElementById('emp-telefone') ? document.getElementById('emp-telefone').value.trim() : '',
        cep: document.getElementById('emp-cep') ? document.getElementById('emp-cep').value.trim() : '',
        rua: document.getElementById('emp-rua') ? document.getElementById('emp-rua').value.trim() : '',
        numero: document.getElementById('emp-numero') ? document.getElementById('emp-numero').value.trim() : '',
        bairro: document.getElementById('emp-bairro') ? document.getElementById('emp-bairro').value.trim() : '',
        cidade: document.getElementById('emp-cidade') ? document.getElementById('emp-cidade').value.trim() : '',
        uf: document.getElementById('emp-uf') ? document.getElementById('emp-uf').value.trim() : '',
        ibge: document.getElementById('emp-ibge') ? document.getElementById('emp-ibge').value.trim() : '',
        ie: document.getElementById('emp-ie') ? document.getElementById('emp-ie').value.trim() : '',
        im: document.getElementById('emp-im') ? document.getElementById('emp-im').value.trim() : '',
        crt: document.getElementById('emp-crt') ? document.getElementById('emp-crt').value.trim() : '',
        cscToken: document.getElementById('emp-csc-token') ? document.getElementById('emp-csc-token').value.trim() : '',
        cscId: document.getElementById('emp-csc-id') ? document.getElementById('emp-csc-id').value.trim() : '',
        fiscalAtivo: document.getElementById('emp-fiscal-ativo') ? document.getElementById('emp-fiscal-ativo').checked : true,
        ambienteFiscal: document.getElementById('emp-fiscal-ambiente') ? document.getElementById('emp-fiscal-ambiente').value : 'homologacao',
        focusToken: document.getElementById('emp-focus-token') ? document.getElementById('emp-focus-token').value.trim() : '',
        serieNFe: document.getElementById('emp-serie-nfe') ? document.getElementById('emp-serie-nfe').value.trim() : '1',
        serieNFCe: document.getElementById('emp-serie-nfce') ? document.getElementById('emp-serie-nfce').value.trim() : '1',
        naturezaOperacao: document.getElementById('emp-natureza-operacao') ? document.getElementById('emp-natureza-operacao').value.trim() : 'VENDA DE MERCADORIA',
        geminiKey: document.getElementById('emp-gemini-key') ? document.getElementById('emp-gemini-key').value.trim() : '',
        logo: document.getElementById('emp-logo-base64') ? document.getElementById('emp-logo-base64').value : ''
    };

    // Salva as 12 Taxas Separadas
    db.config.custoBoleto = parseInputMoney(document.getElementById('tx-boleto-custo').value) || 0;
    const tDeb = parseInputMoney(document.getElementById('tx-deb').value) || 0;
    const taxasCredito = {};
    for(let i=1; i<=12; i++) {
        taxasCredito[i] = parseInputMoney(document.getElementById('tx-c'+i).value) || 0;
    }

    db.config.taxas = {
        'Dinheiro': 0, 'PIX': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Débito': tDeb,
        'Cartão Crédito': taxasCredito
    };

    const getPrazo = (id, def) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const val = parseInt(el.value);
        return isNaN(val) ? def : val;
    };

    db.config.prazos = {
        'Fiado': getPrazo('prazo-fiado', 30),
        'Boleto': getPrazo('prazo-boleto', 30),
        'Cartão Crédito': getPrazo('prazo-credito', 1),
        'Cartão Débito': getPrazo('prazo-debito', 1)
    };

    // Salva Dados da Loja
    db.config.loja = {
        ativa: document.getElementById('loja-ativa') ? document.getElementById('loja-ativa').checked : false,
    };
    ['nome', 'slogan', 'descricao', 'banner-titulo', 'banner-subtitulo', 'btn-cta', 'cor-primaria', 'cor-primaria-hex', 'titulo-produtos', 'titulo-sobre', 'rodape', 'whatsapp', 'whatsapp-msg', 'instagram', 'facebook', 'maps'].forEach(campo => {
        const el = document.getElementById('loja-' + campo);
        if(el) {
            db.config.loja[campo] = el.value.trim();
        }
    });

    try {
        await firestore.collection('fc_moveis').doc('config').set(db.config, { merge: true });
        if (typeof window.FCCache !== 'undefined') {
            window.FCCache.set('fc_moveis_config', db.config);
        }
        if (typeof aplicarIdentidadeVisualGlobal === 'function') {
            aplicarIdentidadeVisualGlobal();
        }
        localStorage.setItem('fc_theme_sistema', temaEscolhido);
        showToast('Configurações salvas com sucesso!', 'success');
        setTimeout(() => { window.location.reload(); }, 800);
    } catch(err) {
        console.error(err);
        showToast('Erro ao salvar configurações.', 'error');
    }
}

// ==========================================
// GESTÃO DE CATEGORIAS E SUBCATEGORIAS
// ==========================================

function carregarCategorias() {
    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb) {
        return firestore.collection(col).onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };

    _listen('categorias', function(dados) {
        db.categorias = dados || [];
        renderCategorias();
    });
}

function renderCategorias() {
    const container = document.getElementById('lista-categorias-container');
    if (!container) return;
    
    if (!db.categorias || db.categorias.length === 0) {
        container.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm">Nenhuma categoria cadastrada.</div>';
        return;
    }
    
    container.innerHTML = db.categorias.map(cat => `
        <div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <div class="flex justify-between items-center mb-3">
                <h4 class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <i class="fa-solid fa-folder text-yellow-500"></i> ${cat.nome}
                </h4>
                <button onclick="excluirCategoria('${cat.id}')" class="text-red-500 hover:text-red-700 text-sm" title="Excluir Categoria">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            
            <div class="pl-6 space-y-2 mb-3">
                ${(Array.isArray(cat.subcategorias) ? cat.subcategorias : []).map((sub, idx) => `
                    <div class="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 border-l-2 border-slate-300 dark:border-slate-600 pl-3 py-1">
                        <span><i class="fa-solid fa-folder-tree mr-1 text-slate-400"></i> ${sub}</span>
                        <button onclick="excluirSubcategoria('${cat.id}', ${idx})" class="text-red-400 hover:text-red-600">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
            
            <div class="pl-6 flex gap-2">
                <input type="text" id="nova-sub-${cat.id}" class="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-1.5 rounded text-xs outline-none focus:border-blue-500 dark:text-white" placeholder="Nova Subcategoria">
                <button onclick="adicionarSubcategoria('${cat.id}')" class="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                    Adicionar
                </button>
            </div>
        </div>
    `).join('');
}

async function adicionarCategoria() {
    const input = document.getElementById('nova-categoria-nome');
    const nome = input.value.trim();
    if (!nome) return showToast("Digite o nome da categoria", "error");
    
    // Verifica se já existe
    if (db.categorias.find(c => c.nome.toLowerCase() === nome.toLowerCase())) {
        return showToast("Esta categoria já existe", "error");
    }
    
    try {
        const nova = { nome: nome, subcategorias: [] };
        const docRef = await firestore.collection("categorias").add(nova);
        db.categorias.push({ id: docRef.id, ...nova });
        input.value = '';
        renderCategorias();
        showToast("Categoria adicionada com sucesso", "success");
    } catch (err) {
        console.error(err);
        showToast("Erro ao adicionar categoria", "error");
    }
}

async function excluirCategoria(id) {
    if (!confirm("Tem certeza que deseja excluir esta categoria inteira? Todos os produtos nela ficarão 'Sem Categoria'.")) return;
    
    try {
        await firestore.collection("categorias").doc(id).delete();
        db.categorias = db.categorias.filter(c => c.id !== id);
        renderCategorias();
        showToast("Categoria excluída", "success");
    } catch (err) {
        console.error(err);
        showToast("Erro ao excluir", "error");
    }
}

async function adicionarSubcategoria(catId) {
    const input = document.getElementById(`nova-sub-${catId}`);
    const nome = input.value.trim();
    if (!nome) return showToast("Digite o nome da subcategoria", "error");
    
    const cat = db.categorias.find(c => c.id === catId);
    if (!cat) return;
    
    if ((cat.subcategorias || []).map(s => s.toLowerCase()).includes(nome.toLowerCase())) {
        return showToast("Subcategoria já existe nesta categoria", "error");
    }
    
    cat.subcategorias = cat.subcategorias || [];
    cat.subcategorias.push(nome);
    
    try {
        await firestore.collection("categorias").doc(catId).update({ subcategorias: cat.subcategorias });
        input.value = '';
        renderCategorias();
        showToast("Subcategoria adicionada", "success");
    } catch (err) {
        console.error(err);
        showToast("Erro ao adicionar subcategoria", "error");
    }
}

async function excluirSubcategoria(catId, index) {
    const cat = db.categorias.find(c => c.id === catId);
    if (!cat) return;
    
    if (!confirm(`Excluir a subcategoria '${cat.subcategorias[index]}'?`)) return;
    
    cat.subcategorias.splice(index, 1);
    
    try {
        await firestore.collection("categorias").doc(catId).update({ subcategorias: cat.subcategorias });
        renderCategorias();
        showToast("Subcategoria excluída", "success");
    } catch (err) {
        console.error(err);
        showToast("Erro ao excluir subcategoria", "error");
    }
}




