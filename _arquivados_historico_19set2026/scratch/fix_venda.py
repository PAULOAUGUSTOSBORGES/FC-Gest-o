import re

with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    content = f.read()

target = '''// ==========================================
// VISÃO DE VENDA SIMPLIFICADA (VIA SWEETALERT)'''
start_idx = content.find(target)

if start_idx == -1:
    target = '''// ==========================================
// VISO DE VENDA SIMPLIFICADA (VIA SWEETALERT)'''
    start_idx = content.find(target)

if start_idx == -1:
    target = '''// ==========================================
// VIS\xc3\x83O DE VENDA SIMPLIFICADA (VIA SWEETALERT)'''
    start_idx = content.find(target)

if start_idx == -1:
    # Use regex
    match = re.search(r'// ==========================================\n// VIS[^O]+O DE VENDA SIMPLIFICADA \(VIA SWEETALERT\)', content)
    if match:
        start_idx = match.start()

if start_idx == -1:
    print('Could not find target block.')
else:
    new_content = content[:start_idx] + '''// ==========================================
// VISÃO DE VENDA DETALHADA (VIA SWEETALERT)
// ==========================================
window.verDetalhesVenda = function(id) {
    if (!db || !db.vendas) {
        if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Banco de dados de vendas não carregado.', 'error');
        else alert('Banco de dados de vendas não carregado.');
        return;
    }
    const v = db.vendas.find(x => String(x.id) === String(id) || String(x.idVenda) === String(id) || String(x.origemVendaId) === String(id));
    if (!v) {
        if (typeof Swal !== 'undefined') Swal.fire('Venda não encontrada', 'Não foi possível localizar a venda origem.', 'info');
        else alert('Não foi possível localizar a venda origem.');
        return;
    }

    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    const tipoTexto = v.tipo || 'VENDA';
    const subtotal = Number(v.subtotal || v.valor || v.total || 0);
    const desconto = Number(v.desconto || 0);
    const totalVenda = Number(v.total || v.valor || 0);
    const frete = Number(v.frete || 0);
    const acrescimo = Number(v.acrescimo || 0);
    
    let itensHtml = (v.itens || []).map(i => {
        const preco = Number(i.preco || i.valorUnitario || i.valor || 0);
        const qtd = Number(i.qtd || i.quantidade || 1);
        const subTot = preco * qtd;
        return `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding:6px 0; font-size:13px; text-align:left;">
            <div style="max-width:70%; word-break:break-word;">
                <span style="font-weight:bold; color:#3b82f6;">${qtd}x</span> ${i.nome || i.produto || i.descricao || 'Item'}
                <div style="font-size:11px; color:#64748b;">Unidade: ${formatMoney(preco)}</div>
            </div>
            <div style="font-weight:600; padding-top:2px;">${formatMoney(subTot)}</div>
        </div>`;
    }).join('');

    const html = `
    <div style="font-family:sans-serif; text-align:left; color:#334155; font-size:14px;" class="dark:text-slate-300">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px; font-size:13px;">
            <div>
                <p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Cliente</p>
                <p style="margin:0; font-weight:600;">${v.clienteNome || v.cliente || 'Desconhecido'}</p>
            </div>
            <div>
                <p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Data / Pedido</p>
                <p style="margin:0; font-weight:600;">${v.data ? formatData(v.data).split(' ')[0] : '-'} <span style="color:#94a3b8">| #${numPedStr}</span></p>
            </div>
            <div>
                <p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Pagamento</p>
                <p style="margin:0; font-weight:600;">${v.pag || v.formaPagamento || '-'}</p>
            </div>
            <div>
                <p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Vendedor</p>
                <p style="margin:0; font-weight:600;">${v.vendedor || v.usuario || '-'}</p>
            </div>
        </div>
        
        <p style="font-weight:700; margin:15px 0 5px 0; font-size:13px; color:#475569; text-transform:uppercase; border-bottom:2px solid #e2e8f0; padding-bottom:4px;">Itens da ${tipoTexto}:</p>
        <div style="max-height:220px; overflow-y:auto; padding-right:5px; margin-bottom:10px;" class="custom-scrollbar">
            ${itensHtml || '<div style="padding:10px 0; text-align:center; color:#94a3b8; font-style:italic;">Nenhum item detalhado</div>'}
        </div>
        
        <div style="background-color:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;" class="dark:bg-slate-800 dark:border-slate-700">
            ${desconto > 0 ? \`<div style="display:flex; justify-content:space-between; font-size:13px; color:#64748b; margin-bottom:4px;"><span>Subtotal:</span> <span>\${formatMoney(subtotal)}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:13px; color:#ef4444; margin-bottom:4px;"><span>Desconto:</span> <span>-\${formatMoney(desconto)}</span></div>\` : ''}
            ${frete > 0 ? \`<div style="display:flex; justify-content:space-between; font-size:13px; color:#64748b; margin-bottom:4px;"><span>Frete:</span> <span>+\${formatMoney(frete)}</span></div>\` : ''}
            ${acrescimo > 0 ? \`<div style="display:flex; justify-content:space-between; font-size:13px; color:#64748b; margin-bottom:4px;"><span>Acréscimo:</span> <span>+\${formatMoney(acrescimo)}</span></div>\` : ''}
            
            <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:900; margin-top:6px; padding-top:6px; border-top:1px dashed #cbd5e1;">
                <span style="color:#334155;" class="dark:text-slate-200">TOTAL:</span>
                <span style="color:#10b981;">${formatMoney(totalVenda)}</span>
            </div>
        </div>
    </div>
    `;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: \`<div style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-receipt" style="color:#3b82f6;"></i> Detalhes da Operação</div>\`,
            html: html,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#3b82f6',
            width: '450px',
            customClass: {
                popup: 'dark:bg-slate-900 dark:text-slate-200 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800',
                title: 'text-left text-lg font-black text-slate-800 dark:text-white m-0 p-0 mb-2',
                htmlContainer: 'text-left m-0 p-0'
            }
        });
    } else {
        alert("Cliente: " + (v.clienteNome || v.cliente || 'Desconhecido') + "\\nTotal: " + formatMoney(totalVenda));
    }
};
'''
    with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
        f.write(new_content)
    print('Success!')
