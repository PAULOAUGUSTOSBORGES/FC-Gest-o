// ==========================================
// NCM HELPER - BUSCA E AUTOCOMPLETE DE NCMês
// Suporte a todos os 10.437 códigos NCM do Brasil
// ==========================================

(function() {
    let mapaNCM = null;

    function injetarEstilosNCM() {
        if (typeof document === 'undefined' || document.getElementById('ncm-autocomplete-styles')) return;
        const style = document.createElement('style');
        style.id = 'ncm-autocomplete-styles';
        style.textContent = `
            .ncm-autocomplete-dropdown {
                position: absolute;
                left: 0;
                right: 0;
                top: calc(100% + 4px);
                max-height: 260px;
                overflow-y: auto;
                border-radius: 10px;
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.15);
                z-index: 99999 !important;
            }
            .dark .ncm-autocomplete-dropdown,
            [data-theme="dark"] .ncm-autocomplete-dropdown,
            .dark-theme .ncm-autocomplete-dropdown {
                background-color: #0f172a !important;
                border: 1px solid #334155 !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important;
            }
            .ncm-opcao {
                padding: 10px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                border-bottom: 1px solid #f1f5f9;
                transition: background-color 0.15s ease, color 0.15s ease;
                background-color: #ffffff;
                color: #0f172a;
                text-align: left;
            }
            .dark .ncm-opcao,
            [data-theme="dark"] .ncm-opcao,
            .dark-theme .ncm-opcao {
                background-color: #0f172a !important;
                color: #f8fafc !important;
                border-bottom: 1px solid #1e293b !important;
            }
            .ncm-opcao:hover,
            .ncm-opcao.ncm-ativo {
                background-color: #eff6ff !important;
            }
            .dark .ncm-opcao:hover,
            [data-theme="dark"] .ncm-opcao:hover,
            .dark-theme .ncm-opcao:hover,
            .dark .ncm-opcao.ncm-ativo,
            [data-theme="dark"] .ncm-opcao.ncm-ativo,
            .dark-theme .ncm-opcao.ncm-ativo {
                background-color: #1e293b !important;
            }
            .ncm-code-badge {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-weight: 700;
                font-size: 11px;
                padding: 3px 8px;
                border-radius: 6px;
                background-color: #dbeafe;
                color: #1d4ed8;
                border: 1px solid #bfdbfe;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .dark .ncm-code-badge,
            [data-theme="dark"] .ncm-code-badge,
            .dark-theme .ncm-code-badge {
                background-color: #0369a1 !important;
                color: #e0f2fe !important;
                border: 1px solid #0284c7 !important;
            }
            .ncm-desc-text {
                font-size: 12px;
                line-height: 1.35;
                color: #1e293b;
                flex: 1;
                font-weight: 500;
            }
            .dark .ncm-desc-text,
            [data-theme="dark"] .ncm-desc-text,
            .dark-theme .ncm-desc-text {
                color: #f1f5f9 !important;
            }
            .ncm-descricao-preview {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function obterMapaNCM() {
        if (!mapaNCM && window.TABELA_NCM && Array.isArray(window.TABELA_NCM)) {
            mapaNCM = new Map();
            for (let i = 0; i < window.TABELA_NCM.length; i++) {
                const item = window.TABELA_NCM[i];
                mapaNCM.set(item.c, item.d);
            }
        }
        return mapaNCM;
    }

    function limparNCM(valor) {
        if (!valor) return '';
        const str = String(valor).trim();
        const parteCod = str.includes(' - ') ? str.split(' - ')[0] : str;
        return parteCod.replace(/\D/g, '').substring(0, 8);
    }

    function formatarNCM(cod) {
        const d = limparNCM(cod);
        if (d.length === 8) {
            return `${d.substring(0, 4)}.${d.substring(4, 6)}.${d.substring(6, 8)}`;
        }
        return d;
    }

    function formatarNCMDisplay(codigo) {
        if (!codigo) return '';
        const str = String(codigo).trim();
        if (str.includes(' - ')) return str;
        const limpo = limparNCM(str);
        if (!limpo) return str;
        const desc = buscarDescricaoNCM(limpo);
        if (desc) {
            return `${limpo} - ${desc}`;
        }
        return limpo;
    }

    function buscarDescricaoNCM(codigo) {
        const limpo = limparNCM(codigo);
        if (!limpo) return '';
        const mapa = obterMapaNCM();
        if (mapa && mapa.has(limpo)) {
            return mapa.get(limpo);
        }
        return '';
    }

    function normalizarTexto(txt) {
        return String(txt || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function filtrarNCMês(termo, limite = 30) {
        if (!window.TABELA_NCM || !Array.isArray(window.TABELA_NCM)) return [];
        let termoLimpo = String(termo || '').trim();
        if (!termoLimpo) return [];

        let termoBusca = termoLimpo;
        if (termoBusca.includes(' - ')) {
            termoBusca = termoBusca.split(' - ')[0].trim();
        }

        const apenasDig = termoBusca.replace(/\D/g, '');
        const termoNorm = normalizarTexto(termoBusca);

        const resultadosExatos = [];
        const resultadosInicio = [];
        const resultadosContem = [];
        const resultadosDesc = [];

        for (let i = 0; i < window.TABELA_NCM.length; i++) {
            const item = window.TABELA_NCM[i];
            const cod = item.c;
            const descNorm = normalizarTexto(item.d);

            if (apenasDig && cod === apenasDig) {
                resultadosExatos.push(item);
                continue;
            }

            if (apenasDig && cod.startsWith(apenasDig)) {
                resultadosInicio.push(item);
                if (resultadosInicio.length >= limite) break;
                continue;
            }

            if (apenasDig && apenasDig.length >= 2 && cod.includes(apenasDig)) {
                if (resultadosContem.length < limite) resultadosContem.push(item);
                continue;
            }

            if (!apenasDig && descNorm.includes(termoNorm)) {
                if (resultadosDesc.length < limite) resultadosDesc.push(item);
            }
        }

        const combinados = [
            ...resultadosExatos,
            ...resultadosInicio,
            ...resultadosContem,
            ...resultadosDesc
        ];

        return combinados.slice(0, limite);
    }

    function initNCMAutocomplete(inputOrId, options = {}) {
        const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
        if (!input) return null;

        // Injeta estilos CSS garantidos (dark mode & light mode)
        injetarEstilosNCM();

        // Evita reinicialização duplicada no mesmo input
        if (input.dataset.ncmAutocompleteAtivo === 'true') {
            atualizarPreviewNCM(input);
            return input;
        }
        input.dataset.ncmAutocompleteAtivo = 'true';

        // Garante que o input esteja dentro de um container relativo para posicionamento
        let parent = input.parentElement;
        if (parent && getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }

        // Dropdown flutuante
        const dropdown = document.createElement('div');
        dropdown.className = 'ncm-autocomplete-dropdown hidden custom-scrollbar';
        if (parent) parent.appendChild(dropdown);

        // Remove qualquer tag antiga de preview caso ainda exista no DOM
        if (parent) {
            const oldPreview = parent.querySelector('.ncm-descricao-preview');
            if (oldPreview) oldPreview.remove();
        }

        let debounceTimer = null;
        let indiceAtivo = -1;
        let itensAtuais = [];

        function renderizarLista(itens) {
            itensAtuais = itens;
            indiceAtivo = -1;
            if (!itens || itens.length === 0) {
                dropdown.innerHTML = `
                    <div style="padding: 12px; text-align: center; font-size: 12px; opacity: 0.7;">
                        Nenhum NCM encontrado para o termo digitado.
                    </div>`;
                dropdown.classList.remove('hidden');
                return;
            }

            dropdown.innerHTML = itens.map((it, idx) => `
                <div class="ncm-opcao" data-index="${idx}">
                    <span class="ncm-code-badge">${formatarNCM(it.c)}</span>
                    <span class="ncm-desc-text">${it.d}</span>
                </div>
            `).join('');

            dropdown.classList.remove('hidden');

            dropdown.querySelectorAll('.ncm-opcao').forEach(el => {
                el.addEventListener('mousedown', function(e) {
                    e.preventDefault(); // Evita perder foco antes do clique
                    const idx = parseInt(this.dataset.index, 10);
                    selecionarItem(itensAtuais[idx]);
                });
            });
        }

        function selecionarItem(item) {
            if (!item) return;
            input.value = `${item.c} - ${item.d}`;
            fecharDropdown();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof options.onSelect === 'function') {
                options.onSelect(item);
            }
        }

        function fecharDropdown() {
            dropdown.classList.add('hidden');
            indiceAtivo = -1;
        }

        function destacarOpcao(novoIndice) {
            const opcoes = dropdown.querySelectorAll('.ncm-opcao');
            if (!opcoes.length) return;
            opcoes.forEach(op => op.classList.remove('ncm-ativo'));
            if (novoIndice >= 0 && novoIndice < opcoes.length) {
                indiceAtivo = novoIndice;
                opcoes[indiceAtivo].classList.add('ncm-ativo');
                opcoes[indiceAtivo].scrollIntoView({ block: 'nearest' });
            }
        }

        input.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            const val = this.value.trim();

            if (!val) {
                fecharDropdown();
                return;
            }

            debounceTimer = setTimeout(() => {
                const resultados = filtrarNCMês(val, 25);
                renderizarLista(resultados);
            }, 80);
        });

        input.addEventListener('focus', function() {
            if (this.value.trim()) {
                const resultados = filtrarNCMês(this.value.trim(), 25);
                renderizarLista(resultados);
            }
        });

        input.addEventListener('blur', function() {
            const val = this.value.trim();
            if (!val) return;
            if (!val.includes(' - ')) {
                const limpo = limparNCM(val);
                if (limpo && limpo.length === 8) {
                    const desc = buscarDescricaoNCM(limpo);
                    if (desc) {
                        this.value = `${limpo} - ${desc}`;
                    }
                }
            }
        });

        input.addEventListener('keydown', function(e) {
            if (dropdown.classList.contains('hidden')) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                destacarOpcao(Math.min(indiceAtivo + 1, itensAtuais.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                destacarOpcao(Math.max(indiceAtivo - 1, 0));
            } else if (e.key === 'Enter') {
                if (indiceAtivo >= 0 && itensAtuais[indiceAtivo]) {
                    e.preventDefault();
                    selecionarItem(itensAtuais[indiceAtivo]);
                } else {
                    const val = input.value.trim();
                    if (val && !val.includes(' - ')) {
                        const limpo = limparNCM(val);
                        if (limpo && limpo.length === 8) {
                            const desc = buscarDescricaoNCM(limpo);
                            if (desc) {
                                input.value = `${limpo} - ${desc}`;
                                fecharDropdown();
                            }
                        }
                    }
                }
            } else if (e.key === 'Escape') {
                fecharDropdown();
            }
        });

        document.addEventListener('click', function(e) {
            if (parent && !parent.contains(e.target)) {
                fecharDropdown();
            }
        });

        return input;
    }

    function atualizarPreviewNCM(inputOrId) {
        const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
        if (!input) return;
        const parent = input.parentElement;
        if (!parent) return;
        const oldPreview = parent.querySelector('.ncm-descricao-preview');
        if (oldPreview) oldPreview.remove();
    }

    // ==========================================
    // HELPERS PARA CSOSN / CST
    // ==========================================
    const MAPA_CSOSN_CST = {
        '101': '101 - Simples Nacional (com permissão de crédito)',
        '102': '102 - Simples Nacional (sem permissão de crédito)',
        '103': '103 - Simples Nacional (isenção de ICMS)',
        '201': '201 - Simples Nacional (com crédito e com ST)',
        '202': '202 - Simples Nacional (sem crédito e com ST)',
        '203': '203 - Simples Nacional (isenção ICMS e com ST)',
        '300': '300 - Imune',
        '400': '400 - Não tributada pelo Simples Nacional',
        '500': '500 - Simples Nacional (ICMS cobrado anteriormente por ST)',
        '900': '900 - Simples Nacional (Outros)',
        '00': '00 - Tributada integralmente',
        '10': '10 - Tributada e com cobrança de ST',
        '20': '20 - Com redução de base de cálculo',
        '30': '30 - Isenta ou não tributada e com cobrança de ST',
        '40': '40 - Isenta',
        '41': '41 - Não tributada',
        '50': '50 - Suspensão',
        '51': '51 - Diferimento',
        '60': '60 - Cobrado anteriormente por ST',
        '70': '70 - Com redução de base e cobrança ST',
        '90': '90 - Outras'
    };

    function formatarCSOSNDisplay(val) {
        if (!val && val !== 0) return '';
        const str = String(val).trim();
        if (str.includes(' - ')) return str;
        if (MAPA_CSOSN_CST[str]) return MAPA_CSOSN_CST[str];
        const cod = str.replace(/\D/g, '');
        if (MAPA_CSOSN_CST[cod]) return MAPA_CSOSN_CST[cod];
        return str;
    }

    function extrairCodigoCSOSN(val) {
        if (!val && val !== 0) return '';
        const str = String(val).trim();
        if (str.includes(' - ')) {
            const parte = str.split(' - ')[0].trim();
            return parte.replace(/\D/g, '');
        }
        return str.replace(/\D/g, '');
    }

    function initCSOSNInput(inputOrId) {
        const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
        if (!input || input.dataset.csosnAtivo === 'true') return;
        input.dataset.csosnAtivo = 'true';

        function autoFormatar() {
            const val = input.value.trim();
            if (val) {
                const formatado = formatarCSOSNDisplay(val);
                if (formatado !== val) {
                    input.value = formatado;
                }
            }
        }

        input.addEventListener('change', autoFormatar);
        input.addEventListener('blur', autoFormatar);
    }

    // Exporta globalmente
    window.NCMHelper = {
        limparNCM,
        formatarNCM,
        formatarNCMDisplay,
        buscarDescricaoNCM,
        filtrarNCMês,
        initNCMAutocomplete,
        atualizarPreviewNCM,
        MAPA_CSOSN_CST,
        formatarCSOSNDisplay,
        extrairCodigoCSOSN,
        initCSOSNInput
    };
    window.FiscalHelper = window.NCMHelper;

    // Auto-inicialização automática quando o DOM carregar
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', function() {
            ['prod-ncm', 'avulsa-item-ncm', 'dev-compra-item-ncm'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    initNCMAutocomplete(el);
                }
            });
            ['prod-csosn', 'item-csosn', 'avulsa-item-csosn'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    initCSOSNInput(el);
                }
            });
        });
    }
})();
