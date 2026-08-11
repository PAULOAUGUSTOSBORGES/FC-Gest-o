# Full reconstruction of financeiro.html based on gestao.html
# The files share the same layout. We just need to:
# 1. Change the title and the JS script reference
# 2. Replace modal-nova-conta's pessoa field with dropdown
# 3. Update dark backgrounds

$gestao = Get-Content -Raw -Path 'gestao.html'

# Step 1: Apply financeiro-specific substitutions
$result = $gestao

# Title
$result = $result.Replace('FC Móveis - Gestão e Financeiro', 'FC Móveis - FINANCEIRO')
$result = $result.Replace('FC M&oacute;veis - Gest&atilde;o e Financeiro', 'FC M&oacute;veis - FINANCEIRO')

# Script reference  
$result = $result.Replace('src="gestao.js"', 'src="financeiro.js"')
$result = $result.Replace("src='gestao.js'", "src='financeiro.js'")

# Step 2: Replace modal conta-pessoa simple input with dropdown
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

if ($result.Contains($oldPessoa)) {
    $result = $result.Replace($oldPessoa, $newPessoa)
    Write-Host "Dropdown patched!"
} else {
    Write-Host "Trying alternative line endings..."
    $oldPessoa2 = '<div><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Favorecido / Pagador *</label>' + "`n" + '                        <input type="text" id="conta-pessoa" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 dark:text-white" placeholder="Nome do Cliente ou Fornecedor"></div>'
    if ($result.Contains($oldPessoa2)) {
        $result = $result.Replace($oldPessoa2, $newPessoa)
        Write-Host "Dropdown patched (alt)!"
    } else {
        Write-Host "WARNING: Could not find old pessoa field"
        # Search for it
        $idx = $result.IndexOf('id="conta-pessoa"')
        Write-Host "conta-pessoa at: $idx"
        Write-Host "Context: '$($result.Substring([Math]::Max(0,$idx-200), 400))'"
    }
}

# Step 3: Remove dark card backgrounds (make them slate-700 not white)
$result = $result.Replace('class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]"', 'class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]"')
$result = $result.Replace('class="p-4 md:p-6 bg-slate-800 dark:bg-slate-900 flex-1 overflow-y-auto custom-scrollbar"', 'class="p-4 md:p-6 bg-slate-800 flex-1 overflow-y-auto custom-scrollbar"')
$result = $result.Replace(
    'class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-2"',
    'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-2"'
)
$result = $result.Replace(
    'class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"',
    'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4"'
)
$result = $result.Replace(
    'class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-3"',
    'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-3"'
)
$result = $result.Replace(
    'class="bg-white dark:bg-slate-800 p-4 md:p-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-2xl"',
    'class="bg-slate-900 p-4 md:p-5 border-t border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-2xl"'
)

[System.IO.File]::WriteAllText("$(Get-Location)\financeiro.html", $result, [System.Text.Encoding]::UTF8)
Write-Host "Done! File size: $($result.Length)"
Write-Host "Line count: $($result.Split("`n").Count)"
