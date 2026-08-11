const fs = require('fs');

// 1. Modificar vendas_gestao.html para adicionar a coluna de Ações e o Modal
let htmlGestao = fs.readFileSync('g:\\site sistema\\vendas_gestao.html', 'utf8');

// Adicionar a coluna no thead
htmlGestao = htmlGestao.replace(
    '<th class="p-3 text-right">Lucro Líquido</th>',
    '<th class="p-3 text-right">Lucro Líquido</th>\n                                        <th class="p-3 text-center">Ações</th>'
);

// Pegar o HTML do modal e do zoom do vendas_operacao.html
let htmlOperacao = fs.readFileSync('g:\\site sistema\\vendas_operacao.html', 'utf8');
let modalHtml = htmlOperacao.split('<!-- DETALHES DA VENDA/ORÇAMENTO -->')[1].split('<!-- CONFIRMAÇÃO DO SISTEMA -->')[0];

if (!htmlGestao.includes('id="modal-detalhes-venda"')) {
    htmlGestao = htmlGestao.replace(
        '<!-- CONFIRMAÇÃO DO SISTEMA -->',
        '<!-- DETALHES DA VENDA/ORÇAMENTO -->' + modalHtml + '<!-- CONFIRMAÇÃO DO SISTEMA -->'
    );
}

fs.writeFileSync('g:\\site sistema\\vendas_gestao.html', htmlGestao);


// 2. Modificar vendas_gestao.js para adicionar o botão de Detalhes na tabela
let jsGestao = fs.readFileSync('g:\\site sistema\\vendas_gestao.js', 'utf8');

// Adicionar a célula com o botão "verDetalhesVenda" na linha da tabela
jsGestao = jsGestao.replace(
    '<td class="p-3 text-right font-black text-emerald-600">${typeof formatMoney === \'function\' ? formatMoney(lucroDaVenda) : lucroDaVenda}</td>\n            </tr>`;',
    '<td class="p-3 text-right font-black text-emerald-600">${typeof formatMoney === \'function\' ? formatMoney(lucroDaVenda) : lucroDaVenda}</td>\n                <td class="p-3 text-center print:hidden"><button onclick="verDetalhesVenda(\'${v.id}\')" class="text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1.5 rounded font-bold text-xs"><i class="fa-solid fa-eye"></i></button></td>\n            </tr>`;'
);

// Adicionar o colspan para "Nenhum registro" (de 7 para 8)
jsGestao = jsGestao.replace(
    '<td colspan="7"',
    '<td colspan="8"'
);

// 3. Atualizar a lógica do verDetalhesVenda em vendas_operacao.js (e copiar para vendas_gestao.js)
let jsOperacao = fs.readFileSync('g:\\site sistema\\vendas_operacao.js', 'utf8');

const enhancedVerDetalhes = `
function verDetalhesVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    const isGestao = window.location.href.includes('gestao');
    
    const subtitleEl = document.querySelector('#modal-detalhes-venda p.text-slate-400.uppercase');
    if (subtitleEl) {
        subtitleEl.innerText = isGestao ? 'Vis\u00e3o Gerencial de Custos e Lucros' : 'Vis\u00e3o Detalhada';
    }
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    let tipoTexto = v.tipo || 'VENDA';
    
    document.getElementById('det-venda-cliente').innerText = v.clienteNome || 'Desconhecido'; 
    document.getElementById('det-venda-data').innerText = `${v.data ? formatData(v.data).split(' ')[0] : '-'} | #${numPedStr}`; 
    document.getElementById('det-venda-pag').innerText = tipoTexto === 'OR\u00c7AMENTO' ? 'Or\u00e7amento' : (v.pag || '-'); 
    
    let osInfoHtml = '';
    if (tipoTexto === 'SERVI\u00c7O' && v.servicoDetalhes) {
        let galeriaHtml = '';
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) { 
            galeriaHtml = `<p class="mt-2"><strong>Fotos de Refer\u00eancia:</strong></p><div class="flex gap-2 flex-wrap mt-1">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" onclick="abrirZoom('${f}')" class="h-20 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`).join('')}</div>`; 
        } else if (v.servicoDetalhes.foto) { 
            galeriaHtml = `<p class="mt-2"><strong>Foto de Refer\u00eancia:</strong></p><img src="${v.servicoDetalhes.foto}" onclick="abrirZoom('${v.servicoDetalhes.foto}')" class="mt-1 h-24 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`; 
        }
        osInfoHtml = `
            <div class="mt-4 bg-purple-50 dark:bg-purple-900/20 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800/50 text-xs md:text-sm text-purple-900 dark:text-purple-200">
                <h4 class="font-bold mb-2 uppercase text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800/50 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Servi\u00e7o</h4>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <p><strong>Prazo de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'N\u00e3o informado'}</p>
                    <p><strong>Garantia:</strong> ${v.servicoDetalhes.garantia || 'Nenhuma'}</p>
                </div>
                <p class="mb-2"><strong>Escopo / Diagn\u00f3stico:</strong><br> ${v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}</p>
                ${galeriaHtml}
            </div>`;
    }
    
    document.getElementById('det-venda-obs').innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observa\u00e7\u00e3o geral vinculada a esta venda.</span>') + osInfoHtml;
    
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
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors group">
            <td class="p-4 border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${i.nome || 'Produto/Servi\u00e7o'}</div>
                ${i.obsVenda ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md"><i class="fa-solid fa-note-sticky mr-1"></i>${i.obsVenda}</div>` : ''}
            </td>
            <td class="p-4 text-center border-b border-slate-100 dark:border-slate-800/50">
                <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700">${qtd}</span>
            </td>
            <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-black text-slate-700 dark:text-slate-300 text-sm">${typeof formatMoney === 'function' ? formatMoney(preco) : preco}</div>
                ${isGestao ? `<div class="text-[10px] text-red-500/80 dark:text-red-400/80 font-bold mt-0.5 bg-red-50 dark:bg-red-900/20 inline-block px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800/30">Custo: ${typeof formatMoney === 'function' ? formatMoney(custo) : custo}</div>` : ''}
            </td>
            <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-black text-slate-800 dark:text-white text-sm">${typeof formatMoney === 'function' ? formatMoney(subTot) : subTot}</div>
                ${isGestao ? `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub}</div>` : ''}
            </td>
        </tr>`;
    }).join('');
    
    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const lucroLiquido = tot - totalCusto - taxaCartao;
    
    const tfootEl = document.querySelector('#det-venda-tfoot');
    if (tfootEl) {
        let tfootHtml = '';
        if (isGestao) {
            tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Custo Total (Produtos)</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : totalCusto}</td>
                </tr>
            `;
            if (taxaCartao > 0) {
                tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cart\u00e3o / Despesa</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
                </tr>`;
            }
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
                </tr>
                <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro L\u00edquido Real</td>
                    <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
                </tr>
            `;
        } else {
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Total Geral</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
                </tr>
            `;
        }
        tfootEl.innerHTML = tfootHtml;
    }
    
    document.getElementById('modal-detalhes-venda').classList.remove('hidden');
}

function fecharModalDetalhesVenda() { 
    document.getElementById('modal-detalhes-venda').classList.add('hidden'); 
}
`;

// Substituir as funções velhas no vendas_operacao.js
const regexOperacao = /function verDetalhesVenda\(id\) \{[\s\S]*?function fecharModalDetalhesVenda\(\) \{[\s\S]*?\}/g;
jsOperacao = jsOperacao.replace(regexOperacao, enhancedVerDetalhes);

// No vendas_operacao.js há a função duplicada verDetalhesVenda(id) nas linhas ~1886. 
// Vamos também substituí-la ou não, mas a regex acima substituirá as duas instâncias juntas se ambas tiverem o fecharModal em seguida.
// Na verdade, a primeira não tem "fecharModalDetalhesVenda" logo depois dela, ela tem 'excluirVenda' depois.
// Vamos fazer um match mais seguro para a segunda função.
let idxSegundaFuncao = jsOperacao.lastIndexOf('function verDetalhesVenda(id) {');
if(idxSegundaFuncao !== -1 && jsOperacao.indexOf('document.getElementById(\'print-area\').innerHTML = htmlRecibo;', idxSegundaFuncao) === -1) {
    // Isso quer dizer que pegamos a segunda função (linha 2119).
    let prefix = jsOperacao.substring(0, idxSegundaFuncao);
    let rest = jsOperacao.substring(idxSegundaFuncao);
    let suffix = rest.substring(rest.indexOf('function editarVenda(id) {'));
    jsOperacao = prefix + enhancedVerDetalhes + '\n\n' + suffix;
}

fs.writeFileSync('g:\\site sistema\\vendas_operacao.js', jsOperacao);

// Adicionar a mesma função enhancedVerDetalhes no vendas_gestao.js se ela não existir
if (!jsGestao.includes('function verDetalhesVenda')) {
    jsGestao += '\n\n' + enhancedVerDetalhes;
} else {
    // Se existir, atualiza.
    let idx = jsGestao.lastIndexOf('function verDetalhesVenda');
    let prefix = jsGestao.substring(0, idx);
    jsGestao = prefix + enhancedVerDetalhes;
}

fs.writeFileSync('g:\\site sistema\\vendas_gestao.js', jsGestao);

console.log("Patched files successfully.");
