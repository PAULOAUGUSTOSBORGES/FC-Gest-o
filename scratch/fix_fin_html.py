import os

# 1. Clean financeiro.html
with open('sistema/financeiro.html', 'r', encoding='latin1') as f:
    fin_content = f.read()

# Find the start of the injected modal. 
# It starts with 'id="modal-detalhes-venda"' but maybe with spaces.
# Let's find the last occurrences of valid HTML.
# The original end of financeiro.html was probably something else.
# Let's just find the first occurrence of the corrupted string or the actual modal ID.
idx1 = fin_html_clean = fin_content.find('< d i v   i d = " m o d a l - d e t a l h e s - v e n d a "')
if idx1 != -1:
    fin_content = fin_content[:idx1]
    
# Or maybe it has null bytes.
idx2 = fin_content.find('id="\x00m\x00o\x00d\x00a\x00l\x00')
if idx2 != -1:
    fin_content = fin_content[:idx2]

# There could also be the original modal_detalhes_venda string if the encoding wasn't exactly that.
idx3 = fin_content.find('<div id="modal-detalhes-venda"')
if idx3 != -1:
    fin_content = fin_content[:idx3]

# Strip trailing whitespaces
fin_content = fin_content.rstrip()

# 2. Extract cleanly from vendas_gestao.html
with open('sistema/vendas_gestao.html', 'r', encoding='utf-8') as f:
    vendas_html = f.read()

start = vendas_html.find('<div id="modal-detalhes-venda"')
if start != -1:
    open_divs = 0
    end = start
    # Iterate through looking for tags to count open and close
    i = start
    while i < len(vendas_html):
        if vendas_html[i:i+4] == '<div':
            open_divs += 1
        elif vendas_html[i:i+6] == '</div>':
            open_divs -= 1
            if open_divs == 0:
                end = i + 6
                break
        i += 1
        
    modal_clean = vendas_html[start:end]
else:
    modal_clean = ""

# 3. Append cleanly
fin_content = fin_content + '\n\n' + modal_clean + '\n'

with open('sistema/financeiro.html', 'w', encoding='utf-8') as f:
    f.write(fin_content)

print("Financeiro HTML fixed and modal appended cleanly.")
