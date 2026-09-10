import os

BYTE_REPLACEMENTS = [
    # 1. Image 3 / arrows and control chars
    (b'Origem \xc3\xa2\xe2\x80\xa0\xe2\x80\x99\xc2\x9d Destino', 'Origem → Destino'.encode('utf-8')),
    (b'ORIGEM \xc3\xa2\xe2\x80\xa0\xe2\x80\x99\xc2\x9d DESTINO', 'ORIGEM → DESTINO'.encode('utf-8')),
    (b'Origem \xc3\xa2\xe2\x80\xa0\xe2\x80\x99 Destino', 'Origem → Destino'.encode('utf-8')),
    (b'ORIGEM \xc3\xa2\xe2\x80\xa0\xe2\x80\x99 DESTINO', 'ORIGEM → DESTINO'.encode('utf-8')),
    (b'\xc3\xa2\xe2\x80\xa0\xe2\x80\x99\xc2\x9d', '→'.encode('utf-8')),
    (b'\xc3\xa2\xe2\x80\xa0\xe2\x80\x99', '→'.encode('utf-8')),
    (b'?\xc2\x9d', '→'.encode('utf-8')),
    (b'\xc2\x9d', b''),

    # 2. All-caps words with mojibake
    (b'GEST\xc3\x83\xc2\xa3O', 'GESTÃO'.encode('utf-8')),
    (b'GEST\xc3\xa3O', 'GESTÃO'.encode('utf-8')),
    (b'Gest\xc3\x83\xc2\xa3o', 'Gestão'.encode('utf-8')),
    (b'HIST\xc3\x83\xc2\xb3RICO', 'HISTÓRICO'.encode('utf-8')),
    (b'Hist\xc3\x83\xc2\xb3rico', 'Histórico'.encode('utf-8')),
    (b'MOVIMENTA\xc3\x83\xc2\x87\xc3\x83\xc2\x95ES', 'MOVIMENTAÇÕES'.encode('utf-8')),
    (b'MOVIMENTA\xc3\x83\xc2\xa7\xc3\x83\xc2\xb5ES', 'MOVIMENTAÇÕES'.encode('utf-8')),
    (b'Movimenta\xc3\x83\xc2\xa7\xc3\x83\xc2\xb5es', 'Movimentações'.encode('utf-8')),
    (b'OPERA\xc3\x83\xc2\x87\xc3\x83\xc2\x83O', 'OPERAÇÃO'.encode('utf-8')),
    (b'OPERA\xc3\x83\xc2\xa7\xc3\x83\xc2\xa3O', 'OPERAÇÃO'.encode('utf-8')),
    (b'Opera\xc3\x83\xc2\xa7\xc3\x83\xc2\xa3o', 'Operação'.encode('utf-8')),
    (b'RELAT\xc3\x83\xc2\xb3RIOS', 'RELATÓRIOS'.encode('utf-8')),
    (b'Relat\xc3\x83\xc2\xb3rios', 'Relatórios'.encode('utf-8')),
    (b'ATEN\xc3\x83\xc2\x87\xc3\x83\xc2\x83O', 'ATENÇÃO'.encode('utf-8')),
    (b'ATEN\xc3\x83\xc2\xa7\xc3\x83\xc2\xa3O', 'ATENÇÃO'.encode('utf-8')),
    (b'Aten\xc3\x83\xc2\xa7\xc3\x83\xc2\xa3o', 'Atenção'.encode('utf-8')),
    (b'CONFIGURA\xc3\x83\xc2\x87\xc3\x83\xc2\x95ES', 'CONFIGURAÇÕES'.encode('utf-8')),
    (b'Configura\xc3\x83\xc2\xa7\xc3\x83\xc2\xb5es', 'Configurações'.encode('utf-8')),
    (b'CONFIRMA\xc3\x83\xc2\x87\xc3\x83\xc2\x83O', 'CONFIRMAÇÃO'.encode('utf-8')),
    (b'Confirma\xc3\x83\xc2\xa7\xc3\x83\xc2\xa3o', 'Confirmação'.encode('utf-8')),
    (b'CONTE\xc3\x83\xc2\xbaDO', 'CONTEÚDO'.encode('utf-8')),
    (b'Conte\xc3\x83\xc2\xbado', 'Conteúdo'.encode('utf-8')),

    # 3. Lowercase double UTF-8
    (b'\xc3\x83\xc2\xa1', 'á'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa0', 'à'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa2', 'â'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa3', 'ã'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa9', 'é'.encode('utf-8')),
    (b'\xc3\x83\xc2\xaa', 'ê'.encode('utf-8')),
    (b'\xc3\x83\xc2\xad', 'í'.encode('utf-8')),
    (b'\xc3\x83\xc2\xb3', 'ó'.encode('utf-8')),
    (b'\xc3\x83\xc2\xb4', 'ô'.encode('utf-8')),
    (b'\xc3\x83\xc2\xb5', 'õ'.encode('utf-8')),
    (b'\xc3\x83\xc2\xba', 'ú'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa7', 'ç'.encode('utf-8')),

    # 4. Uppercase double UTF-8
    (b'\xc3\x83\xc2\x81', 'Á'.encode('utf-8')),
    (b'\xc3\x83\xc2\x80', 'À'.encode('utf-8')),
    (b'\xc3\x83\xc2\x82', 'Â'.encode('utf-8')),
    (b'\xc3\x83\xc2\x83', 'Ã'.encode('utf-8')),
    (b'\xc3\x83\xc2\x89', 'É'.encode('utf-8')),
    (b'\xc3\x83\xc2\x8a', 'Ê'.encode('utf-8')),
    (b'\xc3\x83\xc2\x8d', 'Í'.encode('utf-8')),
    (b'\xc3\x83\xc2\x93', 'Ó'.encode('utf-8')),
    (b'\xc3\x83\xc2\x94', 'Ô'.encode('utf-8')),
    (b'\xc3\x83\xc2\x95', 'Õ'.encode('utf-8')),
    (b'\xc3\x83\xc2\x9a', 'Ú'.encode('utf-8')),
    (b'\xc3\x83\xc2\x87', 'Ç'.encode('utf-8')),
    (b'\xc3\x83\xc5\xa0', 'Ê'.encode('utf-8')),
    (b'\xc3\x83\xc5\xa1', 'É'.encode('utf-8')),

    # 5. Fix double oo / typos
    (b'ObservA\xc3\xa7\xc3\xa3oo', 'Observação'.encode('utf-8')),
    (b'ObservA\xc3\xa7\xc3\xa3o', 'Observação'.encode('utf-8')),
    (b'Observa\xc3\xa7\xc3\xa3oo', 'Observação'.encode('utf-8')),
    (b'observa\xc3\xa7\xc3\xa3oo', 'observação'.encode('utf-8')),
    (b'Finaliza\xc3\xa7\xc3\xa3oo', 'Finalização'.encode('utf-8')),
    (b'finaliza\xc3\xa7\xc3\xa3oo', 'finalização'.encode('utf-8')),
    (b'Concilia\xc3\xa7\xc3\xa3oo', 'Conciliação'.encode('utf-8')),
    (b'concilia\xc3\xa7\xc3\xa3oo', 'conciliação'.encode('utf-8')),
    (b'Composi\xc3\xa7\xc3\xa3oo', 'Composição'.encode('utf-8')),
    (b'composi\xc3\xa7\xc3\xa3oo', 'composição'.encode('utf-8')),
    (b'Movimenta\xc3\xa7\xc3\xa3oo', 'Movimentação'.encode('utf-8')),
    (b'movimenta\xc3\xa7\xc3\xa3oo', 'movimentação'.encode('utf-8')),
    (b'Redu\xc3\xa7\xc3\xa3oo', 'Redução'.encode('utf-8')),
    (b'redu\xc3\xa7\xc3\xa3oo', 'redução'.encode('utf-8')),
    (b'Situa\xc3\xa7\xc3\xa3oo', 'Situação'.encode('utf-8')),
    (b'situa\xc3\xa7\xc3\xa3oo', 'situação'.encode('utf-8')),
    (b'Opera\xc3\xa7\xc3\xa3oo', 'Operação'.encode('utf-8')),
    (b'opera\xc3\xa7\xc3\xa3oo', 'operação'.encode('utf-8')),
    (b'Aten\xc3\xa7\xc3\xa3oo', 'Atenção'.encode('utf-8')),
    (b'aten\xc3\xa7\xc3\xa3oo', 'atenção'.encode('utf-8')),
    (b'Descri\xc3\xa7\xc3\xa3oo', 'Descrição'.encode('utf-8')),
    (b'descri\xc3\xa7\xc3\xa3oo', 'descrição'.encode('utf-8')),
    (b'Configura\xc3\xa7\xc3\xa3oo', 'Configuração'.encode('utf-8')),
    (b'configura\xc3\xa7\xc3\xa3oo', 'configuração'.encode('utf-8')),
    (b'Autoriza\xc3\xa7\xc3\xa3oo', 'Autorização'.encode('utf-8')),
    (b'autoriza\xc3\xa7\xc3\xa3oo', 'autorização'.encode('utf-8')),
    (b'Presta\xc3\xa7\xc3\xa3oo', 'Prestação'.encode('utf-8')),
    (b'presta\xc3\xa7\xc3\xa3oo', 'prestação'.encode('utf-8')),
    (b'Reposi\xc3\xa7\xc3\xa3oo', 'Reposição'.encode('utf-8')),
    (b'reposi\xc3\xa7\xc3\xa3oo', 'reposição'.encode('utf-8')),
    (b'A\xc3\xa7\xc3\xa3oo', 'Ação'.encode('utf-8')),
    (b'a\xc3\xa7\xc3\xa3oo', 'ação'.encode('utf-8')),
    (b'A\xc3\xa7\xc3\xb5eso', 'Ações'.encode('utf-8')),
    (b'a\xc3\xa7\xc3\xb5eso', 'ações'.encode('utf-8')),
]

files = []
for root, dirs, fnames in os.walk('.'):
    if '.git' in root or 'node_modules' in root or 'scratch' in root:
        continue
    for fn in fnames:
        if fn.endswith(('.html', '.js')):
            files.append(os.path.join(root, fn))

modified = 0
for fpath in files:
    with open(fpath, 'rb') as fp:
        data = fp.read()
    orig = data
    for b_old, b_new in BYTE_REPLACEMENTS:
        data = data.replace(b_old, b_new)
    if data != orig:
        with open(fpath, 'wb') as fp:
            fp.write(data)
        modified += 1
        print(f"Cleaned: {fpath}")

print(f"Completed! Cleaned {modified} files.")
