$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$errors = [System.Collections.Generic.List[string]]::new()

Get-ChildItem -Path $root -Recurse -File -Include *.json,*.json5 | ForEach-Object {
    try { Get-Content -Raw -Encoding UTF8 $_.FullName | ConvertFrom-Json | Out-Null }
    catch { $errors.Add("JSON syntax: $($_.FullName) - $($_.Exception.Message)") }
}

$pagesFile = Join-Path $root 'entry\src\main\resources\base\profile\main_pages.json'
$pages = (Get-Content -Raw -Encoding UTF8 $pagesFile | ConvertFrom-Json).src
$pages | ForEach-Object {
    $pagePath = Join-Path $root ("entry\src\main\ets\{0}.ets" -f $_)
    if (-not (Test-Path -LiteralPath $pagePath)) { $errors.Add("Missing page: $_") }
}

$etsFiles = Get-ChildItem -Path (Join-Path $root 'entry\src\main\ets') -Recurse -Filter *.ets
foreach ($file in $etsFiles) {
    $text = Get-Content -Raw -Encoding UTF8 $file.FullName
    $openCount = ([regex]::Matches($text, '\{')).Count
    $closeCount = ([regex]::Matches($text, '\}')).Count
    if ($openCount -ne $closeCount) { $errors.Add("Brace mismatch: $($file.FullName) ($openCount/$closeCount)") }

    [regex]::Matches($text, "from\s+'(\.\.?/[^']+)'") | ForEach-Object {
        $relative = $_.Groups[1].Value.Replace('/', '\') + '.ets'
        $target = [System.IO.Path]::GetFullPath((Join-Path $file.DirectoryName $relative))
        if (-not (Test-Path -LiteralPath $target)) { $errors.Add("Missing import: $($file.FullName) -> $relative") }
    }

    [regex]::Matches($text, "url:\s*'pages/([^']+)'") | ForEach-Object {
        $route = 'pages/' + $_.Groups[1].Value
        if ($pages -notcontains $route) { $errors.Add("Unregistered route: $route") }
    }

    if ($text -match '\b(document|localStorage|axios)\b|window\.(location|setInterval|setTimeout)|<template|<style') {
        $errors.Add("Browser dependency: $($file.FullName)")
    }
}

$threeComponent = Join-Path $root 'entry\src\main\ets\components\FactoryThreeScene.ets'
if (Test-Path -LiteralPath $threeComponent) {
    $threeRoot = Join-Path $root 'entry\src\main\resources\rawfile\factory3d'
    $threeFiles = @(
        'index.html',
        'scene.css',
        'scene.js',
        'vendor\three.min.js',
        'vendor\THREE-LICENSE.txt'
    )
    $threeFiles | ForEach-Object {
        $path = Join-Path $threeRoot $_
        if (-not (Test-Path -LiteralPath $path)) { $errors.Add("Missing Three.js resource: $_") }
    }
    $componentText = Get-Content -Raw -Encoding UTF8 $threeComponent
    @("from '@kit.ArkWeb'", "`$rawfile('factory3d/index.html')", 'runJavaScript', 'factory://device/', 'factory://product/') | ForEach-Object {
        if (-not $componentText.Contains($_)) { $errors.Add("Missing ArkWeb bridge contract: $_") }
    }
    $sceneFile = Join-Path $threeRoot 'scene.js'
    if (Test-Path -LiteralPath $sceneFile) {
        $sceneText = Get-Content -Raw -Encoding UTF8 $sceneFile
        @('THREE.WebGLRenderer', 'window.FactoryScene', 'setLayoutEdit', 'setStatusColors') | ForEach-Object {
            if (-not $sceneText.Contains($_)) { $errors.Add("Missing Three.js scene contract: $_") }
        }
        if ($sceneText -match 'https?://|cdn\.') { $errors.Add('Three.js scene contains an external runtime dependency') }
    }
}

$serviceText = ($etsFiles | Where-Object { $_.DirectoryName -like '*\service' } | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName }) -join "`n"
$requiredContracts = @('/auth/login', '/auth/register', '/factory/dashboard', '/factory/runtime', '/operations/overview', '/logistics/overview', '/factory/runtime/incidents', '/operations/alarms/')
$requiredContracts | ForEach-Object {
    if (-not $serviceText.Contains($_)) { $errors.Add("Missing API contract: $_") }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Host "[FAIL] $_" -ForegroundColor Red }
    throw "Static validation failed: $($errors.Count) item(s)."
}

Write-Host '[PASS] JSON/JSON5 files parse' -ForegroundColor Green
Write-Host "[PASS] $($pages.Count) pages exist and are registered" -ForegroundColor Green
Write-Host "[PASS] $($etsFiles.Count) ArkTS files pass import and brace checks" -ForegroundColor Green
Write-Host '[PASS] no Vue runtime dependency found in ArkTS business code' -ForegroundColor Green
if (Test-Path -LiteralPath $threeComponent) {
    Write-Host '[PASS] local ArkWeb + Three.js scene and bridge contracts are present' -ForegroundColor Green
} else {
    Write-Host '[PASS] admin console has no Three.js dependency' -ForegroundColor Green
}
Write-Host '[PASS] core backend API contracts are covered' -ForegroundColor Green
