# 五个对话执行派发词

四个开发工作区已有未提交改动，分别执行补救；融合工作尚未开始，等四端交付后再做第一次正式集成。不要让开发对话直接拉取或 cherry-pick 总设计分支，以免覆盖工作树；让它们直接读取 E 盘公共文档，在自己的分支补救并提交。下面五段分别发送给对应对话。

## 1. 数字展板

```text
现在进入补救阶段，不要推倒重写，也不要 reset、覆盖或回退现有未提交改动。请直接读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\01-digital-display.md，并读取同目录根下最新 contracts、DEVELOPMENT_STANDARD.md、TESTING_TOOLCHAIN.md。先审计当前 D:\HarmonyOS-Dev\Workspaces\bottling-display 的现有实现和 git diff，列出 P0 已完成/缺失/证据不足，再按提示词逐项最小修复。必须调用 $deveco-cli；Three.js 独立测试入口可调用 $playwright，但最终必须在鸿蒙模拟器验证。完成构建、测试、截图和日志证据后提交并推送 codex/display，报告提交号和未通过项。中间不需要问我，遇到真实阻塞再说明。
```

## 2. 小屏终端

```text
现在进入补救阶段，不要推倒重写，也不要 reset、覆盖或回退现有未提交改动。请直接读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\02-workstation-terminal.md，并读取最新 contracts、DEVELOPMENT_STANDARD.md、TESTING_TOOLCHAIN.md。先审计 D:\HarmonyOS-Dev\Workspaces\bottling-terminal 的当前实现和 git diff，列 P0 已完成/缺失/证据不足，再最小修复。重点补当前环节先展示、与展板同一 StageSnapshot/stateVersion、未登录只读和四角色权限、九工位不同能力、命令 PENDING 到最终回执、ArkWeb 本地 Three.js 2D/3D 测试。必须调用 $deveco-cli；浏览器测试不能代替鸿蒙模拟器。完成后提交并推送 codex/terminal，报告测试证据、接口阻塞和提交号。
```

## 3. 后台管理

```text
现在进入补救阶段，不要推倒重写，也不要 reset、覆盖或回退现有未提交改动。请直接读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\03-admin-console.md，并读取最新 contracts、DEVELOPMENT_STANDARD.md、TESTING_TOOLCHAIN.md。审计 D:\HarmonyOS-Dev\Workspaces\bottling-admin 现有认证、导航、页面、ApiClient 和 git diff，先列 P0 已完成/缺失/证据不足/后端阻塞，再最小修复。重点补未登录及 VIEWER/OPERATOR/ENGINEER/ADMIN、真实导航页面、列表状态、写操作确认/失败/审计，不复制展板动画或小屏现场调参。必须调用 $deveco-cli 并在鸿蒙模拟器测试。完成后提交并推送 codex/admin，报告角色矩阵、测试证据、接口阻塞和提交号。
```

## 4. Spring Boot 后端

```text
现在进入补救阶段，不要重新搭骨架，也不要 reset、覆盖或回退现有未提交改动。请直接读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\04-backend.md，并读取最新 contracts、DEVELOPMENT_STANDARD.md、TESTING_TOOLCHAIN.md。审计 D:\HarmonyOS-Dev\Workspaces\bottling-backend 的 Controller、Service、持久化、事件发布、数据库脚本、测试和 git diff，列 P0 已完成/缺失/证据不足/兼容风险，再增量修复。重点补统一 LineSnapshot/StageSnapshot/stateVersion、目标 API、统一 WebSocket 信封、中央模拟、控制安全门、MySQL 持久化和三端一致性。Maven 已安装在 D 盘且仓库固定到 D:\HarmonyOS-Dev\Maven\repository。运行 mvn test 和 factory-demo HTTP/WebSocket 冒烟，完成后提交并推送 codex/backend，报告迁移、测试证据、风险和提交号。
```

## 5. 融合评审

```text
融合此前从未进行，现在先不要开始，等待 display、terminal、admin、backend 四个分支完成补救并分别提交、推送和报告测试证据。直接读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\05-integration-review.md，以及最新 contracts、DEVELOPMENT_STANDARD.md、TESTING_TOOLCHAIN.md。四端交付齐全后，从干净的 D:\HarmonyOS-Dev\Workspaces\bottling-integration 和 integration/full-system 基线开始第一次正式融合，按后端、展板、小屏、后台顺序逐个评审和合并，每次合并后单独测试。任何端 P0 不完整时给出文件、行为、复现步骤和契约依据并退回对应对话，不替它大规模开发。最终同时安装三个 HAP，用同一中央模拟场景验证三端相同 stateVersion、HTTP/WebSocket、控制回执、持久化和全流程，再决定是否创建 main PR。
```
