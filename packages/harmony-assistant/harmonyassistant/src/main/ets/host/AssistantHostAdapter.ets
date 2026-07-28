import {
  AssistantContext,
  AssistantEntityType,
  AssistantSelection,
  AssistantSourceApp
} from '../model/AssistantModels'

export interface AssistantSelectionListener {
  onSelectionChanged(selection: AssistantSelection | undefined): void
}

export interface AssistantHostAdapter {
  readonly sourceApp: AssistantSourceApp
  getContext(): AssistantContext
  getAccessToken(): Promise<string>
  getServiceEndpoint(): string
  subscribeSelection(listener: AssistantSelectionListener): void
  unsubscribeSelection(listener: AssistantSelectionListener): void
  clearSelection(): void
  navigateToEntity(entityType: AssistantEntityType, entityId: string): void
}

export class AssistantSelectionPublisher {
  private listeners: AssistantSelectionListener[] = []
  private currentSelection: AssistantSelection | undefined = undefined

  get current(): AssistantSelection | undefined {
    return this.currentSelection
  }

  subscribe(listener: AssistantSelectionListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener)
    }
    listener.onSelectionChanged(this.currentSelection)
  }

  unsubscribe(listener: AssistantSelectionListener): void {
    this.listeners = this.listeners.filter((item: AssistantSelectionListener) => item !== listener)
  }

  publish(selection: AssistantSelection): void {
    this.currentSelection = selection
    this.notify()
  }

  clear(): void {
    this.currentSelection = undefined
    this.notify()
  }

  private notify(): void {
    this.listeners.forEach((listener: AssistantSelectionListener) => {
      listener.onSelectionChanged(this.currentSelection)
    })
  }
}

export function createSelection(
  entityType: AssistantEntityType,
  entityId: string,
  displayText: string,
  source: string,
  pageRoute: string,
  stateVersion: number,
  selectedText?: string
): AssistantSelection {
  return {
    entityType: entityType,
    entityId: entityId,
    displayText: displayText,
    source: source,
    pageRoute: pageRoute,
    stateVersion: stateVersion,
    selectedAt: new Date().toISOString(),
    selectedText: selectedText
  }
}
