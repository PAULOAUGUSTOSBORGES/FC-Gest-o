param()
# Patch pdv.js, caixa.js, compras.js, relatorios_v2.js, vendas_gestao.js, financeiro.js
# Substitui onSnapshot por fcListenCollection nos inicializarGestao/inicializarOperacao

$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"

function PatchFileByMarker($filePath, $startMarker, $endMarker, $novoBloco) {
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    
    $startIdx = $content.IndexOf($startMarker)
    if ($startIdx -lt 0) {
        Write-Host "ERRO: marcador inicio nao encontrado em $filePath"
        Write-Host "Buscando: $($startMarker.Substring(0, [Math]::Min(80, $startMarker.Length)))"
        return
    }
    
    $endIdx = $content.IndexOf($endMarker, $startIdx)
    if ($endIdx -lt 0) {
        Write-Host "ERRO: marcador fim nao encontrado em $filePath"
        Write-Host "Buscando: $($endMarker.Substring(0, [Math]::Min(80, $endMarker.Length)))"
        return
    }
    
    # Avança além do endMarker até o próximo }
    $closeBraceIdx = $content.IndexOf("`n}", $endIdx)
    if ($closeBraceIdx -lt 0) {
        $closeBraceIdx = $content.IndexOf("}", $endIdx)
    }
    
    if ($closeBraceIdx -lt 0) {
        Write-Host "ERRO: fechar chave nao encontrado em $filePath"
        return
    }
    
    $before = $content.Substring(0, $startIdx)
    $after = $content.Substring($closeBraceIdx + 1)
    $newContent = $before + $novoBloco + $after
    
    [System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "OK: $filePath"
}

# ========== PDV.JS ==========
$pdvNovo = @"
function inicializarOperacao() {
    aplicarIdentidadeVisualNoMenu(); 
    
    // Cache inteligente: serve dados instantaneamente do sessionStorage
    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb, opts) {
        let ref = firestore.collection(col);
        if (opts && typeof opts.query === 'function') ref = opts.query(ref);
        return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    const _listenDoc = (typeof window.fcListenDoc === 'function') ? window.fcListenDoc : function(col, id, cb) {
        return firestore.collection(col).doc(id).onSnapshot(doc => cb(doc.exists ? doc.data() : null));
    };

    _listen('produtos', function(dados) {
        db.produtos = dados;
    });
    _listen('clientes', function(dados) {
        db.clientes = dados;
        atualizarListaClientesPDV();
    });
    _listen('vendas', function(dados) {
        db.vendas = dados;
        const v = document.getElementById('view-vendas');
        const o = document.getElementById('view-orcamentos');
        if(v && v.classList.contains('active')) renderVendas();
        if(o && o.classList.contains('active')) renderOrcamentos();
        
        // Auto-edicao vinda de outras paginas
        const editId = sessionStorage.getItem('autoEditVendaId');
        if(editId) {
            sessionStorage.removeItem('autoEditVendaId');
            executarEstornoEEdicao(editId);
        }
    });
    // Caixa: sempre ativo pois é crítico (saldo em tempo real)
    _listenDoc('fc_moveis', 'caixa', function(data) {
        db.caixa = data || { status: 'FECHADO', saldo: 0, historico: [] };
        const badgeCaixa = document.getElementById('pdv-status-caixa');
        if (badgeCaixa) prepararPDV();
    });
    _listen('financeiro', function(dados) {
        db.financeiro = dados;
    });
    _listen('funcionarios', function(dados) {
        db.funcionarios = dados;
        atualizarVendedoresPDV();
    });

    const urlParams = new URLSearchParams(window.location.search);
    mudarVisaoLocal('pdv');
}
"@

PatchFileByMarker (Join-Path $baseDir "pdv.js") "function inicializarOperacao() {" "mudarVisaoLocal('pdv');" $pdvNovo

# ========== BLOCO GESTAO PADRAO (caixa.js, compras.js, relatorios_v2.js, vendas_gestao.js, financeiro.js) ==========
# Todos têm o mesmo padrão de onSnapshot com 6 coleções + caixa
# A diferença está no refreshCurrentView() ou renderXxx() chamado no final

$gestaoNovo = @"
function inicializarGestao() {
    // Primeiro tenta migrar dados do banco antigo se necessario
    migrarDadosSeNecessario();

    // Cache inteligente: serve dados instantaneamente do sessionStorage
    const _listen = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb, opts) {
        let ref = firestore.collection(col);
        if (opts && typeof opts.query === 'function') ref = opts.query(ref);
        return ref.onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    const _listenDoc = (typeof window.fcListenDoc === 'function') ? window.fcListenDoc : function(col, id, cb) {
        return firestore.collection(col).doc(id).onSnapshot(doc => cb(doc.exists ? doc.data() : null));
    };

    // Controla quantas colecoes ja carregaram o primeiro snapshot
    let colecoesProntas = 0;
    const totalColecoes = 6;
    function tentarRefresh() {
        colecoesProntas++;
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    }

    _listen('vendas', function(dados) {
        db.vendas = dados;
        tentarRefresh();
    });
    _listen('financeiro', function(dados) {
        db.financeiro = dados;
        tentarRefresh();
    });
    _listen('compras', function(dados) {
        db.compras = dados;
        tentarRefresh();
    });
    _listen('produtos', function(dados) {
        db.produtos = dados;
        tentarRefresh();
    });
    _listen('clientes', function(dados) {
        db.clientes = dados;
        tentarRefresh();
    });
    _listen('fornecedores', function(dados) {
        db.fornecedores = dados;
        tentarRefresh();
    });
    _listen('funcionarios', function(dados) {
        db.funcionarios = dados;
        // Nao conta no tentarRefresh (colecao adicional)
    });
    // Caixa: sempre ativo pois é crítico (saldo em tempo real)
    _listenDoc('fc_moveis', 'caixa', function(data) {
        db.caixa = data || { status: 'FECHADO', saldo: 0, historico: [] };
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    });
}
"@

# compras.js
PatchFileByMarker (Join-Path $baseDir "compras.js") "function inicializarGestao() {" "migrarDadosSeNecessario();" $gestaoNovo

# vendas_gestao.js
PatchFileByMarker (Join-Path $baseDir "vendas_gestao.js") "function inicializarGestao() {" "migrarDadosSeNecessario();" $gestaoNovo

# financeiro.js - pode ter padrão diferente, verificar
# Primeiro vamos ver como é o inicio da funcao em financeiro.js
$finContent = [System.IO.File]::ReadAllText((Join-Path $baseDir "financeiro.js"), [System.Text.Encoding]::UTF8)
$finIdx = $finContent.IndexOf("function inicializarGestao() {")
if ($finIdx -ge 0) {
    $sample = $finContent.Substring($finIdx, [Math]::Min(300, $finContent.Length - $finIdx))
    Write-Host "financeiro.js inicializarGestao inicio:"
    Write-Host $sample
} else {
    Write-Host "financeiro.js: inicializarGestao NAO encontrado!"
}

Write-Host "Concluido parte 2!"
