import os
import time

# 1. Read the clean modal HTML from vendas_gestao.html to use as the template
with open('sistema/vendas_gestao.html', 'r', encoding='utf-8') as f:
    vendas_html = f.read()

start_marker = 'id="modal-detalhes-venda"'
start_pos = vendas_html.find(start_marker)
div_start = vendas_html.rfind('<div', 0, start_pos)

div_count = 0
div_end = -1
for i in range(div_start, len(vendas_html)):
    if vendas_html[i:i+4] == '<div':
        div_count += 1
    elif vendas_html[i:i+6] == '</div>':
        div_count -= 1
        if div_count == 0:
            div_end = i + 6
            break

modal_html = vendas_html[div_start:div_end]

# 2. Build the robust verDetalhesVenda function
robust_fn = f'''
// ==========================================
// VISAO DE VENDA DETALHADA (ROBUSTO & NATIVO)
// ==========================================
const MODAL_DETALHES_VENDA_HTML = `{modal_html}`;

function garantirModalDetalhesNoDOM() {{
    let modal = document.getElementById('modal-detalhes-venda');
    if (!modal) {{
        console.log('[VerVenda] Inserindo modal no DOM dinamicamente...');
        const temp = document.createElement('div');
        temp.innerHTML = MODAL_DETALHES_VENDA_HTML;
        modal = temp.firstElementChild;
        document.body.appendChild(modal);
    }}
    return modal;
}}

window.fecharModalDetalhesVenda = function() {{
    const modal = document.getElementById('modal-detalhes-venda');
    if (modal) {{
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }}
}};

window.verDetalhesVenda = async function(id) {{
    console.log('[VerVenda] Abrindo detalhes para ID:', id);
    if (!id || id === 'undefined' || id === 'null') {{
        if (typeof showToast === 'function') {{
            showToast('Identificador de venda inv\u00e1lido ou n\u00e3o vinculado.', 'warning');
        }} else {{
            alert('Identificador de venda inv\u00e1lido ou n\u00e3o vinculado.');
        }}
        return;
    }}

    const modal = garantirModalDetalhesNoDOM();
    if (!modal) return;

    // Buscar venda na mem\u00f3ria local db.vendas
    let v = null;
    if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {{
        v = db.vendas.find(x => String(x.id) === String(id) || String(x.idVenda) === String(id) || String(x.numeroPedido) === String(id));
    }}

    // Se n\u00e3o achou na mem\u00f3ria, busca no Firestore direto
    if (!v && typeof firestore !== 'undefined') {{
        try {{
            console.log('[VerVenda] Buscando venda diretamente no Firestore...');
            const snap = await firestore.collection('vendas').doc(String(id)).get();
            if (snap.exists) {{
                v = {{ id: snap.id, ...snap.data() }};
            }} else {{
                // Tenta buscar por numeroPedido
                const numVal = Number(id);
                if (!isNaN(numVal)) {{
                    const q = await firestore.collection('vendas').where('numeroPedido', '==', numVal).limit(1).get();
                    if (!q.empty) {{
                        v = {{ id: q.docs[0].id, ...q.docs[0].data() }};
                    }}
                }}
            }}
        }} catch (err) {{
            console.error('[VerVenda] Erro ao consultar Firestore:', err);
        }}
    }}

    if (!v) {{
        console.warn('[VerVenda] Venda n\u00e3o encontrada:', id);
        if (typeof showToast === 'function') {{
            showToast('Venda #' + id + ' n\u00e3o encontrada no banco de dados.', 'warning');
        }} else {{
            alert('Venda #' + id + ' n\u00e3o encontrada no banco de dados.');
        }}
        return;
    }}

    const isGestao = window.location.href.includes('gestao') || window.location.href.includes('financeiro');
    const subtitleEl = modal.querySelector('p.text-slate-400.uppercase');
    if (subtitleEl) {{
        subtitleEl.innerText = isGestao ? 'Vis\u00e3o Gerencial de Custos e Lucros' : 'Vis\u00e3o Detalhada';
    }}

    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const tipoTexto = v.tipo || 'VENDA';

    const elCli = document.getElementById('det-venda-cliente');
    if (elCli) elCli.innerText = v.clienteNome || 'Desconhecido';

    const elData = document.getElementById('det-venda-data');
    if (elData) {{
        const dStr = v.data ? (typeof formatData === 'function' ? formatData(v.data).split(' ')[0] : String(v.data).slice(0, 10)) : '-';
        elData.innerText = `${{dStr}} | #${{numPedStr}}`;
    }}

    const elPag = document.getElementById('det-venda-pag');
    if (elPag) elPag.innerText = tipoTexto === 'OR\u00c7AMENTO' ? 'Or\u00e7amento' : (v.pag || '-');

    let osInfoHtml = '';
    if (tipoTexto === 'SERVI\u00c7O' && v.servicoDetalhes) {{
        let galeriaHtml = '';
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) {{
            galeriaHtml = `<p class="mt-2"><strong>Fotos de Refer\u00eancia:</strong></p><div class="flex gap-2 flex-wrap mt-1">${{v.servicoDetalhes.fotos.map(f => `<img src="${{f}}" class="h-20 rounded border border-purple-300 shadow-sm hover:opacity-80 transition" title="Foto">`).join('')}}</div>`;
        }} else if (v.servicoDetalhes.foto) {{
            galeriaHtml = `<p class="mt-2"><strong>Foto de Refer\u00eancia:</strong></p><img src="${{v.servicoDetalhes.foto}}" class="mt-1 h-24 rounded border border-purple-300 shadow-sm hover:opacity-80 transition" title="Foto">`;
        }}
        osInfoHtml = `
            <div class="mt-4 bg-purple-50 dark:bg-purple-900/20 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800/50 text-xs md:text-sm text-purple-900 dark:text-purple-200">
                <h4 class="font-bold mb-2 uppercase text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800/50 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Servi\u00e7o</h4>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <p><strong>Prazo de Entrega:</strong> ${{v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'N\u00e3o informado'}}</p>
                    <p><strong>Garantia:</strong> ${{v.servicoDetalhes.garantia || 'Nenhuma'}}</p>
                </div>
                <p class="mb-2"><strong>Escopo / Diagn\u00f3stico:</strong><br> ${{v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}}</p>
                ${{galeriaHtml}}
            </div>`;
    }}

    const elObs = document.getElementById('det-venda-obs');
    if (elObs) {{
        elObs.innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observa\u00e7\u00e3o geral vinculada a esta venda.</span>') + osInfoHtml;
    }}

    let totalCusto = 0;
    const elItens = document.getElementById('det-venda-itens');
    if (elItens) {{
        elItens.innerHTML = (v.itens || []).map(i => {{
            const preco = Number(i.preco) || 0;
            const qtd = Number(i.qtd) || 1;
            const custo = Number(i.custo) || 0;

            const subTot = preco * qtd;
            const subCusto = custo * qtd;
            const lucroSub = subTot - subCusto;
            const margemSub = subTot > 0 ? ((lucroSub / subTot) * 100) : 0;

            totalCusto += subCusto;

            return `
            <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors group">
                <td class="p-4 border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${{i.nome || 'Produto/Servi\u00e7o'}}</div>
                    ${{i.obsVenda ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md"><i class="fa-solid fa-note-sticky mr-1"></i>${{i.obsVenda}}</div>` : ''}}
                </td>
                <td class="p-4 text-center border-b border-slate-100 dark:border-slate-800/50">
                    <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700">${{qtd}}</span>
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-black text-slate-700 dark:text-slate-300 text-sm">${{typeof formatMoney === 'function' ? formatMoney(preco) : 'R$ ' + preco.toFixed(2)}}</div>
                    ${{isGestao ? `<div class="text-[10px] text-red-500/80 dark:text-red-400/80 font-bold mt-0.5 bg-red-50 dark:bg-red-900/20 inline-block px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800/30">Custo: ${{typeof formatMoney === 'function' ? formatMoney(custo) : 'R$ ' + custo.toFixed(2)}}</div>` : ''}}
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-black text-slate-800 dark:text-white text-sm">${{typeof formatMoney === 'function' ? formatMoney(subTot) : 'R$ ' + subTot.toFixed(2)}}</div>
                    ${{isGestao ? `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${{typeof formatMoney === 'function' ? formatMoney(lucroSub) : 'R$ ' + lucroSub.toFixed(2)}} <span class="text-blue-500">(${{margemSub.toFixed(1)}}%)</span></div>` : ''}}
                </td>
            </tr>`;
        }}).join('');
    }}

    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const taxaBoleto = Number(v.taxaBoleto) || 0;
    const totalDespesas = taxaCartao + taxaBoleto;
    const custoGeral = totalCusto + totalDespesas;
    const lucroLiquido = tot - custoGeral;
    const margemLiquidaReal = tot > 0 ? ((lucroLiquido / tot) * 100) : 0;
    const markupReal = custoGeral > 0 ? ((lucroLiquido / custoGeral) * 100) : 0;

    const tfootEl = document.getElementById('det-venda-tfoot');
    if (tfootEl) {{
        let tfootHtml = '';
        if (isGestao) {{
            tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Custo Total (Produtos)</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${{typeof formatMoney === 'function' ? formatMoney(totalCusto) : 'R$ ' + totalCusto.toFixed(2)}}</td>
                </tr>
            `;
            if (taxaCartao > 0) {{
                tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cart\u00e3o / Despesa</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${{typeof formatMoney === 'function' ? formatMoney(taxaCartao) : 'R$ ' + taxaCartao.toFixed(2)}}</td>
                </tr>`;
            }}
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${{typeof formatMoney === 'function' ? formatMoney(tot) : 'R$ ' + tot.toFixed(2)}}</td>
                </tr>
                <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro L\u00edquido Real</td>
                    <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${{typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : 'R$ ' + lucroLiquido.toFixed(2)}}</td>
                </tr>
                <tr class="bg-emerald-50/40 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-800/30">
                    <td colspan="3" class="p-3 text-right font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Margem de Lucro Real / Markup</td>
                    <td class="p-3 text-right font-black text-sm">
                        <span class="bg-emerald-100 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded font-black text-xs">${{margemLiquidaReal.toFixed(2)}}% Margem</span>
                        <span class="text-[11px] text-blue-600 dark:text-blue-400 font-bold ml-1">(${{markupReal.toFixed(2)}}% MKP)</span>
                    </td>
                </tr>
            `;
        }} else {{
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Total Geral</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${{typeof formatMoney === 'function' ? formatMoney(tot) : 'R$ ' + tot.toFixed(2)}}</td>
                </tr>
            `;
        }}
        tfootEl.innerHTML = tfootHtml;
    }}

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}};
'''

# 3. Read and update financeiro.js cleanly in UTF-8
with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    fin_js = f.read()

target = '// ==========================================\n// VISAO DE VENDA DETALHADA'
pos = fin_js.find(target)
if pos == -1:
    target = 'window.verDetalhesVenda ='
    pos = fin_js.find(target)

if pos != -1:
    fin_js = fin_js[:pos] + robust_fn.strip() + '\n'
else:
    fin_js = fin_js + '\n' + robust_fn.strip() + '\n'

with open('sistema/financeiro.js', 'w', encoding='utf-8') as f:
    f.write(fin_js)

print("financeiro.js updated with robust verDetalhesVenda!")

# 4. Now bump version in financeiro.html to force browser refresh
new_ver = str(int(time.time()))
with open('sistema/financeiro.html', 'r', encoding='utf-8') as f:
    fin_html = f.read()

import re
fin_html = re.sub(r'financeiro\.js\?v=[0-9]+', f'financeiro.js?v={new_ver}', fin_html)
with open('sistema/financeiro.html', 'w', encoding='utf-8') as f:
    f.write(fin_html)

print(f"Bumped financeiro.html script version to v={new_ver}")
