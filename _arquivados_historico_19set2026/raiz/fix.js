const fs = require('fs');
let content = fs.readFileSync('sistema/financeiro.js', 'latin1');

// 1. Add origemVendaId button
const acoesOld = "let acoesExtras = '';\n        if (f.status === 'PENDENTE') {";
const acoesNew = "let acoesExtras = '';\n        if (f.origemVendaId) {\n            acoesExtras += \<button onclick=\"verDetalhesVenda('\')\" class=\"text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 p-1.5 ml-1 print:hidden\" title=\"Ver Venda\"><i class=\"fa-solid fa-receipt\"></i></button>\;\n        }\n        if (f.status === 'PENDENTE') {";
content = content.replace(acoesOld, acoesNew);

// 2. Add total calculation and footer
const mapStartOld = "document.getElementById(\	abela-fin-\\).innerHTML = lista.map(f => {";
const mapStartNew = "let totalExibido = 0;\n    let htmlLinhas = lista.map(f => {\n        let valorParaTotal = Number(f.valor) || 0;\n        if (f.status === 'PAGO') {\n            valorParaTotal = Number(f.valorPago) || Number(f.valor) || 0;\n        } else {\n            const c = calcularJurosMulta(f);\n            if(c.diasAtraso > 0 && (c.multa > 0 || c.juros > 0)) {\n                valorParaTotal = Number(c.valorAtualizado) || 0;\n            }\n        }\n        totalExibido += valorParaTotal;\n";
content = content.replace(mapStartOld, mapStartNew);

// 3. Replace the end of map using regex to avoid accent issues
const mapEndRegex = /\}\)\.join\(''\) \|\| <tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum t.tulo encontrado\.<\/td><\/tr>;/g;
const mapEndNew = "}).join('');\n    if (!htmlLinhas) htmlLinhas = <tr><td colspan=\"6\" class=\"p-6 text-center text-slate-500 dark:text-slate-400\">Nenhum t\\xEDtulo encontrado.</td></tr>;\n    else htmlLinhas += <tr class=\"bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700\"><td colspan=\"3\" class=\"p-3 text-right font-bold text-slate-600 dark:text-slate-300\">Total Filtrado:</td><td class=\"p-3 text-right font-black \\">\</td><td colspan=\"2\"></td></tr>;\n    document.getElementById(\	abela-fin-\\).innerHTML = htmlLinhas;";
content = content.replace(mapEndRegex, mapEndNew);

fs.writeFileSync('sistema/financeiro.js', content, 'latin1');
console.log("Substituicoes concluidas no node");
