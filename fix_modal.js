const fs = require('fs');
let content = fs.readFileSync('sistema/financeiro.js', 'latin1');

const modalCode = 
// ==========================================
// VISÃO DE VENDA SIMPLIFICADA (VIA SWEETALERT)
// ==========================================
window.verDetalhesVenda = function(id) {
    if (!db || !db.vendas) {
        Swal.fire('Erro', 'Banco de dados de vendas n\u00e3o carregado.', 'error');
        return;
    }
    const v = db.vendas.find(x => String(x.id) === String(id));
    if (!v) {
        Swal.fire('Venda n\u00e3o encontrada', 'N\u00e3o foi poss\u00edvel localizar a venda origem.', 'info');
        return;
    }

    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const tipoTexto = v.tipo || 'VENDA';
    
    let itensHtml = (v.itens || []).map(i => {
        const preco = Number(i.preco) || 0;
        const qtd = Number(i.qtd) || 1;
        const subTot = preco * qtd;
        return \
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:4px 0; font-size:13px; text-align:left;">
            <div style="max-width:65%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <span style="font-weight:bold;">\x</span> \
            </div>
            <div>\</div>
        </div>\;
    }).join('');

    const html = \
    <div style="font-family:sans-serif; text-align:left; color:#333;" class="dark:text-slate-200">
        <p><strong>Cliente:</strong> \</p>
        <p><strong>Data:</strong> \ | #\</p>
        <p><strong>Tipo:</strong> \</p>
        <p><strong>Pagamento:</strong> \</p>
        <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;" />
        <p style="font-weight:bold; margin-bottom:5px;">Itens da Venda:</p>
        <div style="max-height:150px; overflow-y:auto; padding-right:5px;">
            \
        </div>
        <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;" />
        <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:900;">
            <span>TOTAL:</span>
            <span style="color:#10b981;">\</span>
        </div>
    </div>
    \;

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
};
;

content += '\n' + modalCode;
fs.writeFileSync('sistema/financeiro.js', content, 'latin1');
console.log("Adicionado com sucesso no final");
