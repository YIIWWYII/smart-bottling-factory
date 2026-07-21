# 第十一课：ArkTS与鸿蒙工程基础

## 本节学习路线

### 这是什么

ArkTS是鸿蒙应用语言，ArkUI是界面框架，Stage是应用模型。你们用它开发产线工位小屏，不是把Spring Boot改写成鸿蒙程序。

### 为什么要学

工位屏不仅展示，还要让操作员看本站状态、提交控制、确认报警、处理断线和显示设备最终结果，因此需要一个独立的鸿蒙前端。

### 它在项目中的位置

鸿蒙ArkTS工位屏 → HTTP/WebSocket → Spring Boot → MQTT → 设备控制器。鸿蒙端不直连MySQL和MQTT。

### 需要的软件和安装

- DevEco Studio。
- HarmonyOS SDK。
- 鸿蒙模拟器或真实工位屏。
- VS Code可用于查看协议，但不能替代DevEco构建鸿蒙工程。

软件、SDK和模拟器数据统一放E盘，例如E盘的HarmonyOS-SDK、HarmonyOS-Projects目录。安装后用DevEco创建Stage ArkTS模板验证，不以安装器成功为准。

### 最小例子

创建BottlingStationHmi工程，运行默认页面，把标题改成“智慧工厂工位屏”，再用State把IDLE切换成RUNNING。

### 项目实操顺序

1. 安装DevEco和SDK到E盘。
2. 创建ArkTS Stage工程。
3. 启动模拟器或连接设备。
4. 运行模板工程。
5. 创建pages、components、model和service目录。
6. 定义StationStatus模型。
7. 创建登录和工位选择页。
8. 创建水洗工位页。
9. 使用假数据验证页面状态。
10. 第13课再接HTTP和WebSocket。

### 鸿蒙调试怎么做

- 工程不能构建：查API版本、SDK版本、Gradle和工程路径。
- 页面白屏：看DevEco运行日志和ArkTS编译错误。
- 模拟器无网络：检查模拟器网络和电脑防火墙。
- 真机访问失败：不能使用localhost，改运行后端电脑的局域网IP。
- 状态不刷新：先确认State绑定，再确认网络数据是否到达。

### 如何与下一节连接

第12课用ArkUI把工位屏做成可操作页面；第13课让页面调用第3课接口并通过第8课WebSocket获得命令结果。

### 通过门禁

每个人都能在E盘创建、运行和调试ArkTS Stage工程，能解释ArkTS、ArkUI、Stage和Spring Boot的边界。

## 学习目标

- 理解鸿蒙工位应用在系统中的位置。
- 掌握ArkTS基础类型、对象和异步概念。
- 理解ArkUI、Stage模型和UIAbility。
- 创建并运行一个ArkTS Stage工程。
- 规划一个工程支持多个工位页面。

## 鸿蒙端职责

```text
鸿蒙工位屏
→ HTTP查询和提交
→ WebSocket接收状态
→ Spring Boot
→ MQTT
→ 设备控制器
```

鸿蒙端负责：

- 展示本站状态、传感器和任务。
- 收集操作员输入。
- 向后端提交操作请求。
- 展示后端校验和设备执行结果。
- 显示报警、断线和数据过期。

鸿蒙端不负责：

- 直接连接MySQL。
- 直接MQTT控制设备。
- 自己决定生产放行。
- 保存唯一可信生产状态。

## ArkTS基础

```ts
let stationName: string = '水洗工位'
let temperature: number = 25.6
let deviceOnline: boolean = true
let alarms: string[] = ['气体超限', '设备离线']
```

对象：

```ts
interface StationStatus {
  stationCode: string
  state: string
  deviceOnline: boolean
}

let status: StationStatus = {
  stationCode: 'WASH-01',
  state: 'IDLE',
  deviceOnline: true
}
```

ArkTS在TypeScript风格基础上强化类型和静态检查。

## ArkUI

常用组件：

- `Column`：纵向排列。
- `Row`：横向排列。
- `Stack`：层叠布局。
- `Text`：文字。
- `Button`：命令按钮。
- `Image`：图片。
- `List`：列表。
- `Grid`：网格。
- `TextInput`：输入。
- `Scroll`：滚动区域。

最小页面：

```ts
@Entry
@Component
struct Index {
  @State message: string = '水洗工位'

  build() {
    Column() {
      Text(this.message)
        .fontSize(28)
      Button('启动水洗')
        .onClick(() => {
          this.message = '正在启动'
        })
    }
  }
}
```

## 状态驱动

```ts
@State deviceState: string = 'IDLE'
@State gasValue: number = 6.2
@State alarmVisible: boolean = false
```

修改状态后ArkUI自动重绘。

不要把所有内容合并成一个大字符串，应该拆成明确字段和数据模型。

## 组件拆分

```text
StationPage
├─ StationHeader
├─ DeviceStatusPanel
├─ SensorPanel
├─ CommandPanel
└─ AlarmPanel
```

父组件向子组件传递状态，子组件专注展示；复杂页面不全部写在`Index.ets`。

## Stage模型

### UIAbility

- 包含UI的应用组件。
- 管理应用启动、前台、后台和销毁生命周期。

### WindowStage

- 提供应用窗口和ArkUI绘制区域。

### AbilityStage

- 管理模块运行环境和多个UIAbility共享状态。

第一版重点：

```text
UIAbility生命周期
ArkUI页面
应用权限
HTTP和WebSocket
```

暂不深入复杂ExtensionAbility、分布式协同和端侧智能体。

## 工程结构

```text
entry
├─ src/main/ets
│  ├─ entryability
│  ├─ pages
│  ├─ components
│  ├─ model
│  └─ service
├─ src/main/resources
├─ module.json5
└─ build-profile.json5
```

项目建议：

```text
pages
├─ LoginPage.ets
├─ StationSelectPage.ets
├─ WashStationPage.ets
├─ GasInspectionPage.ets
└─ AlarmPage.ets

components
├─ DeviceStatusCard.ets
├─ SensorValueCard.ets
├─ CommandButton.ets
└─ AlarmBanner.ets

model
├─ StationStatus.ets
├─ SensorReading.ets
└─ CommandResult.ets

service
├─ ApiService.ets
└─ WebSocketService.ets
```

## 页面导航

```text
登录
→ 选择工位
→ 工位主页
→ 参数、报警、历史页面
```

第一版先固定`WASH-01`，再根据账号或工位绑定动态显示。

## 权限

- 网络访问需要网络权限。
- 直接使用相机需要相机权限。
- 文件访问按API版本声明权限。
- 权限拒绝时显示明确提示。
- 不申请与项目无关的敏感权限。
- 如果视觉在独立电脑完成，鸿蒙端暂时不需要相机权限。

具体权限名称以安装的DevEco和目标API版本为准。

## 与Vue区别

- Vue使用JavaScript和Vue组件，运行在浏览器。
- 鸿蒙使用ArkTS和ArkUI，运行在HarmonyOS设备。
- Vue Router对应鸿蒙页面导航。
- Axios对应鸿蒙网络API。
- 浏览器WebSocket对应鸿蒙WebSocket API。
- 两者调用同一套Spring Boot接口和数据格式。

## 状态分层

### 页面状态

- 弹窗是否打开。
- 输入内容。
- 按钮是否禁用。
- 当前页面。

### 后端业务状态

- 当前瓶子和工序。
- 设备状态。
- 报警和命令状态。

### 网络状态

- HTTP是否可用。
- WebSocket是否连接。
- 最后更新时间。
- 是否正在重连。

三类状态分开保存。

## 按钮条件

设备离线、瓶子状态错误、气体未通过或命令执行中时禁用按钮。

按钮禁用只改善体验，Spring Boot仍要校验，防止绕过页面直接调用接口。

## 应用生命周期与连接

```text
启动 → 建立连接
进入后台 → 暂停或管理连接
回到前台 → 检查并重连
网络断开 → 显示断线
网络恢复 → 重连并查询快照
退出 → 关闭连接
```

## 最小数据模型

```ts
interface StationStatus {
  stationCode: string
  stationName: string
  state: string
  mode: string
  deviceOnline: boolean
  currentStep: string
  currentBottleCode?: string
  allowedActions: string[]
  updatedAt: string
}
```

```ts
interface SensorReading {
  deviceCode: string
  metric: string
  value: number
  unit: string
  level: string
  collectedAt: string
}
```

```ts
interface CommandResult {
  commandId: string
  status: string
  message: string
  createdAt: string
}
```

## 暂不学习

- 分布式软总线。
- 复杂多设备协同。
- 端侧大模型。
- 系统级后台服务。
- 复杂动画。
- 应用商店上架。
- 多窗口高级适配。

第一版目标是启动、识别工位、查询后端、显示实时状态、提交操作、接收结果和显示报警。

## E盘开发环境

- DevEco Studio、HarmonyOS SDK和模拟器数据优先放E盘。
- 统一团队DevEco与API版本。
- 不让SDK和缓存占满C盘。

## 实操作业

- 创建ArkTS Stage工程。
- 在模拟器或真机运行。
- 修改标题和按钮。
- 使用`@State`改变设备状态。
- 创建`StationStatus`模型。
- 拆出设备状态组件。
- 增加登录和工位选择静态页面。
- 创建水洗工位主页。
- 测试进入后台、回到前台和退出。

## 验收标准

- 能解释Stage、UIAbility、ArkTS和ArkUI。
- 能运行工程并写一个页面。
- 能通过状态变化刷新界面。
- 能解释鸿蒙端为什么不能直接控制MQTT设备。

## 具体实操：创建第一个鸿蒙工程

### 步骤1：准备E盘开发目录

在DevEco Studio的设置中，把SDK、Node、Gradle或模拟器数据能够配置到E盘的位置。建议统一规划：

```text
E:\dev\DevEco-Studio
E:\dev\HarmonyOS-SDK
E:\dev\HarmonyOS-Projects
E:\dev\HarmonyOS-Cache
```

实际菜单名称随DevEco版本可能不同，看到默认路径在C盘时先修改，不要直接点击下载。

### 步骤2：创建Stage工程

1. 打开DevEco Studio。
2. 选择创建新工程。
3. 选择手机、平板或通用ArkTS模板中支持Stage的模板。
4. 语言选择ArkTS。
5. 工程名称填写`BottlingStationHmi`。
6. 保存到：

```text
E:\dev\HarmonyOS-Projects\BottlingStationHmi
```

7. 记录API版本、SDK路径和构建工具版本。

### 步骤3：运行默认页面

1. 打开模拟器管理。
2. 创建或选择一个可运行设备。
3. 启动模拟器。
4. 点击运行按钮。
5. 确认默认页面显示。
6. 查看Run窗口，确认没有构建错误。

如果构建失败：

- 先看第一条真正错误。
- 检查SDK/API版本是否匹配。
- 检查工程路径是否有权限或特殊字符问题。
- 不要先删除大量缓存。

### 步骤4：修改第一个页面

找到默认Entry页面，把标题改为：

```text
智慧工厂工位屏
```

把按钮改为：

```text
进入水洗工位
```

再次运行，确认热更新或重新构建结果。

### 步骤5：练习ArkTS类型

在页面中声明：

```ts
let stationCode: string = 'WASH-01'
let gasValue: number = 6.2
let deviceOnline: boolean = true
```

故意把字符串赋给number，观察编辑器的静态错误，再恢复正确类型。

### 步骤6：练习@State

```ts
@State deviceState: string = 'IDLE'
```

按钮点击时改为：

```ts
this.deviceState = 'RUNNING'
```

页面文字绑定`deviceState`，验证点击后自动刷新。

### 步骤7：创建工程目录

在`ets`下创建：

```text
pages
components
model
service
```

先创建空文件：

```text
pages/WashStationPage.ets
components/DeviceStatusCard.ets
model/StationStatus.ets
service/ApiService.ets
```

### 步骤8：定义状态模型

在`StationStatus.ets`写：

```ts
export interface StationStatus {
  stationCode: string
  state: string
  mode: string
  deviceOnline: boolean
  currentStep: string
}
```

在页面中创建一份假数据，成功显示后再接网络。

### 步骤9：测试应用生命周期

1. 运行应用。
2. 切换到后台。
3. 回到前台。
4. 关闭应用。
5. 查看日志是否能看到生命周期回调。

### 本课完成标志

- 工程和SDK位于E盘。
- 每个人能创建和运行ArkTS Stage工程。
- 能修改页面、声明类型和使用`@State`。
- 能创建页面、组件、模型和服务目录。
- 能解释鸿蒙应用与Spring Boot的边界。

## 保姆式安装：把 DevEco 和 SDK 放到 E 盘

### 第 1 步：准备目录

~~~powershell
New-Item -ItemType Directory -Force -Path 'E:\dev\DevEco-Studio','E:\dev\HarmonyOS-SDK','E:\dev\HarmonyOS-projects','E:\dev\HarmonyOS-cache'
~~~

### 第 2 步：安装和创建工程

从华为开发者官方网站下载与目标 HarmonyOS API 匹配的 Windows 安装包。安装目录选择 E:\dev\DevEco-Studio，SDK 目录选择 E:\dev\HarmonyOS-SDK，项目目录选择 E:\dev\HarmonyOS-projects。如果安装器强制把 SDK 放在 C 盘，先取消安装，进入 DevEco 的 SDK 配置后再安装。

创建工程时选择基础 Stage 工程、ArkTS，工程名填写 BottlingStation，目录为 E:\dev\HarmonyOS-projects\BottlingStation。

### 第 3 步：第一次运行和回退

1. 打开 Device Manager。
2. 启动匹配 API 版本的模拟器，或连接已开启开发者模式的真机。
3. 选择 entry 模块和设备。
4. 点击 Run，先确认模板页面能显示。
5. 创建 E:\dev\HarmonyOS-projects\BottlingStation-baseline 作为静态基线。

如果构建失败，先看 Build 窗口最早出现的错误，常见原因是 SDK/API 不匹配、Gradle 缓存损坏或设备未连接。

### 第 4 步：验证第一个 ArkTS 页面

在 entry/src/main/ets/pages/Index.ets 中暂时写入：

~~~ts
@Entry
@Component
struct Index {
  @State state: string = 'IDLE'

  build() {
    Column({ space: 16 }) {
      Text('WASH-01').fontSize(28)
      Text('状态：' + this.state).fontSize(20)
      Button('模拟启动').onClick(() => {
        this.state = 'RUNNING'
      })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
~~~

点击按钮后文字必须从 IDLE 变成 RUNNING。先通过静态页面门禁，再接 HTTP 和 WebSocket。
