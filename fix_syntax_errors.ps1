$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # We are looking for the dangling else block that got left behind
    # It looks exactly like:
    # } 
    #     else { document.getElementById('prod-id').value = ''; document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); }
    # }
    
    $regex = '(?s)\}[ \t\r\n]*else \{ document\.getElementById\(''prod-id''\)\.value = ''''; document\.getElementById\(''modal-produto-title''\)\.innerText = ''Completar Novo Produto''; document\.getElementById\(''prod-nome''\)\.value = p\.nome; document\.getElementById\(''prod-ean''\)\.value = p\.cEAN \|\| ''''; document\.getElementById\(''prod-custo''\)\.value = p\.custoFinal\.toFixed\(2\); document\.getElementById\(''prod-margem''\)\.value = p\.margemAtual\.toFixed\(2\); document\.getElementById\(''prod-preco''\)\.value = p\.precoVendaSug\.toFixed\(2\); \}[ \t\r\n]*\}'

    if ($content -match $regex) {
        $content = $content -replace $regex, '}'
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Fixed syntax error in $($file.Name)"
    }
}
