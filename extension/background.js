const SERVER_URL = 'https://peerview-zh4i.onrender.com'

let socket = null
let currentToken = null

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CONNECT') {
    connect(msg.token)
    sendResponse({ ok: true })
  }

  if (msg.type === 'DISCONNECT') {
    disconnect()
    sendResponse({ ok: true })
  }

  if (msg.type === 'GET_STATUS') {
    sendResponse({ connected: !!socket, token: currentToken })
  }

  return true
})

function connect(token) {
  if (socket) disconnect()

  currentToken = token
  socket = new PVSocket(SERVER_URL)

  socket.on('connect', () => {
    socket.emit('join-observer', { token })
  })

  socket.on('cursor-move', ({ x, y }) => {
    broadcastToActiveTab({ type: 'CURSOR_MOVE', x, y })
  })

  socket.on('cursor-hide', () => {
    broadcastToActiveTab({ type: 'CURSOR_HIDE' })
  })

  socket.on('session-ended', () => {
    broadcastToActiveTab({ type: 'CURSOR_HIDE' })
    disconnect()
  })
}

function disconnect() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  currentToken = null
}

function broadcastToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message, () => {
        // Ignorar errores si el content script no está listo
        void chrome.runtime.lastError
      })
    }
  })
}
