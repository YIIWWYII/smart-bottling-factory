# 七个对话执行派发词

总架构先发布契约；数字展板、小屏、后台和后端在各自工作区增量补救；AI 中枢同时实现独立服务和唯一共享鸿蒙助手 HAR；融合最后汇总。任何任务先检查并保护未提交代码，禁止 reset 或覆盖已有改动。

## 1. 总架构

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-ai-architecture 和 codex/ai-architecture 维护共同契约，只修改 README.md、contracts/、docs/。审查五个开发任务字段、权限、状态机和依赖方向是否一致，先发布 assistant-host-contract.md，再让 AI 中枢实现共享包、三端实现宿主适配。不要修改 apps/、services/ 或实现业务代码。检查后提交推送 codex/ai-architecture，并把提交号通知五个开发任务和融合任务。
```

## 2. 数字展板

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-display 和 codex/display 增量补救。先检查 Git 状态并保护已有改动；工作树干净时再 fetch/pull。读取 GitHub PR #4 最新 contracts、docs/ai-prompts/01-digital-display.md、DEVELOPMENT_STANDARD.md 和 TESTING_TOOLCHAIN.md。不要自建助手 UI 或 AI 客户端；等待并依赖 codex/ai-center 发布的同一 @bottling/harmony-assistant HAR。只在展板工程实现 sourceApp=DISPLAY 的 AssistantHostAdapter、挂载点、选择映射和只读引用导航。ArkUI/Three.js 选择必须转成稳定业务 ID，禁止 Three.js uuid。不得直接调用 /assistant/**。调用 $deveco-cli，测试后提交推送 codex/display。
```

## 3. 小屏终端

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-terminal 和 codex/terminal 增量补救。先检查 Git 状态并保护已有改动；工作树干净时再 fetch/pull。读取 GitHub PR #4 最新 contracts 和 docs/ai-prompts/02-workstation-terminal.md。不要自建助手 UI 或 AI 客户端；依赖 codex/ai-center 发布的同一 @bottling/harmony-assistant HAR。只实现 sourceApp=WORKSTATION 的 AssistantHostAdapter、挂载点、稳定选择映射和本站只读引用导航。正式控制仍走控制区、人工锁、二次确认、后端安全门和 ACK，助手不能创建命令。调用 $deveco-cli，测试后提交推送 codex/terminal。
```

## 4. 后台管理

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-admin 和 codex/admin 增量补救。先检查 Git 状态并保护已有改动；工作树干净时再 fetch/pull。读取 GitHub PR #4 最新 contracts 和 docs/ai-prompts/03-admin-console.md。不要自建助手 UI 或 AI 客户端；依赖 codex/ai-center 发布的同一 @bottling/harmony-assistant HAR。只实现 sourceApp=ADMIN 的 AssistantHostAdapter、挂载点、稳定选择映射和带 RBAC 的只读引用导航。知识上传/审核仍是后台业务页面，不属于共享助手。调用 $deveco-cli，测试后提交推送 codex/admin。
```

## 5. Spring Boot 生产后端

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-backend 和 codex/backend 增量补救。先 git fetch/pull 对应远程分支并保护未提交改动。读取 GitHub PR #4 最新 contracts 和 docs/ai-prompts/04-backend.md。把视觉、模型、RAG、MCP 编排、问答、文档切分和向量库移出后端；旧 /operations/ai/decide 只做迁移兼容。后端只提供经鉴权的生产事实工具、接收视觉结构化结果、接收字段级命令意图，并执行人工锁、版本、范围、原子组、联锁、下发和 ACK。运行 mvn test 与冒烟后提交推送 codex/backend。
```

## 6. AI 中枢与共享助手包

```text
在 D:\HarmonyOS-Dev\Workspaces\bottling-ai-center 和 codex/ai-center 增量开发，唯一写入 services/ai-center/ 与 packages/harmony-assistant/。读取 PR #4 最新 assistant-host-contract.md、docs/ai-prompts/05-ai-center.md 和全部 contracts。实现统一 AI 中枢，以及唯一 @bottling/harmony-assistant ArkTS HAR；共享包导出契约规定的面板、控制器、宿主适配器和数据类型，统一负责会话、流式、停止/重试、引用、错误和权限反馈。不得修改三个 App，不得让助手创建命令。服务与共享包分别测试，先发布 HAR 版本和 SHA-256，再通知三端接入。所有依赖、模型、缓存和数据放 D 盘。测试后提交推送 codex/ai-center。
```

## 7. 融合评审

```text
等待架构和五个开发分支提交推送后，读取 GitHub PR #4 最新 docs/ai-prompts/06-integration-review.md 和 contracts。从最新 main 创建/更新 integration/full-system，按后端、AI 中枢及共享 HAR、展板、小屏、后台顺序逐个评审合并。验证三个 HAP 使用同一 @bottling/harmony-assistant 版本和 HAR SHA-256，无本地聊天实现；再验证视觉到决策到命令 ACK、人工锁阻止 AI、三端自由/选中问询、稳定实体 ID、停止/重试/断线、实时与 RAG 引用、问答绝不触发命令、知识审核前不可检索及撤销停用。P0 不完整退回对应对话。
```
