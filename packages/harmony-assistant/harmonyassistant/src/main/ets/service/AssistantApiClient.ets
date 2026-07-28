import { http } from '@kit.NetworkKit'
import { AssistantHostAdapter } from '../host/AssistantHostAdapter'
import {
  AssistantApiEnvelope,
  AssistantConversationResult,
  AssistantCreateConversationPayload,
  AssistantMessageResult,
  AssistantSendMessagePayload,
  AssistantServiceEndpoint
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

  cancelActiveRequest(): void {
    if (this.activeRequest !== undefined) {
      this.activeRequest.destroy()
      this.activeRequest = undefined
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
        readTimeout: 30000
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
      const message: string = caughtError.message === undefined || caughtError.message.length === 0
        ? 'AI 服务请求失败'
        : caughtError.message
      const code: number = caughtError.code === undefined ? -1 : caughtError.code
      throw new AssistantApiError(message, code)
    } finally {
      if (this.activeRequest === client) {
        this.activeRequest = undefined
      }
      client.destroy()
    }
  }

  private normalizeEndpoint(value: string): string {
    let endpoint: string = value.trim()
    while (endpoint.endsWith('/')) {
      endpoint = endpoint.substring(0, endpoint.length - 1)
    }
    return endpoint
  }
}
