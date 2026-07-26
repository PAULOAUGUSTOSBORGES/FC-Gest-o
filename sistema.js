// sistema.js - Configurações

function renderConfig() {
    const area = document.getElementById('config-taxas-area');
    if(!db.config) db.config = { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1:4.99, 2:5.99, 3:6.99, 4:7.99, 5:8.99, 6:9.99, 7:10.99, 8:11.99, 9:12.99, 10:13.99, 11:14.99, 12:15.99 } } };
    
    let htmlInputs = `<div class="md:col-span-3 border-b border-slate-200 pb-2 mb-2"><h3 class="font-bold text-slate-700">Taxas Fixas (%)</h3></div>`;
    const fixas = ['Dinheiro', 'PIX', 'Cartão Débito', 'Boleto', 'Fiado'];
    
    fixas.forEach(metodo => {
        let mId = metodo.replace(/[^a-zA-Z\u00C0-\u017F]/g, '');
        htmlInputs += `<div><label class="text-xs font-bold text-slate-500 mb-1 block">Taxa: ${metodo}</label><input type="number" step="0.01" id="taxa-${mId}" value="${db.config.taxas[metodo]||0}" class="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500"></div>`;
    });
    
    htmlInputs += `<div class="md:col-span-3 mt-6 border-b border-slate-200 pb-2 mb-2"><h3 class="font-bold text-slate-700">Taxas Cartão de Crédito - Por Parcela (%)</h3></div>`;
    for(let i=1; i<=12; i++) {
        let val = db.config.taxas['Cartão Crédito'][i] || 0;
        htmlInputs += `<div><label class="text-xs font-bold text-slate-500 mb-1 block">Crédito em ${i}x</label><input type="number" step="0.01" id="taxa-cc-${i}" value="${val}" class="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500"></div>`;
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

window.onload = () => { initGlobalData(renderConfig); };
// sistema.js - Configurações

function renderConfig() {
    const area = document.getElementById('config-taxas-area');
    if(!db.config) db.config = { taxas: { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 1.99, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1:4.99, 2:5.99, 3:6.99, 4:7.99, 5:8.99, 6:9.99, 7:10.99, 8:11.99, 9:12.99, 10:13.99, 11:14.99, 12:15.99 } } };
    
    let htmlInputs = `
        <div class="md:col-span-3 border-b border-slate-200 pb-2 mb-2 mt-4">
            <h3 class="font-bold text-blue-600 flex items-center gap-2"><i class="fa-solid fa-robot"></i> Inteligência Artificial (Google Gemini)</h3>
        </div>
        <div class="md:col-span-3">
            <label class="text-xs font-bold text-slate-500 mb-1 block">Sua API Key do Gemini</label>
            <input type="password" id="gemini-api-key" placeholder="Cole sua chave gerada no Google AI Studio aqui..." value="${db.config.geminiKey || ''}" class="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-sm font-mono outline-none focus:border-blue-500">
        </div>
        <div class="md:col-span-3 border-b border-slate-200 pb-2 mb-2 mt-6">
            <h3 class="font-bold text-slate-700">Taxas Fixas (%)</h3>
        </div>
    `;
    
    const fixas = ['Dinheiro', 'PIX', 'Cartão Débito', 'Boleto', 'Fiado'];
    fixas.forEach(metodo => {
        let mId = metodo.replace(/[^a-zA-Z\u00C0-\u017F]/g, '');
        htmlInputs += `<div><label class="text-xs font-bold text-slate-500 mb-1 block">Taxa: ${metodo}</label><input type="number" step="0.01" id="taxa-${mId}" value="${db.config.taxas[metodo]||0}" class="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500"></div>`;
    });
    
    htmlInputs += `<div class="md:col-span-3 mt-6 border-b border-slate-200 pb-2 mb-2"><h3 class="font-bold text-slate-700">Taxas Cartão de Crédito - Por Parcela (%)</h3></div>`;
    for(let i=1; i<=12; i++) {
        let val = db.config.taxas['Cartão Crédito'][i] || 0;
        htmlInputs += `<div><label class="text-xs font-bold text-slate-500 mb-1 block">Crédito em ${i}x</label><input type="number" step="0.01" id="taxa-cc-${i}" value="${val}" class="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500"></div>`;
    }
    area.innerHTML = htmlInputs;
}

function salvarConfiguracoes() {
    // Salva a chave do Gemini
    db.config.geminiKey = document.getElementById('gemini-api-key').value.trim();

    const fixas = ['Dinheiro', 'PIX', 'Cartão Débito', 'Boleto', 'Fiado'];
    fixas.forEach(metodo => {
        let mId = metodo.replace(/[^a-zA-Z\u00C0-\u017F]/g, '');
        db.config.taxas[metodo] = parseFloat(document.getElementById(`taxa-${mId}`).value) || 0;
    });
    for(let i=1; i<=12; i++) {
        db.config.taxas['Cartão Crédito'][i] = parseFloat(document.getElementById(`taxa-cc-${i}`).value) || 0;
    }
    saveDB();
    showToast('Configurações salvas com sucesso!', 'success');
}

window.onload = () => { initGlobalData(renderConfig); };