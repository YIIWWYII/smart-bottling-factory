import { http, webSocket } from '@kit.NetworkKit'
import { BusinessError } from '@kit.BasicServicesKit'
import { AssistantHostAdapter } from '../host/AssistantHostAdapter'
import {
  AssistantApiEnvelope,
  AssistantConversationMessagesResult,
  AssistantConversationResult,
  AssistantCreateConversationPayload,
  AssistantMessageResult,
  AssistantSendMessagePayload,
  AssistantServiceEndpoint,
  AssistantStreamEvent
} from '../model/AssistantModels'

interface AssistantHeaders {
  'Content-Type': string
  'X-Client-Type': string
  Authorization?: string
}

interface AssistantCaughtError {
  message?: string
  code?: number
}

interface AssistantWsHeaders {
  'X-Client-Type': string
  Authorization?: string
}

export type AssistantStreamListener = (event: AssistantStreamEvent) => void
export type AssistantStreamClosedListener = () => void

export class AssistantApiError extends Error {
  code: number

  constructor(message: string, code: number = -1) {
    super(message)
    this.code = code
  }
}

export class AssistantApiClient {
  private adapter: AssistantHostAdapter
  private activeRequest: http.HttpRequest | undefined = undefined
  private socket: webSocket.WebSocket | undefined = undefined
  private streamStopped: boolean = true
  private streamConversationId: string = ''
  private reconnectTimer: number = -1
  private reconnectAttempt: number = 0
  private seenEventIds: string[] = []
  private aggregateKeys: string[] = []
  private aggregateVersions: number[] = []
  private streamListener: AssistantStreamListener | undefined = undefined
  private streamClosedListener: AssistantStreamClosedListener | undefined = undefined

  constructor(adapter: AssistantHostAdapter) {
    this.adapter = adapter
  }

  async createConversation(payload: AssistantCreateConversationPayload): Promise<AssistantConversationResult> {
    return await this.request<AssistantConversationResult>(
      '/assistant/conversations',
      http.RequestMethod.POST,
      JSON.stringify(payload)
    )
  }

  async sendMessage(conversationId: string, payload: AssistantSendMessagePayload): Promise<AssistantMessageResult> {
    return await this.request<AssistantMessageResult>(
      '/assistant/conversations/' + encodeURIComponent(conversationId) + '/messages',
      http.RequestMethod.POST,
      JSON.stringify(payload)
    )
  }

  async listMessages(conversationId: string): Promise<AssistantConversationMessagesResult> {
    return await this.request<AssistantConversationMessagesResult>(
      '/assistant/conversations/' + encodeURIComponent(conversationId) + '/messages',
      http.RequestMethod.GET,
      ''
    )
  }

  async getMessage(conversationId: string, messageId: string): Promise<AssistantMessageResult> {
    return await this.request<AssistantMessageResult>(
      '/assistant/conversations/' + encodeURIComponent(conversationId) + '/messages/' + encodeURIComponent(messageId),
      http.RequestMethod.GET,
      ''
    )
  }

  async stopConversation(conversationId: string): Promise<void> {
    await this.request<object>(
      '/assistant/conversations/' + encodeURIComponent(conversationId) + '/stop',
      http.RequestMethod.POST,
      '{}'
    )
  }

  async stopMessage(conversationId: string, messageId: string): Promise<void> {
    await this.request<object>(
      '/assistant/conversations/' + encodeURIComponent(conversationId) + '/messages/' + encodeURIComponent(messageId) + '/stop',
      http.RequestMethod.POST,
      '{}'
    )
  }

  cancelActiveRequest(): void {
    if (this.activeRequest !== undefined) {
      this.activeRequest.destroy()
      this.activeRequest = undefined
    }
  }

  startEventStream(
    conversationId: string,
    listener: AssistantStreamListener,
    closedListener: AssistantStreamClosedListener
  ): void {
    if (this.streamConversationId !== conversationId) {
      this.resetStreamDedup()
    }
    this.closeEventStream()
    this.streamStopped = false
    this.streamConversationId = conversationId
    this.streamListener = listener
    this.streamClosedListener = closedListener
    this.openEventSocket()
  }

  closeEventStream(): void {
    this.streamStopped = true
    if (this.reconnectTimer >= 0) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = -1
    }
    const currentSocket: webSocket.WebSocket | undefined = this.socket
    this.socket = undefined
    if (currentSocket !== undefined) {
      currentSocket.close()
    }
  }

  private async request<T>(path: string, method: http.RequestMethod, body: string): Promise<T> {
    const serviceEndpoint: AssistantServiceEndpoint = this.adapter.getServiceEndpoint()
    const endpoint: string = this.normalizeEndpoint(serviceEndpoint.httpBaseUrl)
    if (endpoint.length === 0) {
      throw new AssistantApiError('AI 服务地址未配置')
    }
    const token: string | undefined = await this.adapter.getAccessToken()
    const headers: AssistantHeaders = token !== undefined && token.length > 0
      ? {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Client-Type': this.adapter.sourceApp,
        'Authorization': token
      }
      : {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Client-Type': this.adapter.sourceApp
      }
    const client: http.HttpRequest = http.createHttp()
    this.activeRequest = client
    try {
      const response: http.HttpResponse = await client.request(endpoint + path, {
        method: method,
        header: headers,
        extraData: body,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 8000,
        readTimeout: 45000
      })
      if (response.responseCode < 200 || response.responseCode >= 300) {
        throw new AssistantApiError('AI 服务 HTTP ' + response.responseCode.toString(), response.responseCode)
      }
      const raw: string = response.result as string
      const envelope: AssistantApiEnvelope<T> = JSON.parse(raw) as AssistantApiEnvelope<T>
      if (!envelope.success || (envelope.code !== 0 && envelope.code !== 1)) {
        throw new AssistantApiError(envelope.message || 'AI 服务返回错误', envelope.code)
      }
      return envelope.data
    } catch (error) {
      const caughtError: AssistantCaughtError = error as AssistantCaughtError
      const message: string = this.toFriendlyErrorMessage(caughtError)
      const code: number = caughtError.code === undefined ? -1 : caughtError.code
      throw new AssistantApiError(message, code)
    } finally {
      if (this.activeRequest === client) {
        this.activeRequest = undefined
      }
      client.destroy()
    }
  }

  private async openEventSocket(): Promise<void> {
    if (this.streamStopped || this.streamConversationId.length === 0) return
    const serviceEndpoint: AssistantServiceEndpoint = this.adapter.getServiceEndpoint()
    const endpoint: string = this.normalizeEndpoint(
      serviceEndpoint.wsBaseUrl.length > 0 ? serviceEndpoint.wsBaseUrl : this.toWsEndpoint(serviceEndpoint.httpBaseUrl)
    )
    if (endpoint.length === 0) return
    const token: string | undefined = await this.adapter.getAccessToken()
    const headers: AssistantWsHeaders = token !== undefined && token.length > 0
      ? { 'X-Client-Type': this.adapter.sourceApp, 'Authorization': token }
      : { 'X-Client-Type': this.adapter.sourceApp }
    const socket: webSocket.WebSocket = webSocket.createWebSocket()
    this.socket = socket
    socket.on('open', () => {
      this.reconnectAttempt = 0
    })
    socket.on('message', (error: BusinessError, value: string | ArrayBuffer) => {
      if (!error && typeof value === 'string') {
        this.handleStreamMessage(value)
      }
    })
    socket.on('error', () => {
      this.notifyStreamClosed()
    })
    socket.on('close', () => {
      this.notifyStreamClosed()
      this.scheduleReconnect()
    })
    const url: string = endpoint + '/assistant/events?conversationId=' +
      encodeURIComponent(this.streamConversationId) + '&afterVersion=' + this.lastAggregateVersion().toString()
    const options: webSocket.WebSocketRequestOptions = {
      header: headers,
      pingInterval: 20
    }
    socket.connect(url, options, (error: BusinessError) => {
      if (error) {
        this.notifyStreamClosed()
        this.scheduleReconnect()
      }
    })
  }

  private handleStreamMessage(raw: string): void {
    if (raw === 'pong' || raw.length === 0) return
    const event: AssistantStreamEvent = JSON.parse(raw) as AssistantStreamEvent
    if (this.shouldSkipEvent(event)) return
    if (this.streamListener !== undefined) {
      this.streamListener(event)
    }
  }

  private shouldSkipEvent(event: AssistantStreamEvent): boolean {
    if (event.eventId.length > 0) {
      if (this.seenEventIds.indexOf(event.eventId) >= 0) return true
      this.seenEventIds.push(event.eventId)
      if (this.seenEventIds.length > 200) {
        this.seenEventIds = this.seenEventIds.slice(this.seenEventIds.length - 200)
      }
    }
    if (event.aggregateVersion !== undefined && event.aggregateVersion > 0 &&
      event.aggregateType !== undefined && event.aggregateId !== undefined) {
      const key: string = event.aggregateType + ':' + event.aggregateId
      const index: number = this.aggregateKeys.indexOf(key)
      if (index >= 0) {
        if (event.aggregateVersion <= this.aggregateVersions[index]) return true
        this.aggregateVersions[index] = event.aggregateVersion
      } else {
        this.aggregateKeys.push(key)
        this.aggregateVersions.push(event.aggregateVersion)
      }
    }
    return false
  }

  private scheduleReconnect(): void {
    if (this.streamStopped || this.reconnectTimer >= 0) return
    const delay: number = Math.min(8000, 800 + this.reconnectAttempt * 1200)
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = -1
      this.openEventSocket()
    }, delay)
  }

  private notifyStreamClosed(): void {
    if (this.streamClosedListener !== undefined) {
      this.streamClosedListener()
    }
  }

  private lastAggregateVersion(): number {
    let result: number = 0
    for (let index: number = 0; index < this.aggregateVersions.length; index++) {
      result = Math.max(result, this.aggregateVersions[index])
    }
    return result
  }

  private resetStreamDedup(): void {
    this.seenEventIds = []
    this.aggregateKeys = []
    this.aggregateVersions = []
    this.reconnectAttempt = 0
  }

  private toWsEndpoint(value: string): string {
    const endpoint: string = this.normalizeEndpoint(value)
    if (endpoint.startsWith('https://')) return 'wss://' + endpoint.substring(8)
    if (endpoint.startsWith('http://')) return 'ws://' + endpoint.substring(7)
    return endpoint
  }

  private normalizeEndpoint(value: string): string {
    let endpoint: string = value.trim()
    while (endpoint.endsWith('/')) {
      endpoint = endpoint.substring(0, endpoint.length - 1)
    }
    return endpoint
  }

  private toFriendlyErrorMessage(error: AssistantCaughtError): string {
    const raw: string = error.message === undefined ? '' : error.message
    const lowered: string = raw.toLowerCase()
    if (lowered.includes('timeout') || lowered.includes('timed out') || lowered.includes('read timed') ||
      lowered.includes('connect timed')) {
      return 'AI 服务响应超时，请在后台管理检查模型地址、API Key、模型名称和请求超时时间。'
    }
    if (lowered.includes('failed to connect') || lowered.includes('connection') || lowered.includes('network')) {
      return 'AI 服务连接失败，请确认 AI 中枢已启动并且后台模型服务地址可访问。'
    }
    if (raw.length === 0) {
      return 'AI 服务请求失败，请在后台管理执行“测试连接”查看原因。'
    }
    return raw
  }
}
