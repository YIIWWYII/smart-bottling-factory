import { AssistantHostAdapter, AssistantSelectionListener } from '../host/AssistantHostAdapter'
import {
  AssistantContext,
  AssistantMessageResult,
  AssistantMessageView,
  AssistantQuestionType,
  AssistantSelection,
  AssistantSendMessagePayload,
  AssistantUiStatus
} from '../model/AssistantModels'
import { AssistantApiClient, AssistantApiError } from '../service/AssistantApiClient'

@Observed
export class AssistantController implements AssistantSelectionListener {
  readonly adapter: AssistantHostAdapter
  visible: boolean = false
  hostVisible: boolean = true
  draft: string = ''
  status: AssistantUiStatus = AssistantUiStatus.IDLE
  errorMessage: string = ''
  messages: AssistantMessageView[] = []
  activeSelection: AssistantSelection | undefined = undefined

  private client: AssistantApiClient
  private conversationId: string = ''
  private lastQuestion: string = ''
  private disposed: boolean = false
  private requestCancelled: boolean = false

  constructor(adapter: AssistantHostAdapter) {
    this.adapter = adapter
    this.client = new AssistantApiClient(adapter)
    this.adapter.subscribeSelection(this)
  }

  onSelectionChanged(selection: AssistantSelection | undefined): void {
    this.activeSelection = selection
  }

  toggle(): void {
    this.visible = !this.visible
  }

  open(): void {
    this.visible = true
  }

  close(): void {
    this.visible = false
  }

  setDraft(value: string): void {
    this.draft = value
  }

  reportHostVisibility(visible: boolean): void {
    this.hostVisible = visible
    if (!visible) {
      this.close()
    }
  }

  clearSelection(): void {
    this.adapter.clearSelection()
  }

  navigateToSelection(): void {
    if (this.activeSelection !== undefined) {
      this.adapter.navigateToEntity(this.activeSelection.entityType, this.activeSelection.entityId)
    }
  }

  async sendQuestion(questionOverride?: string): Promise<void> {
    if (this.disposed || this.status === AssistantUiStatus.SENDING) {
      return
    }
    const question: string = (questionOverride === undefined ? this.draft : questionOverride).trim()
    if (question.length === 0) {
      this.errorMessage = '请输入问题'
      return
    }
    this.lastQuestion = question
    this.requestCancelled = false
    this.draft = ''
    this.errorMessage = ''
    this.status = AssistantUiStatus.SENDING
    this.appendUserMessage(question)
    try {
      const context: AssistantContext = this.buildContext()
      if (this.conversationId.length === 0) {
        const conversation = await this.client.createConversation({ context: context })
        this.conversationId = conversation.conversationId
      }
      const payload: AssistantSendMessagePayload = {
        question: question,
        questionType: this.activeSelection === undefined
          ? AssistantQuestionType.FREE_TEXT
          : AssistantQuestionType.SELECTION,
        context: context
      }
      const result: AssistantMessageResult = await this.client.sendMessage(this.conversationId, payload)
      this.messages = this.messages.concat([this.toAssistantMessage(result)])
      this.status = AssistantUiStatus.COMPLETE
    } catch (error) {
      if (!this.requestCancelled) {
        const apiError: AssistantApiError = error as AssistantApiError
        this.errorMessage = apiError.message || 'AI 助手暂时不可用'
        this.status = AssistantUiStatus.ERROR
      }
    }
  }

  stop(): void {
    if (this.status === AssistantUiStatus.SENDING) {
      this.requestCancelled = true
      this.status = AssistantUiStatus.STOPPED
      this.client.cancelActiveRequest()
      this.errorMessage = '本次回答已停止'
    }
  }

  async retry(): Promise<void> {
    if (this.lastQuestion.length > 0 && this.status !== AssistantUiStatus.SENDING) {
      await this.sendQuestion(this.lastQuestion)
    }
  }

  dispose(): void {
    this.disposed = true
    this.requestCancelled = true
    this.client.cancelActiveRequest()
    this.adapter.unsubscribeSelection(this)
  }

  private buildContext(): AssistantContext {
    const context: AssistantContext = this.adapter.getContext()
    context.sourceApp = this.adapter.sourceApp
    context.capturedAt = new Date().toISOString()
    if (this.activeSelection !== undefined) {
      context.selectedEntityType = this.activeSelection.entityType
      context.selectedEntityId = this.activeSelection.entityId
      context.selectedText = this.activeSelection.selectedText === undefined
        ? this.activeSelection.displayText
        : this.activeSelection.selectedText
    } else {
      context.selectedEntityType = undefined
      context.selectedEntityId = undefined
      context.selectedText = undefined
    }
    return context
  }

  private appendUserMessage(question: string): void {
    const message: AssistantMessageView = {
      messageId: 'local-' + Date.now().toString(),
      role: 'USER',
      content: question,
      status: AssistantUiStatus.COMPLETE,
      citations: [],
      createdAt: new Date().toISOString()
    }
    this.messages = this.messages.concat([message])
  }

  private toAssistantMessage(result: AssistantMessageResult): AssistantMessageView {
    return {
      messageId: result.messageId,
      role: 'ASSISTANT',
      content: result.content,
      status: AssistantUiStatus.COMPLETE,
      answerMode: result.answerMode,
      dataGeneratedAt: result.dataGeneratedAt,
      stateVersion: result.stateVersion,
      knowledgeVersion: result.knowledgeVersion,
      citations: result.citations,
      createdAt: result.createdAt
    }
  }
}
