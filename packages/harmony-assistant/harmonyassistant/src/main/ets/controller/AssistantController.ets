import {
  AssistantHostAdapter,
  AssistantSelectionListener,
  AssistantVisibilityListener,
  createEntityRef
} from '../host/AssistantHostAdapter'
import {
  AssistantContext,
  AssistantMessageResult,
  AssistantMessageView,
  AssistantQuestionType,
  AssistantSelection,
  AssistantSendMessagePayload,
  AssistantSubscription,
  AssistantUiStatus,
  AssistantVisibility
} from '../model/AssistantModels'
import { AssistantApiClient, AssistantApiError } from '../service/AssistantApiClient'

@Observed
export class AssistantController {
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
  private selectionSubscription: AssistantSubscription
  private visibilitySubscription: AssistantSubscription
  private selectionListener: AssistantSelectionListener
  private visibilityListener: AssistantVisibilityListener

  constructor(adapter: AssistantHostAdapter) {
    this.adapter = adapter
    this.client = new AssistantApiClient(adapter)
    this.selectionListener = (selection: AssistantSelection): void => {
      this.onSelectionChanged(selection)
    }
    this.visibilityListener = (visibility: AssistantVisibility): void => {
      this.onVisibilityChanged(visibility)
    }
    this.selectionSubscription = this.adapter.subscribeSelection(this.selectionListener)
    this.visibilitySubscription = this.adapter.subscribeVisibility(this.visibilityListener)
  }

  toggle(): void {
    this.visible = !this.visible
  }

  open(): void {
    if (this.hostVisible) {
      this.visible = true
    }
  }

  close(): void {
    this.visible = false
  }

  setDraft(value: string): void {
    this.draft = value
  }

  reportHostVisibility(visible: boolean): void {
    this.onVisibilityChanged(visible ? 'VISIBLE' : 'HIDDEN')
  }

  clearSelection(): void {
    this.onSelectionChanged({
      action: 'CLEAR',
      entityType: '',
      entityId: '',
      displayText: '',
      source: 'ARKUI',
      pageRoute: '',
      selectedAt: new Date().toISOString(),
      fields: []
    })
  }

  async navigateToSelection(): Promise<void> {
    if (this.activeSelection !== undefined) {
      const result = await this.adapter.navigateToEntity(createEntityRef(this.activeSelection))
      if (!result.handled) {
        this.errorMessage = result.reason === undefined ? '当前页面无法定位该对象' : result.reason
        this.status = AssistantUiStatus.FAILED
      }
    }
  }

  async sendQuestion(questionOverride?: string): Promise<void> {
    if (this.disposed || this.status === AssistantUiStatus.SENDING || this.status === AssistantUiStatus.STREAMING) {
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
      const context: AssistantContext = await this.buildContext()
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
      this.status = AssistantUiStatus.COMPLETED
    } catch (error) {
      if (!this.requestCancelled) {
        const apiError: AssistantApiError = error as AssistantApiError
        this.errorMessage = apiError.message || 'AI 助手暂时不可用'
        this.status = AssistantUiStatus.FAILED
      }
    }
  }

  stop(): void {
    if (this.status === AssistantUiStatus.SENDING || this.status === AssistantUiStatus.STREAMING) {
      this.requestCancelled = true
      this.status = AssistantUiStatus.STOPPED
      this.client.cancelActiveRequest()
      this.errorMessage = '本次回答已停止'
    }
  }

  async retryLast(): Promise<void> {
    if (this.lastQuestion.length > 0 &&
      this.status !== AssistantUiStatus.SENDING &&
      this.status !== AssistantUiStatus.STREAMING) {
      await this.sendQuestion(this.lastQuestion)
    }
  }

  async retry(): Promise<void> {
    await this.retryLast()
  }

  dispose(): void {
    this.disposed = true
    this.requestCancelled = true
    this.client.cancelActiveRequest()
    this.selectionSubscription.unsubscribe()
    this.visibilitySubscription.unsubscribe()
  }

  private onSelectionChanged(selection: AssistantSelection): void {
    this.activeSelection = selection.action === 'CLEAR' ? undefined : selection
  }

  private onVisibilityChanged(visibility: AssistantVisibility): void {
    this.hostVisible = visibility === 'VISIBLE'
    if (!this.hostVisible) {
      this.close()
      this.stop()
    }
  }

  private async buildContext(): Promise<AssistantContext> {
    const context: AssistantContext = await this.adapter.getContext()
    context.contextVersion = context.contextVersion <= 0 ? 1 : context.contextVersion
    context.sourceApp = this.adapter.sourceApp
    context.capturedAt = new Date().toISOString()
    if (this.activeSelection !== undefined) {
      context.selection = this.activeSelection
    } else {
      context.selection = undefined
    }
    return context
  }

  private appendUserMessage(question: string): void {
    const message: AssistantMessageView = {
      messageId: 'local-' + Date.now().toString(),
      role: 'USER',
      content: question,
      status: AssistantUiStatus.COMPLETED,
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
      status: AssistantUiStatus.COMPLETED,
      answerMode: result.answerMode,
      dataGeneratedAt: result.dataGeneratedAt,
      stateVersion: result.stateVersion,
      knowledgeVersion: result.knowledgeVersion,
      citations: result.citations,
      createdAt: result.createdAt
    }
  }
}
