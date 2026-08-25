// Lógica do Carrinho de Compras

let carrinho = JSON.parse(localStorage.getItem('fc_carrinho')) || [];

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
    
    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            foto: produto.foto || '',
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
    return carrinho.reduce((total, item) => total + (Number(item.preco) * item.quantidade), 0);
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
    const totalEl = document.getElementById('carrinho-total');
    if (!container || !totalEl) return;
    
    container.innerHTML = '';
    
    if (carrinho.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                <i class="fa-solid fa-cart-arrow-down text-6xl mb-4 opacity-50"></i>
                <p>Seu carrinho está vazio.</p>
                <button onclick="fecharCarrinho()" class="mt-4 text-brand font-medium hover:underline">Continuar Comprando</button>
            </div>
        `;
        totalEl.innerText = formatMoney(0);
        document.getElementById('carrinho-btn-finalizar').disabled = true;
        document.getElementById('carrinho-btn-finalizar').classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }

    document.getElementById('carrinho-btn-finalizar').disabled = false;
    document.getElementById('carrinho-btn-finalizar').classList.remove('opacity-50', 'cursor-not-allowed');

    carrinho.forEach(item => {
        const fotoUrl = item.foto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg==';
        
        container.innerHTML += `
            <div class="flex gap-4 py-4 border-b border-gray-100">
                <div class="w-20 h-20 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100">
                    <img src="${fotoUrl}" alt="${item.nome}" class="w-full h-full object-cover">
                </div>
                <div class="flex-grow flex flex-col justify-between">
                    <div class="flex justify-between items-start gap-2">
                        <h4 class="text-sm font-bold text-gray-900 leading-tight">${item.nome}</h4>
                        <button onclick="removerDoCarrinho('${item.id}')" class="text-gray-400 hover:text-red-500 transition-colors">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                    <div class="text-brand font-black text-sm">${formatMoney(item.preco)}</div>
                    <div class="flex items-center gap-3 mt-2">
                        <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <button onclick="alterarQuantidade('${item.id}', -1)" class="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 transition-colors">-</button>
                            <span class="w-8 text-center text-sm font-medium">${item.quantidade}</span>
                            <button onclick="alterarQuantidade('${item.id}', 1)" class="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 transition-colors">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    totalEl.innerText = formatMoney(calcularTotal());
}

function finalizarPedidoWhatsApp() {
    if (carrinho.length === 0) return;
    
    const nomeCliente = document.getElementById('carrinho-nome-cliente')?.value || 'Cliente';
    
    let mensagem = `*NOVO PEDIDO*\r\n\r\n`;
    mensagem += `*Cliente:* ${nomeCliente}\r\n\r\n`;
    mensagem += `*Itens do Pedido:*\r\n`;
    
    carrinho.forEach(item => {
        mensagem += `- ${item.quantidade}x ${item.nome} (R$ ${Number(item.preco).toFixed(2)})\r\n`;
    });
    
    mensagem += `\r\n*TOTAL: ${formatMoney(calcularTotal())}*`;
    
    // Pega o número do wpp configurado na loja globalmente
    let wpp = '';
    if (typeof lojaConfig !== 'undefined' && lojaConfig.whatsapp) {
        wpp = lojaConfig.whatsapp;
    } else {
        wpp = '5511999999999'; // fallback
    }
    
    const numeroLimpo = String(wpp).replace(/\D/g, '');
    const url = `https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
    
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
            <div class="flex justify-between items-center text-lg">
                <span class="text-gray-500 font-medium">Total Estimado</span>
                <span id="carrinho-total" class="font-black text-2xl text-gray-900">R$ 0,00</span>
            </div>
            
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

