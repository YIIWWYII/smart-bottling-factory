export interface ApiConfigValues {
  API_BASE: string
  WS_BASE: string
  requestTimeoutMs: number
  refreshIntervalMs: number
}

export const ApiConfig: ApiConfigValues = {
  // 集成环境通过当前电脑局域网地址访问 Spring Boot 服务，不能使用 localhost。
  API_BASE: 'http://192.168.0.104:8088/hdc/api',
  WS_BASE: 'ws://192.168.0.104:8088/hdc/api/dataScreen/1',
  requestTimeoutMs: 8000,
  refreshIntervalMs: 2000
}
