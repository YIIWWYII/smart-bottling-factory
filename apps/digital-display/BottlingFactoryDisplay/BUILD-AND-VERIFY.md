# 数字展板构建与验证

## 环境

所有工具、SDK、模拟器、缓存、构建产物和日志均放在 `D:\HarmonyOS-Dev`。工程源码位于：

```text
D:\HarmonyOS-Dev\Workspaces\bottling-display\apps\digital-display\BottlingFactoryDisplay
```

应用通过 `entry/oh-package.json5` 依赖本地 `libs/harmonyassistant-1.0.1.har`，OHPM 包名必须为 `@bottling/harmony-assistant`，版本必须为 `1.0.1`。

## 构建

```powershell
& 'D:\HarmonyOS-Dev\npm-global\devecocli.cmd' --version
& 'D:\HarmonyOS-Dev\npm-global\devecocli.cmd' build --modules entry --build-mode debug
```

构建前运行工程静态检查：

```powershell
& '.\tools\validate-project.ps1'
```

成功标准是 CLI 输出 `BUILD SUCCESSFUL`，且 `entry\build\default\outputs\default\` 下生成 `.hap`，不能只凭 ArkTS 类型检查判断完成。

## 服务地址

`entry/src/main/ets/service/ApiConfig.ets` 配置 Spring Boot 与 AI 中枢地址。模拟器或真机不能使用 `localhost`；电脑防火墙必须允许对应端口入站。后端不可用时页面应显示明确错误和 `LOCAL DEMO`，AI 中枢不可用时共享助手应显示服务不可用，但不能阻塞展板页面。

## 最低验收

| 检查项 | 预期结果 |
| --- | --- |
| 启动 | 无需登录，直接进入全局总览 |
| 工序导航 | 九工序均可从总览进入详情，页面可上下滚动 |
| 2D | 加载 `factory2d/index.html`，显示平面设备符号、工艺路径和移动物料，不是 3D 俯视角 |
| 3D | 加载 `factory3d/index.html`，九工序设备组合和动作不同 |
| 同快照联动 | 两视图的 `stateVersion`、设备/产品、速度、进度、来源一致 |
| 暂停/恢复 | 暂停冻结当前帧；恢复后应用最新快照并继续运动 |
| 性能开关 | 2D/3D 可独立关闭；关闭后取消动画帧并释放 WebGL |
| 状态颜色 | 可关闭颜色映射，设备状态文字仍显示 |
| 布局编辑 | 设备可拖拽；按工序和视图保存，重开后恢复 |
| 选择联动 | 工位、设备、产品使用稳定业务 ID 发布共享助手选择；空白点击发送 `CLEAR` |
| 服务异常 | 后端/AI 不可用提示清楚，页面不崩溃、不显示假成功 |

Three.js 可先在浏览器对 rawfile 页面做 canvas、点击、拖拽和探针回归，但最终必须在 HarmonyOS 模拟器中确认 ArkWeb、本地资源、桥接和页面切换。
