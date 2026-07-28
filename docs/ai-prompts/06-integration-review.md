# 融合评审对话提示词

你负责七个 Codex 对话最终产物的融合评审，不开发新的业务程序。工作区 `D:\HarmonyOS-Dev\Workspaces\bottling-integration`，分支 `integration/full-system`。架构基线来自 `codex/ai-architecture`；待评审业务分支为 `codex/display`、`codex/terminal`、`codex/admin`、`codex/backend`、`codex/ai-center`。其中 `codex/ai-center` 必须同时交付 AI 服务和 `@bottling/harmony-assistant` HAR。

## 顺序

1. 从 GitHub 拉取最新 `main`、`codex/ai-architecture` 和五个业务分支，确认工作树干净、交付提交和测试证据齐全。
2. 先审查契约，再依次合并生产后端、AI 中枢及共享助手包、数字展板、小屏、后台；每次合并后立即测试，前端合并前必须先能构建共享 HAR。
3. 三个鸿蒙工程分别调用 `$deveco-cli` 构建并在模拟器验收；后端运行 Maven 测试；AI 中枢运行服务测试和共享 HAR 的 Local Test/ArkUI/模拟适配器测试。
4. 完成九工序中央模拟和三端生产事实一致性。
5. 完成 AI 闭环：图片 -> 瓶型/缺陷 -> 最新快照 -> RAG/工具 -> 字段级补丁 -> 后端安全门 -> 边缘 ACK。
6. 人工锁定字段后验证 AI 跳过并解释；参数版本变化使旧决策 `STALE`；原子组不可拆分。
7. 三端分别验证自由问询和选中问询，包括文字、卡片/表格、报警及 Three.js 设备/物料。实时回答标时间和版本，非实时回答带引用，混合回答二者兼有；ArkUI 与 Three.js 使用稳定业务 ID，不得使用组件索引或 Three.js UUID。
8. 输入“把流量改为120”等控制语言，确认问答不会创建命令；只有隐式决策可提交命令意图。
9. 后台上传资料，分别拒绝、批准、索引和撤销；批准前不可检索，`INDEXED` 后可引用，撤销后立即停用。
10. 验证服务边界：AI 中枢不直连生产 MySQL/设备 MQTT，Spring Boot 不包含模型、RAG、向量库或 AI 会话实现。
11. 解包或检查三个 HAP 的依赖清单，确认它们使用同一 `@bottling/harmony-assistant` 版本和同一 HAR SHA-256；三端无本地聊天 UI、独立 AI ApiClient、流式事件解析或直接 `/assistant/**` 请求。
12. 验证助手停止、重试、断线恢复、token 过期、宿主隐藏/恢复和引用导航；重试重新采集上下文与令牌，令牌不进入上下文、消息、日志或持久化。

## 硬门槛

- 三个 HAP 可同时安装；展板、小屏、后台各自 P0 和共享助手宿主适配通过。
- AI 中枢的视觉、决策、问答、知识、工具五模块及共享助手 HAR P0 通过，模拟结果明确标识。
- 三端使用同一共享包版本和 HAR 校验值；任一端复制助手源码、使用临时实体 ID 或让助手创建命令，均不得合入。
- 后端持久化、MQTT/模拟切换、只读 AI 工具、视觉结果、命令意图、安全门和 ACK 通过。
- 任一 P0、构建、关键测试或权限隔离失败不得合入 `main`。

只做必要兼容修复，输出五分支来源、合并提交、测试计数、三个 HAP、AI/后端产物、截图日志、端到端结果和残余风险。通过后创建到受保护 `main` 的 PR，不直接推 `main`。
