$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    $c = $c -creplace 'SuGestão', 'Sugestão'
    $c = $c -creplace 'suGestão', 'sugestão'
    $c = $c -creplace 'suGestão', 'sugestão'
    $c = $c -creplace 'Reposi\w+o', 'Reposição'
    $c = $c -creplace 'suGestãor', 'sugestor'
    
    # Just in case other things got camel-cased wrong
    $c = $c -creplace 'Ações Avançadas', 'Ações Avançadas'

    [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
}
