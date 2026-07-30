// cadastro.js - Lógica de Produtos, Clientes, Fornecedores e Estoque

let acaoConfirmacaoPendente = null;

// ==========================================
// NAVEGAÇÃO E INICIALIZAÇÃO
// ==========================================
function mudarVisaoLocal(viewId) {
    document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('active'); });
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('text-slate-300'); });
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
    if(activeBtn) { activeBtn.classList.remove('text-slate-300'); activeBtn.classList.add('bg-blue-600', 'text-white'); }
    
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }
    
    if(viewId === 'produtos') renderProdutos();
    if(viewId === 'clientes') renderClientes();
    if(viewId === 'fornecedores') renderFornecedores();
    if(viewId === 'estoque') renderKardex();
}

function inicializarCadastro() {
    renderProdutos();
    
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if(view) mudarVisaoLocal(view);
}

window.onload = () => { initGlobalData(inicializarCadastro); };

// ==========================================
// FUNÇÕES GENÉRICAS DE UI
// ==========================================
function abaModal(prefix, nomeAba) {
    const modalId = `#modal-${prefix === 'cli' ? 'cliente' : (prefix === 'forn' ? 'fornecedor' : 'produto')}`;
    document.querySelectorAll(`${modalId} .aba-conteudo`).forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
    document.getElementById(`${prefix}-aba-${nomeAba}`).classList.remove('hidden'); document.getElementById(`${prefix}-aba-${nomeAba}`).classList.add('active');
    document.querySelectorAll(`[id^="${prefix}-btn-"]`).forEach(el => { el.classList.remove('border-blue-600','text-blue-600'); el.classList.add('border-transparent','text-slate-500'); });
    const btnAtivo = document.getElementById(`${prefix}-btn-${nomeAba}`);
    btnAtivo.classList.remove('border-transparent','text-slate-500'); btnAtivo.classList.add('border-blue-600','text-blue-600');
}

function abrirConfirmacao(titulo, mensagem, acao) { 
    document.getElementById('modal-confirm-title').innerText = titulo; 
    document.getElementById('modal-confirm-msg').innerText = mensagem; 
    acaoConfirmacaoPendente = acao; 
    document.getElementById('modal-confirmacao').classList.remove('hidden'); 
    document.getElementById('modal-confirm-btn').onclick = function() {
        if(acaoConfirmacaoPendente) acaoConfirmacaoPendente();
        fecharModalConfirmacao();
    };
}
function fecharModalConfirmacao() { document.getElementById('modal-confirmacao').classList.add('hidden'); acaoConfirmacaoPendente = null; document.getElementById('modal-confirm-btn').onclick = null; }

function abrirZoom(src) { if(!src) return; document.getElementById('zoom-img-src').src = src; document.getElementById('modal-zoom').classList.remove('hidden'); }
function fecharZoom() { document.getElementById('modal-zoom').classList.add('hidden'); document.getElementById('zoom-img-src').src = ''; }

async function buscarCEP(prefix) {
    const el = document.getElementById(`${prefix}-cep`); if(!el) return; let cep = el.value.replace(/\D/g, ''); if (cep.length !== 8) return;
    try { let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); let data = await res.json(); if (!data.erro) { document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.localidade} - ${data.uf}`; } } catch (e) {}
}

async function buscarCNPJ(prefix) {
    const elDoc = document.getElementById(`${prefix}-doc`); if(!elDoc) return; let cnpj = elDoc.value.replace(/\D/g, ''); if (cnpj.length !== 14) return showToast('Digite os 14 números do CNPJ', 'error');
    showToast('Consultando Receita...', 'info');
    try {
        let res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); let data = await res.json();
        if(data.razao_social) { document.getElementById(`${prefix}-nome`).value = data.razao_social || ''; document.getElementById(`${prefix}-wpp`).value = data.ddd_telefone_1 || ''; document.getElementById(`${prefix}-cep`).value = data.cep || ''; document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.municipio||''} - ${data.uf||''}`; showToast('Empresa Importada!', 'success'); }
    } catch (e) { showToast('Serviço indisponível.', 'error'); }
}

// ==========================================
// PRODUTOS
// ==========================================
function renderProdutos() {
    const termo = document.getElementById('busca-produto-lista')?.value.toLowerCase() || ''; const statusFiltro = document.getElementById('filtro-prod-status')?.value || 'todos';
    let filtrados = db.produtos.filter(p => p.nome.toLowerCase().includes(termo) || (p.ean && p.ean.includes(termo)) || (p.marca && p.marca.toLowerCase().includes(termo)));
    if(statusFiltro === 'alerta') filtrados = filtrados.filter(p => p.estoque > 0 && p.estoque <= p.min);
    if(statusFiltro === 'zerado') filtrados = filtrados.filter(p => p.estoque <= 0);
    if(statusFiltro === 'ok') filtrados = filtrados.filter(p => p.estoque > p.min);

    document.getElementById('tabela-produtos').innerHTML = filtrados.map(p => {
        const isBaixo = p.estoque <= p.min; const isZerado = p.estoque <= 0;
        const corEstoque = isZerado ? 'text-red-600 bg-red-50' : (isBaixo ? 'text-amber-600 bg-amber-50' : 'text-slate-700');
        const fHtml = p.foto ? `<img src="${p.foto}" onclick="abrirZoom('${p.foto}')" class="w-10 h-10 rounded object-cover border border-slate-200 mx-auto cursor-zoom-in hover:opacity-80 transition">` : `<div class="w-10 h-10 mx-auto rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs"><i class="fa-regular fa-image"></i></div>`;
        const badgeInativo = p.ativo === false ? `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] ml-2 font-bold"><i class="fa-solid fa-ban"></i> INATIVO</span>` : '';
        return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 ${p.ativo === false ? 'opacity-60' : ''}">
            <td class="p-3 text-center">${fHtml}</td>
            <td class="p-3"><p class="font-bold text-slate-800">${p.nome} ${badgeInativo}</p><p class="text-[11px] text-slate-500 font-mono">EAN: ${p.ean || 'S/N'} | ${p.categoria} | Marca: ${p.marca || '-'}</p></td>
            <td class="p-3 text-right"><p class="text-slate-600 font-medium">${formatMoney(p.custo)}</p><p class="text-[10px] text-blue-500 font-bold">${p.margem}% MKP</p></td>
            <td class="p-3 text-right font-bold text-emerald-600">${formatMoney(p.preco)}</td>
            <td class="p-3 text-center font-bold"><span class="px-2 py-1 rounded ${corEstoque}">${p.estoque} un</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-1 mt-2"><button onclick="editarProduto(${p.id})" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirProduto(${p.id})" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}

function abrirModalProduto() {
    abaModal('prod', 'dados'); document.getElementById('modal-produto-title').innerText = 'Cadastrar Produto';
    ['id','nome','ean','marca','custo','preco','margem','estoque','minimo','obs'].forEach(id => { const el = document.getElementById(`prod-${id}`); if(el) el.value = ''; });
    document.getElementById('prod-ativo').value = 'true'; document.getElementById('prod-foto-base64').value = '';
    document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden');
    document.getElementById('prod-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Cadastre para ver o histórico.</td></tr>';
    document.getElementById('modal-produto').classList.remove('hidden');
}

function fecharModalProduto() { document.getElementById('modal-produto').classList.add('hidden'); }

function processarFoto(event) {
    const file = event.target.files[0]; if(!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image(); img.onload = function() {
            const canvas = document.createElement('canvas'); let w = img.width, h = img.height; const MAX = 300;
            if(w > h) { if(w > MAX) { h *= MAX/w; w = MAX; } } else { if(h > MAX) { w *= MAX/h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('preview-foto').src = dataUrl; document.getElementById('preview-foto').classList.remove('hidden');
            document.getElementById('texto-sem-foto').classList.add('hidden'); document.getElementById('prod-foto-base64').value = dataUrl;
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
}

function calcularPrecoMargin(quemMudou = 'preco') {
    const custo = parseFloat(document.getElementById('prod-custo').value) || 0;
    const precoEl = document.getElementById('prod-preco'); const margemEl = document.getElementById('prod-margem');
    if(custo <= 0) return;
    if(quemMudou === 'preco') { margemEl.value = ((((parseFloat(precoEl.value)||0) - custo) / custo) * 100).toFixed(2); }
    else if (quemMudou === 'margem') { precoEl.value = (custo * (1 + ((parseFloat(margemEl.value)||0) / 100))).toFixed(2); }
    else if (quemMudou === 'custo') { if(parseFloat(margemEl.value)>0) precoEl.value = (custo * (1 + (parseFloat(margemEl.value) / 100))).toFixed(2); }
}

function salvarProduto() {
    const id = document.getElementById('prod-id').value; const nome = document.getElementById('prod-nome').value.trim(); const preco = parseFloat(document.getElementById('prod-preco').value);
    if(!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

    const p = {
        id: id ? parseInt(id) : Date.now(), nome, preco, ean: document.getElementById('prod-ean').value, marca: document.getElementById('prod-marca').value, categoria: document.getElementById('prod-categoria').value,
        unidade: document.getElementById('prod-unidade').value, custo: parseFloat(document.getElementById('prod-custo').value) || 0, margem: parseFloat(document.getElementById('prod-margem').value) || 0,
        estoque: parseInt(document.getElementById('prod-estoque').value) || 0, min: parseInt(document.getElementById('prod-minimo').value) || 0, ativo: document.getElementById('prod-ativo').value === 'true',
        obs: document.getElementById('prod-obs').value, foto: document.getElementById('prod-foto-base64').value
    };

    if(id) {
        const idx = db.produtos.findIndex(x => x.id === p.id); const difEstoque = p.estoque - db.produtos[idx].estoque;
        if(difEstoque !== 0) salvarKardex('Ajuste Manual', p.id, p.nome, difEstoque, 'AJUSTE'); db.produtos[idx] = p; showToast('Atualizado!');
    } else { db.produtos.push(p); if(p.estoque > 0) salvarKardex('Estoque Inicial', p.id, p.nome, p.estoque, 'INICIAL'); showToast('Salvo!', 'success'); }
    
    saveDB(); fecharModalProduto(); renderProdutos();
}

function editarProduto(id) {
    const p = db.produtos.find(x => x.id === id); if(!p) return;
    abrirModalProduto(); document.getElementById('modal-produto-title').innerText = 'Editar Produto';
    for(let key in p) { const el = document.getElementById(`prod-${key === 'min' ? 'minimo' : key}`); if(el && key !== 'foto' && key !== 'ativo') el.value = p[key]; }
    document.getElementById('prod-ativo').value = p.ativo !== false ? 'true' : 'false'; document.getElementById('prod-foto-base64').value = p.foto || '';
    if(p.foto) { document.getElementById('preview-foto').src = p.foto; document.getElementById('preview-foto').classList.remove('hidden'); document.getElementById('texto-sem-foto').classList.add('hidden'); } 
    else { document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden'); }
    
    const hist = db.movimentacoes.filter(m => m.prodId === p.id);
    document.getElementById('prod-historico-body').innerHTML = hist.length > 0 ? hist.map(m => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-3">${formatData(m.data).split(' ')[0]}</td><td class="p-3 font-bold">${m.tipo}</td><td class="p-3">${m.ref}</td><td class="p-3 text-right font-bold ${m.qtd > 0 ? 'text-indigo-600' : 'text-red-500'}">${m.qtd > 0 ? '+'+m.qtd : m.qtd}</td></tr>`).join('') : '<tr><td colspan="4" class="p-6 text-center text-slate-500">Sem movimentações.</td></tr>';
}

function excluirProduto(id) { abrirConfirmacao('Excluir Produto', 'Remover produto permanentemente?', () => { db.produtos = db.produtos.filter(p => p.id !== id); saveDB(); renderProdutos(); showToast('Excluído!'); }); }

// ==========================================
// CLIENTES
// ==========================================
function renderClientes() {
    const termo = document.getElementById('busca-cliente-lista')?.value.toLowerCase() || ''; const filtrados = db.clientes.filter(c => c.nome.toLowerCase().includes(termo) || (c.doc && c.doc.includes(termo)));
    document.getElementById('tabela-clientes').innerHTML = filtrados.map(c => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-4 font-bold text-slate-800">${c.nome}</td><td class="p-4 text-slate-600 font-mono">${c.doc || '-'}</td><td class="p-4 text-slate-800"><i class="fa-brands fa-whatsapp text-emerald-500 mr-1"></i> ${c.wpp || '-'}</td><td class="p-4 text-slate-600">${c.cidade || '-'}</td><td class="p-4 text-center"><button onclick="editarCliente(${c.id})" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirCliente(${c.id})" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
}

function abrirModalCliente() { abaModal('cli', 'dados'); document.getElementById('cli-id').value = ''; ['nome','doc','rg','nasc','wpp','fixo','email','cep','rua','numero','bairro','cidade','obs'].forEach(id => { const el = document.getElementById(`cli-${id}`); if(el) el.value = ''; }); document.getElementById('cli-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Cadastre para ver o histórico.</td></tr>'; document.getElementById('modal-cliente-title').innerText = 'Novo Cliente'; document.getElementById('modal-cliente').classList.remove('hidden'); }
function fecharModalCliente() { document.getElementById('modal-cliente').classList.add('hidden'); }

function salvarCliente() {
    const id = document.getElementById('cli-id').value; const nome = document.getElementById('cli-nome').value.trim(); if(!nome) return showToast('Nome é obrigatório!', 'error');
    const c = { id: id ? parseInt(id) : Date.now(), nome: nome, doc: document.getElementById('cli-doc').value, rg: document.getElementById('cli-rg').value, nasc: document.getElementById('cli-nasc').value, wpp: document.getElementById('cli-wpp').value, fixo: document.getElementById('cli-fixo').value, email: document.getElementById('cli-email').value, cep: document.getElementById('cli-cep').value, rua: document.getElementById('cli-rua').value, numero: document.getElementById('cli-numero').value, bairro: document.getElementById('cli-bairro').value, cidade: document.getElementById('cli-cidade').value, obs: document.getElementById('cli-obs').value };
    if(id) { const idx = db.clientes.findIndex(x => x.id === c.id); db.clientes[idx] = c; } else { db.clientes.push(c); } saveDB(); fecharModalCliente(); renderClientes(); showToast('Salvo!', 'success');
}

function editarCliente(id) {
    const c = db.clientes.find(x => x.id === id); if(!c) return;
    abrirModalCliente(); document.getElementById('modal-cliente-title').innerText = `Editar: ${c.nome}`;
    for(let key in c) { const el = document.getElementById(`cli-${key}`); if(el) el.value = c[key] || ''; }
    const hist = db.vendas.filter(v => String(v.clienteId) === String(c.id)); 
    document.getElementById('cli-historico-body').innerHTML = hist.length > 0 ? hist.map(v => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-3">${formatData(v.data).split(' ')[0]}</td><td class="p-3 font-mono text-slate-500">#${String(v.numeroPedido || v.id).padStart(4, '0')}</td><td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${v.pag}</span></td><td class="p-3 text-right font-bold text-emerald-600">${formatMoney(v.tot)}</td></tr>`).join('') : '<tr><td colspan="4" class="p-6 text-center text-slate-500">Nenhuma compra.</td></tr>';
}

function excluirCliente(id) { abrirConfirmacao('Excluir Cliente', 'Remover cliente?', () => { db.clientes = db.clientes.filter(c => c.id !== id); saveDB(); renderClientes(); showToast('Excluído!'); }); }

// ==========================================
// FORNECEDORES
// ==========================================
function renderFornecedores() {
    const termo = document.getElementById('busca-fornecedor-lista')?.value.toLowerCase() || ''; const filtrados = db.fornecedores.filter(f => f.nome.toLowerCase().includes(termo) || (f.doc && f.doc.includes(termo)));
    document.getElementById('tabela-fornecedores').innerHTML = filtrados.map(f => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-4 font-bold text-slate-800">${f.nome}</td><td class="p-4 text-slate-600 font-mono">${f.doc || f.cnpj || '-'}</td><td class="p-4 text-slate-800"><i class="fa-solid fa-phone text-blue-500 mr-1"></i> ${f.wpp || '-'}</td><td class="p-4 text-center"><button onclick="editarFornecedor(${f.id})" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirFornecedor(${f.id})" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500">Sem fornecedores.</td></tr>';
}

function abrirModalFornecedor() { abaModal('forn', 'dados'); document.getElementById('forn-id').value = ''; ['nome','doc','ie','contato','wpp','email','cep','rua','numero','bairro','cidade','condicoes','produtos'].forEach(id => { const el = document.getElementById(`forn-${id}`); if(el) el.value = ''; }); document.getElementById('forn-historico-body').innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-500">Cadastre para ver histórico.</td></tr>'; document.getElementById('modal-fornecedor-title').innerText = 'Novo Fornecedor'; document.getElementById('modal-fornecedor').classList.remove('hidden'); }
function fecharModalFornecedor() { document.getElementById('modal-fornecedor').classList.add('hidden'); }

function salvarFornecedor() {
    const id = document.getElementById('forn-id').value; const nome = document.getElementById('forn-nome').value.trim(); if(!nome) return showToast('Razão Social obrigatória!', 'error');
    const f = { id: id ? parseInt(id) : Date.now(), nome: nome, doc: document.getElementById('forn-doc').value, cnpj: document.getElementById('forn-doc').value, ie: document.getElementById('forn-ie').value, contato: document.getElementById('forn-contato').value, wpp: document.getElementById('forn-wpp').value, email: document.getElementById('forn-email').value, cep: document.getElementById('forn-cep').value, rua: document.getElementById('forn-rua').value, numero: document.getElementById('forn-numero').value, bairro: document.getElementById('forn-bairro').value, cidade: document.getElementById('forn-cidade').value, condicoes: document.getElementById('forn-condicoes').value, produtos: document.getElementById('forn-produtos').value };
    if(id) { const idx = db.fornecedores.findIndex(x => x.id === f.id); db.fornecedores[idx] = f; } else { db.fornecedores.push(f); } saveDB(); fecharModalFornecedor(); renderFornecedores(); showToast('Fornecedor Salvo!', 'success');
}

function editarFornecedor(id) {
    const f = db.fornecedores.find(x => x.id === id); if(!f) return;
    abrirModalFornecedor(); document.getElementById('modal-fornecedor-title').innerText = `Editar: ${f.nome}`;
    for(let key in f) { const el = document.getElementById(`forn-${key}`); if(el) el.value = f[key] || ''; }
    if(!f.doc && f.cnpj) document.getElementById('forn-doc').value = f.cnpj;
    const hist = db.compras.filter(c => c.cnpj === f.doc || c.cnpj === f.cnpj || c.fornecedor === f.nome);
    document.getElementById('forn-historico-body').innerHTML = hist.length > 0 ? hist.map(c => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-3">${formatData(c.data).split(' ')[0]}</td><td class="p-3 font-bold text-slate-700">${c.qtdTotal} itens</td><td class="p-3 text-right font-bold text-indigo-600">${formatMoney(c.totalNF)}</td></tr>`).join('') : '<tr><td colspan="3" class="p-6 text-center text-slate-500">Sem notas.</td></tr>';
}

function excluirFornecedor(id) { abrirConfirmacao('Excluir', 'Isso não apagará as Notas. Continuar?', () => { db.fornecedores = db.fornecedores.filter(f => f.id !== id); saveDB(); renderFornecedores(); showToast('Excluído!'); }); }

// ==========================================
// ESTOQUE KARDEX
// ==========================================
function salvarKardex(ref, prodId, prodNome, qtd, tipo) { db.movimentacoes.unshift({ id: Date.now() + Math.random(), data: new Date().toISOString(), ref, prodId, prodNome, qtd, tipo }); }

function renderKardex() {
    document.getElementById('tabela-kardex').innerHTML = db.movimentacoes.slice(0, 50).map(m => `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-4 text-xs text-slate-500">${formatData(m.data)}</td><td class="p-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.tipo.includes('ENTRADA') ? 'bg-indigo-100 text-indigo-700' : (m.tipo === 'VENDA' || m.tipo === 'SAIDA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}">${m.tipo}</span></td><td class="p-4 font-bold text-slate-800">${m.prodNome}</td><td class="p-4 text-slate-600 text-xs">${m.ref}</td><td class="p-4 text-right font-black ${m.qtd > 0 ? 'text-indigo-600' : 'text-red-500'}">${m.qtd > 0 ? '+'+m.qtd : m.qtd}</td></tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500">Nenhuma movimentação de estoque.</td></tr>'; 
}
async function gerarDescricaoIA(event) {
    const nome = document.getElementById('prod-nome').value.trim();
    const categoria = document.getElementById('prod-categoria').value;
    const marca = document.getElementById('prod-marca').value.trim();

    if(!nome) return showToast('Preencha o Nome do Produto primeiro!', 'error');

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
    
    if(resposta) {
        document.getElementById('prod-obs').value = resposta;
        showToast('Ficha técnica gerada com sucesso!', 'success');
    }

    btn.innerHTML = textoOriginal;
    btn.disabled = false;
}
// ==========================================
// IMPORTAÇÃO E EXPORTAÇÃO DE PLANILHA DE PRODUTOS
// ==========================================

function baixarPlanilhaModeloProduto() {
    // Cabeçalho exato que o sistema vai ler
    const cabecalho = "Nome do Produto;EAN (Codigo de Barras);Categoria;Marca;Custo;Margem de Lucro %;Preco de Venda Final;Estoque Atual;Estoque Minimo\n";
    // Um exemplo de como o usuário deve preencher
    const exemplo1 = "Mesa de Jantar Madeira Maciça;78900000000;Mesas;FC Móveis;500,00;50;750,00;10;2\n";
    const exemplo2 = "Cadeira Estofada;78900000001;Cadeiras;FC Móveis;120,50;100;241,00;40;10\n";
    
    // O \uFEFF força o Excel a ler os acentos (ã, ç, é) corretamente no Brasil
    const csvContent = "\uFEFF" + cabecalho + exemplo1 + exemplo2;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "FC_Moveis_Modelo_Produtos.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast("Planilha modelo baixada! Preencha e salve como CSV.", "info");
}

function processarPlanilhaProdutos(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showToast("Lendo planilha, aguarde...", "info");
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            // Separa o texto por linhas e tira linhas em branco
            const linhas = text.split('\n').filter(linha => linha.trim() !== '');
            
            if (linhas.length <= 1) {
                return showToast("A planilha parece estar vazia ou só tem o cabeçalho.", "error");
            }

            // Descobre automaticamente se o Excel salvou separando por Ponto e Vírgula (Padrão BR) ou Vírgula
            const separador = linhas[0].includes(';') ? ';' : ',';
            let produtosAdicionados = 0;

            if (!db.produtos) db.produtos = [];

            // Pula a primeira linha (i=1) porque é o cabeçalho, e começa a ler os dados
            for (let i = 1; i < linhas.length; i++) {
                const colunas = linhas[i].split(separador).map(c => c.trim().replace(/^"|"$/g, ''));
                
                // Se não tem nome, pula a linha
                if (!colunas[0]) continue;

                const nome = colunas[0];
                const ean = colunas[1] || '';
                const categoria = colunas[2] || 'Geral';
                const marca = colunas[3] || '';
                
                // Troca a vírgula do Brasil pelo Ponto americano para fazer o cálculo correto
                const custo = parseFloat(colunas[4] ? colunas[4].replace(',', '.') : 0) || 0;
                const margem = parseFloat(colunas[5] ? colunas[5].replace(',', '.') : 0) || 0;
                const preco = parseFloat(colunas[6] ? colunas[6].replace(',', '.') : 0) || 0;
                
                const estoque = parseInt(colunas[7]) || 0;
                const min = parseInt(colunas[8]) || 5;

                // Checagem de segurança: evita cadastrar EAN duplicado
                let existe = false;
                if (ean && ean !== '') {
                    existe = db.produtos.find(p => p.ean === ean);
                }
                
                if (!existe) {
                    const novoProdId = Date.now() + i; // Cria ID único
                    db.produtos.push({
                        id: novoProdId,
                        nome: nome,
                        ean: ean,
                        categoria: categoria,
                        marca: marca,
                        custo: custo,
                        margem: margem,
                        preco: preco,
                        estoque: estoque,
                        min: min,
                        foto: '', // Planilha não sobe foto, o usuário edita depois se quiser
                        ativo: true
                    });
                    
                    // Se a planilha já trouxer estoque, grava no Kardex (Histórico)
                    if (estoque > 0) {
                        salvarKardex("Importação de Planilha", novoProdId, nome, estoque, "INICIAL");
                    }
                    produtosAdicionados++;
                }
            }

            if (produtosAdicionados > 0) {
                saveDB(); // Salva no banco Firebase
                if (typeof renderProdutos === "function") renderProdutos(); // Atualiza a tabela na tela
                showToast(`${produtosAdicionados} produtos importados com sucesso!`, "success");
            } else {
                showToast("Nenhum produto novo importado (podem ser EANs duplicados).", "info");
            }

        } catch (err) {
            console.error(err);
            showToast("Erro ao ler a planilha. Verifique o formato CSV.", "error");
        }
    };
    reader.readAsText(file, "UTF-8");
    event.target.value = ''; // Limpa o "cachê" do arquivo para poder subir a mesma planilha de novo depois
}