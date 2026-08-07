import re
import os

# The correct renderTitulos function using proper backtick template literals
CORRECT_RENDER_TITULOS = '''function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar';
    if (!document.getElementById(`tabela-fin-${prefix}`)) return;
    if (!db.financeiro) return;
    
    const statusFilterEl = document.getElementById(`filtro-${prefix}-status`);
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'TODOS';
    
    const periodoFilterEl = document.getElementById(`filtro-${prefix}-periodo`);
    const periodoFilter = periodoFilterEl ? periodoFilterEl.value : 'TUDO';
    
    const buscaEl = document.getElementById(`busca-fin-${prefix}`);
    const termoBusca = buscaEl ? buscaEl.value.toLowerCase() : '';
    
    const dataIniEl = document.getElementById(`filtro-${prefix}-ini`);
    const dataIni = dataIniEl ? dataIniEl.value : '';
    
    const dataFimEl = document.getElementById(`filtro-${prefix}-fim`);
    const dataFim = dataFimEl ? dataFimEl.value : '';
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    if (termoBusca) {'''

# Pattern to find the broken renderTitulos header (introduced by the bad ps1 script)
# The broken version uses \tabela-fin- (tab char + "abela-fin-") and similar escape sequences
BROKEN_PATTERN = re.compile(
    r'function renderTitulos\(tipo\)\s*\{.*?if\s*\(\s*termoBusca\s*\)\s*\{',
    re.DOTALL
)

# Also fix the duplicate code blocks injected between try{ and the actual await call
# The duplicate inserted was: renderCaixaDiario body + abrirModalCaixa + fecharModalCaixa + confirmarMovCaixa
# This always appears starting with:
#     try {
#     if (!document.getElementById('caixa-saldo-display')) return;
# and ending just before the correct await line

DUPLICATE_INJECTION_PATTERN = re.compile(
    r'(\s*try \{)\n    if \(!document\.getElementById\(\'caixa-saldo-display\'\)\) return;.*?'
    r'async function confirmarMovCaixa\(\).*?'
    r'catch\(err\) \{ console\.error\(err\); showToast\(\'Erro ao registrar caixa\.\', \'error\'\); \}\n\}\n\n',
    re.DOTALL
)

CORRECT_TRY_BLOCK = '''    try {
        await firestore.collection('fc_moveis').doc('caixa').set({ ...cxAtual, status: novoStatus, saldo: novoSaldo, historico: cxHistoricoNovo }, { merge: true });
        fecharModalCaixa(); renderCaixaDiario(); showToast('Operação realizada com sucesso!', 'success');
    } catch(err) { console.error(err); showToast('Erro ao registrar caixa.', 'error'); }
}

'''

target_files = [
    r'g:\site sistema\financeiro.js',
    r'g:\site sistema\caixa.js',
    r'g:\site sistema\compras.js',
    r'g:\site sistema\gestao.js',
    r'g:\site sistema\relatorios.js',
    r'g:\site sistema\vendas_gestao.js',
    r'g:\site sistema\script.js',
]

for filepath in target_files:
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filepath}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    changed = False
    
    # Fix 1: Replace broken renderTitulos header with correct version
    if BROKEN_PATTERN.search(content):
        content = BROKEN_PATTERN.sub(CORRECT_RENDER_TITULOS, content)
        changed = True
        print(f"  [Fixed renderTitulos] {os.path.basename(filepath)}")
    
    # Fix 2: Remove the duplicate code block injected into try{}
    if "if (!document.getElementById('caixa-saldo-display')) return;" in content:
        content = DUPLICATE_INJECTION_PATTERN.sub(CORRECT_TRY_BLOCK, content)
        if content != original:
            changed = True
            print(f"  [Fixed duplicate injection] {os.path.basename(filepath)}")
    
    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"SAVED: {os.path.basename(filepath)}")
    else:
        print(f"No changes needed: {os.path.basename(filepath)}")

print("\nDone.")
