$ErrorActionPreference='Stop'
$project=$PSScriptRoot
$logRoot='F:/BottleAI/logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
function Test-Port([int]$Port) {
    $socket=New-Object Net.Sockets.TcpClient
    try { $socket.Connect('127.0.0.1',$Port); return $true } catch { return $false } finally { $socket.Dispose() }
}
if (-not (Test-Port 8093)) {
    Start-Process node.exe -ArgumentList 'vision-demo-server.mjs' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'vision.out.log') -RedirectStandardError (Join-Path $logRoot 'vision.err.log') | Out-Null
}
if (-not (Test-Port 8002) -and -not (Test-Port 8003)) {
    $modelScript=Join-Path $project 'start-chat-model.ps1'
    Start-Process powershell.exe -ArgumentList @('-NoProfile','-File',('"'+$modelScript+'"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'chat.out.log') -RedirectStandardError (Join-Path $logRoot 'chat.err.log') | Out-Null
}
if ((Test-Port 8002) -or (Test-Port 8003)) {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8002/health' -TimeoutSec 3
        if ($health.status -ne 'ok') { Write-Warning 'Model is still loading; the assistant is not ready yet.' }
    } catch { Write-Warning 'Model endpoint is not healthy. No duplicate model was started; check F:/BottleAI/logs/chat.err.log.' }
}
if (-not (Test-Port 8888)) {
    $dockerDesktop='C:/Program Files/Docker/Docker/Docker Desktop.exe'
    if (Test-Path -LiteralPath $dockerDesktop) {
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null
    } else { Write-Warning 'Coze Studio requires the existing Docker Desktop deployment.' }
}
Write-Output 'Integration services requested: vision 8093, model 8002, Coze 8888. Model and Docker may need time to become ready.'


if (-not (Test-Port 8891)) {
    Start-Process python.exe -ArgumentList 'knowledge-service.py' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'knowledge.out.log') -RedirectStandardError (Join-Path $logRoot 'knowledge.err.log') | Out-Null
}
