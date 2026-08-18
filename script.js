// ==========================================
        // 1. TRAVA DE SEGURANÇA E CONFIGURAÇÕES GERAIS
        // ==========================================
        if (sessionStorage.getItem('erp_auth_master') !== 'true') {
            window.location.href = 'login.html'; 
        }

        const firebaseConfig = {
            apiKey: "AIzaSyDIlmd3zUTof-lwxyT7j3UxmenPKs_sMJg",
            authDomain: "lojafc-a31f9.firebaseapp.com",
            projectId: "lojafc-a31f9",
            storageBucket: "lojafc-a31f9.firebasestorage.app",
            messagingSenderId: "221558052645",
            appId: "1:221558052645:web:ed942d019727a472096ccc"
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const firestore = firebase.firestore();

        // Variáveis Globais
        let db = { 
            produtos: [], clientes: [], fornecedores: [], vendas: [], movimentacoes: [], 
            financeiro: [], compras: [], caixa: { status: 'FECHADO', saldo: 0, historico: [] }, 
            config: { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } } }
        };
        
        let cart = [];
        let acaoConfirmacaoPendente = null;
        window.tempXMLData = null; 
        window.xmlItemEditIndex = null;
        
        const categoriasPagar = ['Fornecedores', 'Funcionários', 'Impostos', 'Aluguel', 'Água', 'Energia', 'Outras Despesas'];
        const categoriasReceber = ['Vendas', 'Serviços', 'Outras Receitas'];

        const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formatData = (isoStr) => new Date(isoStr).toLocaleString('pt-BR');

        function showToast(msg, type = 'info') {
            const container = document.getElementById('toast-container');
            const t = document.createElement('div');
            t.className = `toast show ${type}`;
            t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle')}"></i> ${msg}`;
            container.appendChild(t);
            setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
        }

        // ==========================================
        // 2. BANCO DE DADOS E INIT
        // ==========================================
        async function initData() {
            try {
                showToast("Sincronizando com a nuvem...", "info");
                const docRef = firestore.collection("fc_moveis").doc("banco_principal");
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    db = docSnap.data();
                    if(!db.movimentacoes) db.movimentacoes = [];
                    if(!db.financeiro) db.financeiro = [];
                    if(!db.fornecedores) db.fornecedores = [];
                    if(!db.compras) db.compras = [];
                    if(!db.vendas) db.vendas = [];
                    if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
                    if(!db.config || !db.config.taxas || typeof db.config.taxas['Cartão Crédito'] === 'number') { 
                        db.config = { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 4.99, 2: 5.49, 3: 5.99, 4: 6.49, 5: 6.99, 6: 7.49, 7: 7.99, 8: 8.49, 9: 8.99, 10: 9.49, 11: 9.99, 12: 10.49 } } }; 
                    }
                    
                    let maxPed = 0;
                    db.vendas.forEach(v => { if(v.numeroPedido > maxPed) maxPed = v.numeroPedido; });
                    if(maxPed === 0 && db.vendas.length > 0) {
                        let n = db.vendas.length;
                        db.vendas.forEach(v => { v.numeroPedido = n--; }); 
                    }
                    showToast("Dados carregados com sucesso!", "success");
                } else { await docRef.set(db); }
                mudarVisao('dashboard');
            } catch (error) { showToast("Erro ao conectar com a nuvem.", "error"); }
        }

        function saveDB() { firestore.collection("fc_moveis").doc("banco_principal").set(db).catch(e => showToast("Falha ao salvar dados.", "error")); }

        // ==========================================
        // 3. EXPORTAÇÕES E IMPRESSÕES ANTI-BLOQUEIO
        // ==========================================
        function imprimirArea(areaId) {
            const printContent = document.getElementById(areaId).innerHTML;
            const style = document.createElement('style');
            style.id = 'print-style-temp';
            style.innerHTML = `
                @media print {
                    body > :not(#print-temp) { display: none !important; }
                    #print-temp { display: block !important; position: absolute; left: 0; top: 0; width: 100%; background: #fff; color: #000; padding: 20px; z-index: 99999; }
                    .print\\:hidden { display: none !important; }
                    @page { size: auto; margin: 10mm; }
                }
            `;
            document.head.appendChild(style);
            
            const printDiv = document.createElement('div');
            printDiv.id = 'print-temp';
            printDiv.innerHTML = `<h2 style="font-size: 22px; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">FC Móveis - Relatório Gerencial</h2>` + printContent;
            document.body.appendChild(printDiv);
            
            window.print();
            
            setTimeout(() => {
                printDiv.remove();
                style.remove();
            }, 1000);
        }

        function printAction(type) {
            const printContent = document.getElementById('print-area').innerHTML;
            const widthStyle = type === 'thermal' 
                ? 'width: 80mm; font-size: 12px; font-family: monospace; padding: 2mm; margin: 0 auto;' 
                : 'width: 210mm; font-size: 14px; font-family: sans-serif; padding: 20mm; margin: 0 auto;';
            
            const style = document.createElement('style');
            style.id = 'print-style-temp';
            style.innerHTML = `
                @media print {
                    body > :not(#print-temp) { display: none !important; }
                    #print-temp { display: block !important; position: absolute; left: 0; top: 0; right: 0; background: #fff; color: #000; z-index: 99999; ${widthStyle} }
                    @page { margin: 0; }
                }
            `;
            document.head.appendChild(style);
            
            const printDiv = document.createElement('div');
            printDiv.id = 'print-temp';
            printDiv.innerHTML = printContent;
            document.body.appendChild(printDiv);
            
            window.print();
            
            setTimeout(() => {
                printDiv.remove();
                style.remove();
            }, 1000);
        }

        function baixarPDF(areaId, filename) {
            const element = document.getElementById(areaId);
            const opt = { margin: 10, filename: filename + '_' + Date.now() + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
            const hideElements = element.querySelectorAll('.print\\:hidden');
            hideElements.forEach(el => el.style.display = 'none');
            html2pdf().set(opt).from(element).save().then(() => { hideElements.forEach(el => el.style.display = ''); showToast('PDF Gerado!', 'success'); });
        }

        function downloadPDF(areaId, filename) {
            const element = document.getElementById(areaId); element.classList.remove('hidden'); element.style.padding = '20px'; element.style.fontFamily = 'sans-serif';
            html2pdf().set({ margin:10, filename:`${filename}_${Date.now()}.pdf`, html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} }).from(element).save().then(() => { element.classList.add('hidden'); element.style.padding = ''; showToast('PDF baixado!'); });
        }

        function exportarExcel(tabelaId, filename) {
            let table = document.getElementById(tabelaId);
            if(!table) return showToast('Tabela não encontrada.', 'error');
            let rows = table.querySelectorAll('tr'); let csv = [];
            for (let i = 0; i < rows.length; i++) {
                let row = [], cols = rows[i].querySelectorAll('td:not(.print\\:hidden), th:not(.print\\:hidden)');
                for (let j = 0; j < cols.length; j++) { let text = cols[j].innerText.replace(/"/g, '""').trim(); row.push('"' + text + '"'); }
                csv.push(row.join(';'));
            }
            let csvFile = new Blob(["\uFEFF"+csv.join('\n')], {type: 'text/csv;charset=utf-8;'});
            let link = document.createElement("a"); link.href = window.URL.createObjectURL(csvFile); link.setAttribute("download", filename + "_" + Date.now() + ".csv");
            document.body.appendChild(link); link.click(); showToast('Excel/CSV exportado!', 'success');
        }

        // ==========================================
        // 4. NAVEGAÇÃO E MODAIS BÁSICOS
        // ==========================================
        function fazerLogout() { sessionStorage.removeItem('erp_auth_master'); window.location.href = 'login.html'; }

        // Mudar Visão Responsiva (Fecha o menu ao clicar no celular)
        function mudarVisao(viewId) {
            document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('active'); });
            const targetView = document.getElementById(`view-${viewId}`);
            if(targetView) { targetView.classList.remove('hidden'); targetView.classList.add('active'); }
            
            document.querySelectorAll('.nav-btn').forEach(btn => { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('text-slate-300'); });
            const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
            if(activeBtn) { activeBtn.classList.remove('text-slate-300'); activeBtn.classList.add('bg-blue-600', 'text-white'); }
            
            // Fechar menu mobile se estiver aberto
            if (window.innerWidth < 768) {
                document.getElementById('sidebar').classList.add('-translate-x-full');
                document.getElementById('sidebar-overlay').classList.add('hidden');
            }
            
            if(viewId === 'pdv') prepararPDV();
            if(viewId === 'vendas') renderVendas();
            if(viewId === 'config') renderConfig();
            if(viewId === 'produtos') renderProdutos();
            if(viewId === 'clientes') renderClientes();
            if(viewId === 'fornecedores') renderFornecedores();
            if(viewId === 'financeiro') renderFinAbas('caixa');
            if(viewId === 'dashboard' || viewId === 'relatorios') renderDashboard();
            if(viewId === 'estoque') renderKardex();
            if(viewId === 'compras') renderComprasHist();
        }

        // Função para abrir e fechar Menu Mobile
        function toggleMenu() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.remove('hidden');
            } else {
                sidebar.classList.add('-translate-x-full');
                overlay.classList.add('hidden');
            }
        }

        function abaModal(prefix, nomeAba) {
            const modalId = `#modal-${prefix === 'cli' ? 'cliente' : (prefix === 'forn' ? 'fornecedor' : 'produto')}`;
            document.querySelectorAll(`${modalId} .aba-conteudo`).forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
            document.getElementById(`${prefix}-aba-${nomeAba}`).classList.remove('hidden'); document.getElementById(`${prefix}-aba-${nomeAba}`).classList.add('active');
            document.querySelectorAll(`[id^="${prefix}-btn-"]`).forEach(el => { el.classList.remove('border-blue-600','text-blue-600'); el.classList.add('border-transparent','text-slate-500 dark:text-slate-400'); });
            const btnAtivo = document.getElementById(`${prefix}-btn-${nomeAba}`);
            btnAtivo.classList.remove('border-transparent','text-slate-500 dark:text-slate-400'); btnAtivo.classList.add('border-blue-600','text-blue-600');
        }

        function abrirConfirmacao(titulo, mensagem, acao) { 
            document.getElementById('modal-confirm-title').innerText = titulo; 
            document.getElementById('modal-confirm-msg').innerText = mensagem; 
            acaoConfirmacaoPendente = acao; 
            document.getElementById('modal-confirmacao').classList.remove('hidden'); 
            
            document.getElementById('modal-confirm-btn').onclick = function() {
                if(acaoConfirmacaoPendente) acaoConfirmacaoPendente();
                fecharModalConfirmacao();
            };
        }
        function fecharModalConfirmacao() { 
            document.getElementById('modal-confirmacao').classList.add('hidden'); 
            acaoConfirmacaoPendente = null; 
            document.getElementById('modal-confirm-btn').onclick = null;
        }

        async function buscarCEP(prefix) {
            const el = document.getElementById(`${prefix}-cep`); if(!el) return; let cep = el.value.replace(/\D/g, ''); if (cep.length !== 8) return;
            try { let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); let data = await res.json(); if (!data.erro) { document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.localidade} - ${data.uf}`; } } catch (e) {}
        }

        async function buscarCNPJ(prefix) {
            const elDoc = document.getElementById(`${prefix}-doc`); if(!elDoc) return; let cnpj = elDoc.value.replace(/\D/g, ''); if (cnpj.length !== 14) return showToast('Digite os 14 números do CNPJ', 'error');
            showToast('Consultando Receita...', 'info');
            try {
                let res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); let data = await res.json();
                if(data.razao_social) { document.getElementById(`${prefix}-nome`).value = data.razao_social || ''; document.getElementById(`${prefix}-wpp`).value = data.ddd_telefone_1 || ''; document.getElementById(`${prefix}-cep`).value = data.cep || ''; document.getElementById(`${prefix}-rua`).value = data.logradouro || ''; document.getElementById(`${prefix}-bairro`).value = data.bairro || ''; document.getElementById(`${prefix}-cidade`).value = `${data.municipio||''} - ${data.uf||''}`; showToast('Empresa Importada!', 'success'); }
            } catch (e) { showToast('Serviço indisponível.', 'error'); }
        }
        
        // --- FUNÇÕES DE ZOOM DE IMAGEM ---
        function abrirZoom(src) {
            if(!src) return;
            document.getElementById('zoom-img-src').src = src;
            document.getElementById('modal-zoom').classList.remove('hidden');
        }
        function fecharZoom() {
            document.getElementById('modal-zoom').classList.add('hidden');
            document.getElementById('zoom-img-src').src = '';
        }

        // ==========================================
        // 5. CONFIGURAÇÃO DE CONTAS / TAXAS
        // ==========================================
        function renderConfig() {
            const area = document.getElementById('config-taxas-area');
            if(!db.config) db.config = { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1:4.99, 2:5.99, 3:6.99, 4:7.99, 5:8.99, 6:9.99, 7:10.99, 8:11.99, 9:12.99, 10:13.99, 11:14.99, 12:15.99 } } };
            
            let htmlInputs = `<div class="md:col-span-3 border-b border-slate-200 dark:border-slate-700 pb-2 mb-2"><h3 class="font-bold text-slate-700 dark:text-slate-200">Taxas Fixas (%)</h3></div>`;
            const fixas = ['Dinheiro', 'PIX', 'Cartão Débito', 'Boleto', 'Fiado'];
            
            fixas.forEach(metodo => {
                let mId = metodo.replace(/[^a-zA-Z\u00C0-\u017F]/g, '');
                htmlInputs += `<div><label class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Taxa: ${metodo}</label><input type="number" step="0.01" id="taxa-${mId}" value="${db.config.taxas[metodo]||0}" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500 dark:text-white"></div>`;
            });
            
            htmlInputs += `<div class="md:col-span-3 mt-6 border-b border-slate-200 dark:border-slate-700 pb-2 mb-2"><h3 class="font-bold text-slate-700 dark:text-slate-200">Taxas Cartão de Crédito - Por Parcela (%)</h3></div>`;
            for(let i=1; i<=12; i++) {
                let val = db.config.taxas['Cartão Crédito'][i] || 0;
                htmlInputs += `<div><label class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Crédito em ${i}x</label><input type="number" step="0.01" id="taxa-cc-${i}" value="${val}" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500 dark:text-white"></div>`;
            }
            area.innerHTML = htmlInputs;
        }

        function salvarConfiguracoes() {
            const fixas = ['Dinheiro', 'PIX', 'Cartão Débito', 'Boleto', 'Fiado'];
            fixas.forEach(metodo => {
                let mId = metodo.replace(/[^a-zA-Z\u00C0-\u017F]/g, '');
                db.config.taxas[metodo] = parseFloat(document.getElementById(`taxa-${mId}`).value) || 0;
            });
            for(let i=1; i<=12; i++) {
                db.config.taxas['Cartão Crédito'][i] = parseFloat(document.getElementById(`taxa-cc-${i}`).value) || 0;
            }
            saveDB();
            showToast('Configurações e taxas atualizadas!', 'success');
        }

        // ==========================================
        // 6. MÓDULO PRODUTOS
        // ==========================================
        function renderProdutos() {
            const termo = document.getElementById('busca-produto-lista')?.value.toLowerCase() || '';
            const statusFiltro = document.getElementById('filtro-prod-status')?.value || 'todos';
            
            let filtrados = db.produtos.filter(p => p.nome.toLowerCase().includes(termo) || (p.ean && p.ean.includes(termo)) || (p.marca && p.marca.toLowerCase().includes(termo)));
            if(statusFiltro === 'alerta') filtrados = filtrados.filter(p => p.estoque > 0 && p.estoque <= p.min);
            if(statusFiltro === 'zerado') filtrados = filtrados.filter(p => p.estoque <= 0);
            if(statusFiltro === 'ok') filtrados = filtrados.filter(p => p.estoque > p.min);

            const tbody = document.getElementById('tabela-produtos');
            let linhas = '';
            filtrados.forEach(p => {
                const isBaixo = p.estoque <= p.min; const isZerado = p.estoque <= 0;
                const corEstoque = isZerado ? 'text-red-600 bg-red-50' : (isBaixo ? 'text-amber-600 bg-amber-50' : 'text-slate-700 dark:text-slate-200');
                const fHtml = p.foto ? `<img src="${p.foto}" onclick="abrirZoom('${p.foto}')" class="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 mx-auto cursor-zoom-in hover:opacity-80 transition">` : `<div class="w-10 h-10 mx-auto rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs"><i class="fa-regular fa-image"></i></div>`;
                const badgeInativo = p.ativo === false ? `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] ml-2 font-bold"><i class="fa-solid fa-ban"></i> INATIVO</span>` : '';

                linhas += `
                <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${p.ativo === false ? 'opacity-60' : ''}">
                    <td class="p-3 text-center">${fHtml}</td>
                    <td class="p-3"><p class="font-bold text-slate-800 dark:text-slate-100">${p.nome} ${badgeInativo}</p><p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">EAN: ${p.ean || 'S/N'} | ${p.categoria} | Marca: ${p.marca || '-'}</p></td>
                    <td class="p-3 text-right"><p class="text-slate-600 dark:text-slate-300 font-medium">${formatMoney(p.custo)}</p><p class="text-[10px] text-blue-500 font-bold">${p.margem}% MKP</p></td>
                    <td class="p-3 text-right font-bold text-emerald-600">${formatMoney(p.preco)}</td>
                    <td class="p-3 text-center font-bold"><span class="px-2 py-1 rounded ${corEstoque}">${p.estoque} un</span></td>
                    <td class="p-3 text-center flex items-center justify-center gap-1 mt-2"><button onclick="editarProduto('${p.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirProduto('${p.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td>
                </tr>`;
            });
            tbody.innerHTML = linhas;
        }

        function abrirModalProduto() {
            abaModal('prod', 'dados'); document.getElementById('modal-produto-title').innerText = 'Cadastrar Produto';
            ['id','nome','ean','marca','custo','preco','margem','estoque','minimo','obs'].forEach(id => { const el = document.getElementById(`prod-${id}`); if(el) el.value = ''; });
            document.getElementById('prod-ativo').value = 'true'; document.getElementById('prod-foto-base64').value = '';
            document.getElementById('preview-foto').src = ''; document.getElementById('preview-foto').classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden');
            document.getElementById('prod-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver o histórico.</td></tr>';
            document.getElementById('modal-produto').classList.remove('hidden');
        }

        function fecharModalProduto() { document.getElementById('modal-produto').classList.add('hidden'); document.getElementById('modal-produto').classList.remove('z-[250]'); document.getElementById('modal-produto').classList.add('z-[150]'); }

        function processarFoto(event) {
            const file = event.target.files[0]; if(!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image(); img.onload = function() {
                    const canvas = document.createElement('canvas'); let w = img.width, h = img.height; const MAX = 300;
                    if(w > h) { if(w > MAX) { h *= MAX/w; w = MAX; } } else { if(h > MAX) { w *= MAX/h; h = MAX; } }
                    canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const prev = document.getElementById('preview-foto'); prev.src = dataUrl; prev.classList.remove('hidden');
                    document.getElementById('texto-sem-foto').classList.add('hidden'); document.getElementById('prod-foto-base64').value = dataUrl;
                }; img.src = e.target.result;
            }; reader.readAsDataURL(file);
        }

        function calcularPrecoMargin(quemMudou = 'preco') {
            const custo = parseFloat(document.getElementById('prod-custo').value) || 0;
            const precoEl = document.getElementById('prod-preco'); const margemEl = document.getElementById('prod-margem');
            if(custo <= 0) return;
            if(quemMudou === 'preco') { margemEl.value = ((((parseFloat(precoEl.value)||0) - custo) / custo) * 100).toFixed(2); }
            else if (quemMudou === 'margem') { precoEl.value = (custo * (1 + ((parseFloat(margemEl.value)||0) / 100))).toFixed(2); }
            else if (quemMudou === 'custo') { if(parseFloat(margemEl.value)>0) precoEl.value = (custo * (1 + (parseFloat(margemEl.value) / 100))).toFixed(2); }
        }

        function salvarProduto() {
            const id = document.getElementById('prod-id').value; const nome = document.getElementById('prod-nome').value.trim(); const preco = parseFloat(document.getElementById('prod-preco').value);
            if(!nome || isNaN(preco)) return showToast('Preencha Nome e Preço de Venda!', 'error');

            const p = {
                id: id ? parseInt(id) : Date.now(), nome, preco, ean: document.getElementById('prod-ean').value,
                marca: document.getElementById('prod-marca').value, categoria: document.getElementById('prod-categoria').value,
                unidade: document.getElementById('prod-unidade').value, custo: parseFloat(document.getElementById('prod-custo').value) || 0,
                margem: parseFloat(document.getElementById('prod-margem').value) || 0, estoque: parseFloat(document.getElementById('prod-estoque').value) || 0,
                min: parseInt(document.getElementById('prod-minimo').value) || 0, ativo: document.getElementById('prod-ativo').value === 'true',
                obs: document.getElementById('prod-obs').value, foto: document.getElementById('prod-foto-base64').value
            };

            if(id) {
                const idx = db.produtos.findIndex(x => x.id === p.id); const difEstoque = p.estoque - db.produtos[idx].estoque;
                if(difEstoque !== 0) salvarKardex('Ajuste Manual', p.id, p.nome, difEstoque, 'AJUSTE'); db.produtos[idx] = p; showToast('Atualizado!');
            } else { db.produtos.push(p); if(p.estoque > 0) salvarKardex('Estoque Inicial', p.id, p.nome, p.estoque, 'INICIAL'); showToast('Salvo!', 'success'); }
            
            saveDB(); 
            fecharModalProduto(); 
            renderProdutos();
            
            // Atualiza PDV se estiver na tela
            if(document.getElementById('view-pdv').classList.contains('active')) {
                buscarProdutoPDV();
            }
        }

        function editarProduto(id) {
            const p = db.produtos.find(x => x.id === id); if(!p) return;
            abrirModalProduto(); document.getElementById('modal-produto-title').innerText = 'Editar Produto';
            for(let key in p) { const el = document.getElementById(`prod-${key === 'min' ? 'minimo' : key}`); if(el && key !== 'foto' && key !== 'ativo') el.value = p[key]; }
            document.getElementById('prod-ativo').value = p.ativo !== false ? 'true' : 'false'; document.getElementById('prod-foto-base64').value = p.foto || '';
            const prev = document.getElementById('preview-foto');
            if(p.foto) { prev.src = p.foto; prev.classList.remove('hidden'); document.getElementById('texto-sem-foto').classList.add('hidden'); } else { prev.src = ''; prev.classList.add('hidden'); document.getElementById('texto-sem-foto').classList.remove('hidden'); }
            
            const hist = db.movimentacoes.filter(m => m.prodId === p.id); const tbody = document.getElementById('prod-historico-body');
            document.getElementById('prod-btn-crm').innerHTML = `CRM & Histórico ${hist.length > 0 ? `<span class="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] ml-1">${hist.length}</span>` : ''}`;
            if(hist.length > 0) {
                let txtHist = '';
                hist.forEach(m => {
                    const corTipo = m.tipo.includes('ENTRADA') ? 'bg-indigo-100 text-indigo-700' : (m.tipo === 'VENDA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700');
                    const corQtd = m.qtd > 0 ? 'text-indigo-600' : 'text-red-500';
                    txtHist += `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3">${formatData(m.data).split(' ')[0]}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${corTipo}">${m.tipo}</span></td><td class="p-3 text-slate-600 dark:text-slate-300 font-mono">${m.ref}</td><td class="p-3 text-right font-bold ${corQtd}">${m.qtd > 0 ? '+'+m.qtd : m.qtd}</td></tr>`;
                });
                tbody.innerHTML = txtHist;
            } else { tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem movimentações.</td></tr>'; }
        }

        function excluirProduto(id) { abrirConfirmacao('Excluir Produto', 'Remover produto permanentemente?', () => { db.produtos = db.produtos.filter(p => p.id !== id); saveDB(); renderProdutos(); showToast('Excluído!'); }); }

        // ==========================================
        // 7. CLIENTES E FORNECEDORES
        // ==========================================
        function renderClientes() {
            const termo = document.getElementById('busca-cliente-lista')?.value.toLowerCase() || ''; const filtrados = db.clientes.filter(c => c.nome.toLowerCase().includes(termo) || (c.doc && c.doc.includes(termo)));
            document.getElementById('tabela-clientes').innerHTML = filtrados.map(c => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${c.nome}</td><td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${c.doc || '-'}</td><td class="p-4 text-slate-800 dark:text-slate-100"><i class="fa-brands fa-whatsapp text-emerald-500 mr-1"></i> ${c.wpp || '-'}</td><td class="p-4 text-slate-600 dark:text-slate-300">${c.cidade || '-'}</td><td class="p-4 text-center"><button onclick="editarCliente('${c.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirCliente('${c.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
        }
        function abrirModalCliente() { abaModal('cli', 'dados'); document.getElementById('cli-id').value = ''; ['nome','doc','rg','nasc','wpp','fixo','email','cep','rua','numero','bairro','cidade','obs'].forEach(id => { const el = document.getElementById(`cli-${id}`); if(el) el.value = ''; }); document.getElementById('cli-historico-body').innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver o histórico.</td></tr>'; document.getElementById('modal-cliente-title').innerText = 'Novo Cliente'; document.getElementById('modal-cliente').classList.remove('hidden'); }
        function fecharModalCliente() { document.getElementById('modal-cliente').classList.add('hidden'); }
        function salvarCliente() {
            const id = document.getElementById('cli-id').value; const nome = document.getElementById('cli-nome').value.trim(); if(!nome) return showToast('Nome é obrigatório!', 'error');
            const c = { id: id ? parseInt(id) : Date.now(), nome: nome, doc: document.getElementById('cli-doc').value, rg: document.getElementById('cli-rg').value, nasc: document.getElementById('cli-nasc').value, wpp: document.getElementById('cli-wpp').value, fixo: document.getElementById('cli-fixo').value, email: document.getElementById('cli-email').value, cep: document.getElementById('cli-cep').value, rua: document.getElementById('cli-rua').value, numero: document.getElementById('cli-numero').value, bairro: document.getElementById('cli-bairro').value, cidade: document.getElementById('cli-cidade').value, obs: document.getElementById('cli-obs').value };
            if(id) { const idx = db.clientes.findIndex(x => x.id === c.id); db.clientes[idx] = c; } else { db.clientes.push(c); } saveDB(); fecharModalCliente(); renderClientes(); showToast('Salvo!', 'success');
        }
        function editarCliente(id) {
            const c = db.clientes.find(x => x.id === id); if(!c) return;
            abrirModalCliente(); document.getElementById('modal-cliente-title').innerText = `Editar: ${c.nome}`;
            for(let key in c) { const el = document.getElementById(`cli-${key}`); if(el) el.value = c[key] || ''; }
            const hist = db.vendas.filter(v => String(v.clienteId) === String(c.id)); const tbody = document.getElementById('cli-historico-body');
            document.getElementById('cli-btn-crm').innerHTML = `CRM & Histórico ${hist.length > 0 ? `<span class="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] ml-1">${hist.length}</span>` : ''}`;
            if(hist.length > 0) { tbody.innerHTML = hist.map(v => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3">${v.data.split('T')[0].split('-').reverse().join('/')}</td><td class="p-3 font-mono text-slate-500 dark:text-slate-400">#${String(v.numeroPedido || v.id).padStart(4, '0')}</td><td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${v.pag}</span></td><td class="p-3 text-right font-bold text-emerald-600">${formatMoney(v.tot)}</td><td class="p-3 text-center"><button onclick="verDetalhesVenda('${v.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded font-bold text-[10px]"><i class="fa-solid fa-eye"></i> Ver</button></td></tr>`).join(''); } else { tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma compra.</td></tr>'; }
        }
        function excluirCliente(id) { abrirConfirmacao('Excluir Cliente', 'Remover cliente?', () => { db.clientes = db.clientes.filter(c => c.id !== id); saveDB(); renderClientes(); showToast('Excluído!'); }); }

        function renderFornecedores() {
            const termo = document.getElementById('busca-fornecedor-lista')?.value.toLowerCase() || ''; const filtrados = db.fornecedores.filter(f => f.nome.toLowerCase().includes(termo) || (f.doc && f.doc.includes(termo)));
            document.getElementById('tabela-fornecedores').innerHTML = filtrados.map(f => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${f.nome}</td><td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${f.doc || f.cnpj || '-'}</td><td class="p-4 text-slate-800 dark:text-slate-100"><i class="fa-solid fa-phone text-blue-500 mr-1"></i> ${f.wpp || '-'}</td><td class="p-4 text-center"><button onclick="editarFornecedor('${f.id}')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="excluirFornecedor('${f.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem fornecedores.</td></tr>';
        }
        function abrirModalFornecedor() { abaModal('forn', 'dados'); document.getElementById('forn-id').value = ''; ['nome','doc','ie','contato','wpp','email','cep','rua','numero','bairro','cidade','condicoes','produtos'].forEach(id => { const el = document.getElementById(`forn-${id}`); if(el) el.value = ''; }); document.getElementById('forn-historico-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">Cadastre para ver histórico.</td></tr>'; document.getElementById('modal-fornecedor-title').innerText = 'Novo Fornecedor'; document.getElementById('modal-fornecedor').classList.remove('hidden'); }
        function fecharModalFornecedor() { document.getElementById('modal-fornecedor').classList.add('hidden'); }
        function salvarFornecedor() {
            const id = document.getElementById('forn-id').value; const nome = document.getElementById('forn-nome').value.trim(); if(!nome) return showToast('Razão Social obrigatória!', 'error');
            const f = { id: id ? parseInt(id) : Date.now(), nome: nome, doc: document.getElementById('forn-doc').value, cnpj: document.getElementById('forn-doc').value, ie: document.getElementById('forn-ie').value, contato: document.getElementById('forn-contato').value, wpp: document.getElementById('forn-wpp').value, email: document.getElementById('forn-email').value, cep: document.getElementById('forn-cep').value, rua: document.getElementById('forn-rua').value, numero: document.getElementById('forn-numero').value, bairro: document.getElementById('forn-bairro').value, cidade: document.getElementById('forn-cidade').value, condicoes: document.getElementById('forn-condicoes').value, produtos: document.getElementById('forn-produtos').value };
            if(id) { const idx = db.fornecedores.findIndex(x => x.id === f.id); db.fornecedores[idx] = f; } else { db.fornecedores.push(f); } saveDB(); fecharModalFornecedor(); renderFornecedores(); showToast('Fornecedor Salvo!', 'success');
        }
        function editarFornecedor(id) {
            const f = db.fornecedores.find(x => x.id === id); if(!f) return;
            abrirModalFornecedor(); document.getElementById('modal-fornecedor-title').innerText = `Editar: ${f.nome}`;
            for(let key in f) { const el = document.getElementById(`forn-${key}`); if(el) el.value = f[key] || ''; }
            if(!f.doc && f.cnpj) document.getElementById('forn-doc').value = f.cnpj;
            const hist = db.compras.filter(c => c.cnpj === f.doc || c.cnpj === f.cnpj || c.fornecedor === f.nome);
            document.getElementById('forn-btn-historico').innerHTML = `Histórico NF-e ${hist.length > 0 ? `<span class="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] ml-1">${hist.length}</span>` : ''}`;
            if(hist.length > 0) { document.getElementById('forn-historico-body').innerHTML = hist.map(c => `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-3">${formatData(c.data).split(' ')[0]}</td><td class="p-3 font-bold text-slate-700 dark:text-slate-200">${c.qtdTotal} itens</td><td class="p-3 text-right font-bold text-indigo-600">${formatMoney(c.totalNF)}</td><td class="p-3 text-center"><button onclick="verDetalhesNF('${c.id}')" class="text-blue-600 bg-blue-50 px-2 py-1 rounded text-[10px] font-bold">Ver</button></td></tr>`).join(''); } else { document.getElementById('forn-historico-body').innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem notas.</td></tr>'; }
        }
        function excluirFornecedor(id) { abrirConfirmacao('Excluir', 'Isso não apagará as Notas. Continuar?', () => { db.fornecedores = db.fornecedores.filter(f => f.id !== id); saveDB(); renderFornecedores(); showToast('Excluído!'); }); }

        // ==========================================
        // 8. FRENTE DE CAIXA E CARRINHO (PDV)
        // ==========================================
        function prepararPDV() {
            const sCli = document.getElementById('pdv-cliente'); sCli.innerHTML = '<option value="0">Consumidor Final</option>' + db.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join(''); document.getElementById('pdv-busca-resultados').classList.add('hidden'); document.getElementById('pdv-produto-busca').value = '';
            const badgeCaixa = document.getElementById('pdv-status-caixa');
            if(db.caixa.status === 'ABERTO') { badgeCaixa.className = "bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; badgeCaixa.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Caixa Aberto'; } 
            else { badgeCaixa.className = "bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider"; badgeCaixa.innerHTML = '<i class="fa-solid fa-lock mr-1"></i> Caixa Fechado'; }
        }

        function buscarProdutoPDV() {
            const termo = document.getElementById('pdv-produto-busca').value.toLowerCase().trim(); const resC = document.getElementById('pdv-busca-resultados');
            if(!termo) { resC.classList.add('hidden'); return; }
            const filtrados = db.produtos.filter(p => p.ativo !== false && (String(p.id) === termo || String(p.ean) === termo || p.nome.toLowerCase().includes(termo)));
            if(filtrados.length === 0) { resC.innerHTML = '<div class="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">Nenhum produto ativo.</div>'; resC.classList.remove('hidden'); return; }
            resC.innerHTML = filtrados.map(p => { 
                const fHtml = p.foto ? `<img src="${p.foto}" onclick="event.stopPropagation(); abrirZoom('${p.foto}')" class="w-8 h-8 rounded object-cover inline-block mr-2 cursor-zoom-in hover:opacity-80 transition" title="Ver foto em tela cheia">` : `<div class="w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 inline-flex items-center justify-center text-[10px] text-slate-400 mr-2"><i class="fa-regular fa-image"></i></div>`; 
                return `<div class="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors" onclick="pdvSelecionarProdutoBusca('${p.id}')"><div class="flex items-center">${fHtml}<div><p class="font-bold text-slate-800 dark:text-slate-100 text-sm">${p.nome}</p><p class="text-[10px] text-slate-500 dark:text-slate-400">Cód: ${p.id}</p></div></div><div class="text-right"><p class="font-bold text-blue-600 text-sm">${formatMoney(p.preco)}</p><p class="text-[10px] font-bold ${p.estoque<1?'text-red-500':'text-emerald-600'}">Est: ${p.estoque}</p></div></div>`
            }).join(''); resC.classList.remove('hidden');
        }

        function pdvSelecionarProdutoBusca(id) { const p = db.produtos.find(x => x.id === id); if(p) processarAdicaoProduto(p); document.getElementById('pdv-produto-busca').value = ''; document.getElementById('pdv-busca-resultados').classList.add('hidden'); document.getElementById('pdv-produto-busca').focus(); }
        function pdvAdicionarItemBusca(btnClick = false) { const termo = document.getElementById('pdv-produto-busca').value.toLowerCase().trim(); if(!termo) return; let p = db.produtos.find(x => x.ativo !== false && (String(x.ean) === termo || String(x.id) === termo)); if(!p) { const fil = db.produtos.filter(x => x.ativo !== false && x.nome.toLowerCase().includes(termo)); if(fil.length === 1) p = fil[0]; } if(p) pdvSelecionarProdutoBusca(p.id); else if(btnClick) showToast('Não encontrado.', 'error'); }

        function processarAdicaoProduto(p) { const idx = cart.findIndex(i => i.id === p.id); if(idx >= 0) { cart[idx].qtd++; if(cart[idx].qtd > p.estoque) showToast(`Estoque NEGATIVO! Restam ${p.estoque}.`, 'info'); } else { cart.push({ id: p.id, nome: p.nome, preco: p.preco, custo: p.custo, qtd: 1, foto: p.foto }); if(p.estoque < 1) showToast(`Estoque NEGATIVO!`, 'info'); } renderCarrinho(); }
        
        function renderCarrinho() {
            document.getElementById('pdv-carrinho-body').innerHTML = cart.map((item, i) => { 
                const fHtml = item.foto ? `<img src="${item.foto}" onclick="abrirZoom('${item.foto}')" class="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 mx-auto cursor-zoom-in hover:opacity-80 transition" title="Ver foto em tela cheia">` : `<div class="w-10 h-10 mx-auto rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs border border-slate-200 dark:border-slate-700"><i class="fa-regular fa-image"></i></div>`; 
                return `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-50"><td class="py-2 text-center">${fHtml}</td><td class="py-2 text-slate-800 dark:text-slate-100 font-medium">${item.nome}</td><td class="py-2 text-center"><input type="number" min="1" value="${item.qtd}" onchange="pdvMudarQtd(${i}, this.value)" class="w-16 text-center border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-bold outline-none bg-white dark:bg-slate-800 dark:text-white"></td><td class="py-2 text-right text-slate-600 dark:text-slate-300">${formatMoney(item.preco)}</td><td class="py-2 text-right font-bold text-slate-800 dark:text-slate-100">${formatMoney(item.preco * item.qtd)}</td><td class="py-2 text-center"><button onclick="cart.splice(${i},1); renderCarrinho()" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash text-lg"></i></button></td></tr>`
            }).join('');
            pdvAtualizarTotais();
        }

        function pdvMudarQtd(i, n) { const novaQtd = Math.max(0.001, parseFloat(n)||0.001); cart[i].qtd = novaQtd; const p = db.produtos.find(x => x.id === cart[i].id); if(p && novaQtd > p.estoque) showToast(`Estoque NEGATIVO! Restam ${p.estoque}.`, 'info'); renderCarrinho(); }
        
        function pdvLimpar() { cart = []; document.getElementById('pdv-desconto').value=0; document.getElementById('pdv-frete').value=0; document.getElementById('pdv-pagamento-selecionado').value=''; if(document.getElementById('pdv-obs')) document.getElementById('pdv-obs').value = ''; document.querySelectorAll('.btn-pag').forEach(b => b.classList.remove('bg-blue-50','border-blue-500','text-blue-700','ring-2')); document.getElementById('area-parcelamento').classList.add('hidden'); renderCarrinho(); }

        function pdvAtualizarTotais() { 
            const sub = cart.reduce((acc, i) => acc + (i.preco * i.qtd), 0); 
            let frete = parseFloat(document.getElementById('pdv-frete').value) || 0;
            let desc = parseFloat(document.getElementById('pdv-desconto').value) || 0; 
            if(desc > (sub + frete)) desc = sub + frete; 
            const tot = sub + frete - desc; 
            document.getElementById('pdv-subtotal').innerText = formatMoney(sub); 
            document.getElementById('pdv-total').innerText = formatMoney(tot); 
            document.getElementById('pdv-qtd-itens').innerText = `${cart.reduce((a,b)=>a+b.qtd,0)} itens`; 
            calcularPreviaParcelas(tot); return { sub, desc, frete, tot }; 
        }

        function calcularPreviaParcelas(totalParam = null) { 
            const parc = parseInt(document.getElementById('pdv-parcelas').value) || 1; 
            let tot = totalParam !== null ? totalParam : pdvAtualizarTotais().tot;
            document.getElementById('pdv-previa-parcelas').innerText = tot > 0 && parc > 0 ? `${parc}x de ${formatMoney(tot/parc)}` : '1x de R$ 0,00'; 
        }

        function pdvSelPagamento(btnEl, metodo) { 
            document.querySelectorAll('.btn-pag').forEach(b => b.classList.remove('bg-blue-50','border-blue-500','text-blue-700','ring-2')); 
            btnEl.classList.add('bg-blue-50','border-blue-500','text-blue-700','ring-2'); 
            document.getElementById('pdv-pagamento-selecionado').value = metodo; 
            const area = document.getElementById('area-parcelamento'); 
            if(metodo === 'Cartão Crédito' || metodo === 'Boleto' || metodo === 'Fiado') { area.classList.remove('hidden'); calcularPreviaParcelas(); } else { area.classList.add('hidden'); document.getElementById('pdv-parcelas').value = 1; } 
        }

        function pdvFinalizar() {
            if(cart.length === 0) return showToast('O carrinho está vazio!', 'error');
            const pag = document.getElementById('pdv-pagamento-selecionado').value;
            if(!pag) return showToast('Selecione o Pagamento!', 'error');
            if(db.caixa.status !== 'ABERTO') return showToast('O Caixa está FECHADO. Abra no menu Financeiro.', 'error');

            const { sub, desc, frete, tot } = pdvAtualizarTotais(); 
            const custoTotal = cart.reduce((acc, i) => acc + (i.custo * i.qtd), 0);
            
            let parc = parseInt(document.getElementById('pdv-parcelas').value) || 1; 
            
            // LÓGICA DE TAXAS / LÍQUIDO / CUSTO DA VENDA
            let taxaPct = 0;
            if (db.config && db.config.taxas) {
                if (pag === 'Cartão Crédito') {
                    let pNum = parc > 12 ? 12 : parc;
                    taxaPct = db.config.taxas['Cartão Crédito'][pNum] || 0;
                } else { taxaPct = db.config.taxas[pag] || 0; }
            }
            const taxaValor = tot * (taxaPct / 100);
            const valorLiquido = tot - taxaValor;
            const lucroReal = valorLiquido - custoTotal;

            const cId = document.getElementById('pdv-cliente').value; 
            const cNome = cId === "0" ? 'Consumidor Final' : (db.clientes.find(x => String(x.id) === String(cId))?.nome || 'Consumidor Final');
            const op = document.getElementById('pdv-operacao').value; 
            const vend = document.getElementById('pdv-vendedor').value; 
            const obsTexto = document.getElementById('pdv-obs') ? document.getElementById('pdv-obs').value.trim() : ''; 
            const vendaId = Date.now(); 
            
            // GERAR NÚMERO DE PEDIDO SEQUENCIAL
            const numeroPedido = db.vendas.length > 0 ? Math.max(...db.vendas.map(v => v.numeroPedido || 0)) + 1 : 1;
            const numPedStr = String(numeroPedido).padStart(4, '0');

            const dataIso = new Date().toISOString();
            let txtFrete = frete > 0 ? `<p style="margin: 2px 0;">Frete/Entrega: ${formatMoney(frete)}</p>` : '';
            
            let htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÓVEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: ${op.toUpperCase()}</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data: ${new Date().toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${cNome}</p><p style="margin: 2px 0;">Vendedor: ${vend}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${cart.map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${formatMoney(i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><p style="margin: 2px 0;">Subtotal: ${formatMoney(sub)}</p>${txtFrete}<p style="margin: 2px 0;">Desconto: ${formatMoney(desc)}</p><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total: ${formatMoney(tot)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${pag}</p>${parc > 1 ? `<p style="margin: 2px 0; font-size: 0.85em;">Parcelado em ${parc}x</p>` : ''}</div>`;

            cart.forEach(item => { const p = db.produtos.find(x => x.id === item.id); if(p) { p.estoque -= item.qtd; salvarKardex(`Venda #${numPedStr}`, p.id, p.nome, -item.qtd, 'VENDA'); } });
            
            db.vendas.unshift({ 
                id: vendaId, numeroPedido: numeroPedido, data: dataIso, clienteId: cId, clienteNome: cNome, 
                subtotal: sub, frete: frete, desconto: desc,
                tot: tot, taxaPct: taxaPct, taxaValor: taxaValor, valorLiquido: valorLiquido, 
                custoTotal: custoTotal, lucroReal: lucroReal, 
                pag: pag, parcelas: parc, vendedor: vend, obs: obsTexto, itens: [...cart] 
            });
            
            if(pag === 'Fiado' || pag === 'Boleto' || pag.includes('Crédito') || pag.includes('Prazo')) {
                const valParc = valorLiquido / parc; 
                for(let i=1; i<=parc; i++) { db.financeiro.unshift({ id: Date.now()+i, ref: `Venda #${numPedStr} (${i}/${parc})`, data: dataIso, pessoa: cNome, wpp: '', valor: valParc, status: 'PENDENTE', tipo: 'RECEITA', categoria: 'Vendas' }); }
            } else if (pag === 'Dinheiro' || pag === 'PIX' || pag.includes('Débito')) {
                db.financeiro.unshift({ id: Date.now()+1, ref: `Venda #${numPedStr} (PDV)`, data: dataIso, pessoa: cNome, wpp: '', valor: valorLiquido, status: 'PAGO', tipo: 'RECEITA', categoria: 'Vendas', metodoPagamento: pag, dataPagamento: dataIso });
                if(pag === 'Dinheiro') { db.caixa.saldo += valorLiquido; db.caixa.historico.unshift({ data: dataIso, tipo: 'ENTRADA', desc: `Venda #${numPedStr}`, valor: valorLiquido }); }
            }
            saveDB(); document.getElementById('print-area').innerHTML = htmlRecibo; document.getElementById('modal-opcoes-recibo').classList.remove('hidden'); pdvLimpar();
        }

        function fecharModalOpcoesRecibo() { document.getElementById('modal-opcoes-recibo').classList.add('hidden'); }

        // ==========================================
        // 9. HISTÓRICO DE VENDAS E EXCLUSÃO (ESTORNO)
        // ==========================================
        function renderVendas() {
            const termo = document.getElementById('busca-vendas').value.toLowerCase().trim();
            const dataIni = document.getElementById('filtro-vendas-ini').value;
            const dataFim = document.getElementById('filtro-vendas-fim').value;
            const pgto = document.getElementById('filtro-vendas-pgto').value;

            let filtrados = db.vendas || [];

            if (termo) filtrados = filtrados.filter(v => v.clienteNome.toLowerCase().includes(termo) || String(v.numeroPedido).includes(termo) || (v.vendedor && v.vendedor.toLowerCase().includes(termo)));
            if (pgto !== 'TODOS') filtrados = filtrados.filter(v => v.pag && v.pag.includes(pgto));
            
            if (dataIni) { const dIni = new Date(dataIni + 'T00:00:00').getTime(); filtrados = filtrados.filter(v => new Date(v.data).getTime() >= dIni); }
            if (dataFim) { const dFim = new Date(dataFim + 'T23:59:59').getTime(); filtrados = filtrados.filter(v => new Date(v.data).getTime() <= dFim); }

            filtrados.sort((a,b) => new Date(b.data) - new Date(a.data));

            const tbody = document.getElementById('tabela-vendas-body');
            let totalLucro = 0;
            let linhas = '';

            filtrados.forEach(v => {
                const liq = v.valorLiquido || v.tot; 
                const txV = v.taxaValor || 0; 
                const txP = v.taxaPct || 0;
                const custoProd = v.custoTotal || 0;
                
                const custoTotalDaVenda = custoProd + txV;
                const lucroDaVenda = v.tot - custoTotalDaVenda; 
                const numPedStr = String(v.numeroPedido || v.id).padStart(4, '0');
                
                totalLucro += lucroDaVenda;

                linhas += `
                <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                    <td class="p-3 text-slate-500 dark:text-slate-400 text-xs">${formatData(v.data)}</td>
                    <td class="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">#${numPedStr}</td>
                    <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${v.clienteNome} <br> <span class="text-[10px] text-slate-400 font-normal">Vend: ${v.vendedor || '-'}</span></td>
                    <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${v.pag} ${v.parcelas > 1 ? '('+v.parcelas+'x)' : ''}</span></td>
                    <td class="p-3 text-right font-black text-slate-700 dark:text-slate-200">${formatMoney(v.tot)}</td>
                    <td class="p-3 text-right font-bold text-red-500">-${formatMoney(custoTotalDaVenda)} <br><span class="text-[9px] font-normal text-slate-400">Prod: ${formatMoney(custoProd)} | Taxa: ${formatMoney(txV)}</span></td>
                    <td class="p-3 text-right font-black text-emerald-600">${formatMoney(lucroDaVenda)}</td>
                    <td class="p-3 text-center flex items-center justify-center gap-1 print:hidden">
                        <button onclick="verDetalhesVenda('${v.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded font-bold text-xs" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="reimprimirVenda('${v.id}')" class="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:bg-slate-700 px-2 py-1.5 rounded font-bold text-xs" title="Reimprimir Recibo"><i class="fa-solid fa-print"></i></button>
                        <button onclick="excluirVenda('${v.id}')" class="text-red-500 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded font-bold text-xs ml-1" title="Excluir Venda e Estornar Estoque"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
            });
            
            tbody.innerHTML = linhas || '<tr><td colspan="8" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma venda encontrada com os filtros atuais.</td></tr>';
            document.getElementById('vendas-total-filtros').innerText = `Lucro Real Acumulado: ${formatMoney(totalLucro)}`;
        }

        function excluirVenda(id) {
            abrirConfirmacao('Excluir Venda e Estornar', 'Isso irá devolver os produtos ao estoque e remover os lançamentos do Financeiro. Confirma?', () => {
                try {
                    const v = db.vendas.find(x => x.id === id);
                    if(v) {
                        const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
                        
                        // 1. Devolve os produtos para o estoque
                        if(v.itens && v.itens.length > 0) {
                            v.itens.forEach(item => {
                                const p = db.produtos.find(prod => prod.id === item.id);
                                if(p) { 
                                    p.estoque += item.qtd; 
                                    salvarKardex(`Estorno Venda #${numPedStr}`, p.id, p.nome, item.qtd, 'ESTORNO'); 
                                }
                            });
                        }

                        // 2. Remove os títulos gerados no financeiro
                        db.financeiro = db.financeiro.filter(f => f.ref ? !f.ref.includes(`Venda #${numPedStr}`) : true);

                        // 3. Tira o dinheiro do caixa se a venda foi no Dinheiro
                        if(v.pag === 'Dinheiro') {
                            if(!db.caixa) db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
                            if(!db.caixa.historico) db.caixa.historico = [];
                            
                            db.caixa.saldo -= v.valorLiquido;
                            db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Estorno Venda #${numPedStr}`, valor: v.valorLiquido });
                        }

                        // 4. Exclui a venda do banco de dados
                        db.vendas = db.vendas.filter(x => x.id !== id);
                        
                        saveDB(); 
                        renderVendas(); 
                        showToast('Venda excluída com sucesso!', 'success');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('Erro ao excluir a venda.', 'error');
                }
            });
        }

        function reimprimirVenda(id) {
            const v = db.vendas.find(x => x.id === id); if(!v) return;
            const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
            const htmlRecibo = `<div style="text-align: center; border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px;"><h2 style="font-weight: bold; font-size: 1.2em; margin: 0;">FC MÓVEIS E INTERIORES</h2><p style="font-size: 0.9em; margin: 0;">Operação: REIMPRESSÃO</p></div><div style="border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em;"><p style="margin: 2px 0;">Pedido: #${numPedStr}</p><p style="margin: 2px 0;">Data Original: ${new Date(v.data).toLocaleString('pt-BR')}</p><p style="margin: 2px 0;">Cliente: ${v.clienteNome}</p><p style="margin: 2px 0;">Vendedor: ${v.vendedor || '-'}</p></div><table style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse; margin-bottom: 10px;"><tr style="border-bottom: 1px solid #ccc;"><th style="padding-bottom: 4px;">Item</th><th style="padding-bottom: 4px; text-align: center;">Qtd</th><th style="padding-bottom: 4px; text-align: right;">Total</th></tr>${v.itens.map(i => `<tr><td style="padding: 4px 0;">${i.nome}</td><td style="padding: 4px 0; text-align: center;">${i.qtd}</td><td style="padding: 4px 0; text-align: right;">${formatMoney(i.preco*i.qtd)}</td></tr>`).join('')}</table><div style="text-align: right; font-size: 0.9em;"><h3 style="font-weight: bold; font-size: 1.2em; margin: 5px 0 0 0;">Total Final: ${formatMoney(v.tot)}</h3></div><div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #999; text-align: center; font-size: 0.9em;"><p style="margin: 0; font-weight: bold; text-transform: uppercase;">PAGAMENTO: ${v.pag}</p></div>`;
            document.getElementById('print-area').innerHTML = htmlRecibo; document.getElementById('modal-opcoes-recibo').classList.remove('hidden');
        }

        function verDetalhesVenda(id) {
    const v = db.vendas.find(x => String(x.id) === String(id)); 
    if(!v) return; 
    
    const isGestao = window.location.href.includes('gestao');
    
    const subtitleEl = document.querySelector('#modal-detalhes-venda p.text-slate-400.uppercase');
    if (subtitleEl) {
        subtitleEl.innerText = isGestao ? 'Vis\u00e3o Gerencial de Custos e Lucros' : 'Vis\u00e3o Detalhada';
    }
    
    const numPedStr = v.numeroPedido ? String(v.numeroPedido).padStart(4, '0') : String(v.id).slice(-4);
    let tipoTexto = v.tipo || 'VENDA';
    
    document.getElementById('det-venda-cliente').innerText = v.clienteNome || 'Desconhecido'; 
    document.getElementById('det-venda-data').innerText = `${v.data ? formatData(v.data).split(' ')[0] : '-'} | #${numPedStr}`; 
    document.getElementById('det-venda-pag').innerText = tipoTexto === 'OR\u00c7AMENTO' ? 'Or\u00e7amento' : (v.pag || '-'); 
    
    let osInfoHtml = '';
    if (tipoTexto === 'SERVI\u00c7O' && v.servicoDetalhes) {
        let galeriaHtml = '';
        if (v.servicoDetalhes.fotos && v.servicoDetalhes.fotos.length > 0) { 
            galeriaHtml = `<p class="mt-2"><strong>Fotos de Refer\u00eancia:</strong></p><div class="flex gap-2 flex-wrap mt-1">${v.servicoDetalhes.fotos.map(f => `<img src="${f}" onclick="abrirZoom('${f}')" class="h-20 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`).join('')}</div>`; 
        } else if (v.servicoDetalhes.foto) { 
            galeriaHtml = `<p class="mt-2"><strong>Foto de Refer\u00eancia:</strong></p><img src="${v.servicoDetalhes.foto}" onclick="abrirZoom('${v.servicoDetalhes.foto}')" class="mt-1 h-24 rounded border border-purple-300 cursor-zoom-in shadow-sm hover:opacity-80 transition" title="Clique para ampliar">`; 
        }
        osInfoHtml = `
            <div class="mt-4 bg-purple-50 dark:bg-purple-900/20 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800/50 text-xs md:text-sm text-purple-900 dark:text-purple-200">
                <h4 class="font-bold mb-2 uppercase text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800/50 pb-2"><i class="fa-solid fa-clipboard-list"></i> Ficha da Ordem de Servi\u00e7o</h4>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <p><strong>Prazo de Entrega:</strong> ${v.servicoDetalhes.prazo ? v.servicoDetalhes.prazo.split('-').reverse().join('/') : 'N\u00e3o informado'}</p>
                    <p><strong>Garantia:</strong> ${v.servicoDetalhes.garantia || 'Nenhuma'}</p>
                </div>
                <p class="mb-2"><strong>Escopo / Diagn\u00f3stico:</strong><br> ${v.servicoDetalhes.desc || 'Nenhum detalhe adicional.'}</p>
                ${galeriaHtml}
            </div>`;
    }
    
    document.getElementById('det-venda-obs').innerHTML = (v.obs ? v.obs : '<span class="text-slate-400 italic">Nenhuma observa\u00e7\u00e3o geral vinculada a esta venda.</span>') + osInfoHtml;
    
    let totalCusto = 0;
    document.getElementById('det-venda-itens').innerHTML = (v.itens || []).map(i => {
        const preco = Number(i.preco) || 0;
        const qtd = Number(i.qtd) || 1;
        const custo = Number(i.custo) || 0;
        
        const subTot = preco * qtd;
        const subCusto = custo * qtd;
        const lucroSub = subTot - subCusto;
        
        totalCusto += subCusto;
        
        return `
        <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors group">
            <td class="p-4 border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${i.nome || 'Produto/Servi\u00e7o'}</div>
                ${i.obsVenda ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md"><i class="fa-solid fa-note-sticky mr-1"></i>${i.obsVenda}</div>` : ''}
            </td>
            <td class="p-4 text-center border-b border-slate-100 dark:border-slate-800/50">
                <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700">${qtd}</span>
            </td>
            <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-black text-slate-700 dark:text-slate-300 text-sm">${typeof formatMoney === 'function' ? formatMoney(preco) : preco}</div>
                ${isGestao ? `<div class="text-[10px] text-red-500/80 dark:text-red-400/80 font-bold mt-0.5 bg-red-50 dark:bg-red-900/20 inline-block px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800/30">Custo: ${typeof formatMoney === 'function' ? formatMoney(custo) : custo}</div>` : ''}
            </td>
            <td class="p-4 text-right border-b border-slate-100 dark:border-slate-800/50">
                <div class="font-black text-slate-800 dark:text-white text-sm">${typeof formatMoney === 'function' ? formatMoney(subTot) : subTot}</div>
                ${isGestao ? `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">Lucro: ${typeof formatMoney === 'function' ? formatMoney(lucroSub) : lucroSub}</div>` : ''}
            </td>
        </tr>`;
    }).join('');
    
    const tot = Number(v.tot) || 0;
    const taxaCartao = Number(v.taxaValor) || 0;
    const lucroLiquido = tot - totalCusto - taxaCartao;
    
    const tfootEl = document.querySelector('#det-venda-tfoot');
    if (tfootEl) {
        let tfootHtml = '';
        if (isGestao) {
            tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Custo Total (Produtos)</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(totalCusto) : totalCusto}</td>
                </tr>
            `;
            if (taxaCartao > 0) {
                tfootHtml += `
                <tr>
                    <td colspan="3" class="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Taxa de Cart\u00e3o / Despesa</td>
                    <td class="p-4 text-right font-black text-red-500 dark:text-red-400 text-sm bg-red-50/50 dark:bg-red-900/10">- ${typeof formatMoney === 'function' ? formatMoney(taxaCartao) : taxaCartao}</td>
                </tr>`;
            }
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Valor Bruto Total</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
                </tr>
                <tr class="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-wide">Lucro L\u00edquido Real</td>
                    <td class="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-xl shadow-sm">${typeof formatMoney === 'function' ? formatMoney(lucroLiquido) : lucroLiquido}</td>
                </tr>
            `;
        } else {
            tfootHtml += `
                <tr class="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                    <td colspan="3" class="p-4 text-right font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Total Geral</td>
                    <td class="p-4 text-right font-black text-slate-900 dark:text-white text-lg">${typeof formatMoney === 'function' ? formatMoney(tot) : tot}</td>
                </tr>
            `;
        }
        tfootEl.innerHTML = tfootHtml;
    }
    
    document.getElementById('modal-detalhes-venda').classList.remove('hidden');
}

function fecharModalDetalhesVenda() { 
    document.getElementById('modal-detalhes-venda').classList.add('hidden'); 
}


        // ==========================================
        // 10. FINANCEIRO E CAIXA DIÁRIO
        // ==========================================
        function renderFinAbas(aba) {
            document.querySelectorAll('.fin-area').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="fin-tab-"]').forEach(el => { el.classList.remove('bg-blue-600', 'text-white'); el.classList.add('text-slate-600 dark:text-slate-300'); });
            
            document.getElementById(`fin-area-${aba}`).classList.remove('hidden');
            document.getElementById(`fin-tab-${aba}`).classList.remove('text-slate-600 dark:text-slate-300');
            document.getElementById(`fin-tab-${aba}`).classList.add('bg-blue-600', 'text-white');

            if(aba === 'caixa') renderCaixaDiario();
            if(aba === 'receber') renderTitulos('RECEITA');
            if(aba === 'pagar') renderTitulos('DESPESA');
        }

        function renderCaixaDiario() {
            document.getElementById('caixa-saldo-display').innerText = formatMoney(db.caixa.saldo);
            const b = document.getElementById('caixa-status-badge');
            if(db.caixa.status === 'ABERTO') { b.innerText = 'ABERTO'; b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-emerald-100 text-emerald-700 border border-emerald-300'; } 
            else { b.innerText = 'FECHADO'; b.className = 'px-4 py-2 rounded-lg font-black text-lg mb-4 bg-red-100 text-red-700 border border-red-300'; }

            const hoje = new Date().toISOString().split('T')[0];
            const movs = db.caixa.historico.filter(m => m.data.startsWith(hoje));
            document.getElementById('tabela-caixa-historico').innerHTML = movs.map(m => `
                <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                    <td class="p-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">${formatData(m.data).split(' ')[1]}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${m.tipo}</span></td>
                    <td class="p-3 text-slate-700 dark:text-slate-200 text-xs font-bold">${m.desc}</td>
                    <td class="p-3 text-right font-black ${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? 'text-emerald-500' : 'text-red-500'}">${m.tipo==='ENTRADA' || m.tipo==='ABERTURA' ? '+ ' : '- '}${formatMoney(m.valor)}</td>
                </tr>
            `).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Sem movimentos hoje no caixa físico.</td></tr>';
        }

        function abrirModalCaixa(op) {
            if(op === 'abrir' && db.caixa.status === 'ABERTO') return showToast('O caixa já está aberto!', 'error');
            if(op !== 'abrir' && db.caixa.status === 'FECHADO') return showToast('Abra o caixa primeiro!', 'error');
            
            document.getElementById('caixa-operacao-tipo').value = op.toUpperCase();
            document.getElementById('modal-caixa-title').innerText = op === 'abrir' ? 'Abertura de Caixa' : (op === 'fechar' ? 'Fechamento de Caixa' : (op === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'));
            document.getElementById('caixa-op-valor').value = ''; document.getElementById('caixa-op-desc').value = '';
            
            if(op === 'fechar') { document.getElementById('caixa-op-valor').value = db.caixa.saldo; document.getElementById('caixa-op-desc').value = 'Fechamento do dia'; }
            if(op === 'abrir') { document.getElementById('caixa-op-valor').value = 0; document.getElementById('caixa-op-desc').value = 'Troco Inicial'; }
            
            document.getElementById('modal-mov-caixa').classList.remove('hidden');
        }

        function fecharModalCaixa() { document.getElementById('modal-mov-caixa').classList.add('hidden'); }

        function confirmarMovCaixa() {
            const op = document.getElementById('caixa-operacao-tipo').value;
            const val = parseFloat(document.getElementById('caixa-op-valor').value) || 0;
            const desc = document.getElementById('caixa-op-desc').value || op;

            if(op === 'ABRIR') { db.caixa.status = 'ABERTO'; db.caixa.saldo = val; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'ABERTURA', desc, valor: val }); }
            else if(op === 'FECHAR') { db.caixa.status = 'FECHADO'; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'FECHAMENTO', desc: `Fechamento (Retirado: ${formatMoney(val)})`, valor: val }); db.caixa.saldo -= val; }
            else if(op === 'SANGRIA') { if(val > db.caixa.saldo) return showToast('Saldo insuficiente para sangria!', 'error'); db.caixa.saldo -= val; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `SANGRIA: ${desc}`, valor: val }); }
            else if(op === 'SUPRIMENTO') { db.caixa.saldo += val; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `SUPRIMENTO: ${desc}`, valor: val }); }

            saveDB(); fecharModalCaixa(); renderCaixaDiario(); showToast('Operação realizada com sucesso!', 'success');
        }

        function renderTitulos(tipo) {
    const prefix = tipo === 'RECEITA' ? 'receber' : 'pagar';
    if (!document.getElementById('tabela-fin-' + prefix)) return;
    if (!db.financeiro) return;
    
    const statusFilterEl = document.getElementById('filtro-' + prefix + '-status');
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'TODOS';
    
    const periodoFilterEl = document.getElementById('filtro-' + prefix + '-periodo');
    const periodoFilter = periodoFilterEl ? periodoFilterEl.value : 'TUDO';
    
    const buscaEl = document.getElementById('busca-fin-' + prefix);
    const termoBusca = buscaEl ? buscaEl.value.toLowerCase() : '';
    
    const dataIniEl = document.getElementById('filtro-' + prefix + '-ini');
    const dataIni = dataIniEl ? dataIniEl.value : '';
    
    const dataFimEl = document.getElementById('filtro-' + prefix + '-fim');
    const dataFim = dataFimEl ? dataFimEl.value : '';
    
    let lista = db.financeiro.filter(f => (f.tipo === tipo || (!f.tipo && tipo === 'RECEITA')));
    
    if (termoBusca) { lista = lista.filter(f => (f.pessoa && f.pessoa.toLowerCase().includes(termoBusca)) || (f.ref && f.ref.toLowerCase().includes(termoBusca)) || (f.categoria && f.categoria.toLowerCase().includes(termoBusca))); }
            if(statusFilter !== 'TODOS') { lista = lista.filter(f => f.status === statusFilter); }

            lista.sort((a, b) => {
                if (sortOrder === 'venc_asc') return new Date(a.data) - new Date(b.data);
                if (sortOrder === 'venc_desc') return new Date(b.data) - new Date(a.data);
                if (sortOrder === 'valor_desc') return b.valor - a.valor;
                if (sortOrder === 'valor_asc') return a.valor - b.valor;
                return 0;
            });

            const tbody = document.getElementById(`tabela-fin-${prefix}`);
            let linhas = '';
            lista.forEach(f => {
                const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime();
                const corStatus = f.status === 'PAGO' ? 'bg-emerald-100 text-emerald-700' : (isAtrasado ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700');
                const badgeStatus = f.status === 'PAGO' ? 'PAGO' : (isAtrasado ? 'ATRASADO' : 'PENDENTE');

                let btnWhats = '';
                if(tipo === 'RECEITA' && f.status === 'PENDENTE') {
                    let c = db.clientes.find(cli => cli.nome === f.pessoa); let nro = c && c.wpp ? c.wpp.replace(/\D/g, '') : '';
                    if(nro) { let texto = `Olá! Notamos que há um título pendente no valor de ${formatMoney(f.valor)} (Ref: ${f.ref}). Por favor, entre em contato para regularizarmos.`; btnWhats = `<a href="https://wa.me/55${nro}?text=${encodeURIComponent(texto)}" target="_blank" class="text-emerald-500 hover:text-emerald-700 p-2 print:hidden" title="Cobrar por WhatsApp"><i class="fa-brands fa-whatsapp text-lg"></i></a>`; }
                }

                linhas += `
                <tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                    <td class="p-3 text-slate-500 dark:text-slate-400 font-mono text-xs">${formatData(f.data).split(' ')[0]}</td>
                    <td class="p-3 font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">${f.pessoa}</td>
                    <td class="p-3 text-slate-600 dark:text-slate-300 text-[11px]">${f.categoria || '-'} <br><span class="font-bold">${f.ref}</span></td>
                    <td class="p-3 text-right font-black ${tipo === 'RECEITA' ? 'text-blue-600' : 'text-red-500'}">${formatMoney(f.valor)}</td>
                    <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${corStatus}">${badgeStatus}</span></td>
                    <td class="p-3 text-center flex items-center justify-center gap-1 print:hidden">
                        <button onclick="verDetalhesTitulo('${f.id}')" class="text-blue-500 hover:text-blue-700 p-1.5" title="Detalhes do Título"><i class="fa-solid fa-eye"></i></button>
                        ${btnWhats}
                        ${f.status === 'PENDENTE' ? `<button onclick="abrirModalBaixa('${f.id}')" class="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-bold hover:bg-blue-100">Baixar</button>` : ``}
                        <button onclick="excluirTitulo('${f.id}')" class="text-slate-400 hover:text-red-500 p-1.5 ml-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = linhas || `<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhum título encontrado.</td></tr>`;
        }

        function abrirModalConta(tipo) {
            document.getElementById('conta-id').value = ''; document.getElementById('conta-tipo').value = tipo === 'RECEBER' ? 'RECEITA' : 'DESPESA';
            document.getElementById('lbl-conta-pessoa').innerText = tipo === 'RECEBER' ? 'Cliente / Pagador *' : 'Fornecedor / Favorecido *';
            document.getElementById('conta-categoria').innerHTML = (tipo === 'RECEBER' ? categoriasReceber : categoriasPagar).map(c => `<option value="${c}">${c}</option>`).join('');
            document.getElementById('modal-conta-header').className = `p-5 text-white flex justify-between items-center ${tipo === 'RECEBER' ? 'bg-emerald-500' : 'bg-red-500'}`;
            document.getElementById('modal-conta-title').innerText = tipo === 'RECEBER' ? 'Nova Conta a Receber' : 'Nova Conta a Pagar';
            ['pessoa','ref','vencimento','valor'].forEach(id => document.getElementById(`conta-${id}`).value = '');
            document.getElementById('modal-nova-conta').classList.remove('hidden');
        }

        function fecharModalConta() { document.getElementById('modal-nova-conta').classList.add('hidden'); }

        function salvarConta() {
            const tipo = document.getElementById('conta-tipo').value; const pessoa = document.getElementById('conta-pessoa').value.trim(); const valor = parseFloat(document.getElementById('conta-valor').value); const venc = document.getElementById('conta-vencimento').value;
            if(!pessoa || isNaN(valor) || !venc) return showToast('Preencha Todos os campos!', 'error');
            const dtIso = new Date(venc + 'T12:00:00').toISOString();
            db.financeiro.unshift({ id: Date.now(), tipo: tipo, pessoa: pessoa, ref: document.getElementById('conta-ref').value || 'Avulso', categoria: document.getElementById('conta-categoria').value, data: dtIso, valor: valor, status: 'PENDENTE' });
            saveDB(); fecharModalConta(); renderFinAbas(tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Título Salvo!', 'success');
        }

        function excluirTitulo(id) { abrirConfirmacao('Excluir Título', 'Deseja apagar permanentemente?', () => { const tit = db.financeiro.find(f => f.id === id); db.financeiro = db.financeiro.filter(f => f.id !== id); saveDB(); if(tit) renderFinAbas(tit.tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Excluído!'); }); }

        function verDetalhesTitulo(id) {
            const f = db.financeiro.find(x => x.id === id); if(!f) return;
            const isReceita = f.tipo === 'RECEITA' || !f.tipo;
            document.getElementById('det-tit-header').className = `p-5 text-white flex justify-between items-center ${isReceita ? 'bg-blue-600' : 'bg-red-600'}`;
            document.getElementById('det-tit-lbl-pessoa').innerText = isReceita ? 'Cliente / Pagador' : 'Fornecedor / Favorecido'; document.getElementById('det-tit-pessoa').innerText = f.pessoa || 'Não informado';
            
            const isAtrasado = f.status === 'PENDENTE' && new Date(f.data).getTime() < new Date().getTime();
            const badge = document.getElementById('det-tit-status');
            badge.innerText = f.status === 'PAGO' ? 'PAGO' : (isAtrasado ? 'ATRASADO' : 'PENDENTE');
            badge.className = `mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${f.status === 'PAGO' ? 'bg-emerald-100 text-emerald-700' : (isAtrasado ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}`;

            document.getElementById('det-tit-venc').innerText = formatData(f.data).split(' ')[0]; document.getElementById('det-tit-valor-orig').innerText = formatMoney(f.valor);
            document.getElementById('det-tit-ref').innerText = f.ref || '-'; document.getElementById('det-tit-cat').innerText = f.categoria || '-';

            const areaPgto = document.getElementById('det-tit-area-pagamento');
            if(f.status === 'PAGO') {
                areaPgto.classList.remove('hidden'); document.getElementById('det-tit-dtpag').innerText = f.dataPagamento ? formatData(f.dataPagamento).split(' ')[0] : '-';
                document.getElementById('det-tit-metodo').innerText = f.metodoPagamento || '-'; document.getElementById('det-tit-valfinal').innerText = formatMoney(f.valorPago || f.valor);
            } else { areaPgto.classList.add('hidden'); }
            document.getElementById('modal-detalhes-titulo').classList.remove('hidden');
        }
        function fecharModalDetalhesTitulo() { document.getElementById('modal-detalhes-titulo').classList.add('hidden'); }

        function abrirModalBaixa(id) { const f = db.financeiro.find(x => x.id === id); if(!f) return; document.getElementById('baixa-id').value = f.id; document.getElementById('baixa-valor-original').innerText = formatMoney(f.valor); document.getElementById('baixa-vencimento').innerText = formatData(f.data).split(' ')[0]; document.getElementById('baixa-acrescimo').value = 0; document.getElementById('baixa-desconto').value = 0; calcularAcrescimos(); document.getElementById('modal-baixa-conta').classList.remove('hidden'); }
        function fecharModalBaixa() { document.getElementById('modal-baixa-conta').classList.add('hidden'); }
        function calcularAcrescimos() { const id = parseInt(document.getElementById('baixa-id').value); const f = db.financeiro.find(x => x.id === id); if(!f) return; const ac = parseFloat(document.getElementById('baixa-acrescimo').value) || 0; const de = parseFloat(document.getElementById('baixa-desconto').value) || 0; const vf = f.valor + ac - de; document.getElementById('baixa-valor-final').innerText = formatMoney(vf); return vf; }

        function confirmarBaixa() {
            const id = parseInt(document.getElementById('baixa-id').value); const f = db.financeiro.find(x => x.id === id); if(!f) return;
            const vf = calcularAcrescimos(); const metodo = document.getElementById('baixa-metodo').value;

            if(metodo === 'Dinheiro') {
                if(db.caixa.status !== 'ABERTO') return showToast('Abra o Caixa Físico primeiro!', 'error');
                if(f.tipo === 'RECEITA') { db.caixa.saldo += vf; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'ENTRADA', desc: `Recbto. Título: ${f.pessoa}`, valor: vf }); } 
                else { if(vf > db.caixa.saldo) return showToast('Saldo do Caixa insuficiente!', 'error'); db.caixa.saldo -= vf; db.caixa.historico.unshift({ data: new Date().toISOString(), tipo: 'SAIDA', desc: `Pgto. Título: ${f.pessoa}`, valor: vf }); }
            }
            f.status = 'PAGO'; f.valorPago = vf; f.metodoPagamento = metodo; f.dataPagamento = new Date().toISOString();
            saveDB(); fecharModalBaixa(); renderFinAbas(f.tipo === 'RECEITA' ? 'receber' : 'pagar'); showToast('Baixa realizada com sucesso!', 'success');
        }

        // ==========================================
        // 11. COMPRAS E NF-E
        // ==========================================
        function processarXMLReal(event) {
            const file = event.target.files[0]; if(!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const parser = new DOMParser(); const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
                    const getFloatSafe = (context, tag) => { const node = context ? context.getElementsByTagName(tag)[0] : null; return node && node.textContent ? parseFloat(node.textContent) : 0; };
                    const getStringSafe = (context, tag) => { const node = context ? context.getElementsByTagName(tag)[0] : null; return node ? node.textContent : ''; };
                    const emit = xmlDoc.getElementsByTagName("emit")[0];
                    if(!emit) throw new Error("XML inválido.");

                    const fornNome = getStringSafe(emit, "xNome"); const fornCNPJ = getStringSafe(emit, "CNPJ"); const totalNF = getFloatSafe(xmlDoc, "vNF");
                    const detNodes = xmlDoc.getElementsByTagName("det"); const produtosXML = [];
                    for(let i=0; i<detNodes.length; i++) {
                        const prod = detNodes[i].getElementsByTagName("prod")[0]; const imposto = detNodes[i].getElementsByTagName("imposto")[0];
                        const nome = getStringSafe(prod, "xProd"); const cEAN = getStringSafe(prod, "cEAN");
                        const vProd = getFloatSafe(prod, "vProd"); const qCom = getFloatSafe(prod, "qCom");
                        const vFrete = getFloatSafe(prod, "vFrete"); const vDesc = getFloatSafe(prod, "vDesc");
                        const vIPI = getFloatSafe(imposto, "vIPI"); const vICMSST = getFloatSafe(imposto, "vICMSST");
                        const vTotalItemNaNota = vProd + vFrete - vDesc + vIPI + vICMSST;
                        produtosXML.push({ nItem: i+1, cEAN, nome, qCom, vTotalItemNaNota, statusDB: 'NOVO', idMatch: null, margemAtual: 50, custoFinal: 0, precoVendaSug: 0 });
                    }
                    window.tempXMLData = { fornNome, fornCNPJ, totalNF, produtosXML, freteExtra: 0 };
                    window.tempXMLData.produtosXML.forEach(p => {
                        let match = db.produtos.find(prod => (prod.ean && prod.ean === p.cEAN) || prod.nome.toLowerCase() === p.nome.toLowerCase());
                        if(match) { p.statusDB = 'ATUALIZAR'; p.idMatch = match.id; p.margemAtual = match.margem || 50; }
                        let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0;
                        let freteRateado = window.tempXMLData.freteExtra * pesoValor;
                        p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + freteRateado) / p.qCom) : 0;
                        p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100));
                    });
                    renderTelaConferenciaXML(); document.getElementById('modal-conferencia-xml').classList.remove('hidden');
                } catch (err) { showToast('Erro ao ler XML.', 'error'); }
            }; reader.readAsText(file); document.getElementById('xml-upload').value = '';
        }

        function recalcularRateioXML() {
            window.tempXMLData.freteExtra = parseFloat(document.getElementById('xml-frete-extra').value) || 0;
            window.tempXMLData.produtosXML.forEach(p => { let pesoValor = window.tempXMLData.totalNF > 0 ? (p.vTotalItemNaNota / window.tempXMLData.totalNF) : 0; p.custoFinal = p.qCom > 0 ? ((p.vTotalItemNaNota + (window.tempXMLData.freteExtra * pesoValor)) / p.qCom) : 0; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual / 100)); }); renderTelaConferenciaXML();
        }

        function xmlAtualizarValores(i, campo, val) {
            const p = window.tempXMLData.produtosXML[i]; val = parseFloat(val) || 0;
            if(campo === 'custo') { p.custoFinal = val; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); }
            if(campo === 'margem') { p.margemAtual = val; p.precoVendaSug = p.custoFinal * (1 + (p.margemAtual/100)); }
            if(campo === 'preco') { p.precoVendaSug = val; if(p.custoFinal>0) p.margemAtual = ((p.precoVendaSug-p.custoFinal)/p.custoFinal)*100; }
            renderTelaConferenciaXML();
        }

        function abrirModalProdutoDoXML(index) {
    const p = window.tempXMLData.produtosXML[index]; window.xmlItemEditIndex = index; document.getElementById('modal-produto').classList.remove('hidden');
    
    const divAcao = document.getElementById('div-acao-vinculo-xml');
    if(divAcao) divAcao.classList.remove('hidden'); 
    
    const selectAcao = document.getElementById('prod-acao-vinculo');
    const divBusca = document.getElementById('div-vinculo-busca');
    const selProd = document.getElementById('prod-vinculo-select');
    
    if(selectAcao) {
        selectAcao.value = (p.statusDB === 'ATUALIZAR' && p.idMatch) ? 'VINCULAR' : 'NOVO';
        if(selectAcao.value === 'VINCULAR') {
            divBusca.classList.remove('hidden');
            if(selProd && selProd.options.length <= 1) {
                let html = '<option value="">Selecione um produto...</option>';
                const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
                sorted.forEach(prod => {
                    html += "<option value=\"" + prod.id + "\">" + prod.nome + " (Estoque: " + prod.estoque + ")</option>";
                });
                selProd.innerHTML = html;
            }
            if(selProd) selProd.value = p.idMatch || '';
        } else {
            divBusca.classList.add('hidden');
        }
    }

    if(p.statusDB === 'ATUALIZAR' && p.idMatch) { 
        document.getElementById('prod-id').value = p.idMatch; document.getElementById('modal-produto-title').innerText = 'Atualizar Produto Vinculado'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    } 
    else { 
        document.getElementById('prod-id').value = ''; document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; 
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); 
    }
} 
            else { abrirModalProduto(); document.getElementById('modal-produto-title').innerText = 'Completar Novo Produto'; document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-ean').value = p.cEAN || ''; document.getElementById('prod-custo').value = p.custoFinal.toFixed(2); document.getElementById('prod-margem').value = p.margemAtual.toFixed(2); document.getElementById('prod-preco').value = p.precoVendaSug.toFixed(2); }
        }

        function renderTelaConferenciaXML() {
            const d = window.tempXMLData; document.getElementById('xml-forn-nome').innerText = d.fornNome; document.getElementById('xml-forn-cnpj').innerText = d.fornCNPJ; document.getElementById('xml-total-nota').innerText = formatMoney(d.totalNF);
            let linhas = '';
            d.produtosXML.forEach((p, i) => {
                linhas += `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-indigo-50">
                    <td class="p-2 text-xs"><input type="text" class="w-full bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none dark:text-white" value="${p.nome}" onchange="tempXMLData.produtosXML[${i}].nome = this.value"><span class="text-[10px] text-slate-500 dark:text-slate-400">EAN: ${p.cEAN || 'S/N'}</span></td>
                    <td class="p-2 text-xs text-center"><span class="${p.statusDB === 'NOVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded font-bold">${p.statusDB}</span></td>
                    <td class="p-2 text-xs text-center font-bold">${p.qCom}</td>
                    <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-red-600 outline-none dark:text-white" value="${p.custoFinal.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'custo', this.value)"></td>
                    <td class="p-2 text-xs text-center"><input type="number" step="0.1" class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold text-blue-600 outline-none dark:text-white" value="${p.margemAtual.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'margem', this.value)"> %</td>
                    <td class="p-2 text-xs text-right"><input type="number" step="0.01" class="w-24 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 text-right font-bold text-emerald-600 outline-none dark:text-white" value="${p.precoVendaSug.toFixed(2)}" onchange="xmlAtualizarValores(${i}, 'preco', this.value)"></td>
                    <td class="p-2 text-xs text-center"><button onclick="abrirModalProdutoDoXML('${i}')" class="text-indigo-500 bg-indigo-100 p-1.5 rounded"><i class="fa-solid fa-pen-to-square"></i></button></td>
                </tr>`;
            });
            document.getElementById('xml-produtos-body').innerHTML = linhas;
        }
        function fecharModalXML() { document.getElementById('modal-conferencia-xml').classList.add('hidden'); window.tempXMLData = null; }

        function salvarXMLConferido() {
            const data = window.tempXMLData; let totalQtd = 0;
            let forn = db.fornecedores.find(f => f.doc === data.fornCNPJ || f.cnpj === data.fornCNPJ);
            if(!forn) { db.fornecedores.push({ id: Date.now(), nome: data.fornNome, doc: data.fornCNPJ, cnpj: data.fornCNPJ, ie: '', wpp: '', email: '', contato: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', condicoes: '', produtos: '' }); }
            data.produtosXML.forEach(p => {
                let idProd = p.idMatch;
                if (p.statusDB === 'NOVO' && !idProd) {
                    idProd = Date.now() + Math.floor(Math.random() * 1000);
                    db.produtos.push({ id: idProd, ean: p.cEAN, nome: p.nome, categoria: 'Geral', marca: data.fornNome, custo: p.custoFinal, margem: p.margemAtual, preco: p.precoVendaSug, estoque: p.qCom, min: 5, foto: '', ativo: true });
                } else { let pDB = db.produtos.find(x => x.id === idProd); if (pDB) { pDB.estoque += p.qCom; pDB.custo = p.custoFinal; pDB.margem = p.margemAtual; pDB.preco = p.precoVendaSug; pDB.nome = p.nome; pDB.ativo = true; } }
                totalQtd += p.qCom; salvarKardex(`NF-e ${data.fornNome}`, idProd, p.nome, p.qCom, 'ENTRADA XML');
            });
            db.compras.unshift({ id: Date.now(), data: new Date().toISOString(), fornecedor: data.fornNome, cnpj: data.fornCNPJ, totalNF: data.totalNF, qtdTotal: totalQtd, itens: data.produtosXML });
            db.financeiro.unshift({ id: Date.now()+1, ref: `NF-e Entrada`, data: new Date().toISOString(), pessoa: data.fornNome, wpp: '', valor: data.totalNF, status: 'PENDENTE', tipo: 'DESPESA', categoria: 'Fornecedores' });
            saveDB(); fecharModalXML(); renderComprasHist(); renderProdutos(); renderFornecedores(); renderFinAbas('pagar'); showToast('Entrada de XML Concluída!', 'success');
        }

        function renderComprasHist() {
            if(!db.compras) db.compras = [];
            let linhas = '';
            db.compras.slice(0,20).forEach(c => {
                linhas += `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 text-xs">${formatData(c.data).split(' ')[0]}</td><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${c.fornecedor}</td><td class="p-4 text-right font-bold text-indigo-600">${formatMoney(c.totalNF)}</td><td class="p-4 text-center flex items-center justify-center gap-2"><button onclick="verDetalhesNF('${c.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg font-bold text-xs"><i class="fa-solid fa-eye"></i></button><button onclick="excluirNF('${c.id}')" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            });
            document.getElementById('tabela-compras-hist').innerHTML = linhas || '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma Nota Fiscal.</td></tr>';
        }
        function excluirNF(id) { abrirConfirmacao('Excluir Nota', 'Atenção: Não reverte o estoque nem o financeiro.', () => { db.compras = db.compras.filter(c => c.id !== id); saveDB(); renderComprasHist(); showToast('Nota excluída!'); }); }
        function verDetalhesNF(id) { const c = db.compras.find(x => x.id === id); if(!c) return; document.getElementById('det-nf-fornecedor').innerText = c.fornecedor; document.getElementById('det-nf-data').innerText = formatData(c.data); document.getElementById('det-nf-total').innerText = formatMoney(c.totalNF); document.getElementById('det-nf-itens').innerHTML = c.itens.map(i => `<tr class="border-b border-slate-100 dark:border-slate-700"><td class="p-3 text-xs">${i.nome}</td><td class="p-3 text-xs text-center font-bold">${i.qCom}</td><td class="p-3 text-xs text-right font-bold text-emerald-600">${formatMoney(i.custoFinal)}</td></tr>`).join(''); document.getElementById('modal-detalhes-nf').classList.remove('hidden'); }
        function fecharModalDetalhesNF() { document.getElementById('modal-detalhes-nf').classList.add('hidden'); }

        // ==========================================
        // 12. ESTOQUE KARDEX
        // ==========================================
        ); }
        function renderKardex() {
            let linhas = '';
            db.movimentacoes.slice(0, 50).forEach(m => {
                linhas += `<tr class="hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"><td class="p-4 text-xs text-slate-500 dark:text-slate-400">${formatData(m.data)}</td><td class="p-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.tipo.includes('ENTRADA') ? 'bg-indigo-100 text-indigo-700' : (m.tipo === 'VENDA' || m.tipo === 'SAIDA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}">${m.tipo}</span></td><td class="p-4 font-bold text-slate-800 dark:text-slate-100">${m.prodNome}</td><td class="p-4 text-slate-600 dark:text-slate-300 text-xs">${m.ref}</td><td class="p-4 text-right font-black ${m.qtd > 0 ? 'text-indigo-600' : 'text-red-500'}">${m.qtd > 0 ? '+'+m.qtd : m.qtd}</td></tr>`;
            });
            document.getElementById('tabela-kardex').innerHTML = linhas || '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">Nenhuma movimentação.</td></tr>'; 
        }

        // ==========================================
        // 13. RELATÓRIOS GERENCIAIS (BI E DRE)
        // ==========================================
        function renderDashboard() {
            const vendas = db.vendas || [];
            const fatTotal = vendas.reduce((a, b) => a + b.tot, 0); 
            const cmvTotal = vendas.reduce((a, b) => a + (b.custoTotal || 0), 0);
            const taxasTotal = vendas.reduce((a, b) => a + (b.taxaValor || 0), 0);
            const lucroReal = fatTotal - cmvTotal - taxasTotal;
            
            const aReceber = db.financeiro.filter(f => f.status === 'PENDENTE' && (!f.tipo || f.tipo === 'RECEITA')).reduce((a, b) => a + b.valor, 0);
            
            if(document.getElementById('dash-faturamento')) {
                document.getElementById('dash-faturamento').innerText = formatMoney(fatTotal); 
                document.getElementById('dash-lucro').innerText = formatMoney(lucroReal);
                document.getElementById('dash-receber').innerText = formatMoney(aReceber); 
                document.getElementById('dash-produtos').innerText = db.produtos.length;
            }

            if(document.getElementById('bi-receita')) {
                document.getElementById('bi-receita').innerText = formatMoney(fatTotal); 
                document.getElementById('bi-cmv').innerText = `- ${formatMoney(cmvTotal)}`; 
                if(document.getElementById('bi-taxas')) document.getElementById('bi-taxas').innerText = `- ${formatMoney(taxasTotal)}`;
                document.getElementById('bi-lucro').innerText = formatMoney(lucroReal);
                
                const rankingProd = {}; vendas.forEach(v => v.itens.forEach(i => { if(!rankingProd[i.nome]) rankingProd[i.nome] = 0; rankingProd[i.nome] += (i.preco * i.qtd); }));
                let linhasProd = ''; Object.keys(rankingProd).map(k => ({nome: k, val: rankingProd[k]})).sort((a,b) => b.val - a.val).slice(0,5).forEach((p, i) => { linhasProd += `<div class="flex justify-between text-sm border-b pb-1"><span class="truncate pr-2">${i+1}. ${p.nome}</span><span class="font-bold text-emerald-600">${formatMoney(p.val)}</span></div>`; });
                document.getElementById('bi-abc-produtos').innerHTML = linhasProd;

                const comissoes = {}; vendas.forEach(v => { const vend = v.vendedor || 'Desconhecido'; if(!comissoes[vend]) comissoes[vend] = 0; comissoes[vend] += v.tot; });
                let linhasCom = ''; Object.keys(comissoes).forEach(v => { linhasCom += `<div class="flex justify-between text-sm border-b pb-1"><span>${v}</span><span class="font-bold text-purple-600">${formatMoney(comissoes[v] * 0.05)}</span></div>`; });
                document.getElementById('bi-comissoes').innerHTML = linhasCom;

                const rankingCli = {}; vendas.forEach(v => { const c = v.clienteNome || 'Consumidor'; if(!rankingCli[c]) rankingCli[c] = 0; rankingCli[c] += v.tot; });
                let linhasCli = ''; Object.keys(rankingCli).map(k => ({nome: k, val: rankingCli[k]})).sort((a,b) => b.val - a.val).slice(0,5).forEach((c, i) => { linhasCli += `<div class="flex justify-between text-sm border-b pb-1"><span class="truncate pr-2">${i+1}. ${c.nome}</span><span class="font-bold text-blue-600">${formatMoney(c.val)}</span></div>`; });
                document.getElementById('bi-top-clientes').innerHTML = linhasCli;
            }
        }

        window.onload = () => { initData(); };




// NOVO: Funções auxiliares para Vínculo de XML
function alternarAcaoVinculoXML() {
    const acao = document.getElementById('prod-acao-vinculo').value;
    if(acao === 'VINCULAR') {
        document.getElementById('div-vinculo-busca').classList.remove('hidden');
    } else {
        document.getElementById('div-vinculo-busca').classList.add('hidden');
        document.getElementById('prod-id').value = '';
    }
}

function preencherVinculoXML() {
    const id = document.getElementById('prod-vinculo-select').value;
    if(id) {
        const prod = db.produtos.find(p => String(p.id) === String(id));
        if(prod) {
            document.getElementById('prod-id').value = prod.id;
            document.getElementById('prod-nome').value = prod.nome;
            document.getElementById('prod-ean').value = prod.ean || '';
            document.getElementById('prod-margem').value = (prod.margem || 50).toFixed(2);
            if(typeof calcularPrecoMargin === 'function') {
                calcularPrecoMargin('margem');
            }
        }
    }
}


function abrirModalXML() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = processarXMLReal;
    input.click();
}


function selecionarProdutoVinculoXML(id, nome) {
    document.getElementById('prod-vinculo-select').value = id;
    document.getElementById('prod-vinculo-search').value = nome;
    ocultarListaProdutosXMLBusca();
    preencherVinculoXML(); 
}

function filtrarProdutosXMLBusca() {
    const termo = document.getElementById('prod-vinculo-search').value.toLowerCase();
    const lista = document.getElementById('prod-vinculo-lista');
    lista.classList.remove('hidden');
    let html = '';
    const sorted = [...db.produtos].sort((a,b) => a.nome.localeCompare(b.nome));
    let count = 0;
    sorted.forEach(p => {
        if(p.nome.toLowerCase().includes(termo) || (p.ean && p.ean.includes(termo))) {
            count++;
            if(count <= 50) {
                html += '<li onclick="selecionarProdutoVinculoXML(\'' + p.id + '\', \'' + p.nome.replace(/'/g, "\\'") + '\')" class="p-2 border-b border-slate-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer"><div class="font-bold text-xs">' + p.nome + '</div><div class="text-[10px] text-slate-500">Estoque: ' + p.estoque + ' | EAN: ' + (p.ean || 'S/N') + '</div></li>';
            }
        }
    });
    if(count === 0) html = '<li class="p-2 text-xs text-slate-500">Nenhum produto encontrado.</li>';
    lista.innerHTML = html;
}

function mostrarListaProdutosXMLBusca() { filtrarProdutosXMLBusca(); }
function ocultarListaProdutosXMLBusca() { document.getElementById('prod-vinculo-lista').classList.add('hidden'); }

