import re, os, glob

# For HTML files
html_files = glob.glob(r"g:\site sistema\*.html")
for f in html_files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        new_content = content.replace("tailwind = tailwind || {};", "window.tailwind = window.tailwind || {};")
        
        if new_content != content:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"Updated HTML: {f}")
    except Exception as e:
        print(f"Error on {f}: {e}")

# For JS files
js_files = glob.glob(r"g:\site sistema\*.js")
# We want to match from "function printHtmlSeguro(htmlCompleto) {" up to the closing brace after setTimeout
print_func_pattern = re.compile(
    r'function printHtmlSeguro\(htmlCompleto\)\s*\{.*?setTimeout\([^,]+,\s*1500\);\s*\}',
    re.DOTALL
)

new_func = """function printHtmlSeguro(htmlCompleto) {
    showToast("Preparando documento para impressão...", "info");
    
    const printWin = window.open('', '', 'width=800,height=600');
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
}"""

for f in js_files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        new_content, count = print_func_pattern.subn(new_func, content)
        
        if count > 0:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"Updated JS: {f} (Replaced printHtmlSeguro)")
    except Exception as e:
        print(f"Error on {f}: {e}")
