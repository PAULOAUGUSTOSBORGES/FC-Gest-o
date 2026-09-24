import os

# 1. Read vendas_gestao.html in UTF-8
with open('sistema/vendas_gestao.html', 'r', encoding='utf-8') as f:
    vendas_html = f.read()

start_marker = 'id="modal-detalhes-venda"'
start_pos = vendas_html.find(start_marker)
if start_pos == -1:
    print("ERROR: modal not found in vendas_gestao.html")
    exit(1)

# Find the <div that contains this id
div_start = vendas_html.rfind('<div', 0, start_pos)

# Count open/close div tags
div_count = 0
div_end = -1
for i in range(div_start, len(vendas_html)):
    if vendas_html[i:i+4] == '<div':
        div_count += 1
    elif vendas_html[i:i+6] == '</div>':
        div_count -= 1
        if div_count == 0:
            div_end = i + 6
            break

if div_end == -1:
    print("ERROR: could not find end of modal div")
    exit(1)

modal_html = vendas_html[div_start:div_end]
print(f"Modal extracted successfully! Length: {len(modal_html)} bytes.")

# 2. Read financeiro.html in UTF-8
with open('sistema/financeiro.html', 'r', encoding='utf-8') as f:
    fin_html = f.read()

# Verify if modal is already there
if 'id="modal-detalhes-venda"' in fin_html:
    print("Modal is already in financeiro.html!")
else:
    # Target location: right before the first script tag before </body>
    target = "<script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>"
    if target not in fin_html:
        # Fallback to </body>
        target = "</body>"
    
    if target in fin_html:
        new_fin_html = fin_html.replace(target, modal_html + "\n\n    " + target, 1)
        with open('sistema/financeiro.html', 'w', encoding='utf-8') as f:
            f.write(new_fin_html)
        print("Modal successfully inserted into financeiro.html!")
    else:
        print("ERROR: Target insertion point not found in financeiro.html")
