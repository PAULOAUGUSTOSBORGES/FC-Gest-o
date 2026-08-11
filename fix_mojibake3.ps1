$files = @("financeiro.html", "gestao.html", "compras.html", "relatorios.html", "vendas_gestao.html", "pdv.html", "estoque.html", "orcamentos.html", "clientes.html", "fornecedores.html", "funcionarios.html")

$replacements = @{
    "Operaçãonal" = "Operacional"
    "RECORRÃ Å NCIA" = "RECORRÊNCIA"
    "RECORRÃƒÂ Ã…Â NCIA" = "RECORRÊNCIA"
    "RECORRÊNCIANCIA" = "RECORRÊNCIA"
    "Não (Ãšnica)" = "Não (Única)"
    "Referente Ã Â  NF" = "Referente à NF"
    "Ã Â " = "à"
    "Situaçãou" = "Situação"
    "SituaÃ§Ã£o" = "Situação"
    "MÃªs" = "Mês"
    "Gestǜo" = "Gestão"
    "Mveis" = "Móveis"
    "<body class=`"flex" = "<body class=`"flex dark:[color-scheme:dark]"
    "dark:text-amber-800" = "dark:text-amber-300"
    "text-amber-800 outline-none focus:border-amber-500 dark:text-white" = "text-amber-800 dark:text-amber-300 outline-none focus:border-amber-500"
}

foreach ($f in $files) {
    if (Test-Path $f) {
        $text = [System.IO.File]::ReadAllText("$pwd\$f", [System.Text.Encoding]::UTF8)
        
        foreach ($key in $replacements.Keys) {
            $text = $text.Replace($key, $replacements[$key])
        }
        
        [System.IO.File]::WriteAllText("$pwd\$f", $text, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed $f"
    }
}
