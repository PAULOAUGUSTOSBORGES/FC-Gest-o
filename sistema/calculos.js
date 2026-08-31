// ==========================================
// FC-Gestão - Módulo de Cálculos Globais
// Centralização de regras de negócio matemáticas
// ==========================================

const Calculos = {
    /**
     * Calcula o valor da parcela com juros compostos ou simples, 
     * baseado no parcelamento e na tabela de taxas globais.
     */
    calcularParcelaCartao: function (valorBase, numParcelas, tabelaTaxas) {
        if (!valorBase || valorBase <= 0) return 0;
        if (!numParcelas || numParcelas < 1) return valorBase;
        if (!tabelaTaxas) return valorBase / numParcelas;

        const taxa = tabelaTaxas[numParcelas] || 0;
        const valorFinal = valorBase + (valorBase * (taxa / 100));
        return (valorFinal / numParcelas).toFixed(2);
    },

    /**
     * Calcula o Lucro de uma Venda (Valor de Venda - Custo dos Produtos)
     */
    calcularLucroDaVenda: function(venda) {
        if (!venda || !venda.itens) return 0;
        let custoTotal = 0;
        venda.itens.forEach(item => {
            let custoUnitario = parseInputMoney(item.custo) || 0;
            custoTotal += (custoUnitario * item.qtd);
        });
        
        let valorFinal = parseInputMoney(venda.tot || venda.valorLiquido) || 0;
        return valorFinal - custoTotal;
    },

    /**
     * Calcula Juros e Multa por Atraso de um Título Financeiro
     */
    calcularJurosMultaAtraso: function(titulo, taxaJurosAoDia = 0.033, multaFixa = 2.00) {
        if (!titulo || !titulo.vencimento) return { diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: titulo.valor };
        if (titulo.status === 'PAGO' || titulo.status === 'CANCELADO') {
            return { diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: titulo.valor };
        }

        const dataVenc = new Date(titulo.vencimento + 'T00:00:00');
        const dataHoje = new Date();
        dataHoje.setHours(0,0,0,0);
        
        let juros = 0, multa = 0, diasAtraso = 0;
        const valorBase = parseInputMoney(titulo.valor) || 0;

        if (dataHoje > dataVenc) {
            const diffTime = Math.abs(dataHoje - dataVenc);
            diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            multa = valorBase * (multaFixa / 100);
            juros = valorBase * (taxaJurosAoDia / 100) * diasAtraso;
        }

        return {
            diasAtraso,
            multa: parseInputMoney(multa.toFixed(2)),
            juros: parseInputMoney(juros.toFixed(2)),
            valorAtualizado: parseInputMoney((valorBase + multa + juros).toFixed(2))
        };
    }
};

window.Calculos = Calculos;
