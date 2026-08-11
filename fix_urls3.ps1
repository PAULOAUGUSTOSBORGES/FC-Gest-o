$files = Get-ChildItem -Filter *.html
$replacements = @{
    'Orçamentos.html' = 'orcamentos.html'
    'Funcionários.html' = 'funcionarios.html'
    'Relatórios.html' = 'relatorios.html'
    'vendas_Operação.html' = 'vendas_operacao.html'
    'vendas_Opera\uFFFD\uFFFDo.html' = 'vendas_operacao.html'
    'vendas_Operao.html' = 'vendas_operacao.html'
    'Operao.html' = 'operacao.html'
    'Operação.html' = 'operacao.html'
}

foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $c
    foreach ($key in $replacements.Keys) {
        $c = $c.Replace($key, $replacements[$key])
    }
    if ($c -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $c, [System.Text.Encoding]::UTF8)
    }
}
