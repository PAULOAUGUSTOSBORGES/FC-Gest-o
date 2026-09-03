const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'sistema');
const files = fs.readdirSync(dir);

const newProcessar = `async function processarPlanilhaProdutos(event) {
    const file = event.target.files[0];
    if (!file) return;

    showToast("Lendo planilha, aguarde...", "info");

    // Verifica se não é csv
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast("Por favor, envie um arquivo .csv (separado por vírgulas ou ponto e vírgula).", "error");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const text = e.target.result;
            // Correção: divide por \r\n (Windows), \n (Linux) ou \r (Mac/Excel antigo)
            const linhas = text.split(/\\r\\n|\\n|\\r/).filter(linha => linha.trim() !== '');
            
            if (linhas.length <= 1) {
                showToast("A planilha parece estar vazia ou só tem o cabeçalho.", "error");
                return;
            }

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
                
                const parseCustom = (val) => {
                    if (typeof parseInputMoney !== 'undefined') {
                        return parseInputMoney(val ? val.replace(',', '.') : 0) || 0;
                    }
                    return parseFloat((val || '0').replace(',', '.')) || 0;
                };

                const custo = parseCustom(strCusto);
                const preco = parseCustom(strPreco);
                let margem = parseCustom(strMargem);
                
                if (custo > 0 && preco > 0 && margem === 0) {
                    margem = parseFloat((((preco - custo) / custo) * 100).toFixed(2));
                }
                
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
                showToast("Nenhum produto novo importado (podem ser EANs duplicados).", "warning");
            }
        } catch (error) {
            console.error("Erro ao importar planilha:", error);
            showToast("Erro ao processar planilha.", "error");
        }
    };
    reader.readAsText(file, "UTF-8");
    event.target.value = '';
}`;

for (const file of files) {
    if (file.endsWith('.js')) {
        let content = fs.readFileSync(path.join(dir, file), 'utf8');
        let originalContent = content;
        
        // Substituir a função processarPlanilhaProdutos() usando uma regex mais permissiva no final
        const processarRegex = /async function processarPlanilhaProdutos\(event\)\s*\{[\s\S]*?reader\.readAsText\(file,\s*["']UTF-8["']\);[\s\S]*?\n\}/i;
        if (processarRegex.test(content)) {
            content = content.replace(processarRegex, newProcessar);
        } else {
            // Tenta outra regex caso o readAsText seja diferente
            const processarRegex2 = /async function processarPlanilhaProdutos\(event\)\s*\{[\s\S]*?reader\.readAsText\(file\);[\s\S]*?\n\}/i;
            if (processarRegex2.test(content)) {
                content = content.replace(processarRegex2, newProcessar);
            }
        }

        if (content !== originalContent) {
            fs.writeFileSync(path.join(dir, file), content, 'utf8');
            console.log('Atualizado processar:', file);
        }
    }
}
