import { webSocket } from '@kit.NetworkKit'
import { BusinessError } from '@kit.BasicServicesKit'
import { util } from '@kit.ArkTS'
import { ApiConfig } from './ApiConfig'
import { SessionStore } from './SessionStore'

export type RealtimeCallback = (payload: string) => void
export type RealtimeStatusCallback = (online: boolean) => void

export class FactoryRealtime {
  private socket: webSocket.WebSocket | undefined
  private stopped: boolean = true
  private retryTimer: number = -1
  private onEvent: RealtimeCallback | undefined
  private onStatus: RealtimeStatusCallback | undefined

  connect(onEvent: RealtimeCallback, onStatus: RealtimeStatusCallback): void {
    this.onEvent = onEvent
    this.onStatus = onStatus
    if (SessionStore.isDemo) {
      this.stopped = true
      this.reportStatus(false)
      return
    }
    this.stopped = false
    this.open()
  }

  private open(): void {
    if (this.stopped || SessionStore.isDemo) return
    this.reportStatus(false)
    const socket = webSocket.createWebSocket()
    this.socket = socket
    socket.on('open', () => this.reportStatus(true))
    socket.on('message', (error: BusinessError, value: string | ArrayBuffer) => {
      if (!error && typeof value === 'string') {
        if (value !== 'pong' && this.onEvent !== undefined) this.onEvent(value)
      } else if (!error && value instanceof ArrayBuffer) {
        const payload: string = util.TextDecoder.create('utf-8').decodeToString(new Uint8Array(value))
        if (payload !== 'pong' && this.onEvent !== undefined) this.onEvent(payload)
      }
    })
    socket.on('error', () => this.reportStatus(false))
    socket.on('close', () => {
      this.reportStatus(false)
      if (!this.stopped) this.retryTimer = setTimeout(() => this.open(), 2000)
    })
    socket.connect(ApiConfig.WS_BASE, (error: BusinessError) => {
      if (error) this.reportStatus(false)
    })
  }

  close(): void {
    this.stopped = true
    if (this.retryTimer >= 0) clearTimeout(this.retryTimer)
    this.retryTimer = -1
    const socket = this.socket
    this.socket = undefined
    if (socket) socket.close()
  }

  private reportStatus(value: boolean): void {
    if (this.onStatus !== undefined) this.onStatus(value)
  }
}
