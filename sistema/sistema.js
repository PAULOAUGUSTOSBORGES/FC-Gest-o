// ==========================================
// SISTEMA.JS - Lógica de Configurações, Tema, Empresa e Taxas 1 a 12x
// ==========================================

function inicializarSistema() {
    carregarConfiguracoesNaTela();
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

window.onload = () => {
    initGlobalData(inicializarSistema);
};

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
// BUSCA AUTOMÁTICA DE CNPJ NA RECEITA
// ==========================================
async function formatarEBuscarCNPJ(input) {
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
                
                // Preenche Nome Fantasia ou Razão Social
                document.getElementById('emp-nome').value = data.nome_fantasia || data.razao_social || '';
                
                // Preenche Telefone com DDD
                if(data.ddd_telefone_1) document.getElementById('emp-telefone').value = data.ddd_telefone_1;
                
                // Preenche Endereço formatado e outros campos
                if(data.cep) document.getElementById('emp-cep').value = data.cep;
                if(data.logradouro) document.getElementById('emp-rua').value = data.logradouro;
                if(data.numero) document.getElementById('emp-numero').value = data.numero;
                if(data.bairro) document.getElementById('emp-bairro').value = data.bairro;
                if(data.municipio) document.getElementById('emp-cidade').value = data.municipio;
                if(data.uf) document.getElementById('emp-uf').value = data.uf;
                if(data.codigo_municipio_ibge) document.getElementById('emp-ibge').value = data.codigo_municipio_ibge;
                
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

function carregarConfiguracoesNaTela() {
    if (!db.config) db.config = {};
    if (!db.config.empresa) db.config.empresa = { nome: 'FC Móveis e Interiores', fantasia: 'FC Móveis' };

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
        { prop: 'cscId', id: 'emp-csc-id' }
    ];

    mapaCampos.forEach(({ prop, id }) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = emp[prop] || '';
        }
    });

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
        setPrazo('prazo-credito', 'Cartão Crédito', 1);
        setPrazo('prazo-debito', 'Cartão Débito', 1);
    }

    // Carrega as 12 Taxas Separadas
    if (db.config.taxas) {
        if (document.getElementById('tx-boleto-custo')) {
            document.getElementById('tx-boleto-custo').value = db.config.custoBoleto || 0;
        }
        if (document.getElementById('tx-deb')) {
            document.getElementById('tx-deb').value = db.config.taxas['Cartão Débito'] || 0;
        }
        if (db.config.taxas['Cartão Crédito']) {
            for (let i = 1; i <= 12; i++) {
                const elTaxa = document.getElementById('tx-c' + i);
                if (elTaxa) {
                    elTaxa.value = db.config.taxas['Cartão Crédito'][i] || 0;
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
    
    db.config.tema = 'escuro';

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
        logo: document.getElementById('emp-logo-base64') ? document.getElementById('emp-logo-base64').value : ''
    };

    // Salva as 12 Taxas Separadas
    db.config.custoBoleto = parseFloat(document.getElementById('tx-boleto-custo').value) || 0;
    const tDeb = parseFloat(document.getElementById('tx-deb').value) || 0;
    const taxasCredito = {};
    for(let i=1; i<=12; i++) {
        taxasCredito[i] = parseFloat(document.getElementById('tx-c'+i).value) || 0;
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
        // Tema forçado, não é necessário salvar no localStorage
        localStorage.setItem('sistema_tema', 'escuro');
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

async function carregarCategorias() {
    try {
        const snap = await firestore.collection("categorias").get();
        db.categorias = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCategorias();
    } catch (err) {
        console.error("Erro ao carregar categorias:", err);
        showToast("Erro ao carregar: " + (err.message || err.code || err), "error");
    }
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


