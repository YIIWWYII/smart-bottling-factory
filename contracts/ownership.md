# 所有权与协作边界

| 对话 | 分支 | 唯一可写业务目录 | 禁止修改 |
| --- | --- | --- | --- |
| 数字展板 | `codex/display` | `apps/digital-display/` | 其他 App、后端 |
| 小屏终端 | `codex/terminal` | `apps/workstation-terminal/` | 其他 App、后端 |
| 后台管理 | `codex/admin` | `apps/admin-console/` | 其他 App、后端 |
| AI 协同端 | `codex/ai-assistant` | `apps/ai-assistant/` | 其他 App、后端 |
| 后端 | `codex/backend` | `services/backend/` | 四个 App |
| 融合评审 | `integration/full-system` | 合并、契约兼容和联调修复 | 新建第六个应用、替代模块大规模开发 |

开发对话如需改变 `contracts/`，先在 PR 描述提交“契约变更提案”，列出影响和迁移方案。README、契约、CI 或根配置的最终修改由融合对话统一处理。
