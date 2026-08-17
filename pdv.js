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

// Evita o "piscar" da tela carregando as abas instantaneamente antes do Firebase
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'pdv';
    if (typeof mudarVisaoLocal === 'function') mudarVisaoLocal(view);
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
    const empNomeEl = document.getElementById('menu-empresa-nome');
    const logoImg = document.getElementById('menu-logo');
    const logoPlaceholder = document.getElementById('menu-logo-placeholder');

    if (db.config && db.config.empresa) {
        if (empNomeEl && db.config.empresa.nome) {
            empNomeEl.innerText = db.config.empresa.nome;
        }
        if (logoImg && logoPlaceholder && db.config.empresa.logo) {
            logoImg.src = db.config.empresa.logo;
            logoImg.classList.remove('hidden');
            logoPlaceholder.classList.add('hidden');
        }
    }
}

function obterDadosClientePDV(cId) {
    const c = cId && cId !== "0" && db.clientes ? db.clientes.find(x => String(x.id) === String(cId)) : null;
    if(!c) return { nome: 'Consumidor Final', doc: 'Não informado', tel: 'Não informado', endCompleto: 'Não informado', bairro: '', cidade: '', cep: '' };
    
    const doc = c.cpfCnpj || c.documento || c.cnpj || c.cpf || c.doc || c.cpf_cnpj || 'Não informado';
    const tel = c.whatsapp || c.wpp || c.celular || c.telefone || c.telefoneFixo || c.tel || 'Não informado';
    
    const rua = c.rua || c.logradouro || c.endereco || c.end || '';
    const num = c.numero ? ', ' + c.numero : '';
    const endCompleto = rua ? (rua + num) : 'Não informado';
    
    return {
        nome: c.nome || c.razaoSocial || 'Consumidor Final',
        doc: doc,
        tel: tel,
        endCompleto: endCompleto,
        bairro: c.bairro || 'Não informado',
        cidade: c.cidade || 'Não informado',
        cep: c.cep || 'Não informado'
    };
}

// ==========================================
// 2. INICIALIZAÇÃO E NAVEGAÇÃO
// ==========================================
function mudarVisaoLocal(viewId) {
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
    
    if (viewId === 'pdv') prepararPDV();
    if (viewId === 'vendas') renderVendas();
    if (viewId === 'orcamentos') renderOrcamentos();
}

function inicializarOperação() {
    aplicarIdentidadeVisualNoMenu(); 
    
    firestore.collection('produtos').onSnapshot(snap => {
        db.produtos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    firestore.collection('clientes').onSnapshot(snap => {
        db.clientes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        atualizarListaClientesPDV();
    });
    firestore.collection('vendas').onSnapshot(snap => {
        db.vendas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const v = document.getElementById('view-vendas');
        const o = document.getElementById('view-orcamentos');
        if(v && v.classList.contains('active')) renderVendas();
        if(o && o.classList.contains('active')) renderOrcamentos();
    });
    firestore.collection('fc_moveis').doc('caixa').onSnapshot(doc => {
        if(doc.exists) db.caixa = doc.data();
        else db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
        const badgeCaixa = document.getElementById('pdv-status-caixa');
        if (badgeCaixa) prepararPDV();
    });
    firestore.collection('financeiro').onSnapshot(snap => {
        db.financeiro = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    firestore.collection('funcionarios').onSnapshot(snap => {
        db.funcionarios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        atualizarVendedoresPDV();
    });

    const urlParams = new URLSearchParams(window.location.search);
    mudarVisaoLocal('pdv');
}

window.onload = () => { initGlobalData(inicializarOperação); };

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
function atualizarListaClientesPDV(selecionarId = null) {
    const hiddenId = document.getElementById('pdv-cliente');
    const inputBusca = document.getElementById('pdv-cliente-busca');
    
    if (!hiddenId || !inputBusca) return;

    if(selecionarId && selecionarId !== '0') {
        const c = (db.clientes || []).find(x => String(x.id) === String(selecionarId));
        if(c) {
            hiddenId.value = c.id;
            inputBusca.value = c.nome;
        }
    } else {
        hiddenId.value = '0';
        inputBusca.value = '';
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
            (c.cpfCnpj && c.cpfCnpj.includes(busca))
        );
    }

    const divConsumidor = document.createElement('div');
    divConsumidor.className = 'p-3 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900';
    divConsumidor.innerHTML = `<i class="fa-solid fa-user text-slate-400 mr-2"></i>Consumidor Final (Padrão)`;
    divConsumidor.onclick = () => {
        document.getElementById('pdv-cliente').value = '0';
        document.getElementById('pdv-cliente-busca').value = '';
        dropdown.classList.add('hidden');
    };
    dropdown.appendChild(divConsumidor);

    filtrados.forEach(c => {
        const div = document.createElement('div');
        div.className = 'p-3 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 text-sm flex flex-col transition-colors';
        
        const docs = c.cpfCnpj || c.documento || 'Sem documento';
        const fone = c.wpp || c.telefone || 'Sem telefone';
        const end = c.endereco || c.cidade || 'Sem endereço';
        
        div.innerHTML = `
            <div class="flex flex-col">
                <span class="font-bold text-slate-800 dark:text-slate-100">${c.nome}</span>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] text-slate-500 dark:text-slate-400">
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded whitespace-nowrap"><i class="fa-solid fa-id-card mr-1 text-slate-400"></i>${docs}</span>
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded whitespace-nowrap"><i class="fa-brands fa-whatsapp mr-1 text-emerald-500"></i>${fone}</span>
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[200px]" title="${end}"><i class="fa-solid fa-location-dot mr-1 text-slate-400"></i>${end}</span>
                </div>
            </div>
        `;
        div.onclick = () => {
            document.getElementById('pdv-cliente').value = c.id;
            document.getElementById('pdv-cliente-busca').value = c.nome;
        };
        dropdown.appendChild(div);
    });

    dropdown.classList.remove('hidden');
}

function abrirModalClienteRapido() {
    document.getElementById('cli-id').value = '';
    document.getElementById('cli-nome').value = '';
    document.getElementById('cli-doc').value = '';
    document.getElementById('cli-rg').value = '';
    document.getElementById('cli-nasc').value = '';
    document.getElementById('cli-wpp').value = '';
    document.getElementById('cli-fixo').value = '';
    document.getElementById('cli-email').value = '';
    document.getElementById('cli-cep').value = '';
    document.getElementById('cli-rua').value = '';
    document.getElementById('cli-numero').value = '';
    document.getElementById('cli-complemento').value = '';
    document.getElementById('cli-bairro').value = '';
    document.getElementById('cli-cidade').value = '';
    document.getElementById('cli-ibge').value = '';
    document.getElementById('cli-obs').value = '';
    document.getElementById('cli-historico-body').innerHTML = '<tr><td colspan="4" class="text-center p-4 text-slate-400">Nenhum histórico</td></tr>';
    
    document.getElementById('modal-cliente-title').innerText = 'Novo Cliente';
    abaModal('cli', 'dados');
    document.getElementById('modal-cliente').classList.remove('hidden');
}

function fecharModalCliente() {
    document.getElementById('modal-cliente').classList.add('hidden');
}

async function buscarCEP(prefix) {
    const el = document.getElementById(`${prefix}-cep`); if (!el) return; let cep = el.value.replace(/\D/g, ''); if (cep.length !== 8) return;
    try { let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); let data = await res.json(); if (!data.erro) { document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.localidade} - ${data.uf}`; } } catch (e) { }
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
        cep: document.getElementById('cli-cep').value.trim(),
        rua: document.getElementById('cli-rua').value.trim(),
        numero: document.getElementById('cli-numero').value.trim(),
        complemento: document.getElementById('cli-complemento').value.trim(),
        bairro: document.getElementById('cli-bairro').value.trim(),
        cidade: document.getElementById('cli-cidade').value.trim(),
        ibge: document.getElementById('cli-ibge').value.trim(),
        obs: document.getElementById('cli-obs').value.trim(),
        dataCadastro: new Date().toISOString()
    };

    try {
        const docRef = await firestore.collection('clientes').add(dados);
        fecharModalCliente();
        atualizarListaClientesPDV(docRef.id);
        showToast('Cliente cadastrado e selecionado!', 'success');
    } catch(err) {
        console.error(err);
        showToast('Erro ao cadastrar cliente.', 'error');
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
    const idEl = document.getElementById('prod-id');
    const nomeEl = document.getElementById('prod-nome');
    const precoEl = document.getElementById('prod-preco');
    if(!nomeEl || !precoEl) return showToast('Erro no formulário.', 'error');
    const nome = nomeEl.value.trim(); const preco = parseFloat(precoEl.value);
    if(!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

    const ean = document.getElementById('prod-ean') ? document.getElementById('prod-ean').value : '';
    const marca = document.getElementById('prod-marca') ? document.getElementById('prod-marca').value : '';
    const custo = document.getElementById('prod-custo') ? parseFloat(document.getElementById('prod-custo').value) : 0;
    const estoque = document.getElementById('prod-estoque') ? parseFloat(document.getElementById('prod-estoque').value) : 0;
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
            await firestore.collection('produtos').doc(pId).update(p);
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
            const docRef = await firestore.collection('produtos').add(p);
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
    if (window.vendaAtualImpressao) { imprimirContratoObj(window.vendaAtualImpressao); } else { showToast("Nenhuma venda selecionada para imprimir.", "error"); }
}

function imprimirContratoById(id) { 
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(v) imprimirContratoObj(v); 
}

// CORREÇÃO: Variável cliTel e Telefone do Whatsapp blindados!
function enviarPDFWhatsApp(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error');

    const cliInfo = obterDadosClientePDV(v.clienteId);
    
    // Garantindo que a variável existe
    const cliNome = v.clienteNome || cliInfo.nome || 'Consumidor Final';
    const cliCpf = v.clienteDoc || cliInfo.doc || 'Não informado';
    const cliTel = v.clienteTel || cliInfo.tel || ''; 
    const cliEndCompleto = v.clienteEnd || cliInfo.endCompleto || 'Não informado';
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
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${(v.itens || []).map(i => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px;">
                            <strong>${i.nome || 'Produto/Serviço'}</strong>
                            ${i.obsVenda ? `<br><span style="font-size: 11px; color: #475569; font-style: italic;">Obs: ${i.obsVenda}</span>` : ''}
                        </td>
                        <td style="padding: 8px; text-align: center;">${i.qtd || 1}</td>
                        <td style="padding: 8px; text-align: right; font-weight: bold;">${formatMoney((i.preco || 0) * (i.qtd || 1))}</td>
                    </tr>
                `).join('')}
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
    const cliNome = v.clienteNome || cliInfo.nome || 'Consumidor Final';
    const cliCpf = v.clienteDoc || cliInfo.doc || 'Não informado';
    const cliTel = v.clienteTel || cliInfo.tel || 'Não informado';
    const cliEndCompleto = v.clienteEnd || cliInfo.endCompleto || 'Não informado';

    let itensHtml = (v.itens || []).map((i, idx) => {
        const prodDb = (db.produtos || []).find(p => String(p.id) === String(i.id));
        const fotoHtml = prodDb && prodDb.foto ? `<div style="margin-right: 15px; flex-shrink: 0;"><img src="${prodDb.foto}" style="width: 90px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;"></div>` : '';
        return `
        <div style="margin-bottom: 15px; display: flex; align-items: flex-start; border-bottom: 1px dashed #eee; padding-bottom: 10px;">
            ${fotoHtml}
            <div style="flex: 1;">
                <strong>PRODUTO/SERVIÇO ${idx + 1}</strong><br>
                Descrição: ${i.nome} ${i.obsVenda ? ` - Obs: ${i.obsVenda}` : ''}<br>
                Quantidade: ${i.qtd} unidade(s)<br>
                Valor: ${formatMoney(i.preco * i.qtd)}<br>
                Situação do produto: ( ) Produto em estoque &nbsp;&nbsp;&nbsp; ( ) Produto sob fabricação
            </div>
        </div>
        `;
    }).join('');

    const prazoOs = v.servicoDetalhes && v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : '___/___/20__';
    const dataEmissaoOperação = v.data ? new Date(v.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

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
            <strong>Valor total:</strong> ${formatMoney(v.tot)}<br>
            <strong>Forma de pagamento registrada:</strong> ${v.pag || '_________________________________'}<br>
            <strong>Data da Operação:</strong> ${dataEmissaoOperação}
        </p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">PRAZO DE ENTREGA E GARANTIA</h3>
        <p style="margin-top: 0; text-align: justify;">Caso o produto esteja disponível em estoque, o prazo de entrega será de até 3 (três) dias úteis após a confirmação do pagamento.<br>Caso o produto seja fabricado sob encomenda, o prazo de produção e entrega será de até 30 (trinta) dias corridos após a confirmação do pedido e pagamento da entrada.<br>O produto/serviço possui garantia legal de 90 (noventa) dias contra defeitos de fabricação.<br>Os prazos poderão sofrer alterações em casos de força maior, problemas logísticos, transporte, fornecedores ou condições climáticas.</p>

        <h3 style="font-size: 14px; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; margin-bottom: 10px;">LOCAL DE ENTREGA</h3>
        <p style="margin-top: 0;"><strong>Endereço:</strong> ${cliEndCompleto}<br><strong>Data prevista:</strong> ${prazoOs}</p>

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
    buscaInput.value = decodedText; 
    const prod = db.produtos.find(x => String(x.ean) === decodedText || String(x.id) === decodedText); 
    
    if(prod && prod.ativo !== false) { 
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
function prepararPDV() {
    if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
    
    const opSelect = document.getElementById('pdv-operação'); 
    if(opSelect) { 
        opSelect.addEventListener('change', () => { 
            atualizarResumoPagamentosVenda(); 
            togglePanelServico(); 
        }); 
    }
    
    atualizarListaClientesPDV();
    
    document.getElementById('pdv-busca-resultados').classList.add('hidden'); 
    document.getElementById('pdv-produto-busca').value = '';
    
    const badgeCaixa = document.getElementById('pdv-status-caixa');
    if(db.caixa.status === 'ABERTO') { 
        badgeCaixa.className = "bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; 
        badgeCaixa.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Caixa Aberto'; 
    } else { 
        badgeCaixa.className = "bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; 
        badgeCaixa.innerHTML = '<i class="fa-solid fa-lock mr-1"></i> Caixa Fechado'; 
    }
    
    togglePanelServico();
}

function togglePanelServico() {
    const op = document.getElementById('pdv-operação'); 
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

function filtrarProdutosPDV(termo) {
    const dropdown = document.getElementById('pdv-busca-resultados'); 
    if (!dropdown) return; 
    
    dropdown.innerHTML = '';
    const listaProdutos = db.produtos || []; 
    const busca = termo ? String(termo).trim().toLowerCase() : '';
    
    const produtosFiltrados = busca === '' ? listaProdutos : listaProdutos.filter(p => { 
        const nomeStr = p.nome ? String(p.nome).toLowerCase() : ''; 
        const eanStr = p.ean ? String(p.ean) : ''; 
        return (nomeStr.includes(busca) || eanStr === busca) && p.ativo !== false; 
    });
    
    const limitados = produtosFiltrados.slice(0, 50);
    if (limitados.length === 0) { 
        dropdown.classList.add('hidden'); 
        return; 
    }
    
    limitados.forEach(prod => {
        if(prod.ativo === false) return; 
        
        const div = document.createElement('div'); 
        div.className = 'p-3 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 text-sm flex justify-between items-center transition-colors';
        const precoFormatado = Number(prod.preco || 0).toFixed(2).replace('.', ','); 
        const nomeProd = prod.nome || 'Produto Sem Nome';
        
        div.innerHTML = `<span class="font-medium text-slate-700 dark:text-slate-200">${nomeProd}</span> <span class="font-bold text-emerald-600">R$ ${precoFormatado}</span>`;
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
    const op = document.getElementById('pdv-operação') ? document.getElementById('pdv-operação').value : 'Venda'; 
    const isOrcamento = op === 'Orçamento';
    const idx = cart.findIndex(i => String(i.id) === String(p.id)); 
    
    if(idx >= 0) { 
        cart[idx].qtd++; 
        if(!isOrcamento && cart[idx].qtd > (p.estoque || 0)) {
            showToast(`Estoque NEGATIVO! Restam ${p.estoque || 0}.`, 'info'); 
        }
    } else { 
        cart.push({ id: p.id || '', nome: p.nome || 'Produto', preco: Number(p.preco) || 0, custo: Number(p.custo) || 0, qtd: 1, foto: p.foto || '', obsVenda: '' }); 
        if(!isOrcamento && (p.estoque || 0) < 1) {
            showToast(`Estoque NEGATIVO!`, 'info'); 
        }
    } 
    renderCarrinho(); 
}

function pdvMudarObsItem(i, val) { 
    cart[i].obsVenda = val || ''; 
}

function renderCarrinho() {
    document.getElementById('pdv-carrinho-body').innerHTML = cart.map((item, i) => { 
        const fHtml = item.foto ? `<img src="${item.foto}" onclick="abrirZoomCart('${i}')" class="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 mx-auto cursor-zoom-in hover:opacity-80 transition" title="Ver foto em tela cheia">` : `<div class="w-10 h-10 mx-auto rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs border border-slate-200 dark:border-slate-700"><i class="fa-regular fa-image"></i></div>`; 
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-50">
            <td class="py-2 text-center">${fHtml}</td>
            <td class="py-2 text-slate-800 dark:text-slate-100 font-medium">
                ${item.nome}
                ${item.id ? `<button onclick="abrirModalProduto('${item.id}')" class="ml-1 text-slate-400 hover:text-blue-500 transition-colors" title="Editar Cadastro do Produto"><i class="fa-solid fa-pencil text-xs"></i></button>` : ''}
                <input type="text" placeholder="Obs do item (cor, lado, etc...)" value="${item.obsVenda || ''}" onchange="pdvMudarObsItem(${i}, this.value)" class="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[10px] outline-none focus:border-blue-400 placeholder:text-slate-300 dark:text-white">
            </td>
            <td class="py-2 text-center"><input type="number" step="0.001" min="0.001" value="${item.qtd}" onchange="pdvMudarQtd(${i}, this.value)" class="w-14 text-center border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-bold outline-none bg-white dark:bg-slate-800 dark:text-white"></td>
            <td class="py-2 text-right hidden sm:table-cell"><input type="number" step="0.01" value="${Number(item.preco).toFixed(2)}" onchange="pdvMudarPreco(${i}, this.value)" class="w-20 text-right border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 bg-white dark:bg-slate-800 dark:text-white"></td>
            <td class="py-2 text-right font-bold text-slate-800 dark:text-slate-100">${formatMoney((item.preco || 0) * (item.qtd || 1))}</td>
            <td class="py-2 text-center"><button onclick="cart.splice(${i},1); renderCarrinho()" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash text-lg"></i></button></td>
        </tr>`;
    }).join(''); 
    pdvAtualizarTotais();
}

function pdvMudarQtd(i, n) { 
    const op = document.getElementById('pdv-operação') ? document.getElementById('pdv-operação').value : 'Venda'; 
    const isOrcamento = op === 'Orçamento'; 
    const novaQtd = Math.max(0.001, parseFloat(n)||0.001); 
    cart[i].qtd = novaQtd; 
    
    const p = db.produtos.find(x => String(x.id) === String(cart[i].id)); 
    if(!isOrcamento && p && novaQtd > (p.estoque || 0)) {
        showToast(`Estoque NEGATIVO! Restam ${p.estoque || 0}.`, 'info'); 
    }
    renderCarrinho(); 
}

function pdvMudarPreco(i, val) { 
    const novoPreco = parseFloat(val); 
    if(!isNaN(novoPreco) && novoPreco >= 0) { 
        cart[i].preco = novoPreco; 
    } 
    pdvAtualizarTotais(); 
    renderCarrinho(); 
}

function pdvLimpar() { 
    cart = []; 
    document.getElementById('pdv-desconto').value = 0; 
    document.getElementById('pdv-frete').value = 0; 
    
    if(document.getElementById('pdv-obs')) {
        document.getElementById('pdv-obs').value = ''; 
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
    atualizarListaClientesPDV(null);
    renderCarrinho(); 
}

function pdvAtualizarTotais() { 
    const sub = cart.reduce((acc, i) => acc + ((i.preco || 0) * (i.qtd || 1)), 0); 
    let frete = parseFloat(document.getElementById('pdv-frete').value) || 0; 
    let desc = parseFloat(document.getElementById('pdv-desconto').value) || 0; 
    
    if(desc > (sub + frete)) desc = sub + frete; 
    const tot = sub + frete - desc; 
    
    document.getElementById('pdv-subtotal').innerText = formatMoney(sub); 
    document.getElementById('pdv-total').innerText = formatMoney(tot); 
    document.getElementById('pdv-qtd-itens').innerText = `${cart.reduce((a,b)=>a+(b.qtd||1),0)} itens`; 
    
    pdvTotalAtual = tot; 
    atualizarResumoPagamentosVenda(); 
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
    
    if(metodo === 'Cartão Crédito' || metodo === 'Boleto' || metodo === 'Fiado') { 
        selParc.classList.remove('hidden'); 
    } else { 
        selParc.classList.add('hidden'); 
        selParc.value = '1'; 
    } 
    
    const parcelas = parseInt(selParc.value) || 1;
    
    if(metodo === 'Boleto' || metodo === 'Fiado') { 
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
    const opSelect = document.getElementById('pdv-operação'); 
    const isOrcamento = opSelect && opSelect.value === 'Orçamento'; 
    const isServico = opSelect && opSelect.value === 'Serviço'; 
    const lista = document.getElementById('lista-pagamentos-adicionados'); 
    
    if(!lista) return;
    
    let totalVendaFinal = pdvTotalAtual; 
    lista.innerHTML = ''; 
    let totalPago = 0;
    
    if (pagamentosVendaAtual.length === 0) { 
        lista.innerHTML = `<div class="text-xs text-slate-400 text-center mt-4 italic">${isOrcamento ? 'Orçamentos não exigem pagamentos prévios.' : 'Nenhum pagamento inserido.'}</div>`; 
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
            btnFinalizar.classList.add('active:scale-95', 'bg-blue-500', 'hover:bg-blue-600'); 
            btnFinalizar.innerHTML = window.vendaEmEdicao ? '<i class="fa-solid fa-file-invoice"></i> SALVAR ORÇAMENTO EDITADO' : '<i class="fa-solid fa-file-invoice"></i> SALVAR ORÇAMENTO'; 
        } else if (!isOrcamento && totalPago >= totalVendaFinal && totalVendaFinal > 0) { 
            btnFinalizar.disabled = false; 
            btnFinalizar.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-blue-500', 'hover:bg-blue-600'); 
            btnFinalizar.classList.add('active:scale-95', 'bg-emerald-500', 'hover:bg-emerald-600'); 
            btnFinalizar.innerHTML = window.vendaEmEdicao ? '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA EDITADA' : (isServico ? '<i class="fa-solid fa-handshake"></i> FINALIZAR SERVIÇO' : '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA'); 
        } else { 
            btnFinalizar.disabled = true; 
            btnFinalizar.classList.add('opacity-50', 'cursor-not-allowed'); 
            btnFinalizar.classList.remove('active:scale-95'); 
            btnFinalizar.innerHTML = isServico ? '<i class="fa-solid fa-handshake"></i> FINALIZAR SERVIÇO' : '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA'; 
            
            if(!isOrcamento) { 
                btnFinalizar.classList.remove('bg-blue-500', 'hover:bg-blue-600'); 
                btnFinalizar.classList.add('bg-emerald-500', 'hover:bg-emerald-600'); 
            } 
        } 
    }
}

function adicionarPagamentoVenda() { 
    const metodo = document.getElementById('pdv-metodo-atual').value || ''; 
    const inputValor = document.getElementById('pdv-valor-atual'); 
    const parcelas = parseInt(document.getElementById('pdv-parcelas-atual').value) || 1; 
    const valor = parseFloat(inputValor.value); 
    
    if (!valor || valor <= 0) return showToast("Digite um valor numérico válido para o pagamento.", "error"); 
    
    let vencimentosPersonalizados = [];
    if (metodo === 'Boleto' || metodo === 'Fiado') {
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
    inputValor.focus(); 
}

function removerPagamentoVenda(index) { 
    pagamentosVendaAtual.splice(index, 1); 
    atualizarResumoPagamentosVenda(); 
}

async function finalizarVendaMultipla() {
    const op = document.getElementById('pdv-operação') ? document.getElementById('pdv-operação').value : 'Venda';
    const isOrcamento = op === 'Orçamento'; 
    const isServico = op === 'Serviço';
    
    let tipoVenda = 'VENDA'; 
    if (isOrcamento) tipoVenda = 'ORÇAMENTO'; 
    if (isServico) tipoVenda = 'SERVIÇO';
    
    if(cart.length === 0) return showToast('Nenhum item na operação!', 'error');
    
    if (!isOrcamento) { 
        if(pagamentosVendaAtual.length === 0) return showToast('Insira ao menos um pagamento!', 'error'); 
        if(!db.caixa || db.caixa.status !== 'ABERTO') return showToast('O Caixa está FECHADO. Abra o caixa antes.', 'error'); 
    }

    const { sub, desc, frete, tot } = pdvAtualizarTotais(); 
    const custoTotal = cart.reduce((acc, i) => acc + ((i.custo || 0) * (i.qtd || 1)), 0);
    
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
    const dataIso = isEdicao ? window.vendaEmEdicao.data : new Date().toISOString();
    
    let numeroPedido = 1;
    if (isEdicao && window.vendaEmEdicao.numeroPedido) {
        numeroPedido = window.vendaEmEdicao.numeroPedido;
    } else {
        numeroPedido = (db.vendas || []).length > 0 ? Math.max(...db.vendas.map(v => v.numeroPedido || 0)) + 1 : 1;
    }
    const numPedStr = String(numeroPedido).padStart(4, '0');

    const osPrazo = document.getElementById('os-prazo') ? document.getElementById('os-prazo').value : ''; 
    const osGarantia = document.getElementById('os-garantia') ? document.getElementById('os-garantia').value : ''; 
    const osDesc = document.getElementById('os-desc') ? document.getElementById('os-desc').value.trim() : ''; 
    const osFotosParaSalvar = [...osFotosArray]; 
    
    const tituloRecibo = isOrcamento ? 'ORÇAMENTO - VÁLIDO POR 7 DIAS' : (isServico ? 'ORDEM DE PRESTAÇÃO DE SERVIÇO' : 'CUPOM NÃO FISCAL - SEM VALOR LEGAL');
    
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
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${cart.map(i => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px;">
                            <strong>${i.nome || 'Produto/Serviço'}</strong>
                            ${i.obsVenda ? `<br><span style="font-size: 11px; color: #475569; font-style: italic;">Obs: ${i.obsVenda}</span>` : ''}
                        </td>
                        <td style="padding: 8px; text-align: center;">${i.qtd || 1}</td>
                        <td style="padding: 8px; text-align: right; font-weight: bold;">${formatMoney((i.preco || 0) * (i.qtd || 1))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 20px; font-size: 13px;">
            <div style="flex: 1; min-width: 280px; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-right: 5px; margin-bottom: 5px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">${isOrcamento ? 'PREVISÃO DE PAGAMENTO' : 'PAGAMENTOS REGISTRADOS'}</h3>
                ${pagTexto !== 'Orçamento (Sem Pagamento Exigido)' ? pagamentosVendaAtual.map(p => `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>? ${p.metodo} ${p.parcelas > 1 ? `(${p.parcelas}x)` : ''}</span> <strong>${formatMoney(p.valor)}</strong></div>`).join('') : '<p style="font-style: italic; color: #555;">Nenhum pagamento registrado no orçamento.</p>'}
                ${valorTroco > 0 && !isOrcamento ? `<div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #000;"><span>Troco Devolvido:</span> <strong style="color: red;">${formatMoney(valorTroco)}</strong></div>` : ''}
            </div>
            <div style="flex: 1; min-width: 280px; border: 1px solid #000; border-radius: 5px; padding: 12px; margin-left: 5px; margin-bottom: 5px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">RESUMO DOS VALORES</h3>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Subtotal:</span> <span>${formatMoney(sub)}</span></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Taxas / Desloc (+):</span> <span>${formatMoney(frete)}</span></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Descontos (-):</span> <span>-${formatMoney(desc)}</span></div>
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
    `;

    const batch = firestore.batch();
    
    // Preparar Venda
    const vendaRef = isEdicao ? firestore.collection('vendas').doc(String(vendaId)) : firestore.collection('vendas').doc();
    const idFinalVenda = vendaRef.id;

    if (!isOrcamento) { 
        cart.forEach(item => { 
            const p = (db.produtos || []).find(x => String(x.id) === String(item.id)); 
            if(p) { 
                const pRef = firestore.collection('produtos').doc(String(p.id));
                batch.update(pRef, { estoque: (p.estoque || 0) - item.qtd });
                
                const kardexRef = firestore.collection('movimentacoes').doc();
                batch.set(kardexRef, {
                    data: new Date().toISOString(),
                    ref: `${tipoVenda} #${numPedStr}`,
                    prodId: p.id,
                    prodNome: p.nome,
                    qtd: -(item.qtd || 1),
                    tipo: tipoVenda
                });
            } 
        }); 
    }

    const itensLimpados = cart.map(i => { return { id: i.id || '', nome: i.nome || '', preco: i.preco || 0, custo: i.custo || 0, qtd: i.qtd || 1, obsVenda: i.obsVenda || '' }; });

    const novaVendaObj = { 
        numeroPedido: numeroPedido, 
        data: dataIso, 
        clienteId: cId || '', 
        clienteNome: cliInfo.nome || '', 
        clienteDoc: cliInfo.doc,
        clienteTel: cliInfo.tel,
        clienteEnd: cliInfo.endCompleto,
        subtotal: sub || 0, 
        frete: frete || 0, 
        desconto: desc || 0, 
        tot: tot || 0, 
        taxaValor: taxaValorTotal || 0, 
        valorLiquido: valorLiquido || 0, 
        custoTotal: custoTotal || 0, 
        lucroReal: lucroReal || 0, 
        pag: pagTexto || '', 
        vendedor: vend || '', 
        obs: obsTexto || '', 
        tipo: tipoVenda, 
        servicoDetalhes: isServico ? { prazo: osPrazo, garantia: osGarantia, desc: osDesc, fotos: osFotosParaSalvar } : null, 
        itens: itensLimpados 
    };
    
    batch.set(vendaRef, novaVendaObj, { merge: true });
    
    if (!isOrcamento) {
        let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
        let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
        let cxSaldoNovo = cxAtual.saldo || 0;
        
        pagamentosVendaAtual.forEach((p, idx) => {
            let valorParaCaixa = p.valor || 0; 
            if(p.metodo === 'Dinheiro' && valorTroco > 0) { 
                valorParaCaixa -= valorTroco; 
                if(valorParaCaixa < 0) valorParaCaixa = 0; 
            }
            
            if(valorParaCaixa > 0) {
                let pRef = `${tipoVenda} #${numPedStr} (${p.metodo || ''}${(p.parcelas || 1) > 1 ? ' '+p.parcelas+'x' : ''})`;
                
                if(p.metodo === 'Fiado' || p.metodo === 'Boleto') { 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    let prazoMetodo = (db.config && db.config.prazos && db.config.prazos[p.metodo] !== undefined) ? parseInt(db.config.prazos[p.metodo]) : 30;
                    let dataBase = p.vencimentoBase ? new Date(p.vencimentoBase + 'T12:00:00') : new Date(); 
                    if(!p.vencimentoBase) dataBase.setDate(dataBase.getDate() + prazoMetodo); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        let dataVencParc = new Date(dataBase); 
                        if (p.vencimentosPersonalizados && p.vencimentosPersonalizados[i-1]) {
                            dataVencParc = new Date(p.vencimentosPersonalizados[i-1] + 'T12:00:00');
                        } else {
                            dataVencParc.setDate(dataVencParc.getDate() + (prazoMetodo * (i - 1))); 
                        }
                        
                        const finRef = firestore.collection('financeiro').doc();
                        batch.set(finRef, { ref: ` [/]`, data: dataVencParc.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', origemVendaId: idFinalVenda }); 
                    } 
                } else if (p.metodo && (String(p.metodo).includes('Crédito') || String(p.metodo).includes('Débito'))) { 
                    let prazoCartao = (db.config && db.config.prazos && db.config.prazos[p.metodo] !== undefined) ? parseInt(db.config.prazos[p.metodo]) : 1;
                    let dataAmanha = new Date(); 
                    dataAmanha.setDate(dataAmanha.getDate() + prazoCartao); 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        const finRef = firestore.collection('financeiro').doc();
                        batch.set(finRef, { ref: `${pRef} [${i}/${p.parcelas}]`, data: dataAmanha.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, origemVendaId: idFinalVenda }); 
                    } 
                } else if (p.metodo === 'Dinheiro' || p.metodo === 'PIX') { 
                    const finRef = firestore.collection('financeiro').doc();
                    batch.set(finRef, { ref: pRef, data: dataIso, pessoa: cliInfo.nome, wpp: '', valor: valorParaCaixa, status: 'PAGO', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, dataPagamento: dataIso, origemVendaId: idFinalVenda }); 
                    
                    if(p.metodo === 'Dinheiro') { 
                        cxSaldoNovo += valorParaCaixa; 
                        cxHistoricoNovo.unshift({ data: dataIso, tipo: 'ENTRADA', desc: pRef, valor: valorParaCaixa }); 
                    } 
                }
            }
        });
        
        const caixaRef = firestore.collection('fc_moveis').doc('caixa');
        batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
    }

    try {
        await batch.commit();
    } catch(err) {
        console.error("Erro ao salvar no firestore: ", err);
        return showToast("Erro ao salvar operação no banco de dados.", "error");
    } 
    
    window.vendaEmEdicao = null;
    window.vendaAtualImpressao = novaVendaObj;
    
    document.getElementById('print-area').innerHTML = htmlRecibo; 
    document.getElementById('modal-opcoes-recibo').classList.remove('hidden'); 
    
    pdvLimpar(); 
    showToast(isOrcamento ? "Orçamento salvo!" : (isServico ? "Serviço registrado!" : "Venda registrada com sucesso!"), "success");
}

function fecharModalOpcoesRecibo() { 
    document.getElementById('modal-opcoes-recibo').classList.add('hidden'); 
    document.getElementById('fiscal-status-container').classList.add('hidden');
    document.getElementById('fiscal-status-container').innerHTML = '';
}

async function emitirNota(tipo) {
    if(!window.vendaAtualImpressao || !window.vendaAtualImpressao.id) {
        return showToast("Erro: Venda não identificada.", "error");
    }
    
    const btnNfce = document.getElementById('btn-emitir-nfce');
    const btnNfe = document.getElementById('btn-emitir-nfe');
    const statusContainer = document.getElementById('fiscal-status-container');
    
    btnNfce.disabled = true;
    btnNfe.disabled = true;
    statusContainer.classList.remove('hidden');
    statusContainer.classList.remove('border-red-500', 'bg-red-50', 'border-emerald-500', 'bg-emerald-50');
    statusContainer.classList.add('border-blue-500', 'bg-blue-50');
    statusContainer.innerHTML = `<p class="text-blue-700 font-bold animate-pulse"><i class="fa-solid fa-spinner fa-spin"></i> Emitindo ${tipo.toUpperCase()}... aguarde.</p>`;

    try {
        // Chama a Cloud Function
        const emitirFunc = firebase.functions().httpsCallable(tipo === 'nfce' ? 'emitirNFCe' : 'emitirNFe');
        const response = await emitirFunc({ vendaId: window.vendaAtualImpressao.id });
        const result = response.data;
        
        statusContainer.classList.remove('border-blue-500', 'bg-blue-50');
        statusContainer.classList.add('border-emerald-500', 'bg-emerald-50');
        
        let linkDanfe = result.data.caminho_danfe || result.data.caminho_xml_nota_fiscal;
        
        statusContainer.innerHTML = `
            <p class="text-emerald-700 font-bold mb-2"><i class="fa-solid fa-check-circle"></i> Nota Autorizada!</p>
            ${linkDanfe ? `<a href="https://api.focusnfe.com.br${linkDanfe}" target="_blank" class="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-emerald-700 inline-block">Imprimir DANFE</a>` : ''}
        `;
        showToast("Nota emitida com sucesso!", "success");

    } catch (error) {
        console.error("Erro na emissão fiscal:", error);
        statusContainer.classList.remove('border-blue-500', 'bg-blue-50');
        statusContainer.classList.add('border-red-500', 'bg-red-50');
        
        let errorMsg = error.message;
        try {
            // Tenta parsear erros comuns da Focus NFe passados pela function
            const parsed = JSON.parse(errorMsg);
            if(parsed.erros && parsed.erros.length > 0) {
                errorMsg = parsed.erros[0].mensagem || parsed.erros[0].codigo;
            } else if (parsed.mensagem_sefaz) {
                errorMsg = parsed.mensagem_sefaz;
            }
        } catch(e) {}
        
        statusContainer.innerHTML = `<p class="text-red-700 font-bold text-sm"><i class="fa-solid fa-circle-exclamation"></i> Erro: ${errorMsg}</p>`;
        
        btnNfce.disabled = false;
        btnNfe.disabled = false;
    }
}

// ==========================================
// 12. HISTÓRICO VENDAS E ORÇAMENTOS
// ==========================================
function renderVendas() {
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
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${clienteRender} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
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
    const buscaEl = document.getElementById('busca-orcamentos'); 
    const dataIniEl = document.getElementById('filtro-orcamentos-ini'); 
    const dataFimEl = document.getElementById('filtro-orcamentos-fim');
    
    const termo = buscaEl && buscaEl.value ? String(buscaEl.value).toLowerCase().trim() : ''; 
    const dataIni = dataIniEl ? dataIniEl.value : ''; 
    const dataFim = dataFimEl ? dataFimEl.value : ''; 
    
    let filtrados = db.vendas || []; 
    filtrados = filtrados.filter(v => v.tipo === 'ORÇAMENTO');
    
    if (termo) filtrados = filtrados.filter(v => (v.clienteNome && String(v.clienteNome).toLowerCase().includes(termo)) || (v.numeroPedido && String(v.numeroPedido).includes(termo)) || (v.vendedor && String(v.vendedor).toLowerCase().includes(termo)));
    if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() >= dIni); }
    if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() <= dFim); }
    
    filtrados.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));

    let totalOrcamentos = 0;
    
    document.getElementById('tabela-orcamentos-body').innerHTML = filtrados.map(v => {
        try {
            const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0'); 
            totalOrcamentos += (Number(v.tot) || 0);
            
            const dataRender = v.data && typeof formatData === 'function' ? formatData(v.data).replace(',', '') : (v.data || '-'); 
            const clienteRender = v.clienteNome || 'Desconhecido'; 
            const vendRender = v.vendedor || '-'; 
            const qtdItens = v.itens ? v.itens.reduce((acc, i) => acc + (i.qtd||1), 0) : 0;
            
            return `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                <td class="p-3 text-slate-500 dark:text-slate-400 text-xs">${dataRender}</td>
                <td class="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">#${numPedStr}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${clienteRender} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
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
    
    document.getElementById('det-venda-obs').innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observa\u00e7\u00e3o geral vinculada a esta venda.</span>') + osInfoHtml;
    
    let totalCusto = 0;
    document.getElementById('det-venda-itens').innerHTML = (v.itens || []).map(i => {
        const preco = Number(i.preco) || 0;
        const qtd = Number(i.qtd) || 1;
        const custo = Number(i.custo) || 0;
        
        const subTot = preco * qtd;
        const subCusto = custo * qtd;
        const lucroSub = subTot - subCusto;
        
        totalCusto += subCusto;
        
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors group">
            <td class="p-4 border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${i.nome || 'Produto/Servi\u00e7o'}</div>
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
                ${isGestao ? `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub}</div>` : ''}
            </td>
        </tr>`;
    }).join('');
    
    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const lucroLiquido = tot - totalCusto - taxaCartao;
    
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
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cart\u00e3o / Despesa</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
                </tr>`;
            }
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
                </tr>
                <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro L\u00edquido Real</td>
                    <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
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
    document.getElementById('modal-detalhes-venda').classList.add('hidden'); 
}

// ==========================================
// 13. EDITAR / REABRIR VENDA (BLINDADO COM STRING E SEM LOOP)
// ==========================================
function editarVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return showToast('Venda não encontrada.', 'error'); 

    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento 
        ? 'Deseja carregar este orçamento de volta no PDV para editar?' 
        : 'Atenção! Isso fará o ESTORNO automático desta venda (devolvendo estoque e apagando as parcelas) e carregará todos os itens no PDV para você editar e re-finalizar. Deseja continuar?';

    abrirConfirmacao('Editar Operação', msg, async () => {
        try {
            const batch = firestore.batch();
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            const pRef = firestore.collection('produtos').doc(String(p.id));
                            batch.update(pRef, { estoque: (p.estoque || 0) + Number(item.qtd || 1) });
                            
                            const kardexRef = firestore.collection('movimentacoes').doc();
                            batch.set(kardexRef, {
                                data: new Date().toISOString(),
                                ref: `Estorno de Edição ${v.tipo} #${numPedStr}`,
                                prodId: p.id,
                                prodNome: p.nome,
                                qtd: Number(item.qtd || 1),
                                tipo: 'ESTORNO'
                            });
                        } 
                    }); 
                }
                
                const finQuery = await firestore.collection('financeiro').where('origemVendaId', '==', String(id)).get();
                finQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                if(v.pag && typeof v.pag === 'string' && String(v.pag).includes('Dinheiro')) { 
                    let cxAtual = db.caixa || { status: 'FECHADO', saldo: 0, historico: [] };
                    let cxHistoricoNovo = cxAtual.historico ? [...cxAtual.historico] : [];
                    let cxSaldoNovo = (cxAtual.saldo || 0) - (Number(v.valorLiquido) || 0);
                    cxHistoricoNovo.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno (Edição) ${v.tipo} #${numPedStr}`, valor: (Number(v.valorLiquido) || 0) });
                    
                    const caixaRef = firestore.collection('fc_moveis').doc('caixa');
                    batch.set(caixaRef, { ...cxAtual, saldo: cxSaldoNovo, historico: cxHistoricoNovo }, { merge: true });
                }
            }

            const vendaRef = firestore.collection('vendas').doc(String(id));
            batch.delete(vendaRef);
            
            await batch.commit(); 

            pdvLimpar(); 
            
            mudarVisaoLocal('pdv');
            
            window.vendaEmEdicao = {
                id: v.id,
                data: v.data,
                numeroPedido: v.numeroPedido
            };
            
            const opSelect = document.getElementById('pdv-operação');
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
    
                document.getElementById('pdv-frete').value = v.frete || 0;
                document.getElementById('pdv-desconto').value = v.desconto || 0;
                
                const obsEl = document.getElementById('pdv-obs');
                if(obsEl) obsEl.value = v.obs || '';
    
                if(v.tipo === 'SERVIÇO' && v.servicoDetalhes) {
                    if(document.getElementById('os-prazo')) document.getElementById('os-prazo').value = v.servicoDetalhes.prazo || '';
                    if(document.getElementById('os-garantia')) document.getElementById('os-garantia').value = v.servicoDetalhes.garantia || '';
                    if(document.getElementById('os-desc')) document.getElementById('os-desc').value = v.servicoDetalhes.desc || '';
                    osFotosArray = v.servicoDetalhes.fotos ? [...v.servicoDetalhes.fotos] : [];
                    renderizarFotosOS();
                }
    
                cart = v.itens.map(i => {
                    const pBD = (db.produtos || []).find(prod => String(prod.id) === String(i.id));
                    return {
                        id: i.id,
                        nome: i.nome,
                        preco: i.preco,
                        custo: i.custo,
                        qtd: i.qtd,
                        obsVenda: i.obsVenda || '',
                        foto: pBD ? (pBD.foto || '') : ''
                    };
                });
    
                pagamentosVendaAtual = [];
                pdvAtualizarTotais();
                renderCarrinho();
    
                showToast('Dados carregados no PDV. Modifique e finalize!', 'success');
            }, 100);

        } catch (err) { 
            console.error(err); 
            showToast('Erro ao carregar venda para edição.', 'error'); 
        }
    });
}

function atualizarVendedoresPDV() {
    const select = document.getElementById('pdv-vendedor');
    if (!select) return;
    
    // Guarda o valor selecionado atualmente para não perder ao atualizar a lista
    const selectedValue = select.value;
    
    // Filtra apenas os que são marcados como vendedor = "SIM"
    const vendedores = (db.funcionarios || [])
        .filter(f => f.vendedor === 'SIM' || f.vendedor === 'Sim' || f.vendedor === true)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        
    let html = `<option value="Balcão">Vend: Balcão</option>`;
    
    vendedores.forEach(v => {
        html += `<option value="${v.nome}">Vend: ${v.nome}</option>`;
    });
    
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
// PERSISTÃŠNCIA DE ESTADO DO PDV (LOCALSTORAGE)
// ==========================================
window.salvarEstadoPDV = function() {
    try {
        const estado = {
            cart: typeof cart !== 'undefined' ? cart : [],
            pagamentos: typeof pagamentosVendaAtual !== 'undefined' ? pagamentosVendaAtual : [],
            clienteId: document.getElementById('pdv-cliente') ? document.getElementById('pdv-cliente').value : '0',
            clienteBusca: document.getElementById('pdv-cliente-busca') ? document.getElementById('pdv-cliente-busca').value : '',
            vendedorId: document.getElementById('pdv-vendedor') ? document.getElementById('pdv-vendedor').value : '',
            observacao: document.getElementById('pdv-obs') ? document.getElementById('pdv-obs').value : '',
            dataVenda: document.getElementById('pdv-data') ? document.getElementById('pdv-data').value : '',
            desconto: document.getElementById('pdv-desconto') ? document.getElementById('pdv-desconto').value : '0',
            frete: document.getElementById('pdv-frete') ? document.getElementById('pdv-frete').value : '0',
            vendaEmEdicao: window.vendaEmEdicao || null
        };
        localStorage.setItem('pdvState', JSON.stringify(estado));
    } catch(e) {}
};

window.carregarEstadoPDV = function() {
    const saved = localStorage.getItem('pdvState');
    if (saved) {
        try {
            const estado = JSON.parse(saved);
            if (typeof cart !== 'undefined') cart = estado.cart || [];
            if (typeof pagamentosVendaAtual !== 'undefined') pagamentosVendaAtual = estado.pagamentos || [];
            window.vendaEmEdicao = estado.vendaEmEdicao || null;

            if (document.getElementById('pdv-cliente')) document.getElementById('pdv-cliente').value = estado.clienteId || '0';
            if (document.getElementById('pdv-cliente-busca')) document.getElementById('pdv-cliente-busca').value = estado.clienteBusca || '';
            if (document.getElementById('pdv-vendedor')) document.getElementById('pdv-vendedor').value = estado.vendedorId || '';
            if (document.getElementById('pdv-obs')) document.getElementById('pdv-obs').value = estado.observacao || '';
            if (document.getElementById('pdv-data') && estado.dataVenda) document.getElementById('pdv-data').value = estado.dataVenda;
            if (document.getElementById('pdv-desconto')) document.getElementById('pdv-desconto').value = estado.desconto || '0';
            if (document.getElementById('pdv-frete')) document.getElementById('pdv-frete').value = estado.frete || '0';

            if (typeof renderCarrinho === 'function') renderCarrinho();
            if (typeof atualizarResumoPagamentosVenda === 'function') atualizarResumoPagamentosVenda();
            
            const btnFinalizar = document.getElementById('btn-finalizar-venda');
            if(btnFinalizar && window.vendaEmEdicao) {
                btnFinalizar.innerHTML = '<i class="fa-solid fa-circle-check"></i> FINALIZAR VENDA EDITADA';
            }
        } catch(e) {
            console.error('Erro ao restaurar estado do PDV:', e);
        }
    }
};

setInterval(() => {
    if (document.getElementById('view-pdv') && document.getElementById('view-pdv').classList.contains('active')) {
        if (typeof window.salvarEstadoPDV === 'function') window.salvarEstadoPDV();
    }
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof window.carregarEstadoPDV === 'function') window.carregarEstadoPDV();
    }, 800); 
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
            document.getElementById('prod-margem').value = (prod.margem || 50).toFixed(2);
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
window.pdvMudarPreco = pdvMudarPreco;
window.pdvLimpar = pdvLimpar;
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

