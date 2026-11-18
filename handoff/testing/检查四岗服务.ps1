param(
    [string]$PlatformBaseUrl='http://127.0.0.1:5174',
    [string]$VisionBaseUrl='http://127.0.0.1:8093',
    [string]$AgentBaseUrl='http://127.0.0.1:8887'
)
$ErrorActionPreference='Continue'
$script:failed=$false
function Check($name,[scriptblock]$action){
    try { $detail=& $action; Write-Host ('PASS  '+$name+'  '+$detail) -ForegroundColor Green }
    catch { $script:failed=$true; Write-Host ('FAIL  '+$name+'  '+$_.Exception.Message) -ForegroundColor Red }
}
$PlatformBaseUrl=$PlatformBaseUrl.TrimEnd('/')
$VisionBaseUrl=$VisionBaseUrl.TrimEnd('/')
$AgentBaseUrl=$AgentBaseUrl.TrimEnd('/')
Check 'platform page' { $r=Invoke-WebRequest ($PlatformBaseUrl+'/') -UseBasicParsing -TimeoutSec 8; if($r.StatusCode -ne 200){throw ('HTTP '+$r.StatusCode)}; ('HTTP '+$r.StatusCode) }
Check 'platform context' { $r=Invoke-RestMethod ($PlatformBaseUrl+'/api/ops/context') -Headers @{Cookie='bw_demo_actor=admin'} -TimeoutSec 8; ('mode='+$r.dataMode) }
Check 'vision health' { $r=Invoke-RestMethod ($VisionBaseUrl+'/health') -TimeoutSec 8; if($r.contract -ne 'bottleworks-vision-v1'){throw 'contract mismatch'}; ('ready demo='+$r.demo) }
$bytes=[IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'samples/normal-original-top.webp'))
$data='data:image/webp;base64,'+[Convert]::ToBase64String($bytes)
$cameraIds=@('top','side-0','side-120','side-240')
$images=@($cameraIds|ForEach-Object {@{cameraId=$_;data=$data}})
foreach($case in @('normal','defect')){
    foreach($branch in @('opencv','yolo','patchcore','inspect')){
        Check ('vision '+$case+'/'+$branch) {
            $body=@{requestId=[guid]::NewGuid().ToString();bottleId='TEST-01';batchId='LAN-TEST';caseId=$case;images=$images}|ConvertTo-Json -Depth 8
            $r=Invoke-RestMethod -Method Post -Uri ($VisionBaseUrl+'/'+$branch) -ContentType 'application/json' -Body $body -TimeoutSec 10
            if($r.cameras.Count -ne 4){throw ('camera count '+$r.cameras.Count)}
            if($branch -eq 'inspect'){
                $expected=if($case -eq 'normal'){'pass'}else{'reject'}
                if($r.verdict -ne $expected){throw ('expected '+$expected+', got '+$r.verdict)}
                ('verdict='+$r.verdict+' demo='+$r.demo)
            }else{'four preset camera results demo='+$r.demo}
        }
    }
}
Check 'agent health' { $r=Invoke-RestMethod ($AgentBaseUrl+'/health') -TimeoutSec 8; if($r.contract -ne 'coze-v3-demo'){throw 'contract mismatch'}; ('ready demo='+$r.demo) }
Check 'agent chat' {
    $body=@{bot_id='123456789012';user_id='handoff-test';stream=$false;additional_messages=@(@{role='user';content='connectivity test';content_type='text'})}|ConvertTo-Json -Depth 8
    $r=Invoke-RestMethod -Method Post -Uri ($AgentBaseUrl+'/v3/chat') -ContentType 'application/json' -Body $body -TimeoutSec 8
    if($r.code -ne 0 -or $r.data.status -ne 'completed'){throw 'chat not completed'}
    $query='?conversation_id='+$r.data.conversation_id+'&chat_id='+$r.data.id
    $answer=Invoke-RestMethod ($AgentBaseUrl+'/v3/chat/message/list'+$query) -TimeoutSec 8
    if(-not ($answer.data | Where-Object { $_.type -eq 'answer' -and $_.content })){throw 'answer missing'}
    'mock answer received'
}
if($script:failed){exit 1}
Write-Host 'All handoff checks passed. These are interface/demo checks, not real inference or robot acceptance.' -ForegroundColor Cyan
