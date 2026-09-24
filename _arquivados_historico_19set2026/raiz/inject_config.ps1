$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) { $root = (Get-Location).Path }

$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -Recurse

$arquivosAtualizados = 0

foreach ($file in $htmlFiles) {
    if ($file.FullName -match "\\\.") { continue }

    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $originalContent = $content

    # Inject config_banco.js before global.js
    if ($content -match 'src="\.\./global\.js') {
        # Check if config_banco is already injected
        if ($content -notmatch 'config_banco\.js') {
            $content = $content -replace '(<script src="\.\./global\.js)', '<script src="../sistema/config_banco.js"></script>`n    $1'
        }
    } elseif ($content -match 'src="global\.js') {
        if ($content -notmatch 'config_banco\.js') {
            $content = $content -replace '(<script src="global\.js)', '<script src="sistema/config_banco.js"></script>`n    $1'
        }
    }

    # Also for firebase-site.js (in root index.html or site pages if any)
    if ($content -match 'src="firebase-site\.js') {
        if ($content -notmatch 'config_banco\.js') {
            $content = $content -replace '(<script src="firebase-site\.js)', '<script src="../sistema/config_banco.js"></script>`n    $1'
        }
    }

    if ($content -cne $originalContent) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $arquivosAtualizados++
        Write-Host "Injetado em: $($file.Name)"
    }
}

Write-Host "Total injetado: $arquivosAtualizados"
