# 第七课：MQTT与设备接入

## 本节学习路线

### 这是什么

MQTT是设备和Spring Boot之间的消息通道。Broker中转消息，设备发布遥测和ACK，后端发布命令并处理回调。

### 为什么要学

传感器和AGV需要持续上报，设备命令要异步返回执行结果。HTTP不适合设备持续在线消息，MQTT可以让设备和后端解耦。

### 它在项目中的位置

设备控制器 ↔ MQTT Broker ↔ Spring Boot。MQTT只负责传输，安全判定、状态机、数据库和界面通知仍由Spring Boot负责。

### 需要的软件与安装

- 项目已有Aedes Broker，使用E盘运行目录。
- Node.js：运行设备模拟器。
- MQTTX或MQTT Explorer：查看主题和发布测试消息。
- Spring Boot：Paho客户端已在pom中。

当前本机配置是127.0.0.1:31883。真实局域网接入时改服务器IP、认证和防火墙，不能直接暴露无认证Broker。

### 最小例子

用MQTTX连接127.0.0.1:31883，订阅factory/line1/#，发布一条GAS-01遥测JSON，观察MQTTX和后端日志。先不接真实传感器。

### 项目实操顺序

1. 固定mqtt-topics.md和JSON字段。
2. 启动Aedes Broker并检查31883。
3. 启动Spring Boot，确认订阅日志。
4. 用MQTTX发布合格气体值。
5. 验证后端解析、入库和最新状态。
6. 发布超限值，验证报警和HOLD。
7. 编写Node模拟泵，订阅command。
8. 后端发布START，模拟泵打印命令。
9. 模拟泵等待后返回相同commandId的ACK。
10. 测试SUCCESS、FAILED、TIMEOUT、重复和过期。
11. 用协议不变的方式替换真实设备。

### MQTT调试怎么做

先问：消息有没有发布、Broker有没有转发、订阅方有没有处理。MQTTX看主题，Spring Boot看订阅和解析日志，MySQL看业务结果。只看到MQTTX有消息，不代表业务成功。

### 常见错误怎么查

- MQTTX连接失败：查Broker进程、端口和监听地址。
- 看不到消息：查主题拼写、客户端连接和通配符。
- 后端没有收到：查Paho订阅注册和回调。
- JSON解析失败：查字段名称、类型和编码。
- 命令重复：查保留消息、commandId幂等和重连。
- 设备收到但不动作：查真实设备协议、控制器和本地急停。

AGV超声波避障必须在小车本地执行，网络断开时也要能停车。

### 如何与下一节连接

MQTT回调把设备数据交给第6课状态机，再由第8课WebSocket推送给三个界面。第13课鸿蒙HTTP命令最终会走到本节MQTT。

### 通过门禁

模拟器完成正常、超限、心跳、命令成功、失败、超时、重复和过期八种场景，才允许接入真实设备。

## 学习目标

- 理解Broker、发布、订阅、主题和Payload。
- 设计设备遥测、状态、事件、命令和ACK主题。
- 区分MQTT发布成功与设备执行成功。
- 处理QoS、心跳、离线、重复消息和命令过期。
- 用统一协议替换模拟设备与真实设备。

## MQTT角色

- Broker：消息中转站。
- Publisher：发布消息的一方。
- Subscriber：订阅消息的一方。
- Topic：消息分类地址。
- Payload：消息中的数据，一般使用JSON。

数据流：

```text
传感器或设备控制器
→ MQTT Broker
→ Spring Boot
→ 业务处理和数据库
```

控制流：

```text
Spring Boot
→ MQTT Broker
→ 设备控制器
→ ACK返回Spring Boot
```

## 当前项目MQTT

- 本地Broker：`tcp://127.0.0.1:31883`。
- Broker使用Aedes。
- 后端使用Paho MQTT客户端。
- `MqttClientService`负责连接、订阅、发送和回调。
- `MqttHelper`保存旧主题与消息DTO。
- `AdapterPlcService`处理PLC适配和状态推送。

现有主题：

```text
device/network/online
sync/online
order/adapter/sync
order/service/sync
order/adapter/action
order/service/lamps
```

旧主题继续兼容，新设备使用统一主题规范。

## 新主题规范

```text
factory/{lineId}/{stationId}/{deviceId}/{messageType}
```

示例：

```text
factory/line1/gas/GAS-01/telemetry
factory/line1/gas/GAS-01/state
factory/line1/gas/GAS-01/heartbeat
factory/line1/wash/PUMP-01/command
factory/line1/wash/PUMP-01/ack
factory/line1/agv/AGV-01/telemetry
factory/line1/agv/AGV-01/event
```

消息类型：

- `telemetry`：设备到后端的传感器数值。
- `state`：设备当前状态。
- `event`：检测完成、到达工位等事件。
- `heartbeat`：设备在线证明。
- `command`：后端到设备的控制命令。
- `ack`：设备执行反馈。

## 传感器消息

```json
{
  "messageId": "MSG-20260719-0001",
  "deviceId": "GAS-01",
  "stationId": "GAS_CHECK-01",
  "timestamp": "2026-07-19T10:30:00+08:00",
  "sequence": 1024,
  "metrics": {
    "voc": {
      "value": 6.2,
      "unit": "ppm"
    },
    "co": {
      "value": 1.1,
      "unit": "ppm"
    }
  }
}
```

后端检查：

- `messageId`是否重复。
- `deviceId`是否存在。
- 时间是否异常。
- 数值是否为数字。
- 单位是否正确。
- 数值是否超出传感器合理范围。
- 是否超过业务安全阈值。

传感器通常由PLC、ESP32、开发板或控制器读取后组装JSON发布。

## 控制命令

```json
{
  "commandId": "CMD-20260719-0008",
  "deviceId": "PUMP-01",
  "stationId": "WASH-01",
  "action": "START",
  "parameters": {
    "durationSeconds": 15
  },
  "sentAt": "2026-07-19T10:31:00+08:00",
  "expiresAt": "2026-07-19T10:31:10+08:00"
}
```

设备ACK：

```json
{
  "commandId": "CMD-20260719-0008",
  "deviceId": "PUMP-01",
  "status": "SUCCESS",
  "completedAt": "2026-07-19T10:31:15+08:00",
  "errorCode": null,
  "message": "水洗完成"
}
```

设备必须原样返回`commandId`，后端才能匹配命令。

## 三层成功

```text
后端把消息交给Broker
Broker把消息交给设备
设备实际执行并返回ACK
```

MQTT日志“发布成功”不能证明电机已转动。只有收到相同`commandId`的`SUCCESS` ACK，才能显示设备执行成功。

## QoS

- QoS 0：尽力发送，可能丢失，适合高频普通遥测。
- QoS 1：至少送达一次，可能重复，适合控制命令、报警和ACK。
- QoS 2：协议开销最大，只在极少场景使用。

建议：

```text
普通温湿度、AGV距离：QoS 0或1
控制命令、检测结果、报警：QoS 1
```

即使QoS 2，业务层仍要用编号去重。

## 保留消息

适合保留：

- 最新在线状态。
- 当前运行模式。
- 当前工位状态。

绝不能保留：

- 启动电机。
- 机械臂夹取。
- 开始灌装。
- AGV前进。

否则设备重连可能重新执行旧命令。

控制命令必须有`expiresAt`，过期命令直接拒绝。

## 心跳与离线

```json
{
  "deviceId": "AGV-01",
  "timestamp": "2026-07-19T10:35:00+08:00",
  "state": "IDLE",
  "firmwareVersion": "1.0.0"
}
```

后端记录`lastOnlineTime`。

如果每5秒一个心跳：

- 15秒未收到：疑似离线。
- 30秒未收到：离线并报警。

不同设备可配置不同超时时间。

## AGV本地安全

AGV超声波避障必须在本地完成：

```text
发现近距离障碍
→ 本地立即停车或绕行
→ 同时MQTT上报障碍事件
```

不能把实时避障依赖后端网络往返。

后端负责：

- 分配运输任务。
- 指定目的区。
- 监控速度、距离和负载。
- 暂停或取消任务。

AGV本地负责：

- 电机控制。
- 超声波避障。
- 紧急停车。
- 短距离路线执行。

仓储火灾和气体泄漏同样需要本地报警或断电保护，平台不是唯一安全保护。

## 模拟与真实设备统一

- 模拟器和真实设备使用同一主题、JSON、状态和ACK格式。
- 替换真实设备时，后端、数据库和界面不修改。

模拟器至少支持：

- 正常数值。
- 数值超限。
- 设备离线。
- 命令成功。
- 命令失败。
- 命令超时。

## Broker安全边界

当前Aedes Broker：

- 只监听`127.0.0.1`。
- 无用户密码。
- 无TLS。
- 适合本机开发与演示。

局域网真实设备接入需要：

- 改为局域网监听。
- 账号密码与设备身份。
- 主题访问权限。
- Windows防火墙配置。
- 必要时使用TLS。
- 不能把无认证端口直接暴露互联网。

## 实操作业

- 启动MQTT Broker与Spring Boot。
- 查看连接成功和主题订阅日志。
- 发布模拟气体数据。
- 让后端解析并保存。
- 模拟气体超限并生成报警。
- 后端发布启动水洗命令。
- 模拟设备返回`SUCCESS` ACK。
- 测试重复消息、错误单位、离线和超时。
- 为摄像头、灌装机、机械臂和AGV设计主题表。

## 验收问题

### 问题

Spring Boot日志显示“MQTT消息发布成功”，鸿蒙屏能否显示“水洗设备启动成功”？

### 答案

不能。它只证明Broker接受消息，必须收到设备携带相同`commandId`的执行ACK。

## 具体实操：使用模拟设备跑通MQTT

### 步骤1：启动现有Broker

打开PowerShell：

```powershell
Set-Location 'E:\2026挑战杯\工业沙盘2026\数字展板前后端\.runtime\mqtt-broker'
node .\start-broker.js
```

看到下面日志表示成功：

```text
MQTT broker listening on 127.0.0.1:31883
```

### 步骤2：启动Spring Boot并查看订阅

启动后端，搜索日志中的：

```text
mqtt连接完成
注册TOPIC
```

如果没有订阅日志，检查`application-dev.yaml`中的：

```yaml
mqtt:
  url: tcp://127.0.0.1
  port: 31883
```

### 步骤3：准备模拟设备

在E盘准备目录：

```text
E:\bottling-device-simulator
```

使用Node.js创建一个最小模拟器。模拟器只需要做三件事：连接Broker、发布心跳和订阅命令。可以先使用项目已有MQTT依赖，或者在该目录执行：

```powershell
npm init -y
npm install mqtt
```

不要把模拟器依赖安装到C盘项目缓存；设置npm缓存时使用：

```powershell
npm config set cache E:\dev\npm-cache
```

### 步骤4：模拟气体传感器上报

向主题发布：

```text
factory/line1/gas/GAS-01/telemetry
```

Payload：

```json
{
  "messageId": "MSG-TEST-001",
  "deviceId": "GAS-01",
  "stationId": "GAS_CHECK-01",
  "timestamp": "2026-07-19T10:30:00+08:00",
  "metrics": {
    "voc": { "value": 6.2, "unit": "ppm" }
  }
}
```

检查顺序：

1. 模拟器显示publish完成。
2. Spring Boot日志出现收到主题。
3. 数据库出现传感器记录。
4. 管理端或大屏出现最新值。

### 步骤5：模拟气体超限

只把`value`改为`12.5`，`messageId`换成新编号：

```json
{ "value": 12.5, "unit": "ppm" }
```

预期：

```text
创建alarm_record
瓶子进入HOLD
大屏显示红色报警
工位屏禁止灌装
```

### 步骤6：模拟设备订阅命令

模拟器订阅：

```text
factory/line1/wash/PUMP-01/command
```

收到`START`后：

1. 读取`commandId`。
2. 打印命令内容。
3. 等待3秒模拟执行。
4. 发布ACK：

```text
factory/line1/wash/PUMP-01/ack
```

```json
{
  "commandId": "CMD-TEST-001",
  "deviceId": "PUMP-01",
  "status": "SUCCESS",
  "message": "水洗完成"
}
```

### 步骤7：测试失败和超时

#### 设备失败

ACK中的：

```json
{ "status": "FAILED", "message": "泵启动失败" }
```

预期命令状态为`FAILED`，工位进入`FAULT`。

#### 设备超时

- 模拟器收到命令后不返回ACK。
- 等待后端设定的超时时间。
- 预期命令为`TIMEOUT`，页面显示设备未响应。

### 步骤8：测试重复消息

- 连续发布两次同一个`messageId`。
- 连续发布两次同一个`commandId`的ACK。
- 检查数据库不能重复产生报警、库存或命令执行结果。

### 步骤9：测试离线

- 停止模拟器。
- 等待心跳超时。
- 检查设备状态、报警和界面显示。
- 再启动模拟器，检查设备是否恢复在线。

### 步骤10：编写设备协议表

```text
主题 | 发布方 | 订阅方 | JSON | QoS | 频率 | 是否保留
```

每个真实设备接入前，必须先填这张表并用模拟器跑通。

### 本课完成标志

- 能启动Broker并看到后端订阅。
- 能模拟遥测、超限、命令成功、失败和超时。
- 能验证ACK必须携带相同`commandId`。
- 能验证重复消息不会重复执行业务。

## 保姆式实操：不用真实硬件先完成一次 MQTT 闭环

本节先用模拟器验证主题、JSON、后端入库和界面逻辑。真实传感器接入时只替换发布端，后端协议不变。

### 第 1 步：启动项目自带 Broker

~~~powershell
Set-Location 'E:\2026挑战杯\工业沙盘2026\数字展板前后端\.runtime\mqtt-broker'
node .\start-broker.js
~~~

另开窗口验证：

~~~powershell
Test-NetConnection 127.0.0.1 -Port 31883
~~~

必须看到 TcpTestSucceeded : True。如果端口失败，先查：

~~~powershell
Get-NetTCPConnection -LocalPort 31883 -ErrorAction SilentlyContinue
~~~

### 第 2 步：使用 MQTTX 或 Node 客户端连接

MQTTX 新建连接填写：

~~~text
Host：127.0.0.1
Port：31883
Protocol：mqtt://
Username：留空
Password：留空
~~~

如果不安装 MQTTX，可以单独建立工具目录：

~~~powershell
New-Item -ItemType Directory -Force 'E:\dev\mqtt-tools' | Out-Null
Set-Location 'E:\dev\mqtt-tools'
npm init -y
npm install mqtt --cache 'E:\dev\npm-cache'
~~~

### 第 3 步：订阅和发布气体数据

订阅：

~~~text
factory/line1/gas/GAS-01/telemetry
factory/line1/gas/GAS-01/heartbeat
~~~

发布正常数据：

~~~json
{
  "messageId": "MSG-DEMO-001",
  "deviceId": "GAS-01",
  "stationId": "GAS_CHECK-01",
  "timestamp": "2026-07-19T22:00:00+08:00",
  "sequence": 1,
  "metrics": {
    "voc": {"value": 6.2, "unit": "ppm"},
    "co": {"value": 1.1, "unit": "ppm"}
  }
}
~~~

再发布 VOC 为 12.5 的超限数据。预期结果必须同时满足：状态机禁止进入下一工序、数据库有报警、管理端和大屏收到报警、鸿蒙工位屏显示异常。只改页面颜色不算闭环。

### 第 4 步：测试控制命令和 ACK

发布到：

~~~text
factory/line1/wash/PUMP-01/command
~~~

命令必须包含 commandId 和 expiresAt。模拟设备收到后向 factory/line1/wash/PUMP-01/ack 返回相同编号。只有编号匹配且 status=SUCCESS，后端才能把命令改为成功。

### 第 5 步：固定排错顺序和门禁

~~~text
没有订阅消息：查 Broker、主题、客户端连接
订阅到了但后端无日志：查后端订阅和端口 31883
后端有日志但无入库：查 JSON、Mapper、数据库连接
入库但页面不变：查 WebSocket 推送和前端事件处理
命令成功但设备不动作：查真实控制器和 ACK，不要继续改前端
~~~

正常、超限、重复 messageId、过期命令、成功 ACK、失败 ACK、无 ACK 超时和设备离线恢复全部通过后，才允许接入真实传感器。
