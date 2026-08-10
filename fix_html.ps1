$htmlFiles = Get-ChildItem -Path . -Filter *.html -File
foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $content = $content -replace 'OP.*?O DE V.*?NCULO MANUAL', 'OPÇÃO DE VÍNCULO MANUAL'
    $content = $content -replace 'A.*?o: Vincular ou Cadastrar\?', 'Ação: Vincular ou Cadastrar?'
    $content = $content -replace 'C.*?d Barras \(EAN\)', 'Cód Barras (EAN)'
    $content = $content -replace 'Pre.*?o R\$', 'Preço R$'
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
}
