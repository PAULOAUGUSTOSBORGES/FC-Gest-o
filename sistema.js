// ==========================================
// SISTEMA.JS - Lógica de Configurações, Tema, Empresa e Taxas 1 a 12x
// ==========================================

function inicializarSistema() {
    carregarConfiguracoesNaTela();
}

window.onload = () => {
    initGlobalData(inicializarSistema);
};

// ==========================================
// BUSCA AUTOMÁTICA DE CNPJ NA RECEITA
// ==========================================
async function formatarEBuscarCNPJ(input) {
    // Aplica máscara visual
    let valor = input.value.replace(/\D/g, '');
    if (valor.length > 14) valor = valor.slice(0, 14);
    
    let mascarado = valor;
    if (valor.length > 2) mascarado = valor.replace(/^(\d{2})(\d)/, "$1.$2");
    if (valor.length > 5) mascarado = mascarado.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    if (valor.length > 8) mascarado = mascarado.replace(/\.(\d{3})(\d)/, ".$1/$2");
    if (valor.length > 12) mascarado = mascarado.replace(/(\d{4})(\d)/, "$1-$2");
    
    input.value = mascarado;

    // Se tiver 14 números, faz a busca na API
    if (valor.length === 14) {
        showToast('Buscando CNPJ na Receita Federal...', 'info');
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${valor}`);
            if (response.ok) {
                const data = await response.json();
                
                // Preenche Nome Fantasia ou Razão Social
                document.getElementById('emp-nome').value = data.nome_fantasia || data.razao_social || '';
                
                // Preenche Telefone com DDD
                if(data.ddd_telefone_1) document.getElementById('emp-telefone').value = data.ddd_telefone_1;
                
                // Preenche Endereço formatado
                let enderecoCompleto = `${data.logradouro || ''}, ${data.numero || 'S/N'}`;
                if(data.complemento) enderecoCompleto += ` - ${data.complemento}`;
                enderecoCompleto += ` - ${data.bairro || ''}, ${data.municipio || ''} - ${data.uf || ''}. CEP: ${data.cep || ''}`;
                
                document.getElementById('emp-endereco').value = enderecoCompleto;
                
                showToast('Dados da empresa puxados com sucesso!', 'success');
            } else {
                showToast('CNPJ não encontrado na base.', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Erro ao consultar CNPJ. Digite manualmente.', 'error');
        }
    }
}

function carregarConfiguracoesNaTela() {
    if (!db.config) {
        db.config = {
            tema: 'claro',
            empresa: {},
            taxas: {
                'Cartão Débito': 1.99,
                'Cartão Crédito': { 1: 4.99, 2: 5.5, 3: 5.5, 4: 5.5, 5: 5.5, 6: 5.5, 7: 6.5, 8: 6.5, 9: 6.5, 10: 6.5, 11: 6.5, 12: 6.5 }
            }
        };
    }

    // Tema é sempre escuro, não carrega mais da tela

    // Carrega Dados da Empresa
    if(db.config.empresa) {
        if(document.getElementById('emp-nome')) document.getElementById('emp-nome').value = db.config.empresa.nome || '';
        if(document.getElementById('emp-cnpj')) document.getElementById('emp-cnpj').value = db.config.empresa.cnpj || '';
        if(document.getElementById('emp-telefone')) document.getElementById('emp-telefone').value = db.config.empresa.telefone || '';
        if(document.getElementById('emp-endereco')) document.getElementById('emp-endereco').value = db.config.empresa.endereco || '';
        if(document.getElementById('emp-logo-base64')) document.getElementById('emp-logo-base64').value = db.config.empresa.logo || '';
        
        if(db.config.empresa.logo && document.getElementById('emp-logo-preview')) {
            document.getElementById('emp-logo-preview').src = db.config.empresa.logo;
            document.getElementById('emp-logo-preview').classList.remove('hidden');
            document.getElementById('emp-logo-text').classList.add('hidden');
        }
    }

    // Carrega as 12 Taxas Separadas
    if(db.config.taxas) {
        if(document.getElementById('tx-deb')) document.getElementById('tx-deb').value = db.config.taxas['Cartão Débito'] || 0;
        if(db.config.taxas['Cartão Crédito']) {
            for(let i=1; i<=12; i++) {
                if(document.getElementById('tx-c'+i)) {
                    document.getElementById('tx-c'+i).value = db.config.taxas['Cartão Crédito'][i] || 0;
                }
            }
        }
    }
}

function processarLogoEmpresa(event) {
    const file = event.target.files[0]; if(!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image(); img.onload = function() {
            const canvas = document.createElement('canvas'); let w = img.width, h = img.height; const MAX = 300; 
            if(w > h) { if(w > MAX) { h *= MAX/w; w = MAX; } } else { if(h > MAX) { w *= MAX/h; h = MAX; } }
            canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/png', 0.9);
            
            document.getElementById('emp-logo-base64').value = dataUrl;
            document.getElementById('emp-logo-preview').src = dataUrl;
            document.getElementById('emp-logo-preview').classList.remove('hidden');
            document.getElementById('emp-logo-text').classList.add('hidden');
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
}

async function salvarConfiguracoes() {
    if(!db.config) db.config = {};
    
    db.config.tema = 'escuro';

    db.config.empresa = {
        nome: document.getElementById('emp-nome').value.trim(),
        cnpj: document.getElementById('emp-cnpj').value.trim(),
        telefone: document.getElementById('emp-telefone').value.trim(),
        endereco: document.getElementById('emp-endereco').value.trim(),
        logo: document.getElementById('emp-logo-base64').value
    };

    // Salva as 12 Taxas Separadas
    const tDeb = parseFloat(document.getElementById('tx-deb').value) || 0;
    const taxasCredito = {};
    for(let i=1; i<=12; i++) {
        taxasCredito[i] = parseFloat(document.getElementById('tx-c'+i).value) || 0;
    }

    db.config.taxas = {
        'Dinheiro': 0, 'PIX': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Débito': tDeb,
        'Cartão Crédito': taxasCredito
    };

    try {
        await firestore.collection('fc_moveis').doc('config').set(db.config, { merge: true });
        // Tema forçado, não é necessário salvar no localStorage
        localStorage.setItem('sistema_tema', 'escuro');
        showToast('Configurações salvas com sucesso!', 'success');
        setTimeout(() => { window.location.reload(); }, 800);
    } catch(err) {
        console.error(err);
        showToast('Erro ao salvar configurações.', 'error');
    }
}