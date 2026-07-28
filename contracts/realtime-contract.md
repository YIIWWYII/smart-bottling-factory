# WebSocket 实时契约

## 边界

- 生产实时通道：`ws://<backend-host>:8088/hdc/api/dataScreen/{groupId}`；AI 助手/决策通道由 AI 中枢提供 `ws://<ai-host>:8091/api/ws/{clientId}`。
- WebSocket 用于主动通知和关键事件；HTTP 用于首屏快照、断线补偿、详情和所有有副作用的控制。
- MQTT 是硬件/边缘层与生产后端之间的设备消息载体，三个鸿蒙前端和 AI 中枢不直接冒充边缘控制器发布设备命令。

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

产线状态事件使用 `lineId/stageCode/stateVersion`。问答和知识审核不属于产线快照，改用 `aggregateType`、`aggregateId`、`aggregateVersion`，例如会话 ID 或提交审核 ID；不得伪造无意义的 `lineId`。

知识提交事件示例：

```json
{
  "eventId": "evt-knowledge-0001",
  "type": "knowledge.submission.changed",
  "aggregateType": "KNOWLEDGE_SUBMISSION",
  "aggregateId": "KS-20260727-0001",
  "aggregateVersion": 4,
  "occurredAt": "2026-07-27T15:30:00+08:00",
  "schemaVersion": 1,
  "payload": {
    "status": "PENDING_REVIEW",
    "statusReason": "后台正在审核资料准确性",
    "reviewId": "KR-20260727-0001"
  }
}
```

问答流式事件使用相同聚合信封，其中 `aggregateType` 为 `AI_CONVERSATION`、`aggregateId` 为会话 ID；每个增量必须带单调递增的 `aggregateVersion`，客户端断线后通过 HTTP 获取完整消息，不依赖重放全部增量。

| 类型 | 消费端 | 处理 |
| --- | --- | --- |
| `factory.stage.changed` | 三前端、AI 工具 | 刷新产品、工位和决策上下文 |
| `factory.runtime.changed` | 三前端、AI 工具 | 更新设备、速度、进度、参数版本和缓冲 |
| `operations.sensor.recorded` | 三前端、AI 工具 | 更新读数和质量门 |
| `operations.alarm.changed` | 三前端、AI 工具 | 更新颜色、报警和联锁 |
| `operations.command.changed` | 终端、管理、AI 中枢 | 更新人工/AI 命令最终结果 |
| `parameter.override.changed` | 终端、管理、AI 中枢 | 更新字段所有权、人工锁和 AI 跳过原因 |
| `product.changed` | 三前端、AI 工具 | 更新产品位置、瓶型、状态、质量和追踪链 |
| `quality.gate.changed` | 三前端、AI 工具 | 更新质量门判定、依据和规则版本 |
| `production.order.changed` | 展板、终端、管理 | 更新工单、批次、计划和实际进度 |
| `logistics.changed` | 展板、终端、管理 | 更新 AGV 运力、任务、速度和避障 |
| `warehouse.changed` | 展板、终端、管理 | 更新仓区安全、库位和箱级库存 |
| `config.recipe.changed` | 终端、管理、AI 工具；展板摘要 | 更新批准配方、参数来源和版本 |
| `config.threshold.changed` | 三前端、AI 工具 | 只读刷新安全阈值版本和相关质量门 |
| `simulation.changed` | 三前端、AI 工具 | 更新中央模拟场景、时钟、运行状态和来源 |
| `ai.vision.changed` | 三前端按范围 | 更新瓶型、缺陷、置信度和视觉证据摘要 |
| `ai.decision.changed` | 三前端按范围 | 更新 RAG、实时校验、字段补丁、人工锁和执行状态 |
| `ai.conversation.delta` | 发起问询的前端 | 流式回答片段、实时数据时间、引用和完成/失败状态 |
| `knowledge.submission.changed` | 管理 | 更新处理、待审核、批准或拒绝状态 |
| `knowledge.index.changed` | 管理 | 更新正式入库、向量化、索引或撤销状态 |

## 客户端规则

1. 页面先 HTTP 拉完整快照，再连 WebSocket。
2. 事件按 `eventId` 去重；乱序按版本号或时间取新值。
3. 断线退避重连并显示状态；重连后立即 HTTP 全量刷新。
4. 暂停动画只冻结画面；恢复直接跳到当前实时状态，不回放积压动画。
5. Three.js 2D/3D 使用同一份快照。速度、进度、设备状态、产品位置和颜色不得各自随机生成。
6. 产线事件至少携带 `lineId` 和 `stateVersion`，工位事件还要携带 `stageCode`；问答/知识事件携带聚合 ID 和聚合版本。客户端只应用比当前版本新的事件。
7. 同一业务变化可以触发多个主题，但后端必须使用稳定 `eventId`/关联号，客户端不得重复累计 KPI。
8. 生产事件由 Spring Boot 发布，AI 事件由 AI 中枢发布；二者通过 `correlationId/decisionId/commandId` 关联，不混用数据库或伪造对方状态。
