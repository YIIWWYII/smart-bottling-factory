export interface AiCenterConfigValues {
  API_BASE: string
  WS_BASE: string
  requestTimeoutMs: number
}

export const AiCenterConfig: AiCenterConfigValues = {
  // Independent AI center, separate from the Spring Boot production backend.
  API_BASE: 'http://192.168.0.104:8091/api',
  WS_BASE: 'ws://192.168.0.104:8091/api/assistant/events',
  requestTimeoutMs: 12000
}
