$ErrorActionPreference = "Stop"

$jsFixes = @(
    @{ File = 'produtos.js'; View = 'produtos' },
    @{ File = 'clientes.js'; View = 'clientes' },
    @{ File = 'fornecedores.js'; View = 'fornecedores' },
    @{ File = 'funcionarios.js'; View = 'funcionarios' },
    @{ File = 'estoque.js'; View = 'estoque' },
    @{ File = 'financeiro.js'; View = 'financeiro' },
    @{ File = 'relatorios.js'; View = 'relatorios' },
    @{ File = 'pdv.js'; View = 'pdv' },
    @{ File = 'orcamentos.js'; View = 'orcamentos' }
)

foreach ($item in $jsFixes) {
    if (Test-Path $item.File) {
        $content = Get-Content -Path $item.File -Raw -Encoding UTF8
        
        # Fix DOMContentLoaded view
        $content = $content -replace "const view = urlParams\.get\('view'\) \|\| '.*?';", "const view = urlParams.get('view') || '$($item.View)';"
        
        # Fix inicializarCadastro and inicializarOperacao calls to mudarVisaoLocal
        $content = $content -replace "(?s)(function inicializarCadastro\(\)\s*\{.*?mudarVisaoLocal\(').*?('\);\s*\})", "`$1$($item.View)`$2"
        $content = $content -replace "(?s)(function inicializarOperacao\(\)\s*\{.*?mudarVisaoLocal\(').*?('\);\s*\})", "`$1$($item.View)`$2"
        $content = $content -replace "(?s)(function inicializarOperacao\(\)\s*\{.*?mudarVisaoLocal\().*?(\);\s*\})", "`$1'$($item.View)'`$2"

        [IO.File]::WriteAllText("$PWD\$($item.File)", $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed JS: $($item.File)"
    }
}

$htmlFixes = @(
    @{ File = 'produtos.html'; Js = 'produtos.js' },
    @{ File = 'clientes.html'; Js = 'clientes.js' },
    @{ File = 'fornecedores.html'; Js = 'fornecedores.js' },
    @{ File = 'funcionarios.html'; Js = 'funcionarios.js' },
    @{ File = 'estoque.html'; Js = 'estoque.js' },
    @{ File = 'financeiro.html'; Js = 'financeiro.js' },
    @{ File = 'relatorios.html'; Js = 'relatorios.js' },
    @{ File = 'pdv.html'; Js = 'pdv.js' },
    @{ File = 'orcamentos.html'; Js = 'orcamentos.js' }
)

foreach ($item in $htmlFixes) {
    if (Test-Path $item.File) {
        $content = Get-Content -Path $item.File -Raw -Encoding UTF8
        
        # Replace the script tag for the main logic
        $content = $content -replace '<script src="cadastro(_v3)?\.js.*?"></script>', "<script src=""$($item.Js)""></script>"
        $content = $content -replace '<script src="gestao\.js.*?"></script>', "<script src=""$($item.Js)""></script>"
        $content = $content -replace '<script src="operacao\.js.*?"></script>', "<script src=""$($item.Js)""></script>"
        
        # Ensure only the target view is active initially
        $content = $content -replace 'class="([^"]*)view-section([^"]*)"', 'class="$1view-section hidden$2"'
        $content = $content -replace 'class="([^"]*)hidden hidden([^"]*)"', 'class="$1hidden$2"'
        $content = $content -replace "(id=""view-$($item.View)"".*?class=""[^""]*)hidden([^""]*"")", '$1active$2'
        
        [IO.File]::WriteAllText("$PWD\$($item.File)", $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed HTML: $($item.File)"
    }
}

Write-Host "Fixes applied."
