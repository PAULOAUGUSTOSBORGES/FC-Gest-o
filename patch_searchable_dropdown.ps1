$htmlFiles = Get-ChildItem -Path . -Filter *.html -File
foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # We find the start and end of the div-vinculo-busca
    $startIndex = $content.IndexOf('<div id="div-vinculo-busca" class="hidden">')
    if ($startIndex -ge 0) {
        $endIndex = $content.IndexOf('</div>', $startIndex)
        if ($endIndex -ge 0) {
            $endIndex += 6 # length of </div>
            $oldBlock = $content.Substring($startIndex, $endIndex - $startIndex)
            
            # Check if it is actually the select block (has prod-vinculo-select as select)
            if ($oldBlock.Contains('<select id="prod-vinculo-select"')) {
                $newDivBusca = @"
<div id="div-vinculo-busca" class="hidden">
                        <label class="text-xs font-bold text-slate-500 mb-1 block">Pesquisar Produto Existente</label>
                        <div class="relative">
                            <input type="text" id="prod-vinculo-search" autocomplete="off" oninput="filtrarProdutosXMLBusca()" onfocus="mostrarListaProdutosXMLBusca()" onblur="setTimeout(()=>ocultarListaProdutosXMLBusca(), 200)" class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded text-sm outline-none dark:text-white" placeholder="Digite para pesquisar...">
                            <input type="hidden" id="prod-vinculo-select" onchange="preencherVinculoXML()">
                            <ul id="prod-vinculo-lista" class="hidden absolute z-[200] w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded mt-1 max-h-48 overflow-y-auto shadow-xl dark:text-white text-sm">
                            </ul>
                        </div>
                    </div>
"@
                $content = $content.Replace($oldBlock, $newDivBusca)
                Set-Content -Path $file.FullName -Value $content -Encoding UTF8
                Write-Host "Updated HTML $($file.Name)"
            }
        }
    }
}

$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $updated = $false
    
    # Replace the options generation in alternarAcaoVinculoXML
    $altStart = $content.IndexOf("function alternarAcaoVinculoXML() {")
    if ($altStart -ge 0) {
        $altEnd = $content.IndexOf("}", $content.IndexOf("}", $altStart) + 1)
        # Find next } if needed to cover the if/else
        $altEnd = $content.IndexOf("}", $content.IndexOf("}", $content.IndexOf("}", $altStart) + 1) + 1)
        if ($altEnd -ge 0) {
            $altEnd += 1
            $oldAlt = $content.Substring($altStart, $altEnd - $altStart)
            if ($oldAlt.Contains("options.length")) {
                $newAlternarAcao = @"
function alternarAcaoVinculoXML() {
    const acao = document.getElementById('prod-acao-vinculo').value;
    if(acao === 'VINCULAR') {
        document.getElementById('div-vinculo-busca').classList.remove('hidden');
    } else {
        document.getElementById('div-vinculo-busca').classList.add('hidden');
        document.getElementById('prod-id').value = '';
    }
}
"@
                $content = $content.Replace($oldAlt, $newAlternarAcao)
                $updated = $true
            }
        }
    }

    # Replace the options generation in abrirModalProdutoDoXML
    $regexAbrir = '(?s)if\(selectAcao\.value === ''VINCULAR''\) \{\s*divBusca\.classList\.remove\(''hidden''\);\s*if\(selProd && selProd\.options\.length <= 1\) \{.*?\selProd\.innerHTML = html;\s*\}\s*if\(selProd\) selProd\.value = p\.idMatch \|\| '''';\s*\}'
    $newAbrirBlock = @"
if(selectAcao.value === 'VINCULAR') {
            divBusca.classList.remove('hidden');
            if(selProd) {
                selProd.value = p.idMatch || '';
                if(p.idMatch) {
                    const matchP = db.produtos.find(x => String(x.id) === String(p.idMatch));
                    if(matchP) document.getElementById('prod-vinculo-search').value = matchP.nome;
                } else {
                    document.getElementById('prod-vinculo-search').value = '';
                }
            }
        }
"@

    if ($content -match $regexAbrir) {
        $content = $content -replace $regexAbrir, $newAbrirBlock
        $updated = $true
    }
    
    if ($updated -and -not $content.Contains('function selecionarProdutoVinculoXML')) {
        $helperFunctions = @"

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
"@
        $content += "`n" + $helperFunctions
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Updated JS $($file.Name)"
    }
}
