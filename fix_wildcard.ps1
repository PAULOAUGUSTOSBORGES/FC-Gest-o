$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content

        $content = [regex]::Replace($content, 'Opera.{1,4}o', 'Operação')
        $content = [regex]::Replace($content, 'opera.{1,4}o', 'operação')
        $content = [regex]::Replace($content, 'M.{1,3}veis', 'Móveis')
        $content = [regex]::Replace($content, 'm.{1,3}veis', 'móveis')
        $content = [regex]::Replace($content, 'Aten.{1,3}o', 'Atenção')
        $content = [regex]::Replace($content, 'aten.{1,3}o', 'atenção')
        $content = [regex]::Replace($content, 'C.{1,2}mera', 'Câmera')
        $content = [regex]::Replace($content, 'CONFIRMA.{1,3}O', 'CONFIRMAÇÃO')
        $content = [regex]::Replace($content, 'CONTE.{1,2}DO', 'CONTEÚDO')
        $content = [regex]::Replace($content, 'd.{1,2}gitos', 'dígitos')
        $content = [regex]::Replace($content, 'EMISS.{1,3}O', 'EMISSÃO')
        $content = [regex]::Replace($content, 'OR.{1,2}AMENTO', 'ORÇAMENTO')
        $content = [regex]::Replace($content, 'Padr.{1,3}o', 'Padrão')
        $content = [regex]::Replace($content, 'Raz.{1,3}o', 'Razão')
        $content = [regex]::Replace($content, 'R.{1,2}PIDO', 'RÁPIDO')
        $content = [regex]::Replace($content, 'SERVI.{1,3}O', 'SERVIÇO')
        
        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed in $($file.Name)"
        }
    } catch { }
}
