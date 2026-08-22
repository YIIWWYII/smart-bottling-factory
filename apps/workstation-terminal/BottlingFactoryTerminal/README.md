# 鸿蒙小屏工位终端

这是面向生产现场的 HarmonyOS 工位应用，使用 ArkTS/ArkUI 展示本站状态、设备和物料信息，并提供经过后端安全校验的受控操作。

## 运行方式

1. 使用 DevEco Studio 打开本目录。
2. 在 `entry/src/main/ets/service/ApiConfig.ets` 配置 Spring Boot 后端地址；模拟器或真机不能填写 `localhost`。
3. 先启动根目录部署说明中的生产后端和 AI 中枢，再同步依赖并运行 `entry` 模块。

详细的安装、构建、安装和联调步骤见仓库根目录 [ONBOARDING-DEPLOYMENT.md](../../../ONBOARDING-DEPLOYMENT.md)。

## 应用边界

- ArkWeb 加载 `entry/src/main/resources/rawfile/factory3d` 中的本地 Three.js 场景。
- 工位操作通过生产后端完成权限、参数范围、联锁、幂等和边缘回执校验。
- 应用不直接连接 MySQL、MQTT 或设备 SDK；共享助手不能修改设备参数。
