param([string]$ModelRoot='F:/BottleAI',[ValidateRange(0,99)][int]$GpuLayers=0)
$ErrorActionPreference='Stop'
$credentials=Get-Content -LiteralPath 'D:/BottleAI/local-service.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$env:LLAMA_API_KEY=$credentials.model_api_key
$server=Join-Path $ModelRoot 'llama.cpp/llama-server.exe'
$model=Join-Path $ModelRoot 'models/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q4_K_M.gguf'
$projector=Join-Path $ModelRoot 'models/Qwen3.5-4B-GGUF/mmproj-F16.gguf'
foreach($file in @($server,$model,$projector)){if(-not(Test-Path -LiteralPath $file)){throw "Missing model runtime: $file"}}
# Default to CPU after the CUDA failure. GPU offload requires an explicit -GpuLayers value.
# Browser rendering preferences are independent of model inference.
$proxyScript=Join-Path $PSScriptRoot 'model-tool-proxy.mjs'
$proxy=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"'+$proxyScript+'"') -WindowStyle Hidden -PassThru
try {
& $server --model $model --mmproj $projector --alias 'Qwen3.5-4B,bottle-chat' --host 0.0.0.0 --port 8003 --ctx-size 8192 --parallel 1 --n-gpu-layers $GpuLayers --no-mmproj-offload --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 --jinja --reasoning-budget 0 --threads 8

} finally { if (-not $proxy.HasExited) { Stop-Process -Id $proxy.Id } }
