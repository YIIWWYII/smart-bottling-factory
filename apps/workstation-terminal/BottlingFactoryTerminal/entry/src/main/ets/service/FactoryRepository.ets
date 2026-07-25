import { http } from '@kit.NetworkKit'
import { ApiClient, apiClient } from './ApiClient'
import { FactoryRealtime } from './FactoryRealtime'
import { createMockBundle } from './MockFactoryData'
import { DeviceCommand, DeviceCommandRequestPayload, FactoryBundle, FactoryDashboard, FactoryIncident, LogisticsOverview, OperationsOverview, RuntimeSnapshot } from '../model/FactoryModels'

interface IncidentResolveRequest {
  action: string
  targetStage: string
  note: string
}

class FactoryRepositoryImpl {
  bundle: FactoryBundle = createMockBundle()
  realtimeOnline: boolean = false
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

  async refresh(): Promise<void> {
    try {
      const dashboard: FactoryDashboard = await this.client.request<FactoryDashboard>('/factory/dashboard')
      const operations: OperationsOverview = await this.client.request<OperationsOverview>('/operations/overview')
      const logistics: LogisticsOverview = await this.client.request<LogisticsOverview>('/logistics/overview')
      const runtime: RuntimeSnapshot = await this.client.request<RuntimeSnapshot>('/factory/runtime')
      this.bundle = { dashboard, operations, logistics, runtime, source: 'BACKEND', online: true, updatedAt: runtime.generatedAt || new Date().toISOString(), errorMessage: '' }
    } catch (error) {
      this.bundle = { dashboard: this.bundle.dashboard, operations: this.bundle.operations, logistics: this.bundle.logistics, runtime: this.bundle.runtime, source: 'LOCAL DEMO', online: false, updatedAt: this.bundle.updatedAt, errorMessage: error instanceof Error ? error.message : '后端请求失败' }
    }
    this.notify()
  }

  connectRealtime(): void {
    this.realtime.connect((payload: string) => {
      if (payload.indexOf('factory.') >= 0) void this.refresh()
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
    await this.refresh()
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
