param(
    [string]$ModelRoot=(Join-Path $PSScriptRoot '.runtime/chat-model'),
    [string]$ModelFile='base-model.gguf',
    [string]$AdapterFile='',
    [string]$ProjectorFile='',
    [string]$CredentialsFile='',
    [ValidateRange(0,99)][int]$GpuLayers=0
)
$ErrorActionPreference='Stop'
# 所有相对路径从本脚本所在的网页工程目录计算。
if (-not [IO.Path]::IsPathRooted($ModelRoot)) { $ModelRoot=Join-Path $PSScriptRoot $ModelRoot }
function Get-ModelPath([string]$Value) {
    if ([IO.Path]::IsPathRooted($Value)) { return $Value }
    return Join-Path $ModelRoot $Value
}
$server=Get-ModelPath 'llama.cpp/llama-server.exe'
$model=Get-ModelPath $ModelFile
$modelArgs=@('--model',$model,'--alias','Qwen3.5-4B,bottle-chat','--host','127.0.0.1','--port','8003','--ctx-size','8192','--parallel','1','--n-gpu-layers',"$GpuLayers",'--no-mmproj-offload','--flash-attn','on','--cache-type-k','q8_0','--cache-type-v','q8_0','--jinja','--reasoning-budget','0','--threads','8')
$required=@($server,$model)
if ($AdapterFile) { $adapter=Get-ModelPath $AdapterFile; $required+=$adapter; $modelArgs+=@('--lora',$adapter) }
if ($ProjectorFile) { $projector=Get-ModelPath $ProjectorFile; $required+=$projector; $modelArgs+=@('--mmproj',$projector) }
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing model runtime: $file. Supply the model migration package first." }
}
if ($CredentialsFile) {
    if (-not [IO.Path]::IsPathRooted($CredentialsFile)) { $CredentialsFile=Join-Path $PSScriptRoot $CredentialsFile }
    $credentials=Get-Content -LiteralPath $CredentialsFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $credentials.model_api_key) { throw 'Credentials file must contain model_api_key.' }
    $env:LLAMA_API_KEY=$credentials.model_api_key
}
foreach ($port in @(8002,8003)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is already in use; keep the existing model service or stop it before using this launcher." }
}
# 8002 是兼容接口，通过代理转发到本机 8003 模型进程；不修改 Coze 配置。
$proxyScript=Join-Path $PSScriptRoot 'model-tool-proxy.mjs'
$proxy=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"'+$proxyScript+'"') -WindowStyle Hidden -PassThru
try {
    & $server @modelArgs
    if ($LASTEXITCODE -ne 0) { throw "Model server exited with code $LASTEXITCODE" }
} finally { if (-not $proxy.HasExited) { Stop-Process -Id $proxy.Id } }
