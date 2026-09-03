// cadastro.js - Lógica de Produtos, Clientes, Fornecedores e Estoque

let acaoConfirmacaoPendente = null;

// Evita o "piscar" da tela carregando as abas instantaneamente antes do Firebase
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'produtos';
    if (typeof mudarVisaoLocal === 'function') mudarVisaoLocal(view);
});

// ==========================================
// NAVEGAÇÃO E INICIALIZAÇÃO
// ==========================================
function mudarVisaoLocal(viewId) {
    document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('active'); });
    const viewTarget = document.getElementById(`view-${viewId}`);
    if (viewTarget) {
        viewTarget.classList.remove('hidden');
        viewTarget.classList.add('active');
    }

    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('text-slate-300'); });
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
    if (activeBtn) { activeBtn.classList.remove('text-slate-300'); activeBtn.classList.add('bg-blue-600', 'text-white'); }

    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('-translate-x-full');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.add('hidden');
    }
}

function inicializarCadastro() {
    // Liga os listeners do Firestore
    unsubProdutos = firestore.collection('produtos').onSnapshot(snap => {
        db.produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const v = document.getElementById('view-produtos');
        if (v && v.classList.contains('active')) renderProdutos();
    });

    unsubClientes = firestore.collection('clientes').onSnapshot(snap => {
        db.clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const v = document.getElementById('view-clientes');
        if (v && v.classList.contains('active')) renderClientes();
    });

    unsubFornecedores = firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const v = document.getElementById('view-fornecedores');
        if (v && v.classList.contains('active')) renderFornecedores();
    });

    firestore.collection('funcionarios').onSnapshot(snap => {
        db.funcionarios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (typeof renderFuncionarios === 'function') renderFuncionarios();
    });

    unsubCategorias = firestore.collection('categorias').onSnapshot(snap => {
        db.categorias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        preencherSelectsDeCategorias();
        const v = document.getElementById('view-produtos');
        if (v && v.classList.contains('active')) renderProdutos();
    });

    unsubKardex = firestore.collection('movimentacoes').orderBy('data', 'desc').limit(50).onSnapshot(snap => {
        db.movimentacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const v = document.getElementById('view-estoque');
        if (v && v.classList.contains('active')) renderKardex();
    });

    // Carrega vendas para exibir histórico de compras do cliente
    firestore.collection('vendas').onSnapshot(snap => {
        db.vendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });

    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    mudarVisaoLocal(view || 'produtos');
}

window.onload = () => { initGlobalData(inicializarCadastro); };

// ==========================================
// FUNÇÕES GENÉRICAS DE UI
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
    btnAtivo.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400'); 
    btnAtivo.classList.add('border-blue-600', 'text-blue-600');
}

function abrirConfirmacao(titulo, mensagem, acao) {
    document.getElementById('modal-confirm-title').innerText = titulo;
    document.getElementById('modal-confirm-msg').innerText = mensagem;
    acaoConfirmacaoPendente = acao;
    document.getElementById('modal-confirmacao').classList.remove('hidden');
    document.getElementById('modal-confirm-btn').onclick = function () {
        if (acaoConfirmacaoPendente) acaoConfirmacaoPendente();
        fecharModalConfirmacao();
    };
}
function fecharModalConfirmacao() { document.getElementById('modal-confirmacao').classList.add('hidden'); acaoConfirmacaoPendente = null; document.getElementById('modal-confirm-btn').onclick = null; }

function abrirZoom(src) { if (!src) return; document.getElementById('zoom-img-src').src = src; document.getElementById('modal-zoom').classList.remove('hidden'); }
function fecharZoom() { document.getElementById('modal-zoom').classList.add('hidden'); document.getElementById('zoom-img-src').src = ''; }

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

// ==========================================
// ESTOQUE KARDEX (Backend)
// ==========================================
async function salvarKardex(ref, prodId, prodNome, qtd, tipo) {
    try {
        await firestore.collection('movimentacoes').add({
            data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo
        });
    } catch (e) {
        console.error("Erro ao salvar Kardex", e);
    }
}

// ==========================================
// PRODUTOS
// ==========================================
function preencherSelectsDeCategorias() {
    const selects = ['prod-categoria', 'filtro-prod-categoria'];
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        
        const valorAtual = select.value;
        const textoPadrao = id.includes('filtro') ? 'Categoria: Todas' : 'Sem Categoria';
        const valorPadrao = id.includes('filtro') ? 'todos' : '';
        
        select.innerHTML = `<option value="${valorPadrao}">${textoPadrao}</option>` + 
            (db.categorias || []).map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
            
        if (valorAtual) select.value = valorAtual;
    });
}

window.atualizarOpcoesSubcategoria = function(categoriaSelecionada = null, targetId = 'prod-subcategoria') {
    if (categoriaSelecionada === null) {
        categoriaSelecionada = document.getElementById('prod-categoria')?.value || '';
    }
    
    const select = document.getElementById(targetId);
    if (!select) return;
    
    const valorAtual = select.value;
    const textoPadrao = targetId.includes('filtro') ? 'Subcategoria: Todas' : 'Sem Subcategoria';
    const valorPadrao = targetId.includes('filtro') ? 'todos' : '';
    
    select.innerHTML = `<option value="${valorPadrao}">${textoPadrao}</option>`;
    
    if (categoriaSelecionada && categoriaSelecionada !== 'todos') {
        const cat = (db.categorias || []).find(c => c.nome === categoriaSelecionada);
        if (cat && cat.subcategorias) {
            select.innerHTML += cat.subcategorias.map(s => `<option value="${s}">${s}</option>`).join('');
        }
    }
    
    if (valorAtual) select.value = valorAtual;
};

function renderProdutos() {
    const termo = document.getElementById('busca-produto-lista')?.value.toLowerCase() || ''; 
    const statusFiltro = document.getElementById('filtro-prod-status')?.value || 'todos';
    const catFiltro = document.getElementById('filtro-prod-categoria')?.value || 'todos';
    const subFiltro = document.getElementById('filtro-prod-subcategoria')?.value || 'todos';
    
    let filtrados = db.produtos.filter(p => p.nome.toLowerCase().includes(termo) || (p.ean && p.ean.includes(termo)) || (p.marca && p.marca.toLowerCase().includes(termo)));
    
    if (statusFiltro === 'alerta') filtrados = filtrados.filter(p => p.estoque > 0 && p.estoque <= p.min);
    if (statusFiltro === 'zerado') filtrados = filtrados.filter(p => p.estoque <= 0);
    if (statusFiltro === 'ok') filtrados = filtrados.filter(p => p.estoque > p.min);
    
    if (catFiltro !== 'todos') filtrados = filtrados.filter(p => p.categoria === catFiltro);
    if (subFiltro !== 'todos') filtrados = filtrados.filter(p => p.subcategoria === subFiltro);

    document.getElementById('tabela-produtos').innerHTML = filtrados.map(p => {
        const isBaixo = p.estoque <= p.min; const isZerado = p.estoque <= 0;
        const corEstoque = isZerado ? 'text-red-600 bg-red-50' : (isBaixo ? 'text-amber-600 bg-amber-50' : 'text-slate-700 dark:text-slate-200');
        const fHtml = p.foto ? `<img src="${p.foto}" onclick="abrirZoom('${p.foto}')" class="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 mx-auto cursor-zoom-in hover:opacity-80 transition">` : `<div class="w-10 h-10 mx-auto rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs"><i class="fa-regular fa-image"></i></div>`;
        const badgeInativo = p.ativo === false ? `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] ml-2 font-bold"><i class="fa-solid fa-ban"></i> INATIVO</span>` : '';
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${p.ativo === false ? 'opacity-60' : ''}">
            <td class="p-3 text-center">${fHtml}</td>
            <td class="p-3"><p class="font-bold text-slate-800 dark:text-slate-100">${p.nome} ${badgeInativo}</p><p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">EAN: ${p.ean || 'S/N'} | Cat: ${p.categoria || 'Sem'} &gt; ${p.subcategoria || 'Sem'} | Marca: ${p.marca || '-'}</p></td>
            <td class="p-3 text-right"><p class="text-slate-600 dark:text-slate-300 font-medium">${formatMoney(p.custo)}</p><p class="text-[10px] text-blue-500 font-bold">${p.custo > 0 ? (((p.preco - p.custo) / p.custo) * 100).toFixed(2) : (p.margem || 0).toFixed(2)}% MKP</p></td>
            <td class="p-3 text-right font-bold text-emerald-600">${formatMoney(p.preco)}</td>
            <td class="p-3 text-center font-bold"><span class="px-2 py-1 rounded ${corEstoque}">${p.estoque} un</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-1 mt-2"><button onclick="editarProduto('${p.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirProduto('${p.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}

function abrirModalProduto() {
    abaModal('prod', 'dados'); document.getElementById('modal-produto-title').innerText = 'Cadastrar Produto';
    ['id', 'nome', 'ean', 'marca', 'custo', 'preco', 'margem', 'estoque', 'minimo', 'obs', 'ncm', 'cfop', 'csosn', 'origem', 'cest'].forEach(id => { const el = document.getElementById(`prod-${id}`); if (el) el.value = ''; });
    document.getElementById('prod-ativo').value = 'true'; document.getElementById('prod-foto-base64').value = '';
    document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden');
    document.getElementById('prod-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver o histórico.</td></tr>';
    const modalProd = document.getElementById('modal-produto');
    modalProd.classList.remove('hidden');
    modalProd.style.display = 'flex';
}

function fecharModalProduto() {
    const modalProd = document.getElementById('modal-produto');
    modalProd.classList.add('hidden');
    modalProd.style.display = '';
}

function processarFoto(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image(); img.onload = function () {
            const canvas = document.createElement('canvas'); let w = img.width, h = img.height; const MAX = 300;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('preview-foto').src = dataUrl; document.getElementById('preview-foto').classList.remove('hidden');
            document.getElementById('texto-sem-foto').classList.add('hidden'); document.getElementById('prod-foto-base64').value = dataUrl;
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
}

function calcularPrecoMargin(quemMudou = 'preco') {
    const custoEl = document.getElementById('prod-custo');
    const margemEl = document.getElementById('prod-margem');
    const precoEl = document.getElementById('prod-preco');
    if (!custoEl || !margemEl || !precoEl) return;

    const custo = parseInputMoney(custoEl.value);
    const margem = parseInputMoney(margemEl.value);
    const preco = parseInputMoney(precoEl.value);

    if (custo <= 0) return;

    if (quemMudou === 'preco') {
        if (preco > 0) {
            const novaMargem = ((preco - custo) / custo) * 100;
            margemEl.value = novaMargem.toFixed(2);
        }
    } else if (quemMudou === 'margem') {
        const novoPreco = custo * (1 + (margem / 100));
        precoEl.value = novoPreco.toFixed(2);
    } else if (quemMudou === 'custo') {
        if (margem !== 0) {
            const novoPreco = custo * (1 + (margem / 100));
            precoEl.value = novoPreco.toFixed(2);
        } else if (preco > 0) {
            const novaMargem = ((preco - custo) / custo) * 100;
            margemEl.value = novaMargem.toFixed(2);
        }
    }
}

async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value.trim();
    const preco = parseInputMoney(document.getElementById('prod-preco').value);

    if (!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

    const p = {
        nome, preco,
        ean: document.getElementById('prod-ean').value,
        marca: document.getElementById('prod-marca').value,
        categoria: document.getElementById('prod-categoria').value,
        subcategoria: document.getElementById('prod-subcategoria').value,
        unidade: document.getElementById('prod-unidade').value,
        custo: parseInputMoney(document.getElementById('prod-custo').value) || 0,
        margem: (parseInputMoney(document.getElementById('prod-custo').value) || 0) > 0 ? parseFloat((((preco - (parseInputMoney(document.getElementById('prod-custo').value) || 0)) / (parseInputMoney(document.getElementById('prod-custo').value) || 0)) * 100).toFixed(2)) : (parseInputMoney(document.getElementById('prod-margem').value) || 0),
        estoque: parseInt(document.getElementById('prod-estoque').value) || 0,
        min: parseInt(document.getElementById('prod-minimo').value) || 0,
        ativo: document.getElementById('prod-ativo').value === 'true',
        obs: document.getElementById('prod-obs').value,
        foto: document.getElementById('prod-foto-base64').value,
        ncm: document.getElementById('prod-ncm') ? document.getElementById('prod-ncm').value : '',
        cfop: document.getElementById('prod-cfop') ? document.getElementById('prod-cfop').value : '',
        csosn: document.getElementById('prod-csosn') ? document.getElementById('prod-csosn').value : '',
        origem: document.getElementById('prod-origem') ? document.getElementById('prod-origem').value : '0',
        cest: document.getElementById('prod-cest') ? document.getElementById('prod-cest').value : ''
    };

    try {
        if (id) {
            const idStr = String(id).trim();
            const oldP = db.produtos.find(x => String(x.id).trim() === idStr);
            const difEstoque = p.estoque - (oldP ? oldP.estoque : 0);
            await firestore.collection('produtos').doc(idStr).set(p, { merge: true });
            if (difEstoque !== 0) salvarKardex('Ajuste Manual', idStr, p.nome, difEstoque, 'AJUSTE');
            showToast('Produto Atualizado!');
        } else {
            const docRef = await firestore.collection('produtos').add(p);
            if (p.estoque > 0) salvarKardex('Estoque Inicial', docRef.id, p.nome, p.estoque, 'INICIAL');
            showToast('Produto Criado!', 'success');
        }
        fecharModalProduto();
    } catch (e) {
        showToast('Erro ao salvar produto.', 'error');
        console.error(e);
    }
}

async function editarProduto(id) {
    const idStr = String(id).trim();
    let p = db.produtos.find(x => String(x.id).trim() === idStr);
    
    if (!p) {
        try {
            const snap = await firestore.collection('produtos').doc(idStr).get();
            if (snap.exists) {
                p = { id: snap.id, ...snap.data() };
                db.produtos.push(p);
            }
        } catch (err) {
            console.error('Erro ao buscar produto:', err);
        }
    }
    
    if (!p) return showToast('Produto não encontrado!', 'error');

    abrirModalProduto(); document.getElementById('modal-produto-title').innerText = 'Editar Produto';

    document.getElementById('prod-id').value = idStr;
    for (let key in p) {
        if (key === 'id') continue;
        const el = document.getElementById(`prod-${key === 'min' ? 'minimo' : key}`);
        if (el && key !== 'foto' && key !== 'ativo' && key !== 'custo' && key !== 'preco' && key !== 'margem') { el.value = p[key]; }
    }
    
    const custoNum = parseInputMoney(p.custo);
    const precoNum = parseInputMoney(p.preco);
    if (document.getElementById('prod-custo')) document.getElementById('prod-custo').value = custoNum.toFixed(2);
    if (document.getElementById('prod-preco')) document.getElementById('prod-preco').value = precoNum.toFixed(2);
    if (document.getElementById('prod-margem')) {
        if (custoNum > 0 && precoNum > 0) {
            document.getElementById('prod-margem').value = (((precoNum - custoNum) / custoNum) * 100).toFixed(2);
        } else {
            document.getElementById('prod-margem').value = parseInputMoney(p.margem || 50).toFixed(2);
        }
    }
    
    // Atualiza opções de subcategoria e seta o valor correto se existir
    if (p.categoria) {
        atualizarOpcoesSubcategoria(p.categoria, 'prod-subcategoria');
        if (p.subcategoria) {
            document.getElementById('prod-subcategoria').value = p.subcategoria;
        }
    }

    document.getElementById('prod-ativo').value = p.ativo !== false ? 'true' : 'false';
    document.getElementById('prod-foto-base64').value = p.foto || '';
    if (p.foto) { document.getElementById('preview-foto').src = p.foto; document.getElementById('preview-foto').classList.remove('hidden'); document.getElementById('texto-sem-foto').classList.add('hidden'); }
    else { document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden'); }

    const hist = db.movimentacoes ? db.movimentacoes.filter(m => String(m.prodId) === idStr) : [];
    document.getElementById('prod-historico-body').innerHTML = hist.length > 0 ? hist.map(m => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3">${formatData(m.data).split(' ')[0]}</td><td class="p-3 font-bold">${m.tipo}</td><td class="p-3">${m.ref}</td><td class="p-3 text-right font-bold ${m.qtd > 0 ? 'text-indigo-600' : 'text-red-500'}">${m.qtd > 0 ? '+' + m.qtd : m.qtd}</td></tr>`).join('') : '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem movimentações.</td></tr>';
}

function excluirProduto(id) {
    abrirConfirmacao('Excluir Produto', 'Remover produto permanentemente?', async () => {
        try {
            await firestore.collection('produtos').doc(id).delete();
            showToast('Produto excluído!');
        } catch (e) {
            showToast('Erro ao excluir', 'error');
        }
    });
}

// ==========================================
// CLIENTES
// ==========================================
function renderClientes() {
    const termo = document.getElementById('busca-cliente-lista')?.value.toLowerCase() || '';
    const filtrados = db.clientes.filter(c => c.nome.toLowerCase().includes(termo) || (c.doc && c.doc.includes(termo)));
    document.getElementById('tabela-clientes').innerHTML = filtrados.map(c => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${c.nome}</td><td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${c.doc || '-'}</td><td class="p-4 text-slate-800 dark:text-slate-100"><i class="fa-brands fa-whatsapp text-emerald-500 mr-1"></i> ${c.wpp || '-'}</td><td class="p-4 text-slate-600 dark:text-slate-300">${c.cidade || '-'}</td><td class="p-4 text-center"><button onclick="editarCliente('${c.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirCliente('${c.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum cliente encontrado.</td></tr>';
}

function abrirModalCliente() {
    abaModal('cli', 'dados');
    document.getElementById('cli-id').value = '';
    ['nome', 'doc', 'rg', 'nasc', 'wpp', 'fixo', 'email', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'ibge', 'obs'].forEach(campo => {
        const el = document.getElementById(`cli-${campo}`);
        if (el) el.value = '';
    });
    document.getElementById('cli-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver o histórico.</td></tr>';
    document.getElementById('modal-cliente-title').innerText = 'Novo Cliente';
    // Fix: remover hidden E garantir display flex (conflito Tailwind)
    const modal = document.getElementById('modal-cliente');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function fecharModalCliente() {
    const modal = document.getElementById('modal-cliente');
    modal.classList.add('hidden');
    modal.style.display = '';
}

async function salvarCliente() {
    const id = document.getElementById('cli-id').value;
    const nome = document.getElementById('cli-nome').value.trim();
    if (!nome) return showToast('Nome é obrigatório!', 'error');

    const c = {
        nome:    nome,
        doc:     document.getElementById('cli-doc').value    || '',
        rg:      document.getElementById('cli-rg').value     || '',
        nasc:    document.getElementById('cli-nasc').value   || '',
        wpp:     document.getElementById('cli-wpp').value    || '',
        fixo:    document.getElementById('cli-fixo').value   || '',
        email:   document.getElementById('cli-email').value  || '',
        cep:     document.getElementById('cli-cep').value    || '',
        rua:     document.getElementById('cli-rua').value    || '',
        numero:  document.getElementById('cli-numero').value || '',
        complemento: document.getElementById('cli-complemento').value || '',
        bairro:  document.getElementById('cli-bairro').value || '',
        cidade:  document.getElementById('cli-cidade').value || '',
        ibge:    document.getElementById('cli-ibge').value   || '',
        obs:     document.getElementById('cli-obs').value    || ''
    };

    console.log('[salvarCliente] Salvando... id:', id);

    try {
        if (id) {
            await firestore.collection('clientes').doc(String(id)).set(c, { merge: true });
            showToast('Cliente atualizado!', 'success');
        } else {
            await firestore.collection('clientes').add(c);
            showToast('Cliente cadastrado!', 'success');
        }
        fecharModalCliente();
    } catch (e) {
        console.error('[salvarCliente] ERRO:', e);
        showToast('Erro ao salvar: ' + (e.message || e.code || 'Verifique o console'), 'error');
    }
}

async function editarCliente(id) {
    const idStr = String(id).trim();

    // Tenta encontrar no cache local primeiro
    let c = db.clientes.find(x => String(x.id).trim() === idStr);

    // Se não encontrou (cache vazio), busca diretamente no Firestore
    if (!c) {
        try {
            const snap = await firestore.collection('clientes').doc(idStr).get();
            if (snap.exists) {
                c = { id: snap.id, ...snap.data() };
                db.clientes.push(c);
            }
        } catch (err) {
            console.error('Erro ao buscar cliente:', err);
        }
    }

    if (!c) return showToast('Cliente não encontrado!', 'error');

    abrirModalCliente();
    document.getElementById('modal-cliente-title').innerText = `Editar: ${c.nome}`;
    document.getElementById('cli-id').value = idStr;

    // Preenche todos os campos com os dados do cliente
    ['nome', 'doc', 'rg', 'nasc', 'wpp', 'fixo', 'email', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'ibge', 'obs'].forEach(campo => {
        const el = document.getElementById(`cli-${campo}`);
        if (el) el.value = c[campo] || '';
    });

    const hist = db.vendas ? db.vendas.filter(v => String(v.clienteId) === idStr) : [];
    document.getElementById('cli-historico-body').innerHTML = hist.length > 0
        ? hist.map(v => `<tr data-venda-id="${v.id}" class="linha-historico hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 cursor-pointer">
            <td class="p-3">${formatData(v.data).split(' ')[0]}</td>
            <td class="p-3 font-mono text-slate-500 dark:text-slate-400">#${String(v.numeroPedido || v.id).padStart(4, '0')}</td>
            <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${v.pag}</span></td>
            <td class="p-3 text-right font-bold text-emerald-600">${formatMoney(v.tot)}</td>
        </tr>`).join('')
        : '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma compra.</td></tr>';
}

function excluirCliente(id) {
    abrirConfirmacao('Excluir Cliente', 'Remover cliente?', async () => {
        try {
            await firestore.collection('clientes').doc(id).delete();
            showToast('Cliente Excluído!');
        } catch (e) { showToast('Erro', 'error'); }
    });
}

// ==========================================
// FORNECEDORES
// ==========================================
function renderFornecedores() {
    const termo = document.getElementById('busca-fornecedor-lista')?.value.toLowerCase() || ''; const filtrados = db.fornecedores.filter(f => f.nome.toLowerCase().includes(termo) || (f.doc && f.doc.includes(termo)));
    document.getElementById('tabela-fornecedores').innerHTML = filtrados.map(f => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${f.nome}</td><td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${f.doc || f.cnpj || '-'}</td><td class="p-4 text-slate-800 dark:text-slate-100"><i class="fa-solid fa-phone text-blue-500 mr-1"></i> ${f.wpp || '-'}</td><td class="p-4 text-center"><button onclick="editarFornecedor('${f.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirFornecedor('${f.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem fornecedores.</td></tr>';
}

function abrirModalFornecedor() {
    abaModal('forn', 'dados');
    document.getElementById('forn-id').value = '';
    ['nome', 'doc', 'ie', 'contato', 'wpp', 'email', 'cep', 'rua', 'numero', 'bairro', 'cidade', 'condicoes', 'produtos'].forEach(id => { const el = document.getElementById(`forn-${id}`); if (el) el.value = ''; });
    document.getElementById('forn-historico-body').innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver histórico.</td></tr>';
    document.getElementById('modal-fornecedor-title').innerText = 'Novo Fornecedor';
    const modalForn = document.getElementById('modal-fornecedor');
    modalForn.classList.remove('hidden');
    modalForn.style.display = 'flex';
}
function fecharModalFornecedor() {
    const modalForn = document.getElementById('modal-fornecedor');
    modalForn.classList.add('hidden');
    modalForn.style.display = '';
}

async function salvarFornecedor() {
    const id = document.getElementById('forn-id').value;
    const nome = document.getElementById('forn-nome').value.trim();
    if (!nome) return showToast('Razão Social obrigatória!', 'error');

    const f = {
        nome: nome, doc: document.getElementById('forn-doc').value, cnpj: document.getElementById('forn-doc').value,
        ie: document.getElementById('forn-ie').value, contato: document.getElementById('forn-contato').value,
        wpp: document.getElementById('forn-wpp').value, email: document.getElementById('forn-email').value,
        cep: document.getElementById('forn-cep').value, rua: document.getElementById('forn-rua').value,
        numero: document.getElementById('forn-numero').value, bairro: document.getElementById('forn-bairro').value,
        cidade: document.getElementById('forn-cidade').value, condicoes: document.getElementById('forn-condicoes').value,
        produtos: document.getElementById('forn-produtos').value
    };

    try {
        if (id) { await firestore.collection('fornecedores').doc(id).update(f); }
        else { await firestore.collection('fornecedores').add(f); }
        fecharModalFornecedor();
        showToast('Fornecedor Salvo!', 'success');
    } catch (e) { showToast('Erro', 'error'); }
}

function editarFornecedor(id) {
    const f = db.fornecedores.find(x => x.id === id); if (!f) return;
    abrirModalFornecedor(); document.getElementById('modal-fornecedor-title').innerText = `Editar: ${f.nome}`;
    document.getElementById('forn-id').value = id;
    for (let key in f) { if (key === 'id') continue; const el = document.getElementById(`forn-${key}`); if (el) el.value = f[key] || ''; }
    if (!f.doc && f.cnpj) document.getElementById('forn-doc').value = f.cnpj;

    const hist = db.compras ? db.compras.filter(c => c.cnpj === f.doc || c.cnpj === f.cnpj || c.fornecedor === f.nome) : [];
    document.getElementById('forn-historico-body').innerHTML = hist.length > 0 ? hist.map(c => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3">${formatData(c.data).split(' ')[0]}</td><td class="p-3 font-bold text-slate-700 dark:text-slate-200">${c.qtdTotal} itens</td><td class="p-3 text-right font-bold text-indigo-600">${formatMoney(c.totalNF)}</td></tr>`).join('') : '<tr><td colspan="3" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem notas.</td></tr>';
}

function excluirFornecedor(id) {
    abrirConfirmacao('Excluir', 'Isso não apagará as Notas. Continuar?', async () => {
        try {
            await firestore.collection('fornecedores').doc(id).delete();
            showToast('Excluído!');
        } catch (e) { showToast('Erro', 'error'); }
    });
}

// ==========================================
// ESTOQUE KARDEX (UI)
// ==========================================
function renderKardex() {
    document.getElementById('tabela-kardex').innerHTML = (db.movimentacoes || []).slice(0, 50).map(m => {
        let badgeClass = m.tipo.includes('ENTRADA') ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : (m.tipo === 'VENDA' || m.tipo === 'SAIDA' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400');
        let tipoHtml = String(m.tipo || '').split('<br>').map(t => `<span class="px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1 ${badgeClass}">${t}</span>`).join('<br>');
        let dataFormatada = (m.data && typeof formatData === 'function') ? formatData(m.data).replace(',', '') : (m.data || '-');
        return `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 text-xs text-slate-500 dark:text-slate-400">${dataFormatada}</td><td class="p-4 whitespace-nowrap">${tipoHtml}</td><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${m.prodNome}</td><td class="p-4 text-slate-600 dark:text-slate-300 text-xs">${m.ref}</td><td class="p-4 text-right font-black ${m.qtd > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500 dark:text-red-400'}">${m.qtd > 0 ? '+' + m.qtd : m.qtd}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma movimentação de estoque.</td></tr>';
}

async function gerarDescricaoIA(event) {
    const nome = document.getElementById('prod-nome').value.trim();
    const categoria = document.getElementById('prod-categoria').value;
    const marca = document.getElementById('prod-marca').value.trim();

    if (!nome) return showToast('Preencha o Nome do Produto primeiro!', 'error');

    const prompt = `Atue como um especialista em marketing de móveis de alto padrão e artigos para casa. Escreva uma descrição comercial curta, elegante, atraente e persuasiva (máximo de 3 parágrafos curtos) para o seguinte produto pronto para entrega:
    Nome: ${nome}
    Categoria: ${categoria}
    Marca/Fornecedor: ${marca || 'Genérica'}
    Destaque o design, conforto e crie desejo imediato de compra no cliente. Não use formatação em negrito.`;

    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
    btn.disabled = true;

    const resposta = await chamarGemini(prompt);

    if (resposta) {
        document.getElementById('prod-obs').value = resposta;
        showToast('Ficha técnica gerada com sucesso!', 'success');
    }

    btn.innerHTML = textoOriginal;
    btn.disabled = false;
}

// ==========================================
// IMPORTAÇÃO DE PLANILHA
// ==========================================
function baixarPlanilhaModeloProduto() {
    const cabecalho = "Nome do Produto;EAN (Codigo de Barras);Categoria;Custo;Preco de Venda;Estoque Atual\n";
    const exemplo1 = "Mesa de Jantar Madeira Maciça;78900000000;Mesas;500,00;750,00;10\n";
    const exemplo2 = "Cadeira Estofada;78900000001;Cadeiras;120,50;241,00;40\n";
    const csvContent = "\uFEFF" + cabecalho + exemplo1 + exemplo2;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "fc_moveis_Modelo_Produtos.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Planilha modelo baixada! Preencha e salve como CSV.", "info");
}

async function processarPlanilhaProdutos(event) {
    const file = event.target.files[0];
    if (!file) return;

    showToast("Lendo planilha, aguarde...", "info");

    // Verifica se não é csv
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast("Por favor, envie um arquivo .csv (separado por vírgulas ou ponto e vírgula).", "error");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const text = e.target.result;
            // Correcao: divide por CRLF, LF ou CR
            const linhas = text.split(/\r\n|\n|\r/).filter(linha => linha.trim() !== '');
            
            if (linhas.length <= 1) {
                showToast("A planilha parece estar vazia ou só tem o cabeçalho.", "error");
                return;
            }

            const separador = linhas[0].includes(';') ? ';' : ',';
            let produtosAdicionados = 0;

            const batch = firestore.batch();
            
            // Leitura dinâmica do cabeçalho para suportar planilha velha ou nova
            let colIndex = { nome: 0, ean: 1, categoria: 2, marca: 3, custo: 4, margem: 5, preco: 6, estoque: 7, min: 8 };
            const hCols = linhas[0].toLowerCase().split(separador).map(c => c.trim().replace(/^"|"$/g, ''));
            if (hCols[0].includes('nome')) {
                colIndex.nome = hCols.findIndex(c => c.includes('nome'));
                colIndex.ean = hCols.findIndex(c => c.includes('ean') || c.includes('barras'));
                colIndex.categoria = hCols.findIndex(c => c.includes('categoria'));
                colIndex.marca = hCols.findIndex(c => c.includes('marca'));
                colIndex.custo = hCols.findIndex(c => c.includes('custo'));
                colIndex.margem = hCols.findIndex(c => c.includes('margem'));
                colIndex.preco = hCols.findIndex(c => c.includes('preco') || c.includes('preço') || c.includes('venda'));
                colIndex.estoque = hCols.findIndex(c => c.includes('estoque') || c.includes('atual') || c.includes('qtd'));
                colIndex.min = hCols.findIndex(c => c.includes('minimo') || c.includes('mínimo'));
            }

            for (let i = 1; i < linhas.length; i++) {
                const colunas = linhas[i].split(separador).map(c => c.trim().replace(/^"|"$/g, ''));
                const nomeIdx = colIndex.nome !== -1 ? colIndex.nome : 0;
                if (!colunas[nomeIdx]) continue;

                const nome = colunas[nomeIdx];
                const ean = colIndex.ean !== -1 ? (colunas[colIndex.ean] || '') : '';
                const categoria = colIndex.categoria !== -1 ? (colunas[colIndex.categoria] || 'Geral') : 'Geral';
                const marca = colIndex.marca !== -1 ? (colunas[colIndex.marca] || '') : '';
                
                const strCusto = colIndex.custo !== -1 ? colunas[colIndex.custo] : null;
                const strPreco = colIndex.preco !== -1 ? colunas[colIndex.preco] : null;
                const strMargem = colIndex.margem !== -1 ? colunas[colIndex.margem] : null;
                
                const parseCustom = (val) => {
                    if (typeof parseInputMoney !== 'undefined') {
                        return parseInputMoney(val ? val.replace(',', '.') : 0) || 0;
                    }
                    return parseFloat((val || '0').replace(',', '.')) || 0;
                };

                const custo = parseCustom(strCusto);
                const preco = parseCustom(strPreco);
                let margem = parseCustom(strMargem);
                
                if (custo > 0 && preco > 0 && margem === 0) {
                    margem = parseFloat((((preco - custo) / custo) * 100).toFixed(2));
                }
                
                const strEstoque = colIndex.estoque !== -1 ? colunas[colIndex.estoque] : null;
                const strMin = colIndex.min !== -1 ? colunas[colIndex.min] : null;
                
                const estoque = typeof parseInputMoney !== 'undefined' ? (parseInputMoney((strEstoque||'0').replace(',','.')) || 0) : (parseFloat((strEstoque||'0').replace(',','.'))||0);
                const min = typeof parseInputMoney !== 'undefined' ? (parseInputMoney((strMin||'5').replace(',','.')) || 5) : (parseFloat((strMin||'5').replace(',','.'))||5);

                let existe = false;
                if (ean && ean !== '') {
                    existe = db.produtos && db.produtos.find(p => p.ean === ean);
                }

                if (!existe) {
                    const docRef = firestore.collection('produtos').doc();
                    batch.set(docRef, { nome, ean, categoria, marca, custo, margem, preco, estoque, min, foto: '', ativo: true });

                    if (estoque > 0) {
                        const karRef = firestore.collection('movimentacoes').doc();
                        batch.set(karRef, { data: new Date().toISOString(), ref: "Importação de Planilha", prodId: docRef.id, prodNome: nome, qtd: estoque, tipo: "INICIAL" });
                    }
                    produtosAdicionados++;
                }
            }

            if (produtosAdicionados > 0) {
                await batch.commit();
                showToast(`${produtosAdicionados} produtos importados com sucesso!`, "success");
            } else {
                showToast("Nenhum produto novo importado (podem ser EANs duplicados).", "warning");
            }
        } catch (error) {
            console.error("Erro ao importar planilha:", error);
            showToast("Erro ao processar planilha.", "error");
        }
    };
    reader.readAsText(file, "UTF-8");
    event.target.value = '';
}

// ==========================================
// FUNCIONÁRIOS / VENDEDORES E PERMISSÕES
// ==========================================

function renderFuncionarios() {
    const termoBusca = document.getElementById('busca-funcionario-lista').value.toLowerCase();
    
    let lista = db.funcionarios || [];
    if (termoBusca) {
        lista = lista.filter(f => 
            (f.nome && f.nome.toLowerCase().includes(termoBusca)) || 
            (f.email && f.email.toLowerCase().includes(termoBusca))
        );
    }
    
    lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    
    document.getElementById('tabela-funcionarios').innerHTML = lista.map(f => {
        let permissoesStr = [];
        if (f.perm_pdv) permissoesStr.push('PDV');
        if (f.perm_cadastros) permissoesStr.push('Cadastros');
        if (f.perm_gestao) permissoesStr.push('Gestão');
        if (f.perm_config) permissoesStr.push('Config');
        
        let permissoesBadge = permissoesStr.length > 0 ? permissoesStr.join(', ') : 'Nenhum Acesso';
        if (f.isAdmin) permissoesBadge = 'Acesso Total (Admin)';

        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 transition-colors">
            <td class="p-3">
                <div class="font-bold text-slate-800 dark:text-slate-100 uppercase">${f.nome || 'Sem Nome'}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">Permissões: <span class="text-blue-500 font-bold">${permissoesBadge}</span></div>
            </td>
            <td class="p-3 text-slate-600 dark:text-slate-300 font-medium">${f.email}</td>
            <td class="p-3 text-slate-600 dark:text-slate-300">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${f.vendedor === 'SIM' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
                    ${f.vendedor === 'SIM' ? 'Vendedor' : 'Interno'}
                </span>
            </td>
            <td class="p-3 font-bold text-blue-600">${f.comissao ? f.comissao + '%' : '0%'}</td>
            <td class="p-3 text-center flex items-center justify-center gap-1">
                <button onclick="abrirModalFuncionario('${f.id}')" class="text-indigo-500 hover:text-indigo-700 p-2" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="excluirFuncionario('${f.id}')" class="text-slate-400 hover:text-red-500 p-2" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum funcionário cadastrado.</td></tr>`;
}

function abrirModalFuncionario(id = null) {
    document.getElementById('func-id').value = id || '';
    
    if (id) {
        document.getElementById('modal-funcionario-title').innerText = 'Editar Funcionário';
        const f = (db.funcionarios || []).find(x => x.id === id);
        if (f) {
            document.getElementById('func-email').value = f.email || '';
            document.getElementById('func-email').disabled = true; // Email não muda após criar
            document.getElementById('func-senha').value = '';
            document.getElementById('func-senha-aviso').classList.remove('hidden');
            
            document.getElementById('func-nome').value = f.nome || '';
            document.getElementById('func-vendedor').value = f.vendedor || 'NAO';
            document.getElementById('func-comissao').value = f.comissao || 0;
            document.getElementById('func-telefone').value = f.telefone || '';
            
            document.getElementById('func-perm-dashboard').checked = !!f.perm_dashboard;
            document.getElementById('func-perm-pdv').checked = !!f.perm_pdv;
            document.getElementById('func-perm-cadastros').checked = !!f.perm_cadastros;
            document.getElementById('func-perm-gestao').checked = !!f.perm_gestao;
            document.getElementById('func-perm-config').checked = !!f.perm_config;
        }
    } else {
        document.getElementById('modal-funcionario-title').innerText = 'Novo Funcionário';
        document.getElementById('func-email').value = '';
        document.getElementById('func-email').disabled = false;
        document.getElementById('func-senha').value = '';
        document.getElementById('func-senha-aviso').classList.add('hidden');
        
        document.getElementById('func-nome').value = '';
        document.getElementById('func-vendedor').value = 'NAO';
        document.getElementById('func-comissao').value = 0;
        document.getElementById('func-telefone').value = '';
        
        document.getElementById('func-perm-dashboard').checked = true;
        document.getElementById('func-perm-pdv').checked = true;
        document.getElementById('func-perm-cadastros').checked = false;
        document.getElementById('func-perm-gestao').checked = false;
        document.getElementById('func-perm-config').checked = false;
    }
    
    document.getElementById('modal-funcionario').classList.remove('hidden');
    document.getElementById('modal-funcionario').style.display = 'flex';
}

function fecharModalFuncionario() {
    document.getElementById('modal-funcionario').classList.add('hidden');
    document.getElementById('modal-funcionario').style.display = 'none';
}

// Inicializa a instância secundária para criar contas sem deslogar o Admin
let secondaryAuthApp = null;
function getSecondaryApp() {
    if (!secondaryAuthApp) {
        secondaryAuthApp = firebase.initializeApp(firebaseConfig, "Secondary");
    }
    return secondaryAuthApp;
}

async function salvarFuncionario() {
    const id = document.getElementById('func-id').value;
    const email = document.getElementById('func-email').value.trim();
    const senha = document.getElementById('func-senha').value;
    
    const obj = {
        nome: document.getElementById('func-nome').value.trim().toUpperCase(),
        email: email,
        vendedor: document.getElementById('func-vendedor').value,
        comissao: parseInputMoney(document.getElementById('func-comissao').value) || 0,
        telefone: document.getElementById('func-telefone').value.trim(),
        perm_dashboard: document.getElementById('func-perm-dashboard').checked,
        perm_pdv: document.getElementById('func-perm-pdv').checked,
        perm_cadastros: document.getElementById('func-perm-cadastros').checked,
        perm_gestao: document.getElementById('func-perm-gestao').checked,
        perm_config: document.getElementById('func-perm-config').checked,
        ultimaAtualizacao: new Date().toISOString()
    };
    
    if (!obj.nome || !email) {
        return showToast('Preencha pelo menos Nome e E-mail!', 'error');
    }

    try {
        if (!id) {
            // CRIAR NOVO FUNCIONÁRIO
            if (!senha || senha.length < 6) return showToast('Para novos funcionários, informe uma senha de no mínimo 6 caracteres.', 'error');
            
            showToast('Criando conta de acesso...', 'info');
            
            const secApp = getSecondaryApp();
            const userCredential = await secApp.auth().createUserWithEmailAndPassword(email, senha);
            const uid = userCredential.user.uid;
            
            // Faz logout na instância secundária para não afetar nada
            await secApp.auth().signOut();
            
            obj.id = uid;
            await firestore.collection('funcionarios').doc(uid).set(obj);
            showToast('Funcionário e acesso criados com sucesso!', 'success');
            
        } else {
            // ATUALIZAR FUNCIONÁRIO EXISTENTE
            if (senha) {
                showToast('Aviso: Alteração de senha por aqui ainda não está implementada nesta versão.', 'info');
                // Se precisar mudar senha, teria que usar cloud functions ou Admin SDK.
                // Como workaround, o usuário pode usar a recuperação de senha na tela de login.
            }
            
            await firestore.collection('funcionarios').doc(id).set(obj, { merge: true });
            showToast('Funcionário atualizado com sucesso!', 'success');
        }
        
        fecharModalFuncionario();
        renderFuncionarios();
        
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Este e-mail já possui uma conta no sistema.', 'error');
        } else {
            showToast('Erro ao salvar: ' + error.message, 'error');
        }
    }
}

function excluirFuncionario(id) {
    abrirConfirmacao('Excluir Funcionário', 'ATENÇÃO: O cadastro será apagado do sistema, mas a conta de login continuará ativa no Firebase (devido a restrições de segurança do cliente). O usuário não poderá mais acessar o sistema. Continuar?', async () => {
        try {
            await firestore.collection('funcionarios').doc(id).delete();
            showToast('Funcionário excluído! Acesso revogado.', 'success');
            renderFuncionarios();
        } catch (e) {
            console.error(e);
            showToast('Erro ao excluir.', 'error');
        }
    });
}

// Detalhes da Venda no CRM
window.verDetalhesVenda = function(id) {
    try {
        const v = db.vendas.find(x => String(x.id) === String(id)); 
        if(!v) { 
            alert("Venda não encontrada no banco de dados local: " + id);
            return; 
        }
        
        const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
        let tipoTexto = v.tipo || 'VENDA';
        
        document.getElementById('det-venda-cliente').innerText = v.clienteNome || 'Desconhecido'; 
        document.getElementById('det-venda-data').innerText = `${v.data ? formatData(v.data).split(' ')[0] : '-'} | #${numPedStr}`; 
        document.getElementById('det-venda-pag').innerText = tipoTexto === 'ORÇAMENTO' ? 'Orçamento' : (v.pag || '-'); 
        
        let osInfoHtml = '';
        if (tipoTexto === 'SERVIÇO' && v.servicoDetalhes) {
            let galeriaHtml = '';
            if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) { 
                galeriaHtml = `<p class="mt-2"><strong>Fotos de Referência:</strong></p><div class="flex gap-2 flex-wrap mt-1">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" onclick="abrirZoom('${f}')" class="h-20 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`).join('')}</div>`; 
            } else if (v.servicoDetalhes.foto) { 
                galeriaHtml = `<p class="mt-2"><strong>Foto de Referência:</strong></p><img src="${v.servicoDetalhes.foto}" onclick="abrirZoom('${v.servicoDetalhes.foto}')" class="mt-1 h-24 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`; 
            }
            osInfoHtml = `
                <div class="mt-4 bg-purple-50 p-3 md:p-4 rounded-lg border border-purple-200 text-xs md:text-sm text-purple-900">
                    <h4 class="font-bold mb-2 uppercase text-purple-700 border-b border-purple-200 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Serviço</h4>
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <p><strong>Prazo de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'Não informado'}</p>
                        <p><strong>Garantia:</strong> ${v.servicoDetalhes.garantia || 'Nenhuma'}</p>
                    </div>
                    <p class="mb-2"><strong>Escopo / Diagnóstico:</strong><br> ${v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}</p>
                    ${galeriaHtml}
                </div>`;
        }
        
        document.getElementById('det-venda-obs').innerHTML = (v.obs ? v.obs : '<span class="text-slate-400">Nenhuma observação geral.</span>') + osInfoHtml;
        document.getElementById('det-venda-total').innerText = formatMoney(v.tot || 0);
        document.getElementById('det-venda-itens').innerHTML = (v.itens || []).map(i => `<tr class="border-b border-slate-100 dark:border-slate-700 last:border-0"><td class="py-2 text-slate-800 dark:text-slate-200">${i.nome}</td><td class="py-2 text-center text-slate-600 dark:text-slate-400">${i.qtd}x</td><td class="py-2 text-right text-slate-800 dark:text-slate-200 font-medium">${formatMoney(i.preco * i.qtd)}</td></tr>`).join('');
        
        const modal = document.getElementById('modal-detalhes-venda');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.zIndex = '9999';
        } else {
            alert("ERRO GRAVE: A janela de resumo não existe no código HTML. Por favor, feche TODAS as abas do sistema e abra novamente para forçar a atualização.");
        }
        modal.style.zIndex = '9999';
    } catch(err) {
        alert("Erro JS no resumo: " + err.message);
    }
}

window.fecharModalDetalhesVenda = function() { 
    document.getElementById('modal-detalhes-venda').classList.add('hidden'); 
    document.getElementById('modal-detalhes-venda').style.display = '';
}

// Event Delegation para clique no histórico (muito mais robusto que onclick inline)
document.addEventListener('click', function(e) {
    const tr = e.target.closest('tr.linha-historico');
    if (tr && tr.dataset.vendaId) {
        if (window.verDetalhesVenda) {
            window.verDetalhesVenda(tr.dataset.vendaId);
        } else {
            alert('Função de detalhes não está carregada!');
        }
    }
});
