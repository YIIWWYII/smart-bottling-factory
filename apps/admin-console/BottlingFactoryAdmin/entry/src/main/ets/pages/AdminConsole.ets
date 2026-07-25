import { http } from '@kit.NetworkKit'
import { router, promptAction } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { SectionTitle, StateBadge } from '../components/IndustrialComponents'
import { FACTORY_STAGES, findStage } from '../config/FactoryStages'
import { FactoryRepository } from '../service/FactoryRepository'
import { apiClient } from '../service/ApiClient'
import { SessionStore } from '../service/SessionStore'
import { ApiConfig } from '../service/ApiConfig'
import {
  AdminAuditRecord,
  AgvTask,
  AiAudit,
  AlarmRecord,
  AuthUser,
  DeviceCommand,
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

interface MenuItem {
  code: string
  label: string
  description: string
  minRole: string
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
  { code: 'USERS', label: '用户权限', description: '账号、角色和状态', minRole: 'ADMIN' },
  { code: 'SETTINGS', label: '系统配置', description: '阈值和策略版本', minRole: 'ADMIN' },
  { code: 'AUDIT', label: '操作审计', description: '用户操作和后端结果', minRole: 'VIEWER' }
]

const DEMO_USERS: Array<AuthUser> = [
  { id: 1, username: 'admin', displayName: '管理员', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: '2026-07-25T10:00:00+08:00' },
  { id: 2, username: 'operator', displayName: '工艺操作员', role: 'OPERATOR', status: 'ACTIVE', lastLoginAt: '2026-07-25T09:40:00+08:00' },
  { id: 3, username: 'viewer', displayName: '只读观察员', role: 'VIEWER', status: 'ACTIVE', lastLoginAt: '2026-07-24T18:20:00+08:00' }
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
  @State query: string = ''
  @State filter: string = 'ALL'
  @State pageIndex: number = 0
  @State selectedDetail: string = '请选择一条记录查看详情。'
  @State message: string = ''
  @State loading: boolean = false
  private timer: number = -1
  private readonly pageSize: number = 5
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    this.rebuildAuditRecords()
  }

  aboutToAppear(): void {
    if (!SessionStore.isAuthenticated) {
      router.replaceUrl({ url: 'pages/Login' })
      return
    }
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
  }

  private async refreshAll(): Promise<void> {
    await FactoryRepository.refresh()
    this.bundle = FactoryRepository.bundle
    await this.loadIncidents()
    if (SessionStore.isAdmin) {
      await this.loadUsers()
    } else {
      this.users = []
    }
    this.rebuildAuditRecords()
    this.loading = false
  }

  private async loadIncidents(): Promise<void> {
    try {
      this.incidents = await FactoryRepository.listIncidents(this.filter === 'RESOLVED' ? 'RESOLVED' : 'OPEN')
    } catch (error) {
      this.incidents = this.bundle.runtime.incidents
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      this.users = await apiClient.request<Array<AuthUser>>('/auth/users')
    } catch (error) {
      this.users = SessionStore.isDemo ? DEMO_USERS : []
      this.message = '用户列表暂不可用，已展示只读演示样例。'
    }
  }

  private canUse(requiredRole: string): boolean {
    const role: string = SessionStore.user === undefined ? 'VIEWER' : SessionStore.user.role
    if (requiredRole === 'VIEWER') return true
    if (requiredRole === 'OPERATOR') return role === 'OPERATOR' || role === 'ADMIN'
    if (requiredRole === 'ADMIN') return role === 'ADMIN'
    return false
  }

  private canWrite(requiredRole: string): boolean {
    return this.canUse(requiredRole) && !SessionStore.isDemo && this.bundle.online
  }

  private selectSection(code: string): void {
    this.section = code
    this.query = ''
    this.filter = 'ALL'
    this.pageIndex = 0
    this.selectedDetail = this.currentMenu().description
    this.message = ''
    if (code === 'USERS' && SessionStore.isAdmin) void this.loadUsers()
    if (code === 'INCIDENTS') void this.loadIncidents()
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
    if (SessionStore.user.role === 'ADMIN') return 'ADMIN 管理员'
    if (SessionStore.user.role === 'OPERATOR') return 'OPERATOR 操作员'
    return 'VIEWER 只读'
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
        this.appendAudit('退出登录', 'auth/logout', 'FAILED', error instanceof Error ? error.message : '后端退出接口不可达')
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

  private appendAudit(action: string, target: string, result: string, message: string): void {
    const actor: string = SessionStore.user === undefined ? 'anonymous' : SessionStore.user.username
    const record: AdminAuditRecord = {
      auditId: 'LOCAL-' + new Date().getTime().toString(),
      actor: actor,
      action: action,
      target: target,
      result: result,
      message: message,
      occurredAt: new Date().toISOString()
    }
    this.auditRecords = [record].concat(this.auditRecords)
  }

  private rebuildAuditRecords(): void {
    const rows: Array<AdminAuditRecord> = []
    this.bundle.operations.commands.forEach((command: DeviceCommand) => {
      rows.push({
        auditId: command.commandId,
        actor: command.source,
        action: command.commandType,
        target: command.deviceCode,
        result: command.status,
        message: command.message || '等待设备回执',
        occurredAt: command.acknowledgedAt || command.createdAt || this.bundle.updatedAt
      })
    })
    this.bundle.operations.aiAudits.forEach((item: AiAudit) => {
      rows.push({
        auditId: item.auditId,
        actor: 'AI_DECISION_CENTER',
        action: item.decision,
        target: item.traceCode,
        result: item.validationStatus,
        message: item.reason,
        occurredAt: item.createdAt
      })
    })
    this.bundle.runtime.incidents.forEach((incident: FactoryIncident) => {
      rows.push({
        auditId: incident.incidentId,
        actor: 'FACTORY_RUNTIME',
        action: incident.strategy,
        target: incident.stageCode,
        result: incident.status,
        message: incident.message,
        occurredAt: incident.resolvedAt || incident.createdAt || this.bundle.updatedAt
      })
    })
    const localRows: Array<AdminAuditRecord> = this.auditRecords.filter((item: AdminAuditRecord) => item.auditId.indexOf('LOCAL-') === 0)
    this.auditRecords = localRows.concat(rows)
  }

  private async acknowledgeAlarm(alarm: AlarmRecord): Promise<void> {
    if (!this.canWrite('OPERATOR')) {
      this.message = this.writeDisabledReason('OPERATOR')
      this.appendAudit('确认报警', alarm.alarmId, 'DENIED', this.message)
      return
    }
    try {
      await FactoryRepository.acknowledgeAlarm(alarm.alarmId)
      this.appendAudit('确认报警', alarm.alarmId, 'ACCEPTED', '后端已受理报警确认')
      promptAction.showToast({ message: '报警确认已提交' })
      await this.refreshAll()
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : '报警确认失败'
      this.appendAudit('确认报警', alarm.alarmId, 'FAILED', msg)
      this.message = msg
    }
  }

  private async resolveIncident(incident: FactoryIncident, strategy: string): Promise<void> {
    if (!this.canWrite('OPERATOR')) {
      this.message = this.writeDisabledReason('OPERATOR')
      this.appendAudit('处置异常', incident.incidentId, 'DENIED', this.message)
      return
    }
    try {
      await FactoryRepository.resolveIncident(incident.incidentId, strategy)
      this.appendAudit('处置异常', incident.incidentId, 'ACCEPTED', '后端已受理异常策略：' + strategy)
      promptAction.showToast({ message: '异常处置已提交' })
      await this.refreshAll()
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : '异常处置失败'
      this.appendAudit('处置异常', incident.incidentId, 'FAILED', msg)
      this.message = msg
    }
  }

  private async updateUser(user: AuthUser): Promise<void> {
    if (!this.canWrite('ADMIN')) {
      this.message = this.writeDisabledReason('ADMIN')
      this.appendAudit('更新用户', user.username, 'DENIED', this.message)
      return
    }
    const nextRole: string = user.role === 'VIEWER' ? 'OPERATOR' : user.role === 'OPERATOR' ? 'ADMIN' : 'VIEWER'
    const payload: UpdateUserPayload = { role: nextRole, status: user.status }
    const patchMethod: http.RequestMethod = 'PATCH' as http.RequestMethod
    try {
      await apiClient.request<Object>('/auth/users/' + user.id.toString(), patchMethod, JSON.stringify(payload))
      this.appendAudit('更新用户', user.username, 'ACCEPTED', '角色变更为 ' + nextRole)
      promptAction.showToast({ message: '用户角色更新已提交' })
      await this.loadUsers()
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : '更新用户失败'
      this.appendAudit('更新用户', user.username, 'FAILED', msg)
      this.message = msg
    }
  }

  private writeDisabledReason(requiredRole: string): string {
    if (SessionStore.isDemo) return '演示账号只允许浏览，不发送真实写操作。'
    if (!this.canUse(requiredRole)) return '当前角色权限不足，需要 ' + requiredRole + ' 或更高权限。'
    if (!this.bundle.online) return '后端不可达，写操作已禁用。'
    return '当前操作不可用。'
  }

  build() {
    Row() {
      this.sidebar()
      Column() {
        this.topbar()
        Scroll() {
          Column() {
            this.connectionBanner()
            if (!this.canUse(this.currentMenu().minRole)) {
              this.noAccessView()
            } else {
              this.adminToolbar()
              if (this.section === 'DASHBOARD') this.dashboardView()
              if (this.section === 'PRODUCTION') this.productionView()
              if (this.section === 'INCIDENTS') this.incidentView()
              if (this.section === 'DEVICES') this.deviceView()
              if (this.section === 'MATERIALS') this.materialView()
              if (this.section === 'LOGISTICS') this.logisticsView()
              if (this.section === 'AI_AUDIT') this.aiAuditView()
              if (this.section === 'USERS') this.userView()
              if (this.section === 'SETTINGS') this.settingsView()
              if (this.section === 'AUDIT') this.auditView()
            }
            if (this.message.length > 0) {
              Text(this.message).fontSize(11).fontColor(Theme.danger).padding(12).width('100%').backgroundColor('#FFF1F2').margin({ top: 12 })
            }
          }.width('100%').alignItems(HorizontalAlign.Start).padding(20)
        }.width('100%').layoutWeight(1).backgroundColor(Theme.page)
      }.layoutWeight(1).height('100%')
    }.width('100%').height('100%').backgroundColor(Theme.page)
  }

  @Builder
  sidebar() {
    Column() {
      Text('BOTTLING ADMIN').fontSize(10).fontColor('#A9CDE6').fontWeight(FontWeight.Bold)
      Text('后台管理').fontSize(24).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 8 })
      Text(this.roleName()).fontSize(10).fontColor('#C8DCE9').margin({ top: 16 })
      Divider().color('#45687F').margin({ top: 14, bottom: 10 })
      Scroll() {
        Column({ space: 5 }) {
          ForEach(MENU, (item: MenuItem) => {
            Button(item.label)
              .type(ButtonType.Normal)
              .width('100%')
              .height(40)
              .fontSize(12)
              .fontColor(this.section === item.code ? '#FFFFFF' : '#C7D8E4')
              .backgroundColor(this.section === item.code ? Theme.blue : Color.Transparent)
              .borderRadius(2)
              .onClick(() => this.selectSection(item.code))
          }, (item: MenuItem) => item.code)
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
    }.width(232).height('100%').padding(18).alignItems(HorizontalAlign.Start).backgroundColor(Theme.navy)
  }

  @Builder
  topbar() {
    Row() {
      Column() {
        Text(this.currentMenu().label).fontSize(25).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
        Text(this.currentMenu().description).fontSize(11).fontColor(Theme.muted).margin({ top: 4 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      StateBadge({ status: this.bundle.online ? 'RUNNING' : 'WAIT', label: this.dataSourceLabel() })
      Text(SessionStore.user === undefined ? '--' : SessionStore.user.displayName)
        .fontSize(12)
        .fontColor(Theme.text)
        .fontWeight(FontWeight.Bold)
        .margin({ left: 16 })
    }.width('100%').height(76).padding({ left: 22, right: 22 }).backgroundColor(Theme.panel).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  connectionBanner() {
    if (!this.bundle.online || SessionStore.isDemo) {
      Text((SessionStore.isDemo ? '演示账号只读。' : '') + (this.bundle.errorMessage.length > 0 ? this.bundle.errorMessage : '后端不可达，当前显示本地演示数据。'))
        .fontSize(11)
        .fontColor(Theme.warning)
        .padding(12)
        .width('100%')
        .backgroundColor('#FFF7E6')
        .border({ width: { left: 4 }, color: Theme.warning })
        .margin({ bottom: 14 })
    }
  }

  @Builder
  adminToolbar() {
    Row({ space: 10 }) {
      TextInput({ text: this.query, placeholder: '搜索编号、工位、设备、追踪号或操作者' })
        .height(38)
        .layoutWeight(1)
        .backgroundColor(Theme.panel)
        .onChange((value: string) => { this.query = value; this.resetPage() })
      Button(this.filter).type(ButtonType.Normal).height(38).fontColor(Theme.blue).backgroundColor(Theme.panel).border({ width: 1, color: Theme.line }).onClick(() => this.nextFilter())
      Button('刷新').height(38).backgroundColor(Theme.blue).fontColor('#FFFFFF').onClick(() => { this.loading = true; void this.refreshAll() })
    }.width('100%').margin({ bottom: 12 })
  }

  private nextFilter(): void {
    const filters: Array<string> = ['ALL', 'RUNNING', 'OPEN', 'ALARM', 'FAILED', 'RESOLVED']
    let index: number = filters.indexOf(this.filter)
    index = index < 0 ? 0 : index + 1
    if (index >= filters.length) index = 0
    this.filter = filters[index]
    this.pageIndex = 0
    if (this.section === 'INCIDENTS') void this.loadIncidents()
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
    Flex({ wrap: FlexWrap.Wrap }) {
      this.metric('累计批次', this.bundle.dashboard.total.toString(), '进入产线', 'NORMAL')
      this.metric('运行中', this.bundle.dashboard.running.toString(), '连续流水', 'RUNNING')
      this.metric('完成入库', this.bundle.dashboard.completed.toString(), '箱级库存', 'PASS')
      this.metric('待处理', this.bundle.dashboard.holding.toString(), '人工待办', 'WAIT')
      this.metric('开放异常', this.openIncidentCount().toString(), '质量或设备', this.openIncidentCount() > 0 ? 'ALARM' : 'PASS')
      this.metric('AI 审计', this.bundle.operations.aiAudits.length.toString(), '建议与校验', 'NORMAL')
    }.width('100%').margin({ bottom: 14 })
    Row({ space: 12 }) {
      this.stageSummary()
      this.todoSummary()
    }.width('100%').alignItems(VerticalAlign.Top)
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
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectedDetail = this.runDetail(run))
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
            Button('处置').enabled(this.canWrite('OPERATOR')).fontColor('#FFFFFF').backgroundColor(this.canWrite('OPERATOR') ? Theme.blue : Theme.neutral).onClick(() => this.confirmAction('确认处置异常', '提交后由后端执行权限、安全门和联锁校验。', () => void this.resolveIncident(incident, incident.strategy)))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (incident: FactoryIncident) => incident.incidentId)
        this.pager(this.filteredIncidents().length)
      }
      Text('写操作状态：' + (this.canWrite('OPERATOR') ? '可提交到后端' : this.writeDisabledReason('OPERATOR'))).fontSize(10).fontColor(this.canWrite('OPERATOR') ? Theme.success : Theme.warning).margin({ top: 10 })
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
            Button('档案').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectedDetail = this.deviceDetail(device))
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
            Button('追溯').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectedDetail = this.runDetail(run))
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
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  aiAuditView() {
    Column() {
      SectionTitle({ code: 'AI DECISION AUDIT', title: 'AI 决策审计', description: '查看 RAG 来源版本、数据库校验、建议、审批、命令和结果。' })
      if (this.filteredAiAudits().length === 0) {
        this.emptyState('没有匹配的 AI 决策记录。')
      } else {
        ForEach(this.filteredAiAudits().slice(this.pageStart(), this.pageEnd(this.filteredAiAudits().length)), (audit: AiAudit) => {
          Row() {
            Column() {
              Text(audit.auditId + ' · ' + audit.traceCode).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
              Text(audit.knowledgeVersion + ' · ' + audit.bottleType).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).width(230)
            StateBadge({ status: audit.validationStatus, label: audit.validationStatus })
            Text(audit.decision).fontSize(10).fontColor(Theme.text).layoutWeight(1)
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectedDetail = this.aiDetail(audit))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (audit: AiAudit) => audit.auditId)
        this.pager(this.filteredAiAudits().length)
      }
      this.detailPanel()
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
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
            Button('切换角色').enabled(this.canWrite('ADMIN')).fontColor('#FFFFFF').backgroundColor(this.canWrite('ADMIN') ? Theme.blue : Theme.neutral).onClick(() => this.confirmAction('确认修改用户角色', '提交后由后端记录权限变更审计。', () => void this.updateUser(user)))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (user: AuthUser) => user.id.toString())
        this.pager(this.filteredUsers().length)
      }
      Text('写操作状态：' + (this.canWrite('ADMIN') ? '可提交到后端' : this.writeDisabledReason('ADMIN'))).fontSize(10).fontColor(this.canWrite('ADMIN') ? Theme.success : Theme.warning).margin({ top: 10 })
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
        }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
      }, (policy: SystemPolicy) => policy.policyCode)
      Text('后端地址：' + ApiConfig.API_BASE).fontSize(10).fontColor(Theme.muted).margin({ top: 14 })
      Text('实时地址：' + ApiConfig.WS_BASE).fontSize(10).fontColor(Theme.muted).margin({ top: 6 })
      Button('提交策略版本变更').enabled(false).fontColor('#FFFFFF').backgroundColor(Theme.neutral).margin({ top: 12 })
      Text('按钮禁用原因：公共契约尚未定义系统配置写入端点，管理端不伪造配置成功。').fontSize(10).fontColor(Theme.warning).margin({ top: 8 })
    }.width('100%').padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  auditView() {
    Column() {
      SectionTitle({ code: 'OPERATION AUDIT', title: '操作审计', description: '记录谁在何时做了什么、目标、结果和失败原因。' })
      if (this.filteredAuditRecords().length === 0) {
        this.emptyState('没有匹配的审计记录。')
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
            Button('详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectedDetail = this.auditDetail(record))
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (record: AdminAuditRecord) => record.auditId)
        this.pager(this.filteredAuditRecords().length)
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
