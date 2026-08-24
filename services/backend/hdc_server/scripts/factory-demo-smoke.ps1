param(
  [string]$BaseUrl = 'http://127.0.0.1:8088/hdc/api',
  [string]$WsUrl = 'ws://127.0.0.1:8088/hdc/api/dataScreen/1',
  [string]$Username = 'admin',
  [string]$Password = 'admin123'
)

$ErrorActionPreference = 'Stop'

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )
  $uri = "$BaseUrl$Path"
  $params = @{
    Method = $Method
    Uri = $uri
    Headers = $Headers
    ContentType = 'application/json;charset=UTF-8'
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 20)
  }
  Invoke-RestMethod @params
}

function Test-WebSocket {
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $socket.ConnectAsync([Uri]$WsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  $bytes = [Text.Encoding]::UTF8.GetBytes('ping')
  $sendSegment = [ArraySegment[byte]]::new($bytes)
  $socket.SendAsync($sendSegment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true,
    [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  $buffer = New-Object byte[] 4096
  $receiveSegment = [ArraySegment[byte]]::new($buffer)
  $result = $socket.ReceiveAsync($receiveSegment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $initialMessage = [Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
  Invoke-Json POST '/factory/runtime/telemetry' @{
    stageCode = 'GAS_INSPECTION'
    deviceCode = 'GAS-VERIFY-01'
    state = 'RUNNING'
    source = 'MQTT'
    speedMps = 0.1
    progress = 0.25
  } | Out-Null
  $message = $null
  $deadline = [DateTime]::UtcNow.AddSeconds(5)
  while ([DateTime]::UtcNow -lt $deadline -and [string]::IsNullOrWhiteSpace($message)) {
    $receiveCts = [Threading.CancellationTokenSource]::new(1000)
    try {
      $eventResult = $socket.ReceiveAsync($receiveSegment, $receiveCts.Token).GetAwaiter().GetResult()
      $candidate = [Text.Encoding]::UTF8.GetString($buffer, 0, $eventResult.Count)
      try {
        $candidateJson = $candidate | ConvertFrom-Json
        if ($null -ne $candidateJson.eventId -and $null -ne $candidateJson.stateVersion -and $null -ne $candidateJson.lineId) {
          $message = $candidate
        }
      } catch { }
    } catch [System.OperationCanceledException] { }
    finally { $receiveCts.Dispose() }
  }
  $socket.CloseOutputAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'smoke done',
    [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  if ([string]::IsNullOrWhiteSpace($message)) {
    throw "WebSocket connected but no unified event was received; initial=$initialMessage"
  }
  $message
}

function Ensure-DemoGroup {
  $cities = Invoke-Json GET '/city/listCity'
  $city = $cities.data | Select-Object -First 1
  if ($null -eq $city) {
    $city = Invoke-Json POST '/city/create' @{
      name = 'DemoCity'
      useFlag = 1
      orders = 1
    }
    $cities = Invoke-Json GET '/city/listCity'
    $city = $cities.data | Select-Object -First 1
  }
  if ($null -eq $city) {
    throw 'no city was available for websocket smoke'
  }

  $page = Invoke-Json GET '/group/page?currentPage=1&pageSize=20'
  $current = @($page.data.records | Where-Object { $_.useFlag -eq $true } | Select-Object -First 1)
  if ($current.Count -gt 0) {
    return $current[0]
  }

  $begin = (Get-Date).AddHours(-1).ToString('yyyy-MM-dd HH:mm:ss')
  $end = (Get-Date).AddHours(23).ToString('yyyy-MM-dd HH:mm:ss')
  Invoke-Json POST '/group/create' @{
    name = 'Factory Demo Group'
    beginTime = $begin
    endTime = $end
    useFlag = $true
    cityId = $city.id
    cityName = $city.name
  } | Out-Null

  $page = Invoke-Json GET '/group/page?currentPage=1&pageSize=20'
  $current = @($page.data.records | Select-Object -First 1)
  if ($current.Count -eq 0) {
    throw 'demo group could not be created'
  }
  return $current[0]
}

Write-Host "HTTP snapshot: $BaseUrl/factory/runtime"
$runtime = Invoke-Json GET '/factory/runtime'
if ($runtime.success -ne $true -and $runtime.code -ne 0 -and $runtime.code -ne 1) {
  throw 'factory runtime snapshot failed'
}

$group = Ensure-DemoGroup
$groupId = $group.id
$baseUri = [Uri]$BaseUrl
$WsUrl = "ws://$($baseUri.Host):$($baseUri.Port)/hdc/api/dataScreen/$groupId"

Write-Host "WebSocket ping: $WsUrl"
$wsMessage = Test-WebSocket
Write-Host "WebSocket first message: $wsMessage"
try { $wsJson = $wsMessage | ConvertFrom-Json } catch { throw 'WebSocket message is not valid JSON' }

Write-Host 'External telemetry smoke'
$reading = Invoke-Json POST '/operations/sensors/readings' @{
  deviceCode = 'GAS-VERIFY-01'
  sensorType = 'VOC'
  stage = 'GAS_INSPECTION'
  traceCode = 'BOT-SMOKE-001'
  value = 6.2
  unit = 'ppm'
  quality = 'GOOD'
  mode = 'SIMULATION'
}
if ($reading.data.sensorType -ne 'VOC') {
  throw 'sensor telemetry smoke failed'
}

Write-Host 'Login and command acceptance smoke'
$login = Invoke-Json POST '/auth/login' @{ username = $Username; password = $Password }
$token = $login.data.token
if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'login did not return a token'
}
$headers = @{ Authorization = "Bearer $token" }
$command = Invoke-Json POST '/operations/commands' @{
  clientRequestId = "SMOKE-$([Guid]::NewGuid().ToString('N'))"
  deviceCode = 'FIL-PUMP-01'
  commandType = 'SET_PUMP_SPEED'
  source = 'OPERATOR'
  operator = $Username
  operatorRole = 'OPERATOR'
  reason = 'factory-demo simulation command acknowledgement'
  traceCode = 'BOT-SMOKE-001'
  timeoutSeconds = 30
  payload = @{
    value = 60
  }
} $headers
if ($command.data.status -ne 'ACKNOWLEDGED') {
  throw "simulation command was not acknowledged: $($command.data.status)"
}
if ([string]::IsNullOrWhiteSpace([string]$command.data.edgeAckId) -or
    $command.data.message -notlike 'Simulation adapter*') {
  throw 'simulation command did not return an adapter acknowledgement'
}

Write-Host 'Contract snapshot smoke'
$topology = Invoke-Json GET '/factory/topology'
if ($topology.success -ne $true -or $topology.data.stages.Count -ne 9) {
  throw 'topology contract smoke failed'
}
if (($topology.data.stages[0].upstream -ne $null) -or
    ($topology.data.stages[0].downstream -ne 'GAS_INSPECTION') -or
    ($topology.data.stages[1].upstream -ne 'PRETREATMENT')) {
  throw 'topology stage links are inconsistent'
}
$line = Invoke-Json GET '/factory/line-snapshot'
$stage = Invoke-Json GET '/factory/stages/FILLING/snapshot'
if ($line.success -ne $true -or $stage.success -ne $true) {
  throw 'contract snapshot smoke failed'
}
if ($stage.data.devices.Count -eq 0 -or $stage.data.products.Count -eq 0) {
  throw 'stage snapshot did not contain device and product runtime data'
}
if ([string]::IsNullOrWhiteSpace([string]$stage.data.stateVersion)) {
  throw 'stage snapshot stateVersion is missing'
}
$capability = Invoke-Json GET '/devices/FIL-PUMP-01/capabilities'
if ($capability.data.capabilityVersion -ne 'capability-2026.1') {
  throw 'device capability contract smoke failed'
}

Write-Host 'factory-demo smoke passed'
