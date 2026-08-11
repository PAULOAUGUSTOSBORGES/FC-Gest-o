$files = @("financeiro.html", "gestao.html", "compras.html", "relatorios.html", "vendas_gestao.html")

$replacements = @{
    # Encoding fixes
    "GestÃ£o" = "Gestão"
    "MÃ“DULO" = "MÓDULO"
    "DescriÃ§Ã£o" = "Descrição"
    "NÃ£o Especificado" = "Não Especificado"
    "OperaÃ§Ã£onal" = "Operacional"
    "LogÃ­stica" = "Logística"
    "BancÃ¡ria" = "Bancária"
    "FÃ­sico" = "Físico"
    "ItaÃº" = "Itaú"
    "EmissÃ£o" = "Emissão"
    "NÃ£o (ÃƒÅ¡nica)" = "Não (Única)"
    "RECORRÃƒÂ Ã…Â NCIA" = "RECORRÊNCIA"
    "COMPETÃƒÂ Ã…Â NCIA" = "COMPETÊNCIA"
    "UNITÃƒÂRIO" = "UNITÁRIO"
    "SituaÃ§Ã£o" = "Situação"
    "CartÃ£o" = "Cartão"
    "DÃ©bito/CrÃ©dito" = "Débito/Crédito"
    "TransferÃªncia" = "Transferência"
    "NÂº" = "Nº"
    "CÃ³d." = "Cód."
    "ObservaÃ§Ãµes" = "Observações"
    "LanÃ§amento" = "Lançamento"
    "TÃ­tulo" = "Título"
    "ÃƒÂ Ã‚Â" = "à"
    "MÃƒÂŠS" = "MÊS"
    "RECORRÃŠNCIA" = "RECORRÊNCIA"
    "NÃ£o (Ãšnica)" = "Não (Única)"
    "SituaÃ§Ã£o" = "Situação"

    # Background fixes for the modal inputs (make them look consistent in dark mode)
    'w-full bg-amber-50 border border-amber-300 p-2 rounded-lg text-xs font-bold text-amber-800 outline-none focus:border-amber-500 dark:text-white' = 'w-full bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 p-2 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300 outline-none focus:border-amber-500'
    'bg-slate-50 dark:bg-slate-900' = 'bg-slate-50 dark:bg-slate-800'
    'border-slate-300 dark:border-slate-600' = 'border-slate-300 dark:border-slate-500'
    'bg-white dark:bg-slate-800' = 'bg-white dark:bg-slate-700'
    'text-slate-600 dark:text-slate-300' = 'text-slate-600 dark:text-slate-200'
    'border-slate-100 dark:border-slate-700' = 'border-slate-100 dark:border-slate-600'
    'bg-red-50 dark:bg-red-900/10' = 'bg-red-50 dark:bg-red-900/30'
    'bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-xs font-bold text-emerald-800 outline-none focus:border-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white' = 'w-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 p-2 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-300 outline-none focus:border-emerald-500'
    'bg-blue-50 border border-blue-300 p-2 md:p-3 rounded-lg text-base md:text-lg font-black text-blue-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all text-right dark:bg-slate-800 dark:border-slate-600 dark:text-white' = 'w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 p-2 md:p-3 rounded-lg text-base md:text-lg font-black text-blue-800 dark:text-blue-300 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all text-right'
    'bg-orange-50 border border-orange-200 text-orange-700 p-2 rounded-lg text-xs font-bold outline-none text-right dark:bg-slate-800 dark:border-slate-600 dark:text-white' = 'w-full bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 p-2 rounded-lg text-xs font-bold outline-none text-right'
    'bg-red-50 border border-red-200 text-red-700 p-2 rounded-lg text-xs font-bold outline-none text-right dark:text-white' = 'w-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-2 rounded-lg text-xs font-bold outline-none text-right'
    'bg-emerald-50 border border-emerald-200 text-emerald-700 p-2 rounded-lg text-xs font-bold outline-none text-right dark:bg-slate-800 dark:border-slate-600 dark:text-white' = 'w-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 p-2 rounded-lg text-xs font-bold outline-none text-right'
}

foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    $content = Get-Content -Raw -Path $f

    foreach ($key in $replacements.Keys) {
        $content = $content.Replace($key, $replacements[$key])
    }

    [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
    Write-Host "$f - fixed encoding and backgrounds"
}
