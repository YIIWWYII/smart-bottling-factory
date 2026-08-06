# HTTP API 契约

## 基础约定

- 生产后端基地址：`http://<backend-host>:8088/hdc/api`；AI 中枢基地址：`http://<ai-host>:8091/api`。真机和模拟器不能写 `localhost`。
- 默认编码：`application/json;charset=UTF-8`；文件上传使用 `multipart/form-data`。鉴权头：`Authorization: <token>`。
- 统一响应：`{ "code": 0, "message": "", "data": ..., "success": true }`。当前兼容成功码 0/1，融合阶段统一。
- 非 2xx、业务失败码、超时、解析失败都是真实失败，UI 不得显示“操作成功”。

## 当前核心端点

下表是当前后端已经存在或已有兼容实现的接口。前端补救时先通过 Repository/ApiClient 适配这些接口，不得把尚未实现的目标接口当作成功返回。

| 方法 | 路径 | 使用端 | 用途 |
| --- | --- | --- | --- |
| POST | `/auth/register`、`/auth/login` | 后台管理、三端助手身份 | 注册、登录 |
| GET/POST | `/auth/me`、`/auth/logout` | 后台管理、三端助手身份 | 恢复会话、退出 |
| GET/PATCH | `/auth/users[/{id}]` | 后台管理 | 用户、角色与状态 |
| GET | `/factory/dashboard` | 三前端、AI 工具 | 生产和产品追踪总览 |
| GET | `/factory/runs/{traceCode}` | 三前端、AI 工具 | 单产品完整追踪链 |
| POST | `/factory/runs`、`/factory/runs/{traceCode}/steps` | 后端/联调 | 创建和推进产品 |
| GET | `/factory/runtime` | 三前端、AI 工具 | 设备、工位、缓冲和异常快照 |
| POST | `/factory/runtime/telemetry` | 外部设备接口 | 设备运行数据进入中枢 |
| GET/POST | `/factory/runtime/incidents` | 管理、后端 | 查询或创建异常 |
| POST | `/factory/runtime/incidents/{id}/resolve` | 管理 | 按策略解决异常 |
| GET | `/operations/overview` | 三前端、AI 工具 | 读数、报警和命令结果 |
| POST | `/operations/sensors/readings` | 外部设备接口 | 传感器读数进入中枢 |
| POST | `/operations/alarms/{id}/ack` | 管理 | 报警确认 |
| POST/GET | `/operations/commands` | 终端、管理 | 创建设备命令、查询状态 |
| POST | `/operations/commands/{id}/ack` | 外部控制接口 | 边缘层回执命令 |
| POST/GET | `/operations/ai/decide`、`/operations/ai/audits` | 旧兼容接口 | 迁移到独立 AI 中枢后废弃，不再扩展 |
| GET | `/logistics/overview` | 展板、终端、管理 | AGV、仓区安全和库存 |
| POST | `/logistics/agv/tasks` | 后端/管理 | 创建物流任务 |
| POST | `/logistics/agv/tasks/{id}/telemetry` | 外部设备接口 | AGV 速度、路程、负载、避障 |
| POST | `/logistics/warehouse/zones/{code}/telemetry` | 外部设备接口 | 仓区气体、烟雾和温度 |
| POST | `/logistics/warehouse/inbound` | 后端/管理 | 箱级入库 |

## P0 目标端点

下表是五个业务工程最终对齐所需的目标契约。标记为目标不代表当前已经实现；后端对话负责逐项落地并提供迁移说明，前端在端点可用前只能显示明确的不可用/只读状态，不能伪造数据或成功。

| 方法 | 路径 | 使用端 | 用途 |
| --- | --- | --- | --- |
| GET | `/factory/topology` | 三前端、AI 工具 | 产线、九工位、设备归属和拓扑版本 |
| GET | `/factory/line-snapshot` | 三前端、AI 工具 | 唯一 `LineSnapshot` 首屏快照 |
| GET | `/factory/stages/{stageCode}/snapshot` | 三前端、AI 工具 | 唯一 `StageSnapshot` |
| GET | `/factory/stages/{stageCode}/capabilities` | 终端、管理 | 工位可用动作、权限和联锁 |
| GET | `/devices/{deviceCode}/capabilities` | 终端、管理 | 设备参数类型、范围、步长和角色 |
| GET | `/devices/{deviceCode}/parameters` | 三前端、AI 工具 | 当前参数、来源、人工锁和版本 |
| GET | `/devices/{deviceCode}/parameter-ownership` | 终端、管理、AI 工具 | 字段所有权、锁定人、原因和版本 |
| POST | `/devices/{deviceCode}/manual-overrides` | 终端、管理 | 创建字段级人工覆盖锁 |
| POST | `/devices/{deviceCode}/manual-overrides/{parameterCode}/release` | 终端、管理 | 按权限释放人工覆盖锁 |
| GET/POST | `/production/orders` | 管理；其他端只读 | 查询或创建生产任务/工单 |
| GET/PATCH | `/production/orders/{id}` | 管理 | 查看、排产、暂停、结束生产任务 |
| GET | `/quality/gates` | 三前端、AI 工具 | 质量门状态和规则版本 |
| GET/POST | `/quality/rules` | 管理 | 质量规则查询与版本化创建 |
| GET/POST | `/config/recipes` | 终端只读、管理 | 参数模板查询、创建和版本管理 |
| POST | `/config/recipes/{id}/approve` | 管理 | 审批/发布批准配方 |
| GET/POST | `/config/thresholds` | 三前端/AI 工具只读、管理写 | 安全阈值查询和版本化创建 |
| POST | `/config/thresholds/{id}/publish` | 管理 | 发布/回滚安全阈值版本 |
| GET | `/audit/operations` | 管理 | 操作、命令和配置审计检索 |
| GET | `/reports/production` | 管理 | 生产、质量、物流和仓储报表 |
| GET | `/simulation/scenarios` | 管理 | 可复现中央模拟场景 |
| POST | `/simulation/start`、`/simulation/stop`、`/simulation/reset` | 管理 | 统一控制后端模拟时钟和场景 |

## AI 中枢目标端点

以下端点由独立 AI 中枢提供，不实现到 Spring Boot 工程中。三端复用同一协议，通过 `AssistantContext.sourceApp` 和用户权限限制范围。

| 方法 | 路径 | 使用端 | 用途 |
| --- | --- | --- | --- |
| POST | `/vision/inferences` | 摄像头/边缘层 | 图片或图片引用进入视觉识别，返回瓶型、缺陷、置信度和证据 |
| GET | `/decisions` | 管理；展板/终端按范围 | 按工位、设备、产品和状态检索决策 |
| GET | `/decisions/current` | 三前端 | 当前决策摘要；按应用上下文和权限裁剪 |
| GET | `/decisions/{decisionId}` | 三前端 | 识别、RAG、实时校验、字段补丁、人工锁和回执详情 |
| POST | `/decisions/evaluate` | AI 内部/联调 | 基于视觉结果和实时上下文触发隐式决策，不由普通前端调用 |
| GET/POST | `/assistant/conversations` | 三前端 | 会话列表和新建会话，携带统一 `AssistantContext` |
| GET | `/assistant/conversations/{id}/messages` | 三前端 | 历史消息、实时数据时间、知识引用和状态 |
| POST | `/assistant/conversations/{id}/messages` | 三前端 | 自由问询或选中问询；文本不能直接触发命令 |
| POST | `/assistant/messages/{messageId}/cancel` | 共享助手包 | 停止当前生成；幂等返回 `STOPPED` 或已有最终状态 |
| POST | `/assistant/messages/{messageId}/retry` | 共享助手包 | 基于新请求 ID 和重新采集的上下文重试，不复用旧权限/版本 |
| POST | `/knowledge/submissions` | 后台管理 | `multipart/form-data` 上传文件和来源元数据，创建审核任务 |
| GET | `/knowledge/submissions[/{id}]` | 后台管理 | 处理、审核、入库和索引状态 |
| GET | `/admin/knowledge/reviews` | 管理 | 待审核队列、冲突和解析状态 |
| GET | `/admin/knowledge/reviews/{id}` | 管理 | 原文、解析预览、来源、范围和历史 |
| POST | `/admin/knowledge/reviews/{id}/approve` | 管理 | 使用 `KNOWLEDGE_REVIEW` 权限批准并生成知识版本 |
| POST | `/admin/knowledge/reviews/{id}/reject` | 管理 | 拒绝并记录审核意见 |
| POST | `/admin/knowledge/reviews/{id}/revoke` | 管理 | 撤销已发布版本并停止检索 |

## AI 与生产后端接口

| 方法 | 生产后端路径 | 调用方 | 用途 |
| --- | --- | --- | --- |
| GET | 上述快照、设备、质量、审计接口 | AI 中枢只读工具 | 回答实时问题和构造决策上下文 |
| POST | `/ai-integration/recognitions` | AI 中枢 | 提交视觉结构化结果，不上传原始图片 |
| POST | `/ai-integration/command-intents` | AI 中枢 | 提交字段级命令意图、上下文版本、参数版本和幂等号 |
| GET | `/ai-integration/commands/{id}` | AI 中枢 | 查询后端安全校验、命令状态和边缘 ACK |
| POST | `/auth/introspect` | AI 中枢 | 校验三端用户令牌和权限；生产环境也可使用共享 JWT 公钥 |

目标快照字段遵循 `shared-snapshot-contract.md`，控制权限与命令遵循 `control-security-contract.md`，AI 与资料流程分别遵循 `ai-decision-contract.md` 和 `knowledge-governance-contract.md`。AI 中枢和生产后端必须使用独立客户端、配置、数据库和部署进程；若旧组合接口暂时承载同等数据，必须记录迁移和废弃计划。

助手端点只由 `@bottling/harmony-assistant` 调用，三个宿主 App 不分别实现客户端。发送、取消和重试都携带幂等请求 ID；令牌只放 `Authorization`，`sourceApp` 和 `userRoleHint` 不能替代服务端鉴权。问答端点没有设备命令副作用。

## 写操作标准

设备控制至少包含 `deviceCode`、`commandType`、参数、来源和客户端请求号。后端完成角色鉴权、参数范围、设备在线、工序联锁、幂等和安全门校验后返回 `PENDING`；只有收到边缘层回执才显示 `ACKNOWLEDGED` 或 `FAILED`。HTTP 成功不等于设备执行成功。
