export interface ApiConfigValues {
  API_BASE: string
  WS_BASE: string
  requestTimeoutMs: number
  refreshIntervalMs: number
}

export const ApiConfig: ApiConfigValues = {
  API_BASE: 'http://192.168.0.104:8088/hdc/api',
  WS_BASE: 'ws://192.168.0.104:8088/hdc/api/dataScreen/1',
  requestTimeoutMs: 8000,
  refreshIntervalMs: 2000
}
