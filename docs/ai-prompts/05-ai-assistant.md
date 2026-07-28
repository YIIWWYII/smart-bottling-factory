# AI 协同端开发对话提示词

你负责新增鸿蒙 AI 协同端。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-ai-assistant`，分支是 `codex/ai-assistant`，唯一业务写入范围是 `apps/ai-assistant/BottlingFactoryAI`。不要修改数字展板、小屏、后台管理或后端；公共契约不足时只提交契约变更提案。

## 当前阶段

这是一个新工程，不是把后台管理或小屏复制一份。先阅读根 README、全部 `contracts/`、`DEVELOPMENT_STANDARD.md` 和 `TESTING_TOOLCHAIN.md`，确认 Git 分支和工作区干净，再参考另外三个鸿蒙工程的 SDK/API/签名配置创建独立 Empty Ability 工程。bundleName 固定为 `com.factory.bottling.aiassistant`。

必须调用 `$deveco-cli`，会话可见时优先使用官方 `deveco-cli` MCP。SDK、缓存、构建和日志都留在 D 盘；遇到 ArkTS/ArkWeb/构建问题按“本地开发日志、CLI 本地文档、华为官方文档”顺序处理。只有 Test Runner、模拟器或 Web 调试必须操作界面时才调用 `$computer-use:computer-use`。

## 目标定位

该应用是 AI 与用户之间的协同界面，负责四类事情：

1. 展示瓶型识别、当前数据、RAG 引用、数据库校验、字段级参数建议、人工覆盖、后端命令和设备回执。
2. 用户围绕产线、设备、工艺和异常进行多轮问答，并看到来源引用和知识版本。
3. 有权限的用户上传资料，填写来源、版本和适用范围，跟踪后台审核与索引状态。
4. 通知用户资料正在后台审核准确性；审核员需前往后台管理端处理，本应用自身不提供批准按钮。

它不是设备控制终端、不是后台审核端，也不是聊天套壳。启动后必须登录，导航至少包含“决策动态、AI 问答、资料提交、消息/我的”。

## 决策动态

首页显示当前决策及最近历史：识别瓶型与置信度、关联产品/工位/设备、上下文 `stateVersion`、知识版本、数据库校验状态、建议字段数量、人工锁定数量和最终状态。

决策详情严格按 `ai-decision-contract.md` 展示：

- 每个参数显示旧值、建议值、单位、原因、置信度和原子组。
- 人工修改字段显示锁定人、时间、原因和“AI 已跳过”，不能出现强制覆盖按钮。
- 明确区分 `PROPOSED`、`COMMAND_PENDING` 和 `APPLIED`；只有边缘回执后才显示已执行。
- 版本过期显示 `STALE`，不继续播放旧决策已经生效的假动画。

如需要展示设备、物料或参数流动动画，只能通过 ArkWeb `Web` 加载 HAP `rawfile` 中的本地 Three.js。问答、表单、列表和资料页必须使用原生 ArkUI。不得加载 CDN 或把 3D 装饰当作决策证据。

## AI 问答

- 使用 HTTP 创建会话/消息，WebSocket 接收 `ai.conversation.delta` 流式片段、引用和最终状态。
- 每个回答显示来源标题、版本、引用片段和适用范围；依据不足时明确提示。
- 支持历史会话、停止生成、失败重试、复制和来源详情。
- 用户输入“把流量改为 120”等控制语言时，只回答说明并提示应通过受控决策/小屏操作；绝不创建命令或显示执行成功。
- 后端不可达时不伪造 AI 回答；本地演示只能使用明确标识的静态只读样例。

## 资料提交

按 `knowledge-governance-contract.md` 实现：

1. 选择文件并填写标题、来源、发布方、日期、版本、适用瓶型/设备/工位和说明。
2. 上传前显示文件类型、大小和权限校验；上传后展示审核单号。
3. 状态支持 `PROCESSING/PENDING_REVIEW/APPROVED/INGESTING/INDEXED/REJECTED/FAILED/REVOKED`。
4. `PENDING_REVIEW` 固定显示“后台正在审核资料准确性”；`REJECTED` 显示审核意见；只有 `INDEXED` 才提示已进入知识库。
5. 本应用不允许审核自己的资料，也不直接连接 MySQL、向量库、对象存储或 AI 服务，全部通过 Spring Boot 后端。

## 禁止

- 不直接连接 MQTT、MySQL、向量库、RAG 服务或模型供应商。
- 不下发设备命令，不提供参数编辑、人工锁释放、知识批准或用户管理。
- 不把待审核资料用于本地问答，不伪造审核或索引成功。
- 不复制数字展板全局总览、小屏现场控制或后台管理导航。

## 验收与交付

按 `DEVELOPMENT_STANDARD.md` 和 `TESTING_TOOLCHAIN.md` 完成 P0。至少测试登录/过期、决策完整时间线、人工锁字段、问答引用/失败/控制语言、上传到审核/拒绝/索引全过程、无权限、断线和空数据。

使用 D 盘英文构建目录：

```powershell
& "D:\Codex\.codex\skills\deveco-cli\scripts\build-harmony.ps1" `
  -SourceProject "D:\HarmonyOS-Dev\Workspaces\bottling-ai-assistant\apps\ai-assistant\BottlingFactoryAI" `
  -BuildProject "D:\HarmonyOS-Dev\Build\BottlingFactoryAI" -Modules entry -BuildMode debug
```

要求 `BUILD SUCCESSFUL`、HAP 生成、模拟器运行、原生页面和可选 Three.js 动画验证通过。提交并推送 `codex/ai-assistant`，报告提交号、测试命令与计数、截图/日志、后端接口阻塞和契约提案，不推 `main`。
