$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    $c = $c -replace 'Gestǜo', 'Gestão'
    $c = $c -replace 'Sugestǜo', 'Sugestão'
    $c = $c -replace 'Reposi.ǜo', 'Reposição'
    $c = $c -replace 'A.es', 'Ações'
    $c = $c -replace 'A.es Avan.adas', 'Ações Avançadas'
    $c = $c -replace 'A.*o: Vincular', 'Ação: Vincular'
    $c = $c -replace 'Reposi.ão', 'Reposição'
    $c = $c -replace 'Hist.rico', 'Histórico'
    $c = $c -replace 'Relat.rios', 'Relatórios'
    $c = $c -replace 'Configura.es', 'Configurações'
    $c = $c -replace 'M.veis', 'Móveis'
    $c = $c -replace 'Or.amentos', 'Orçamentos'
    $c = $c -replace 'Funcion.rios', 'Funcionários'
    $c = $c -replace 'In.cio', 'Início'
    $c = $c -replace 'Servi.os', 'Serviços'
    $c = $c -replace 'F.sico', 'Físico'
    
    [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
}
