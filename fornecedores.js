// fornecedores.js - Lógica Exclusiva de Fornecedores

let acaoConfirmacaoPendente = null;

document.addEventListener('DOMContentLoaded', () => {
    // Liga os listeners do Firestore para Fornecedores e Compras (para o histórico)
    firestore.collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFornecedores();
    });

    firestore.collection('compras').onSnapshot(snap => {
        db.compras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
});

function abaModal(prefix, nomeAba) {
    const modalId = `#modal-${prefix === 'cli' ? 'cliente' : (prefix === 'forn' ? 'fornecedor' : 'produto')}`;
    document.querySelectorAll(`${modalId} .aba-conteudo`).forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
    const abaEl = document.getElementById(`${prefix}-aba-${nomeAba}`);
    if(abaEl) {
        abaEl.classList.remove('hidden'); 
        abaEl.classList.add('active');
    }
    document.querySelectorAll(`[id^="${prefix}-btn-"]`).forEach(el => { 
        el.classList.remove('border-blue-600', 'text-blue-600'); 
        el.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400'); 
    });
    const btnAtivo = document.getElementById(`${prefix}-btn-${nomeAba}`);
    if(btnAtivo) {
        btnAtivo.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400'); 
        btnAtivo.classList.add('border-blue-600', 'text-blue-600');
    }
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

function fecharModalConfirmacao() { 
    document.getElementById('modal-confirmacao').classList.add('hidden'); 
    acaoConfirmacaoPendente = null; 
    document.getElementById('modal-confirm-btn').onclick = null; 
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
        if (data.razao_social) { 
            document.getElementById(`${prefix}-nome`).value = data.razao_social || ''; 
            document.getElementById(`${prefix}-wpp`).value = data.ddd_telefone_1 || ''; 
            document.getElementById(`${prefix}-cep`).value = data.cep || ''; 
            document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; 
            document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; 
            document.getElementById(`${prefix}-cidade`).value = `${data.municipio || ''} - ${data.uf || ''}`; 
            showToast('Empresa Importada!', 'success'); 
        }
    } catch (e) { showToast('Serviço indisponível.', 'error'); }
}

function renderFornecedores() {
    const termo = document.getElementById('busca-fornecedor-lista')?.value.toLowerCase() || ''; 
    const filtrados = (db.fornecedores || []).filter(f => (f.nome || '').toLowerCase().includes(termo) || (f.doc && f.doc.includes(termo)));
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
    document.getElementById('forn-historico-body').innerHTML = hist.length > 0 ? hist.map(c => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3">${(typeof formatData === 'function' ? formatData(c.data) : c.data).split(' ')[0]}</td><td class="p-3 font-bold text-slate-700 dark:text-slate-200">${c.qtdTotal} itens</td><td class="p-3 text-right font-bold text-indigo-600">${typeof formatMoney === 'function' ? formatMoney(c.totalNF) : c.totalNF}</td></tr>`).join('') : '<tr><td colspan="3" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem notas.</td></tr>';
}

function excluirFornecedor(id) {
    abrirConfirmacao('Excluir', 'Isso não apagará as Notas. Continuar?', async () => {
        try {
            await firestore.collection('fornecedores').doc(id).delete();
            showToast('Excluído!', 'success');
        } catch (e) { showToast('Erro', 'error'); }
    });
}

