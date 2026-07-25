import { router } from '@kit.ArkUI'
import { Theme, statusColor } from '../common/Theme'
import { DeviceStateRow, QualityGateRow, SectionTitle, StateBadge } from '../components/IndustrialComponents'
import { FactoryThreeScene } from '../components/FactoryThreeScene'
import { FACTORY_STAGES, findStage } from '../config/FactoryStages'
import { ActionControlDefinition, controlsForStage, ParameterControlDefinition, WorkstationStageControls } from '../config/WorkstationControls'
import { FactoryRepository } from '../service/FactoryRepository'
import { ApiConfig } from '../service/ApiConfig'
import { apiClient } from '../service/ApiClient'
import { SessionStore } from '../service/SessionStore'
import { isFinalCommandStatus } from '../service/WorkstationPolicy'
import {
  AgvTask,
  AiAudit,
  AlarmRecord,
  DeviceCommand,
  DeviceCapability,
  DeviceCommandParameters,
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
  StageSnapshot,
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
  stateVersion: number = 0
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
  requiredRole: string = 'OPERATOR'
}

@Entry
@Component
struct StageDetail {
  @State stageCode: string = 'PRETREATMENT'
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State snapshot: StageSnapshot = FactoryRepository.stageSnapshot
  @State selectedDeviceCode: string = ''
  @State selectedTraceCode: string = ''
  @State planarEnabled: boolean = true
  @State threeEnabled: boolean = true
  @State statusColorsEnabled: boolean = true
  @State layoutEditEnabled: boolean = false
  @State paused: boolean = false
  @State sessionRevision: number = 0
  @State username: string = ''
  @State password: string = ''
  @State loginBusy: boolean = false
  @State loginMessage: string = '未登录时终端保持只读'
  @State edits: Array<ParameterEdit> = []
  @State pendingDraft: PendingCommandDraft = new PendingCommandDraft()
  @State commandBusy: boolean = false
  @State commandStatus: string = 'IDLE'
  @State commandMessage: string = '尚未发起命令'
  @State auditNo: string = '--'
  @State activeCommandId: string = ''
  private refreshTimer: number = -1
  private commandTimer: number = -1
  private commandPollCount: number = 0
  private listener: () => void = () => {
    this.bundle = FactoryRepository.bundle
    this.snapshot = FactoryRepository.stageSnapshot
    this.syncCommandFromSnapshot()
  }
  private sessionListener: () => void = () => this.sessionRevision++

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
    return {
      stageCode: this.snapshot.stageCode,
      state: this.snapshot.state,
      bufferLevel: this.snapshot.buffer.inputLevel,
      bufferCapacity: this.snapshot.buffer.capacity,
      upstreamImpact: this.snapshot.upstream.length > 0 ? this.snapshot.upstream[0].materialFlow : '等待数据',
      downstreamImpact: this.snapshot.downstream.length > 0 ? this.snapshot.downstream[0].materialFlow : '等待数据',
      updatedAt: this.snapshot.generatedAt
    }
  }

  get stationRuns(): Array<FactoryRun> {
    return this.snapshot.products
  }

  get stationReadings(): Array<SensorReading> {
    return this.snapshot.sensors
  }

  get stationAlarms(): Array<AlarmRecord> {
    return this.snapshot.alarms.filter((item: AlarmRecord) => item.status === 'OPEN')
  }

  get stationIncidents(): Array<FactoryIncident> {
    return this.snapshot.incidents.filter((item: FactoryIncident) => item.status !== 'RESOLVED')
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
    SessionStore.subscribe(this.sessionListener)
    void FactoryRepository.refresh(this.stageCode)
    if (SessionStore.isAuthenticated) void this.validateSession()
    FactoryRepository.connectRealtime()
    this.refreshTimer = setInterval(() => void FactoryRepository.refresh(this.stageCode), ApiConfig.refreshIntervalMs)
  }

  aboutToDisappear(): void {
    FactoryRepository.unsubscribe(this.listener)
    SessionStore.unsubscribe(this.sessionListener)
    FactoryRepository.closeRealtime()
    if (this.refreshTimer >= 0) clearInterval(this.refreshTimer)
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
    return this.snapshot.devices.find((item: RuntimeDevice) => item.deviceCode === code)
  }

  private normalizeStage(stage: string, deviceCode: string): string {
    return stage === 'WAREHOUSE_SAFETY' || deviceCode.indexOf('WH-') === 0 ? 'WAREHOUSE_INBOUND' : stage
  }

  private formatTime(value: string | undefined): string {
    return value === undefined || value.length === 0 ? '--' : value.replace('T', ' ').slice(0, 19)
  }

  private stageStateValue(): string {
    if (this.stationAlarms.length > 0) return 'ALARM'
    if (this.snapshot.state.length > 0) return this.snapshot.state
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
    let speed: number = 0
    this.snapshot.devices.forEach((item: RuntimeDevice) => {
      if (item.speed !== undefined) {
        speed = item.speed
      } else if (item.speedMps !== undefined) {
        speed = item.speedMps
      }
    })
    const task = this.bundle.logistics.tasks.find((item: AgvTask) => this.stageCode === 'AGV_TRANSPORT')
    if (task !== undefined) speed = task.speedMps
    return speed
  }

  private sceneProgress(): number {
    let progress: number = 0
    this.snapshot.products.forEach((item: FactoryRun) => {
      if (item.stageProgressPct !== undefined) progress = item.stageProgressPct
    })
    this.snapshot.devices.forEach((item: RuntimeDevice) => {
      if (item.cycleProgressPct !== undefined) {
        progress = item.cycleProgressPct
      } else if (item.progress !== undefined) {
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
    payload.source = this.snapshot.dataMode + ' · ' + FactoryRepository.snapshotMode
    payload.viewMode = viewMode
    payload.paused = this.paused
    payload.statusColors = this.statusColorsEnabled
    payload.layoutEdit = this.layoutEditEnabled
    payload.speed = this.sceneSpeed()
    payload.progress = this.sceneProgress()
    payload.stateVersion = this.snapshot.stateVersion
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
    if (this.snapshot.qualityGates.length > 0) return this.snapshot.qualityGates
    return [{
      label: '后端质量门',
      standard: '由统一 StageSnapshot 返回规则与阈值',
      actual: '当前接口未提供质量门结果',
      status: 'WAIT',
      source: FactoryRepository.snapshotMode
    }]
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

  private capabilityFor(deviceCode: string, commandType: string): DeviceCapability | undefined {
    return FactoryRepository.capabilities.find((item: DeviceCapability) =>
      item.deviceCode === deviceCode && item.commandType === commandType)
  }

  private parameterMin(control: ParameterControlDefinition): number {
    const capability = this.capabilityFor(control.deviceCode, control.commandType)
    return capability !== undefined && capability.min !== undefined ? capability.min : control.min
  }

  private parameterMax(control: ParameterControlDefinition): number {
    const capability = this.capabilityFor(control.deviceCode, control.commandType)
    return capability !== undefined && capability.max !== undefined ? capability.max : control.max
  }

  private parameterStep(control: ParameterControlDefinition): number {
    const capability = this.capabilityFor(control.deviceCode, control.commandType)
    return capability !== undefined && capability.step !== undefined ? capability.step : control.step
  }

  private parameterCurrent(control: ParameterControlDefinition): number {
    const capability = this.capabilityFor(control.deviceCode, control.commandType)
    return capability !== undefined && capability.currentValue !== undefined ? capability.currentValue : control.currentValue
  }

  private requiredRole(deviceCode: string, commandType: string, fallbackRole: string): string {
    const capability = this.capabilityFor(deviceCode, commandType)
    return capability === undefined || capability.requiredRole.length === 0 ? fallbackRole : capability.requiredRole
  }

  private setTarget(control: ParameterControlDefinition, delta: number): void {
    const min: number = this.parameterMin(control)
    const max: number = this.parameterMax(control)
    const next: Array<ParameterEdit> = []
    this.edits.forEach((item: ParameterEdit) => {
      const edit = new ParameterEdit()
      edit.parameterCode = item.parameterCode
      edit.value = item.parameterCode === control.parameterCode ? Math.max(min, Math.min(max, Number((item.value + delta).toFixed(2)))) : item.value
      next.push(edit)
    })
    this.edits = next
  }

  private canEditParameter(control: ParameterControlDefinition): boolean {
    return this.commandBlockReason(true, control.requiredRole, control.deviceCode, control.commandType).length === 0
  }

  private commandBlockReason(controlDangerous: boolean, fallbackRole: string = 'OPERATOR', deviceCode: string = '', commandType: string = ''): string {
    if (!this.bundle.online || this.bundle.source !== 'BACKEND') return '后端不可达或本地演示模式，只读'
    if (!FactoryRepository.snapshotOnline || FactoryRepository.snapshotMode !== 'CANONICAL') return '统一 StageSnapshot 接口不可用，旧接口适配仅允许只读'
    if (FactoryRepository.capabilityMode !== 'BACKEND') return '设备能力接口不可用，无法校验范围、角色和联锁'
    if (this.commandBusy) return '已有命令等待回执'
    if (!SessionStore.isAuthenticated) return '未登录操作员，终端保持只读'
    const role: string = this.requiredRole(deviceCode, commandType, fallbackRole)
    if (!SessionStore.can(role)) return '当前角色权限不足，需要 ' + role
    if (deviceCode.length > 0 && commandType.length > 0) {
      const capability = this.capabilityFor(deviceCode, commandType)
      if (capability === undefined) return '后端未授权该设备命令'
      if (!capability.writable) return capability.disabledReason || '后端能力标记为只读'
    }
    if (this.stageStateValue() === 'OFFLINE') return '本站离线'
    if (controlDangerous && this.stationAlarms.length > 0) return '存在开放报警，危险操作禁用'
    if (controlDangerous && this.qualitySummary() === '禁止自动放行') return '质量门失败，危险操作禁用'
    return ''
  }

  private async validateSession(): Promise<void> {
    try {
      const user = await apiClient.me()
      SessionStore.setSession(SessionStore.token, user, SessionStore.expiresAt)
      this.loginMessage = user.displayName + ' · ' + user.role
    } catch (error) {
      SessionStore.clear()
      this.loginMessage = error instanceof Error ? error.message : '会话校验失败，已恢复只读'
    }
  }

  private async loginOperator(): Promise<void> {
    if (this.username.trim().length === 0 || this.password.length === 0) {
      this.loginMessage = '请输入工位账号和密码'
      return
    }
    this.loginBusy = true
    try {
      const result = await apiClient.login(this.username.trim(), this.password)
      SessionStore.setSession(result.token, result.user, result.expiresAt || '')
      this.password = ''
      this.loginMessage = result.user.displayName + ' · ' + result.user.role + ' 已登录'
    } catch (error) {
      SessionStore.clear()
      this.loginMessage = error instanceof Error ? error.message : '登录失败'
    } finally {
      this.loginBusy = false
    }
  }

  private logoutOperator(): void {
    SessionStore.clear()
    this.password = ''
    this.loginMessage = '已退出，终端恢复只读'
  }

  private operatorLabel(): string {
    if (!SessionStore.isAuthenticated || SessionStore.user === undefined) return '未登录 · READ ONLY'
    return SessionStore.user.displayName + ' · ' + SessionStore.user.role
  }

  private prepareParameter(control: ParameterControlDefinition): void {
    const target: number = this.targetValue(control.parameterCode)
    if (target < this.parameterMin(control) || target > this.parameterMax(control)) {
      this.commandStatus = 'BLOCKED'
      this.commandMessage = '目标值超出后端能力范围，请重新调整'
      return
    }
    const draft = new PendingCommandDraft()
    draft.deviceCode = control.deviceCode
    draft.commandType = control.commandType
    draft.parameterCode = control.parameterCode
    draft.value = target
    draft.unit = control.unit
    draft.label = control.label
    draft.intent = '调整 ' + control.label + ' 到 ' + draft.value.toString() + ' ' + control.unit
    draft.risk = control.risk
    draft.interlock = control.interlock
    draft.dangerous = true
    draft.requiredRole = this.requiredRole(control.deviceCode, control.commandType, control.requiredRole)
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
    draft.requiredRole = this.requiredRole(control.deviceCode, control.commandType, control.requiredRole)
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
    const reason = this.commandBlockReason(this.pendingDraft.dangerous, this.pendingDraft.requiredRole,
      this.pendingDraft.deviceCode, this.pendingDraft.commandType)
    if (reason.length > 0 || this.pendingDraft.commandType.length === 0) {
      this.commandStatus = 'BLOCKED'
      this.commandMessage = reason.length > 0 ? reason : '没有待确认命令'
      return
    }
    this.commandBusy = true
    this.commandStatus = 'PENDING'
    this.commandMessage = 'HTTP 已发送，等待后端受理'
    const parameters = new DeviceCommandParameters()
    parameters.parameterCode = this.pendingDraft.parameterCode
    parameters.value = this.pendingDraft.value
    parameters.unit = this.pendingDraft.unit
    const request = new DeviceCommandRequestPayload()
    request.clientRequestId = 'TERM-' + Date.now().toString() + '-' + this.pendingDraft.deviceCode
    request.lineId = this.snapshot.lineId
    request.stageCode = this.stageCode
    request.deviceCode = this.pendingDraft.deviceCode
    request.commandType = this.pendingDraft.commandType
    request.parameters = parameters
    request.payload = parameters
    request.expectedStateVersion = this.snapshot.stateVersion
    request.recipeVersion = this.snapshot.recipeVersion || ''
    request.reason = this.pendingDraft.intent
    request.source = 'WORKSTATION_TERMINAL'
    request.traceCode = this.selectedTraceCode
    try {
      const command = await FactoryRepository.createCommand(request)
      this.activeCommandId = command.commandId
      this.auditNo = command.auditNo || command.commandId
      this.commandStatus = 'PENDING'
      this.commandMessage = '后端已受理，等待 WebSocket/HTTP 最终回执'
      this.pendingDraft = new PendingCommandDraft()
      this.commandPollCount = 0
      this.scheduleCommandPoll()
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
    if (isFinalCommandStatus(command.status)) {
      this.commandBusy = false
      if (this.commandTimer >= 0) clearTimeout(this.commandTimer)
      this.commandTimer = -1
    }
  }

  private scheduleCommandPoll(): void {
    if (this.commandTimer >= 0) clearTimeout(this.commandTimer)
    this.commandTimer = setTimeout(() => void this.pollCommandStatus(), 1500)
  }

  private async pollCommandStatus(): Promise<void> {
    if (this.activeCommandId.length === 0 || !this.commandBusy) return
    this.commandPollCount++
    try {
      const commands: Array<DeviceCommand> = await FactoryRepository.listCommands()
      const command = commands.find((item: DeviceCommand) => item.commandId === this.activeCommandId)
      if (command !== undefined) {
        this.commandStatus = command.status
        this.commandMessage = command.message || this.commandMessage
        this.auditNo = command.auditNo || command.commandId
        if (isFinalCommandStatus(command.status)) {
          this.commandBusy = false
          this.commandTimer = -1
          return
        }
      }
    } catch (error) {
      this.commandMessage = '状态查询失败，仍保持 PENDING，等待实时通道或下次补拉'
    }
    if (this.commandPollCount >= 8) {
      this.commandMessage = '后端仍未返回最终状态，命令保持 PENDING，禁止重复下发'
    }
    this.scheduleCommandPoll()
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
          Text('快照版本 ' + this.snapshot.stateVersion.toString() + ' · ' + FactoryRepository.snapshotMode +
            (FactoryRepository.snapshotError.length > 0 ? ' · ' + FactoryRepository.snapshotError : ''))
            .fontSize(8)
            .fontColor(FactoryRepository.snapshotMode === 'CANONICAL' ? Theme.success : Theme.warning)
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
      this.identityPanel()
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
  identityPanel() {
    Column() {
      Row() {
        Column() {
          Text('操作员身份').fontSize(10).fontColor(Theme.muted)
          Text(this.operatorLabel()).fontSize(13).fontColor(SessionStore.isAuthenticated ? Theme.success : Theme.warning).fontWeight(FontWeight.Bold).margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        if (SessionStore.isAuthenticated) {
          Button('退出').height(32).fontSize(10).backgroundColor('#E7F0F5').fontColor(Theme.navy).onClick(() => this.logoutOperator())
        }
      }
      .width('100%')
      if (!SessionStore.isAuthenticated) {
        TextInput({ placeholder: '工位账号', text: this.username })
          .height(38)
          .margin({ top: 10 })
          .onChange((value: string) => this.username = value)
        TextInput({ placeholder: '密码', text: this.password })
          .type(InputType.Password)
          .height(38)
          .margin({ top: 8 })
          .onChange((value: string) => this.password = value)
        Button(this.loginBusy ? '登录中...' : '登录解锁获批操作')
          .width('100%')
          .height(36)
          .margin({ top: 8 })
          .enabled(!this.loginBusy)
          .backgroundColor(Theme.navy)
          .fontColor('#FFFFFF')
          .onClick(() => void this.loginOperator())
      }
      Text(this.loginMessage).fontSize(9).fontColor(Theme.muted).margin({ top: 8 })
      Text('权限边界：VIEWER 只读；OPERATOR 运行操作；ENGINEER 受限维护；ADMIN 仅继承现场授权，不绕过后端安全门。')
        .fontSize(8).fontColor(Theme.muted).margin({ top: 5 })
    }
    .width('100%')
    .padding(12)
    .margin({ top: 10, bottom: 4 })
    .backgroundColor(Theme.panelSoft)
    .border({ width: 1, color: Theme.line })
  }

  @Builder
  parameterControl(control: ParameterControlDefinition) {
    Column() {
      Row() {
        Column() {
          Text(control.label + ' · ' + control.deviceCode).fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
          Text(control.role).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
          Text('范围 ' + this.parameterMin(control).toString() + '-' + this.parameterMax(control).toString() + ' ' + control.unit + ' · 步长 ' + this.parameterStep(control).toString() + ' · ' + control.source).fontSize(8).fontColor(Theme.muted).margin({ top: 4 })
          Text('最低角色 ' + this.requiredRole(control.deviceCode, control.commandType, control.requiredRole)).fontSize(8).fontColor(Theme.blue).margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Column() {
          Text('当前 ' + this.parameterCurrent(control).toString() + ' ' + control.unit).fontSize(9).fontColor(Theme.muted)
          Text('目标 ' + this.targetValue(control.parameterCode).toString() + ' ' + control.unit).fontSize(16).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.End)
      }
      .width('100%')
      Row({ space: 8 }) {
        Button('-').width(42).height(34).enabled(this.canEditParameter(control)).onClick(() => this.setTarget(control, -this.parameterStep(control)))
        Button('+').width(42).height(34).enabled(this.canEditParameter(control)).onClick(() => this.setTarget(control, this.parameterStep(control)))
        Button('发送调整')
          .layoutWeight(1)
          .height(34)
          .fontSize(11)
          .fontColor('#FFFFFF')
          .backgroundColor(this.commandBlockReason(true, control.requiredRole, control.deviceCode, control.commandType).length === 0 ? Theme.blue : Theme.neutral)
          .enabled(this.commandBlockReason(true, control.requiredRole, control.deviceCode, control.commandType).length === 0)
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
        Text('最低角色：' + this.requiredRole(control.deviceCode, control.commandType, control.requiredRole)).fontSize(8).fontColor(Theme.blue).margin({ top: 4 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Button(control.dangerous ? '确认动作' : '发起动作')
        .height(34)
        .fontSize(10)
        .fontColor('#FFFFFF')
        .backgroundColor(this.commandBlockReason(control.dangerous, control.requiredRole, control.deviceCode, control.commandType).length === 0 ? (control.dangerous ? Theme.warning : Theme.blue) : Theme.neutral)
        .enabled(this.commandBlockReason(control.dangerous, control.requiredRole, control.deviceCode, control.commandType).length === 0)
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
          Button('确认发送到后端').layoutWeight(1).height(36).backgroundColor(Theme.warning).fontColor('#FFFFFF')
            .enabled(this.commandBlockReason(this.pendingDraft.dangerous, this.pendingDraft.requiredRole, this.pendingDraft.deviceCode, this.pendingDraft.commandType).length === 0)
            .onClick(() => void this.confirmCommand())
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
      ForEach(this.stationRuns.filter((item: FactoryRun) => item.traceCode === this.selectedTraceCode), (run: FactoryRun) => {
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
