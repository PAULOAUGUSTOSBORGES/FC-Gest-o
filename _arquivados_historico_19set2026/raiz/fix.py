import re

with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    content = f.read()

# 1. Add origemVendaId button
acoes_extras_old = "let acoesExtras = '';\n        if (f.status === 'PENDENTE') {"
acoes_extras_new = "let acoesExtras = '';\n        if (f.origemVendaId) {\n            acoesExtras += <button onclick=\"verDetalhesVenda('')\" class=\"text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 p-1.5 ml-1 print:hidden\" title=\"Ver Venda\"><i class=\"fa-solid fa-receipt\"></i></button>;\n        }\n        if (f.status === 'PENDENTE') {"
content = content.replace(acoes_extras_old, acoes_extras_new)

# 2. Add total calculation and footer
map_start_old = "    document.getElementById(	abela-fin-).innerHTML = lista.map(f => {"
map_start_new = "    let totalExibido = 0;\n    let htmlLinhas = lista.map(f => {\n        let valorParaTotal = Number(f.valor) || 0;\n        if (f.status === 'PAGO') {\n            valorParaTotal = Number(f.valorPago) || Number(f.valor) || 0;\n        } else {\n            const c = calcularJurosMulta(f);\n            if(c.diasAtraso > 0 && (c.multa > 0 || c.juros > 0)) {\n                valorParaTotal = Number(c.valorAtualizado) || 0;\n            }\n        }\n        totalExibido += valorParaTotal;"
content = content.replace(map_start_old, map_start_new)

# Replace the end of map
map_end_old = "    }).join('') || <tr><td colspan=\"6\" class=\"p-6 text-center text-slate-500 dark:text-slate-400\">Nenhum título encontrado.</td></tr>;"
map_end_new = "    }).join('');\n    if (!htmlLinhas) htmlLinhas = <tr><td colspan=\"6\" class=\"p-6 text-center text-slate-500 dark:text-slate-400\">Nenhum título encontrado.</td></tr>;\n    else htmlLinhas += <tr class=\"bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700\"><td colspan=\"3\" class=\"p-3 text-right font-bold text-slate-600 dark:text-slate-300\">Total Filtrado:</td><td class=\"p-3 text-right font-black \"></td><td colspan=\"2\"></td></tr>;\n    document.getElementById(	abela-fin-).innerHTML = htmlLinhas;"
content = content.replace(map_end_old, map_end_new)

with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
    f.write(content)

print("Substituições concluídas.")
