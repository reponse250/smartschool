$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assetDirectory = Join-Path $PSScriptRoot '..\public\assets'
$assetDirectory = [System.IO.Path]::GetFullPath($assetDirectory)
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null

function New-SmartSchoolIcon([int]$Size, [string]$Path) {
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bounds = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bounds,
        [System.Drawing.Color]::FromArgb(37, 99, 235),
        [System.Drawing.Color]::FromArgb(14, 165, 233),
        45
    )
    $font = New-Object System.Drawing.Font('Arial', ($Size * 0.66), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textBounds = New-Object System.Drawing.RectangleF(0, ($Size * 0.015), $Size, ($Size * 0.92))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

    try {
        $graphics.FillRectangle($gradient, $bounds)
        $graphics.DrawString('S', $font, $white, $textBounds, $format)
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $white.Dispose()
        $format.Dispose()
        $font.Dispose()
        $gradient.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

New-SmartSchoolIcon 192 (Join-Path $assetDirectory 'app-icon-192.png')
New-SmartSchoolIcon 512 (Join-Path $assetDirectory 'app-icon-512.png')
Write-Output 'Generated install icons in public/assets.'
