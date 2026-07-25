param(
  [string]$BaseUrl = 'http://127.0.0.1:8088/hdc/api',
  [string]$WsUrl = 'ws://127.0.0.1:8088/hdc/api/dataScreen/1',
  [string]$Username = 'admin',
  [string]$Password = 'Admin@123456'
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
  $socket.ConnectAsync([Uri]$WsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $bytes = [Text.Encoding]::UTF8.GetBytes('ping')
  $sendSegment = [ArraySegment[byte]]::new($bytes)
  $socket.SendAsync($sendSegment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true,
    [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $buffer = New-Object byte[] 4096
  $receiveSegment = [ArraySegment[byte]]::new($buffer)
  $result = $socket.ReceiveAsync($receiveSegment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $message = [Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
  $socket.CloseOutputAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'smoke done',
    [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  if ([string]::IsNullOrWhiteSpace($message)) {
    throw 'WebSocket connected but no message was received'
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
$WsUrl = "ws://127.0.0.1:8089/hdc/api/dataScreen/$groupId"

Write-Host "WebSocket ping: $WsUrl"
$wsMessage = Test-WebSocket
Write-Host "WebSocket first message: $wsMessage"

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
  deviceCode = 'LINE-CONTROL-01'
  commandType = 'SET_RECIPE'
  source = 'OPERATOR'
  operator = $Username
  operatorRole = 'OPERATOR'
  reason = 'factory-demo smoke command acceptance'
  traceCode = 'BOT-SMOKE-001'
  timeoutSeconds = 30
  payload = @{
    recipeCode = 'PLA-500-DEMO-V1'
    fillingTemperatureC = 25
    fillVolumeMl = 500
    capTorqueNm = 0.9
  }
} $headers
if ($command.data.status -ne 'PENDING') {
  throw "command was not accepted as PENDING: $($command.data.status)"
}

Write-Host 'factory-demo smoke passed'
