# Recorta 8 contentores (2×4) — grelha fixa + trim por célula + fundo preto transparente.
Add-Type -AssemblyName System.Drawing

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$propsDir = Join-Path $root "public/assets/props"
$src = Join-Path $propsDir "containers_source.png"
$out = Join-Path $propsDir "containers_sheet.png"
$meta = Join-Path $propsDir "containers_sheet.meta.json"

if (-not (Test-Path $src)) {
  Write-Error "Fonte não encontrada: $src"
  exit 1
}

$cols = 2
$rows = 4

function IsKeyColor([System.Drawing.Color]$c) {
  return $c.R -le 24 -and $c.G -le 24 -and $c.B -le 24
}

function CellBounds($bmp, [int]$x0, [int]$y0, [int]$x1, [int]$y1) {
  $minX = $x1
  $minY = $y1
  $maxX = $x0
  $maxY = $y0
  $found = $false
  for ($y = $y0; $y -le $y1; $y++) {
    for ($x = $x0; $x -le $x1; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -ge 128 -and -not (IsKeyColor $c)) {
        $found = $true
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if (-not $found) { return $null }
  return ,@($minX, $minY, $maxX, $maxY)
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($src)
$sw = $srcBmp.Width
$sh = $srcBmp.Height
$cellW = [int][Math]::Floor($sw / $cols)
$cellH = [int][Math]::Floor($sh / $rows)

$cells = @()
$maxW = 0
$maxH = 0

for ($row = 0; $row -lt $rows; $row++) {
  for ($col = 0; $col -lt $cols; $col++) {
    $gx0 = $col * $cellW
    $gy0 = $row * $cellH
    $gx1 = if ($col -eq $cols - 1) { $sw - 1 } else { ($col + 1) * $cellW - 1 }
    $gy1 = if ($row -eq $rows - 1) { $sh - 1 } else { ($row + 1) * $cellH - 1 }
    $b = CellBounds $srcBmp $gx0 $gy0 $gx1 $gy1
    if ($null -eq $b) {
      $srcBmp.Dispose()
      Write-Error "Célula vazia row=$row col=$col"
      exit 1
    }
    $cw = $b[2] - $b[0] + 1
    $ch = $b[3] - $b[1] + 1
    if ($cw -gt $maxW) { $maxW = $cw }
    if ($ch -gt $maxH) { $maxH = $ch }
    $cells += ,@($row, $col, $b[0], $b[1], $b[2], $b[3])
  }
}

$outW = $maxW * $cols
$outH = $maxH * $rows
$outBmp = New-Object System.Drawing.Bitmap $outW, $outH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $outH; $y++) {
  for ($x = 0; $x -lt $outW; $x++) {
    $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  }
}

foreach ($cell in $cells) {
  $row = $cell[0]
  $col = $cell[1]
  $x0 = $cell[2]
  $y0 = $cell[3]
  $x1 = $cell[4]
  $y1 = $cell[5]
  $cw = $x1 - $x0 + 1
  $ch = $y1 - $y0 + 1
  $dx0 = $col * $maxW + [int][Math]::Floor(($maxW - $cw) / 2)
  $dy0 = $row * $maxH + [int][Math]::Floor(($maxH - $ch) / 2)

  for ($y = 0; $y -lt $ch; $y++) {
    for ($x = 0; $x -lt $cw; $x++) {
      $c = $srcBmp.GetPixel($x0 + $x, $y0 + $y)
      if ($c.A -lt 128 -or (IsKeyColor $c)) { continue }
      $outBmp.SetPixel($dx0 + $x, $dy0 + $y, [System.Drawing.Color]::FromArgb($c.A, $c.R, $c.G, $c.B))
    }
  }
}

$tmp = "${out}.tmp"
$outBmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$srcBmp.Dispose()
$outBmp.Dispose()
if (Test-Path $out) { Remove-Item $out -Force }
Move-Item $tmp $out -Force

$metaObj = [ordered]@{
  source = (Split-Path $src -Leaf)
  cols = $cols
  rows = $rows
  frameWidth = $maxW
  frameHeight = $maxH
  sheetWidth = $outW
  sheetHeight = $outH
  cells = $cells.Count
}
$metaObj | ConvertTo-Json | Set-Content -Path $meta -Encoding UTF8

Write-Output "containers_sheet.png ${outW}x${outH} frame ${maxW}x${maxH} (${cols}x${rows}, grid trim)"
