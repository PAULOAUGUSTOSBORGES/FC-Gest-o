# This script injects the helper function + patches abrirModalConta, abrirModalContaEdicao and salvarConta
# in financeiro.js, compras.js, gestao.js, relatorios.js, vendas_gestao.js

$jsFiles = @("financeiro.js", "compras.js", "gestao.js", "relatorios.js", "vendas_gestao.js")

# --- The helper function to inject (only if not already present) ---
$helperFn = @'

// ===== HELPER: PESSOA SELECT DROPDOWN =====
function preencherContaPessoaSelect(tipo) {
    const sel = document.getElementById('conta-pessoa-select');
    if (!sel) return;
    const lista = tipo === 'RECEBER'
        ? (db.clientes || []).map(c => c.nome || c.razaoSocial || '')
        : (db.fornecedores || []).map(f => f.nome || f.razaoSocial || '');
    const unique = [...new Set(lista.filter(n => n.trim()))].sort();
    sel.innerHTML = '<option value="">-- Selecione um cadastrado --</option>'
        + unique.map(n => `<option value="${n}">${n}</option>`).join('')
        + '<option value="__novo__">+ Cadastrar novo...</option>';
    sel.value = '';
}

function toggleContaPessoaInput(val) {
    const wrap = document.getElementById('conta-pessoa-novo-wrap');
    const input = document.getElementById('conta-pessoa');
    if (!wrap || !input) return;
    if (val === '__novo__' || val === '') {
        wrap.classList.remove('hidden');
        input.value = '';
        input.focus();
    } else {
        wrap.classList.add('hidden');
        input.value = '';
    }
}

function getPessoaFinalConta() {
    const sel = document.getElementById('conta-pessoa-select');
    const input = document.getElementById('conta-pessoa');
    const selVal = sel ? sel.value : '';
    const inputVal = input ? input.value.trim() : '';
    if (selVal && selVal !== '__novo__') return selVal;
    return inputVal;
}
// ==========================================

'@

foreach ($f in $jsFiles) {
    if (-not (Test-Path $f)) { Write-Host "Not found: $f"; continue }

    $content = Get-Content -Raw -Path $f

    # --- Inject helper if not present ---
    if (-not $content.Contains('function preencherContaPessoaSelect')) {
        # Insert before the section comment or before toggleRecorrencia
        $insertBefore = '// 5. MODAL DE CADASTRO'
        if (-not $content.Contains($insertBefore)) { $insertBefore = 'function toggleRecorrencia' }
        $content = $content.Replace($insertBefore, $helperFn + $insertBefore)
        Write-Host "  $f - helper injected"
    }

    # --- Patch abrirModalConta: add preencherContaPessoaSelect call ---
    $oldAbrirReset = "    ['pessoa','ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','multa','juros','data-pgto','obs','anexo-base64','cartorio','juros','multa'].forEach(id => {
        const el = document.getElementById("

    $newAbrirReset = "    preencherContaPessoaSelect(tipo);
    const selEl = document.getElementById('conta-pessoa-select'); if(selEl) selEl.value = '';
    const wrapEl = document.getElementById('conta-pessoa-novo-wrap'); if(wrapEl) wrapEl.classList.add('hidden');
    const pessoaEl = document.getElementById('conta-pessoa'); if(pessoaEl) pessoaEl.value = '';

    ['ref','emissao','vencimento','competencia','num-nf','num-boleto','valor','acrescimo','desconto','multa','juros','data-pgto','obs','anexo-base64','cartorio','juros','multa'].forEach(id => {
        const el = document.getElementById("

    if ($content.Contains($oldAbrirReset)) {
        $content = $content.Replace($oldAbrirReset, $newAbrirReset)
        Write-Host "  $f - abrirModalConta patched"
    }

    # --- Patch abrirModalContaEdicao: populate select and set value ---
    $oldSetPessoa = "    document.getElementById('conta-pessoa').value = f.pessoa || '';"
    $newSetPessoa = @'
    const tipoPessoa = f.tipo === 'RECEITA' ? 'RECEBER' : 'PAGAR';
    preencherContaPessoaSelect(tipoPessoa);
    const pessoaSelEl = document.getElementById('conta-pessoa-select');
    const pessoaWrapEl = document.getElementById('conta-pessoa-novo-wrap');
    const pessoaInputEl = document.getElementById('conta-pessoa');
    if (pessoaSelEl) {
        const match = [...pessoaSelEl.options].find(o => o.value === f.pessoa);
        if (match) {
            pessoaSelEl.value = f.pessoa;
            if(pessoaWrapEl) pessoaWrapEl.classList.add('hidden');
            if(pessoaInputEl) pessoaInputEl.value = '';
        } else {
            pessoaSelEl.value = '__novo__';
            if(pessoaWrapEl) pessoaWrapEl.classList.remove('hidden');
            if(pessoaInputEl) pessoaInputEl.value = f.pessoa || '';
        }
    }
'@

    if ($content.Contains($oldSetPessoa)) {
        $content = $content.Replace($oldSetPessoa, $newSetPessoa)
        Write-Host "  $f - abrirModalContaEdicao patched"
    }

    # --- Patch salvarConta: use getPessoaFinalConta() and auto-register ---
    $oldPessoaRead = "    const pessoa = document.getElementById('conta-pessoa').value.trim();"
    $newPessoaRead = "    const pessoa = getPessoaFinalConta();"
    if ($content.Contains($oldPessoaRead)) {
        $content = $content.Replace($oldPessoaRead, $newPessoaRead)
        Write-Host "  $f - salvarConta pessoa read patched"
    }

    [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
    Write-Host "  $f - saved"
}

# Also patch caixa.js if present
$caixaFile = "caixa.js"
if (Test-Path $caixaFile) {
    $content = Get-Content -Raw -Path $caixaFile
    if (-not $content.Contains('function preencherContaPessoaSelect')) {
        $insertBefore2 = 'function toggleRecorrencia'
        $content = $content.Replace($insertBefore2, $helperFn + $insertBefore2)
    }
    $oldP = "    const pessoa = document.getElementById('conta-pessoa').value.trim();"
    $newP = "    const pessoa = getPessoaFinalConta();"
    $content = $content.Replace($oldP, $newP)
    [System.IO.File]::WriteAllText("$(Get-Location)\$caixaFile", $content, [System.Text.Encoding]::UTF8)
    Write-Host "  $caixaFile - saved"
}

Write-Host "Done!"
