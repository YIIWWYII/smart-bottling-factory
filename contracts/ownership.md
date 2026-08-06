# 所有权与协作边界

| 对话 | 分支 | 唯一可写目录 | 禁止修改 |
| --- | --- | --- | --- |
| 总架构 | `codex/ai-architecture` | 根 `README.md`、`contracts/`、`docs/` | `apps/`、`services/`、`packages/` |
| 数字展板 | `codex/display` | `apps/digital-display/` | 其他 App、生产后端、AI 中枢、共享助手包 |
| 小屏终端 | `codex/terminal` | `apps/workstation-terminal/` | 其他 App、生产后端、AI 中枢、共享助手包 |
| 后台管理 | `codex/admin` | `apps/admin-console/` | 其他 App、生产后端、AI 中枢、共享助手包 |
| 生产后端 | `codex/backend` | `services/backend/` | 三个 App、AI 中枢、共享助手包 |
| AI 中枢与共享助手 | `codex/ai-center` | `services/ai-center/`、`packages/harmony-assistant/` | 三个宿主 App、生产后端 |
| 融合评审 | `integration/full-system` | 合并、经批准的最小契约兼容修复和联调证据 | 新建第六个应用、替代模块大规模开发、擅自改变架构边界 |

三个前端只实现本 App 的 `AssistantHostAdapter`、页面挂载点、ArkUI/Three.js 选择映射和引用导航。它们不得复制聊天 UI、AI ApiClient、会话存储、流式状态机或共享包源码，也不得向适配器注入设备控制能力。

AI 中枢任务是 `packages/harmony-assistant/` 的唯一代码所有者，同时负责 `services/ai-center/` 的问答/RAG/实时工具服务。后台知识上传/审核和工位正式调参仍属于对应 App 的业务页面，不进入共享包。

模块对话发现契约不足时提交“契约变更提案”，列出影响、兼容和测试，不直接改公共契约。总架构对话发布架构契约；融合对话只能在批准后做必要兼容修复，并记录来源。
