param()
# Script para aplicar cache em produtos.js e clientes.js

$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"

# Bloco novo para produtos.js (termina com 'produtos')
$novoBlocoProdutos = "function inicializarCadastro() {`r`n    // Liga os listeners do Firestore com cache inteligente (FCCache)`r`n    // Se houver dados em cache, a tela carrega instantaneamente antes do Firebase responder.`r`n    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb, opts) {`r`n        let ref = firestore.collection(col);`r`n        if (opts && typeof opts.query === 'function') ref = opts.query(ref);`r`n        return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));`r`n    };`r`n`r`n    unsubProdutos = _listen('produtos', function(dados) {`r`n        db.produtos = dados;`r`n        const v = document.getElementById('view-produtos');`r`n        if (v && v.classList.contains('active')) renderProdutos();`r`n    });`r`n`r`n    unsubClientes = _listen('clientes', function(dados) {`r`n        db.clientes = dados;`r`n        const v = document.getElementById('view-clientes');`r`n        if (v && v.classList.contains('active')) renderClientes();`r`n    });`r`n`r`n    unsubFornecedores = _listen('fornecedores', function(dados) {`r`n        db.fornecedores = dados;`r`n        const v = document.getElementById('view-fornecedores');`r`n        if (v && v.classList.contains('active')) renderFornecedores();`r`n    });`r`n`r`n    _listen('funcionarios', function(dados) {`r`n        db.funcionarios = dados;`r`n        if (typeof renderFuncionarios === 'function') renderFuncionarios();`r`n    });`r`n`r`n    unsubKardex = _listen('movimentacoes', function(dados) {`r`n        db.movimentacoes = dados;`r`n        const v = document.getElementById('view-estoque');`r`n        if (v && v.classList.contains('active')) renderKardex();`r`n    }, { query: function(ref) { return ref.orderBy('data', 'desc').limit(50); } });`r`n`r`n    // Carrega vendas para exibir historico de compras do cliente`r`n    _listen('vendas', function(dados) {`r`n        db.vendas = dados;`r`n    });`r`n`r`n    // Carrega categorias para o cadastro de produtos`r`n    _listen('categorias', function(dados) {`r`n        db.categorias = dados;`r`n        if (typeof renderSelectCategorias === 'function') renderSelectCategorias();`r`n    }, { query: function(ref) { return ref.orderBy('nome'); } });`r`n`r`n    const urlParams = new URLSearchParams(window.location.search);`r`n    const view = urlParams.get('view');`r`n    mudarVisaoLocal(view || 'produtos');`r`n}"

# Bloco novo para clientes.js (termina com 'clientes')
$novoBlocoClientes = "function inicializarCadastro() {`r`n    // Liga os listeners do Firestore com cache inteligente (FCCache)`r`n    // Se houver dados em cache, a tela carrega instantaneamente antes do Firebase responder.`r`n    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb, opts) {`r`n        let ref = firestore.collection(col);`r`n        if (opts && typeof opts.query === 'function') ref = opts.query(ref);`r`n        return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));`r`n    };`r`n`r`n    unsubProdutos = _listen('produtos', function(dados) {`r`n        db.produtos = dados;`r`n        const v = document.getElementById('view-produtos');`r`n        if (v && v.classList.contains('active')) renderProdutos();`r`n    });`r`n`r`n    unsubClientes = _listen('clientes', function(dados) {`r`n        db.clientes = dados;`r`n        const v = document.getElementById('view-clientes');`r`n        if (v && v.classList.contains('active')) renderClientes();`r`n    });`r`n`r`n    unsubFornecedores = _listen('fornecedores', function(dados) {`r`n        db.fornecedores = dados;`r`n        const v = document.getElementById('view-fornecedores');`r`n        if (v && v.classList.contains('active')) renderFornecedores();`r`n    });`r`n`r`n    _listen('funcionarios', function(dados) {`r`n        db.funcionarios = dados;`r`n        if (typeof renderFuncionarios === 'function') renderFuncionarios();`r`n    });`r`n`r`n    unsubKardex = _listen('movimentacoes', function(dados) {`r`n        db.movimentacoes = dados;`r`n        const v = document.getElementById('view-estoque');`r`n        if (v && v.classList.contains('active')) renderKardex();`r`n    }, { query: function(ref) { return ref.orderBy('data', 'desc').limit(50); } });`r`n`r`n    // Carrega vendas para exibir historico de compras do cliente`r`n    _listen('vendas', function(dados) {`r`n        db.vendas = dados;`r`n    });`r`n`r`n    // Carrega categorias para o cadastro de produtos`r`n    _listen('categorias', function(dados) {`r`n        db.categorias = dados;`r`n        if (typeof renderSelectCategorias === 'function') renderSelectCategorias();`r`n    }, { query: function(ref) { return ref.orderBy('nome'); } });`r`n`r`n    const urlParams = new URLSearchParams(window.location.search);`r`n    const view = urlParams.get('view');`r`n    mudarVisaoLocal(view || 'clientes');`r`n}"

function PatchFile($filePath, $novoBloco, $marcador) {
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    
    # Encontra o inicio da funcao
    $startMarker = "function inicializarCadastro() {"
    $startIdx = $content.IndexOf($startMarker)
    
    if ($startIdx -lt 0) {
        Write-Host "ERRO: funcao nao encontrada em $filePath"
        return
    }
    
    # Encontra o fim da funcao procurando o 'mudarVisaoLocal' e o fechar chave apos
    $endMarker = "mudarVisaoLocal(view || '$marcador');"
    $endIdx = $content.IndexOf($endMarker, $startIdx)
    
    if ($endIdx -lt 0) {
        Write-Host "ERRO: marcador de fim nao encontrado em $filePath - marcador: $endMarker"
        return
    }
    
    # Avancar ate o '}'
    $closeBraceIdx = $content.IndexOf("}", $endIdx)
    if ($closeBraceIdx -lt 0) {
        Write-Host "ERRO: fechamento de chave nao encontrado em $filePath"
        return
    }
    
    # Substitui o bloco inteiro
    $before = $content.Substring(0, $startIdx)
    $after = $content.Substring($closeBraceIdx + 1)
    $newContent = $before + $novoBloco + $after
    
    [System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "OK: $filePath atualizado com sucesso"
}

PatchFile (Join-Path $baseDir "produtos.js") $novoBlocoProdutos "produtos"
PatchFile (Join-Path $baseDir "clientes.js") $novoBlocoClientes "clientes"

Write-Host "Concluido!"
