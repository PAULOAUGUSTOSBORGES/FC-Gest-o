# Script para gerar os ícones do PWA com alta qualidade a partir do ícone oficial
Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

$iconeOficial = Join-Path $iconsDir "icone_oficial.png"

function Scale-Icon {
    param(
        [string]$sourcePath,
        [int]$size,
        [string]$outputPath,
        [bool]$maskable = $false
    )

    if (Test-Path $sourcePath) {
        $src = [System.Drawing.Bitmap]::FromFile($sourcePath)
        $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42)) # Slate-900 (#0f172a)
        $g.FillRectangle($bgBrush, 0, 0, $size, $size)
        $bgBrush.Dispose()

        $pad = if ($maskable) { [int]($size * 0.16) } else { [int]($size * 0.05) }
        $drawSize = $size - (2 * $pad)
        $g.DrawImage($src, $pad, $pad, $drawSize, $drawSize)

        $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $bmp.Dispose()
        $src.Dispose()
    }
}

Scale-Icon -sourcePath $iconeOficial -size 512 -outputPath (Join-Path $iconsDir "icon-512.png") -maskable $false
Scale-Icon -sourcePath $iconeOficial -size 512 -outputPath (Join-Path $iconsDir "icon-maskable-512.png") -maskable $true
Scale-Icon -sourcePath $iconeOficial -size 192 -outputPath (Join-Path $iconsDir "icon-192.png") -maskable $false
Scale-Icon -sourcePath $iconeOficial -size 180 -outputPath (Join-Path $iconsDir "icon-apple-touch.png") -maskable $false
Scale-Icon -sourcePath $iconeOficial -size 64  -outputPath (Join-Path $iconsDir "favicon.png") -maskable $false
Scale-Icon -sourcePath $iconeOficial -size 64  -outputPath (Join-Path $PSScriptRoot "favicon.ico") -maskable $false

Write-Host "Ícones PWA oficiais gerados com sucesso na pasta icons/!" -ForegroundColor Green
