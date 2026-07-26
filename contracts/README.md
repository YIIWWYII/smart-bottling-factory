# 公共契约

本目录是三个鸿蒙前端与 Spring Boot 后端之间的共同真相源。

- [api-contract.md](api-contract.md)：HTTP 端点、统一响应与鉴权。
- [realtime-contract.md](realtime-contract.md)：WebSocket 事件、断线和补偿。
- [domain-contract.md](domain-contract.md)：工位、设备、产品、异常、命令和状态。
- [ownership.md](ownership.md)：四个开发对话与融合对话的文件所有权。

## 变更规则

1. 字段删除、重命名、类型或状态语义变化必须先改契约并由融合对话审核。
2. 新增可选字段应向后兼容；前端遇到缺失字段显示 `--` 或“等待数据”，不能崩溃。
3. 时间使用 ISO-8601，默认 `Asia/Shanghai`；标识符使用稳定字符串。
4. 数值同时给出单位；阈值由后端或配置返回，不能在多端写不同版本。
5. 契约变更 PR 列出受影响的三前端、后端、模拟数据和测试。
