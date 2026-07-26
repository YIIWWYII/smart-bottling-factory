# 鸿蒙小屏工位终端

工程入口：`BottlingFactoryTerminal`，bundleName：`com.factory.bottling.terminal`。

仅负责工位选择、当前环节完整实时展示、设备参数和受控操作。启动路径为 `Index -> Workstation -> StageDetail`；`StageDetail` 先显示与数字展板对应工位一致的当前环节画面和状态，再显示调参与控制。保留本地 Three.js 资源和 ArkWeb `Web` 容器，后续实现内嵌本地 Three.js 的独立 2D/3D 与命令回执闭环。

禁止在此工程加入全局数字展板、后台用户/报表管理或直接 MQTT/硬件控制。开发与验收以 `docs/ai-prompts/02-workstation-terminal.md` 为准。
