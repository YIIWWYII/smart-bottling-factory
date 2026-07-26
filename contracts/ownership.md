# 所有权与协作边界

| 对话 | 分支 | 唯一可写业务目录 | 禁止修改 |
| --- | --- | --- | --- |
| 数字展板 | `codex/display` | `apps/digital-display/` | 另两个 App、后端 |
| 小屏终端 | `codex/terminal` | `apps/workstation-terminal/` | 另两个 App、后端 |
| 后台管理 | `codex/admin` | `apps/admin-console/` | 另两个 App、后端 |
| 后端 | `codex/backend` | `services/backend/` | 三个 App |
| 融合评审 | `integration/full-system` | 合并、契约兼容和联调修复 | 新建第五个应用、替代模块大规模开发 |

开发对话如需改变 `contracts/`，先在 PR 描述提交“契约变更提案”，列出影响和迁移方案。README、契约、CI 或根配置的最终修改由融合对话统一处理。
