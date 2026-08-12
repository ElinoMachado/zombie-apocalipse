# Recorta cada carro pelo bounding box (3×14) — sem grelha fixa que corta vizinhos.
Add-Type -AssemblyName System.Drawing

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$propsDir = Join-Path $root "public/assets/props"
$srcPng = Join-Path $propsDir "wrecked_cars_source.png"
$srcJpg = Join-Path $propsDir "wrecked_cars_source.jpg"
$out = Join-Path $propsDir "wrecked_cars_sheet.png"
$meta = Join-Path $propsDir "wrecked_cars_sheet.meta.json"

$src = if (Test-Path $srcPng) { $srcPng } elseif (Test-Path $srcJpg) { $srcJpg } else {
  Write-Error "Fonte não encontrada: $srcPng ou $srcJpg"
  exit 1
}

$cols = 14
$rows = 3

function IsKeyColor([System.Drawing.Color]$c) {
  return $c.R -le 24 -and $c.G -le 24 -and $c.B -le 24
}

function FindContentBands([int[]]$projection) {
  $bands = @()
  $in = $false
  $start = 0
  for ($i = 0; $i -lt $projection.Length; $i++) {
    $has = $projection[$i] -gt 0
    if ($has -and -not $in) {
      $start = $i
      $in = $true
    } elseif (-not $has -and $in) {
      $bands += ,@($start, ($i - 1))
      $in = $false
    }
  }
  if ($in) {
    $bands += ,@($start, ($projection.Length - 1))
  }
  return $bands
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($src)
$sw = $srcBmp.Width
$sh = $srcBmp.Height

$rowProj = New-Object int[] $sh
for ($y = 0; $y -lt $sh; $y++) {
  $sum = 0
  for ($x = 0; $x -lt $sw; $x++) {
    if (-not (IsKeyColor ($srcBmp.GetPixel($x, $y)))) { $sum++ }
  }
  $rowProj[$y] = $sum
}

$rowBands = FindContentBands $rowProj
if ($rowBands.Count -ne $rows) {
  $srcBmp.Dispose()
  Write-Error "Esperadas $rows linhas de conteúdo, detectadas $($rowBands.Count)"
  exit 1
}

$cells = @()
$maxW = 0
$maxH = 0

for ($row = 0; $row -lt $rows; $row++) {
  $y0 = $rowBands[$row][0]
  $y1 = $rowBands[$row][1]

  $colProj = New-Object int[] $sw
  for ($x = 0; $x -lt $sw; $x++) {
    $sum = 0
    for ($y = $y0; $y -le $y1; $y++) {
      if (-not (IsKeyColor ($srcBmp.GetPixel($x, $y)))) { $sum++ }
    }
    $colProj[$x] = $sum
  }

  $colBands = FindContentBands $colProj
  if ($colBands.Count -ne $cols) {
    $srcBmp.Dispose()
    Write-Error "Linha $row : esperadas $cols colunas, detectadas $($colBands.Count)"
    exit 1
  }

  for ($col = 0; $col -lt $cols; $col++) {
    $x0 = $colBands[$col][0]
    $x1 = $colBands[$col][1]
    $cw = $x1 - $x0 + 1
    $ch = $y1 - $y0 + 1
    if ($cw -gt $maxW) { $maxW = $cw }
    if ($ch -gt $maxH) { $maxH = $ch }
    $cells += ,@($row, $col, $x0, $y0, $x1, $y1)
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
      if (-not (IsKeyColor $c)) {
        $outBmp.SetPixel($dx0 + $x, $dy0 + $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
      }
    }
  }
}

$outBmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

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

$srcBmp.Dispose()
$outBmp.Dispose()

Write-Output "wrecked_cars_sheet.png ${outW}x${outH} frame ${maxW}x${maxH} (${cols}x${rows}, bbox per car)"
