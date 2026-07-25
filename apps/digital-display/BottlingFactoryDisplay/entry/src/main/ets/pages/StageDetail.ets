import { router } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { DeviceStateRow, QualityGateRow, SectionTitle, StateBadge } from '../components/IndustrialComponents'
import { FactoryThreeScene } from '../components/FactoryThreeScene'
import { FACTORY_STAGES, findStage } from '../config/FactoryStages'
import { FactoryRepository } from '../service/FactoryRepository'
import { createMockBundle } from '../service/MockFactoryData'
import { ApiConfig } from '../service/ApiConfig'
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
  source: string
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
  @State statusColorsEnabled: boolean = true
  @State layoutEditEnabled: boolean = false
  @State paused: boolean = false
  @State motion: number = 20
  @State revision: number = 0

  private fallbackBundle: FactoryBundle = createMockBundle()
  private refreshTimer: number = -1
  private motionTimer: number = -1
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    this.revision += 1
  }

  get stage(): StageDefinition {
    return findStage(this.stageCode)
  }

  get stageIndex(): number {
    return FACTORY_STAGES.findIndex(item => item.code === this.stageCode)
  }

  get runtimeStage(): RuntimeStage {
    return this.findRuntimeStage(this.stageCode)
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
    FactoryRepository.subscribe(this.listener)
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
    this.refreshTimer = setInterval(() => void FactoryRepository.refresh(), ApiConfig.refreshIntervalMs)
    this.motionTimer = setInterval(() => {
      if (!this.paused && (this.planarEnabled || this.threeEnabled)) this.motion = (this.motion + 4) % 100
    }, 260)
  }

  aboutToDisappear(): void {
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

  private findRuntimeStage(code: string): RuntimeStage {
    let value: RuntimeStage = { stageCode: code, state: 'RUNNING', bufferLevel: 0, bufferCapacity: 6 }
    this.runtimeData().stages.forEach(item => {
      if (item.stageCode === code) value = item
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
    return this.stageAlarms > 0 ? '异常待处理' : this.runtimeStage.state === 'RUNNING' ? '持续运行' : '待机'
  }

  private statusValue(): string {
    return this.stageAlarms > 0 ? 'ALARM' : this.runtimeStage.state === 'RUNNING' ? 'RUNNING' : 'STANDBY'
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
      actual: this.runtimeStage.state,
      status: this.stageAlarms > 0 ? 'FAIL' : this.runtimeStage.state === 'RUNNING' ? 'PASS' : 'WAIT',
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
    const next = this.stageIndex + offset
    if (next >= 0 && next < FACTORY_STAGES.length) router.replaceUrl({ url: 'pages/StageDetail', params: { stageCode: FACTORY_STAGES[next].code } })
  }

  private togglePaused(): void {
    this.paused = !this.paused
  }

  private toggleVisual(key: string): void {
    if (key === 'PLANAR') this.planarEnabled = !this.planarEnabled
    if (key === 'THREE') this.threeEnabled = !this.threeEnabled
    if (key === 'COLORS') this.statusColorsEnabled = !this.statusColorsEnabled
    if (key === 'LAYOUT') this.layoutEditEnabled = !this.layoutEditEnabled
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
    this.stage.devices.forEach((device: DeviceDefinition) => {
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
      stageName: this.stage.name,
      source: this.bundle.source,
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

  build() {
    Scroll() {
      Column() {
        Row() {
          Button('← 总览').type(ButtonType.Normal).fontColor('#FFFFFF').backgroundColor(Color.Transparent).onClick(() => router.back())
          Blank()
          Text(this.stage.code + ' · 工位 ' + (this.stageIndex + 1) + ' / ' + FACTORY_STAGES.length).fontSize(10).fontColor('#C8DCE9')
        }.width('100%').padding({ left: 10, right: 10, top: 7, bottom: 7 }).backgroundColor(Theme.navy)

        Row() {
          Column() {
            Text(this.stage.code).fontSize(10).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
            Text(this.stage.name + ' 工位').fontSize(30).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 7 })
            Text(this.stage.description).fontSize(12).fontColor(Theme.muted).lineHeight(18).margin({ top: 6 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          StateBadge({ status: this.statusValue(), label: this.statusText() })
        }.width('100%').alignItems(VerticalAlign.Bottom).padding(18).border({ width: { bottom: 3 }, color: Theme.blue })

        Row() {
          Button('← 上一工位').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).enabled(this.stageIndex > 0).onClick(() => this.navigateStage(-1))
          Blank()
          Button('下一工位 →').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).enabled(this.stageIndex < FACTORY_STAGES.length - 1).onClick(() => this.navigateStage(1))
        }.width('100%').padding({ left: 10, right: 10 })

        Column() {
          SectionTitle({
            code: '01',
            title: '工位可视化',
            description: '2D 平面图和 Three.js 3D 场景都由同一份设备、物料和速度数据驱动，可单独开关以节省性能。'
          })
          Scroll() {
            Row({ space: 8 }) {
              this.visualToggle('二维', this.planarEnabled, 'PLANAR')
              this.visualToggle('三维', this.threeEnabled, 'THREE')
              this.visualToggle('状态颜色', this.statusColorsEnabled, 'COLORS')
              this.visualToggle('布局编辑', this.layoutEditEnabled, 'LAYOUT')
              Button(this.paused ? '恢复实时' : '暂停画面')
                .type(ButtonType.Normal)
                .fontSize(10)
                .fontColor(this.paused ? '#FFFFFF' : Theme.navy)
                .backgroundColor(this.paused ? Theme.warning : '#E7F0F5')
                .border({ width: 1, color: this.paused ? Theme.warning : Theme.line })
                .borderRadius(2)
                .onClick(() => this.togglePaused())
            }.padding({ top: 12, bottom: 8 })
          }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).width('100%')

          if (this.threeEnabled) {
            Column() {
              Row() {
                Text('THREE.JS 3D').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
                Blank()
                Text(this.layoutEditEnabled ? '拖拽设备调整布局' : '旋转 · 缩放 · 点击查看').fontSize(9).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.muted)
              }.width('100%').padding({ bottom: 8 })
              FactoryThreeScene({
                payload: this.scenePayload(),
                viewMode: 'THREE',
                caption: '立体工位场景',
                heightValue: 360,
                selectedDeviceCode: $selectedDeviceCode,
                selectedTraceCode: $selectedTraceCode
              })
            }.width('100%').padding(12).margin({ top: 4 }).backgroundColor(Theme.panelSoft)
          }

          if (this.planarEnabled) {
            Column() {
              Row() {
                Text('THREE.JS 2D PLAN').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
                Blank()
                Text(this.layoutEditEnabled ? '拖拽平面符号调整布局' : '平面路径 · 物料流向 · 点击查看').fontSize(9).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.muted)
              }.width('100%').padding({ bottom: 8 })
              FactoryThreeScene({
                payload: this.scenePayload(),
                viewMode: 'PLANAR',
                caption: '平面工艺图',
                heightValue: 300,
                selectedDeviceCode: $selectedDeviceCode,
                selectedTraceCode: $selectedTraceCode
              })
            }.width('100%').padding(12).margin({ top: 12 }).backgroundColor(Theme.panelSoft)
          }

          if (!this.threeEnabled && !this.planarEnabled) {
            Column() {
              Text('可视化已关闭').fontSize(18).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
              Text('实时数据仍在刷新，只是不再渲染图形。').fontSize(10).fontColor(Theme.muted).margin({ top: 8 })
            }.width('100%').height(170).justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center).backgroundColor(Theme.panelSoft).margin({ top: 12 })
          }
        }.width('100%').padding(18).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.blue }).borderRadius(3).margin({ top: 12 })

        Scroll() {
          Row({ space: 8 }) {
            this.metric('当前速度', this.stageCode === 'AGV_TRANSPORT' ? '1.00 m/s' : '120 mm/s', '数据驱动画面')
            this.metric('缓冲占用', this.runtimeStage.bufferLevel + '/' + this.runtimeStage.bufferCapacity, '工位间解耦缓冲')
            this.metric('本站在制品', String(this.wipCount), '运行或待处理')
            this.metric('设备在线', this.runtimeData().devices.filter(item => item.stageCode === this.stageCode && item.state !== 'OFFLINE').length + '/' + this.stage.devices.length, this.bundle.source)
          }
        }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).width('100%').margin({ top: 12 })

        Column() {
          SectionTitle({
            code: '02',
            title: '设备运行清单',
            description: '点击设备可查看当前状态、来源和传感器读数。'
          })
          ForEach(this.stage.devices, (device: DeviceDefinition, index: number) => {
            Row() {
              DeviceStateRow({
                index: index,
                device: device,
                state: this.deviceRuntime(device.code),
                source: this.deviceSource(device.code),
                reading: this.deviceReading(device.code)
              })
              Blank()
            }.width('100%').onClick(() => this.selectedDeviceCode = device.code)
          }, (device: DeviceDefinition) => device.code)
        }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)

        if (this.selectedDeviceCode.length > 0) this.deviceInfoPanel()
        if (this.selectedTraceCode.length > 0) this.selectedProductPanel()

        Column() {
          SectionTitle({
            code: '03',
            title: '质量放行门',
            description: '放行优先级为：工序事件、设备联锁、工位专属传感器。'
          })
          Row() {
            Circle().width(9).height(9).fill(this.qualitySummary() === '满足放行条件' ? Theme.success : this.qualitySummary() === '等待判定数据' ? Theme.warning : Theme.danger)
            Text(this.qualitySummary()).fontSize(14).fontColor(this.qualitySummary() === '满足放行条件' ? Theme.success : Theme.danger).fontWeight(FontWeight.Bold).margin({ left: 8 })
          }.width('100%').padding(12).backgroundColor('#F1F7FB').margin({ top: 12 })
          ForEach(this.qualityGates(), (gate: QualityGateView) => {
            QualityGateRow({ gate: gate })
          }, (gate: QualityGateView) => gate.label)
        }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)

        this.materialPanel()
        this.tracePanel()
      }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 28 })
    }.width('100%').height('100%').backgroundColor(Theme.page)
  }

  @Builder
  visualToggle(label: string, enabled: boolean, key: string) {
    Button((enabled ? 'ON  ' : 'OFF  ') + label)
      .type(ButtonType.Normal)
      .fontSize(10)
      .fontColor(enabled ? '#FFFFFF' : Theme.muted)
      .backgroundColor(enabled ? Theme.blue : '#E7F0F5')
      .border({ width: 1, color: enabled ? Theme.blue : Theme.line })
      .borderRadius(2)
      .onClick(() => this.toggleVisual(key))
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
        Row() { Text('瓶型').fontSize(10).fontColor(Theme.muted); Blank(); Text(run.bottleType || '待识别').fontSize(11).fontColor(Theme.navy).fontWeight(FontWeight.Bold) }.width('100%').padding(10)
        Row() { Text('当前工位').fontSize(10).fontColor(Theme.muted); Blank(); Text(run.currentStage).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold) }.width('100%').padding(10).backgroundColor(Theme.panelSoft)
        Row() { Text('产品状态').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.statusTextForRun(run.status)).fontSize(11).fontColor(statusColor(run.status)).fontWeight(FontWeight.Bold) }.width('100%').padding(10)
        Row() { Text('更新时间').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.formatTime(run.updatedAt)).fontSize(10).fontColor(Theme.text) }.width('100%').padding(10).backgroundColor(Theme.panelSoft)
      }, (run: FactoryRun) => run.traceCode)
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.accent }).borderRadius(3)
  }

  @Builder
  metric(label: string, value: string, note: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.muted)
      Text(value).fontSize(18).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text(note).fontSize(8).fontColor(Theme.muted).margin({ top: 3 })
    }.alignItems(HorizontalAlign.Start).width(160).height(78).padding(10).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.accent })
  }

  @Builder
  deviceInfoPanel() {
    Column() {
      SectionTitle({ code: 'DEVICE PROFILE', title: this.selectedDeviceCode, description: this.selectedDeviceRole() })
      Row() { Text('数据源').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.deviceSource(this.selectedDeviceCode)).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold) }.width('100%').padding(10)
      Row() { Text('关键读数').fontSize(10).fontColor(Theme.muted); Blank(); Text(this.deviceReading(this.selectedDeviceCode)).fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold) }.width('100%').padding(10).backgroundColor(Theme.panelSoft)
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.accent }).borderRadius(3)
  }

  private selectedDeviceRole(): string {
    let role: string = '设备作用'
    this.stage.devices.forEach(item => {
      if (item.code === this.selectedDeviceCode) role = item.code + ' · ' + item.role
    })
    return role
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
        }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => this.selectedTraceCode = run.traceCode)
      }, (run: FactoryRun) => run.traceCode)
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
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
          Text(this.runtimeStage.upstreamImpact || '等待数据').fontSize(11).fontColor(Theme.text).margin({ top: 4 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Column() {
          Text('下游影响').fontSize(9).fontColor(Theme.muted)
          Text(this.runtimeStage.downstreamImpact || '等待数据').fontSize(11).fontColor(Theme.text).margin({ top: 4 })
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
          }.width('100%').padding(11).border({ width: { bottom: 1 }, color: Theme.line })
        }, (alarm: AlarmRecord) => alarm.alarmId)
      }
    }.width('100%').padding(18).margin({ top: 12 }).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line }).borderRadius(3)
  }

  private statusTextForRun(status: string): string {
    return status === 'COMPLETED' ? '已入库' : status === 'REJECTED' ? '已剔除' : status === 'HOLD' ? '待处理' : '运行中'
  }
}
