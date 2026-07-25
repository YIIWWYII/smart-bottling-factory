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

未知状态显示“未知”，不得默认涂成绿色。

## 核心对象最低字段

- `FactoryRun`：追踪号、瓶型、批次、当前工序、状态、箱码、AGV、仓位、事件链和更新时间。
- `RuntimeDevice`：设备、工序、状态、来源、fallback、速度、进度和上报时间。
- `RuntimeStage`：工序、状态、缓冲占用/容量、上下游影响和更新时间。
- `SensorReading`：读数 ID、设备、类型、值、单位、质量、模式、工序、产品和时间。
- `FactoryIncident`：异常 ID、工序、设备、策略、状态、目标工序、上下游影响和时间。
- `DeviceCommand`：命令 ID、客户端请求号、设备、类型、参数、操作者、状态、消息和回执时间。
- `AgvTask`：车辆、箱码、起终点、距离、速度、负载、超声波距离、状态、模式和时间。

## 可视化映射

运行/合格绿色，待机/等待黄色，报警/不合格红色，离线灰色。着色可关闭，但文本状态保留。点击设备关联设备对象，点击物料关联 `traceCode`，不能只是装饰模型。
