# 鸿蒙数字展板

工程入口：`BottlingFactoryDisplay`，bundleName：`com.factory.bottling.display`。

数字展板面向厂区大屏，展示整条产线总览、各生产环节的只读详情、设备状态、产品追踪、质量结果、物流和仓储状态。典型页面路径为 `Index -> FactoryOverview -> StageDetail`。

展板使用 ArkUI 承载页面，并通过 ArkWeb 加载本地 Three.js 资源，实现独立的 2D 平面动画和 3D 场景动画。2D 与 3D 是两种展示模式，不是同一场景的简单换角度；两者都由同一份实时快照和模拟时钟驱动。

本应用只读，不包含后台用户管理、工位调参、设备命令下发或 MQTT 客户端。共享助手通过 `@bottling/harmony-assistant` 接入，助手也只能提供问答和只读定位。跨应用字段、事件和权限语义见根目录 `contracts/`。

构建、配置、模拟数据和联调步骤见根目录 [ONBOARDING-DEPLOYMENT.md](../../ONBOARDING-DEPLOYMENT.md)。
