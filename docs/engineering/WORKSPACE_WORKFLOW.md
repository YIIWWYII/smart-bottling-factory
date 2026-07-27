# 多对话工作区流程

六个对话使用六个物理目录，其中只有前五个负责模块开发：

| 对话 | 工作区 | 分支 |
| --- | --- | --- |
| 数字展板 | `D:\HarmonyOS-Dev\Workspaces\bottling-display` | `codex/display` |
| 小屏终端 | `D:\HarmonyOS-Dev\Workspaces\bottling-terminal` | `codex/terminal` |
| 后台管理 | `D:\HarmonyOS-Dev\Workspaces\bottling-admin` | `codex/admin` |
| AI 协同端 | `D:\HarmonyOS-Dev\Workspaces\bottling-ai-assistant` | `codex/ai-assistant` |
| 后端 | `D:\HarmonyOS-Dev\Workspaces\bottling-backend` | `codex/backend` |
| 融合评审 | `D:\HarmonyOS-Dev\Workspaces\bottling-integration` | `integration/full-system` |

推荐使用 `git worktree`：共享 Git 对象但文件和分支互不干扰。一个分支不能同时被两个 worktree 检出。DevEco Studio 可以多开不同工程，但构建优先使用官方 CLI；每个鸿蒙工程使用不同的 D 盘构建暂存目录。

开发对话完成后推送自己的分支，不互相合并。融合对话从集成分支依次合并五个开发分支，先解决契约，再构建联调，最后创建到 `main` 的 PR。

## 推荐建立命令

先确保重构分支已合入基线，或把下面的 `origin/main` 换成已推送的重构分支：

```powershell
git fetch origin
git worktree add -b codex/display D:\HarmonyOS-Dev\Workspaces\bottling-display origin/main
git worktree add -b codex/terminal D:\HarmonyOS-Dev\Workspaces\bottling-terminal origin/main
git worktree add -b codex/admin D:\HarmonyOS-Dev\Workspaces\bottling-admin origin/main
git worktree add -b codex/ai-assistant D:\HarmonyOS-Dev\Workspaces\bottling-ai-assistant origin/main
git worktree add -b codex/backend D:\HarmonyOS-Dev\Workspaces\bottling-backend origin/main
git worktree add -b integration/full-system D:\HarmonyOS-Dev\Workspaces\bottling-integration origin/main
```
