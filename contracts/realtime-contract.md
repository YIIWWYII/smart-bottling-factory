# WebSocket 实时契约

## 边界

- 当前展示通道：`ws://<backend-host>:8088/hdc/api/dataScreen/{groupId}`。
- WebSocket 用于主动通知和关键事件；HTTP 用于首屏快照、断线补偿、详情和所有有副作用的控制。
- MQTT 是硬件/边缘层与后端之间的设备消息载体，三个鸿蒙前端不直接连接 MQTT。

## 统一事件信封

```json
{
  "eventId": "evt-unique-id",
  "type": "factory.stage.changed",
  "lineId": "LINE-01",
  "stageCode": "FILLING",
  "stateVersion": 1024,
  "occurredAt": "2026-07-25T12:00:00+08:00",
  "schemaVersion": 1,
  "payload": {}
}
```

当前 `factory.stage.changed` 部分字段在顶层，融合时先兼容读取，再统一到 `payload`。

| 类型 | 消费端 | 处理 |
| --- | --- | --- |
| `factory.stage.changed` | 三前端 | 刷新产品、工位和总览 |
| `factory.runtime.changed` | 三前端 | 更新设备、速度、进度和缓冲 |
| `operations.sensor.recorded` | 三前端 | 更新读数和质量门 |
| `operations.alarm.changed` | 三前端 | 更新颜色、报警和联锁 |
| `operations.command.changed` | 终端、管理 | 更新命令最终结果 |
| `product.changed` | 三前端 | 更新产品位置、状态、质量和追踪链 |
| `quality.gate.changed` | 三前端 | 更新质量门判定、依据和规则版本 |
| `production.order.changed` | 三前端 | 更新工单、批次、计划和实际进度 |
| `logistics.changed` | 三前端 | 更新 AGV 运力、任务、速度和避障 |
| `warehouse.changed` | 三前端 | 更新仓区安全、库位和箱级库存 |
| `config.recipe.changed` | 终端、管理；展板只读刷新 | 更新批准配方、参数来源和版本 |
| `config.threshold.changed` | 三前端 | 只读刷新安全阈值版本和相关质量门 |
| `simulation.changed` | 三前端 | 更新中央模拟场景、时钟、运行状态和来源 |
| `ai.decision.changed` | 三前端 | 更新建议、知识版本、校验、审批和执行状态 |

## 客户端规则

1. 页面先 HTTP 拉完整快照，再连 WebSocket。
2. 事件按 `eventId` 去重；乱序按版本号或时间取新值。
3. 断线退避重连并显示状态；重连后立即 HTTP 全量刷新。
4. 暂停动画只冻结画面；恢复直接跳到当前实时状态，不回放积压动画。
5. Three.js 2D/3D 使用同一份快照。速度、进度、设备状态、产品位置和颜色不得各自随机生成。
6. 事件至少携带 `lineId` 和 `stateVersion`；工位事件还要携带 `stageCode`。客户端只应用比当前版本新的事件。
7. 同一业务变化可以触发多个主题，但后端必须使用稳定 `eventId`/关联号，客户端不得重复累计 KPI。
