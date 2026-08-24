# 智慧装瓶工厂项目交接与部署说明

本文面向第一次拿到项目的老师或同学，说明当前仓库能做什么、哪些已经验证、如何在另一台 Windows 电脑上配置和运行。

仓库地址：<https://github.com/YIIWWYII/smart-bottling-factory>

## 1. 先看结论

当前 GitHub 默认分支 `main` 已包含以下部分：

| 部分 | 当前状态 | 说明 |
| --- | --- | --- |
| 数字展板 | 已完成构建 | 鸿蒙 ArkTS；总览、工序详情、独立 2D/3D Three.js 场景、设备/物料选择 |
| 工位终端 | 已完成构建 | 鸿蒙 ArkTS；当前工位、实时数据、设备能力、参数控制和命令回执 |
| 后台管理 | 已完成构建 | 鸿蒙 ArkTS；登录、RBAC、运营、设备、物料、物流仓储、AI、知识和审计页面 |
| Spring Boot 后端 | 单元测试通过 | 生产业务中枢、MySQL 持久化、WebSocket、模拟数据、设备和 AI 接口 |
| AI 中枢 | 本地演示闭环通过 | Python 服务、助手会话、流式事件、停止/重试、知识治理接口和本地演示 RAG |
| 共享助手 HAR | 已完成构建 | `@bottling/harmony-assistant`，三端共同依赖，当前版本 `1.0.5` |

### 1.1 已验证的证据

在项目组验证环境执行过：

- 后端 `mvn test`：`Tests run: 36, Failures: 0, Errors: 0`。
- 后端 `factory-demo-smoke.ps1`：HTTP、WebSocket、MySQL 登录、模拟传感器和模拟命令 ACK 全部通过。
- AI 中枢 `scripts/smoke_test.py`：`SMOKE TEST PASSED`。
- 三个 App 的 `tools/validate-project.ps1`：均通过。
- 共享 HAR 和三个 HAP：均出现 `BUILD SUCCESSFUL`。

当前构建产物是调试、未签名产物：

| 产物 | 路径 | SHA-256 |
| --- | --- | --- |
| 共享 HAR 1.0.5 | `packages/harmony-assistant/harmonyassistant/build/default/outputs/default/harmonyassistant.har` | `19F8AACD3B7ECDEC0B11DDB220D9C4ADEB94B5DEE92167251543A4788703FED1` |
| 数字展板 HAP | `apps/digital-display/BottlingFactoryDisplay/entry/build/default/outputs/default/entry-default-unsigned.hap` | `74939E51329DF12B9A2E24BEE7C66D0E08269F39EC5EF40B2ABCA484D43CA2F1` |
| 工位终端 HAP | `apps/workstation-terminal/BottlingFactoryTerminal/entry/build/default/outputs/default/entry-default-unsigned.hap` | `98BE18B2439CAA7AECA8F14E869EB9B6233E3E1886A851DE55F341EA20D9C3DF` |
| 后台管理 HAP | `apps/admin-console/BottlingFactoryAdmin/entry/build/default/outputs/default/entry-default-unsigned.hap` | `A6D98253E9392993C4FAAF1013C6594BCD1244729799472326B7F4D21AEBF1F2` |

### 1.2 目前还不能说“全流程真实打通”的部分

以下内容不能当作已经完成的生产能力：

1. 本次验证没有在线鸿蒙模拟器或真机，因此没有在本次交接前重新做安装、点击、ArkWeb WebGL 和长时间运行验收。
2. 后端默认配置使用 MySQL `127.0.0.1:3307`。如果本机 MySQL 是 `3306`，必须按本文修改配置或启动参数。
3. 后端登录、MySQL 持久化和 WebSocket 已在项目组环境完成联调；换电脑后仍必须按本文重新执行 smoke，不能只看单元测试。
4. AI 默认是 `LOCAL_DEMO`。真实大模型需要在后台 AI 配置中填写兼容接口、模型和 API Key；本地 RAG 当前是演示型内存检索，不是生产向量数据库。
5. 企业 PLC Topic 和 DOBOT TCP 已有兼容适配入口，但真实设备、真实视觉模型、MCP 工具链和“视觉识别后自动生成命令意图”的生产闭环仍需现场配置和验收。

因此，当前版本适合：代码评审、界面演示、模拟数据联调和后续硬件接入；不应直接作为真实产线控制软件使用。

## 2. 推荐目录和磁盘要求

不要把项目、SDK、模拟器、Maven 仓库或 Python 虚拟环境放在 C 盘。推荐使用 ASCII 路径，避免 DevEco/Hvigor 因中文路径构建失败：

```text
D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory
D:\HarmonyOS-Dev\DevEco-Studio
D:\HarmonyOS-Dev\HarmonyOS-SDK
D:\HarmonyOS-Dev\Maven\repository
D:\HarmonyOS-Dev\Data\ai-center
```

如果老师电脑没有 D 盘，可以把仓库放到其他盘的 ASCII 路径，例如 `E:\HarmonyOS-Dev\Workspaces\smart-bottling-factory`；关键是不要使用中文目录和 C 盘默认缓存。

## 3. 需要安装的软件

### 3.1 必需软件

1. Git for Windows。
2. JDK 8。后端 `pom.xml` 的 Java 目标版本是 8。
3. Maven 3.9 或项目组提供的 Maven。建议 Maven 本地仓库放在 `D:\HarmonyOS-Dev\Maven\repository`。
4. MySQL 8.x，并创建数据库 `hdc`。
5. Python 3.10 或更高版本。AI 中枢的当前代码已在 Python 3.13.5 环境通过 smoke test。
6. DevEco Studio，以及与工程匹配的 HarmonyOS SDK `6.1.1(24)`。
7. 鸿蒙模拟器或开启开发者模式的 HarmonyOS 真机。

### 3.2 可选软件

- Redis：用于后续实时缓存和分布式协调；当前本地演示启动不以 Redis 为前置条件。
- MQTT Broker：只有接入真实传感器或 MQTT 演示时才需要；默认 `factory-demo` 使用模拟数据。
- Node.js：只用于可选的 Three.js rawfile 浏览器语法检查，不是鸿蒙构建前置条件。

### 3.3 DevEco 路径检查

在 PowerShell 中执行：

```powershell
$cli = 'D:\HarmonyOS-Dev\npm-global\devecocli.cmd'
& $cli --version
& $cli device list
& $cli emulator list
```

应能看到 `devecocli 1.2.0-stable` 或兼容版本。模拟器必须先在 DevEco Studio 中启动，`device list` 才会显示在线设备。

## 4. 获取仓库

```powershell
New-Item -ItemType Directory -Force 'D:\HarmonyOS-Dev\Workspaces' | Out-Null
Set-Location 'D:\HarmonyOS-Dev\Workspaces'
git clone https://github.com/YIIWWYII/smart-bottling-factory.git smart-bottling-factory
Set-Location '.\smart-bottling-factory'
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git status --short --branch
```

陌生使用者直接使用默认分支 `main` 即可，不要自行把多个开发分支混合复制到一个工程中。拉取后可用 `git rev-parse HEAD` 查看当前版本。

## 5. 初始化 MySQL

先确认 MySQL 正在运行，并记住 root 密码。项目不会替老师猜测或修改数据库密码。

使用 MySQL 客户端执行：

```sql
CREATE DATABASE IF NOT EXISTS hdc
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

项目启动时会按配置执行 `src/main/resources/sql/mysql.sql` 和 `src/main/resources/sql/factory.sql`。如果数据库用户没有建表权限，请由管理员先执行这两个 SQL 文件，或给项目数据库用户授权。

当前后端的演示配置默认值是：

```text
数据库：hdc
地址：127.0.0.1
端口：3307
用户：root
密码：123456
```

如果本机是常见的 `3306` 或密码不同，不要直接改 GitHub 中的默认配置，可以在启动时覆盖：

```powershell
$env:MAVEN_OPTS = '-Dmaven.repo.local=D:\HarmonyOS-Dev\Maven\repository'
mvn spring-boot:run `
  "-Dspring-boot.run.profiles=factory-demo" `
  "-Dspring-boot.run.arguments=--spring.datasource.url=jdbc:mysql://127.0.0.1:3306/hdc?characterEncoding=UTF-8&serverTimezone=Asia/Shanghai --spring.datasource.username=root --spring.datasource.password=你的数据库密码"
```

也可以在 DevEco/IDEA 的运行配置中设置同样的 Spring 参数。不要把真实数据库密码提交到 GitHub。

## 6. 启动 Spring Boot 后端

打开第一个 PowerShell：

```powershell
Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\services\backend\hdc_server'
$env:MAVEN_OPTS = '-Dmaven.repo.local=D:\HarmonyOS-Dev\Maven\repository'
mvn spring-boot:run "-Dspring-boot.run.profiles=factory-demo"
```

如果使用了 MySQL 覆盖参数，将参数附加到命令末尾。看到 Spring Boot 启动并监听 `8088` 后，另开 PowerShell 检查：

```powershell
Invoke-RestMethod 'http://127.0.0.1:8088/hdc/api/factory/health'
Invoke-RestMethod 'http://127.0.0.1:8088/hdc/api/factory/topology'
```

健康接口可访问后，运行后端模拟联调脚本：

```powershell
Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\services\backend\hdc_server'
.\scripts\factory-demo-smoke.ps1 -BaseUrl 'http://127.0.0.1:8088/hdc/api'
```

该脚本会检查 HTTP 快照、WebSocket、模拟传感器、登录、模拟设备命令 ACK、九工序拓扑、设备能力和 StageSnapshot。

### 6.1 全模拟与真实/模拟混合模式

三个鸿蒙应用始终只连接 Spring Boot，不直接连接 PLC、MQTT Broker 或机械臂。是否使用真实设备由后端按设备运行态决定：

```text
设备有新鲜 MQTT 遥测 -> 真实设备模式
设备没有遥测或超过 30 秒 -> 只对该设备使用模拟数据
模拟设备命令 -> 模拟适配器立即 ACKNOWLEDGED
真实 MQTT 设备命令 -> SENT，等待 command-ack
真实设备通道不可用 -> FAILED，不显示假成功
```

没有现场硬件时继续使用 `factory-demo`。接入企业 Broker 时改用 `factory-mqtt-demo`，并通过启动参数填写现场地址：

```powershell
mvn spring-boot:run `
  "-Dspring-boot.run.profiles=factory-mqtt-demo" `
  "-Dspring-boot.run.arguments=--mqtt.url=tcp://192.168.1.10 --mqtt.port=1883 --factory.enterprise.plc.switch-devices=PK-ARM-01,FIL-HEAD-01,PT-CV-01,AGV-01"
```

企业 PLC 兼容 Topic：

```text
后端请求全量同步：order/adapter/sync
PLC 全量状态：     order/service/sync
PLC 单路状态：     order/service/switch
PLC 指示灯状态：   order/service/lamps
```

`device` 数组或 `index` 默认按以下顺序映射，可用 `factory.enterprise.plc.switch-devices` 覆盖：

```text
0 机械臂 -> PK-ARM-01
1 机床   -> FIL-HEAD-01
2 输送线 -> PT-CV-01
3 巡检车 -> AGV-01
```

标准设备 Topic 为：

```text
上报：factory/{lineId}/{stageCode}/{deviceCode}/telemetry
上报：factory/{lineId}/{stageCode}/{deviceCode}/sensor
上报：factory/{lineId}/{stageCode}/{deviceCode}/event
上报：factory/{lineId}/{stageCode}/{deviceCode}/command-ack
下发：factory/{lineId}/{stageCode}/{deviceCode}/command
```

DOBOT 当前只接管 `PK-ARM-01 + START_PACKING_PLAN`。确认机械臂已切到 TCP/IP 二次开发模式、点位和物理安全已验收后，才能启用：

```powershell
mvn spring-boot:run `
  "-Dspring-boot.run.profiles=factory-mqtt-demo" `
  "-Dspring-boot.run.arguments=--factory.enterprise.dobot.enabled=true --factory.enterprise.dobot.host=192.168.1.6 --factory.enterprise.dobot.port=29999 --factory.enterprise.dobot.packing-script=blockly_hdc2024"
```

企业资料中的 `hdc2024` 是 DobotStudio Pro 中的工程名称；企业可运行 ArkTS 源码实际发送的是 `runscript(blockly_hdc2024)`。如果现场控制器中的脚本名不同，只覆盖 `factory.enterprise.dobot.packing-script`，不要修改 Java 代码。

## 7. 启动 AI 中枢

AI 中枢与 Spring Boot 是两个进程。打开第二个 PowerShell：

```powershell
Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\services\ai-center'
if (-not (Test-Path '.venv')) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item '.env.example' '.env' -ErrorAction SilentlyContinue
.\.venv\Scripts\python.exe -m ai_center --host 0.0.0.0 --port 8091
```

第三个 PowerShell 运行 AI smoke test：

```powershell
Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\services\ai-center'
.\.venv\Scripts\python.exe .\scripts\smoke_test.py
```

看到 `SMOKE TEST PASSED` 才表示 AI 中枢的本地演示接口可用。

### 7.1 配置真实大模型

默认配置是安全的 `LOCAL_DEMO`，不会调用外部模型。要使用兼容 OpenAI API 的平台，可先在 AI 中枢环境变量中配置：

```powershell
$env:AI_PROVIDER = 'OPENAI_COMPATIBLE'
$env:AI_MODEL_NAME = '平台当前可用模型名'
$env:AI_BASE_URL = 'https://平台接口地址/v1'
$env:AI_API_KEY = '只在本机环境变量中设置，不要提交'
$env:AI_REQUEST_TIMEOUT_SECONDS = '20'
```

也可以登录后台管理端，在 AI 配置页面填写。API Key 由 AI 中枢服务端保存并脱敏返回；不要写入 ArkTS 源码、Git、聊天记录或截图。

真实模型连接应先使用后台的“连接测试”和“测试提问”，确认模型、权限、网络、超时和 RAG 状态，再用于演示。

## 8. 配置三个鸿蒙应用

三个 App 当前默认访问 `192.168.0.104`。如果后端和 AI 中枢运行在另一台电脑，必须将三个 App 的 `ApiConfig.ets` 中的主机地址改为运行服务电脑的局域网 IPv4 地址：

```text
apps/digital-display/BottlingFactoryDisplay/entry/src/main/ets/service/ApiConfig.ets
apps/workstation-terminal/BottlingFactoryTerminal/entry/src/main/ets/service/ApiConfig.ets
apps/admin-console/BottlingFactoryAdmin/entry/src/main/ets/service/ApiConfig.ets
```

地址关系：

```text
Spring Boot HTTP： http://电脑IP:8088/hdc/api
Spring Boot WS：   ws://电脑IP:8088/hdc/api/dataScreen/1
AI HTTP：          http://电脑IP:8091/api
AI WS：            ws://电脑IP:8091/api/assistant/events
```

模拟器或真机不能使用 `localhost`，因为那代表设备自身。Windows 防火墙要允许 TCP `8088` 和 `8091` 入站；如果只在同一台电脑的模拟器运行，也要确认模拟器能访问宿主机地址。

不要修改本地 Three.js 为 CDN。Three.js 已放在各 App 的 `rawfile/factory3d/vendor/three.min.js`，2D 页面在 `rawfile/factory2d`，3D 页面在 `rawfile/factory3d`。

## 9. 构建、安装和运行三个 App

建议先构建共享 HAR，再构建三个 HAP：

```powershell
$cli = 'D:\HarmonyOS-Dev\npm-global\devecocli.cmd'

Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\packages\harmony-assistant'
& $cli build --modules harmonyassistant --build-mode debug

Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\apps\digital-display\BottlingFactoryDisplay'
& $cli build --modules entry --build-mode debug

Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\apps\workstation-terminal\BottlingFactoryTerminal'
& $cli build --modules entry --build-mode debug

Set-Location 'D:\HarmonyOS-Dev\Workspaces\smart-bottling-factory\apps\admin-console\BottlingFactoryAdmin'
& $cli build --modules entry --build-mode debug
```

每次必须看到 `BUILD SUCCESSFUL`，并检查 `entry/build/default/outputs/default/*.hap` 是否生成。当前工程没有提交签名配置，生成的是 `*-unsigned.hap`；在 DevEco Studio 中配置本机调试签名后再 Run，或者使用该电脑已有的调试签名完成安装。不要把个人签名文件提交到 GitHub。

也可以直接在 DevEco Studio 中分别打开三个工程目录，等待 Sync 完成后选择模拟器运行。三个工程不是一个入口选择器，应该分别运行：

1. `BottlingFactoryDisplay`：启动后直接进入数字展板总览。
2. `BottlingFactoryTerminal`：启动后进入工位选择或绑定的当前工位。
3. `BottlingFactoryAdmin`：启动后进入登录页。

## 10. 演示账号

### 后台管理员

```text
用户名：admin
密码：admin123
```

### 工位账号

所有工位演示账号的密码都是 `station123`：

| 用户名 | 工位 |
| --- | --- |
| `station_pretreatment` | 预处理 |
| `station_gas` | 气体检测 |
| `station_appearance` | 外观检测 |
| `station_beverage` | 饮料准备 |
| `station_filling` | 灌装 |
| `station_secondary` | 二次检测 |
| `station_packing` | 机械臂装箱 |
| `station_agv` | AGV 运输 |
| `station_warehouse` | 仓储入库 |

数字展板默认只读，不需要登录。后端数据库初始化失败时，这些演示账号不会凭空生效，应先检查 Spring Boot 日志中的 MySQL 连接和表初始化错误。

## 11. 最小验收顺序

按下面顺序验收，任何一步失败先处理当前一步：

1. `mvn test`：确认后端代码测试通过。
2. 启动 MySQL，确认数据库 `hdc` 可连接。
3. 启动 Spring Boot，检查 `factory/health` 和 `factory/topology`。
4. 运行 `factory-demo-smoke.ps1`，确认 HTTP、WebSocket、模拟传感器、登录和模拟命令 ACK。
5. 启动 AI 中枢，运行 `smoke_test.py`。
6. 启动模拟器，安装并运行数字展板：确认总览、九工序、2D、3D、滚动、暂停/恢复和对象选择。
7. 运行工位端：使用对应工位账号，确认本站数据、设备能力、只读/可控边界和命令回执。
8. 运行后台：使用 `admin/admin123`，确认登录、导航、AI 配置、知识审核和审计页面。
9. 关闭后端或 AI 中枢，确认前端显示离线/LOCAL DEMO，不显示假成功。
10. 重新启动服务，确认快照、WebSocket 重连和数据版本恢复。

## 12. 常见问题

### 登录失败

先确认：

```powershell
Invoke-RestMethod 'http://127.0.0.1:8088/hdc/api/factory/health'
```

如果接口都打不开，是后端未启动或端口/IP错误；如果接口能打开但登录失败，查看 Spring Boot 控制台是否有 MySQL 表初始化错误，再确认账号密码是否输入正确。

### 页面显示 LOCAL DEMO

这表示前端没有拿到可用后端快照，或服务不可达。它是明确的演示降级，不代表真实传感器在线。检查后端地址、Windows 防火墙、端口 `8088` 和手机/模拟器与电脑是否在可通信网络。

### AI 提问超时

先在后台 AI 配置中使用“连接测试”和“测试提问”。检查 `AI_BASE_URL`、模型名、API Key、服务端网络和 `AI_REQUEST_TIMEOUT_SECONDS`。本地演示应使用 `LOCAL_DEMO`，不依赖外部大模型。

### HAP 无法安装

当前构建产物是 unsigned debug HAP。打开 DevEco Studio 配置调试签名后重新构建；同时确认模拟器系统版本与工程 `6.1.1(24)` 匹配。

### 2D/3D 空白

先确认 HAP 内含 `rawfile/factory2d`、`rawfile/factory3d` 和本地 `three.min.js`，再检查模拟器/真机 ArkWeb WebGL 支持。3D 不可用时可以关闭 3D，只保留 2D 和实时数据；不要把 2D 改成 3D 俯视角。

### Maven 下载很慢或占用 C 盘

确认 `MAVEN_OPTS` 使用：

```powershell
$env:MAVEN_OPTS = '-Dmaven.repo.local=D:\HarmonyOS-Dev\Maven\repository'
```

DevEco SDK、OHPM 缓存、模拟器和构建目录也应在 D 盘配置。

## 13. 项目边界

- 数字展板只读，不直接控制设备。
- 工位端是现场监视和受控调参入口，命令必须经过后端权限、范围、联锁、人工锁和 ACK。
- 后台负责账号、设备档案、异常、物流仓储、AI 配置、知识审核和审计，不复制现场控制页面。
- Spring Boot 是生产事实和命令安全闸口，不实现模型、RAG、MCP 或提示词。
- AI 中枢负责视觉、问答、RAG、决策建议和知识治理；普通助手问答不能创建设备命令。
- 模拟数据必须标注 `SIMULATION` 或 `LOCAL DEMO`，不能当作真实硬件数据。

详细接口与设计说明请先阅读：

- `contracts/README.md`
- `docs/design/INDUSTRIAL-HMI-UI-SYSTEM.md`
- `SOFTWARE-HARDWARE-INTEGRATION-REQUIREMENTS.md`（企业软硬件对接、设备点位、协议和验收）
