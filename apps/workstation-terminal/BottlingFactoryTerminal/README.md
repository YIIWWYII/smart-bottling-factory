# 鸿蒙工位终端工程

使用 DevEco Studio 打开本目录。应用的 EntryAbility 直接加载 pages/Platform，通过 ArkWeb 展示当前网页平台。

完整的跨电脑操作步骤见 [项目交接与部署说明](../../../ONBOARDING-DEPLOYMENT.md)。请保留整个仓库的目录关系，共享模块位于 ../../../packages/harmony-assistant/harmonyassistant/。

## 主要文件

| 文件（相对此工程目录） | 用途 |
| --- | --- |
| entry/src/main/ets/entryability/EntryAbility.ets | 应用启动入口，直接打开 pages/Platform |
| entry/src/main/ets/pages/Platform.ets | 网页外壳、平台地址和连接失败后的重试入口 |
| entry/src/main/resources/base/profile/main_pages.json | 页面注册 |
| entry/src/main/module.json5 | 应用模块、设备类型和网络权限 |
| build-profile.json5 | SDK、模块及本机签名配置 |

模拟器默认访问 http://10.0.2.2:5174/#station，电脑上的网页平台必须先运行。实体平板需将 Platform.ets 中 address 的默认值改为平台电脑的局域网地址，然后重新构建；连接失败时也可在应用地址框更正并重试。此页面的地址修改在当前应用进程内保存，关闭进程后仍使用代码中的默认地址。

工程指定 SDK 6.1.1(24)，使用 DevEco Studio 的 SDK 管理器安装匹配组件。仓库不包含个人签名材料，安装到模拟器或真机时请在本机完成签名配置。

机械臂 IP 和端口位于网页工程的配置文件中，构建 HAP 不依赖真实设备连接，也不要求提前填写机械臂端口。

## 保留的原生页面

“原生工位”按钮进入旧的 pages/Workstation；该界面和 StageDetail 使用 Spring Boot 接口。只有需要使用原生页面时，才配置 entry/src/main/ets/service/ApiConfig.ets 并部署对应服务。该地址不会修改 Platform.ets 的网页地址。
