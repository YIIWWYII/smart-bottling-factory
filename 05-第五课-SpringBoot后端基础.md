# 第五课：Spring Boot后端基础

## 本节学习路线

### 这是什么

Spring Boot是你们的业务后端。它接收HTTP请求、读取数据库、接收设备消息、执行状态规则、调用AI和视觉，并向设备和页面转发经过校验的数据。

### 为什么要学

后端不是把接口写出来就结束。它必须保证权限、工序、安全阈值、设备状态和数据库记录一致，否则页面看似能操作，产线流程却会错乱。

### 它在项目中的位置

管理端、大屏、鸿蒙、AI和视觉都先访问Spring Boot，再由Spring Boot访问MySQL、MQTT、WebSocket和外部Python服务。四个人的项目先保持一个后端工程。

### 需要的软件与配置

- IntelliJ IDEA Community或Eclipse：Java开发和断点。
- JDK 8：与当前pom兼容。
- Maven：编译和依赖。
- MySQL客户端：查表和验证事务。
- Postman或PowerShell：调用接口。
- MQTTX：第7课验证设备消息。

开始前确认MySQL 3307、MQTT 31883和后端8088可用，Maven仓库放E盘。

### 最小例子

新增一个只返回固定数据的接口：GET /hdc/api/stations/WASH-01/status。先证明浏览器或PowerShell能访问Controller，再逐步接Service、Mapper和数据库。

### 项目实操顺序

1. 用IDE打开包含pom.xml的hdc_server。
2. 选择JDK 8，等待Maven加载。
3. 运行HdcApplication确认基线。
4. 阅读现有Controller、Service、Mapper和Entity。
5. 新增StationStatusDto、StationController和StationService。
6. 先返回固定状态。
7. 用PowerShell调用并打断点。
8. 改成查询数据库。
9. 增加控制命令接口，只先写PENDING。
10. 再接MQTT和ACK。
11. 增加事务、超时、日志和测试。

### 断点调试怎么做

在Controller方法第一行打断点，用Debug启动后端，调用接口并观察request参数、PathVariable、Service返回值、Mapper查询结果和异常堆栈。使用Step Over执行下一行、Step Into进入方法、Resume继续运行、Call Stack查看调用链。

### 常见错误怎么查

- 编译失败：只看第一条错误，检查包、导入、括号和JDK。
- 启动失败：按Java、8088、MySQL、表、MQTT、配置顺序排查。
- 404：拼接context-path、Controller映射和前端基础URL。
- 500：复制请求到PowerShell，查看第一个异常。
- code=0但设备没动作：后端只是受理，继续查MQTT和ACK。
- 数据库成功但设备失败：数据库事务不能代表物理执行成功。

### 如何与下一节连接

第6课的状态机放在Service中；第7课的MQTT回调进入Service；第8课的WebSocket由Service在状态变化后推送；第15课的AI建议也必须回到后端二次校验。

### 通过门禁与回退

必须通过固定数据查询、数据库查询、PENDING命令、权限状态参数重复校验、ACK成功失败超时和Maven编译。新增代码破坏旧系统时，先看git diff，回退自己的提交或修复对应文件。

## 学习目标

- 理解Spring Boot启动过程。
- 看懂Controller、Service、Mapper、Entity和DTO的职责。
- 沿真实接口追踪请求到数据库。
- 能按照现有结构增加工位状态接口。
- 理解参数校验、事务、异常、日志和AI调用。

## 后端启动过程

入口：`HdcApplication.java`

```java
@SpringBootApplication
@MapperScan("com.archermind.hdc.mapper")
@EnableScheduling
@EnableWebSocket
public class HdcApplication {
    public static void main(String[] args) {
        SpringApplication.run(HdcApplication.class, args);
    }
}
```

注解作用：

- `@SpringBootApplication`：启动Spring并扫描组件。
- `@MapperScan`：扫描MyBatis数据库接口。
- `@EnableScheduling`：启用定时任务。
- `@EnableWebSocket`：启用WebSocket。
- `main()`：Java程序入口。

启动时发生：

1. 读取`application.yaml`和环境配置。
2. 连接MySQL。
3. 创建Controller、Service等对象。
4. 初始化MQTT和WebSocket。
5. 启动定时任务。
6. 在8088端口等待请求。

看到`Started HdcApplication`才算启动成功。

## 请求处理分层

```text
Vue、鸿蒙或AI客户端
→ Controller
→ Service
→ Mapper
→ MySQL
```

Service还可能调用：

```text
MQTT
WebSocket
Python AI服务
视觉服务
```

### Controller

- 定义接口地址。
- 接收JSON和路径参数。
- 检查基本参数格式。
- 调用Service。
- 返回统一响应。
- 不堆放复杂生产规则。

### Service

- 判断工序是否允许执行。
- 检查设备状态和报警。
- 比较安全阈值。
- 调用数据库、MQTT、AI和视觉服务。
- 组织一项完整业务操作。

产线的大部分业务规则写在Service。

### Mapper

- 查询、新增、修改和删除数据库记录。
- 承载复杂SQL或MyBatis Plus查询。
- 不负责判断气体不合格时能否灌装。

### Entity

- 一般对应一张数据库表。
- 用于Java与数据库之间转换。

```java
@TableName("device")
public class Device {
    private Long id;
    private String sn;
    private String type;
    private Integer state;
}
```

### DTO

- 用于客户端与后端之间传递数据。
- 接口需要什么就定义什么。
- 不把完整数据库Entity直接暴露给客户端。

```java
public class StationCommandRequest {
    private String stationCode;
    private String deviceCode;
    private String action;
}
```

## 现有真实调用链

设备故障批量创建：

```text
POST /hdc/api/machineFailure/batchCreate
→ MachineFailureController
→ MachineFailureService
→ MachineFailureMapper
→ machine_failure表
```

- Controller接收故障列表。
- Service完成时间转换、对象复制和业务判断。
- Mapper执行批量写入。
- Entity映射`machine_failure`表。

## 依赖注入

```java
@Service
public class DeviceService {
}
```

`@Service`告诉Spring创建并管理该业务对象。

```java
@Autowired
private DeviceService deviceService;
```

Spring自动把`DeviceService`注入Controller。

- 现有项目大量使用字段注入，可继续保持风格。
- 熟悉后可逐步使用构造器注入，便于测试和防止空依赖。

## 工位状态接口设计

需求：鸿蒙水洗工位查询当前状态。

```http
GET /hdc/api/stations/WASH-01/status
```

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "stationCode": "WASH-01",
    "state": "RUNNING",
    "mode": "AUTO",
    "deviceOnline": true,
    "currentBottleCode": "BOT-0001"
  }
}
```

Controller：

```java
@RestController
@RequestMapping("/stations")
public class StationController {
    @Autowired
    private StationService stationService;

    @GetMapping("/{stationCode}/status")
    public Result<StationStatusDto> getStatus(
            @PathVariable String stationCode) {
        return Result.success(stationService.getStatus(stationCode));
    }
}
```

Service：

```java
@Service
public class StationService {
    @Autowired
    private StationMapper stationMapper;

    public StationStatusDto getStatus(String stationCode) {
        Station station = stationMapper.selectByCode(stationCode);
        if (station == null) {
            throw new BusinessException("工位不存在");
        }
        return StationStatusDto.from(station);
    }
}
```

Mapper：

```java
public interface StationMapper extends BaseMapper<Station> {
    Station selectByCode(String stationCode);
}
```

## 参数校验

启动水洗请求：

```json
{
  "stationCode": "WASH-01",
  "deviceCode": "PUMP-01",
  "action": "START",
  "durationSeconds": 15
}
```

DTO：

```java
public class StationCommandRequest {
    @NotBlank
    private String stationCode;

    @NotBlank
    private String deviceCode;

    @NotBlank
    private String action;

    @Min(1)
    @Max(60)
    private Integer durationSeconds;
}
```

Controller使用`@Valid`：

```java
public Result createCommand(
        @Valid @RequestBody StationCommandRequest request) {
    return stationCommandService.create(request);
}
```

DTO只保证格式，Service还要检查：

- 工位是否存在。
- 操作人是否有权限。
- 设备是否在线。
- 当前是否有瓶子。
- 前置工序是否合格。
- 是否存在未完成命令。
- 参数是否在安全上下限。
- 是否有活动安全报警。

## 设备控制的后端流程

```text
鸿蒙屏提交命令
→ Spring Boot校验
→ MySQL保存PENDING命令
→ HTTP返回commandId
→ MQTT发布命令
→ 设备收到并执行
→ 设备返回ACK
→ 后端更新SUCCESS、FAILED或TIMEOUT
→ WebSocket推送最终结果
```

数据库保存成功不等于设备动作成功，必须等待设备ACK。

## 数据库事务

装箱完成需要同时：

- 更新瓶子状态。
- 新增装箱明细。
- 更新箱子数量。

```java
@Transactional
public void packBottle(...) {
    bottleMapper.updateStatus(...);
    boxItemMapper.insert(...);
    boxMapper.increaseQuantity(...);
}
```

- 三步一起成功或一起回滚。
- 数据库事务不能回滚已经执行的机械臂动作或MQTT命令。

## 调用AI服务

```text
Spring Boot
→ 提交瓶型、设备状态和当前工序
→ Python查询RAG和MCP
→ 返回参数建议
→ Spring Boot校验
→ 保存AI决策
→ 决定是否下发
```

必须设置：

- 连接超时。
- 响应超时。
- 有限重试。
- 熔断或降级。
- AI不可用时使用已审核工艺或人工处理。

AI超时不能使基础报警和安全规则失效。

## 异常分类

### 参数错误

- 设备编号为空。
- 浓度不是数字。
- 时间格式错误。
- 在DTO和Controller入口阻止。

### 业务错误

- 设备离线。
- 气体检测未通过。
- 当前工序不允许灌装。
- 返回明确、可展示的错误信息。

### 系统错误

- 数据库断开。
- MQTT连接失败。
- 程序空指针。
- 后端记录完整日志，客户端只返回安全的通用错误。

## 日志要求

新代码使用日志框架，不使用`printStackTrace()`作为主要处理方式。

```java
log.error("发送设备命令失败，deviceCode={}", deviceCode, exception);
```

控制日志至少包含：

```text
requestId
commandId
operatorId
stationCode
deviceCode
action
result
timestamp
```

## 新业务包结构

```text
controller
├─ StationController
├─ SensorController
└─ ProductionController

service
├─ StationService
├─ SensorService
├─ ProductionFlowService
└─ AiDecisionService

dto
├─ request
└─ response

entity
mapper
config
exception
```

物流、仓储和AI先作为同一个Spring Boot工程中的业务模块，不急于拆微服务。

## 实操作业

- 启动后端并找到成功日志。
- 调用现有设备故障接口。
- 从Controller追踪到Service、Mapper和数据库。
- 增加只读“查询工位状态”接口。
- 使用Knife4j测试成功和工位不存在。
- 增加参数校验。
- 画出“启动水洗”的后端执行顺序。
- 说明AI超时后的降级方式。

## 验收问题

### 问题

Controller收到“启动灌装”请求后，能否直接调用MQTT发送启动命令？

### 答案

不能。必须调用Service完成权限、工序、设备、安全参数和重复命令校验，创建可追踪命令后再交给MQTT。

## 具体实操：增加一个查询工位状态接口

### 步骤1：复制现有模块作为阅读样本

依次打开：

```text
hdc_server/src/main/java/com/archermind/hdc/controller/DeviceController.java
hdc_server/src/main/java/com/archermind/hdc/service/DeviceService.java
hdc_server/src/main/java/com/archermind/hdc/mapper/DeviceMapper.java
hdc_server/src/main/java/com/archermind/hdc/entity/Device.java
```

每个人在纸上写出：

```text
Controller方法名
→ Service方法名
→ Mapper方法名
→ 查询的表
→ 返回给前端的字段
```

### 步骤2：创建状态DTO

在`dto`目录增加`StationStatusDto.java`，先只放演示需要的字段：

```java
@Data
public class StationStatusDto {
    private String stationCode;
    private String state;
    private String mode;
    private Boolean deviceOnline;
    private String currentBottleCode;
}
```

不要把数据库Entity全部返回给页面。

### 步骤3：创建Controller

```java
@RestController
@RequestMapping("/stations")
public class StationController {
    @Autowired
    private StationService stationService;

    @GetMapping("/{stationCode}/status")
    public Result<StationStatusDto> getStatus(
            @PathVariable String stationCode) {
        return Result.success(stationService.getStatus(stationCode));
    }
}
```

### 步骤4：先用假数据跑通接口

Service暂时不查数据库：

```java
@Service
public class StationService {
    public StationStatusDto getStatus(String stationCode) {
        StationStatusDto dto = new StationStatusDto();
        dto.setStationCode(stationCode);
        dto.setState("IDLE");
        dto.setMode("MANUAL");
        dto.setDeviceOnline(true);
        dto.setCurrentBottleCode("BOT-TEST-001");
        return dto;
    }
}
```

重新启动后端，调用：

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri 'http://localhost:8088/hdc/api/stations/WASH-01/status'
```

看到`code=0`和`data.stationCode=WASH-01`后，说明Controller和Service已经接通。

### 步骤5：增加参数校验

在Service中先拒绝空编号和不存在工位：

```java
if (stationCode == null || stationCode.trim().isEmpty()) {
    return Result.message("工位编号不能为空");
}
```

再测试：

```text
/stations//status
/stations/UNKNOWN/status
```

记录返回结果，不允许所有编号都返回同一份假数据。

### 步骤6：增加一个启动命令接口

创建请求DTO：

```java
@Data
public class StationCommandRequest {
    @NotBlank
    private String stationCode;
    @NotBlank
    private String deviceCode;
    @NotBlank
    private String action;
    @Min(1)
    @Max(60)
    private Integer durationSeconds;
}
```

Controller：

```java
@PostMapping("/commands")
public Result<CommandResultDto> create(
        @Valid @RequestBody StationCommandRequest request) {
    return stationCommandService.create(request);
}
```

### 步骤7：在Service中按顺序校验

严格按照下面顺序写日志和判断：

1. 检查工位存在。
2. 检查动作是否在白名单，例如只允许`START`和`STOP`。
3. 检查设备在线。
4. 检查当前设备状态为`IDLE`。
5. 检查气体检测是否合格。
6. 检查是否存在活动命令。
7. 创建`PENDING`命令记录。
8. 暂时不发MQTT，只返回命令编号。

### 步骤8：测试四种结果

使用PowerShell：

```powershell
$body = @{
  stationCode = 'WASH-01'
  deviceCode = 'PUMP-01'
  action = 'START'
  durationSeconds = 15
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:8088/hdc/api/stations/commands' `
  -ContentType 'application/json' `
  -Body $body
```

分别修改：

```text
durationSeconds=0：参数校验失败
deviceCode=OFFLINE-01：设备离线
action=RUN：动作不在白名单
正常请求：返回commandId和PENDING
```

### 步骤9：练习事务

创建命令时同时写入命令表和操作日志表。给Service方法加`@Transactional`，故意让日志插入失败，确认命令记录不会单独保存。

### 步骤10：使用日志定位

每个关键步骤打印：

```text
requestId
stationCode
deviceCode
action
校验结果
commandId
```

调用失败时从Controller入口日志开始，逐层确认是否进入Service、Mapper和MQTT。

### 本课完成标志

- 能新增一个查询接口并用PowerShell调用。
- 能新增一个控制接口并返回`commandId`。
- 后端能拒绝空参数、非法动作、离线设备和重复命令。
- 能说明事务只保证数据库，不保证物理设备已经动作。

## 保姆式实施手册：从现有后端新增第一个可调试模块

### 需要的软件

- IntelliJ IDEA Community或Eclipse：写Java、运行和断点调试。
- JDK 8：必须与项目兼容。
- Maven：编译和加载依赖。
- MySQL客户端：验证表和事务。
- Postman或PowerShell：调用HTTP接口。
- Git：每完成一个小步骤就提交。

### 前置检查

在PowerShell执行：

```powershell
Test-NetConnection 127.0.0.1 -Port 3307
Test-NetConnection 127.0.0.1 -Port 31883
Get-ChildItem 'E:\2026挑战杯\工业沙盘2026' -Recurse -Filter pom.xml | Select-Object FullName
```

进入显示`hdc_server\pom.xml`的目录，再执行：

```powershell
mvn -DskipTests compile
```

编译失败不能进入下一步。先记录第一条错误、文件、行号和使用的JDK版本。

### 第1步：用IDE打开后端

1. 打开IDE，选择Open。
2. 选择包含`pom.xml`的`hdc_server`目录。
3. 等待Maven依赖加载完成。
4. 在项目设置中选择JDK 8。
5. 找到`HdcApplication.java`。
6. 先使用Run启动，不要立即修改代码。
7. 看到`Started HdcApplication`后停止，再准备调试。

### 第2步：从现有接口学习调用链

打开四个文件：

```text
controller/MachineFailureController.java
service/MachineFailureService.java
mapper/MachineFailureMapper.java
entity/MachineFailure.java
```

在纸上写出：

```text
HTTP路径
→ Controller方法
→ Service方法
→ Mapper方法
→ 数据库表
→ 返回Result
```

如果不知道一个类是做什么的，先看它被谁调用，不要从文件名猜。

### 第3步：新增状态DTO和查询接口

在`dto`目录新建`StationStatusDto.java`，只放页面需要的字段：

```java
@Data
public class StationStatusDto {
    private String stationCode;
    private String state;
    private String mode;
    private Boolean deviceOnline;
    private String currentBottleCode;
}
```

新建Controller：

```java
@RestController
@RequestMapping("/stations")
public class StationController {
    @Autowired
    private StationService stationService;

    @GetMapping("/{stationCode}/status")
    public Result<StationStatusDto> getStatus(
            @PathVariable String stationCode) {
        return Result.success(stationService.getStatus(stationCode));
    }
}
```

### 第4步：先返回固定数据验证网络

Service先返回固定数据：

```java
@Service
public class StationService {
    public StationStatusDto getStatus(String stationCode) {
        StationStatusDto dto = new StationStatusDto();
        dto.setStationCode(stationCode);
        dto.setState("IDLE");
        dto.setMode("MANUAL");
        dto.setDeviceOnline(true);
        dto.setCurrentBottleCode("BOT-TEST-001");
        return dto;
    }
}
```

启动后端，用PowerShell调用：

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:8088/hdc/api/stations/WASH-01/status'
```

预期：HTTP成功、`code=0`、`data.stationCode=WASH-01`。如果失败，先查路径和上下文，不接数据库。

### 第5步：用断点确认请求流向

1. 在Controller方法第一行打断点。
2. 使用IDE Debug启动后端。
3. 再次执行PowerShell请求。
4. 观察`stationCode`。
5. Step Into进入Service。
6. 观察DTO返回值。
7. Resume让请求返回。

如果断点不进入：检查端口、路径、Controller包是否被Spring扫描。如果进入Controller但Service为空：检查依赖注入和异常日志。

### 第6步：改为数据库查询

先在数据库插入测试工位或设备记录，再创建Mapper查询。顺序必须是：

```text
Entity字段
→ Mapper查询
→ Service转换DTO
→ Controller返回
→ PowerShell验证
```

不要让Controller直接调用Mapper，也不要把数据库Entity原样返回。

### 第7步：实现控制请求的第一版

第一版只做数据库闭环，不发MQTT：

```text
接收请求
→ 校验字段
→ 查询设备和工位
→ 检查权限和状态
→ 写入device_command=PENDING
→ 返回commandId
```

请求示例：

```json
{
  "stationCode": "WASH-01",
  "deviceCode": "PUMP-01",
  "action": "START",
  "durationSeconds": 15
}
```

测试四种输入：空字段、非法动作、设备离线、正常请求。每种都记录HTTP状态、业务码、数据库变化和日志。

### 第8步：再接MQTT和ACK

只有PENDING接口稳定后才接设备命令：

1. Service保存PENDING。
2. 发布MQTT后更新SENT。
3. MQTT回调收到同一`commandId`。
4. 校验设备编号。
5. 更新SUCCESS或FAILED。
6. 推进瓶子状态或创建报警。

MQTT发布异常不能把命令伪装成成功。没有ACK不能把PENDING改成SUCCESS。

### 第9步：调试工具和故障定位

#### 编译失败

看第一条错误的文件和行号，检查包名、导入、括号、泛型和Java版本，然后重新执行：

```powershell
mvn -DskipTests compile
```

#### 启动失败

顺序检查：Java版本、8088端口、MySQL、表结构、MQTT和配置文件。

#### 404

逐段核对：`context-path`、Controller路径、方法映射、前端基础URL是否重复`/hdc`。

#### 500

把同一请求复制到PowerShell重试；在Controller、Service和Mapper打断点；查看第一个异常堆栈。

### 第10步：后端门禁与回退

通过条件：

```text
[ ] 假数据查询接口成功
[ ] 数据库查询接口成功
[ ] PENDING命令写库成功
[ ] 权限、设备、状态、参数和重复校验成功
[ ] SUCCESS、FAILED、TIMEOUT可区分
[ ] 断点能解释请求流
[ ] Maven编译成功
```

任何改动导致原有接口不能用：

1. 立即停止继续开发。
2. 查看`git diff`。
3. 只回退自己的提交或修复对应文件。
4. 重启原有系统确认基线恢复。
