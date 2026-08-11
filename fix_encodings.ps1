$files = Get-ChildItem "*.html" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    # 1. Reverse the Windows-1252 to UTF-8 mojibake (e.g., "GestÃ£o" -> "Gestão")
    $c = $c -replace 'GestÃ£o', 'Gestão'
    $c = $c -replace 'MÃ³veis', 'Móveis'
    $c = $c -replace 'SituaÃ§Ã£o', 'Situação'
    $c = $c -replace 'NÃ£o', 'Não'
    $c = $c -replace 'Ãšnica', 'Única'
    $c = $c -replace 'MÃªs', 'Mês'
    $c = $c -replace 'OperaÃ§Ã£o', 'Operação'
    $c = $c -replace 'OperaÃ§Ã£onal', 'Operacional'
    $c = $c -replace 'RECORRÃŠNCIA', 'RECORRÊNCIA'
    $c = $c -replace 'Referente Ã\s*NF', 'Referente à NF'
    $c = $c -replace 'Referente Ã\s*Â\s*NF', 'Referente à NF'
    $c = $c -replace 'à\s*NF', 'à NF'
    $c = $c -replace 'Ã ', 'à'
    
    $c = $c -replace 'HistÃ³rico', 'Histórico'
    $c = $c -replace 'AÃ§Ãµes', 'Ações'
    $c = $c -replace 'AÃ§es', 'Ações'
    $c = $c -replace 'ServiÃ§os', 'Serviços'
    $c = $c -replace 'OrÃ§amentos', 'Orçamentos'
    $c = $c -replace 'FuncionÃ¡rios', 'Funcionários'
    $c = $c -replace 'InÃcio', 'Início'
    $c = $c -replace 'In\.cio', 'Início'
    $c = $c -replace 'VISÃƒO GERAL', 'VISÃO GERAL'
    $c = $c -replace 'OPERAÃ‡ÃƒO', 'OPERAÇÃO'

    # Reverse double mojibake just in case
    $c = $c -replace 'GestÃƒÂ£o', 'Gestão'
    $c = $c -replace 'SituaÃƒÂ§ÃƒÂ£o', 'Situação'
    $c = $c -replace 'FuncionÃƒÂ¡rios', 'Funcionários'
    $c = $c -replace 'VISÃƒÂƒO GERAL', 'VISÃO GERAL'
    $c = $c -replace 'OPERAÃƒÂ‡ÃƒÂƒO', 'OPERAÇÃO'

    # Fix other known corruptions in headers/sidebar
    $c = $c -replace 'Funcion.rios /Ãƒâ€°Âº Vendedores', 'Funcionários / Vendedores'
    $c = $c -replace 'Funcionários /.*? Vendedores', 'Funcionários / Vendedores'
    $c = $c -replace 'Funcion.rios /.*% Vendedores', 'Funcionários / Vendedores'
    $c = $c -replace 'A..o: Vincular ou Cadastrar', 'Ação: Vincular ou Cadastrar'
    $c = $c -replace 'Pre.o R\$', 'Preço R$'
    $c = $c -replace 'C.d Barras', 'Cód Barras'

    # JS files fix for text
    $c = $c -replace 'A.es', 'Ações'
    $c = $c -replace 'Aes', 'Ações'
    $c = $c -replace 'Incio', 'Início'
    $c = $c -replace 'Operao', 'Operação'
    $c = $c -replace 'Servios', 'Serviços'
    $c = $c -replace 'Histrico', 'Histórico'
    $c = $c -replace 'Gesto', 'Gestão'
    $c = $c -replace 'Oramentos', 'Orçamentos'
    $c = $c -replace 'Funcionrios', 'Funcionários'
    $c = $c -replace 'VISO GERAL', 'VISÃO GERAL'
    $c = $c -replace 'OPERAO', 'OPERAÇÃO'
    $c = $c -replace 'Preo', 'Preço'
    $c = $c -replace 'Cd Barras', 'Cód Barras'
    $c = $c -replace 'Configura.es', 'Configurações'

    [System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
}
