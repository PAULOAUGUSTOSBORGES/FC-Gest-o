import os
import re

# 1. HTML MODAL REPLACEMENT
html_new_modal = """    <!-- DETALHES DA VENDA/ORÇAMENTO -->
    <div id="modal-detalhes-venda" class="fixed inset-0 bg-slate-900/60 z-[500] hidden flex items-center justify-center p-4 backdrop-blur-md transition-all duration-300">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/50 dark:border-slate-700/50 w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh] transform scale-100 transition-transform">
            
            <!-- HEADER -->
            <div class="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-950 dark:to-slate-900 p-5 md:p-6 text-white flex justify-between items-center shrink-0 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl backdrop-blur-sm shadow-inner">
                        <i class="fa-solid fa-receipt text-blue-300"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-lg md:text-xl tracking-tight">Detalhes do Documento</h3>
                        <p class="text-xs text-slate-400 font-medium tracking-wide uppercase mt-0.5">Visão Gerencial de Custos e Lucros</p>
                    </div>
                </div>
                <button onclick="fecharModalDetalhesVenda()" class="text-slate-400 hover:text-white hover:bg-white/10 w-10 h-10 rounded-full transition-all flex items-center justify-center"><i class="fa-solid fa-xmark text-2xl"></i></button>
            </div>
            
            <!-- BODY -->
            <div class="p-5 md:p-8 bg-slate-50 dark:bg-slate-900/50 flex-1 overflow-y-auto custom-scrollbar relative">
                <!-- Info Cards -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="col-span-2 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><i class="fa-solid fa-user text-4xl"></i></div>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Cliente</p>
                        <p class="font-black text-slate-800 dark:text-slate-100 text-sm md:text-base truncate relative z-10" id="det-venda-cliente">-</p>
                    </div>
                    <div class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><i class="fa-regular fa-calendar text-4xl"></i></div>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Data / Ref</p>
                        <p class="font-black text-slate-800 dark:text-slate-100 text-sm md:text-base relative z-10" id="det-venda-data">-</p>
                    </div>
                    <div class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-shadow relative overflow-hidden group text-right">
                        <div class="absolute top-0 left-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><i class="fa-solid fa-tag text-4xl"></i></div>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Tipo</p>
                        <span class="inline-block bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 px-3 py-1 rounded-lg text-xs font-black tracking-wide relative z-10 shadow-sm" id="det-venda-pag">-</span>
                    </div>
                </div>
                
                <!-- Obs -->
                <div class="mb-6">
                    <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fa-regular fa-comment-dots"></i> Observações</p>
                    <div class="bg-white dark:bg-slate-800 p-4 rounded-xl border-l-4 border-l-blue-400 dark:border-slate-700 shadow-sm text-sm text-slate-600 dark:text-slate-300 min-h-[50px] font-medium" id="det-venda-obs"></div>
                </div>

                <!-- Table -->
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50 overflow-hidden mb-2">
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left min-w-[700px]">
                            <thead class="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200 dark:border-slate-700/50">
                                <tr>
                                    <th class="p-4">Produto/Serviço</th>
                                    <th class="p-4 text-center w-16">Qtd</th>
                                    <th class="p-4 text-right w-32">Valores Unit.</th>
                                    <th class="p-4 text-right w-32">Totais</th>
                                </tr>
                            </thead>
                            <tbody id="det-venda-itens" class="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm"></tbody>
                            <tfoot class="bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700/50" id="det-venda-tfoot">
                                <!-- Replaced by JS -->
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- FOOTER -->
            <div class="bg-white dark:bg-slate-900 p-4 md:p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0 rounded-b-2xl">
                <button onclick="fecharModalDetalhesVenda()" class="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold tracking-wide px-8 py-2.5 rounded-xl text-sm shadow-md transition-all active:scale-95"><i class="fa-solid fa-check mr-2"></i> Fechar Janela</button>
            </div>
        </div>
    </div>"""

def patch_html(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Encontrar o start e end do modal
    start_tag = '<!-- DETALHES DA VENDA/ORÇAMENTO -->'
    end_tag = '<!-- CONFIRMAÇÃO DO SISTEMA -->'
    
    if start_tag in html and end_tag in html:
        idx_start = html.find(start_tag)
        idx_end = html.find(end_tag)
        if idx_start < idx_end:
            new_html = html[:idx_start] + html_new_modal + "\n\n    " + html[idx_end:]
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_html)

for file in os.listdir('g:\\site sistema'):
    if file.endswith('.html'):
        patch_html(os.path.join('g:\\site sistema', file))

# 2. JS BEAUTIFICATION (Fixing mojibake and improving styling)
js_replacement = """
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
            <div class="mt-4 bg-purple-50 dark:bg-purple-900/20 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800/50 text-xs md:text-sm text-purple-900 dark:text-purple-200">
                <h4 class="font-bold mb-2 uppercase text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800/50 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Serviço</h4>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <p><strong>Prazo de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'Não informado'}</p>
                    <p><strong>Garantia:</strong> ${v.servicoDetalhes.garantia || 'Nenhuma'}</p>
                </div>
                <p class="mb-2"><strong>Escopo / Diagnóstico:</strong><br> ${v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}</p>
                ${galeriaHtml}
            </div>`;
    }
    
    document.getElementById('det-venda-obs').innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observação geral vinculada a esta venda.</span>') + osInfoHtml;
    
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
            <td class="p-4">
                <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${i.nome || 'Produto/Serviço'}</div>
                ${i.obsVenda ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md"><i class="fa-solid fa-note-sticky mr-1"></i>${i.obsVenda}</div>` : ''}
            </td>
            <td class="p-4 text-center">
                <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700">${qtd}</span>
            </td>
            <td class="p-4 text-right">
                <div class="font-black text-slate-700 dark:text-slate-300 text-sm">${typeof formatMoney === 'function' ? formatMoney(preco) : preco}</div>
                <div class="text-[10px] text-red-500/80 dark:text-red-400/80 font-bold mt-0.5 bg-red-50 dark:bg-red-900/20 inline-block px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800/30">Custo: ${typeof formatMoney === 'function' ? formatMoney(custo) : custo}</div>
            </td>
            <td class="p-4 text-right">
                <div class="font-black text-slate-800 dark:text-white text-sm">${typeof formatMoney === 'function' ? formatMoney(subTot) : subTot}</div>
                <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub}</div>
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
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Custo Total (Produtos)</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : totalCusto}</td>
            </tr>
        `;
        if (taxaCartao > 0) {
            tfootHtml += `
            <tr>
                <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cartão / Despesa</td>
                <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
            </tr>`;
        }
        tfootHtml += `
            <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
            </tr>
            <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro Líquido Real</td>
                <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
            </tr>
        `;
        tfootEl.innerHTML = tfootHtml;
    }
    
    document.getElementById('modal-detalhes-venda').classList.remove('hidden');
}

function fecharModalDetalhesVenda() { 
    document.getElementById('modal-detalhes-venda').classList.add('hidden'); 
}"""

def patch_js(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()
    
    # Regex para pegar as funções
    pattern = re.compile(r'function verDetalhesVenda\(id\) \{.*?function fecharModalDetalhesVenda\(\) \{.*?\}', re.DOTALL)
    
    # Substuimos tudo
    if pattern.search(js):
        new_js = pattern.sub(js_replacement.strip(), js)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_js)

for file in os.listdir('g:\\site sistema'):
    if file.endswith('.js'):
        patch_js(os.path.join('g:\\site sistema', file))

print("Beautified files successfully")
