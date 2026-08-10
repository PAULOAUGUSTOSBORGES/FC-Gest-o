$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    $regex = '(?s)function alternarAcaoVinculoXML\(\) \{\s*const acao = document\.getElementById\(''prod-acao-vinculo''\)\.value;\s*if\(acao === ''VINCULAR''\) \{\s*document\.getElementById\(''div-vinculo-busca''\)\.classList\.remove\(''hidden''\);\s*\} else \{\s*document\.getElementById\(''div-vinculo-busca''\)\.classList\.add\(''hidden''\);\s*document\.getElementById\(''prod-id''\)\.value = '''';\s*\}\s*\}\s*else \{\s*document\.getElementById\(''div-vinculo-busca''\)\.classList\.add\(''hidden''\);\s*document\.getElementById\(''prod-id''\)\.value = '''';\s*\}\s*\}'
    
    $replacement = @"
function alternarAcaoVinculoXML() {
    const acao = document.getElementById('prod-acao-vinculo').value;
    if(acao === 'VINCULAR') {
        document.getElementById('div-vinculo-busca').classList.remove('hidden');
    } else {
        document.getElementById('div-vinculo-busca').classList.add('hidden');
        document.getElementById('prod-id').value = '';
    }
}
"@

    if ($content -match $regex) {
        $content = $content -replace $regex, $replacement
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Fixed syntax in $($file.Name)"
    }
}
