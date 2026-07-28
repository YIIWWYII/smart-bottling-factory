# 六个对话执行派发词

数字展板、小屏、后台和后端已有工作区，必须先从 GitHub 拉取各自远程分支再增量补救；AI 中枢是新增独立服务。不要 reset 或覆盖未提交代码。

## 1. 数字展板

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-display 和 codex/display 增量补救。先 git fetch origin、git pull --ff-only origin codex/display；若工作区不干净，先保护现有改动，禁止 reset/覆盖。读取 GitHub PR #4 最新 contracts、docs/ai-prompts/01-digital-display.md、DEVELOPMENT_STANDARD.md 和 TESTING_TOOLCHAIN.md。新增原生 ArkUI 上下文 AI 助手：支持自由问询、选中文字/工位/KPI/报警/产品以及 Three.js 设备物料后问 AI；发送统一 AssistantContext，实时回答显示数据时间和 stateVersion，知识回答显示引用。展板保持只读，助手不得控制设备。调用 $deveco-cli，测试后提交推送 codex/display。
```

## 2. 小屏终端

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-terminal 和 codex/terminal 增量补救。先 git fetch/pull 对应远程分支并保护未提交改动。读取 GitHub PR #4 最新 contracts 和 docs/ai-prompts/02-workstation-terminal.md。新增当前工位上下文助手，支持自由问询和选中文字、传感器、参数卡片、报警、在制品、Three.js 设备物料后问 AI。助手只解释和建议，不能把“调到120”转成命令；正式控制仍走控制区、人工锁、二次确认、后端安全门和 ACK。调用 $deveco-cli，测试后提交推送 codex/terminal。
```

## 3. 后台管理

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-admin 和 codex/admin 增量补救。先 git fetch/pull 对应远程分支并保护未提交改动。读取 GitHub PR #4 最新 contracts 和 docs/ai-prompts/03-admin-console.md。新增全局上下文助手，支持自由问询和选中表格行、审计、配置、报警、设备、产品、知识资料后问 AI；按 RBAC 限制范围。知识资料的上传、审核、拒绝、撤销和索引进度放后台，但调用独立 AI 中枢，不写生产后端数据库。保留完整 AI 决策审计。调用 $deveco-cli，测试后提交推送 codex/admin。
```

## 4. Spring Boot 生产后端

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-backend 和 codex/backend 增量补救。先 git fetch/pull 对应远程分支并保护未提交改动。读取 GitHub PR #4 最新 contracts 和 docs/ai-prompts/04-backend.md。把视觉、模型、RAG、MCP 编排、问答、文档切分和向量库移出后端；旧 /operations/ai/decide 只做迁移兼容。后端只提供经鉴权的生产事实工具、接收视觉结构化结果、接收字段级命令意图，并执行人工锁、版本、范围、原子组、联锁、下发和 ACK。运行 mvn test 与冒烟后提交推送 codex/backend。
```

## 5. 独立 AI 中枢

```text
从 GitHub 最新 main + PR #4 架构规范创建 D:\HarmonyOS-Dev\Workspaces\bottling-ai-center、分支 codex/ai-center，唯一写入 services/ai-center。读取 docs/ai-prompts/05-ai-center.md 和全部 contracts。实现统一 AI 中枢：视觉识别、隐式字段级决策、三端上下文问答、RAG/知识治理、MCP/生产工具。支持自由问询和选中文字/实体问询；实时问题查生产后端并标时间，非实时问题走 RAG 并标引用。不得直连生产 MySQL 或设备 MQTT，只能向生产后端提交命令意图。所有依赖、模型、缓存和数据放 D 盘。测试后提交推送 codex/ai-center。
```

## 6. 融合评审

```text
等待 display、terminal、admin、backend、ai-center 五个分支提交推送后，读取 GitHub PR #4 最新 docs/ai-prompts/06-integration-review.md 和 contracts。从最新 main 创建/更新 integration/full-system，按后端、AI 中枢、展板、小屏、后台顺序逐个评审合并。验证视觉到决策到命令 ACK、人工锁阻止 AI、三端自由/选中问询、实时与 RAG 引用、问答绝不触发命令、知识审核前不可检索及撤销停用。P0 不完整退回对应对话。
```
