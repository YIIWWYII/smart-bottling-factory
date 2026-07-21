import { http } from '@kit.NetworkKit'
import { router, promptAction } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { SectionTitle, StateBadge } from '../components/IndustrialComponents'
import { FACTORY_STAGES } from '../config/FactoryStages'
import { FactoryRepository } from '../service/FactoryRepository'
import { apiClient } from '../service/ApiClient'
import { SessionStore } from '../service/SessionStore'
import { AuthUser, FactoryBundle, FactoryIncident, RuntimeDevice } from '../model/FactoryModels'
import { ApiConfig } from '../service/ApiConfig'

@Entry
@Component
struct AdminConsole {
  @State section: string = 'DASHBOARD'
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State users: Array<AuthUser> = []
  @State incidents: Array<FactoryIncident> = []
  @State message: string = ''
  private timer: number = -1
  private listener: () => void = () => this.bundle = FactoryRepository.bundle
  private menu: Array<string> = ['DASHBOARD', 'INCIDENTS', 'DEVICES', 'MATERIALS', 'WAREHOUSE', 'REPORTS', 'USERS', 'SETTINGS']

  aboutToAppear(): void {
    FactoryRepository.subscribe(this.listener)
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
    this.timer = setInterval(() => void FactoryRepository.refresh(), ApiConfig.refreshIntervalMs)
    void this.loadIncidents()
    if (SessionStore.isAdmin) void this.loadUsers()
  }

  aboutToDisappear(): void {
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
    if (this.timer >= 0) clearInterval(this.timer)
  }

  private async loadIncidents(): Promise<void> {
    try { this.incidents = await FactoryRepository.listIncidents('OPEN') } catch (error) { this.incidents = this.bundle.runtime.incidents.filter(item => item.status === 'OPEN') }
  }

  private async loadUsers(): Promise<void> {
    try { this.users = await apiClient.request<Array<AuthUser>>('/auth/users') } catch (error) { this.message = '用户列表暂不可用' }
  }

  private async resolveIncident(incident: FactoryIncident): Promise<void> {
    try { await FactoryRepository.resolveIncident(incident.incidentId, 'MANUAL_HOLD'); await this.loadIncidents(); promptAction.showToast({ message: '异常已提交解决' }) } catch (error) { this.message = '解决异常失败' }
  }

  private async updateUser(user: AuthUser): Promise<void> {
    if (!SessionStore.isAdmin) return
    const nextRole: string = user.role === 'VIEWER' ? 'OPERATOR' : user.role === 'OPERATOR' ? 'ADMIN' : 'VIEWER'
    try { await apiClient.request<Object>('/auth/users/' + user.id, http.RequestMethod.PATCH, { role: nextRole, status: user.status }); await this.loadUsers(); promptAction.showToast({ message: '用户权限已更新' }) } catch (error) { this.message = '更新用户失败' }
  }

  build() {
    Row() {
      Column() {
        Text('FACTORY ADMIN').fontSize(10).fontColor('#A9CDE6').fontWeight(FontWeight.Bold)
        Text('产线管理').fontSize(23).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 7 })
        Text(SessionStore.user === undefined ? '演示账号' : SessionStore.user.displayName).fontSize(10).fontColor('#C8DCE9').margin({ top: 18 })
        Divider().color('#416A87').margin({ top: 14, bottom: 10 })
        ForEach(this.menu, (item: string) => { Button(this.menuLabel(item)).type(ButtonType.Normal).width('100%').height(42).fontColor(this.section === item ? '#FFFFFF' : '#BBD1DF').backgroundColor(this.section === item ? Theme.blue : Color.Transparent).borderRadius(2).onClick(() => this.section = item) }, (item: string) => item)
        Blank()
        Button('返回工作台').type(ButtonType.Normal).width('100%').fontColor('#FFFFFF').backgroundColor(Color.Transparent).onClick(() => router.back())
      }.width(220).height('100%').padding(18).alignItems(HorizontalAlign.Start).backgroundColor(Theme.navy)

      Scroll() {
        Column() {
          Row() { Column() { Text('MANAGEMENT CONSOLE').fontSize(10).fontColor(Theme.accent).fontWeight(FontWeight.Bold); Text(this.menuLabel(this.section)).fontSize(28).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 6 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1); StateBadge({ status: this.bundle.online ? 'RUNNING' : 'STANDBY', label: this.bundle.source }) }.width('100%').padding({ bottom: 15 }).border({ width: { bottom: 3 }, color: Theme.blue })
          if (this.section === 'DASHBOARD') { this.dashboardView() }
          if (this.section === 'INCIDENTS') { this.incidentView() }
          if (this.section === 'DEVICES') { this.deviceView() }
          if (this.section === 'MATERIALS') { this.materialView() }
          if (this.section === 'WAREHOUSE') { this.warehouseView() }
          if (this.section === 'REPORTS') { this.reportView() }
          if (this.section === 'USERS') { this.userView() }
          if (this.section === 'SETTINGS') { this.settingsView() }
          if (this.message.length > 0) { Text(this.message).fontSize(10).fontColor(Theme.danger).padding(10) }
        }.width('100%').alignItems(HorizontalAlign.Start).padding(22)
      }.layoutWeight(1).height('100%').backgroundColor(Theme.page)
    }.width('100%').height('100%')
  }

  private menuLabel(value: string): string {
    if (value === 'DASHBOARD') return '运营首页'
    if (value === 'INCIDENTS') return '异常处置'
    if (value === 'DEVICES') return '设备管理'
    if (value === 'MATERIALS') return '物料与产品'
    if (value === 'WAREHOUSE') return '物流仓储'
    if (value === 'REPORTS') return '生产报表'
    if (value === 'USERS') return '用户与权限'
    if (value === 'SETTINGS') return '系统配置'
    return value
  }

  @Builder
  dashboardView() {
    Flex({ wrap: FlexWrap.Wrap }) { this.tile('累计批次', this.bundle.dashboard.total.toString(), '进入产线'); this.tile('完成入库', this.bundle.dashboard.completed.toString(), '全流程结束'); this.tile('待处理', this.bundle.dashboard.holding.toString(), '人工确认'); this.tile('开放报警', this.bundle.operations.alarms.filter(item => item.status === 'OPEN').length.toString(), '安全与设备异常'); this.tile('AGV 任务', this.bundle.logistics.tasks.length.toString(), '当前调度任务') }.width('100%').margin({ top: 16, bottom: 14 })
    Column() { SectionTitle({ code: 'PRODUCTION FLOW', title: '工序运行状态', description: '九个工位按连续流水模式独立运行。' }); ForEach(FACTORY_STAGES, (stage) => { Row() { Text(stage.name).fontSize(11).fontColor(Theme.text).width(120); Text(stage.code).fontSize(8).fontColor(Theme.muted).layoutWeight(1); StateBadge({ status: this.stageState(stage.code), label: this.stageState(stage.code) === 'RUNNING' ? '持续运行' : '条件待确认' }) }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line }) }, (stage) => stage.code) }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  tile(label: string, value: string, note: string) { Column() { Text(label).fontSize(10).fontColor(Theme.muted); Text(value).fontSize(25).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 8, bottom: 3 }); Text(note).fontSize(9).fontColor(Theme.muted) }.width(180).height(104).padding(14).margin(4).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.blue }).alignItems(HorizontalAlign.Start) }

  @Builder
  incidentView() {
    Column() { SectionTitle({ code: 'INCIDENT CENTER', title: '异常处置中心', description: '根据异常策略处理剔除、停工、返工、缓冲和整线影响。' }); if (this.incidents.length === 0) { Text('当前没有开放异常。').fontSize(11).fontColor(Theme.muted).padding(16) } else { ForEach(this.incidents, (incident) => { Row({ space: 10 }) { Circle().width(8).height(8).fill(Theme.danger); Column() { Text(incident.strategy + ' · ' + incident.stageCode).fontSize(11).fontColor(Theme.danger).fontWeight(FontWeight.Bold); Text(incident.message).fontSize(10).fontColor(Theme.muted).margin({ top: 4 }); Text('上游：' + (incident.upstreamImpact || '无') + ' · 下游：' + (incident.downstreamImpact || '无')).fontSize(9).fontColor(Theme.muted).margin({ top: 4 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1); Button('标记解决').type(ButtonType.Normal).fontColor('#FFFFFF').backgroundColor(Theme.blue).onClick(() => void this.resolveIncident(incident)) }.width('100%').padding(12).border({ width: { bottom: 1 }, color: Theme.line }) }, (incident) => incident.incidentId) } }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3).margin({ top: 16 })
  }

  @Builder
  deviceView() { Column() { SectionTitle({ code: 'EQUIPMENT', title: '设备管理', description: '设备运行态、数据来源和速度。控制命令由后端安全门校验。' }); ForEach(this.bundle.runtime.devices, (device: RuntimeDevice) => { Row() { Text(device.deviceCode).fontSize(10).fontColor(Theme.blue).fontWeight(FontWeight.Bold).width(160); Text(device.stageCode).fontSize(9).fontColor(Theme.muted).width(160); StateBadge({ status: device.state, label: device.state }); Text(device.source + (device.fallback ? ' · 兜底' : '')).fontSize(9).fontColor(Theme.muted).layoutWeight(1) }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line }) }, (device: RuntimeDevice) => device.deviceCode) }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3).margin({ top: 16 }) }
  @Builder
  materialView() { Column() { SectionTitle({ code: 'MATERIAL TRACE', title: '物料与产品', description: '产品追踪号、瓶型、缺陷、箱码和当前位置。' }); ForEach(this.bundle.dashboard.runs, (run) => { Row() { Text(run.traceCode).fontSize(9).fontColor(Theme.blue).width(190); Text(run.bottleType || '待识别').fontSize(9).fontColor(Theme.text).width(100); Text(run.defectType || '无缺陷记录').fontSize(9).fontColor(run.defectType === undefined ? Theme.muted : Theme.danger).layoutWeight(1); Text(run.boxCode || this.stageForRun(run.currentStage)).fontSize(9).fontColor(Theme.muted) }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line }) }, (run) => run.traceCode) }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3).margin({ top: 16 }) }
  @Builder
  warehouseView() { Column() { SectionTitle({ code: 'LOGISTICS & WMS', title: '物流仓储', description: 'AGV 调度、避障、负载、仓区安全和箱级库存。' }); ForEach(this.bundle.logistics.tasks, (task) => { Row() { Text(task.agvCode + ' · ' + task.boxCode).fontSize(10).fontColor(Theme.blue).width(230); Text(task.status).fontSize(9).fontColor(statusColor(task.status)).width(90); Text('速度 ' + task.speedMps + ' m/s').fontSize(9).fontColor(Theme.text).width(120); Text('避障 ' + task.obstacleDistanceCm + ' cm').fontSize(9).fontColor(Theme.muted).layoutWeight(1) }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line }) }, (task) => task.taskId); ForEach(this.bundle.logistics.zones, (zone) => { Row() { Text('仓区 ' + zone.zoneCode).fontSize(10).fontColor(Theme.text).width(160); StateBadge({ status: zone.status === 'SAFE' ? 'PASS' : 'FAIL', label: zone.status }); Text('VOC ' + zone.vocPpm + ' ppm · 烟雾 ' + zone.smoke + '% · ' + zone.temperatureC + ' °C').fontSize(9).fontColor(Theme.muted).layoutWeight(1) }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line }) }, (zone) => zone.zoneCode) }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3).margin({ top: 16 }) }
  @Builder
  reportView() { Column() { SectionTitle({ code: 'REPORTS', title: '生产报表', description: '当前版本先提供持久化批次、质量和物流汇总；导出功能后续接入。' }); this.reportRow('投入批次', this.bundle.dashboard.total.toString()); this.reportRow('完成入库', this.bundle.dashboard.completed.toString()); this.reportRow('剔除批次', this.bundle.dashboard.rejected.toString()); this.reportRow('质量通过率', this.bundle.dashboard.completed + this.bundle.dashboard.rejected > 0 ? (this.bundle.dashboard.completed / (this.bundle.dashboard.completed + this.bundle.dashboard.rejected) * 100).toFixed(1) + '%' : '--'); this.reportRow('库存箱数', this.bundle.logistics.stock.length.toString()) }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3).margin({ top: 16 }) }
  @Builder reportRow(label: string, value: string) { Row() { Text(label).fontSize(11).fontColor(Theme.muted).layoutWeight(1); Text(value).fontSize(17).fontColor(Theme.navy).fontWeight(FontWeight.Bold) }.width('100%').padding(13).border({ width: { bottom: 1 }, color: Theme.line }) }
  @Builder
  userView() { Column() { SectionTitle({ code: 'ACCESS CONTROL', title: '用户与权限', description: SessionStore.isAdmin ? '管理员可循环调整角色，最终结果由后端权限接口确认。' : '当前账号没有用户管理权限。' }); if (!SessionStore.isAdmin) { Text('仅 ADMIN 角色可以管理用户。').fontSize(11).fontColor(Theme.warning).padding(16) } else { ForEach(this.users, (user) => { Row() { Column() { Text(user.username).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold); Text(user.displayName + ' · ' + user.status).fontSize(9).fontColor(Theme.muted).margin({ top: 4 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1); Text(user.role).fontSize(10).fontColor(Theme.blue).fontWeight(FontWeight.Bold); Button('切换角色').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => void this.updateUser(user)) }.width('100%').padding(12).border({ width: { bottom: 1 }, color: Theme.line }) }, (user) => user.id.toString()) } }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3).margin({ top: 16 }) }
  @Builder
  settingsView() { Column() { SectionTitle({ code: 'SYSTEM CONFIG', title: '系统配置', description: '当前连接配置由工程文件控制，修改后重新构建应用。' }); Text('后端地址').fontSize(10).fontColor(Theme.muted).margin({ top: 15 }); Text(ApiConfig.API_BASE).fontSize(12).fontColor(Theme.blue).padding(12).backgroundColor(Theme.panelSoft).width('100%').margin({ top: 6 }); Text('实时地址').fontSize(10).fontColor(Theme.muted).margin({ top: 15 }); Text(ApiConfig.WS_BASE).fontSize(12).fontColor(Theme.blue).padding(12).backgroundColor(Theme.panelSoft).width('100%').margin({ top: 6 }); Text('数据源：' + this.bundle.source + ' · 实时通道：' + (FactoryRepository.realtimeOnline ? '在线' : '重连中')).fontSize(10).fontColor(Theme.muted).margin({ top: 16 }) }.width('100%').padding(17).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3).margin({ top: 16 }) }

  private stageState(code: string): string { const item = this.bundle.runtime.stages.find(stage => stage.stageCode === code); return item === undefined ? 'RUNNING' : item.state }
  private stageForRun(code: string): string { const item = FACTORY_STAGES.find(stage => stage.code === code); return item === undefined ? code : item.name }
}
