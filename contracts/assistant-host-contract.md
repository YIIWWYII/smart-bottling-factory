# 共享鸿蒙助手宿主契约

## 固定架构

三个鸿蒙 App 嵌入同一个共享助手包，不分别实现聊天页面、会话状态机或 AI 客户端。

- 源码路径：`packages/harmony-assistant/`
- OHPM 包名：`@bottling/harmony-assistant`
- 交付形态：可被三个 HAP 依赖的 ArkTS HAR，不是独立 HAP 或第六个业务工程
- 共享包源码与 AI 中枢服务分别位于 `packages/harmony-assistant/` 和 `services/ai-center/`，两个模块按同一接口版本发布
- 三个宿主 App：只实现 `AssistantHostAdapter`、页面挂载点、选择事件和引用导航

共享包调用独立 AI 中枢的问答接口。宿主不直接实现 AI HTTP/WebSocket 客户端，也不把共享包源码复制进 App。三个 App 必须锁定同一包版本；发布验收记录包版本和 HAR 校验值。

## 共享包导出面

`@bottling/harmony-assistant` 至少导出：

| 导出 | 责任 |
| --- | --- |
| `AssistantPanel` | 原生 ArkUI 助手面板/抽屉，统一会话列表、消息、上下文预览、引用和状态反馈 |
| `AssistantController` | `open/close/toggle/stop/retryLast/dispose`，用于宿主控制可见性和生命周期 |
| `AssistantHostAdapter` | 三个宿主必须实现的唯一适配接口 |
| `AssistantContext` | 每次提问时采集的页面和生产事实定位信息 |
| `AssistantSelection` | ArkUI 与 Three.js 统一选择事件 |
| `AssistantEntityRef` | 回答引用和宿主导航使用的稳定实体引用 |
| `AssistantServiceEndpoint` | AI 中枢 HTTP 与 WebSocket 基地址 |
| `AssistantPanelOptions` | 主题、默认展开状态等纯展示配置；不得包含业务权限或命令能力 |

`AssistantApiClient`、会话存储、流式状态机和消息解析属于包内部实现，不向宿主暴露。共享包不得导出设备命令、参数修改、人工锁释放、知识审核或审批 API。

## ArkTS 接口语义

下列签名是跨端契约。共享包实现可以增加向后兼容的可选字段，不能改名或改变语义。

```typescript
export type AssistantSourceApp = 'DISPLAY' | 'WORKSTATION' | 'ADMIN';
export type AssistantSelectionSource = 'ARKUI' | 'THREE_2D' | 'THREE_3D';
export type AssistantVisibility = 'VISIBLE' | 'HIDDEN';

export interface AssistantServiceEndpoint {
  httpBaseUrl: string;
  wsBaseUrl: string;
}

export interface AssistantDisplayField {
  code: string;
  label: string;
  displayValue: string;
  unit?: string;
}

export interface AssistantEntityRef {
  entityType: string;
  entityId: string;
  lineId?: string;
  stageCode?: string;
  pageRoute?: string;
}

export interface AssistantSelection {
  action: 'SELECT' | 'CLEAR';
  entityType: string;
  entityId: string;
  displayText: string;
  source: AssistantSelectionSource;
  pageRoute: string;
  stateVersion?: number;
  selectedAt: string;
  fields: AssistantDisplayField[];
}

export interface AssistantContext {
  contextVersion: number;
  sourceApp: AssistantSourceApp;
  pageRoute: string;
  capturedAt: string;
  lineId?: string;
  stageCode?: string;
  deviceCode?: string;
  traceCode?: string;
  stateVersion?: number;
  dataGeneratedAt?: string;
  userRoleHint?: string;
  selection?: AssistantSelection;
}

export interface AssistantNavigationResult {
  handled: boolean;
  reason?: string;
}

export interface AssistantSubscription {
  unsubscribe(): void;
}

export interface AssistantHostAdapter {
  readonly sourceApp: AssistantSourceApp;
  getContext(): Promise<AssistantContext>;
  getAccessToken(): Promise<string | undefined>;
  getServiceEndpoint(): AssistantServiceEndpoint;
  subscribeSelection(listener: (selection: AssistantSelection) => void): AssistantSubscription;
  subscribeVisibility(listener: (visibility: AssistantVisibility) => void): AssistantSubscription;
  navigateToEntity(entity: AssistantEntityRef): Promise<AssistantNavigationResult>;
}
```

语义要求：

1. `sourceApp` 由各 App 编译期固定，不能从页面参数、模型回答或用户输入覆盖。
2. `getContext()` 在每次发送和重试前重新采集，不能返回应用启动时缓存的旧快照。
3. `getAccessToken()` 只按需返回当前短期令牌。共享包只把它放入 `Authorization` 请求头，不写入 `AssistantContext`、消息正文、日志或本地持久化。
4. `getServiceEndpoint()` 从 App 配置读取；真机/模拟器不得使用 `localhost`，日志不得输出带凭据的 URL。
5. `subscribeSelection()` 是 ArkUI 与 Three.js 的唯一选择输入。页面切换、数据刷新后实体消失或用户取消选择时必须发送 `CLEAR`。
6. `subscribeVisibility()` 通知共享包宿主页面可见性。隐藏时停止 UI 动画和高频渲染，但不删除服务端会话；重新可见后通过 HTTP 补取完整消息状态。
7. `navigateToEntity()` 只做只读深链和定位。找不到、越权或路由不支持时返回 `handled=false`，不得转成业务写操作。

## 稳定实体 ID

所有 `SELECT` 事件必须同时提供 `entityType` 和稳定 `entityId`。禁止使用列表下标、ArkUI 临时组件 ID、Three.js `uuid`、模型名称、显示文本或每次点击新生成的 UUID。

| 选择对象 | `entityType` | `entityId` 规则 |
| --- | --- | --- |
| 产线 | `LINE` | 后端 `lineId` |
| 工位 | `STAGE` | 后端 `stageCode`；多产线场景同时携带 `lineId` |
| 设备 | `DEVICE` | 后端 `deviceCode` |
| 产品/物料 | `PRODUCT` | 后端 `traceCode` |
| 报警/异常 | `ALARM` / `INCIDENT` | 后端 `alarmId` / `incidentId` |
| 参数 | `PARAMETER` | `deviceCode:parameterCode` |
| KPI | `KPI` | `lineId:kpiCode` 或 `stageCode:kpiCode` |
| 表格行/审计 | 真实领域类型 | 该行后端业务主键，不使用行号 |
| 知识资料 | `KNOWLEDGE_DOCUMENT` | AI 中枢 `knowledgeId` |
| 选中文字 | `TEXT_FRAGMENT` | `pageRoute:ownerEntityId:fieldCode`；文本本身只放 `displayText` |

ArkUI 卡片、列表和表格在构造视图模型时保留业务 ID。Three.js 2D/3D 对象在 `userData` 中只保存允许的 `entityType/entityId`，JS Bridge 只上报这两个稳定字段和画面模式；ArkTS 宿主再补齐路由、版本和白名单显示字段。共享包和 AI 中枢不信任 Three.js 传来的显示文本或任意对象序列化结果。

`fields` 只允许单位、状态、时间等已在当前页面授权显示的白名单字段。不得附带密码、完整令牌、未授权表格列、原始数据库对象、图片二进制或自由序列化 JSON。

## 共享包责任

共享包统一负责：

- 原生 ArkUI 助手 UI、会话切换、消息列表、流式增量、停止、重试和引用交互。
- AI 中枢 HTTP/WebSocket 客户端、统一响应和事件解析、断线重连与 HTTP 补偿。
- 状态机：`IDLE -> SENDING -> STREAMING -> COMPLETED | FAILED | STOPPED`。同一会话只允许一个活动回答。
- 实时回答展示 `dataGeneratedAt/stateVersion`；RAG 回答展示知识版本和可点击引用；混合回答同时展示两类依据。
- 上下文预览、过期版本提示、服务不可用、无权限、限流、网络失败和引用导航失败反馈。
- 会话 ID 和纯 UI 偏好管理。不得持久化访问令牌、完整 `AssistantContext`、敏感选择字段或设备控制数据。
- 包自身版本、兼容策略、Local Test、ArkUI 组件测试和模拟 `AssistantHostAdapter` 测试。

停止回答调用 AI 中枢取消接口并进入 `STOPPED`；重试必须生成新请求 ID、重新调用 `getContext()` 和 `getAccessToken()`，不能复用旧权限或旧 `stateVersion`。WebSocket 中断后不猜测缺失增量，而是通过 HTTP 重新读取消息最终状态。

## 宿主 App 责任

三个宿主分别负责：

- 实现本 App 的 `AssistantHostAdapter`，提供当前页面、产线/工位、数据版本和登录身份。
- 在约定页面挂载 `AssistantPanel`，持有并释放 `AssistantController`。
- 把 ArkUI 与 ArkWeb/Three.js 选择统一转换为 `AssistantSelection`。
- 为回答引用实现 `navigateToEntity()`，并继续执行本 App 原有权限和路由检查。
- 展板只读、小屏本站范围、后台 RBAC 范围；共享 UI 不能扩大宿主业务权限。

宿主不得实现临时聊天 UI、复制会话状态机、直接请求 `/assistant/**`、保存 AI 会话、解析流式事件或在 App 内构造本地假回答。共享包尚未合入时可以先完成宿主适配器和选择映射，但不得提交另一套替代实现。

## 服务端与安全边界

- AI 中枢负责会话、问答、RAG、生产只读工具和流式事件，并根据真实令牌重新校验 `sourceApp`、用户和实体范围。
- `userRoleHint` 只用于界面提示，不是授权依据。客户端上报的 `stateVersion` 过期时，AI 中枢通过生产后端只读工具获取最新事实并在回答中标注实际版本。
- 助手只能回答、解释、排查和提供建议。无论用户如何措辞，助手链路都不能创建 `DeviceCommand`、`command-intent`、释放 `MANUAL_HOLD`、审批知识或改变生产状态。
- 后台知识上传/审核、工位正式调参、AI 决策审批仍由各自业务页面完成。助手可以解释并深链，不能代替业务页面。
- 共享包不得依赖三个 App 的 Repository、Spring Boot 控制客户端、MQTT 或设备 SDK；三个 App 也不得把控制函数注入适配器。

## 发布顺序

1. 先发布或更新本契约以及对应的后端接口。
2. 构建并发布 `packages/harmony-assistant/` 的 HAR，同时验证导出 API 和测试。
3. 三个前端引入完全相同版本的共享包，只在自身 `apps/...` 目录实现适配器、挂载点和选择映射。
4. 联调时先启动生产后端和 AI 中枢，再验证三个 HAP 的会话、稳定实体 ID、权限、停止/重试、引用导航和无命令能力。

任一 App 出现本地聊天组件、独立 AI ApiClient、不同助手包版本、Three.js 临时 ID、令牌进入上下文、助手创建命令或共享包依赖宿主业务实现，均为 P0 阻断项。
