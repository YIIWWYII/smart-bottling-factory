# 七对话工作区流程

七个 Codex 对话使用七个物理目录。总架构只维护文档契约，五个开发对话负责业务工程/共享包，融合对话负责最终汇总。

| 对话 | 工作区 | 分支 | 交付 |
| --- | --- | --- | --- |
| 总架构 | `D:\HarmonyOS-Dev\Workspaces\bottling-ai-architecture` | `codex/ai-architecture` | `README/contracts/docs` |
| 数字展板 | `D:\HarmonyOS-Dev\Workspaces\bottling-display` | `codex/display` | 展板 App 与宿主适配器 |
| 小屏终端 | `D:\HarmonyOS-Dev\Workspaces\bottling-terminal` | `codex/terminal` | 工位 App 与宿主适配器 |
| 后台管理 | `D:\HarmonyOS-Dev\Workspaces\bottling-admin` | `codex/admin` | 管理 App、业务页面与宿主适配器 |
| 生产后端 | `D:\HarmonyOS-Dev\Workspaces\bottling-backend` | `codex/backend` | Spring Boot 生产中枢 |
| AI 中枢 | `D:\HarmonyOS-Dev\Workspaces\bottling-ai-center` | `codex/ai-center` | AI 服务与 `packages/harmony-assistant` |
| 融合评审 | `D:\HarmonyOS-Dev\Workspaces\bottling-integration` | `integration/full-system` | 合并、端到端联调和最终 PR |

推荐使用 `git worktree`：共享 Git 对象但文件和分支互不干扰。一个分支不能同时被两个 worktree 检出。DevEco Studio 可以打开不同鸿蒙工程，但构建优先使用官方 CLI；每个鸿蒙工程使用不同 D 盘构建暂存目录。

## 共享助手依赖顺序

1. 总架构先在 `codex/ai-architecture` 发布 `assistant-host-contract.md`。
2. AI 中枢在 `codex/ai-center` 实现 AI 服务和 `@bottling/harmony-assistant` HAR，推送包版本和测试证据。
3. 三个前端分别实现宿主适配器和选择映射，依赖同一包版本，不复制包源码。
4. 开发对话完成后只推送自己的分支，不互相覆盖业务代码。
5. 融合依次合入生产后端、AI 中枢/共享包、数字展板、小屏、后台；每次合入后单独测试。

共享包尚未发布时，前端可以先按契约完成适配器设计和稳定实体 ID 映射，但不得创建临时聊天 UI 或独立 AI 客户端。需要在分支内构建时，应等待 AI 中枢共享包提交，或以保留所有权历史的方式引入该提交；不得复制粘贴包源码。

## 新建工作区参考

```powershell
git fetch origin
git worktree add -b codex/ai-architecture D:\HarmonyOS-Dev\Workspaces\bottling-ai-architecture origin/main
git worktree add -b codex/display D:\HarmonyOS-Dev\Workspaces\bottling-display origin/main
git worktree add -b codex/terminal D:\HarmonyOS-Dev\Workspaces\bottling-terminal origin/main
git worktree add -b codex/admin D:\HarmonyOS-Dev\Workspaces\bottling-admin origin/main
git worktree add -b codex/backend D:\HarmonyOS-Dev\Workspaces\bottling-backend origin/main
git worktree add -b codex/ai-center D:\HarmonyOS-Dev\Workspaces\bottling-ai-center origin/main
git worktree add -b integration/full-system D:\HarmonyOS-Dev\Workspaces\bottling-integration origin/main
```
