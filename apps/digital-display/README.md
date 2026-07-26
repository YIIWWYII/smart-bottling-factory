# 鸿蒙数字展板

工程入口：`BottlingFactoryDisplay`，bundleName：`com.factory.bottling.display`。

仅负责全局产线总览和工位只读详情。启动路径为 `Index -> FactoryOverview -> StageDetail`。保留 `entry/src/main/resources/rawfile/factory3d` 和 ArkWeb `Web` 容器 `FactoryThreeScene.ets`，后续按数字展板提示词实现内嵌本地 Three.js 的独立 2D/3D。

禁止在此工程加入登录、后台管理、现场控制或 MQTT。开发与验收以 `docs/ai-prompts/01-digital-display.md` 和 `DEVELOPMENT_STANDARD.md` 为准。
