import os
import re

file_path = r'g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\functions\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Injetar a definicao de empId e empresaRef logo apos https.onCall(async (data, context) => {
injection = """https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);"""

# Contar quantas vezes temos onCall para ter certeza de que injetamos certo
count_oncall = content.count("https.onCall(async (data, context) => {")
print(f"Encontrados {count_oncall} funcoes onCall.")

if "const empresaRef = db.collection('empresas')" not in content:
    content = content.replace("https.onCall(async (data, context) => {", injection)
else:
    print("Injecao ja realizada anteriormente.")

# 2. Substituir colecoes raiz pelas da subcolecao da empresa
# Colecoes a substituir: vendas, clientes, produtos, funcionarios, notas_devolucao, notas_avulsas, notas_servico, compras, fornecedores
collections = [
    'vendas', 'clientes', 'produtos', 'funcionarios', 
    'notas_devolucao', 'notas_avulsas', 'notas_servico', 
    'compras', 'fornecedores', 'caixa', 'movimentacoes', 
    'orcamentos', 'os', 'financeiro'
]

for col in collections:
    # Capturar db.collection('colecao') e db.collection("colecao")
    pattern = r'db\.collection\((["\'])' + col + r'\1\)'
    repl = r'empresaRef.collection(\1' + col + r'\1)'
    content = re.sub(pattern, repl, content)

# 3. Substituir fc_moveis por configuracoes
# Em global.js: getEmpresaRef().collection('configuracoes').doc('config')
content = re.sub(r'db\.collection\((["\'])fc_moveis\1\)', r'empresaRef.collection(\1configuracoes\1)', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Backend refatorado com sucesso!")
