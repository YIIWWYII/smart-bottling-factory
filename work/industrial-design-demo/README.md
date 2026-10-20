# 瓶安智慧工厂网页平台

当前演示使用此目录。React/Three.js 提供界面和模型，Vite 插件加载 Node.js 业务、AI 和设备接口，MySQL 保存业务数据。不是根目录 Spring Boot 服务的静态前端。

## 启动

使用 Node.js 24 和 MySQL。先创建空数据库及有该库权限的账号，将 `.env.example` 复制为 `.env`，填写本机数据库连接信息与遥测令牌。服务会初始化业务表。

```powershell
npm ci
npm run dev -- --port 5174
```

浏览器打开 `http://127.0.0.1:5174/`。首次部署需在平台配置模型、Coze Studio、视觉服务及真实设备；仓库不包含本机数据库、登录密钥、模型权重或已经部署的 Coze 容器。`start-integration-services.ps1` 和 `start-chat-model.ps1` 沿用演示电脑的 F 盘路径，其他电脑使用前应调整路径。

`npm run build` 检查并生成前端资源；仅用静态托管或 `vite preview` 不能替代 Node.js 业务服务。

## 机械臂配置

- `config/mg400-communication.json`：IP、端口、连接设置。
- `config/mg400-protocol.json`：反馈帧字段和命令格式。
- `config/mg400-acquisition.json`：接收及展示字段。
- `config/mg400-trajectories.json`：各瓶型取放点位；可乐测试读取 `productTrajectories.profiles`。
- `config/mg400-motion.json`：速度、吸吹气和等待时序。
- `public/config/mg400-model-mapping.json`：Blender 节点与关节反馈映射。

通信、协议和接收配置在重新连接时读取，轨迹与测试运行参数在下次脚本启动时读取，模型映射需刷新页面。平台改速会下发并保存配置。“打开所在文件夹”仅适用于服务所在 Windows 电脑的本地访问。

现有轨迹是演示现场示教值，不能直接用于不同安装位置。`handoff-examples/mg400-cola-loop.mjs` 默认单次执行，只有显式 `--loop` 才循环；运行前核对现场、坐标系、点位和气泵接线。普通构建和以下单元测试不会启动机械臂。

## 验证

```powershell
node --test *.test.mjs
npm run build
```

2026-10-20：123 项 Node 测试通过，前端构建通过；构建仍提示部分资源包超过 500 kB。此轮发布未重新进行真机运动测试。

模型及图片位于 `public/`，Blender 源文件位于 `blender-integration/`，交接样例位于 `handoff-examples/`，平台技能位于 `skills/`。运行数据库、环境密钥、依赖、构建产物和过程截图不提交。
