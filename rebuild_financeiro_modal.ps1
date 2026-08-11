$html = Get-Content -Raw -Path 'financeiro.html'

# Find where the main section ends (before the broken modal fragments)
$mainClose = '</div>
        </main>
    </div>'

# Find the first occurrence of the renegociacao modal (which is intact)
$renegStart = '<!-- MODAL RENEGOCIAÃ‡ÃO'
$renegStart2 = '<!-- MODAL RENEGOCIACAO'
$renegStart3 = 'modal-renegociacao'

$idx1 = $html.IndexOf('<div id="modal-renegociacao"')
if ($idx1 -lt 0) {
    Write-Host "modal-renegociacao not found"
    exit 1
}

# Find the main tag close before the broken fragments
# We look for the closing of the financeiro main tab area which ends before the modal section
$mainPattern = '</div>
                </div>

            </div>
        </main>
    </div>'

$idx2 = $html.IndexOf($mainPattern)
Write-Host "main pattern at: $idx2"
Write-Host "renegociacao at: $idx1"

$before = $html.Substring(0, $idx2 + $mainPattern.Length)
$after = $html.Substring($idx1)

$newModal = @'

    <!-- M O D A I S -->

    <!-- MODAL NOVA CONTA -->
    <div id="modal-nova-conta" class="fixed inset-0 bg-slate-900/80 z-[200] hidden flex items-center justify-center p-4 backdrop-blur-sm">
        <div class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]">
            <div id="modal-conta-header" class="p-4 md:p-5 text-white flex justify-between items-center shrink-0">
                <h3 class="font-bold text-base md:text-lg flex items-center gap-2"><i class="fa-solid fa-money-bill-wave"></i> <span id="modal-conta-title">Novo Título</span></h3>
                <button onclick="fecharModalConta()" class="text-white/70 hover:text-white transition-colors"><i class="fa-solid fa-xmark text-xl md:text-2xl"></i></button>
            </div>
            <div class="p-4 md:p-6 bg-slate-800 flex-1 overflow-y-auto custom-scrollbar">
                <input type="hidden" id="conta-id">
                <input type="hidden" id="conta-tipo">

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

                    <!-- BLOCO 1: DADOS GERAIS -->
                    <div class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-2">
                        <h4 class="text-xs font-bold text-slate-300 uppercase border-b border-slate-600 pb-2"><i class="fa-solid fa-user-tag text-slate-400 mr-1"></i> Dados Gerais</h4>

                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block" id="lbl-conta-pessoa">Fornecedor / Favorecido *</label>
                            <select id="conta-pessoa-select" class="w-full bg-slate-800 border border-slate-600 text-slate-100 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 mb-2" onchange="toggleContaPessoaInput(this.value)">
                                <option value="">-- Selecione um cadastrado --</option>
                            </select>
                            <div id="conta-pessoa-novo-wrap" class="hidden">
                                <input type="text" id="conta-pessoa" class="w-full bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 font-bold" placeholder="Digite o nome do novo Fornecedor/Cliente...">
                                <p class="text-[10px] text-slate-400 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>Sera cadastrado automaticamente ao salvar.</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="col-span-2 sm:col-span-1"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Descricao da Despesa/Receita</label>
                            <input type="text" id="conta-ref" class="w-full bg-slate-800 border border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 text-slate-100 placeholder-slate-500" placeholder="Ex: Referente a NF 1234..."></div>
                            <div class="col-span-2 sm:col-span-1"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Categoria *</label>
                            <select id="conta-categoria" class="w-full bg-slate-800 border border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 text-slate-100"></select></div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="col-span-2 sm:col-span-1"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Centro de Custo</label>
                            <select id="conta-centro-custo" class="w-full bg-slate-800 border border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 text-slate-100">
                                <option value="Geral">Geral / Nao Especificado</option><option value="Operacional">Operacional</option><option value="Administrativo">Administrativo</option><option value="Vendas">Vendas / Comercial</option><option value="Logistica">Logistica / Frete</option>
                            </select></div>
                            <div class="col-span-2 sm:col-span-1"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Conta Bancaria / Destino</label>
                            <select id="conta-banco" class="w-full bg-slate-800 border border-slate-600 p-2 md:p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 text-slate-100">
                                <option value="Caixa Fisico">Gaveta / Caixa Fisico</option><option value="Banco Itau">Banco Itau</option><option value="Banco do Brasil">Banco do Brasil</option><option value="Nubank">Nubank</option><option value="Sicredi">Sicredi</option><option value="Sicoob">Sicoob</option>
                            </select></div>
                        </div>
                    </div>

                    <!-- BLOCO 2: DATAS, VALORES E RECORRENCIA -->
                    <div class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4">
                        <h4 class="text-xs font-bold text-slate-300 uppercase border-b border-slate-600 pb-2"><i class="fa-solid fa-calendar-days text-slate-400 mr-1"></i> Datas e Valores</h4>

                        <div class="grid grid-cols-2 gap-3">
                            <div><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Data de Emissao</label>
                            <input type="date" id="conta-emissao" class="w-full bg-slate-800 border border-slate-600 p-2 rounded-lg text-xs outline-none focus:border-blue-400 text-slate-100"></div>

                            <div><label class="text-[10px] font-bold text-amber-400 uppercase mb-1 block">Vencimento Base *</label>
                            <input type="date" id="conta-vencimento" class="w-full bg-amber-900/30 border border-amber-600 p-2 rounded-lg text-xs font-bold text-amber-300 outline-none focus:border-amber-400"></div>
                        </div>

                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
                            <div class="col-span-2">
                                <label class="text-[10px] font-bold text-red-400 uppercase mb-1 block">Data para Protesto / Cartorio</label>
                                <input type="date" id="conta-cartorio" class="w-full bg-slate-800 border border-red-700 p-2 rounded-lg text-xs font-bold outline-none focus:border-red-500 text-slate-100">
                            </div>
                            <div class="col-span-1">
                                <label class="text-[10px] font-bold text-red-400 uppercase mb-1 block">Multa (%)</label>
                                <input type="number" step="0.01" id="conta-multa" class="w-full bg-slate-800 border border-red-700 p-2 rounded-lg text-xs font-bold outline-none focus:border-red-500 text-slate-100" placeholder="Ex: 2.00">
                            </div>
                            <div class="col-span-1">
                                <label class="text-[10px] font-bold text-red-400 uppercase mb-1 block">Juros (% a.m.)</label>
                                <input type="number" step="0.01" id="conta-juros" class="w-full bg-slate-800 border border-red-700 p-2 rounded-lg text-xs font-bold outline-none focus:border-red-500 text-slate-100" placeholder="Ex: 1.00">
                            </div>
                        </div>

                        <!-- RECORRENCIA -->
                        <div class="grid grid-cols-2 gap-3 p-3 bg-slate-800 border border-slate-600 rounded-lg">
                            <div class="col-span-2 sm:col-span-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Repetir (Assinatura)?</label>
                                <select id="conta-recorrencia" class="w-full bg-slate-700 border border-slate-600 p-2 rounded-lg text-xs font-bold outline-none focus:border-blue-400 text-slate-100" onchange="toggleRecorrencia()">
                                    <option value="UNICA">Nao (Unica)</option>
                                    <option value="MENSAL">Mensal</option>
                                    <option value="QUINZENAL">Quinzenal</option>
                                    <option value="SEMANAL">Semanal</option>
                                    <option value="ANUAL">Anual</option>
                                </select>
                            </div>
                            <div id="div-qtd-recorrencia" class="col-span-2 sm:col-span-1 hidden">
                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Quantas Vezes?</label>
                                <input type="number" id="conta-qtd-recorrencia" value="12" min="2" max="120" class="w-full bg-slate-700 border border-slate-600 p-2 rounded-lg text-xs font-bold outline-none focus:border-blue-400 text-slate-100">
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Competencia (Mes/Ano Ref.)</label>
                            <input type="month" id="conta-competencia" class="w-full bg-slate-800 border border-slate-600 p-2 rounded-lg text-xs outline-none focus:border-blue-400 text-slate-100">
                        </div>

                        <div class="pt-2 border-t border-slate-600">
                            <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Valor Unitario da Parcela *</label>
                            <input type="number" step="0.01" id="conta-valor" oninput="calcularValorFinalFormulario()" class="w-full bg-blue-900/40 border border-blue-600 p-2 md:p-3 rounded-lg text-base md:text-lg font-black text-blue-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-900 transition-all text-right" placeholder="0,00">
                        </div>
                    </div>

                    <!-- BLOCO 3: STATUS, MULTAS E DOCUMENTOS -->
                    <div class="bg-slate-700 p-4 rounded-xl border border-slate-600 shadow-sm space-y-4 md:col-span-3">
                        <h4 class="text-xs font-bold text-slate-300 uppercase border-b border-slate-600 pb-2"><i class="fa-solid fa-list-check text-slate-400 mr-1"></i> Situacao e Documentos</h4>

                        <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            <div class="sm:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Status Atual</label>
                                <select id="conta-status" class="w-full bg-slate-800 border border-slate-600 p-2 rounded-lg text-xs font-bold outline-none focus:border-blue-400 text-slate-100">
                                    <option value="PENDENTE">Em Aberto / Pendente</option><option value="PAGO">Liquidado / Pago</option><option value="CANCELADO">Cancelado</option><option value="RENEGOCIADO">Renegociado</option>
                                </select>
                            </div>

                            <div class="sm:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Data de Pagamento</label>
                            <input type="date" id="conta-data-pgto" class="w-full bg-emerald-900/30 border border-emerald-700 p-2 rounded-lg text-xs font-bold text-emerald-300 outline-none focus:border-emerald-500"></div>

                            <div class="sm:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Forma de Pagamento</label>
                                <select id="conta-metodo" class="w-full bg-slate-800 border border-slate-600 p-2 rounded-lg text-xs outline-none focus:border-blue-400 text-slate-100">
                                    <option value="">Ainda nao pago</option><option value="PIX">PIX</option><option value="Dinheiro">Dinheiro</option><option value="Boleto">Boleto</option><option value="Cartao">Cartao (Debito/Credito)</option><option value="TED">TED / DOC / Transferencia</option>
                                </select>
                            </div>

                            <div><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">No da NF</label><input type="text" id="conta-num-nf" class="w-full bg-slate-800 border border-slate-600 p-2 rounded-lg text-xs outline-none focus:border-blue-400 text-slate-100"></div>
                            <div class="sm:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">No do Boleto / Cod. Barras</label><input type="text" id="conta-num-boleto" class="w-full bg-slate-800 border border-slate-600 p-2 rounded-lg text-xs outline-none focus:border-blue-400 text-slate-100"></div>

                            <div><label class="text-[10px] font-bold text-red-400 uppercase mb-1 block">Juros / Multa (+)</label><input type="number" step="0.01" id="conta-acrescimo" oninput="calcularValorFinalFormulario()" class="w-full bg-red-900/30 border border-red-700 text-red-300 p-2 rounded-lg text-xs font-bold outline-none text-right" value="0"></div>
                            <div><label class="text-[10px] font-bold text-emerald-400 uppercase mb-1 block">Desconto (-)</label><input type="number" step="0.01" id="conta-desconto" oninput="calcularValorFinalFormulario()" class="w-full bg-emerald-900/30 border border-emerald-700 text-emerald-300 p-2 rounded-lg text-xs font-bold outline-none text-right" value="0"></div>

                            <div class="sm:col-span-1"><label class="text-[10px] font-bold text-orange-400 uppercase mb-1 block">Multa Atraso (%)</label><input type="number" step="0.01" id="conta-multa" class="w-full bg-orange-900/30 border border-orange-700 text-orange-300 p-2 rounded-lg text-xs font-bold outline-none text-right" value="0" placeholder="Ex: 2"></div>
                            <div class="sm:col-span-1"><label class="text-[10px] font-bold text-orange-400 uppercase mb-1 block">Juros ao Mes (%)</label><input type="number" step="0.01" id="conta-juros" class="w-full bg-orange-900/30 border border-orange-700 text-orange-300 p-2 rounded-lg text-xs font-bold outline-none text-right" value="0" placeholder="Ex: 1"></div>

                            <div class="bg-slate-900 rounded-lg p-2 text-white flex flex-col justify-center items-end">
                                <span class="text-[10px] font-bold text-slate-400 uppercase">Valor Final / Parcela</span>
                                <span class="text-lg font-black text-emerald-400" id="conta-valor-final-display">R$ 0,00</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t border-slate-600 pt-4">
                            <div>
                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Observacoes Livres</label>
                                <textarea id="conta-obs" rows="3" class="w-full bg-slate-800 border border-slate-600 p-2 rounded-lg text-xs outline-none focus:border-blue-400 custom-scrollbar text-slate-100" placeholder="Anotacoes, dados de renegociacao..."></textarea>
                            </div>
                            <div>
                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Anexar Comprovante / PDF / Imagem</label>
                                <div class="bg-slate-800 border-2 border-dashed border-slate-600 rounded-lg p-4 flex flex-col items-center justify-center h-[76px]">
                                    <input type="file" id="conta-anexo" class="text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-900 file:text-blue-300 w-full outline-none">
                                    <input type="hidden" id="conta-anexo-base64">
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            <div class="bg-slate-900 p-4 md:p-5 border-t border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-2xl">
                <button onclick="fecharModalConta()" class="px-6 py-2.5 bg-slate-700 border border-slate-600 rounded-xl font-bold text-slate-200 text-sm hover:bg-slate-600 transition-colors shadow-sm">Cancelar</button>
                <button onclick="salvarConta()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-2.5 rounded-xl text-sm shadow-md transition-transform active:scale-95"><i class="fa-solid fa-save mr-1"></i> Salvar Lancamento</button>
            </div>
        </div>
    </div>

    <!-- MODAL RENEGOCIACAO -->
    <div id="modal-renegociacao" class="fixed inset-0 bg-slate-900/80 z-[250] hidden flex items-center justify-center p-4 backdrop-blur-sm">
'@

if ($idx2 -lt 0) {
    Write-Host "Could not find main close pattern. Trying alternative..."
    # Try finding right before renegociacao
    $newHtml = $before + "`n" + $newModal + $after
} else {
    $newHtml = $before + $newModal + $after
}

# Remove duplicate modal-renegociacao (we added one in newModal, so remove the old div tag from $after)
$oldRenegTag = '<div id="modal-renegociacao" class="fixed inset-0 bg-slate-900/80 z-[250] hidden flex items-center justify-center p-4 backdrop-blur-sm">'
$newRenegTag = ''
$newHtml = $newHtml.Replace($oldRenegTag, $newRenegTag, 1)  # Remove first occurrence only

[System.IO.File]::WriteAllText("$(Get-Location)\financeiro.html", $newHtml, [System.Text.Encoding]::UTF8)
Write-Host "Done! Lines: $($newHtml.Split("`n").Count)"
