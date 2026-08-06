# Fix HTML files
Get-ChildItem -Path "g:\site sistema" -Filter "*.html" | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $newContent = $content -replace [regex]::Escape('tailwind = tailwind || {};'), 'window.tailwind = window.tailwind || {};'
    if ($content -ne $newContent) {
        [System.IO.File]::WriteAllText($_.FullName, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "Updated HTML: $($_.Name)"
    }
}

# Fix JS files
$newFunc = 'function printHtmlSeguro(htmlCompleto) {
    showToast("Preparando documento para impressão...", "info");
    
    const printWin = window.open('''', '''', ''width=800,height=600'');
    if (!printWin) {
        showToast("Por favor, permita popups para imprimir.", "warning");
        return;
    }
    
    const doc = printWin.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impressão</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page { margin: 10mm; }
                body { font-family: Arial, sans-serif; background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .print\\\\:hidden { display: none !important; }
                table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
            </style>
        </head>
        <body class="bg-white dark:bg-slate-800 p-4">
            ${htmlCompleto}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => { 
        printWin.focus(); 
        printWin.print(); 
        printWin.close(); 
    }, 1500);
}'

$pattern = '(?s)function printHtmlSeguro\(htmlCompleto\)\s*\{.*?setTimeout\([^,]+,\s*\d+\);\s*\}'

Get-ChildItem -Path "g:\site sistema" -Filter "*.js" | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $newContent = [regex]::Replace($content, $pattern, $newFunc)
    if ($content -ne $newContent) {
        [System.IO.File]::WriteAllText($_.FullName, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "Updated JS: $($_.Name)"
    }
}
