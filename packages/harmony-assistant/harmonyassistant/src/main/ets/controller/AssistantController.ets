import {
  AssistantHostAdapter,
  AssistantSelectionListener,
  AssistantVisibilityListener,
  createEntityRef
} from '../host/AssistantHostAdapter'
import {
  AssistantContext,
  AssistantConversationMessagesResult,
  AssistantMessageResult,
  AssistantMessageView,
  AssistantQuestionType,
  AssistantSelection,
  AssistantSendMessagePayload,
  AssistantStreamEvent,
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
  private activeAssistantMessageId: string = ''
  private disposed: boolean = false
  private requestCancelled: boolean = false
  private streamCompensating: boolean = false
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
      this.client.startEventStream(
        this.conversationId,
        (event: AssistantStreamEvent): void => this.onStreamEvent(event),
        (): void => { void this.compensateFromHttp() }
      )
      const payload: AssistantSendMessagePayload = {
        question: question,
        questionType: this.activeSelection === undefined
          ? AssistantQuestionType.FREE_TEXT
          : AssistantQuestionType.SELECTION,
        context: context
      }
      this.status = AssistantUiStatus.STREAMING
      const result: AssistantMessageResult = await this.client.sendMessage(this.conversationId, payload)
      this.applyMessageResult(result)
      if (result.status === AssistantUiStatus.FAILED) {
        this.errorMessage = result.content
        this.status = AssistantUiStatus.FAILED
      } else if (result.status === AssistantUiStatus.STOPPED) {
        this.errorMessage = '本次回答已停止'
        this.status = AssistantUiStatus.STOPPED
      } else {
        this.status = AssistantUiStatus.COMPLETED
      }
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
      if (this.conversationId.length > 0) {
        void this.client.stopConversation(this.conversationId)
      }
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
    this.client.closeEventStream()
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

  private onStreamEvent(event: AssistantStreamEvent): void {
    if (this.disposed || event.conversationId !== this.conversationId) return
    if (event.type === 'ai.connection.ready' || event.type === 'ai.conversation.created') return
    if (event.messageId !== undefined && event.messageId.length > 0) {
      this.activeAssistantMessageId = event.messageId
    }
    if (event.type === 'ai.conversation.started') {
      this.upsertStreamingMessage(event, '')
      this.status = AssistantUiStatus.STREAMING
      return
    }
    if (event.type === 'ai.conversation.delta') {
      this.upsertStreamingMessage(event, event.delta === undefined ? '' : event.delta)
      this.status = AssistantUiStatus.STREAMING
      return
    }
    if (event.type === 'ai.conversation.completed') {
      this.replaceStreamContent(event, AssistantUiStatus.COMPLETED)
      this.errorMessage = ''
      this.status = AssistantUiStatus.COMPLETED
      return
    }
    if (event.type === 'ai.conversation.failed') {
      this.replaceStreamContent(event, AssistantUiStatus.FAILED)
      this.errorMessage = event.content === undefined ? 'AI 鍔╂墜鍥炵瓟澶辫触' : event.content
      this.status = AssistantUiStatus.FAILED
      return
    }
    if (event.type === 'ai.conversation.stopped') {
      this.replaceStreamContent(event, AssistantUiStatus.STOPPED)
      this.errorMessage = '鏈鍥炵瓟宸插仠姝?'
      this.status = AssistantUiStatus.STOPPED
    }
  }

  private async compensateFromHttp(): Promise<void> {
    if (this.disposed || this.streamCompensating || this.conversationId.length === 0) return
    this.streamCompensating = true
    try {
      const result: AssistantConversationMessagesResult = await this.client.listMessages(this.conversationId)
      const views: AssistantMessageView[] = []
      result.messages.forEach((message: AssistantMessageResult) => {
        views.push(this.toAssistantMessage(message))
      })
      if (views.length > 0) {
        this.messages = views
        const lastMessage: AssistantMessageView = views[views.length - 1]
        this.status = lastMessage.status
        if (lastMessage.status === AssistantUiStatus.FAILED || lastMessage.status === AssistantUiStatus.STOPPED) {
          this.errorMessage = lastMessage.content
        }
      }
    } catch (_error) {
      if (this.status === AssistantUiStatus.STREAMING) {
        this.errorMessage = 'AI 瀹炴椂閫氶亾宸叉柇寮€锛屾鍦ㄩ噸杩炲苟绛夊緟 HTTP 琛ュ伩'
      }
    } finally {
      this.streamCompensating = false
    }
  }

  private upsertStreamingMessage(event: AssistantStreamEvent, delta: string): void {
    const messageId: string = event.messageId === undefined ? this.activeAssistantMessageId : event.messageId
    if (messageId.length === 0) return
    const next: AssistantMessageView[] = this.messages.slice()
    const index: number = this.findMessageIndex(messageId)
    if (index >= 0) {
      const current: AssistantMessageView = next[index]
      current.content = current.content + delta
      current.status = AssistantUiStatus.STREAMING
      next[index] = current
    } else {
      next.push({
        messageId: messageId,
        role: 'ASSISTANT',
        content: delta,
        status: AssistantUiStatus.STREAMING,
        dataGeneratedAt: event.dataGeneratedAt,
        stateVersion: event.stateVersion,
        knowledgeVersion: event.knowledgeVersion,
        citations: event.citations === undefined ? [] : event.citations,
        createdAt: event.createdAt === undefined ? new Date().toISOString() : event.createdAt
      })
    }
    this.messages = next
  }

  private replaceStreamContent(event: AssistantStreamEvent, status: AssistantUiStatus): void {
    const messageId: string = event.messageId === undefined ? this.activeAssistantMessageId : event.messageId
    if (messageId.length === 0) return
    const next: AssistantMessageView[] = this.messages.slice()
    const index: number = this.findMessageIndex(messageId)
    if (index >= 0) {
      const current: AssistantMessageView = next[index]
      current.content = event.content === undefined ? current.content : event.content
      current.status = status
      current.dataGeneratedAt = event.dataGeneratedAt
      current.stateVersion = event.stateVersion
      current.knowledgeVersion = event.knowledgeVersion
      current.citations = event.citations === undefined ? current.citations : event.citations
      next[index] = current
    } else {
      next.push({
        messageId: messageId,
        role: 'ASSISTANT',
        content: event.content === undefined ? '' : event.content,
        status: status,
        dataGeneratedAt: event.dataGeneratedAt,
        stateVersion: event.stateVersion,
        knowledgeVersion: event.knowledgeVersion,
        citations: event.citations === undefined ? [] : event.citations,
        createdAt: event.createdAt === undefined ? new Date().toISOString() : event.createdAt
      })
    }
    this.messages = next
  }

  private applyMessageResult(result: AssistantMessageResult): void {
    const next: AssistantMessageView[] = this.messages.slice()
    const index: number = this.findMessageIndex(result.messageId)
    const view: AssistantMessageView = this.toAssistantMessage(result)
    if (index >= 0) {
      next[index] = view
    } else {
      next.push(view)
    }
    this.messages = next
  }

  private findMessageIndex(messageId: string): number {
    for (let index: number = 0; index < this.messages.length; index++) {
      if (this.messages[index].messageId === messageId) return index
    }
    return -1
  }

  private toAssistantMessage(result: AssistantMessageResult): AssistantMessageView {
    return {
      messageId: result.messageId,
      role: 'ASSISTANT',
      content: result.content,
      status: result.status === undefined ? AssistantUiStatus.COMPLETED : result.status,
      answerMode: result.answerMode,
      dataGeneratedAt: result.dataGeneratedAt,
      stateVersion: result.stateVersion,
      knowledgeVersion: result.knowledgeVersion,
      citations: result.citations,
      createdAt: result.createdAt
    }
  }
}
