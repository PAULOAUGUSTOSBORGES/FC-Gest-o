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

function formatarUrlSocial(valor, rede) {
    if (!valor) return '';
    let url = String(valor).trim();
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    url = url.replace(/^@/, '');
    if (rede === 'facebook') {
        if (url.startsWith('facebook.com/') || url.startsWith('www.facebook.com/')) {
            return 'https://' + url;
        }
        return `https://facebook.com/${url}`;
    }
    if (rede === 'instagram') {
        if (url.startsWith('instagram.com/') || url.startsWith('www.instagram.com/')) {
            return 'https://' + url;
        }
        return `https://instagram.com/${url}`;
    }
    return url;
}

function aplicarConfiguracoesLoja(empresaConfig = {}) {
    window.lojaConfig = lojaConfig;
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

    // WhatsApp do Nav
    const wpp = lojaConfig.whatsapp || empresaConfig.telefone;
    const msgPadrão = encodeURIComponent(lojaConfig['whatsapp-msg'] || 'Olá! Vim pelo site e gostaria de mais informações.');
    let linkWpp = '#';
    if (wpp) {
        const numeroLimpo = String(wpp).replace(/\D/g, '');
        if (numeroLimpo.length >= 10) {
            linkWpp = `https://wa.me/${numeroLimpo.length === 10 || numeroLimpo.length === 11 ? '55' + numeroLimpo : numeroLimpo}?text=${msgPadrão}`;
        }
    }
    const navWpp = document.getElementById('nav-whatsapp');
    if (navWpp) navWpp.href = linkWpp;

    // Redes Sociais Footer
    const socialContainer = document.getElementById('social-links');
    if (socialContainer) {
        socialContainer.innerHTML = '';
        if (lojaConfig.instagram) {
            const instaUrl = formatarUrlSocial(lojaConfig.instagram, 'instagram');
            socialContainer.innerHTML += `<a href="${instaUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-brand hover:text-white transition-colors" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`;
        }
        if (lojaConfig.facebook) {
            const fbUrl = formatarUrlSocial(lojaConfig.facebook, 'facebook');
            socialContainer.innerHTML += `<a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-brand hover:text-white transition-colors" title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>`;
        }
        if (wpp) {
            socialContainer.innerHTML += `<a href="${linkWpp}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#25D366] hover:text-white transition-colors" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
        }
    }
}

function mostrarNaoEncontrado() {
    document.getElementById('loader').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('produto-not-found').classList.remove('hidden');
    document.getElementById('produto-detalhes').classList.add('hidden');
}

let fotosProduto = [];
let fotoAtualIndex = 0;

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

    // Configura Lista de Fotos
    if (p.fotos && Array.isArray(p.fotos) && p.fotos.length > 0) {
        fotosProduto = p.fotos.filter(f => !!f);
    } else if (p.foto) {
        fotosProduto = [p.foto];
    } else {
        fotosProduto = ['data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIGR5PSIuM2VtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZW0gSW1hZ2VtPC90ZXh0Pjwvc3ZnPg=='];
    }

    fotoAtualIndex = 0;
    atualizarFotoPrincipal();
    renderizarThumbnails();

    if (p.destaque) {
        document.getElementById('prod-badge-destaque').classList.remove('hidden');
    }

    const temEstoque = p.estoque > 0 || !p.hasOwnProperty('estoque');
    const btn = document.getElementById('btn-comprar');
    const badgeSobEncomenda = document.getElementById('badge-sob-encomenda');
    const txtSemEstoque = document.getElementById('txt-sem-estoque');
    const imgPrincipal = document.getElementById('prod-foto');
    
    if (imgPrincipal) {
        imgPrincipal.classList.remove('grayscale');
    }
    
    if (temEstoque) {
        if (badgeSobEncomenda) badgeSobEncomenda.classList.add('hidden');
        if (txtSemEstoque) txtSemEstoque.classList.add('hidden');
        
        btn.className = 'w-full bg-brand hover:bg-brand-dark text-white text-lg font-bold py-4 px-6 rounded-2xl text-center transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-brand/30 transform hover:-translate-y-1';
        btn.innerHTML = '<i class="fa-solid fa-cart-plus text-2xl"></i> Adicionar ao Carrinho';
        btn.onclick = () => {
            adicionarAoCarrinho(p, 1);
        };
    } else {
        if (badgeSobEncomenda) badgeSobEncomenda.classList.remove('hidden');
        if (txtSemEstoque) txtSemEstoque.classList.add('hidden');
        
        btn.className = 'w-full bg-amber-600 hover:bg-amber-700 text-white text-lg font-bold py-4 px-6 rounded-2xl text-center transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-amber-600/30 transform hover:-translate-y-1';
        btn.innerHTML = '<i class="fa-solid fa-clock text-2xl"></i> Encomendar no Carrinho';
        btn.onclick = () => {
            adicionarAoCarrinho(p, 1);
        };
    }
}

function atualizarFotoPrincipal() {
    const imgEl = document.getElementById('prod-foto');
    if (!imgEl) return;
    
    const fotoSrc = fotosProduto[fotoAtualIndex] || '';
    imgEl.src = fotoSrc;

    // Setas de navegação
    const btnPrev = document.getElementById('btn-foto-prev');
    const btnNext = document.getElementById('btn-foto-next');
    
    if (fotosProduto.length > 1) {
        if (btnPrev) { btnPrev.classList.remove('hidden'); btnPrev.classList.add('flex'); }
        if (btnNext) { btnNext.classList.remove('hidden'); btnNext.classList.add('flex'); }
    } else {
        if (btnPrev) btnPrev.classList.add('hidden');
        if (btnNext) btnNext.classList.add('hidden');
    }
}

function renderizarThumbnails() {
    const container = document.getElementById('prod-galeria-thumbs');
    if (!container) return;

    if (fotosProduto.length <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = fotosProduto.map((foto, idx) => {
        const isAtiva = idx === fotoAtualIndex;
        return `
        <button type="button" onclick="selecionarFotoGaleria(${idx})" class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all p-0.5 bg-white ${isAtiva ? 'border-brand ring-2 ring-brand/40 scale-105 shadow-md' : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-400'}">
            <img src="${foto}" alt="Foto ${idx + 1}" class="w-full h-full object-cover rounded-lg">
        </button>`;
    }).join('');
}

function selecionarFotoGaleria(index) {
    if (index >= 0 && index < fotosProduto.length) {
        fotoAtualIndex = index;
        atualizarFotoPrincipal();
        renderizarThumbnails();
    }
}

function mudarFotoGaleria(direcao) {
    if (fotosProduto.length <= 1) return;
    fotoAtualIndex = (fotoAtualIndex + direcao + fotosProduto.length) % fotosProduto.length;
    atualizarFotoPrincipal();
    renderizarThumbnails();
}

function abrirModalZoomSite(src) {
    const modal = document.getElementById('modal-zoom-site');
    const img = document.getElementById('modal-zoom-img');
    if (!modal || !img) return;
    img.src = src || (fotosProduto[fotoAtualIndex] || '');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalZoomSite() {
    const modal = document.getElementById('modal-zoom-site');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.selecionarFotoGaleria = selecionarFotoGaleria;
window.mudarFotoGaleria = mudarFotoGaleria;
window.abrirModalZoomSite = abrirModalZoomSite;
window.fecharModalZoomSite = fecharModalZoomSite;


