import os
import re

files_to_fix = [
    'gestao_v2.js', 'vendas_gestao.js', 'financeiro.js', 'compras.js', 'caixa.js', 'relatorios_v2.js'
]
base_path = r'g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema'

new_migration_logic = '''async function migrarDadosSeNecessario() {
    try {
        const comprasSnap = await firestore.collection('compras').limit(1).get();
        const finSnap = await firestore.collection('financeiro').limit(1).get();
        if (!comprasSnap.empty || !finSnap.empty) return;
        
        const bancoPrincipalSnap = await firestore.collection('fc_moveis').doc('banco_principal').get();
        if (!bancoPrincipalSnap.exists) return;
        
        const dados = bancoPrincipalSnap.data();
        if (!dados) return;
        
        const temDados = (dados.compras && dados.compras.length > 0) || (dados.financeiro && dados.financeiro.length > 0);
        if (!temDados) return;
        
        showToast('Importando dados do sistema anterior... Aguarde!', 'info');
        
        const operations = [];
        const colecoes = ['produtos', 'clientes', 'fornecedores', 'vendas', 'movimentacoes', 'financeiro', 'compras'];
        
        for (let col of colecoes) {
            if (dados[col] && Array.isArray(dados[col])) {
                for (let item of dados[col]) {
                    const id = item.id ? String(item.id) : firestore.collection(col).doc().id;
                    operations.push({ ref: firestore.collection(col).doc(id), data: item });
                }
            }
        }
        
        if (dados.caixa) operations.push({ ref: firestore.collection('fc_moveis').doc('caixa'), data: dados.caixa });
        if (dados.config) operations.push({ ref: firestore.collection('fc_moveis').doc('config'), data: dados.config });
        
        const BATCH_SIZE = 400;
        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
            const batch = firestore.batch();
            operations.slice(i, i + BATCH_SIZE).forEach(op => {
                batch.set(op.ref, op.data, { merge: true });
            });
            await batch.commit();
        }
        
        try { await firestore.collection('fc_moveis').doc('banco_principal').update({ migrado: true }); } catch (e2) {}
        showToast('Dados importados com sucesso! Recarregando...', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
        console.error('Erro na migracao:', e);
        showToast('Aviso: Erro ao importar dados anteriores.', 'error');
    }
}'''

for fname in files_to_fix:
    fpath = os.path.join(base_path, fname)
    with open(fpath, 'r', encoding='latin-1') as f:
        content = f.read()
    
    # regex to match the old function block
    pattern = re.compile(r'async function migrarDadosSeNecessario\(\)\s*\{.*?\n\}\s*\n', re.DOTALL)
    if pattern.search(content):
        content = pattern.sub(new_migration_logic + '\n\n', content)
        with open(fpath, 'w', encoding='latin-1') as f:
            f.write(content)
        print(f"Fixed {fname}")
    else:
        print(f"Function not found in {fname}")
