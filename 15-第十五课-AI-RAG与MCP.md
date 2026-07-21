# 第十五课：AI、RAG与MCP

## 本节学习路线

### 这是什么

AI服务是参数决策和工艺解释模块。RAG从本地文档找依据，MCP让AI调用受控工具，MySQL提供准确结构化数值，Spring Boot做最终安全校验。

### 为什么要学

AI不能凭记忆改产线参数。你们需要展示AI为什么这样建议、查了哪些文档、读了哪些数据库值、后端为什么接受或拒绝。

### 它在项目中的位置

Spring Boot提供生产上下文 → Python AI服务 → RAG知识库 → MCP只读或受控工具 → 返回结构化建议 → Spring Boot二次校验 → 人工确认或设备命令。

AI服务独立于Spring Boot部署，但业务权限和设备控制权仍在Spring Boot。

### 需要的软件与安装

- Python 3.x和E盘虚拟环境。
- FastAPI和Uvicorn：AI接口。
- 文档解析库：读取Markdown、PDF或Word。
- Chroma或FAISS：本地向量检索，第一版选一种。
- 在线API或本地模型：根据网络和电脑配置选择。
- VS Code：编辑知识库、提示词、JSON Schema和Python。

知识库、向量索引、模型和日志放E盘。模型和在线API不能同时假定可用，比赛前必须准备缓存或规则降级。

### 最小例子

准备一份PLA-500文档，输入“为什么要水洗”，先只返回文档名、章节和匹配片段。检索正确后再接模型。再让AI返回固定PROPOSAL JSON，最后才接MCP工具。

### 项目实操顺序

1. 整理三份有版本元数据的工艺文档。
2. 建立本地向量索引。
3. 验证检索片段和引用。
4. 创建FastAPI AI健康接口。
5. 创建固定AI决策接口。
6. 实现get_bottle_type。
7. 实现get_active_recipe、get_safety_limits和get_device_status。
8. 让AI输出JSON Schema允许的PROPOSAL或NEED_REVIEW。
9. Spring Boot重新查数据库上下限。
10. 管理端显示依据、工具调用、建议和校验结果。
11. 授权人员确认后才创建设备命令。
12. 测试RAG无结果、MCP失败、JSON非法、参数越界、AI超时和设备离线。

### AI调试怎么做

- RAG没有结果：看文档是否建立索引、元数据是否过滤错、查询词是否匹配。
- 引用错误：打印召回片段和版本，不能只看模型回答。
- MCP失败：单独调用工具，不先怪模型。
- 输出不是JSON：保存原始输出，先做Schema校验和有限重试。
- 建议越界：检查后端是否重新读取MySQL，而不是信任模型返回上下限。
- AI超时：检查请求超时和降级，不能让产线线程无限等待。

### 如何与下一节连接

第16课把AI服务、视觉服务、Spring Boot、数据库、MQTT、Web、鸿蒙和真实设备放进同一启动顺序，并验证AI失败时正常生产仍有审核工艺可用。

### 通过门禁

每个建议有文档引用和工具记录，输出可解析，后端能拒绝越界建议，人工确认后才执行，AI停止时系统能降级。

## 学习目标

- 明确AI服务与Spring Boot的关系。
- 建立本地工艺知识库和RAG检索。
- 设计受控MCP查询工具。
- 让AI输出可解析、可引用、可校验的参数建议。
- 处理知识缺失、工具失败、模型超时、越界和降级。

## 决策闭环

```text
摄像头识别瓶型
→ Spring Boot整理生产上下文
→ AI查询RAG
→ MCP查询准确参数和设备状态
→ AI生成结构化建议
→ Spring Boot安全校验
→ 人工确认或自动执行
→ 保存决策和设备反馈
```

## 部署关系

- 业务上AI属于后端智能模块。
- 部署上做成独立Python服务。

```text
Spring Boot：业务、权限、状态机、数据库、MQTT和安全
Python AI：模型、RAG、MCP客户端和决策编排
```

AI服务崩溃时，基础后端和安全报警必须继续运行。

接口建议：

```text
POST /ai/decisions
GET  /ai/health
POST /ai/knowledge/search
```

## 四部分职责

### AI模型

- 理解上下文。
- 选择需要查询的知识和工具。
- 组织参数建议和解释。

### RAG

- PLA处理原因。
- 不同瓶型工艺原则。
- 缺陷原因和排查步骤。
- 设备手册和安全预案。

### MySQL

- 有效工艺版本。
- 准确速度、灌装量、阈值和坐标。
- 当前设备、报警和生产状态。

### MCP

- 让AI调用受控工具。
- 查询瓶型、工艺、阈值和设备状态。
- 创建参数建议。
- 不代替MQTT，不直接控制设备。

## 推荐交互

```text
Spring Boot调用AI
→ AI检索RAG
→ AI通过MCP调用受控后端接口
→ Spring Boot查询MySQL
→ MCP返回准确数据
→ AI返回建议
→ Spring Boot重新校验并执行
```

MCP工具优先调用Spring Boot接口，不给AI数据库管理员密码或任意SQL能力。

## RAG流程

```text
导入文档
→ 文档解析
→ 按章节切分
→ 生成向量
→ 存入向量库
→ 根据问题检索片段
→ 将片段与上下文交给模型
→ 模型带引用回答
```

RAG不同于模型微调；文档更新后重新索引，不必训练模型。

## 知识库内容

- 瓶型规格。
- PLA材料处理说明。
- 饮料调配与杀菌工艺。
- 气体安全说明。
- 灌装和封盖设备手册。
- 瓶盖、瓶身、瓶底缺陷手册。
- 机械臂、AGV操作和故障手册。
- 仓储安全管理与应急预案。

文档元数据：

```json
{
  "documentId": "DOC-PLA-001",
  "title": "PLA-500预处理工艺",
  "version": "2.1",
  "effectiveDate": "2026-06-01",
  "bottleType": "PLA-500",
  "station": "PRETREATMENT",
  "status": "ACTIVE"
}
```

过期和现行文档必须区分。

## 文档切分

优先按：

- 章节。
- 工位。
- 设备。
- 瓶型。
- 故障类型。
- 操作步骤。
- 安全注意事项。

每个片段保留文档名、标题、版本、生效日期、位置和适用范围。不能随意把句子和表格从中间切断。

## 向量库

- Chroma：Python本地演示简单。
- FAISS：轻量本地检索。
- Qdrant：功能完整但多一个服务。

第一版选择Chroma或FAISS，不搭复杂分布式系统。

E盘目录：

```text
E:\bottling-ai\knowledge
E:\bottling-ai\vectors
E:\bottling-ai\models
E:\bottling-ai\logs
```

## 本地知识库与模型

### 本地知识库加在线模型

- 模型能力较强，部署简单。
- 依赖网络和调用费用。
- 需要考虑数据上传。

### 本地知识库加本地模型

- 离线运行，数据留在本机。
- 需要CPU、内存或显卡。
- 小模型可能较慢或推理能力有限。

比赛至少准备本地模型或固定规则备用，具体模型根据硬件再选。

## MCP工具

第一版五至八个工具：

### get_bottle_type

```json
{"bottleCode": "PLA-500"}
```

返回材质、容量和尺寸。

### get_active_recipe

```json
{
  "bottleType": "PLA-500",
  "process": "FILLING"
}
```

返回当前有效版本和参数。

### get_safety_limits

```json
{
  "stationCode": "GAS-01",
  "metricCodes": ["VOC", "CO"]
}
```

### get_device_status

```json
{"deviceCodes": ["PUMP-01", "CONVEYOR-01"]}
```

### create_parameter_proposal

- 只能创建建议。
- 不能直接执行设备命令。

## AI输入上下文

```json
{
  "requestId": "AI-REQ-0001",
  "bottleType": "PLA-500",
  "recipeVersion": "2.1",
  "currentStep": "WAITING_FILLING",
  "beverageBatch": "DRINK-001",
  "stationCode": "FILLING-01",
  "sensorSummary": {
    "temperature": 25.5,
    "humidity": 48,
    "voc": 6.2
  },
  "deviceStates": {
    "filler": "IDLE",
    "conveyor": "RUNNING"
  },
  "activeAlarms": []
}
```

不能只传“帮我调整参数”，必须包含瓶型、工序、单位和当前状态。

## 结构化输出

```json
{
  "decisionId": "AI-DEC-0001",
  "result": "PROPOSAL",
  "bottleType": "PLA-500",
  "recipeVersion": "2.1",
  "proposals": [
    {
      "parameterCode": "CONVEYOR_SPEED",
      "currentValue": 0.2,
      "recommendedValue": 0.25,
      "minValue": 0.1,
      "maxValue": 0.5,
      "unit": "m/s"
    },
    {
      "parameterCode": "FILL_VOLUME",
      "currentValue": 480,
      "recommendedValue": 500,
      "minValue": 495,
      "maxValue": 505,
      "unit": "ml"
    }
  ],
  "evidence": [
    {
      "documentId": "DOC-PLA-001",
      "version": "2.1",
      "section": "灌装参数"
    }
  ],
  "risks": [],
  "requiresApproval": true,
  "confidence": 0.91
}
```

- Spring Boot不从自由文本中猜参数。
- 只接受允许的`parameterCode`。
- AI不能自由生成任意设备命令。

## Spring Boot二次校验

```text
建议值在数据库上下限内
AND 设备在线
AND 工位就绪
AND 无活动安全报警
AND 工艺版本有效
AND 当前状态允许
```

后端重新查询MySQL，不能相信AI自己返回的上下限。

## 不交给大模型的事情

- 气体是否超阈值。
- 工序能否跳步。
- 急停是否执行。
- 机械臂坐标是否越界。
- 库存是否增加。
- AGV超声波是否停车。
- 装箱网格坐标计算。

这些使用规则和确定性算法。

AI适合：

- 解释工艺和原因。
- 推荐候选参数。
- 分析报警关联。
- 给出故障排查步骤。
- 生成可引用的决策说明。

## 提示词约束

- 明确身份和任务。
- 只使用白名单MCP工具。
- 禁止直接控制设备。
- 必须引用知识来源。
- 数据库值优先。
- 证据不足返回`NEED_REVIEW`。
- 输出必须符合JSON Schema。
- 不得自行修改安全阈值。

证据不足：

```json
{
  "result": "NEED_REVIEW",
  "reason": "未检索到PLA-500当前有效封盖参数",
  "proposals": []
}
```

## 故障与降级

### RAG无结果

- 返回`NEED_REVIEW`。
- 不自动调整。
- 提示补充或审核文档。

### MCP失败

- 停止本次建议。
- 不使用模型记忆代替准确数据库值。

### 非法JSON

- Schema校验失败。
- 有限重试。
- 仍失败进入人工处理。

### AI超时

- 使用已审核工艺版本。
- 禁止新的AI自动调整。
- 安全规则继续运行。

### 建议越界

- 后端拒绝并记录原因。
- 不发送MQTT命令。

## 决策审计

保存：

- 请求编号、瓶型和批次。
- 模型、提示词和知识库版本。
- 检索片段和文档引用。
- MCP工具调用与结果。
- AI原始输出和结构化建议。
- 后端校验结果。
- 人工确认人。
- 最终执行和设备反馈。

## MCP安全

- 工具白名单。
- 参数类型和范围校验。
- 查询默认只读。
- 禁止任意SQL和系统命令。
- 写操作只创建建议。
- 记录调用、设置超时和次数限制。
- 文档文字不能覆盖系统安全规则。

## 最小实现顺序

1. FastAPI返回固定JSON。
2. Spring Boot调用成功。
3. RAG带引用回答。
4. 增加瓶型工具。
5. 增加工艺工具。
6. 增加设备与阈值工具。
7. AI输出结构化建议。
8. 后端二次校验。
9. 管理端显示决策。
10. 人工确认后模拟下发。

完成闭环后再考虑自动执行和多智能体。

## 实操作业

- 收集和分类工艺文档。
- 添加版本、瓶型和工位元数据。
- 建立本地向量库。
- 完成带引用RAG查询。
- 创建五个只读MCP工具。
- 创建AI决策接口。
- 强制JSON Schema输出。
- Spring Boot二次校验。
- 管理端显示引用、工具调用和结果。
- 测试知识缺失、工具失败、超时、越界和非法JSON。
- 准备至少20个固定测试场景。

## 验收标准

- 建议有知识依据。
- 准确参数来自受控工具。
- 输出可解析。
- 越界建议被后端拒绝。
- AI不可用时仍可使用审核工艺。
- 决策可查询、解释和追溯。

RAG提供工艺依据，MCP查询真实状态，数据库提供准确参数，Spring Boot作最后安全决定。

## 具体实操：完成一次可审计的AI参数建议

### 步骤1：整理三份最小知识文档

先不要导入几十份资料，只准备：

```text
PLA-500预处理工艺.md
PLA-500灌装参数.md
气体检测安全规则.md
```

每份文档开头写元数据：

```text
documentId: DOC-PLA-001
version: 1.0
status: ACTIVE
bottleType: PLA-500
station: PRETREATMENT
```

### 步骤2：明确知识与数据库边界

把下面内容写入MySQL：

```text
VOC上限：10 ppm
水洗时间：15秒
灌装量：500 ml
传送带速度范围：0.1～0.5 m/s
```

把下面内容放进RAG：

```text
为什么PLA需要静置和水洗
参数调整的工艺原因
出现异常时如何排查
```

### 步骤3：先实现不调用模型的RAG检索

输入问题：

```text
PLA-500瓶子灌装前为什么要水洗？
```

输出必须包含：

```text
匹配文档
章节
版本
相似片段
```

先验证检索片段正确，再接大模型。检索错了，模型只会把错误说得更像真的。

### 步骤4：创建最小AI服务

先实现：

```text
POST /ai/decisions
```

输入固定为：

```json
{
  "requestId": "AI-REQ-TEST-001",
  "bottleType": "PLA-500",
  "currentStep": "PRETREATMENT",
  "stationCode": "WASH-01",
  "sensorSummary": { "voc": 6.2 },
  "activeAlarms": []
}
```

第一版可以先返回固定结构化JSON，验证Spring Boot接口和管理端展示，再替换为真实模型。

### 步骤5：实现第一个只读工具

实现`get_bottle_type`：

1. 接收`bottleCode`。
2. 检查编号格式。
3. 查询`bottle_type`。
4. 只返回允许字段。
5. 记录调用编号、参数、耗时和结果。

测试：

```text
PLA-500：返回尺寸和容量
UNKNOWN：返回业务错误
空参数：参数校验失败
```

### 步骤6：实现工艺和阈值工具

依次实现：

```text
get_active_recipe
get_safety_limits
get_device_status
```

每个工具都重复验证：

- 输入格式。
- 权限或服务身份。
- 数据库查询。
- 返回字段白名单。
- 超时和异常。

### 步骤7：让AI生成结构化建议

AI只允许输出：

```text
PROPOSAL
NEED_REVIEW
REJECTED
```

输出必须能通过JSON Schema校验。缺少依据时返回：

```json
{
  "result": "NEED_REVIEW",
  "reason": "没有找到当前瓶型有效工艺",
  "proposals": []
}
```

### 步骤8：Spring Boot二次校验

不要使用AI返回的`minValue`和`maxValue`作为最终限制。后端重新查数据库：

```text
推荐值是否在数据库范围内
→ 工艺版本是否ACTIVE
→ 工位是否READY
→ 设备是否ONLINE
→ 是否有CRITICAL报警
→ 当前工序是否允许
```

任一步失败都返回拒绝原因，不发布MQTT。

### 步骤9：人工确认闭环

第一版建议：

```text
AI生成建议
→ 管理端显示依据和参数
→ 授权人员点击确认
→ Spring Boot再次校验
→ 创建设备命令
```

不要一开始让AI自动修改所有设备参数。

### 步骤10：保存完整审计记录

每次请求保存：

```text
requestId
decisionId
模型版本
提示词版本
RAG文档和章节
MCP工具调用
AI原始输出
结构化建议
后端校验结果
人工确认人
设备执行结果
```

### 步骤11：测试失败场景

依次制造：

```text
RAG无结果
MCP查询失败
模型输出非法JSON
建议参数越界
AI响应超时
设备离线
存在安全报警
```

每种情况都应：

- 不直接控制设备。
- 保存失败原因。
- 页面给出可理解提示。
- 能切换到审核工艺或人工处理。

### 步骤12：做20个固定问题

测试问题覆盖：

- 两种瓶型。
- 不同工位。
- 正常与超限气体值。
- 设备离线。
- 当前工艺版本不存在。
- 文档版本过期。
- 参数越界。

每个问题保存输入、期望结果和实际结果，模型升级后重跑。

### 本课完成标志

- RAG能返回正确片段和引用。
- MCP工具能查真实数据库值。
- AI输出可以被程序解析。
- Spring Boot能拒绝越界建议。
- 授权人员确认后才进入控制流程。
- AI失败时系统仍能使用审核工艺。

## 保姆式实操：先做确定性闭环，再接模型

AI 是后端体系中的独立服务，不建议把模型、向量库、MCP 和 Spring Boot 全部塞进一个进程。Spring Boot 是唯一业务控制中枢，AI 只能提出带证据的参数建议，后端负责最终校验和执行。

### 第 1 步：建立 E 盘目录

~~~powershell
New-Item -ItemType Directory -Force 'E:\bottling-ai\knowledge','E:\bottling-ai\vectors','E:\bottling-ai\models','E:\bottling-ai\logs'
~~~

优先复用第 14 课的 Python 虚拟环境。所有模型缓存、向量库和日志都必须检查路径，不能默认写到用户目录。

### 第 2 步：先实现无模型规则决策

输入固定请求：

~~~json
{
  "requestId": "AI-REQ-DEMO-001",
  "bottleType": "PLA-500",
  "currentStep": "WAITING_FILLING",
  "stationCode": "FILLING-01",
  "sensorSummary": {"temperature": 25.5, "humidity": 48, "voc": 6.2}
}
~~~

先返回 result=PROPOSAL、requiresApproval=true、空 proposals 和 reason 字段。这一步验证接口、状态和审计，不是模型能力；先确保 AI 停机时后端仍能使用数据库中已审核工艺。

### 第 3 步：建立知识库和最小 RAG

知识文件至少包含瓶型、工位、步骤、版本、生效日期、安全限制和来源：

~~~text
E:\bottling-ai\knowledge\PLA-500\pretreatment.md
E:\bottling-ai\knowledge\PLA-500\filling.md
E:\bottling-ai\knowledge\common\gas-safety.md
E:\bottling-ai\knowledge\common\defect-handbook.md
~~~

第一版使用 Chroma 或 FAISS。顺序固定为：读取 Markdown、按标题切分、保存元数据、生成向量、写入 E 盘、用固定问题检索 top-k、返回片段和引用。检索不到证据时必须返回 NEED_REVIEW。

### 第 4 步：实现只读 MCP 工具

第一批工具只允许查询 get_bottle_type、get_active_recipe、get_safety_limits、get_device_status。工具内部调用 Spring Boot 只读接口，不能把 MySQL 密码、任意 SQL 或 MQTT 控制权限交给 AI。

### 第 5 步：结构化建议和后端二次校验

模型输出必须经过 JSON Schema 校验，只允许白名单参数，例如 CONVEYOR_SPEED、FILL_VOLUME、WASH_DURATION。Spring Boot 重新从 MySQL 查询上下限，并依次检查参数白名单、数字和单位、范围、设备在线、工位状态、安全报警和工艺版本。

通过后只写入 AI_PROPOSAL，由授权人员确认；确认记录用户、时间、原值、新值、证据和原因，随后才生成 MQTT 控制命令。

### 第 6 步：AI 失败测试和门禁

逐个制造模型超时、RAG 无结果、MCP 设备离线、非法 JSON、参数越界和工艺版本过期。所有情况都必须进入审核或固定安全工艺，不能自动修改设备。没有后端二次校验、人工确认、审计记录和固定工艺回退四项，AI 章节不算完成。
