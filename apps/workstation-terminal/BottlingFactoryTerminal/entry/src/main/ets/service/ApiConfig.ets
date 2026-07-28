export interface ApiConfigValues {
  API_BASE: string
  WS_BASE: string
  AI_BASE: string
  AI_WS_BASE: string
  requestTimeoutMs: number
  refreshIntervalMs: number
}

export const ApiConfig: ApiConfigValues = {
  // 集成环境通过当前电脑局域网地址访问 Spring Boot 服务。
  API_BASE: 'http://192.168.0.104:8088/hdc/api',
  WS_BASE: 'ws://192.168.0.104:8088/hdc/api/dataScreen/1',
  // 独立 AI 中枢服务，不经过 Spring Boot 生产后端代理。
  AI_BASE: 'http://192.168.0.104:8091/api',
  AI_WS_BASE: 'ws://192.168.0.104:8091/api/assistant/events',
  requestTimeoutMs: 8000,
  refreshIntervalMs: 2000
}
