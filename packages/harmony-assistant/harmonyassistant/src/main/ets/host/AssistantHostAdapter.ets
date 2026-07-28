import {
  AssistantContext,
  AssistantDisplayField,
  AssistantEntityRef,
  AssistantNavigationResult,
  AssistantSelection,
  AssistantSelectionSource,
  AssistantServiceEndpoint,
  AssistantSourceApp,
  AssistantSubscription,
  AssistantVisibility
} from '../model/AssistantModels'

export type AssistantSelectionListener = (selection: AssistantSelection) => void
export type AssistantVisibilityListener = (visibility: AssistantVisibility) => void

export interface AssistantHostAdapter {
  readonly sourceApp: AssistantSourceApp
  getContext(): Promise<AssistantContext>
  getAccessToken(): Promise<string | undefined>
  getServiceEndpoint(): AssistantServiceEndpoint
  subscribeSelection(listener: AssistantSelectionListener): AssistantSubscription
  subscribeVisibility(listener: AssistantVisibilityListener): AssistantSubscription
  navigateToEntity(entity: AssistantEntityRef): Promise<AssistantNavigationResult>
}

class AssistantCallbackSubscription implements AssistantSubscription {
  private releaseCallback: () => void
  private released: boolean = false

  constructor(releaseCallback: () => void) {
    this.releaseCallback = releaseCallback
  }

  unsubscribe(): void {
    if (!this.released) {
      this.released = true
      this.releaseCallback()
    }
  }
}

export class AssistantSelectionPublisher {
  private listeners: AssistantSelectionListener[] = []
  private currentSelection: AssistantSelection | undefined = undefined

  get current(): AssistantSelection | undefined {
    return this.currentSelection
  }

  subscribe(listener: AssistantSelectionListener): AssistantSubscription {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener)
    }
    if (this.currentSelection !== undefined) {
      listener(this.currentSelection)
    }
    return new AssistantCallbackSubscription(() => {
      this.listeners = this.listeners.filter((item: AssistantSelectionListener) => item !== listener)
    })
  }

  publish(selection: AssistantSelection): void {
    this.currentSelection = selection.action === 'CLEAR' ? undefined : selection
    this.notify(selection)
  }

  clear(pageRoute: string = '', source: AssistantSelectionSource = 'ARKUI'): void {
    const selection: AssistantSelection = createClearSelection(pageRoute, source)
    this.publish(selection)
  }

  private notify(selection: AssistantSelection): void {
    this.listeners.forEach((listener: AssistantSelectionListener) => {
      listener(selection)
    })
  }
}

export class AssistantVisibilityPublisher {
  private listeners: AssistantVisibilityListener[] = []
  private currentVisibility: AssistantVisibility = 'VISIBLE'

  get current(): AssistantVisibility {
    return this.currentVisibility
  }

  subscribe(listener: AssistantVisibilityListener): AssistantSubscription {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener)
    }
    listener(this.currentVisibility)
    return new AssistantCallbackSubscription(() => {
      this.listeners = this.listeners.filter((item: AssistantVisibilityListener) => item !== listener)
    })
  }

  publish(visibility: AssistantVisibility): void {
    this.currentVisibility = visibility
    this.listeners.forEach((listener: AssistantVisibilityListener) => {
      listener(visibility)
    })
  }
}

export function createSelection(
  entityType: string,
  entityId: string,
  displayText: string,
  source: AssistantSelectionSource,
  pageRoute: string,
  stateVersion?: number,
  fields: AssistantDisplayField[] = []
): AssistantSelection {
  return {
    action: 'SELECT',
    entityType: entityType,
    entityId: entityId,
    displayText: displayText,
    source: source,
    pageRoute: pageRoute,
    stateVersion: stateVersion,
    selectedAt: new Date().toISOString(),
    fields: fields
  }
}

export function createClearSelection(
  pageRoute: string = '',
  source: AssistantSelectionSource = 'ARKUI'
): AssistantSelection {
  return {
    action: 'CLEAR',
    entityType: '',
    entityId: '',
    displayText: '',
    source: source,
    pageRoute: pageRoute,
    selectedAt: new Date().toISOString(),
    fields: []
  }
}

export function createEntityRef(selection: AssistantSelection): AssistantEntityRef {
  return {
    entityType: selection.entityType,
    entityId: selection.entityId,
    pageRoute: selection.pageRoute
  }
}
