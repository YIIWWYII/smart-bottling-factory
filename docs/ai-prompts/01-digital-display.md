# 数字展板补救开发对话提示词

你负责智慧装瓶工厂的鸿蒙数字展板。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-display`，分支是 `codex/display`，唯一业务写入范围是 `apps/digital-display/BottlingFactoryDisplay`。不要修改小屏、后台管理、AI 协同端或后端；如契约不足，只提交契约变更提案，不要擅自改别人的工程。

## 当前阶段

该工程已经完成一轮开发且可能存在未提交修改。你的任务是补救和验收，不是删除后重做。先阅读现有实现、`git diff` 和最近提交，保留能工作的代码；禁止 `reset --hard`、覆盖工作树、回退别人改动或从旧骨架重新复制。先列出 P0 已完成/缺失/证据不足三张清单，再做最小范围修复。

## 先做

1. 阅读根 `README.md`、`contracts/`、`docs/engineering/DEVELOPMENT_STANDARD.md`、`docs/engineering/TESTING_TOOLCHAIN.md` 和本工程 README。
2. 检查 `git status --short` 和当前分支，保护已有改动。
3. 必须调用 `$deveco-cli`；会话可见时优先使用官方 `deveco-cli` MCP。鸿蒙错误先查 `D:\HarmonyOS-Dev\Logs\devecocli-official-docs.md`，再查 `devecocli docs`，再查华为官方文档；开发记录只写入 D 盘开发日志。
4. Three.js rawfile 有独立浏览器测试入口时调用 `$playwright`；它只验证 Web 层，不能替代鸿蒙模拟器。只有 DevEco Test Runner、模拟器窗口或 Web 调试必须操作 UI 时才调用 `$computer-use:computer-use`。

## 目标

把现有骨架做成蓝白、厚重、真实工业风的只读数字展板。启动直接进入全局总览；总览上部是九工序连续流水流程，下部是生产、质量、设备、异常、物流仓储和产品追踪。点击工序进入独立详情，详情上部先显示动画，下部显示设备、物料、质量门、报警和上下游影响。

2D 与 3D 必须都通过 HarmonyOS ArkWeb 的 `Web` 组件加载 HAP `rawfile` 中的本地 HTML/JavaScript/Three.js，不是 ArkUI 原生动画，也不访问在线网页或 CDN。2D 是独立平面工艺图：平面设备符号、工艺路径、传送带/AGV 路径和物料运动；3D 是立体设备与物料模型。禁止用 3D 俯视相机冒充 2D。每个工序设备模型和动作应不同。ArkTS 通过 ArkWeb JavaScript 桥把同一数据快照同步给两个场景，速度、动作、物料位置、设备状态和颜色保持一致；支持独立开关、暂停、恢复实时、状态颜色开关、设备拖拽布局和设备/物料点击详情。恢复时直接跳到当前状态。

HTTP 首屏快照，WebSocket 实时通知；断线后清楚标识并重连、补拉。后端无数据时可显示明确的 `LOCAL DEMO`，不能伪装 MQTT。所有数值和数组做好缺失保护，修复当前总览空数据可能触发的 `toString` 崩溃。

## 补救顺序

1. 对照 `client-capability-matrix.md`、`shared-snapshot-contract.md` 和实时契约审计现有 Repository、ArkTS 页面、ArkWeb bridge、2D/3D rawfile。
2. 先修崩溃、白屏、假按钮、不可滚动、导航错误、资源泄漏和假数据来源，再补视觉细节。
3. 统一 2D/3D 使用后端 `stateVersion` 快照。后端目标端点尚未完成时允许兼容当前组合接口，但必须显式记录映射；禁止前端各自随机生成跨端数据。
4. 增加开发态 `window.__factoryTest__` 只读探针和测试入口，不得暴露生产控制能力。
5. 每修一组问题就构建和冒烟，不把所有修改堆到最后验证。

## 禁止

- 不加登录、注册、后台管理、设备控制或参数写入。
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

要求 `BUILD SUCCESSFUL`、HAP 生成、模拟器启动、总览到九工位导航、2D/3D canvas 非空像素、同版本联动、暂停/恢复、点击/拖拽、资源释放和断线冒烟通过。提交到 `codex/display` 并推送，最终报告提交号、文件、测试命令与计数、截图/日志、未完成 P1 和契约提案，不直接推 `main`。
