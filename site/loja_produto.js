let lojaConfig = {};
let produtoUrlId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Pegar o ID da URL
    const urlParams = new URLSearchParams(window.location.search);
    produtoUrlId = urlParams.get('id');

    if (!produtoUrlId) {
        mostrarNaoEncontrado();
        return;
    }

    initProduto();
});

async function initProduto() {
    try {
        const configDoc = await firebase.firestore().collection('fc_moveis').doc('config').get();
        if (configDoc.exists) {
            const data = configDoc.data();
            lojaConfig = data.loja || {};
            aplicarConfiguracoesLoja(data.empresa || {});
        }

        const prodDoc = await firebase.firestore().collection('produtos').doc(produtoUrlId).get();
        
        if (!prodDoc.exists) {
            mostrarNaoEncontrado();
            return;
        }

        const produto = prodDoc.data();
        produto.id = prodDoc.id;

        // Verifica se é pra exibir
        if (produto.ativo === false || produto.exibirLoja === false) {
            mostrarNaoEncontrado();
            return;
        }

        renderizarProduto(produto);

    } catch (error) {
        console.error("Erro ao carregar produto:", error);
        mostrarNaoEncontrado();
    }
}

function aplicarConfiguracoesLoja(empresaConfig = {}) {
    const cor = lojaConfig['cor-primaria-hex'] || lojaConfig['cor-primaria'] || '#2563eb';
    document.documentElement.style.setProperty('--brand-color', cor);
    
    // Função auxiliar simples para escurecer/clarear cor se adjustColor não estiver disponível globalmente
    const adjustColorHex = (color, amount) => {
        return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
    };
    
    document.documentElement.style.setProperty('--brand-color-dark', adjustColorHex(cor, -20));
    document.documentElement.style.setProperty('--brand-color-light', adjustColorHex(cor, 90));
    
    if (empresaConfig.logo) {
        const logo = document.getElementById('nav-logo');
        if (logo) {
            logo.src = empresaConfig.logo;
            logo.classList.remove('hidden');
            document.getElementById('nav-title').classList.add('hidden', 'sm:block');
        }
    }
    
    if (lojaConfig.nome) {
        const titles = [document.getElementById('nav-title'), document.getElementById('footer-title')];
        titles.forEach(t => { if(t) t.innerText = lojaConfig.nome; });
        document.title = lojaConfig.nome + ' | Detalhes do Produto';
    }
    
    if (lojaConfig.slogan) {
        const slogan = document.getElementById('footer-slogan');
        if (slogan) slogan.innerText = lojaConfig.slogan;
    }

    document.getElementById('footer-copyright').innerText = `© ${new Date().getFullYear()} ${lojaConfig.nome || 'Nossa Loja'}. Todos os direitos reservados.`;
}

function mostrarNaoEncontrado() {
    document.getElementById('loader').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('produto-not-found').classList.remove('hidden');
    document.getElementById('produto-detalhes').classList.add('hidden');
}

function renderizarProduto(p) {
    // Esconde loader
    setTimeout(() => {
        document.getElementById('loader').classList.add('opacity-0', 'pointer-events-none');
    }, 500);

    // Mostra Detalhes
    document.getElementById('produto-detalhes').classList.remove('hidden');

    const catStr = p.categoria || 'Geral';
    document.getElementById('bread-categoria').innerText = catStr;
    document.getElementById('bread-nome').innerText = p.nome;

    document.getElementById('prod-categoria').innerText = catStr;
    document.getElementById('prod-nome').innerText = p.nome;
    document.getElementById('prod-preco').innerText = formatMoney(p.preco);

    if (p.legenda) {
        const leg = document.getElementById('prod-legenda');
        leg.innerText = p.legenda;
        leg.classList.remove('hidden');
    }

    const fotoUrl = p.foto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg==';
    document.getElementById('prod-foto').src = fotoUrl;

    if (p.destaque) {
        document.getElementById('prod-badge-destaque').classList.remove('hidden');
    }

    const temEstoque = p.estoque > 0 || !p.hasOwnProperty('estoque');
    const btn = document.getElementById('btn-comprar');
    
    if (temEstoque) {
        btn.onclick = () => {
            adicionarAoCarrinho(p, 1);
        };
    } else {
        btn.classList.add('opacity-50', 'pointer-events-none');
        btn.classList.replace('bg-brand', 'bg-gray-400');
        btn.classList.replace('hover:bg-brand-dark', 'hover:bg-gray-500');
        btn.innerHTML = '<i class="fa-solid fa-box-open text-2xl"></i> Indisponível';
        
        document.getElementById('txt-sem-estoque').classList.remove('hidden');
        document.getElementById('prod-foto').classList.add('grayscale');
    }
}


