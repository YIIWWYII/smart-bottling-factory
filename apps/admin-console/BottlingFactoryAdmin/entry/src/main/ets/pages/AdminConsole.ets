import { http } from '@kit.NetworkKit'
import { router, promptAction } from '@kit.ArkUI'
import {
  AssistantController,
  AssistantDock,
  AssistantEntityRef,
  AssistantEntityType,
  AssistantNavigationResult
} from '@bottling/harmony-assistant'
import { Theme, statusColor } from '../common/Theme'
import { SectionTitle, StateBadge } from '../components/IndustrialComponents'
import { AiDecisionAuditPanel } from '../components/AiDecisionAudit'
import { KnowledgeGovernance } from '../components/KnowledgeGovernance'
import { FACTORY_STAGES, findStage } from '../config/FactoryStages'
import { FactoryRepository } from '../service/FactoryRepository'
import { apiClient } from '../service/ApiClient'
import { aiCenterClient } from '../service/AiCenterClient'
import { SessionStore } from '../service/SessionStore'
import { ApiConfig } from '../service/ApiConfig'
import { AiCenterConfig } from '../service/AiCenterConfig'
import {
  adminAssistantSelectionBus,
  assistantField,
  createAdminSelection
} from '../service/AdminAssistantSelection'
import { AdminAssistantHostAdapter } from '../service/AdminAssistantHostAdapter'
import {
  PERMISSION_DEVICE_CONTROL,
  PERMISSION_INCIDENT_DISPOSE,
  PERMISSION_SYSTEM_MANAGE,
  PERMISSION_THRESHOLD_MANAGE,
  PERMISSION_USER_MANAGE,
  canAccessAdminPage,
  hasPermission,
  permissionLabel,
  roleLabel
} from '../service/AdminAccessPolicy'
import {
  AdminAuditRecord,
  AgvTask,
  AiAudit,
  AlarmRecord,
  AuthUser,
  EnterpriseLampCommandResult,
  EnterprisePlcStatus,
  FactoryBundle,
  FactoryIncident,
  FactoryRun,
  RuntimeDevice,
  RuntimeStage,
  StageDefinition,
  StockItem,
  SystemPolicy,
  WarehouseZone
} from '../model/FactoryModels'
import {
  AiConnectionTestRequest,
  AiConnectionTestResult,
  AiModelConfig,
  AiModelConfigUpdate
} from '../model/AiCenterModels'

interface MenuItem {
  code: string
  label: string
  description: string
  minRole: string
}

interface MenuGroup {
  label: string
  items: Array<MenuItem>
}

interface UpdateUserPayload {
  role: string
  status: string
}

const MENU: Array<MenuItem> = [
  { code: 'DASHBOARD', label: '运营首页', description: '指标、待办和运行概览', minRole: 'VIEWER' },
  { code: 'PRODUCTION', label: '生产任务', description: '批次、工单和产品状态', minRole: 'VIEWER' },
  { code: 'INCIDENTS', label: '异常处置', description: '剔除、局停、返工和缓冲', minRole: 'VIEWER' },
  { code: 'DEVICES', label: '设备管理', description: '档案、在线态、维护和模板', minRole: 'VIEWER' },
  { code: 'MATERIALS', label: '产品与物料', description: '追踪、质量事件和箱码', minRole: 'VIEWER' },
  { code: 'LOGISTICS', label: '物流仓储', description: 'AGV、库位、库存和安全', minRole: 'VIEWER' },
  { code: 'AI_AUDIT', label: 'AI 决策审计', description: 'RAG、校验、建议和结果', minRole: 'VIEWER' },
  { code: 'AI_CONFIG', label: 'AI 管理', description: '模型、Key、超时、RAG 和连接测试', minRole: 'VIEWER' },
  { code: 'KNOWLEDGE', label: '知识资料', description: '上传、解析、审核、撤销和索引', minRole: 'VIEWER' },
  { code: 'USERS', label: '用户权限', description: '账号、角色和状态', minRole: 'ADMIN' },
  { code: 'SETTINGS', label: '系统配置', description: '阈值和策略版本', minRole: 'VIEWER' },
  { code: 'AUDIT', label: '操作审计', description: '用户操作和后端结果', minRole: 'VIEWER' },
  { code: 'LIVE_IO', label: '现场设备', description: '企业 MQTT、PLC 四路状态和实际灯位控制', minRole: 'VIEWER' }
]

const NAV_GROUPS: Array<MenuGroup> = [
  { label: '运行管理', items: [MENU[0], MENU[1], MENU[2]] },
  { label: '资产与追溯', items: [MENU[3], MENU[4], MENU[5], MENU[12]] },
  { label: 'AI 治理', items: [MENU[6], MENU[7], MENU[8]] },
  { label: '平台管理', items: [MENU[9], MENU[10], MENU[11]] }
]

const DEMO_USERS: Array<AuthUser> = [
  { id: 1, username: 'admin', displayName: '管理员', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: '2026-07-25T10:00:00+08:00' },
  { id: 2, username: 'operator', displayName: '工艺操作员', role: 'OPERATOR', status: 'ACTIVE', lastLoginAt: '2026-07-25T09:40:00+08:00' },
  { id: 3, username: 'engineer', displayName: '设备工程师', role: 'ENGINEER', status: 'ACTIVE', lastLoginAt: '2026-07-25T09:20:00+08:00' },
  { id: 4, username: 'viewer', displayName: '只读观察员', role: 'VIEWER', status: 'ACTIVE', lastLoginAt: '2026-07-24T18:20:00+08:00' }
]

const SYSTEM_POLICIES: Array<SystemPolicy> = [
  { policyCode: 'VOC_LIMIT', name: 'PLA 瓶 VOC 安全阈值', value: '10', unit: 'ppm', version: 'quality-v3.2', status: 'ACTIVE', updatedAt: '2026-07-21T12:00:00+08:00' },
  { policyCode: 'AGV_OBSTACLE', name: 'AGV 超声波避障距离', value: '20', unit: 'cm', version: 'logistics-v2.1', status: 'ACTIVE', updatedAt: '2026-07-21T12:00:00+08:00' },
  { policyCode: 'WAREHOUSE_SMOKE', name: '仓储烟雾报警阈值', value: '0.5', unit: '%', version: 'safety-v1.8', status: 'ACTIVE', updatedAt: '2026-07-21T12:00:00+08:00' },
  { policyCode: 'AI_REVIEW', name: 'AI 参数变更复核策略', value: '人工审批', unit: '--', version: 'ai-govern-v1.0', status: 'ACTIVE', updatedAt: '2026-07-21T12:00:00+08:00' }
]

@Entry
@Component
struct AdminConsole {
  @State section: string = 'DASHBOARD'
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State users: Array<AuthUser> = []
  @State incidents: Array<FactoryIncident> = []
  @State auditRecords: Array<AdminAuditRecord> = []
  @State clientActivity: Array<AdminAuditRecord> = []
  @State auditError: string = '尚未请求后端操作审计。'
  @State query: string = ''
  @State filter: string = 'ALL'
  @State pageIndex: number = 0
  @State selectedDetail: string = '请选择一条记录查看详情。'
  @State message: string = ''
  @State loading: boolean = false
  @State aiConfigLoading: boolean = false
  @State aiConfigMessage: string = ''
  @State aiConfigAvailable: boolean = false
  @State aiProvider: string = ''
  @State aiModelName: string = ''
  @State aiBaseUrl: string = ''
  @State aiApiKeyInput: string = ''
  @State aiMaskedApiKey: string = ''
  @State aiTimeoutMs: string = '12000'
  @State aiRetryCount: string = '1'
  @State aiStreamEnabled: boolean = true
  @State aiMaxTokens: string = '2048'
  @State aiTemperature: string = '0.2'
  @State aiRagEnabled: boolean = true
  @State aiVectorStore: string = ''
  @State aiEmbeddingModel: string = ''
  @State aiKnowledgeVersion: string = ''
  @State aiConfigUpdatedAt: string = ''
  @State aiTestQuestion: string = '当前 PLA 瓶 VOC 达标后是否可以进入瑕疵检测？'
  @State aiTestResult: string = '尚未测试。'
  @State aiTestStatus: string = 'WAIT'
  @State livePlc: EnterprisePlcStatus = {
    mqttConnected: false,
    online: false,
    switchNames: [],
    switchDevices: [],
    switches: [],
    lamps: []
  }
  @State livePlcLoading: boolean = false
  @State livePlcMessage: string = '尚未读取现场 PLC。'
  private timer: number = -1
  private readonly pageSize: number = 5
  private readonly assistantAdapter: AdminAssistantHostAdapter = new AdminAssistantHostAdapter()
  @State assistantController: AssistantController = new AssistantController(this.assistantAdapter)
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
  }

  aboutToAppear(): void {
    if (!SessionStore.isAuthenticated) {
      router.replaceUrl({ url: 'pages/Login' })
      return
    }
    this.section = 'DASHBOARD'
    this.selectedDetail = '请选择一条记录查看详情。'
    this.query = ''
    this.filter = 'ALL'
    this.pageIndex = 0
    this.assistantAdapter.setNavigator((entity: AssistantEntityRef) => this.navigateAssistantEntity(entity))
    this.assistantAdapter.setHostContext(this.assistantPageRoute(), this.currentStateVersion(), this.bundle.updatedAt)
    this.assistantAdapter.setVisibility(SessionStore.isDemo ? 'HIDDEN' : 'VISIBLE')
    FactoryRepository.subscribe(this.listener)
    this.loading = true
    void this.refreshAll()
    FactoryRepository.connectRealtime()
    this.timer = setInterval(() => void this.refreshAll(), ApiConfig.refreshIntervalMs)
  }

  aboutToDisappear(): void {
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
    if (this.timer >= 0) clearInterval(this.timer)
    this.assistantAdapter.setVisibility('HIDDEN')
  }

  private async refreshAll(): Promise<void> {
    await FactoryRepository.refresh()
    this.bundle = FactoryRepository.bundle
    this.assistantAdapter.setHostContext(this.assistantPageRoute(), this.currentStateVersion(), this.bundle.updatedAt)
    if (!SessionStore.isAuthenticated) {
      router.replaceUrl({ url: 'pages/Login' })
      return
    }
    await this.loadIncidents()
    if (SessionStore.isAdmin) {
      await this.loadUsers()
    } else {
      this.users = []
    }
    if (this.section === 'AI_CONFIG') await this.loadAiModelConfig()
    if (this.section === 'LIVE_IO') await this.loadLivePlcStatus()
    if (this.section === 'AUDIT') await this.loadAuditRecords()
    this.loading = false
  }

  private async loadIncidents(): Promise<void> {
    try {
      const status: string = this.filter === 'OPEN' || this.filter === 'RESOLVED' ? this.filter : ''
      this.incidents = await FactoryRepository.listIncidents(status)
    } catch (error) {
      this.incidents = this.bundle.runtime.incidents
    }
  }

  private async loadAuditRecords(): Promise<void> {
    if (SessionStore.isDemo) {
      this.auditRecords = []
      this.auditError = '本地演示模式不访问后端操作审计接口。'
      return
    }
    try {
      this.auditRecords = await apiClient.request<Array<AdminAuditRecord>>('/audit/operations')
      this.auditError = ''
    } catch (error) {
      this.auditRecords = []
      this.auditError = error instanceof Error ? error.message : '后端操作审计接口不可用'
    }
  }

  private async loadUsers(): Promise<void> {
    if (SessionStore.isDemo) {
      this.users = DEMO_USERS
      this.message = '当前为只读验收数据；角色变更不会发送到后端。'
      return
    }
    try {
      this.users = await apiClient.request<Array<AuthUser>>('/auth/users')
    } catch (error) {
      this.users = []
      this.message = '用户列表暂不可用：' + (error instanceof Error ? error.message : '后端请求失败')
    }
  }

  private async loadAiModelConfig(): Promise<void> {
    if (SessionStore.isDemo) {
      this.aiConfigAvailable = false
      this.aiConfigMessage = '本地演示模式不访问 AI 中枢管理接口。'
      return
    }
    this.aiConfigLoading = true
    this.aiConfigMessage = ''
    try {
      const config: AiModelConfig = await aiCenterClient.getModelConfig()
      this.applyAiModelConfig(config)
      this.aiConfigAvailable = true
    } catch (error) {
      this.aiConfigAvailable = false
      this.aiConfigMessage = 'AI 配置接口不可用：' + (error instanceof Error ? error.message : 'AI 中枢请求失败') + '。页面不会用本地常量伪造已保存配置。'
      if (this.aiBaseUrl.length === 0) this.aiBaseUrl = AiCenterConfig.API_BASE
      if (this.aiTimeoutMs.length === 0) this.aiTimeoutMs = AiCenterConfig.requestTimeoutMs.toString()
    } finally {
      this.aiConfigLoading = false
    }
  }

  private applyAiModelConfig(config: AiModelConfig): void {
    this.aiProvider = config.provider
    this.aiModelName = config.modelName
    this.aiBaseUrl = config.baseUrl
    this.aiMaskedApiKey = config.maskedApiKey
    this.aiApiKeyInput = ''
    this.aiTimeoutMs = config.requestTimeoutMs.toString()
    this.aiRetryCount = config.retryCount.toString()
    this.aiStreamEnabled = config.streamEnabled
    this.aiMaxTokens = config.maxTokens.toString()
    this.aiTemperature = config.temperature.toString()
    this.aiRagEnabled = config.ragEnabled
    this.aiVectorStore = config.vectorStore
    this.aiEmbeddingModel = config.embeddingModel
    this.aiKnowledgeVersion = config.knowledgeVersion
    this.aiConfigUpdatedAt = config.updatedAt + (config.updatedBy.length > 0 ? ' · ' + config.updatedBy : '')
  }

  private canManageAiConfig(): boolean {
    return this.canWrite(PERMISSION_SYSTEM_MANAGE)
  }

  private parsePositiveInt(value: string, label: string): number {
    const parsed: number = Number.parseInt(value.trim())
    if (parsed.toString() === 'NaN' || parsed <= 0) {
      throw new Error(label + '必须是大于 0 的整数')
    }
    return parsed
  }

  private parseNonNegativeInt(value: string, label: string): number {
    const parsed: number = Number.parseInt(value.trim())
    if (parsed.toString() === 'NaN' || parsed < 0) {
      throw new Error(label + '必须是大于等于 0 的整数')
    }
    return parsed
  }

  private parseTemperature(value: string): number {
    const parsed: number = Number.parseFloat(value.trim())
    if (parsed.toString() === 'NaN' || parsed < 0 || parsed > 2) {
      throw new Error('温度 temperature 必须在 0 到 2 之间')
    }
    return parsed
  }

  private buildAiConfigPayload(): AiModelConfigUpdate {
    if (this.aiProvider.trim().length === 0 || this.aiModelName.trim().length === 0 || this.aiBaseUrl.trim().length === 0) {
      throw new Error('供应商、模型名称和 baseUrl 必填')
    }
    const payload: AiModelConfigUpdate = {
      provider: this.aiProvider.trim(),
      modelName: this.aiModelName.trim(),
      baseUrl: this.aiBaseUrl.trim(),
      requestTimeoutMs: this.parsePositiveInt(this.aiTimeoutMs, '请求超时'),
      retryCount: this.parseNonNegativeInt(this.aiRetryCount, '重试次数'),
      streamEnabled: this.aiStreamEnabled,
      maxTokens: this.parsePositiveInt(this.aiMaxTokens, '最大 token'),
      temperature: this.parseTemperature(this.aiTemperature),
      ragEnabled: this.aiRagEnabled,
      vectorStore: this.aiVectorStore.trim(),
      embeddingModel: this.aiEmbeddingModel.trim()
    }
    if (this.aiApiKeyInput.trim().length > 0) {
      payload.apiKey = this.aiApiKeyInput.trim()
    }
    return payload
  }

  private async saveAiModelConfig(): Promise<void> {
    if (!this.canManageAiConfig()) {
      this.aiConfigMessage = this.writeDisabledReason(PERMISSION_SYSTEM_MANAGE)
      this.appendClientActivity('保存 AI 模型配置', 'AI_CONFIG', 'DENIED', this.aiConfigMessage)
      return
    }
    this.aiConfigLoading = true
    try {
      const payload: AiModelConfigUpdate = this.buildAiConfigPayload()
      const result: AiModelConfig = await aiCenterClient.updateModelConfig(payload)
      this.applyAiModelConfig(result)
      this.aiConfigAvailable = true
      this.aiConfigMessage = 'AI 中枢已返回配置事实状态：' + result.status + '，更新时间：' + result.updatedAt
      this.appendClientActivity('保存 AI 模型配置', result.configId || 'AI_CONFIG', 'ACCEPTED', this.aiConfigMessage)
      promptAction.showToast({ message: 'AI 配置已提交到 AI 中枢' })
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : '保存 AI 配置失败'
      this.aiConfigMessage = '保存失败：' + msg
      this.appendClientActivity('保存 AI 模型配置', 'AI_CONFIG', 'FAILED', msg)
    } finally {
      this.aiConfigLoading = false
    }
  }

  private async testAiConnection(): Promise<void> {
    if (!this.canManageAiConfig()) {
      this.aiTestStatus = 'DENIED'
      this.aiTestResult = this.writeDisabledReason(PERMISSION_SYSTEM_MANAGE)
      this.appendClientActivity('测试 AI 连接', 'AI_CONFIG', 'DENIED', this.aiTestResult)
      return
    }
    const question: string = this.aiTestQuestion.trim().length > 0 ? this.aiTestQuestion.trim() : '请回答当前 AI 中枢是否可用。'
    const payload: AiConnectionTestRequest = {
      question: question,
      includeRag: this.aiRagEnabled
    }
    this.aiConfigLoading = true
    this.aiTestStatus = 'WAIT'
    this.aiTestResult = '正在请求 AI 中枢测试接口...'
    try {
      const result: AiConnectionTestResult = await aiCenterClient.testConnection(payload)
      this.aiTestStatus = result.success ? 'PASS' : 'FAILED'
      this.aiTestResult = result.status + ' · ' + result.message +
        '\n模型：' + result.provider + ' / ' + result.modelName +
        '\n延迟：' + result.latencyMs.toString() + ' ms' +
        '\nRAG：' + (result.ragReady ? 'READY' : 'NOT_READY') +
        '\n知识版本：' + (result.knowledgeVersion || '--') +
        '\n错误类型：' + (result.errorType || '--') +
        '\n时间：' + result.occurredAt
      this.appendClientActivity('测试 AI 连接', 'AI_CONFIG', result.success ? 'ACCEPTED' : 'FAILED', result.message)
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : 'AI 中枢测试接口不可用'
      this.aiTestStatus = 'FAILED'
      this.aiTestResult = '测试失败：' + msg + '\n可能原因：鉴权失败、网络超时、模型不可用、速率限制、RAG 未就绪或接口尚未实现。'
      this.appendClientActivity('测试 AI 连接', 'AI_CONFIG', 'FAILED', msg)
    } finally {
      this.aiConfigLoading = false
    }
  }

  private currentRole(): string {
    return SessionStore.user === undefined ? '' : SessionStore.user.role
  }

  private canUsePage(pageCode: string): boolean {
    return canAccessAdminPage(this.currentRole(), pageCode)
  }

  private canWrite(permission: string): boolean {
    return hasPermission(this.currentRole(), permission) && !SessionStore.isDemo && this.bundle.online
  }

  private selectSection(code: string): void {
    adminAssistantSelectionBus.publish(undefined)
    this.section = code
    adminAssistantSelectionBus.setPageRoute(this.assistantPageRoute())
    this.assistantAdapter.setHostContext(this.assistantPageRoute(), this.currentStateVersion(), this.bundle.updatedAt)
    this.query = ''
    this.filter = 'ALL'
    this.pageIndex = 0
    this.selectedDetail = code === 'LIVE_IO' ? '请选择一条记录查看详情。' : this.currentMenu().description
    this.message = ''
    if (code === 'USERS' && SessionStore.isAdmin) void this.loadUsers()
    if (code === 'INCIDENTS') void this.loadIncidents()
    if (code === 'AI_CONFIG') void this.loadAiModelConfig()
    if (code === 'LIVE_IO') void this.loadLivePlcStatus()
    if (code === 'AUDIT') void this.loadAuditRecords()
  }

  private currentMenu(): MenuItem {
    let current: MenuItem = MENU[0]
    MENU.forEach((item: MenuItem) => {
      if (item.code === this.section) current = item
    })
    return current
  }

  private roleName(): string {
    if (SessionStore.user === undefined) return '未登录'
    return roleLabel(SessionStore.user.role)
  }

  private dataSourceLabel(): string {
    if (this.bundle.online) return 'BACKEND'
    return this.bundle.source
  }

  private contains(source: string, keyword: string): boolean {
    return source.toLowerCase().indexOf(keyword.toLowerCase()) >= 0
  }

  private resetPage(): void {
    this.pageIndex = 0
  }

  private filterMatches(status: string): boolean {
    return this.filter === 'ALL' || status === this.filter
  }

  private pageStart(): number {
    return this.pageIndex * this.pageSize
  }

  private pageEnd(total: number): number {
    const value: number = this.pageStart() + this.pageSize
    return value > total ? total : value
  }

  private totalPages(total: number): number {
    const pages: number = Math.ceil(total / this.pageSize)
    return pages <= 0 ? 1 : pages
  }

  private async logout(): Promise<void> {
    if (!SessionStore.isDemo) {
      try {
        await apiClient.logout()
      } catch (error) {
        this.appendClientActivity('退出登录', 'auth/logout', 'FAILED', error instanceof Error ? error.message : '后端退出接口不可达')
      }
    }
    SessionStore.clear()
    router.replaceUrl({ url: 'pages/Login' })
  }

  private confirmAction(title: string, message: string, action: () => void): void {
    AlertDialog.show({
      title: title,
      message: message,
      primaryButton: { value: '确认执行', action: action },
      secondaryButton: { value: '取消', action: () => {} }
    })
  }

  private appendClientActivity(action: string, target: string, result: string, message: string): void {
    const actor: string = SessionStore.user === undefined ? 'anonymous' : SessionStore.user.username
    const record: AdminAuditRecord = {
      auditId: 'CLIENT-' + new Date().getTime().toString(),
      actor: actor,
      action: action,
      target: target,
      result: result,
      message: message,
      occurredAt: new Date().toISOString()
    }
    this.clientActivity = [record].concat(this.clientActivity)
  }

  private async acknowledgeAlarm(alarm: AlarmRecord): Promise<void> {
    if (!this.canWrite(PERMISSION_INCIDENT_DISPOSE)) {
      this.message = this.writeDisabledReason(PERMISSION_INCIDENT_DISPOSE)
      this.appendClientActivity('确认报警', alarm.alarmId, 'DENIED', this.message)
      return
    }
    try {
      await FactoryRepository.acknowledgeAlarm(alarm.alarmId)
      this.appendClientActivity('确认报警', alarm.alarmId, 'ACCEPTED', '后端已受理，但当前接口未返回服务端审计号')
      promptAction.showToast({ message: '报警确认已提交' })
      await this.refreshAll()
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : '报警确认失败'
      this.appendClientActivity('确认报警', alarm.alarmId, 'FAILED', msg)
      this.message = msg
    }
  }

  private async resolveIncident(incident: FactoryIncident, strategy: string): Promise<void> {
    if (!this.canWrite(PERMISSION_INCIDENT_DISPOSE)) {
      this.message = this.writeDisabledReason(PERMISSION_INCIDENT_DISPOSE)
      this.appendClientActivity('处置异常', incident.incidentId, 'DENIED', this.message)
      return
    }
    try {
      await FactoryRepository.resolveIncident(incident.incidentId, strategy)
      this.appendClientActivity('处置异常', incident.incidentId, 'ACCEPTED', '后端已受理异常策略，但未返回服务端审计号：' + strategy)
      promptAction.showToast({ message: '异常处置已提交' })
      await this.refreshAll()
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : '异常处置失败'
      this.appendClientActivity('处置异常', incident.incidentId, 'FAILED', msg)
      this.message = msg
    }
  }

  private async updateUser(user: AuthUser): Promise<void> {
    if (!this.canWrite(PERMISSION_USER_MANAGE)) {
      this.message = this.writeDisabledReason(PERMISSION_USER_MANAGE)
      this.appendClientActivity('更新用户', user.username, 'DENIED', this.message)
      return
    }
    const nextRole: string = user.role === 'VIEWER' ? 'OPERATOR' : user.role === 'OPERATOR' ? 'ENGINEER' : user.role === 'ENGINEER' ? 'ADMIN' : 'VIEWER'
    const payload: UpdateUserPayload = { role: nextRole, status: user.status }
    const patchMethod: http.RequestMethod = 'PATCH' as http.RequestMethod
    try {
      await apiClient.request<Object>('/auth/users/' + user.id.toString(), patchMethod, JSON.stringify(payload))
      this.appendClientActivity('更新用户', user.username, 'ACCEPTED', '后端已受理角色变更，但未返回服务端审计号：' + nextRole)
      promptAction.showToast({ message: '用户角色更新已提交' })
      await this.loadUsers()
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : '更新用户失败'
      this.appendClientActivity('更新用户', user.username, 'FAILED', msg)
      this.message = msg
    }
  }

  private writeDisabledReason(permission: string): string {
    if (SessionStore.isDemo) return '演示账号只允许浏览，不发送真实写操作。'
    if (!hasPermission(this.currentRole(), permission)) return '当前角色权限不足，需要 ' + permissionLabel(permission) + '。'
    if (!this.bundle.online) return '后端不可达，写操作已禁用。'
    return '当前操作不可用。'
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Row() {
        this.sidebar()
        Column() {
          this.topbar()
          Scroll() {
            Column() {
              this.connectionBanner()
              if (!this.canUsePage(this.currentMenu().code)) {
                this.noAccessView()
              } else {
                this.adminToolbar()
                this.loadingState()
                if (this.section === 'DASHBOARD') this.dashboardView()
                if (this.section === 'PRODUCTION') this.productionView()
                if (this.section === 'INCIDENTS') this.incidentView()
                if (this.section === 'DEVICES') this.deviceView()
                if (this.section === 'LIVE_IO') this.liveIoView()
                if (this.section === 'MATERIALS') this.materialView()
                if (this.section === 'LOGISTICS') this.logisticsView()
                if (this.section === 'AI_AUDIT') this.aiAuditView()
                if (this.section === 'AI_CONFIG') this.aiConfigView()
                if (this.section === 'KNOWLEDGE') this.knowledgeView()
                if (this.section === 'USERS') this.userView()
                if (this.section === 'SETTINGS') this.settingsView()
                if (this.section === 'AUDIT') this.auditView()
              }
              if (this.message.length > 0) {
                Text(this.message).fontSize(11).fontColor(Theme.danger).padding(12).width('100%').backgroundColor(Theme.dangerSoft).margin({ top: 12 })
              }
            }.width('100%').alignItems(HorizontalAlign.Start).padding({ left: 24, right: 24, top: 20, bottom: 28 })
          }.width('100%').layoutWeight(1).backgroundColor(Theme.page)
        }.layoutWeight(1).height('100%')
      }.width('100%').height('100%').backgroundColor(Theme.page)
      if (this.selectedDetail !== '请选择一条记录查看详情。') {
        this.detailDrawer()
      }
      if (!SessionStore.isDemo) {
        AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
          .margin({ top: 18, right: 18, bottom: 18 })
      }
    }.width('100%').height('100%').backgroundColor(Theme.page)
  }

  @Builder
  sidebar() {
    Column() {
      Row({ space: 10 }) {
        Text('BF').fontSize(14).fontColor('#FFFFFF').fontWeight(FontWeight.Bold)
          .width(34).height(34).textAlign(TextAlign.Center).backgroundColor(Theme.blue)
        Column() {
          Text('SMART BOTTLING').fontSize(9).fontColor('#9FC5DF').fontWeight(FontWeight.Bold)
          Text('工厂管理台').fontSize(18).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 3 })
        }.alignItems(HorizontalAlign.Start)
      }.width('100%')
      Row({ space: 6 }) {
        Circle().width(7).height(7).fill(this.bundle.online ? '#49D38A' : '#F2C04C')
        Text(this.bundle.online ? '生产后端在线' : '后端连接待确认').fontSize(9).fontColor('#B4C8D6')
      }.margin({ top: 14, bottom: 12 })
      Text(this.roleName()).fontSize(10).fontColor('#D7EAF8').padding({ left: 8, right: 8, top: 5, bottom: 5 }).backgroundColor('#123F61')
      Divider().color('#2B5876').margin({ top: 16, bottom: 8 })
      Scroll() {
        Column({ space: 10 }) {
          ForEach(NAV_GROUPS, (group: MenuGroup) => {
            Column({ space: 3 }) {
              Text(group.label).fontSize(9).fontColor('#7FA3BB').fontWeight(FontWeight.Bold).margin({ left: 10, bottom: 3 })
              ForEach(group.items, (item: MenuItem) => {
                Button(item.label)
                  .type(ButtonType.Normal)
                  .width('100%')
                  .height(38)
                  .fontSize(11)
                  .fontColor(this.section === item.code ? '#FFFFFF' : '#C2D3DF')
                  .backgroundColor(this.section === item.code ? '#0B66B2' : Color.Transparent)
                  .border({ width: { left: 3 }, color: this.section === item.code ? '#55B7FF' : Color.Transparent })
                  .borderRadius(0)
                  .onClick(() => this.selectSection(item.code))
              }, (item: MenuItem) => item.code)
            }.width('100%').alignItems(HorizontalAlign.Start)
          }, (group: MenuGroup) => group.label)
        }.width('100%').alignItems(HorizontalAlign.Start)
      }.width('100%').layoutWeight(1)
      Button('退出登录')
        .type(ButtonType.Normal)
        .width('100%')
        .height(38)
        .fontColor('#B4C8D6')
        .backgroundColor(Color.Transparent)
        .border({ width: 1, color: '#2B5876' })
        .onClick(() => void this.logout())
    }.width(248).height('100%').padding(18).alignItems(HorizontalAlign.Start).backgroundColor(Theme.navy).border({ width: { right: 1 }, color: '#2B5876' })
  }

  private async loadLivePlcStatus(): Promise<void> {
    if (SessionStore.isDemo) {
      this.livePlcMessage = '演示账号不访问现场设备接口。'
      return
    }
    this.livePlcLoading = true
    try {
      this.livePlc = await FactoryRepository.getEnterprisePlcStatus()
      this.livePlcMessage = this.livePlc.online
        ? 'PLC 正在通过现场 MQTT 上报，状态不会由前端模拟。'
        : (this.livePlc.mqttConnected ? 'Broker 已连接，正在等待 PLC 心跳。' : 'Broker 未连接。')
    } catch (error) {
      this.livePlcMessage = '现场 PLC 状态读取失败：' + (error instanceof Error ? error.message : '后端请求失败')
    } finally {
      this.livePlcLoading = false
    }
  }

  private async setLiveLamp(index: number, action: number): Promise<void> {
    if (!this.canWrite(PERMISSION_DEVICE_CONTROL)) {
      this.livePlcMessage = this.writeDisabledReason(PERMISSION_DEVICE_CONTROL)
      return
    }
    this.livePlcLoading = true
    try {
      const result: EnterpriseLampCommandResult = await FactoryRepository.setEnterpriseLamp(index, action)
      this.livePlcMessage = result.message
      this.appendClientActivity('PLC 灯控', 'LAMP-' + (index + 1).toString(), result.status,
        action === 1 ? '点亮命令已发送' : '熄灭命令已发送')
      await this.loadLivePlcStatus()
    } catch (error) {
      this.livePlcMessage = '灯控失败：' + (error instanceof Error ? error.message : '后端请求失败')
    } finally {
      this.livePlcLoading = false
    }
  }

  @Builder
  topbar() {
    Row() {
      Column() {
        Text('后台管理 / ' + this.currentMenu().label).fontSize(20).fontColor(Theme.text).fontWeight(FontWeight.Bold)
        Text(this.currentMenu().description).fontSize(10).fontColor(Theme.muted).margin({ top: 5 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Text('数据源').fontSize(9).fontColor(Theme.muted).margin({ right: 6 })
      StateBadge({ status: this.bundle.online ? 'RUNNING' : 'WAIT', label: this.dataSourceLabel() })
      Text(SessionStore.user === undefined ? '--' : SessionStore.user.displayName)
        .fontSize(11)
        .fontColor(Theme.text)
        .fontWeight(FontWeight.Bold)
        .margin({ left: 16, right: 12 })
      Button('刷新')
        .type(ButtonType.Normal)
        .height(32)
        .fontSize(10)
        .fontColor(Theme.blue)
        .backgroundColor(Color.Transparent)
        .border({ width: 1, color: Theme.line })
        .onClick(() => { this.loading = true; void this.refreshAll() })
    }.width('100%').height(68).padding({ left: 24, right: 24 }).backgroundColor(Theme.panel).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  connectionBanner() {
    if (!this.bundle.online || SessionStore.isDemo) {
      Row({ space: 8 }) {
        Circle().width(8).height(8).fill(Theme.warning)
        Text((SessionStore.isDemo ? '演示账号只读。' : '') + (this.bundle.errorMessage.length > 0 ? this.bundle.errorMessage : '后端不可达，当前显示本地演示数据。'))
          .fontSize(10).fontColor(Theme.warning).layoutWeight(1)
      }.padding(10).width('100%').backgroundColor(Theme.warningSoft).border({ width: { left: 3 }, color: Theme.warning }).margin({ bottom: 14 })
    }
  }

  @Builder
  adminToolbar() {
    Row({ space: 10 }) {
      Text('筛选').fontSize(10).fontColor(Theme.muted)
      TextInput({ text: this.query, placeholder: '搜索编号、工位、设备、追踪号或操作者' })
        .height(38)
        .layoutWeight(1)
        .backgroundColor(Theme.panel)
        .onChange((value: string) => { this.query = value; this.resetPage() })
      Button('状态：' + this.filter).type(ButtonType.Normal).height(38).fontColor(Theme.blue).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line }).onClick(() => this.nextFilter())
      Button('应用刷新').height(38).fontSize(10).backgroundColor(Theme.blue).fontColor('#FFFFFF').onClick(() => { this.loading = true; void this.refreshAll() })
    }.width('100%').margin({ bottom: 12 })
  }

  @Builder
  loadingState() {
    if (this.loading) {
      Row({ space: 10 }) {
        LoadingProgress().width(20).height(20).color(Theme.blue)
        Text('正在从后端刷新当前页面数据...').fontSize(10).fontColor(Theme.muted)
      }.width('100%').padding(10).backgroundColor(Theme.panelSoft).margin({ bottom: 12 })
    }
  }

  private nextFilter(): void {
    const filters: Array<string> = this.filtersForSection()
    let index: number = filters.indexOf(this.filter)
    index = index < 0 ? 0 : index + 1
    if (index >= filters.length) index = 0
    this.filter = filters[index]
    this.pageIndex = 0
    if (this.section === 'INCIDENTS') void this.loadIncidents()
  }

  private filtersForSection(): Array<string> {
    if (this.section === 'PRODUCTION' || this.section === 'MATERIALS') return ['ALL', 'RUNNING', 'HOLD', 'REJECTED', 'COMPLETED']
    if (this.section === 'INCIDENTS') return ['ALL', 'OPEN', 'RESOLVED']
    if (this.section === 'DEVICES') return ['ALL', 'RUNNING', 'STANDBY', 'ALARM', 'OFFLINE', 'MAINTENANCE']
    if (this.section === 'LOGISTICS') return ['ALL', 'PENDING', 'RUNNING', 'ACKNOWLEDGED', 'FAILED', 'TIMEOUT']
    if (this.section === 'AI_AUDIT') return ['ALL', 'PROPOSED', 'APPROVAL_REQUIRED', 'COMMAND_PENDING', 'APPLIED', 'FAILED', 'STALE']
    if (this.section === 'KNOWLEDGE') return ['ALL', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'INGESTING', 'INDEXED', 'REJECTED', 'FAILED', 'REVOKED']
    if (this.section === 'USERS') return ['ALL', 'ACTIVE', 'DISABLED']
    if (this.section === 'AUDIT') return ['ALL', 'ACCEPTED', 'FAILED', 'DENIED', 'PENDING']
    return ['ALL']
  }

  @Builder
  pager(total: number) {
    Row() {
      Text('第 ' + (this.pageIndex + 1).toString() + ' / ' + this.totalPages(total).toString() + ' 页，共 ' + total.toString() + ' 条')
        .fontSize(10).fontColor(Theme.muted).layoutWeight(1)
      Button('上一页').type(ButtonType.Normal).enabled(this.pageIndex > 0).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.pageIndex--)
      Button('下一页').type(ButtonType.Normal).enabled(this.pageIndex + 1 < this.totalPages(total)).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.pageIndex++)
    }.width('100%').padding({ top: 10 })
  }

  @Builder
  tableHeader(columns: Array<string>) {
    Row() {
      ForEach(columns, (column: string) => {
        Text(column).fontSize(9).fontColor(Theme.muted).fontWeight(FontWeight.Bold).layoutWeight(1)
      }, (column: string) => column)
    }.width('100%').padding({ left: 10, right: 10, top: 8, bottom: 8 }).backgroundColor(Theme.panelSoft).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  emptyState(text: string) {
    Column() {
      Text(text).fontSize(13).fontColor(Theme.muted)
      Text('请调整搜索或筛选条件，或等待后端返回数据。').fontSize(10).fontColor(Theme.muted).margin({ top: 6 })
    }.width('100%').padding(28).alignItems(HorizontalAlign.Center).backgroundColor(Theme.panelSoft)
  }

  @Builder
  detailPanel() {
    Column() {
      Text('详情已在右侧上下文抽屉中显示。').fontSize(10).fontColor(Theme.muted)
    }.width('100%').padding(10).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line }).margin({ top: 12 })
  }

  @Builder
  detailDrawer() {
    Column() {
      Row() {
        Column() {
          Text('CONTEXT').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold).letterSpacing(0.8)
          Text('详情抽屉').fontSize(17).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 4 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Button('关闭')
          .type(ButtonType.Normal)
          .height(30)
          .fontSize(10)
          .fontColor(Theme.muted)
          .backgroundColor(Color.Transparent)
          .border({ width: 1, color: Theme.line })
          .onClick(() => this.selectedDetail = '请选择一条记录查看详情。')
      }.width('100%').padding({ bottom: 12 }).border({ width: { bottom: 1 }, color: Theme.line })
      Text(this.selectedDetail)
        .fontSize(11)
        .fontColor(Theme.text)
        .lineHeight(19)
        .width('100%')
        .margin({ top: 14 })
      Blank()
      Text('引用导航只读；写操作仍必须通过页面按钮、确认框和后端权限闸口。')
        .fontSize(9)
        .fontColor(Theme.muted)
        .padding(10)
        .width('100%')
        .backgroundColor(Theme.panelSoft)
        .border({ width: 1, color: Theme.line })
    }
    .width(360)
    .height('100%')
    .padding(18)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(Theme.panel)
    .border({ width: { left: 1 }, color: Theme.line })
    .shadow({ radius: 18, color: '#1F2A3320', offsetX: -3, offsetY: 0 })
  }

  @Builder
  dashboardView() {
    Column({ space: 12 }) {
      Row() {
        this.metric('今日产量', this.bundle.dashboard.total.toString(), '进入产线', 'NORMAL')
        this.metric('完成率', this.bundle.dashboard.completed.toString(), '完成入库', 'PASS')
        this.metric('设备在线率', this.bundle.runtime.devices.length > 0 ? Math.round(this.bundle.runtime.devices.filter((item: RuntimeDevice) => item.state !== 'OFFLINE').length / this.bundle.runtime.devices.length * 100).toString() + '%' : '--', '实时设备', 'RUNNING')
        this.metric('开放异常', this.openIncidentCount().toString(), '质量或设备', this.openIncidentCount() > 0 ? 'ALARM' : 'PASS')
        this.metric('待审核知识', this.aiReviewCount().toString(), 'RAG 治理', this.aiReviewCount() > 0 ? 'WAIT' : 'PASS')
        this.metric('待处理 AI 决策', this.bundle.operations.aiAudits.filter((item: AiAudit) => item.validationStatus !== 'PASSED').length.toString(), '建议与校验', 'WAIT')
      }.width('100%').height(86).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })

      Row({ space: 12 }) {
        this.dashboardProductionTable()
        this.dashboardIncidentTable()
        this.dashboardContextPanel()
      }.width('100%').alignItems(VerticalAlign.Top)

      Row({ space: 12 }) {
        this.dashboardEquipmentPanel()
        this.dashboardLogisticsPanel()
        this.dashboardAiPanel()
      }.width('100%').alignItems(VerticalAlign.Top)
    }.width('100%')
  }

  @Builder
  dashboardProductionTable() {
    Column() {
      SectionTitle({ code: 'PRODUCTION TASKS', title: '生产任务', description: '批次、瓶型、完成量和当前工序' })
      this.tableHeader(['批次 / 瓶型', '目标状态', '当前工序', '完成率'])
      ForEach(this.filteredRuns().slice(0, 5), (run: FactoryRun) => {
        Row() {
          Column() {
            Text(run.batchCode || run.traceCode).fontSize(10).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
            Text(run.bottleType || '待识别').fontSize(8).fontColor(Theme.muted).margin({ top: 3 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          StateBadge({ status: run.status, label: run.status })
          Text(this.stageName(run.currentStage)).fontSize(9).fontColor(Theme.text).width(90)
          Text(run.status === 'COMPLETED' ? '100%' : run.status === 'RUNNING' ? '进行中' : '待处理').fontSize(9).fontColor(statusColor(run.status)).width(58)
        }.width('100%').padding({ top: 9, bottom: 9 }).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectProduct(run))
      }, (run: FactoryRun) => run.traceCode)
      if (this.filteredRuns().length === 0) this.emptyState('暂无生产任务')
    }.layoutWeight(1).padding(14).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.blue })
  }

  @Builder
  dashboardIncidentTable() {
    Column() {
      SectionTitle({ code: 'EXCEPTION TODO', title: '异常待办', description: '按严重级别、工位和影响范围处理' })
      this.tableHeader(['级别 / 异常', '工位 / 设备', '策略', '状态'])
      ForEach(this.filteredIncidents().slice(0, 5), (incident: FactoryIncident) => {
        Row() {
          Column() {
            Text(incident.strategy).fontSize(10).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
            Text(incident.message).fontSize(8).fontColor(Theme.muted).margin({ top: 3 }).maxLines(1)
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Text(this.stageName(incident.stageCode) + ' · ' + (incident.deviceCode || '--')).fontSize(8).fontColor(Theme.text).width(100).maxLines(2)
          Text(incident.targetStage || '局部').fontSize(8).fontColor(Theme.muted).width(54)
          StateBadge({ status: incident.status === 'OPEN' ? 'ALARM' : 'PASS', label: incident.status })
        }.width('100%').padding({ top: 9, bottom: 9 }).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectedDetail = this.incidentDetail(incident))
      }, (incident: FactoryIncident) => incident.incidentId)
      if (this.filteredIncidents().length === 0) this.emptyState('当前无开放异常')
    }.layoutWeight(1).padding(14).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.warning })
  }

  @Builder
  dashboardContextPanel() {
    Column() {
      Row() {
        Column() {
          Text('CONTEXT').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
          Text('异常详情').fontSize(16).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 4 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        if (this.selectedDetail !== '请选择一条记录查看详情。') {
          Button('关闭').type(ButtonType.Normal).height(28).fontSize(9).fontColor(Theme.muted).backgroundColor(Color.Transparent).border({ width: 1, color: Theme.line }).onClick(() => this.selectedDetail = '请选择一条记录查看详情。')
        }
      }.width('100%').padding({ bottom: 10 }).border({ width: { bottom: 1 }, color: Theme.line })
      Text(this.selectedDetail === '请选择一条记录查看详情。' ? '点击生产任务或异常待办查看完整上下文。' : this.selectedDetail).fontSize(10).fontColor(Theme.text).lineHeight(17).width('100%').margin({ top: 12 })
      Blank()
      Text('数据来自后端实时快照；演示数据会明确标记，不替代服务端状态。').fontSize(8).fontColor(Theme.muted).width('100%').padding(9).backgroundColor(Theme.panelSoft)
    }.width(280).height(330).padding(14).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.danger })
  }

  @Builder
  dashboardEquipmentPanel() {
    Column() {
      SectionTitle({ code: 'EQUIPMENT HEALTH', title: '设备健康与维护', description: '在线、关注、故障和离线设备' })
      Row() {
        Column() {
          Text(this.bundle.runtime.devices.length.toString()).fontSize(28).fontColor(Theme.text).fontWeight(FontWeight.Bold)
          Text('总设备数').fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
        }.layoutWeight(1)
        Column() {
          Text(this.offlineDeviceCount().toString()).fontSize(22).fontColor(this.offlineDeviceCount() > 0 ? Theme.danger : Theme.success).fontWeight(FontWeight.Bold)
          Text('离线').fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
        }.layoutWeight(1)
        Column() {
          Text(this.openAlarmCount().toString()).fontSize(22).fontColor(this.openAlarmCount() > 0 ? Theme.warning : Theme.success).fontWeight(FontWeight.Bold)
          Text('报警').fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
        }.layoutWeight(1)
      }.width('100%').padding({ top: 12, bottom: 12 }).border({ width: { bottom: 1 }, color: Theme.line })
      ForEach(this.bundle.runtime.devices.slice(0, 3), (device: RuntimeDevice) => {
        Row() { Circle().width(7).height(7).fill(statusColor(device.state)); Text(device.deviceCode).fontSize(9).fontColor(Theme.text).margin({ left: 7 }).layoutWeight(1); Text(this.stageName(device.stageCode)).fontSize(8).fontColor(Theme.muted) }.width('100%').padding({ top: 7, bottom: 7 })
      }, (device: RuntimeDevice) => device.deviceCode)
    }.layoutWeight(1).padding(14).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })
  }

  @Builder
  dashboardLogisticsPanel() {
    Column() {
      SectionTitle({ code: 'AGV & WAREHOUSE', title: 'AGV 与仓储任务', description: '运输状态、库位安全和当前任务' })
      Row() {
        this.miniDashboardValue('运输中', this.bundle.logistics.tasks.filter((item: AgvTask) => item.status === 'RUNNING').length.toString(), 'RUNNING')
        this.miniDashboardValue('待调度', this.bundle.logistics.tasks.filter((item: AgvTask) => item.status === 'PENDING').length.toString(), 'WAIT')
        this.miniDashboardValue('仓区风险', this.unsafeZoneCount().toString(), this.unsafeZoneCount() > 0 ? 'ALARM' : 'PASS')
      }.width('100%').padding({ top: 12, bottom: 10 }).border({ width: { bottom: 1 }, color: Theme.line })
      ForEach(this.bundle.logistics.tasks.slice(0, 3), (task: AgvTask) => {
        Row() { Text(task.agvCode).fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold).width(70); Text(task.source + ' → ' + task.destination).fontSize(8).fontColor(Theme.text).layoutWeight(1); StateBadge({ status: task.status, label: task.status }) }.width('100%').padding({ top: 7, bottom: 7 })
      }, (task: AgvTask) => task.taskId)
    }.layoutWeight(1).padding(14).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })
  }

  @Builder
  dashboardAiPanel() {
    Column() {
      SectionTitle({ code: 'AI GOVERNANCE', title: 'AI 决策与知识审核', description: '模型状态、RAG 版本和待复核建议' })
      Row() { this.miniDashboardValue('待复核', this.aiReviewCount().toString(), this.aiReviewCount() > 0 ? 'WAIT' : 'PASS'); this.miniDashboardValue('知识版本', this.aiKnowledgeVersion.length > 0 ? this.aiKnowledgeVersion : '--', 'NORMAL') }.width('100%').padding({ top: 12, bottom: 10 }).border({ width: { bottom: 1 }, color: Theme.line })
      ForEach(this.bundle.operations.aiAudits.slice(0, 3), (audit: AiAudit) => {
        Row() { Text(audit.auditId).fontSize(8).fontColor(Theme.blue).width(82); Text(audit.decision).fontSize(8).fontColor(Theme.text).layoutWeight(1).maxLines(1); StateBadge({ status: audit.validationStatus, label: audit.validationStatus }) }.width('100%').padding({ top: 7, bottom: 7 })
      }, (audit: AiAudit) => audit.auditId)
    }.layoutWeight(1).padding(14).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })
  }

  @Builder
  miniDashboardValue(label: string, value: string, tone: string) {
    Column() { Text(label).fontSize(8).fontColor(Theme.muted); Text(value).fontSize(17).fontColor(tone === 'NORMAL' ? Theme.text : statusColor(tone)).fontWeight(FontWeight.Bold).margin({ top: 4 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
  }

  @Builder
  metric(label: string, value: string, note: string, tone: string) {
    Column() {
      Text(label).fontSize(10).fontColor(Theme.muted)
      Text(value).fontSize(24).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 7 })
      Text(note).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
    }.layoutWeight(1).height('100%').padding(13).alignItems(HorizontalAlign.Start).border({ width: { right: 1 }, color: Theme.line })
  }

  @Builder
  stageSummary() {
    Column() {
      SectionTitle({ code: 'PRODUCTION FLOW', title: '工序运行概览', description: '后台只看管理状态，不复制大屏动画。' })
      ForEach(FACTORY_STAGES, (stage: StageDefinition) => {
        Row() {
          Text(stage.name).fontSize(11).fontColor(Theme.text).width(118)
          Text(stage.code).fontSize(9).fontColor(Theme.muted).layoutWeight(1)
          StateBadge({ status: this.stageState(stage.code), label: this.stageState(stage.code) })
        }.width('100%').padding(9).border({ width: { bottom: 1 }, color: Theme.line })
      }, (stage: StageDefinition) => stage.code)
    }.layoutWeight(1).padding(15).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  todoSummary() {
    Column() {
      SectionTitle({ code: 'MANAGEMENT TODO', title: '待办与风险', description: '需要人工关注的异常、报警、AI 审批和离线设备。' })
      this.todoRow('开放异常', this.openIncidentCount().toString(), this.openIncidentCount() > 0 ? 'ALARM' : 'PASS')
      this.todoRow('开放报警', this.openAlarmCount().toString(), this.openAlarmCount() > 0 ? 'ALARM' : 'PASS')
      this.todoRow('AI 待复核', this.aiReviewCount().toString(), this.aiReviewCount() > 0 ? 'WAIT' : 'PASS')
      this.todoRow('离线设备', this.offlineDeviceCount().toString(), this.offlineDeviceCount() > 0 ? 'ALARM' : 'PASS')
      this.todoRow('仓区风险', this.unsafeZoneCount().toString(), this.unsafeZoneCount() > 0 ? 'ALARM' : 'PASS')
      this.detailPanel()
    }.width(360).padding(15).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  todoRow(label: string, value: string, status: string) {
    Row() {
      Text(label).fontSize(11).fontColor(Theme.text).layoutWeight(1)
      StateBadge({ status: status, label: value })
    }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  productionView() {
    Column() {
      SectionTitle({ code: 'PRODUCTION TASKS', title: '批次与工单', description: '来自生产总览接口，管理端用于查状态和追溯，不做现场调参。' })
      Row({ space: 8 }) {
        Button('新建生产工单').enabled(false).fontColor('#FFFFFF').backgroundColor(Theme.neutral)
        Text('不可用：P0 目标端点 /production/orders 尚未在当前后端分支实现。').fontSize(10).fontColor(Theme.warning)
      }.width('100%').margin({ top: 8, bottom: 8 })
      this.tableHeader(['追踪号 / 批次', '当前工序', '状态', '箱码', '操作'])
      if (this.filteredRuns().length === 0) {
        this.emptyState('没有匹配的生产任务。')
      } else {
        ForEach(this.filteredRuns().slice(this.pageStart(), this.pageEnd(this.filteredRuns().length)), (run: FactoryRun) => {
          Row() {
            Column() {
              Text(run.traceCode).fontSize(12).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
              Text((run.batchCode || '--') + ' · ' + (run.bottleType || '待识别')).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).width(210)
            Text(this.stageName(run.currentStage)).fontSize(10).fontColor(Theme.text).width(130)
            StateBadge({ status: run.status, label: run.status })
            Text(run.boxCode || '未装箱').fontSize(10).fontColor(Theme.muted).layoutWeight(1)
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectProduct(run))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (run: FactoryRun) => run.traceCode)
        this.pager(this.filteredRuns().length)
      }
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  incidentView() {
    Column() {
      SectionTitle({ code: 'INCIDENT CENTER', title: '异常处置中心', description: '处置策略包含剔除、局停、返工、缓冲和上下游影响。' })
      this.tableHeader(['异常 / 工位 / 设备', '状态', '说明', '操作'])
      if (this.filteredIncidents().length === 0) {
        this.emptyState('当前没有匹配的异常。')
      } else {
        ForEach(this.filteredIncidents().slice(this.pageStart(), this.pageEnd(this.filteredIncidents().length)), (incident: FactoryIncident) => {
          Row({ space: 10 }) {
            Column() {
              Text(incident.incidentId + ' · ' + incident.strategy).fontSize(11).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
              Text(this.stageName(incident.stageCode) + ' · ' + (incident.deviceCode || '未绑定设备')).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
              Text(incident.message).fontSize(10).fontColor(Theme.text).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            StateBadge({ status: incident.status, label: incident.status })
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectedDetail = this.incidentDetail(incident))
            Button('处置').enabled(this.canWrite(PERMISSION_INCIDENT_DISPOSE)).fontColor('#FFFFFF').backgroundColor(this.canWrite(PERMISSION_INCIDENT_DISPOSE) ? Theme.blue : Theme.neutral).onClick(() => this.confirmAction('确认处置异常', '提交后由后端执行权限、安全门和联锁校验。', () => void this.resolveIncident(incident, incident.strategy)))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (incident: FactoryIncident) => incident.incidentId)
        this.pager(this.filteredIncidents().length)
      }
      Text('开放报警').fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 18, bottom: 8 })
      this.tableHeader(['报警 / 设备', '状态', '内容', '操作'])
      if (this.bundle.operations.alarms.filter((alarm: AlarmRecord) => alarm.status === 'OPEN').length === 0) {
        this.emptyState('当前没有开放报警。')
      } else {
        ForEach(this.bundle.operations.alarms.filter((alarm: AlarmRecord) => alarm.status === 'OPEN'), (alarm: AlarmRecord) => {
          Row({ space: 10 }) {
            Column() {
              Text(alarm.alarmId + ' · ' + alarm.alarmType).fontSize(11).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
              Text(alarm.deviceCode + ' · ' + alarm.message).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            StateBadge({ status: alarm.status, label: alarm.status })
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectAlarm(alarm))
            Button('确认报警').enabled(this.canWrite(PERMISSION_INCIDENT_DISPOSE)).fontColor('#FFFFFF').backgroundColor(this.canWrite(PERMISSION_INCIDENT_DISPOSE) ? Theme.blue : Theme.neutral).onClick(() => this.confirmAction('确认报警', '确认只代表管理人员已知晓，后端仍记录操作者并校验权限。', () => void this.acknowledgeAlarm(alarm)))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (alarm: AlarmRecord) => alarm.alarmId)
      }
      Text('写操作状态：' + (this.canWrite(PERMISSION_INCIDENT_DISPOSE) ? '可提交到后端' : this.writeDisabledReason(PERMISSION_INCIDENT_DISPOSE))).fontSize(10).fontColor(this.canWrite(PERMISSION_INCIDENT_DISPOSE) ? Theme.success : Theme.warning).margin({ top: 10 })
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  deviceView() {
    Column() {
      SectionTitle({ code: 'EQUIPMENT', title: '设备管理', description: '查看档案、在线态、维护状态和参数模板归属。' })
      this.tableHeader(['设备 / 工位', '状态', '数据源', '速度', '操作'])
      if (this.filteredDevices().length === 0) {
        this.emptyState('没有匹配的设备。')
      } else {
        ForEach(this.filteredDevices().slice(this.pageStart(), this.pageEnd(this.filteredDevices().length)), (device: RuntimeDevice) => {
          Row() {
            Column() {
              Text(device.deviceCode).fontSize(12).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
              Text(this.stageName(device.stageCode)).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).width(210)
            StateBadge({ status: device.state, label: device.state })
            Text(device.source + (device.fallback ? ' · fallback' : '')).fontSize(10).fontColor(Theme.muted).width(150)
            Text('速度 ' + (device.speedMps === undefined ? '--' : device.speedMps.toString()) + ' m/s').fontSize(10).fontColor(Theme.text).layoutWeight(1)
            Button('档案').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectDevice(device))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (device: RuntimeDevice) => device.deviceCode)
        this.pager(this.filteredDevices().length)
      }
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  liveIoView() {
    Column({ space: 14 }) {
      Row() {
        Column() {
          Text('ENTERPRISE DEVICE LINK').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('现场 PLC 与 MQTT').fontSize(20).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 5 })
          Text('四路设备状态由 PLC 只读上报；灯位控制经后端权限校验后发送到现场 Broker。')
            .fontSize(10).fontColor(Theme.muted).margin({ top: 6 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        StateBadge({ status: this.livePlc.mqttConnected ? 'RUNNING' : 'FAILED',
          label: this.livePlc.mqttConnected ? 'MQTT CONNECTED' : 'MQTT OFFLINE' })
        StateBadge({ status: this.livePlc.online ? 'RUNNING' : 'WAIT',
          label: this.livePlc.online ? 'PLC ONLINE' : 'PLC WAITING' }).margin({ left: 8 })
      }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })

      Row({ space: 12 }) {
        this.liveFact('Broker', '192.168.1.200:1883', this.livePlc.mqttConnected ? '已连接' : '未连接')
        this.liveFact('适配器 SN', this.livePlc.adapterSn || '--',
          this.livePlc.version ? '固件 ' + this.livePlc.version : '等待版本')
        this.liveFact('适配器地址', this.livePlc.adapterIp || '--', this.livePlc.protocolType || 'MQTT')
        this.liveFact('最后心跳', this.livePlc.lastSeenAt || '--', this.livePlc.online ? '数据新鲜' : '数据超时')
      }.width('100%')

      Column() {
        SectionTitle({ code: 'PLC INPUT', title: 'PLC 四路设备状态', description: '物理设备输入，只读；顺序由企业协议固定映射。' })
        Row({ space: 10 }) {
          ForEach(this.livePlc.switchDevices, (deviceCode: string, index: number) => {
            Column() {
              Row({ space: 7 }) {
                Circle().width(8).height(8).fill(this.plcSwitchAt(index) === 1 ? Theme.success : Theme.neutral)
                Text(this.plcSwitchAt(index) === 1 ? 'RUNNING' : 'STANDBY').fontSize(9)
                  .fontColor(this.plcSwitchAt(index) === 1 ? Theme.success : Theme.muted).fontWeight(FontWeight.Bold)
              }.width('100%')
              Text(this.plcSwitchNameAt(index)).fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 10 })
              Text(deviceCode).fontSize(10).fontColor(Theme.blue).margin({ top: 5 })
              Text('PLC INPUT ' + index.toString()).fontSize(9).fontColor(Theme.muted).margin({ top: 12 })
            }.layoutWeight(1).height(118).padding(14).alignItems(HorizontalAlign.Start)
              .backgroundColor(Theme.panelSoft)
              .border({ width: 1, color: this.plcSwitchAt(index) === 1 ? Theme.success : Theme.line })
          }, (deviceCode: string) => deviceCode)
        }.width('100%').margin({ top: 12 })
      }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })

      Column() {
        SectionTitle({ code: 'PLC OUTPUT', title: '现场灯位控制', description: '仅展示 PLC 实际上报的灯位数量；发送后以设备回报为最终状态。' })
        if (this.livePlc.lamps.length === 0) {
          this.emptyState('PLC 尚未上报灯位状态。')
        } else {
          Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
            ForEach(this.livePlc.lamps, (lamp: number, index: number) => {
              Row() {
                Column() {
                  Text('LAMP ' + (index + 1).toString()).fontSize(10).fontColor(Theme.muted)
                  Text(lamp === 1 ? '已点亮' : '已熄灭').fontSize(14)
                    .fontColor(lamp === 1 ? Theme.warning : Theme.text).fontWeight(FontWeight.Bold).margin({ top: 5 })
                }.alignItems(HorizontalAlign.Start).layoutWeight(1)
                Button(lamp === 1 ? '熄灭' : '点亮').type(ButtonType.Normal).height(34).fontSize(10)
                  .enabled(this.canWrite(PERMISSION_DEVICE_CONTROL) && this.livePlc.online && !this.livePlcLoading)
                  .fontColor('#FFFFFF').backgroundColor(lamp === 1 ? Theme.neutral : Theme.blue)
                  .onClick(() => this.confirmAction(lamp === 1 ? '确认熄灭现场灯位' : '确认点亮现场灯位',
                    '该命令会发送到真实 PLC，最终状态以设备回报为准。',
                    () => void this.setLiveLamp(index, lamp === 1 ? 0 : 1)))
              }.width(260).height(72).padding(12).margin({ right: 10, bottom: 10 })
                .backgroundColor(Theme.panelSoft).border({ width: 1, color: lamp === 1 ? Theme.warning : Theme.line })
            }, (lamp: number, index: number) => index.toString())
          }.width('100%').margin({ top: 12 })
        }
        Text(this.livePlcMessage).fontSize(10).fontColor(this.livePlc.online ? Theme.success : Theme.warning)
          .width('100%').padding(10).backgroundColor(Theme.panelSoft).margin({ top: 4 })
      }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })
    }.width('100%')
  }

  @Builder
  liveFact(label: string, value: string, note: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.muted)
      Text(value).fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 7 })
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(note).fontSize(9).fontColor(Theme.blue).margin({ top: 6 })
    }.layoutWeight(1).height(86).padding(12).alignItems(HorizontalAlign.Start)
      .backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })
  }

  private plcSwitchAt(index: number): number {
    return index < this.livePlc.switches.length ? this.livePlc.switches[index] : 0
  }

  private plcSwitchNameAt(index: number): string {
    return index < this.livePlc.switchNames.length ? this.livePlc.switchNames[index] : '设备 ' + (index + 1).toString()
  }

  @Builder
  materialView() {
    Column() {
      SectionTitle({ code: 'MATERIAL TRACE', title: '产品与物料', description: '追踪号、瓶型、质量事件、箱码和库位。' })
      this.tableHeader(['追踪号', '瓶型', '质量事件', '箱码', '操作'])
      if (this.filteredRuns().length === 0) {
        this.emptyState('没有匹配的产品或物料。')
      } else {
        ForEach(this.filteredRuns().slice(this.pageStart(), this.pageEnd(this.filteredRuns().length)), (run: FactoryRun) => {
          Row() {
            Text(run.traceCode).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold).width(190)
            Text(run.bottleType || '待识别').fontSize(10).fontColor(Theme.text).width(95)
            Text(run.defectType || '无质量事件').fontSize(10).fontColor(run.defectType === undefined ? Theme.muted : Theme.danger).layoutWeight(1)
            Text(run.boxCode || '--').fontSize(10).fontColor(Theme.muted).width(120)
            Button('追溯').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectProduct(run))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (run: FactoryRun) => run.traceCode)
        this.pager(this.filteredRuns().length)
      }
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  logisticsView() {
    Column() {
      SectionTitle({ code: 'LOGISTICS & WMS', title: '物流仓储', description: '这里作为管理菜单，负责任务、库存、库位和仓区安全查询。' })
      Row({ space: 8 }) {
        Button('新建 AGV 调度').enabled(false).fontColor('#FFFFFF').backgroundColor(Theme.neutral)
        Text('不可用：当前端点仅支持创建任务，尚缺车辆候选、优先级、冲突校验和服务端审计字段。').fontSize(10).fontColor(Theme.warning)
      }.width('100%').margin({ top: 8 })
        Text('AGV 任务').fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 10, bottom: 8 })
      this.tableHeader(['任务 / 车辆 / 箱码', '状态', '速度 / 避障', '操作'])
      if (this.filteredAgvTasks().length === 0) {
        this.emptyState('没有匹配的 AGV 任务。')
      } else {
        ForEach(this.filteredAgvTasks().slice(this.pageStart(), this.pageEnd(this.filteredAgvTasks().length)), (task: AgvTask) => {
          Row() {
            Text(task.taskId).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold).width(150)
            Text(task.agvCode + ' · ' + task.boxCode).fontSize(10).fontColor(Theme.text).width(180)
            StateBadge({ status: task.status, label: task.status })
            Text('速度 ' + task.speedMps.toString() + ' m/s · 避障 ' + task.obstacleDistanceCm.toString() + ' cm').fontSize(10).fontColor(Theme.muted).layoutWeight(1)
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectedDetail = this.taskDetail(task))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (task: AgvTask) => task.taskId)
        this.pager(this.filteredAgvTasks().length)
      }
      Text('仓区安全与库存').fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 18, bottom: 8 })
      this.tableHeader(['仓区', '状态', '环境读数'])
      if (this.bundle.logistics.zones.length === 0 && this.bundle.logistics.stock.length === 0) {
        this.emptyState('当前没有仓区安全或箱级库存数据。')
      } else {
        ForEach(this.bundle.logistics.zones, (zone: WarehouseZone) => {
          Row() {
            Text(zone.zoneCode).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold).width(110)
            StateBadge({ status: zone.status === 'SAFE' ? 'PASS' : 'FAIL', label: zone.status })
            Text('VOC ' + zone.vocPpm.toString() + ' ppm · 烟雾 ' + zone.smoke.toString() + '% · 温度 ' + zone.temperatureC.toString() + ' °C').fontSize(10).fontColor(Theme.muted).layoutWeight(1)
          }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line })
        }, (zone: WarehouseZone) => zone.zoneCode)
        ForEach(this.bundle.logistics.stock, (stock: StockItem) => {
          Row() {
            Text(stock.boxCode).fontSize(10).fontColor(Theme.blue).width(150)
            Text(stock.bottleType).fontSize(10).fontColor(Theme.text).width(110)
            Text(stock.zoneCode + ' / ' + stock.locationCode).fontSize(10).fontColor(Theme.muted).layoutWeight(1)
            Text(stock.status).fontSize(10).fontColor(statusColor(stock.status))
          }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line })
        }, (stock: StockItem) => stock.boxCode)
      }
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  aiAuditView() {
    AiDecisionAuditPanel({ query: this.query, filter: this.filter, stateVersion: this.currentStateVersion() })
  }

  @Builder
  aiConfigView() {
    Column({ space: 14 }) {
      SectionTitle({ code: 'AI MANAGEMENT', title: 'AI 模型与 RAG 配置', description: '管理供应商、模型、Key、超时、流式、RAG 和连接测试；不属于共享助手会话。' })
      this.aiConfigState()
      this.aiModelForm()
      this.aiConnectionTestPanel()
      this.aiRagStatusPanel()
      if (this.aiConfigMessage.length > 0) {
        Text(this.aiConfigMessage).fontSize(10).fontColor(this.aiConfigAvailable ? Theme.warning : Theme.danger).width('100%').padding(10).backgroundColor(this.aiConfigAvailable ? Theme.warningSoft : Theme.dangerSoft)
      }
    }.width('100%').alignItems(HorizontalAlign.Start).padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  aiConfigState() {
    Row({ space: 10 }) {
      StateBadge({ status: this.aiConfigAvailable ? 'PASS' : 'FAILED', label: this.aiConfigAvailable ? '配置已加载' : '接口未就绪' })
      Text('AI 中枢：' + AiCenterConfig.API_BASE).fontSize(9).fontColor(Theme.muted).layoutWeight(1)
      Button('刷新配置').height(34).backgroundColor(Theme.blue).fontColor('#FFFFFF').onClick(() => void this.loadAiModelConfig())
      Button('选择配置').height(34).fontColor(Theme.blue).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line }).onClick(() => this.selectAiConfig())
    }.width('100%')
    if (this.aiConfigLoading) {
      Row({ space: 8 }) {
        LoadingProgress().width(18).height(18).color(Theme.blue)
        Text('正在访问 AI 中枢配置接口...').fontSize(10).fontColor(Theme.muted)
      }.width('100%').padding(8).backgroundColor(Theme.panelSoft)
    }
  }

  @Builder
  aiModelForm() {
    Column({ space: 10 }) {
      Text('模型配置').fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      Row({ space: 8 }) {
        TextInput({ text: this.aiProvider, placeholder: '供应商，例如 OpenAI / DeepSeek / 本地模型' }).layoutWeight(1).onChange((value: string) => this.aiProvider = value)
        TextInput({ text: this.aiModelName, placeholder: '模型名称，例如 gpt-4.1 / deepseek-chat' }).layoutWeight(1).onChange((value: string) => this.aiModelName = value)
        TextInput({ text: this.aiBaseUrl, placeholder: 'baseUrl，例如 https://api.xxx.com/v1' }).layoutWeight(1).onChange((value: string) => this.aiBaseUrl = value)
      }.width('100%')
      Row({ space: 8 }) {
        Column() {
          Text('当前 Key：' + (this.aiMaskedApiKey.length > 0 ? this.aiMaskedApiKey : '未设置或接口未返回')).fontSize(10).fontColor(Theme.muted)
          TextInput({ text: this.aiApiKeyInput, placeholder: '填写新 API Key 才会更新；留空表示不变' })
            .type(InputType.Password)
            .width('100%')
            .onChange((value: string) => this.aiApiKeyInput = value)
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        TextInput({ text: this.aiTimeoutMs, placeholder: '请求超时 ms' }).width(130).onChange((value: string) => this.aiTimeoutMs = value)
        TextInput({ text: this.aiRetryCount, placeholder: '重试次数' }).width(110).onChange((value: string) => this.aiRetryCount = value)
      }.width('100%').alignItems(VerticalAlign.Bottom)
      Row({ space: 8 }) {
        TextInput({ text: this.aiMaxTokens, placeholder: '最大 token' }).width(130).onChange((value: string) => this.aiMaxTokens = value)
        TextInput({ text: this.aiTemperature, placeholder: '温度 0-2' }).width(130).onChange((value: string) => this.aiTemperature = value)
        Button('流式：' + (this.aiStreamEnabled ? '开启' : '关闭')).fontColor('#FFFFFF').backgroundColor(this.aiStreamEnabled ? Theme.success : Theme.neutral).onClick(() => this.aiStreamEnabled = !this.aiStreamEnabled)
        Button('RAG：' + (this.aiRagEnabled ? '开启' : '关闭')).fontColor('#FFFFFF').backgroundColor(this.aiRagEnabled ? Theme.success : Theme.neutral).onClick(() => this.aiRagEnabled = !this.aiRagEnabled)
        Text(this.aiConfigUpdatedAt.length > 0 ? '最近更新：' + this.aiConfigUpdatedAt : '等待 AI 中枢返回配置版本').fontSize(9).fontColor(Theme.muted).layoutWeight(1)
      }.width('100%')
      Row({ space: 8 }) {
        TextInput({ text: this.aiVectorStore, placeholder: '向量库，例如 Milvus / pgvector / Chroma' }).layoutWeight(1).onChange((value: string) => this.aiVectorStore = value)
        TextInput({ text: this.aiEmbeddingModel, placeholder: 'Embedding 模型' }).layoutWeight(1).onChange((value: string) => this.aiEmbeddingModel = value)
        TextInput({ text: this.aiKnowledgeVersion, placeholder: '当前知识版本（只读展示）' }).layoutWeight(1).enabled(false)
      }.width('100%')
      Row({ space: 10 }) {
        Button('保存 AI 配置')
          .enabled(this.canManageAiConfig() && !this.aiConfigLoading)
          .fontColor('#FFFFFF')
          .backgroundColor(this.canManageAiConfig() ? Theme.blue : Theme.neutral)
          .onClick(() => this.confirmAction('确认保存 AI 配置', '配置将提交到 AI 中枢/后端配置 API；API Key 不会明文回显，留空表示沿用现有 Key。', () => void this.saveAiModelConfig()))
        Text(this.canManageAiConfig() ? '具备 SYSTEM_MANAGE 权限' : '保存需要 ADMIN、非演示账号且后端在线。').fontSize(10).fontColor(this.canManageAiConfig() ? Theme.success : Theme.warning)
      }.width('100%')
    }.width('100%').padding(12).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }

  @Builder
  aiConnectionTestPanel() {
    Column({ space: 8 }) {
      Text('测试连接 / 测试问答').fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      TextArea({ text: this.aiTestQuestion, placeholder: '输入一条用于诊断的测试问题' }).height(68).width('100%').onChange((value: string) => this.aiTestQuestion = value)
      Row({ space: 10 }) {
        Button('测试连接').enabled(this.canManageAiConfig() && !this.aiConfigLoading).fontColor('#FFFFFF').backgroundColor(this.canManageAiConfig() ? Theme.blue : Theme.neutral).onClick(() => void this.testAiConnection())
        StateBadge({ status: this.aiTestStatus, label: this.aiTestStatus })
        Text('失败会明确区分鉴权、超时、模型不可用、速率限制、RAG 未就绪或接口未实现。').fontSize(10).fontColor(Theme.muted).layoutWeight(1)
      }.width('100%')
      Text(this.aiTestResult).fontSize(10).fontColor(this.aiTestStatus === 'PASS' ? Theme.success : this.aiTestStatus === 'WAIT' ? Theme.muted : Theme.danger).width('100%').padding(10).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })
    }.width('100%').padding(12).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }

  @Builder
  aiRagStatusPanel() {
    Column({ space: 8 }) {
      Text('文档 / RAG 运维状态').fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      Row() {
        Text('RAG 开关').fontSize(10).fontColor(Theme.muted).width(120)
        StateBadge({ status: this.aiRagEnabled ? 'PASS' : 'WAIT', label: this.aiRagEnabled ? 'ENABLED' : 'DISABLED' })
        Text('向量库：' + (this.aiVectorStore.length > 0 ? this.aiVectorStore : '--')).fontSize(10).fontColor(Theme.text).layoutWeight(1).margin({ left: 12 })
      }.width('100%').padding(9).border({ width: { bottom: 1 }, color: Theme.line })
      Row() {
        Text('Embedding').fontSize(10).fontColor(Theme.muted).width(120)
        Text(this.aiEmbeddingModel.length > 0 ? this.aiEmbeddingModel : '--').fontSize(10).fontColor(Theme.text).layoutWeight(1)
      }.width('100%').padding(9).border({ width: { bottom: 1 }, color: Theme.line })
      Row() {
        Text('知识版本').fontSize(10).fontColor(Theme.muted).width(120)
        Text(this.aiKnowledgeVersion.length > 0 ? this.aiKnowledgeVersion : '等待 AI 中枢返回已发布版本').fontSize(10).fontColor(Theme.text).layoutWeight(1)
      }.width('100%').padding(9).border({ width: { bottom: 1 }, color: Theme.line })
      Text('资料上传、解析预览、审核、拒绝、撤销、索引进度和失败原因在“知识资料”页面处理；只有 INDEXED 且未 REVOKED 的版本才允许参与 RAG。').fontSize(10).fontColor(Theme.muted).width('100%')
      Button('进入知识资料管理').fontColor('#FFFFFF').backgroundColor(Theme.blue).onClick(() => this.selectSection('KNOWLEDGE'))
    }.width('100%').padding(12).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }

  @Builder
  knowledgeView() {
    KnowledgeGovernance({ query: this.query, filter: this.filter, stateVersion: this.currentStateVersion() })
  }

  @Builder
  userView() {
    Column() {
      SectionTitle({ code: 'ACCESS CONTROL', title: '用户权限', description: 'ADMIN 管理账号、角色和状态；后端仍执行真实鉴权。' })
      this.tableHeader(['账号 / 最近登录', '角色', '状态', '操作'])
      if (!SessionStore.isAdmin) {
        this.noAccessView()
      } else if (this.filteredUsers().length === 0) {
        this.emptyState('没有匹配的用户。')
      } else {
        ForEach(this.filteredUsers().slice(this.pageStart(), this.pageEnd(this.filteredUsers().length)), (user: AuthUser) => {
          Row() {
            Column() {
              Text(user.username).fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
              Text(user.displayName + ' · ' + (user.lastLoginAt || '未记录登录时间')).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            Text(user.role).fontSize(10).fontColor(Theme.blue).fontWeight(FontWeight.Bold).width(90)
            StateBadge({ status: user.status === 'ACTIVE' ? 'PASS' : 'WAIT', label: user.status })
            Button('切换角色').enabled(this.canWrite(PERMISSION_USER_MANAGE)).fontColor('#FFFFFF').backgroundColor(this.canWrite(PERMISSION_USER_MANAGE) ? Theme.blue : Theme.neutral).onClick(() => this.confirmAction('确认修改用户角色', '提交后由后端记录权限变更审计。', () => void this.updateUser(user)))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (user: AuthUser) => user.id.toString())
        this.pager(this.filteredUsers().length)
      }
      Text('写操作状态：' + (this.canWrite(PERMISSION_USER_MANAGE) ? '可提交到后端' : this.writeDisabledReason(PERMISSION_USER_MANAGE))).fontSize(10).fontColor(this.canWrite(PERMISSION_USER_MANAGE) ? Theme.success : Theme.warning).margin({ top: 10 })
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  settingsView() {
    Column() {
      SectionTitle({ code: 'SYSTEM CONFIG', title: '系统配置', description: '展示阈值和策略版本；没有正式契约前不发送配置写入。' })
      this.tableHeader(['策略 / 版本', '当前值', '状态', '操作'])
      ForEach(SYSTEM_POLICIES, (policy: SystemPolicy) => {
        Row() {
          Column() {
            Text(policy.name).fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
            Text(policy.policyCode + ' · ' + policy.version + ' · ' + policy.updatedAt).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Text(policy.value + ' ' + policy.unit).fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).width(100)
          StateBadge({ status: policy.status === 'ACTIVE' ? 'PASS' : 'WAIT', label: policy.status })
          Button('查看').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectPolicy(policy))
        }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
      }, (policy: SystemPolicy) => policy.policyCode)
      Text('后端地址：' + ApiConfig.API_BASE).fontSize(10).fontColor(Theme.muted).margin({ top: 14 })
      Text('实时地址：' + ApiConfig.WS_BASE).fontSize(10).fontColor(Theme.muted).margin({ top: 6 })
      Text('阈值管理角色：' + (hasPermission(this.currentRole(), PERMISSION_THRESHOLD_MANAGE) ? '角色满足' : '需要 ENGINEER 或 ADMIN')).fontSize(10).fontColor(hasPermission(this.currentRole(), PERMISSION_THRESHOLD_MANAGE) ? Theme.success : Theme.warning).margin({ top: 12 })
      Button('提交策略版本变更').enabled(false).fontColor('#FFFFFF').backgroundColor(Theme.neutral).margin({ top: 10 })
      Text('按钮禁用原因：P0 已定义 /config/thresholds 与发布端点，但当前后端分支尚未实现；管理端不伪造配置成功。').fontSize(10).fontColor(Theme.warning).margin({ top: 8 })
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  auditView() {
    Column() {
      SectionTitle({ code: 'OPERATION AUDIT', title: '操作审计', description: '记录谁在何时做了什么、目标、结果和失败原因。' })
      if (this.auditError.length > 0) {
        Text('服务端审计不可用：' + this.auditError + '。目标端点为 GET /audit/operations。').fontSize(10).fontColor(Theme.warning).width('100%').padding(10).backgroundColor(Theme.warningSoft).margin({ bottom: 10 })
      }
      this.tableHeader(['动作 / 时间', '操作者', '目标', '结果', '操作'])
      if (this.filteredAuditRecords().length === 0) {
        this.emptyState('没有可验证的服务端操作审计记录。')
      } else {
        ForEach(this.filteredAuditRecords().slice(this.pageStart(), this.pageEnd(this.filteredAuditRecords().length)), (record: AdminAuditRecord) => {
          Row() {
            Column() {
              Text(record.action).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold)
              Text(record.auditId + ' · ' + record.occurredAt).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).width(260)
            Text(record.actor).fontSize(10).fontColor(Theme.blue).width(140)
            Text(record.target).fontSize(10).fontColor(Theme.muted).layoutWeight(1)
            StateBadge({ status: record.result, label: record.result })
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectAuditRecord(record))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (record: AdminAuditRecord) => record.auditId)
        this.pager(this.filteredAuditRecords().length)
      }
      Text('本机操作尝试（不是服务端审计）').fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 16, bottom: 8 })
      if (this.clientActivity.length === 0) {
        this.emptyState('本次会话尚无写操作尝试。')
      } else {
        ForEach(this.clientActivity, (record: AdminAuditRecord) => {
          Row() {
            Text(record.action).fontSize(10).fontColor(Theme.text).width(160)
            Text(record.target).fontSize(10).fontColor(Theme.muted).layoutWeight(1)
            StateBadge({ status: record.result, label: record.result })
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectAuditRecord(record))
          }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line })
        }, (record: AdminAuditRecord) => record.auditId)
      }
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  noAccessView() {
    Column() {
      Text('无权限访问').fontSize(20).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
      Text('当前账号为 ' + this.roleName() + '，该模块需要 ' + this.currentMenu().minRole + ' 权限。').fontSize(12).fontColor(Theme.muted).margin({ top: 8 })
      Text('前端已拦截入口，后端接口仍会执行最终鉴权。').fontSize(10).fontColor(Theme.warning).margin({ top: 8 })
    }.width('100%').padding(24).alignItems(HorizontalAlign.Start).backgroundColor(Theme.panel).border({ width: { left: 4, top: 1, right: 1, bottom: 1 }, color: Theme.danger })
  }

  private filteredRuns(): Array<FactoryRun> {
    const keyword: string = this.query.trim()
    return this.bundle.dashboard.runs.filter((run: FactoryRun) => {
      const text: string = run.traceCode + ' ' + (run.batchCode || '') + ' ' + (run.bottleType || '') + ' ' + run.currentStage + ' ' + (run.boxCode || '') + ' ' + (run.defectType || '')
      return (keyword.length === 0 || this.contains(text, keyword)) && this.filterMatches(run.status)
    })
  }

  private filteredDevices(): Array<RuntimeDevice> {
    const keyword: string = this.query.trim()
    return this.bundle.runtime.devices.filter((device: RuntimeDevice) => {
      const text: string = device.deviceCode + ' ' + device.stageCode + ' ' + device.state + ' ' + device.source
      return (keyword.length === 0 || this.contains(text, keyword)) && this.filterMatches(device.state)
    })
  }

  private filteredIncidents(): Array<FactoryIncident> {
    const keyword: string = this.query.trim()
    return this.incidents.filter((incident: FactoryIncident) => {
      const text: string = incident.incidentId + ' ' + incident.stageCode + ' ' + (incident.deviceCode || '') + ' ' + incident.strategy + ' ' + incident.message
      return (keyword.length === 0 || this.contains(text, keyword)) && this.filterMatches(incident.status)
    })
  }

  private filteredAgvTasks(): Array<AgvTask> {
    const keyword: string = this.query.trim()
    return this.bundle.logistics.tasks.filter((task: AgvTask) => {
      const text: string = task.taskId + ' ' + task.agvCode + ' ' + task.boxCode + ' ' + task.status + ' ' + task.source + ' ' + task.destination
      return (keyword.length === 0 || this.contains(text, keyword)) && this.filterMatches(task.status)
    })
  }

  private filteredAiAudits(): Array<AiAudit> {
    const keyword: string = this.query.trim()
    return this.bundle.operations.aiAudits.filter((audit: AiAudit) => {
      const text: string = audit.auditId + ' ' + audit.traceCode + ' ' + audit.bottleType + ' ' + audit.stage + ' ' + audit.knowledgeVersion + ' ' + audit.decision + ' ' + audit.validationStatus
      return (keyword.length === 0 || this.contains(text, keyword)) && this.filterMatches(audit.validationStatus)
    })
  }

  private filteredUsers(): Array<AuthUser> {
    const keyword: string = this.query.trim()
    return this.users.filter((user: AuthUser) => {
      const text: string = user.username + ' ' + user.displayName + ' ' + user.role + ' ' + user.status
      return (keyword.length === 0 || this.contains(text, keyword)) && this.filterMatches(user.status)
    })
  }

  private filteredAuditRecords(): Array<AdminAuditRecord> {
    const keyword: string = this.query.trim()
    return this.auditRecords.filter((record: AdminAuditRecord) => {
      const text: string = record.auditId + ' ' + record.actor + ' ' + record.action + ' ' + record.target + ' ' + record.result + ' ' + record.message
      return (keyword.length === 0 || this.contains(text, keyword)) && this.filterMatches(record.result)
    })
  }

  private stageState(code: string): string {
    let state: string = 'UNKNOWN'
    this.bundle.runtime.stages.forEach((stage: RuntimeStage) => {
      if (stage.stageCode === code) state = stage.state
    })
    return state
  }

  private currentStateVersion(): number {
    return this.bundle.runtime.stateVersion === undefined ? 0 : this.bundle.runtime.stateVersion
  }

  private assistantPageRoute(): string {
    return 'AdminConsole/' + this.section
  }

  private navigateAssistantEntity(entity: AssistantEntityRef): AssistantNavigationResult {
    const entityType: string = entity.entityType
    const entityId: string = entity.entityId
    if (entityType === AssistantEntityType.DEVICE) {
      let target: RuntimeDevice | undefined = undefined
      this.bundle.runtime.devices.forEach((device: RuntimeDevice) => {
        if (device.deviceCode === entityId) target = device
      })
      this.selectSection('DEVICES')
      if (target !== undefined) {
        this.selectDevice(target)
        return { handled: true }
      }
      this.message = '助手引用的设备不存在或当前角色不可见：' + entityId
      return { handled: false, reason: this.message }
    }
    if (entityType === AssistantEntityType.PRODUCT) {
      let target: FactoryRun | undefined = undefined
      this.bundle.dashboard.runs.forEach((run: FactoryRun) => {
        if (run.traceCode === entityId) target = run
      })
      this.selectSection('MATERIALS')
      if (target !== undefined) {
        this.selectProduct(target)
        return { handled: true }
      }
      this.message = '助手引用的产品追踪号不存在或当前角色不可见：' + entityId
      return { handled: false, reason: this.message }
    }
    if (entityType === AssistantEntityType.ALARM) {
      let target: AlarmRecord | undefined = undefined
      this.bundle.operations.alarms.forEach((alarm: AlarmRecord) => {
        if (alarm.alarmId === entityId) target = alarm
      })
      this.selectSection('INCIDENTS')
      if (target !== undefined) {
        this.selectAlarm(target)
        return { handled: true }
      }
      this.message = '助手引用的报警不存在或当前角色不可见：' + entityId
      return { handled: false, reason: this.message }
    }
    if (entityType === AssistantEntityType.CONFIG) {
      if (entityId === 'AI_MODEL_CONFIG') {
        this.selectSection('AI_CONFIG')
        this.selectAiConfig()
        return { handled: true }
      }
      let target: SystemPolicy | undefined = undefined
      SYSTEM_POLICIES.forEach((policy: SystemPolicy) => {
        if (policy.policyCode === entityId) target = policy
      })
      this.selectSection('SETTINGS')
      if (target !== undefined) {
        this.selectPolicy(target)
        return { handled: true }
      }
      this.message = '助手引用的配置不存在或当前角色不可见：' + entityId
      return { handled: false, reason: this.message }
    }
    if (entityType === AssistantEntityType.AUDIT) {
      let auditRecord: AdminAuditRecord | undefined = undefined
      this.auditRecords.concat(this.clientActivity).forEach((record: AdminAuditRecord) => {
        if (record.auditId === entityId) auditRecord = record
      })
      if (auditRecord !== undefined) {
        this.selectSection('AUDIT')
        this.selectAuditRecord(auditRecord)
        return { handled: true }
      }
      let aiAudit: AiAudit | undefined = undefined
      this.bundle.operations.aiAudits.forEach((audit: AiAudit) => {
        if (audit.auditId === entityId) aiAudit = audit
      })
      this.selectSection('AI_AUDIT')
      if (aiAudit !== undefined) {
        this.selectedDetail = this.aiDetail(aiAudit)
        return { handled: true }
      }
      this.message = '助手引用的审计记录不存在或当前角色不可见：' + entityId
      return { handled: false, reason: this.message }
    }
    if (entityType === AssistantEntityType.KNOWLEDGE_DOCUMENT) {
      this.selectSection('KNOWLEDGE')
      this.selectedDetail = '知识资料：' + entityId + '\n已定位到知识资料页面。资料预览和审核仍必须在后台业务页面中执行，助手不能替代审批。'
      return { handled: true }
    }
    this.message = '当前后台暂不支持定位该助手引用：' + entityId
    return { handled: false, reason: this.message }
  }

  private selectProduct(run: FactoryRun): void {
    this.selectedDetail = this.runDetail(run)
    const selection = createAdminSelection(
      'PRODUCT',
      run.traceCode,
      run.traceCode + ' · ' + (run.bottleType || run.status),
      'AdminConsole/MATERIALS',
      this.currentStateVersion(),
      [
        assistantField('traceCode', run.traceCode),
        assistantField('stageCode', run.currentStage),
        assistantField('status', run.status),
        assistantField('updatedAt', run.updatedAt || ''),
        assistantField('source', this.dataSourceLabel())
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  private selectDevice(device: RuntimeDevice): void {
    this.selectedDetail = this.deviceDetail(device)
    const selection = createAdminSelection(
      'DEVICE',
      device.deviceCode,
      device.deviceCode + ' · ' + device.state,
      'AdminConsole/DEVICES',
      this.currentStateVersion(),
      [
        assistantField('deviceCode', device.deviceCode),
        assistantField('stageCode', device.stageCode),
        assistantField('status', device.state),
        assistantField('source', device.source),
        assistantField('occurredAt', device.occurredAt || '')
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  private selectAlarm(alarm: AlarmRecord): void {
    this.selectedDetail = '报警：' + alarm.alarmId + '\n类型：' + alarm.alarmType + '\n设备：' + alarm.deviceCode + '\n工序：' + (alarm.stage || '--') + '\n追踪号：' + (alarm.traceCode || '--') + '\n状态：' + alarm.status + '\n数值：' + (alarm.value === undefined ? '--' : alarm.value.toString() + ' ' + (alarm.unit || '')) + '\n阈值：' + (alarm.limitValue === undefined ? '--' : alarm.limitValue.toString()) + '\n说明：' + alarm.message + '\n时间：' + (alarm.occurredAt || '--')
    const selection = createAdminSelection(
      'ALARM',
      alarm.alarmId,
      alarm.alarmId + ' · ' + alarm.status,
      'AdminConsole/INCIDENTS',
      this.currentStateVersion(),
      [
        assistantField('deviceCode', alarm.deviceCode),
        assistantField('stageCode', alarm.stage || ''),
        assistantField('traceCode', alarm.traceCode || ''),
        assistantField('status', alarm.status),
        assistantField('occurredAt', alarm.occurredAt || '')
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  private selectPolicy(policy: SystemPolicy): void {
    this.selectedDetail = '配置：' + policy.policyCode + '\n名称：' + policy.name + '\n当前值：' + policy.value + ' ' + policy.unit + '\n版本：' + policy.version + '\n状态：' + policy.status + '\n更新时间：' + policy.updatedAt
    const selection = createAdminSelection(
      'CONFIGURATION',
      policy.policyCode,
      policy.name + ' · ' + policy.version,
      'AdminConsole/SETTINGS',
      this.currentStateVersion(),
      [
        assistantField('status', policy.status),
        assistantField('version', policy.version),
        assistantField('updatedAt', policy.updatedAt),
        assistantField('title', policy.name)
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  private selectAiConfig(): void {
    this.selectedDetail = 'AI 配置：AI_MODEL_CONFIG\n供应商：' + (this.aiProvider || '--') +
      '\n模型：' + (this.aiModelName || '--') +
      '\nbaseUrl：' + (this.aiBaseUrl || '--') +
      '\nAPI Key：' + (this.aiMaskedApiKey || '未设置或接口未返回') +
      '\n超时：' + this.aiTimeoutMs + ' ms' +
      '\n重试：' + this.aiRetryCount +
      '\n流式：' + (this.aiStreamEnabled ? '开启' : '关闭') +
      '\nRAG：' + (this.aiRagEnabled ? '开启' : '关闭') +
      '\n向量库：' + (this.aiVectorStore || '--') +
      '\n知识版本：' + (this.aiKnowledgeVersion || '--') +
      '\n说明：助手只能引用该配置状态，不能通过引用导航修改配置。'
    const selection = createAdminSelection(
      'CONFIGURATION',
      'AI_MODEL_CONFIG',
      'AI 模型配置 · ' + (this.aiModelName || '未加载'),
      'AdminConsole/AI_CONFIG',
      this.currentStateVersion(),
      [
        assistantField('provider', this.aiProvider),
        assistantField('modelName', this.aiModelName),
        assistantField('baseUrl', this.aiBaseUrl),
        assistantField('status', this.aiConfigAvailable ? 'LOADED' : 'UNAVAILABLE'),
        assistantField('knowledgeVersion', this.aiKnowledgeVersion),
        assistantField('updatedAt', this.aiConfigUpdatedAt)
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  private selectAuditRecord(record: AdminAuditRecord): void {
    this.selectedDetail = this.auditDetail(record)
    const selection = createAdminSelection(
      'AUDIT_RECORD',
      record.auditId,
      record.action + ' · ' + record.result,
      'AdminConsole/AUDIT',
      this.currentStateVersion(),
      [
        assistantField('result', record.result),
        assistantField('occurredAt', record.occurredAt),
        assistantField('title', record.action),
        assistantField('status', record.result)
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  private stageName(code: string): string {
    return code === 'COMPLETED' ? '已完成' : findStage(code).name
  }

  private openIncidentCount(): number {
    return this.bundle.runtime.incidents.filter((item: FactoryIncident) => item.status === 'OPEN').length
  }

  private openAlarmCount(): number {
    return this.bundle.operations.alarms.filter((item: AlarmRecord) => item.status === 'OPEN').length
  }

  private aiReviewCount(): number {
    return this.bundle.operations.aiAudits.filter((item: AiAudit) => item.validationStatus !== 'PASSED').length
  }

  private offlineDeviceCount(): number {
    return this.bundle.runtime.devices.filter((item: RuntimeDevice) => item.state === 'OFFLINE').length
  }

  private unsafeZoneCount(): number {
    return this.bundle.logistics.zones.filter((item: WarehouseZone) => item.status !== 'SAFE').length
  }

  private runDetail(run: FactoryRun): string {
    return '追踪号：' + run.traceCode + '\n批次：' + (run.batchCode || '--') + '\n瓶型：' + (run.bottleType || '--') + '\n当前工序：' + this.stageName(run.currentStage) + '\n状态：' + run.status + '\n箱码：' + (run.boxCode || '--') + '\nAGV：' + (run.agvTaskCode || '--') + '\n库位：' + (run.warehouseLocation || '--') + '\n更新时间：' + (run.updatedAt || '--')
  }

  private incidentDetail(incident: FactoryIncident): string {
    return '异常：' + incident.incidentId + '\n工序：' + this.stageName(incident.stageCode) + '\n设备：' + (incident.deviceCode || '--') + '\n策略：' + incident.strategy + '\n状态：' + incident.status + '\n目标工序：' + (incident.targetStage || '--') + '\n上游影响：' + (incident.upstreamImpact || '--') + '\n下游影响：' + (incident.downstreamImpact || '--') + '\n说明：' + incident.message
  }

  private deviceDetail(device: RuntimeDevice): string {
    const stage = findStage(device.stageCode)
    let role: string = '未配置'
    stage.devices.forEach((item) => {
      if (item.code === device.deviceCode) role = item.role
    })
    return '设备：' + device.deviceCode + '\n工序：' + stage.name + '\n职责：' + role + '\n状态：' + device.state + '\n数据源：' + device.source + '\n兜底：' + (device.fallback ? '是' : '否') + '\n速度：' + (device.speedMps === undefined ? '--' : device.speedMps.toString() + ' m/s') + '\n上报时间：' + (device.occurredAt || '--')
  }

  private taskDetail(task: AgvTask): string {
    return '任务：' + task.taskId + '\n车辆：' + task.agvCode + '\n箱码：' + task.boxCode + '\n起点：' + task.source + '\n终点：' + task.destination + '\n距离：' + task.completedDistanceM.toString() + ' / ' + task.totalDistanceM.toString() + ' m\n速度：' + task.speedMps.toString() + ' m/s\n负载：' + task.loadKg.toString() + ' kg\n超声波避障：' + task.obstacleDistanceCm.toString() + ' cm\n状态：' + task.status
  }

  private aiDetail(audit: AiAudit): string {
    return '审计号：' + audit.auditId + '\n追踪号：' + audit.traceCode + '\n瓶型：' + audit.bottleType + '\n工序：' + this.stageName(audit.stage) + '\nRAG 版本：' + audit.knowledgeVersion + '\n数据库校验：' + audit.validationStatus + '\n建议：' + audit.decision + '\n原因：' + audit.reason + '\n时间：' + audit.createdAt
  }

  private auditDetail(record: AdminAuditRecord): string {
    return '审计号：' + record.auditId + '\n操作者：' + record.actor + '\n动作：' + record.action + '\n目标：' + record.target + '\n结果：' + record.result + '\n说明：' + record.message + '\n时间：' + record.occurredAt
  }
}
