$ErrorActionPreference = "Stop"

$utf8 = [System.Text.Encoding]::UTF8
$ansi = [System.Text.Encoding]::GetEncoding(1252)

function Get-Mangled($text) {
    $bytes = $utf8.GetBytes($text)
    return $ansi.GetString($bytes)
}

$replacements = @(
    @("Histrico", "Histórico"),
    @("histrico", "histórico"),
    @("Servios", "Serviços"),
    @("servios", "serviços"),
    @("Servio", "Serviço"),
    @("servio", "serviço"),
    @("Lanamentos", "Lançamentos"),
    @("lanamentos", "lançamentos"),
    @("Lanamento", "Lançamento"),
    @("lanamento", "lançamento"),
    @("Aes", "Ações"),
    @("aes", "ações"),
    @("Ao", "Ação"),
    @("ao", "ação"),
    @("Viso", "Visão"),
    @("viso", "visão"),
    @("Gesto", "Gestão"),
    @("gesto", "gestão"),
    @("Configuraes", "Configurações"),
    @("configuraes", "configurações"),
    @("Configurao", "Configuração"),
    @("configurao", "configuração"),
    @("Oramentos", "Orçamentos"),
    @("oramentos", "orçamentos"),
    @("Oramento", "Orçamento"),
    @("oramento", "orçamento"),
    @("Operao", "Operação"),
    @("operao", "operação"),
    @("Relatrios", "Relatórios"),
    @("relatrios", "relatórios"),
    @("Relatrio", "Relatório"),
    @("relatrio", "relatório"),
    @("Informaes", "Informações"),
    @("informaes", "informações"),
    @("Informao", "Informação"),
    @("informao", "informação"),
    @("Sada", "Saída"),
    @("sada", "saída"),
    @("Mnimo", "Mínimo"),
    @("mnimo", "mínimo"),
    @("Mximo", "Máximo"),
    @("mximo", "máximo"),
    @("Rpido", "Rápido"),
    @("rpido", "rápido"),
    @("Mdulo", "Módulo"),
    @("mdulo", "módulo"),
    @("Automtico", "Automático"),
    @("automtico", "automático"),
    @("Voc", "Você"),
    @("voc", "você"),
    @("Jurdica", "Jurídica"),
    @("jurdica", "jurídica"),
    @("Fsica", "Física"),
    @("fsica", "física"),
    @("Nmero", "Número"),
    @("nmero", "número"),
    @("Endereo", "Endereço"),
    @("endereo", "endereço"),
    @("Usurio", "Usuário"),
    @("usurio", "usuário"),
    @("Ps-venda", "Pós-venda"),
    @("ps-venda", "pós-venda"),
    @("Pr-venda", "Pré-venda"),
    @("pr-venda", "pré-venda"),
    @("Condio", "Condição"),
    @("condio", "condição"),
    @("Condies", "Condições"),
    @("condies", "condições"),
    @("Atravs", "Através"),
    @("atravs", "através"),
    @("Descrio", "Descrição"),
    @("descrio", "descrição"),
    @("Preo", "Preço"),
    @("preo", "preço"),
    @("Carto", "Cartão"),
    @("carto", "cartão"),
    @("Dbito", "Débito"),
    @("dbito", "débito"),
    @("Crdito", "Crédito"),
    @("crdito", "crédito"),
    @("Observao", "Observação"),
    @("observao", "observação"),
    @("Observaes", "Observações"),
    @("observaes", "observações"),
    @("Pgina", "Página"),
    @("pgina", "página"),
    @("Concludo", "Concluído"),
    @("concludo", "concluído"),
    @("Ms", "Mês"),
    @("ms", "mês"),
    @("Trs", "Três"),
    @("trs", "três"),
    @("Cdigo", "Código"),
    @("cdigo", "código"),
    @(" N ", " Nº "),
    @(" j ", " já "),
    @(" s ", " só "),
    @(" No ", " Não "),
    @(" no ", " não "),
    @(" At ", " Até "),
    @(" at ", " até "),
    @(" Ol ", " Olá "),
    @(" H ", " Há "),
    @(" padro ", " padrão "),
    @(" Padro ", " Padrão "),
    @(" padres ", " padrões "),
    @(" Padres ", " Padrões "),
    @(" excludo ", " excluído "),
    @(" Excludo ", " Excluído "),
    @(" Excluso ", " Exclusão "),
    @(" excluso ", " exclusão "),
    @(" opes ", " opções "),
    @(" Opes ", " Opções "),
    @(" opo ", " opção "),
    @(" Opo ", " Opção "),
    @(" vlido ", " válido "),
    @(" Vlido ", " Válido "),
    @(" invlido ", " inválido "),
    @(" Invlido ", " Inválido "),
    @(" clculo ", " cálculo "),
    @(" Clculo ", " Cálculo "),
    @(">No<", ">Não<"),
    @(">no<", ">não<"),
    @(" Cd ", " Cód "),
    @(" cd ", " cód "),
    @(" dgitos ", " dígitos "),
    @(" Dgitos ", " Dígitos "),
    @(" no ", " não "),
    @(" No ", " Não "),
    @(">Aes<", ">Ações<"),
    @(">Histrico", ">Histórico"),
    @("Funcionrios", "Funcionários"),
    @("funcionrios", "funcionários"),
    @("Funcionrio", "Funcionário"),
    @("funcionrio", "funcionário"),
    @("Devoluo", "Devolução"),
    @("devoluo", "devolução"),
    @("Bsico", "Básico"),
    @("bsico", "básico"),
    @("Prximo", "Próximo"),
    @("prximo", "próximo"),
    @("ltimo", "Último"),
    @("ltima", "Última"),
    @("ltimos", "Últimos"),
    @("ltimas", "Últimas"),
    @("C-", "C/"), 
    @("cpf/cnpj", "cpf/cnpj")
)

$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

$badSpaceCharStr = [string]([char]0x00C3) + [string]([char]0x00A9)

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content
        
        # 1. Reverse the spaces perfectly
        $content = $content.Replace($badSpaceCharStr, "")

        # 2. Reverse prefixes
        $s1 = Get-Mangled "cód"
        $content = $content.Replace($s1, "cd")
        $s2 = Get-Mangled "Cód"
        $content = $content.Replace($s2, "Cd")
        
        # 3. Reverse generic words backward
        $a1 = Get-Mangled " você."
        $content = $content.Replace($a1, " voc.")
        $a2 = Get-Mangled " você,"
        $content = $content.Replace($a2, " voc,")
        $a3 = Get-Mangled " Você "
        $content = $content.Replace($a3, " Voc ")
        $a4 = Get-Mangled " você "
        $content = $content.Replace($a4, " voc ")
        $a5 = Get-Mangled " Até "
        $content = $content.Replace($a5, " At ")
        $a6 = Get-Mangled " até "
        $content = $content.Replace($a6, " at ")
        $a7 = Get-Mangled " Há "
        $content = $content.Replace($a7, " H ")
        $a8 = Get-Mangled " há "
        $content = $content.Replace($a8, " h ")
        $a9 = Get-Mangled " já "
        $content = $content.Replace($a9, " j ")
        $a10 = Get-Mangled " Já "
        $content = $content.Replace($a10, " J ")
        $a11 = Get-Mangled " só "
        $content = $content.Replace($a11, " s ")
        $a12 = Get-Mangled " Só "
        $content = $content.Replace($a12, " S ")
        $a13 = Get-Mangled "não "
        $content = $content.Replace($a13, "no ")
        $a14 = Get-Mangled "Não "
        $content = $content.Replace($a14, "No ")
        $a15 = Get-Mangled " não"
        $content = $content.Replace($a15, " no")
        $a16 = Get-Mangled " Não"
        $content = $content.Replace($a16, " No")

        # 4. Undo main replacements backward
        for ($i = $replacements.Count - 1; $i -ge 0; $i--) {
            $pair = $replacements[$i]
            $bad = Get-Mangled $pair[1]
            $content = $content.Replace($bad, $pair[0])
        }

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed encoding in $($file.Name)"
        }
    } catch {
        Write-Warning "Failed $($file.FullName): $_"
    }
}
