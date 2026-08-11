$files = @("financeiro.html", "compras.html", "relatorios.html", "gestao.html", "vendas_gestao.html")

# 1. Remove white background from BLOCO 1 and BLOCO 2 divs
$oldBloco1Class = 'class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-2"'
$newBloco1Class = 'class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-2"'
$oldBloco2Class = 'class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"'
$newBloco2Class = 'class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"'

# The outer modal content wrapper (bg-slate-50)
$oldOuterWrapper = 'class="p-4 md:p-6 bg-slate-50 dark:bg-slate-900 flex-1 overflow-y-auto custom-scrollbar"'
$newOuterWrapper = 'class="p-4 md:p-6 bg-slate-800 dark:bg-slate-900 flex-1 overflow-y-auto custom-scrollbar"'

# 2. The "conta-pessoa" field needs to be replaced with the smarter dual component
$oldPessoa = @'
                        <div><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Favorecido / Pagador *</label>
                        <input type="text" id="conta-pessoa" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 dark:text-white" placeholder="Nome do Cliente ou Fornecedor"></div>
'@

$newPessoa = @'
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Fornecedor / Favorecido *</label>
                            <select id="conta-pessoa-select" class="w-full bg-slate-700 dark:bg-slate-800 border border-slate-600 text-slate-100 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 mb-2" onchange="toggleContaPessoaInput(this.value)">
                                <option value="">-- Selecione um Fornecedor/Cliente cadastrado --</option>
                            </select>
                            <div id="conta-pessoa-novo-wrap" class="hidden">
                                <input type="text" id="conta-pessoa" class="w-full bg-slate-700 dark:bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 font-bold" placeholder="Digite o nome do novo Fornecedor/Cliente...">
                                <p class="text-[10px] text-slate-400 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>Será cadastrado automaticamente ao salvar.</p>
                            </div>
                        </div>
'@

foreach ($f in $files) {
    if (Test-Path $f) {
        $content = Get-Content -Raw -Path $f
        $changed = $false

        if ($content.Contains($oldBloco1Class)) {
            $content = $content.Replace($oldBloco1Class, $newBloco1Class)
            $changed = $true
        }
        if ($content.Contains($oldBloco2Class)) {
            $content = $content.Replace($oldBloco2Class, $newBloco2Class)
            $changed = $true
        }
        if ($content.Contains($oldOuterWrapper)) {
            $content = $content.Replace($oldOuterWrapper, $newOuterWrapper)
            $changed = $true
        }
        if ($content.Contains($oldPessoa)) {
            $content = $content.Replace($oldPessoa, $newPessoa)
            $changed = $true
        }

        if ($changed) {
            [System.IO.File]::WriteAllText("$(Get-Location)\$f", $content, [System.Text.Encoding]::UTF8)
            Write-Host "Updated $f"
        } else {
            Write-Host "No changes in $f"
        }
    }
}
