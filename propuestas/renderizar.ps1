# Convierte los SVG de propuestas/ a PNG usando Microsoft Edge en modo headless.
#   powershell -ExecutionPolicy Bypass -File propuestas\renderizar.ps1
$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { throw 'No se encontró Microsoft Edge.' }

$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$tmp = Join-Path $env:TEMP 'utama-render'
New-Item -ItemType Directory -Force $tmp | Out-Null

Get-ChildItem -Path (Join-Path $aqui 'banners'), (Join-Path $aqui 'logo') -Filter *.svg | ForEach-Object {
    $svg = $_.FullName
    $texto = Get-Content -Raw -Encoding UTF8 $svg
    if ($texto -notmatch 'width="(\d+)" height="(\d+)"') { return }
    $w = [int]$Matches[1]; $h = [int]$Matches[2]
    $html = Join-Path $tmp ($_.BaseName + '.html')
    $uri = ([System.Uri]$svg).AbsoluteUri
    Set-Content -Encoding UTF8 $html "<!doctype html><meta charset='utf-8'><body style='margin:0;background:transparent'><img src='$uri' width='$w' height='$h' style='display:block'>"
    $png = [System.IO.Path]::ChangeExtension($svg, '.png')
    & $edge --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 "--screenshot=$png" "--window-size=$w,$h" ([System.Uri]$html).AbsoluteUri | Out-Null
    Write-Host ("{0} -> {1}x{2}" -f $_.Name, $w, $h)
}
