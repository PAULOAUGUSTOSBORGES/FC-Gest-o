$ErrorActionPreference = "Stop"

$op = Get-Content "operacao.html" -Raw -Encoding UTF8

$match = [regex]::Match($op, 'id="modal-')
if ($match.Success) {
    # Let's find the parent div of the first modal. Usually modals are at the root level inside the body.
    # To be safe, we'll just search for the first "<!--" before the modal.
    $pos = $match.Index
    # Search backwards for "<!--" within 200 chars
    $searchStr = $op.Substring([Math]::Max(0, $pos - 200), [Math]::Min(200, $pos))
    $lastComment = $searchStr.LastIndexOf("<!--")
    if ($lastComment -ne -1) {
        $pos = [Math]::Max(0, $pos - 200) + $lastComment
    } else {
        # find the <div before it
        $lastDiv = $searchStr.LastIndexOf("<div")
        if ($lastDiv -ne -1) {
            $pos = [Math]::Max(0, $pos - 200) + $lastDiv
        }
    }
    
    $modalsHtml = $op.Substring($pos)
    
    $vendas = Get-Content "vendas_operacao.html" -Raw -Encoding UTF8
    
    if ($vendas.IndexOf("id=`"modal-") -eq -1) {
        $vendas = $vendas -replace "(?s)</body>\s*</html>\s*", ""
        $newVendas = $vendas + "`n</div>`n" + $modalsHtml + "`n</body>`n</html>"
        [IO.File]::WriteAllText("$PWD\vendas_operacao.html", $newVendas, [System.Text.Encoding]::UTF8)
        Write-Host "Appended modals to vendas_operacao.html using regex!"
    } else {
        Write-Host "Modals already exist!"
    }
} else {
    Write-Host "No modals found using regex!"
}
