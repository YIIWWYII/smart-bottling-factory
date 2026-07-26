# 智慧装瓶产线鸿蒙应用

这是现有 Vue 管理端和数字大屏的 HarmonyOS 迁移工程。登录、导航、管理、工位信息、网络和状态管理使用 ArkTS/ArkUI；只有工位三维场景使用 ArkWeb 加载应用内置的 Three.js 资源。

## 工作台

- 监控工作台：整线总览、工位详情、产品追踪、物流仓储和质量状态。
- 管理工作台：认证、运营首页、异常处置、用户权限、设备/物料/仓储/报表/配置入口。
- 工位工作台：面向现场小屏，显示本站设备、传感器、质量门和允许操作。

三个工作台共享同一套 `FactoryRepository`。鸿蒙端只通过 HTTP/WebSocket 访问 Spring Boot，不直连 MySQL、MQTT 或 AI/RAG 服务。

## 三维场景

- `entry/src/main/resources/rawfile/factory3d` 保存完全离线的 Three.js 页面、场景代码和固定版本依赖。
- ArkTS 通过 `FactoryThreeScene.ets` 的 `runJavaScript()` 将设备状态、产品位置、速度、数据源和暂停状态推送给三维场景。
- 设备和产品可点击；设备布局编辑结果只保存为本机界面偏好，不替代后端生产数据。
- 关闭“三维”后 ArkUI 不再创建 Web 组件，以降低现场小屏的 GPU 和内存占用。

## 在 E 盘运行

1. 在 DevEco Studio 中打开本目录。
2. SDK、Node.js、Gradle、模拟器和项目缓存全部配置到 `E:\dev` 下的目录。
3. 使用与 `build-profile.json5` 中 API 版本兼容的 HarmonyOS SDK 同步工程。
4. 启动后端 `http://电脑局域网IP:8088/hdc/api`，再运行 `entry`。
5. 在 `entry/src/main/ets/service/ApiConfig.ets` 修改 `API_BASE`，真机不能填写 `localhost`。

## 当前验证边界

本机没有发现 DevEco Studio/HarmonyOS SDK，因此无法在当前 Windows 工作区生成或安装 HAP。工程已提供静态可检查的 Stage 配置和 ArkTS 源码；拿到装好 DevEco 的开发机后，必须执行一次真实 Sync、Build、Preview 和模拟器/真机运行。

## 迁移原则

- 真实接口优先，接口失败时显示明确的 `LOCAL DEMO` 兜底数据。
- 质量放行和异常处置仍由后端最终判定，页面按钮不能绕过后端安全门。
- 大屏和小屏使用同一份状态模型，通过 ArkUI 自适应布局适配不同宽度。
- 2D 工艺图使用 ArkUI；3D 工艺图使用局部 ArkWeb + 本地 Three.js。业务页面不套 WebView，也不依赖 CDN。
- 目标设备必须支持 ArkWeb WebGL，且不能开启会禁用 WebGL/WebGL2 的坚盾守护模式。
