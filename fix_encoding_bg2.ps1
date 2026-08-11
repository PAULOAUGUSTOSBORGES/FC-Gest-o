$files = @("financeiro.html", "gestao.html", "compras.html", "relatorios.html", "vendas_gestao.html")

$replacements = @{
    'GestÃ£o' = 'Gestão'
    'MÃ“DULO' = 'MÓDULO'
    'DescriÃ§Ã£o' = 'Descrição'
    'NÃ£o Especificado' = 'Não Especificado'
    'OperaÃ§Ã£onal' = 'Operacional'
    'LogÃ­stica' = 'Logística'
    'BancÃ¡ria' = 'Bancária'
    'FÃ­sico' = 'Físico'
    'ItaÃº' = 'Itaú'
    'EmissÃ£o' = 'Emissão'
    'NÃ£o (ÃƒÅ¡nica)' = 'Não (Única)'
    'NÃ£o (Ãšnica)' = 'Não (Única)'
    'RECORRÃƒÂ Ã…Â NCIA' = 'RECORRÊNCIA'
    'RECORRÃŠNCIA' = 'RECORRÊNCIA'
    'COMPETÃƒÂ Ã…Â NCIA' = 'COMPETÊNCIA'
    'COMPETÃŠNCIA' = 'COMPETÊNCIA'
    'UNITÃƒÂ RIO' = 'UNITÁRIO'
    'UNITÃRIO' = 'UNITÁRIO'
    'SituaÃ§Ã£o' = 'Situação'
    'CartÃ£o' = 'Cartão'
    'DÃ©bito/CrÃ©dito' = 'Débito/Crédito'
    'TransferÃªncia' = 'Transferência'
    'NÂº' = 'Nº'
    'CÃ³d.' = 'Cód.'
    'ObservaÃ§Ãµes' = 'Observações'
    'LanÃ§amento' = 'Lançamento'
    'TÃ­tulo' = 'Título'
    'ÃƒÂ Ã‚Â' = 'à'
    'MÃƒÂŠS' = 'MÊS'
    'MÃŠS' = 'MÊS'
    'Sera cadastrado' = 'Será cadastrado'

    'bg-amber-50 border border-amber-300' = 'bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600'
    'text-amber-800 outline-none' = 'text-amber-800 dark:text-amber-300 outline-none'
    'bg-slate-50 dark:bg-slate-900' = 'bg-slate-50 dark:bg-slate-800'
    'border-slate-300 dark:border-slate-600' = 'border-slate-300 dark:border-slate-500'
    'bg-white dark:bg-slate-800' = 'bg-white dark:bg-slate-700'
    'text-slate-600 dark:text-slate-300' = 'text-slate-600 dark:text-slate-200'
    'border-slate-100 dark:border-slate-700' = 'border-slate-100 dark:border-slate-600'
    'bg-red-50 dark:bg-red-900/10' = 'bg-red-50 dark:bg-red-900/30'
}

foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    $content = Get-Content -Raw -Path $f -Encoding UTF8

    foreach ($key in $replacements.Keys) {
        $content = $content.Replace($key, $replacements[$key])
    }

    [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
    Write-Host "$f - fixed encoding and backgrounds"
}
