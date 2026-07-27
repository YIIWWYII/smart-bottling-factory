# 测试工具链与证据标准

本项目不把“能够编译”当作“功能通过”。四个鸿蒙 App、ArkWeb 中的 Three.js 页面和 Spring Boot 后端必须分层测试，最后再做四前端同时在线的端到端联调。

## 已确认的本机工具

| 工具 | 位置/调用 | 负责范围 | 不能代替 |
| --- | --- | --- | --- |
| DevEco CLI Skill | `$deveco-cli`，`D:\Codex\.codex\skills\deveco-cli\SKILL.md` | 鸿蒙工程检查、构建、安装、启动、设备和日志 | Test Kit 用例设计、人工视觉验收 |
| 官方 DevEco CLI MCP | Codex MCP 名 `deveco-cli`，已注册 | 由 AI 调用官方 CLI、设备和官方文档能力 | 第三方“自动修好”插件 |
| DevEco Studio/Test Kit | 已安装 DevEco Studio，工程 `ohosTest`/Local Test | ArkTS 单元测试、设备/模拟器 Instrument Test、UI 自动化 | ArkWeb 内部 WebGL 像素验证 |
| HDC | `D:\HarmonyOS-Dev\DevEco-Studio\IDE\DevEco Studio\sdk\default\openharmony\toolchains\hdc.exe` | 设备连接、安装辅助、`hilog` 和故障取证 | 业务断言 |
| Playwright Skill | `$playwright` | 可独立打开的本地 Three.js 测试页、Swagger/辅助 Web 页 | 鸿蒙 ArkUI、ArkWeb 真机兼容性 |
| browser-harness | `$browser-harness` | 浏览器交互、DOM 和截图辅助验证 | 鸿蒙模拟器 UI 测试 |
| Computer Use | `$computer-use:computer-use` | CLI 无法完成的 DevEco Test Runner、模拟器和视觉检查 | 日常文件编辑和普通构建 |
| Maven/JUnit | Maven 3.9.16：`D:\HarmonyOS-Dev\Tools\apache-maven-3.9.16`，项目 `pom.xml` | Spring Boot 单元、集成和契约测试 | 四个鸿蒙 App 的运行验证 |

`DevEco Testing` 是独立的大型测试平台，官方环境说明需要约 100GB 磁盘。本项目当前先使用 SDK 自带 Test Kit、模拟器和 HDC，不把它设为开发前置条件，也不安装到 C 盘。

## D 盘约束

- DevEco SDK、模拟器、构建暂存和日志继续放在 `D:\HarmonyOS-Dev`。
- Maven 安装和本地仓库使用 `D:\HarmonyOS-Dev\Tools` 与 `D:\HarmonyOS-Dev\Maven\repository`。
- 用户环境已设置 `MAVEN_HOME`、`M2_HOME`、`MAVEN_OPTS` 和 Maven `Path`；打开新终端后运行 `mvn -version` 验证。
- Playwright 只通过已有 Skill 按需运行；不得在 C 盘全局安装浏览器和重复依赖。
- 测试截图、日志和报告写入各工作区 `artifacts/test/` 或 D 盘临时目录，不提交大体积二进制。

## 鸿蒙 App 分层测试

### 1. 构建门

先调用 `$deveco-cli`，确认版本、设备和工程配置，再在各自 D 盘英文目录构建。必须同时看到 `BUILD SUCCESSFUL` 和实际 `.hap` 文件。构建警告单独记录，不能用“无报错截图”代替日志。

```powershell
$cli = 'D:\HarmonyOS-Dev\npm-global\devecocli.cmd'
& $cli --version
& $cli device list
& $cli build --modules entry --build-mode debug
```

### 2. ArkTS 单元与 UI 测试

- 纯模型、解析器、状态归并、权限判断和参数范围使用 Local Test。
- 页面导航、按钮、滚动、登录、弹窗、禁用态和触控操作使用 Test Kit Instrument/UI Test，测试代码放工程标准的 `ohosTest` 目录并运行在模拟器/设备上。
- 当前 `devecocli 1.2.0-stable` 没有独立 `test` 子命令。不得虚构命令；优先用工程已有 Hvigor 测试任务，任务不明确时用 DevEco Studio Test Runner，并把操作和结果写入测试报告。
- UI 测试必须按稳定的组件 `id`/语义查找，禁止依赖屏幕绝对坐标作为主要断言。

### 3. ArkWeb 与 Three.js

展板、小屏以及 AI 协同端可选的设备/参数动画需要两层验证：

1. 在鸿蒙模拟器内确认 `Web` 成功加载 HAP `rawfile`，JavaScript bridge 能收发 `stateVersion` 和快照。
2. 开发构建开启 ArkWeb Web 调试，检查 Console、Network、WebGL 上下文和未处理异常；发布构建关闭调试。
3. Three.js 页面提供仅在开发构建启用的 `window.__factoryTest__` 只读探针，至少暴露 `ready`、`mode`、`stateVersion`、`rendererInfo`、当前设备/产品数量、暂停状态和最近错误。
4. 不能只判断 canvas 元素存在。至少渲染一帧后检查 canvas 宽高大于 0、非背景像素数量大于阈值、`renderer.info.render.calls > 0`，并保存截图证据。
5. 2D 与 3D 在相同 `stateVersion` 下设备、产品、速度、进度和状态一致；2D 的 `mode` 必须为平面工艺场景，不能只是 3D 相机俯视。
6. 暂停后画面冻结但数据连接不断；恢复后直接应用最新版本。关闭某视图后停止其动画帧并释放渲染器、几何体、材质和纹理。

若 rawfile 页面有不依赖 ArkWeb 专有桥的浏览器测试入口，可调用 `$playwright` 做 canvas 像素、点击、拖拽和截图回归；该结果只能证明 Web 层，最终仍须在鸿蒙模拟器复测。

### 4. 运行日志

```powershell
$hdc = 'D:\HarmonyOS-Dev\DevEco-Studio\IDE\DevEco Studio\sdk\default\openharmony\toolchains\hdc.exe'
& $hdc list targets
& $hdc shell hilogcat
```

优先调用 `$deveco-cli` 的 `run`/`log`。只有测试运行器、模拟器窗口或 Web 调试面板必须操作 UI 时才调用 Computer Use。

## 各前端最低测试集

### 数字展板

- 启动无需登录并进入总览；九工序可点击导航，所有页面可滚动。
- 2D/3D 均非空、模式不同、同快照联动；暂停、恢复、开关、着色、拖拽、设备/物料详情有效。
- HTTP 首屏、WebSocket 增量、版本跳跃补拉、断线重连和 `LOCAL DEMO` 标识有效。
- 空数组、缺字段、未知状态、后端 5xx 和超时不崩溃，不显示假成功。

### 小屏终端

- 当前环节完整状态在控制区之前，并与展板同工位同版本一致。
- 未登录只读；VIEWER、OPERATOR、ENGINEER、ADMIN 权限边界正确，token 过期回到只读。
- 九工位能力矩阵不同；单位、范围、步长、联锁和禁用原因来自后端能力。
- 命令从 `PENDING` 到 `ACKNOWLEDGED/FAILED/TIMEOUT/CANCELLED`，HTTP 受理不显示执行成功。
- 额外执行数字展板同等的 ArkWeb/Three.js 验证。

### 后台管理

- 未登录拦截，注册、登录、会话恢复、退出和 token 过期有效。
- VIEWER、OPERATOR、ENGINEER、ADMIN 的菜单、读写和危险操作矩阵正确，后端仍做最终鉴权。
- 每个导航有真实页面；列表的加载、空、错误、筛选、分页和详情状态完整。
- 配方、阈值、生产任务、异常、物流仓储、AI、知识审核与操作审计写操作有确认、失败反馈和审计号。
- 知识审核覆盖批准、拒绝、撤销、提交人不可自审、冲突提示和索引失败；批准前资料不得用于 RAG。
- Playwright 仅用于后端 Swagger/辅助 Web 页面，不得替代 ArkUI 模拟器测试。

### AI 协同端

- 登录、会话恢复、VIEWER 问答和 `KNOWLEDGE_SUBMIT` 上传权限正确；本端没有知识批准和设备控制入口。
- 决策详情能区分建议、后端受理和设备回执；人工覆盖字段显示锁定人/时间/原因，且没有强制覆盖操作。
- 问答覆盖历史、流式片段、引用、无依据回答、断线重连和失败重试；控制类自然语言不会创建命令。
- 上传覆盖文件校验、重复文件、处理中、待审核、批准、拒绝、索引失败和最终 `INDEXED`；审核前内容不出现在检索结果。
- 原生 ArkUI 页面可滚动且不被键盘遮挡；若使用 Three.js，执行 canvas 非空、资源释放和鸿蒙模拟器复测。

## 后端测试

后端使用 Maven、JUnit/Spring Boot Test 和可复现的 PowerShell/Node 冒烟脚本。先运行单元/集成测试，再用 `factory-demo` 启动服务。

```powershell
$env:MAVEN_OPTS = '-Dmaven.repo.local=D:\HarmonyOS-Dev\Maven\repository'
mvn test
mvn -DskipTests package
```

最低覆盖：统一 HTTP 响应、认证/RBAC、MySQL 重启持久化、Redis 非事实源、MQTT 与中央模拟切换、统一 WebSocket 信封、命令安全门/幂等/超时/回执、AI 字段级补丁、人工覆盖锁、参数版本竞态、原子组、知识审核与向量索引、问答不会触发控制、九工序并行、局部异常影响、AGV/仓储和服务重启恢复。Testcontainers 只有在项目已采用且 D 盘缓存配置完成后使用，不擅自把 Docker 变成前置条件。

## 融合证据

每个开发对话交付：提交号、测试命令、成功/失败计数、HAP 或 JAR 路径、模拟器截图、关键日志、未通过项和复现步骤。融合对话必须同时安装四个不同 bundleName 的 HAP，用同一后端中央模拟场景核对相同 `stateVersion`、AI 决策、人工覆盖和知识审核状态；任一 P0 或关键测试失败不得合入 `main`。

## 官方依据

- [HarmonyOS Test Kit 简介](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/test-kit-overview-V13)
- [DevEco Studio 代码测试](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-code-test-V13)
- [HarmonyOS ArkTS HiLog](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/hilog-guidelines-arkts-V13)
- [DevEco Testing](https://developer.huawei.com/consumer/cn/deveco-testing/)
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
