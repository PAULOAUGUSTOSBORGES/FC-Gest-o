$jsFiles = Get-ChildItem -Path . -Filter *.js -File
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    if ($content.Contains('function processarXMLReal') -and -not $content.Contains('function abrirModalXML()')) {
        $helper = @"

function abrirModalXML() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = processarXMLReal;
    input.click();
}
"@
        $content = $content + $helper
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Added abrirModalXML to $($file.Name)"
    }
}
