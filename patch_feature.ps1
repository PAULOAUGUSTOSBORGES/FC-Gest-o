$utf8 = New-Object System.Text.UTF8Encoding $false

# 1. Modificar vendas_gestao.html
$htmlGestao = [System.IO.File]::ReadAllText("g:\site sistema\vendas_gestao.html", $utf8)
$htmlGestao = $htmlGestao.Replace('<th class="p-3 text-right">Lucro Líquido</th>', '<th class="p-3 text-right">Lucro Líquido</th><th class="p-3 text-center">Ações</th>')

$htmlOperacao = [System.IO.File]::ReadAllText("g:\site sistema\vendas_operacao.html", $utf8)
$startToken = '<!-- DETALHES DA VENDA/ORÇAMENTO -->'
$endToken = '<!-- CONFIRMAÇÃO DO SISTEMA -->'
$startIndex = $htmlOperacao.IndexOf($startToken)
$endIndex = $htmlOperacao.IndexOf($endToken)

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    $modalHtml = $htmlOperacao.Substring($startIndex + $startToken.Length, $endIndex - $startIndex - $startToken.Length)
    if (-not $htmlGestao.Contains('id="modal-detalhes-venda"')) {
        $htmlGestao = $htmlGestao.Replace($endToken, "$startToken$modalHtml$endToken")
    }
}
[System.IO.File]::WriteAllText("g:\site sistema\vendas_gestao.html", $htmlGestao, $utf8)


# 2. Modificar vendas_gestao.js
$jsGestao = [System.IO.File]::ReadAllText("g:\site sistema\vendas_gestao.js", $utf8)
$jsGestao = $jsGestao.Replace(
    '<td class="p-3 text-right font-black text-emerald-600">${typeof formatMoney === ''function'' ? formatMoney(lucroDaVenda) : lucroDaVenda}</td>',
    '<td class="p-3 text-right font-black text-emerald-600">${typeof formatMoney === ''function'' ? formatMoney(lucroDaVenda) : lucroDaVenda}</td><td class="p-3 text-center print:hidden"><button onclick="verDetalhesVenda(''${v.id}'')" class="text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1.5 rounded font-bold text-xs"><i class="fa-solid fa-eye"></i></button></td>'
)
$jsGestao = $jsGestao.Replace('<td colspan="7"', '<td colspan="8"')


# 3. Enhanced verDetalhesVenda
$enhanced = @"
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
    
    let totalCusto = 0;
    document.getElementById('det-venda-itens').innerHTML = (v.itens || []).map(i => {
        const preco = Number(i.preco) || 0;
        const qtd = Number(i.qtd) || 1;
        const custo = Number(i.custo) || 0;
        
        const subTot = preco * qtd;
        const subCusto = custo * qtd;
        const lucroSub = subTot - subCusto;
        
        totalCusto += subCusto;
        
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
            <td class="p-3 font-medium text-slate-700 dark:text-slate-200 text-xs">
                ${i.nome || 'Produto/Serviço'} ${i.obsVenda ? `<br><span class="text-[10px] text-slate-400">Obs: ${i.obsVenda}</span>` : ''}
            </td>
            <td class="p-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">${qtd}</td>
            <td class="p-3 text-right text-xs text-slate-500 dark:text-slate-400">
                ${typeof formatMoney === 'function' ? formatMoney(preco) : preco}
                <br><span class="text-[10px] text-red-400 font-normal">Custo: ${typeof formatMoney === 'function' ? formatMoney(custo) : custo}</span>
            </td>
            <td class="p-3 text-right text-xs font-bold text-slate-800 dark:text-slate-100">
                ${typeof formatMoney === 'function' ? formatMoney(subTot) : subTot}
                <br><span class="text-[10px] text-emerald-500 font-normal">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub}</span>
            </td>
        </tr>`;
    }).join('');
    
    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const lucroLiquido = tot - totalCusto - taxaCartao;
    
    const tfootEl = document.querySelector('#modal-detalhes-venda tfoot');
    if (tfootEl) {
        let tfootHtml = `
            <tr>
                <td colspan="3" class="p-2 md:p-3 text-right font-bold text-slate-500 dark:text-slate-400 text-[10px] md:text-xs uppercase">Custo Total (Produtos)</td>
                <td class="p-2 md:p-3 text-right font-bold text-red-500 text-sm">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : totalCusto}</td>
            </tr>
        `;
        if (taxaCartao > 0) {
            tfootHtml += `
            <tr>
                <td colspan="3" class="p-2 md:p-3 text-right font-bold text-slate-500 dark:text-slate-400 text-[10px] md:text-xs uppercase">Despesa (Taxa Cartão)</td>
                <td class="p-2 md:p-3 text-right font-bold text-red-500 text-sm">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
            </tr>`;
        }
        tfootHtml += `
            <tr>
                <td colspan="3" class="p-2 md:p-3 text-right font-bold text-slate-800 dark:text-slate-200 text-xs md:text-sm uppercase">Valor Bruto Total</td>
                <td class="p-2 md:p-3 text-right font-black text-slate-800 dark:text-slate-200 text-base md:text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
            </tr>
            <tr class="bg-emerald-50 dark:bg-emerald-900/20">
                <td colspan="3" class="p-2 md:p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 text-xs md:text-sm uppercase">Lucro Líquido Real</td>
                <td class="p-2 md:p-3 text-right font-black text-emerald-600 text-lg md:text-xl">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
            </tr>
        `;
        tfootEl.innerHTML = tfootHtml;
    } else {
        document.getElementById('det-venda-total').innerText = typeof formatMoney === 'function' ? formatMoney(tot) : tot;
    }
    
    document.getElementById('modal-detalhes-venda').classList.remove('hidden');
}

function fecharModalDetalhesVenda() { 
    document.getElementById('modal-detalhes-venda').classList.add('hidden'); 
}
"@

# Update vendas_gestao.js with the function
if (-not $jsGestao.Contains("function verDetalhesVenda")) {
    $jsGestao += "`n`n" + $enhanced
} else {
    $idx = $jsGestao.LastIndexOf("function verDetalhesVenda")
    if ($idx -ge 0) {
        $jsGestao = $jsGestao.Substring(0, $idx) + $enhanced
    }
}
[System.IO.File]::WriteAllText("g:\site sistema\vendas_gestao.js", $jsGestao, $utf8)

# Update vendas_operacao.js
$jsOperacao = [System.IO.File]::ReadAllText("g:\site sistema\vendas_operacao.js", $utf8)
$idx2 = $jsOperacao.LastIndexOf("function verDetalhesVenda(id) {")
if ($idx2 -ge 0) {
    # It has a closing fecharModalDetalhesVenda() which we need to replace up to its end.
    $prefix = $jsOperacao.Substring(0, $idx2)
    
    # find the end of fecharModalDetalhesVenda function
    $closeStr = "function fecharModalDetalhesVenda() { `r`n    document.getElementById('modal-detalhes-venda').classList.add('hidden'); `r`n}"
    # Wait, it might be formatted differently, just find the next function
    $idx3 = $jsOperacao.IndexOf("function editarVenda", $idx2)
    if ($idx3 -gt $idx2) {
        $suffix = $jsOperacao.Substring($idx3)
        $jsOperacao = $prefix + $enhanced + "`n`n" + $suffix
        [System.IO.File]::WriteAllText("g:\site sistema\vendas_operacao.js", $jsOperacao, $utf8)
    }
}

Write-Host "Patch complete."
