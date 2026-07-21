import { http } from '@kit.NetworkKit'
import { ApiConfig } from './ApiConfig'
import { ApiEnvelope, AuthUser, LoginResult } from '../model/FactoryModels'
import { SessionStore } from './SessionStore'

export class ApiError extends Error {
  code: number

  constructor(message: string, code: number = -1) {
    super(message)
    this.code = code
  }
}

export class ApiClient {
  async request<T>(path: string, method: http.RequestMethod = http.RequestMethod.GET, body?: Object): Promise<T> {
    const client = http.createHttp()
    const headers: Object = SessionStore.token.length > 0
      ? { 'Content-Type': 'application/json;charset=UTF-8', 'Authorization': SessionStore.token }
      : { 'Content-Type': 'application/json;charset=UTF-8' }
    try {
      const response = await client.request(ApiConfig.API_BASE + path, {
        method: method,
        header: headers,
        extraData: body === undefined ? undefined : JSON.stringify(body),
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: ApiConfig.requestTimeoutMs,
        readTimeout: ApiConfig.requestTimeoutMs
      })
      const raw: string = response.result as string
      const envelope: ApiEnvelope<T> = JSON.parse(raw) as ApiEnvelope<T>
      if (envelope.code !== 0 && envelope.code !== 1) {
        throw new ApiError(envelope.message || '后端接口返回错误', envelope.code)
      }
      return envelope.data
    } finally {
      client.destroy()
    }
  }

  async login(username: string, password: string): Promise<LoginResult> {
    return await this.request<LoginResult>('/auth/login', http.RequestMethod.POST, { username, password })
  }

  async register(username: string, displayName: string, password: string): Promise<AuthUser> {
    return await this.request<AuthUser>('/auth/register', http.RequestMethod.POST, { username, displayName, password })
  }

  async me(): Promise<AuthUser> {
    return await this.request<AuthUser>('/auth/me')
  }
}

export const apiClient = new ApiClient()
