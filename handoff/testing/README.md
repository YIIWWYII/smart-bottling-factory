# 测试岗服务包

本包提供跨电脑联通检查脚本和视觉请求 JSON 示例。它本身不启动服务，分别检查平台、视觉岗和智能体岗给出的局域网地址。Windows 自带 PowerShell 5.1 即可运行，不需要 Node.js、Docker、OpenCV 或模型。

## 检查

在解压后的测试岗服务包目录打开 PowerShell，运行：

    Set-ExecutionPolicy -Scope Process Bypass
    ./检查四岗服务.ps1 -PlatformBaseUrl http://平台IP:5174 -VisionBaseUrl http://视觉IP:8093 -AgentBaseUrl http://智能体IP:8887

脚本检查平台页面和只读数据接口、视觉服务四个分支的正常/缺陷结论，以及智能体 Coze v3 普通问答接口。报告会分别显示通过或失败及地址；失败时先检查服务进程、IP 和 Windows 专用网络防火墙规则。

8887 是固定问答的联通测试。测试原 Coze 时，使用 8889 的地址和对方给的 Bot ID、访问令牌，在平台 AI 助手中问一个普通问题。测试适配模型时沿用已有的 Promptfoo 用例，地址填 http://智能体IP:8004/v1，模型名填 bottle-qwen35-lora，密钥由智能体岗提供。
