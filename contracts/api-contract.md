# HTTP API 契约

## 基础约定

- 演示基地址：`http://<backend-host>:8088/hdc/api`。真机和模拟器不能把后端写成 `localhost`。
- 编码：`application/json;charset=UTF-8`。鉴权头：`Authorization: <token>`。
- 统一响应：`{ "code": 0, "message": "", "data": ..., "success": true }`。当前兼容成功码 0/1，融合阶段统一。
- 非 2xx、业务失败码、超时、解析失败都是真实失败，UI 不得显示“操作成功”。

## 当前核心端点

| 方法 | 路径 | 使用端 | 用途 |
| --- | --- | --- | --- |
| POST | `/auth/register`、`/auth/login` | 后台管理 | 注册、登录 |
| GET/POST | `/auth/me`、`/auth/logout` | 后台管理 | 恢复会话、退出 |
| GET/PATCH | `/auth/users[/{id}]` | 后台管理 | 用户、角色与状态 |
| GET | `/factory/dashboard` | 三前端 | 生产和产品追踪总览 |
| GET | `/factory/runs/{traceCode}` | 三前端 | 单产品完整追踪链 |
| POST | `/factory/runs`、`/factory/runs/{traceCode}/steps` | 后端/联调 | 创建和推进产品 |
| GET | `/factory/runtime` | 三前端 | 设备、工位、缓冲和异常快照 |
| POST | `/factory/runtime/telemetry` | 外部设备接口 | 设备运行数据进入中枢 |
| GET/POST | `/factory/runtime/incidents` | 管理、后端 | 查询或创建异常 |
| POST | `/factory/runtime/incidents/{id}/resolve` | 管理 | 按策略解决异常 |
| GET | `/operations/overview` | 三前端 | 读数、报警、命令和 AI 审计 |
| POST | `/operations/sensors/readings` | 外部设备接口 | 传感器读数进入中枢 |
| POST | `/operations/alarms/{id}/ack` | 管理 | 报警确认 |
| POST/GET | `/operations/commands` | 终端、管理 | 创建设备命令、查询状态 |
| POST | `/operations/commands/{id}/ack` | 外部控制接口 | 边缘层回执命令 |
| POST/GET | `/operations/ai/decide`、`/operations/ai/audits` | AI、管理 | AI 决策与审计 |
| GET | `/logistics/overview` | 展板、管理 | AGV、仓区安全和库存 |
| POST | `/logistics/agv/tasks` | 后端/管理 | 创建物流任务 |
| POST | `/logistics/agv/tasks/{id}/telemetry` | 外部设备接口 | AGV 速度、路程、负载、避障 |
| POST | `/logistics/warehouse/zones/{code}/telemetry` | 外部设备接口 | 仓区气体、烟雾和温度 |
| POST | `/logistics/warehouse/inbound` | 后端/管理 | 箱级入库 |

## 写操作标准

设备控制至少包含 `deviceCode`、`commandType`、参数、来源和客户端请求号。后端完成角色鉴权、参数范围、设备在线、工序联锁、幂等和安全门校验后返回 `PENDING`；只有收到边缘层回执才显示 `ACKNOWLEDGED` 或 `FAILED`。HTTP 成功不等于设备执行成功。
