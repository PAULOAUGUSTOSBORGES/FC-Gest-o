// ==========================================
// CARRINHO DE COMPRAS & CHECKOUT WHATSAPP
// ==========================================

let carrinho = [];

// Carrega carrinho do LocalStorage
try {
    const saved = localStorage.getItem('fc_carrinho');
    if (saved) {
        carrinho = JSON.parse(saved);
    }
} catch (e) {
    console.error("Erro ao carregar carrinho:", e);
    carrinho = [];
}

document.addEventListener('DOMContentLoaded', () => {
    atualizarBadgeCarrinho();
});

function salvarCarrinho() {
    try {
        localStorage.setItem('fc_carrinho', JSON.stringify(carrinho));
    } catch (e) {
        console.error("Erro ao salvar carrinho:", e);
    }
    atualizarBadgeCarrinho();
    renderizarItensCarrinho();
}

function adicionarAoCarrinho(produto, quantidade = 1) {
    const itemExistente = carrinho.find(item => item.id === produto.id);
    const temEstoque = produto.estoque > 0 || !produto.hasOwnProperty('estoque');
    
    const foto = (produto.fotos && Array.isArray(produto.fotos) && produto.fotos.length > 0 ? produto.fotos[0] : produto.foto) || '';

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco || 0,
            foto: foto,
            categoria: produto.categoria || 'Geral',
            subcategoria: produto.subcategoria || '',
            sobEncomenda: !temEstoque,
            quantidade: quantidade
        });
    }

    salvarCarrinho();
    abrirCarrinho();
}

function alterarQuantidade(id, delta) {
    const item = carrinho.find(item => item.id === id);
    if (item) {
        item.quantidade += delta;
        if (item.quantidade <= 0) {
            removerDoCarrinho(id);
        } else {
            salvarCarrinho();
        }
    }
}

function removerDoCarrinho(id) {
    carrinho = carrinho.filter(item => item.id !== id);
    salvarCarrinho();
}

function limparCarrinho() {
    carrinho = [];
    salvarCarrinho();
}

function calcularTotal() {
    return carrinho.reduce((total, item) => total + (Number(item.preco || 0) * item.quantidade), 0);
}

function atualizarBadgeCarrinho() {
    const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(badge => {
        if (totalItens > 0) {
            badge.innerText = totalItens;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

function abrirCarrinho() {
    if (!document.getElementById('carrinho-sidebar')) {
        injetaHtmlCarrinho();
    }
    const sidebar = document.getElementById('carrinho-sidebar');
    const overlay = document.getElementById('carrinho-overlay');
    if (sidebar && overlay) {
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        renderizarItensCarrinho();
    }
}

function fecharCarrinho() {
    const sidebar = document.getElementById('carrinho-sidebar');
    const overlay = document.getElementById('carrinho-overlay');
    if (sidebar && overlay) {
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    }
}

function renderizarItensCarrinho() {
    const container = document.getElementById('carrinho-itens');
    if (!container) return;
    
    const totalEl = document.getElementById('carrinho-total');
    const btnFinalizar = document.getElementById('carrinho-btn-finalizar');
    
    container.innerHTML = '';
    
    if (carrinho.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500 py-12 text-center">
                <i class="fa-solid fa-cart-arrow-down text-6xl mb-4 opacity-40 text-gray-300 dark:text-slate-600"></i>
                <p class="font-medium text-gray-600 dark:text-slate-400">Seu carrinho está vazio.</p>
                <button type="button" onclick="fecharCarrinho()" class="mt-4 text-brand dark:text-blue-400 font-bold hover:underline">Continuar Comprando</button>
            </div>
        `;
        if (totalEl) totalEl.innerText = (typeof formatMoney === 'function' ? formatMoney(0) : 'R$ 0,00');
        if (btnFinalizar) {
            btnFinalizar.disabled = true;
            btnFinalizar.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return;
    }

    if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    carrinho.forEach(item => {
        const fotoUrl = item.foto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg==';
        const badgeEncomenda = item.sobEncomenda ? `<div class="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 w-fit"><i class="fa-solid fa-clock text-[9px]"></i> Sob Encomenda</div>` : '';

        const subInfo = item.subcategoria ? `<span class="text-[10px] text-gray-400 dark:text-slate-500">• ${item.subcategoria}</span>` : '';

        container.innerHTML += `
            <div class="flex gap-3 sm:gap-4 py-3.5 border-b border-gray-100 dark:border-slate-800 items-center">
                <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-800 flex-shrink-0 border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center">
                    <img src="${fotoUrl}" alt="${item.nome}" loading="lazy" class="w-full h-full object-cover">
                </div>
                <div class="flex-grow flex flex-col justify-between min-w-0">
                    <div class="flex justify-between items-start gap-2">
                        <div>
                            <h4 class="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate" title="${item.nome}">${item.nome}</h4>
                            <div class="flex items-center gap-1 flex-wrap mt-0.5">
                                <span class="text-[10px] text-brand dark:text-blue-400 font-semibold uppercase">${item.categoria || 'Geral'}</span>
                                ${subInfo}
                            </div>
                            ${badgeEncomenda}
                        </div>
                        <button type="button" onclick="removerDoCarrinho('${item.id}')" class="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 shrink-0" title="Remover item">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    </div>
                    
                    <div class="flex items-center justify-between mt-2.5">
                        <div class="flex items-center border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
                            <button type="button" onclick="alterarQuantidade('${item.id}', -1)" class="w-7 h-7 flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-bold text-sm select-none">-</button>
                            <span class="w-8 text-center text-xs font-bold text-gray-800 dark:text-white">${item.quantidade}</span>
                            <button type="button" onclick="alterarQuantidade('${item.id}', 1)" class="w-7 h-7 flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-bold text-sm select-none">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    if (totalEl) totalEl.innerText = (typeof formatMoney === 'function' ? formatMoney(calcularTotal()) : `R$ ${calcularTotal().toFixed(2)}`);
}

function finalizarPedidoWhatsApp() {
    if (carrinho.length === 0) return;
    
    const nomeCliente = document.getElementById('carrinho-nome-cliente')?.value.trim() || 'Cliente';
    
    let mensagem = `*NOVO ORÇAMENTO*\r\n\r\n`;
    mensagem += `*Cliente:* ${nomeCliente}\r\n\r\n`;
    mensagem += `*Itens do Orçamento:*\r\n`;
    
    carrinho.forEach(item => {
        const tagEncomenda = item.sobEncomenda ? ' *(Sob Encomenda)*' : '';
        const tagSub = item.subcategoria ? ` (${item.subcategoria})` : '';
        mensagem += `- ${item.quantidade}x ${item.nome}${tagSub}${tagEncomenda}\r\n`;
    });
    
    let wpp = '';
    if (typeof lojaConfig !== 'undefined' && lojaConfig.whatsapp) {
        wpp = lojaConfig.whatsapp;
    } else if (typeof window.lojaConfig !== 'undefined' && window.lojaConfig.whatsapp) {
        wpp = window.lojaConfig.whatsapp;
    }
    
    const numeroFormatado = formatarNumeroWhatsApp(wpp);
    const url = `https://wa.me/${numeroFormatado || '5511999999999'}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(url, '_blank');
}

function formatarNumeroWhatsApp(num) {
    if (!num) return '';
    const limpo = String(num).replace(/\D/g, '');
    if (limpo.length === 10 || limpo.length === 11) {
        return '55' + limpo;
    }
    return limpo;
}

function injetaHtmlCarrinho() {
    if (document.getElementById('carrinho-sidebar')) return;
    
    const html = `
    <!-- Overlay do Carrinho -->
    <div id="carrinho-overlay" class="fixed inset-0 bg-black/60 z-50 hidden transition-opacity backdrop-blur-xs" onclick="fecharCarrinho()"></div>
    
    <!-- Sidebar do Carrinho -->
    <div id="carrinho-sidebar" class="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white dark:bg-slate-900 z-50 transform translate-x-full transition-transform duration-300 shadow-2xl flex flex-col border-l border-gray-100 dark:border-slate-800">
        <!-- Header -->
        <div class="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/80">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <i class="fa-solid fa-cart-shopping text-brand"></i> Meu Carrinho
            </h2>
            <button onclick="fecharCarrinho()" class="text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center">
                <i class="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>
        
        <!-- Lista de Produtos -->
        <div id="carrinho-itens" class="flex-grow overflow-y-auto px-6 py-4 custom-scrollbar">
            <!-- Renderizado via JS -->
        </div>
        
        <!-- Footer / Checkout -->
        <div class="border-t border-gray-100 dark:border-slate-800 px-6 py-6 bg-gray-50 dark:bg-slate-800/80 space-y-4">
            <input type="text" id="carrinho-nome-cliente" placeholder="Como podemos te chamar? (Seu Nome)" class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500">
            
            <button id="carrinho-btn-finalizar" onclick="finalizarPedidoWhatsApp()" class="w-full bg-[#25D366] hover:bg-[#1DA851] text-white px-6 py-4 rounded-xl font-bold text-lg transition-transform active:scale-95 shadow-lg shadow-[#25D366]/30 flex items-center justify-center gap-3">
                <i class="fa-brands fa-whatsapp text-xl"></i> Finalizar no WhatsApp
            </button>
            <p class="text-xs text-center text-gray-400 dark:text-slate-500 mt-2"><i class="fa-solid fa-lock mr-1"></i> Você não paga nada agora. O atendimento é feito diretamente no WhatsApp.</p>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

window.abrirCarrinho = abrirCarrinho;
window.fecharCarrinho = fecharCarrinho;
window.adicionarAoCarrinho = adicionarAoCarrinho;
window.alterarQuantidade = alterarQuantidade;
window.removerDoCarrinho = removerDoCarrinho;
window.finalizarPedidoWhatsApp = finalizarPedidoWhatsApp;
