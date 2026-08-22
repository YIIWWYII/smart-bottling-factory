# 鸿蒙后台管理端

这是面向管理人员的 HarmonyOS 后台应用，使用 ArkTS/ArkUI 提供认证、生产任务、设备和工位资料、质量、异常、物流仓储、AI 配置、知识审核、权限和操作审计功能。

## 运行方式

1. 使用 DevEco Studio 打开本目录。
2. 在 `entry/src/main/ets/service/ApiConfig.ets` 配置 Spring Boot 后端和 AI 中枢地址；模拟器或真机不能填写 `localhost`。
3. 先启动根目录部署说明中的生产后端和 AI 中枢，再同步依赖并运行 `entry` 模块。

详细的安装、构建、安装、账号和联调步骤见仓库根目录 [ONBOARDING-DEPLOYMENT.md](../../../ONBOARDING-DEPLOYMENT.md)。

## 应用边界

- 后台写操作和配置发布必须经过后端的身份、角色、范围、版本和审计校验。
- 知识资料上传和审核、AI 配置、报表和物流仓储管理属于本应用；现场实时调参属于工位终端。
- 应用不直接连接 MySQL、MQTT 或设备 SDK，也不包含数字展板 Three.js 产线场景。
