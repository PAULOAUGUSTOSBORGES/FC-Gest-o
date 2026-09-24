with open('sistema/financeiro.html', 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

pos_baixa = text.find('id="modal-baixa-conta"')
print('--- MODAL BAIXA CONTA (First 400 chars) ---')
print(text[pos_baixa-50:pos_baixa+350].encode('ascii', errors='backslashreplace').decode('ascii'))

pos_det = text.find('id="modal-detalhes-venda"')
print('--- MODAL DETALHES VENDA (First 400 chars) ---')
print(text[pos_det-50:pos_det+350].encode('ascii', errors='backslashreplace').decode('ascii'))
