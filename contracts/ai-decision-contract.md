# AI 参数决策契约

## 业务边界

AI 决策不是“整线切型”，也不因为识别到瓶型就覆盖整套配方。它处理的是当前瓶型、当前工位和当前设备状态下，部分参数或命令不合适时的字段级修正。

- 视觉识别属于 AI 中枢，负责瓶型、缺陷、置信度和证据；图片直接进入 AI 视觉接口，不经过 Spring Boot 中转。
- AI 中枢负责视觉、RAG、实时工具查询、解释和字段级参数建议，不持有生产数据库写权限和设备直控权限。
- Spring Boot 生产后端只提供经鉴权的实时/历史事实、参数所有权和设备能力接口，并负责最终安全门、命令下发与 ACK。
- AI 中枢查询实时数据时调用生产后端只读 API/MCP 工具；不能直接持有生产 MySQL 凭据。
- 三个鸿蒙前端通过上下文助手展示和询问 AI；普通问答不直接下发设备命令。

## 完整流向

1. 摄像头或边缘设备向 AI 视觉模块提交图片/图片引用和追踪信息。
2. AI 视觉模块输出 `bottleTypeCode`、缺陷、置信度、证据引用和推理版本，并触发隐式决策流程。
3. AI 中枢通过生产后端只读接口获取同一产品/工位的 `StageSnapshot`、参数版本、遥测、质量门、报警和人工覆盖状态。
4. AI 中枢使用 RAG 查询已审核发布的知识版本，并通过工具查询设备能力、阈值和配方适用范围。
5. AI 中枢生成结构化 `AiDecision`，只包含需要变更的字段，不返回整套设备配置。
6. AI 中枢向生产后端提交带 `contextStateVersion`、`parameterVersion` 和幂等号的命令意图。
7. 生产后端按最新状态、RBAC、设备在线、联锁、人工覆盖锁和参数版本再次校验，防止评估期间数据变化。
8. 生产后端只为允许字段创建命令；被人工覆盖、越权、联锁或过期字段不下发，并返回字段级原因。
9. 命令经边缘控制层执行并回执；生产后端发布命令结果，AI 中枢关联更新决策状态，三前端按各自范围显示。

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

## 三端展示与问答

数字展板显示全局决策摘要和与当前产线/工位相关的助手回答；小屏显示本站建议、人工锁和设备解释；后台管理显示完整决策审计、知识来源、策略和高风险审批。任何端都不能把“AI 建议”“后端受理”显示成“设备执行成功”。

助手同时支持自由问询和选中问询。实时问题必须通过工具读取最新生产事实并标注 `stateVersion/generatedAt`；非实时问题使用 RAG 并显示知识版本和引用；混合问题同时给出实时数据时间与文档来源。问答文本即使包含“调整参数”也只解释或建议，不绕过隐式决策与正式命令安全门。
