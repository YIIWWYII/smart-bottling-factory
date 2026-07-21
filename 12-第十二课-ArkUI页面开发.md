# 第十二课：ArkUI页面开发

## 本节学习路线

### 这是什么

ArkUI页面是操作员看到的工位HMI：状态要清楚、按钮要有条件、报警要明显、数据断线要可解释。

### 为什么要学

工位屏不是简单显示网页。它需要在小屏上正确处理在线、离线、运行、故障、无瓶、气体超限、命令执行中和命令失败。

### 它在项目中的位置

ArkUI负责展示和收集操作，后端负责最终判断，设备负责执行。页面本地模拟状态只用于开发，不能当真实设备结果。

### 需要的软件

- DevEco Studio和ArkTS工程。
- 鸿蒙模拟器或工位屏。
- 设计草图工具或纸。
- 第13课再使用HTTP和WebSocket调试。

### 最小例子

制作三块静态区域：Header、StatusPanel、CommandPanel。用State模拟在线、离线、超限和运行中，确认按钮是否按规则启用。

### 项目实操顺序

1. 列出首屏字段。
2. 创建Header和工位状态卡片。
3. 创建VOC、温度、湿度SensorCard。
4. 创建当前瓶子和工序区域。
5. 创建启动水洗按钮。
6. 写canStartWash规则。
7. 增加开发用正常、离线、超限模拟按钮。
8. 增加命令执行中和成功页面。
9. 增加报警横幅、加载和错误状态。
10. 测试真实小屏横屏布局。

### ArkUI调试怎么做

- 状态变化但文字不变：检查State是否用于页面属性。
- 按钮不禁用：逐项打印在线、设备状态、气体值和命令状态。
- 页面重叠：检查Row、Column、layoutWeight和固定宽高。
- 文字裁切：降低单行内容，允许换行，检查系统字号。
- 报警被遮挡：检查布局层级和Stack位置。

### 如何与下一节连接

本节按钮、状态字段和报警区域会在第13课接入ApiService、WebSocket和真实命令状态。页面字段必须与第3课协议一致。

### 通过门禁

在线空闲可启动、离线不可启动、气体超限不可启动、运行中不可重复启动，且目标屏幕无重叠和裁切。

## 学习目标

- 创建适合产线操作的工位主页。
- 使用Column、Row、Grid、List等布局。
- 使用状态驱动颜色、内容和按钮。
- 拆分可复用组件。
- 完成加载、离线、无数据、错误和报警状态。

## 工位页面结构

```text
顶部：工位名称、网络状态、当前时间
中部左：设备状态
中部右：温度、湿度、气体浓度
底部：当前瓶子、工序、操作按钮
报警区域：报警、命令结果和异常提示
```

组件树：

```text
WashStationPage
├─ StationHeader
├─ DeviceStatusPanel
├─ SensorPanel
├─ BottleInfoPanel
├─ CommandPanel
└─ AlarmBanner
```

## 基本布局

### Column

- 纵向排列。

```ts
Column() {
  Text('水洗工位')
  Text('设备运行中')
}
```

### Row

- 横向排列。

```ts
Row() {
  Text('设备状态')
  Text('运行中')
}
```

### Stack

- 层叠显示，适合角标和覆盖提示。

### Grid

- 适合VOC、温度、湿度等指标网格。

### List与Scroll

- 适合报警和操作历史。
- 长内容必须允许滚动，避免溢出屏幕。

## 常用修饰器

```text
.width()
.height()
.padding()
.margin()
.backgroundColor()
.borderRadius()
.fontSize()
.fontColor()
.fontWeight()
.opacity()
.enabled()
.visibility()
```

状态标签根据设备状态改变文字与颜色。

## 状态驱动界面

```ts
@State deviceState: string = 'IDLE'
@State deviceOnline: boolean = true
@State gasValue: number = 6.2
@State commandStatus: string = 'NONE'
@State alarmMessage: string = ''
```

- 修改状态后界面自动刷新。
- 不直接寻找控件手动修改。
- 不把多个状态拼成一个大字符串。

## 条件显示和状态转换

```ts
if (!this.deviceOnline) {
  Text('设备离线')
    .fontColor(Color.Red)
}
```

统一状态文字：

```ts
getStateText(): string {
  const map: Record<string, string> = {
    IDLE: '空闲',
    RUNNING: '运行中',
    PAUSED: '已暂停',
    FAULT: '故障',
    OFFLINE: '离线'
  }
  return map[this.deviceState] ?? '未知状态'
}
```

统一状态颜色：

- `RUNNING`绿色。
- `FAULT`红色。
- `PAUSED`橙色。
- `OFFLINE`灰色。
- `IDLE`蓝色或青色。

## 按钮条件

```ts
canStartWash(): boolean {
  return this.deviceOnline
    && this.deviceState === 'IDLE'
    && this.gasValue < 10
    && this.commandStatus !== 'EXECUTING'
}
```

```ts
Button('启动水洗')
  .enabled(this.canStartWash())
  .onClick(() => {
    this.startWash()
  })
```

本课`startWash()`只模拟本地状态变化，下一课才调用后端。

## @Builder与独立组件

### @Builder

- 拆分同一页面的局部区域。

```ts
@Builder
buildDevicePanel() {
  Column() {
    Text('设备状态')
    Text(this.getStateText())
  }
}
```

### @Component

- 用于独立复用、接收参数的组件。

```ts
@Component
struct SensorCard {
  @Prop title: string
  @Prop value: string

  build() {
    Column() {
      Text(this.title)
      Text(this.value)
    }
  }
}
```

## @Prop与@Link

### @Prop

- 父组件传值，子组件只读展示。

### @Link

- 父子双向绑定。
- 第一版谨慎使用。
- 本地变量变化不能代表设备已经改变，设备状态必须以后端反馈为准。

## 页面必须覆盖的状态

### 加载中

- 显示`LoadingProgress`。
- 禁止重复操作。

### 设备离线

- 显示离线与最后更新时间。
- 禁用控制按钮。

### 没有瓶子

- 当前瓶子显示暂无。
- 不能启动依赖瓶子的工序。

### 请求失败

- 显示无法获取最新状态。
- 提供重试按钮。
- 保留旧数据显示时标记为过期。

### 报警

- 显示等级、内容、发生时间、当前值和阈值。
- 重要报警使用清晰红色或橙色。

## 小屏布局原则

- 主要按钮高度至少约48dp。
- 首屏显示关键状态。
- 控制按钮数量有限。
- 复杂表格改为列表。
- 关键传感器使用大字号。
- 危险操作二次确认。
- 使用`layoutWeight`和百分比布局。
- 少用大量绝对坐标。
- 提前确定横屏或竖屏。

## 导航结构

```text
LoginPage
→ StationSelectPage
→ StationHomePage
→ AlarmPage
→ HistoryPage
```

- 简单阶段使用工程模板支持的路由。
- 后续可统一使用`Navigation`和页面栈。
- 页面负责展示，服务负责网络，模型定义字段。

## 静态主页数据

页面至少包含：

```text
WASH-01工位名称
网络连接状态
设备IDLE/RUNNING/FAULT/OFFLINE
VOC值和ppm单位
温度与湿度
当前瓶子追踪号
当前工序
允许操作按钮
命令执行状态
报警提示
```

## 实操作业

- 创建`WashStationPage.ets`。
- 完成顶部工位信息。
- 显示设备、VOC、温度、湿度。
- 使用`@State`模拟状态变化。
- 根据状态改变文字和颜色。
- 离线时禁用启动按钮。
- 气体超限时显示报警。
- 拆出`SensorCard`和`DeviceStatus`。
- 增加加载、无数据和错误状态。
- 测试横屏布局。

## 验收标准

```text
设备在线且空闲：可以启动
设备离线：不能启动
气体超限：不能启动
设备运行中：不能重复启动
启动后：页面显示执行中
```

页面要清楚告诉操作员：现在发生什么、能做什么、不能做什么。

## 具体实操：制作静态水洗工位屏

### 步骤1：先写页面字段

在页面顶部列出不超过10个首屏字段：

```text
工位：WASH-01
设备：PUMP-01
设备状态：空闲
网络：正常
当前瓶子：BOT-TEST-001
当前工序：预处理
VOC：6.2 ppm
温度：25.6 ℃
湿度：48 %
命令：启动水洗
```

### 步骤2：实现三块布局

先只实现：

```text
Header
StatusPanel
CommandPanel
```

确认页面在小屏横向布局不重叠后，再增加传感器卡片和报警。

### 步骤3：创建状态变量

```ts
@State deviceOnline: boolean = true
@State deviceState: string = 'IDLE'
@State gasValue: number = 6.2
@State temperature: number = 25.6
@State humidity: number = 48
@State currentBottle: string = 'BOT-TEST-001'
@State commandStatus: string = 'NONE'
@State alarmMessage: string = ''
```

### 步骤4：做状态切换按钮

临时增加三个开发按钮：

```text
模拟正常
模拟设备离线
模拟气体超限
```

点击后分别修改状态，确认界面显示：

```text
正常：绿色，可启动
离线：灰色，按钮禁用
超限：红色，按钮禁用并显示报警
```

开发按钮只在培训分支保留，正式演示前删除或隐藏。

### 步骤5：拆SensorCard

让`SensorCard`接收：

```text
title
value
unit
level
```

页面使用三张卡片：

```text
VOC 6.2 ppm
温度 25.6 ℃
湿度 48 %
```

### 步骤6：实现按钮规则

先写测试表：

```text
在线 + 空闲 + VOC合格：启用
离线 + 空闲：禁用
在线 + 运行：禁用
在线 + VOC超限：禁用
在线 + 活动命令：禁用
```

再把条件写进`canStartWash()`，不要只靠按钮颜色判断。

### 步骤7：实现本地模拟命令

点击启动后：

1. `commandStatus='EXECUTING'`。
2. `deviceState='RUNNING'`。
3. 禁用按钮。
4. 3秒后模拟`SUCCESS`。
5. `deviceState='IDLE'`。
6. 显示“水洗完成”。

这个步骤只验证页面，不代表真实设备已启动。

### 步骤8：实现报警显示

气体值改为12.5时：

```text
alarmMessage = 'VOC浓度超过安全上限10 ppm'
```

页面显示红色横幅，并禁用启动。

### 步骤9：测试不同屏幕

至少测试：

```text
鸿蒙模拟器尺寸
实际工位屏尺寸
横屏方向
系统字号放大
```

检查按钮是否能点、文字是否裁切、报警是否覆盖其他内容。

### 本课完成标志

- 静态水洗工位页能运行。
- 设备、传感器、瓶子和报警信息布局清楚。
- 正常、离线、超限和运行中状态都可模拟。
- 按钮规则与状态表一致。
- 页面在目标小屏尺寸不重叠。
