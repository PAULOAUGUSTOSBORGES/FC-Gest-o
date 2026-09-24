import os

with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    content = f.read()

modal_code = """
// ==========================================
// VISÃO DE VENDA SIMPLIFICADA (VIA SWEETALERT)
// ==========================================
window.verDetalhesVenda = function(id) {
    if (!db || !db.vendas) {
        if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Banco de dados de vendas não carregado.', 'error');
        else alert('Banco de dados de vendas não carregado.');
        return;
    }
    const v = db.vendas.find(x => String(x.id) === String(id));
    if (!v) {
        if (typeof Swal !== 'undefined') Swal.fire('Venda não encontrada', 'Não foi possível localizar a venda origem.', 'info');
        else alert('Não foi possível localizar a venda origem.');
        return;
    }

    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const tipoTexto = v.tipo || 'VENDA';
    
    let itensHtml = (v.itens || []).map(i => {
        const preco = Number(i.preco) || 0;
        const qtd = Number(i.qtd) || 1;
        const subTot = preco * qtd;
        return `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:4px 0; font-size:13px; text-align:left;">
            <div style="max-width:65%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <span style="font-weight:bold;">${qtd}x</span> ${i.nome || i.produto || 'Item'}
            </div>
            <div>${formatMoney(subTot)}</div>
        </div>`;
    }).join('');

    const html = `
    <div style="font-family:sans-serif; text-align:left; color:#333;" class="dark:text-slate-200">
        <p><strong>Cliente:</strong> ${v.clienteNome || 'Desconhecido'}</p>
        <p><strong>Data:</strong> ${v.data ? formatData(v.data).split(' ')[0] : '-'} | #${numPedStr}</p>
        <p><strong>Tipo:</strong> ${tipoTexto}</p>
        <p><strong>Pagamento:</strong> ${v.pag || '-'}</p>
        <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;" />
        <p style="font-weight:bold; margin-bottom:5px;">Itens da Venda:</p>
        <div style="max-height:150px; overflow-y:auto; padding-right:5px;">
            ${itensHtml}
        </div>
        <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;" />
        <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:900;">
            <span>TOTAL:</span>
            <span style="color:#10b981;">${formatMoney(v.total || v.valor || 0)}</span>
        </div>
    </div>
    `;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Resumo da Venda',
            html: html,
            icon: 'info',
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#3b82f6',
            customClass: {
                popup: 'dark:bg-slate-800 dark:text-slate-200'
            }
        });
    } else {
        alert("Cliente: " + (v.clienteNome || 'Desconhecido') + "\\nTotal: " + formatMoney(v.total || v.valor || 0));
    }
};
"""

if 'window.verDetalhesVenda =' not in content:
    content += '\n' + modal_code
    with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
        f.write(content)
    print("Adicionado com sucesso!")
else:
    print("Já existe!")
