const fs = require('fs');

function patchHtml(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    const newPanels = `
                            <!-- Despesas por Categoria e Centro de Custo -->
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-tags text-slate-400 mr-2"></i> Despesas por Categoria</span>
                                </h3>
                                <div id="bi-despesas-categoria" class="space-y-3"></div>
                            </div>
                            <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
                                    <span><i class="fa-solid fa-building text-slate-400 mr-2"></i> Despesas por Centro de Custo</span>
                                </h3>
                                <div id="bi-despesas-centro-custo" class="space-y-3"></div>
                            </div>
                            
                            <!-- Evolução de Custos por Produto (NOVO) -->`;

    if (!content.includes('Despesas por Categoria e Centro de Custo')) {
        content = content.replace('<!-- Evolução de Custos por Produto (NOVO) -->', newPanels);
        fs.writeFileSync(filepath, content, 'utf8');
        console.log('Patched ' + filepath);
    }
}

patchHtml('g:/VERSOES DO SISTEMA/site sistema/gestao.html');
