# Spring Boot 后端开发对话提示词
满足后端 P0。运行 `mvn test`，增加服务单元测试、持久化重启测试、命令安全门/幂等/超时测试、模拟与 MQTT 切换测试、WebSocket 契约测试。使用 `factory-demo` 启动并提供可复现的 HTTP/WebSocket 冒烟脚本。提交并推送 `codex/backend`，报告提交号、数据库迁移、接口变化、测试、风险和契约提案，不推 `main`。
你负责唯一 Spring Boot 后端。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-backend`，分支是 `codex/backend`，唯一业务写入范围是 `services/backend/hdc_server`。不要修改三个鸿蒙 App。后端不使用 ArkTS，也不使用 `devecocli` 构建。

## 先做

阅读根 README、`contracts/`、开发标准和后端 README；检查 Git、Java、Maven、配置和现有测试。不得把数据库、Maven 缓存或运行文件新增到 C 盘；保护现有配置和用户数据。

## 目标

把现有服务完善成产线业务中枢，而不是单纯 CRUD：

1. 接收 MQTT/外部 HTTP 遥测，规范化设备、传感器、视觉识别、AGV 和仓区安全数据。
2. 维护九工序连续流水状态、产品追踪、质量门、缓冲、设备、异常、命令、物流和仓储。
3. MQTT 实机优先；按设备检测超时后才降级模拟并标记 `source=SIMULATION`、`fallback=true`，恢复后平滑切回。
4. MySQL 持久化产品/事件、遥测历史、报警/异常、命令/回执、AI 审计、AGV 任务、库存/库位、用户/角色、阈值和参数版本。Redis 只做热点快照、会话、幂等和实时协调，不代替事实数据库。
5. 设备命令执行 RBAC、参数范围、在线状态、质量门/安全联锁、客户端请求号幂等、超时和回执。记录操作者、旧值、新值、理由和最终结果。
6. 异常策略支持剔除、局部暂停、返工、缓冲和人工处置，明确对产品、设备、本站和上下游影响，避免默认整线停机。
7. 按 `contracts` 提供 HTTP 快照和 WebSocket 事件；首屏不依赖 WebSocket。兼容现有事件后再迁移到统一信封。
8. AI 决策中枢通过清晰的外部端口接 RAG/MCP/模型：记录输入、知识版本、召回依据、数据库校验、建议、审批、设备命令和回执。AI 不得绕过后端安全门直接控制硬件。

## 禁止

- 不把前端模拟数据当事实写入生产库，不静默吞错，不返回假成功。
- 不让 Controller 直接实现复杂业务或直接耦合 UI。
- 不把 Redis 当唯一存储，不在 Git 提交真实密码、令牌或生产地址。
- 不改变契约而不提供迁移和三端影响说明。

## 验收与交付

满足后端 P0。运行 `mvn test`，增加服务单元测试、持久化重启测试、命令安全门/幂等/超时测试、模拟与 MQTT 切换测试、WebSocket 契约测试。使用 `factory-demo` 启动并提供可复现的 HTTP/WebSocket 冒烟脚本。提交并推送 `codex/backend`，报告提交号、数据库迁移、接口变化、测试、风险和契约提案，不推 `main`。
