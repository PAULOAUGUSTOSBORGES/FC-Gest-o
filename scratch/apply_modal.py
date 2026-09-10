import re

# 1. Append modal to financeiro.html
with open('scratch/modal_html.txt', 'r', encoding='latin1') as f:
    modal_html = f.read()

with open('sistema/financeiro.html', 'r', encoding='latin1') as f:
    fin_html = f.read()

if 'id="modal-detalhes-venda"' not in fin_html:
    # insert before </body>
    fin_html = fin_html.replace('</body>', modal_html + '\n</body>')
    with open('sistema/financeiro.html', 'w', encoding='latin1') as f:
        f.write(fin_html)
    print("Modal injected into financeiro.html.")

# 2. Update financeiro.js verDetalhesVenda function
with open('scratch/ver_detalhes_venda_fn.txt', 'r', encoding='latin1') as f:
    ver_detalhes_fn = f.read()

# Make it window.verDetalhesVenda
if ver_detalhes_fn.startswith('function verDetalhesVenda'):
    ver_detalhes_fn = ver_detalhes_fn.replace('function verDetalhesVenda(id)', 'window.verDetalhesVenda = function(id)')

# We also need fecharModalDetalhesVenda
fechar_fn = '''
window.fecharModalDetalhesVenda = function() {
    document.getElementById('modal-detalhes-venda').classList.add('hidden');
};
'''

with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    fin_js = f.read()

target = '''// ==========================================
// VISÃO DE VENDA DETALHADA (VIA SWEETALERT)
// =========================================='''
start_idx = fin_js.find(target)
if start_idx == -1:
    target = '''// ==========================================
// VIS\xc3\x83O DE VENDA DETALHADA (VIA SWEETALERT)'''
    start_idx = fin_js.find(target)

if start_idx != -1:
    new_fin_js = fin_js[:start_idx] + '// ==========================================\n// VISAO DE VENDA DETALHADA (MODAL NATIVO)\n// ==========================================\n' + ver_detalhes_fn + '\n' + fechar_fn
    with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
        f.write(new_fin_js)
    print("financeiro.js updated successfully.")
else:
    print("Could not find the target block in financeiro.js to replace.")
