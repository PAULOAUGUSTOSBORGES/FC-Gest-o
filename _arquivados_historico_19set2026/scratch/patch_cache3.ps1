param()
# Patch caixa.js (tem renderCaixaDiario no onSnapshot do caixa)
# Patch relatorios_v2.js (tem debouncedRenderDashboard)
# Patch financeiro.js

$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"

function PatchFileByMarker($filePath, $startMarker, $endMarker, $novoBloco) {
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    
    $startIdx = $content.IndexOf($startMarker)
    if ($startIdx -lt 0) {
        Write-Host "ERRO: marcador inicio nao encontrado em $filePath"
        return
    }
    
    $endIdx = $content.IndexOf($endMarker, $startIdx)
    if ($endIdx -lt 0) {
        Write-Host "ERRO: marcador fim nao encontrado em $filePath"
        return
    }
    
    # Encontra o } que fecha a funcao
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

# ========== CAIXA.JS ==========
# No caixa.js, o listener de caixa chama renderCaixaDiario()
$caixaNovo = @"
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
    const totalColecoes = 6; // aguarda as 6 principais antes de renderizar
    function tentarRefresh() {
        colecoesProntas++;
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    }

    _listen('vendas', function(dados) {
        db.vendas = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
    });
    _listen('financeiro', function(dados) {
        db.financeiro = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
    });
    _listen('compras', function(dados) {
        db.compras = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
    });
    _listen('produtos', function(dados) {
        db.produtos = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
    });
    _listen('clientes', function(dados) {
        db.clientes = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
    });
    _listen('fornecedores', function(dados) {
        db.fornecedores = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
    });
    _listen('funcionarios', function(dados) {
        db.funcionarios = dados;
        // Nao conta no tentarRefresh (colecao adicional)
    });
    // Caixa: sempre ativo pois e critico (saldo em tempo real)
    _listenDoc('fc_moveis', 'caixa', function(data) {
        db.caixa = data || { status: 'FECHADO', saldo: 0, historico: [] };
        renderCaixaDiario(); // Renderiza caixa sempre que o saldo mudar
    });
}
"@

PatchFileByMarker (Join-Path $baseDir "caixa.js") "function inicializarGestao() {" "migrarDadosSeNecessario();" $caixaNovo

# ========== RELATORIOS_V2.JS ==========
# Tem debounce e debouncedRenderDashboard
$relatoriosNovo = @"
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

    // Debounce para evitar renderizacoes multiplas simultaneas
    let renderTimer = null;
    function debouncedRenderDashboard() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => { if (colecoesProntas >= totalColecoes) renderDashboard(); }, 150);
    }

    // Controla quantas colecoes ja carregaram o primeiro snapshot
    let colecoesProntas = 0;
    const totalColecoes = 6;
    function tentarRefresh() {
        colecoesProntas++;
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    }

    _listen('vendas', function(dados) {
        db.vendas = dados;
        tentarRefresh(); // CORRECAO: tentarRefresh ao inves de renderDashboard direto
        debouncedRenderDashboard();
    });
    _listen('financeiro', function(dados) {
        db.financeiro = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('compras', function(dados) {
        db.compras = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('produtos', function(dados) {
        db.produtos = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('clientes', function(dados) {
        db.clientes = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('fornecedores', function(dados) {
        db.fornecedores = dados;
        tentarRefresh(); // CORRECAO: adicionado tentarRefresh()
        debouncedRenderDashboard();
    });
    _listen('funcionarios', function(dados) {
        db.funcionarios = dados;
        // Nao conta no tentarRefresh (colecao adicional)
        debouncedRenderDashboard();
    });
    // Caixa: sempre ativo pois e critico (saldo em tempo real)
    _listenDoc('fc_moveis', 'caixa', function(data) {
        db.caixa = data || { status: 'FECHADO', saldo: 0, historico: [] };
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    });
}
"@

PatchFileByMarker (Join-Path $baseDir "relatorios_v2.js") "function inicializarGestao() {" "migrarDadosSeNecessario();" $relatoriosNovo

# ========== FINANCEIRO.JS ==========
# Usa o mesmo padrao gestao
$financeiroNovo = @"
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
    // Caixa: sempre ativo pois e critico (saldo em tempo real)
    _listenDoc('fc_moveis', 'caixa', function(data) {
        db.caixa = data || { status: 'FECHADO', saldo: 0, historico: [] };
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    });
}
"@

PatchFileByMarker (Join-Path $baseDir "financeiro.js") "function inicializarGestao() {" "migrarDadosSeNecessario();" $financeiroNovo

Write-Host "Concluido parte 3!"
