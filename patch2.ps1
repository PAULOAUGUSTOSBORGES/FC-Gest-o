$gestao = [System.IO.File]::ReadAllText('G:\VERSOES DO SISTEMA\site sistema\gestao.html', [System.Text.Encoding]::UTF8)
$start = $gestao.IndexOf('<div id="modal-detalhes-nf"')
$end = $gestao.IndexOf('</div>
    
    <!-- MODAL DETALHES DE VENDA/ORÇAMENTO -->', $start)

if ($start -gt 0 -and $end -gt 0) {
    $modal = $gestao.Substring($start, $end - $start)
    
    $compras = [System.IO.File]::ReadAllText('G:\VERSOES DO SISTEMA\site sistema\compras.html', [System.Text.Encoding]::UTF8)
    if ($compras -notmatch 'id="modal-detalhes-nf"') {
        $insertPoint = $compras.IndexOf('<!-- SCRIPTS -->')
        if ($insertPoint -gt 0) {
            $compras = $compras.Insert($insertPoint, $modal + "`n`n    ")
            [System.IO.File]::WriteAllText('G:\VERSOES DO SISTEMA\site sistema\compras.html', $compras, [System.Text.Encoding]::UTF8)
        }
    }
}
