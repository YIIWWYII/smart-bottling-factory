import { router } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { SectionTitle, MetricTile, StateBadge } from '../components/IndustrialComponents'
import { FactoryOverviewScene } from '../components/FactoryOverviewScene'
import { FACTORY_STAGES, findStage } from '../config/FactoryStages'
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

class OverviewStagePayload {
  code: string = ''
  state: string = ''
  wip: number = 0
  onlineDevices: number = 0
  totalDevices: number = 0
}

class OverviewProductPayload {
  traceCode: string = ''
  status: string = ''
}

interface OverviewScenePayload {
  stateVersion: number
  source: string
  speed: number
  stages: Array<OverviewStagePayload>
  products: Array<OverviewProductPayload>
}

@Entry
@Component
struct FactoryOverview {
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State realtimeOnline: boolean = FactoryRepository.realtimeOnline
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
  @State mapPulse: number = 0
  @State assistantController: AssistantController = new AssistantController(displayAssistantHost)

  private fallbackBundle: FactoryBundle = createMockBundle()
  private refreshTimer: number = -1
  private pulseTimer: number = -1
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    this.realtimeOnline = FactoryRepository.realtimeOnline
    this.syncSnapshot()
    displayAssistantHost.updatePage('pages/FactoryOverview', this.bundle)
    this.revision += 1
  }

  aboutToAppear(): void {
    displayAssistantHost.updatePage('pages/FactoryOverview', this.bundle)
    displayAssistantHost.publishVisibility('VISIBLE')
    FactoryRepository.subscribe(this.listener)
    this.realtimeOnline = FactoryRepository.realtimeOnline
    this.syncSnapshot()
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
    this.refreshTimer = setInterval(() => void FactoryRepository.refresh(), ApiConfig.refreshIntervalMs)
    this.pulseTimer = setInterval(() => this.mapPulse = (this.mapPulse + 1) % 4, 900)
  }

  aboutToDisappear(): void {
    displayAssistantHost.clearSelection('ARKUI')
    displayAssistantHost.publishVisibility('HIDDEN')
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
    if (this.refreshTimer >= 0) clearInterval(this.refreshTimer)
    if (this.pulseTimer >= 0) clearInterval(this.pulseTimer)
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
    displayAssistantHost.publishSelection(AssistantEntityType.KPI, 'LINE-01:' + kpiCode, label, 'ARKUI', [
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
        Column({ space: 0 }) {
          this.commandHeader()
          this.processRail()
          this.lineHero()
          this.overviewLedger()
        }.width('100%').alignItems(HorizontalAlign.Start).backgroundColor(Theme.page)
      }.width('100%').height('100%').backgroundColor(Theme.page)
      AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
        .margin({ top: 16, right: 16 })
    }.width('100%').height('100%')
  }

  @Builder
  commandHeader() {
    Row() {
      Row({ space: 14 }) {
        Column() {
          Text('L01').fontSize(11).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('LINE').fontSize(7).fontColor(Theme.onDarkMuted).margin({ top: 3 })
        }.width(34).alignItems(HorizontalAlign.Start)
        Column() {
          Text('智慧装瓶产线').fontSize(25).fontColor(Theme.onDark).fontWeight(FontWeight.Bold)
          Text('实时生产控制室  /  LIVE PRODUCTION CONTROL').fontSize(8).fontColor(Theme.onDarkMuted).margin({ top: 5 })
        }.alignItems(HorizontalAlign.Start)
      }.layoutWeight(1)
      Row({ space: 18 }) {
        Column() {
          Text('LINE STATE').fontSize(7).fontColor(Theme.onDarkMuted).fontWeight(FontWeight.Bold)
          Row({ space: 6 }) {
            Circle().width(7).height(7).fill(this.bundle.online ? Theme.success : Theme.warning)
            Text(this.bundle.online ? '连续运行' : '本地演示').fontSize(11).fontColor(Theme.onDark).fontWeight(FontWeight.Bold)
          }.margin({ top: 5 })
        }.alignItems(HorizontalAlign.Start)
        Column() {
          Text('DATA LINK').fontSize(7).fontColor(Theme.onDarkMuted).fontWeight(FontWeight.Bold)
          Text(this.realtimeOnline ? 'MQTT  LIVE' : 'MQTT  FALLBACK').fontSize(10).fontColor(this.realtimeOnline ? Theme.success : Theme.warning).fontWeight(FontWeight.Bold).margin({ top: 7 })
        }.alignItems(HorizontalAlign.Start)
        Button('刷新数据').type(ButtonType.Normal).height(32).width(78).fontSize(9).fontColor(Theme.onDark).backgroundColor(Theme.blue).borderRadius(2).onClick(() => void FactoryRepository.refresh())
      }.alignItems(VerticalAlign.Center)
    }.width('100%').padding({ left: 36, right: 170, top: 16, bottom: 14 }).backgroundColor(Theme.navy).border({ width: { bottom: 1 }, color: Theme.lineStrong })
  }

  @Builder
  lineHero() {
    Column() {
      Row() {
        Column() {
          Row({ space: 8 }) {
            Text('01').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
            Text('LINE OVERVIEW').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
          }
          Text('产线实时拓扑').fontSize(22).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 6 })
          Text('点击工位进入独立作业页 · 图形、物料与实时状态保持同一快照').fontSize(9).fontColor(Theme.muted).margin({ top: 5 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Row({ space: 22 }) {
          this.heroMetric('运行工位', this.runningStageCount + '/' + FACTORY_STAGES.length, Theme.success)
          this.heroMetric('在制品', String(this.dashboardWip), Theme.accent)
          this.heroMetric('开放异常', String(this.openExceptionCount), this.openExceptionCount > 0 ? Theme.danger : Theme.success)
        }.alignItems(VerticalAlign.Center)
      }.width('100%').padding({ left: 30, right: 30, top: 20, bottom: 16 })

      Row({ space: 0 }) {
        Column() {
          FactoryOverviewScene({
            payload: this.overviewScenePayload(),
            heightValue: 468,
            onStageSelected: (stageCode: string): void => this.openStage(stageCode)
          }).width('100%')
          Row() {
            Text('物流路径').fontSize(8).fontColor(Theme.muted)
            Text('瓶体  →  气体安全  →  外观  →  灌装  →  二检  →  装箱  →  AGV  →  入库').fontSize(9).fontColor(Theme.text).margin({ left: 12 })
            Blank()
            Text('STATE v' + this.bundle.stateVersion).fontSize(8).fontColor(Theme.muted)
          }.width('100%').padding({ left: 16, right: 16, top: 9, bottom: 11 }).backgroundColor(Theme.panelSoft)
        }.layoutWeight(1).height(500).padding({ left: 18, right: 8 }).backgroundColor('#071015')

        Column() {
          Row() {
            Text('02').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
            Text('WATCHLIST').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold).margin({ left: 8 })
          }
          Text('运行监视').fontSize(18).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 7 })
          Divider().strokeWidth(1).color(Theme.line).margin({ top: 14, bottom: 14 })
          this.monitorValue('批次通过率', this.dashboardPassRate, 'QUALITY GATE', Theme.success)
          this.monitorValue('设备在线', this.onlineDeviceCount + ' / ' + this.totalDeviceCount, this.realtimeOnline ? 'MQTT LIVE' : 'LOCAL DEMO', Theme.accent)
          this.monitorValue('待处理事件', String(this.openExceptionCount), this.openExceptionCount > 0 ? 'REQUIRES REVIEW' : 'NO OPEN ALARMS', this.openExceptionCount > 0 ? Theme.danger : Theme.success)
          Divider().strokeWidth(1).color(Theme.line).margin({ top: 3, bottom: 13 })
          Row({ space: 7 }) {
            Circle().width(7).height(7).fill(this.openExceptionCount > 0 ? Theme.warning : Theme.success)
            Text(this.openExceptionCount > 0 ? '存在待确认事件' : '所有工位满足连续运行条件').fontSize(9).fontColor(this.openExceptionCount > 0 ? Theme.warning : Theme.success).fontWeight(FontWeight.Bold)
          }
          Text('数据时间').fontSize(8).fontColor(Theme.muted).margin({ top: 18 })
          Text(this.formatTime(this.bundle.updatedAt)).fontSize(10).fontColor(Theme.text).margin({ top: 5 })
          Text('实时数据、模拟数据均沿用同一状态模型').fontSize(8).fontColor(Theme.muted).margin({ top: 5 })
        }.width(236).height(500).alignItems(HorizontalAlign.Start).padding({ left: 20, right: 18, top: 18, bottom: 16 }).backgroundColor(Theme.panel).border({ width: { left: 1 }, color: Theme.line })
      }.width('100%').height(500)
    }.width('100%').backgroundColor(Theme.page).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  heroMetric(label: string, value: string, color: string) {
    Column() {
      Text(label).fontSize(7).fontColor(Theme.muted)
      Text(value).fontSize(20).fontColor(color).fontWeight(FontWeight.Bold).margin({ top: 4 })
    }.alignItems(HorizontalAlign.End)
  }

  @Builder
  monitorValue(label: string, value: string, note: string, color: string) {
    Column() {
      Text(label).fontSize(8).fontColor(Theme.muted)
      Text(value).fontSize(21).fontColor(color).fontWeight(FontWeight.Bold).margin({ top: 4 })
      Text(note).fontSize(7).fontColor(Theme.muted).margin({ top: 3 })
    }.alignItems(HorizontalAlign.Start).margin({ bottom: 12 })
  }

  @Builder
  processRail() {
    Column() {
      Row() {
        Column() {
          Row({ space: 8 }) {
            Text('03').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
            Text('PROCESS RAIL').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
          }
          Text('工序状态轨道').fontSize(16).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 5 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Text('运行中的连续工序  ·  点击节点查看工位').fontSize(8).fontColor(Theme.muted)
      }.width('100%').padding({ left: 30, right: 30, top: 18, bottom: 12 })
      Row() {
        ForEach(FACTORY_STAGES, (stage: StageDefinition, index: number) => {
          this.processRailNode(stage, index)
          if (index < FACTORY_STAGES.length - 1) {
            Text('›').fontSize(18).fontColor(Theme.blue).margin({ left: 5, right: 5 })
          }
        }, (stage: StageDefinition) => stage.code)
      }.width('100%').padding({ left: 26, right: 26, bottom: 20 }).alignItems(VerticalAlign.Center)
    }.width('100%').backgroundColor(Theme.panel).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  processRailNode(stage: StageDefinition, index: number) {
    Column() {
      Row() {
        Text((index + 1).toString().padStart(2, '0')).fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
        Blank()
        Circle().width(7).height(7).fill(statusColor(this.stageStatus(stage)))
      }.width('100%')
      Text(stage.name).fontSize(10).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 8 }).maxLines(1)
      Text(stage.code).fontSize(6).fontColor(Theme.muted).margin({ top: 4 }).maxLines(1)
      Row() {
        Text('WIP ' + this.stageProductCount(stage.code)).fontSize(7).fontColor(statusColor(this.stageStatus(stage))).fontWeight(FontWeight.Bold)
        Blank()
        Text(this.runtimeData().devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length).fontSize(7).fontColor(Theme.muted)
      }.width('100%').margin({ top: 7 })
    }.width(124).height(74).padding({ left: 10, right: 10, top: 8, bottom: 7 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: statusColor(this.stageStatus(stage)) }).onClick(() => this.openStage(stage.code))
  }

  @Builder
  overviewLedger() {
    Row({ space: 0 }) {
      Column() {
        Row({ space: 8 }) {
          Text('04').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('LINE LEDGER').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
        }
        Text('生产台账').fontSize(16).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 5 })
        Row({ space: 28 }) {
          this.ledgerValue('投入批次', String(this.dashboardTotal), Theme.text)
          this.ledgerValue('完成入库', String(this.dashboardCompleted), Theme.success)
          this.ledgerValue('剔除隔离', String(this.dashboardRejected), Theme.danger)
          this.ledgerValue('人工复核', String(this.dashboardHolding), Theme.warning)
        }.width('100%').margin({ top: 18 })
        Divider().strokeWidth(1).color(Theme.line).margin({ top: 18, bottom: 4 })
        Text('最近追溯').fontSize(9).fontColor(Theme.muted).margin({ top: 8, bottom: 2 })
        ForEach(this.dashboardRuns().slice(0, 4), (run: FactoryRun) => {
          Row() {
            Circle().width(6).height(6).fill(statusColor(run.status))
            Text(run.traceCode).fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold).margin({ left: 9 }).layoutWeight(1)
            Text(this.stageLabel(run.currentStage)).fontSize(8).fontColor(Theme.muted)
            Text(this.statusLabel(run.status)).fontSize(8).fontColor(statusColor(run.status)).margin({ left: 12 })
          }.width('100%').padding({ top: 9, bottom: 9 }).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectProduct(run))
        }, (run: FactoryRun) => run.traceCode)
      }.layoutWeight(2).alignItems(HorizontalAlign.Start).padding({ left: 30, right: 28, top: 22, bottom: 28 }).backgroundColor(Theme.panel)
      Column() {
        Row({ space: 8 }) {
          Text('05').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('EVENTS').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
        }
        Text('事件与安全').fontSize(16).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 5 })
        if (this.openExceptionCount === 0) {
          Row({ space: 8 }) { Circle().width(7).height(7).fill(Theme.success); Text('当前无开放异常').fontSize(10).fontColor(Theme.success).fontWeight(FontWeight.Bold) }.width('100%').padding({ top: 21 })
        } else {
          ForEach(this.operationsData().alarms.filter(item => item.status === 'OPEN').slice(0, 3), (alarm: AlarmRecord) => {
            Row({ space: 8 }) {
              Circle().width(7).height(7).fill(Theme.danger)
              Column() { Text(alarm.alarmType + ' · ' + alarm.deviceCode).fontSize(9).fontColor(Theme.danger).fontWeight(FontWeight.Bold); Text(alarm.message).fontSize(8).fontColor(Theme.muted).margin({ top: 4 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            }.width('100%').padding({ top: 13, bottom: 11 }).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectAlarm(alarm))
          }, (alarm: AlarmRecord) => alarm.alarmId)
        }
        Divider().strokeWidth(1).color(Theme.line).margin({ top: 16, bottom: 16 })
        Text('物流与仓储').fontSize(10).fontColor(Theme.muted)
        Row() {
          this.darkFooterMetric('AGV任务', String(this.logisticsData().tasks.length), Theme.text)
          this.darkFooterMetric('运输中', String(this.logisticsData().tasks.filter(item => item.status === 'RUNNING').length), Theme.success)
          this.darkFooterMetric('库存箱', String(this.logisticsData().stock.length), Theme.accent)
        }.width('100%').margin({ top: 13 })
      }.layoutWeight(1).alignItems(HorizontalAlign.Start).padding({ left: 28, right: 30, top: 22, bottom: 28 }).backgroundColor(Theme.panelSoft).border({ width: { left: 1 }, color: Theme.line })
    }.width('100%').backgroundColor(Theme.panel).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  ledgerValue(label: string, value: string, color: string) {
    Column() {
      Text(label).fontSize(8).fontColor(Theme.muted)
      Text(value).fontSize(20).fontColor(color).fontWeight(FontWeight.Bold).margin({ top: 4 })
    }.alignItems(HorizontalAlign.Start).layoutWeight(1)
  }

  private overviewScenePayload(): string {
    const stages: Array<OverviewStagePayload> = []
    FACTORY_STAGES.forEach((stage: StageDefinition) => {
      const item = new OverviewStagePayload()
      item.code = stage.code
      item.state = this.stageStatus(stage)
      item.wip = this.stageProductCount(stage.code)
      item.onlineDevices = this.runtimeData().devices.filter(device => device.stageCode === stage.code && device.state !== 'OFFLINE').length
      item.totalDevices = stage.devices.length
      stages.push(item)
    })
    const products: Array<OverviewProductPayload> = []
    this.dashboardRuns().filter(item => item.status === 'RUNNING' || item.status === 'HOLD').slice(0, 8).forEach((run: FactoryRun) => {
      const item = new OverviewProductPayload()
      item.traceCode = run.traceCode
      item.status = run.status
      products.push(item)
    })
    let speed: number = 0.12
    this.runtimeData().devices.forEach(device => {
      if (device.speedMps !== undefined && device.speedMps > speed) speed = device.speedMps
    })
    const payload: OverviewScenePayload = {
      stateVersion: this.bundle.stateVersion,
      source: this.bundle.source,
      speed: speed,
      stages: stages,
      products: products
    }
    return JSON.stringify(payload)
  }

  private openStage(stageCode: string): void {
    const stage = findStage(stageCode)
    this.selectStage(stage)
    router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stageCode } })
  }

  @Builder
  controlHeader() {
    Row() {
      Column() {
        Row({ space: 12 }) {
          Text('L01').fontSize(13).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('智慧装瓶产线').fontSize(30).fontColor(Theme.onDark).fontWeight(FontWeight.Bold)
        }
        Text('LINE CONTROL ROOM  /  LIVE PRODUCTION TWIN').fontSize(9).fontColor(Theme.onDarkMuted).margin({ top: 7 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Row({ space: 22 }) {
        Column() {
          Text('LINE CONDITION').fontSize(8).fontColor(Theme.onDarkMuted).fontWeight(FontWeight.Bold)
          Row({ space: 7 }) {
            Circle().width(9).height(9).fill(this.bundle.online ? Theme.success : Theme.warning)
            Text(this.bundle.online ? 'RUNNING' : 'LOCAL DEMO').fontSize(13).fontColor(Theme.onDark).fontWeight(FontWeight.Bold)
          }.margin({ top: 7 })
        }.alignItems(HorizontalAlign.Start)
        Column() {
          Text('DATA LINK').fontSize(8).fontColor(Theme.onDarkMuted).fontWeight(FontWeight.Bold)
          Text(this.realtimeOnline ? 'MQTT / LIVE' : 'MQTT / FALLBACK').fontSize(11).fontColor(this.realtimeOnline ? Theme.success : Theme.warning).fontWeight(FontWeight.Bold).margin({ top: 8 })
          Text('STATE v' + this.bundle.stateVersion + '  ' + this.formatTime(this.bundle.updatedAt)).fontSize(8).fontColor(Theme.onDarkMuted).margin({ top: 4 })
        }.alignItems(HorizontalAlign.End)
        Button('刷新数据').type(ButtonType.Normal).height(36).width(82).fontSize(10).fontColor(Theme.onDark).backgroundColor(Theme.blue).borderRadius(2).onClick(() => void FactoryRepository.refresh())
      }.alignItems(VerticalAlign.Center)
    }.width('100%').padding({ left: 38, right: 166, top: 18, bottom: 18 }).backgroundColor(Theme.navy).border({ width: { bottom: 3 }, color: Theme.accent })
  }

  @Builder
  productionMap() {
    Column() {
      Row() {
        Column() {
          Text('01 / PRODUCTION TOPOLOGY').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('产线实时拓扑').fontSize(23).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).margin({ top: 5 })
          Text('连续工序 · 双支线汇流 · 物料沿线流转').fontSize(9).fontColor(Theme.onDarkMuted).margin({ top: 5 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Row({ space: 18 }) {
          Column() {
            Text('RUNNING STATIONS').fontSize(8).fontColor(Theme.onDarkMuted)
            Text(this.runningStageCount + '/' + FACTORY_STAGES.length).fontSize(22).fontColor(Theme.success).fontWeight(FontWeight.Bold).margin({ top: 4 })
          }.alignItems(HorizontalAlign.End)
          Column() {
            Text('WIP ON LINE').fontSize(8).fontColor(Theme.onDarkMuted)
            Text(String(this.dashboardWip)).fontSize(22).fontColor(Theme.accent).fontWeight(FontWeight.Bold).margin({ top: 4 })
          }.alignItems(HorizontalAlign.End)
          Row({ space: 12 }) {
            this.darkLegend(Theme.success, '运行')
            this.darkLegend(Theme.warning, '等待')
            this.darkLegend(Theme.danger, '异常')
          }
        }.alignItems(VerticalAlign.Center)
      }.width('100%').padding({ left: 26, right: 26, top: 20, bottom: 16 })

      Row({ space: 0 }) {
        Column() {
          FactoryOverviewScene({
            payload: this.overviewScenePayload(),
            heightValue: 448,
            onStageSelected: (stageCode: string): void => this.openStage(stageCode)
          }).width('100%')
          Row() {
            Text('物料流向').fontSize(8).fontColor(Theme.onDarkMuted)
            Text('瓶体 → 气体安全 → 外观 → 灌装 ← 饮料 → 二检 → 装箱 → AGV → 入库').fontSize(9).fontColor(Theme.onDark).margin({ left: 12 })
            Blank()
            Text('STATE v' + this.bundle.stateVersion).fontSize(8).fontColor(Theme.onDarkMuted)
          }.width('100%').padding({ left: 18, right: 18, top: 10, bottom: 12 }).backgroundColor('#13242C')
        }.layoutWeight(1).height(492).padding({ left: 14, right: 8, bottom: 0 }).backgroundColor('#08141A')

        Column() {
          Text('02 / WATCHLIST').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('运行监视').fontSize(18).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).margin({ top: 6 })
          Divider().strokeWidth(1).color(Theme.lineStrong).margin({ top: 15, bottom: 15 })
          this.watchValue('在制品', String(this.dashboardWip), 'WIP / RUNNING', Theme.accent)
          this.watchValue('批次通过率', this.dashboardPassRate, 'QUALITY GATE', Theme.success)
          this.watchValue('开放异常', String(this.openExceptionCount), 'REQUIRES REVIEW', this.openExceptionCount > 0 ? Theme.danger : Theme.success)
          Divider().strokeWidth(1).color(Theme.lineStrong).margin({ top: 4, bottom: 14 })
          Row({ space: 8 }) {
            Circle().width(8).height(8).fill(this.openExceptionCount > 0 ? Theme.warning : Theme.success)
            Text(this.openExceptionCount > 0 ? '存在待确认事件' : '当前无开放异常').fontSize(10).fontColor(this.openExceptionCount > 0 ? Theme.warning : Theme.success).fontWeight(FontWeight.Bold)
          }
          Text('设备在线').fontSize(8).fontColor(Theme.onDarkMuted).margin({ top: 18 })
          Text(this.onlineDeviceCount + ' / ' + this.totalDeviceCount).fontSize(20).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).margin({ top: 4 })
          Text(this.realtimeOnline ? 'MQTT 实时链路' : '本地模拟链路').fontSize(9).fontColor(this.realtimeOnline ? Theme.success : Theme.warning).margin({ top: 4 })
          Text('点击画布中的工位进入独立作业页').fontSize(9).fontColor(Theme.onDarkMuted).margin({ top: 30 })
        }.width(238).height(492).alignItems(HorizontalAlign.Start).padding({ left: 20, right: 20, top: 18, bottom: 14 }).backgroundColor('#0E1B22').border({ width: { left: 1 }, color: Theme.lineStrong })
      }.width('100%').height(492)
    }.width('100%').padding({ bottom: 14 }).backgroundColor(Theme.navy).border({ width: { top: 1, bottom: 1 }, color: Theme.lineStrong })
  }

  @Builder
  darkLegend(color: string, label: string) {
    Row({ space: 5 }) { Circle().width(7).height(7).fill(color); Text(label).fontSize(9).fontColor(Theme.onDarkMuted) }
  }

  @Builder
  mapLaneLabel(title: string, code: string) {
    Column() {
      Text(title).fontSize(10).fontColor(Theme.onDark).fontWeight(FontWeight.Bold)
      Text(code).fontSize(7).fontColor(Theme.onDarkMuted).margin({ top: 5 })
    }.width(76).alignItems(HorizontalAlign.Start).justifyContent(FlexAlign.Center)
  }

  @Builder
  mapStage(stage: StageDefinition, indexLabel: string) {
    Column() {
      Row() {
        Text(indexLabel).fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
        Blank()
        Circle().width(8).height(8).fill(statusColor(this.stageStatus(stage)))
      }.width('100%')
      Text(stage.name).fontSize(11).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).margin({ top: 8 }).maxLines(1)
      Text(stage.code).fontSize(6).fontColor(Theme.onDarkMuted).margin({ top: 4 }).maxLines(1)
      Row() {
        Text('D ' + this.runtimeData().devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length).fontSize(7).fontColor(Theme.onDarkMuted)
        Blank()
        Text('W ' + this.stageProductCount(stage.code)).fontSize(7).fontColor(statusColor(this.stageStatus(stage))).fontWeight(FontWeight.Bold)
      }.width('100%').margin({ top: 7 })
    }.width(116).height(84).padding({ left: 10, right: 10, top: 9, bottom: 6 }).backgroundColor('#12252D').border({ width: { left: 3, top: 1, right: 1, bottom: 1 }, color: statusColor(this.stageStatus(stage)) }).onClick(() => {
      this.selectStage(stage)
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
    })
  }

  @Builder
  mapMerge(stage: StageDefinition) {
    Column() {
      Row() { Text('05').fontSize(8).fontColor(Theme.warning).fontWeight(FontWeight.Bold); Blank(); Circle().width(8).height(8).fill(statusColor(this.stageStatus(stage))) }.width('100%')
      Text('灌装汇流').fontSize(11).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).margin({ top: 8 })
      Text('BOTTLE + BEVERAGE').fontSize(6).fontColor(Theme.warning).margin({ top: 4 })
      Text('定位 · 定量 · 液位').fontSize(7).fontColor(Theme.onDarkMuted).margin({ top: 7 })
    }.width(116).height(84).padding({ left: 10, right: 10, top: 9, bottom: 6 }).backgroundColor('#3A2A15').border({ width: { left: 3, top: 1, right: 1, bottom: 1 }, color: Theme.warning }).onClick(() => {
      this.selectStage(stage)
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
    })
  }

  @Builder
  mapFlow() {
    Column() {
      Divider().strokeWidth(2).color(Theme.lineStrong)
      Row({ space: 3 }) {
        Circle().width(4).height(4).fill(this.mapPulse === 0 ? Theme.accent : Theme.lineStrong)
        Circle().width(4).height(4).fill(this.mapPulse === 1 ? Theme.accent : Theme.lineStrong)
        Circle().width(4).height(4).fill(this.mapPulse === 2 ? Theme.accent : Theme.lineStrong)
      }.margin({ top: 5 })
    }.width(25).justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
  }

  @Builder
  mapVerticalFlow() {
    Column() {
      Divider().strokeWidth(2).color(Theme.warning)
      Text('↓').fontSize(13).fontColor(Theme.warning).margin({ top: 2 })
    }.width(24).justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
  }

  @Builder
  watchValue(label: string, value: string, note: string, color: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.onDarkMuted)
      Text(value).fontSize(22).fontColor(color).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text(note).fontSize(7).fontColor(Theme.onDarkMuted).margin({ top: 3 })
    }.alignItems(HorizontalAlign.Start).margin({ bottom: 12 })
  }

  @Builder
  pulseBand() {
    Row() {
      Column() {
        Text('02 / PRODUCTION PULSE').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
        Text('生产脉搏').fontSize(18).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 5 })
      }.width(190).alignItems(HorizontalAlign.Start)
      this.lightMetric('投入追踪', String(this.dashboardTotal), 'BATCHES', 'NORMAL')
      this.lightMetric('在制 WIP', String(this.dashboardWip), 'RUNNING / HOLD', 'NORMAL')
      this.lightMetric('完成入库', String(this.dashboardCompleted), 'BATCHES', 'PASS')
      this.lightMetric('通过率', this.dashboardPassRate, 'QUALITY', 'PASS')
      this.lightMetric('已剔除', String(this.dashboardRejected), 'ISOLATED', 'FAIL')
      this.lightMetric('人工处理', String(this.dashboardHolding), 'REVIEW', 'WAIT')
    }.width('100%').padding({ left: 38, right: 38, top: 20, bottom: 20 }).backgroundColor(Theme.panel).border({ width: { top: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  lightMetric(label: string, value: string, note: string, tone: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.muted)
      Text(value).fontSize(22).fontColor(tone === 'NORMAL' ? Theme.text : statusColor(tone)).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text(note).fontSize(7).fontColor(Theme.muted).margin({ top: 4 })
    }.layoutWeight(1).alignItems(HorizontalAlign.Start).padding({ left: 16 }).border({ width: { left: 1 }, color: Theme.line })
  }

  @Builder
  overviewFooter() {
    Row({ space: 0 }) {
      Column() {
        SectionTitle({ code: '03 / STATION MATRIX', title: '工序状态矩阵', description: '实时工位、设备和在制品状态', dark: true })
        Row() {
          Text('工位').fontSize(8).fontColor(Theme.onDarkMuted).width(190)
          Text('状态').fontSize(8).fontColor(Theme.onDarkMuted).width(100)
          Text('设备在线').fontSize(8).fontColor(Theme.onDarkMuted).width(110)
          Text('在制品').fontSize(8).fontColor(Theme.onDarkMuted).width(90)
          Text('缓冲').fontSize(8).fontColor(Theme.onDarkMuted).layoutWeight(1)
        }.width('100%').padding({ left: 12, right: 12, top: 14, bottom: 9 }).border({ width: { bottom: 1 }, color: Theme.lineStrong })
        ForEach(FACTORY_STAGES, (stage: StageDefinition, index: number) => {
          this.stationMatrixRow(stage, index)
        }, (stage: StageDefinition) => stage.code)
        Row({ space: 14 }) {
          Text('通过率').fontSize(9).fontColor(Theme.onDarkMuted)
          Text(this.dashboardPassRate).fontSize(20).fontColor(Theme.success).fontWeight(FontWeight.Bold)
          Text('已入库 ' + this.dashboardCompleted + ' · 已剔除 ' + this.dashboardRejected + ' · 待确认 ' + this.dashboardHolding).fontSize(9).fontColor(Theme.onDarkMuted)
        }.width('100%').padding({ left: 12, top: 14, bottom: 8 })
      }.layoutWeight(2).height('100%').alignItems(HorizontalAlign.Start).padding({ left: 38, right: 28, top: 24, bottom: 28 }).backgroundColor(Theme.navy)
      Column() {
        SectionTitle({ code: '04 / TRACE', title: '事件与追溯', description: '异常优先 · 点击查看对应实体', dark: true })
        if (this.openExceptionCount === 0) {
          Row({ space: 8 }) { Circle().width(8).height(8).fill(Theme.success); Text('当前无开放异常').fontSize(11).fontColor(Theme.success).fontWeight(FontWeight.Bold) }.width('100%').padding({ top: 20 })
        } else {
          ForEach(this.operationsData().alarms.filter(item => item.status === 'OPEN').slice(0, 2), (alarm: AlarmRecord) => {
            Row({ space: 8 }) { Circle().width(8).height(8).fill(Theme.danger); Column() { Text(alarm.alarmType + ' · ' + alarm.deviceCode).fontSize(10).fontColor(Theme.danger).fontWeight(FontWeight.Bold); Text(alarm.message).fontSize(9).fontColor(Theme.onDarkMuted).margin({ top: 4 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1) }.width('100%').padding({ top: 13, bottom: 10 }).border({ width: { bottom: 1 }, color: Theme.lineStrong }).onClick(() => this.selectAlarm(alarm))
          }, (alarm: AlarmRecord) => alarm.alarmId)
        }
        Text('RECENT TRACE').fontSize(8).fontColor(Theme.onDarkMuted).margin({ top: 28 })
        ForEach(this.dashboardRuns().slice(0, 3), (run: FactoryRun) => {
          Row() { Text(run.traceCode).fontSize(10).fontColor(Theme.accent).fontWeight(FontWeight.Bold).layoutWeight(1); Text(this.stageLabel(run.currentStage)).fontSize(9).fontColor(Theme.onDarkMuted); Text(this.statusLabel(run.status)).fontSize(9).fontColor(statusColor(run.status)).margin({ left: 12 }) }.width('100%').padding({ top: 10, bottom: 10 }).border({ width: { bottom: 1 }, color: Theme.lineStrong }).onClick(() => this.selectProduct(run))
          }, (run: FactoryRun) => run.traceCode)
        if (this.dashboardRuns().length === 0) Text('等待产品追踪数据').fontSize(10).fontColor(Theme.onDarkMuted).margin({ top: 12 })
        Divider().strokeWidth(1).color(Theme.lineStrong).margin({ top: 18, bottom: 16 })
        Text('物流与仓储').fontSize(12).fontColor(Theme.onDark).fontWeight(FontWeight.Bold)
        Row() { this.darkFooterMetric('AGV任务', String(this.logisticsData().tasks.length), Theme.onDark); this.darkFooterMetric('运输中', String(this.logisticsData().tasks.filter(item => item.status === 'RUNNING').length), Theme.success); this.darkFooterMetric('库存箱', String(this.logisticsData().stock.length), Theme.onDark) }.width('100%').margin({ top: 16 })
        if (this.logisticsData().zones.length > 0) {
          Row({ space: 8 }) { Circle().width(8).height(8).fill(this.logisticsData().zones[0].status === 'SAFE' ? Theme.success : Theme.danger); Column() { Text('仓区 ' + this.logisticsData().zones[0].zoneCode + ' · ' + this.logisticsData().zones[0].status).fontSize(10).fontColor(Theme.onDark).fontWeight(FontWeight.Bold); Text('VOC ' + this.logisticsData().zones[0].vocPpm + ' ppm  ·  烟雾 ' + this.logisticsData().zones[0].smoke + '%').fontSize(9).fontColor(Theme.onDarkMuted).margin({ top: 5 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1) }.width('100%').padding(11).backgroundColor('#16352F').margin({ top: 16 })
        }
        Text('点击异常或产品，打开对应实体上下文').fontSize(9).fontColor(Theme.onDarkMuted).margin({ top: 22 })
      }.layoutWeight(1).height('100%').alignItems(HorizontalAlign.Start).padding({ left: 28, right: 38, top: 24, bottom: 28 }).backgroundColor(Theme.navy).border({ width: { left: 1 }, color: Theme.lineStrong })
    }.width('100%').height(520).backgroundColor(Theme.navy).border({ width: { top: 1 }, color: Theme.lineStrong })
  }

  @Builder
  stationMatrixRow(stage: StageDefinition, index: number) {
    Row() {
      Row({ space: 9 }) {
        Text((index + 1).toString().padStart(2, '0')).fontSize(8).fontColor(Theme.accent).width(24)
        Column() {
          Text(stage.name).fontSize(10).fontColor(Theme.onDark).fontWeight(FontWeight.Bold)
          Text(stage.code).fontSize(7).fontColor(Theme.onDarkMuted).margin({ top: 3 })
        }.alignItems(HorizontalAlign.Start)
      }.width(190)
      StateBadge({ status: this.stageStatus(stage), label: this.statusLabel(this.stageStatus(stage)) }).width(88)
      Text(this.runtimeData().devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length).fontSize(10).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).width(110)
      Text(String(this.stageProductCount(stage.code))).fontSize(10).fontColor(statusColor(this.stageStatus(stage))).fontWeight(FontWeight.Bold).width(90)
      Text(this.stageRuntime(stage.code).bufferLevel + '/' + this.stageRuntime(stage.code).bufferCapacity).fontSize(9).fontColor(Theme.onDarkMuted).layoutWeight(1)
    }.width('100%').height(48).padding({ left: 12, right: 12 }).border({ width: { bottom: 1 }, color: Theme.lineStrong }).onClick(() => this.openStage(stage.code))
  }

  @Builder
  darkFooterMetric(label: string, value: string, color: string) {
    Column() { Text(label).fontSize(9).fontColor(Theme.onDarkMuted); Text(value).fontSize(20).fontColor(color).fontWeight(FontWeight.Bold).margin({ top: 5 }) }.layoutWeight(1).alignItems(HorizontalAlign.Start)
  }

  @Builder
  lightFooterValue(label: string, value: string) {
    Column() { Text(label).fontSize(9).fontColor(Theme.muted); Text(value).fontSize(18).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 4 }) }.layoutWeight(1).alignItems(HorizontalAlign.Start)
  }

  @Builder
  stageCard(stage: StageDefinition, index: number) {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Circle().width(30).height(30).fill(Theme.page).stroke(statusColor(this.stageStatus(stage))).strokeWidth(2)
        Text((index + 1).toString().padStart(2, '0')).fontSize(9).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      }
      Text(stage.name).fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 8 }).maxLines(1)
      Text(stage.code).fontSize(7).fontColor(Theme.muted).margin({ top: 3 }).maxLines(1)
      Row() {
        Text(this.runtimeData().devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length + ' DEV').fontSize(7).fontColor(Theme.muted)
        Text('  ·  ').fontSize(7).fontColor(Theme.lineStrong)
        Text('WIP ' + this.stageProductCount(stage.code)).fontSize(7).fontColor(statusColor(this.stageStatus(stage)))
      }.margin({ top: 7 })
    }.width(132).height(104).alignItems(HorizontalAlign.Center).justifyContent(FlexAlign.Center).padding({ left: 6, right: 6, top: 8, bottom: 6 }).backgroundColor(Color.Transparent).onClick(() => {
        this.selectStage(stage)
        router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
      })
  }

  @Builder
  routeLabel(title: string, code: string) {
    Column() {
      Text(title).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      Text(code).fontSize(7).fontColor(Theme.accent).margin({ top: 4 })
      Text('CONTINUOUS').fontSize(7).fontColor(Theme.muted).margin({ top: 12 })
    }.width(92).height('100%').alignItems(HorizontalAlign.Start).justifyContent(FlexAlign.Center).padding({ left: 4 })
  }

  @Builder
  routeEnd(label: string) {
    Column() {
      Circle().width(10).height(10).fill(Theme.success)
      Text(label).fontSize(9).fontColor(Theme.success).fontWeight(FontWeight.Bold).margin({ top: 7 })
      Text('READY').fontSize(7).fontColor(Theme.muted).margin({ top: 3 })
    }.width(100).height('100%').justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
  }

  @Builder
  flowRail(label: string) {
    Column() {
      Divider().strokeWidth(2).color(Theme.lineStrong)
      Text(label).fontSize(16).fontColor(Theme.accent).fontWeight(FontWeight.Bold).margin({ top: 2 })
    }.width(22).height('100%').justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
  }

  @Builder
  compactStageNode(stage: StageDefinition, indexLabel: string) {
    Column() {
      Row() {
        Text(indexLabel).fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
        Text(stage.name).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ left: 6 })
        Blank()
        Circle().width(7).height(7).fill(statusColor(this.stageStatus(stage)))
      }.width('100%')
      Text(stage.code).fontSize(6).fontColor(Theme.muted).margin({ top: 5 }).maxLines(1)
      Divider().strokeWidth(1).color(Theme.line).margin({ top: 6, bottom: 5 })
      Row() {
        Text('D ' + this.runtimeData().devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length).fontSize(7).fontColor(Theme.muted)
        Blank()
        Text('W ' + this.stageProductCount(stage.code)).fontSize(7).fontColor(statusColor(this.stageStatus(stage))).fontWeight(FontWeight.Bold)
      }.width('100%')
    }.width(130).height('100%').padding({ left: 9, right: 9, top: 8, bottom: 6 }).backgroundColor(Theme.steel).border({ width: { left: 3, top: 1, right: 1, bottom: 1 }, color: statusColor(this.stageStatus(stage)) }).onClick(() => {
      this.selectStage(stage)
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
    })
  }

  @Builder
  compactMergeNode(stage: StageDefinition) {
    Column() {
      Row() {
        Text('05').fontSize(8).fontColor(Theme.warning).fontWeight(FontWeight.Bold)
        Text('灌装汇流').fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ left: 6 })
        Blank()
        Circle().width(7).height(7).fill(statusColor(this.stageStatus(stage)))
      }.width('100%')
      Text('BOTTLE + BEVERAGE').fontSize(6).fontColor(Theme.warning).margin({ top: 5 })
      Divider().strokeWidth(1).color(Theme.warning).margin({ top: 6, bottom: 5 })
      Text('定位 · 定量 · 液位').fontSize(7).fontColor(Theme.muted)
    }.width(130).height('100%').padding({ left: 9, right: 9, top: 8, bottom: 6 }).backgroundColor(Theme.warningSoft).border({ width: { left: 3, top: 1, right: 1, bottom: 1 }, color: Theme.warning }).onClick(() => {
      this.selectStage(stage)
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
    })
  }

  @Builder
  stageNode(stage: StageDefinition, indexLabel: string) {
    Column() {
      Row() {
        Text(indexLabel).fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
        Text(stage.name).fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ left: 8 })
        Blank()
        Circle().width(7).height(7).fill(statusColor(this.stageStatus(stage)))
      }.width('100%')
      Text(stage.code).fontSize(7).fontColor(Theme.muted).margin({ top: 6 })
      Divider().strokeWidth(1).color(Theme.line).margin({ top: 8, bottom: 7 })
      Row() {
        Text('DEV ' + this.runtimeData().devices.filter(item => item.stageCode === stage.code && item.state !== 'OFFLINE').length + '/' + stage.devices.length).fontSize(8).fontColor(Theme.muted)
        Blank()
        Text('WIP ' + this.stageProductCount(stage.code)).fontSize(8).fontColor(statusColor(this.stageStatus(stage))).fontWeight(FontWeight.Bold)
      }.width('100%')
    }.width(208).height('100%').padding({ left: 12, right: 12, top: 10, bottom: 8 }).backgroundColor(Theme.steel).border({ width: { left: 4, top: 1, right: 1, bottom: 1 }, color: statusColor(this.stageStatus(stage)) }).onClick(() => {
      this.selectStage(stage)
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
    })
  }

  @Builder
  mergeNode(stage: StageDefinition) {
    Column() {
      Row() {
        Text('05').fontSize(8).fontColor(Theme.warning).fontWeight(FontWeight.Bold)
        Text('灌装汇流').fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ left: 8 })
        Blank()
        Circle().width(8).height(8).fill(statusColor(this.stageStatus(stage)))
      }.width('100%')
      Text('BOTTLE + BEVERAGE').fontSize(7).fontColor(Theme.warning).margin({ top: 6 })
      Divider().strokeWidth(1).color(Theme.warning).margin({ top: 8, bottom: 7 })
      Text('定位 · 定量 · 液位复核').fontSize(8).fontColor(Theme.muted)
    }.width(208).height('100%').padding({ left: 12, right: 12, top: 10, bottom: 8 }).backgroundColor(Theme.warningSoft).border({ width: { left: 4, top: 1, right: 1, bottom: 1 }, color: Theme.warning }).onClick(() => {
      this.selectStage(stage)
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } })
    })
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
      Progress({ value: this.dashboardCompleted + this.dashboardRejected > 0 ? this.dashboardCompleted / (this.dashboardCompleted + this.dashboardRejected) * 100 : 0, total: 100, type: ProgressType.Linear }).width('100%').height(8).color(Theme.success).backgroundColor(Theme.panelStrong).margin({ top: 9 })
      Text('已判定 ' + (this.dashboardCompleted + this.dashboardRejected) + ' 批 · 通过 ' + this.dashboardCompleted + ' 批 · 剔除 ' + this.dashboardRejected + ' 批').fontSize(9).fontColor(Theme.muted).margin({ top: 7 })
      Row() {
        this.smallValue('运行工位', this.runningStageCount + '/' + FACTORY_STAGES.length, 'RUNNING')
        this.smallValue('MQTT 实机', String(this.mqttCount), 'NORMAL')
        this.smallValue('开放异常', String(this.openExceptionCount), 'FAIL')
      }.width('100%').margin({ top: 16 })
    }.layoutWeight(1).constraintSize({ minHeight: 178 }).alignItems(HorizontalAlign.Start).padding({ left: 18, right: 18 }).backgroundColor(Color.Transparent)
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
      Text(this.constraintText()).fontSize(14).fontColor(Theme.accent).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text('各工位缓冲不再一味按单一速度判定，而是由当前工位运行态和相邻工序联锁共同约束。').fontSize(9).fontColor(Theme.muted).lineHeight(14).margin({ top: 6 })
      Row() { Text('在线设备 ' + this.onlineDeviceCount).fontSize(10).fontColor(Theme.text); Blank(); Text(this.bundle.source).fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold) }.width('100%').margin({ top: 16 })
    }.layoutWeight(1).constraintSize({ minHeight: 178 }).alignItems(HorizontalAlign.Start).padding({ left: 18, right: 18 }).backgroundColor(Color.Transparent)
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
        }.width('100%').padding(10).backgroundColor(Theme.successSoft).margin({ top: 16 })
      }
    }.layoutWeight(1).constraintSize({ minHeight: 178 }).alignItems(HorizontalAlign.Start).padding({ left: 18, right: 18 }).backgroundColor(Color.Transparent)
  }

  @Builder
  exceptionPanel() {
    Column() {
      SectionTitle({ code: 'ACTIVE EXCEPTIONS', title: '异常与影响范围', description: '报警确认与工艺影响必须经过后端判定。' })
      if (this.openExceptionCount === 0) {
          Row({ space: 8 }) { Circle().width(8).height(8).fill(Theme.success); Text('当前无开放异常，所有工位满足连续运行条件。').fontSize(11).fontColor(Theme.text) }.width('100%').padding(14).backgroundColor(Theme.successSoft).margin({ top: 14 })
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
    }.layoutWeight(1).constraintSize({ minHeight: 178 }).alignItems(HorizontalAlign.Start).padding({ left: 18, right: 18 }).backgroundColor(Color.Transparent)
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
    }.layoutWeight(2).constraintSize({ minHeight: 178 }).alignItems(HorizontalAlign.Start).padding({ left: 18, right: 18 }).backgroundColor(Color.Transparent)
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
