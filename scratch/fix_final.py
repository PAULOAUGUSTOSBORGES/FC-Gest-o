import os

# Extract verDetalhesVenda from vendas_gestao.js
with open('sistema/vendas_gestao.js', 'r', encoding='latin1') as f:
    vendas_js = f.read()

start = vendas_js.find('function verDetalhesVenda')
if start == -1:
    start = vendas_js.find('window.verDetalhesVenda = function')

if start != -1:
    open_braces = 0
    in_function = False
    ver_detalhes_fn = ""
    for i in range(start, len(vendas_js)):
        if vendas_js[i] == '{':
            open_braces += 1
            in_function = True
        elif vendas_js[i] == '}':
            open_braces -= 1
        
        if in_function and open_braces == 0:
            ver_detalhes_fn = vendas_js[start:i+1]
            break

# Convert to window function
if ver_detalhes_fn.startswith('function verDetalhesVenda(id)'):
    ver_detalhes_fn = ver_detalhes_fn.replace('function verDetalhesVenda(id)', 'window.verDetalhesVenda = function(id)')

fechar_fn = '''
window.fecharModalDetalhesVenda = function() {
    document.getElementById('modal-detalhes-venda').classList.add('hidden');
};
'''

# Update financeiro.js
with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    fin_js = f.read()

target = '// ==========================================\n// VISAO DE VENDA DETALHADA (MODAL NATIVO)'
start_idx = fin_js.find(target)

if start_idx == -1:
    target = '// ==========================================\n// VISÃO DE VENDA DETALHADA'
    start_idx = fin_js.find(target)
    
if start_idx == -1:
    target = '// ==========================================\n// VISO DE VENDA DETALHADA'
    start_idx = fin_js.find(target)
    
if start_idx == -1:
    print('Could not find the target block in financeiro.js')
else:
    new_fin_js = fin_js[:start_idx] + '// ==========================================\n// VISAO DE VENDA DETALHADA (MODAL NATIVO)\n// ==========================================\n' + ver_detalhes_fn + '\n' + fechar_fn
    with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
        f.write(new_fin_js)
    print('financeiro.js restored successfully!')
