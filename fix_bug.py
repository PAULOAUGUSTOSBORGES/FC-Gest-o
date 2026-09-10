import os

with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    content = f.read()

old_str = "    document.getElementById(`tabela-fin-${prefix}`).innerHTML = lista.map(f => {"
new_str = """    let totalExibido = 0;
    let htmlLinhas = lista.map(f => {
        let valorParaTotal = Number(f.valor) || 0;
        if (f.status === 'PAGO') {
            valorParaTotal = Number(f.valorPago) || Number(f.valor) || 0;
        } else {
            const c = calcularJurosMulta(f);
            if(c.diasAtraso > 0 && (c.multa > 0 || c.juros > 0)) {
                valorParaTotal = Number(c.valorAtualizado) || 0;
            }
        }
        totalExibido += valorParaTotal;"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('sistema/financeiro.js', 'w', encoding='latin1') as f:
        f.write(content)
    print("Substituído com sucesso!")
else:
    print("String antiga não encontrada!")
