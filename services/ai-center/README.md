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
$env:PRODUCTION_BACKEND_BASE_URL='http://192.168.106.20:8088/hdc/api'
$env:PRODUCTION_BACKEND_SERVICE_TOKEN='dev-ai-service-token'
```

`PRODUCTION_BACKEND_SERVICE_TOKEN` 必须与 Spring Boot 的
`factory.ai.service-token` 一致。`factory-demo` 本地联调默认使用
`dev-ai-service-token`；部署环境必须改为独立的服务间凭据，不能继续使用演示值。

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

## Admin AI Settings

The admin console can manage AI runtime settings through the AI center. API keys are stored server-side and are always masked when returned to the frontend.

- `GET /api/admin/ai/config`
- `PUT /api/admin/ai/config`
- `POST /api/admin/ai/config/test`
- `POST /api/admin/ai/config/test-question`
- `GET /api/admin/ai/rag/status`
- `GET /api/admin/ai/rag/documents`
- `POST /api/admin/ai/rag/documents`
- `POST /api/admin/ai/rag/reindex`

Supported config fields:

- `provider`: `LOCAL_DEMO` or an OpenAI-compatible provider label.
- `modelName`, `baseUrl`, `apiKey`, `temperature`, `maxTokens`.
- `requestTimeoutSeconds`, `retryCount`, `streamingEnabled`.
- `embeddingModel`, `vectorStoreType`, `vectorStoreUrl`.
- `ragTopK`, `chunkSize`, `chunkOverlap`, `knowledgeIndexEnabled`.

Timeout behavior:

- Assistant answers never create production commands.
- If the external model times out, the service returns a clear `AI_PROVIDER_TIMEOUT` result instead of spinning forever.
- `POST /api/admin/ai/config/test` classifies common errors as `AUTH_FAILED`, `NETWORK_TIMEOUT`, `MODEL_NOT_FOUND`, `RATE_LIMITED`, or `RAG_NOT_READY`.
- `LOCAL_DEMO` mode returns immediately and is marked `LOCAL DEMO / SIMULATION`.

Boot defaults can be set with `.env.example` style variables such as `AI_PROVIDER`, `AI_MODEL_NAME`, `AI_BASE_URL`, `AI_API_KEY`, and `AI_REQUEST_TIMEOUT_SECONDS`.

## Important Boundary

产品汇报里可以说“AI 给出调参/控制建议”，但工程实现上：

- 助手问答通道永远只读。
- 隐式决策只能生成字段级 command intent。
- 真正命令必须走生产后端 `/ai-integration/command-intents`，由后端校验 RBAC、人工锁、版本、范围、联锁和边缘 ACK。
