# 生产快照与 AI 上下文契约

数字展板工位详情、小屏当前环节、后台运营监控和 AI 中枢决策工具必须读取同一个 Spring Boot 生产事实模型。允许各端排版不同，不允许字段含义和计算口径不同。

## 整线快照

`LineSnapshot` 至少包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lineId`、`lineName` | string | 产线稳定标识和名称 |
| `stateVersion` | long | 后端单调递增版本，用于乱序事件和补拉 |
| `generatedAt` | ISO-8601 | 快照生成时间 |
| `dataMode` | enum | `MQTT`、`SIMULATION` 或 `MIXED` |
| `stages` | StageSummary[] | 九工序状态、WIP、缓冲、设备和报警摘要 |
| `production` | object | 工单、计划/实际、完成、剔除、HOLD、通过率 |
| `logistics` | object | AGV 运力、任务、运输中、冲突和平均时效 |
| `warehouse` | object | 库存箱、库位占用、仓区安全和开放报警 |
| `activeIncidents` | Incident[] | 开放异常及影响范围 |
| `recentProducts` | ProductRuntime[] | 最近产品追踪摘要 |

## 工位快照

`StageSnapshot` 是三前端和 AI 中枢关联同一产线事实的核心，至少包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lineId`、`stageCode`、`stageName` | string | 所属产线和工位 |
| `state`、`stateReason` | enum/string | 工位状态及原因 |
| `stateVersion`、`generatedAt` | long/time | 版本和时间 |
| `dataMode` | enum | 本站实机、模拟或混合来源 |
| `workOrder` | object? | 当前工单、批次、产品目标和计划量 |
| `devices` | DeviceRuntime[] | 本站设备、动作、状态、参数和遥测 |
| `products` | ProductRuntime[] | 本站在制品及画面位置 |
| `qualityGates` | QualityGate[] | 标准、实际值、结果、来源和规则版本 |
| `buffer` | object | 输入/输出占用、容量和阻塞原因 |
| `incidents`、`alarms` | array | 本站异常、报警和上下游影响 |
| `activeRecipe` | object? | 配方/参数模板、版本、来源和应用状态 |
| `aiDecision` | object? | 决策 ID、建议摘要、知识版本、校验、人工锁和执行状态 |
| `upstream`、`downstream` | StageLink[] | 相邻工位状态和物料流向 |
| `capabilityVersion` | string | 小屏控制能力版本 |

## 动画数据

`DeviceRuntime` 除基础字段外必须提供：

- `actionCode`：例如 `CONVEYING`、`WASHING`、`SCANNING`、`FILLING`、`REJECTING`、`PICKING`、`MOVING`。
- `cycleProgressPct`：0-100 周期进度；无周期设备可为空。
- `speed`、`speedUnit`：真实或中央模拟速度及单位。
- `parameters`：当前有效运行参数；每个字段包含值、单位、`ownerSource`、`lockMode` 和 `parameterVersion`。
- `source`、`fallback`、`lastSeenAt`：数据来源和新鲜度。

`ProductRuntime` 必须提供：

- `traceCode`、瓶型、工单、批次、状态和质量摘要。
- `stageCode`、`laneCode`、`stageProgressPct`：产品在工位内的归一化位置。
- `speed`、`speedUnit`、`animationState`：画面运动依据。
- `enteredStageAt`、`updatedAt`：时间依据。

2D 与 3D 只负责把上述字段映射为不同视觉表现。严禁各自使用随机计时器生成不同位置。无精确位置传感器时，由后端中央模拟/估算器产生带 `estimated=true` 的统一位置。

## 一致性规则

1. 三前端与 AI 中枢在相同 `stateVersion` 下，相同设备、产品、参数所有权和人工锁状态必须一致。
2. WebSocket 只通知增量变化；客户端发现版本跳跃时重新 GET 快照。
3. 前端 KPI 只做展示格式化，统计口径由后端返回。
4. 质量门最终结果、异常影响、AI 校验和参数可修改性由后端返回，前端不得分别重算。
5. `LOCAL DEMO` 只能用于单 App 离线展示；跨端联调和 AI 实时问答必须使用后端中央 `SIMULATION`，否则无法保证一致。

## 助手上下文

三个前端通过共享包调用 AI 助手时发送统一 `AssistantContext`，字段和适配器签名以 `assistant-host-contract.md` 为准，至少包含：

- `sourceApp`：`DISPLAY`、`WORKSTATION`、`ADMIN`。
- `pageRoute`、`lineId`、可选 `stageCode/deviceCode/traceCode`。
- `stateVersion`、`dataGeneratedAt` 和可选 `AssistantSelection`。
- `userRoleHint` 只作显示提示。短期令牌由 `getAccessToken()` 提供，只能进入 `Authorization` 请求头，绝不能进入上下文或消息正文；AI 中枢必须再次校验身份和实体范围。

选中问询可来自 ArkUI 文字、列表行、参数卡片，也可由 Three.js 通过 JS Bridge 上报设备或物料稳定 ID。若 `stateVersion` 已过期，AI 中枢先通过生产后端获取最新快照，再回答并标注实际数据时间和版本。
