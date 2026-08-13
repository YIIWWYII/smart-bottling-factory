import {
  AssistantContext,
  AssistantDisplayField,
  AssistantEntityRef,
  AssistantHostAdapter,
  AssistantNavigationResult,
  AssistantSelection,
  AssistantSelectionListener,
  AssistantServiceEndpoint,
  AssistantSourceApp,
  AssistantSubscription,
  AssistantVisibility,
  AssistantVisibilityListener,
  AssistantVisibilityPublisher
} from '@bottling/harmony-assistant'
import { SessionStore } from './SessionStore'
import { AiCenterConfig } from './AiCenterConfig'
import { adminAssistantSelectionPublisher } from './AdminAssistantSelection'

export type AdminAssistantNavigator = (entity: AssistantEntityRef) => AssistantNavigationResult

interface AssistantHostContextState {
  pageRoute: string
  lineId: string
  stageCode: string
  deviceCode: string
  traceCode: string
  stateVersion: number
  dataGeneratedAt: string
}

function valueFromSelection(selection: AssistantSelection | undefined, fieldCode: string): string {
  if (selection === undefined) return ''
  let value: string = ''
  selection.fields.forEach((field: AssistantDisplayField) => {
    if (field.code === fieldCode) value = field.displayValue
  })
  return value
}

export class AdminAssistantHostAdapter implements AssistantHostAdapter {
  readonly sourceApp: AssistantSourceApp = 'ADMIN'
  private visibilityPublisher: AssistantVisibilityPublisher = new AssistantVisibilityPublisher()
  private contextState: AssistantHostContextState = {
    pageRoute: 'AdminConsole/DASHBOARD',
    lineId: 'LINE-01',
    stageCode: '',
    deviceCode: '',
    traceCode: '',
    stateVersion: 0,
    dataGeneratedAt: ''
  }
  private navigator: AdminAssistantNavigator | undefined = undefined

  setHostContext(pageRoute: string, stateVersion: number, dataGeneratedAt: string): void {
    this.contextState.pageRoute = pageRoute
    this.contextState.stateVersion = stateVersion
    this.contextState.dataGeneratedAt = dataGeneratedAt
    const current: AssistantSelection | undefined = adminAssistantSelectionPublisher.current
    this.applySelectionContext(current)
  }

  setNavigator(navigator: AdminAssistantNavigator): void {
    this.navigator = navigator
  }

  setVisibility(visibility: AssistantVisibility): void {
    this.visibilityPublisher.publish(visibility)
  }

  async getContext(): Promise<AssistantContext> {
    const current: AssistantSelection | undefined = adminAssistantSelectionPublisher.current
    this.applySelectionContext(current)
    return {
      contextVersion: 1,
      sourceApp: this.sourceApp,
      pageRoute: this.contextState.pageRoute,
      capturedAt: new Date().toISOString(),
      lineId: this.contextState.lineId,
      stageCode: this.contextState.stageCode.length === 0 ? undefined : this.contextState.stageCode,
      deviceCode: this.contextState.deviceCode.length === 0 ? undefined : this.contextState.deviceCode,
      traceCode: this.contextState.traceCode.length === 0 ? undefined : this.contextState.traceCode,
      stateVersion: this.contextState.stateVersion,
      dataGeneratedAt: this.contextState.dataGeneratedAt.length === 0 ? undefined : this.contextState.dataGeneratedAt,
      userRoleHint: SessionStore.user === undefined ? 'ANONYMOUS' : SessionStore.user.role,
      selection: current
    }
  }

  async getAccessToken(): Promise<string | undefined> {
    if (!SessionStore.isAuthenticated || SessionStore.isDemo) return undefined
    const token: string = SessionStore.token.trim()
    return token.toLowerCase().startsWith('bearer ') ? token : 'Bearer ' + token
  }

  getServiceEndpoint(): AssistantServiceEndpoint {
    if (SessionStore.isDemo) return { httpBaseUrl: '', wsBaseUrl: '' }
    return {
      httpBaseUrl: AiCenterConfig.API_BASE,
      wsBaseUrl: AiCenterConfig.WS_BASE
    }
  }

  subscribeSelection(listener: AssistantSelectionListener): AssistantSubscription {
    return adminAssistantSelectionPublisher.subscribe(listener)
  }

  subscribeVisibility(listener: AssistantVisibilityListener): AssistantSubscription {
    return this.visibilityPublisher.subscribe(listener)
  }

  async navigateToEntity(entity: AssistantEntityRef): Promise<AssistantNavigationResult> {
    if (this.navigator === undefined) {
      return { handled: false, reason: '后台宿主尚未注册只读导航器' }
    }
    return this.navigator(entity)
  }

  private applySelectionContext(selection: AssistantSelection | undefined): void {
    if (selection === undefined || selection.action === 'CLEAR') {
      this.contextState.stageCode = ''
      this.contextState.deviceCode = ''
      this.contextState.traceCode = ''
      return
    }
    this.contextState.pageRoute = selection.pageRoute
    this.contextState.stateVersion = selection.stateVersion === undefined ? this.contextState.stateVersion : selection.stateVersion
    this.contextState.stageCode = valueFromSelection(selection, 'stageCode')
    this.contextState.deviceCode = valueFromSelection(selection, 'deviceCode')
    this.contextState.traceCode = valueFromSelection(selection, 'traceCode')
  }
}
