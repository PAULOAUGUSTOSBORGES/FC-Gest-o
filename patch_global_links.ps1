$file = "g:\VERSOES DO SISTEMA\site sistema\global.js"
$content = Get-Content $file -Raw -Encoding UTF8

$old = @"
    // Checa as regras do link de destino
    if (link.href.includes('cadastro.html') && link.href.includes('view=funcionarios')) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar Funcionários.';
    } else if (link.href.includes('cadastro.html') && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if (link.href.includes('gestao.html') && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado à Gestão Financeira.';
    } else if (link.href.includes('operacao.html') && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (link.href.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado às Configurações do Sistema.';
    } else if ((link.href.endsWith('index.html') || link.pathname === '/') && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (Visão Geral).';
    }
"@

$new = @"
    // Checa as regras do link de destino
    if (link.href.includes('funcionarios.html')) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado: Apenas o Administrador pode gerenciar Funcionários.';
    } else if ((link.href.includes('cadastro.html') || link.href.includes('produtos.html') || link.href.includes('clientes.html') || link.href.includes('fornecedores.html')) && !p.perm_cadastros) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado aos Cadastros.';
    } else if ((link.href.includes('gestao.html') || link.href.includes('vendas_gestao.html') || link.href.includes('financeiro.html') || link.href.includes('relatorios.html') || link.href.includes('compras.html')) && !p.perm_gestao) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado à Gestão Financeira.';
    } else if ((link.href.includes('operacao.html') || link.href.includes('pdv.html') || link.href.includes('vendas_operacao.html') || link.href.includes('orcamentos.html') || link.href.includes('caixa.html')) && !p.perm_pdv) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao PDV e Vendas.';
    } else if (link.href.includes('sistema.html') && !p.perm_config) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado às Configurações do Sistema.';
    } else if ((link.href.endsWith('index.html') || link.pathname === '/') && !p.perm_dashboard) {
        bloqueado = true;
        mensagemBloqueio = 'Acesso Negado ao Dashboard (Visão Geral).';
    }
"@

$content = $content.Replace($old.Replace("`r`n", "`n"), $new.Replace("`r`n", "`n"))
$content = $content.Replace($old.Replace("`n", "`r`n"), $new.Replace("`n", "`r`n"))

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
