# 第九课：Vue管理端开发

## 本节学习路线

### 这是什么

Vue管理端是给管理员和操作人员使用的后台界面，负责设备、工位、瓶型、工艺、报警、批次、物流和仓储的查询与操作。

### 为什么要学

管理端不能只是静态表格。它需要处理加载中、无数据、接口失败、权限不足、实时更新和危险操作确认，并且不能把前端判断当成安全规则。

### 它在项目中的位置

浏览器Vue管理端 → Axios HTTP查询和操作 → Spring Boot → MySQL、MQTT、WebSocket。管理端不直连数据库、不直连MQTT。

### 需要的软件

- VS Code：编辑Vue 2文件。
- Node.js和npm：运行项目。
- Chrome或Edge：调试页面。
- Git：保存小步修改。

项目已有Vue 2、Vue Router 3、Element UI和Axios，第一版不要升级技术栈。

### 最小例子

创建一个设备列表页面：先用三条假数据显示，再调用后端接口替换假数据，最后接WebSocket改变一行设备状态。

### 项目实操顺序

1. 启动管理端和后端。
2. 在src/views创建DeviceList.vue。
3. 在router/index.js增加路由。
4. 用el-table显示假设备。
5. 增加加载、错误和空数据状态。
6. 通过ServiceGet调用设备接口。
7. 增加详情弹窗。
8. 接收device.state.changed。
9. 将状态码转换为中文和颜色。
10. 按同样方式创建瓶型、工艺、报警、AGV和仓储页面。

### 前端调试怎么做

- 页面空白：看Console第一条错误。
- 路由404：查router路径和浏览器实际URL。
- 接口404：查Service基础URL和hdc/api是否重复。
- 接口500：复制Network中的请求到PowerShell，看后端日志。
- 数据有但不显示：在then中打断点，看Axios拦截器返回data还是完整Result。
- 实时重复：查created中是否多次注册WebSocket监听。

### 如何与下一节连接

第10课数字大屏使用同一个后端快照和事件；第13课鸿蒙工位屏使用同一接口合同；第15课AI决策记录在管理端展示。

### 通过门禁

设备列表能查询、加载、显示空状态、显示错误、打开详情并实时更新；前端按钮不能绕过后端放行规则。

## 学习目标

- 理解Vue 2页面、路由、状态、生命周期和事件。
- 使用Axios调用Spring Boot接口。
- 使用Element UI开发表格、表单和报警页面。
- 结合HTTP快照与WebSocket实时事件。
- 明确前端展示与后端业务校验的边界。

## 管理端功能范围

```text
生产总览
设备与工位
瓶型与工艺参数
生产批次
检测结果
报警处理
装箱记录
AGV任务
仓储管理
AI决策记录
```

管理端面向操作员和管理员，负责配置、查询、控制请求和追溯，不是数字大屏。

## Vue文件结构

```vue
<template>
  页面结构
</template>

<script>
  页面数据和业务逻辑
</script>

<style>
  页面样式
</style>
```

- `main.js`：创建Vue实例、注册路由、Element UI和WebSocket。
- `App.vue`：最外层容器和`router-view`。
- `router/index.js`：URL与页面对应关系。
- `views`：完整业务页面。
- `api/Service.js`：Axios请求封装。
- `api/WebSocket.js`：实时连接。
- `store/localSave.js`：本地配置和令牌。

## 当前路由

```text
/home
├─ /plcControl
├─ /plcControlCabinet
├─ /productDisplay
├─ /scanningRecord
└─ /printReportPreview

/setting
```

新产线路由建议：

```text
/home/production
/home/device
/home/bottleTypes
/home/recipes
/home/alarms
/home/logistics
/home/warehouse
/home/aiDecisions
```

路由只负责找到页面，不放复杂业务逻辑。

## 数据驱动流程

```text
data初始值
→ created或mounted
→ Axios查询后端
→ 修改data
→ Vue自动更新页面
```

示例：

```javascript
data() {
  return {
    loading: false,
    deviceList: [],
    selectedDevice: null
  }
}
```

## 五个核心概念

### data

- 保存页面内部状态。
- 每个组件的`data()`返回独立对象。

### methods

```javascript
methods: {
  loadDevices() {},
  submitParameter() {},
  handleAlarm() {}
}
```

- 保存用户操作和请求方法。

### computed

```javascript
computed: {
  onlineCount() {
    return this.deviceList.filter(item => item.online).length
  }
}
```

- 根据已有状态计算展示值。
- 避免模板中重复复杂计算。

### watch

- 监听数据变化。
- 当前PLC页面监听数组后自动发送控制请求。
- 新设备控制不建议依赖数组监听，否则初始化和WebSocket更新可能误触发命令。
- 使用明确按钮事件提交控制请求。

### 生命周期

- `created`：组件创建后，适合准备或查询数据。
- `mounted`：DOM挂载后，适合需要访问元素的场景。
- `beforeDestroy`：清理WebSocket监听、计时器和图表。

## Axios调用

查询：

```javascript
ServiceGet({
  url: '/api/devices',
  params: {
    stationCode: 'GAS-01'
  }
}).then(res => {
  this.deviceList = res
})
```

创建或控制：

```javascript
Service({
  url: '/api/station-commands',
  data: {
    stationCode: 'WASH-01',
    action: 'START'
  }
}).then(res => {
  this.commandId = res.commandId
})
```

- 基础地址已在`Service.js`配置。
- 页面只写相对路径。
- 拦截器处理令牌、业务码和统一错误提示。

## 标准管理页面

### 设备管理

```text
查询区域
→ 设备表格
→ 分页
→ 新增与编辑
→ 删除确认
→ 加载、空数据和错误状态
```

### 工艺参数

```text
瓶型选择
→ 当前工艺版本
→ 参数和单位
→ 安全上下限
→ 修改原因
→ 保存确认
→ 操作记录
```

### 报警管理

```text
报警等级
→ 设备和工位
→ 当前值、阈值和单位
→ 发生时间
→ 确认状态
→ 处理结果
```

## Element UI组件

- `el-table`：表格。
- `el-form`、`el-form-item`：表单和校验。
- `el-input`：输入。
- `el-select`：选项集合。
- `el-button`：明确命令。
- `el-dialog`：编辑和二次确认。
- `el-pagination`：分页。
- `el-tag`：状态标签。
- `el-alert`：报警提示。
- `el-loading`：加载状态。

继续使用现有UI框架，不为普通管理页面引入第二套组件库。

## 前后端边界

前端负责：

- 展示后端状态。
- 收集用户输入。
- 提交操作请求。
- 显示后端结果。

后端负责：

- 权限、生产状态和安全参数校验。
- 设备控制。
- 数据保存和审计。

按钮显示“允许灌装”不代表后端一定允许，后端必须重新校验。

## HTTP与WebSocket配合

```text
页面首次打开
→ HTTP查询完整状态
→ WebSocket接收后续变化
```

示例：

```javascript
window.addEventListener('onmessageWS', event => {
  const message = JSON.parse(event.detail.data)
  if (message.type === 'alarm.created') {
    this.alarmList.unshift(message.data)
  }
})
```

- WebSocket通知报警。
- HTTP提交报警确认和处理。
- 页面销毁时移除监听器。

## 状态文字和颜色

```javascript
export function deviceStateText(state) {
  const map = {
    RUNNING: '运行中',
    IDLE: '空闲',
    FAULT: '故障',
    OFFLINE: '离线'
  }
  return map[state] || '未知'
}
```

统一颜色：

- 运行：绿色。
- 空闲：灰色或青色。
- 故障：红色。
- 暂停：橙色。
- 离线：深灰色。

状态映射抽为公共工具或组件，不在各页面重复。

## 当前项目改造注意

### App.vue固定跳转

- 当前创建时固定跳到PLC页面。
- 未来根据登录、角色、工位或默认工作台跳转。

### store目前不是完整Vuex

- 当前主要保存区域、分组和令牌。
- 设备与生产状态仍来自后端。

### PLC页面依赖固定下标

旧方式：

```text
dValue[0]
dValue[1]
dValue[2]
```

新方式：

```json
{
  "deviceCode": "GAS-01",
  "metric": "VOC",
  "value": 6.2,
  "unit": "ppm",
  "state": "NORMAL"
}
```

不要靠记忆下标代表哪个设备。

## 开发顺序

1. 设备和工位列表。
2. 瓶型管理。
3. 工艺参数管理。
4. 生产批次管理。
5. 报警管理。
6. 生产追溯。
7. AGV任务。
8. 仓储管理。
9. AI决策记录。

先完成列表、查询、详情和状态，再增加复杂控制。

## 实操作业

- 找到管理端入口、路由和页面。
- 新增“设备列表”路由。
- 用模拟数据显示设备编号、工位、状态和最后时间。
- 改为调用真实接口。
- 增加加载、空数据和错误状态。
- 点击设备查看详情。
- WebSocket更新设备状态。
- 状态码转换为中文和统一颜色。
- 抽取公共状态组件或工具。

## 验收问题

前端按钮显示“允许灌装”是否代表后端一定允许？

- 不是。
- 后端仍需检查瓶子状态、气体检测、饮料批次、设备状态和安全报警。

## 具体实操：创建第一个设备管理页面

### 步骤1：创建页面文件

在：

```text
数字大屏前端code\hdc_web\src\views
```

增加：

```text
DeviceList.vue
```

先复制一个结构简单的现有页面，删除业务内容，保留Vue单文件格式。

### 步骤2：增加路由

打开：

```text
数字大屏前端code\hdc_web\src\router\index.js
```

在`/home`的`children`中增加：

```javascript
{
  path: 'deviceList',
  name: 'DeviceList',
  component: () => import('../views/DeviceList.vue'),
  meta: { title: '设备管理' }
}
```

浏览器访问：

```text
http://localhost:8080/home/deviceList
```

### 步骤3：先写假数据页面

在`data()`中放三条数据：

```javascript
deviceList: [
  { code: 'GAS-01', name: '气体传感器', station: 'GAS-01', state: 'ONLINE' },
  { code: 'PUMP-01', name: '水洗泵', station: 'WASH-01', state: 'IDLE' },
  { code: 'AGV-01', name: 'AGV小车', station: 'AGV-01', state: 'OFFLINE' }
]
```

模板使用`el-table`显示：

```vue
<el-table :data="deviceList" v-loading="loading">
  <el-table-column prop="code" label="设备编号" />
  <el-table-column prop="name" label="名称" />
  <el-table-column prop="station" label="工位" />
  <el-table-column prop="state" label="状态" />
</el-table>
```

先确认页面布局和状态颜色，再接后端。

### 步骤4：改为调用后端

```javascript
import { ServiceGet } from '@/api/Service.js'

async loadDevices() {
  this.loading = true
  try {
    this.deviceList = await ServiceGet({
      url: '/api/devices'
    })
  } catch (error) {
    this.errorMessage = '设备列表加载失败'
  } finally {
    this.loading = false
  }
}
```

在`created()`调用：

```javascript
created() {
  this.loadDevices()
}
```

### 步骤5：处理三种页面状态

增加：

```javascript
loading: false,
errorMessage: '',
deviceList: []
```

模板增加：

```vue
<el-alert
  v-if="errorMessage"
  :title="errorMessage"
  type="error"
  show-icon />

<el-empty
  v-if="!loading && deviceList.length === 0"
  description="暂无设备" />
```

不要在请求失败时继续显示空的“正常列表”。

### 步骤6：统一状态显示

在`utils`增加工具：

```javascript
export function stateText(state) {
  return {
    ONLINE: '在线',
    IDLE: '空闲',
    RUNNING: '运行中',
    FAULT: '故障',
    OFFLINE: '离线'
  }[state] || '未知'
}
```

使用`el-tag`：

```vue
<el-tag :type="tagType(scope.row.state)">
  {{ stateText(scope.row.state) }}
</el-tag>
```

### 步骤7：增加详情弹窗

1. 增加`selectedDevice`和`detailVisible`。
2. 表格增加“详情”按钮。
3. 点击时保存当前设备。
4. 弹窗显示编号、工位、状态、最后上报时间。
5. 设备为空时不打开弹窗。

### 步骤8：接入WebSocket

1. 页面`created`注册`onmessageWS`。
2. `beforeDestroy`移除监听。
3. 根据`device.state.changed`找到对应设备。
4. 只更新相同`deviceCode`的记录。
5. 记录最后更新时间。

### 步骤9：测试

- 后端正常：表格有数据。
- 后端停止：显示错误提示。
- 后端恢复：点击重试或重新进入页面恢复。
- 模拟设备状态变化：表格状态实时更新。
- 没有设备：显示空状态。
- 点击详情：数据与行一致。

### 步骤10：扩展为产线页面

按照同一模式依次创建：

```text
BottleTypeList.vue
RecipeList.vue
AlarmList.vue
AgvTaskList.vue
WarehouseList.vue
AiDecisionList.vue
```

每次只做一个页面，完成查询、加载、空数据、错误、详情和实时刷新后再做下一个。

### 本课完成标志

- 能独立创建路由和Vue页面。
- 能先用假数据验证布局，再接真实接口。
- 能处理加载、空数据、错误和WebSocket变化。
- 前端不把本地判断当作灌装最终放行依据。
