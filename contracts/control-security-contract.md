# 身份、参数与控制契约

## 两类身份

- 客户端身份：`DISPLAY_CLIENT`、`TERMINAL_CLIENT`、`ADMIN_CLIENT`、`AI_SERVICE`，由安装配置或安全存储提供，决定应用或服务可访问的接口范围。
- 操作员身份：`VIEWER`、`OPERATOR`、`ENGINEER`、`ADMIN`，通过 `/auth/login` 获得短期令牌，决定业务写权限。

展板使用 `DISPLAY_CLIENT` 只读，不弹用户登录。小屏使用 `TERMINAL_CLIENT` 可只读；首次写操作必须要求操作员登录，令牌过期后恢复只读。管理端始终要求用户登录。三端助手沿用当前客户端和操作员权限，AI 中枢使用 `AI_SERVICE` 调用受限只读工具和命令意图接口。开发演示可简化凭据，但生产配置不得匿名开放控制接口。

## 参数分层

| 类型 | 示例 | 小屏 | 管理端 | AI 中枢 | 生产后端 |
| --- | --- | --- | --- | --- | --- |
| 实时遥测 | 当前温度、VOC、速度 | 只读 | 查询/历史 | 经工具只读 | 接收并持久化 |
| 运行设定值 | 清洗时间、目标温度、灌装量、速度上限 | 在批准范围内人工修改 | 查看、审批范围 | 生成字段级建议和命令意图 | 最终校验并下发 |
| 配方模板 | 某瓶型的整套设备参数 | 选择/应用获批模板 | 创建、版本、审批、发布、回滚 | 只读引用 | 持久化并校验适用性 |
| 人工覆盖 | 人工锁定灌装流量 | 创建/释放授权锁 | 查询、强制释放和审计 | 跳过并解释 | 字段级强制锁和版本控制 |
| 安全阈值 | VOC 上限、烟雾上限、最低避障距离 | 只读 | ENGINEER/ADMIN 版本化管理 | 只读引用 | 强制联锁，任何端不可绕过 |
| 系统策略 | 异常传播、返工路由、缓冲容量 | 只读 | ADMIN 管理 | 只读引用 | 状态机执行 |

## 设备能力

后端对每台设备返回 `DeviceCapability`：

- `deviceCode`、`capabilityVersion`、`controlId`、`commandType`、显示名称。
- `valueType`、`unit`、`min`、`max`、`step`、枚举候选和当前值。
- `requiredRole`、`riskLevel`、`confirmationRequired`、`reasonRequired`。
- `interlocks`、`writable`、`disabledReason`。

小屏根据能力渲染控件，但不能只依赖前端范围；后端必须再次校验。不同工位、不同设备不得共用一套虚构参数。

## 参数所有权和人工覆盖

后端对每个参数维护 `ownerSource`、`lockMode`、`lockedBy`、`lockedAt`、`lockReason`、`expiresAt` 和 `parameterVersion`。人工修改默认产生 `MANUAL_HOLD`；AI 不得释放或覆盖，只能把该字段放入 `blockedChanges` 并给出说明。

后端必须在 AI 决策即将执行时重新比较 `parameterVersion`。版本已变化时拒绝旧建议。存在耦合关系的字段使用同一 `atomicGroupId`，组内任何字段被锁定或失败时整组不执行。完整规则见 `ai-decision-contract.md`。

## 命令请求和状态

命令请求至少包含：

```json
{
  "clientRequestId": "terminal-uuid",
  "lineId": "LINE-01",
  "stageCode": "FILLING",
  "deviceCode": "FIL-PUMP-01",
  "commandType": "SET_FLOW_RATE",
  "parameters": { "value": 120, "unit": "ml/s" },
  "expectedStateVersion": 1024,
  "expectedParameterVersion": 18,
  "recipeVersion": "recipe-v3",
  "reason": "人工纠正灌装流量偏差"
}
```

状态严格按 `PENDING -> SENT -> ACKNOWLEDGED` 或 `FAILED/TIMEOUT/CANCELLED` 演进。接口返回 `PENDING` 只代表受理。后端记录操作者、客户端、旧值、新值、安全校验、下发时间、边缘层回执和最终结果。

## 异常操作分级

- 小屏 OPERATOR：确认本站报警、请求单品剔除、本站暂停/恢复、应用已批准配方。
- ENGINEER：维护模式、设备复位、受限手动动作和参数模板试运行。
- 管理端 OPERATOR/ADMIN：跨工位返工、缓冲路由、AGV 重调度、异常关闭。
- ADMIN：用户、阈值、策略、配方发布和模拟场景控制。
- 拥有 `KNOWLEDGE_SUBMIT` 权限的 ENGINEER/ADMIN：从后台管理提交资料。
- 拥有 `KNOWLEDGE_REVIEW` 权限的审核人：只在后台管理端批准、拒绝、撤销和发布知识。
- 三端助手：问答文本不能转换为设备命令；选中参数后的“问 AI”也只负责解释。
- AI 中枢：只有隐式决策模块可提交命令意图，且必须经过生产后端全部安全门。

任何急停/安全联锁必须由硬件/边缘控制层优先实现；软件只能展示状态和发送受控请求，不能宣称替代物理安全回路。
