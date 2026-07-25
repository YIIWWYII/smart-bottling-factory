# 鸿蒙工程构建与验证

## 开发机准备

所有开发工具和缓存放在 E 盘，例如：

```text
E:\dev\DevEco-Studio
E:\dev\HarmonyOS-SDK
E:\dev\HarmonyOS-Projects
E:\dev\HarmonyOS-Cache
```

安装 DevEco Studio 时，如果安装器默认指向 C 盘，先取消默认 SDK/缓存路径，在 DevEco 的 SDK 配置中改到 E 盘后再下载。

## 打开与同步

1. 打开 DevEco Studio，选择 `Open`。
2. 打开 `BottlingFactoryNative`，不要打开旧的 `.runtime/harmony-workstation`。
3. 等待 Sync 完成，确认 `entry` 模块被识别。
4. 选择与当前 SDK 匹配的 API 版本；如果 IDE 要求补充 `compatibleSdkVersion`，以 IDE 推荐版本为准写入 `build-profile.json5`。
5. 运行工程根目录的 `tools\validate-project.ps1`。

## 后端地址

在 `entry/src/main/ets/service/ApiConfig.ets` 中修改：

```ts
API_BASE: 'http://电脑局域网IP:8088/hdc/api'
WS_BASE: 'ws://电脑局域网IP:8088/hdc/api/dataScreen/1'
```

手机、平板或工位屏不能使用 `localhost`，必须使用运行 Spring Boot 电脑的局域网 IP。电脑防火墙要允许 8088 入站访问。

## 运行顺序

1. 运行现有 Spring Boot 后端，确认 `GET http://127.0.0.1:8088/hdc/api/factory/health` 返回成功。
2. 启动 HarmonyOS 模拟器或连接已开启开发者模式的真机。
3. 在 DevEco 中选择 `entry` 和设备，点击 Run。
4. 登录页选择真实登录或“进入本地演示”。
5. 依次检查监控工作台、工位工作台和管理工作台。

## Three.js 离线资源

三维场景不需要执行 `npm install`，固定依赖已经放在：

```text
entry/src/main/resources/rawfile/factory3d/vendor/three.min.js
entry/src/main/resources/rawfile/factory3d/vendor/THREE-LICENSE.txt
```

不要把 Three.js 改成 CDN 地址。真机测试前确认系统未开启坚盾守护模式，否则 ArkWeb 会禁用 WebGL/WebGL2；遇到不支持的设备时，关闭“三维”并使用二维工艺图。

## 验收表

| 检查项 | 预期结果 |
| --- | --- |
| 登录 | 真实后端返回 token，角色进入工作台 |
| 重启应用 | Preferences 恢复 token 和角色 |
| 后端断开 | 页面显示 `LOCAL DEMO`，不崩溃、不误报真实设备在线 |
| WebSocket 断开 | 状态显示重连中，恢复后重新拉取快照 |
| 工位切换 | 九个工位都能进入详情 |
| 三维场景 | 九个工位显示不同设备组合，旋转、缩放、设备/产品点选正常 |
| 数据联动 | 设备状态颜色、产品位置、速度和暂停/恢复与同一份运行快照一致 |
| 性能开关 | 二维、三维和状态颜色可独立切换，关闭三维后 Web 组件被移除 |
| 布局编辑 | 开启后可拖拽三维设备；关闭编辑后恢复旋转视角，重开页面保留位置 |
| 质量门 | VOC、温度、AGV 和仓储安全条件显示 PASS/WAIT/FAIL |
| 异常处置 | 解决请求使用 `action/targetStage/note`，由后端最终判定 |
| 角色 | VIEWER 不显示可执行的管理写操作，ADMIN 可进入用户管理 |
| 屏幕 | phone、tablet、横屏大屏可以滚动且无核心内容遮挡 |

## 当前构建限制

本 Windows 工作区没有发现 DevEco Studio、HarmonyOS SDK、`hvigorw` 或 `hdc`，因此本轮可完成工程静态验证、Three.js 浏览器渲染验证和现有后端联调检查，但不能声称已经生成 HAP。拿到鸿蒙开发机后，必须完成一次真实 Sync、Debug Build、Preview 和真机安装，并重点测试 ArkWeb WebGL、内存和长时间运行温度。
