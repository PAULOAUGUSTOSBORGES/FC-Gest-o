const fs = require('fs');

function getFiles(dir, ext) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = dir + '/' + file;
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) { 
            // no recurse
        } else { 
            if(file.endsWith(ext)) results.push(fullPath);
        }
    });
    return results;
}

const htmlFiles = getFiles('.', '.html');
htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if(content.includes('id="modal-produto"') && !content.includes('id="div-acao-vinculo-xml"')) {
        content = content.replace(
            /(<input type="hidden" id="prod-id">)/,
            `<!-- NOVO: OPÇÃO DE VÍNCULO MANUAL (MOSTRADA APENAS NO XML) -->
                <div id="div-acao-vinculo-xml" class="hidden mb-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg">
                    <label class="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 block">Ação: Vincular ou Cadastrar?</label>
                    <select id="prod-acao-vinculo" onchange="alternarAcaoVinculoXML()" class="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 p-2 rounded text-sm outline-none mb-2 font-bold text-slate-700 dark:text-slate-200">
                        <option value="NOVO">Cadastrar como Novo Produto</option>
                        <option value="VINCULAR">Vincular a Produto Existente</option>
                    </select>
                    
                    <div id="div-vinculo-busca" class="hidden">
                        <label class="text-xs font-bold text-slate-500 mb-1 block">Selecione o Produto Existente</label>
                        <select id="prod-vinculo-select" onchange="preencherVinculoXML()" class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded text-sm outline-none">
                            <option value="">Selecione um produto...</option>
                        </select>
                    </div>
                </div>\n                $1`
        );
        fs.writeFileSync(file, content);
        console.log('Updated HTML ' + file);
    }
});

const jsFiles = getFiles('.', '.js');

const helperFunctions = `
// NOVO: Funções auxiliares para Vínculo de XML
function alternarAcaoVinculoXML() {
    const acao = document.getElementById('prod-acao-vinculo').value;
    if(acao === 'VINCULAR') {
        document.getElementById('div-vinculo-busca').classList.remove('hidden');
    } else {
        document.getElementById('div-vinculo-busca').classList.add('hidden');
        document.getElementById('prod-id').value = '';
    }
})\</option>\`;
            });
            sel.innerHTML = html;
        }
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
            document.getElementById('prod-margem').value = (prod.margem || 50).toFixed(2);
            if(typeof calcularPrecoMargin === 'function') {
                calcularPrecoMargin('margem');
            }
        }
    }
}
`;

const newAbrirModalProdutoDoXML = `function abrirModalProdutoDoXML(index) {
    const p = window.tempXMLData.produtosXML[index]; window.xmlItemEditIndex = index; document.getElementById('modal-produto').classList.remove('hidden');
    
    const divAcao = document.getElementById('div-acao-vinculo-xml');
    if(divAcao) divAcao.classList.remove('hidden'); 
    
    const selectAcao = document.getElementById('prod-acao-vinculo');
    const divBusca = document.getElementById('div-vinculo-busca');
    const selProd = document.getElementById('prod-vinculo-select');
    
    if(selectAcao) {
        selectAcao.value = (p.statusDB === 'ATUALIZAR' && p.idMatch) ? 'VINCULAR' : 'NOVO';
        if(selectAcao.value === 'VINCULAR') {
            divBusca.classList.remove('hidden');
            if(selProd && selProd.options.length <= 1) {
                let html = '<option value="">Selecione um produto...</option>';
                const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
                sorted.forEach(prod => {
                    html += "<option value=\"" + prod.id + "\">" + prod.nome + " (Estoque: " + prod.estoque + ")</option>";
                });
                selProd.innerHTML = html;
            }
            if(selProd) selProd.value = p.idMatch || '';
        } else {
            divBusca.classList.add('hidden');
        }
    }

    if(p.statusDB === 'ATUALIZAR' && p.idMatch) { 
        document.getElementById('prod-id').value = p.idMatch; document.getElementById('modal-produto-title').innerText = 'Atualizar Produto Vinculado'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    } 
    else { 
        document.getElementById('prod-id').value = ''; document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    }
}">\${prod.nome} (Estoque: \${prod.estoque})\</option>\`;
                });
                selProd.innerHTML = html;
            }
            if(selProd) selProd.value = p.idMatch || '';
        } else {
            divBusca.classList.add('hidden');
        }
    }

    if(p.statusDB === 'ATUALIZAR' && p.idMatch) { 
        document.getElementById('prod-id').value = p.idMatch; document.getElementById('modal-produto-title').innerText = 'Atualizar Produto Vinculado'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    } 
    else { 
        document.getElementById('prod-id').value = ''; document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    }
}`;

const newSalvarProdutoXmlModal = `function salvarProdutoXmlModal() {
    const nome = document.getElementById('prod-nome').value; const id = document.getElementById('prod-id').value;
    const pXML = window.tempXMLData.produtosXML[window.xmlItemEditIndex];
    if(!nome) return showToast('Nome obrigatÃ³rio', 'error');
    
    const selectAcao = document.getElementById('prod-acao-vinculo');
    if(selectAcao && selectAcao.value === 'VINCULAR' && !id) {
        return showToast('Selecione um produto para vincular', 'error');
    }

    pXML.nome = nome; pXML.cEAN = document.getElementById('prod-ean').value;
    pXML.custoFinal = parseFloat(document.getElementById('prod-custo').value)||0; pXML.margemAtual = parseFloat(document.getElementById('prod-margem').value)||0; pXML.precoVendaSug = parseFloat(document.getElementById('prod-preco').value)||0;
    
    if(selectAcao && selectAcao.value === 'VINCULAR' && id) {
        pXML.statusDB = 'ATUALIZAR';
        pXML.idMatch = id;
    } else {
        pXML.statusDB = 'NOVO CADASTRADO';
        pXML.idMatch = null;
    }

    pXML.nome = nome; pXML.cEAN = document.getElementById('prod-ean').value;
    pXML.custoFinal = parseFloat(document.getElementById('prod-custo').value)||0; pXML.margemAtual = parseFloat(document.getElementById('prod-margem').value)||0; pXML.precoVendaSug = parseFloat(document.getElementById('prod-preco').value)||0;
    
    if(selectAcao && selectAcao.value === 'VINCULAR' && id) {
        pXML.statusDB = 'ATUALIZAR';
        pXML.idMatch = id;
    } else {
        pXML.statusDB = 'NOVO CADASTRADO';
        pXML.idMatch = null;
    }`;

jsFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let updated = false;

    // In abrirModalProduto() (general one), we should hide the div
    if(content.includes('function abrirModalProduto(') || content.includes('function abrirModalProduto ()')) {
        // Need to insert hiding logic just after {
        if(!content.includes("document.getElementById('div-acao-vinculo-xml')")) {
            content = content.replace(
                /function\s+abrirModalProduto\s*\([^)]*\)\s*\{/,
                `$& \n    const divAcao = document.getElementById('div-acao-vinculo-xml'); if(divAcao) divAcao.classList.add('hidden');\n`
            );
            updated = true;
        }
    }

    // Replace abrirModalProdutoDoXML
    if(content.includes('function abrirModalProdutoDoXML(index) {
    const p = window.tempXMLData.produtosXML[index]; window.xmlItemEditIndex = index; document.getElementById('modal-produto').classList.remove('hidden');
    
    const divAcao = document.getElementById('div-acao-vinculo-xml');
    if(divAcao) divAcao.classList.remove('hidden'); 
    
    const selectAcao = document.getElementById('prod-acao-vinculo');
    const divBusca = document.getElementById('div-vinculo-busca');
    const selProd = document.getElementById('prod-vinculo-select');
    
    if(selectAcao) {
        selectAcao.value = (p.statusDB === 'ATUALIZAR' && p.idMatch) ? 'VINCULAR' : 'NOVO';
        if(selectAcao.value === 'VINCULAR') {
            divBusca.classList.remove('hidden');
            if(selProd && selProd.options.length <= 1) {
                let html = '<option value="">Selecione um produto...</option>';
                const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
                sorted.forEach(prod => {
                    html += "<option value=\"" + prod.id + "\">" + prod.nome + " (Estoque: " + prod.estoque + ")</option>";
                });
                selProd.innerHTML = html;
            }
            if(selProd) selProd.value = p.idMatch || '';
        } else {
            divBusca.classList.add('hidden');
        }
    }

    if(p.statusDB === 'ATUALIZAR' && p.idMatch) { 
        document.getElementById('prod-id').value = p.idMatch; document.getElementById('modal-produto-title').innerText = 'Atualizar Produto Vinculado'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    } 
    else { 
        document.getElementById('prod-id').value = ''; document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    }
}\`;
        
        if (content.includes(oldAbrir)) {
             content = content.replace(oldAbrir, newAbrirModalProdutoDoXML);
             updated = true;
        }
        
        const oldSalvar = \`function salvarProdutoXmlModal() {
    const nome = document.getElementById('prod-nome').value; const id = document.getElementById('prod-id').value;
    const pXML = window.tempXMLData.produtosXML[window.xmlItemEditIndex];
    if(!nome) return showToast('Nome obrigatÃ³rio', 'error');
    
    const selectAcao = document.getElementById('prod-acao-vinculo');
    if(selectAcao && selectAcao.value === 'VINCULAR' && !id) {
        return showToast('Selecione um produto para vincular', 'error');
    }

    pXML.nome = nome; pXML.cEAN = document.getElementById('prod-ean').value;
    pXML.custoFinal = parseFloat(document.getElementById('prod-custo').value)||0; pXML.margemAtual = parseFloat(document.getElementById('prod-margem').value)||0; pXML.precoVendaSug = parseFloat(document.getElementById('prod-preco').value)||0;
    
    if(selectAcao && selectAcao.value === 'VINCULAR' && id) {
        pXML.statusDB = 'ATUALIZAR';
        pXML.idMatch = id;
    } else {
        pXML.statusDB = 'NOVO CADASTRADO';
        pXML.idMatch = null;
    }
    fecharModalProduto(); renderTelaConferenciaXML(); showToast('Ficha salva para a importação!');
}\`;
        
        if (content.includes(oldSalvar)) {
             content = content.replace(oldSalvar, newSalvarProdutoXmlModal);
             updated = true;
        }
        
        if (updated && !content.includes('function alternarAcaoVinculoXML')) {
            content += '\\n' + helperFunctions;
        }
    }

    if (updated) {
        fs.writeFileSync(file, content);
        console.log('Updated JS ' + file);
    }
});







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
