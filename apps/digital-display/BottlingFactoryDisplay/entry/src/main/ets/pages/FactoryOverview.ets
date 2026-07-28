import { router } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { SectionTitle, MetricTile, StateBadge } from '../components/IndustrialComponents'
import { FACTORY_STAGES } from '../config/FactoryStages'
import { FactoryRepository } from '../service/FactoryRepository'
import { createMockBundle } from '../service/MockFactoryData'
import { ApiConfig } from '../service/ApiConfig'
import { AssistantController, AssistantDock, AssistantEntityType } from '@bottling/harmony-assistant'
import { displayAssistantHost } from '../assistant/DisplayAssistantHostAdapter'
import {
  AlarmRecord,
  FactoryBundle,
  FactoryDashboard,
  FactoryIncident,
  FactoryRun,
  LogisticsOverview,
  OperationsOverview,
  RuntimeSnapshot,
  RuntimeStage,
  StageDefinition
} from '../model/FactoryModels'

@Entry
@Component
struct FactoryOverview {
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State revision: number = 0
  @State dashboardTotal: number = 0
  @State dashboardCompleted: number = 0
  @State dashboardRejected: number = 0
  @State dashboardHolding: number = 0
  @State dashboardWip: number = 0
  @State dashboardPassRate: string = '--'
  @State runningStageCount: number = 0
  @State mqttCount: number = 0
  @State openExceptionCount: number = 0
  @State onlineDeviceCount: number = 0
  @State totalDeviceCount: number = 0
  @State fallbackDeviceCount: number = 0
  @State assistantController: AssistantController = new AssistantController(displayAssistantHost)

  private fallbackBundle: FactoryBundle = createMockBundle()
  private refreshTimer: number = -1
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    this.syncSnapshot()
    displayAssistantHost.updatePage('pages/FactoryOverview', this.bundle)
    this.revision += 1
  }

  aboutToAppear(): void {
    displayAssistantHost.updatePage('pages/FactoryOverview', this.bundle)
    displayAssistantHost.publishVisibility('VISIBLE')
    FactoryRepository.subscribe(this.listener)
    this.syncSnapshot()
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
    this.refreshTimer = setInterval(() => void FactoryRepository.refresh(), ApiConfig.refreshIntervalMs)
  }

  aboutToDisappear(): void {
    displayAssistantHost.clearSelection('ARKUI')
    displayAssistantHost.publishVisibility('HIDDEN')
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
    if (this.refreshTimer >= 0) clearInterval(this.refreshTimer)
  }

  private dashboardData(): FactoryDashboard {
    return this.bundle.dashboard === undefined ? this.fallbackBundle.dashboard : this.bundle.dashboard
  }

  private operationsData(): OperationsOverview {
    return this.bundle.operations === undefined ? this.fallbackBundle.operations : this.bundle.operations
  }

  private runtimeData(): RuntimeSnapshot {
    return this.bundle.runtime === undefined ? this.fallbackBundle.runtime : this.bundle.runtime
  }

  private logisticsData(): LogisticsOverview {
    return this.bundle.logistics === undefined ? this.fallbackBundle.logistics : this.bundle.logistics
  }

  private dashboardRuns(): Array<FactoryRun> {
    const dashboard = this.dashboardData()
    return dashboard.runs === undefined ? [] : dashboard.runs
  }

  private safeCount(value: number | undefined): number {
    return value === undefined || value === null || value !== value ? 0 : value
  }

  private syncSnapshot(): void {
    const dashboard = this.dashboardData()
    const runtime = this.runtimeData()
    const operations = this.operationsData()
    const completed = this.safeCount(dashboard.completed)
    const rejected = this.safeCount(dashboard.rejected)
    const total = this.safeCount(dashboard.total)
    const holding = this.safeCount(dashboard.holding)
    this.dashboardTotal = total
    this.dashboardCompleted = completed
    this.dashboardRejected = rejected
    this.dashboardHolding = holding
    this.dashboardWip = Math.max(0, total - completed - rejected)
    const judged = completed + rejected
    this.dashboardPassRate = judged > 0 ? (completed / judged * 100).toFixed(1) + '%' : '--'
    this.runningStageCount = runtime.stages.filter(item => item.state === 'RUNNING').length
    this.mqttCount = runtime.devices.filter(item => item.source === 'MQTT' && !item.fallback).length
    this.onlineDeviceCount = runtime.devices.filter(item => item.state !== 'OFFLINE').length
    this.totalDeviceCount = runtime.devices.length
    this.fallbackDeviceCount = runtime.devices.filter(item => item.fallback).length
    this.openExceptionCount = operations.alarms.filter(item => item.status === 'OPEN').length + runtime.incidents.filter(item => item.status === 'OPEN').length
    displayAssistantHost.updatePage('pages/FactoryOverview', this.bundle)
  }

  private stageRuntime(code: string): RuntimeStage {
    let value: RuntimeStage = { stageCode: code, state: 'RUNNING', bufferLevel: 0, bufferCapacity: 6 }
    this.runtimeData().stages.forEach(item => {
      if (item.stageCode === code) value = item
    })
    return value
  }

  private stageProductCount(code: string): number {
    return this.dashboardRuns().filter(item => item.currentStage === code && (item.status === 'RUNNING' || item.status === 'HOLD')).length
  }

  private stageStatus(stage: StageDefinition): string {
    const runtime = this.stageRuntime(stage.code)
    const rejected = this.dashboardRuns().some(item => item.currentStage === stage.code && item.status === 'REJECTED')
    const alarm = this.operationsData().alarms.some(item => item.status === 'OPEN' && this.normalizeStage(item.stage || '', item.deviceCode) === stage.code)
    if (rejected) return 'REJECTED'
    if (runtime.state !== 'RUNNING' || alarm) return 'HOLD'
    return 'RUNNING'
  }

  private normalizeStage(stage: string, deviceCode: string): string {
    return stage === 'WAREHOUSE_SAFETY' || deviceCode.indexOf('WAREHOUSE') === 0 ? 'WAREHOUSE_INBOUND' : stage
  }

  private formatTime(value: string | undefined): string {
    return value === undefined ? '--' : value.replace('T', ' ').slice(0, 19)
  }

  private stageLabel(code: string): string {
    if (code === 'COMPLETED') return '完成入库'
    let label: string = code
    FACTORY_STAGES.forEach(stage => {
      if (stage.code === code) label = stage.name
    })
    return label
  }

  private statusLabel(status: string): string {
    return status === 'COMPLETED' ? '已入库' : status === 'REJECTED' ? '已剔除' : status === 'HOLD' ? '待处理' : '运行中'
  }

  private selectStage(stage: StageDefinition): void {
    displayAssistantHost.publishSelection(AssistantEntityType.STAGE, stage.code, stage.name, 'ARKUI', [
      { code: 'state', label: '状态', displayValue: this.stageStatus(stage) },
      { code: 'wip', label: '在制品', displayValue: this.stageProductCount(stage.code).toString() },
      { code: 'buffer', label: '缓冲', displayValue: this.stageRuntime(stage.code).bufferLevel + '/' + this.stageRuntime(stage.code).bufferCapacity }
    ])
  }

  private selectKpi(kpiCode: string, label: string, value: string): void {
    displayAssistantHost.publishSelection(AssistantEntityType.KPI, 'LINE-1:' + kpiCode, label, 'ARKUI', [
      { code: 'value', label: '当前值', displayValue: value },
      { code: 'source', label: '来源', displayValue: this.bundle.source }
    ])
  }

  private selectAlarm(alarm: AlarmRecord): void {
    displayAssistantHost.publishSelection(AssistantEntityType.ALARM, alarm.alarmId, alarm.alarmType + ' · ' + alarm.deviceCode, 'ARKUI', [
      { code: 'deviceCode', label: '设备', displayValue: alarm.deviceCode },
      { code: 'message', label: '报警', displayValue: alarm.message },
      { code: 'status', label: '状态', displayValue: alarm.status }
    ])
  }

  private selectProduct(run: FactoryRun): void {
    displayAssistantHost.publishSelection(AssistantEntityType.PRODUCT, run.traceCode, run.traceCode, 'ARKUI', [
      { code: 'bottleType', label: '瓶型', displayValue: run.bottleType || '待识别' },
      { code: 'stage', label: '当前工位', displayValue: this.stageLabel(run.currentStage) },
      { code: 'status', label: '状态', displayValue: this.statusLabel(run.status) }
    ])
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Scroll() {
      Column() {
        Row() {
          Column() {
            Text('BOTTLING LINE · NATIVE MONITOR').fontSize(10).fontColor('#A9CDE6').fontWeight(FontWeight.Bold)
            Text('智慧装瓶产线全局监控').fontSize(29).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 6 })
            Text('生产、质量、设备、物流与仓储一体化运行态势').fontSize(12).fontColor('#D2E0EB').margin({ top: 5 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Column() {
            StateBadge({
              status: this.bundle.online ? (this.openExceptionCount > 0 ? 'HOLD' : 'RUNNING') : 'STANDBY',
              label: this.bundle.online ? (this.openExceptionCount > 0 ? '连续运行 · 局部异常' : '后端在线') : 'LOCAL DEMO'
            })
            Text('实时通道：' + (FactoryRepository.realtimeOnline ? '在线' : '重连中')).fontSize(9).fontColor('#D2E0EB').margin({ top: 8 })
            Text(this.formatTime(this.bundle.updatedAt)).fontSize(8).fontColor('#B8CEDC').margin({ top: 4 })
          }.alignItems(HorizontalAlign.End)
        }.width('100%').padding(22).backgroundColor(Theme.navy)

        Row() {
          Text('全局总览').fontSize(10).fontColor(Theme.muted).fontWeight(FontWeight.Bold)
          Blank()
          Button('刷新数据').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => void FactoryRepository.refresh())
        }.width('100%').padding({ left: 16, right: 8, top: 4, bottom: 4 })

        Column() {
          SectionTitle({
            code: 'CONTINUOUS PRODUCTION FLOW',
            title: '整线生产流程',
            description: '点击任一工位查看设备、物料、质量门和异常影响。'
          })
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
            this.kpiTile('累计投入', String(this.dashboardTotal), '进入产线的追踪批次', 'total')
            this.kpiTile('完成入库', String(this.dashboardCompleted), '全流程完成', 'completed', 'PASS')
            this.kpiTile('在制品 WIP', String(this.dashboardWip), '运行或待处理', 'wip')
            this.kpiTile('检测剔除', String(this.dashboardRejected), '不合格品已隔离', 'rejected', 'FAIL')
            this.kpiTile('待人工处理', String(this.dashboardHolding), '暂停自动放行', 'holding', 'WAIT')
            this.kpiTile('批次通过率', this.dashboardPassRate, '完成 / 已判定批次', 'passRate', 'PASS')
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
      AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
        .margin({ top: 16, right: 16 })
    }.width('100%').height('100%')
  }

  @Builder
  stageCard(stage: StageDefinition, index: number) {
    Column() {
      Row() {
        Text((index + 1).toString().padStart(2, '0')).fontSize(9).fontColor(Theme.muted)
        Blank()
        StateBadge({ status: this.stageStatus(stage), label: this.stageStatus(stage) === 'RUNNING' ? '持续运行' : this.stageStatus(stage) === 'REJECTED' ? '存在剔除' : '待处理' })
      }.width('100%')
      Text(stage.name).fontSize(16).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 12 })
      Text(stage.description).fontSize(9).fontColor(Theme.muted).maxLines(2).lineHeight(14).margin({ top: 6 })
      Row() {
        Text('设备 ').fontSize(9).fontColor(Theme.muted)
        Text(this.runtimeData().devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold)
        Blank()
        Text('缓冲 ').fontSize(9).fontColor(Theme.muted)
        Text(this.stageRuntime(stage.code).bufferLevel + '/' + this.stageRuntime(stage.code).bufferCapacity).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      }.width('100%').margin({ top: 12 })
      Row() {
        Text('在制品 ' + this.stageProductCount(stage.code)).fontSize(9).fontColor(Theme.muted)
        Blank()
        Text('速度 ' + (stage.code === 'AGV_TRANSPORT' ? '1.00 m/s' : '120 mm/s')).fontSize(9).fontColor(Theme.blue)
      }.width('100%').margin({ top: 7 })
      Blank()
      Button('进入工位').width('100%').height(34).backgroundColor(Theme.blue).borderRadius(2).onClick(() => {
        this.selectStage(stage)
        router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
      })
    }.width(198).height(220).alignItems(HorizontalAlign.Start).padding(13).backgroundColor(Theme.panel).border({ width: { top: 4, left: 1, right: 1, bottom: 2 }, color: statusColor(this.stageStatus(stage)) }).borderRadius(3)
  }

  @Builder
  kpiTile(label: string, value: string, note: string, kpiCode: string, tone: string = 'NORMAL') {
    Stack() {
      MetricTile({ label: label, value: value, note: note, tone: tone })
    }.onClick(() => this.selectKpi(kpiCode, label, value))
  }

  @Builder
  productionPanel() {
    Column() {
      SectionTitle({ code: 'PRODUCTION & QUALITY', title: '生产与质量', description: '以持续产线和工序事件为口径，呈现当前放行态势。' })
      Row() { Text(this.dashboardPassRate).fontSize(30).fontColor(Theme.blue).fontWeight(FontWeight.Bold); Text('批次通过率').fontSize(10).fontColor(Theme.muted).margin({ left: 9, top: 13 }) }.width('100%').margin({ top: 14 })
      Progress({ value: this.dashboardCompleted + this.dashboardRejected > 0 ? this.dashboardCompleted / (this.dashboardCompleted + this.dashboardRejected) * 100 : 0, total: 100, type: ProgressType.Linear }).width('100%').height(8).color(Theme.success).backgroundColor('#DDE8EF').margin({ top: 9 })
      Text('已判定 ' + (this.dashboardCompleted + this.dashboardRejected) + ' 批 · 通过 ' + this.dashboardCompleted + ' 批 · 剔除 ' + this.dashboardRejected + ' 批').fontSize(9).fontColor(Theme.muted).margin({ top: 7 })
      Row() {
        this.smallValue('运行工位', this.runningStageCount + '/' + FACTORY_STAGES.length, 'RUNNING')
        this.smallValue('MQTT 实机', String(this.mqttCount), 'NORMAL')
        this.smallValue('开放异常', String(this.openExceptionCount), 'FAIL')
      }.width('100%').margin({ top: 16 })
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  equipmentPanel() {
    Column() {
      SectionTitle({ code: 'EQUIPMENT & CONSTRAINT', title: '设备与产线约束', description: '区分 MQTT 实机与模拟兜底，展示在线设备和约束来源。' })
      Row() {
        this.smallValue('设备在线', this.onlineDeviceCount + '/' + this.totalDeviceCount, 'PASS')
        this.smallValue('模拟兜底', String(this.fallbackDeviceCount), 'WAIT')
      }.width('100%').margin({ top: 14 })
      Text('当前约束').fontSize(10).fontColor(Theme.muted).margin({ top: 18 })
      Text(this.constraintText()).fontSize(14).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text('各工位缓冲不再一味按单一速度判定，而是由当前工位运行态和相邻工序联锁共同约束。').fontSize(9).fontColor(Theme.muted).lineHeight(14).margin({ top: 6 })
      Row() { Text('在线设备 ' + this.onlineDeviceCount).fontSize(10).fontColor(Theme.text); Blank(); Text(this.bundle.source).fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold) }.width('100%').margin({ top: 16 })
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  logisticsPanel() {
    Column() {
      SectionTitle({ code: 'LOGISTICS & WAREHOUSE', title: '物流与仓储', description: 'AGV 任务、避障距离、仓区安全和箱级库存。' })
      Row() {
        this.smallValue('AGV 任务', String(this.logisticsData().tasks.length), 'NORMAL')
        this.smallValue('运输中', String(this.logisticsData().tasks.filter(item => item.status === 'RUNNING').length), 'PASS')
        this.smallValue('库存箱', String(this.logisticsData().stock.length), 'NORMAL')
      }.width('100%').margin({ top: 14 })
      if (this.logisticsData().zones.length > 0) {
        Row() {
          Circle().width(8).height(8).fill(this.logisticsData().zones[0].status === 'SAFE' ? Theme.success : Theme.danger)
          Text('仓区 ' + this.logisticsData().zones[0].zoneCode + ' · ' + this.logisticsData().zones[0].status).fontSize(11).fontColor(Theme.text).margin({ left: 8 })
          Blank()
          Text('VOC ' + this.logisticsData().zones[0].vocPpm + ' ppm').fontSize(9).fontColor(Theme.muted)
        }.width('100%').padding(10).backgroundColor('#EEF7F2').margin({ top: 16 })
      }
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  exceptionPanel() {
    Column() {
      SectionTitle({ code: 'ACTIVE EXCEPTIONS', title: '异常与影响范围', description: '报警确认与工艺影响必须经过后端判定。' })
      if (this.openExceptionCount === 0) {
        Row({ space: 8 }) { Circle().width(8).height(8).fill(Theme.success); Text('当前无开放异常，所有工位满足连续运行条件。').fontSize(11).fontColor(Theme.text) }.width('100%').padding(14).backgroundColor('#EEF7F2').margin({ top: 14 })
      } else {
        ForEach(this.operationsData().alarms.filter(item => item.status === 'OPEN').slice(0, 4), (alarm: AlarmRecord) => {
          Row({ space: 10 }) {
            Circle().width(8).height(8).fill(Theme.danger)
            Column() {
              Text(alarm.alarmType + ' · ' + alarm.deviceCode).fontSize(10).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
              Text(alarm.message).fontSize(9).fontColor(Theme.muted).margin({ top: 3 })
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            Text(alarm.value === undefined ? '--' : alarm.value.toString()).fontSize(11).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
          }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectAlarm(alarm))
        }, (alarm: AlarmRecord) => alarm.alarmId)
      }
    }.width(390).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  tracePanel() {
    Column() {
      SectionTitle({ code: 'RECENT PRODUCT TRACE', title: '最近产品追踪', description: '追踪号、瓶型、当前位置、结果和更新时间。' })
      ForEach(this.dashboardRuns().slice(0, 6), (run: FactoryRun) => {
        Row({ space: 9 }) {
          Text(run.traceCode).fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold).width(170)
          Text(run.bottleType || '待识别').fontSize(9).fontColor(Theme.text).width(80)
          Text(this.stageLabel(run.currentStage)).fontSize(9).fontColor(Theme.muted).layoutWeight(1)
          StateBadge({ status: run.status, label: this.statusLabel(run.status) })
        }.width('100%').constraintSize({ minHeight: 44 }).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectProduct(run))
      }, (run: FactoryRun) => run.traceCode)
    }.width(800).constraintSize({ minHeight: 220 }).alignItems(HorizontalAlign.Start).padding(17).margin(5).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  @Builder
  smallValue(label: string, value: string, tone: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.muted)
      Text(value).fontSize(18).fontColor(statusColor(tone)).fontWeight(FontWeight.Bold).margin({ top: 5 })
    }.alignItems(HorizontalAlign.Start).layoutWeight(1)
  }

  private constraintText(): string {
    let level: number = 0
    let text: string = '暂无明显约束'
    this.runtimeData().stages.forEach(stage => {
      if (stage.bufferLevel > level) {
        level = stage.bufferLevel
        text = this.stageLabel(stage.stageCode)
      }
    })
    return text
  }
}
