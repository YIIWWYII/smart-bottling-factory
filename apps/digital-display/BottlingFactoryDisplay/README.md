# 智慧装瓶工厂数字展板

这是只读的 HarmonyOS 数字展板应用。应用启动后直接进入九工序全局总览，不需要登录，也不提供设备控制、参数写入或后台管理入口。

## 页面与数据

- `FactoryOverview`：连续九工序流程，以及生产、质量、设备、异常、物流仓储和产品追踪指标。
- `StageDetail`：上部为独立 2D 平面工艺图或 3D 设备场景，下部为设备、物料、质量门、报警和上下游影响。
- HTTP 获取首屏完整快照，WebSocket 接收实时事件；断线或接口不可用时明确显示 `LOCAL DEMO`，不伪装真实 MQTT 数据。
- 展板通过 `@bottling/harmony-assistant` 1.0.2 接入共享只读助手，只提供宿主上下文、稳定实体选择和只读导航。

## 2D 与 3D

两种视图都由 ArkWeb 加载 HAP 内置的本地 Three.js 页面，不访问 CDN：

```text
entry/src/main/resources/rawfile/factory2d  独立平面工艺图
entry/src/main/resources/rawfile/factory3d  立体设备场景和 Three.js 固定依赖
```

2D 使用正交相机和平面工艺符号表现路径、工位设备、物料流向、报警状态和工序动作，不是 3D 模型的俯视角。两种视图接收同一个 ArkTS 快照，统一使用 `stateVersion`、`speed`、`progress`、设备/产品状态、暂停和状态颜色字段。关闭视图后 Web 组件卸载，渲染循环和 WebGL 上下文随之释放。

设备布局按“工序 + 视图模式 + 设备编号”保存在 ArkWeb 本地偏好中。设备、产品和工位点击只上报 `deviceCode`、`traceCode`、`stageCode` 等稳定业务 ID，再由 ArkTS 发布共享助手选择；不使用 Three.js UUID、显示名称或列表下标。

## 本机开发

- 工作区：`D:\HarmonyOS-Dev\Workspaces\bottling-display`
- 分支：`codex/display`
- DevEco CLI：`D:\HarmonyOS-Dev\npm-global\devecocli.cmd`
- SDK、模拟器、缓存、构建目录和日志全部位于 `D:\HarmonyOS-Dev`，不得写入 C 盘。

后端和 AI 中枢地址在 `entry/src/main/ets/service/ApiConfig.ets`。模拟器/真机不能使用 `localhost`，应填写运行服务电脑可访问的局域网地址。

构建和验收命令见 `BUILD-AND-VERIFY.md`。
