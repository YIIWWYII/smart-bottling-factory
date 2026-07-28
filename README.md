# 智慧装瓶工厂前后端

本仓库目标包含五个独立工程：三个鸿蒙前端、Spring Boot 生产后端和独立 AI 中枢；“融合评审”只是第六个 Codex 对话，不是第六个程序。

| 工程 | 目录 | 应用标识 | 职责 |
| --- | --- | --- | --- |
| 数字展板 | `apps/digital-display/BottlingFactoryDisplay` | `com.factory.bottling.display` | 全局总览、工位详情、2D/3D 动态可视化，只读 |
| 小屏终端 | `apps/workstation-terminal/BottlingFactoryTerminal` | `com.factory.bottling.terminal` | 本工位状态、设备参数、受控操作和命令结果 |
| 后台管理 | `apps/admin-console/BottlingFactoryAdmin` | `com.factory.bottling.admin` | 登录认证、运营管理、异常处置、权限和审计 |
| 后端 | `services/backend/hdc_server` | Spring Boot | 业务中枢、持久化、实时推送、设备与 AI 外部接口 |
| AI 中枢 | `services/ai-center` | Python AI service | 视觉识别、隐式决策、上下文问答、RAG、MCP 和知识治理 |

共同接口真相源在 [contracts/README.md](contracts/README.md)，工程边界和合并门槛在 [docs/engineering/DEVELOPMENT_STANDARD.md](docs/engineering/DEVELOPMENT_STANDARD.md)，六个对话提示词在 `docs/ai-prompts/`。

## 开发原则

1. 一个开发对话只修改一个工程目录，并使用独立物理工作区和独立分支。
2. 三个鸿蒙应用保持独立，不重新合并成入口选择器；三端均内嵌上下文 AI 助手，但展示范围由当前应用、页面、用户权限和选中对象决定。
3. 公共契约只能通过明确的契约变更提案修改，前端不得猜测字段。
4. 数字展板和小屏的 2D、3D 都通过 HarmonyOS ArkWeb 的 `Web` 组件内嵌 HAP 本地 Three.js 实现；2D 是独立平面工艺图，不是 3D 俯视角。
5. AI 助手使用原生 ArkUI 侧栏/抽屉；支持自由问询，以及对文字、表格行、参数卡片和 Three.js 设备/物料的选中问询。
6. 视觉识别、隐式决策、问答、RAG、MCP 和知识库归 AI 中枢；Spring Boot 不实现模型、提示词、向量检索或文档切分。
7. AI 只提交字段级参数命令意图，Spring Boot 执行最终权限、人工锁、版本、范围和联锁校验；设备 ACK 后才算执行成功。
8. 用户资料在后台管理上传和审核，只有 AI 中枢完成正式发布与索引后才能参与 RAG。
9. 无 MQTT 数据时允许明确标识的 `SIMULATION`/`LOCAL DEMO`，不得伪装成实机数据。
10. `main` 只通过融合评审后的 PR 更新，禁止开发对话直接推送。

## 环境约束

- DevEco、SDK、模拟器、依赖缓存、构建暂存和工作区都放在 `D:\HarmonyOS-Dev`，不占用 C 盘。
- 鸿蒙构建使用 `D:\Codex\.codex\skills\deveco-cli\scripts\build-harmony.ps1`。
- DevEco/Hvigor/ArkTS 问题先查 `D:\HarmonyOS-Dev\Logs\devecocli-official-docs.md`，再查 `devecocli docs`，最后查华为官方在线文档。
