// cadastro.js - L�gica de Produtos, Clientes, Fornecedores e Estoque

let acaoConfirmacaoPendente = null;

// Evita o "piscar" da tela carregando as abas instantaneamente antes do Firebase
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'produtos';
    if (typeof mudarVisaoLocal === 'function') mudarVisaoLocal(view);
});

// ==========================================
// NAVEGA��O E INICIALIZA��O
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
    // Liga os listeners do Firestore com cache inteligente (FCCache)
    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb, opts) {
        let ref = firestore.collection(col);
        if (opts && typeof opts.query === 'function') ref = opts.query(ref);
        return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };

    unsubProdutos = _listen('produtos', function(dados) {
        db.produtos = dados;
        const v = document.getElementById('view-produtos');
        if (v && v.classList.contains('active')) renderProdutos();
    });

    unsubClientes = _listen('clientes', function(dados) {
        db.clientes = dados;
        const v = document.getElementById('view-clientes');
        if (v && v.classList.contains('active')) renderClientes();
    });

    unsubFornecedores = _listen('fornecedores', function(dados) {
        db.fornecedores = dados;
        const v = document.getElementById('view-fornecedores');
        if (v && v.classList.contains('active')) renderFornecedores();
    });

    _listen('funcionarios', function(dados) {
        db.funcionarios = dados;
        if (typeof renderFuncionarios === 'function') renderFuncionarios();
    });

    unsubKardex = _listen('movimentacoes', function(dados) {
        db.movimentacoes = dados;
        const v = document.getElementById('view-estoque');
        if (v && v.classList.contains('active')) renderKardex();
    }, { query: function(ref) { return ref.orderBy('data', 'desc').limit(50); } });

    // Carrega vendas para exibir histórico de compras do cliente
    _listen('vendas', function(dados) {
        db.vendas = dados;
    });

    // Carrega categorias para o cadastro de produtos
    _listen('categorias', function(dados) {
        db.categorias = dados;
        if (typeof renderSelectCategorias === 'function') renderSelectCategorias();
    }, { query: function(ref) { return ref.orderBy('nome'); } });

    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    mudarVisaoLocal(view || 'produtos');
}

window.addEventListener('load', () => { initGlobalData(inicializarCadastro); });

// ==========================================
// FUN��ES GEN�RICAS DE UI
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
    try { let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); let data = await res.json(); if (!data.erro) { document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.localidade} - ${data.uf}`; } } catch (e) { console.error("Erro interno:", e); }
}

async function buscarCNPJ(prefix) {
    const elDoc = document.getElementById(`${prefix}-doc`); if (!elDoc) return; let cnpj = elDoc.value.replace(/\D/g, ''); if (cnpj.length !== 14) return showToast('Digite os 14 n�meros do CNPJ', 'error');
    showToast('Consultando Receita...', 'info');
    try {
        let res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); let data = await res.json();
        if (data.razao_social) { document.getElementById(`${prefix}-nome`).value = data.razao_social || ''; document.getElementById(`${prefix}-wpp`).value = data.ddd_telefone_1 || ''; document.getElementById(`${prefix}-cep`).value = data.cep || ''; document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.municipio || ''} - ${data.uf || ''}`; showToast('Empresa Importada!', 'success'); }
    } catch (e) { showToast('Servi�o indispon�vel.', 'error'); }
}

// ==========================================
// ESTOQUE KARDEX (Backend)
// ==========================================


// ==========================================
// CATEGORIAS (PRODUTOS)
// ==========================================
function renderSelectCategorias() {
    const selectCat = document.getElementById('prod-categoria');
    if (!selectCat) return;
    const valAtual = selectCat.value;
    let html = '<option value="">Sem Categoria</option>';
    if (db.categorias && db.categorias.length > 0) {
        db.categorias.forEach(cat => { html += `<option value="${cat.nome}">${cat.nome}</option>`; });
    }
    selectCat.innerHTML = html;
    if (valAtual && selectCat.querySelector(`option[value="${valAtual}"]`)) selectCat.value = valAtual;
    atualizarOpcoesSubcategoria();
}

function atualizarOpcoesSubcategoria() {
    const selectCat = document.getElementById('prod-categoria');
    const selectSub = document.getElementById('prod-subcategoria');
    if (!selectCat || !selectSub) return;
    const catSelecionada = selectCat.value;
    const valAtualSub = selectSub.value;
    let html = '<option value="">Sem Subcategoria</option>';
    if (catSelecionada && db.categorias) {
        const categoria = db.categorias.find(c => c.nome === catSelecionada);
        if (categoria && categoria.subcategorias && Array.isArray(categoria.subcategorias)) {
            categoria.subcategorias.forEach(sub => { html += `<option value="${sub}">${sub}</option>`; });
        }
    }
    selectSub.innerHTML = html;
    if (valAtualSub && selectSub.querySelector(`option[value="${valAtualSub}"]`)) selectSub.value = valAtualSub;
}

// ==========================================
// PRODUTOS
// ==========================================
window.prodSortDirection = 'asc';

function popularFiltroCategoriasProdutos() {
    const selectCat = document.getElementById('filtro-prod-categoria');
    if (!selectCat) return;
    const valAtual = selectCat.value;
    
    const catsSet = new Set();
    if (Array.isArray(db.categorias)) {
        db.categorias.forEach(c => {
            if (c && c.nome && String(c.nome).trim()) catsSet.add(String(c.nome).trim());
        });
    }
    if (Array.isArray(db.produtos)) {
        db.produtos.forEach(p => {
            if (p && p.categoria && String(p.categoria).trim()) catsSet.add(String(p.categoria).trim());
        });
    }
    
    const lista = Array.from(catsSet).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    let html = '<option value="">Todas as Categorias</option>';
    lista.forEach(cat => {
        html += '<option value="' + cat.replace(/"/g, '&quot;') + '">' + cat + '</option>';
    });
    selectCat.innerHTML = html;
    if (valAtual && catsSet.has(valAtual)) {
        selectCat.value = valAtual;
    }
}

function toggleSortProdutos() {
    const selectOrdem = document.getElementById('filtro-prod-ordem');
    if (selectOrdem) {
        if (selectOrdem.value === 'nome-asc') {
            selectOrdem.value = 'nome-desc';
        } else {
            selectOrdem.value = 'nome-asc';
        }
    } else {
        window.prodSortDirection = (window.prodSortDirection === 'asc') ? 'desc' : 'asc';
    }
    renderProdutos();
}

function alterarOrdemProdutos(novaOrdem) {
    if (novaOrdem === 'nome-asc') window.prodSortDirection = 'asc';
    if (novaOrdem === 'nome-desc') window.prodSortDirection = 'desc';
    renderProdutos();
}

function limparFiltrosProdutos() {
    const busca = document.getElementById('busca-produto-lista');
    if (busca) busca.value = '';
    const cat = document.getElementById('filtro-prod-categoria');
    if (cat) cat.value = '';
    const status = document.getElementById('filtro-prod-status');
    if (status) status.value = 'todos';
    const ordem = document.getElementById('filtro-prod-ordem');
    if (ordem) ordem.value = 'nome-asc';
    window.prodSortDirection = 'asc';
    renderProdutos();
}

function renderProdutos() {
    const inputBusca = document.getElementById('busca-produto-lista');
    const termo = (inputBusca?.value || '').trim();
    const statusFiltro = document.getElementById('filtro-prod-status')?.value || 'todos';
    const categoriaFiltro = document.getElementById('filtro-prod-categoria')?.value || '';
    const ordemFiltro = document.getElementById('filtro-prod-ordem')?.value || (window.prodSortDirection === 'desc' ? 'nome-desc' : 'nome-asc');

    // Popula categorias dinamicamente se necess?rio
    const selectCat = document.getElementById('filtro-prod-categoria');
    if (selectCat && selectCat.options.length <= 1 && ((db.produtos && db.produtos.length > 0) || (db.categorias && db.categorias.length > 0))) {
        popularFiltroCategoriasProdutos();
    }

    // Bot?o de limpar busca r?pida
    const btnLimparBusca = document.getElementById('btn-limpar-busca-produto');
    if (btnLimparBusca) {
        if (termo) btnLimparBusca.classList.remove('hidden');
        else btnLimparBusca.classList.add('hidden');
    }

    // Normalizador de texto para busca sem distin??o de acentos ou mai?sculas/min?sculas
    const normalizar = (txt) => {
        return (txt || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    };
    const termoNorm = normalizar(termo);

    const produtos = Array.isArray(db.produtos) ? db.produtos : [];

    let filtrados = produtos.filter(p => {
        if (!p) return false;

        // Filtro de texto (nome, c?digo de barras EAN, c?digo interno, marca, categoria, observa??o, ID)
        if (termoNorm) {
            const matchNome = normalizar(p.nome).includes(termoNorm);
            const matchEan = normalizar(p.ean).includes(termoNorm);
            const matchCodigo = normalizar(p.codigo).includes(termoNorm);
            const matchMarca = normalizar(p.marca).includes(termoNorm);
            const matchCat = normalizar(p.categoria).includes(termoNorm);
            const matchSub = normalizar(p.subcategoria).includes(termoNorm);
            const matchNcm = normalizar(p.ncm).includes(termoNorm);
            const matchObs = normalizar(p.obs).includes(termoNorm);
            const matchLegenda = normalizar(p.legenda).includes(termoNorm);
            const matchId = normalizar(p.id).includes(termoNorm);

            if (!matchNome && !matchEan && !matchCodigo && !matchMarca && !matchCat && !matchSub && !matchNcm && !matchObs && !matchLegenda && !matchId) {
                return false;
            }
        }

        // Filtro de categoria
        if (categoriaFiltro) {
            const pCat = (p.categoria || '').trim().toLowerCase();
            if (pCat !== categoriaFiltro.toLowerCase()) return false;
        }

        // Filtro de status / estoque
        const estoque = Number(p.estoque) || 0;
        const minimo = Number(p.min) || 0;
        if (statusFiltro === 'ok' && !(estoque > minimo)) return false;
        if (statusFiltro === 'alerta' && !(estoque > 0 && estoque <= minimo)) return false;
        if (statusFiltro === 'zerado' && !(estoque <= 0)) return false;
        if (statusFiltro === 'ativos' && p.ativo === false) return false;
        if (statusFiltro === 'inativos' && p.ativo !== false) return false;

        return true;
    });

    // Ordena??o
    if (ordemFiltro === 'nome-asc') {
        window.prodSortDirection = 'asc';
        if (typeof ordenarListaAlfabeticamente === 'function') {
            filtrados = ordenarListaAlfabeticamente(filtrados, 'nome', 'asc');
        } else {
            filtrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
        }
    } else if (ordemFiltro === 'nome-desc') {
        window.prodSortDirection = 'desc';
        if (typeof ordenarListaAlfabeticamente === 'function') {
            filtrados = ordenarListaAlfabeticamente(filtrados, 'nome', 'desc');
        } else {
            filtrados.sort((a, b) => (b.nome || '').localeCompare(a.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
        }
    } else if (ordemFiltro === 'preco-asc') {
        filtrados.sort((a, b) => (parseFloat(a.preco) || 0) - (parseFloat(b.preco) || 0));
    } else if (ordemFiltro === 'preco-desc') {
        filtrados.sort((a, b) => (parseFloat(b.preco) || 0) - (parseFloat(a.preco) || 0));
    } else if (ordemFiltro === 'estoque-desc') {
        filtrados.sort((a, b) => (parseFloat(b.estoque) || 0) - (parseFloat(a.estoque) || 0));
    } else if (ordemFiltro === 'estoque-asc') {
        filtrados.sort((a, b) => (parseFloat(a.estoque) || 0) - (parseFloat(b.estoque) || 0));
    }

    // Atualiza ?cone do cabe?alho da tabela e bot?o de ordem
    const thIcon = document.getElementById('sort-icon-produto');
    const btnOrdemIcon = document.getElementById('btn-ordem-icon');
    const btnOrdemLabel = document.getElementById('btn-ordem-label');
    const ordemIconeSelect = document.getElementById('filtro-prod-ordem-icone');

    if (ordemFiltro === 'nome-asc') {
        if (thIcon) thIcon.className = 'fa-solid fa-arrow-down-a-z ml-1 text-indigo-500';
        if (btnOrdemIcon) btnOrdemIcon.className = 'fa-solid fa-arrow-down-a-z';
        if (btnOrdemLabel) btnOrdemLabel.textContent = 'A - Z';
        if (ordemIconeSelect) ordemIconeSelect.className = 'fa-solid fa-arrow-down-a-z absolute left-3 top-3 text-slate-400 text-xs pointer-events-none';
    } else if (ordemFiltro === 'nome-desc') {
        if (thIcon) thIcon.className = 'fa-solid fa-arrow-up-z-a ml-1 text-indigo-500';
        if (btnOrdemIcon) btnOrdemIcon.className = 'fa-solid fa-arrow-up-z-a';
        if (btnOrdemLabel) btnOrdemLabel.textContent = 'Z - A';
        if (ordemIconeSelect) ordemIconeSelect.className = 'fa-solid fa-arrow-up-z-a absolute left-3 top-3 text-slate-400 text-xs pointer-events-none';
    } else {
        if (thIcon) thIcon.className = 'fa-solid fa-sort ml-1 text-slate-400';
        if (btnOrdemIcon) btnOrdemIcon.className = 'fa-solid fa-arrow-down-wide-short';
        if (btnOrdemLabel) btnOrdemLabel.textContent = 'Personalizada';
        if (ordemIconeSelect) ordemIconeSelect.className = 'fa-solid fa-arrow-down-wide-short absolute left-3 top-3 text-slate-400 text-xs pointer-events-none';
    }

    // Atualiza indicador de filtros ativos e bot?o limpar
    const temFiltroAtivo = Boolean(termo || categoriaFiltro || statusFiltro !== 'todos' || (ordemFiltro !== 'nome-asc' && ordemFiltro !== ''));
    const badgeFiltro = document.getElementById('badge-filtro-ativo');
    if (badgeFiltro) {
        if (temFiltroAtivo) badgeFiltro.classList.remove('hidden');
        else badgeFiltro.classList.add('hidden');
    }
    const btnLimpar = document.getElementById('btn-limpar-filtros');
    if (btnLimpar) {
        if (temFiltroAtivo) btnLimpar.classList.remove('hidden');
        else btnLimpar.classList.add('hidden');
    }

    // Atualiza contador de produtos
    const contadorEl = document.getElementById('contador-produtos');
    if (contadorEl) {
        const total = produtos.length;
        if (filtrados.length === total) {
            contadorEl.textContent = total + ' produto' + (total !== 1 ? 's' : '') + ' cadastrado' + (total !== 1 ? 's' : '');
        } else {
            contadorEl.textContent = 'Exibindo ' + filtrados.length + ' de ' + total + ' produto' + (total !== 1 ? 's' : '');
        }
    }

    const tbody = document.getElementById('tabela-produtos');
    if (!tbody) return;

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-slate-500 dark:text-slate-400">
                    <i class="fa-solid fa-box-open text-4xl mb-3 text-slate-300 dark:text-slate-600 block"></i>
                    <p class="font-bold text-slate-700 dark:text-slate-200">Nenhum produto encontrado</p>
                    <p class="text-xs mt-1 text-slate-400">Tente ajustar os termos de busca ou filtros selecionados.</p>
                    ${temFiltroAtivo ? '<button type="button" onclick="limparFiltrosProdutos()" class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 text-xs font-bold transition-colors"><i class="fa-solid fa-rotate-left"></i> Limpar filtros</button>' : ''}
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const isBaixo = p.estoque <= p.min; const isZerado = p.estoque <= 0;
        const corEstoque = isZerado ? 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400' : (isBaixo ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200');
        const fHtml = p.foto ? '<img src="' + p.foto + '" onclick="abrirZoom(\'' + p.foto + '\')" class="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 mx-auto cursor-zoom-in hover:opacity-80 transition">' : '<div class="w-10 h-10 mx-auto rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs"><i class="fa-regular fa-image"></i></div>';
        const badgeInativo = p.ativo === false ? '<span class="bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 px-2 py-0.5 rounded text-[10px] ml-2 font-bold"><i class="fa-solid fa-ban"></i> INATIVO</span>' : '';
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${p.ativo === false ? 'opacity-60' : ''}">
            <td class="p-3 text-center">${fHtml}</td>
            <td class="p-3"><p class="font-bold text-slate-800 dark:text-slate-100">${p.nome} ${badgeInativo}</p><p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">EAN: ${p.ean || 'S/N'} | ${p.categoria || 'Sem categoria'} | Marca: ${p.marca || '-'}</p></td>
            <td class="p-3 text-right"><p class="text-slate-600 dark:text-slate-300 font-medium">${formatMoney(p.custo)}</p><p class="text-[10px] text-blue-500 font-bold">${p.custo > 0 ? (((p.preco - p.custo) / p.custo) * 100).toFixed(2) : (p.margem || 0).toFixed(2)}% MKP</p></td>
            <td class="p-3 text-right font-bold text-emerald-600">${formatMoney(p.preco)}</td>
            <td class="p-3 text-center font-bold"><span class="px-2 py-1 rounded ${corEstoque}">${p.estoque} un</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-1 mt-2"><button onclick="editarProduto('${p.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirProduto('${p.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}

function abrirModalProduto() {
    const divAcao = document.getElementById('div-acao-vinculo-xml'); if(divAcao) divAcao.classList.add('hidden');
    abaModal('prod', 'dados'); document.getElementById('modal-produto-title').innerText = 'Cadastrar Produto';
    ['id', 'nome', 'ean', 'marca', 'custo', 'preco', 'margem', 'estoque', 'minimo', 'obs', 'ncm', 'cfop', 'csosn', 'origem', 'cest'].forEach(id => { const el = document.getElementById(`prod-${id}`); if (el) el.value = ''; });
    document.getElementById('prod-ativo').value = 'true'; document.getElementById('prod-foto-base64').value = '';
    document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden');
    document.getElementById('prod-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver o hist�rico.</td></tr>';
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

    if (!nome || isNaN(preco)) return showToast('Preencha Nome e Pre�o de Venda!', 'error');

    const p = {
        nome, preco,
        ean: document.getElementById('prod-ean').value,
        marca: document.getElementById('prod-marca').value,
        categoria: document.getElementById('prod-categoria').value,
        unidade: document.getElementById('prod-unidade').value,
        custo: parseInputMoney(document.getElementById('prod-custo').value) || 0,
        margem: (parseInputMoney(document.getElementById('prod-custo').value) || 0) > 0 ? parseFloat((((preco - (parseInputMoney(document.getElementById('prod-custo').value) || 0)) / (parseInputMoney(document.getElementById('prod-custo').value) || 0)) * 100).toFixed(2)) : (parseInputMoney(document.getElementById('prod-margem').value) || 0),
        estoque: parseInputMoney(document.getElementById('prod-estoque').value) || 0,
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
    
    if (!p) return showToast('Produto n�o encontrado!', 'error');

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

    document.getElementById('prod-ativo').value = p.ativo !== false ? 'true' : 'false';
    document.getElementById('prod-foto-base64').value = p.foto || '';
    if (p.foto) { document.getElementById('preview-foto').src = p.foto; document.getElementById('preview-foto').classList.remove('hidden'); document.getElementById('texto-sem-foto').classList.add('hidden'); }
    else { document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden'); }

    const hist = db.movimentacoes ? db.movimentacoes.filter(m => String(m.prodId) === idStr) : [];
    document.getElementById('prod-historico-body').innerHTML = hist.length > 0 ? hist.map(m => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3">${formatData(m.data).split(' ')[0]}</td><td class="p-3 font-bold">${m.tipo}</td><td class="p-3">${m.ref}</td><td class="p-3 text-right font-bold ${m.qtd > 0 ? 'text-indigo-600' : 'text-red-500'}">${m.qtd > 0 ? '+' + m.qtd : m.qtd}</td></tr>`).join('') : '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem movimenta��es.</td></tr>';
}

function excluirProduto(id) {
    abrirConfirmacao('Excluir Produto', 'Remover produto permanentemente?', async () => {
        try {
            await firestore.collection('produtos').doc(id).delete();
            showToast('Produto exclu�do!');
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
    let filtrados = db.clientes.filter(c => c.nome.toLowerCase().includes(termo) || (c.doc && c.doc.includes(termo)));
    if (typeof ordenarListaAlfabeticamente === 'function') {
        filtrados = ordenarListaAlfabeticamente(filtrados, 'nome');
    } else {
        filtrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }
    document.getElementById('tabela-clientes').innerHTML = filtrados.map(c => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${c.nome}</td><td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${c.doc || '-'}</td><td class="p-4 text-slate-800 dark:text-slate-100"><i class="fa-brands fa-whatsapp text-emerald-500 mr-1"></i> ${c.wpp || '-'}</td><td class="p-4 text-slate-600 dark:text-slate-300">${c.cidade || '-'}</td><td class="p-4 text-center"><button onclick="editarCliente('${c.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirCliente('${c.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum cliente encontrado.</td></tr>';
}

function abrirModalCliente() {
    abaModal('cli', 'dados');
    document.getElementById('cli-id').value = '';
    ['nome', 'doc', 'rg', 'nasc', 'wpp', 'fixo', 'email', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'ibge', 'obs'].forEach(campo => {
        const el = document.getElementById(`cli-${campo}`);
        if (el) el.value = '';
    });
    document.getElementById('cli-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver o hist�rico.</td></tr>';
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
    if (!nome) return showToast('Nome � obrigat�rio!', 'error');

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

    // Se n�o encontrou (cache vazio), busca diretamente no Firestore
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

    if (!c) return showToast('Cliente n�o encontrado!', 'error');

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
        ? hist.map(v => `<tr data-venda-id="${v.id}" class="linha-historico hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 cursor-pointer"><td class="p-3">${formatData(v.data).split(' ')[0]}</td><td class="p-3 font-mono text-slate-500 dark:text-slate-400">#${String(v.numeroPedido || v.id).padStart(4, '0')}</td><td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${v.pag}</span></td><td class="p-3 text-right font-bold text-emerald-600">${formatMoney(v.tot)}</td></tr>`).join('')
        : '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma compra.</td></tr>';
}

function excluirCliente(id) {
    abrirConfirmacao('Excluir Cliente', 'Remover cliente?', async () => {
        try {
            await firestore.collection('clientes').doc(id).delete();
            showToast('Cliente Exclu�do!');
        } catch (e) { showToast('Erro', 'error'); }
    });
}

// ==========================================
// FORNECEDORES
// ==========================================
function renderFornecedores() {
    const termo = document.getElementById('busca-fornecedor-lista')?.value.toLowerCase() || ''; 
    let filtrados = db.fornecedores.filter(f => f.nome.toLowerCase().includes(termo) || (f.doc && f.doc.includes(termo)));
    if (typeof ordenarListaAlfabeticamente === 'function') {
        filtrados = ordenarListaAlfabeticamente(filtrados, 'nome');
    } else {
        filtrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }
    document.getElementById('tabela-fornecedores').innerHTML = filtrados.map(f => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${f.nome}</td><td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${f.doc || f.cnpj || '-'}</td><td class="p-4 text-slate-800 dark:text-slate-100"><i class="fa-solid fa-phone text-blue-500 mr-1"></i> ${f.wpp || '-'}</td><td class="p-4 text-center"><button onclick="editarFornecedor('${f.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirFornecedor('${f.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem fornecedores.</td></tr>';
}

function abrirModalFornecedor() {
    abaModal('forn', 'dados');
    document.getElementById('forn-id').value = '';
    ['nome', 'doc', 'ie', 'contato', 'wpp', 'email', 'cep', 'rua', 'numero', 'bairro', 'cidade', 'condicoes', 'produtos'].forEach(id => { const el = document.getElementById(`forn-${id}`); if (el) el.value = ''; });
    document.getElementById('forn-historico-body').innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver hist�rico.</td></tr>';
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
    if (!nome) return showToast('Raz�o Social obrigat�ria!', 'error');

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
    abrirConfirmacao('Excluir', 'Isso n�o apagar� as Notas. Continuar?', async () => {
        try {
            await firestore.collection('fornecedores').doc(id).delete();
            showToast('Exclu�do!');
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
    }).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma movimenta��o de estoque.</td></tr>';
}

async function gerarDescricaoIA(event) {
    const nome = document.getElementById('prod-nome').value.trim();
    const categoria = document.getElementById('prod-categoria').value;
    const marca = document.getElementById('prod-marca').value.trim();

    if (!nome) return showToast('Preencha o Nome do Produto primeiro!', 'error');

    const prompt = `Atue como um especialista em marketing de m�veis de alto padr�o e artigos para casa. Escreva uma descri��o comercial curta, elegante, atraente e persuasiva (m�ximo de 3 par�grafos curtos) para o seguinte produto pronto para entrega:
    Nome: ${nome}
    Categoria: ${categoria}
    Marca/Fornecedor: ${marca || 'Gen�rica'}
    Destaque o design, conforto e crie desejo imediato de compra no cliente. N�o use formata��o em negrito.`;

    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
    btn.disabled = true;

    const resposta = await chamarGemini(prompt);

    if (resposta) {
        document.getElementById('prod-obs').value = resposta;
        showToast('Ficha t�cnica gerada com sucesso!', 'success');
    }

    btn.innerHTML = textoOriginal;
    btn.disabled = false;
}

// ==========================================
// IMPORTA��O DE PLANILHA
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
// FUNCION�RIOS / VENDEDORES E PERMISS�ES
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
        if (f.perm_gestao) permissoesStr.push('Gest�o');
        if (f.perm_config) permissoesStr.push('Config');
        
        let permissoesBadge = permissoesStr.length > 0 ? permissoesStr.join(', ') : 'Nenhum Acesso';
        if (f.isAdmin) permissoesBadge = 'Acesso Total (Admin)';

        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 transition-colors">
            <td class="p-3">
                <div class="font-bold text-slate-800 dark:text-slate-100 uppercase">${f.nome || 'Sem Nome'}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">Permiss�es: <span class="text-blue-500 font-bold">${permissoesBadge}</span></div>
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
    }).join('') || `<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum funcion�rio cadastrado.</td></tr>`;
}

function abrirModalFuncionario(id = null) {
    document.getElementById('func-id').value = id || '';
    
    if (id) {
        document.getElementById('modal-funcionario-title').innerText = 'Editar Funcion�rio';
        const f = (db.funcionarios || []).find(x => x.id === id);
        if (f) {
            document.getElementById('func-email').value = f.email || '';
            document.getElementById('func-email').disabled = true; // Email n�o muda ap�s criar
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
        document.getElementById('modal-funcionario-title').innerText = 'Novo Funcion�rio';
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

// Inicializa a inst�ncia secund�ria para criar contas sem deslogar o Admin
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
            // CRIAR NOVO FUNCION�RIO
            if (!senha || senha.length < 6) return showToast('Para novos funcion�rios, informe uma senha de no m�nimo 6 caracteres.', 'error');
            
            showToast('Criando conta de acesso...', 'info');
            
            const secApp = getSecondaryApp();
            const userCredential = await secApp.auth().createUserWithEmailAndPassword(email, senha);
            const uid = userCredential.user.uid;
            
            // Faz logout na inst�ncia secund�ria para n�o afetar nada
            await secApp.auth().signOut();
            
            obj.id = uid;
            await firestore.collection('funcionarios').doc(uid).set(obj);
            showToast('Funcion�rio e acesso criados com sucesso!', 'success');
            
        } else {
            // ATUALIZAR FUNCION�RIO EXISTENTE
            if (senha) {
                showToast('Aviso: Altera��o de senha por aqui ainda n�o est� implementada nesta vers�o.', 'info');
                // Se precisar mudar senha, teria que usar cloud functions ou Admin SDK.
                // Como workaround, o usu�rio pode usar a recupera��o de senha na tela de login.
            }
            
            await firestore.collection('funcionarios').doc(id).set(obj, { merge: true });
            showToast('Funcion�rio atualizado com sucesso!', 'success');
        }
        
        fecharModalFuncionario();
        renderFuncionarios();
        
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Este e-mail j� possui uma conta no sistema.', 'error');
        } else {
            showToast('Erro ao salvar: ' + error.message, 'error');
        }
    }
}

function excluirFuncionario(id) {
    abrirConfirmacao('Excluir Funcion�rio', 'ATEN��O: O cadastro ser� apagado do sistema, mas a conta de login continuar� ativa no Firebase (devido a restri��es de seguran�a do cliente). O usu�rio n�o poder� mais acessar o sistema. Continuar?', async () => {
        try {
            await firestore.collection('funcionarios').doc(id).delete();
            showToast('Funcion�rio exclu�do! Acesso revogado.', 'success');
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
            alert("Venda n�o encontrada no banco de dados local: " + id);
            return; 
        }
        
        const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
        let tipoTexto = v.tipo || 'VENDA';
        
        document.getElementById('det-venda-cliente').innerText = v.clienteNome || 'Desconhecido'; 
        document.getElementById('det-venda-data').innerText = `${v.data ? formatData(v.data).split(' ')[0] : '-'} | #${numPedStr}`; 
        document.getElementById('det-venda-pag').innerText = tipoTexto === 'OR�AMENTO' ? 'Or�amento' : (v.pag || '-'); 
        
        let osInfoHtml = '';
        if (tipoTexto === 'SERVI�O' && v.servicoDetalhes) {
            let galeriaHtml = '';
            if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) { 
                galeriaHtml = `<p class="mt-2"><strong>Fotos de Refer�ncia:</strong></p><div class="flex gap-2 flex-wrap mt-1">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" onclick="abrirZoom('${f}')" class="h-20 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`).join('')}</div>`; 
            } else if (v.servicoDetalhes.foto) { 
                galeriaHtml = `<p class="mt-2"><strong>Foto de Refer�ncia:</strong></p><img src="${v.servicoDetalhes.foto}" onclick="abrirZoom('${v.servicoDetalhes.foto}')" class="mt-1 h-24 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`; 
            }
            osInfoHtml = `
                <div class="mt-4 bg-purple-50 p-3 md:p-4 rounded-lg border border-purple-200 text-xs md:text-sm text-purple-900">
                    <h4 class="font-bold mb-2 uppercase text-purple-700 border-b border-purple-200 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Servi�o</h4>
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <p><strong>Prazo de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'N�o informado'}</p>
                        <p><strong>Garantia:</strong> ${v.servicoDetalhes.garantia || 'Nenhuma'}</p>
                    </div>
                    <p class="mb-2"><strong>Escopo / Diagn�stico:</strong><br> ${v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}</p>
                    ${galeriaHtml}
                </div>`;
        }
        
        document.getElementById('det-venda-obs').innerHTML = (v.obs ? v.obs : '<span class="text-slate-400">Nenhuma observa��o geral.</span>') + osInfoHtml;
        document.getElementById('det-venda-total').innerText = formatMoney(v.tot || 0);
        document.getElementById('det-venda-itens').innerHTML = (v.itens || []).map(i => `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-50">
                <td class="p-3 font-medium text-slate-700 dark:text-slate-200 text-xs">
                    ${i.nome || 'Produto/Servi�o'} ${i.obsVenda ? `<br><span class="text-[10px] text-slate-400">Obs: ${i.obsVenda}</span>` : ''}
                </td>
                <td class="p-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">${i.qtd || 1}</td>
                <td class="p-3 text-right text-xs text-slate-500 dark:text-slate-400">${formatMoney(i.preco || 0)}</td>
                <td class="p-3 text-right text-xs font-bold text-slate-800 dark:text-slate-100">${formatMoney((i.preco || 0) * (i.qtd || 1))}</td>
            </tr>`).join('');
        
        const modal = document.getElementById('modal-detalhes-venda');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
    } catch(err) {
        alert("Erro JS no resumo: " + err.message);
    }
}

window.fecharModalDetalhesVenda = function() { 
    document.getElementById('modal-detalhes-venda').classList.add('hidden'); 
    document.getElementById('modal-detalhes-venda').style.display = '';
}

// Event Delegation para clique no hist�rico (muito mais robusto que onclick inline)
document.addEventListener('click', function(e) {
    const tr = e.target.closest('tr.linha-historico');
    if (tr && tr.dataset.vendaId) {
        if (window.verDetalhesVenda) {
            window.verDetalhesVenda(tr.dataset.vendaId);
        } else {
            alert('Fun��o de detalhes n�o est� carregada!');
        }
    }
});




// NOVO: Fun��es auxiliares para V�nculo de XML
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




window.popularFiltroCategoriasProdutos = popularFiltroCategoriasProdutos;
window.toggleSortProdutos = toggleSortProdutos;
window.alterarOrdemProdutos = alterarOrdemProdutos;
window.limparFiltrosProdutos = limparFiltrosProdutos;
