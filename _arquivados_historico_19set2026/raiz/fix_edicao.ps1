$ErrorActionPreference = "Stop"

$folder = "g:\VERSOES DO SISTEMA\site sistema"

$files = @("gestao_v2.js", "vendas_gestao.js", "financeiro.js", "caixa.js", "compras.js", "relatorios_v2.js")

foreach ($file in $files) {
    $filePath = Join-Path $folder $file
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        
        # Replace the first pattern: `const match = [...pessoaSelEl.options].find(o => o.value === f.pessoa);`
        $pattern1 = "const match = [...pessoaSelEl.options].find(o => o.value === f.pessoa);"
        $replacement1 = "const match = [...pessoaSelEl.options].find(o => o.value.toLowerCase() === (f.pessoa || '').toLowerCase());"
        $content = $content.Replace($pattern1, $replacement1)
        
        # Also need to fix the case where match is used to set the value.
        # If match is found, we should use match.value!
        $pattern1_set = "pessoaSelEl.value = f.pessoa;"
        $replacement1_set = "pessoaSelEl.value = match ? match.value : f.pessoa;"
        
        # We only want to replace this inside the if (match) block, but doing it globally is safe if there's only one.
        # Let's do a more specific regex.
        $regex1 = '(?s)const match = \[\.\.\.pessoaSelEl\.options\]\.find\(o => o\.value \=\=\= f\.pessoa\);\s*if \(match\) \{\s*pessoaSelEl\.value = f\.pessoa;'
        $repl1 = "const match = [...pessoaSelEl.options].find(o => o.value.toLowerCase() === (f.pessoa || '').toLowerCase());`r`n        if (match) {`r`n            pessoaSelEl.value = match.value;"
        $content = [regex]::Replace($content, $regex1, $repl1)

        # In financeiro.js it was `let isKnown = false; Array.from...`
        $regex2 = '(?s)let isKnown = false;\s*Array\.from\(pessoaSelEl\.options\)\.forEach\(opt => \{\s*if \(opt\.value === f\.pessoa\) isKnown = true;\s*\}\);\s*if \(isKnown\) \{\s*pessoaSelEl\.value = f\.pessoa;'
        $repl2 = "let isKnown = false;`r`n        let matchedVal = f.pessoa;`r`n        Array.from(pessoaSelEl.options).forEach(opt => {`r`n            if (opt.value.toLowerCase() === (f.pessoa || '').toLowerCase()) { isKnown = true; matchedVal = opt.value; }`r`n        });`r`n        if (isKnown) {`r`n            pessoaSelEl.value = matchedVal;"
        $content = [regex]::Replace($content, $regex2, $repl2)

        # Fix __avulso__ in financeiro.js to __novo__
        $content = $content.Replace("pessoaSelEl.value = '__avulso__';", "pessoaSelEl.value = '__novo__';")

        # Fix the parseFloat in financeiro.js for multa and juros
        $content = $content.Replace("parseFloat(document.getElementById('conta-multa').value)", "parseFloat(document.getElementById('conta-multa') ? document.getElementById('conta-multa').value : 0)")
        $content = $content.Replace("parseFloat(document.getElementById('conta-juros').value)", "parseFloat(document.getElementById('conta-juros') ? document.getElementById('conta-juros').value : 0)")
        
        Set-Content -Path $filePath -Value $content -Encoding UTF8
        Write-Host "Processed $file"
    }
}
Write-Output "Done"
