# 鸿蒙工位终端

DevEco 工程入口为 `BottlingFactoryTerminal/`，应用标识为 `com.factory.bottling.terminal`。

当前应用启动后直接打开网页平台的工位终端。网页平台运行在电脑上，鸿蒙应用通过 ArkWeb 显示页面；网页的设备、任务和连接配置由平台服务保存。

请完整下载仓库。工程引用 `packages/harmony-assistant/harmonyassistant/`，只复制此目录会丢失共享模块。

导入、SDK、签名、服务地址和运行步骤见 [项目交接与部署说明](../../ONBOARDING-DEPLOYMENT.md)。工程内部的页面和启动入口见 [工程说明](BottlingFactoryTerminal/README.md)。

应用中的“原生工位”保留旧原生界面，其后端配置与当前网页入口分开。使用网页入口不需要启动旧 Spring Boot 后端。
