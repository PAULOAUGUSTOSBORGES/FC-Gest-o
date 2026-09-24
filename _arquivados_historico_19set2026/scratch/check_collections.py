import os
import re
import glob

valid_collections = {
    'produtos', 'clientes', 'fornecedores', 'vendas', 'movimentacoes',
    'financeiro', 'compras', 'funcionarios', 'fc_moveis', 'marketing_historico',
    'relatorios_ia_historico', 'orcamentos', 'caixa', 'config', 'config_loja',
    'banco_principal', 'historico'
}

js_files = glob.glob("sistema/*.js") + glob.glob("*.js")
issues = []

for f in js_files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        txt = fp.read()
    for m in re.finditer(r'(collection|_listen|_listenDoc)\([\'\"]([^\'\"]+)[\'\"]', txt):
        col = m.group(2)
        if any(ord(c) > 127 for c in col):
            issues.append((f, m.group(0)))

print(f"Total accented collection calls: {len(issues)}")
for f, call in issues:
    print(f"  {f}: {call}")
