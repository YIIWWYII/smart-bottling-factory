# Vue 到 ArkTS 迁移方案

## 1. 迁移目标

把现有两个 Vue 前端的业务能力迁移到一个 HarmonyOS Stage/ArkTS 原生应用中：监控大屏、后台管理和工位小屏共享数据层，但根据屏幕和角色展示不同工作台。

## 2. 边界

鸿蒙端负责页面展示、用户输入、权限体验、连接状态和命令结果展示；Spring Boot 负责认证、生产状态机、质量放行、异常策略、MQTT、AI/RAG、数据库持久化。鸿蒙端不直连 MySQL/MQTT。

## 3. 页面映射

| Vue 功能 | ArkUI 页面 | 第一版处理 |
| --- | --- | --- |
| 登录/注册 | `Login.ets` / `Register.ets` | 保留账号认证和只读注册 |
| 运营首页/数字大屏 | `FactoryOverview.ets` | 原生生产流程和全局指标 |
| 工位环节详情 | `StageDetail.ets` | 原生业务信息 + 局部 Three.js 三维工位 |
| 工位控制端 | `Workstation.ets` | 现场小屏精简布局和命令入口 |
| 异常处置 | `AdminConsole.ets` 的异常页 | 查询、策略展示、确认和解决 |
| 用户权限 | `AdminConsole.ets` 的用户页 | 管理员查看并更新角色/状态 |
| PLC、物料、仓储、报表、配置 | `AdminConsole.ets` 的业务入口 | 第一版统一管理工作台，后续拆成独立页面 |

## 4. 接口映射

- `POST /hdc/api/auth/login`
- `POST /hdc/api/auth/register`
- `GET /hdc/api/auth/me`
- `GET /hdc/api/auth/users`
- `PATCH /hdc/api/auth/users/{id}`
- `GET /hdc/api/factory/dashboard`
- `GET /hdc/api/factory/runtime`
- `GET /hdc/api/operations/overview`
- `GET /hdc/api/logistics/overview`
- `POST /hdc/api/operations/ai/decide`
- `GET /hdc/api/factory/runtime/incidents`
- `POST /hdc/api/factory/runtime/incidents/{id}/resolve`
- `POST /hdc/api/operations/alarms/{id}/ack`
- WebSocket `ws://电脑局域网IP:8088/hdc/api/dataScreen/1`

## 5. 状态闭环

```text
登录 -> 获取 token -> 拉取快照 -> WebSocket 订阅 factory.*
                         |                 |
                    断线显示过期       事件触发重新拉取
                         |
                   HTTP 失败 -> LOCAL DEMO 明确兜底
```

## 6. 方案自检

- 页面是否能在无后端时运行：是，仓库提供本地演示数据。
- 页面是否可以越权控制：否，按钮只提交后端命令，后端仍需鉴权和安全校验。
- 页面是否依赖浏览器：业务页面不依赖；只有可关闭的 3D 渲染区域依赖 ArkWeb/WebGL。
- 是否覆盖滚动、加载、断线、空数据、错误和权限状态：是，页面统一显示这些状态。
- 是否保留 Three.js：保留为应用内置离线资源，只负责 3D 渲染；ArkTS 通过 `runJavaScript()` 推送实时快照，业务逻辑仍在 ArkTS 和后端。
- 是否能在当前电脑生成 HAP：不能确认，当前环境没有 DevEco Studio 和 HarmonyOS SDK；必须在 DevEco 开发机做最后构建门禁。

## 7. 验收门禁

1. DevEco Sync 无错误。
2. `entry` Debug 构建成功。
3. 模拟器能打开登录页并完成本地演示登录。
4. 后端在线时能显示接口数据，断开后显示 `LOCAL DEMO`。
5. 点击工位能进入详情，点击设备能打开设备信息。
6. 3D 场景九工位差异化，设备/产品点选、状态颜色、暂停恢复和布局编辑正常。
7. 模拟异常时质量门、设备状态、三维状态颜色和异常处置显示一致。
8. 关闭 3D 后 Web 组件被移除，phone、tablet 和横屏大屏均无关键内容遮挡。

## 8. 官方依据

- Stage 模型与工程结构：<https://developer.huawei.com/consumer/en/doc/harmonyos-guides/ide-project-structure>
- Stage 模型开发概述：<https://developer.huawei.com/consumer/cn/arkui/arkui-stage/>
- 多设备响应式布局：<https://developer.huawei.com/consumer/en/doc/best-practices/bpta-multi-device-screen-layout>
- ArkUI Previewer：<https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-previewer-arkui>
- Preferences 持久化：<https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/data-persistence-by-preferences>
- ArkWeb 本地页面与跳转拦截：<https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/web-redirection-and-browsing-history-mgmt>
- 应用侧调用前端页面函数：<https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/web-in-app-frontend-page-function-invoking>
- 坚盾守护模式的 WebGL 限制：<https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/web-secure-shield-mode>
