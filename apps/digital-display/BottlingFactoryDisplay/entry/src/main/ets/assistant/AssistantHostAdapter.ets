import { ApiConfig } from '../service/ApiConfig'
import { FactoryBundle } from '../model/FactoryModels'

export class AssistantContext {
  sourceApp: string = 'DISPLAY'
  pageRoute: string = ''
  lineId: string = 'LINE-1'
  stageCode: string = ''
  deviceCode: string = ''
  traceCode: string = ''
  stateVersion: string = ''
  selectedEntityType: string = ''
  selectedEntityId: string = ''
  selectedText: string = ''
  userRole: string = 'DISPLAY_VIEWER'
  capturedAt: string = ''
}

export class AssistantSelection {
  entityType: string = ''
  entityId: string = ''
  label: string = ''
  selectedText: string = ''
  origin: string = ''
  stateVersion: string = ''
}

export class AssistantHostStatus {
  sourceApp: string = 'DISPLAY'
  readonlyClient: boolean = true
  aiBase: string = ''
  sharedPackageAvailable: boolean = false
  unavailableReason: string = ''
}

class AssistantHostAdapterImpl {
  private context: AssistantContext = new AssistantContext()
  private selection: AssistantSelection = new AssistantSelection()
  private listeners: Array<() => void> = []

  subscribe(listener: () => void): void {
    this.listeners.push(listener)
  }

  unsubscribe(listener: () => void): void {
    this.listeners = this.listeners.filter(item => item !== listener)
  }

  private notify(): void {
    this.listeners.forEach(listener => listener())
  }

  buildContext(pageRoute: string, bundle: FactoryBundle, stageCode: string = '', deviceCode: string = '', traceCode: string = ''): AssistantContext {
    const value = new AssistantContext()
    value.pageRoute = pageRoute
    value.lineId = 'LINE-1'
    value.stageCode = stageCode
    value.deviceCode = deviceCode
    value.traceCode = traceCode
    value.stateVersion = this.stateVersionOf(bundle)
    value.selectedEntityType = this.selection.entityType
    value.selectedEntityId = this.selection.entityId
    value.selectedText = this.selection.selectedText
    value.capturedAt = bundle.updatedAt || new Date().toISOString()
    return value
  }

  updateContext(next: AssistantContext): void {
    this.context = next
    this.notify()
  }

  select(next: AssistantSelection): void {
    this.selection = next
    this.context.selectedEntityType = next.entityType
    this.context.selectedEntityId = next.entityId
    this.context.selectedText = next.selectedText
    this.context.stateVersion = next.stateVersion
    this.notify()
  }

  createSelection(entityType: string, entityId: string, label: string, origin: string, stateVersion: string, selectedText: string = ''): AssistantSelection {
    const value = new AssistantSelection()
    value.entityType = entityType
    value.entityId = entityId
    value.label = label
    value.origin = origin
    value.stateVersion = stateVersion
    value.selectedText = selectedText
    return value
  }

  currentContext(): AssistantContext {
    return this.context
  }

  currentSelection(): AssistantSelection {
    return this.selection
  }

  status(): AssistantHostStatus {
    const value = new AssistantHostStatus()
    value.aiBase = ApiConfig.AI_BASE
    value.unavailableReason = 'packages/harmony-assistant 尚未进入当前工作区，展板只暴露宿主上下文与统一选择事件，不创建临时聊天 UI。'
    return value
  }

  entityRoute(selection: AssistantSelection): string {
    if (selection.entityType === 'STAGE') return 'pages/StageDetail'
    if (selection.entityType === 'DEVICE') return 'pages/StageDetail'
    if (selection.entityType === 'PRODUCT') return 'pages/StageDetail'
    return ''
  }

  stateVersionOf(bundle: FactoryBundle): string {
    return bundle.stateVersion || bundle.runtime.stateVersion || bundle.runtime.generatedAt || bundle.updatedAt || 'UNKNOWN'
  }
}

export const AssistantHostAdapter = new AssistantHostAdapterImpl()
