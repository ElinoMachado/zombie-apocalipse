# Converte props de POI para PNG RGBA preservando alpha da fonte (sem chroma key).
Add-Type -AssemblyName System.Drawing

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$propsDir = Join-Path $root "public/assets/props"
$names = @('lixeira', 'gerador', 'cadaver1', 'cadaver2')

function IsTransparent([System.Drawing.Color]$c) {
  return $c.A -lt 128
}

function Resolve-SourcePath([string]$name) {
  $base = Join-Path $propsDir $name
  foreach ($ext in @('.png', '.jpg', '.jpeg')) {
    $candidate = "${base}_source${ext}"
    if (Test-Path $candidate) { return $candidate }
  }
  foreach ($ext in @('.png', '.jpg', '.jpeg')) {
    $candidate = "${base}${ext}"
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

foreach ($name in $names) {
  $srcPath = Resolve-SourcePath $name
  if ($null -eq $srcPath) {
    Write-Warning "Fonte não encontrada para ${name}"
    continue
  }

  $srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
  $w = $srcBmp.Width
  $h = $srcBmp.Height
  $outBmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $c = $srcBmp.GetPixel($x, $y)
      if (IsTransparent $c) {
        $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      } else {
        $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
      }
    }
  }

  $outPath = Join-Path $propsDir "${name}.png"
  $tmpPath = Join-Path $propsDir "${name}.tmp.png"
  $outBmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $srcBmp.Dispose()
  $outBmp.Dispose()
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  Move-Item $tmpPath $outPath -Force
  Write-Output "${name}.png ${w}x${h} RGBA (fonte: $(Split-Path $srcPath -Leaf), sem chroma key)"
}
