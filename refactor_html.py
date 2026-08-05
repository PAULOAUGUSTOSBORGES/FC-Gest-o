import re
import os

with open('gestao.html', 'r', encoding='utf8') as f:
    gest = f.read()

start_financeiro = gest.find('<!-- MÓDULO FINANCEIRO -->')
start_vendas = gest.find('<div id="view-vendas"')
start_compras = gest.find('<div id="view-compras"')
start_modal = gest.find('<!-- MODAL DETALHES DA VENDA -->')
if start_modal == -1:
    start_modal = gest.find('<div id="modal-detalhes-venda"')

part1 = gest[:start_financeiro]
part2 = gest[start_vendas:start_compras]
part3 = gest[start_modal:]

vendas_gest = part1 + part2 + part3
vendas_gest = vendas_gest.replace('id="view-vendas" class="view-section hidden', 'id="view-vendas" class="view-section')
vendas_gest = vendas_gest.replace('<script src="gestao.js"></script>', '<script src="vendas_gestao.js"></script>')
vendas_gest = vendas_gest.replace('id="header-title">Gestão</h2>', 'id="header-title">Histórico Vendas (Gestão)</h2>')
vendas_gest = vendas_gest.replace('<th class="p-3 text-center w-28 print:hidden">Ações</th>', '')

with open('vendas_gestao.html', 'w', encoding='utf8') as f:
    f.write(vendas_gest)

with open('operacao.html', 'r', encoding='utf8') as f:
    op = f.read()

start_pdv = op.find('<!-- ================== TELA DO PDV ================== -->')
start_vendas_op = op.find('<div id="view-vendas"')
start_orc = op.find('<!-- ================== TELA DE ORÇAMENTOS ================== -->')
start_modal_op = op.find('<!-- ================== MODAIS ================== -->')

part1_op = op[:start_pdv]
part2_op = op[start_vendas_op:start_orc]
part3_op = op[start_modal_op:]

vendas_op = part1_op + part2_op + part3_op
vendas_op = vendas_op.replace('id="view-vendas" class="view-section hidden', 'id="view-vendas" class="view-section')
vendas_op = vendas_op.replace('<script src="operacao.js"></script>', '<script src="vendas_operacao.js"></script>')
vendas_op = vendas_op.replace('id="header-title">Operação & Vendas</h2>', 'id="header-title">Histórico de Vendas</h2>')

with open('vendas_operacao.html', 'w', encoding='utf8') as f:
    f.write(vendas_op)

print("HTML pages created")
