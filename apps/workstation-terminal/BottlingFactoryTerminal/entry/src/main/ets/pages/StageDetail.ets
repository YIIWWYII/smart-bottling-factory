import { router } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { DeviceStateRow, QualityGateRow, SectionTitle, StateBadge } from '../components/IndustrialComponents'
import { FactoryThreeScene } from '../components/FactoryThreeScene'
import { FACTORY_STAGES, findStage } from '../config/FactoryStages'
import { ActionControlDefinition, controlsForStage, ParameterControlDefinition, WorkstationStageControls } from '../config/WorkstationControls'
import { FactoryRepository } from '../service/FactoryRepository'
import { ApiConfig } from '../service/ApiConfig'
import {
  AgvTask,
  AiAudit,
  AlarmRecord,
  DeviceCommand,
  DeviceCommandPayload,
  DeviceCommandRequestPayload,
  DeviceDefinition,
  FactoryBundle,
  FactoryIncident,
  FactoryRun,
  QualityGateView,
  RuntimeDevice,
  RuntimeStage,
  SensorReading,
  StageDefinition,
  WarehouseZone
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

class ThreeScenePayload {
  stageCode: string = ''
  stageName: string = ''
  source: string = ''
  viewMode: string = 'THREE'
  paused: boolean = false
  statusColors: boolean = true
  layoutEdit: boolean = false
  speed: number = 0.12
  progress: number = 0
  devices: Array<ThreeDevicePayload> = []
  products: Array<ThreeProductPayload> = []
}

class ParameterEdit {
  parameterCode: string = ''
  value: number = 0
}

class PendingCommandDraft {
  deviceCode: string = ''
  commandType: string = ''
  parameterCode: string = ''
  value: number = 0
  unit: string = ''
  label: string = ''
  intent: string = ''
  risk: string = ''
  interlock: string = ''
  dangerous: boolean = false
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
  @State edits: Array<ParameterEdit> = []
  @State pendingDraft: PendingCommandDraft = new PendingCommandDraft()
  @State commandBusy: boolean = false
  @State commandStatus: string = 'IDLE'
  @State commandMessage: string = '尚未发起命令'
  @State auditNo: string = '--'
  @State activeCommandId: string = ''
  private refreshTimer: number = -1
  private motionTimer: number = -1
  private commandTimer: number = -1
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    this.syncCommandFromSnapshot()
  }

  get stage(): StageDefinition {
    return findStage(this.stageCode)
  }

  get stageIndex(): number {
    return FACTORY_STAGES.findIndex((item: StageDefinition) => item.code === this.stageCode)
  }

  get controls(): WorkstationStageControls {
    return controlsForStage(this.stageCode)
  }

  get runtimeStage(): RuntimeStage {
    return this.findRuntimeStage(this.stageCode)
  }

  get stationRuns(): Array<FactoryRun> {
    return this.bundle.dashboard.runs.filter((item: FactoryRun) => item.currentStage === this.stageCode)
  }

  get stationReadings(): Array<SensorReading> {
    return this.bundle.operations.latestReadings.filter((item: SensorReading) => this.normalizeStage(item.stage || '', item.deviceCode) === this.stageCode)
  }

  get stationAlarms(): Array<AlarmRecord> {
    return this.bundle.operations.alarms.filter((item: AlarmRecord) => item.status === 'OPEN' && this.normalizeStage(item.stage || '', item.deviceCode) === this.stageCode)
  }

  get stationIncidents(): Array<FactoryIncident> {
    return this.bundle.runtime.incidents.filter((item: FactoryIncident) => item.stageCode === this.stageCode && item.status !== 'RESOLVED')
  }

  get stationCommands(): Array<DeviceCommand> {
    return this.bundle.operations.commands.filter((item: DeviceCommand) => this.stage.devices.some((device: DeviceDefinition) => device.code === item.deviceCode)).slice(0, 5)
  }

  aboutToAppear(): void {
    const params = router.getParams() as StageParams
    if (params !== undefined && params.stageCode !== undefined && params.stageCode.length > 0) {
      this.stageCode = params.stageCode
    }
    this.resetControlTargets()
    FactoryRepository.subscribe(this.listener)
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
    this.refreshTimer = setInterval(() => void FactoryRepository.refresh(), ApiConfig.refreshIntervalMs)
    this.motionTimer = setInterval(() => {
      if (!this.paused && (this.planarEnabled || this.threeEnabled)) {
        this.motion = (this.motion + Math.max(2, Math.round(this.sceneSpeed() * 30))) % 100
      }
    }, 300)
  }

  aboutToDisappear(): void {
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
    if (this.refreshTimer >= 0) clearInterval(this.refreshTimer)
    if (this.motionTimer >= 0) clearInterval(this.motionTimer)
    if (this.commandTimer >= 0) clearTimeout(this.commandTimer)
  }

  private resetControlTargets(): void {
    const result: Array<ParameterEdit> = []
    controlsForStage(this.stageCode).parameters.forEach((item: ParameterControlDefinition) => {
      const edit = new ParameterEdit()
      edit.parameterCode = item.parameterCode
      edit.value = item.targetValue
      result.push(edit)
    })
    this.edits = result
    this.pendingDraft = new PendingCommandDraft()
  }

  private findRuntimeStage(code: string): RuntimeStage {
    let value: RuntimeStage = { stageCode: code, state: 'RUNNING', bufferLevel: 0, bufferCapacity: 6, upstreamImpact: '等待数据', downstreamImpact: '等待数据' }
    this.bundle.runtime.stages.forEach((item: RuntimeStage) => {
      if (item.stageCode === code) {
        value = item
      }
    })
    return value
  }

  private runtimeDevice(code: string): RuntimeDevice | undefined {
    return this.bundle.runtime.devices.find((item: RuntimeDevice) => item.deviceCode === code)
  }

  private normalizeStage(stage: string, deviceCode: string): string {
    return stage === 'WAREHOUSE_SAFETY' || deviceCode.indexOf('WH-') === 0 ? 'WAREHOUSE_INBOUND' : stage
  }

  private formatTime(value: string | undefined): string {
    return value === undefined || value.length === 0 ? '--' : value.replace('T', ' ').slice(0, 19)
  }

  private stageStateValue(): string {
    if (this.stationAlarms.length > 0) return 'ALARM'
    if (this.runtimeStage.state.length > 0) return this.runtimeStage.state
    return 'UNKNOWN'
  }

  private stageStateText(): string {
    const state = this.stageStateValue()
    if (state === 'RUNNING') return '持续运行'
    if (state === 'ALARM') return '异常待处理'
    if (state === 'BLOCKED') return '下游阻塞'
    if (state === 'STARVED') return '上游缺料'
    if (state === 'HOLD') return '本站保持'
    if (state === 'OFFLINE') return '离线'
    return '未知'
  }

  private deviceRuntime(code: string): string {
    const device = this.runtimeDevice(code)
    return device === undefined || device.state.length === 0 ? 'UNKNOWN' : device.state
  }

  private deviceSource(code: string): string {
    const device = this.runtimeDevice(code)
    if (device === undefined) return '等待数据'
    return device.source + (device.fallback ? ' · 兜底' : '')
  }

  private deviceReading(code: string): string {
    const reading = this.bundle.operations.latestReadings.find((item: SensorReading) => item.deviceCode === code)
    if (reading !== undefined) return reading.value.toString() + ' ' + reading.unit
    const type = this.sensorTypeForDevice(code)
    if (type.length > 0) {
      const typed = this.stationReadings.find((item: SensorReading) => item.sensorType === type)
      if (typed !== undefined) return typed.value.toString() + ' ' + typed.unit
    }
    return '等待读数'
  }

  private sensorTypeForDevice(code: string): string {
    if (code.indexOf('VOC') >= 0 || code === 'GAS-VERIFY-01') return 'VOC'
    if (code.indexOf('TEMP') >= 0) return 'TEMPERATURE'
    if (code.indexOf('HUM') >= 0) return 'HUMIDITY'
    if (code.indexOf('SMOKE') >= 0) return 'SMOKE'
    if (code.indexOf('US') >= 0) return 'AGV_DISTANCE'
    if (code.indexOf('FLOW') >= 0) return 'FLOW'
    if (code.indexOf('LEVEL') >= 0) return 'LEVEL'
    return ''
  }

  private sceneSpeed(): number {
    let speed: number = this.stageCode === 'AGV_TRANSPORT' ? 1 : 0.12
    this.bundle.runtime.devices.forEach((item: RuntimeDevice) => {
      if (item.stageCode === this.stageCode && item.speedMps !== undefined) {
        speed = item.speedMps
      }
    })
    const task = this.bundle.logistics.tasks.find((item: AgvTask) => this.stageCode === 'AGV_TRANSPORT')
    if (task !== undefined) speed = task.speedMps
    return speed
  }

  private sceneProgress(): number {
    let progress: number = this.motion
    this.bundle.runtime.devices.forEach((item: RuntimeDevice) => {
      if (item.stageCode === this.stageCode && item.progress !== undefined) {
        progress = item.progress
      }
    })
    const task = this.bundle.logistics.tasks.find((item: AgvTask) => this.stageCode === 'AGV_TRANSPORT')
    if (task !== undefined && task.totalDistanceM > 0) {
      progress = Math.min(100, Math.round(task.completedDistanceM / task.totalDistanceM * 100))
    }
    return progress
  }

  private scenePayload(viewMode: string): string {
    const payload = new ThreeScenePayload()
    payload.stageCode = this.stageCode
    payload.stageName = this.stage.name
    payload.source = this.bundle.source
    payload.viewMode = viewMode
    payload.paused = this.paused
    payload.statusColors = this.statusColorsEnabled
    payload.layoutEdit = this.layoutEditEnabled
    payload.speed = this.sceneSpeed()
    payload.progress = this.sceneProgress()
    this.stage.devices.forEach((device: DeviceDefinition) => {
      const item = new ThreeDevicePayload()
      item.code = device.code
      item.name = device.name
      item.state = this.deviceRuntime(device.code)
      item.source = this.deviceSource(device.code)
      item.reading = this.deviceReading(device.code)
      payload.devices.push(item)
    })
    this.stationRuns.slice(0, 8).forEach((run: FactoryRun) => {
      const item = new ThreeProductPayload()
      item.traceCode = run.traceCode
      item.bottleType = run.bottleType || '待识别'
      item.status = run.status
      item.defectType = run.defectType || ''
      payload.products.push(item)
    })
    return JSON.stringify(payload)
  }

  private qualityGates(): Array<QualityGateView> {
    const eventFail = this.bundle.dashboard.runs.some((run: FactoryRun) => run.events.some(event => event.stage === this.stageCode && event.status === 'FAILED'))
    const eventPass = this.bundle.dashboard.runs.some((run: FactoryRun) => run.events.some(event => event.stage === this.stageCode && event.status === 'PASSED'))
    const interlock: QualityGateView = {
      label: '设备联锁',
      standard: '设备在线、无开放报警、缓冲未阻塞',
      actual: this.stageStateText(),
      status: this.stationAlarms.length > 0 || this.runtimeStage.state === 'BLOCKED' || this.runtimeStage.state === 'OFFLINE' ? 'FAIL' : this.runtimeStage.state === 'RUNNING' ? 'PASS' : 'WAIT',
      source: '工位运行态'
    }
    const eventGate: QualityGateView = {
      label: '工序事件判定',
      standard: '产品事件链 PASSED',
      actual: eventFail ? '存在失败事件' : eventPass ? '最近记录通过' : '等待产品判定',
      status: eventFail ? 'FAIL' : eventPass ? 'PASS' : 'WAIT',
      source: '产品追踪'
    }
    if (this.stageCode === 'GAS_INSPECTION') {
      const reading = this.stationReadings.find((item: SensorReading) => item.sensorType === 'VOC')
      return [{
        label: 'VOC 安全浓度',
        standard: '<= 10 ppm',
        actual: reading === undefined ? '等待传感器上报' : reading.value.toString() + ' ' + reading.unit,
        status: reading === undefined ? 'WAIT' : reading.value <= 10 ? 'PASS' : 'FAIL',
        source: reading === undefined ? 'VOC 传感器' : reading.mode
      }, interlock]
    }
    if (this.stageCode === 'BEVERAGE_READY') {
      const reading = this.stationReadings.find((item: SensorReading) => item.sensorType === 'TEMPERATURE')
      return [{
        label: '饮料温度',
        standard: '20-30 °C',
        actual: reading === undefined ? '等待温度读数' : reading.value.toString() + ' ' + reading.unit,
        status: reading === undefined ? 'WAIT' : reading.value >= 20 && reading.value <= 30 ? 'PASS' : 'FAIL',
        source: reading === undefined ? '温度传感器' : reading.mode
      }, eventGate, interlock]
    }
    if (this.stageCode === 'AGV_TRANSPORT') {
      const task = this.bundle.logistics.tasks.length > 0 ? this.bundle.logistics.tasks[0] : undefined
      return [{
        label: '超声波避障',
        standard: '>= 20 cm',
        actual: task === undefined ? '等待 AGV 报文' : task.obstacleDistanceCm.toString() + ' cm',
        status: task === undefined ? 'WAIT' : task.obstacleDistanceCm >= 20 ? 'PASS' : 'FAIL',
        source: task === undefined ? '超声波传感器' : task.mode
      }, interlock]
    }
    if (this.stageCode === 'WAREHOUSE_INBOUND') {
      const zone = this.bundle.logistics.zones.length > 0 ? this.bundle.logistics.zones[0] : undefined
      return [{
        label: '仓区安全',
        standard: 'SAFE、VOC <= 10 ppm、烟雾 <= 0.5%',
        actual: zone === undefined ? '等待仓区报文' : zone.status + ' · VOC ' + zone.vocPpm.toString() + ' ppm',
        status: zone === undefined ? 'WAIT' : zone.status === 'SAFE' && zone.vocPpm <= 10 && zone.smoke <= 0.5 ? 'PASS' : 'FAIL',
        source: '仓区安全传感器'
      }, interlock]
    }
    return [eventGate, interlock]
  }

  private qualitySummary(): string {
    const gates = this.qualityGates()
    if (gates.some((item: QualityGateView) => item.status === 'FAIL')) return '禁止自动放行'
    if (gates.some((item: QualityGateView) => item.status === 'WAIT')) return '等待判定数据'
    return '满足放行条件'
  }

  private targetValue(parameterCode: string): number {
    let value: number = 0
    this.edits.forEach((item: ParameterEdit) => {
      if (item.parameterCode === parameterCode) value = item.value
    })
    return value
  }

  private setTarget(control: ParameterControlDefinition, delta: number): void {
    const next: Array<ParameterEdit> = []
    this.edits.forEach((item: ParameterEdit) => {
      const edit = new ParameterEdit()
      edit.parameterCode = item.parameterCode
      edit.value = item.parameterCode === control.parameterCode ? Math.max(control.min, Math.min(control.max, Number((item.value + delta).toFixed(2)))) : item.value
      next.push(edit)
    })
    this.edits = next
  }

  private canSendCommands(): boolean {
    return this.bundle.online && this.bundle.source === 'BACKEND' && !this.commandBusy
  }

  private commandBlockReason(controlDangerous: boolean): string {
    if (!this.bundle.online || this.bundle.source !== 'BACKEND') return '后端不可达或本地演示模式，只读'
    if (this.commandBusy) return '已有命令等待回执'
    if (this.stageStateValue() === 'OFFLINE') return '本站离线'
    if (controlDangerous && this.stationAlarms.length > 0) return '存在开放报警，危险操作禁用'
    if (controlDangerous && this.qualitySummary() === '禁止自动放行') return '质量门失败，危险操作禁用'
    return ''
  }

  private prepareParameter(control: ParameterControlDefinition): void {
    const draft = new PendingCommandDraft()
    draft.deviceCode = control.deviceCode
    draft.commandType = control.commandType
    draft.parameterCode = control.parameterCode
    draft.value = this.targetValue(control.parameterCode)
    draft.unit = control.unit
    draft.label = control.label
    draft.intent = '调整 ' + control.label + ' 到 ' + draft.value.toString() + ' ' + control.unit
    draft.risk = control.risk
    draft.interlock = control.interlock
    draft.dangerous = true
    this.pendingDraft = draft
    this.commandStatus = 'CONFIRM_REQUIRED'
    this.commandMessage = '请核对风险提示后再次确认发送'
  }

  private prepareAction(control: ActionControlDefinition): void {
    const draft = new PendingCommandDraft()
    draft.deviceCode = control.deviceCode
    draft.commandType = control.commandType
    draft.parameterCode = ''
    draft.value = 0
    draft.unit = ''
    draft.label = control.label
    draft.intent = control.intent
    draft.risk = control.risk
    draft.interlock = control.interlock
    draft.dangerous = control.dangerous
    this.pendingDraft = draft
    this.commandStatus = 'CONFIRM_REQUIRED'
    this.commandMessage = '请核对风险提示后再次确认发送'
  }

  private clearDraft(): void {
    this.pendingDraft = new PendingCommandDraft()
    this.commandStatus = this.activeCommandId.length > 0 ? this.commandStatus : 'IDLE'
    this.commandMessage = this.activeCommandId.length > 0 ? this.commandMessage : '尚未发起命令'
  }

  private async confirmCommand(): Promise<void> {
    const reason = this.commandBlockReason(this.pendingDraft.dangerous)
    if (reason.length > 0 || this.pendingDraft.commandType.length === 0) {
      this.commandStatus = 'BLOCKED'
      this.commandMessage = reason.length > 0 ? reason : '没有待确认命令'
      return
    }
    this.commandBusy = true
    this.commandStatus = 'PENDING'
    this.commandMessage = 'HTTP 已发送，等待后端受理'
    const payload = new DeviceCommandPayload()
    payload.stageCode = this.stageCode
    payload.parameterCode = this.pendingDraft.parameterCode
    payload.value = this.pendingDraft.value
    payload.unit = this.pendingDraft.unit
    payload.intent = this.pendingDraft.intent
    payload.risk = this.pendingDraft.risk
    payload.interlock = this.pendingDraft.interlock
    payload.clientRequestNo = 'TERM-' + Date.now().toString()
    const request = new DeviceCommandRequestPayload()
    request.deviceCode = this.pendingDraft.deviceCode
    request.commandType = this.pendingDraft.commandType
    request.payload = payload
    request.source = 'WORKSTATION_TERMINAL'
    request.traceCode = this.selectedTraceCode
    try {
      const command = await FactoryRepository.createCommand(request)
      this.activeCommandId = command.commandId
      this.auditNo = command.commandId
      this.commandStatus = command.status
      this.commandMessage = command.message || '后端已受理，等待边缘层回执'
      this.pendingDraft = new PendingCommandDraft()
      if (this.commandTimer >= 0) clearTimeout(this.commandTimer)
      this.commandTimer = setTimeout(() => {
        if (this.commandBusy && (this.commandStatus === 'PENDING' || this.commandStatus === 'SENT')) {
          this.commandBusy = false
          this.commandStatus = 'TIMEOUT'
          this.commandMessage = '未收到边缘层最终回执，请在管理端或后端命令记录中复核'
        }
      }, 12000)
    } catch (error) {
      this.commandBusy = false
      this.commandStatus = 'FAILED'
      this.commandMessage = error instanceof Error ? error.message : '命令创建失败'
    }
  }

  private syncCommandFromSnapshot(): void {
    if (this.activeCommandId.length === 0) return
    const command = this.bundle.operations.commands.find((item: DeviceCommand) => item.commandId === this.activeCommandId)
    if (command === undefined) return
    this.commandStatus = command.status
    this.commandMessage = command.message || this.commandMessage
    if (command.status === 'ACKNOWLEDGED' || command.status === 'FAILED' || command.status === 'CANCELLED' || command.status === 'TIMEOUT') {
      this.commandBusy = false
      if (this.commandTimer >= 0) clearTimeout(this.commandTimer)
      this.commandTimer = -1
    }
  }

  private navigateStage(offset: number): void {
    const next = this.stageIndex + offset
    if (next >= 0 && next < FACTORY_STAGES.length) {
      router.replaceUrl({ url: 'pages/StageDetail', params: { stageCode: FACTORY_STAGES[next].code } })
    }
  }

  private statusTextForRun(status: string): string {
    if (status === 'COMPLETED') return '已完成'
    if (status === 'REJECTED') return '已剔除'
    if (status === 'HOLD') return '待处理'
    return '运行中'
  }

  build() {
    Scroll() {
      Column() {
        this.topBar()
        this.stageHeader()
        this.visualSection()
        this.stationSnapshotSection()
        this.controlSection()
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding({ bottom: 32 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(Theme.page)
  }

  @Builder
  topBar() {
    Row() {
      Button('← 工位列表')
        .type(ButtonType.Normal)
        .fontColor('#FFFFFF')
        .backgroundColor(Color.Transparent)
        .onClick(() => router.back())
      Blank()
      Text(FactoryRepository.realtimeOnline ? 'WebSocket 在线' : 'WebSocket 重连中')
        .fontSize(10)
        .fontColor(FactoryRepository.realtimeOnline ? '#D8F5E7' : '#F5D99C')
      Text(this.bundle.source)
        .fontSize(10)
        .fontColor('#FFFFFF')
        .margin({ left: 12 })
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: 7, bottom: 7 })
    .backgroundColor(Theme.navy)
  }

  @Builder
  stageHeader() {
    Column() {
      Row() {
        Column() {
          Text(this.stage.code + ' · 工位 ' + (this.stageIndex + 1).toString() + ' / ' + FACTORY_STAGES.length.toString())
            .fontSize(10)
            .fontColor(Theme.accent)
            .fontWeight(FontWeight.Bold)
          Text(this.stage.name + '工位')
            .fontSize(30)
            .fontColor(Theme.navy)
            .fontWeight(FontWeight.Bold)
            .margin({ top: 7 })
          Text(this.stage.description)
            .fontSize(12)
            .fontColor(Theme.muted)
            .lineHeight(18)
            .margin({ top: 6 })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        StateBadge({ status: this.stageStateValue(), label: this.stageStateText() })
      }
      .width('100%')
      .alignItems(VerticalAlign.Bottom)

      Scroll() {
        Row({ space: 8 }) {
          this.metric('运行状态', this.stageStateText(), this.formatTime(this.runtimeStage.updatedAt), this.stageStateValue())
          this.metric('在制品', this.stationRuns.length.toString(), '本站正在处理', 'RUNNING')
          this.metric('缓冲', this.runtimeStage.bufferLevel.toString() + '/' + this.runtimeStage.bufferCapacity.toString(), '输入/输出缓冲', this.runtimeStage.bufferLevel >= this.runtimeStage.bufferCapacity ? 'WARNING' : 'RUNNING')
          this.metric('报警', this.stationAlarms.length.toString(), '开放报警', this.stationAlarms.length > 0 ? 'ALARM' : 'RUNNING')
          this.metric('数据源', this.bundle.source, this.bundle.online ? '后端快照' : '只读演示', this.bundle.online ? 'RUNNING' : 'WAIT')
        }
        .padding({ top: 16 })
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')

      Row() {
        Button('← 上一工位')
          .type(ButtonType.Normal)
          .fontColor(Theme.blue)
          .backgroundColor(Color.Transparent)
          .enabled(this.stageIndex > 0)
          .onClick(() => this.navigateStage(-1))
        Blank()
        Button('下一工位 →')
          .type(ButtonType.Normal)
          .fontColor(Theme.blue)
          .backgroundColor(Color.Transparent)
          .enabled(this.stageIndex < FACTORY_STAGES.length - 1)
          .onClick(() => this.navigateStage(1))
      }
      .width('100%')
      .margin({ top: 10 })
    }
    .width('100%')
    .padding(18)
    .backgroundColor(Theme.panel)
    .border({ width: { bottom: 3 }, color: Theme.blue })
  }

  @Builder
  visualSection() {
    Column() {
      SectionTitle({ code: '01 REALTIME SCENE', title: '实时作业画面', description: '2D 平面工艺图与 3D 立体场景均由 HAP 本地 ArkWeb Three.js 加载，并共享同一份实时快照。' })
      Scroll() {
        Row({ space: 8 }) {
          this.visualToggle('2D 平面图', this.planarEnabled, 'PLANAR')
          this.visualToggle('3D 立体图', this.threeEnabled, 'THREE')
          this.visualToggle('状态着色', this.statusColorsEnabled, 'COLORS')
          this.visualToggle('布局拖拽', this.layoutEditEnabled, 'LAYOUT')
          Button(this.paused ? '恢复实时' : '暂停画面')
            .type(ButtonType.Normal)
            .fontSize(10)
            .fontColor(this.paused ? '#FFFFFF' : Theme.navy)
            .backgroundColor(this.paused ? Theme.warning : '#E7F0F5')
            .border({ width: 1, color: this.paused ? Theme.warning : Theme.line })
            .borderRadius(2)
            .onClick(() => this.paused = !this.paused)
        }
        .padding({ top: 12, bottom: 8 })
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')

      if (this.planarEnabled) {
        this.scenePanel('THREE.JS 2D PLAN', '平面工艺符号 · 点击设备/物料查看 · 拖拽设备保存本站布局', 'PLANAR', 260)
      }
      if (this.threeEnabled) {
        this.scenePanel('THREE.JS 3D', this.layoutEditEnabled ? '拖拽设备调整位置' : '拖拽旋转 · 滚轮缩放 · 点击查看', 'THREE', 360)
      }
      if (!this.planarEnabled && !this.threeEnabled) {
        Column() {
          Text('可视化已关闭').fontSize(18).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
          Text('实时数据仍继续刷新，关闭只停止 ArkWeb 渲染以节省 GPU 和内存。').fontSize(10).fontColor(Theme.muted).margin({ top: 8 })
        }
        .width('100%')
        .height(170)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor(Theme.panelSoft)
        .margin({ top: 12 })
      }
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.blue })
  }

  @Builder
  scenePanel(title: string, hint: string, viewMode: string, height: number) {
    Column() {
      Row() {
        Text(title).fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
        Blank()
        Text(hint).fontSize(9).fontColor(this.layoutEditEnabled ? Theme.warning : Theme.muted)
      }
      .width('100%')
      .padding({ bottom: 8 })
      FactoryThreeScene({
        payload: this.scenePayload(viewMode),
        sceneHeight: height,
        label: title,
        selectedDeviceCode: $selectedDeviceCode,
        selectedTraceCode: $selectedTraceCode
      })
    }
    .width('100%')
    .padding(12)
    .margin({ top: 10 })
    .backgroundColor(Theme.panelSoft)
  }

  @Builder
  stationSnapshotSection() {
    Column() {
      this.deviceSection()
      this.sensorSection()
      this.materialSection()
      this.qualitySection()
      this.bufferSection()
      this.alarmSection()
      if (this.selectedDeviceCode.length > 0) this.deviceProfile()
      if (this.selectedTraceCode.length > 0) this.productProfile()
    }
    .width('100%')
  }

  @Builder
  deviceSection() {
    Column() {
      SectionTitle({ code: '02 DEVICES', title: '设备运行清单', description: '本站直接相关设备，点击设备可查看角色、来源和读数。' })
      ForEach(this.stage.devices, (device: DeviceDefinition, index: number) => {
        Row() {
          DeviceStateRow({ index: index, device: device, state: this.deviceRuntime(device.code), source: this.deviceSource(device.code), reading: this.deviceReading(device.code) })
        }
        .width('100%')
        .onClick(() => this.selectedDeviceCode = device.code)
      }, (device: DeviceDefinition) => device.code)
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line })
  }

  @Builder
  sensorSection() {
    Column() {
      SectionTitle({ code: '03 SENSORS', title: '传感器读数', description: '只展示本站相关读数，缺失字段显示等待数据。' })
      if (this.stationReadings.length === 0) {
        Text('等待本站传感器上报。').fontSize(10).fontColor(Theme.muted).padding(12)
      } else {
        ForEach(this.stationReadings, (reading: SensorReading) => {
          Row({ space: 10 }) {
            Circle().width(8).height(8).fill(reading.quality === 'GOOD' ? Theme.success : Theme.warning)
            Column() {
              Text(reading.sensorType + ' · ' + reading.deviceCode).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold)
              Text(reading.mode + ' · ' + this.formatTime(reading.occurredAt)).fontSize(9).fontColor(Theme.muted).margin({ top: 3 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Text(reading.value.toString() + ' ' + reading.unit).fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
          }
          .width('100%')
          .padding(11)
          .border({ width: { bottom: 1 }, color: Theme.line })
        }, (reading: SensorReading) => reading.readingId)
      }
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line })
  }

  @Builder
  materialSection() {
    Column() {
      SectionTitle({ code: '04 MATERIALS', title: '在制品与物料', description: '当前工位产品追踪号、瓶型、批次、质量事件和更新时间。' })
      if (this.stationRuns.length === 0) {
        Text('本站当前没有在制品，可能处于首批未到达或上游缺料状态。').fontSize(10).fontColor(Theme.muted).padding(12)
      } else {
        ForEach(this.stationRuns.slice(0, 8), (run: FactoryRun) => {
          Row({ space: 9 }) {
            Circle().width(9).height(9).fill(statusColor(run.status))
            Column() {
              Text(run.traceCode).fontSize(10).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
              Text((run.bottleType || '待识别') + ' · ' + (run.batchCode || '批次待绑定') + ' · ' + this.statusTextForRun(run.status)).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Text(run.defectType || '质量事件待确认').fontSize(9).fontColor(run.defectType === undefined ? Theme.muted : Theme.danger)
          }
          .width('100%')
          .padding(11)
          .border({ width: { bottom: 1 }, color: Theme.line })
          .onClick(() => this.selectedTraceCode = run.traceCode)
        }, (run: FactoryRun) => run.traceCode)
      }
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line })
  }

  @Builder
  qualitySection() {
    Column() {
      SectionTitle({ code: '05 QUALITY GATE', title: '质量门', description: '本站放行条件和联锁条件，最终判定以后端为准。' })
      Row() {
        Circle().width(9).height(9).fill(this.qualitySummary() === '满足放行条件' ? Theme.success : this.qualitySummary() === '等待判定数据' ? Theme.warning : Theme.danger)
        Text(this.qualitySummary()).fontSize(14).fontColor(this.qualitySummary() === '满足放行条件' ? Theme.success : Theme.danger).fontWeight(FontWeight.Bold).margin({ left: 8 })
      }
      .width('100%')
      .padding(12)
      .backgroundColor('#F1F7FB')
      .margin({ top: 12 })
      ForEach(this.qualityGates(), (gate: QualityGateView) => {
        QualityGateRow({ gate: gate })
      }, (gate: QualityGateView) => gate.label)
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line })
  }

  @Builder
  bufferSection() {
    Column() {
      SectionTitle({ code: '06 BUFFER', title: '缓冲与上下游影响', description: '本站通过缓冲与上下游解耦，异常不默认整线停机。' })
      Row({ space: 10 }) {
        this.impactCard('输入/输出缓冲', this.runtimeStage.bufferLevel.toString() + '/' + this.runtimeStage.bufferCapacity.toString(), '当前占用')
        this.impactCard('上游影响', this.runtimeStage.upstreamImpact || '等待数据', '来自 RuntimeStage')
        this.impactCard('下游影响', this.runtimeStage.downstreamImpact || '等待数据', '来自 RuntimeStage')
      }
      .width('100%')
      .padding({ top: 12 })
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line })
  }

  @Builder
  alarmSection() {
    Column() {
      SectionTitle({ code: '07 ALARMS', title: '报警与异常策略', description: '本站只展示和本站有关的报警、异常和处理策略。' })
      if (this.stationAlarms.length === 0 && this.stationIncidents.length === 0) {
        Text('当前没有本站开放报警或待处理异常。').fontSize(10).fontColor(Theme.muted).padding(12)
      }
      ForEach(this.stationAlarms, (alarm: AlarmRecord) => {
        Row({ space: 10 }) {
          Circle().width(8).height(8).fill(Theme.danger)
          Column() {
            Text(alarm.alarmType + ' · ' + alarm.deviceCode).fontSize(10).fontColor(Theme.danger).fontWeight(FontWeight.Bold)
            Text(alarm.message).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text('管理端确认').fontSize(9).fontColor(Theme.warning)
        }
        .width('100%')
        .padding(11)
        .border({ width: { bottom: 1 }, color: Theme.line })
      }, (alarm: AlarmRecord) => alarm.alarmId)
      ForEach(this.stationIncidents, (incident: FactoryIncident) => {
        Row({ space: 10 }) {
          Circle().width(8).height(8).fill(Theme.warning)
          Column() {
            Text(incident.strategy + ' · ' + (incident.deviceCode || '本站')).fontSize(10).fontColor(Theme.warning).fontWeight(FontWeight.Bold)
            Text(incident.message).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(incident.status).fontSize(9).fontColor(Theme.blue)
        }
        .width('100%')
        .padding(11)
        .border({ width: { bottom: 1 }, color: Theme.line })
      }, (incident: FactoryIncident) => incident.incidentId)
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.line })
  }

  @Builder
  controlSection() {
    Column() {
      SectionTitle({ code: '08 CONTROL', title: '本站调参与控制', description: '控制请求通过 HTTP 创建命令，HTTP 成功只代表后端受理，最终结果等待 WebSocket/HTTP 回执。' })
      Text(this.commandBlockReason(false).length > 0 ? this.commandBlockReason(false) : '后端在线时可发起本站命令；危险动作会额外检查报警和质量门。')
        .fontSize(10)
        .fontColor(this.commandBlockReason(false).length > 0 ? Theme.warning : Theme.muted)
        .margin({ top: 10, bottom: 8 })
      ForEach(this.controls.parameters, (control: ParameterControlDefinition) => {
        this.parameterControl(control)
      }, (control: ParameterControlDefinition) => control.parameterCode)
      ForEach(this.controls.actions, (control: ActionControlDefinition) => {
        this.actionControl(control)
      }, (control: ActionControlDefinition) => control.commandType + control.deviceCode)
      this.pendingConfirmPanel()
      this.commandStatusPanel()
      this.commandHistoryPanel()
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.blue })
  }

  @Builder
  parameterControl(control: ParameterControlDefinition) {
    Column() {
      Row() {
        Column() {
          Text(control.label + ' · ' + control.deviceCode).fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
          Text(control.role).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
          Text('范围 ' + control.min.toString() + '-' + control.max.toString() + ' ' + control.unit + ' · 步长 ' + control.step.toString() + ' · ' + control.source).fontSize(8).fontColor(Theme.muted).margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Column() {
          Text('当前 ' + control.currentValue.toString() + ' ' + control.unit).fontSize(9).fontColor(Theme.muted)
          Text('目标 ' + this.targetValue(control.parameterCode).toString() + ' ' + control.unit).fontSize(16).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.End)
      }
      .width('100%')
      Row({ space: 8 }) {
        Button('-').width(42).height(34).enabled(this.canSendCommands()).onClick(() => this.setTarget(control, -control.step))
        Button('+').width(42).height(34).enabled(this.canSendCommands()).onClick(() => this.setTarget(control, control.step))
        Button('发送调整')
          .layoutWeight(1)
          .height(34)
          .fontSize(11)
          .fontColor('#FFFFFF')
          .backgroundColor(this.commandBlockReason(true).length === 0 ? Theme.blue : Theme.neutral)
          .enabled(this.commandBlockReason(true).length === 0)
          .onClick(() => this.prepareParameter(control))
      }
      .width('100%')
      .margin({ top: 10 })
      Text('联锁：' + control.interlock + '；风险：' + control.risk).fontSize(8).fontColor(Theme.muted).margin({ top: 8 })
    }
    .width('100%')
    .padding(12)
    .margin({ top: 10 })
    .backgroundColor(Theme.panelSoft)
    .border({ width: 1, color: Theme.line })
  }

  @Builder
  actionControl(control: ActionControlDefinition) {
    Row({ space: 10 }) {
      Column() {
        Text(control.label + ' · ' + control.deviceCode).fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
        Text(control.intent).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
        Text('联锁：' + control.interlock).fontSize(8).fontColor(Theme.muted).margin({ top: 4 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Button(control.dangerous ? '确认动作' : '发起动作')
        .height(34)
        .fontSize(10)
        .fontColor('#FFFFFF')
        .backgroundColor(this.commandBlockReason(control.dangerous).length === 0 ? (control.dangerous ? Theme.warning : Theme.blue) : Theme.neutral)
        .enabled(this.commandBlockReason(control.dangerous).length === 0)
        .onClick(() => this.prepareAction(control))
    }
    .width('100%')
    .padding(12)
    .margin({ top: 10 })
    .backgroundColor(Theme.panelSoft)
    .border({ width: 1, color: Theme.line })
  }

  @Builder
  pendingConfirmPanel() {
    if (this.pendingDraft.commandType.length > 0) {
      Column() {
        Text('二次确认').fontSize(10).fontColor(Theme.warning).fontWeight(FontWeight.Bold)
        Text(this.pendingDraft.label + ' · ' + this.pendingDraft.commandType).fontSize(15).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 5 })
        Text(this.pendingDraft.intent).fontSize(10).fontColor(Theme.text).margin({ top: 6 })
        Text('风险：' + this.pendingDraft.risk).fontSize(9).fontColor(Theme.danger).margin({ top: 6 })
        Row({ space: 8 }) {
          Button('取消').layoutWeight(1).height(36).backgroundColor('#E7F0F5').fontColor(Theme.navy).onClick(() => this.clearDraft())
          Button('确认发送到后端').layoutWeight(1).height(36).backgroundColor(Theme.warning).fontColor('#FFFFFF').enabled(!this.commandBusy).onClick(() => void this.confirmCommand())
        }
        .width('100%')
        .margin({ top: 12 })
      }
      .width('100%')
      .padding(12)
      .margin({ top: 12 })
      .backgroundColor('#FFF7E8')
      .border({ width: { left: 4, top: 1, right: 1, bottom: 1 }, color: Theme.warning })
    }
  }

  @Builder
  commandStatusPanel() {
    Row({ space: 10 }) {
      Circle().width(9).height(9).fill(statusColor(this.commandStatus))
      Column() {
        Text('命令状态：' + this.commandStatus).fontSize(12).fontColor(statusColor(this.commandStatus)).fontWeight(FontWeight.Bold)
        Text(this.commandMessage).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Text('审计号 ' + this.auditNo).fontSize(9).fontColor(Theme.blue)
    }
    .width('100%')
    .padding(12)
    .margin({ top: 12 })
    .backgroundColor('#F1F7FB')
    .border({ width: 1, color: Theme.line })
  }

  @Builder
  commandHistoryPanel() {
    Column() {
      Text('最近本站命令').fontSize(12).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
      if (this.stationCommands.length === 0) {
        Text('暂无命令记录。').fontSize(9).fontColor(Theme.muted).margin({ top: 8 })
      } else {
        ForEach(this.stationCommands, (command: DeviceCommand) => {
          Row() {
            Column() {
              Text(command.commandType + ' · ' + command.deviceCode).fontSize(10).fontColor(Theme.text).fontWeight(FontWeight.Bold)
              Text(this.formatTime(command.createdAt) + ' · ' + (command.message || '等待回执')).fontSize(8).fontColor(Theme.muted).margin({ top: 3 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Text(command.status).fontSize(9).fontColor(statusColor(command.status)).fontWeight(FontWeight.Bold)
          }
          .width('100%')
          .padding({ top: 9, bottom: 9 })
          .border({ width: { bottom: 1 }, color: Theme.line })
        }, (command: DeviceCommand) => command.commandId)
      }
    }
    .width('100%')
    .padding(12)
    .margin({ top: 12 })
    .backgroundColor(Theme.panelSoft)
  }

  @Builder
  deviceProfile() {
    Column() {
      SectionTitle({ code: 'DEVICE PROFILE', title: this.selectedDeviceCode, description: this.selectedDeviceRole() })
      Row() {
        Text('数据源').fontSize(10).fontColor(Theme.muted)
        Blank()
        Text(this.deviceSource(this.selectedDeviceCode)).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
      }
      .width('100%')
      .padding(10)
      Row() {
        Text('关键读数').fontSize(10).fontColor(Theme.muted)
        Blank()
        Text(this.deviceReading(this.selectedDeviceCode)).fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
      }
      .width('100%')
      .padding(10)
      .backgroundColor(Theme.panelSoft)
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.accent })
  }

  @Builder
  productProfile() {
    Column() {
      SectionTitle({ code: 'PRODUCT PROFILE', title: this.selectedTraceCode, description: '选中物料的追踪信息。' })
      ForEach(this.bundle.dashboard.runs.filter((item: FactoryRun) => item.traceCode === this.selectedTraceCode), (run: FactoryRun) => {
        this.keyValue('瓶型', run.bottleType || '待识别')
        this.keyValue('批次', run.batchCode || '待绑定')
        this.keyValue('当前工位', run.currentStage)
        this.keyValue('产品状态', this.statusTextForRun(run.status))
        this.keyValue('更新时间', this.formatTime(run.updatedAt))
      }, (run: FactoryRun) => run.traceCode)
    }
    .width('100%')
    .padding(18)
    .margin({ top: 12 })
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.accent })
  }

  private selectedDeviceRole(): string {
    let role: string = '设备作用等待数据'
    this.stage.devices.forEach((item: DeviceDefinition) => {
      if (item.code === this.selectedDeviceCode) role = item.name + ' · ' + item.role
    })
    return role
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
      .onClick(() => {
        if (key === 'PLANAR') this.planarEnabled = !this.planarEnabled
        if (key === 'THREE') this.threeEnabled = !this.threeEnabled
        if (key === 'COLORS') this.statusColorsEnabled = !this.statusColorsEnabled
        if (key === 'LAYOUT') this.layoutEditEnabled = !this.layoutEditEnabled
      })
  }

  @Builder
  metric(label: string, value: string, note: string, tone: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.muted)
      Text(value).fontSize(17).fontColor(statusColor(tone)).fontWeight(FontWeight.Bold).margin({ top: 5 })
      Text(note).fontSize(8).fontColor(Theme.muted).margin({ top: 3 }).maxLines(1)
    }
    .alignItems(HorizontalAlign.Start)
    .width(160)
    .height(78)
    .padding(10)
    .backgroundColor(Theme.panelSoft)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: statusColor(tone) })
  }

  @Builder
  impactCard(label: string, value: string, note: string) {
    Column() {
      Text(label).fontSize(9).fontColor(Theme.muted)
      Text(value).fontSize(12).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 6 }).maxLines(2)
      Text(note).fontSize(8).fontColor(Theme.muted).margin({ top: 4 })
    }
    .alignItems(HorizontalAlign.Start)
    .layoutWeight(1)
    .constraintSize({ minHeight: 80 })
    .padding(10)
    .backgroundColor(Theme.panelSoft)
    .border({ width: 1, color: Theme.line })
  }

  @Builder
  keyValue(label: string, value: string) {
    Row() {
      Text(label).fontSize(10).fontColor(Theme.muted)
      Blank()
      Text(value).fontSize(11).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
    }
    .width('100%')
    .padding(10)
    .border({ width: { bottom: 1 }, color: Theme.line })
  }
}
