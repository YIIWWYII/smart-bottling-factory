import { http } from '@kit.NetworkKit'
import { ApiConfig } from './ApiConfig'
import { ApiEnvelope, AuthUser, LoginResult } from '../model/FactoryModels'
import { SessionStore } from './SessionStore'

interface RequestHeaders {
  'Content-Type': string
  Authorization?: string
}

interface LoginPayload {
  username: string
  password: string
}

interface RegisterPayload {
  username: string
  displayName: string
  password: string
}

export class ApiError extends Error {
  code: number

  constructor(message: string, code: number = -1) {
    super(message)
    this.code = code
  }
}

export class ApiClient {
  async request<T>(path: string, method: http.RequestMethod = http.RequestMethod.GET, body?: string): Promise<T> {
    const client = http.createHttp()
    const headers: RequestHeaders = SessionStore.token.length > 0
      ? { 'Content-Type': 'application/json;charset=UTF-8', 'Authorization': SessionStore.token }
      : { 'Content-Type': 'application/json;charset=UTF-8' }
    try {
      const response = await client.request(ApiConfig.API_BASE + path, {
        method: method,
        header: headers,
        extraData: body,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: ApiConfig.requestTimeoutMs,
        readTimeout: ApiConfig.requestTimeoutMs
      })
      if (response.responseCode < 200 || response.responseCode >= 300) {
        if (response.responseCode === 401) SessionStore.clear()
        if (response.responseCode === 401) throw new ApiError('登录已过期，请重新登录', response.responseCode)
        if (response.responseCode === 403) throw new ApiError('当前账号权限不足，后端已拒绝操作', response.responseCode)
        throw new ApiError('HTTP ' + response.responseCode + '：后端请求失败', response.responseCode)
      }
      const raw: string = response.result as string
      const envelope: ApiEnvelope<T> = JSON.parse(raw) as ApiEnvelope<T>
      if ((envelope.code !== 0 && envelope.code !== 1) || envelope.success === false) {
        if (envelope.code === 401 || envelope.code === 2004) SessionStore.clear()
        throw new ApiError(envelope.message || '后端接口返回错误', envelope.code)
      }
      return envelope.data
    } finally {
      client.destroy()
    }
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const payload: LoginPayload = { username: username, password: password }
    return await this.request<LoginResult>('/auth/login', http.RequestMethod.POST, JSON.stringify(payload))
  }

  async register(username: string, displayName: string, password: string): Promise<AuthUser> {
    const payload: RegisterPayload = { username: username, displayName: displayName, password: password }
    return await this.request<AuthUser>('/auth/register', http.RequestMethod.POST, JSON.stringify(payload))
  }

  async me(): Promise<AuthUser> {
    return await this.request<AuthUser>('/auth/me')
  }

  async logout(): Promise<void> {
    await this.request<Object>('/auth/logout', http.RequestMethod.POST)
  }
}

export const apiClient = new ApiClient()
