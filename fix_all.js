
# This script uses Node.js to fix the corrupted JS files
# since Python is not available

const fs = require('fs');

const files = [
    'g:/site sistema/financeiro.js',
    'g:/site sistema/caixa.js',
    'g:/site sistema/compras.js',
    'g:/site sistema/gestao.js',
    'g:/site sistema/relatorios.js',
    'g:/site sistema/vendas_gestao.js',
    'g:/site sistema/script.js',
];

// The correct renderTitulos header (with proper template literals)
const CORRECT_HEADER = `function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar';
    if (!document.getElementById('tabela-fin-' + prefix)) return;
    if (!db.financeiro) return;
    
    const statusFilterEl = document.getElementById('filtro-' + prefix + '-status');
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'TODOS';
    
    const periodoFilterEl = document.getElementById('filtro-' + prefix + '-periodo');
    const periodoFilter = periodoFilterEl ? periodoFilterEl.value : 'TUDO';
    
    const buscaEl = document.getElementById('busca-fin-' + prefix);
    const termoBusca = buscaEl ? buscaEl.value.toLowerCase() : '';
    
    const dataIniEl = document.getElementById('filtro-' + prefix + '-ini');
    const dataIni = dataIniEl ? dataIniEl.value : '';
    
    const dataFimEl = document.getElementById('filtro-' + prefix + '-fim');
    const dataFim = dataFimEl ? dataFimEl.value : '';
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    if (termoBusca) {`;

// Patterns for broken code
// The broken renderTitulos uses literal tab chars (\t) in getElementById calls
const BROKEN_RT_REGEX = /function renderTitulos\(tipo\)\s*\{[\s\S]*?if\s*\(\s*termoBusca\s*\)\s*\{/;

// The duplicate injection pattern - renderCaixaDiario body repeated inside try{}
const DUP_INJECT_REGEX = /(\s*try \{)\n    if \(!document\.getElementById\('caixa-saldo-display'\)\) return;[\s\S]*?async function confirmarMovCaixa\(\)[\s\S]*?catch\(err\) \{ console\.error\(err\); showToast\('Erro ao registrar caixa\.', 'error'\); \}\n\}/;

const CORRECT_TRY = `
    try {
        await firestore.collection('fc_moveis').doc('caixa').set({ ...cxAtual, status: novoStatus, saldo: novoSaldo, historico: cxHistoricoNovo }, { merge: true });
        fecharModalCaixa(); renderCaixaDiario(); showToast('Operação realizada com sucesso!', 'success');
    } catch(err) { console.error(err); showToast('Erro ao registrar caixa.', 'error'); }
}`;

for (const filepath of files) {
    try {
        let content = fs.readFileSync(filepath, 'utf8');
        const original = content;
        let changed = false;

        // Fix 1: renderTitulos broken header
        if (BROKEN_RT_REGEX.test(content)) {
            content = content.replace(BROKEN_RT_REGEX, CORRECT_HEADER);
            changed = true;
            console.log(`  [Fixed renderTitulos] ${filepath.split('/').pop()}`);
        }

        // Fix 2: Duplicate injection in confirmarMovCaixa
        if (content.includes("if (!document.getElementById('caixa-saldo-display')) return;") && 
            content.includes("async function confirmarMovCaixa()") &&
            (content.match(/async function confirmarMovCaixa/g) || []).length > 1) {
            content = content.replace(DUP_INJECT_REGEX, CORRECT_TRY);
            changed = true;
            console.log(`  [Fixed duplicate injection] ${filepath.split('/').pop()}`);
        }

        if (changed) {
            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`SAVED: ${filepath.split('/').pop()}`);
        } else {
            console.log(`No changes: ${filepath.split('/').pop()}`);
        }
    } catch (err) {
        console.error(`ERROR processing ${filepath}: ${err.message}`);
    }
}
console.log('\nDone.');
