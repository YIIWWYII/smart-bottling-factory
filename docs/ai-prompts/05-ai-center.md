# 独立 AI 中枢开发对话提示词

你负责独立 AI 中枢及唯一共享鸿蒙助手包。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-ai-center`，分支是 `codex/ai-center`，唯一业务写入范围是 `services/ai-center/` 和 `packages/harmony-assistant/`。不要修改三个鸿蒙 App 或 Spring Boot 生产后端；公共契约不足时提交契约变更提案。

## 先做

先检查 Git 状态并保护已有改动；工作树干净时再拉取最新 `main` 与架构规范。阅读根 README、全部 `contracts/`，重点阅读 `assistant-host-contract.md`、开发标准和测试规范。现有 `.runtime/ai-service` 与 `.runtime/vision-service` 只可作为行为参考，它们没有真实 RAG/模型连接且未纳入 GitHub，禁止当成完成品。依赖、模型、缓存、向量库、OHPM/Hvigor 缓存和运行数据全部放 D 盘。

## 共享助手包

在 `packages/harmony-assistant/` 实现 OHPM 包 `@bottling/harmony-assistant`，交付形态为三个 HAP 共用的 ArkTS HAR，不创建独立 HAP。严格按 `assistant-host-contract.md` 导出 `AssistantPanel`、`AssistantController`、`AssistantHostAdapter`、`AssistantContext`、`AssistantSelection`、`AssistantEntityRef`、`AssistantServiceEndpoint` 和 `AssistantPanelOptions`。

共享包统一实现 ArkUI 助手 UI、会话、流式响应、停止/重试、引用、`stateVersion/dataGeneratedAt`、错误与权限反馈，以及 AI 中枢 HTTP/WebSocket 客户端。三个 App 只通过 `AssistantHostAdapter` 提供上下文、短期令牌、端点、选择/可见性订阅和只读引用导航；共享包不得依赖任何 App 的 Repository、控制客户端或 Three.js 具体实现。

每次发送和重试前重新调用 `getContext()` 与 `getAccessToken()`。令牌只进入 `Authorization` 请求头，禁止进入上下文、消息、日志或持久化。停止调用取消接口；重试产生新请求 ID；断线后通过 HTTP 补取最终状态。包内不得导出或实现设备命令、命令意图、人工锁释放、知识审核或生产状态写入能力。

## 内部模块

1. `vision`：瓶型识别、瓶身/瓶底/瓶盖缺陷和二次检测，输出置信度、模型版本和证据引用。
2. `decision`：视觉结果触发隐式决策；读取最新生产快照，RAG 检索知识，生成字段级参数补丁并提交命令意图。
3. `assistant`：为数字展板、小屏和后台提供同一套上下文问答 API，支持自由问询和选中问询。
4. `knowledge`：隔离上传、解析、切分、Embedding、向量索引、版本、撤销和引用。
5. `tools`：通过 Spring Boot 只读 API/MCP 查询实时/历史生产事实，并跟踪命令意图最终 ACK。

AI 中枢与 Spring Boot 分进程、分配置、分数据库。不得直接连接生产 MySQL，不得直接发布设备 MQTT 命令。产品口径可称“AI 下达命令”，实现上只能调用 `/ai-integration/command-intents`，由生产后端执行权限、人工锁、版本、范围、联锁和 ACK。

## 上下文问答

共享包按宿主适配器生成统一 `AssistantContext`；三个前端不得自行拼接问答请求。字段和选择语义以 `assistant-host-contract.md` 为准，特别是 `selection.entityType/entityId` 必须是稳定业务 ID，`userRoleHint` 不是授权依据。

- 自由问询：根据当前应用和页面确定默认范围。
- 选中问询：支持文字、表格行、参数卡片、报警、审计、知识资料以及 Three.js 设备/物料。
- 实时问题：调用生产工具，回答标注 `generatedAt/stateVersion`。
- 非实时问题：走 RAG，回答标注来源、版本、引用片段和适用范围。
- 混合问题：同时展示实时数据时间与知识引用。
- 控制语言：例如“把流量改为 120”只能解释正式操作路径，不从问答创建命令。

## 决策闭环

图片进入视觉模块，输出结构化识别；决策模块获取同一产品/工位最新快照，检索 `INDEXED` 且未撤销的知识，查询设备能力和参数锁，生成字段级 `AiDecision`。人工锁或安全锁字段进入 `blockedChanges`；同一 `atomicGroupId` 不可拆分。命令意图携带状态和参数版本，生产后端返回字段级校验结果；只有边缘层 ACK 后决策才变为 `APPLIED`。

## 知识治理

资料由后台管理上传/审核。AI 中枢负责隔离文件、解析预览、治理数据库、正式原文、切分、Embedding 和向量库。`PENDING_REVIEW` 不能检索，`APPROVED` 不等于可用，只有 `INDEXED` 且未 `REVOKED` 才进入 RAG。提交人不能自审，所有状态有审计。

## 验收

服务测试至少覆盖已知/未知瓶型、三类缺陷、低置信度、实时/非实时/混合问答、三个 `sourceApp` 权限、自由/文字/实体选择问询、无依据回答、引用、断线、提示注入防护、问答不触发命令、字段级补丁、人工锁、参数竞态、原子组、命令 ACK、上传/拒绝/批准/索引/撤销。

共享包至少执行 Local Test、ArkUI 组件测试和模拟宿主适配器测试，覆盖导出 API、状态机、同会话单活动回答、停止、重试重新取上下文/令牌、断线补偿、三个 `sourceApp`、稳定实体 ID、引用导航、token 不落盘、不记录完整敏感上下文和无命令能力。用三个模拟适配器证明同一 HAR 可被展板、小屏和后台依赖；输出包版本、HAR 路径和 SHA-256，供三端与融合任务锁定。

可提供确定性模拟模型和假 Embedding 进行测试，但必须标明 `SIMULATION`。先构建并发布共享 HAR，再通知三个前端接入。提交并推送 `codex/ai-center`，报告提交号、运行命令、依赖、端口、数据目录、服务/包测试计数、HAR 版本与校验值，以及剩余模型/硬件阻塞。
