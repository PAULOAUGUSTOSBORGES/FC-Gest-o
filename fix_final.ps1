$r = [char]0xFFFD
$replacements = @(
    @("Aten$($r)o", "Atenção"),
    @("Aten$($r)$($r)o", "Atenção"),
    @("C$($r)d.", "Cód."),
    @("C$($r)mera", "Câmera"),
    @("CONFIRMA$($r)$($r)O", "CONFIRMAÇÃO"),
    @("CONFIRMA$($r)O", "CONFIRMAÇÃO"),
    @("CONTE$($r)DO", "CONTEÚDO"),
    @("d$($r)gitos", "dígitos"),
    @("EMISS$($r)O", "EMISSÃO"),
    @("M$($r)veis", "Móveis"),
    @("OR$($r)AMENTO", "ORÇAMENTO"),
    @("OR$($r)AMENTOS", "ORÇAMENTOS"),
    @("Padr$($r)o", "Padrão"),
    @("Raz$($r)o", "Razão"),
    @("R$($r)PIDO", "RÁPIDO"),
    @("Ser$($r) ", "Será "),
    @("SERVI$($r)O", "SERVIÇO"),
    @("SERVI$($r)OS", "SERVIÇOS")
)

$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content
        
        foreach ($pair in $replacements) {
            $content = $content.Replace($pair[0], $pair[1])
        }

        # Handle the Operaǜo thing.
        # Let's just use Regex for "Opera" followed by any weird non-ascii, then "o"
        $content = [regex]::Replace($content, 'Opera[^\x20-\x7E]+o', 'Operação')
        $content = [regex]::Replace($content, 'opera[^\x20-\x7E]+o', 'operação')

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed in $($file.Name)"
        }
    } catch {
        Write-Warning "Failed $($file.FullName): $_"
    }
}
