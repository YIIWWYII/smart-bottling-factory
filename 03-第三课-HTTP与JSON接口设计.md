# 第三课：HTTP、JSON与接口设计

## 本节学习路线

### 这是什么

HTTP是前端、鸿蒙端、AI服务访问Spring Boot的请求方式，JSON是这些模块之间传递结构化数据的格式。

### 为什么要学

三个界面和两个Python服务必须调用同一套接口。如果字段、单位、错误码和命令状态不一致，后面不可能形成闭环。

### 它在项目中的位置

HTTP连接界面、AI、视觉和Spring Boot。它不直接连接设备；设备通信在第7课使用MQTT，实时推送在第8课使用WebSocket。

### 需要的软件

- 浏览器开发者工具：抓管理端真实请求。
- Knife4j：查看和调用后端接口。
- PowerShell或Postman：脱离页面单独测试接口。
- VS Code：维护http-api.md。

### 最小例子

抓取现有changeLampsState请求，记录URL、方法、请求JSON和响应JSON，再用PowerShell重复调用。如果页面请求和PowerShell结果一致，说明接口基本理解正确。

### 项目实操顺序

1. 从现有页面抓一个真实请求。
2. 在后端找到Controller、Service和Mapper。
3. 写统一响应格式。
4. 定义气体查询接口。
5. 定义工位状态接口。
6. 定义控制命令接口。
7. 为每个接口写成功、空参数、离线、越界、重复五类测试。
8. 将字段类型、单位和枚举写入协议文件。

### 如何调试

- 404：按前端基础地址、上下文路径、Controller路径、方法路径逐段拼接。
- 400：检查JSON字段名和类型。
- 401/403：检查令牌和权限。
- 500：复制请求到PowerShell，脱离页面看后端日志。
- code=0但设备没动作：这是后端受理，还没有MQTT ACK。

### 如何与下一节连接

第4课根据接口中的字段建立数据库；第5课实现接口；第9课和第13课分别让Vue和鸿蒙调用同一接口；第15课让AI调用受控后端工具。

### 通过门禁

同一个查询接口必须能被PowerShell、Vue和后续鸿蒙端使用；控制接口必须明确区分PENDING和设备最终SUCCESS。

## 学习目标

- 理解请求与响应。
- 看懂URL、方法、请求头、请求体和状态码。
- 理解JSON类型和统一响应格式。
- 区分控制请求“已受理”和设备“已执行”。
- 设计管理端、鸿蒙端和AI共同使用的接口表。

## 接口是什么

- 接口是Spring Boot对外开放的办事窗口。
- 客户端可以是Vue、鸿蒙应用、Python AI服务或接口测试工具。
- 客户端通过HTTP提交请求，后端处理后返回响应。
- 鸿蒙屏不能直接修改数据库或控制继电器，只能调用后端接口。

## HTTP请求组成

```http
POST /hdc/api/web/changeLampsState HTTP/1.1
Host: localhost:8088
Content-Type: application/json
Authorization: 用户令牌

{
  "groupId": 1,
  "action": 1,
  "index": 3
}
```

- `POST`：请求方法。
- `/hdc/api/web/changeLampsState`：接口路径。
- `localhost:8088`：后端地址与端口。
- `Content-Type`：请求数据格式。
- `Authorization`：登录身份。
- JSON正文：业务参数。

## 当前项目真实请求

前端基础地址：

```javascript
export const URL = 'http://localhost:8088/hdc'
```

页面调用：

```javascript
Service({
  url: '/api/web/changeLampsState',
  data: {
    groupId: Local.getId(),
    action: pAction,
    index: pIndex
  }
})
```

真实地址：

```text
http://localhost:8088/hdc/api/web/changeLampsState
```

后端映射：

```java
@RestController
@RequestMapping("/web")
public class WebController {
    @PostMapping("changeLampsState")
    public Result changeLampsState(
            @RequestBody WebChangeLampsStateRequestDto request) {
        return Result.success();
    }
}
```

注解含义：

- `@RestController`：这是HTTP接口类。
- `@RequestMapping`：Controller公共路径。
- `@PostMapping`：接收POST请求。
- `@RequestBody`：把JSON转换为Java DTO。
- `Result`：统一响应结构。

## 常见HTTP方法

- `GET`：查询，例如查询气体状态。
- `POST`：创建或执行动作，例如创建批次、启动水洗。
- `PUT`：修改，例如修改瓶型工艺参数。
- `DELETE`：删除，例如删除未使用的设备配置。

新接口示例：

```text
GET    /hdc/api/devices/GAS-01/status
POST   /hdc/api/production-batches
POST   /hdc/api/station-commands
PUT    /hdc/api/bottle-types/PLA-500/parameters
DELETE /hdc/api/devices/GAS-01
```

现有项目许多查询使用POST，不必立即重写旧接口；新接口逐步规范。

## JSON数据类型

```json
{
  "deviceId": "GAS-01",
  "concentration": 6.2,
  "online": true,
  "alarm": null,
  "gasTypes": ["VOC", "CO"],
  "position": {
    "stationId": "PRETREATMENT-01",
    "area": "SEALED_ZONE"
  }
}
```

- 字符串：`"GAS-01"`。
- 数字：`6.2`。
- 布尔值：`true`。
- 空值：`null`。
- 数组：`[]`。
- 对象：`{}`。

错误示例：

```json
{
  "concentration": "6.2",
  "online": "true"
}
```

不要把数字和布尔值写成字符串，否则比较和计算容易出错。

## 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deviceId": "GAS-01",
    "online": true
  }
}
```

- `code`：业务是否成功。
- `message`：说明或错误原因。
- `data`：真正业务数据。

当前Axios拦截器在`code`为0时直接返回`data`。浏览器响应中有外层结构，但页面`.then(res => {})`中的`res`通常只是`data`。

## HTTP状态码与业务码

### HTTP状态码

- `200`：HTTP请求已处理。
- `400`：参数格式错误。
- `401`：未登录。
- `403`：无权限。
- `404`：接口不存在。
- `409`：当前业务状态不允许操作。
- `500`：后端程序异常。

### 业务错误

```json
{
  "code": 1,
  "message": "气体检测未通过，禁止启动灌装",
  "data": null
}
```

现有项目常用HTTP 200加业务错误码。新模块可以逐步规范，但调用双方必须约定一致。

## 查询与控制的区别

### 查询接口

- 收到成功响应时，查询已经结束。
- 例如查询设备状态，响应就是当前结果。

### 控制接口

- HTTP成功只表示后端接受请求。
- 设备是否执行，要等待MQTT ACK。
- 最终状态通过WebSocket推送。

控制受理响应：

```json
{
  "code": 0,
  "message": "控制命令已受理",
  "data": {
    "commandId": "CMD-20260718-0012",
    "status": "PENDING",
    "acceptedAt": "2026-07-18T10:30:00+08:00"
  }
}
```

工位屏需要区分：

```text
正在发送
已受理
设备执行中
执行成功
执行失败
执行超时
后端拒绝
```

## 工位控制接口设计

请求：

```http
POST /hdc/api/station-commands
```

```json
{
  "stationId": "WASH-01",
  "deviceId": "PUMP-01",
  "action": "START",
  "parameters": {
    "durationSeconds": 15
  }
}
```

后端检查：

- 用户是否有控制权限。
- 工位模式是否允许控制。
- 设备是否在线、有无故障。
- 瓶子是否到达该工位。
- 前置工序是否完成。
- 参数是否在安全范围。
- 是否有相同活动命令。
- 是否存在阻止操作的安全报警。

操作员身份由后端根据令牌获取，不能信任客户端提交的姓名。

## 接口文档必须记录

- 接口名称。
- 方法和路径。
- 调用方与权限。
- 请求字段与必填字段。
- 字段类型和单位。
- 成功响应。
- 参数错误、设备离线、工序不允许等失败响应。
- 是否产生MQTT命令。
- 是否需要WebSocket反馈。
- 超时和幂等要求。

接口文档是四个人共同遵守的合同，不是后端个人笔记。

## 调试方法

### 浏览器Network

1. 点击页面按钮。
2. 找到对应请求。
3. 查看Request URL与方法。
4. 查看Request Payload。
5. 查看HTTP状态码。
6. 查看Response业务码和消息。

### Knife4j

后端启动后尝试访问：

```text
http://localhost:8088/hdc/api/doc.html
```

- 可直接查看和调用接口。
- 当前本地配置启用了默认账号验证。
- 正式联网前必须更换默认凭据。

## 实操作业

- 在管理端操作一次PLC开关。
- 找到`changeLampsState`请求。
- 写出完整URL、方法、请求JSON和响应JSON。
- 找到对应Controller方法。
- 使用接口文档独立调用一次。
- 设计“查询气体状态”接口。
- 设计“启动水洗”控制接口。
- 写出参数错误、设备离线和工序不允许三种响应。

## 验收问题

### 问题

鸿蒙屏收到`code: 0`后，为什么不能立即显示“设备运行成功”？

### 答案

它只表示后端受理了请求。必须等待设备通过MQTT返回携带相同`commandId`的执行确认，再由后端通过WebSocket推送最终结果。

## 具体实操：从现有接口学会设计新接口

### 步骤1：抓取现有接口

1. 启动后端和管理端。
2. 打开管理端，按`F12`进入Network。
3. 进入PLC控制页面。
4. 点击一个开关。
5. 找到`changeLampsState`请求。
6. 记录以下内容：

```text
Request URL
Request Method
Request Headers
Request Payload
Response
```

### 步骤2：还原请求JSON

把Network中的Request Payload抄到培训作业中：

```json
{
  "groupId": 1,
  "action": 1,
  "index": 3
}
```

再回答：

- 哪个字段代表设备或分组？
- 哪个字段代表动作？
- 哪个字段有取值范围？
- 后端在哪里校验这些字段？

### 步骤3：使用Knife4j重复调用

打开：

```text
http://localhost:8088/hdc/api/doc.html
```

执行：

1. 登录Knife4j。
2. 搜索`changeLampsState`。
3. 点击接口进入详情。
4. 填入`groupId=1`、`action=1`、`index=3`。
5. 点击执行。
6. 对照页面请求和Knife4j请求是否相同。

### 步骤4：用PowerShell调用查询接口

示例：

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri 'http://localhost:8088/hdc/api/device/plc?groupId=1'
```

如果接口需要POST JSON：

```powershell
$body = @{ groupId = 1 } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:8088/hdc/api/web/lamps' `
  -ContentType 'application/json' `
  -Body $body
```

### 步骤5：设计气体状态接口

先写接口合同，不写代码：

```text
名称：查询气体传感器当前状态
方法：GET
路径：/hdc/api/stations/GAS-01/sensors/gas
调用方：管理端、大屏、鸿蒙屏
成功：当前值、阈值、单位、等级、采集时间
失败：设备不存在、设备离线
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deviceCode": "GAS-01",
    "metric": "VOC",
    "value": 6.2,
    "threshold": 10.0,
    "unit": "ppm",
    "level": "NORMAL",
    "collectedAt": "2026-07-19T10:30:00+08:00"
  }
}
```

### 步骤6：设计启动水洗接口

请求：

```json
{
  "stationCode": "WASH-01",
  "deviceCode": "PUMP-01",
  "action": "START",
  "parameters": {
    "durationSeconds": 15
  }
}
```

至少写出四种结果：

```text
参数正确：PENDING
设备离线：REJECTED
气体未通过：REJECTED
参数超范围：REJECTED
```

### 步骤7：用错误数据验证接口设计

依次提交：

```json
{}
```

```json
{
  "stationCode": "UNKNOWN",
  "deviceCode": "PUMP-01",
  "action": "START"
}
```

```json
{
  "stationCode": "WASH-01",
  "deviceCode": "PUMP-01",
  "action": "START",
  "parameters": { "durationSeconds": 9999 }
}
```

每次记录HTTP状态、业务码、message和后端日志。

### 步骤8：完成接口表

用Markdown表格记录：

```text
接口 | 方法 | 调用方 | 请求字段 | 成功响应 | 失败情况 | 是否MQTT | 是否WebSocket
```

第9课管理端、第13课鸿蒙端、第15课AI都必须使用这张表，不能各自重新定义字段。

### 本课完成标志

- 能从浏览器抓出一个真实请求。
- 能用PowerShell或Knife4j重复调用。
- 能设计一个查询接口和一个控制接口。
- 能写出空参数、离线、越界和成功四种响应。

## 保姆式执行清单：先做接口合同，再写页面

### 第1步：建立接口文档位置

在项目根目录新建：

```text
接口协议
├─ http-api.md
├─ mqtt-topics.md
├─ websocket-events.md
└─ enums.md
```

四个人只修改对应模块的草稿，最终由负责人合并到正式协议。接口路径、字段名、单位和枚举一旦进入正式协议，不允许随意改名。

### 第2步：先抓一个现有接口

不要从网上抄接口写法。启动现有系统后：

1. 管理端打开PLC页面。
2. `F12 → Network`。
3. 点击一个开关。
4. 点击请求的Headers、Payload、Response。
5. 将四项内容抄到`http-api.md`。
6. 在后端搜索路径最后一段，确认Controller。

最终必须形成：

```text
前端文件 → Service.js → URL → Controller → Service → Mapper → 表
```

### 第3步：统一新接口响应

新接口一律记录：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

同时记录失败样例：

```json
{
  "code": -1,
  "message": "气体检测未通过，禁止灌装",
  "data": null
}
```

前端、鸿蒙端和AI服务在写代码前先对照该文件，禁止每个人自定义一套`success`字段。

### 第4步：定义最小接口集合

先只设计闭环必需接口：

```text
GET  /stations/{stationCode}/snapshot
POST /station-commands
POST /device-events
POST /vision/inspection-results
POST /ai/decisions
GET  /data-screen/overview
POST /alarms/{alarmId}/ack
```

每个接口填写：调用方、请求体、响应体、错误、超时、是否写库、是否MQTT、是否WebSocket。

### 第5步：定义控制接口的状态语义

HTTP返回：

```text
PENDING = 后端已接收并保存
```

MQTT发送后：

```text
SENT = 后端已将命令发布到Broker
```

设备反馈：

```text
ACKED、EXECUTING、SUCCESS、FAILED、TIMEOUT
```

把这些语义写到接口文档中，避免页面把`PENDING`误显示为成功。

### 第6步：用三种客户端调用同一个接口

同一个查询接口必须分别用：

1. PowerShell调用。
2. Vue管理端调用。
3. 鸿蒙端调用。

三次请求的路径、字段和返回结构必须一致。若需要为某端特殊处理，优先在客户端适配，不要复制成三套后端接口。

### 第7步：为每个字段定义类型和单位

```text
gasValue：number，单位ppm
temperature：number，单位℃
humidity：number，单位%
durationSeconds：integer，范围1～60
deviceOnline：boolean
commandId：string
```

禁止同一个字段在一个端是字符串、另一个端是数字。禁止把单位写在数值字符串中，例如`"6.2ppm"`。

### 第8步：接口错误测试

每个接口至少测试：

```text
缺字段
空字符串
类型错误
范围越界
编号不存在
设备离线
当前状态不允许
重复请求
服务超时
```

记录实际响应，并把最终约定写回`http-api.md`。

### 第9步：接口变更规则

需要改字段时：

1. 先在协议文件写变更原因。
2. 标出旧字段和新字段。
3. 后端先兼容旧字段或同步修改所有调用方。
4. 完成调用链测试后再提交。
5. 版本号增加，例如`api-v1.1`。

### 第10步：完成第三课门禁

```text
[ ] http-api.md完成最小闭环接口
[ ] 字段类型、单位和枚举统一
[ ] 查询和控制的状态语义明确
[ ] PowerShell、Vue、鸿蒙至少各调用一次
[ ] 错误和重复请求测试完成
[ ] 接口变更规则写入文档
```
