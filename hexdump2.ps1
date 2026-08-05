$bytes = [System.IO.File]::ReadAllBytes('g:\site sistema\vendas_operacao.html')
for ($i=0; $i -lt $bytes.Length - 20; $i++) {
    if ($bytes[$i] -eq 79 -and $bytes[$i+1] -eq 112 -and $bytes[$i+2] -eq 101 -and $bytes[$i+3] -eq 114 -and $bytes[$i+4] -eq 97) {
        $slice = $bytes[$i..($i+15)]
        $hex = ($slice | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
        Write-Host "Found Opera: $hex"
        break
    }
}
