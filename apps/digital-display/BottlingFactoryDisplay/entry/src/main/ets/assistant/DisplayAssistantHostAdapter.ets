import { router } from '@kit.ArkUI'
import {
  AssistantContext,
  AssistantDisplayField,
  AssistantEntityRef,
  AssistantHostAdapter,
  AssistantNavigationResult,
  AssistantSelection,
  AssistantSelectionPublisher,
  AssistantSelectionSource,
  AssistantServiceEndpoint,
  AssistantSourceApp,
  AssistantSubscription,
  AssistantVisibility,
  AssistantVisibilityPublisher,
  createSelection
} from '@bottling/harmony-assistant'
import { ApiConfig } from '../service/ApiConfig'
import { FactoryBundle } from '../model/FactoryModels'
import { SessionStore } from '../service/SessionStore'

interface DisplayAssistantPageState {
  pageRoute: string
  lineId: string
  stageCode: string
  deviceCode: string
  traceCode: string
  stateVersion: number
  dataGeneratedAt: string
}

const DEFAULT_LINE_ID: string = 'LINE-01'

export class DisplayAssistantHostAdapter implements AssistantHostAdapter {
  readonly sourceApp: AssistantSourceApp = 'DISPLAY'

  private selectionPublisher: AssistantSelectionPublisher = new AssistantSelectionPublisher()
  private visibilityPublisher: AssistantVisibilityPublisher = new AssistantVisibilityPublisher()
  private pageState: DisplayAssistantPageState = {
    pageRoute: 'pages/FactoryOverview',
    lineId: DEFAULT_LINE_ID,
    stageCode: '',
    deviceCode: '',
    traceCode: '',
    stateVersion: 0,
    dataGeneratedAt: ''
  }

  updatePage(pageRoute: string, bundle: FactoryBundle, stageCode: string = ''): void {
    this.pageState.pageRoute = pageRoute
    this.pageState.stageCode = stageCode
    this.pageState.stateVersion = this.safeVersion(bundle.stateVersion)
    this.pageState.dataGeneratedAt = this.dataGeneratedAt(bundle)
  }

  updateFocusedEntity(deviceCode: string = '', traceCode: string = ''): void {
    this.pageState.deviceCode = deviceCode
    this.pageState.traceCode = traceCode
  }

  publishSelection(
    entityType: string,
    entityId: string,
    displayText: string,
    source: AssistantSelectionSource,
    fields: Array<AssistantDisplayField> = []
  ): void {
    if (entityId.length === 0) return
    const selection: AssistantSelection = createSelection(
      entityType,
      entityId,
      displayText,
      source,
      this.pageState.pageRoute,
      this.pageState.stateVersion,
      fields
    )
    this.selectionPublisher.publish(selection)
  }

  clearSelection(source: AssistantSelectionSource = 'ARKUI'): void {
    this.updateFocusedEntity()
    this.selectionPublisher.clear(this.pageState.pageRoute, source)
  }

  publishVisibility(visibility: AssistantVisibility): void {
    this.visibilityPublisher.publish(visibility)
  }

  async getContext(): Promise<AssistantContext> {
    return {
      contextVersion: 1,
      sourceApp: this.sourceApp,
      pageRoute: this.pageState.pageRoute,
      capturedAt: new Date().toISOString(),
      lineId: this.pageState.lineId,
      stageCode: this.pageState.stageCode.length > 0 ? this.pageState.stageCode : undefined,
      deviceCode: this.pageState.deviceCode.length > 0 ? this.pageState.deviceCode : undefined,
      traceCode: this.pageState.traceCode.length > 0 ? this.pageState.traceCode : undefined,
      stateVersion: this.pageState.stateVersion,
      dataGeneratedAt: this.pageState.dataGeneratedAt.length > 0 ? this.pageState.dataGeneratedAt : undefined,
      userRoleHint: 'DISPLAY_READONLY'
    }
  }

  async getAccessToken(): Promise<string | undefined> {
    return SessionStore.token.length > 0 ? SessionStore.token : undefined
  }

  getServiceEndpoint(): AssistantServiceEndpoint {
    return {
      httpBaseUrl: ApiConfig.AI_BASE,
      wsBaseUrl: ApiConfig.AI_WS_BASE
    }
  }

  subscribeSelection(listener: (selection: AssistantSelection) => void): AssistantSubscription {
    return this.selectionPublisher.subscribe(listener)
  }

  subscribeVisibility(listener: (visibility: AssistantVisibility) => void): AssistantSubscription {
    return this.visibilityPublisher.subscribe(listener)
  }

  async navigateToEntity(entity: AssistantEntityRef): Promise<AssistantNavigationResult> {
    if (entity.entityType === 'STAGE') {
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: entity.entityId } })
      return { handled: true }
    }
    if ((entity.entityType === 'DEVICE' || entity.entityType === 'PRODUCT') &&
      entity.stageCode !== undefined && entity.stageCode.length > 0) {
      router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: entity.stageCode } })
      return { handled: true }
    }
    if (entity.entityType === 'LINE') {
      router.pushUrl({ url: 'pages/FactoryOverview' })
      return { handled: true }
    }
    return {
      handled: false,
      reason: '数字展板只支持只读定位到产线或工位，不能执行控制操作。'
    }
  }

  private safeVersion(value: number): number {
    return value !== value || value < 0 ? 0 : Math.floor(value)
  }

  private dataGeneratedAt(bundle: FactoryBundle): string {
    if (bundle.runtime.generatedAt !== undefined && bundle.runtime.generatedAt.length > 0) {
      return bundle.runtime.generatedAt
    }
    return bundle.updatedAt
  }
}

export const displayAssistantHost: DisplayAssistantHostAdapter = new DisplayAssistantHostAdapter()
