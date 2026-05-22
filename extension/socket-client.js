class PVSocket {
  constructor(url) {
    this.url = url
    this.handlers = {}
    this._ws = null
    this._reconnectTimer = null
    this._connect()
  }

  _connect() {
    const wsUrl = this.url
      .replace(/^https/, 'wss')
      .replace(/^http/, 'ws')

    try {
      this._ws = new WebSocket(`${wsUrl}/socket.io/?EIO=4&transport=websocket`)
    } catch (e) {
      this._scheduleReconnect()
      return
    }

    this._ws.onmessage = (e) => {
      const data = e.data

      // Engine.IO ping → responder pong
      if (data === '2') {
        this._ws.send('3')
        return
      }

      // Engine.IO open → enviar socket.io CONNECT
      if (data.startsWith('0')) {
        this._ws.send('40')
        return
      }

      // Socket.IO CONNECT confirmado
      if (data === '40' || data.startsWith('40{')) {
        this._trigger('connect')
        return
      }

      // Socket.IO EVENT
      if (data.startsWith('42')) {
        try {
          const parsed = JSON.parse(data.slice(2))
          const [event, ...args] = parsed
          this._trigger(event, ...args)
        } catch {}
      }
    }

    this._ws.onclose = () => this._scheduleReconnect()
    this._ws.onerror = () => this._ws.close()
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer)
    this._reconnectTimer = setTimeout(() => this._connect(), 3000)
  }

  _trigger(event, ...args) {
    ;(this.handlers[event] || []).forEach(h => h(...args))
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(handler)
    return this
  }

  emit(event, data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send('42' + JSON.stringify([event, data]))
    }
  }

  disconnect() {
    clearTimeout(this._reconnectTimer)
    if (this._ws) {
      this._ws.onclose = null
      this._ws.onerror = null
      this._ws.close()
      this._ws = null
    }
  }
}
