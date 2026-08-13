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

$adminConsoleFile = Join-Path $root 'entry\src\main\ets\pages\AdminConsole.ets'
$adminConsoleText = Get-Content -Raw -Encoding UTF8 $adminConsoleFile
$requiredMenus = @('DASHBOARD', 'PRODUCTION', 'INCIDENTS', 'DEVICES', 'MATERIALS', 'LOGISTICS', 'AI_AUDIT', 'AI_CONFIG', 'KNOWLEDGE', 'USERS', 'SETTINGS', 'AUDIT')
$requiredMenus | ForEach-Object {
    if (-not $adminConsoleText.Contains($_)) { $errors.Add("Missing admin navigation: $_") }
}

$requiredListStates = @('loadingState()', 'emptyState(', 'pager(', 'nextFilter()', 'detailPanel()')
$requiredListStates | ForEach-Object {
    if (-not $adminConsoleText.Contains($_)) { $errors.Add("Missing list state: $_") }
}

$requiredWriteGuards = @('confirmAction(', 'writeDisabledReason(', 'appendClientActivity(', 'SessionStore.isDemo', '/audit/operations')
$requiredWriteGuards | ForEach-Object {
    if (-not $adminConsoleText.Contains($_)) { $errors.Add("Missing write safety evidence: $_") }
}

$rolePolicyFile = Join-Path $root 'entry\src\main\ets\service\AdminAccessPolicy.ets'
if (-not (Test-Path -LiteralPath $rolePolicyFile)) {
    $errors.Add('Missing AdminAccessPolicy.ets')
} else {
    $rolePolicyText = Get-Content -Raw -Encoding UTF8 $rolePolicyFile
    @('VIEWER', 'OPERATOR', 'ENGINEER', 'ADMIN', 'INCIDENT_DISPOSE', 'THRESHOLD_MANAGE', 'USER_MANAGE') | ForEach-Object {
        if (-not $rolePolicyText.Contains($_)) { $errors.Add("Missing RBAC role or permission: $_") }
    }
}

$sessionText = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'entry\src\main\ets\service\SessionStore.ets')
@('expiresAt', 'isExpired()', 'setDemoSession(', 'demoMode') | ForEach-Object {
    if (-not $sessionText.Contains($_)) { $errors.Add("Missing session expiry evidence: $_") }
}
if ($sessionText -notmatch "setDemoSession[\s\S]*this\.token\s*=\s*''") { $errors.Add('Demo session token must stay empty') }

$apiClientText = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'entry\src\main\ets\service\ApiClient.ets')
if (-not ($apiClientText -match 'responseCode\s*===\s*401[\s\S]*SessionStore\.clear\(\)')) { $errors.Add('HTTP 401 must clear the session') }
if ($apiClientText -match 'responseCode\s*===\s*403[\s\S]{0,100}SessionStore\.clear\(\)') { $errors.Add('HTTP 403 must not clear a valid session') }
if ($apiClientText -notmatch 'SessionStore\.isDemo[\s\S]{0,120}throw new ApiError') { $errors.Add('HTTP client must reject demo-mode requests before creating a client') }

$loginText = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'entry\src\main\ets\pages\Login.ets')
if ($loginText -notmatch 'setSession\(result\.token') { $errors.Add('Real login must preserve the backend token') }
if ($loginText -notmatch 'setDemoSession\(') { $errors.Add('Demo login must use a separate demo session') }

$realtimeText = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'entry\src\main\ets\service\FactoryRealtime.ets')
if ($realtimeText -notmatch 'SessionStore\.isDemo[\s\S]{0,300}createWebSocket') { $errors.Add('WebSocket client must stop before connecting in demo mode') }

$assistantAdapterText = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'entry\src\main\ets\service\AdminAssistantHostAdapter.ets')
if ($assistantAdapterText -notmatch "SessionStore\.isDemo[\s\S]{0,100}httpBaseUrl:\s*''") { $errors.Add('Assistant endpoint must be disabled in demo mode') }

$adminSourceText = ($etsFiles | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName }) -join "`n"
$projectText = (Get-ChildItem -Path $root -Recurse -File | Where-Object { $_.FullName -notmatch '\\(oh_modules|build)\\' } | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName }) -join "`n"
$fixedDemoToken = 'LOCAL' + '-DEMO'
if ($projectText.Contains($fixedDemoToken)) { $errors.Add('Fixed demo tokens are forbidden in the admin console') }
@('/assistant/conversations', '/assistant/conversations/', 'ai.conversation', 'AssistantApiClient', 'conversationId') | ForEach-Object {
    if ($adminSourceText.Contains($_)) { $errors.Add("Admin console must not implement shared assistant conversation client: $_") }
}

$knowledgeGovernanceFile = Join-Path $root 'entry\src\main\ets\components\KnowledgeGovernance.ets'
if (-not (Test-Path -LiteralPath $knowledgeGovernanceFile)) {
    $errors.Add('Missing KnowledgeGovernance.ets')
} else {
    $knowledgeGovernanceText = Get-Content -Raw -Encoding UTF8 $knowledgeGovernanceFile
    @('PERMISSION_KNOWLEDGE_REVIEW', 'submittedBy !== this.currentUsername()', 'submittedBy === this.currentUsername()', 'approveKnowledge', 'rejectKnowledge', 'revokeKnowledge', 'INDEXED') | ForEach-Object {
        if (-not $knowledgeGovernanceText.Contains($_)) { $errors.Add("Missing knowledge governance negative evidence: $_") }
    }
}

$aiCenterClientFile = Join-Path $root 'entry\src\main\ets\service\AiCenterClient.ets'
if (Test-Path -LiteralPath $aiCenterClientFile) {
    $aiCenterClientText = Get-Content -Raw -Encoding UTF8 $aiCenterClientFile
    @('/admin/ai/config', '/admin/ai/config/test-question', '/admin/knowledge/reviews') | ForEach-Object {
        if (-not $aiCenterClientText.Contains($_)) { $errors.Add("Missing admin AI business endpoint: $_") }
    }
    if ($aiCenterClientText.Contains('/assistant/')) { $errors.Add('AiCenterClient must not call shared assistant conversation endpoints') }
    if ($aiCenterClientText -notmatch 'assertNetworkAllowed\(\)[\s\S]{0,120}createHttp') { $errors.Add('AI client must reject demo-mode requests before creating a client') }
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
Write-Host "[PASS] $($requiredMenus.Count) real admin navigation entries are present" -ForegroundColor Green
Write-Host '[PASS] VIEWER/OPERATOR/ENGINEER/ADMIN RBAC and session expiry guards are present' -ForegroundColor Green
Write-Host '[PASS] list states and write confirmation/failure/audit evidence are present' -ForegroundColor Green
Write-Host '[PASS] assistant boundary and knowledge-review negative guards are present' -ForegroundColor Green
