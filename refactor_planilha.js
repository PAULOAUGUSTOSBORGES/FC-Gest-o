const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'sistema');
const files = fs.readdirSync(dir);

const newBaixar = `function baixarPlanilhaModeloProduto() {
    const cabecalho = "Nome do Produto;EAN (Codigo de Barras);Categoria;Custo;Preco de Venda;Estoque Atual\\n";
    const exemplo1 = "Mesa de Jantar Madeira Maciça;78900000000;Mesas;500,00;750,00;10\\n";
    const exemplo2 = "Cadeira Estofada;78900000001;Cadeiras;120,50;241,00;40\\n";
    const csvContent = "\\uFEFF" + cabecalho + exemplo1 + exemplo2;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "fc_moveis_Modelo_Produtos.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Planilha modelo baixada! Preencha e salve como CSV.", "info");
}`;

const newProcessar = `async function processarPlanilhaProdutos(event) {
    const file = event.target.files[0];
    if (!file) return;

    showToast("Lendo planilha, aguarde...", "info");

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const text = e.target.result;
            const linhas = text.split('\\n').filter(linha => linha.trim() !== '');
            if (linhas.length <= 1) return showToast("A planilha parece estar vazia ou só tem o cabeçalho.", "error");

            const separador = linhas[0].includes(';') ? ';' : ',';
            let produtosAdicionados = 0;

            const batch = firestore.batch();
            
            // Leitura dinâmica do cabeçalho para suportar planilha velha ou nova
            let colIndex = { nome: 0, ean: 1, categoria: 2, marca: 3, custo: 4, margem: 5, preco: 6, estoque: 7, min: 8 };
            const hCols = linhas[0].toLowerCase().split(separador).map(c => c.trim().replace(/^"|"$/g, ''));
            if (hCols[0].includes('nome')) {
                colIndex.nome = hCols.findIndex(c => c.includes('nome'));
                colIndex.ean = hCols.findIndex(c => c.includes('ean') || c.includes('barras'));
                colIndex.categoria = hCols.findIndex(c => c.includes('categoria'));
                colIndex.marca = hCols.findIndex(c => c.includes('marca'));
                colIndex.custo = hCols.findIndex(c => c.includes('custo'));
                colIndex.margem = hCols.findIndex(c => c.includes('margem'));
                colIndex.preco = hCols.findIndex(c => c.includes('preco') || c.includes('preço') || c.includes('venda'));
                colIndex.estoque = hCols.findIndex(c => c.includes('estoque') || c.includes('atual') || c.includes('qtd'));
                colIndex.min = hCols.findIndex(c => c.includes('minimo') || c.includes('mínimo'));
            }

            for (let i = 1; i < linhas.length; i++) {
                const colunas = linhas[i].split(separador).map(c => c.trim().replace(/^"|"$/g, ''));
                const nomeIdx = colIndex.nome !== -1 ? colIndex.nome : 0;
                if (!colunas[nomeIdx]) continue;

                const nome = colunas[nomeIdx];
                const ean = colIndex.ean !== -1 ? (colunas[colIndex.ean] || '') : '';
                const categoria = colIndex.categoria !== -1 ? (colunas[colIndex.categoria] || 'Geral') : 'Geral';
                const marca = colIndex.marca !== -1 ? (colunas[colIndex.marca] || '') : '';
                
                const strCusto = colIndex.custo !== -1 ? colunas[colIndex.custo] : null;
                const strPreco = colIndex.preco !== -1 ? colunas[colIndex.preco] : null;
                const strMargem = colIndex.margem !== -1 ? colunas[colIndex.margem] : null;
                
                const custo = typeof parseInputMoney !== 'undefined' ? (parseInputMoney(strCusto ? strCusto.replace(',', '.') : 0) || 0) : (parseFloat((strCusto||'0').replace(',','.'))||0);
                const preco = typeof parseInputMoney !== 'undefined' ? (parseInputMoney(strPreco ? strPreco.replace(',', '.') : 0) || 0) : (parseFloat((strPreco||'0').replace(',','.'))||0);
                let margem = typeof parseInputMoney !== 'undefined' ? (parseInputMoney(strMargem ? strMargem.replace(',', '.') : 0) || 0) : (parseFloat((strMargem||'0').replace(',','.'))||0);
                
                if (custo > 0 && preco > 0 && margem === 0) margem = parseFloat((((preco - custo) / custo) * 100).toFixed(2));
                
                const strEstoque = colIndex.estoque !== -1 ? colunas[colIndex.estoque] : null;
                const strMin = colIndex.min !== -1 ? colunas[colIndex.min] : null;
                
                const estoque = typeof parseInputMoney !== 'undefined' ? (parseInputMoney((strEstoque||'0').replace(',','.')) || 0) : (parseFloat((strEstoque||'0').replace(',','.'))||0);
                const min = typeof parseInputMoney !== 'undefined' ? (parseInputMoney((strMin||'5').replace(',','.')) || 5) : (parseFloat((strMin||'5').replace(',','.'))||5);

                let existe = false;
                if (ean && ean !== '') {
                    existe = db.produtos && db.produtos.find(p => p.ean === ean);
                }

                if (!existe) {
                    const docRef = firestore.collection('produtos').doc();
                    batch.set(docRef, { nome, ean, categoria, marca, custo, margem, preco, estoque, min, foto: '', ativo: true });

                    if (estoque > 0) {
                        const karRef = firestore.collection('movimentacoes').doc();
                        batch.set(karRef, { data: new Date().toISOString(), ref: "Importação de Planilha", prodId: docRef.id, prodNome: nome, qtd: estoque, tipo: "INICIAL" });
                    }
                    produtosAdicionados++;
                }
            }

            if (produtosAdicionados > 0) {
                await batch.commit();
                showToast(\`\${produtosAdicionados} produtos importados com sucesso!\`, "success");
            } else {
                showToast("Nenhum produto novo para importar.", "warning");
            }
        } catch (error) {
            console.error("Erro ao importar planilha:", error);
            showToast("Erro ao processar planilha.", "error");
        }
    };
    reader.readAsText(file, "UTF-8");
}`;

for (const file of files) {
    if (file.endsWith('.js')) {
        let content = fs.readFileSync(path.join(dir, file), 'utf8');
        let originalContent = content;
        
        // Substituir a função baixarPlanilhaModeloProduto()
        const baixarRegex = /function baixarPlanilhaModeloProduto\(\)\s*\{[\s\S]*?\n\}/;
        if (baixarRegex.test(content)) {
            content = content.replace(baixarRegex, newBaixar);
        }
        
        // Substituir a função processarPlanilhaProdutos()
        const processarRegex = /async function processarPlanilhaProdutos\(event\)\s*\{[\s\S]*?reader\.readAsText\(file,\s*["']UTF-8["']\);\s*\}/;
        if (processarRegex.test(content)) {
            content = content.replace(processarRegex, newProcessar);
        }

        if (content !== originalContent) {
            fs.writeFileSync(path.join(dir, file), content, 'utf8');
            console.log('Atualizado:', file);
        }
    }
}
