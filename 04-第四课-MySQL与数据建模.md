# 第四课：MySQL与产线数据建模

## 本节学习路线

### 这是什么

MySQL保存系统的长期事实：瓶型、工艺版本、批次、单瓶状态、工序历史、传感器记录、报警、命令、装箱、运输、库存和AI决策。

### 为什么要学

页面显示现在是什么不够，系统还要回答这只瓶子经历了什么、为什么被剔除、哪个参数版本生效、库存为什么增加。

### 它在项目中的位置

Spring Boot通过Mapper访问MySQL。前端、鸿蒙和AI不能直连数据库。RAG存说明性文档，图片存文件目录，MySQL存结构化和可校验事实。

### 需要的软件和安装

- MySQL服务：当前项目使用127.0.0.1:3307，继续使用已经部署的E盘实例。
- MySQL Workbench、DBeaver或命令行客户端：选择一种即可。
- VS Code：编辑SQL和迁移脚本。
- PowerShell：检查3307端口和备份路径。

客户端不需要把数据库安装到C盘；如果使用便携客户端，放在E盘。

### 最小例子

连接hdc数据库，执行SHOW TABLES、DESCRIBE device和SELECT * FROM device LIMIT 10。再创建一条PLA-500瓶型并查询出来。

### 项目实操顺序

1. 备份开发数据库。
2. 查看现有11张表。
3. 按依赖顺序创建瓶型、工艺、批次、单瓶和事件表。
4. 插入两个瓶型、两个工艺版本和一批演示数据。
5. 用单瓶追踪号查询当前状态。
6. 用事件表查询历史。
7. 测试工艺版本不会漂移。
8. 测试装箱和入库事务。
9. 准备只清理演示批次的重置脚本。

### 如何调试

- 连接失败：先查3307端口，再查用户名密码和数据库名。
- 表不存在：确认SQL执行目标是hdc，并按依赖顺序执行。
- 中文乱码：不要随意转码覆盖源SQL，确认UTF-8和数据库字符集。
- 历史参数变化：检查批次是否保存了工艺版本，不要每次读当前ACTIVE。
- 当前状态和历史不一致：检查事务和事件插入是否同时成功。

### 如何与下一节连接

第5课的Entity、Mapper和Service会读取本节的表；第6课更新bottle和process_event；第14课保存检测结果；第16课用演示数据重置脚本反复彩排。

### 通过门禁

能从数据库查询两只演示瓶的当前状态和全部历史，且修改当前工艺不会改变旧批次的历史参数。

## 学习目标

- 理解表、行、字段、主键、索引和关联。
- 认识当前项目已有数据库表。
- 设计瓶型、工艺、批次、单瓶、检测、物流和仓储模型。
- 区分MySQL、RAG和文件存储的边界。
- 能追溯一只瓶子的完整经历。

## 基础概念

以瓶型表为例：

```text
id | code    | name          | volume_ml | height_mm
1  | PLA-500 | 500ml PLA瓶   | 500       | 210
2  | PLA-330 | 330ml PLA瓶   | 330       | 170
```

- 表：一类对象，例如瓶型。
- 行：一个具体对象，例如PLA-500。
- 列：对象属性，例如容量和高度。
- 主键：数据库内部唯一编号，一般为`id`。
- 业务编号：现实中稳定使用的编号，例如`PLA-500`。
- 索引：加快查询。
- 关联：用编号把不同表连接起来。

页面、二维码和设备通信优先使用稳定业务编号，不直接依赖数据库自增ID。

## 当前项目已有表

建表文件：`hdc_server/src/main/resources/sql/mysql.sql`

- `device`：PAD、PDA、适配器设备，可扩展为产线设备。
- `group`：原沙盘分组，可理解为产线或演示单元。
- `group_device`：分组与设备关系。
- `product_type`：产品种类，可参考但不足以完整表达瓶型。
- `product_model`：产品型号。
- `product`：单件产品和条码，可作为追溯参考。
- `product_store`：出入库记录，可扩展为库存流水。
- `machine_failure`：设备故障，可保留并增加实时报警表。
- `production`：月度计划和产量，适合统计，不适合逐瓶追溯。
- `city`：城市信息，新产线基本不需要。
- `group_visitor`：参观人数，新产线基本不需要。

旧表继续支撑现有页面，新业务通过新表逐步接入，不把所有功能硬塞进旧表。

现有SQL中文注释有乱码，字段仍可读取。以后修复必须通过明确的数据库迁移，不直接随意转换整个文件编码。

## 数据的四类

### 基础资料

- 瓶型。
- 设备与工位。
- 箱型和库位。
- 工艺方案及版本。
- 安全阈值。

### 生产业务数据

- 生产批次。
- 单瓶追踪。
- 检测结果。
- 装箱记录。
- AGV任务。
- 入库记录。

### 实时与历史数据

- 气体浓度。
- 温度、湿度。
- AGV速度、距离和负载。
- 设备运行状态。

### 决策与异常数据

- 报警记录。
- 人工操作记录。
- AI参数建议。
- 后端校验结果。
- 设备命令和执行结果。

## 第一版核心表

### 生产核心

- `bottle_type`：瓶型、长宽高、容量和材质。
- `process_recipe`：瓶型对应的工艺方案和版本。
- `production_batch`：一次生产批次。
- `bottle`：单瓶追踪号和当前状态。
- `process_event`：瓶子经历每个工位的事件。
- `inspection_result`：瓶盖、瓶身、瓶底和液位检测结果。

### 设备与安全

- `device`：扩展现有设备表。
- `sensor_reading`：传感器历史数据。
- `alarm_record`：报警产生、确认、解除和处理过程。
- `device_command`：控制命令和执行结果。

### 物流仓储

- `box`：箱体和装箱方案。
- `box_item`：瓶子在箱中的行、列、层或坐标。
- `agv_task`：运输起点、终点、车辆和状态。
- `warehouse_location`：仓储库位。
- `inventory_record`：入库、出库和转移流水。

### AI

- `ai_decision`：AI输入、知识依据、工具调用、建议、校验和最终结果。

## 数据关系

```text
瓶型 1 → 多个工艺版本
生产批次 1 → 多只瓶子
瓶型 1 → 多只瓶子
瓶子 1 → 多条工序事件
瓶子 1 → 多次检测结果
设备 1 → 多条传感器数据
设备 1 → 多条报警和命令
箱子 1 → 多个装箱明细
箱子 1 → 一个或多个运输任务
库位 1 → 多条库存流水
批次 1 → 多条AI决策
```

## 数据类型选择

- 数据库主键：`BIGINT`。
- 编号、名称、状态：`VARCHAR`。
- 数量：`INT`。
- 浓度、温度、尺寸：`DECIMAL`。
- 是否启用：`TINYINT`或布尔映射。
- 时间：`DATETIME`。
- 可变AI详情、缺陷列表、知识引用：`JSON`或文本。

不要用`FLOAT`保存需要稳定比较的安全阈值；不要把时间保存成随意格式字符串。

## 瓶型与工艺版本

瓶型保存固有属性：

```sql
CREATE TABLE bottle_type (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    material VARCHAR(32) NOT NULL,
    volume_ml DECIMAL(10,2) NOT NULL,
    diameter_mm DECIMAL(10,2),
    height_mm DECIMAL(10,2),
    enabled TINYINT NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL
);
```

工艺参数独立版本化：

```text
PLA-500
→ 工艺方案V1
→ 静置时间、清洗时间、风洗时间
→ 气体安全阈值
→ 灌装量、传送带速度、装箱规则
```

- 修改工艺时创建新版本。
- 历史批次继续引用当时版本。
- 不允许当前配置变化后篡改历史记录。

## 批次与单瓶

### 生产批次

```text
批次：BATCH-20260718-001
瓶型：PLA-500
饮料：橙汁
工艺版本：V2
计划数量：20
```

### 单瓶

```text
追踪号：BOT-20260718-000001
所属批次：BATCH-20260718-001
当前工序：SECOND_INSPECTION
当前状态：PASSED
```

比赛演示数量少，逐瓶记录最直观。真实高速产线可以按批次或抽检优化，但不影响第一版设计。

## 传感器数据保存策略

- 后端内存保存最新值。
- MySQL按1秒、5秒或数值明显变化时落库。
- 报警前后的关键数据必须保存。
- 原始图片保存在文件目录，数据库只保存路径和识别结果。
- 普通历史数据设置清理周期；报警和生产记录长期保留。

查询设备最新20条数据：

```sql
SELECT device_code, metric_code, value, unit, collected_at
FROM sensor_reading
WHERE device_code = 'GAS-01'
ORDER BY collected_at DESC
LIMIT 20;
```

## 单瓶追溯

```sql
SELECT
    b.trace_code,
    b.batch_code,
    e.station_code,
    e.event_type,
    e.result,
    e.start_time,
    e.end_time
FROM bottle b
JOIN process_event e ON e.bottle_id = b.id
WHERE b.trace_code = 'BOT-20260718-000001'
ORDER BY e.start_time;
```

最终应得到：

```text
10:00 瓶型识别：PLA-500
10:02 水洗完成：合格
10:03 风洗完成：合格
10:04 气体检测：6.2 ppm，合格
10:06 初次外观检测：合格
10:10 灌装完成
10:12 二次检测：合格
10:15 装入BOX-001第2行第3列
10:20 由AGV-01运输
10:25 入库A区01号库位
```

## MySQL、RAG和文件的边界

### MySQL

- 准确、结构化、可计算、可校验的数据。
- 例如安全上限、速度、灌装量和工艺版本。

### RAG

- PLA处理原因、工艺说明、缺陷原因、设备调整步骤和安全预案。

### 文件目录

- 原始图片、缺陷标注图、文档原件和模型文件。
- 数据库只保存文件路径、哈希或元数据。

## 数据库规则

- 重要生产记录不直接删除，使用状态或删除标记。
- 业务编号设置唯一约束。
- 高频查询的设备编号、批次号和追踪号建立索引。
- 数值必须明确单位。
- 多表装箱、入库等操作使用事务。
- 开发库和演示库分开。
- 修改表结构前备份并使用迁移脚本。
- 前端、鸿蒙端和AI服务不能直连MySQL。

## 实操作业

- 找到现有11张表。
- 查询`device`表。
- 新增、查询、修改和删除一条测试瓶型。
- 画出瓶型、批次、单瓶和检测记录关系。
- 设计一只瓶子的完整追溯数据。
- 写SQL查询设备最新20条传感器数据。
- 说明哪些内容放MySQL、RAG或文件目录。

## 验收问题

### 问题

今天把PLA-500工艺从V1改成V2，昨天生产的瓶子应该显示哪套参数？

### 答案

昨天批次继续关联V1。工艺参数必须版本化，不能让历史生产记录随当前配置改变。

## 具体实操：从查询现有数据库到设计产线数据

### 步骤1：确认数据库连接

先确认MySQL端口：

```powershell
Test-NetConnection 127.0.0.1 -Port 3307
```

在MySQL客户端或数据库工具中填写：

```text
Host：127.0.0.1
Port：3307
User：root
Password：123456
Database：hdc
```

如果使用命令行客户端并且客户端已配置到PATH：

```powershell
mysql -h127.0.0.1 -P3307 -uroot -p123456 hdc
```

密码不写入团队文档或提交到Git。

### 步骤2：查看现有表

```sql
SHOW TABLES;
DESCRIBE device;
DESCRIBE product;
DESCRIBE machine_failure;
SELECT * FROM device LIMIT 10;
```

把表名、主键和主要字段记录下来，不要一上来修改旧表。

### 步骤3：新建最小瓶型表

在开发数据库执行：

```sql
CREATE TABLE IF NOT EXISTS bottle_type (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    material VARCHAR(32) NOT NULL,
    volume_ml DECIMAL(10,2) NOT NULL,
    diameter_mm DECIMAL(10,2),
    height_mm DECIMAL(10,2),
    enabled TINYINT NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 步骤4：插入两种测试瓶型

```sql
INSERT INTO bottle_type
    (code, name, material, volume_ml, diameter_mm, height_mm)
VALUES
    ('PLA-500', '500ml PLA瓶', 'PLA', 500, 65, 210),
    ('PLA-330', '330ml PLA瓶', 'PLA', 330, 58, 170);
```

验证：

```sql
SELECT code, name, volume_ml, height_mm
FROM bottle_type
ORDER BY id;
```

### 步骤5：设计工艺版本表

```sql
CREATE TABLE IF NOT EXISTS process_recipe (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    recipe_code VARCHAR(64) NOT NULL,
    bottle_type_code VARCHAR(64) NOT NULL,
    version_no VARCHAR(32) NOT NULL,
    wash_seconds INT NOT NULL,
    air_seconds INT NOT NULL,
    gas_limit_ppm DECIMAL(10,2) NOT NULL,
    fill_volume_ml DECIMAL(10,2) NOT NULL,
    conveyor_speed_mps DECIMAL(10,3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_recipe_version (recipe_code, version_no)
);
```

插入V1和V2：

```sql
INSERT INTO process_recipe
    (recipe_code, bottle_type_code, version_no, wash_seconds,
     air_seconds, gas_limit_ppm, fill_volume_ml,
     conveyor_speed_mps, status)
VALUES
    ('PLA-500-DEFAULT', 'PLA-500', 'V1', 15, 10, 10, 500, 0.250, 'ACTIVE'),
    ('PLA-500-DEFAULT', 'PLA-500', 'V2', 18, 12, 10, 500, 0.220, 'DRAFT');
```

### 步骤6：验证版本不改历史

先建立测试批次或在作业纸上规定：

```text
BATCH-001使用V1
BATCH-002使用V2
```

修改V2的水洗时间后，再查询BATCH-001关联的版本，确保仍是V1。生产批次必须保存`recipe_version`，不能每次查询当前ACTIVE版本代替历史版本。

### 步骤7：设计单瓶追踪记录

最小字段：

```text
trace_code
batch_code
bottle_type_code
recipe_version
current_step
status
current_station
update_time
```

先不用急着建全部表，先画出一条记录从`IDENTIFICATION`变成`GAS_INSPECTION`的字段变化。

### 步骤8：写一条追溯查询

先用现有表练习多表查询，再为新表设计：

```sql
SELECT trace_code, batch_code, bottle_type_code,
       recipe_version, current_step, status
FROM bottle
WHERE trace_code = 'BOT-20260719-0001';
```

后续加入工序事件表后：

```sql
SELECT event_type, station_code, result,
       start_time, end_time
FROM process_event
WHERE bottle_id = 1
ORDER BY start_time;
```

### 步骤9：测试传感器数据策略

模拟插入10条数据：

```sql
INSERT INTO sensor_reading
    (device_code, metric_code, value, unit, collected_at)
VALUES
    ('GAS-01', 'VOC', 6.2, 'ppm', NOW());
```

查询最新数据：

```sql
SELECT device_code, metric_code, value, unit, collected_at
FROM sensor_reading
WHERE device_code = 'GAS-01'
ORDER BY collected_at DESC
LIMIT 20;
```

### 步骤10：做一次事务练习

写下装箱需要改变的三件事：

```text
瓶子状态：PACKING → BOXED
新增box_item
箱子数量：n → n+1
```

故意让第二步失败，验证第一步不会单独提交。事务测试必须在开发库进行，不能使用演示库。

### 本课完成标志

- 能连接3307端口并查看现有表。
- 能创建瓶型和工艺版本测试数据。
- 能解释批次为什么必须绑定工艺版本。
- 能查询一只瓶子的当前状态和历史事件。
- 能说清实时数据、生产记录和图片文件分别放在哪里。

## 保姆式执行清单：建立第一版可追溯数据库

### 第1步：先备份再改表

在任何DDL之前：

1. 用数据库工具导出`hdc`开发库。
2. 文件保存到：

```text
E:\hdc_runtime\backup\before-schema-change.sql
```

3. 打开备份文件确认有`CREATE TABLE`。
4. 只在开发库执行新表语句。

不要直接修改演示库，更不要在未备份时执行`DROP TABLE`。

### 第2步：按依赖顺序建表

不要同时创建全部产线表。按下面顺序：

```text
1. bottle_type
2. process_recipe
3. production_batch
4. bottle
5. process_event
6. inspection_result
7. sensor_reading
8. alarm_record
9. device_command
10. box和box_item
11. agv_task
12. warehouse_location和inventory_record
13. ai_decision
```

每建一张表，立刻执行`DESCRIBE`、插入一条测试数据和查询，不要一次执行一长段SQL后再找错误。

### 第3步：给业务编号加唯一性

必须唯一的字段：

```text
bottle_type.code
production_batch.batch_code
bottle.trace_code
device.device_code
device_command.command_id
process_event.event_id
inspection_result.inspection_id
box.box_code
agv_task.task_code
```

唯一约束是防重复的最后一道数据库保障，不能只依靠前端判断。

### 第4步：插入基础资料

最先插入：

```text
PLA-500瓶型
PLA-330瓶型
PLA-500 V1工艺
GAS-01、PUMP-01、CAM-01、ARM-01、AGV-01设备
WASH-01、GAS-01、INSPECT-01等工位
WH-A01-01仓储库位
```

每条数据插入后执行查询，确保代码和名称没有拼写差异。

### 第5步：创建一条演示批次

固定数据：

```text
batch_code：BATCH-DEMO-001
bottle_type_code：PLA-500
recipe_version：V1
planned_quantity：2
```

创建两只瓶：

```text
BOT-DEMO-001：正常瓶
BOT-DEMO-002：缺陷瓶
```

两只瓶必须绑定同一批次和工艺版本，但后续检测结果不同。

### 第6步：写入第一条工序事件

为`BOT-DEMO-001`保存：

```text
event_id：EVT-DEMO-001
from_step：IDENTIFICATION
to_step：PRETREATMENT
result：PASS
```

再更新`bottle.current_step=PRETREATMENT`。这两个写操作应由同一个Service事务完成。

### 第7步：验证当前状态与历史状态

分别执行：

```sql
SELECT trace_code, current_step, status
FROM bottle
WHERE trace_code = 'BOT-DEMO-001';
```

```sql
SELECT event_id, from_step, to_step, result
FROM process_event
WHERE bottle_id = 1
ORDER BY occurred_at;
```

如果当前状态变了但历史事件没有，说明业务事务不完整。

### 第8步：验证工艺版本不漂移

1. 创建批次时保存V1。
2. 把V2设为ACTIVE或修改V2数值。
3. 再查询BATCH-DEMO-001。
4. 它仍必须显示V1和创建时的参数快照。

如果页面每次都查询当前ACTIVE方案代替批次关联版本，必须立即修复。

### 第9步：验证传感器数据和报警

插入合格值与超限值：

```text
6.2 ppm → NORMAL
12.5 ppm → CRITICAL
```

确认：

- 原始传感器记录保留。
- 报警记录关联设备和工位。
- 报警关联当前瓶子或批次。
- 超限不自动覆盖为合格。

### 第10步：验证装箱和库存一致性

正常瓶装箱时必须同时：

```text
bottle.status = BOXED
box_item新增一条
box.quantity + 1
```

入库时必须同时：

```text
box.status = IN_WAREHOUSE
inventory_record新增入库流水
warehouse_location.current_quantity + 1
```

任一步失败，整个事务回滚。

### 第11步：准备重置脚本

演示每天开始前需要恢复固定数据。准备一个只清理演示批次的脚本：

```text
只删除BATCH-DEMO-001及其关联事件、检测、箱子、AGV任务和库存流水
不删除瓶型、工艺、设备和知识库基础数据
```

脚本执行前打印将要删除的批次编号并要求人工确认。

### 第12步：完成第四课门禁

```text
[ ] 开发库备份完成
[ ] 12类核心表按依赖顺序建立
[ ] 业务编号唯一约束完成
[ ] 两只演示瓶和一个批次建立
[ ] 当前状态与历史事件一致
[ ] 工艺版本不漂移
[ ] 报警、装箱、入库事务测试完成
[ ] 演示数据重置脚本准备好
```
