$files = @("financeiro.html", "gestao.html", "compras.html", "relatorios.html", "vendas_gestao.html")

$replacements = @(
    # Fix Backgrounds
    @("Ymctc2xhdGUtOTA=" , "Ymctc2xhdGUtODA="), # bg-slate-90 -> bg-slate-80 (fix dark mode bg in modal inputs)
    
    # Fix Garbled Text in UTF-8
    @("RGVzY3Jpw4fDo28=", "RGVzY3JpY8Ojbw=="), # DescriÃ§Ã£o -> Descrição
    @("T3BlcmHDp8Ojb25hbA==", "T3BlcmFjaW9uYWw="), # OperaÃ§Ã£onal -> Operacional
    @("TG9nw61zdGljYQ==", "TG9nw61zdGljYQ=="), # LogÃ­stica -> Logística (this was wrong in b64, let's use direct utf8)
    @("Q29udGEgQmFuY8Ohcmlh", "Q29udGEgQmFuY8Ohcmlh"), 
    @("Q2FpeGEgRsOtc2ljbw==", "Q2FpeGEgRsOtc2ljbw=="), 
    @("QmFuY28gSXRhw7o=", "QmFuY28gSXRhw7o="),
    @("RGF0YSBkZSBFbWlzc8Ojbw==", "RGF0YSBkZSBFbWlzc8Ojbw=="),
    @("TsOjbyAow5puaWNhKQ==", "TsOjbyAoVW5pY2Ep"), 
    @("Q29tcGV0w6puY2lh", "Q29tcGV0w6puY2lh"),
    @("VmFsb3IgVW5pdMOhcmlv", "VmFsb3IgVW5pdMOhcmlv"),
    @("U2l0dWFpw6fDo28=", "U2l0dWFpw6fDo28="),
    @("Q2FydMOjbw==", "Q2FydMOjbw=="),
    @("RMOpYml0bw==", "RMOpYml0bw=="),
    @("Q3LDqWRpdG8=", "Q3LDqWRpdG8="),
    @("VHJhbnNmZXLDqm5jaWE=", "VHJhbnNmZXLDqm5jaWE="),
    @("T2JzZXJ2YcOnw7Vlcw==", "T2JzZXJ2YcOnw7Vlcw=="),
    @("TGFuw6dhbWVudG8=", "TGFuw6dhbWVudG8="),
    @("UsOhaWRh", "UsOhcGlkYQ=="), # RÃ¡pida -> Rápida
    @("VMOtdHVsbw==", "VMOtdHVsbw==") # TÃ­tulo -> Título
)

# Actually, the simplest way is to just use a script that defines the exact bad strings and good strings and forces UTF-8 read/write.
# PowerShell 7+ does this perfectly. In PS 5.1, we use [System.IO.File]::ReadAllText and WriteAllText.

$badToGood = @{
    "DescriÃ§Ã£o" = "Descrição"
    "OperaÃ§Ã£onal" = "Operacional"
    "LogÃ­stica" = "Logística"
    "BancÃ¡ria" = "Bancária"
    "FÃ­sico" = "Físico"
    "ItaÃº" = "Itaú"
    "EmissÃ£o" = "Emissão"
    "NÃ£o" = "Não"
    "ÃƒÅ¡nica" = "Única"
    "Ãšnica" = "Única"
    "RECORRÃƒÂ Ã…Â NCIA" = "RECORRÊNCIA"
    "RECORRÃ Å NCIA" = "RECORRÊNCIA"
    "CompetÃªncia" = "Competência"
    "MÃªs" = "Mês"
    "UnitÃ¡rio" = "Unitário"
    "SituaÃ§Ã£o" = "Situação"
    "CartÃ£o" = "Cartão"
    "DÃ©bito" = "Débito"
    "CrÃ©dito" = "Crédito"
    "TransferÃªncia" = "Transferência"
    "ObservaÃ§Ãµes" = "Observações"
    "LanÃ§amento" = "Lançamento"
    "RÃ¡pida" = "Rápida"
    "TÃ­tulo" = "Título"
    "AnotaÃ§Ãµes" = "Anotações"
    "renegociaÃ§Ã£o" = "renegociação"
    "NÃƒâ€šÂº" = "Nº"
    "NÃ‚º" = "Nº"
    "CÃ³d" = "Cód"
    "ÃƒÂ Ã‚Â " = "à"
    "Ã Â " = "à"
}

foreach ($f in $files) {
    if (Test-Path $f) {
        $text = [System.IO.File]::ReadAllText("$pwd\$f", [System.Text.Encoding]::UTF8)
        
        foreach ($key in $badToGood.Keys) {
            $text = $text.Replace($key, $badToGood[$key])
        }

        # Fix the white backgrounds inside modal-nova-conta specifically
        $text = $text.Replace('class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600', 'class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600')
        $text = $text.Replace('class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600', 'class="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600')
        $text = $text.Replace('id="conta-vencimento" class="w-full bg-amber-50 border border-amber-300', 'id="conta-vencimento" class="w-full bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600')
        $text = $text.Replace('id="conta-valor" oninput="calcularValorFinalFormulario()" class="w-full bg-blue-50 border border-blue-300', 'id="conta-valor" oninput="calcularValorFinalFormulario()" class="w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700')
        
        [System.IO.File]::WriteAllText("$pwd\$f", $text, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed $f"
    }
}
