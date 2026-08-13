import { webSocket } from '@kit.NetworkKit'
import { BusinessError } from '@kit.BasicServicesKit'
import { util } from '@kit.ArkTS'
import { ApiConfig } from './ApiConfig'

export type RealtimeCallback = (payload: string) => void
export type RealtimeStatusCallback = (online: boolean) => void

export class FactoryRealtime {
  private socket: webSocket.WebSocket | undefined
  private stopped: boolean = true
  private connecting: boolean = false
  private online: boolean = false
  private retryTimer: number = -1
  private sessionId: number = 0
  private onEvent: RealtimeCallback | undefined
  private onStatus: RealtimeStatusCallback | undefined

  connect(onEvent: RealtimeCallback, onStatus: RealtimeStatusCallback): void {
    this.onEvent = onEvent
    this.onStatus = onStatus
    this.stopped = false
    this.reportStatus(this.online)
    if (this.socket !== undefined || this.connecting || this.retryTimer >= 0) return
    this.open()
  }

  private open(): void {
    if (this.stopped || this.socket !== undefined || this.connecting) return
    this.connecting = true
    const currentSessionId: number = this.sessionId + 1
    this.sessionId = currentSessionId
    this.setOnline(false)
    const socket = webSocket.createWebSocket()
    this.socket = socket
    socket.on('open', () => {
      if (!this.isCurrentSocket(socket, currentSessionId)) return
      this.connecting = false
      this.setOnline(true)
    })
    socket.on('message', (error: BusinessError, value: string | ArrayBuffer) => {
      if (!this.isCurrentSocket(socket, currentSessionId)) return
      if (!error && typeof value === 'string') {
        // Some emulator builds deliver the first data frame before the open callback.
        this.connecting = false
        this.setOnline(true)
        if (value !== 'pong' && this.onEvent !== undefined) this.onEvent(value)
      } else if (!error && value instanceof ArrayBuffer) {
        this.connecting = false
        this.setOnline(true)
        const payload: string = util.TextDecoder.create('utf-8').decodeToString(new Uint8Array(value))
        if (payload !== 'pong' && this.onEvent !== undefined) this.onEvent(payload)
      }
    })
    socket.on('error', () => this.handleSocketClosed(socket, currentSessionId))
    socket.on('close', () => this.handleSocketClosed(socket, currentSessionId))
    void socket.connect(ApiConfig.WS_BASE).then((connected: boolean) => {
      if (!this.isCurrentSocket(socket, currentSessionId)) return
      if (connected) {
        this.connecting = false
        this.setOnline(true)
      } else {
        this.handleSocketClosed(socket, currentSessionId)
      }
    }).catch((_error: BusinessError) => {
      this.handleSocketClosed(socket, currentSessionId)
    })
  }

  close(): void {
    this.stopped = true
    this.sessionId += 1
    this.connecting = false
    if (this.retryTimer >= 0) clearTimeout(this.retryTimer)
    this.retryTimer = -1
    const socket = this.socket
    this.socket = undefined
    this.setOnline(false)
    if (socket) socket.close()
  }

  private isCurrentSocket(socket: webSocket.WebSocket, sessionId: number): boolean {
    return !this.stopped && this.socket === socket && this.sessionId === sessionId
  }

  private handleSocketClosed(socket: webSocket.WebSocket, sessionId: number): void {
    if (!this.isCurrentSocket(socket, sessionId)) return
    this.socket = undefined
    this.connecting = false
    this.setOnline(false)
    if (this.retryTimer < 0) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = -1
        this.open()
      }, 2000)
    }
  }

  private setOnline(value: boolean): void {
    if (this.online === value) return
    this.online = value
    this.reportStatus(value)
  }

  private reportStatus(value: boolean): void {
    if (this.onStatus !== undefined) this.onStatus(value)
  }
}
