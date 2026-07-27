# 智慧装瓶工厂前后端

本仓库目标包含五个独立工程。四个鸿蒙应用都是前端，Spring Boot 是唯一后端；“融合评审”只是第六个 Codex 对话，不是第六个程序。

| 工程 | 目录 | 应用标识 | 职责 |
| --- | --- | --- | --- |
| 数字展板 | `apps/digital-display/BottlingFactoryDisplay` | `com.factory.bottling.display` | 全局总览、工位详情、2D/3D 动态可视化，只读 |
| 小屏终端 | `apps/workstation-terminal/BottlingFactoryTerminal` | `com.factory.bottling.terminal` | 本工位状态、设备参数、受控操作和命令结果 |
| 后台管理 | `apps/admin-console/BottlingFactoryAdmin` | `com.factory.bottling.admin` | 登录认证、运营管理、异常处置、权限和审计 |
| AI 协同端 | `apps/ai-assistant/BottlingFactoryAI` | `com.factory.bottling.aiassistant` | AI 决策链展示、知识问答、资料提交和审核进度 |
| 后端 | `services/backend/hdc_server` | Spring Boot | 业务中枢、持久化、实时推送、设备与 AI 外部接口 |

共同接口真相源在 [contracts/README.md](contracts/README.md)，工程边界和合并门槛在 [docs/engineering/DEVELOPMENT_STANDARD.md](docs/engineering/DEVELOPMENT_STANDARD.md)，六个对话提示词在 `docs/ai-prompts/`。

## 开发原则

1. 一个开发对话只修改一个工程目录，并使用独立物理工作区和独立分支。
2. 四个鸿蒙应用保持独立，不重新合并成入口选择器；AI 协同端只提示资料需在后台审核，不在自身提供审核能力。
3. 公共契约只能通过明确的契约变更提案修改，前端不得猜测字段。
4. 数字展板和小屏的 2D、3D 都通过 HarmonyOS ArkWeb 的 `Web` 组件内嵌 HAP 本地 Three.js 实现；2D 是独立平面工艺图，不是 3D 俯视角。
5. AI 协同端以 ArkUI 原生页面为主，只有实际设备、物料或参数联动动画使用 ArkWeb 本地 Three.js；聊天和资料页面不能做成 Web 壳。
6. AI 只提出字段级参数补丁，后端执行最终校验；人工覆盖字段和安全锁永远优先。
7. 用户资料必须经过后台人工审核并成功索引后，才能进入正式数据库和 RAG。
8. 无 MQTT 数据时允许明确标识的 `SIMULATION`/`LOCAL DEMO`，不得伪装成实机数据。
9. `main` 只通过融合评审后的 PR 更新，禁止开发对话直接推送。

## 环境约束

- DevEco、SDK、模拟器、依赖缓存、构建暂存和工作区都放在 `D:\HarmonyOS-Dev`，不占用 C 盘。
- 鸿蒙构建使用 `D:\Codex\.codex\skills\deveco-cli\scripts\build-harmony.ps1`。
- DevEco/Hvigor/ArkTS 问题先查 `D:\HarmonyOS-Dev\Logs\devecocli-official-docs.md`，再查 `devecocli docs`，最后查华为官方在线文档。
