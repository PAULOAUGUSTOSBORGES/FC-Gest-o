import os

with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    content = f.read()

target = """        let acoesExtras = '';
        if (f.origemVendaId) {
            acoesExtras += `<button onclick="verDetalhesVenda('${f.origemVendaId}')" class="text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 p-1.5 ml-1 print:hidden" title="Ver Venda"><i class="fa-solid fa-receipt"></i></button>`;
        }
        if (f.status === 'PENDENTE') {
            acoesExtras = `
                <button onclick="abrirModalBaixa('${f.id}')" class="text-blue-600 bg-blue-50 dark:bg-blue-950/70 dark:text-blue-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900 ml-1">Baixar</button>
                <button onclick="abrirModalRenegociacao('${f.id}')" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 p-1.5 ml-1 print:hidden" title="Renegociar / Parcelar"><i class="fa-solid fa-handshake"></i></button>
            `;
        } else if (f.status === 'PAGO') {
            acoesExtras = `<button onclick="estornarTitulo('${f.id}')" class="text-amber-500 hover:text-amber-700 dark:text-amber-400 p-1.5 ml-1 print:hidden" title="Estornar Pagamento"><i class="fa-solid fa-rotate-left"></i></button>`;
        }"""

replacement = """        let acoesExtras = '';
        if (f.status === 'PENDENTE' || f.status === 'ATRASADO') {
            acoesExtras += `
                <button onclick="abrirModalBaixa('${f.id}')" class="text-blue-600 bg-blue-50 dark:bg-blue-950/70 dark:text-blue-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900 ml-1">Baixar</button>
                <button onclick="abrirModalRenegociacao('${f.id}')" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 p-1.5 ml-1 print:hidden" title="Renegociar / Parcelar"><i class="fa-solid fa-handshake"></i></button>
            `;
        } else if (f.status === 'PAGO') {
            acoesExtras += `<button onclick="estornarTitulo('${f.id}')" class="text-amber-500 hover:text-amber-700 dark:text-amber-400 p-1.5 ml-1 print:hidden" title="Estornar Pagamento"><i class="fa-solid fa-rotate-left"></i></button>`;
        }
        
        const vid = f.origemVendaId || f.idVenda;
        if (vid) {
            acoesExtras += `<button onclick="verDetalhesVenda('${vid}')" class="text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 p-1.5 ml-1 print:hidden" title="Ver Venda"><i class="fa-solid fa-receipt"></i></button>`;
        }"""

if target in content:
    with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
        f.write(content.replace(target, replacement))
    print('Success')
else:
    print('Could not find target exactly.')
