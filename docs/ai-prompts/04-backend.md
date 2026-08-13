# Spring Boot 生产后端补救开发对话提示词

你负责 Spring Boot 生产后端。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-backend`，分支是 `codex/backend`，唯一业务写入范围是 `services/backend/hdc_server`。不要修改三个鸿蒙 App 或 `services/ai-center`。后端不使用 ArkTS，也不使用 `devecocli` 构建。

## 当前阶段

后端已经完成一轮开发且可能存在未提交修改。先 `git fetch origin`、`git pull --ff-only origin codex/backend`，再审计现有 Controller、Service、持久化、实时发布、数据库脚本和测试。保护已有代码与数据；禁止硬重置、覆盖工作树或用内存实现替换已有持久化。

阅读 GitHub 最新架构分支的 README、全部 `contracts/`、开发标准、测试规范和后端 README。使用 Maven/JUnit/Spring Boot Test；HTTP/WebSocket 冒烟使用可复现脚本。依赖缓存和运行文件留在 D 盘，不提交密码、令牌或生产地址。

## 生产后端职责

1. 接收 MQTT/外部 HTTP 遥测，规范化设备、传感器、AI 中枢提交的视觉结构化结果、AGV 和仓区安全数据。
2. 维护九工序连续流水、产品追踪、质量门、缓冲、设备、异常、命令、物流和仓储。
3. 实机优先；按设备超时后才降级模拟并标记来源，恢复后平滑切回。
4. MySQL 持久化生产事实；Redis 仅做缓存、会话、幂等和协调。
5. 设备命令执行 RBAC、参数范围、在线状态、质量/安全联锁、幂等、超时和 ACK。
6. 异常支持剔除、局停、返工、缓冲和人工处置，不默认整线停机。
7. 提供统一 `LineSnapshot/StageSnapshot/stateVersion` 和 WebSocket 生产事件。
8. 为 AI 中枢提供经鉴权的快照、能力、参数所有权、阈值、追踪、报警、命令和历史审计只读接口。
9. 接收 AI 中枢字段级命令意图，维护 `MANUAL_HOLD/SAFETY_LOCK`、参数版本和原子组；只下发后端最终允许的字段。
10. 接收 AI 视觉模块的瓶型、缺陷、置信度、模型版本和证据引用并纳入追踪链。
11. 为 `AI_SERVICE` 提供独立权限、令牌校验、限流、幂等和审计。

## 明确不属于后端

Spring Boot 不实现视觉推理、模型调用、提示词、RAG、MCP 编排、AI 会话、文档解析/切分、Embedding、知识治理数据库或向量库。旧 `/operations/ai/decide` 只做迁移兼容并标记废弃，不继续添加 AI 逻辑。AI 问答不能通过后端偷偷转换成命令。

## 补救顺序

1. 对照功能矩阵确认三个前端和 AI 中枢都有真实数据源或命令接收端。
2. 兼容现有接口，再补快照、能力、参数锁、工单、规则、审计、报表和中央模拟接口。
3. 统一快照版本，三前端和 AI 工具不得从不同随机源得到位置、速度、锁和 KPI。
4. 统一生产事件信封；AI 事件由 AI 中枢发布，通过关联号连接，不在后端伪造。
5. 补 AI 集成接口：令牌校验、只读工具、视觉结果、字段级命令意图和命令状态查询。
6. 先补失败测试再修实现，不强制 Docker/Testcontainers。

## 验收与交付

运行 `mvn test` 和 `factory-demo` 冒烟。至少覆盖持久化重启、模拟/MQTT 切换、AI 服务鉴权、视觉结构化结果、只读工具权限、字段级命令意图、人工锁、参数版本竞态、原子组、幂等、超时、ACK、快照和 WebSocket。提交并推送 `codex/backend`，报告提交号、数据库迁移、接口变化、测试计数、失败证据、风险和契约提案，不推 `main`。
