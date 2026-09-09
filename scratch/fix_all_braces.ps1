param()
# Corrige o problema de }} (duplo fechamento de chave) em TODOS os JS do sistema

$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"

# Lista todos os JS com possível problema
$arquivos = @(
    'pdv.js', 'compras.js', 'vendas_gestao.js', 'caixa.js',
    'relatorios_v2.js', 'financeiro.js', 'estoque.js', 'produtos.js',
    'clientes.js', 'operacao.js', 'orcamentos.js', 'vendas_operacao.js',
    'cadastro.js', 'cadastro_v3.js', 'funcionarios.js', 'fornecedores.js'
)

$totalFixed = 0
foreach ($arquivo in $arquivos) {
    $path = Join-Path $baseDir $arquivo
    if (-not (Test-Path $path)) { continue }
    
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Padrão 1: qualquer linha terminando com ;\n}} (duplo fechamento)
    $content = $content -replace ';\r\n\}\}(\r?\n)', ";`r`n}`$1"
    
    # Padrão 2: ;\n}} no final de arquivo
    $content = $content -replace ';\r\n\}\}$', ";`r`n}"
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "CORRIGIDO: $arquivo"
        $totalFixed++
    } else {
        Write-Host "OK: $arquivo"
    }
}

Write-Host ""
Write-Host "Total corrigidos: $totalFixed"
Write-Host "Concluido!"
