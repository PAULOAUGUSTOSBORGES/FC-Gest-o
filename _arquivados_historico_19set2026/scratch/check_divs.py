with open('sistema/financeiro.html', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('id="modal-detalhes-venda"')
div_start = text.rfind('<div', 0, pos)
sub = text[:div_start]
open_divs = sub.count('<div') - sub.count('</div')
print('Unclosed divs before modal:', open_divs)
