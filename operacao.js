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

function inicializarOperacao() {
    aplicarIdentidadeVisualNoMenu(); 
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'pdv'; 
    mudarVisaoLocal(view);
}

window.onload = () => { initGlobalData(inicializarOperacao); };

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

function salvarKardex(ref, prodId, prodNome, qtd, tipo) { 
    if(!db.movimentacoes) db.movimentacoes = []; 
    db.movimentacoes.unshift({ 
        id: Date.now() + Math.random(), 
        data: new Date().toISOString(), 
        ref: ref || '', 
        prodId: prodId || '', 
        prodNome: prodNome || 'Produto', 
        qtd: qtd || 0, 
        tipo: tipo || 'AJUSTE' 
    }); 
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
    divConsumidor.className = 'p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 text-sm font-bold text-slate-700 bg-slate-50';
    divConsumidor.innerHTML = `<i class="fa-solid fa-user text-slate-400 mr-2"></i>Consumidor Final (Padrão)`;
    divConsumidor.onclick = () => {
        document.getElementById('pdv-cliente').value = '0';
        document.getElementById('pdv-cliente-busca').value = '';
        dropdown.classList.add('hidden');
    };
    dropdown.appendChild(divConsumidor);

    filtrados.forEach(c => {
        const div = document.createElement('div');
        div.className = 'p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 text-sm flex flex-col transition-colors';
        div.innerHTML = `<span class="font-bold text-slate-800">${c.nome}</span><span class="text-[10px] text-slate-500">${c.wpp || c.documento || c.cpfCnpj || 'Sem docs'}</span>`;
        div.onclick = () => {
            document.getElementById('pdv-cliente').value = c.id;
            document.getElementById('pdv-cliente-busca').value = c.nome;
            dropdown.classList.add('hidden');
        };
        dropdown.appendChild(div);
    });

    dropdown.classList.remove('hidden');
}

function abrirModalClienteRapido() {
    document.getElementById('cli-rapido-nome').value = '';
    document.getElementById('cli-rapido-wpp').value = '';
    document.getElementById('cli-rapido-doc').value = '';
    document.getElementById('modal-cliente-rapido').classList.remove('hidden');
}

function fecharModalClienteRapido() {
    document.getElementById('modal-cliente-rapido').classList.add('hidden');
}

function salvarClienteRapido() {
    const nome = document.getElementById('cli-rapido-nome').value.trim();
    if(!nome) return showToast('Nome do cliente é obrigatório!', 'error');

    const novoCliente = {
        id: Date.now(),
        nome: nome,
        wpp: document.getElementById('cli-rapido-wpp').value.trim(),
        documento: document.getElementById('cli-rapido-doc').value.trim(),
        dataCadastro: new Date().toISOString()
    };

    if(!db.clientes) db.clientes = [];
    db.clientes.push(novoCliente);
    saveDB();
    
    fecharModalClienteRapido();
    atualizarListaClientesPDV(novoCliente.id);
    showToast('Cliente cadastrado e selecionado!', 'success');
}

// ==========================================
// 5. CADASTRO RÁPIDO DE PRODUTO NO PDV
// ==========================================
function abrirModalProduto() {
    const ids = ['prod-nome', 'prod-ean', 'prod-marca', 'prod-preco', 'prod-foto-base64'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
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

function salvarProdutoRapido() {
    const nomeEl = document.getElementById('prod-nome');
    const precoEl = document.getElementById('prod-preco');
    if(!nomeEl || !precoEl) return showToast('Erro no formulário.', 'error');
    const nome = nomeEl.value.trim(); const preco = parseFloat(precoEl.value);
    if(!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

    const ean = document.getElementById('prod-ean') ? document.getElementById('prod-ean').value : '';
    const marca = document.getElementById('prod-marca') ? document.getElementById('prod-marca').value : '';
    const custo = document.getElementById('prod-custo') ? parseFloat(document.getElementById('prod-custo').value) : 0;
    const estoque = document.getElementById('prod-estoque') ? parseInt(document.getElementById('prod-estoque').value) : 0;
    const foto = document.getElementById('prod-foto-base64') ? document.getElementById('prod-foto-base64').value : '';

    const p = {
        id: Date.now(), nome: nome, preco: preco, ean: ean, marca: marca, categoria: 'Geral', unidade: 'Un', custo: custo || 0, margem: 0, estoque: estoque || 0, min: 1, ativo: true, obs: '', foto: foto
    };

    if(!db.produtos) db.produtos = [];
    db.produtos.push(p); 
    if(p.estoque > 0) salvarKardex('Estoque Inicial PDV', p.id, p.nome, p.estoque, 'INICIAL'); 
    
    saveDB(); 
    fecharModalProduto(); 
    processarAdicaoProduto(p); 
    showToast('Produto cadastrado e adicionado!', 'success');
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
            <button onclick="removerFotoOS(${idx})" class="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `).join(''); 
}
function removerFotoOS(index) { osFotosArray.splice(index, 1); renderizarFotosOS(); }

// ==========================================
// 7. MOTORES DE IMPRESSÃO E PDF (BLINDADOS)
// ==========================================
function printHtmlSeguro(htmlCompleto) {
    showToast("Preparando documento para impressão...", "info");
    let oldIframe = document.getElementById('iframe-impressao');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'iframe-impressao';
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
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
                .print\\:hidden { display: none !important; }
                table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
            </style>
        </head>
        <body class="bg-white p-4">${htmlCompleto}</body>
        </html>
    `);
    doc.close();

    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 1500);
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
    if (typeof window.html2pdf === 'undefined') { showToast('Biblioteca PDF carregando...', 'error'); return; }
    const element = document.getElementById(areaId); 
    if(!element) return showToast("Erro: Área do PDF não encontrada.", "error");
    const clone = element.cloneNode(true); 
    clone.querySelectorAll('.print\\:hidden').forEach(el => el.style.display = 'none'); 
    
    clone.classList.remove('hidden');
    clone.style.display = 'block';
    clone.style.opacity = '1';
    clone.style.visibility = 'visible';

    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'pdf-loading-overlay';
    loadingOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.95); z-index: 9999999; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; text-align: center;';
    loadingOverlay.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i><h2 style="font-size: 1.5rem; font-weight: bold;">Gerando PDF Oficial...</h2><p style="color: #cbd5e1; margin-top: 0.5rem;">Processando documento, aguarde.</p>';
    document.body.appendChild(loadingOverlay);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute'; wrapper.style.top = '0'; wrapper.style.left = '0'; wrapper.style.width = '850px'; 
    wrapper.style.background = '#ffffff'; wrapper.style.zIndex = '999998'; wrapper.style.padding = '20px';
    wrapper.appendChild(clone); document.body.appendChild(wrapper);
    
    document.body.classList.remove('h-screen', 'overflow-hidden');
    window.scrollTo(0, 0);

    const opt = { margin: 10, filename: `${filename}_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowWidth: 850 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }; 
    
    setTimeout(() => {
        try {
            html2pdf().set(opt).from(wrapper).save().then(() => { 
                document.body.classList.add('h-screen', 'overflow-hidden');
                wrapper.remove(); loadingOverlay.remove(); showToast('PDF gerado com sucesso!', 'success'); 
            }).catch(err => { 
                console.error(err); document.body.classList.add('h-screen', 'overflow-hidden');
                wrapper.remove(); loadingOverlay.remove(); showToast('Erro ao processar imagem do PDF.', 'error'); 
            }); 
        } catch(e) { document.body.classList.add('h-screen', 'overflow-hidden'); wrapper.remove(); loadingOverlay.remove(); showToast('Falha na biblioteca de PDF.', 'error'); }
    }, 500); 
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
    
    baixarPDF('wpp-pdf-container', filename);

    setTimeout(() => {
        window.open(`https://wa.me/${numLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
        showToast('PDF salvo! Arraste-o para a conversa no WhatsApp.', 'success');
        divWhatsApp.remove(); 
    }, 2500); 
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
    const dataEmissaoOperacao = v.data ? new Date(v.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');

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
            <strong>Data da Operação:</strong> ${dataEmissaoOperacao}
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
    
    const opSelect = document.getElementById('pdv-operacao'); 
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
    
    if (produtosFiltrados.length === 0) { 
        dropdown.classList.add('hidden'); 
        return; 
    }
    
    produtosFiltrados.forEach(prod => {
        if(prod.ativo === false) return; 
        
        const div = document.createElement('div'); 
        div.className = 'p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 text-sm flex justify-between items-center transition-colors';
        const precoFormatado = Number(prod.preco || 0).toFixed(2).replace('.', ','); 
        const nomeProd = prod.nome || 'Produto Sem Nome';
        
        div.innerHTML = `<span class="font-medium text-slate-700">${nomeProd}</span> <span class="font-bold text-emerald-600">R$ ${precoFormatado}</span>`;
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
    const op = document.getElementById('pdv-operacao') ? document.getElementById('pdv-operacao').value : 'Venda'; 
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
        const fHtml = item.foto ? `<img src="${item.foto}" onclick="abrirZoomCart(${i})" class="w-10 h-10 rounded object-cover border border-slate-200 mx-auto cursor-zoom-in hover:opacity-80 transition" title="Ver foto em tela cheia">` : `<div class="w-10 h-10 mx-auto rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs border border-slate-200"><i class="fa-regular fa-image"></i></div>`; 
        return `
        <tr class="hover:bg-slate-50 border-b border-slate-50">
            <td class="py-2 text-center">${fHtml}</td>
            <td class="py-2 text-slate-800 font-medium">
                ${item.nome}
                <input type="text" placeholder="Obs do item (cor, lado, etc...)" value="${item.obsVenda || ''}" onchange="pdvMudarObsItem(${i}, this.value)" class="w-full mt-1 bg-white border border-slate-200 rounded px-2 py-1 text-[10px] outline-none focus:border-blue-400 placeholder:text-slate-300">
            </td>
            <td class="py-2 text-center"><input type="number" min="1" value="${item.qtd}" onchange="pdvMudarQtd(${i}, this.value)" class="w-14 text-center border border-slate-300 rounded-lg p-1.5 font-bold outline-none"></td>
            <td class="py-2 text-right hidden sm:table-cell"><input type="number" step="0.01" value="${item.preco}" onchange="pdvMudarPreco(${i}, this.value)" class="w-20 text-right border border-slate-300 rounded-lg p-1.5 font-bold text-slate-600 outline-none focus:border-blue-500"></td>
            <td class="py-2 text-right font-bold text-slate-800">${formatMoney((item.preco || 0) * (item.qtd || 1))}</td>
            <td class="py-2 text-center"><button onclick="cart.splice(${i},1); renderCarrinho()" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash text-lg"></i></button></td>
        </tr>`;
    }).join(''); 
    pdvAtualizarTotais();
}

function pdvMudarQtd(i, n) { 
    const op = document.getElementById('pdv-operacao') ? document.getElementById('pdv-operacao').value : 'Venda'; 
    const isOrcamento = op === 'Orçamento'; 
    const novaQtd = Math.max(1, parseInt(n)||1); 
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
    
    if(metodo === 'Cartão Crédito' || metodo === 'Boleto' || metodo === 'Fiado') { 
        selParc.classList.remove('hidden'); 
    } else { 
        selParc.classList.add('hidden'); 
        selParc.value = '1'; 
    } 
    
    if(metodo === 'Boleto' || metodo === 'Fiado') { 
        inpVenc.classList.remove('hidden'); 
        const hj = new Date(); 
        hj.setDate(hj.getDate() + 30); 
        inpVenc.value = hj.toISOString().split('T')[0]; 
    } else { 
        inpVenc.classList.add('hidden'); 
        inpVenc.value = ''; 
    } 
}

function atualizarResumoPagamentosVenda() {
    const opSelect = document.getElementById('pdv-operacao'); 
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
            <div class="flex justify-between items-center bg-white border border-slate-200 p-2.5 rounded-lg text-xs shadow-sm mb-2">
                <div>
                    <span class="font-bold uppercase ${corMetodo}"><i class="fa-solid fa-check mr-1"></i> ${pag.metodo} ${txtParc}</span>${txtVenc}
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-black text-slate-700">R$ ${pag.valor.toFixed(2).replace('.', ',')}</span>
                    <button onclick="removerPagamentoVenda(${index})" class="text-red-400 hover:text-red-600 p-1"><i class="fa-solid fa-trash"></i></button>
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
    const vencimentoBase = document.getElementById('pdv-vencimento-atual').value || ''; 
    const valor = parseFloat(inputValor.value); 
    
    if (!valor || valor <= 0) return showToast("Digite um valor numérico válido para o pagamento.", "error"); 
    
    pagamentosVendaAtual.push({ metodo, valor, parcelas, vencimentoBase }); 
    atualizarResumoPagamentosVenda(); 
    inputValor.focus(); 
}

function removerPagamentoVenda(index) { 
    pagamentosVendaAtual.splice(index, 1); 
    atualizarResumoPagamentosVenda(); 
}

function finalizarVendaMultipla() {
    const op = document.getElementById('pdv-operacao') ? document.getElementById('pdv-operacao').value : 'Venda';
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
                ${pagTexto !== 'Orçamento (Sem Pagamento Exigido)' ? pagamentosVendaAtual.map(p => `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>✓ ${p.metodo} ${p.parcelas > 1 ? `(${p.parcelas}x)` : ''}</span> <strong>${formatMoney(p.valor)}</strong></div>`).join('') : '<p style="font-style: italic; color: #555;">Nenhum pagamento registrado no orçamento.</p>'}
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

    if (!isOrcamento) { 
        cart.forEach(item => { 
            const p = (db.produtos || []).find(x => String(x.id) === String(item.id)); 
            if(p) { 
                p.estoque -= item.qtd; 
                salvarKardex(`${tipoVenda} #${numPedStr}`, p.id, p.nome, -(item.qtd || 1), tipoVenda); 
            } 
        }); 
    }

    if(!db.vendas) db.vendas = [];
    const itensLimpados = cart.map(i => { return { id: i.id || '', nome: i.nome || '', preco: i.preco || 0, custo: i.custo || 0, qtd: i.qtd || 1, obsVenda: i.obsVenda || '' }; });

    const novaVendaObj = { 
        id: vendaId, 
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
    
    db.vendas.unshift(novaVendaObj);
    
    if (!isOrcamento) {
        if(!db.financeiro) db.financeiro = []; 
        if(!db.caixa) db.caixa = { status: 'ABERTO', saldo: 0, historico: [] }; 
        if(!db.caixa.historico) db.caixa.historico = [];
        
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
                    let dataBase = p.vencimentoBase ? new Date(p.vencimentoBase + 'T12:00:00') : new Date(); 
                    if(!p.vencimentoBase) dataBase.setDate(dataBase.getDate() + 30); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        let dataVencParc = new Date(dataBase); 
                        dataVencParc.setDate(dataVencParc.getDate() + (30 * (i - 1))); 
                        db.financeiro.unshift({ id: Date.now()+idx+i, ref: `${pRef} [${i}/${p.parcelas}]`, data: dataVencParc.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas' }); 
                    } 
                } else if (p.metodo && (String(p.metodo).includes('Crédito') || String(p.metodo).includes('Débito'))) { 
                    let dataAmanha = new Date(); 
                    dataAmanha.setDate(dataAmanha.getDate() + 1); 
                    const valParc = valorParaCaixa / (p.parcelas || 1); 
                    for(let i=1; i<=(p.parcelas || 1); i++) { 
                        db.financeiro.unshift({ id: Date.now()+idx+i, ref: `${pRef} [${i}/${p.parcelas}]`, data: dataAmanha.toISOString(), pessoa: cliInfo.nome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo }); 
                    } 
                } else if (p.metodo === 'Dinheiro' || p.metodo === 'PIX') { 
                    db.financeiro.unshift({ id: Date.now()+idx, ref: pRef, data: dataIso, pessoa: cliInfo.nome, wpp: '', valor: valorParaCaixa, status: 'PAGO', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: p.metodo, dataPagamento: dataIso }); 
                    if(p.metodo === 'Dinheiro') { 
                        db.caixa.saldo += valorParaCaixa; 
                        db.caixa.historico.unshift({ data: dataIso, tipo: 'ENTRADA', desc: pRef, valor: valorParaCaixa }); 
                    } 
                }
            }
        });
    }

    saveDB(); 
    
    window.vendaEmEdicao = null;
    window.vendaAtualImpressao = novaVendaObj;
    
    document.getElementById('print-area').innerHTML = htmlRecibo; 
    document.getElementById('modal-opcoes-recibo').classList.remove('hidden'); 
    
    pdvLimpar(); 
    showToast(isOrcamento ? "Orçamento salvo!" : (isServico ? "Serviço registrado!" : "Venda registrada com sucesso!"), "success");
}

function fecharModalOpcoesRecibo() { 
    document.getElementById('modal-opcoes-recibo').classList.add('hidden'); 
}

// ==========================================
// 12. HISTÓRICO DE VENDAS E SERVIÇOS
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
    if (tipoFiltro === 'SERVICOS') filtrados = filtrados.filter(v => v.tipo === 'SERVIÇO');
    if (termo) filtrados = filtrados.filter(v => (v.clienteNome && String(v.clienteNome).toLowerCase().includes(termo)) || (v.numeroPedido && String(v.numeroPedido).includes(termo)) || (v.vendedor && String(v.vendedor).toLowerCase().includes(termo)));
    if (pgto !== 'TODOS') filtrados = filtrados.filter(v => v.pag && String(v.pag).includes(pgto));
    if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() >= dIni); }
    if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(v => v.data && new Date(v.data).getTime() <= dFim); }
    
    filtrados.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));

    let totalLucro = 0;
    
    document.getElementById('tabela-vendas-body').innerHTML = filtrados.map(v => {
        try {
            const custoTotalDaVenda = (Number(v.custoTotal) || 0) + (Number(v.taxaValor) || 0); 
            const lucroDaVenda = (Number(v.tot) || 0) - custoTotalDaVenda; 
            const numPedStr = String(v.numeroPedido || v.id || '0').padStart(4, '0'); 
            totalLucro += lucroDaVenda;
            
            const dataRender = v.data && typeof formatData === 'function' ? formatData(v.data) : (v.data || '-'); 
            const clienteRender = v.clienteNome || 'Desconhecido'; 
            const vendRender = v.vendedor || '-'; 
            const pagRender = v.pag || '-';
            
            const badgeTipo = v.tipo === 'SERVIÇO' ? `<span class="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1">SERVIÇO</span><br>` : `<span class="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold inline-block mb-1">VENDA</span><br>`;
            
            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="p-3 text-slate-500 text-xs">${dataRender}</td>
                <td class="p-3 font-mono font-bold text-slate-700">${badgeTipo}#${numPedStr}</td>
                <td class="p-3 font-bold text-slate-800">${clienteRender} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
                <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${pagRender}</span></td>
                <td class="p-3 text-right font-black text-slate-700">${typeof formatMoney === 'function' ? formatMoney(v.tot || 0) : (v.tot || 0)}</td>
                <td class="p-3 text-right font-bold text-red-500">-${typeof formatMoney === 'function' ? formatMoney(custoTotalDaVenda) : custoTotalDaVenda}</td>
                <td class="p-3 text-right font-black text-emerald-600">${typeof formatMoney === 'function' ? formatMoney(lucroDaVenda) : lucroDaVenda}</td>
                <td class="p-3 text-center flex flex-wrap justify-center gap-1 print:hidden">
                    <button onclick="verDetalhesVenda('${v.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded font-bold text-xs" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="reimprimirVenda('${v.id}')" class="text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded font-bold text-xs" title="Imprimir/PDF"><i class="fa-solid fa-print"></i></button>
                    <button onclick="enviarPDFWhatsApp('${v.id}')" class="text-emerald-500 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded font-bold text-xs" title="Enviar PDF no WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                    <button onclick="editarVenda('${v.id}')" class="text-amber-500 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1.5 rounded font-bold text-xs" title="Editar / Reabrir no PDV"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirVenda('${v.id}')" class="text-red-500 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded font-bold text-xs" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        } catch (e) { console.error(e); return ''; }
    }).join('') || '<tr><td colspan="8" class="p-6 text-center text-slate-500">Nenhum registro encontrado com os filtros atuais.</td></tr>';
    
    if (document.getElementById('vendas-total-filtros')) {
        document.getElementById('vendas-total-filtros').innerText = `Lucro Real Acumulado: ${typeof formatMoney === 'function' ? formatMoney(totalLucro) : totalLucro}`;
    }
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
            
            const dataRender = v.data && typeof formatData === 'function' ? formatData(v.data) : (v.data || '-'); 
            const clienteRender = v.clienteNome || 'Desconhecido'; 
            const vendRender = v.vendedor || '-'; 
            const qtdItens = v.itens ? v.itens.reduce((acc, i) => acc + (i.qtd||1), 0) : 0;
            
            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="p-3 text-slate-500 text-xs">${dataRender}</td>
                <td class="p-3 font-mono font-bold text-slate-700">#${numPedStr}</td>
                <td class="p-3 font-bold text-slate-800">${clienteRender} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${vendRender}</span></td>
                <td class="p-3 text-center font-bold text-slate-600">${qtdItens} un</td>
                <td class="p-3 text-right font-black text-slate-700">${typeof formatMoney === 'function' ? formatMoney(v.tot || 0) : (v.tot || 0)}</td>
                <td class="p-3 text-center flex flex-wrap justify-center gap-1 print:hidden">
                    <button onclick="verDetalhesVenda('${v.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded font-bold text-xs" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="reimprimirVenda('${v.id}')" class="text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded font-bold text-xs" title="Imprimir/PDF"><i class="fa-solid fa-print"></i></button>
                    <button onclick="enviarPDFWhatsApp('${v.id}')" class="text-emerald-500 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded font-bold text-xs" title="Enviar PDF no WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                    <button onclick="editarVenda('${v.id}')" class="text-amber-500 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1.5 rounded font-bold text-xs" title="Editar / Reabrir no PDV"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirVenda('${v.id}')" class="text-red-500 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded font-bold text-xs" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        } catch (e) { console.error(e); return ''; }
    }).join('') || '<tr><td colspan="6" class="p-6 text-center text-slate-500">Nenhum orçamento encontrado.</td></tr>';
    
    if (document.getElementById('orcamentos-total-filtros')) {
        document.getElementById('orcamentos-total-filtros').innerText = `Valor Total em Orçamentos: ${typeof formatMoney === 'function' ? formatMoney(totalOrcamentos) : totalOrcamentos}`;
    }
}

// ==========================================
// 13. EXCLUSÃO E REIMPRESSÃO BLINDADA
// ==========================================
function excluirVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    const isOrcamento = v.tipo === 'ORÇAMENTO'; 
    const msg = isOrcamento ? 'Deseja excluir este Orçamento do histórico permanentemente?' : 'Devolver estoque e apagar parcelas/caixa desta operação?';
    
    abrirConfirmacao('Confirmar Exclusão', msg, () => {
        try {
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            p.estoque += Number(item.qtd || 1); 
                            salvarKardex(`Estorno ${v.tipo} #${numPedStr}`, p.id, p.nome, Number(item.qtd || 1), 'ESTORNO'); 
                        } 
                    }); 
                }
                
                db.financeiro = (db.financeiro || []).filter(f => f.ref ? !String(f.ref).includes(`#${numPedStr}`) : true);
                
                if(v.pag && typeof v.pag === 'string' && v.pag.includes('Dinheiro')) { 
                    if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] }; 
                    if(!db.caixa.historico) db.caixa.historico = []; 
                    db.caixa.saldo -= (Number(v.valorLiquido) || 0); 
                    db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno ${v.tipo} #${numPedStr}`, valor: (Number(v.valorLiquido) || 0) }); 
                }
            }
            db.vendas = db.vendas.filter(x => String(x.id) !== String(id)); 
            saveDB(); 
            if(isOrcamento) renderOrcamentos(); else renderVendas(); 
            showToast('Registro excluído com sucesso!', 'success');
        } catch (err) { 
            console.error(err); 
            showToast('Erro ao excluir registro.', 'error'); 
        }
    });
}

function reimprimirVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    window.vendaAtualImpressao = v;
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const isOrcamento = v.tipo === 'ORÇAMENTO';
    const isServico = v.tipo === 'SERVIÇO';

    let tituloRecibo = 'CUPOM NÃO FISCAL - SEM VALOR LEGAL'; 
    if (isOrcamento) tituloRecibo = 'ORÇAMENTO - VÁLIDO POR 7 DIAS'; 
    else if (isServico) tituloRecibo = 'RECIBO DE PRESTAÇÃO DE SERVIÇO';
    
    const emp = obterDadosEmpresa(); 
    const cliInfo = obterDadosClientePDV(v.clienteId);

    const cliNome = v.clienteNome || cliInfo.nome || 'Consumidor Final';
    const cliCpf = v.clienteDoc || cliInfo.doc || 'Não informado';
    const cliTel = v.clienteTel || cliInfo.tel || 'Não informado';
    const cliEndCompleto = v.clienteEnd || cliInfo.endCompleto || 'Não informado';

    let fotosHtml = '';
    if (isServico && v.servicoDetalhes) {
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) {
            fotosHtml = `<div style="margin-top: 10px;"><strong>Fotos de Referência (Estado Inicial):</strong><br><div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" style="height: 120px; border-radius: 4px; border: 1px solid #d8b4fe;">`).join('')}</div></div>`;
        } else if (v.servicoDetalhes.foto) {
            fotosHtml = `<div style="margin-top: 10px;"><strong>Foto de Referência (Estado Inicial):</strong><br><img src="${v.servicoDetalhes.foto}" style="max-height: 150px; border-radius: 4px; border: 1px solid #d8b4fe; margin-top: 5px;"></div>`;
        }
    }

    const htmlRecibo = `
    <div style="font-family: Arial, sans-serif; color: #000; max-width: 800px; margin: 0 auto; padding: 10px;">
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
                Telefone: ${cliTel}<br>
                Endereço: ${cliEndCompleto}
            </div>
            <div style="text-align: right; border-left: 1px solid #ccc; padding-left: 15px;">
                <strong>DADOS DA OPERAÇÃO</strong><br>
                Nº: #${numPedStr}<br>
                Data Orig: ${v.data ? new Date(v.data).toLocaleString('pt-BR') : '-'}<br>
                Op: REIMPRESSÃO
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
                <div style="margin-top: 5px;">
                    <p style="margin: 5px 0 0 0;">${v.pag || 'Nenhum pagamento exigido'}</p>
                </div>
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
            <strong>Observações Gerais:</strong><br>
            ${v.obs}
        </div>
        ` : ''}

        <div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-size: 13px;">
            <div style="width: 40%;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">Assinatura do Cliente</div>
                <div style="font-size: 11px; margin-top: 3px; color: #475569;">${isOrcamento ? 'Reconheço o orçamento acima' : (v.tipo === 'SERVIÇO' ? 'Aprovo a execução do serviço.' : 'Declaro ter recebido os itens acima.')}</div>
            </div>
            <div style="width: 40%;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">Assinatura da Empresa</div>
                <div style="font-size: 11px; margin-top: 3px; color: #475569; font-weight: bold;">${emp.nome}</div>
            </div>
        </div>
    </div>`;
    
    document.getElementById('print-area').innerHTML = htmlRecibo; 
    document.getElementById('modal-opcoes-recibo').classList.remove('hidden');
}

function verDetalhesVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
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
    document.getElementById('det-venda-itens').innerHTML = (v.itens || []).map(i => `
        <tr class="hover:bg-slate-50 border-b border-slate-50">
            <td class="p-3 font-medium text-slate-700 text-xs">
                ${i.nome || 'Produto/Serviço'} ${i.obsVenda ? `<br><span class="text-[10px] text-slate-400">Obs: ${i.obsVenda}</span>` : ''}
            </td>
            <td class="p-3 text-center text-xs font-bold text-slate-600">${i.qtd || 1}</td>
            <td class="p-3 text-right text-xs text-slate-500">${formatMoney(i.preco || 0)}</td>
            <td class="p-3 text-right text-xs font-bold text-slate-800">${formatMoney((i.preco || 0) * (i.qtd || 1))}</td>
        </tr>`).join('');
    
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

    abrirConfirmacao('Editar Operação', msg, () => {
        try {
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            
            if(!isOrcamento) {
                if(v.itens && v.itens.length > 0) { 
                    v.itens.forEach(item => { 
                        const p = (db.produtos || []).find(prod => String(prod.id) === String(item.id)); 
                        if(p) { 
                            p.estoque += Number(item.qtd || 1); 
                            salvarKardex(`Estorno de Edição ${v.tipo} #${numPedStr}`, p.id, p.nome, Number(item.qtd || 1), 'ESTORNO'); 
                        } 
                    }); 
                }
                
                db.financeiro = (db.financeiro || []).filter(f => f.ref ? !String(f.ref).includes(`#${numPedStr}`) : true);
                
                if(v.pag && typeof v.pag === 'string' && String(v.pag).includes('Dinheiro')) { 
                    if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] }; 
                    if(!db.caixa.historico) db.caixa.historico = []; 
                    db.caixa.saldo -= (Number(v.valorLiquido) || 0); 
                    db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno (Edição) ${v.tipo} #${numPedStr}`, valor: (Number(v.valorLiquido) || 0) }); 
                }
            }

            db.vendas = db.vendas.filter(x => String(x.id) !== String(id)); 
            saveDB(); 

            pdvLimpar(); 
            
            mudarVisaoLocal('pdv');
            
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