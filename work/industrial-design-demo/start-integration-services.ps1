param(
    [switch]$StartModel,
    [string]$ModelRoot='.runtime/chat-model',
    [string]$ModelFile='base-model.gguf',
    [string]$AdapterFile='',
    [string]$KnowledgeRoot='',
    [string]$EmbeddingCache='',
    [string]$CozeComposeFile=''
)
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
function Resolve-ServicePath([string]$Value) {
    if ([IO.Path]::IsPathRooted($Value)) { return $Value }
    return [IO.Path]::GetFullPath((Join-Path $project $Value))
}
function Test-Port([int]$Port) {
    $socket=New-Object Net.Sockets.TcpClient
    try { $socket.Connect('127.0.0.1',$Port); return $true } catch { return $false } finally { $socket.Dispose() }
}
# 先检查主动请求的迁移资源，再启动服务；没有迁移资料时不自动安装替代服务。
$ModelRoot=Resolve-ServicePath $ModelRoot
if ($StartModel -and -not (Test-Port 8002) -and -not (Test-Port 8003)) {
    foreach ($file in @('llama.cpp/llama-server.exe',$ModelFile,$AdapterFile)) {
        if ($file) {
            $target=if ([IO.Path]::IsPathRooted($file)) { $file } else { Join-Path $ModelRoot $file }
            if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Missing model file: $target. Supply the model migration package first." }
        }
    }
}
if ($KnowledgeRoot -or $EmbeddingCache) {
    if (-not $KnowledgeRoot -or -not $EmbeddingCache) { throw 'Provide both -KnowledgeRoot and -EmbeddingCache.' }
    $env:BOTTLE_KNOWLEDGE_ROOT=Resolve-ServicePath $KnowledgeRoot
    $env:BOTTLE_EMBEDDING_CACHE=Resolve-ServicePath $EmbeddingCache
    if (-not (Test-Path -LiteralPath (Join-Path $env:BOTTLE_KNOWLEDGE_ROOT 'platform-knowledge.json') -PathType Leaf)) { throw 'Knowledge data platform-knowledge.json is missing.' }
    if (-not (Test-Path -LiteralPath $env:BOTTLE_EMBEDDING_CACHE -PathType Container)) { throw 'Embedding model cache is missing; supply the knowledge migration files first.' }
    $python=(Get-Command python -ErrorAction Stop).Source
}
if ($CozeComposeFile) {
    $CozeComposeFile=Resolve-ServicePath $CozeComposeFile
    if (-not (Test-Path -LiteralPath $CozeComposeFile -PathType Leaf)) { throw 'Coze Compose file is missing; restore the existing migration package first.' }
    Get-Command docker -ErrorAction Stop | Out-Null
    & docker info --format '{{.ServerVersion}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and wait for the engine to be ready.' }
}
$logRoot=Join-Path $project '.runtime/logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
if (-not (Test-Port 8093)) {
    Start-Process -FilePath (Get-Command node).Source -ArgumentList 'vision-demo-server.mjs' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'vision.out.log') -RedirectStandardError (Join-Path $logRoot 'vision.err.log') | Out-Null
}
Write-Output 'Vision demonstration service: port 8093. Fixed examples only; no real visual model inference.'
if ($StartModel -and -not (Test-Port 8002) -and -not (Test-Port 8003)) {
    $modelScript=Join-Path $project 'start-chat-model.ps1'
    $arguments=@('-NoProfile','-File',('"'+$modelScript+'"'),'-ModelRoot',('"'+$ModelRoot+'"'),'-ModelFile',('"'+$ModelFile+'"'))
    if ($AdapterFile) { $arguments+=@('-AdapterFile',('"'+$AdapterFile+'"')) }
    Start-Process powershell.exe -ArgumentList $arguments -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'chat.out.log') -RedirectStandardError (Join-Path $logRoot 'chat.err.log') | Out-Null
    Write-Output 'Model startup requested: compatibility endpoint 8002, local model 8003. Check chat.err.log if startup fails.'
} elseif ($StartModel) { Write-Output 'Existing model endpoint detected. Its configuration was not changed.' }
if ($KnowledgeRoot -and -not (Test-Port 8891)) {
    Start-Process -FilePath $python -ArgumentList 'knowledge-service.py' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'knowledge.out.log') -RedirectStandardError (Join-Path $logRoot 'knowledge.err.log') | Out-Null
    Write-Output 'Knowledge service startup requested on 8891. Check knowledge.err.log if startup fails.'
}
if ($CozeComposeFile) {
    # 仅启动已恢复的镜像和数据，不构建或下载替代镜像。
    & docker compose -f $CozeComposeFile up -d --no-build --pull never
    if ($LASTEXITCODE -ne 0) { throw 'Coze startup failed. Check the restored Compose environment and images.' }
    Write-Output 'Existing Coze Compose services started. Keep the migrated bot and model connection settings.'
}
Write-Output 'Startup requests sent. Inspect .runtime/logs and the individual health endpoints before configuring platform connections.'
