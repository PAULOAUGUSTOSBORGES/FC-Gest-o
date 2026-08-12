import os

def patch_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The block we want to insert after is Top Fornecedores
    # In gestao.html, it's untouched. Let's find exactly the block.
    # The block is:
    # <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
    #    <h3 class="font-bold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4 flex justify-between items-center">
    #        <span><i class="fa-solid fa-truck"></i> Top Fornecedores (Gastos)</span>
    #        <button onclick="abrirInfoRelatorio('top_fornecedores')" ...></button>
    #    </h3>
    #    <div id="bi-top-fornecedores" class="space-y-3"></div>
    # </div>
    
    # We will inject the new panels right before <!-- Evolução de Custos por Produto (NOVO) -->
    
    if '<!-- Despesas por Categoria e Centro de Custo -->' not in content:
        new_panels = """
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
                            
                            <!-- Evolução de Custos por Produto (NOVO) -->"""
                            
        content = content.replace('<!-- Evolução de Custos por Produto (NOVO) -->', new_panels)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
patch_html(r'g:\VERSOES DO SISTEMA\site sistema\gestao.html')
