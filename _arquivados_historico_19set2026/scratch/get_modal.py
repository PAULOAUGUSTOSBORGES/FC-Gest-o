with open('sistema/vendas_gestao.html', 'r', encoding='latin1') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'id="modal-detalhes-venda"' in line:
        start = i
        break
else:
    start = -1

if start != -1:
    end = start
    open_divs = 0
    for i in range(start, len(lines)):
        open_divs += lines[i].count('<div')
        open_divs -= lines[i].count('</div')
        if open_divs <= 0 and i > start:
            end = i
            break
    print(''.join(lines[start:end+1]))
