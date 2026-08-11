$files = Get-ChildItem -Filter *.js
$replacements = @{
    'Operao' = 'Operação'
    'operao' = 'operação'
    'OPERAO' = 'OPERAÇÃO'
    'Ao' = 'Ação'
    'ao' = 'ação'
    'Alterao' = 'Alteração'
    'importao' = 'importação'
    'movimentao' = 'movimentação'
    'observao' = 'observação'
    'formatao' = 'formatação'
    'migrao' = 'migração'
    'MVEIS' = 'MÓVEIS'
    'RELATRIO' = 'RELATÓRIO'
    'GESTO' = 'GESTÃO'
    'prticos' = 'práticos'
    'executveis' = 'executáveis'
    'est' = 'está'
    'verso' = 'versão'
    'usurio' = 'usuário'
    'recuperao' = 'recuperação'
    'No' = 'Não'
    'no' = 'não'
    'cdigo' = 'código'
    'forar' = 'forçar'
    'atualizao' = 'atualização'
    'inicializao' = 'inicialização'
    'ORAMENTO' = 'ORÇAMENTO'
    'CONFIRMAO' = 'CONFIRMAÇÃO'
    'NAVEGAO' = 'NAVEGAÇÃO'
    'exportao' = 'exportação'
    'Aja como o consultor financeiro do gestor. Fornea' = 'Aja como o consultor financeiro do gestor. Forneça'
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
