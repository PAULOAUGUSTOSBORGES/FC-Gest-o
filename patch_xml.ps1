$htmlFiles = Get-ChildItem -Path . -Filter *.html -File
foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content.Contains('id="modal-produto"') -and -not $content.Contains('id="div-acao-vinculo-xml"')) {
        $replacement = @"
<!-- NOVO: OPÇÃO DE VÍNCULO MANUAL (MOSTRADA APENAS NO XML) -->
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
                </div>
                <input type="hidden" id="prod-id">
"@
        $content = $content -replace '<input type="hidden" id="prod-id">', $replacement
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Updated HTML $($file.Name)"
    }
}

$helperFunctions = @"

// NOVO: Funções auxiliares para Vínculo de XML
function alternarAcaoVinculoXML() {
    const acao = document.getElementById('prod-acao-vinculo').value;
    if(acao === 'VINCULAR') {
        document.getElementById('div-vinculo-busca').classList.remove('hidden');
        const sel = document.getElementById('prod-vinculo-select');
        if(sel.options.length <= 1) {
            let html = '<option value="">Selecione um produto...</option>';
            const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
            sorted.forEach(p => {
                html += `<option value="` + p.id + `">` + p.nome + ` (Estoque: ` + p.estoque + `)</option>`;
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
"@

$newAbrirModalProdutoDoXML = @"
function abrirModalProdutoDoXML(index) {
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
                    html += `<option value="` + prod.id + `">` + prod.nome + ` (Estoque: ` + prod.estoque + `)</option>`;
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
}
"@

$newSalvarProdutoXmlModal = @"
function salvarProdutoXmlModal() {
    const nome = document.getElementById('prod-nome').value; const id = document.getElementById('prod-id').value;
    const pXML = window.tempXMLData.produtosXML[window.xmlItemEditIndex];
    if(!nome) return showToast('Nome obrigatório', 'error');
    
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
}
"@

$oldAbrirRegex = '(?s)function abrirModalProdutoDoXML\(index\) \{.*?\}'
$oldSalvarRegex = '(?s)function salvarProdutoXmlModal\(\) \{.*?\}'

$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $updated = $false

    if ($content -match $oldAbrirRegex) {
        $content = $content -replace $oldAbrirRegex, $newAbrirModalProdutoDoXML
        $updated = $true
    }

    if ($content -match $oldSalvarRegex) {
        $content = $content -replace $oldSalvarRegex, $newSalvarProdutoXmlModal
        $updated = $true
    }
    
    if ($content -match '(?s)function abrirModalProduto\(\) \{' -and -not $content.Contains('div-acao-vinculo-xml')) {
        $content = $content -replace 'function abrirModalProduto\(\) \{', "function abrirModalProduto() {`n    const divAcao = document.getElementById('div-acao-vinculo-xml'); if(divAcao) divAcao.classList.add('hidden');"
        $updated = $true
    }
    
    if ($content -match '(?s)function abrirModalProduto\(id = null\) \{' -and -not $content.Contains('div-acao-vinculo-xml')) {
        $content = $content -replace 'function abrirModalProduto\(id = null\) \{', "function abrirModalProduto(id = null) {`n    const divAcao = document.getElementById('div-acao-vinculo-xml'); if(divAcao) divAcao.classList.add('hidden');"
        $updated = $true
    }

    if ($updated -and -not $content.Contains('function alternarAcaoVinculoXML')) {
        $content += "`n" + $helperFunctions
    }

    if ($updated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Updated JS $($file.Name)"
    }
}
