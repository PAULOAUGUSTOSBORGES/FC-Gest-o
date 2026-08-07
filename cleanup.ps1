$c = Get-Content 'g:\site sistema\caixa.html' -Raw -Encoding UTF8
$c = $c -replace '<title>Financeiro - Sistema PDV</title>', '<title>Caixa Diário - Sistema PDV</title>'
$c = $c -replace 'Gestão de Contas', 'Gestão de Caixa'
$c = $c -replace '(?s)<div class="flex bg-white[^>]+>.*?</div>\s*</div>\s*<!-- SUB-ABA CAIXA -->', '</div><!-- SUB-ABA CAIXA -->'
$c = $c -replace '<div id="fin-area-caixa" class="fin-area hidden space-y-6">', '<div id="fin-area-caixa" class="fin-area space-y-6">'
$c = $c -replace '(?s)<!-- SUB-ABA CONTAS A RECEBER -->.*?<!-- SUB-ABA CONTAS A PAGAR -->', '<!-- SUB-ABA CONTAS A PAGAR -->'
$c = $c -replace '(?s)<!-- SUB-ABA CONTAS A PAGAR -->.*?<div id="modal-mov-caixa"', '<div id="modal-mov-caixa"'
$c = $c -replace '(?s)<div id="modal-nova-conta".*?<div id="modal-conferencia-xml"', '<div id="modal-conferencia-xml"'
$c = $c -replace '<script src="financeiro.js"></script>', '<script src="caixa.js"></script>'
[System.IO.File]::WriteAllText('g:\site sistema\caixa.html', $c, (New-Object System.Text.UTF8Encoding $false))

$f = Get-Content 'g:\site sistema\financeiro.html' -Raw -Encoding UTF8
$f = $f -replace '<button onclick="renderFinAbas\(''caixa''\)" id="fin-tab-caixa" class="px-4 py-1.5 rounded-md text-sm font-bold bg-blue-600 text-white transition-colors whitespace-nowrap">Caixa Diário</button>', ''
$f = $f -replace '(?s)<!-- SUB-ABA CAIXA -->.*?<!-- SUB-ABA CONTAS A RECEBER -->', '<!-- SUB-ABA CONTAS A RECEBER -->'
$f = $f -replace '<div id="fin-area-receber" class="fin-area hidden space-y-6">', '<div id="fin-area-receber" class="fin-area space-y-6">'
$f = $f -replace '(?s)<div id="modal-mov-caixa" class="fixed inset-0.*?<div id="modal-nova-conta"', '<div id="modal-nova-conta"'
[System.IO.File]::WriteAllText('g:\site sistema\financeiro.html', $f, (New-Object System.Text.UTF8Encoding $false))
