# 数字展板补救开发对话提示词

你负责智慧装瓶工厂的鸿蒙数字展板。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-display`，分支是 `codex/display`，唯一业务写入范围是 `apps/digital-display/BottlingFactoryDisplay`。不要修改小屏、后台管理、生产后端、AI 中枢或 `packages/harmony-assistant`；如契约不足，只提交契约变更提案。

## 当前阶段

该工程已经完成一轮开发且可能存在未提交修改。你的任务是补救和验收，不是删除后重做。先阅读现有实现、`git diff` 和最近提交，保留能工作的代码；禁止 `reset --hard`、覆盖工作树、回退别人改动或从旧骨架重新复制。先列出 P0 已完成/缺失/证据不足三张清单，再做最小范围修复。

## 先做

1. 先检查 `git status --short` 和当前分支，保护已有改动；工作树干净时再 `git fetch origin`、`git pull --ff-only origin codex/display`。
2. 阅读 GitHub 最新架构分支的根 `README.md`、全部 `contracts/`，重点阅读 `assistant-host-contract.md`、开发标准、测试规范和本工程 README。
3. 必须调用 `$deveco-cli`；会话可见时优先使用官方 `deveco-cli` MCP。鸿蒙错误先查 `D:\HarmonyOS-Dev\Logs\devecocli-official-docs.md`，再查 `devecocli docs`，再查华为官方文档；开发记录只写入 D 盘开发日志。
4. Three.js rawfile 有独立浏览器测试入口时调用 `$playwright`；它只验证 Web 层，不能替代鸿蒙模拟器。只有 DevEco Test Runner、模拟器窗口或 Web 调试必须操作 UI 时才调用 `$computer-use:computer-use`。

## 目标

把现有骨架做成蓝白、厚重、真实工业风的只读数字展板。启动直接进入全局总览；总览上部是九工序连续流水流程，下部是生产、质量、设备、异常、物流仓储和产品追踪。点击工序进入独立详情，详情上部先显示动画，下部显示设备、物料、质量门、报警和上下游影响。

2D 与 3D 必须都通过 HarmonyOS ArkWeb 的 `Web` 组件加载 HAP `rawfile` 中的本地 HTML/JavaScript/Three.js，不是 ArkUI 原生动画，也不访问在线网页或 CDN。2D 是独立平面工艺图：平面设备符号、工艺路径、传送带/AGV 路径和物料运动；3D 是立体设备与物料模型。禁止用 3D 俯视相机冒充 2D。每个工序设备模型和动作应不同。ArkTS 通过 ArkWeb JavaScript 桥把同一数据快照同步给两个场景，速度、动作、物料位置、设备状态和颜色保持一致；支持独立开关、暂停、恢复实时、状态颜色开关、设备拖拽布局和设备/物料点击详情。恢复时直接跳到当前状态。

HTTP 首屏快照，WebSocket 实时通知；断线后清楚标识并重连、补拉。后端无数据时可显示明确的 `LOCAL DEMO`，不能伪装 MQTT。所有数值和数组做好缺失保护，修复当前总览空数据可能触发的 `toString` 崩溃。

## 上下文 AI 助手

不要开发助手 UI、AI ApiClient、会话存储或流式状态机。依赖 AI 中枢任务提供的同一 `@bottling/harmony-assistant` HAR，只完成以下宿主工作：

- 在总览和工位详情挂载共享 `AssistantPanel`，持有并在页面销毁时释放 `AssistantController`。
- 实现 `AssistantHostAdapter`：`sourceApp='DISPLAY'`；`getContext()` 返回当前总览/工位、`lineId/stageCode/stateVersion/dataGeneratedAt`；`getAccessToken()` 返回展板只读客户端凭据；`getServiceEndpoint()` 读取 AI 中枢配置；实现 `subscribeSelection()`、`subscribeVisibility()` 和只读 `navigateToEntity()`。
- ArkUI 工位、KPI、报警、产品和文字选择转换为 `AssistantSelection`。实体 ID 使用 `stageCode`、`lineId:kpiCode`、后端报警 ID、`traceCode` 或稳定文字字段 ID。
- Three.js 2D/3D 只从 `userData` 上报稳定 `deviceCode/traceCode`，ArkTS 补齐页面路由和 `stateVersion`；禁止使用 Three.js `uuid/name` 或显示文本作为 ID。
- 展板范围始终只读。回答引用导航只能定位页面/对象，不能产生参数修改、审批或设备控制。

共享包统一负责自由/选中问询、会话、流式回答、停止/重试、引用、数据时间、知识版本、错误和权限反馈。AI 不可达时由共享包显示真实错误，不生成本地假回答。

## 补救顺序

1. 对照 `client-capability-matrix.md`、`shared-snapshot-contract.md`、`assistant-host-contract.md` 和实时契约审计现有 Repository、ArkTS 页面、ArkWeb bridge、2D/3D rawfile。
2. 先修崩溃、白屏、假按钮、不可滚动、导航错误、资源泄漏和假数据来源，再补视觉细节。
3. 统一 2D/3D 使用后端 `stateVersion` 快照。后端目标端点尚未完成时允许兼容当前组合接口，但必须显式记录映射；禁止前端各自随机生成跨端数据。
4. 增加开发态 `window.__factoryTest__` 只读探针和测试入口，不得暴露生产控制能力。
5. 每修一组问题就构建和冒烟，不把所有修改堆到最后验证。

## 禁止

- 不加登录、注册、后台管理、设备控制或参数写入；AI 助手也不能成为控制入口。
- 不复制共享助手源码，不实现本地聊天 UI，不直接调用 `/assistant/**` 或解析 `ai.conversation.*`。
- 不连接 MQTT，不在前端实现业务真相或随机生成彼此不一致的数据。
- 不引入网络 CDN，Three.js 及许可证都随 HAP 本地打包。
- 不做只有样式不能点击的按钮，不牺牲滚动和小尺寸可用性。

## 验收与交付

逐项满足 `DEVELOPMENT_STANDARD.md` 的数字展板 P0，并按 `TESTING_TOOLCHAIN.md` 补 Local Test、Test Kit/模拟器测试和 ArkWeb/Three.js 证据。使用 D 盘英文构建目录：

```powershell
& "D:\Codex\.codex\skills\deveco-cli\scripts\build-harmony.ps1" `
  -SourceProject "D:\HarmonyOS-Dev\Workspaces\bottling-display\apps\digital-display\BottlingFactoryDisplay" `
  -BuildProject "D:\HarmonyOS-Dev\Build\BottlingFactoryDisplay" -Modules entry -BuildMode debug
```

要求 `BUILD SUCCESSFUL`、HAP 生成、模拟器启动、总览到九工位导航、2D/3D canvas 非空像素、同版本联动、暂停/恢复、点击/拖拽、资源释放和断线冒烟通过；另须证明使用统一助手包版本、适配器七项能力、稳定实体 ID、只读引用导航和无本地助手实现。提交到 `codex/display` 并推送，最终报告提交号、文件、测试命令与计数、截图/日志、未完成 P1 和契约提案，不直接推 `main`。
