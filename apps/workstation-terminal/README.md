# 鸿蒙小屏工位终端

工程入口：`BottlingFactoryTerminal`，bundleName：`com.factory.bottling.terminal`。

工位终端面向生产现场，展示当前工位和所属环节的实时状态、设备运行信息、正在处理的产品，以及经过权限和联锁校验的参数调整与控制操作。`Index -> Workstation -> StageDetail` 是主要使用路径；工位画面与数字展板使用同一份生产快照。

终端使用 ArkUI 承载交互，通过 ArkWeb 加载本地 Three.js 资源，提供与大屏一致数据驱动的独立 2D 平面动画和 3D 场景动画。写操作必须通过生产后端完成身份、权限、参数范围、联锁、幂等和边缘回执校验，HTTP 返回成功不代表设备已经执行成功。

本应用不负责全局大屏、后台报表、知识审核或直接连接 MQTT/硬件。共享助手通过 `@bottling/harmony-assistant` 接入，助手本身不能修改设备参数。跨应用字段和命令状态见根目录 `contracts/`。

构建、配置、模拟数据和联调步骤见根目录 [ONBOARDING-DEPLOYMENT.md](../../ONBOARDING-DEPLOYMENT.md)。
