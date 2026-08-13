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
  AiModelConfigUpdate,
  AiProviderPreset
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
  { code: 'AI_CENTER', label: 'AI 中心', description: '模型连接、知识库治理和决策审计', minRole: 'VIEWER' },
  { code: 'USERS', label: '用户权限', description: '账号、角色和状态', minRole: 'ADMIN' },
  { code: 'SETTINGS', label: '系统配置', description: '阈值和策略版本', minRole: 'VIEWER' },
  { code: 'AUDIT', label: '操作审计', description: '用户操作和后端结果', minRole: 'VIEWER' }
]

const MENU_GROUPS: Array<MenuGroup> = [
  { label: '运营监控', items: MENU.filter((item: MenuItem) => item.code === 'DASHBOARD' || item.code === 'PRODUCTION' || item.code === 'INCIDENTS') },
  { label: '现场资产', items: MENU.filter((item: MenuItem) => item.code === 'DEVICES' || item.code === 'MATERIALS' || item.code === 'LOGISTICS') },
  { label: 'AI 治理', items: MENU.filter((item: MenuItem) => item.code === 'AI_CENTER') },
  { label: '系统管理', items: MENU.filter((item: MenuItem) => item.code === 'USERS' || item.code === 'SETTINGS' || item.code === 'AUDIT') }
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
  @State aiCenterTab: string = 'MODEL'
  @State aiProviders: Array<AiProviderPreset> = []
  @State aiProviderDescription: string = ''
  @State aiProviderRequiresKey: boolean = true
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
    if (this.section === 'AI_CENTER') await this.loadAiCenter()
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

  private async loadAiCenter(): Promise<void> {
    if (SessionStore.isDemo) {
      if (this.aiProviders.length > 0) return
      this.aiConfigLoading = true
      try {
        this.aiProviders = await aiCenterClient.listProviderPresets()
        this.aiProvider = 'LOCAL_DEMO'
        this.aiModelName = 'local-demo-assistant'
        this.aiBaseUrl = ''
        this.aiMaskedApiKey = ''
        this.aiConfigAvailable = false
        this.aiConfigMessage = '本地演示模式可查看厂商预设；保存 API Key 和真实模型测试需要登录 ADMIN。'
        this.syncSelectedProvider()
      } catch (error) {
        this.aiConfigMessage = '厂商预设暂不可用：' + (error instanceof Error ? error.message : 'AI 中枢请求失败')
      } finally {
        this.aiConfigLoading = false
      }
      return
    }
    this.aiConfigLoading = true
    this.aiConfigMessage = ''
    try {
      this.aiProviders = await aiCenterClient.listProviderPresets()
      await this.loadAiModelConfig()
      this.syncSelectedProvider()
    } catch (error) {
      this.aiConfigAvailable = false
      this.aiConfigMessage = 'AI 中心接口不可用：' + (error instanceof Error ? error.message : 'AI 中枢请求失败')
    } finally {
      this.aiConfigLoading = false
    }
  }

  private syncSelectedProvider(): void {
    let matched: boolean = false
    this.aiProviders.forEach((provider: AiProviderPreset) => {
      if (provider.provider === this.aiProvider.toUpperCase()) {
        matched = true
        this.aiProviderDescription = provider.description
        this.aiProviderRequiresKey = provider.requiresApiKey
      }
    })
    if (!matched) {
      this.aiProviderDescription = '当前配置未匹配预设，可继续使用自定义 OpenAI 兼容服务。'
      this.aiProviderRequiresKey = true
    }
  }

  private selectAiProvider(provider: AiProviderPreset): void {
    const changed: boolean = this.aiProvider !== provider.provider
    this.aiProvider = provider.provider
    this.aiProviderDescription = provider.description
    this.aiProviderRequiresKey = provider.requiresApiKey
    this.aiBaseUrl = provider.baseUrl
    if (provider.models.length > 0 && provider.models[0] !== '请输入模型名称') {
      this.aiModelName = provider.models[0]
    } else {
      this.aiModelName = ''
    }
    if (changed) {
      this.aiApiKeyInput = ''
      this.aiMaskedApiKey = ''
    }
    this.aiConfigMessage = '已选择 ' + provider.label + '，Base URL 和推荐模型已填入；仍可手动覆盖。'
  }

  private changeAiProvider(value: string): void {
    const changed: boolean = this.aiProvider !== value
    this.aiProvider = value
    this.syncSelectedProvider()
    if (changed) {
      this.aiApiKeyInput = ''
      this.aiMaskedApiKey = ''
    }
  }

  private selectAiModel(model: string): void {
    if (model !== '请输入模型名称') this.aiModelName = model
  }

  private currentProviderModels(): Array<string> {
    let models: Array<string> = []
    this.aiProviders.forEach((provider: AiProviderPreset) => {
      if (provider.provider === this.aiProvider.toUpperCase()) models = provider.models
    })
    return models
  }

  private selectAiCenterTab(tab: string): void {
    this.aiCenterTab = tab
    this.query = ''
    this.filter = 'ALL'
    this.pageIndex = 0
    if (tab === 'MODEL' && this.aiProviders.length === 0) void this.loadAiCenter()
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
    if (this.aiProvider.trim().length === 0 || this.aiModelName.trim().length === 0) {
      throw new Error('供应商和模型名称必填')
    }
    if (this.aiProvider.toUpperCase() !== 'LOCAL_DEMO' && this.aiBaseUrl.trim().length === 0) {
      throw new Error('非本地演示模式必须填写 baseUrl')
    }
    if (this.aiProviderRequiresKey && this.aiApiKeyInput.trim().length === 0 && this.aiMaskedApiKey.length === 0) {
      throw new Error('当前厂商需要填写 API Key')
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
    this.selectedDetail = this.currentMenu().description
    this.message = ''
    if (code === 'USERS' && SessionStore.isAdmin) void this.loadUsers()
    if (code === 'INCIDENTS') void this.loadIncidents()
    if (code === 'AI_CENTER') void this.loadAiCenter()
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
                if (!(this.section === 'AI_CENTER' && this.aiCenterTab === 'MODEL')) this.adminToolbar()
                this.loadingState()
                if (this.section === 'DASHBOARD') this.dashboardView()
                if (this.section === 'PRODUCTION') this.productionView()
                if (this.section === 'INCIDENTS') this.incidentView()
                if (this.section === 'DEVICES') this.deviceView()
                if (this.section === 'MATERIALS') this.materialView()
                if (this.section === 'LOGISTICS') this.logisticsView()
                if (this.section === 'AI_CENTER') this.aiCenterView()
                if (this.section === 'USERS') this.userView()
                if (this.section === 'SETTINGS') this.settingsView()
                if (this.section === 'AUDIT') this.auditView()
              }
              if (this.message.length > 0) {
                Text(this.message).fontSize(11).fontColor(Theme.danger).padding(12).width('100%').backgroundColor(Theme.dangerSoft).margin({ top: 12 })
              }
            }.width('100%').alignItems(HorizontalAlign.Start).padding(20)
          }.width('100%').layoutWeight(1).backgroundColor(Theme.page)
        }.layoutWeight(1).height('100%')
      }.width('100%').height('100%').backgroundColor(Theme.page)
      if (!SessionStore.isDemo) {
        AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
          .margin({ top: 18, right: 18 })
      }
    }.width('100%').height('100%').backgroundColor(Theme.page)
  }

  @Builder
  sidebar() {
    Column() {
      Text('BOTTLING / CONTROL').fontSize(10).fontColor('#9CC9E3').fontWeight(FontWeight.Bold)
      Text('管理控制台').fontSize(23).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 8 })
      Row({ space: 7 }) {
        Circle().width(7).height(7).fill('#6FD0A4')
        Text(this.roleName() + ' · ' + this.dataSourceLabel()).fontSize(10).fontColor('#C8DCE9')
      }.margin({ top: 14 })
      Divider().color('#45687F').margin({ top: 16, bottom: 12 })
      Scroll() {
        Column({ space: 13 }) {
          ForEach(MENU_GROUPS, (group: MenuGroup) => {
            Column({ space: 3 }) {
              Text(group.label).fontSize(9).fontColor('#7FA4B8').fontWeight(FontWeight.Bold).margin({ left: 10, bottom: 3 })
              ForEach(group.items, (item: MenuItem) => {
                Button(item.label)
                  .type(ButtonType.Normal)
                  .width('100%')
                  .height(38)
                  .fontSize(12)
                  .fontColor(this.section === item.code ? '#FFFFFF' : '#C7D8E4')
                  .backgroundColor(this.section === item.code ? Theme.blue : Color.Transparent)
                  .borderRadius(3)
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
        .fontColor('#FFFFFF')
        .backgroundColor(Color.Transparent)
        .border({ width: 1, color: '#5B7A92' })
        .onClick(() => void this.logout())
    }.width(244).height('100%').padding({ left: 16, right: 16, top: 20, bottom: 16 }).alignItems(HorizontalAlign.Start).backgroundColor(Theme.navy)
  }

  @Builder
  topbar() {
    Row() {
      Column() {
        Text(this.currentMenu().label).fontSize(23).fontColor(Theme.text).fontWeight(FontWeight.Bold)
        Text(this.currentMenu().description).fontSize(10).fontColor(Theme.muted).margin({ top: 5 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      StateBadge({ status: this.bundle.online ? 'RUNNING' : 'WAIT', label: this.dataSourceLabel() })
      Text(SessionStore.user === undefined ? '--' : SessionStore.user.displayName)
        .fontSize(12)
        .fontColor(Theme.text)
        .fontWeight(FontWeight.Bold)
        .margin({ left: 16 })
    }.width('100%').height(82).padding({ left: 24, right: 24 }).backgroundColor(Theme.panel).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  connectionBanner() {
    if (!this.bundle.online || SessionStore.isDemo) {
      Text((SessionStore.isDemo ? '演示账号只读。' : '') + (this.bundle.errorMessage.length > 0 ? this.bundle.errorMessage : '后端不可达，当前显示本地演示数据。'))
        .fontSize(11)
        .fontColor(Theme.warning)
        .padding(12)
        .width('100%')
        .backgroundColor(Theme.warningSoft)
        .border({ width: { left: 4 }, color: Theme.warning })
        .margin({ bottom: 14 })
    }
  }

  @Builder
  adminToolbar() {
    Row({ space: 10 }) {
      TextInput({ text: this.query, placeholder: '搜索编号、工位、设备、追踪号或操作者' })
        .height(40)
        .layoutWeight(1)
        .backgroundColor(Theme.panel)
        .border({ width: 1, color: Theme.line })
        .borderRadius(3)
        .onChange((value: string) => { this.query = value; this.resetPage() })
      Button('筛选  ' + this.filter).type(ButtonType.Normal).height(40).fontSize(11).fontColor(Theme.blue).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line }).borderRadius(3).onClick(() => this.nextFilter())
      Button('刷新数据').height(40).fontSize(11).backgroundColor(Theme.blue).fontColor('#FFFFFF').borderRadius(3).onClick(() => { this.loading = true; void this.refreshAll() })
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
    if (this.section === 'AI_CENTER' && this.aiCenterTab === 'AUDIT') return ['ALL', 'PROPOSED', 'APPROVAL_REQUIRED', 'COMMAND_PENDING', 'APPLIED', 'FAILED', 'STALE']
    if (this.section === 'AI_CENTER' && this.aiCenterTab === 'KNOWLEDGE') return ['ALL', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'INGESTING', 'INDEXED', 'REJECTED', 'FAILED', 'REVOKED']
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
  emptyState(text: string) {
    Column() {
      Text(text).fontSize(13).fontColor(Theme.muted)
      Text('请调整搜索或筛选条件，或等待后端返回数据。').fontSize(10).fontColor(Theme.muted).margin({ top: 6 })
    }.width('100%').padding(28).alignItems(HorizontalAlign.Center).backgroundColor(Theme.panelSoft)
  }

  @Builder
  detailPanel() {
    Column() {
      Text('详情').fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
      Text(this.selectedDetail).fontSize(11).fontColor(Theme.muted).margin({ top: 8 }).width('100%')
    }.width('100%').padding(14).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line }).margin({ top: 12 })
  }

  @Builder
  dashboardView() {
    Column() {
      Row({ space: 8 }) {
        this.compactMetric('运行中', this.bundle.dashboard.running.toString(), 'RUNNING')
        this.compactMetric('待处理', this.bundle.dashboard.holding.toString(), 'WAIT')
        this.compactMetric('开放异常', this.openIncidentCount().toString(), this.openIncidentCount() > 0 ? 'ALARM' : 'PASS')
        this.compactMetric('AI 待审', this.aiReviewCount().toString(), this.aiReviewCount() > 0 ? 'WAIT' : 'PASS')
        this.compactMetric('已入库', this.bundle.dashboard.completed.toString(), 'PASS')
      }.width('100%').margin({ bottom: 12 })
      Row() {
        Text('产线持续运行，下方优先呈现需要管理人员判断的状态。').fontSize(10).fontColor(Theme.muted)
        Blank()
        Text('快照版本 ' + this.currentStateVersion().toString()).fontSize(9).fontColor(Theme.muted)
      }.width('100%').padding({ bottom: 12 })
    }
    Row({ space: 12 }) {
      this.stageSummary()
      this.todoSummary()
    }.width('100%').alignItems(VerticalAlign.Top)
    Column() {
      SectionTitle({ code: 'RECENT OPERATIONS', title: '最近需要关注的事项', description: '异常、设备离线和仓区风险按优先级汇总，进入对应菜单处理。' })
      this.todoRow('开放报警', this.openAlarmCount().toString(), this.openAlarmCount() > 0 ? 'ALARM' : 'PASS')
      this.todoRow('仓区风险', this.unsafeZoneCount().toString(), this.unsafeZoneCount() > 0 ? 'ALARM' : 'PASS')
      this.todoRow('离线设备', this.offlineDeviceCount().toString(), this.offlineDeviceCount() > 0 ? 'ALARM' : 'PASS')
    }.width('100%').padding(15).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  compactMetric(label: string, value: string, tone: string) {
    Row({ space: 8 }) {
      Column().width(4).height(36).backgroundColor(statusColor(tone))
      Column() {
        Text(label).fontSize(9).fontColor(Theme.muted)
        Text(value).fontSize(19).fontColor(statusColor(tone)).fontWeight(FontWeight.Bold).margin({ top: 3 })
      }.alignItems(HorizontalAlign.Start)
    }.layoutWeight(1).height(62).padding(10).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line })
  }

  @Builder
  metric(label: string, value: string, note: string, tone: string) {
    Column() {
      Text(label).fontSize(10).fontColor(Theme.muted)
      Text(value).fontSize(25).fontColor(statusColor(tone)).fontWeight(FontWeight.Bold).margin({ top: 7 })
      Text(note).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
    }.width(168).height(96).padding(13).margin({ right: 8, bottom: 8 }).alignItems(HorizontalAlign.Start).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: statusColor(tone) }).borderRadius(3)
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
      Text('开放报警').fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 18, bottom: 8 })
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
  materialView() {
    Column() {
      SectionTitle({ code: 'MATERIAL TRACE', title: '产品与物料', description: '追踪号、瓶型、质量事件、箱码和库位。' })
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
      Text('AGV 任务').fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 10, bottom: 8 })
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
      Text('仓区安全与库存').fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 18, bottom: 8 })
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
  aiCenterView() {
    Column({ space: 14 }) {
      SectionTitle({ code: 'AI CENTER', title: 'AI 中心', description: '统一管理模型连接、知识库治理和 AI 决策审计；助手问答只读，生产命令仍由后端安全闸口处理。' })
      Row({ space: 8 }) {
        Button('模型与连接').height(38).fontColor(this.aiCenterTab === 'MODEL' ? '#FFFFFF' : Theme.blue).backgroundColor(this.aiCenterTab === 'MODEL' ? Theme.blue : Theme.panelSoft).border({ width: 1, color: Theme.line }).onClick(() => this.selectAiCenterTab('MODEL'))
        Button('知识库治理').height(38).fontColor(this.aiCenterTab === 'KNOWLEDGE' ? '#FFFFFF' : Theme.blue).backgroundColor(this.aiCenterTab === 'KNOWLEDGE' ? Theme.blue : Theme.panelSoft).border({ width: 1, color: Theme.line }).onClick(() => this.selectAiCenterTab('KNOWLEDGE'))
        Button('决策审计').height(38).fontColor(this.aiCenterTab === 'AUDIT' ? '#FFFFFF' : Theme.blue).backgroundColor(this.aiCenterTab === 'AUDIT' ? Theme.blue : Theme.panelSoft).border({ width: 1, color: Theme.line }).onClick(() => this.selectAiCenterTab('AUDIT'))
      }.width('100%')
      if (this.aiCenterTab === 'MODEL') {
        this.aiConfigState()
        this.aiModelForm()
        this.aiConnectionTestPanel()
        this.aiRagStatusPanel()
      }
      if (this.aiCenterTab === 'KNOWLEDGE') {
        KnowledgeGovernance({ query: this.query, filter: this.filter, stateVersion: this.currentStateVersion() })
      }
      if (this.aiCenterTab === 'AUDIT') {
        AiDecisionAuditPanel({ query: this.query, filter: this.filter, stateVersion: this.currentStateVersion() })
      }
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
      Button('刷新配置').height(34).backgroundColor(Theme.blue).fontColor('#FFFFFF').onClick(() => void this.loadAiCenter())
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
      Text('常用模型厂商').fontSize(14).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
      Flex({ wrap: FlexWrap.Wrap }) {
        ForEach(this.aiProviders, (provider: AiProviderPreset) => {
          Button(provider.label).height(36).fontSize(10).fontColor(this.aiProvider === provider.provider ? '#FFFFFF' : Theme.blue).backgroundColor(this.aiProvider === provider.provider ? Theme.blue : Theme.panel).border({ width: 1, color: Theme.line }).margin({ right: 8, bottom: 8 }).onClick(() => this.selectAiProvider(provider))
        }, (provider: AiProviderPreset) => provider.provider)
      }.width('100%')
      Text(this.aiProviderDescription.length > 0 ? this.aiProviderDescription : '选择一个预设后自动填充 Base URL 和推荐模型；自定义兼容服务仍可手动填写。').fontSize(10).fontColor(Theme.muted).width('100%')
      if (this.currentProviderModels().length > 0) {
        Row({ space: 8 }) {
          Text('推荐模型').fontSize(10).fontColor(Theme.muted).width(72)
          ForEach(this.currentProviderModels(), (model: string) => {
            Button(model).height(30).fontSize(9).fontColor(this.aiModelName === model ? '#FFFFFF' : Theme.blue).backgroundColor(this.aiModelName === model ? Theme.blue : Theme.panel).border({ width: 1, color: Theme.line }).onClick(() => this.selectAiModel(model))
          }, (model: string) => model)
        }.width('100%')
      }
      Text('模型连接').fontSize(14).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 4 })
      Row({ space: 8 }) {
        TextInput({ text: this.aiProvider, placeholder: '供应商，例如 OpenAI / DeepSeek / 本地模型' }).layoutWeight(1).onChange((value: string) => this.changeAiProvider(value))
        TextInput({ text: this.aiModelName, placeholder: '模型名称，例如 gpt-4.1 / deepseek-chat' }).layoutWeight(1).onChange((value: string) => this.aiModelName = value)
        TextInput({ text: this.aiBaseUrl, placeholder: 'baseUrl，例如 https://api.xxx.com/v1' }).layoutWeight(1).onChange((value: string) => this.aiBaseUrl = value)
      }.width('100%')
      Row({ space: 8 }) {
        Column() {
          Text('当前 Key：' + (this.aiMaskedApiKey.length > 0 ? this.aiMaskedApiKey : '未设置或接口未返回') + (this.aiProviderRequiresKey ? '' : ' · 此预设无需 Key')).fontSize(10).fontColor(Theme.muted)
          TextInput({ text: this.aiApiKeyInput, placeholder: this.aiProviderRequiresKey ? '填写 API Key；留空表示沿用现有 Key' : '本地演示模式无需填写 API Key' })
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
      Text('测试连接 / 测试问答').fontSize(14).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
      TextArea({ text: this.aiTestQuestion, placeholder: '输入一条用于诊断的测试问题' }).height(68).width('100%').onChange((value: string) => this.aiTestQuestion = value)
      Row({ space: 10 }) {
        Button('测试连接').enabled(this.canManageAiConfig() && !this.aiConfigLoading).fontColor('#FFFFFF').backgroundColor(this.canManageAiConfig() ? Theme.blue : Theme.neutral).onClick(() => void this.testAiConnection())
        StateBadge({ status: this.aiTestStatus, label: this.aiTestStatus })
        Text('失败会明确区分鉴权、超时、模型不可用、速率限制、RAG 未就绪或接口未实现。').fontSize(10).fontColor(Theme.muted).layoutWeight(1)
      }.width('100%')
      Text(this.aiTestResult).fontSize(10).fontColor(this.aiTestStatus === 'PASS' ? Theme.success : this.aiTestStatus === 'WAIT' ? Theme.muted : Theme.danger).width('100%').padding(10).backgroundColor('#FFFFFF').border({ width: 1, color: Theme.line })
    }.width('100%').padding(12).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }

  @Builder
  aiRagStatusPanel() {
    Column({ space: 8 }) {
      Text('文档 / RAG 运维状态').fontSize(14).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
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
      Button('打开知识库治理页签').fontColor('#FFFFFF').backgroundColor(Theme.blue).onClick(() => this.selectAiCenterTab('KNOWLEDGE'))
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
      ForEach(SYSTEM_POLICIES, (policy: SystemPolicy) => {
        Row() {
          Column() {
            Text(policy.name).fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
            Text(policy.policyCode + ' · ' + policy.version + ' · ' + policy.updatedAt).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Text(policy.value + ' ' + policy.unit).fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold).width(100)
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
      Text('本机操作尝试（不是服务端审计）').fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 16, bottom: 8 })
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
          this.aiCenterTab = 'MODEL'
          this.selectSection('AI_CENTER')
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
      this.aiCenterTab = 'AUDIT'
      this.selectSection('AI_CENTER')
      if (aiAudit !== undefined) {
        this.selectedDetail = this.aiDetail(aiAudit)
        return { handled: true }
      }
      this.message = '助手引用的审计记录不存在或当前角色不可见：' + entityId
      return { handled: false, reason: this.message }
    }
    if (entityType === AssistantEntityType.KNOWLEDGE_DOCUMENT) {
      this.aiCenterTab = 'KNOWLEDGE'
      this.selectSection('AI_CENTER')
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
      'AdminConsole/AI_CENTER',
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
