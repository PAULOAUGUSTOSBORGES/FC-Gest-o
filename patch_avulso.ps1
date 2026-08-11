# Patch 1: Add "Avulso" option to all HTML files
$htmlFiles = @("financeiro.html", "gestao.html", "compras.html", "relatorios.html", "vendas_gestao.html")

$oldOpt = '<option value="">-- Selecione um cadastrado --</option>'
$newOpt = '<option value="">-- Selecione um cadastrado --</option>
                                <option value="__avulso__">-- Digitar nome avulso (sem cadastrar) --</option>'

foreach ($f in $htmlFiles) {
    if (-not (Test-Path $f)) { Write-Host "Not found: $f"; continue }
    $content = Get-Content -Raw -Path $f
    if ($content.Contains($oldOpt)) {
        $content = $content.Replace($oldOpt, $newOpt)
        [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
        Write-Host "$f - avulso option added"
    } else {
        Write-Host "$f - NOT FOUND"
    }
}

# Patch 2: Update JS files to handle __avulso__
$jsFiles = @("financeiro.js", "gestao.js", "compras.js", "relatorios.js", "vendas_gestao.js", "caixa.js")

# 2a. Update toggleContaPessoaInput to also show input when __avulso__
$oldToggle = "    if (val === '__novo__' || val === '') {"
$newToggle = "    if (val === '__novo__' || val === '' || val === '__avulso__') {"

# 2b. Update getPessoaFinalConta to treat __avulso__ same as __novo__
$oldGetPessoa = "    if (selVal && selVal !== '__novo__') return selVal;"
$newGetPessoa = "    if (selVal && selVal !== '__novo__' && selVal !== '__avulso__' && selVal !== '') return selVal;"

# 2c. Update auto-register: only register if __novo__, NOT __avulso__
$oldAutoReg = "    if ((_selValFinal === '' || _selValFinal === '__novo__') && _inpValFinal) {"
$newAutoReg = "    if (_selValFinal === '__novo__' && _inpValFinal) {"

foreach ($f in $jsFiles) {
    if (-not (Test-Path $f)) { Write-Host "Not found: $f"; continue }
    $content = Get-Content -Raw -Path $f
    $changed = $false

    if ($content.Contains($oldToggle)) {
        $content = $content.Replace($oldToggle, $newToggle); $changed = $true
        Write-Host "$f - toggle patched"
    }
    if ($content.Contains($oldGetPessoa)) {
        $content = $content.Replace($oldGetPessoa, $newGetPessoa); $changed = $true
        Write-Host "$f - getPessoa patched"
    }
    if ($content.Contains($oldAutoReg)) {
        $content = $content.Replace($oldAutoReg, $newAutoReg); $changed = $true
        Write-Host "$f - auto-register patched (avulso won't register)"
    }

    if ($changed) {
        [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
        Write-Host "$f - saved"
    } else {
        Write-Host "$f - no changes needed"
    }
}

Write-Host "Done!"
