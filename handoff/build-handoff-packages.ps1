param([Parameter(Mandatory)][string]$ModelSource)
$ErrorActionPreference='Stop'
$handoffRoot=$PSScriptRoot
$repoRoot=Split-Path $handoffRoot -Parent
$appRoot=Join-Path $repoRoot 'work/industrial-design-demo'
$outRoot=Join-Path $repoRoot 'handoff-packages'
if(Test-Path -LiteralPath $outRoot){
    $allowed=@('01-视觉岗服务包.zip','02-智能体岗服务包.zip','03-平台岗服务包.zip','04-测试岗服务包.zip','交接说明.md')
    $unexpected=Get-ChildItem -LiteralPath $outRoot -Force | Where-Object Name -NotIn $allowed
    if($unexpected){throw "Output contains files not created by this packager; inspect before continuing: $outRoot"}
}else{New-Item -ItemType Directory -Path $outRoot | Out-Null}
$stage=Join-Path $outRoot ('_stage-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null

function Copy-TreeFiles([string]$Source,[string]$Destination,[scriptblock]$Include){
    Get-ChildItem -LiteralPath $Source -File -Recurse -Force | Where-Object { & $Include $_ } | ForEach-Object {
        $relative=$_.FullName.Substring($Source.Length).TrimStart([char[]]@([char]92,[char]47))
        $target=Join-Path $Destination $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $target
    }
}
function Make-Zip([string]$Folder,[string]$ZipName){
    $archive=Join-Path $stage $ZipName
    & tar.exe -a -cf $archive -C $Folder .
    if($LASTEXITCODE -ne 0){throw "ZIP creation failed: $ZipName"}
    Move-Item -LiteralPath $archive -Destination (Join-Path $outRoot $ZipName) -Force
}

$vision=Join-Path $stage '01-视觉岗服务包'
New-Item -ItemType Directory -Force -Path (Join-Path $vision 'src'),(Join-Path $vision 'public/images/vision-demo') | Out-Null
Copy-Item -LiteralPath (Join-Path $appRoot 'vision-demo-server.mjs'),(Join-Path $appRoot 'vision-rehearsal.mjs') -Destination $vision
Copy-Item -LiteralPath (Join-Path $appRoot 'src/materialFlow.js') -Destination (Join-Path $vision 'src')
Copy-TreeFiles (Join-Path $appRoot 'public/images/vision-demo') (Join-Path $vision 'public/images/vision-demo') { $true }
Copy-Item -LiteralPath (Join-Path $handoffRoot 'vision-service/README.md'),(Join-Path $handoffRoot 'vision-service/start.cmd') -Destination $vision
Copy-Item -LiteralPath (Join-Path $handoffRoot 'vision-service/package.json') -Destination $vision
Make-Zip $vision '01-视觉岗服务包.zip'

$agent=Join-Path $stage '02-智能体岗服务包'
New-Item -ItemType Directory -Force -Path $agent | Out-Null
Copy-Item -LiteralPath (Join-Path $handoffRoot 'agent-service/server.mjs'),(Join-Path $handoffRoot 'agent-service/启动接口联通模拟.cmd'),(Join-Path $handoffRoot 'agent-service/启动适配模型.cmd'),(Join-Path $handoffRoot 'agent-service/README.md') -Destination $agent
foreach($name in @('coze-native-agent.json','coze-agent.openapi.json','coze-skills.openapi.json','coze-platform-schema.json','coze-result-node.py')){
    Copy-Item -LiteralPath (Join-Path $appRoot ('handoff-examples/'+$name)) -Destination $agent
}
Copy-Item -LiteralPath (Join-Path $handoffRoot 'agent-service/交付已发布智能体.cmd') -Destination $agent
$modelTarget=Join-Path $agent 'model'
New-Item -ItemType Directory -Force -Path (Join-Path $modelTarget 'models'),(Join-Path $modelTarget 'runtime') | Out-Null
foreach($name in @('base-model.gguf','adapter.gguf','qwen35_chat_template.jinja')){
    Copy-Item -LiteralPath (Join-Path (Join-Path $modelSource 'models') $name) -Destination (Join-Path $modelTarget 'models')
}
Get-ChildItem -LiteralPath (Join-Path $modelSource 'runtime') -File -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $modelTarget 'runtime') }
if(Test-Path -LiteralPath (Join-Path $modelSource 'vc_redist.x64.exe')){Copy-Item -LiteralPath (Join-Path $modelSource 'vc_redist.x64.exe') -Destination $modelTarget}
Make-Zip $agent '02-智能体岗服务包.zip'

$platform=Join-Path $stage '03-平台岗服务包'
New-Item -ItemType Directory -Force -Path $platform | Out-Null
Copy-TreeFiles $appRoot $platform {
    param($f)
    $relative=$f.FullName.Substring($appRoot.Length).Replace([char]92,'/')
    $f.Extension -in @('.mjs','.js','.html','.css','.json','.md') -and
    $f.Name -notmatch '\.test\.' -and
    $f.Name -notin @('protoforge-config.json','.local-ai.json','.local-operations.json') -and
    $relative -notmatch '(^|/)(\.runtime|\.pytest_cache|node_modules|dist|blender-integration|vision|handoff-examples|mg400-projects)(/|$)' -and
    $relative -notmatch '(^|/)config/mg400-[^/]+\.json$' -and
    $relative -notmatch '(^|/)public/uploads(/|$)'
}
Copy-TreeFiles (Join-Path $appRoot 'public') (Join-Path $platform 'public') {
    param($f)
    $relative=$f.FullName.Substring((Join-Path $appRoot 'public').Length).Replace([char]92,'/')
    $relative -notmatch '(^|/)uploads(/|$)'
}
Copy-Item -LiteralPath (Join-Path $handoffRoot 'platform-template/.env.handoff.example') -Destination (Join-Path $platform '.env.handoff.example')
Copy-Item -LiteralPath (Join-Path $appRoot 'protoforge-config.json') -Destination $platform
$mgCfg=Join-Path $platform 'config';New-Item -ItemType Directory -Force -Path $mgCfg | Out-Null
foreach($name in @('mg400-communication.json','mg400-protocol.json','mg400-acquisition.json','mg400-trajectories.json','mg400-motion.json')){
    Copy-Item -LiteralPath (Join-Path (Join-Path $appRoot 'config') $name) -Destination $mgCfg
}
$examples=Join-Path $platform 'handoff-examples';New-Item -ItemType Directory -Force -Path $examples | Out-Null
Copy-Item -LiteralPath (Join-Path $appRoot 'handoff-examples/mg400-motion-config.mjs') -Destination $examples
foreach($dir in @('src','skills','knowledge')){
    $source=Join-Path $appRoot $dir
    if(Test-Path -LiteralPath $source){Copy-TreeFiles $source (Join-Path $platform $dir) { $true }}
}
$cfg=Join-Path $platform 'config';New-Item -ItemType Directory -Force -Path $cfg | Out-Null
foreach($name in @('assistant-skills.json','alarm-rules.json','device-capabilities.json','README.md')){
    $source=Join-Path (Join-Path $appRoot 'config') $name
    if(Test-Path -LiteralPath $source){Copy-Item -LiteralPath $source -Destination $cfg}
}
$visionDoc=Join-Path $platform 'docs/external-vision-contract.md';New-Item -ItemType Directory -Force -Path (Split-Path $visionDoc -Parent) | Out-Null
Copy-Item -LiteralPath (Join-Path $appRoot 'docs/external-vision-contract.md') -Destination $visionDoc
Copy-Item -LiteralPath (Join-Path $handoffRoot 'platform-template/docker-compose.demo.yml'),(Join-Path $handoffRoot 'platform-template/README-交接.md'),(Join-Path $handoffRoot 'platform-template/start.cmd') -Destination $platform
Copy-Item -LiteralPath (Join-Path $handoffRoot 'agent-service/server.mjs') -Destination (Join-Path $platform 'local-agent-demo.mjs')
Copy-Item -LiteralPath (Join-Path $handoffRoot 'platform-template/start-platform-handoff.mjs') -Destination $platform
Make-Zip $platform '03-平台岗服务包.zip'

$testing=Join-Path $stage '04-测试岗服务包'
$sampleDir=Join-Path $testing 'samples';New-Item -ItemType Directory -Force -Path $sampleDir | Out-Null
Copy-TreeFiles (Join-Path $handoffRoot 'testing') $testing { $true }
Copy-Item -LiteralPath (Join-Path $appRoot 'public/images/vision-demo/normal-original-top.webp') -Destination (Join-Path $sampleDir 'normal-original-top.webp')
Make-Zip $testing '04-测试岗服务包.zip'

$summary=@'
# 四岗服务交接包

01 视觉岗：局域网模拟视觉服务，TCP 8093。提供 OpenCV、YOLO、PatchCore、联合检测四个假结果接口，素材随包。
02 智能体岗：已适配的 Qwen3.5 模型（8004）、瓶安助手配置、已发布 Coze 接口转发（8889）、固定回复联通模拟（8887）。真实智能体需要已有的 Coze 实例和已发布 Bot。
03 平台岗：网页平台（5174），本地 MySQL（仅本机 53307）、视觉备用（仅本机 18093）及智能体联通模拟备用（仅本机 8887）。
04 测试岗：联通检查脚本、四路图片样例和测试说明。

三位服务提供方启动后，将服务地址交给对应接收方。把 192.168.1.x 替换为服务电脑的实际 IPv4，只在比赛的专用局域网使用。
'@
Set-Content -LiteralPath (Join-Path $outRoot '交接说明.md') -Value $summary -Encoding UTF8 -Force
$stageFull=[IO.Path]::GetFullPath($stage)
$outFull=[IO.Path]::GetFullPath($outRoot)
if(-not $stageFull.StartsWith($outFull+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Stage path escaped output directory'}
Remove-Item -LiteralPath $stageFull -Recurse -Force
Get-ChildItem -LiteralPath $outRoot -File | Select-Object Name,Length
