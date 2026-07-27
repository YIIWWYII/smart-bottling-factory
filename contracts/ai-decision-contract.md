# AI 参数决策契约

## 业务边界

AI 决策不是“整线切型”，也不因为识别到瓶型就覆盖整套配方。它处理的是当前瓶型、当前工位和当前设备状态下，部分参数或命令不合适时的字段级修正。

- 视觉模块只负责输出瓶型、置信度和识别证据，不直接修改设备。
- Spring Boot 后端负责汇总实时快照、调用 AI、执行最终数据库校验和安全门，并向边缘控制层发送命令。
- AI 负责 RAG 检索、解释和生成结构化参数建议，不持有数据库写权限和设备控制权限。
- AI 需要查询结构化数据时，通过后端提供的只读工具/API（可由 MCP 暴露）查询，不能直接持有 MySQL 凭据。
- 鸿蒙 AI 协同端只展示、问答和提交资料，不直接下发设备命令。

## 完整流向

1. 摄像头/视觉服务识别瓶型，向后端提交 `bottleTypeCode`、置信度、图像证据引用和时间。
2. 后端获取同一时刻的 `StageSnapshot`、设备参数版本、遥测、质量门、报警和人工覆盖状态。
3. 后端把瓶型、实时上下文和允许评估的参数范围发送给 AI 决策服务。
4. AI 使用 RAG 查询已审核发布的知识版本，返回来源引用、规则依据和候选参数修正。
5. AI 通过后端只读校验工具查询结构化参数、设备能力、阈值、配方适用范围和人工覆盖锁。
6. AI 返回结构化 `AiDecision`，只包含需要变更的字段，不返回整套设备配置。
7. 后端按最新 `stateVersion`、`parameterVersion`、RBAC、设备在线状态、联锁和人工覆盖锁再次校验，防止 AI 评估期间数据已变化。
8. 后端只为允许执行的字段创建命令；被人工覆盖或已过期的字段不下发，并记录原因。
9. 命令经边缘控制层执行并回执；后端把 `PENDING/SENT/ACKNOWLEDGED/FAILED/TIMEOUT` 推送给各端。

AI 返回“校验通过”不等于设备已经执行。只有后端收到边缘层 `ACKNOWLEDGED` 才能显示修改完成。

## AiDecision 最低字段

| 字段 | 说明 |
| --- | --- |
| `decisionId`、`correlationId` | 决策及全链路关联号 |
| `lineId`、`stageCode`、`deviceCode` | 作用范围 |
| `traceCode`、`bottleTypeCode` | 当前产品与识别瓶型，可为空但要说明 |
| `recognitionConfidence`、`recognitionEvidenceRef` | 视觉识别可信度与证据引用 |
| `contextStateVersion`、`parameterVersion` | AI 评估时使用的数据版本 |
| `knowledgeVersion`、`citations` | RAG 使用的已发布知识版本和引用 |
| `databaseValidationId`、`validationSummary` | 结构化数据库校验记录 |
| `proposedChanges` | 仅包含拟修改字段的数组 |
| `blockedChanges` | 被人工覆盖、联锁、权限或版本冲突阻止的字段 |
| `status`、`statusReason` | 决策状态和可读原因 |
| `commandIds` | 后端实际创建的命令；未下发时为空 |
| `createdAt`、`validatedAt`、`completedAt` | 关键时间 |

单个 `proposedChanges` 至少包含：

```json
{
  "parameterCode": "FLOW_RATE",
  "oldValue": 115,
  "proposedValue": 120,
  "unit": "ml/s",
  "reason": "当前流量低于该瓶型的已审核工艺区间",
  "confidence": 0.91,
  "atomicGroupId": "FILL_VOLUME_GROUP",
  "currentOwner": "RECIPE",
  "manualOverride": false,
  "eligibility": "ELIGIBLE"
}
```

## 决策状态

`COLLECTING_CONTEXT`、`RETRIEVING`、`VALIDATING`、`PROPOSED`、`PARTIALLY_BLOCKED`、`BLOCKED`、`APPROVAL_REQUIRED`、`COMMAND_PENDING`、`APPLIED`、`FAILED`、`STALE`。

- `PARTIALLY_BLOCKED`：部分独立字段可以执行，部分字段被阻止。
- `BLOCKED`：没有任何字段可安全执行。
- `STALE`：实时状态或参数版本已经变化，必须重新评估，不能沿用旧建议。
- 高风险参数按后端策略进入 `APPROVAL_REQUIRED`；低风险且满足策略的字段可自动创建命令。

## 人工覆盖优先

每个可调参数必须记录：

- `ownerSource`：`RECIPE`、`AI`、`MANUAL`、`SYSTEM`。
- `lockMode`：`NONE`、`MANUAL_HOLD`、`SAFETY_LOCK`。
- `lockedBy`、`lockedAt`、`lockReason`、可选 `expiresAt`。
- `parameterVersion`：每次有效修改后递增。

规则如下：

1. 人工从小屏或管理端修改参数后，默认形成 `MANUAL_HOLD`；AI 无权释放或覆盖。
2. 人工可明确设置到期时间，未设置时只有具备权限的人工操作才能释放。
3. AI 建议必须同时返回被跳过字段及说明，例如“该参数于 10:32 被张工手动锁定，AI 未修改”。
4. 后端使用乐观锁比较 `parameterVersion`。AI 评估后若人工再次修改，旧决策变为 `STALE`。
5. 同一 `atomicGroupId` 中任一字段被锁定或校验失败时，整组不得部分执行；不同原子组可独立执行。
6. `SAFETY_LOCK` 优先级最高，任何 AI 或普通人工操作都不能绕过。

## 前端展示

AI 协同端的决策详情必须依次显示：识别瓶型与置信度、实时上下文版本、知识引用、数据库校验、拟修改字段、人工锁定字段、后端安全校验、命令状态和最终回执。

数字展板只显示摘要；小屏显示本站相关建议和人工锁状态；后台管理提供完整审计、策略和高风险审批。任何端都不能把“AI 建议”“后端受理”显示成“设备执行成功”。
