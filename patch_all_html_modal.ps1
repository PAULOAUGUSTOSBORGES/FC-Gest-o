$files = @("gestao.html", "compras.html", "relatorios.html", "vendas_gestao.html")

$oldPessoa = '<div><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Favorecido / Pagador *</label>' + "`r`n" + '                        <input type="text" id="conta-pessoa" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 dark:text-white" placeholder="Nome do Cliente ou Fornecedor"></div>'

$newPessoa = '<div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Fornecedor / Favorecido *</label>
                            <select id="conta-pessoa-select" class="w-full bg-slate-800 border border-slate-600 text-slate-100 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 mb-2" onchange="toggleContaPessoaInput(this.value)">
                                <option value="">-- Selecione um cadastrado --</option>
                            </select>
                            <div id="conta-pessoa-novo-wrap" class="hidden">
                                <input type="text" id="conta-pessoa" class="w-full bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 font-bold" placeholder="Digite o nome do novo Fornecedor/Cliente...">
                                <p class="text-[10px] text-slate-400 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>Sera cadastrado automaticamente ao salvar.</p>
                            </div>
                        </div>'

foreach ($f in $files) {
    if (-not (Test-Path $f)) { Write-Host "Not found: $f"; continue }
    $content = Get-Content -Raw -Path $f

    if ($content.Contains($oldPessoa)) {
        $content = $content.Replace($oldPessoa, $newPessoa)
        Write-Host "$f - dropdown patched"
    } else {
        # Try also with \n instead of \r\n
        $oldPessoa2 = '<div><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Favorecido / Pagador *</label>' + "`n" + '                        <input type="text" id="conta-pessoa" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 dark:text-white" placeholder="Nome do Cliente ou Fornecedor"></div>'
        if ($content.Contains($oldPessoa2)) {
            $content = $content.Replace($oldPessoa2, $newPessoa)
            Write-Host "$f - dropdown patched (alt)"
        } else {
            Write-Host "$f - NOT FOUND"
        }
    }

    # Also update modal backgrounds
    $content = $content.Replace('class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]"', 'class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]"')
    $content = $content.Replace('class="p-4 md:p-6 bg-slate-800 dark:bg-slate-900 flex-1 overflow-y-auto custom-scrollbar"', 'class="p-4 md:p-6 bg-slate-800 flex-1 overflow-y-auto custom-scrollbar"')
    $content = $content.Replace('class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-2"', 'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-2"')
    $content = $content.Replace('class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"', 'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4"')
    $content = $content.Replace('class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-3"', 'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-3"')
    $content = $content.Replace('class="bg-white dark:bg-slate-800 p-4 md:p-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-2xl"', 'class="bg-slate-900 p-4 md:p-5 border-t border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-2xl"')

    [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
    Write-Host "$f - saved"
}

Write-Host "Done!"
