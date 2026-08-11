$files = Get-ChildItem -Include *.html -Recurse -File

$replacements = @{
    'href="vendas_Opera[^"]+"' = 'href="vendas_operacao.html"'
    'href="Orçamentos.html"' = 'href="orcamentos.html"'
    'href="Funcionários.html"' = 'href="funcionarios.html"'
    'href="vendas_Gestão.html"' = 'href="vendas_gestao.html"'
    'href="Relatórios.html"' = 'href="relatorios.html"'
    
    'data-target="vendas_Opera[^"]+"' = 'data-target="vendas_operacao"'
    'data-target="Orçamentos"' = 'data-target="orcamentos"'
    'data-target="Funcionários"' = 'data-target="funcionarios"'
    'data-target="vendas_Gestão"' = 'data-target="vendas_gestao"'
    'data-target="Relatórios"' = 'data-target="relatorios"'
    
    '<script src="vendas_Opera[^"]+"' = '<script src="vendas_operacao.js"'
    '<script src="Orçamentos.js"' = '<script src="orcamentos.js"'
    '<script src="Funcionários.js"' = '<script src="funcionarios.js"'
    '<script src="vendas_Gestão.js"' = '<script src="vendas_gestao.js"'
    '<script src="Relatórios.js"' = '<script src="relatorios.js"'
}

foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    
    foreach ($key in $replacements.Keys) {
        $c = [System.Text.RegularExpressions.Regex]::Replace($c, $key, $replacements[$key])
    }

    if ($c -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $c, [System.Text.Encoding]::UTF8)
    }
}
