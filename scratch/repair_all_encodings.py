import os, glob, re

# Comprehensive dictionary of string replacements
REPLACEMENTS = [
    # Mojibake arrow and control characters
    ('Origem \xc3\xa2\xe2\x80\xa0\xe2\x80\x99\xc2\x9d Destino'.encode('latin1').decode('utf-8', errors='ignore'), 'Origem → Destino'),
    ('ORIGEM \xc3\xa2\xe2\x80\xa0\xe2\x80\x99\xc2\x9d DESTINO'.encode('latin1').decode('utf-8', errors='ignore'), 'ORIGEM → DESTINO'),
    ('â†’\x9d', '→'),
    ('â†’', '→'),
    ('?\x9d', '→'),
    ('Â\xa0', ' '),
    ('Â', ''),

    # Double-encoded all-caps words
    ('GESTÃ£O', 'GESTÃO'),
    ('GestÃ£o', 'Gestão'),
    ('OPERAÃ§Ã£O', 'OPERAÇÃO'),
    ('OperaÃ§Ã£o', 'Operação'),
    ('ATENÃ§Ã£O', 'ATENÇÃO'),
    ('AtenÃ§Ã£o', 'Atenção'),
    ('CONFIGURAÃ§Ã£O', 'CONFIGURAÇÃO'),
    ('ConfiguraÃ§Ã£o', 'Configuração'),
    ('CONFIRMAÃ§Ã£O', 'CONFIRMAÇÃO'),
    ('ConfirmaÃ§Ã£o', 'Confirmação'),
    ('HISTÃ³RICO', 'HISTÓRICO'),
    ('HistÃ³rico', 'Histórico'),
    ('MOVIMENTAÃ§ÃµES', 'MOVIMENTAÇÕES'),
    ('MovimentaÃ§Ãµes', 'Movimentações'),
    ('RELATÃ³RIOS', 'RELATÓRIOS'),
    ('RelatÃ³rios', 'Relatórios'),
    ('CONTEÃºDO', 'CONTEÚDO'),
    ('ConteÃºdo', 'Conteúdo'),
    ('DESCRIÃ§Ã£O', 'DESCRIÇÃO'),
    ('DescriÃ§Ã£o', 'Descrição'),
    ('SITUAÃ§Ã£O', 'SITUAÇÃO'),
    ('SituaÃ§Ã£o', 'Situação'),
    ('OBSERVAÃ§Ã£O', 'OBSERVAÇÃO'),
    ('ObservaÃ§Ã£o', 'Observação'),
    ('ObservAçãoo', 'Observação'),
    ('Observaçãoo', 'Observação'),
    ('observaçãoo', 'observação'),
    ('AÃ§Ãµes', 'Ações'),
    ('AÃ§Ã£o', 'Ação'),

    # Lowercase mojibake
    ('Ã¡', 'á'), ('Ã\xa0', 'à'), ('Ã¢', 'â'), ('Ã£', 'ã'),
    ('Ã©', 'é'), ('Ãª', 'ê'), ('Ã\xad', 'í'), ('Ã³', 'ó'),
    ('Ã´', 'ô'), ('Ãµ', 'õ'), ('Ãº', 'ú'), ('Ã§', 'ç'),

    # Uppercase mojibake
    ('Ã\x81', 'Á'), ('Ã\x80', 'À'), ('Ã\x82', 'Â'), ('Ã\x83', 'Ã'),
    ('Ã\x89', 'É'), ('Ã\x8a', 'Ê'), ('Ã\x8d', 'Í'), ('Ã\x93', 'Ó'),
    ('Ã\x94', 'Ô'), ('Ã\x95', 'Õ'), ('Ã\x9a', 'Ú'), ('Ã\x87', 'Ç'),

    # Double oo suffixes
    ('açãoo', 'ação'), ('Açãoo', 'Ação'),
    ('AÇÃOo', 'AÇÃO'), ('AÇÃOO', 'AÇÃO'),
    ('açõeso', 'ações'), ('Açõeso', 'Ações'),
    ('AÇÕESo', 'AÇÕES'), ('AÇÕESO', 'AÇÕES'),
    ('Finalizaçãoo', 'Finalização'), ('finalizaçãoo', 'finalização'),
    ('Conciliaçãoo', 'Conciliação'), ('conciliaçãoo', 'conciliação'),
    ('Composiçãoo', 'Composição'), ('composiçãoo', 'composição'),
    ('Movimentaçãoo', 'Movimentação'), ('movimentaçãoo', 'movimentação'),
    ('Reduçãoo', 'Redução'), ('reduçãoo', 'redução'),
    ('Situaçãoo', 'Situação'), ('situaçãoo', 'situação'),
    ('Operaçãoo', 'Operação'), ('operaçãoo', 'operação'),
    ('Atençãoo', 'Atenção'), ('atençãoo', 'atenção'),
    ('Descriçãoo', 'Descrição'), ('descriçãoo', 'descrição'),
    ('Configuraçãoo', 'Configuração'), ('configuraçãoo', 'configuração'),
    ('Autorizaçãoo', 'Autorização'), ('autorizaçãoo', 'autorização'),
    ('Prestaçãão', 'Prestação'), ('Prestaçãoo', 'Prestação'),

    # Words with literal replacement character or stripped accents
    ('Histrico', 'Histórico'), ('histrico', 'histórico'),
    ('Gesto', 'Gestão'), ('gesto', 'gestão'),
    ('Movimentaes', 'Movimentações'), ('movimentaes', 'movimentações'),
    ('Movimenta', 'Movimentaç'), ('movimenta', 'movimentaç'),
    ('Operaes', 'Operações'), ('operaes', 'operações'),
    ('Opera', 'Operaç'), ('opera', 'operaç'),
    ('Configuraes', 'Configurações'), ('configuraes', 'configurações'),
    ('Configura', 'Configuraç'), ('configura', 'configuraç'),
    ('Relatrios', 'Relatórios'), ('relatrios', 'relatórios'),
    ('Relatrio', 'Relatório'), ('relatrio', 'relatório'),
    ('Pginas', 'Páginas'), ('pginas', 'páginas'),
    ('Calendrio', 'Calendário'), ('calendrio', 'calendário'),
    ('Incio', 'Início'), ('incio', 'início'),
    ('Aes', 'Ações'), ('aes', 'ações'),
    ('Ao', 'Ação'), ('ao', 'ação'),
    ('Prestao', 'Prestação'), ('prestao', 'prestação'),
    ('Servios', 'Serviços'), ('servios', 'serviços'),
    ('Servio', 'Serviço'), ('servio', 'serviço'),
    ('Endereo', 'Endereço'), ('endereo', 'endereço'),
    ('Observaes', 'Observações'), ('observaes', 'observações'),
    ('Observao', 'Observação'), ('observao', 'observação'),
    ('Condies', 'Condições'), ('condies', 'condições'),
    ('Oramentos', 'Orçamentos'), ('oramentos', 'orçamentos'),
    ('Oramento', 'Orçamento'), ('oramento', 'orçamento'),
    ('Funcionrios', 'Funcionários'), ('funcionrios', 'funcionários'),
    ('Funcionrio', 'Funcionário'), ('funcionrio', 'funcionário'),
    ('Avanados', 'Avançados'), ('avanados', 'avançados'),
    ('Avanado', 'Avançado'), ('avanado', 'avançado'),
    ('Notificaes', 'Notificações'), ('notificaes', 'notificações'),
    ('Promoes', 'Promoções'), ('promoes', 'promoções'),
    ('Usurio', 'Usuário'), ('usurio', 'usuário'),
    ('Horrio', 'Horário'), ('horrio', 'horário'),
    ('Salrio', 'Salário'), ('salrio', 'salário'),
    ('Fsico', 'Físico'), ('fsico', 'físico'),
    ('Bancrio', 'Bancário'), ('bancrio', 'bancário'),
    ('Bancria', 'Bancária'), ('bancria', 'bancária'),
    ('Ateno', 'Atenção'), ('ateno', 'atenção'),
    ('Descrio', 'Descrição'), ('descrio', 'descrição'),
    ('Situao', 'Situação'), ('situao', 'situação'),
    ('Finalizao', 'Finalização'), ('finalizao', 'finalização'),
]

total_files = 0
total_changes = 0

for root, dirs, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root or 'scratch' in root:
        continue
    for f in files:
        if f.endswith(('.html', '.js')):
            fpath = os.path.join(root, f)
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                content = fp.read()
            original = content
            for old, new in REPLACEMENTS:
                content = content.replace(old, new)
            if content != original:
                total_files += 1
                total_changes += (len(original) - len(content)) # rough indicator
                with open(fpath, 'w', encoding='utf-8') as fp:
                    fp.write(content)
                print(f'Fixed: {fpath}')

print(f'Done! Fixed {total_files} files.')