# 项目交接与部署说明

本说明用于在另一台 Windows 电脑运行当前网页平台，并用 DevEco Studio 构建鸿蒙应用。鸿蒙应用通过 ArkWeb 加载电脑上的网页平台，打开应用后直接进入工位终端。

所有文件路径均以当前步骤说明的目录为起点。命令中的 http://... 是网络地址，不是文件路径。

## 1. 准备软件和项目

需要 Git for Windows、Node.js 24、MySQL 8 或 9、DevEco Studio，以及与工程匹配的 HarmonyOS SDK 6.1.1(24)。SDK、模拟器和项目建议放在非系统盘。当前网页入口不需要 Java、Maven 或旧 Spring Boot 后端。只运行网页时不需要 DevEco。

在准备保存项目的父文件夹中，右键选择“在终端中打开”。项目及其所有上级目录请使用英文、数字和短横线，避免中文和空格导致构建路径问题。

```powershell
# 检查 Git 是否安装并加入 PATH；识别不了时重新打开终端，或修复 Git 安装的 PATH 选项。
git --version

# 检查 Node.js，版本应为 v24.x。
node --version

# 下载主分支的整个仓库，不使用只下载网页目录的稀疏检出。
git clone --branch main https://github.com/YIIWWYII/smart-bottling-factory.git smart-bottling-factory

# 进入仓库根目录。
Set-Location .\smart-bottling-factory
```

应看到 work、apps、packages 等目录。网页工程在 work/industrial-design-demo/；鸿蒙工程在 apps/workstation-terminal/BottlingFactoryTerminal/；鸿蒙共享模块在 packages/harmony-assistant/harmonyassistant/。不要拆开移动这些目录。

## 2. 创建数据库

MySQL 用于保存任务、设备资产、业务数据和服务配置。先在 Windows“服务”中确认 MySQL 服务已启动。使用 MySQL 自带命令行或图形管理工具，以安装时设置的管理员账号登录。

在 SQL 编辑区依次执行以下语句。把 ReplaceWithYourPassword 换成自己设置的数据库密码，后续在 .env 中使用同一密码。账号仅允许本机 TCP 连接。

```sql
-- 创建当前网页平台使用的空数据库。
CREATE DATABASE IF NOT EXISTS bottleworks CHARACTER SET utf8mb4;

-- 创建平台连接数据库时使用的本机账号。
CREATE USER IF NOT EXISTS 'bottleworks'@'127.0.0.1' IDENTIFIED BY 'ReplaceWithYourPassword';

-- 授予该账号读写及创建本库业务表的权限。
GRANT ALL PRIVILEGES ON bottleworks.* TO 'bottleworks'@'127.0.0.1';
```

如果账号已经存在，CREATE USER IF NOT EXISTS 不会更新密码；使用现有密码，或由管理员为该账号重新设置密码。不要导入旧 Spring Boot 工程的 hdc.sql，它不是当前网页平台的数据库结构。

## 3. 配置网页平台

以下命令从仓库根目录开始。

```powershell
# 进入网页工程；后续 npm 和平台脚本都在此目录执行。
Set-Location .\work\industrial-design-demo

# 建立只属于本机的数据库配置文件；已有 .env 时先检查内容，不覆盖。
if (-not (Test-Path -LiteralPath .\.env)) { Copy-Item -LiteralPath .\.env.example -Destination .\.env }

# 用记事本打开本机配置。
notepad .\.env
```

按实际安装填写：

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=bottleworks
MYSQL_USER=bottleworks
MYSQL_PASSWORD=ReplaceWithYourPassword
TELEMETRY_TOKEN=ReplaceWithYourOwnRandomToken
```

MySQL 常用默认端口为 3306，原演示电脑使用 3307。以自己的 MySQL 配置为准；.env.example 中的 3307 需要相应修改。TELEMETRY_TOKEN 是外部程序提交设备数据时使用的令牌，请设置自己的随机值，不上传 .env。

```powershell
# 根据仓库的锁定版本安装网页和 Node.js 接口依赖。
npm ci

# 启动网页及业务接口；监听局域网以便鸿蒙设备访问。
npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
```

保持此终端运行。在电脑浏览器打开 http://127.0.0.1:5174/，应能进入平台。服务首次启动会创建业务表并生成初始演示数据。页面未打开时，先检查终端报错；不要跳过数据库错误继续构建鸿蒙应用。

此命令同时承载网页、业务、AI 接入和设备接口。npm run build 仅生成前端资源，双击 HTML 或运行 vite preview 不会启动这些业务接口。

## 4. 导入鸿蒙工程并直接打开平台

1. 打开 DevEco Studio，在欢迎页点击 **Open（打开）**；已进入其他工程时，选择 **File → Open（文件 → 打开）**。
2. 从仓库根目录依次进入 apps、workstation-terminal，选择 BottlingFactoryTerminal 文件夹，点击打开。不是选择整个仓库，也不是只选择 entry。
3. 等待工程同步。共享模块从仓库的 packages/harmony-assistant/harmonyassistant/ 引用，保持原目录关系即可。
4. 工程要求 SDK 6.1.1(24)。如果提示 SDK 缺失，在 DevEco 的 SDK 管理器中安装匹配版本；不要仅为绕过提示随意改版本号。
5. 先确认第 3 步的网页服务仍在运行。启动 HarmonyOS 模拟器，在运行目标中选中它。
6. 按本机 DevEco 的签名提示，在 **File → Project Structure → Signing Configs（文件 → 项目结构 → 签名配置）**中完成调试签名。真机安装使用自己的账号、设备和签名配置，不复制他人的证书路径。
7. 运行模块选择 entry，点击顶部 **Run（运行）**。等待构建、安装完成。
8. 应用启动后直接打开网页平台的工位终端，不再要求先填写地址。

默认地址位于 entry/src/main/ets/pages/Platform.ets（相对鸿蒙工程目录）：

```typescript
@StorageLink('platformUrl') address: string = 'http://10.0.2.2:5174/#station'
```

10.0.2.2 用于模拟器访问宿主电脑。若所用模拟器网络不支持该地址，改用平台电脑的局域网 IPv4。实体平板也使用电脑的局域网 IPv4，例如 http://192.168.1.20:5174/#station；示例 IP 必须换成实际地址。

```powershell
# 在运行网页服务的电脑查看网络配置，找到当前以太网或 Wi-Fi 的 IPv4 地址。
ipconfig
```

电脑和平板应在可互通的同一网络中，Windows 防火墙需允许 Node.js 在当前专用网络接收连接。平板上的 127.0.0.1 指向平板本身，不能用来访问电脑服务。

连接失败时，应用显示地址输入框和“重试”按钮；也可在代码中改好默认地址后重新运行。界面重试修改只在当前进程保存，若希望下次启动仍使用新地址，请修改代码默认值并重新构建。

## 5. 编写状态卡与配置设备的顺序

先在网页工程修改状态卡，在电脑浏览器检查，再构建鸿蒙应用。网页通过网络加载，网页代码更新后通常只需刷新应用页面或重新打开应用；改变 ArkTS 外壳、默认地址、权限或本地资源时，需要重新构建并安装 HAP。

机械臂通信在应用构建后配置。相关文件相对网页工程为：

- config/mg400-communication.json：机械臂 IP、TCP 端口、超时。
- config/mg400-protocol.json：指令和反馈协议。
- config/mg400-trajectories.json：轨迹工程预设。
- config/mg400-projects/：平台保存的轨迹工程副本。
- public/config/mg400-model-mapping.json：模型节点与关节反馈映射。

通信参数未填时，平台和鸿蒙应用仍可构建、启动，连接实机时才校验通信资料。预设轨迹在平台登记不等于已导入控制器，控制器中的工程需通过对应的 DobotStudio 导入并保持工程名一致。运行真实轨迹前核对设备安装位置、点位和现场条件。

## 6. 可选的 AI、Coze 和视觉服务

网页、初始演示数据和鸿蒙外壳可先独立运行。智能体回答、真实视觉检测和知识检索需要相应服务，不能仅靠网页源码恢复。

### 沿用现有迁移包

将现有 Coze、适配模型、知识库和视觉迁移资料另行交付。按迁移包说明恢复 Docker 镜像、数据卷、模型和知识数据，启动后在平台“工程管理 → AI 配置”填写实际地址、已发布智能体 ID、工作流 ID 和本机令牌。地址和端口以迁移包为准，保留迁移后的 Coze 提示词、工具及模型设置。

GitHub 不包含 Coze 容器数据、完整模型权重、个人访问令牌和签名材料。只安装 Docker Desktop 不会自动生成原来的 Coze 智能体。连接其他电脑上的现成服务时，也需要按网络与访问权限填写该服务地址。

### 仓库附带的辅助启动脚本

以下命令均从网页工程目录执行。已有迁移包启动脚本时，优先沿用迁移包，不同时启动第二套相同端口的服务。

```powershell
# 仅启动端口 8093 的固定结果视觉示例，用于检查接口；不执行真实识别，也不会启动模型或 Coze。
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-integration-services.ps1
```

如需使用仓库的本地模型辅助脚本，在 .runtime/chat-model/ 下提供 llama.cpp/llama-server.exe、自己的基础 GGUF 和适配器 GGUF。以下文件名为摆放约定，必须与实际文件一致：

```powershell
# 启动指定基础模型和适配器；8002 为兼容接口，转发到本机 8003 模型进程。
# 此脚本不自动修改 Coze；迁移包已经占用相同端口时不要运行。
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-chat-model.ps1 -ModelRoot .\.runtime\chat-model -ModelFile base-model.gguf -AdapterFile adapter.gguf
```

模型服务还需要与文件兼容的 llama.cpp 运行文件。可通过 -ProjectorFile 指定多模态投影文件，通过 -CredentialsFile 指定包含 model_api_key 的本机 JSON；不传凭据文件时沿用进程环境的 LLAMA_API_KEY。模型与适配器路径相对 ModelRoot 计算，不含电脑盘符。脚本使用 CPU，显式传入 -GpuLayers 才启用对应 GPU 层数。

知识服务需要单独安装 Python 依赖 fastapi、uvicorn、numpy、fastembed，并提供 platform-knowledge.json 与 BAAI/bge-small-zh-v1.5 的已有模型缓存。

```powershell
# 安装知识服务需要的 Python 依赖；若使用迁移包的虚拟环境，应在该环境中执行。
python -m pip install fastapi uvicorn numpy fastembed

# 使用指定知识数据和已有向量模型缓存启动知识检索，以及固定结果视觉示例。
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-integration-services.ps1 -KnowledgeRoot .\.runtime\knowledge -EmbeddingCache .\.runtime\embedding-cache

# Docker 引擎及迁移数据已恢复后，启动指定 Compose 中现有镜像；不会下载替代镜像。
# 此例假设已把迁移部署放在 .runtime/coze/，以实际恢复目录为准。
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-integration-services.ps1 -CozeComposeFile .\.runtime\coze\docker-compose.yml
```

启动日志位于网页工程 .runtime/logs/。脚本输出“已请求启动”不代表模型完成加载；还需检查对应服务健康接口和平台连接测试。固定结果视觉示例不能作为 YOLO、PatchCore 的真实检测结果。

## 7. 是否需要转移原电脑的数据

如果对方只需运行初始演示，使用空库即可。如果需要你当前配置好的设备、任务和模型位置，还需迁移业务数据与上传文件：

1. 在平台停止操作并停止网页服务后，使用 MySQL 工具导出原电脑的 bottleworks 数据库。该库可能包含 AI 连接令牌，只交给获授权的接收者，不上传 GitHub。
2. 复制网页工程 public/uploads/ 下实际使用的上传文件，以及 .runtime/ 下需要保留的上传资源；不要把本机依赖、日志或临时文件混入资料包。
3. 在对方电脑启动平台之前恢复到目标数据库，按相同相对目录放回上传文件。已有数据时先备份，不直接覆盖。
4. 按对方现场重新核对机械臂 IP、设备地址和服务连接。需要恢复工具桥令牌时，单独处理本机 config/platform-agent.json，不要提交到 GitHub。

运行中的数据库与上传文件需保持一致。仓库中已有的默认模型资源会随克隆下载，但本机后来上传的模型及资产登记不会仅凭 Git 克隆自动恢复。

## 8. 更新代码

以下命令从仓库根目录执行。更新前保存本机修改，停止网页服务；保留 .env、数据库和迁移服务数据。

```powershell
# 查看有没有本机代码修改；有修改先处理，避免覆盖学生正在编辑的内容。
git status

# 只允许快进更新，不自动产生合并提交；有分叉时先处理本机提交。
git pull --ff-only origin main

# 进入网页工程，安装与新锁文件一致的依赖。
Set-Location .\work\industrial-design-demo
npm ci

# 重新启动更新后的网页与业务接口。
npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
```

鸿蒙外壳代码有更新时，在 DevEco 中重新同步并运行 entry。仅更新网页时，保持外壳地址指向同一服务，刷新或重新打开应用即可查看。

## 9. 常见问题

| 现象 | 检查位置与处理 |
| --- | --- |
| Git 或 npm 无法识别 | 确认软件已安装并加入 PATH；安装后重开终端和 DevEco |
| MySQL 连接被拒绝 | 检查 MySQL 服务、实际端口，以及 .env 是否保存 |
| 数据库或账号不存在 | 完成第 2 步；网页只自动创建业务表，不自动创建数据库或 MySQL 用户 |
| 页面能看，操作接口失败 | 查看启动终端的数据库错误；不要用静态 HTML 或 preview 替代业务服务 |
| 平板连不上，电脑能打开 | 检查平板使用的 IP、局域网、服务 --host 和 Windows 防火墙 |
| 应用先进入旧原生工位 | 确认已拉取本次更新并重新构建安装；当前 EntryAbility 应加载 pages/Platform |
| 鸿蒙构建提示共享模块缺失 | 检查 packages/harmony-assistant/harmonyassistant/，完整克隆并保留目录关系 |
| 找不到 SDK 或签名文件 | 安装工程指定 SDK，并在本机配置调试签名；不使用其他电脑的证书路径 |
| AI 或视觉没有结果 | 先启动迁移包中相应服务，再配置和测试连接；网页启动不会自动启动这些外部服务 |
| 更新后上传模型消失 | 检查模型文件与数据库中的模型路径是否一同迁移 |

## 10. 验证与其他工程

网页工程目录执行以下检查，不会启动真实机械臂：

```powershell
# 执行 Node.js 自动测试。
node --test *.test.mjs

# 构建前端，检查界面代码与资源引用。
npm run build
```

鸿蒙静态检查脚本位于 apps/workstation-terminal/BottlingFactoryTerminal/tools/validate-project.ps1。静态检查不能替代 DevEco 的 HAP 构建和设备运行；完整验收应确认网页可操作、鸿蒙构建成功并在目标设备显示平台。

仓库还保留原生数字展板、原生后台、Spring Boot 和 Python AI 中枢。只有使用这些独立工程时才按各自目录的 README 安装和启动，不把旧服务的 hdc 数据库、ApiConfig.ets 或端口配置套用到当前网页平台。
