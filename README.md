# 智慧装瓶工厂

智慧装瓶工厂是一套面向装瓶生产线的工业监测与控制系统，覆盖瓶体预处理、气体安全检测、外观检测、饮料准备、灌装、二次检测、装箱、AGV 运输和仓储入库九个环节。

系统由三个鸿蒙原生应用、一个 Spring Boot 生产后端、一个独立 AI 中枢和一个三端共享的鸿蒙助手包组成。项目支持本地模拟数据演示，也为 MQTT 传感器、视觉识别和生产设备接入保留接口。

## 项目组成

| 模块 | 位置 | 用途 |
| --- | --- | --- |
| 数字展板 | `apps/digital-display` | 查看整条产线总览、九个工序和工序详情；包含独立 2D 平面工艺图与 3D Three.js 场景 |
| 工位终端 | `apps/workstation-terminal` | 查看当前工位、设备和物料状态，进行有权限的参数调整并查看命令回执 |
| 后台管理 | `apps/admin-console` | 用户认证、生产任务、设备、异常、产品物料、物流仓储、AI 配置、知识治理和操作审计 |
| 生产后端 | `services/backend/hdc_server` | Spring Boot 业务中枢，负责生产事实、MySQL 持久化、实时推送、权限和设备命令安全校验 |
| AI 中枢 | `services/ai-center` | 独立 Python 服务，负责助手会话、模型配置、知识治理、演示 RAG、视觉和决策接口 |
| 共享助手 | `packages/harmony-assistant` | 三个鸿蒙应用共用的 ArkUI 助手 HAR，统一会话、流式回答、引用和权限反馈 |

## 架构关系

```text
传感器 / 视觉设备 / MQTT
            │
            ▼
Spring Boot 生产后端 ───── MySQL
       │       │  ╲
       │       │   ╲ AI 中枢 ── 模型 / RAG / 知识治理
       │       │
       ├───────┼────── HTTP / WebSocket
       │       │
       ▼       ▼
数字展板   工位终端   后台管理
```

数字展板和工位终端中的 2D、3D 画面均通过 HarmonyOS ArkWeb 加载 HAP 内的本地 Three.js 资源。2D 是独立的平面工艺图，不是 3D 场景的俯视角。

## 当前能力

- 九工序连续生产流程和并行饮料准备流程展示。
- 设备、传感器、在制品、质量门、报警、AGV 和仓储信息展示。
- 2D/3D 场景独立开关、暂停/恢复、状态标识、设备拖拽布局和实体选择。
- Spring Boot HTTP 接口、生产 WebSocket、MySQL 持久化和模拟数据降级。
- 工位端按设备能力、角色、范围、联锁和人工锁执行受控命令。
- AI 助手会话、流式响应、停止、重试、知识提交/审核和 AI 配置。
- 管理端支持模型地址、模型名、API Key、超时和 RAG 参数配置；API Key 不返回明文。

## 当前限制

当前仓库适合代码评审、模拟数据演示和软件联调，不能直接当作真实产线控制软件使用。以下能力需要在现场或正式环境单独配置和验收：

- 真实传感器、MQTT Broker、PLC、机械臂和 AGV。
- 真实视觉识别模型和生产级推理服务。
- 真实大模型、生产级向量数据库和正式 MCP 工具链。
- 鸿蒙调试签名、真机安装和长时间运行性能。

AI 默认使用 `LOCAL_DEMO`，不会自动调用外部模型；没有 MQTT 数据时，页面会明确显示 `SIMULATION` 或 `LOCAL DEMO`。

## 快速开始

完整的跨电脑安装、配置、启动、账号和故障排查步骤见：

**[项目交接与部署说明](ONBOARDING-DEPLOYMENT.md)**

企业软硬件对接、设备点位、协议、命令回执和验收要求见：

**[软硬件对接需求](SOFTWARE-HARDWARE-INTEGRATION-REQUIREMENTS.md)**

最简启动顺序：

1. 安装 Git、JDK 8、Maven、MySQL、Python、DevEco Studio 和 HarmonyOS SDK。
2. 克隆仓库并创建 MySQL 数据库 `hdc`。
3. 启动 Spring Boot 后端，默认端口 `8088`。
4. 启动 AI 中枢，默认端口 `8091`。
5. 在三个 App 的 `ApiConfig.ets` 中填写运行服务电脑的局域网 IP。
6. 用 DevEco Studio 或官方 `devecocli` 分别构建并运行三个鸿蒙工程。

项目、SDK、模拟器、Maven 仓库和 Python 环境建议放在 D 盘或其他非 C 盘的 ASCII 路径。

## 演示账号

后台管理：`admin / admin123`

工位端密码统一为 `station123`，用户名对应工序：

```text
station_pretreatment   station_gas          station_appearance
station_beverage       station_filling      station_secondary
station_packing        station_agv          station_warehouse
```

数字展板默认只读，不需要登录。

## 目录说明

```text
apps/       三个鸿蒙原生应用
services/   Spring Boot 后端和 Python AI 中枢
packages/   三端共享的鸿蒙助手 HAR
contracts/  跨模块接口和数据约定
docs/       工业 HMI 设计参考
```

## License

当前版本用于教学演示和竞赛展示。正式对外发布前，请补充项目组确定的开源许可证和第三方资源声明。
