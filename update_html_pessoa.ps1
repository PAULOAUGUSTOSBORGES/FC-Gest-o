$files = @("financeiro.html", "compras.html", "relatorios.html", "gestao.html", "vendas_gestao.html")

$oldDiv = @'
                        <div><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Favorecido / Pagador *</label>
                        <input type="text" id="conta-pessoa" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 dark:text-white" placeholder="Nome do Cliente ou Fornecedor"></div>
'@

$newDiv = @'
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Favorecido / Pagador *</label>
                            <div class="flex gap-2">
                                <select id="conta-pessoa-select" class="w-1/2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 dark:text-white" onchange="
                                    if(this.value) { 
                                        document.getElementById('conta-pessoa').value = ''; 
                                        document.getElementById('conta-pessoa').classList.add('hidden'); 
                                    } else { 
                                        document.getElementById('conta-pessoa').classList.remove('hidden'); 
                                        document.getElementById('conta-pessoa').focus();
                                    }
                                "></select>
                                <input type="text" id="conta-pessoa" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 dark:text-white" placeholder="Novo Cliente/Fornecedor (Avulso)...">
                            </div>
                        </div>
'@

foreach ($f in $files) {
    if (Test-Path $f) {
        $content = Get-Content -Raw -Path $f
        if ($content -match 'id="conta-pessoa"') {
            # Let's replace using string replace instead of regex to avoid escaping issues
            $content = $content.Replace($oldDiv, $newDiv)
            [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
            Write-Host "Updated $f"
        }
    }
}
