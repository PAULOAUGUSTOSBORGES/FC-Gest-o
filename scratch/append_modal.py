import os

with open('scratch/modal_html.txt', 'r', encoding='latin1') as f:
    modal_html = f.read()

with open('sistema/financeiro.html', 'a', encoding='latin1') as f:
    f.write('\n\n' + modal_html + '\n')

print("Modal appended to financeiro.html")
