# 第八课：WebSocket与实时状态

## 本节学习路线

### 这是什么

WebSocket是Spring Boot和管理端、大屏、鸿蒙工位屏之间的持续连接，用于主动推送状态变化和报警。

### 为什么要学

界面不能靠每秒轮询所有数据才能知道报警。WebSocket让后端在确认状态变化后立即通知相关页面。

### 它在项目中的位置

MQTT设备消息 → Spring Boot处理和保存 → WebSocket推送 → 管理端、大屏、鸿蒙屏。WebSocket不代替HTTP查询，也不代替MQTT设备通信。

### 需要的软件

- Chrome或Edge：Network→WS。
- Spring Boot：现有Java WebSocket端点。
- WebSocket测试客户端：独立验证服务端。
- Vue前端：验证页面事件处理。
- 鸿蒙模拟器：第13课验证。

### 最小例子

打开管理端或大屏，查看WebSocket连接和ping/pong。再从后端发送一个固定alarm.created事件，页面新增一条报警。

### 项目实操顺序

1. 固定websocket-events.md。
2. 实现HTTP完整快照接口。
3. 页面首次进入先获取快照。
4. 建立WebSocket。
5. 处理alarm.created、device.state.changed和command.status.changed。
6. 用eventId去重、version拒绝旧消息。
7. 测试后端停止、页面断线和自动重连。
8. 重连后重新获取快照。
9. 对高频传感器消息做聚合和限流。

### WebSocket调试怎么做

在Network→WS观察握手是否成功、连接地址、ping、pong、业务Frames和关闭原因。前端事件处理器打断点，查看原始文本、JSON对象、type、version和页面状态。

### 常见错误怎么查

- 握手失败：查8088、上下文路径和端点路径。
- 连接成功没有数据：查后端是否按正确groupId推送。
- 页面重复报警：查监听是否注册多次和eventId去重。
- 断线恢复旧状态：重连后没有重新获取快照。
- 页面卡顿：每条数据都重绘图表或数组无限增长。
- 鸿蒙不能连接：不要使用鸿蒙设备的localhost，改服务器局域网IP。

### 如何与下一节连接

第9课管理端订阅设备和报警事件；第10课大屏订阅流程和统计事件；第13课鸿蒙订阅命令ACK和工位报警。

### 通过门禁

快照、事件、心跳、断线重连、重复事件、旧版本和高频数据测试全部通过，才能进入三个界面开发。

## 学习目标

- 理解HTTP轮询与WebSocket推送的区别。
- 掌握连接、消息、错误、关闭、心跳和重连。
- 统一管理端、大屏和鸿蒙端的实时事件格式。
- 处理首次快照、断线恢复、重复、乱序和高频数据。
- 明确WebSocket不代替HTTP和MQTT。

## 三种通信职责

```text
MQTT：设备与Spring Boot之间通信
HTTP：界面查询或提交业务操作
WebSocket：Spring Boot向三个界面实时推送
```

## 为什么需要WebSocket

HTTP轮询：

```text
页面每秒问：浓度是多少？
后端重复回答
```

WebSocket：

```text
建立持续连接
后端在数据变化或报警时主动通知页面
```

完整链路：

```text
气体传感器发布12.5 ppm
→ MQTT Broker
→ Spring Boot校验并判断超限
→ MySQL保存数据和报警
→ WebSocket推送报警
→ 管理端、大屏、鸿蒙屏更新
```

WebSocket推送后端确认后的状态，不直接转发未经处理的设备原始消息。

## 当前项目WebSocket

### 管理端

```text
ws://localhost:8088/hdc/api/plc/{groupId}
```

后端：`CommonWebSocketService.java`

### 数字大屏

```text
ws://127.0.0.1:8088/hdc/api/dataScreen/{groupId}
```

后端：`DataScreenWebSocketService.java`

### 已有能力

- 建立连接。
- 按`groupId`分组。
- 同一分组多个页面同时连接。
- `ping/pong`心跳。
- 推送PLC和大屏数据。
- 部分断线检查。

## 连接生命周期

```text
CONNECTING → OPEN → CLOSING → CLOSED
```

浏览器`readyState`：

- 0：正在连接。
- 1：已连接。
- 2：正在关闭。
- 3：已关闭。

常用事件：

```javascript
socket.onopen = () => {}
socket.onmessage = event => {}
socket.onerror = error => {}
socket.onclose = event => {}
```

连接未打开时不能直接`send()`。

## 统一实时消息格式

```json
{
  "eventId": "WS-20260719-0001",
  "type": "alarm.created",
  "lineId": "LINE-01",
  "stationId": "GAS_CHECK-01",
  "timestamp": "2026-07-19T11:00:00+08:00",
  "version": 105,
  "data": {
    "alarmId": "ALM-0012",
    "deviceId": "GAS-01",
    "level": "CRITICAL",
    "metric": "VOC",
    "value": 12.5,
    "threshold": 10,
    "unit": "ppm"
  }
}
```

事件类型建议：

```text
device.state.changed
sensor.telemetry.updated
alarm.created
alarm.resolved
bottle.process.changed
inspection.completed
command.status.changed
agv.task.changed
inventory.changed
ai.decision.created
```

不要使用难以理解的`type: 1`、`type: 2`。

## 三类界面接收内容

### 管理端

- 全部设备状态。
- 报警产生和处理。
- 工艺参数变化。
- 生产批次、物流和仓储变化。
- AI决策记录。

### 数字大屏

- 总体产量和良品率。
- 各工位状态。
- 实时曲线采样。
- AGV和仓储概况。
- 重要报警。

### 鸿蒙工位屏

- 本工位设备状态。
- 当前瓶子或批次。
- 允许操作。
- 命令执行进度。
- 本工位报警。

水洗工位屏不应收到整个仓库的每一条库存变化。

## 快照与事件

首次打开：

```text
HTTP查询完整快照
→ 建立WebSocket
→ 接收后续变化事件
```

- Snapshot：完整当前状态。
- Event：某一项变化。
- 现有大屏也可以在WebSocket打开时由后端推送全量数据。
- 断线重连后必须重新加载快照。

## 心跳

当前前端每20秒发送`ping`，后端回复`pong`。

心跳证明：

```text
页面与Spring Boot的WebSocket连接正常
```

心跳不能证明：

```text
传感器、机械臂或AGV在线
```

设备在线由MQTT心跳判断。

## 断线重连

递增重连间隔：

```text
1秒 → 2秒 → 4秒 → 8秒 → 最大30秒
```

重连成功后：

1. 重新验证身份。
2. 重新加入对应产线或工位。
3. HTTP查询完整快照。
4. 恢复实时事件。
5. 清除“数据可能过期”提示。

页面显示：

```text
实时连接正常
正在重连
连接已断开，数据可能过期
最后更新时间
```

## 重复与乱序

消息携带：

```text
eventId
timestamp
version
```

页面可忽略旧版本：

```javascript
if (message.version <= currentVersion) {
  return
}
```

- 后端也要按`eventId`去重。
- WebSocket不是永久消息仓库。
- 离线期间缺失的数据从MySQL重新查询。

## 控制操作不用WebSocket发送

新鸿蒙控制流程：

```text
HTTP提交控制请求
→ 后端返回commandId
→ MQTT控制设备
→ WebSocket推送命令进度
```

HTTP更适合：

- 登录和权限。
- 参数校验。
- 操作审计。
- 幂等控制。
- 明确受理响应。

WebSocket主要负责推送，不能绕过业务后端控制设备。

## 高频数据限流

```text
后端接收高频原始数据
→ 按1秒或2秒聚合
→ 推送最新、最小、最大和平均值
```

- 图片和视频不直接塞入WebSocket JSON。
- 视觉服务保存图片，推送URL和识别结果。

## 鸿蒙端连接

```text
ws://服务器IP:8088/hdc/api/station/WASH-01
```

示例：

```json
{
  "type": "command.status.changed",
  "stationId": "WASH-01",
  "data": {
    "commandId": "CMD-0012",
    "status": "SUCCESS",
    "message": "水洗完成"
  }
}
```

鸿蒙应用需要处理：

- 前台恢复后重连。
- 网络恢复后重连。
- 退出时关闭连接。
- 重连后重新查询工位快照。

## 安全

- 当前连接主要按路径`groupId`区分，正式改造要增加身份验证。
- 验证用户是否有权查看产线。
- 验证工位屏是否绑定当前工位。
- 生产环境HTTPS对应使用`wss://`。
- 防止HTTPS页面连接不安全的`ws://`。

## 实操作业

- 在浏览器`Network → WS`找到现有连接。
- 查看`ping`、`pong`和业务消息。
- 模拟气体变化并由后端推送。
- 让管理端和大屏同时更新。
- 停止后端观察断线状态。
- 重启后端验证重连和快照恢复。
- 设计鸿蒙水洗工位消息类型。
- 测试重复、乱序和连接中断。
- 关闭页面后验证连接被清理。

## 验收问题

### 问题

页面断线一分钟后重新连接，能否只等待下一条WebSocket消息继续显示？

### 答案

不能。断线期间可能错过状态和报警，必须重新查询完整快照，再继续接收事件。

## 具体实操：让三个界面实时收到一次报警

### 步骤1：确认现有连接地址

管理端：

```text
ws://localhost:8088/hdc/api/plc/{groupId}
```

数字大屏：

```text
ws://127.0.0.1:8088/hdc/api/dataScreen/{groupId}
```

先打开管理端和大屏的Network→WS，记录实际连接地址和握手状态码。

### 步骤2：检查心跳

在WS消息中找到：

```text
ping
pong
```

如果只有握手没有`pong`：

1. 检查后端`@OnMessage`。
2. 检查浏览器是否真的发送ping。
3. 检查页面是否在初始化后注册心跳定时器。

### 步骤3：准备一个统一报警JSON

不要先让页面接收不同格式，先固定：

```json
{
  "eventId": "WS-TEST-001",
  "type": "alarm.created",
  "lineId": "LINE-01",
  "stationId": "GAS-01",
  "timestamp": "2026-07-19T11:00:00+08:00",
  "version": 1,
  "data": {
    "alarmId": "ALM-TEST-001",
    "level": "CRITICAL",
    "message": "VOC浓度超限",
    "value": 12.5,
    "threshold": 10,
    "unit": "ppm"
  }
}
```

### 步骤4：从后端触发推送

在Spring Boot中找到现有：

```text
CommonWebSocketService.sentMessageByGroupId(...)
DataScreenWebSocketService.sentMessageByGroupId(...)
```

不要直接从Controller推送。先在Service中写一个测试方法：

```java
public void pushTestAlarm(Long groupId) {
    String message = "{...}";
    CommonWebSocketService.sentMessageByGroupId(groupId, message);
    DataScreenWebSocketService.sentMessageByGroupId(groupId, message);
}
```

正式代码中把JSON使用对象序列化生成，不要长期手写字符串。

### 步骤5：页面处理消息

管理端页面中：

```javascript
created() {
  window.addEventListener('onmessageWS', this.handleWS)
},
beforeDestroy() {
  window.removeEventListener('onmessageWS', this.handleWS)
},
methods: {
  handleWS(event) {
    const message = JSON.parse(event.detail.data)
    if (message.type === 'alarm.created') {
      this.alarmList.unshift(message.data)
    }
  }
}
```

大屏同样处理，但只更新报警数量、工位颜色和报警列表。

### 步骤6：做一次端到端验证

1. 启动MySQL、MQTT、后端、管理端和大屏。
2. 打开两个浏览器页面。
3. 在两个页面的WS面板确认连接OPEN。
4. 调用测试报警接口或触发模拟气体超限。
5. 检查管理端报警列表。
6. 检查大屏工位颜色和报警数量。
7. 检查后端日志中的推送次数。

### 步骤7：测试快照恢复

1. 记下当前报警和设备状态。
2. 停止后端一分钟。
3. 在此期间改变模拟传感器值。
4. 重启后端。
5. 页面重连后必须先查询快照。
6. 检查页面显示最新状态，而不是停机前旧状态。

### 步骤8：测试重复和旧版本

先发送`version=2`，再发送`version=1`，页面应保留版本2；同一`eventId`发送两次，不能增加两条报警。

### 步骤9：测试高频数据限流

- 模拟器每100毫秒发送一条气体数据。
- 后端可以全部接收，但页面每秒最多更新一次图表。
- 前端数组只保留最近60个点。
- 打开浏览器Performance，确认页面没有持续增长的任务和内存。

### 本课完成标志

- 管理端和大屏同时收到一次后端报警。
- 页面能显示连接断开和重连。
- 重连后能恢复最新快照。
- 旧版本和重复事件不会覆盖或重复显示。
- 高频设备数据不会让页面持续卡顿。
