import { router } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { DeviceStateRow, QualityGateRow, SectionTitle, StateBadge } from '../components/IndustrialComponents'
import { FactoryThreeScene } from '../components/FactoryThreeScene'
import { FactoryPlanScene } from '../components/FactoryPlanScene'
import { FACTORY_STAGES, findStage } from '../config/FactoryStages'
import { FactoryRepository } from '../service/FactoryRepository'
import { createMockBundle } from '../service/MockFactoryData'
import { ApiConfig } from '../service/ApiConfig'
import {
  AssistantController,
  AssistantDock,
  AssistantEntityType,
  AssistantSelectionSource
} from '@bottling/harmony-assistant'
import { displayAssistantHost } from '../assistant/DisplayAssistantHostAdapter'
import {
  AlarmRecord,
  DeviceDefinition,
  FactoryBundle,
  FactoryDashboard,
  FactoryRun,
  LogisticsOverview,
  OperationsOverview,
  QualityGateView,
  RuntimeSnapshot,
  RuntimeStage,
  StageDefinition
} from '../model/FactoryModels'

interface StageParams {
  stageCode: string
}

class ThreeDevicePayload {
  code: string = ''
  name: string = ''
  state: string = ''
  source: string = ''
  reading: string = ''
}

class ThreeProductPayload {
  traceCode: string = ''
  bottleType: string = ''
  status: string = ''
  defectType: string = ''
}

interface ThreeScenePayload {
  stageCode: string
  stageName: string
  stateVersion: number
  source: string
  errorMessage: string
  paused: boolean
  statusColors: boolean
  layoutEdit: boolean
  speed: number
  progress: number
  devices: Array<ThreeDevicePayload>
  products: Array<ThreeProductPayload>
}

@Entry
@Component
struct StageDetail {
  @State stageCode: string = 'PRETREATMENT'
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State selectedDeviceCode: string = ''
  @State selectedTraceCode: string = ''
  @State planarEnabled: boolean = true
  @State threeEnabled: boolean = true
  @State activeVisual: string = 'THREE'
  @State detailTab: string = 'EQUIPMENT'
  @State statusColorsEnabled: boolean = true
  @State layoutEditEnabled: boolean = false
  @State paused: boolean = false
  @State motion: number = 20
  @State revision: number = 0
  @State assistantController: AssistantController = new AssistantController(displayAssistantHost)

  private fallbackBundle: FactoryBundle = createMockBundle()
  private refreshTimer: number = -1
  private motionTimer: number = -1
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    displayAssistantHost.updatePage(this.pageRoute(), this.bundle, this.stageCode)
    this.revision += 1
  }

  get stageIndex(): number {
    return this.currentStageIndex()
  }

  private currentStageIndex(): number {
    const index = FACTORY_STAGES.findIndex(item => item.code === this.stageCode)
    return index < 0 ? 0 : index
  }

  private wipCountValue(): number {
    return this.dashboardRuns().filter(item => item.currentStage === this.stageCode && (item.status === 'RUNNING' || item.status === 'HOLD')).length
  }

  get runtimeStage(): RuntimeStage {
    const stage = this.findRuntimeStage(this.stageCode)
    if (stage === undefined) {
      return {
        stageCode: this.stageCode,
        state: 'STANDBY',
        bufferLevel: 0,
        bufferCapacity: 6,
        upstreamImpact: '等待数据',
        downstreamImpact: '等待数据'
      }
    }
    return stage
  }

  get stageAlarms(): number {
    return this.operationsData().alarms.filter(item => item.status === 'OPEN' && this.normalizeStage(item.stage || '', item.deviceCode) === this.stageCode).length
  }

  get wipCount(): number {
    return this.dashboardRuns().filter(item => item.currentStage === this.stageCode && (item.status === 'RUNNING' || item.status === 'HOLD')).length
  }

  aboutToAppear(): void {
    const params = router.getParams() as StageParams
    if (params !== undefined && params.stageCode !== undefined) this.stageCode = params.stageCode
    displayAssistantHost.updatePage(this.pageRoute(), this.bundle, this.stageCode)
    displayAssistantHost.publishVisibility('VISIBLE')
    FactoryRepository.subscribe(this.listener)
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
    this.refreshTimer = setInterval(() => void FactoryRepository.refresh(), ApiConfig.refreshIntervalMs)
    this.motionTimer = setInterval(() => {
      if (!this.paused && (this.planarEnabled || this.threeEnabled)) this.motion = (this.motion + 4) % 100
    }, 260)
  }

  aboutToDisappear(): void {
    displayAssistantHost.clearSelection('ARKUI')
    displayAssistantHost.publishVisibility('HIDDEN')
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
    if (this.refreshTimer >= 0) clearInterval(this.refreshTimer)
    if (this.motionTimer >= 0) clearInterval(this.motionTimer)
  }

  private safeCount(value: number | undefined): number {
    return value === undefined || value === null || value !== value ? 0 : value
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

  private currentStageRun(): FactoryRun | undefined {
    return this.dashboardRuns().find(item => item.currentStage === this.stageCode)
  }

  private currentBottleType(): string {
    const run = this.currentStageRun()
    return run === undefined || run.bottleType === undefined ? 'PLA 500 ml' : run.bottleType
  }

  private currentBatchCode(): string {
    const run = this.currentStageRun()
    if (run === undefined) return '--'
    if (run.batchCode !== undefined && run.batchCode.length > 0) return run.batchCode
    return run.traceCode
  }

  private pageRoute(): string {
    return 'pages/StageDetail?stageCode=' + this.stageCode
  }

  private findRuntimeStage(code: string): RuntimeStage {
    let value: RuntimeStage = {
      stageCode: code,
      state: 'STANDBY',
      bufferLevel: 0,
      bufferCapacity: 6,
      upstreamImpact: '等待数据',
      downstreamImpact: '等待数据'
    }
    const runtime = this.runtimeData()
    if (runtime === undefined || runtime.stages === undefined) return value
    runtime.stages.forEach(item => {
      if (item !== undefined && item.stageCode === code) value = item
    })
    return value
  }

  private runtimeStageValue(): RuntimeStage {
    const value = this.findRuntimeStage(this.stageCode)
    return value === undefined ? {
      stageCode: this.stageCode,
      state: 'STANDBY',
      bufferLevel: 0,
      bufferCapacity: 6,
      upstreamImpact: '等待数据',
      downstreamImpact: '等待数据'
    } : value
  }

  private runtimeStateValue(): string {
    const stage = this.runtimeStageValue()
    return stage === undefined || stage.state === undefined ? 'STANDBY' : stage.state
  }

  private stageData(): StageDefinition {
    let value: StageDefinition = {
      code: 'PRETREATMENT',
      name: '预处理',
      description: '冷却静置、水洗和风洗，去除 PLA 瓶残留物。',
      devices: [],
      qualityRules: []
    }
    FACTORY_STAGES.forEach((stage: StageDefinition) => {
      if (stage.code === this.stageCode) value = stage
    })
    return value
  }

  private normalizeStage(stage: string, deviceCode: string): string {
    return stage === 'WAREHOUSE_SAFETY' || deviceCode.indexOf('WAREHOUSE') === 0 ? 'WAREHOUSE_INBOUND' : stage
  }

  private formatTime(value: string | undefined): string {
    return value === undefined ? '--' : value.replace('T', ' ').slice(0, 19)
  }

  private statusText(): string {
    return this.stageAlarms > 0 ? '异常待处理' : this.runtimeStateValue() === 'RUNNING' ? '持续运行' : '待机'
  }

  private statusValue(): string {
    return this.stageAlarms > 0 ? 'ALARM' : this.runtimeStateValue() === 'RUNNING' ? 'RUNNING' : 'STANDBY'
  }

  private deviceRuntime(code: string): string {
    let state: string = 'STANDBY'
    this.runtimeData().devices.forEach(item => {
      if (item.deviceCode === code) state = item.state
    })
    return state === 'ALARM' ? 'ALARM' : state === 'RUNNING' ? 'RUNNING' : 'STANDBY'
  }

  private deviceSource(code: string): string {
    let source: string = 'SIMULATION'
    this.runtimeData().devices.forEach(item => {
      if (item.deviceCode === code) source = item.source + (item.fallback ? ' · 兜底' : '')
    })
    return source
  }

  private deviceReading(code: string): string {
    let value: string = '查看参数'
    const type = this.sensorTypeForDevice(code)
    if (type.length > 0) {
      this.operationsData().latestReadings.forEach(item => {
        if (item.sensorType === type && item.stage === this.stageCode) value = item.value + ' ' + item.unit
      })
    }
    return value
  }

  private sensorTypeForDevice(code: string): string {
    if (code === 'GAS-VERIFY-01' || code === 'WH-VOC-01') return 'VOC'
    if (code === 'BEV-TEMP-01') return 'TEMPERATURE'
    if (code === 'BEV-HUM-01') return 'HUMIDITY'
    if (code === 'AGV-US-01') return 'AGV_DISTANCE'
    if (code === 'WH-SMOKE-01') return 'SMOKE'
    if (code === 'FIL-FLOW-01') return 'FLOW'
    return ''
  }

  private qualityGates(): Array<QualityGateView> {
    const runs = this.dashboardRuns()
    const eventExists = runs.some(run => run.events.some(event => event.stage === this.stageCode && event.status === 'PASSED'))
    const eventFail = runs.some(run => run.events.some(event => event.stage === this.stageCode && event.status === 'FAILED'))
    const eventGate: QualityGateView = {
      label: '工序事件判定',
      standard: '产品工序事件 PASSED',
      actual: eventFail ? '存在失败事件' : eventExists ? '最近记录通过' : '等待产品判定',
      status: eventFail ? 'FAIL' : eventExists ? 'PASS' : 'WAIT',
      source: '产品事件链'
    }
    const interlock: QualityGateView = {
      label: '设备联锁',
      standard: 'RUNNING 且无开放报警',
      actual: this.runtimeStateValue(),
      status: this.stageAlarms > 0 ? 'FAIL' : this.runtimeStateValue() === 'RUNNING' ? 'PASS' : 'WAIT',
      source: '工位运行态与报警'
    }
    if (this.stageCode === 'GAS_INSPECTION') {
      const reading = this.operationsData().latestReadings.find(item => item.sensorType === 'VOC' && item.stage === this.stageCode)
      return [{
        label: 'VOC 安全浓度',
        standard: '<= 10 ppm 且无开放报警',
        actual: reading === undefined ? '等待传感器上报' : reading.value + ' ' + reading.unit,
        status: reading === undefined ? 'WAIT' : reading.value <= 10 && this.stageAlarms === 0 ? 'PASS' : 'FAIL',
        source: reading === undefined ? 'VOC 传感器' : reading.mode
      }, interlock]
    }
    if (this.stageCode === 'BEVERAGE_READY') {
      const reading = this.operationsData().latestReadings.find(item => item.sensorType === 'TEMPERATURE' && item.stage === this.stageCode)
      return [{
        label: '饮料温度',
        standard: '20-30 °C',
        actual: reading === undefined ? '等待传感器上报' : reading.value + ' ' + reading.unit,
        status: reading === undefined ? 'WAIT' : reading.value >= 20 && reading.value <= 30 ? 'PASS' : 'FAIL',
        source: reading === undefined ? '温度传感器' : reading.mode
      }, eventGate, interlock]
    }
    if (this.stageCode === 'AGV_TRANSPORT') {
      const task = this.logisticsData().tasks.length > 0 ? this.logisticsData().tasks[0] : undefined
      return [{
        label: '超声波避障距离',
        standard: '>= 20 cm',
        actual: task === undefined ? '等待 AGV 报文' : task.obstacleDistanceCm + ' cm',
        status: task === undefined ? 'WAIT' : task.obstacleDistanceCm >= 20 ? 'PASS' : 'FAIL',
        source: task === undefined ? '超声波传感器' : task.mode
      }, {
        label: '车辆负载',
        standard: '<= 30 kg',
        actual: task === undefined ? '等待负载报文' : task.loadKg + ' kg',
        status: task === undefined ? 'WAIT' : task.loadKg <= 30 ? 'PASS' : 'FAIL',
        source: task === undefined ? '负载传感器' : task.mode
      }]
    }
    if (this.stageCode === 'WAREHOUSE_INBOUND') {
      const zone = this.logisticsData().zones.length > 0 ? this.logisticsData().zones[0] : undefined
      return [{
        label: '仓区安全状态',
        standard: 'SAFE，VOC <= 10 ppm，烟雾 <= 0.5%',
        actual: zone === undefined ? '等待仓区报文' : zone.status + ' · VOC ' + zone.vocPpm + ' ppm',
        status: zone === undefined ? 'WAIT' : zone.status === 'SAFE' && zone.vocPpm <= 10 && zone.smoke <= 0.5 ? 'PASS' : 'FAIL',
        source: '仓区安全传感器'
      }]
    }
    return [eventGate, interlock]
  }

  private qualitySummary(): string {
    const gates = this.qualityGates()
    if (gates.some(item => item.status === 'FAIL')) return '禁止自动放行'
    if (gates.some(item => item.status === 'WAIT')) return '等待判定数据'
    return '满足放行条件'
  }

  private navigateStage(offset: number): void {
    const next = this.currentStageIndex() + offset
    if (next >= 0 && next < FACTORY_STAGES.length) router.replaceUrl({ url: 'pages/StageDetail', params: { stageCode: FACTORY_STAGES[next].code } })
  }

  private togglePaused(): void {
    this.paused = !this.paused
  }

  private toggleVisual(key: string): void {
    if (key === 'PLANAR') {
      this.planarEnabled = !this.planarEnabled
      if (this.planarEnabled) this.activeVisual = 'PLANAR'
      if (!this.planarEnabled && this.activeVisual === 'PLANAR') this.activeVisual = this.threeEnabled ? 'THREE' : 'NONE'
    }
    if (key === 'THREE') {
      this.threeEnabled = !this.threeEnabled
      if (this.threeEnabled) this.activeVisual = 'THREE'
      if (!this.threeEnabled && this.activeVisual === 'THREE') this.activeVisual = this.planarEnabled ? 'PLANAR' : 'NONE'
    }
    if (key === 'COLORS') this.statusColorsEnabled = !this.statusColorsEnabled
    if (key === 'LAYOUT') this.layoutEditEnabled = !this.layoutEditEnabled
  }

  private switchVisual(key: string): void {
    if (key === 'PLANAR' && this.planarEnabled) this.activeVisual = 'PLANAR'
    if (key === 'THREE' && this.threeEnabled) this.activeVisual = 'THREE'
  }

  private sceneSpeed(): number {
    let speed: number = this.stageCode === 'AGV_TRANSPORT' ? 1 : 0.12
    this.runtimeData().devices.forEach(item => {
      if (item.stageCode === this.stageCode && item.speedMps !== undefined) speed = item.speedMps
    })
    return speed
  }

  private sceneProgress(): number {
    let progress: number = this.motion
    this.runtimeData().devices.forEach(item => {
      if (item.stageCode === this.stageCode && item.progress !== undefined) progress = item.progress
    })
    return progress
  }

  private scenePayload(): string {
    const devices: Array<ThreeDevicePayload> = []
    this.stageData().devices.forEach((device: DeviceDefinition) => {
      const item = new ThreeDevicePayload()
      item.code = device.code
      item.name = device.name
      item.state = this.deviceRuntime(device.code)
      item.source = this.deviceSource(device.code)
      item.reading = this.deviceReading(device.code)
      devices.push(item)
    })

    const products: Array<ThreeProductPayload> = []
    this.dashboardRuns().filter(item => item.currentStage === this.stageCode).slice(0, 8).forEach((run: FactoryRun) => {
      const item = new ThreeProductPayload()
      item.traceCode = run.traceCode
      item.bottleType = run.bottleType || '待识别'
      item.status = run.status
      item.defectType = run.defectType || ''
      products.push(item)
    })

    const payload: ThreeScenePayload = {
      stageCode: this.stageCode,
      stageName: this.stageData().name,
      stateVersion: this.bundle.stateVersion,
      source: this.bundle.source,
      errorMessage: this.bundle.errorMessage,
      paused: this.paused,
      statusColors: this.statusColorsEnabled,
      layoutEdit: this.layoutEditEnabled,
      speed: this.sceneSpeed(),
      progress: this.sceneProgress(),
      devices: devices,
      products: products
    }
    return JSON.stringify(payload)
  }

  @Builder
  legacyBuild() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Scroll() {
        Column() {
        Row() {
          Button('← 产线总览').type(ButtonType.Normal).fontColor(Theme.accent).backgroundColor(Color.Transparent).fontSize(11).padding({ left: 0, right: 14 }).onClick(() => router.back())
          Text('工位作业 / ' + this.stageData().code).fontSize(9).fontColor(Theme.onDarkMuted).margin({ left: 16 })
          Blank()
          Text('STATION ' + (this.currentStageIndex() + 1).toString().padStart(2, '0') + ' / ' + FACTORY_STAGES.length).fontSize(9).fontColor(Theme.onDarkMuted)
        }.width('100%').padding({ left: 38, right: 166, top: 12, bottom: 12 }).backgroundColor(Theme.navy).border({ width: { bottom: 2 }, color: Theme.accent })

        Row() {
          Column() {
            Text('WORKSTATION  /  ' + this.stageData().code).fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
            Text(this.stageData().name + ' 工位').fontSize(30).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).margin({ top: 5 })
            Text(this.stageData().description)
              .fontSize(11)
              .fontColor(Theme.onDarkMuted)
              .lineHeight(16)
              .margin({ top: 6 })
              .onClick(() => this.selectTextFragment('stageDescription', this.stageData().description))
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Column() {
            Text('CURRENT STATE').fontSize(8).fontColor(Theme.onDarkMuted)
            StateBadge({ status: this.statusValue(), label: this.statusText() }).margin({ top: 7 })
            Text('v' + this.bundle.stateVersion + '  ·  ' + this.bundle.source).fontSize(8).fontColor(Theme.onDarkMuted).margin({ top: 8 })
          }.alignItems(HorizontalAlign.End)
        }.width('100%').alignItems(VerticalAlign.Bottom).padding({ left: 38, right: 38, top: 20, bottom: 20 }).backgroundColor(Theme.navy).border({ width: { bottom: 2 }, color: statusColor(this.statusValue()) })

        Row() {
          Button('← 上一工位').type(ButtonType.Normal).fontColor(this.currentStageIndex() > 0 ? Theme.accent : Theme.muted).backgroundColor(Color.Transparent).fontSize(10).enabled(this.currentStageIndex() > 0).onClick(() => this.navigateStage(-1))
          Blank()
          Text('工位导航').fontSize(8).fontColor(Theme.muted)
          Blank()
          Button('下一工位 →').type(ButtonType.Normal).fontColor(this.currentStageIndex() < FACTORY_STAGES.length - 1 ? Theme.accent : Theme.muted).backgroundColor(Color.Transparent).fontSize(10).enabled(this.currentStageIndex() < FACTORY_STAGES.length - 1).onClick(() => this.navigateStage(1))
        }.width('100%').padding({ left: 38, right: 38, top: 6, bottom: 6 }).backgroundColor(Theme.panel).border({ width: { bottom: 1 }, color: Theme.line })

        Column() {
          SectionTitle({
            code: '01  LIVE CELL VIEW',
            title: '工位作业画面',
            description: '图形、设备状态与产品流转使用同一份实时快照。'
          })
          Row() {
            Column() {
              Text('VIEW MODE').fontSize(8).fontColor(Theme.muted).fontWeight(FontWeight.Bold)
              Row({ space: 0 }) {
                this.visualModeButton('立体视图', 'THREE')
                this.visualModeButton('平面视图', 'PLANAR')
              }.margin({ top: 7 })
            }.alignItems(HorizontalAlign.Start)
            Blank()
            Scroll() {
              Row({ space: 7 }) {
                this.visualToggle('2D', this.planarEnabled, 'PLANAR')
                this.visualToggle('3D', this.threeEnabled, 'THREE')
                this.visualToggle('状态色', this.statusColorsEnabled, 'COLORS')
                this.visualToggle('布局编辑', this.layoutEditEnabled, 'LAYOUT')
                Button(this.paused ? '▶ 恢复实时' : 'Ⅱ 暂停画面')
                  .type(ButtonType.Normal)
                  .height(34)
                  .fontSize(10)
                  .fontColor(this.paused ? Theme.navy : Theme.onDark)
                  .backgroundColor(this.paused ? Theme.warning : Theme.navy)
                  .border({ width: 1, color: this.paused ? Theme.warning : Theme.navy })
                  .borderRadius(2)
                  .onClick(() => this.togglePaused())
              }.padding({ top: 12, bottom: 8 })
            }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).constraintSize({ maxWidth: 710 })
          }.width('100%').alignItems(VerticalAlign.Bottom)

          if (this.threeEnabled && this.activeVisual === 'THREE') {
            Column() {
              Row() {
                Text('THREE.JS 3D / LIVE SCENE').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
                Blank()
                Text(this.layoutEditEnabled ? '拖拽设备调整布局' : '旋转 · 缩放 · 点击查看').fontSize(9).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.muted)
              }.width('100%').padding({ bottom: 8 })
              FactoryThreeScene({
                payload: this.scenePayload(),
                viewMode: 'THREE',
                caption: '立体工位场景',
                heightValue: 410,
                selectionSource: 'THREE_3D',
                selectedDeviceCode: $selectedDeviceCode,
                selectedTraceCode: $selectedTraceCode,
                onDeviceSelected: (deviceCode: string, source: string): void => this.selectSceneDevice(deviceCode, source),
                onProductSelected: (traceCode: string, source: string): void => this.selectSceneProduct(traceCode, source),
                onSelectionCleared: (source: string): void => this.clearSceneSelection(source)
              })
            }.width('100%').padding({ left: 12, right: 12, top: 10, bottom: 12 }).margin({ top: 4 }).backgroundColor(Theme.navy).border({ width: { left: 3, top: 1, right: 1, bottom: 1 }, color: Theme.accent })
          }

          if (this.planarEnabled && this.activeVisual === 'PLANAR') {
            Column() {
              Row() {
                Text('THREE.JS 2D / PROCESS PLAN').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
                Blank()
                Text(this.layoutEditEnabled ? '拖拽平面符号调整布局' : '平面路径 · 物料流向 · 点击查看').fontSize(9).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.muted)
              }.width('100%').padding({ bottom: 8 })
              FactoryPlanScene({
                payload: this.scenePayload(),
                caption: '平面工艺图',
                heightValue: 360,
                selectionSource: 'THREE_2D',
                selectedDeviceCode: $selectedDeviceCode,
                selectedTraceCode: $selectedTraceCode,
                onStageSelected: (stageCode: string, source: string): void => this.selectSceneStage(stageCode, source),
                onDeviceSelected: (deviceCode: string, source: string): void => this.selectSceneDevice(deviceCode, source),
                onProductSelected: (traceCode: string, source: string): void => this.selectSceneProduct(traceCode, source),
                onSelectionCleared: (source: string): void => this.clearSceneSelection(source)
              })
            }.width('100%').padding({ left: 12, right: 12, top: 10, bottom: 12 }).margin({ top: 12 }).backgroundColor(Theme.navy).border({ width: { left: 3, top: 1, right: 1, bottom: 1 }, color: Theme.accent })
          }

          if (!this.threeEnabled && !this.planarEnabled) {
            Column() {
              Text('可视化已关闭').fontSize(18).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
              Text('实时数据仍在刷新，只是不再渲染图形。').fontSize(10).fontColor(Theme.muted).margin({ top: 8 })
            }.width('100%').height(170).justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center).backgroundColor(Theme.panelSoft).margin({ top: 12 })
          }
        }.width('100%').padding({ left: 38, right: 38, top: 18, bottom: 22 }).backgroundColor(Theme.panel).border({ width: { top: 1, bottom: 1 }, color: Theme.line }).margin({ top: 12 })

        Scroll() {
          Row({ space: 8 }) {
            this.metric('当前瓶型', this.currentBottleType(), '视觉识别结果')
            this.metric('当前批次', this.currentBatchCode(), '本站追踪批次')
            this.metric('生产节拍', this.stageCode === 'AGV_TRANSPORT' ? '1.00 m/s' : '120 mm/s', '实时设备快照')
            this.metric('累计处理', this.dashboardData().completed.toString(), '当前生产日')
            this.metric('质量门', this.qualitySummary() === '满足放行条件' ? '通过' : '待判定', '本站放行条件')
            this.metric('在线设备', this.runtimeData().devices.filter(item => item.stageCode === this.stageCode && item.state !== 'OFFLINE').length + '/' + this.stageData().devices.length, this.bundle.source)
            this.metric('开放报警', this.stageAlarms.toString(), '需关注事件')
          }
        }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).width('100%').margin({ top: 18, left: 28, right: 28 })

        this.detailWorkspace()
        }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 28 })
      }.width('100%').height('100%').backgroundColor(Theme.page)
      AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
        .margin({ top: 16, right: 16 })
    }.width('100%').height('100%')
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Scroll() {
        Column() {
          this.stationTopBar()
          this.stationHeader()
          this.stationNavigator()
          this.stationWorkbench()
          this.detailWorkspace()
        }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 28 }).backgroundColor(Theme.page)
      }.width('100%').height('100%').backgroundColor(Theme.page)
      AssistantDock({ controller: this.assistantController, panelWidth: 410, panelHeight: 620 })
        .margin({ top: 16, right: 16 })
    }.width('100%').height('100%')
  }

  @Builder
  stationTopBar() {
    Row() {
      Button('← 产线总览').type(ButtonType.Normal).fontColor(Theme.accent).backgroundColor(Color.Transparent).fontSize(10).padding({ left: 0, right: 18 }).onClick(() => router.back())
      Text('工位作业  /  ' + this.stageData().code).fontSize(8).fontColor(Theme.muted)
      Blank()
      Text('STATION ' + (this.currentStageIndex() + 1).toString().padStart(2, '0') + '  /  ' + FACTORY_STAGES.length).fontSize(8).fontColor(Theme.muted)
    }.width('100%').padding({ left: 36, right: 170, top: 11, bottom: 11 }).backgroundColor(Theme.navy).border({ width: { bottom: 1 }, color: Theme.lineStrong })
  }

  @Builder
  stationHeader() {
    Row() {
      Column() {
        Row({ space: 8 }) {
          Text((this.currentStageIndex() + 1).toString().padStart(2, '0')).fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('WORKSTATION  /  ' + this.stageData().code).fontSize(9).fontColor(Theme.onDarkMuted).fontWeight(FontWeight.Bold)
        }
        Text(this.stageData().name + ' 工位').fontSize(27).fontColor(Theme.onDark).fontWeight(FontWeight.Bold).margin({ top: 7 })
        Text(this.stageData().description).fontSize(10).fontColor(Theme.onDarkMuted).lineHeight(15).margin({ top: 5 }).onClick(() => this.selectTextFragment('stageDescription', this.stageData().description))
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Column() {
        Text('CURRENT STATE').fontSize(7).fontColor(Theme.onDarkMuted).fontWeight(FontWeight.Bold)
        StateBadge({ status: this.statusValue(), label: this.statusText() }).margin({ top: 7 })
        Text('STATE v' + this.bundle.stateVersion + '  ·  ' + this.bundle.source).fontSize(8).fontColor(Theme.onDarkMuted).margin({ top: 7 })
      }.alignItems(HorizontalAlign.End)
    }.width('100%').alignItems(VerticalAlign.Bottom).padding({ left: 36, right: 36, top: 19, bottom: 17 }).backgroundColor(Theme.navy).border({ width: { bottom: 2 }, color: statusColor(this.statusValue()) })
  }

  @Builder
  stationNavigator() {
    Row() {
      Button('← 上一工位').type(ButtonType.Normal).fontColor(this.currentStageIndex() > 0 ? Theme.accent : Theme.muted).backgroundColor(Color.Transparent).fontSize(9).enabled(this.currentStageIndex() > 0).onClick(() => this.navigateStage(-1))
      Blank()
      Text('工位导航').fontSize(8).fontColor(Theme.muted)
      Blank()
      Button('下一工位 →').type(ButtonType.Normal).fontColor(this.currentStageIndex() < FACTORY_STAGES.length - 1 ? Theme.accent : Theme.muted).backgroundColor(Color.Transparent).fontSize(9).enabled(this.currentStageIndex() < FACTORY_STAGES.length - 1).onClick(() => this.navigateStage(1))
    }.width('100%').padding({ left: 36, right: 36, top: 5, bottom: 5 }).backgroundColor(Theme.panelSoft).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  stationWorkbench() {
    Column() {
      Row() {
        Column() {
          Text('01  LIVE WORKCELL').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
          Text('工位现场').fontSize(18).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 4 })
          Text('2D 平面图与 3D 设备场景共用同一实时快照').fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Scroll() {
          Row({ space: 6 }) {
            this.visualModeButton('2D 平面', 'PLANAR')
            this.visualModeButton('3D 立体', 'THREE')
            this.visualToggle('状态色', this.statusColorsEnabled, 'COLORS')
            this.visualToggle('布局编辑', this.layoutEditEnabled, 'LAYOUT')
            Button(this.paused ? '▶ 恢复实时' : 'Ⅱ 暂停实时').type(ButtonType.Normal).height(32).fontSize(9).fontColor(this.paused ? Theme.navy : Theme.text).backgroundColor(this.paused ? Theme.warning : Theme.panel).border({ width: 1, color: this.paused ? Theme.warning : Theme.line }).borderRadius(2).onClick(() => this.togglePaused())
          }
        }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).constraintSize({ maxWidth: 720 })
      }.width('100%').alignItems(VerticalAlign.Bottom).padding({ left: 28, right: 28, top: 16, bottom: 12 })

      if (this.planarEnabled && this.threeEnabled) {
        Row({ space: 10 }) {
          Column() {
            Row() { Text('2D  /  PROCESS PLAN').fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold); Blank(); Text(this.layoutEditEnabled ? '拖拽调整布局' : '平面路径 · 点击对象').fontSize(8).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.onDarkMuted) }.width('100%').padding({ left: 10, right: 10, bottom: 7 })
            FactoryPlanScene({ payload: this.scenePayload(), caption: '独立二维工艺图', heightValue: 300, selectionSource: 'THREE_2D', selectedDeviceCode: $selectedDeviceCode, selectedTraceCode: $selectedTraceCode, onStageSelected: (stageCode: string, source: string): void => this.selectSceneStage(stageCode, source), onDeviceSelected: (deviceCode: string, source: string): void => this.selectSceneDevice(deviceCode, source), onProductSelected: (traceCode: string, source: string): void => this.selectSceneProduct(traceCode, source), onSelectionCleared: (source: string): void => this.clearSceneSelection(source) })
          }.layoutWeight(1).backgroundColor('#071015').padding(10)
          Column() {
            Row() { Text('3D  /  MACHINE VIEW').fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold); Blank(); Text(this.layoutEditEnabled ? '拖拽调整布局' : '旋转 · 缩放 · 点击对象').fontSize(8).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.onDarkMuted) }.width('100%').padding({ left: 10, right: 10, bottom: 7 })
            FactoryThreeScene({ payload: this.scenePayload(), viewMode: 'THREE', caption: 'Three.js 设备场景', heightValue: 300, selectionSource: 'THREE_3D', selectedDeviceCode: $selectedDeviceCode, selectedTraceCode: $selectedTraceCode, onDeviceSelected: (deviceCode: string, source: string): void => this.selectSceneDevice(deviceCode, source), onProductSelected: (traceCode: string, source: string): void => this.selectSceneProduct(traceCode, source), onSelectionCleared: (source: string): void => this.clearSceneSelection(source) })
          }.layoutWeight(1).backgroundColor('#071015').padding(10)
        }.width('100%').padding({ left: 12, right: 12, bottom: 12 })
      } else if (this.threeEnabled) {
        Column() {
          Row() { Text('3D  /  MACHINE VIEW').fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold); Blank(); Text(this.layoutEditEnabled ? '拖拽调整布局' : '旋转 · 缩放 · 点击对象').fontSize(8).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.onDarkMuted) }.width('100%').padding({ left: 12, right: 12, bottom: 8 })
          FactoryThreeScene({ payload: this.scenePayload(), viewMode: 'THREE', caption: 'Three.js 设备场景', heightValue: 380, selectionSource: 'THREE_3D', selectedDeviceCode: $selectedDeviceCode, selectedTraceCode: $selectedTraceCode, onDeviceSelected: (deviceCode: string, source: string): void => this.selectSceneDevice(deviceCode, source), onProductSelected: (traceCode: string, source: string): void => this.selectSceneProduct(traceCode, source), onSelectionCleared: (source: string): void => this.clearSceneSelection(source) })
        }.width('100%').backgroundColor('#071015').padding({ left: 12, right: 12, bottom: 12 })
      } else if (this.planarEnabled) {
        Column() {
          Row() { Text('2D  /  PROCESS PLAN').fontSize(8).fontColor(Theme.accent).fontWeight(FontWeight.Bold); Blank(); Text(this.layoutEditEnabled ? '拖拽调整布局' : '平面路径 · 点击对象').fontSize(8).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.onDarkMuted) }.width('100%').padding({ left: 12, right: 12, bottom: 8 })
          FactoryPlanScene({ payload: this.scenePayload(), caption: '独立二维工艺图', heightValue: 380, selectionSource: 'THREE_2D', selectedDeviceCode: $selectedDeviceCode, selectedTraceCode: $selectedTraceCode, onStageSelected: (stageCode: string, source: string): void => this.selectSceneStage(stageCode, source), onDeviceSelected: (deviceCode: string, source: string): void => this.selectSceneDevice(deviceCode, source), onProductSelected: (traceCode: string, source: string): void => this.selectSceneProduct(traceCode, source), onSelectionCleared: (source: string): void => this.clearSceneSelection(source) })
        }.width('100%').backgroundColor('#071015').padding({ left: 12, right: 12, bottom: 12 })
      }
      if (!this.threeEnabled && !this.planarEnabled) {
        Column() { Text('可视化已关闭').fontSize(16).fontColor(Theme.navy).fontWeight(FontWeight.Bold); Text('实时数据仍在更新，打开 2D 或 3D 继续查看现场。').fontSize(9).fontColor(Theme.muted).margin({ top: 8 }) }.width('100%').height(170).justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center).backgroundColor(Theme.panelSoft)
      }
    }.width('100%').backgroundColor(Theme.panel).border({ width: { bottom: 1 }, color: Theme.line })
  }

  @Builder
  detailWorkspace() {
    Column() {
      SectionTitle({
        code: '02 STATION DATA',
        title: '工位实时详情',
        description: '按任务查看设备、产品或质量影响，避免所有信息同时堆叠。'
      })
      Row({ space: 6 }) {
        this.detailTabButton('EQUIPMENT', '设备')
        this.detailTabButton('MATERIAL', '产品与追溯')
        this.detailTabButton('QUALITY', '质量与影响')
      }.width('100%').padding({ top: 12, bottom: 12 })

      if (this.detailTab === 'EQUIPMENT') {
        ForEach(this.stageData().devices, (device: DeviceDefinition, index: number) => {
          Row() {
            DeviceStateRow({
              index: index,
              device: device,
              state: this.deviceRuntime(device.code),
              source: this.deviceSource(device.code),
              reading: this.deviceReading(device.code)
            })
          }.width('100%').onClick(() => this.selectDeviceByCode(device.code, 'ARKUI'))
        }, (device: DeviceDefinition) => device.code)
        if (this.selectedDeviceCode.length > 0) this.deviceInfoPanel()
      }

      if (this.detailTab === 'MATERIAL') {
        if (this.selectedTraceCode.length > 0) this.selectedProductPanel()
        this.materialPanel()
        this.tracePanel()
      }

      if (this.detailTab === 'QUALITY') {
        Row() {
          Circle().width(9).height(9).fill(this.qualitySummary() === '满足放行条件' ? Theme.success : this.qualitySummary() === '等待判定数据' ? Theme.warning : Theme.danger)
          Text(this.qualitySummary())
            .fontSize(14)
            .fontColor(this.qualitySummary() === '满足放行条件' ? Theme.success : this.qualitySummary() === '等待判定数据' ? Theme.warning : Theme.danger)
            .fontWeight(FontWeight.Bold)
            .margin({ left: 8 })
            }.width('100%').padding(12).backgroundColor(this.qualitySummary() === '满足放行条件' ? Theme.successSoft : this.qualitySummary() === '等待判定数据' ? Theme.warningSoft : Theme.dangerSoft)
        ForEach(this.qualityGates(), (gate: QualityGateView) => {
          QualityGateRow({ gate: gate })
        }, (gate: QualityGateView) => gate.label)
      }
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { left: 3, top: 1, bottom: 1 }, color: Theme.accent })
  }

  @Builder
  detailTabButton(key: string, label: string) {
    Button(label)
      .type(ButtonType.Normal)
      .layoutWeight(1)
      .height(36)
      .fontSize(10)
      .fontColor(this.detailTab === key ? '#FFFFFF' : Theme.text)
      .backgroundColor(this.detailTab === key ? Theme.blue : Theme.panelSoft)
      .border({ width: 1, color: this.detailTab === key ? Theme.blue : Theme.line })
      .borderRadius(3)
      .onClick(() => this.detailTab = key)
  }

  @Builder
  visualToggle(label: string, enabled: boolean, key: string) {
    Button((enabled ? '●  ' : '○  ') + label)
      .type(ButtonType.Normal)
      .height(34)
      .fontSize(10)
      .fontColor(enabled ? Theme.blue : Theme.muted)
      .backgroundColor(enabled ? Theme.panel : Theme.panelSoft)
      .border({ width: 1, color: enabled ? Theme.blue : Theme.line })
      .borderRadius(2)
      .onClick(() => this.toggleVisual(key))
  }

  @Builder
  visualModeButton(label: string, key: string) {
    Button(label)
      .type(ButtonType.Normal)
      .width(108)
      .height(36)
      .fontSize(10)
      .fontColor(this.activeVisual === key ? Theme.onDark : Theme.text)
      .backgroundColor(this.activeVisual === key ? Theme.navy : Theme.panelSoft)
      .border({ width: 1, color: this.activeVisual === key ? Theme.navy : Theme.line })
      .borderRadius(0)
      .enabled(key === 'THREE' ? this.threeEnabled : this.planarEnabled)
      .onClick(() => this.switchVisual(key))
  }

  @Builder
  selectedProductPanel() {
    Column() {
      SectionTitle({
        code: 'PRODUCT PROFILE',
        title: this.selectedTraceCode,
        description: '展示当前选中的在制品详情。'
      })
      ForEach(this.dashboardRuns().filter(item => item.traceCode === this.selectedTraceCode), (run: FactoryRun) => {
        Row() { Text('瓶型').fontSize(10).fontColor(Theme.muted); Blank(); Text(run.bottleType || '待识别').fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold) }.width('100%').padding(10)
        Row() { Text('当前工位').fontSize(10).fontColor(Theme.muted); Blank(); Text(run.currentStage).fontSize(11).fontColor(Theme.accent).fontWeight(FontWeight.Bold) }.width('100%').padding(10).backgroundColor(Theme.panelSoft)
        Row() { Text('产品状态').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.statusTextForRun(run.status)).fontSize(11).fontColor(statusColor(run.status)).fontWeight(FontWeight.Bold) }.width('100%').padding(10)
        Row() { Text('更新时间').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.formatTime(run.updatedAt)).fontSize(10).fontColor(Theme.text) }.width('100%').padding(10).backgroundColor(Theme.panelSoft)
      }, (run: FactoryRun) => run.traceCode)
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 1, left: 1, bottom: 1 }, color: Theme.accent })
  }

  @Builder
  metric(label: string, value: string, note: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.muted)
      Text(value).fontSize(18).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text(note).fontSize(8).fontColor(Theme.muted).margin({ top: 3 })
    }.alignItems(HorizontalAlign.Start).width(150).height(78).padding(10).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.accent })
  }

  @Builder
  deviceInfoPanel() {
    Column() {
      SectionTitle({ code: 'DEVICE PROFILE', title: this.selectedDeviceCode, description: this.selectedDeviceRole() })
      Row() { Text('数据源').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.deviceSource(this.selectedDeviceCode)).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold) }.width('100%').padding(10)
      Row() { Text('关键读数').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.deviceReading(this.selectedDeviceCode)).fontSize(13).fontColor(Theme.text).fontWeight(FontWeight.Bold) }.width('100%').padding(10).backgroundColor(Theme.panelSoft)
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 1, left: 1, bottom: 1 }, color: Theme.accent })
  }

  private selectedDeviceRole(): string {
    let role: string = '设备作用'
    this.stageData().devices.forEach(item => {
      if (item.code === this.selectedDeviceCode) role = item.code + ' · ' + item.role
    })
    return role
  }

  private selectDeviceByCode(deviceCode: string, source: AssistantSelectionSource): void {
    this.selectedDeviceCode = deviceCode
    displayAssistantHost.updateFocusedEntity(deviceCode, '')
    displayAssistantHost.publishSelection(AssistantEntityType.DEVICE, deviceCode, this.deviceTitle(deviceCode), source, [
      { code: 'stageCode', label: '工位', displayValue: this.stageData().name },
      { code: 'state', label: '状态', displayValue: this.deviceRuntime(deviceCode) },
      { code: 'source', label: '来源', displayValue: this.deviceSource(deviceCode) },
      { code: 'reading', label: '读数', displayValue: this.deviceReading(deviceCode) }
    ])
  }

  private selectProductByTrace(traceCode: string, source: AssistantSelectionSource): void {
    this.selectedTraceCode = traceCode
    displayAssistantHost.updateFocusedEntity('', traceCode)
    const run = this.findRun(traceCode)
    displayAssistantHost.publishSelection(AssistantEntityType.PRODUCT, traceCode, traceCode, source, [
      { code: 'bottleType', label: '瓶型', displayValue: run.bottleType || '待识别' },
      { code: 'stageCode', label: '工位', displayValue: this.stageData().name },
      { code: 'status', label: '状态', displayValue: this.statusTextForRun(run.status) }
    ])
  }

  private selectAlarm(alarm: AlarmRecord): void {
    displayAssistantHost.publishSelection(AssistantEntityType.ALARM, alarm.alarmId, alarm.alarmType + ' · ' + alarm.deviceCode, 'ARKUI', [
      { code: 'deviceCode', label: '设备', displayValue: alarm.deviceCode },
      { code: 'stageCode', label: '工位', displayValue: this.stageCode },
      { code: 'message', label: '报警', displayValue: alarm.message },
      { code: 'status', label: '状态', displayValue: alarm.status }
    ])
  }

  private selectTextFragment(fieldCode: string, displayText: string): void {
    const ownerId: string = this.stageCode.length > 0 ? this.stageCode : 'LINE-01'
    displayAssistantHost.publishSelection(
      AssistantEntityType.TEXT_FRAGMENT,
      this.pageRoute() + ':' + ownerId + ':' + fieldCode,
      displayText,
      'ARKUI',
      [
        { code: 'field', label: '字段', displayValue: fieldCode },
        { code: 'stageCode', label: '工位', displayValue: this.stageCode }
      ]
    )
  }

  private selectSceneDevice(deviceCode: string, source: string): void {
    const assistantSource: AssistantSelectionSource = source === 'THREE_2D' ? 'THREE_2D' : 'THREE_3D'
    this.selectDeviceByCode(deviceCode, assistantSource)
  }

  private selectSceneProduct(traceCode: string, source: string): void {
    const assistantSource: AssistantSelectionSource = source === 'THREE_2D' ? 'THREE_2D' : 'THREE_3D'
    this.selectProductByTrace(traceCode, assistantSource)
  }

  private selectSceneStage(stageCode: string, source: string): void {
    const assistantSource: AssistantSelectionSource = source === 'THREE_2D' ? 'THREE_2D' : 'THREE_3D'
    let stageName: string = stageCode
    FACTORY_STAGES.forEach((stage: StageDefinition) => {
      if (stage.code === stageCode) stageName = stage.name
    })
    displayAssistantHost.publishSelection(AssistantEntityType.STAGE, stageCode, stageName, assistantSource, [
      { code: 'stageCode', label: '工位', displayValue: stageCode },
      { code: 'state', label: '状态', displayValue: this.runtimeStage.state },
      { code: 'wip', label: '在制品', displayValue: this.wipCount.toString() }
    ])
  }

  private clearSceneSelection(source: string): void {
    const assistantSource: AssistantSelectionSource = source === 'THREE_2D' ? 'THREE_2D' : 'THREE_3D'
    this.selectedDeviceCode = ''
    this.selectedTraceCode = ''
    displayAssistantHost.clearSelection(assistantSource)
  }

  private deviceTitle(deviceCode: string): string {
    let title: string = deviceCode
    this.stageData().devices.forEach((device: DeviceDefinition) => {
      if (device.code === deviceCode) title = device.name
    })
    return title
  }

  private findRun(traceCode: string): FactoryRun {
    let found: FactoryRun = {
      traceCode: traceCode,
      currentStage: this.stageCode,
      status: 'RUNNING',
      events: []
    }
    this.dashboardRuns().forEach((run: FactoryRun) => {
      if (run.traceCode === traceCode) found = run
    })
    return found
  }

  @Builder
  materialPanel() {
    Column() {
      SectionTitle({
        code: '04',
        title: '物料与在制品',
        description: '列出当前工位相关的追踪号、瓶型、状态和检测结果。'
      })
      ForEach(this.dashboardRuns().filter(item => item.currentStage === this.stageCode).slice(0, 6), (run: FactoryRun) => {
        Row({ space: 9 }) {
          Circle().width(9).height(9).fill(statusColor(run.status))
          Column() {
            Text(run.traceCode).fontSize(10).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
            Text((run.bottleType || '待识别') + ' · ' + this.statusTextForRun(run.status)).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Text(run.defectType === undefined ? '检测结果待确认' : run.defectType).fontSize(9).fontColor(run.defectType === undefined ? Theme.muted : Theme.danger)
        }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectProductByTrace(run.traceCode, 'ARKUI'))
      }, (run: FactoryRun) => run.traceCode)
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 1, left: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  tracePanel() {
    Column() {
      SectionTitle({
        code: '05',
        title: '工位异常与影响',
        description: '展示本工位的报警和上下游影响。'
      })
      Row() {
        Column() {
          Text('上游影响').fontSize(9).fontColor(Theme.muted)
          Text(this.runtimeStageValue().upstreamImpact || '等待数据').fontSize(11).fontColor(Theme.text).margin({ top: 4 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Column() {
          Text('下游影响').fontSize(9).fontColor(Theme.muted)
          Text(this.runtimeStageValue().downstreamImpact || '等待数据').fontSize(11).fontColor(Theme.text).margin({ top: 4 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      }.width('100%').padding(12).backgroundColor(Theme.panelSoft).margin({ top: 10 })

      if (this.stageAlarms === 0) {
        Text('当前没有本站开放报警。').fontSize(10).fontColor(Theme.muted).padding(12)
      } else {
        ForEach(this.operationsData().alarms.filter(item => item.status === 'OPEN' && this.normalizeStage(item.stage || '', item.deviceCode) === this.stageCode), (alarm: AlarmRecord) => {
          Row() {
            Circle().width(8).height(8).fill(Theme.danger)
            Column() {
              Text(alarm.alarmType + ' · ' + alarm.deviceCode).fontSize(10).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
              Text(alarm.message).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            Text('需管理端确认').fontSize(9).fontColor(Theme.warning)
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectAlarm(alarm))
        }, (alarm: AlarmRecord) => alarm.alarmId)
      }
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 1, left: 1, bottom: 1 }, color: Theme.line })
  }

  private statusTextForRun(status: string): string {
    return status === 'COMPLETED' ? '已入库' : status === 'REJECTED' ? '已剔除' : status === 'HOLD' ? '待处理' : '运行中'
  }
}
