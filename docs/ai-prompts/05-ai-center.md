# 独立 AI 中枢开发对话提示词

你负责独立 AI 中枢。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-ai-center`，分支是 `codex/ai-center`，唯一业务写入范围是 `services/ai-center`。不要修改三个鸿蒙 App 或 Spring Boot 生产后端；公共契约不足时提交契约变更提案。

## 先做

从 GitHub 拉取最新 `main` 与架构规范，确认分支/工作区干净。阅读根 README、全部 `contracts/`、开发标准和测试规范。现有 `.runtime/ai-service` 与 `.runtime/vision-service` 只可作为行为参考，它们没有真实 RAG/模型连接且未纳入 GitHub，禁止当成完成品。依赖、模型、缓存、向量库和运行数据全部放 D 盘。

## 内部模块

1. `vision`：瓶型识别、瓶身/瓶底/瓶盖缺陷和二次检测，输出置信度、模型版本和证据引用。
2. `decision`：视觉结果触发隐式决策；读取最新生产快照，RAG 检索知识，生成字段级参数补丁并提交命令意图。
3. `assistant`：为数字展板、小屏和后台提供同一套上下文问答 API，支持自由问询和选中问询。
4. `knowledge`：隔离上传、解析、切分、Embedding、向量索引、版本、撤销和引用。
5. `tools`：通过 Spring Boot 只读 API/MCP 查询实时/历史生产事实，并跟踪命令意图最终 ACK。

AI 中枢与 Spring Boot 分进程、分配置、分数据库。不得直接连接生产 MySQL，不得直接发布设备 MQTT 命令。产品口径可称“AI 下达命令”，实现上只能调用 `/ai-integration/command-intents`，由生产后端执行权限、人工锁、版本、范围、联锁和 ACK。

## 上下文问答

三个前端发送统一 `AssistantContext`：`sourceApp/pageRoute/lineId/stageCode/deviceCode/traceCode/stateVersion/selectedEntityType/selectedEntityId/selectedText/userRole`。

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

至少覆盖已知/未知瓶型、三类缺陷、低置信度、实时/非实时/混合问答、三个 `sourceApp` 权限、自由/文字/实体选择问询、无依据回答、引用、断线、提示注入防护、问答不触发命令、字段级补丁、人工锁、参数竞态、原子组、命令 ACK、上传/拒绝/批准/索引/撤销。可提供确定性模拟模型和假 Embedding 进行测试，但必须标明 `SIMULATION`。提交并推送 `codex/ai-center`，报告运行命令、依赖、端口、数据目录、测试计数和剩余模型/硬件阻塞。
