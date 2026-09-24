import os
import re

# 1. First let's restore financeiro.html cleanly to git state so characters aren't garbled
os.system('git checkout sistema/financeiro.html')

with open('sistema/financeiro.html', 'r', encoding='latin1') as f:
    fin_html = f.read()

# 2. Add tailwind-built.css if not present
if 'tailwind-built.css' not in fin_html:
    fin_html = fin_html.replace(
        '<link rel="stylesheet" href="../style.css',
        '<link rel="stylesheet" href="../tailwind-built.css">\n    <link rel="stylesheet" href="../style.css'
    )

# 3. Read modal from vendas_gestao.html in latin1
with open('sistema/vendas_gestao.html', 'r', encoding='latin1') as f:
    vg_html = f.read()

start_pos = vg_html.find('id="modal-detalhes-venda"')
div_start = vg_html.rfind('<div', 0, start_pos)
count = 0
div_end = -1
for i in range(div_start, len(vg_html)):
    if vg_html[i:i+4] == '<div':
        count += 1
    elif vg_html[i:i+6] == '</div>':
        count -= 1
        if count == 0:
            div_end = i + 6
            break

modal_html = vg_html[div_start:div_end]

# Ensure modal has explicit inline style for fixed viewport and super high z-index
modal_html_styled = modal_html.replace(
    'id="modal-detalhes-venda" class="fixed inset-0 bg-slate-900/60 z-[500] hidden flex',
    'id="modal-detalhes-venda" style="position: fixed; inset: 0; z-index: 99999; display: none;" class="fixed inset-0 bg-slate-900/60 z-[500] flex'
)

# Insert modal before first script tag
target_script = "<script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>"
if target_script in fin_html:
    fin_html = fin_html.replace(target_script, modal_html_styled + '\n\n    ' + target_script)
else:
    fin_html = fin_html.replace('</body>', modal_html_styled + '\n\n</body>')

with open('sistema/financeiro.html', 'w', encoding='latin1') as f:
    f.write(fin_html)

print("financeiro.html updated cleanly with tailwind and modal!")

# 4. Now update financeiro.js with the robust verDetalhesVenda
with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    fin_js = f.read()

# Replace the verDetalhesVenda block
robust_js = '''
// ==========================================
// VISAO DE VENDA DETALHADA (MODAL NATIVO ROBUSTO)
// ==========================================
window.fecharModalDetalhesVenda = function() {
    const modal = document.getElementById('modal-detalhes-venda');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
};

window.verDetalhesVenda = async function(id) {
    console.log('[VerVenda] Abrindo detalhes para ID:', id);
    if (!id || id === 'undefined' || id === 'null') {
        if (typeof showToast === 'function') showToast('Identificador de venda inválido.', 'warning');
        else alert('Identificador de venda inválido.');
        return;
    }

    let modal = document.getElementById('modal-detalhes-venda');
    if (!modal) {
        console.error('[VerVenda] Elemento modal-detalhes-venda não encontrado no DOM!');
        return;
    }

    // Garante que o modal esteja como filho direto do body para não ser afetado por overflow/transform
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    // Buscar venda na memória local db.vendas
    let v = null;
    if (typeof db !== 'undefined' && Array.isArray(db.vendas)) {
        v = db.vendas.find(x => String(x.id) === String(id) || String(x.idVenda) === String(id) || String(x.numeroPedido) === String(id));
    }

    // Se não achou na memória, busca no Firestore direto
    if (!v && typeof firestore !== 'undefined') {
        try {
            console.log('[VerVenda] Buscando venda diretamente no Firestore...');
            const snap = await firestore.collection('vendas').doc(String(id)).get();
            if (snap.exists) {
                v = { id: snap.id, ...snap.data() };
            } else {
                const numVal = Number(id);
                if (!isNaN(numVal)) {
                    const q = await firestore.collection('vendas').where('numeroPedido', '==', numVal).limit(1).get();
                    if (!q.empty) {
                        v = { id: q.docs[0].id, ...q.docs[0].data() };
                    }
                }
            }
        } catch (err) {
            console.error('[VerVenda] Erro ao consultar Firestore:', err);
        }
    }

    if (!v) {
        console.warn('[VerVenda] Venda não encontrada:', id);
        if (typeof showToast === 'function') showToast('Venda #' + id + ' não encontrada.', 'warning');
        else alert('Venda #' + id + ' não encontrada.');
        return;
    }

    const isGestao = window.location.href.includes('gestao') || window.location.href.includes('financeiro');
    const subtitleEl = modal.querySelector('p.text-slate-400.uppercase');
    if (subtitleEl) {
        subtitleEl.innerText = isGestao ? 'Visão Gerencial de Custos e Lucros' : 'Visão Detalhada';
    }

    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const tipoTexto = v.tipo || 'VENDA';

    const elCli = document.getElementById('det-venda-cliente');
    if (elCli) elCli.innerText = v.clienteNome || 'Desconhecido';

    const elData = document.getElementById('det-venda-data');
    if (elData) {
        const dStr = v.data ? (typeof formatData === 'function' ? formatData(v.data).split(' ')[0] : String(v.data).slice(0, 10)) : '-';
        elData.innerText = `${dStr} | #${numPedStr}`;
    }

    const elPag = document.getElementById('det-venda-pag');
    if (elPag) elPag.innerText = tipoTexto === 'ORÇAMENTO' ? 'Orçamento' : (v.pag || '-');

    let osInfoHtml = '';
    if (tipoTexto === 'SERVIÇO' && v.servicoDetalhes) {
        let galeriaHtml = '';
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) {
            galeriaHtml = `<p class="mt-2"><strong>Fotos de Referência:</strong></p><div class="flex gap-2 flex-wrap mt-1">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" class="h-20 rounded border border-purple-300 shadow-sm hover:opacity-80 transition" title="Foto">`).join('')}</div>`;
        } else if (v.servicoDetalhes.foto) {
            galeriaHtml = `<p class="mt-2"><strong>Foto de Referência:</strong></p><img src="${v.servicoDetalhes.foto}" class="mt-1 h-24 rounded border border-purple-300 shadow-sm hover:opacity-80 transition" title="Foto">`;
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

    const elObs = document.getElementById('det-venda-obs');
    if (elObs) {
        elObs.innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observação geral vinculada a esta venda.</span>') + osInfoHtml;
    }

    let totalCusto = 0;
    const elItens = document.getElementById('det-venda-itens');
    if (elItens) {
        elItens.innerHTML = (v.itens || []).map(i => {
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
                    <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${i.nome || 'Produto/Serviço'}</div>
                    ${i.obsVenda ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md"><i class="fa-solid fa-note-sticky mr-1"></i>${i.obsVenda}</div>` : ''}
                </td>
                <td class="p-4 text-center border-b border-slate-100 dark:border-slate-800/50">
                    <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700">${qtd}</span>
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-black text-slate-700 dark:text-slate-300 text-sm">${typeof formatMoney === 'function' ? formatMoney(preco) : 'R$ ' + preco.toFixed(2)}</div>
                    ${isGestao ? `<div class="text-[10px] text-red-500/80 dark:text-red-400/80 font-bold mt-0.5 bg-red-50 dark:bg-red-900/20 inline-block px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800/30">Custo: ${typeof formatMoney === 'function' ? formatMoney(custo) : 'R$ ' + custo.toFixed(2)}</div>` : ''}
                </td>
                <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                    <div class="font-black text-slate-800 dark:text-white text-sm">${typeof formatMoney === 'function' ? formatMoney(subTot) : 'R$ ' + subTot.toFixed(2)}</div>
                    ${isGestao ? `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : 'R$ ' + lucroSub.toFixed(2)} <span class="text-blue-500">(${margemSub.toFixed(1)}%)</span></div>` : ''}
                </td>
            </tr>`;
        }).join('');
    }

    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const taxaBoleto = Number(v.taxaBoleto) || 0;
    const totalDespesas = taxaCartao + taxaBoleto;
    const custoGeral = totalCusto + totalDespesas;
    const lucroLiquido = tot - custoGeral;
    const margemLiquidaReal = tot > 0 ? ((lucroLiquido / tot) * 100) : 0;
    const markupReal = custoGeral > 0 ? ((lucroLiquido / custoGeral) * 100) : 0;

    const tfootEl = document.getElementById('det-venda-tfoot');
    if (tfootEl) {
        let tfootHtml = '';
        if (isGestao) {
            tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Custo Total (Produtos)</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : 'R$ ' + totalCusto.toFixed(2)}</td>
                </tr>
            `;
            if (taxaCartao > 0) {
                tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cartão / Despesa</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : 'R$ ' + taxaCartao.toFixed(2)}</td>
                </tr>`;
            }
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : 'R$ ' + tot.toFixed(2)}</td>
                </tr>
                <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro Líquido Real</td>
                    <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : 'R$ ' + lucroLiquido.toFixed(2)}</td>
                </tr>
                <tr class="bg-emerald-50/40 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-800/30">
                    <td colspan="3" class="p-3 text-right font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Margem de Lucro Real / Markup</td>
                    <td class="p-3 text-right font-black text-sm">
                        <span class="bg-emerald-100 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded font-black text-xs">${margemLiquidaReal.toFixed(2)}% Margem</span>
                        <span class="text-[11px] text-blue-600 dark:text-blue-400 font-bold ml-1">(${markupReal.toFixed(2)}% MKP)</span>
                    </td>
                </tr>
            `;
        } else {
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Total Geral</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : 'R$ ' + tot.toFixed(2)}</td>
                </tr>
            `;
        }
        tfootEl.innerHTML = tfootHtml;
    }

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '99999', 'important');
    console.log('[VerVenda] Modal exibido com sucesso!');
};
'''

idx = fin_js.find('// ==========================================\n// VISAO DE VENDA DETALHADA')
if idx == -1:
    idx = fin_js.find('window.verDetalhesVenda =')
if idx != -1:
    fin_js = fin_js[:idx] + robust_js.strip() + '\n'
else:
    fin_js = fin_js + '\n' + robust_js.strip() + '\n'

with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
    f.write(fin_js)

print("financeiro.js updated with robust verDetalhesVenda!")
