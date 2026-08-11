# Reconstruct financeiro.html using gestao.html as template for the modal section
# 1. Read gestao.html
$gestao = Get-Content -Raw -Path 'gestao.html'

# 2. Extract the modal-nova-conta block from gestao.html
$modalStart = '<div id="modal-nova-conta"'
$renegStart = '<div id="modal-renegociacao"'

$idxModalStart = $gestao.IndexOf($modalStart)
$idxRenegStart = $gestao.IndexOf($renegStart)

$modalBlock = $gestao.Substring($idxModalStart, $idxRenegStart - $idxModalStart)
Write-Host "Modal block length: $($modalBlock.Length)"

# 3. Patch the modal block: replace old simple input with dropdown
$oldPessoa = '                        <div><label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Favorecido / Pagador *</label>
                        <input type="text" id="conta-pessoa" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 dark:text-white" placeholder="Nome do Cliente ou Fornecedor"></div>'

$newPessoa = '                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Fornecedor / Favorecido *</label>
                            <select id="conta-pessoa-select" class="w-full bg-slate-800 border border-slate-600 text-slate-100 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 mb-2" onchange="toggleContaPessoaInput(this.value)">
                                <option value="">-- Selecione um cadastrado --</option>
                            </select>
                            <div id="conta-pessoa-novo-wrap" class="hidden">
                                <input type="text" id="conta-pessoa" class="w-full bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 font-bold" placeholder="Digite o nome do novo Fornecedor/Cliente...">
                                <p class="text-[10px] text-slate-400 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>Sera cadastrado automaticamente ao salvar.</p>
                            </div>
                        </div>'

if ($modalBlock.Contains($oldPessoa)) {
    $modalBlock = $modalBlock.Replace($oldPessoa, $newPessoa)
    Write-Host "Dropdown patched!"
} else {
    Write-Host "WARNING: old pessoa not found in modal block"
}

# 4. Replace the outer modal wrapper bg-white with bg-slate-800
$modalBlock = $modalBlock.Replace(
    '<div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]">',
    '<div class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]">'
)
$modalBlock = $modalBlock.Replace(
    'class="p-4 md:p-6 bg-slate-800 dark:bg-slate-900 flex-1 overflow-y-auto custom-scrollbar"',
    'class="p-4 md:p-6 bg-slate-800 flex-1 overflow-y-auto custom-scrollbar"'
)
# Replace bloco bg-slate-100 with bg-slate-700
$modalBlock = $modalBlock.Replace(
    'class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-2"',
    'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-2"'
)
$modalBlock = $modalBlock.Replace(
    'class="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"',
    'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4"'
)
$modalBlock = $modalBlock.Replace(
    'class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 md:col-span-3"',
    'class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-3"'
)
$modalBlock = $modalBlock.Replace(
    'class="bg-white dark:bg-slate-800 p-4 md:p-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-2xl"',
    'class="bg-slate-900 p-4 md:p-5 border-t border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-2xl"'
)

# 5. Read current financeiro.html (it has the modal-renegociacao and the rest intact from idx=172 approx)
$fin = Get-Content -Raw -Path 'financeiro.html'

# 6. Find where modal-renegociacao starts in current financeiro.html
$finRenegIdx = $fin.IndexOf('<div id="modal-renegociacao"')
Write-Host "Renegociacao idx in financeiro.html: $finRenegIdx"

if ($finRenegIdx -lt 0) {
    Write-Host "ERROR: modal-renegociacao not found"
    exit 1
}

# 7. Find the gestao.html complete structure before the modal-nova-conta
# We'll reconstruct: [financeiro-specific head+nav+main content] + [patched modal block] + [renegociacao onwards from current financeiro.html]

# The "before" part: use gestao.html's structure up to the modal-nova-conta position
# but replace "Gestao e Financeiro" title with "FINANCEIRO" and adjust references

# Actually, the current financeiro.html still has the correct head+nav+main from line 1-549
# We just need to find where the main content ends and modal begins

# Look for a marker that's at the end of the main content in the current file
# The current file starts with truncated content. Let's check what's at line ~410 area

$renegoniacao = $fin.Substring($finRenegIdx)
$newContent = "    <!-- MODAL NOVA CONTA -->`n    " + $modalBlock.Trim() + "`n`n    <!-- MODAL RENEGOCIACAO -->`n    " + $renegoniacao

# Where should we insert? Before the first modal-nova-conta or renegociacao
# Current file: starts truncated from <!DOCTYPE...> to old stuff
# Let's find the "<!-- M O D A I S" comment or we look for the char before renegociacao idx

$before = $fin.Substring(0, $finRenegIdx)
# Remove trailing "<!-- MODAL" comments we may have added
$cleanBefore = $before.TrimEnd()
if ($cleanBefore.EndsWith('<!-- MODAL RENEGOCIACAO -->')) {
    $cleanBefore = $cleanBefore.Substring(0, $cleanBefore.Length - '<!-- MODAL RENEGOCIACAO -->'.Length).TrimEnd()
}
if ($cleanBefore.EndsWith('<!-- MODAL NOVA CONTA -->')) {
    $cleanBefore = $cleanBefore.Substring(0, $cleanBefore.Length - '<!-- MODAL NOVA CONTA -->'.Length).TrimEnd()
}
if ($cleanBefore.EndsWith('<!-- M O D A I S -->')) {
    $cleanBefore = $cleanBefore.Substring(0, $cleanBefore.Length - '<!-- M O D A I S -->'.Length).TrimEnd()
}

$finalHtml = $cleanBefore + "`n`n    <!-- M O D A I S -->`n`n    <!-- MODAL NOVA CONTA -->`n    " + $modalBlock.Trim() + "`n`n    " + $renegoniacao

[System.IO.File]::WriteAllText("$(Get-Location)\financeiro.html", $finalHtml, [System.Text.Encoding]::UTF8)
Write-Host "Done! Total length: $($finalHtml.Length)"
