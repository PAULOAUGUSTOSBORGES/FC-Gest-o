$bytes = [System.IO.File]::ReadAllBytes('g:\site sistema\vendas_operacao.html')
for ($i=0; $i -lt $bytes.Length - 20; $i++) {
    if ($bytes[$i] -eq 118 -and $bytes[$i+1] -eq 101 -and $bytes[$i+2] -eq 110 -and $bytes[$i+7] -eq 112 -and $bytes[$i+8] -eq 101) {
        $slice = $bytes[$i..($i+30)]
        $hex = $slice | ForEach-Object { '{0:X2}' -f $_ } -Join ' '
        Write-Host $hex
        break
    }
}
