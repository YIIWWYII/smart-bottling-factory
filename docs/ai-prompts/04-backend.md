# Spring Boot 后端补救开发对话提示词

你负责唯一 Spring Boot 后端。工作区是 `D:\HarmonyOS-Dev\Workspaces\bottling-backend`，分支是 `codex/backend`，唯一业务写入范围是 `services/backend/hdc_server`。不要修改四个鸿蒙 App。后端不使用 ArkTS，也不使用 `devecocli` 构建。

## 当前阶段

后端已经完成一轮开发且可能存在未提交修改。先审计现有 Controller、Service、持久化、实时发布和测试，再做补救，不重新搭骨架。检查 `git diff`、数据库脚本和配置，保护已有代码与数据；禁止硬重置、覆盖工作树或用内存实现替换已经存在的持久化。先输出 P0 已完成、缺失、证据不足和兼容风险清单。

## 先做

阅读根 README、`contracts/`、开发标准、`docs/engineering/TESTING_TOOLCHAIN.md` 和后端 README；检查 Git、Java、Maven、配置和现有测试。后端使用 Maven/JUnit/Spring Boot Test，不调用 `devecocli`；HTTP 冒烟可用 PowerShell/curl，WebSocket 冒烟使用可复现 Node/Java 客户端，Swagger 辅助页可调用 `$playwright` 或 `$browser-harness`。不得把数据库、Maven 缓存或运行文件新增到 C 盘；保护现有配置和用户数据。

## 目标

把现有服务完善成产线业务中枢，而不是单纯 CRUD：

1. 接收 MQTT/外部 HTTP 遥测，规范化设备、传感器、视觉识别、AGV 和仓区安全数据。
2. 维护九工序连续流水状态、产品追踪、质量门、缓冲、设备、异常、命令、物流和仓储。
3. MQTT 实机优先；按设备检测超时后才降级模拟并标记 `source=SIMULATION`、`fallback=true`，恢复后平滑切回。
4. MySQL 持久化产品/事件、遥测历史、报警/异常、命令/回执、AI 审计、AGV 任务、库存/库位、用户/角色、阈值和参数版本。Redis 只做热点快照、会话、幂等和实时协调，不代替事实数据库。
5. 设备命令执行 RBAC、参数范围、在线状态、质量门/安全联锁、客户端请求号幂等、超时和回执。记录操作者、旧值、新值、理由和最终结果。
6. 异常策略支持剔除、局部暂停、返工、缓冲和人工处置，明确对产品、设备、本站和上下游影响，避免默认整线停机。
7. 按 `contracts` 提供 HTTP 快照和 WebSocket 事件；首屏不依赖 WebSocket。兼容现有事件后再迁移到统一信封。
8. AI 决策不是整线切型。按 `ai-decision-contract.md` 汇总瓶型识别和当前快照，调用 RAG/MCP/模型，接收字段级参数补丁；AI 通过后端只读工具查询结构化数据库，不持有数据库写权限。
9. 后端维护每个参数的所有权、`MANUAL_HOLD/SAFETY_LOCK`、参数版本和原子组。人工修改过的字段 AI 必须跳过；执行前再次校验最新版本，只向边缘层发送允许的部分命令。
10. 按 `knowledge-governance-contract.md` 接收 AI 协同端资料：隔离存储、解析、创建后台审核任务；批准后才写正式 MySQL/文档存储并建立向量索引。待审核资料不得参与 RAG。
11. AI 问答会话和流式事件通过后端鉴权、转发和留痕；普通自然语言消息绝不能自动转换为设备命令。

## 补救顺序

1. 对照 `client-capability-matrix.md` 检查每个前端功能是否有真实数据源或命令接收端。
2. 对照 API 契约区分当前兼容接口和 P0 目标接口；先保持旧端兼容，再补快照、能力、工单、规则、配置、审计、报表和中央模拟接口。
3. 统一生成 `LineSnapshot`、`StageSnapshot` 和单调递增 `stateVersion`；四个前端不得从不同随机源得到位置、速度、参数锁和 KPI。
4. 按实时契约统一事件信封，并在迁移期兼容旧事件；补物流、仓储、产品、质量门、工单、配置、模拟和 AI 事件消费者所需字段。
5. 按控制与 AI 契约补客户端身份、角色、安全阈值、参数所有权、人工覆盖、乐观锁、原子组和命令最终状态；HTTP 受理只返回 `PENDING`。
6. 补 AI 会话、资料提交、后台审核、正式入库、向量索引和撤销接口；关系库保留不可抵赖审核记录。
7. 先补自动化测试再修实现，确保失败用例能够重现问题；不把 Docker/Testcontainers 强行设为前置条件。

## 禁止

- 不把前端模拟数据当事实写入生产库，不静默吞错，不返回假成功。
- 不让 Controller 直接实现复杂业务或直接耦合 UI。
- 不把 Redis 当唯一存储，不在 Git 提交真实密码、令牌或生产地址。
- 不改变契约而不提供迁移和四前端影响说明。

## 验收与交付

满足后端 P0。运行 `mvn test`，增加持久化重启、命令安全门/幂等/超时/回执、字段级 AI 补丁、人工覆盖竞态、原子组、资料审核/索引、问答不触发控制、模拟/MQTT 切换、快照和 WebSocket 契约测试。使用 `factory-demo` 启动并提供可复现的 HTTP/WebSocket 冒烟脚本。提交并推送 `codex/backend`，报告提交号、数据库迁移、接口变化、测试命令与计数、失败证据、风险和契约提案，不推 `main`。
