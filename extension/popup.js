;(function () {
  const input     = document.getElementById('token-input')
  const btnConn   = document.getElementById('btn-connect')
  const btnDisc   = document.getElementById('btn-disconnect')
  const dot       = document.getElementById('status-dot')
  const statusTxt = document.getElementById('status-text')
  const errorMsg  = document.getElementById('error-msg')

  function parseToken(raw) {
    const trimmed = raw.trim()
    const match = trimmed.match(/session\/([a-f0-9-]{36})/i)
    if (match) return match[1]
    if (/^[a-f0-9-]{36}$/i.test(trimmed)) return trimmed
    return null
  }

  function setStatus(state, text) {
    dot.className = 'dot ' + state
    statusTxt.textContent = text
  }

  function setError(msg) {
    errorMsg.textContent = msg
  }

  function setConnected(token) {
    input.disabled = true
    btnConn.style.display = 'none'
    btnDisc.style.display = 'block'
    setStatus('connected', 'Conectado · ' + token.slice(0, 8) + '…')
    setError('')
  }

  function setDisconnected() {
    input.disabled = false
    btnConn.style.display = 'block'
    btnDisc.style.display = 'none'
    setStatus('', 'Sin conectar')
    setError('')
  }

  // Poll GET_STATUS up to maxTries with intervalMs between tries.
  function waitForConnection(token, maxTries, intervalMs, onSuccess, onFail) {
    let tries = 0
    function attempt() {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
        if (res && res.connected) {
          onSuccess()
        } else if (++tries < maxTries) {
          setTimeout(attempt, intervalMs)
        } else {
          onFail()
        }
      })
    }
    attempt()
  }

  // Restore state on popup open
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (res && res.connected && res.token) {
      input.value = res.token
      setConnected(res.token)
    }
  })

  btnConn.addEventListener('click', () => {
    const token = parseToken(input.value)
    if (!token) {
      setError('Pega un link de sesion valido')
      return
    }

    setStatus('connecting', 'Conectando…')
    setError('')
    btnConn.disabled = true

    chrome.runtime.sendMessage({ type: 'CONNECT', token }, () => {
      // Poll until WebSocket is actually open (Render can take ~10s to wake up).
      waitForConnection(
        token,
        12,   // up to 12 tries
        1000, // every 1 second → max 12s wait
        () => {
          btnConn.disabled = false
          setConnected(token)
        },
        () => {
          btnConn.disabled = false
          setStatus('error', 'Sin conexion')
          setError('No se pudo conectar. El servidor puede estar iniciando, intenta de nuevo.')
        }
      )
    })
  })

  btnDisc.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT' }, () => {
      setDisconnected()
    })
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnConn.click()
  })
})()
