# Script para gerar os ícones do PWA com alta qualidade
Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

function Create-PwaIcon {
    param(
        [int]$size,
        [string]$outputPath,
        [bool]$maskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42)) # Slate-900 (#0f172a)
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Safe zone calculation
    $pad = if ($maskable) { [float]($size * 0.16) } else { [float]($size * 0.08) }
    $innerW = [float]($size - (2 * $pad))
    $innerH = [float]($size - (2 * $pad))
    $rect = New-Object System.Drawing.RectangleF([float]$pad, [float]$pad, [float]$innerW, [float]$innerH)

    # Rounded card in the center with gradient
    $cTop = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)   # Blue-600 (#2563eb)
    $cBot = [System.Drawing.Color]::FromArgb(255, 30, 58, 138)   # Blue-900 (#1e3a8a)
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBot, 45.0)

    $radius = [float]($innerW * 0.22)
    $diameter = [float]($radius * 2.0)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc([float]$rect.X, [float]$rect.Y, [float]$diameter, [float]$diameter, 180.0, 90.0)
    $path.AddArc([float]($rect.Right - $diameter), [float]$rect.Y, [float]$diameter, [float]$diameter, 270.0, 90.0)
    $path.AddArc([float]($rect.Right - $diameter), [float]($rect.Bottom - $diameter), [float]$diameter, [float]$diameter, 0.0, 90.0)
    $path.AddArc([float]$rect.X, [float]($rect.Bottom - $diameter), [float]$diameter, [float]$diameter, 90.0, 90.0)
    $path.CloseFigure()

    $g.FillPath($gradBrush, $path)

    # Border around inner card
    $borderThickness = [float][Math]::Max(2.0, ($size * 0.015))
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), $borderThickness)
    $g.DrawPath($borderPen, $path)

    # Draw Text "FC"
    $fontSize = [float]($innerH * 0.36)
    $fontFamily = New-Object System.Drawing.FontFamily("Arial")
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $textY = [float]($pad + ($innerH * 0.06))
    $textH = [float]($innerH * 0.52)
    $textRect = New-Object System.Drawing.RectangleF([float]$pad, [float]$textY, [float]$innerW, [float]$textH)
    $g.DrawString("FC", $font, $textBrush, $textRect, $format)

    # Subtext "GESTAO"
    $subFontSize = [float]($innerH * 0.12)
    $subFont = New-Object System.Drawing.Font($fontFamily, $subFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 147, 197, 253)) # Blue-300
    $subY = [float]($pad + ($innerH * 0.60))
    $subH = [float]($innerH * 0.26)
    $subTextRect = New-Object System.Drawing.RectangleF([float]$pad, [float]$subY, [float]$innerW, [float]$subH)
    $g.DrawString("GESTAO", $subFont, $subBrush, $subTextRect, $format)

    # Save PNG
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    $bgBrush.Dispose()
    $gradBrush.Dispose()
    $textBrush.Dispose()
    $subBrush.Dispose()
    $font.Dispose()
    $subFont.Dispose()
    $borderPen.Dispose()
    $path.Dispose()
}

Create-PwaIcon -size 512 -outputPath (Join-Path $iconsDir "icon-512.png") -maskable $false
Create-PwaIcon -size 512 -outputPath (Join-Path $iconsDir "icon-maskable-512.png") -maskable $true
Create-PwaIcon -size 192 -outputPath (Join-Path $iconsDir "icon-192.png") -maskable $false
Create-PwaIcon -size 180 -outputPath (Join-Path $iconsDir "icon-apple-touch.png") -maskable $false
Create-PwaIcon -size 64  -outputPath (Join-Path $iconsDir "favicon.png") -maskable $false

Write-Host "Ícones PWA gerados com sucesso na pasta icons/!" -ForegroundColor Green
