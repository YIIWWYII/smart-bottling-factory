# 六个对话执行派发词

数字展板、小屏、后台和后端工作区已有改动，分别执行增量补救；AI 协同端是新增工程；融合工作等五个开发分支交付后再开始。不要让开发对话直接拉取或 cherry-pick 总设计分支覆盖脏工作树，让它们直接读取 E 盘公共文档。

## 1. 数字展板

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-display 和 codex/display 增量补救，不要 reset、覆盖或回退现有改动。读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\01-digital-display.md、最新 contracts、DEVELOPMENT_STANDARD.md 和 TESTING_TOOLCHAIN.md。保持展板只读，只增加当前 AI 决策摘要所需的兼容显示，不复制 AI 协同端问答/资料功能。必须调用 $deveco-cli，完成构建、模拟器、Three.js 和断线测试后提交推送，报告提交号与证据。
```

## 2. 小屏终端

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-terminal 和 codex/terminal 增量补救，不要 reset、覆盖或回退现有改动。读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\02-workstation-terminal.md 和最新 contracts。重点补字段级人工覆盖：人工修改成功后形成 MANUAL_HOLD，显示锁定人/时间/原因/参数版本；AI 不得覆盖，版本冲突必须刷新。保持当前环节先展示、九工位能力和完整命令回执。必须调用 $deveco-cli，测试后提交推送并报告证据。
```

## 3. 后台管理

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-admin 和 codex/admin 增量补救，不要 reset、覆盖或回退现有改动。读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\03-admin-console.md、ai-decision-contract.md 和 knowledge-governance-contract.md。新增知识审核队列、来源/解析/冲突检查、批准/拒绝/撤销/索引状态和 KNOWLEDGE_REVIEW 鉴权；补 AI 字段级建议与人工跳过审计。不要复制 AI 协同端聊天和资料提交主界面。必须调用 $deveco-cli，测试后提交推送并报告证据。
```

## 4. Spring Boot 后端

```text
继续在 D:\HarmonyOS-Dev\Workspaces\bottling-backend 和 codex/backend 增量补救，不要重搭骨架或覆盖现有改动。读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\04-backend.md 及全部最新 contracts。纠正旧逻辑：AI 不是整线切型，而是基于瓶型和当前快照经 RAG、只读数据库校验生成字段级参数补丁；后端维护人工覆盖锁、参数版本和原子组，最终校验后才创建部分命令。实现 AI 问答转发、资料隔离上传、后台审核、批准后 MySQL/文档存储/向量索引和撤销。运行 mvn test 与 HTTP/WebSocket 冒烟后提交推送，报告迁移和证据。
```

## 5. AI 协同端

```text
新建独立鸿蒙 AI 协同端。工作区 D:\HarmonyOS-Dev\Workspaces\bottling-ai-assistant，分支 codex/ai-assistant，唯一写入 apps/ai-assistant/BottlingFactoryAI。读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\05-ai-assistant.md 和全部最新 contracts 后从零实现。原生 ArkUI 做登录、决策动态、AI 问答、资料提交和审核进度；只有实际设备/参数动画使用 ArkWeb 本地 Three.js。不得直连数据库、向量库、MQTT 或模型，不得控制设备或审核资料。必须调用 $deveco-cli，完成 HAP、模拟器和权限/断线/全状态测试后提交推送 codex/ai-assistant，报告证据。
```

## 6. 融合评审

```text
融合此前从未进行。等待 display、terminal、admin、ai-assistant、backend 五个分支分别提交、推送并报告测试证据后，再读取 E:\2026挑战杯\工业沙盘2026\数字展板前后端\docs\ai-prompts\06-integration-review.md 和最新 contracts。从干净的 integration/full-system 基线第一次正式融合，按后端、展板、小屏、后台、AI 协同端顺序逐个评审、合并和测试。额外验证人工覆盖阻止 AI、原子组安全、问答不触发命令、资料审核前不可检索、批准索引后可引用、撤销后停用。任何 P0 不完整都退回对应对话，不替它大规模开发。
```
