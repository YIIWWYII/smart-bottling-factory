export interface ApiConfigValues {
  API_BASE: string
  WS_BASE: string
  AI_BASE: string
  AI_WS_BASE: string
  requestTimeoutMs: number
  refreshIntervalMs: number
}

export const ApiConfig: ApiConfigValues = {
  API_BASE: 'http://192.168.124.8:8088/hdc/api',
  WS_BASE: 'ws://192.168.124.8:8088/hdc/api/dataScreen/1',
  AI_BASE: 'http://192.168.124.8:8090/ai/api',
  AI_WS_BASE: 'ws://192.168.124.8:8090/ai/api/assistant/ws',
  requestTimeoutMs: 8000,
  refreshIntervalMs: 2000
}
