let socket = null
let reconnectTimer = null
let heartbeatTimer = null
let stopped = false

export function connectFactoryRealtime(onEvent, onStatus) {
	stopped = false
	const connect = () => {
		if (stopped) return
		onStatus(false)
		socket = new WebSocket('ws://127.0.0.1:8088/hdc/api/dataScreen/1')
		socket.onopen = () => {
			onStatus(true)
			heartbeatTimer = window.setInterval(() => {
				if (socket && socket.readyState === WebSocket.OPEN) socket.send('ping')
			}, 15000)
		}
		socket.onmessage = event => {
			if (event.data === 'pong') return
			try {
				const message = JSON.parse(event.data)
				if (message.type && message.type.indexOf('factory.') === 0) onEvent(message)
			} catch (error) {
				// The legacy screen endpoint also sends its own non-factory payloads.
			}
		}
		socket.onerror = () => onStatus(false)
		socket.onclose = () => {
			onStatus(false)
			window.clearInterval(heartbeatTimer)
			if (!stopped) reconnectTimer = window.setTimeout(connect, 2000)
		}
	}
	connect()
}

export function closeFactoryRealtime() {
	stopped = true
	window.clearTimeout(reconnectTimer)
	window.clearInterval(heartbeatTimer)
	if (socket) socket.close()
	socket = null
}
