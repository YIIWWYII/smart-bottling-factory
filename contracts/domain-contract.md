# 领域数据契约

## 工序代码

`PRETREATMENT`、`GAS_INSPECTION`、`APPEARANCE_INSPECTION`、`BEVERAGE_READY`、`FILLING`、`SECONDARY_INSPECTION`、`PACKING`、`AGV_TRANSPORT`、`WAREHOUSE_INBOUND`。

工序是连续流水、并行运行的独立业务单元，通过输入/输出缓冲解耦。问题可触发剔除、局部暂停、返工、缓冲或人工处置，不应默认整线停机。

## 状态枚举

- 设备：`RUNNING`、`STANDBY`、`ALARM`、`OFFLINE`、`MAINTENANCE`。
- 工位：`RUNNING`、`HOLD`、`BLOCKED`、`STARVED`、`OFFLINE`。
- 产品：`RUNNING`、`HOLD`、`REJECTED`、`COMPLETED`。
- 质量门：`PASS`、`FAIL`、`WAIT`。
- 命令：`PENDING`、`SENT`、`ACKNOWLEDGED`、`FAILED`、`CANCELLED`、`TIMEOUT`。
- 数据模式：`MQTT`、`SIMULATION`；单设备降级必须带 `fallback=true`。
- AI 决策：`COLLECTING_CONTEXT`、`RETRIEVING`、`VALIDATING`、`PROPOSED`、`PARTIALLY_BLOCKED`、`BLOCKED`、`APPROVAL_REQUIRED`、`COMMAND_PENDING`、`APPLIED`、`FAILED`、`STALE`。
- 知识资料：`UPLOADED`、`PROCESSING`、`PENDING_REVIEW`、`APPROVED`、`INGESTING`、`INDEXED`、`REJECTED`、`FAILED`、`SUPERSEDED`、`REVOKED`。

未知状态显示“未知”，不得默认涂成绿色。

## 核心对象最低字段

- `FactoryRun`：追踪号、瓶型、批次、当前工序、状态、箱码、AGV、仓位、事件链和更新时间。
- `RuntimeDevice`：设备、工序、状态、来源、fallback、速度、进度、参数所有权/版本和上报时间。
- `RuntimeStage`：工序、状态、缓冲占用/容量、上下游影响和更新时间。
- `SensorReading`：读数 ID、设备、类型、值、单位、质量、模式、工序、产品和时间。
- `FactoryIncident`：异常 ID、工序、设备、策略、状态、目标工序、上下游影响和时间。
- `DeviceCommand`：命令 ID、客户端请求号、设备、类型、参数、来源、AI 决策、操作者、状态、消息和回执时间。
- `AgvTask`：车辆、箱码、起终点、距离、速度、负载、超声波距离、状态、模式和时间。
- `ParameterState`：参数编码、值、单位、所有者来源、人工/安全锁、锁定人/原因、参数版本和原子组。
- `VisionInference`：推理 ID、任务类型、摄像头、产线/工序、可选产品追踪号、采集时间、瓶型、缺陷列表、置信度、证据引用、模型版本、推理状态和耗时。原始图片默认保留在视觉服务或对象存储中，提交给生产后端的只能是结构化结果和受控证据引用。
- `AiDecision`：识别瓶型、上下文版本、知识引用、数据库校验、字段级建议、阻止字段、命令和回执。
- `KnowledgeSubmission`：文件、来源、适用范围、提交人、审核记录、知识版本和索引状态。
- `AssistantContext`：遵循 `assistant-host-contract.md`，包含来源应用、页面路由、产线、可选工序/设备/产品、事实版本/时间、稳定实体选择和上下文采集时间。身份令牌必须放在 `Authorization` 请求头中，不得写入上下文、消息正文或持久化字段。
- `AssistantConversation`：会话 ID、用户 ID、来源应用、可访问产线/工序范围、标题、创建时间和更新时间。
- `AssistantMessage`：消息 ID、会话 ID、角色、问询类型（自由或选中）、问题、`AssistantContext`、回答模式（实时、RAG 或混合）、数据时间、事实 `stateVersion`、知识版本、引用、工具调用摘要和创建时间。

## AI 上下文约束

1. `sourceApp` 只能是 `DISPLAY`、`WORKSTATION`、`ADMIN`；AI 中枢必须根据真实登录身份和权限重新裁剪上下文，不能信任前端自报的 `userRole` 或实体范围。
2. 选择对象遵循 `AssistantSelection`，至少支持 `TEXT_FRAGMENT`、`LINE`、`STAGE`、`KPI`、`ALARM`、`INCIDENT`、`DEVICE`、`PRODUCT`、`PARAMETER`、真实表格行领域类型和 `KNOWLEDGE_DOCUMENT`。稳定 ID 规则以 `assistant-host-contract.md` 为准；Three.js 对象通过 JS Bridge 上报同一业务 ID。
3. 实时或混合回答必须返回事实数据时间和实际使用的 `stateVersion`；收到过期版本时，AI 中枢先通过生产后端只读接口补取最新快照。
4. RAG 或混合回答必须返回可核验引用和知识版本；未审核、已拒绝、已撤销或已被替代的资料不得参与检索。
5. 助手消息只能形成回答和建议，不能创建 `DeviceCommand` 或 `command-intent`。隐式决策是独立流程，只有它能生成字段级命令意图，并仍由 Spring Boot 完成安全校验和执行。

## 可视化映射

运行/合格绿色，待机/等待黄色，报警/不合格红色，离线灰色。着色可关闭，但文本状态保留。点击设备关联设备对象，点击物料关联 `traceCode`，不能只是装饰模型。
