$ErrorActionPreference = "Stop"

$r = [char]0xFFFD

$replacements = @(
    @("Hist$r`rico", "Histórico"),
    @("hist$r`rico", "histórico"),
    @("Servi$r`os", "Serviços"),
    @("servi$r`os", "serviços"),
    @("Servi$r`o", "Serviço"),
    @("servi$r`o", "serviço"),
    @("Lan$r`amentos", "Lançamentos"),
    @("lan$r`amentos", "lançamentos"),
    @("Lan$r`amento", "Lançamento"),
    @("lan$r`amento", "lançamento"),
    @("A$r$r`es", "Ações"),
    @("a$r$r`es", "ações"),
    @("A$r$r`o", "Ação"),
    @("a$r$r`o", "ação"),
    @("Vis$r`o", "Visão"),
    @("vis$r`o", "visão"),
    @("Gest$r`o", "Gestão"),
    @("gest$r`o", "gestão"),
    @("Configura$r$r`es", "Configurações"),
    @("configura$r$r`es", "configurações"),
    @("Configura$r$r`o", "Configuração"),
    @("configura$r$r`o", "configuração"),
    @("Or$r`amentos", "Orçamentos"),
    @("or$r`amentos", "orçamentos"),
    @("Or$r`amento", "Orçamento"),
    @("or$r`amento", "orçamento"),
    @("Opera$r$r`o", "Operação"),
    @("opera$r$r`o", "operação"),
    @("Relat$r`rios", "Relatórios"),
    @("relat$r`rios", "relatórios"),
    @("Relat$r`rio", "Relatório"),
    @("relat$r`rio", "relatório"),
    @("Informa$r$r`es", "Informações"),
    @("informa$r$r`es", "informações"),
    @("Informa$r$r`o", "Informação"),
    @("informa$r$r`o", "informação"),
    @("Sa$r`da", "Saída"),
    @("sa$r`da", "saída"),
    @("M$r`nimo", "Mínimo"),
    @("m$r`nimo", "mínimo"),
    @("M$r`ximo", "Máximo"),
    @("m$r`ximo", "máximo"),
    @("R$r`pido", "Rápido"),
    @("r$r`pido", "rápido"),
    @("M$r`dulo", "Módulo"),
    @("m$r`dulo", "módulo"),
    @("Autom$r`tico", "Automático"),
    @("autom$r`tico", "automático"),
    @("Voc$r", "Você"),
    @("voc$r", "você"),
    @("Jur$r`dica", "Jurídica"),
    @("jur$r`dica", "jurídica"),
    @("F$r`sica", "Física"),
    @("f$r`sica", "física"),
    @("N$r`mero", "Número"),
    @("n$r`mero", "número"),
    @("Endere$r`o", "Endereço"),
    @("endere$r`o", "endereço"),
    @("Usu$r`rio", "Usuário"),
    @("usu$r`rio", "usuário"),
    @("P$r`s-venda", "Pós-venda"),
    @("p$r`s-venda", "pós-venda"),
    @("Pr$r`-venda", "Pré-venda"),
    @("pr$r`-venda", "pré-venda"),
    @("Condi$r$r`o", "Condição"),
    @("condi$r$r`o", "condição"),
    @("Condi$r$r`es", "Condições"),
    @("condi$r$r`es", "condições"),
    @("Atrav$r`s", "Através"),
    @("atrav$r`s", "através"),
    @("Descri$r$r`o", "Descrição"),
    @("descri$r$r`o", "descrição"),
    @("Pre$r`o", "Preço"),
    @("pre$r`o", "preço"),
    @("Cart$r`o", "Cartão"),
    @("cart$r`o", "cartão"),
    @("D$r`bito", "Débito"),
    @("d$r`bito", "débito"),
    @("Cr$r`dito", "Crédito"),
    @("cr$r`dito", "crédito"),
    @("Observa$r$r`o", "Observação"),
    @("observa$r$r`o", "observação"),
    @("Observa$r$r`es", "Observações"),
    @("observa$r$r`es", "observações"),
    @("P$r`gina", "Página"),
    @("p$r`gina", "página"),
    @("Conclu$r`do", "Concluído"),
    @("conclu$r`do", "concluído"),
    @("M$r`s", "Mês"),
    @("m$r`s", "mês"),
    @("Tr$r`s", "Três"),
    @("tr$r`s", "três"),
    @("C$r`digo", "Código"),
    @("c$r`digo", "código"),
    @(" N$r ", " Nº "),
    @(" j$r ", " já "),
    @(" s$r ", " só "),
    @(" N$r`o ", " Não "),
    @(" n$r`o ", " não "),
    @(">N$r`o<", ">Não<"),
    @(">n$r`o<", ">não<"),
    @(" At$r ", " Até "),
    @(" at$r ", " até "),
    @(" Ol$r ", " Olá "),
    @(" H$r ", " Há "),
    @(" h$r ", " há "),
    @(" padr$r`o ", " padrão "),
    @(" Padr$r`o ", " Padrão "),
    @(" padr$r$r`es ", " padrões "),
    @(" Padr$r$r`es ", " Padrões "),
    @(" exclu$r`do ", " excluído "),
    @(" Exclu$r`do ", " Excluído "),
    @(" Exclus$r`o ", " Exclusão "),
    @(" exclus$r`o ", " exclusão "),
    @(" op$r$r`es ", " opções "),
    @(" Op$r$r`es ", " Opções "),
    @(" op$r$r`o ", " opção "),
    @(" Op$r$r`o ", " Opção "),
    @(" v$r`lido ", " válido "),
    @(" V$r`lido ", " Válido "),
    @(" inv$r`lido ", " inválido "),
    @(" Inv$r`lido ", " Inválido "),
    @(" c$r`lculo ", " cálculo "),
    @(" C$r`lculo ", " Cálculo "),
    @(" C$r`d ", " Cód "),
    @(" c$r`d ", " cód "),
    @(" d$r`gitos ", " dígitos "),
    @(" D$r`gitos ", " Dígitos "),
    @(">A$r$r`es<", ">Ações<"),
    @(">Hist$r`rico", ">Histórico"),
    @("Funcion$r`rios", "Funcionários"),
    @("funcion$r`rios", "funcionários"),
    @("Funcion$r`rio", "Funcionário"),
    @("funcion$r`rio", "funcionário"),
    @("Devolu$r$r`o", "Devolução"),
    @("devolu$r$r`o", "devolução"),
    @("B$r`sico", "Básico"),
    @("b$r`sico", "básico"),
    @("Pr$r`ximo", "Próximo"),
    @("pr$r`ximo", "próximo"),
    @("$r`ltimo", "Último"),
    @("$r`ltima", "Última"),
    @("$r`ltimos", "Últimos"),
    @("$r`ltimas", "Últimas")
)

$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content
        
        foreach ($pair in $replacements) {
            $content = $content.Replace($pair[0], $pair[1])
        }

        # Handle remaining "é" safely where surrounded by spaces
        # But wait, did U+FFFD replace 'é' in " é "?
        # Yes, any 'é' was corrupted to U+FFFD if it was in the original ANSI file.
        $content = $content.Replace(" $r ", " é ")
        $content = $content.Replace(">$r<", ">é<")
        $content = $content.Replace(" $r", " é")

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Restored accents in $($file.Name)"
        }
    } catch {
        Write-Warning "Failed $($file.FullName): $_"
    }
}
