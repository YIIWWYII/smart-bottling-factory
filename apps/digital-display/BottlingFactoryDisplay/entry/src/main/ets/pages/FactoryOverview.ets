import { router } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { AssistantMountPoint } from '../components/AssistantMountPoint'
import { SectionTitle, MetricTile, StateBadge } from '../components/IndustrialComponents'
import { FACTORY_STAGES } from '../config/FactoryStages'
import { AssistantHostAdapter, AssistantSelection } from '../assistant/AssistantHostAdapter'
import { FactoryRepository } from '../service/FactoryRepository'
import { AlarmRecord, FactoryBundle, FactoryRun, RuntimeStage, StageDefinition } from '../model/FactoryModels'
import { ApiConfig } from '../service/ApiConfig'

@Entry
@Component
struct FactoryOverview {
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State revision: number = 0
  @State assistantOpen: boolean = false
  @State assistantSelectionType: string = ''
  @State assistantSelectionId: string = ''
  @State assistantSelectionLabel: string = ''
  @State assistantSelectedText: string = ''
  private refreshTimer: number = -1
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    this.syncAssistantContext()
    this.revision += 1
  }

  aboutToAppear(): void {
    FactoryRepository.subscribe(this.listener)
    this.syncAssistantContext()
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
    this.refreshTimer = setInterval(() => void FactoryRepository.refresh(), ApiConfig.refreshIntervalMs)
  }

  aboutToDisappear(): void {
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
    if (this.refreshTimer >= 0) clearInterval(this.refreshTimer)
  }

  private safeCount(value: number): number { return Number.isFinite(value) ? value : 0 }
  private totalCount(): number { return this.safeCount(this.bundle.dashboard.total) }
  private completedCount(): number { return this.safeCount(this.bundle.dashboard.completed) }
  private rejectedCount(): number { return this.safeCount(this.bundle.dashboard.rejected) }
  private holdingCount(): number { return this.safeCount(this.bundle.dashboard.holding) }
  private wipCount(): number { return Math.max(0, this.totalCount() - this.completedCount() - this.rejectedCount()) }
  private finishedCount(): number { return this.completedCount() + this.rejectedCount() }
  private passRate(): string { return this.finishedCount() > 0 ? (this.completedCount() / this.finishedCount() * 100).toFixed(1) + '%' : '--' }
  private openAlarmCount(): number { return this.bundle.operations.alarms.filter(item => item.status === 'OPEN').length }
  private openIncidentCount(): number { return this.bundle.runtime.incidents.filter(item => item.status === 'OPEN').length }
  private runningStageCount(): number { return this.bundle.runtime.stages.filter(item => item.state === 'RUNNING').length }
  private mqttCount(): number { return this.bundle.runtime.devices.filter(item => item.source === 'MQTT' && !item.fallback).length }
  private onlineDeviceCount(): number { return this.bundle.runtime.devices.filter(item => item.state !== 'OFFLINE').length }
  private totalDeviceCount(): number { return this.bundle.runtime.devices.length }

  private stageRuntime(code: string): RuntimeStage {
    let value: RuntimeStage = { stageCode: code, state: 'RUNNING', bufferLevel: 0, bufferCapacity: 6 }
    this.bundle.runtime.stages.forEach(item => { if (item.stageCode === code) value = item })
    return value
  }

  private stageProductCount(code: string): number {
    return this.bundle.dashboard.runs.filter(item => item.currentStage === code && (item.status === 'RUNNING' || item.status === 'HOLD')).length
  }

  private stageStatus(stage: StageDefinition): string {
    const runtime = this.stageRuntime(stage.code)
    const rejected = this.bundle.dashboard.runs.some(item => item.currentStage === stage.code && item.status === 'REJECTED')
    const alarm = this.bundle.operations.alarms.some(item => item.status === 'OPEN' && this.normalizeStage(item.stage || '', item.deviceCode) === stage.code)
    if (rejected) return 'REJECTED'
    if (runtime.state !== 'RUNNING' || alarm) return 'HOLD'
    return 'RUNNING'
  }

  private normalizeStage(stage: string, deviceCode: string): string {
    if (stage === 'WAREHOUSE_SAFETY' || deviceCode.indexOf('WAREHOUSE') === 0) return 'WAREHOUSE_INBOUND'
    return stage
  }

  private formatTime(value: string | undefined): string { return value === undefined ? '--' : value.replace('T', ' ').slice(0, 19) }
  private stageLabel(code: string): string {
    if (code === 'COMPLETED') return '完成入库'
    let label: string = code
    FACTORY_STAGES.forEach(stage => { if (stage.code === code) label = stage.name })
    return label
  }
  private statusLabel(status: string): string { return status === 'COMPLETED' ? '已入库' : status === 'REJECTED' ? '已剔除' : status === 'HOLD' ? '待处理' : '运行中' }
  private defectLabel(value: string | undefined): string { return value === undefined ? '等待检测结果' : value === 'BODY_DENT' ? '瓶身凹陷' : value === 'CAP_DEFECT' ? '瓶盖缺陷' : value }
  private assistantStateVersion(): string { return AssistantHostAdapter.stateVersionOf(this.bundle) }
  private syncAssistantContext(): void {
    AssistantHostAdapter.updateContext(AssistantHostAdapter.buildContext('pages/FactoryOverview', this.bundle))
  }
  private selectAssistant(entityType: string, entityId: string, label: string, origin: string, selectedText: string = ''): void {
    const selection: AssistantSelection = AssistantHostAdapter.createSelection(entityType, entityId, label, origin, this.assistantStateVersion(), selectedText)
    AssistantHostAdapter.select(selection)
    this.assistantSelectionType = selection.entityType
    this.assistantSelectionId = selection.entityId
    this.assistantSelectionLabel = selection.label
    this.assistantSelectedText = selection.selectedText
    this.assistantOpen = true
    this.syncAssistantContext()
  }

  build() {
    Scroll() {
      Column() {
        Row() {
          Column() {
            Text('BOTTLING LINE · NATIVE MONITOR').fontSize(10).fontColor('#A9CDE6').fontWeight(FontWeight.Bold)
            Text('智慧装瓶产线全局监控').fontSize(29).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 6 })
            Text('生产、质量、设备、物流与仓储一体化运行态势').fontSize(12).fontColor('#D2E0EB').margin({ top: 5 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Column() {
            StateBadge({ status: this.bundle.online ? (this.openAlarmCount() > 0 ? 'HOLD' : 'RUNNING') : 'STANDBY', label: this.bundle.online ? (this.openAlarmCount() > 0 ? '连续运行 · 局部异常' : '后端在线') : 'LOCAL DEMO' })
            Text('实时通道：' + (FactoryRepository.realtimeOnline ? '在线' : '重连中')).fontSize(9).fontColor('#D2E0EB').margin({ top: 8 })
            Text(this.formatTime(this.bundle.updatedAt)).fontSize(8).fontColor('#B8CEDC').margin({ top: 4 })
          }.alignItems(HorizontalAlign.End)
        }.width('100%').padding(22).backgroundColor(Theme.navy)

        Row() {
          Text('全局总览').fontSize(10).fontColor(Theme.muted).fontWeight(FontWeight.Bold)
          Blank()
          Button('选中页面说明').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectAssistant('TEXT', 'text:display:overview-summary', '全局总览页面说明', 'overview-text', '智慧装瓶产线全局监控，展示九工序连续流水、生产质量、设备、异常、物流仓储和产品追踪。'))
          Button(this.assistantOpen ? '收起助手' : '助手上下文').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.assistantOpen = !this.assistantOpen)
          Button('刷新数据').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => void FactoryRepository.refresh())
        }.width('100%').padding({ left: 16, right: 8, top: 4, bottom: 4 })

        if (this.assistantOpen) {
          this.assistantPanel()
        }

        Column() {
          SectionTitle({ code: 'CONTINUOUS PRODUCTION FLOW', title: '整线生产流程', description: '点击任一工位查看设备、物料、质量门和异常影响。' })
          Scroll() {
            Row({ space: 10 }) {
              ForEach(FACTORY_STAGES, (stage: StageDefinition, index: number) => {
                this.stageCard(stage, index)
              }, (stage: StageDefinition) => stage.code)
            }.padding({ top: 16, bottom: 8 })
          }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Auto).width('100%')
        }.width('100%').padding(18).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.blue }).borderRadius(3)

        Scroll() {
          Row({ space: 8 }) {
            MetricTile({ label: '累计投入', value: this.totalCount().toString(), note: '进入产线的追踪批次' }).onClick(() => this.selectAssistant('KPI', 'kpi:display:dashboard.total', '累计投入 ' + this.totalCount(), 'overview-kpi'))
            MetricTile({ label: '完成入库', value: this.completedCount().toString(), note: '全流程完成', tone: 'PASS' }).onClick(() => this.selectAssistant('KPI', 'kpi:display:dashboard.completed', '完成入库 ' + this.completedCount(), 'overview-kpi'))
            MetricTile({ label: '在制品 WIP', value: this.wipCount().toString(), note: '运行或待处理' }).onClick(() => this.selectAssistant('KPI', 'kpi:display:dashboard.wip', '在制品 WIP ' + this.wipCount(), 'overview-kpi'))
            MetricTile({ label: '检测剔除', value: this.rejectedCount().toString(), note: '不合格品已隔离', tone: 'FAIL' }).onClick(() => this.selectAssistant('KPI', 'kpi:display:dashboard.rejected', '检测剔除 ' + this.rejectedCount(), 'overview-kpi'))
            MetricTile({ label: '待人工处理', value: this.holdingCount().toString(), note: '暂停自动放行', tone: 'WAIT' }).onClick(() => this.selectAssistant('KPI', 'kpi:display:dashboard.holding', '待人工处理 ' + this.holdingCount(), 'overview-kpi'))
            MetricTile({ label: '批次通过率', value: this.passRate(), note: '完成 / 已判定批次', tone: 'PASS' }).onClick(() => this.selectAssistant('KPI', 'kpi:display:dashboard.passRate', '批次通过率 ' + this.passRate(), 'overview-kpi'))
          }.padding({ top: 14, bottom: 4 })
        }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).width('100%')

        Flex({ wrap: FlexWrap.Wrap }) {
          this.productionPanel()
          this.equipmentPanel()
          this.logisticsPanel()
          this.exceptionPanel()
          this.tracePanel()
        }.width('100%').padding({ top: 10, bottom: 24 })
      }.width('100%').alignItems(HorizontalAlign.Start)
    }.width('100%').height('100%').backgroundColor(Theme.page)
  }

  @Builder
  assistantPanel() {
    AssistantMountPoint({
      sourceApp: 'DISPLAY',
      pageRoute: 'pages/FactoryOverview',
      lineId: 'LINE-1',
      stateVersion: this.assistantStateVersion(),
      selectionType: this.assistantSelectionType,
      selectionId: this.assistantSelectionId,
      selectionLabel: this.assistantSelectionLabel,
      selectedText: this.assistantSelectedText,
      aiBase: AssistantHostAdapter.status().aiBase,
      unavailableReason: AssistantHostAdapter.status().unavailableReason
    }).margin({ left: 16, right: 16, top: 10, bottom: 8 })
  }

  @Builder
  stageCard(stage: StageDefinition, index: number) {
    Column() {
      Row() { Text((index + 1).toString().padStart(2, '0')).fontSize(9).fontColor(Theme.muted); Blank(); StateBadge({ status: this.stageStatus(stage), label: this.stageStatus(stage) === 'RUNNING' ? '持续运行' : this.stageStatus(stage) === 'REJECTED' ? '存在剔除' : '待处理' }) }.width('100%')
      Text(stage.name).fontSize(16).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 12 })
      Text(stage.description).fontSize(9).fontColor(Theme.muted).maxLines(2).lineHeight(14).margin({ top: 6 })
      Row() { Text('设备 ').fontSize(9).fontColor(Theme.muted); Text(this.bundle.runtime.devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold); Blank(); Text('缓冲 ').fontSize(9).fontColor(Theme.muted); Text(this.stageRuntime(stage.code).bufferLevel + '/' + this.stageRuntime(stage.code).bufferCapacity).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold) }.width('100%').margin({ top: 12 })
      Row() { Text('在制品 ' + this.stageProductCount(stage.code)).fontSize(9).fontColor(Theme.muted); Blank(); Text('速度 ' + (stage.code === 'AGV_TRANSPORT' ? '1.00 m/s' : '120 mm/s')).fontSize(9).fontColor(Theme.blue) }.width('100%').margin({ top: 7 })
      Blank()
      Row({ space: 6 }) {
        Button('问 AI').height(34).layoutWeight(1).fontSize(10).backgroundColor('#E7F0F5').fontColor(Theme.blue).border({ width: 1, color: Theme.line }).borderRadius(2).onClick(() => this.selectAssistant('STAGE', 'stage:' + stage.code, stage.name + '工位', 'overview-stage'))
        Button('进入工位').height(34).layoutWeight(1).backgroundColor(Theme.blue).borderRadius(2).onClick(() => router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } }))
      }.width('100%')
    }.width(198).height(220).alignItems(HorizontalAlign.Start).padding(13).backgroundColor(Theme.panel).border({ width: { top: 4, left: 1, right: 1, bottom: 2 }, color: statusColor(this.stageStatus(stage)) }).borderRadius(3)
  }

  @Builder
  productionPanel() {
    Column() {
      SectionTitle({ code: 'PRODUCTION & QUALITY', title: '生产与质量', description: '以持久化批次和工序事件为口径，不伪造 OEE。' })
      Row() { Text(this.passRate()).fontSize(30).fontColor(Theme.blue).fontWeight(FontWeight.Bold); Text('批次通过率').fontSize(10).fontColor(Theme.muted).margin({ left: 9, top: 13 }) }.width('100%').margin({ top: 14 })
      Progress({ value: this.finishedCount() > 0 ? this.completedCount() / this.finishedCount() * 100 : 0, total: 100, type: ProgressType.Linear }).width('100%').height(8).color(Theme.success).backgroundColor('#DDE8EF').margin({ top: 9 })
      Text('已判定 ' + this.finishedCount() + ' 批 · 通过 ' + this.completedCount() + ' 批 · 剔除 ' + this.rejectedCount() + ' 批').fontSize(9).fontColor(Theme.muted).margin({ top: 7 })
      Row() { this.smallValue('运行工位', this.runningStageCount() + '/' + FACTORY_STAGES.length, 'RUNNING'); this.smallValue('MQTT 实机', this.mqttCount().toString(), 'NORMAL'); this.smallValue('开放异常', (this.openAlarmCount() + this.openIncidentCount()).toString(), 'FAIL') }.width('100%').margin({ top: 16 })
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  equipmentPanel() {
    Column() {
      SectionTitle({ code: 'EQUIPMENT & CONSTRAINT', title: '设备与产线约束', description: '区分 MQTT 实机与无实机时的模拟兜底。' })
      Row() { this.smallValue('设备在线', this.onlineDeviceCount() + '/' + this.totalDeviceCount(), 'PASS'); this.smallValue('模拟兜底', this.bundle.runtime.devices.filter(item => item.fallback).length.toString(), 'WAIT') }.width('100%').margin({ top: 14 })
      Text('当前约束').fontSize(10).fontColor(Theme.muted).margin({ top: 18 })
      Text(this.constraintText()).fontSize(14).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text('各工位缓冲均无积压时，不根据单一速度值强行判定瓶颈。').fontSize(9).fontColor(Theme.muted).lineHeight(14).margin({ top: 6 })
      Row() { Text('在线设备 ' + this.onlineDeviceCount()).fontSize(10).fontColor(Theme.text); Blank(); Text(this.bundle.source).fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold) }.width('100%').margin({ top: 16 })
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  logisticsPanel() {
    Column() {
      SectionTitle({ code: 'LOGISTICS & WAREHOUSE', title: '物流与仓储', description: 'AGV 任务、避障距离、仓区安全和箱级库存。' })
      Row() { this.smallValue('AGV 任务', this.bundle.logistics.tasks.length.toString(), 'NORMAL'); this.smallValue('运输中', this.bundle.logistics.tasks.filter(item => item.status === 'RUNNING').length.toString(), 'PASS'); this.smallValue('库存箱', this.bundle.logistics.stock.length.toString(), 'NORMAL') }.width('100%').margin({ top: 14 })
      if (this.bundle.logistics.zones.length > 0) {
        Row() { Circle().width(8).height(8).fill(this.bundle.logistics.zones[0].status === 'SAFE' ? Theme.success : Theme.danger); Text('仓区 ' + this.bundle.logistics.zones[0].zoneCode + ' · ' + this.bundle.logistics.zones[0].status).fontSize(11).fontColor(Theme.text).margin({ left: 8 }); Blank(); Text('VOC ' + this.bundle.logistics.zones[0].vocPpm + ' ppm').fontSize(9).fontColor(Theme.muted) }.width('100%').padding(10).backgroundColor('#EEF7F2').margin({ top: 16 })
      }
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  exceptionPanel() {
    Column() {
      SectionTitle({ code: 'ACTIVE EXCEPTIONS', title: '异常与影响范围', description: '报警确认和异常解决必须经过后端鉴权。' })
      if (this.openAlarmCount() + this.openIncidentCount() === 0) {
        Row({ space: 8 }) { Circle().width(8).height(8).fill(Theme.success); Text('当前无开放异常，所有工位满足连续运行条件').fontSize(11).fontColor(Theme.text) }.width('100%').padding(14).backgroundColor('#EEF7F2').margin({ top: 14 })
      } else {
        ForEach(this.bundle.operations.alarms.filter(item => item.status === 'OPEN').slice(0, 4), (alarm: AlarmRecord) => {
          Row({ space: 10 }) { Circle().width(8).height(8).fill(Theme.danger); Column() { Text(alarm.alarmType + ' · ' + alarm.deviceCode).fontSize(10).fontColor(Theme.danger).fontWeight(FontWeight.Bold); Text(alarm.message).fontSize(9).fontColor(Theme.muted).margin({ top: 3 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1); Text(alarm.value === undefined ? '--' : alarm.value.toString()).fontSize(11).fontColor(Theme.danger).fontWeight(FontWeight.Bold) }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectAssistant('ALARM', 'alarm:' + alarm.alarmId, alarm.alarmType + ' · ' + alarm.deviceCode, 'overview-alarm'))
        }, (alarm: AlarmRecord) => alarm.alarmId)
      }
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  tracePanel() {
    Column() {
      SectionTitle({ code: 'RECENT PRODUCT TRACE', title: '最近产品追踪', description: '追踪号、瓶型、当前位置、结果和更新时间。' })
      ForEach(this.bundle.dashboard.runs.slice(0, 6), (run: FactoryRun) => {
        Row({ space: 9 }) { Text(run.traceCode).fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold).width(170); Text(run.bottleType || '待识别').fontSize(9).fontColor(Theme.text).width(80); Text(this.stageLabel(run.currentStage)).fontSize(9).fontColor(Theme.muted).layoutWeight(1); StateBadge({ status: run.status, label: this.statusLabel(run.status) }) }.width('100%').constraintSize({ minHeight: 44 }).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectAssistant('PRODUCT', 'product:' + run.traceCode, run.traceCode + ' · ' + (run.bottleType || '待识别'), 'overview-product'))
      }, (run: FactoryRun) => run.traceCode)
    }.width(800).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  smallValue(label: string, value: string, tone: string) {
    Column() { Text(label).fontSize(9).fontColor(Theme.muted); Text(value).fontSize(18).fontColor(statusColor(tone)).fontWeight(FontWeight.Bold).margin({ top: 5 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
  }

  private constraintText(): string {
    let level: number = 0
    let text: string = '暂无明显约束'
    this.bundle.runtime.stages.forEach(stage => {
      if (stage.bufferLevel > level) { level = stage.bufferLevel; text = this.stageLabel(stage.stageCode) }
    })
    return text
  }
}
