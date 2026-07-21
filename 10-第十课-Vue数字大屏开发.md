# 第十课：Vue数字大屏开发

## 本节学习路线

### 这是什么

数字大屏是面向评委和参观者的总览界面，强调几秒看懂整条产线的运行状态、质量、报警、AI决策、AGV和仓储。

### 为什么要学

大屏和管理端目标不同。大屏不能堆满表格，也不能靠无限刷新和无限图表数据运行，否则现场会卡顿或显示过期状态。

### 它在项目中的位置

Spring Boot聚合快照和WebSocket事件 → Vue大屏 → ECharts、流程节点和状态动画。大屏不承担复杂设备控制。

### 需要的软件

- VS Code：编辑DataOverview和子组件。
- Node.js和npm：运行大屏。
- Chrome或Edge：调整1920×1080、1366×768和现场分辨率。
- ECharts：项目已在package.json中。

### 最小例子

先用假数据画九个工位节点和一张气体折线图。切换一个节点的状态，确认颜色和文字变化，再接真实快照。

### 项目实操顺序

1. 启动大屏和后端。
2. 固定设计尺寸1920×1080。
3. 将流程拆成数组，用v-for生成节点。
4. 实现统一状态颜色。
5. 在mounted初始化一次ECharts。
6. 在setOption中更新数据。
7. 在beforeDestroy中移除监听并dispose。
8. 调用大屏聚合快照接口。
9. 接收流程、报警、环境和AGV事件。
10. 限制传感器图表为最近60个点。
11. 测试断线重连和数据过期。
12. 测试实际投影分辨率。

### 大屏调试怎么做

- 图表空白：检查容器宽高、mounted、接口数据和setOption字段。
- 元素重叠：检查ScaleScreen设计尺寸、系统缩放和绝对定位。
- 数据不更新：查快照是否成功、WS是否OPEN、事件type是否匹配。
- 越来越卡：查是否重复init、数组是否无限增长、监听是否重复。
- 动画与状态不符：查动画是否由后端事件触发，而不是页面自循环。

### 如何与下一节连接

大屏的流程、设备和报警字段来自第3课接口、第8课WebSocket、第14课视觉结果和第16课完整联调。

### 通过门禁

九个流程节点、气体趋势、缺陷统计、报警、连接状态和断线恢复都能运行，连续运行10分钟没有明显卡顿。

## 学习目标

- 区分管理端与数字大屏。
- 设计产线流程、质量、环境、物流和仓储信息层级。
- 正确管理ECharts生命周期。
- 结合HTTP快照与WebSocket事件。
- 处理固定设计尺寸、分辨率适配、性能和断线状态。

## 大屏定位

- 面向评委、参观者和值班人员。
- 几秒内看懂产线是否正常、瓶子在哪、质量如何、是否报警、物流仓储是否正常。
- 不是放大版管理端。
- 原则上不承担修改参数、启停设备和删除记录等复杂控制。

## 当前工程

- `views/DataOverview.vue`：大屏总览。
- `router/index.js`：`/dataOverview`和设置页。
- `main.js`：注册ECharts、Element UI、路由和WebSocket。
- 使用Vue 2、ECharts、ScaleScreen、固定设计尺寸、图片和WebP动画。

## 建议布局

```text
顶部：项目名、批次、模式、时间、连接状态
中央：整条生产线实时流程
左侧：生产、质量、视觉检测
右侧：设备、报警、AI决策
底部左：气体、温湿度趋势
底部中：机械臂装箱、AGV任务
底部右：仓储库存和安全
```

核心指标控制在10至15个：

- 当前瓶型和批次。
- 计划与完成数量。
- 良品率。
- 瓶盖、瓶身、瓶底缺陷数量。
- 在线设备和报警数量。
- 气体安全状态。
- 装箱进度。
- AGV任务。
- 仓储库存。

## 中央生产流程

```text
瓶型识别
→ 瓶子预处理
→ 气体检测
→ 初次外观检测
→ 灌装封盖
→ 二次检测
→ 机械臂装箱
→ AGV运输
→ 仓储入库
```

饮料支线：

```text
饮料调配
→ 杀菌和质量监测
→ 与合格瓶子在灌装汇合
```

每个工位显示：

- 工位名称。
- 当前状态。
- 当前瓶子或批次。
- 关键参数。
- 报警状态。
- 已处理数量。

统一颜色：绿色正常、青色空闲、橙色暂停、红色故障、灰色离线。

## 数据获取

```text
首次进入：HTTP获取完整快照
运行中：WebSocket接收变化
```

聚合接口建议：

```http
GET /hdc/api/data-screen/overview?lineId=LINE-01
```

响应分区：

```json
{
  "summary": {},
  "productionFlow": [],
  "quality": {},
  "environment": {},
  "equipment": {},
  "packing": {},
  "agv": {},
  "warehouse": {},
  "alarms": [],
  "aiDecisions": []
}
```

复杂统计在后端完成，大屏专注展示。

## ECharts生命周期

1. `mounted`后初始化一次。
2. 数据变化调用`setOption()`。
3. 窗口变化调用`resize()`。
4. `beforeDestroy`调用`dispose()`并移除监听。

```javascript
mounted() {
  this.gasChart = this.$echarts.init(this.$refs.gasChart)
  this.updateGasChart()
  window.addEventListener('resize', this.resizeCharts)
},
beforeDestroy() {
  window.removeEventListener('resize', this.resizeCharts)
  this.gasChart?.dispose()
}
```

不要每次收到数据都重新`echarts.init()`。

## 图表选择

- 产量和良品率：大数字。
- 气体、温度随时间：折线图。
- 缺陷类型数量：柱状图。
- 工位状态：生产流程节点。
- AGV位置与任务：简化路线图。
- 仓库库存：分区图或条形图。
- 报警：实时列表。
- AI建议：简短决策和状态。

不要把所有指标做成饼图，也不为炫技制作难读三维图。

## 高频更新

传感器每秒20条时：

```text
后端接收原始数据
→ 每秒聚合一次
→ WebSocket推送
→ 大屏每秒更新一次
```

限制历史点：

```javascript
this.gasPoints.push(point)
if (this.gasPoints.length > 60) {
  this.gasPoints.shift()
}
```

避免数组和图表无限增长。

## 布局与组件拆分

现有页面使用`ScaleScreen`、1920固定宽度和大量绝对定位。

优点：

- 固定演示屏容易精确还原。
- 当前页面可快速运行。

问题：

- 修改容易互相影响。
- 不同屏幕比例可能裁切。
- 单文件过长，不适合继续堆模块。

建议组件：

```text
DataOverview.vue
├─ ScreenHeader.vue
├─ ProductionFlow.vue
├─ QualityPanel.vue
├─ EnvironmentPanel.vue
├─ EquipmentPanel.vue
├─ AlarmPanel.vue
├─ PackingPanel.vue
├─ AgvPanel.vue
├─ WarehousePanel.vue
└─ AiDecisionPanel.vue
```

父页面取数据，子组件展示。

## 分辨率适配

优先确定设计分辨率，例如1920×1080。

至少测试：

- 1920×1080。
- 1366×768。
- 现场投影实际分辨率。
- 浏览器全屏。
- Windows 100%与125%缩放。

检查文字可读、表格不溢出、工位不重叠、图表容器有尺寸。

## 连接状态

大屏显示：

```text
数据更新正常
正在重连
连接中断
最后更新时间
```

断线后可保留最后数据，但必须标记数据可能过期。

## 动画原则

- 瓶子按真实工位事件移动。
- 当前工位轻微高亮。
- AGV按任务路线移动。
- 报警节点短暂闪烁。
- 数字变化平滑。
- 设备离线时不能继续显示运行动画。

后续流程动画可用`anime.js`，但必须由后端事件驱动，不自行无限播放。

## 大屏不承担

- 修改工艺参数。
- 直接启停设备。
- 删除生产记录。
- 手动放行不合格瓶。
- 仓储出入库操作。

只提供查看详情、区域切换、时间范围和全屏等轻交互。

## 常见故障

### 图表空白

- 容器无宽高。
- 未在`mounted`后初始化。
- 接口无数据。
- `setOption`字段错误。
- 控制台存在异常。

### 元素重叠

- 设计尺寸与实际屏幕不一致。
- 系统缩放或浏览器非全屏。
- 固定定位超出容器。

### 运行越来越卡

- 数组无限增长。
- 重复初始化ECharts。
- 重复注册WebSocket监听。
- 未清理定时器和事件。

## 实操作业

- 找到当前大屏入口和路由。
- 列出当前数据区域。
- 画新产线大屏布局。
- 把中央流程拆为组件。
- 用模拟数据显示九个工位。
- 接入聚合接口和WebSocket。
- 完成气体趋势图与缺陷柱状图。
- 测试断线与过期提示。
- 在两种分辨率检查布局。

## 验收问题

气体传感器每秒20条，大屏是否每秒调用20次`setOption()`？

- 不应该。
- 先聚合、限频并限制历史点，再约每秒更新一次。

## 具体实操：新增产线总览大屏

### 步骤1：确定设计尺寸

第一版固定：

```text
1920 × 1080
```

在纸上划分四个区域：

```text
顶部：标题和连接状态
中央：九个工位流程
左侧：产量、质量和气体
右侧：设备、报警、AGV和仓储
```

不要先写代码，先把每个区域需要的字段写在草图上。

### 步骤2：把流程拆成数据

先准备假数据：

```javascript
productionFlow: [
  { code: 'IDENTIFICATION', name: '瓶型识别', state: 'DONE' },
  { code: 'PRETREATMENT', name: '瓶子预处理', state: 'RUNNING' },
  { code: 'GAS_INSPECTION', name: '气体检测', state: 'WAITING' },
  { code: 'FIRST_INSPECTION', name: '初次外观检测', state: 'WAITING' },
  { code: 'FILLING', name: '灌装封盖', state: 'WAITING' },
  { code: 'SECOND_INSPECTION', name: '二次检测', state: 'WAITING' },
  { code: 'PACKING', name: '机械臂装箱', state: 'WAITING' },
  { code: 'TRANSPORTING', name: 'AGV运输', state: 'WAITING' },
  { code: 'WAREHOUSING', name: '仓储入库', state: 'WAITING' }
]
```

用`v-for`画流程节点，不要为九个节点复制九份HTML。

### 步骤3：实现状态颜色

写一个方法：

```javascript
flowClass(state) {
  return {
    DONE: 'flow-done',
    RUNNING: 'flow-running',
    FAULT: 'flow-fault',
    WAITING: 'flow-waiting'
  }[state] || 'flow-unknown'
}
```

先用假数据切换状态，确认颜色、文字和动画一致。

### 步骤4：创建一个气体趋势图

1. 在模板中放固定宽高的`div ref="gasChart"`。
2. 在`mounted`调用`echarts.init`一次。
3. 准备最近60个时间点和数值。
4. 调用`setOption`。
5. 在`beforeDestroy`调用`dispose`。

最小数据：

```javascript
gasPoints: [
  { time: '10:00:01', value: 6.1 },
  { time: '10:00:02', value: 6.2 },
  { time: '10:00:03', value: 6.4 }
]
```

### 步骤5：创建缺陷柱状图

```javascript
defectStats: [
  { name: '瓶盖歪斜', count: 3 },
  { name: '瓶身划痕', count: 2 },
  { name: '瓶底变形', count: 1 }
]
```

图表的类别来自后端，不要在大屏中写死真实统计。

### 步骤6：调用大屏聚合接口

```javascript
async loadOverview() {
  this.snapshot = await ServiceGet({
    url: '/hdc/api/data-screen/overview',
    params: { lineId: 'LINE-01' }
  })
  this.productionFlow = this.snapshot.productionFlow
  this.gasPoints = this.snapshot.environment.gasPoints
}
```

注意当前大屏`Service.js`基础地址与管理端不同，调用前先确认是否应写`/hdc/api`，不要盲目重复拼接路径。

### 步骤7：接WebSocket更新状态

1. 页面首次进入调用`loadOverview()`。
2. 初始化大屏WebSocket。
3. 注册事件处理器。
4. 收到`bottle.process.changed`时更新流程。
5. 收到`alarm.created`时增加报警并修改对应工位。
6. 收到`environment.updated`时更新气体和温湿度。

### 步骤8：做断线测试

- 停止后端。
- 大屏显示“连接断开，数据可能过期”。
- 恢复后端。
- 页面重连并重新请求快照。
- 检查流程节点和图表恢复最新数据。

### 步骤9：做性能测试

- 模拟器每100毫秒发送传感器值。
- 前端只每秒更新图表。
- 只保留60个历史点。
- 运行10分钟，观察页面是否明显变卡。

### 步骤10：做分辨率检查

依次使用浏览器设备模拟或调整窗口到：

```text
1920×1080
1366×768
现场投影分辨率
```

记录文字裁切、节点重叠、图表空白、滚动条和比例变形问题，逐项修复。

### 本课完成标志

- 大屏有九个流程节点和统一状态颜色。
- 有一张气体折线图和一张缺陷柱状图。
- 数据来自聚合接口和WebSocket。
- 断线和重连状态清晰。
- 连续运行10分钟没有明显卡顿。
