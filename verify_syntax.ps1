# verify_syntax.ps1
$base = 'g:\site sistema'
$arquivos = Get-ChildItem -Path $base -Filter '*.js' -File
$encontrou = $false
foreach ($f in $arquivos) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    $temErro1 = $content.Contains("`r`n); `r`n}")
    $temErro2 = $content.Contains(").catch(e => console.error(`"Erro ao salvar kardex:`", e));`r`n}")
    if ($temErro1 -or $temErro2) {
        Write-Host "AINDA COM ERRO: $($f.Name)" -ForegroundColor Red
        $encontrou = $true
    }
}
if (-not $encontrou) { 
    Write-Host "TUDO LIMPO! Nenhum fragmento orfao encontrado." -ForegroundColor Green 
}
