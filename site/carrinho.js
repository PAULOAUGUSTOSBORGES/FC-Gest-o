function formatarNumeroWhatsApp(tel) {
    if (!tel) return '5511999999999';
    let clean = String(tel).replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }
    return clean;
}
// Lógica do Carrinho de Compras

let carrinho = [];
try {
    const raw = localStorage.getItem('fc_carrinho');
    carrinho = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(carrinho)) carrinho = [];
} catch(e) {
    carrinho = [];
}

document.addEventListener('DOMContentLoaded', () => {
    injetaHtmlCarrinho();
    atualizarBadgeCarrinho();
});

function salvarCarrinho() {
    localStorage.setItem('fc_carrinho', JSON.stringify(carrinho));
    atualizarBadgeCarrinho();
    renderizarItensCarrinho();
}

function adicionarAoCarrinho(produto, quantidade = 1) {
    const itemExistente = carrinho.find(item => item.id === produto.id);
    
    const fotoPrincipal = (produto.fotos && Array.isArray(produto.fotos) && produto.fotos.length > 0 ? produto.fotos[0] : produto.foto) || '';
    const temEstoque = produto.estoque > 0 || !produto.hasOwnProperty('estoque');

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco || 0,
            foto: fotoPrincipal,
            quantidade: quantidade,
            sobEncomenda: !temEstoque
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
            <div class="flex flex-col items-center justify-center h-full text-gray-400 py-12 text-center">
                <i class="fa-solid fa-cart-arrow-down text-6xl mb-4 opacity-40 text-gray-300"></i>
                <p class="font-medium text-gray-600">Seu carrinho está vazio.</p>
                <button type="button" onclick="fecharCarrinho()" class="mt-4 text-brand font-bold hover:underline">Continuar Comprando</button>
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
        const badgeEncomenda = item.sobEncomenda ? `<div class="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 w-fit"><i class="fa-solid fa-clock text-[9px]"></i> Sob Encomenda</div>` : '';

        container.innerHTML += `
            <div class="flex gap-3 sm:gap-4 py-3.5 border-b border-gray-100 items-center">
                <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100 shadow-sm flex items-center justify-center">
                    <img src="${fotoUrl}" alt="${item.nome}" loading="lazy" class="w-full h-full object-cover">
                </div>
                <div class="flex-grow flex flex-col justify-between min-w-0">
                    <div class="flex justify-between items-start gap-2">
                        <div>
                            <h4 class="text-sm font-bold text-gray-900 leading-tight truncate" title="${item.nome}">${item.nome}</h4>
                            ${badgeEncomenda}
                        </div>
                        <button type="button" onclick="removerDoCarrinho('${item.id}')" class="text-gray-400 hover:text-red-500 transition-colors p-1 shrink-0" title="Remover item">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    </div>
                    
                    <div class="flex items-center justify-between mt-2.5">
                        <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                            <button type="button" onclick="alterarQuantidade('${item.id}', -1)" class="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 transition-colors font-bold text-sm select-none">-</button>
                            <span class="w-8 text-center text-xs font-bold text-gray-800">${item.quantidade}</span>
                            <button type="button" onclick="alterarQuantidade('${item.id}', 1)" class="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 transition-colors font-bold text-sm select-none">+</button>
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
        mensagem += `- ${item.quantidade}x ${item.nome}${tagEncomenda}\r\n`;
    });
    
    // Pega o número do wpp configurado na loja globalmente
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

function injetaHtmlCarrinho() {
    if (document.getElementById('carrinho-sidebar')) return;
    
    const html = `
    <!-- Overlay do Carrinho -->
    <div id="carrinho-overlay" class="fixed inset-0 bg-black/40 z-50 hidden transition-opacity" onclick="fecharCarrinho()"></div>
    
    <!-- Sidebar do Carrinho -->
    <div id="carrinho-sidebar" class="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white z-50 transform translate-x-full transition-transform duration-300 shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                <i class="fa-solid fa-cart-shopping text-brand"></i> Meu Carrinho
            </h2>
            <button onclick="fecharCarrinho()" class="text-gray-400 hover:text-gray-700 transition-colors w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center">
                <i class="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>
        
        <!-- Lista de Produtos -->
        <div id="carrinho-itens" class="flex-grow overflow-y-auto px-6 py-4 custom-scrollbar">
            <!-- Renderizado via JS -->
        </div>
        
        <!-- Footer / Checkout -->
        <div class="border-t border-gray-100 px-6 py-6 bg-gray-50 space-y-4">
            
            <input type="text" id="carrinho-nome-cliente" placeholder="Como podemos te chamar? (Nome)" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm bg-white">
            
            <button id="carrinho-btn-finalizar" onclick="finalizarPedidoWhatsApp()" class="w-full bg-[#25D366] hover:bg-[#1DA851] text-white px-6 py-4 rounded-xl font-bold text-lg transition-transform active:scale-95 shadow-lg shadow-[#25D366]/30 flex items-center justify-center gap-3">
                <i class="fa-brands fa-whatsapp text-xl"></i> Finalizar no WhatsApp
            </button>
            <p class="text-xs text-center text-gray-400 mt-2"><i class="fa-solid fa-lock mr-1"></i> Você não paga nada agora. O pagamento é combinado diretamente no WhatsApp.</p>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
}


