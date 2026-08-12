import os

filepath = r"g:\VERSOES DO SISTEMA\site sistema\financeiro.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("Este MÃªs", "Este Mês")
content = content.replace("PrÃ³ximos", "Próximos")
content = content.replace("HistÃ³rico", "Histórico")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
