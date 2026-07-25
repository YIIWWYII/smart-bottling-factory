# Spring Boot 后端

工程入口：`hdc_server`。这是三个鸿蒙 App 的唯一业务后端，不是鸿蒙工程，不使用 ArkTS 或 `devecocli`。

负责业务状态、MySQL 持久化、可选 Redis、HTTP、WebSocket、MQTT/外部设备接入和 AI 外部端口。开发与验收以 `docs/ai-prompts/04-backend.md` 和 `contracts/` 为准。
