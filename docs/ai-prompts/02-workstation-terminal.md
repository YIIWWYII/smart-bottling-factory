# 小屏工位终端补救开发对话提示词

你负责鸿蒙小屏工位终端。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-terminal`，分支是 `codex/terminal`，唯一业务写入范围是 `apps/workstation-terminal/BottlingFactoryTerminal`。不要修改数字展板、后台管理、AI 协同端或后端。

## 当前阶段

该工程已经完成一轮开发且可能存在未提交修改。先审计和补救，不推倒重写。读取 `git diff`、现有页面、Repository、控制组件和 rawfile，保护已有成果；禁止硬重置、覆盖工作树或复制旧骨架。先给出 P0 已完成、缺失、证据不足清单，再按风险从高到低修复。

## 先做

阅读根 README、`contracts/`、开发标准、`docs/engineering/TESTING_TOOLCHAIN.md` 和本工程 README；核对 Git 状态。必须调用 `$deveco-cli`，会话可见时优先使用官方 `deveco-cli` MCP；所有 SDK、缓存、构建和日志留在 D 盘。Three.js 独立测试入口调用 `$playwright`，但仍须模拟器复测；仅在 CLI 无法完成 Test Runner/模拟器 UI 时调用 `$computer-use:computer-use`。遇错执行“本地开发日志、CLI 本地文档、华为官方文档”的顺序。

## 目标

把骨架做成现场 HMI：启动后直接进入设备绑定的当前环节；未绑定时先选择工位。当前环节首页必须先完整展示该环节的名称、运行状态、实时作业画面、设备、在制品、传感器、质量门、报警、缓冲和上下游影响，展示内容和数字展板对应工位一致；参数调整与控制区排在当前环节展示之后。本站只负责当前环节，不做全厂管理。

工位可视化与数字展板对应工位使用同一后端契约、字段、状态和实时数据。2D 与 3D 都必须通过 HarmonyOS ArkWeb 的 `Web` 组件加载 HAP `rawfile` 中的本地 HTML/JavaScript/Three.js，不是 ArkUI 原生动画，也不访问在线网页或 CDN。2D 是独立平面工艺动画，3D 是立体动画，并满足同数据驱动、独立开关、暂停恢复、状态着色、布局拖拽、设备/物料点击。不要把 2D 做成 3D 俯视。

逐工位设计控制项，不能复制一套通用面板：预处理控制清洗/风洗/静置；气检控制采样与阈值相关允许项；外观检测控制相机/光源/剔除；饮料准备控制搅拌、加热和目标温度；灌装控制泵、阀、灌装量与节拍；二检控制相机/液位/剔除；装箱控制机械臂、箱型与摆放方案；AGV 控制任务、速度上限和调度请求；仓储控制入库、库位和安全处置。所有参数以设备能力/后端契约为准，显示单位、范围、步长、当前值、目标值和来源。

控制闭环：编辑、前端校验、风险提示和二次确认、HTTP 创建命令、显示 PENDING、等待 WebSocket/HTTP 回执、显示 ACKNOWLEDGED/FAILED/TIMEOUT 和审计号。人工修改成功后显示该字段的 `MANUAL_HOLD`、锁定人、时间、原因和参数版本；AI 建议不得覆盖该字段。设备离线、报警、质量门失败、权限不足或后端不可达时禁用危险操作。演示模式只能只读。

## 补救顺序

1. 先确认当前环节完整展示位于控制区之前，并与展板使用同一 `StageSnapshot/stateVersion`。
2. 按 `control-security-contract.md` 补客户端身份、未登录只读、操作员登录、token 过期降级和 VIEWER/OPERATOR/ENGINEER/ADMIN 权限。
3. 逐工位核对设备能力与控制项；删除虚构通用参数。安全阈值只读，小屏只提交批准范围内的运行设定值。
4. 按 `ai-decision-contract.md` 补字段级人工覆盖：修改后创建锁、按权限释放、显示 AI 跳过原因，版本冲突时要求刷新而不是覆盖。
5. 补完整命令状态机和失败路径；现有后端缺端点时显示不可用并提交契约提案，不准本地伪造 ACK。
6. 对 ArkWeb/Three.js 做与展板相同的 canvas、同快照、暂停恢复、资源释放测试。

## 禁止

- 不做全局数字展板、用户管理、报表或后台配置中心。
- 不直接连接 MQTT，不绕过后端控制硬件，不把 HTTP 200 当执行成功。
- 不伪造控制成功，不隐藏失败和联锁原因。

## 验收与交付

满足小屏 P0，对九工位分别做参数/控制矩阵测试。按 `TESTING_TOOLCHAIN.md` 补 Local Test、Test Kit/模拟器和 Three.js 证据；使用构建目录 `D:\HarmonyOS-Dev\Build\BottlingFactoryTerminal`，验证 HAP、当前环节优先、2D/3D 非空且同版本、数据断线、身份权限和完整命令状态机。提交并推送 `codex/terminal`，报告提交号、测试命令与计数、截图/日志、风险和契约提案，不推 `main`。
