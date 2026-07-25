import { http } from '@kit.NetworkKit'
import { ApiClient, apiClient } from './ApiClient'
import { FactoryRealtime } from './FactoryRealtime'
import { createMockBundle } from './MockFactoryData'
import { DeviceCapability, DeviceCommand, DeviceCommandRequestPayload, FactoryBundle, FactoryDashboard, FactoryIncident, LogisticsOverview, OperationsOverview, RuntimeSnapshot, StageSnapshot } from '../model/FactoryModels'
import { adaptLegacyStageSnapshot, normalizeStageSnapshot } from './StageSnapshotAdapter'
import { findStage } from '../config/FactoryStages'
import { shouldApplyStateVersion } from './WorkstationPolicy'

interface IncidentResolveRequest {
  action: string
  targetStage: string
  note: string
}

interface RealtimeEnvelope {
  type: string
  stageCode?: string
  stateVersion?: number
}

class FactoryRepositoryImpl {
  bundle: FactoryBundle = createMockBundle()
  stageSnapshot: StageSnapshot = adaptLegacyStageSnapshot(this.bundle, findStage('PRETREATMENT'))
  snapshotMode: string = 'LOCAL_DEMO'
  snapshotOnline: boolean = false
  snapshotError: string = ''
  capabilities: Array<DeviceCapability> = []
  capabilityMode: string = 'UNAVAILABLE'
  realtimeOnline: boolean = false
  private activeStageCode: string = 'PRETREATMENT'
  private realtime: FactoryRealtime = new FactoryRealtime()
  private listeners: Array<() => void> = []
  private client: ApiClient = apiClient

  subscribe(listener: () => void): void {
    this.listeners.push(listener)
  }

  unsubscribe(listener: () => void): void {
    this.listeners = this.listeners.filter(item => item !== listener)
  }

  private notify(): void {
    this.listeners.forEach(listener => listener())
  }

  async refresh(stageCode: string = this.activeStageCode): Promise<void> {
    this.activeStageCode = stageCode
    try {
      const dashboard: FactoryDashboard = await this.client.request<FactoryDashboard>('/factory/dashboard')
      const operations: OperationsOverview = await this.client.request<OperationsOverview>('/operations/overview')
      const logistics: LogisticsOverview = await this.client.request<LogisticsOverview>('/logistics/overview')
      const runtime: RuntimeSnapshot = await this.client.request<RuntimeSnapshot>('/factory/runtime')
      this.bundle = { dashboard, operations, logistics, runtime, source: 'BACKEND', online: true, updatedAt: runtime.generatedAt || new Date().toISOString(), errorMessage: '' }
    } catch (error) {
      this.bundle = { dashboard: this.bundle.dashboard, operations: this.bundle.operations, logistics: this.bundle.logistics, runtime: this.bundle.runtime, source: 'LOCAL DEMO', online: false, updatedAt: this.bundle.updatedAt, errorMessage: error instanceof Error ? error.message : '后端请求失败' }
    }
    await this.refreshStageSnapshot(stageCode)
    this.notify()
  }

  private async refreshStageSnapshot(stageCode: string): Promise<void> {
    const stage = findStage(stageCode)
    try {
      const raw: StageSnapshot = await this.client.request<StageSnapshot>(`/factory/stages/${stageCode}/snapshot`)
      const next: StageSnapshot = normalizeStageSnapshot(raw, stage)
      if (shouldApplyStateVersion(this.stageSnapshot.stageCode, this.stageSnapshot.stateVersion, stageCode, next.stateVersion)) {
        this.stageSnapshot = next
      }
      this.snapshotMode = 'CANONICAL'
      this.snapshotOnline = true
      this.snapshotError = ''
    } catch (error) {
      if (this.stageSnapshot.stageCode !== stageCode || this.snapshotMode !== 'CANONICAL') {
        this.stageSnapshot = adaptLegacyStageSnapshot(this.bundle, stage)
        this.snapshotMode = this.bundle.online ? 'LEGACY_ADAPTER' : 'LOCAL_DEMO'
      }
      this.snapshotOnline = false
      this.snapshotError = error instanceof Error ? error.message : 'StageSnapshot 接口不可用'
    }
    try {
      this.capabilities = await this.client.request<Array<DeviceCapability>>(`/factory/stages/${stageCode}/capabilities`)
      this.capabilityMode = 'BACKEND'
    } catch (error) {
      this.capabilities = []
      this.capabilityMode = 'UNAVAILABLE'
    }
  }

  connectRealtime(): void {
    this.realtime.connect((payload: string) => {
      try {
        const event: RealtimeEnvelope = JSON.parse(payload) as RealtimeEnvelope
        const relevant: boolean = event.type.indexOf('factory.') === 0 || event.type === 'operations.sensor.recorded' ||
          event.type === 'operations.alarm.changed' || event.type === 'operations.command.changed' ||
          event.type === 'product.changed' || event.type === 'quality.gate.changed' || event.type === 'config.recipe.changed'
        const sameStage: boolean = event.stageCode === undefined || event.stageCode === this.activeStageCode
        if (relevant && sameStage) void this.refresh(this.activeStageCode)
      } catch (error) {
        console.error('[BottlingFactory] ignored malformed realtime event')
      }
    }, (online: boolean) => {
      this.realtimeOnline = online
      this.notify()
    })
  }

  closeRealtime(): void {
    this.realtime.close()
  }

  async acknowledgeAlarm(alarmId: string): Promise<void> {
    await this.client.request<Object>(`/operations/alarms/${alarmId}/ack`, http.RequestMethod.POST)
    await this.refresh()
  }

  async resolveIncident(incidentId: string, strategy: string): Promise<void> {
    const payload: IncidentResolveRequest = { action: strategy, targetStage: '', note: 'HarmonyOS 管理端人工确认' }
    await this.client.request<Object>(`/factory/runtime/incidents/${incidentId}/resolve`, http.RequestMethod.POST, JSON.stringify(payload))
    await this.refresh()
  }

  async createCommand(request: DeviceCommandRequestPayload): Promise<DeviceCommand> {
    const command: DeviceCommand = await this.client.request<DeviceCommand>('/operations/commands', http.RequestMethod.POST, JSON.stringify(request))
    await this.refresh(this.activeStageCode)
    return command
  }

  async listCommands(status: string = ''): Promise<Array<DeviceCommand>> {
    const path = status.length > 0 ? `/operations/commands?status=${status}` : '/operations/commands'
    return await this.client.request<Array<DeviceCommand>>(path)
  }

  async listIncidents(status: string = 'OPEN'): Promise<Array<FactoryIncident>> {
    return await this.client.request<Array<FactoryIncident>>(`/factory/runtime/incidents?status=${status}`)
  }
}

export const FactoryRepository = new FactoryRepositoryImpl()
