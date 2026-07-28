import { router } from '@kit.ArkUI'
import {
  AssistantContext,
  AssistantEntityRef,
  AssistantEntityType,
  AssistantHostAdapter,
  AssistantNavigationResult,
  AssistantSelectionListener,
  AssistantSelectionPublisher,
  AssistantServiceEndpoint,
  AssistantSourceApp,
  AssistantSubscription,
  AssistantVisibilityListener,
  AssistantVisibilityPublisher
} from '@bottling/harmony-assistant'
import { controlsForStage, ParameterControlDefinition } from '../config/WorkstationControls'
import { AlarmRecord, FactoryIncident, SensorReading } from '../model/FactoryModels'
import { ApiConfig } from './ApiConfig'
import { FactoryRepository } from './FactoryRepository'
import { SessionStore } from './SessionStore'

export class WorkstationAssistantHostAdapter implements AssistantHostAdapter {
  readonly sourceApp: AssistantSourceApp = 'WORKSTATION'
  private selectionPublisher: AssistantSelectionPublisher
  private visibilityPublisher: AssistantVisibilityPublisher
  private getStageCode: () => string
  private getDeviceCode: () => string
  private getTraceCode: () => string
  private selectDevice: (deviceCode: string) => void
  private selectProduct: (traceCode: string) => void
  private clearHostSelection: () => void

  constructor(
    selectionPublisher: AssistantSelectionPublisher,
    visibilityPublisher: AssistantVisibilityPublisher,
    getStageCode: () => string,
    getDeviceCode: () => string,
    getTraceCode: () => string,
    selectDevice: (deviceCode: string) => void,
    selectProduct: (traceCode: string) => void,
    clearHostSelection: () => void
  ) {
    this.selectionPublisher = selectionPublisher
    this.visibilityPublisher = visibilityPublisher
    this.getStageCode = getStageCode
    this.getDeviceCode = getDeviceCode
    this.getTraceCode = getTraceCode
    this.selectDevice = selectDevice
    this.selectProduct = selectProduct
    this.clearHostSelection = clearHostSelection
  }

  async getContext(): Promise<AssistantContext> {
    const deviceCode: string = this.getDeviceCode()
    const traceCode: string = this.getTraceCode()
    const context: AssistantContext = {
      contextVersion: 1,
      sourceApp: this.sourceApp,
      pageRoute: this.pageRoute(this.getStageCode()),
      capturedAt: new Date().toISOString(),
      lineId: FactoryRepository.stageSnapshot.lineId || 'LINE-01',
      stageCode: this.getStageCode(),
      stateVersion: FactoryRepository.stageSnapshot.stateVersion,
      dataGeneratedAt: FactoryRepository.stageSnapshot.generatedAt,
      userRoleHint: this.currentUserRole()
    }
    if (deviceCode.length > 0) {
      context.deviceCode = deviceCode
    }
    if (traceCode.length > 0) {
      context.traceCode = traceCode
    }
    return context
  }

  async getAccessToken(): Promise<string | undefined> {
    return SessionStore.isAuthenticated ? SessionStore.token : undefined
  }

  getServiceEndpoint(): AssistantServiceEndpoint {
    return {
      httpBaseUrl: ApiConfig.AI_BASE,
      wsBaseUrl: ApiConfig.AI_WS_BASE
    }
  }

  subscribeSelection(listener: AssistantSelectionListener): AssistantSubscription {
    return this.selectionPublisher.subscribe(listener)
  }

  subscribeVisibility(listener: AssistantVisibilityListener): AssistantSubscription {
    return this.visibilityPublisher.subscribe(listener)
  }

  async navigateToEntity(entity: AssistantEntityRef): Promise<AssistantNavigationResult> {
    if (entity.entityType === AssistantEntityType.STAGE) {
      this.clearSelection()
      router.replaceUrl({ url: 'pages/StageDetail', params: { stageCode: entity.entityId } })
      return { handled: true }
    }
    if (entity.entityType === AssistantEntityType.DEVICE) {
      this.selectDevice(entity.entityId)
      return { handled: true }
    }
    if (entity.entityType === AssistantEntityType.PRODUCT) {
      this.selectProduct(entity.entityId)
      return { handled: true }
    }
    if (entity.entityType === AssistantEntityType.SENSOR) {
      return { handled: this.navigateToSensor(entity.entityId), reason: '当前工位未找到该传感器' }
    }
    if (entity.entityType === AssistantEntityType.PARAMETER) {
      return { handled: this.navigateToParameter(entity.entityId), reason: '当前工位未找到该参数' }
    }
    if (entity.entityType === AssistantEntityType.ALARM || entity.entityType === AssistantEntityType.INCIDENT) {
      return { handled: this.navigateToAlarm(entity.entityId), reason: '当前工位未找到该报警或异常' }
    }
    return { handled: false, reason: '工位端只支持本站实体的只读定位' }
  }

  private clearSelection(): void {
    this.clearHostSelection()
    this.selectionPublisher.clear(this.pageRoute(this.getStageCode()), 'ARKUI')
  }

  private currentUserRole(): string {
    if (!SessionStore.isAuthenticated || SessionStore.user === undefined) {
      return 'VIEWER'
    }
    return SessionStore.user.role
  }

  private pageRoute(stageCode: string): string {
    return 'pages/StageDetail?stageCode=' + stageCode
  }

  private navigateToSensor(readingId: string): boolean {
    const reading = FactoryRepository.stageSnapshot.sensors.find((item: SensorReading) => item.readingId === readingId)
    if (reading !== undefined && reading.deviceCode.length > 0) {
      this.selectDevice(reading.deviceCode)
      return true
    }
    return false
  }

  private navigateToParameter(parameterId: string): boolean {
    const separator: number = parameterId.indexOf(':')
    if (separator > 0) {
      this.selectDevice(parameterId.substring(0, separator))
      return true
    }
    const control = controlsForStage(this.getStageCode()).parameters.find((item: ParameterControlDefinition) =>
      item.parameterCode === parameterId)
    if (control !== undefined) {
      this.selectDevice(control.deviceCode)
      return true
    }
    return false
  }

  private navigateToAlarm(alarmId: string): boolean {
    const alarm = FactoryRepository.stageSnapshot.alarms.find((item: AlarmRecord) => item.alarmId === alarmId)
    if (alarm !== undefined && alarm.deviceCode.length > 0) {
      this.selectDevice(alarm.deviceCode)
      return true
    }
    const incident = FactoryRepository.stageSnapshot.incidents.find((item: FactoryIncident) => item.incidentId === alarmId)
    if (incident !== undefined && incident.deviceCode !== undefined && incident.deviceCode.length > 0) {
      this.selectDevice(incident.deviceCode)
      return true
    }
    return false
  }
}
