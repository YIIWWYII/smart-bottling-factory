export interface ApiConfigValues {
  API_BASE: string
  WS_BASE: string
  AI_BASE: string
  AI_WS_BASE: string
  requestTimeoutMs: number
  refreshIntervalMs: number
}

const BACKEND_HOST: string = '192.168.1.104'
const BACKEND_PORT: string = '8088'
const AI_CENTER_HOST: string = '192.168.1.104'
const AI_CENTER_PORT: string = '8091'
const BACKEND_API_ROOT: string = BACKEND_HOST + ':' + BACKEND_PORT + '/hdc/api'
const AI_CENTER_API_ROOT: string = AI_CENTER_HOST + ':' + AI_CENTER_PORT + '/api'

export const ApiConfig: ApiConfigValues = {
  // 集成环境通过当前电脑局域网地址访问 Spring Boot 服务。
  API_BASE: 'http://' + BACKEND_API_ROOT,
  WS_BASE: 'ws://' + BACKEND_API_ROOT + '/dataScreen/1',
  // 独立 AI 中枢服务，不经过 Spring Boot 生产后端代理。
  AI_BASE: 'http://' + AI_CENTER_API_ROOT,
  AI_WS_BASE: 'ws://' + AI_CENTER_API_ROOT + '/assistant/events',
  requestTimeoutMs: 8000,
  refreshIntervalMs: 2000
}
