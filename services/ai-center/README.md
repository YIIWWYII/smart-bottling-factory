# Bottling Factory AI Center

独立 AI 中枢最小可联调服务。默认监听 `8091`，API 前缀 `/api`。

当前实现是 `LOCAL DEMO / SIMULATION` 闭环，用于让三个鸿蒙前端和后台管理端完成联调：

- 助手会话：创建、发送、读取最终消息、停止、重试。
- WebSocket：`/api/assistant/events` 推送 `ai.conversation.started/delta/completed/stopped`。
- 只读边界：助手问答不会创建命令、不会释放人工锁、不会审批知识、不会改变生产状态。
- 预留接口：视觉识别、决策审计、知识提交/审核、AI 与生产后端集成接口均返回明确模拟结果，避免页面 404。

## Run

```powershell
cd D:\HarmonyOS-Dev\Workspaces\bottling-ai-center\services\ai-center
python -m ai_center --host 0.0.0.0 --port 8091
```

生产后端只读工具默认尝试：

```text
http://127.0.0.1:8088/hdc/api/ai-integration/facts
```

可通过环境变量覆盖：

```powershell
$env:PRODUCTION_BACKEND_BASE_URL='http://192.168.0.104:8088/hdc/api'
```

## Smoke Test

```powershell
cd D:\HarmonyOS-Dev\Workspaces\bottling-ai-center\services\ai-center
python .\scripts\smoke_test.py
```

测试会自动启动本服务，覆盖：

- `GET /api/health`
- `POST /api/assistant/conversations`
- WebSocket `/api/assistant/events`
- `POST /api/assistant/conversations/{id}/messages`
- `POST /api/assistant/conversations/{id}/messages/{messageId}/stop`
- `POST /api/assistant/conversations/{id}/messages/{messageId}/retry`
- `GET /api/assistant/conversations/{id}/messages`

## Important Boundary

产品汇报里可以说“AI 给出调参/控制建议”，但工程实现上：

- 助手问答通道永远只读。
- 隐式决策只能生成字段级 command intent。
- 真正命令必须走生产后端 `/ai-integration/command-intents`，由后端校验 RBAC、人工锁、版本、范围、联锁和边缘 ACK。
