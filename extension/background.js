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
    const wsOpen = !!socket && !!socket._ws && socket._ws.readyState === 1
    sendResponse({ connected: wsOpen, token: currentToken })
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
    if (!tabs || !tabs[0]) return
    const tabId = tabs[0].id

    chrome.tabs.sendMessage(tabId, message, () => {
      if (!chrome.runtime.lastError) return

      // Content script not running in this tab — inject it and retry
      chrome.tabs.executeScript(tabId, { file: 'content.js' }, () => {
        void chrome.runtime.lastError
        chrome.tabs.sendMessage(tabId, message, () => {
          void chrome.runtime.lastError
        })
      })
    })
  })
}
