# 数字展板开发对话提示词

你负责智慧装瓶工厂的鸿蒙数字展板。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-display`，分支是 `codex/display`，唯一业务写入范围是 `apps/digital-display/BottlingFactoryDisplay`。不要修改小屏、后台管理或后端；如契约不足，只提交契约变更提案，不要擅自改别人的工程。

## 先做

1. 阅读根 `README.md`、`contracts/`、`docs/engineering/DEVELOPMENT_STANDARD.md` 和本工程 README。
2. 检查 `git status --short` 和当前分支，保护已有改动。
3. 使用 `C:\Users\王艺\.codex\skills\deveco-cli\SKILL.md`。鸿蒙错误先查 `D:\HarmonyOS-Dev\Logs\devecocli-official-docs.md`，再查 `devecocli docs`，再查华为官方文档；开发记录只写入 D 盘开发日志。

## 目标

把现有骨架做成蓝白、厚重、真实工业风的只读数字展板。启动直接进入全局总览；总览上部是九工序连续流水流程，下部是生产、质量、设备、异常、物流仓储和产品追踪。点击工序进入独立详情，详情上部先显示动画，下部显示设备、物料、质量门、报警和上下游影响。

2D 与 3D 必须都通过 HarmonyOS ArkWeb 的 `Web` 组件加载 HAP `rawfile` 中的本地 HTML/JavaScript/Three.js，不是 ArkUI 原生动画，也不访问在线网页或 CDN。2D 是独立平面工艺图：平面设备符号、工艺路径、传送带/AGV 路径和物料运动；3D 是立体设备与物料模型。禁止用 3D 俯视相机冒充 2D。每个工序设备模型和动作应不同。ArkTS 通过 ArkWeb JavaScript 桥把同一数据快照同步给两个场景，速度、动作、物料位置、设备状态和颜色保持一致；支持独立开关、暂停、恢复实时、状态颜色开关、设备拖拽布局和设备/物料点击详情。恢复时直接跳到当前状态。

HTTP 首屏快照，WebSocket 实时通知；断线后清楚标识并重连、补拉。后端无数据时可显示明确的 `LOCAL DEMO`，不能伪装 MQTT。所有数值和数组做好缺失保护，修复当前总览空数据可能触发的 `toString` 崩溃。

## 禁止

- 不加登录、注册、后台管理、设备控制或参数写入。
- 不连接 MQTT，不在前端实现业务真相或随机生成彼此不一致的数据。
- 不引入网络 CDN，Three.js 及许可证都随 HAP 本地打包。
- 不做只有样式不能点击的按钮，不牺牲滚动和小尺寸可用性。

## 验收与交付

逐项满足 `DEVELOPMENT_STANDARD.md` 的数字展板 P0。使用 D 盘英文构建目录：

```powershell
& "C:\Users\王艺\.codex\skills\deveco-cli\scripts\build-harmony.ps1" \
  -SourceProject "D:\HarmonyOS-Dev\Workspaces\bottling-display\apps\digital-display\BottlingFactoryDisplay" \
  -BuildProject "D:\HarmonyOS-Dev\Build\BottlingFactoryDisplay" -Modules entry -BuildMode debug
```

要求 `BUILD SUCCESSFUL`、HAP 生成、模拟器启动、总览到九工位导航、2D/3D/暂停/点击/断线冒烟通过。提交到 `codex/display` 并推送，最终报告提交号、文件、测试证据、未完成 P1 和契约提案，不直接推 `main`。
