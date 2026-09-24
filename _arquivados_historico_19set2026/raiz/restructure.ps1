$ErrorActionPreference = "Stop"
$root = "g:\VERSOES DO SISTEMA\site sistema"
cd $root

# Create folders
New-Item -ItemType Directory -Force -Path "site" | Out-Null
New-Item -ItemType Directory -Force -Path "sistema" | Out-Null

# Define lists
$siteFiles = @("loja.html", "loja.js", "produto.html", "loja_produto.js", "carrinho.js")
$sharedFiles = @("global.js", "style.css", "firestore.rules")

# Move site files
foreach ($f in $siteFiles) {
    if (Test-Path $f) {
        Move-Item -Path $f -Destination "site\" -Force
    }
}

# Rename loja.html to index.html
if (Test-Path "site\loja.html") {
    Rename-Item -Path "site\loja.html" -NewName "index.html"
}

# Get all html and js files
$allFiles = Get-ChildItem -File | Where-Object { $_.Extension -in @(".html", ".js") -and $_.Name -notin $sharedFiles }

# Move remaining html and js to sistema
foreach ($f in $allFiles) {
    Move-Item -Path $f.FullName -Destination "sistema\" -Force
}

# Process HTML files in site and sistema to update global.js and style.css
$htmlFiles = Get-ChildItem -Path "site", "sistema" -Filter "*.html" -File

foreach ($f in $htmlFiles) {
    $content = Get-Content $f.FullName -Raw
    
    # Update style.css
    $content = $content -replace 'href="style.css"', 'href="../style.css"'
    
    # Update global.js
    $content = $content -replace 'src="global.js(.*?)"', 'src="../global.js$1"'
    
    # Update internal link loja.html -> index.html in the site
    if ($f.Directory.Name -eq "site") {
        $content = $content -replace 'href="loja.html"', 'href="index.html"'
    }
    
    Set-Content -Path $f.FullName -Value $content -Encoding UTF8
}

# Update internal link loja.html -> index.html in JS files in the site
$jsFiles = Get-ChildItem -Path "site" -Filter "*.js" -File
foreach ($f in $jsFiles) {
    $content = Get-Content $f.FullName -Raw
    $content = $content -replace 'href="loja.html"', 'href="index.html"'
    $content = $content -replace 'window\.location\.href\s*=\s*[''"]loja\.html[''"]', "window.location.href='index.html'"
    Set-Content -Path $f.FullName -Value $content -Encoding UTF8
}

Write-Output "Restructuring complete."
