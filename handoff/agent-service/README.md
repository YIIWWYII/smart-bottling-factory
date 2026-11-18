# 智能体岗服务包

本包包含 Qwen3.5-4B 基础权重、LoRA 适配权重及 llama.cpp 运行文件，并附一份瓶安助手提示词/工具配置参考。Coze Studio 本身及已发布的工作流/数据库不包含在 ZIP 内；目标电脑需要在自己的 Coze Studio 中导入或按参考配置重新发布智能体。

## 第一次使用

本包分为三种用法：接口联通模拟、已发布 Coze 接口转发、适配模型推理。三种用法都需要 Windows x64 的 Node.js 24 LTS；接口联通模拟不需要模型、不需要 Docker、不需要 Coze。适配模型的运行文件和模型文件已经随包提供，首次运行若提示缺少 `VCRUNTIME` 或 `MSVCP`，双击 `model/vc_redist.x64.exe` 安装 Microsoft Visual C++ 运行库，再重新启动。

安装 Node.js 后重新打开命令行，执行 `node --version`，主版本号应为 24 或更高。解压 ZIP 后不要只复制 `.cmd` 文件，必须保留 `model/models` 和 `model/runtime` 的完整目录；启动脚本会检查这些文件是否存在。

## 启动

双击“启动适配模型.cmd”，模型服务监听 8004。提示缺少 VC++ 运行库时，安装 model/vc_redist.x64.exe 后重试。浏览器访问 http://本机局域网IP:8004/health 检查是否就绪。给测试岗三个值：地址 http://模型电脑IP:8004/v1、模型名 bottle-qwen35-lora、演示密钥 sk-bottle-8004。Coze 在同一台电脑的 Docker 内运行时，模型地址填 http://host.docker.internal:8004/v1。CPU 推理响应可能较慢。

已有 Coze 迁移包时，先恢复原智能体、检查模型连接并发布 API。Coze 在本机 8888 正常运行后，双击“交付已发布智能体.cmd”。它只转发 Coze 的问答和工作流接口。给平台岗和测试岗三个值：地址 http://智能体电脑IP:8889、实际 Bot ID、实际访问令牌。用告警复盘时另给已发布的工作流 ID。

如只检查连通，双击“启动接口联通模拟.cmd”。地址 http://智能体电脑IP:8887、Bot ID 123456789012、令牌 demo-token。这里返回固定答复。专用局域网按需允许 TCP 8004（模型）、8889（已发布智能体）或 8887（联通模拟）入站。

## 联通模拟接口

- GET /health
- POST /v3/chat
- GET /v3/chat/retrieve
- GET /v3/chat/message/list
- POST /v3/chat/cancel

coze-native-agent.json 可核对提示词和工具名称，OpenAPI 文件可用来配置工具。跨电脑时，将工具回调地址改成平台岗提供的 http://平台电脑IP:8094，凭证由平台岗单独交付。旧 Coze 数据库及其账号、历史会话和访问令牌没有装入本包；配置参考不能替代恢复或发布。
