;(function () {
  const input     = document.getElementById('token-input')
  const btnConn   = document.getElementById('btn-connect')
  const btnDisc   = document.getElementById('btn-disconnect')
  const dot       = document.getElementById('status-dot')
  const statusTxt = document.getElementById('status-text')
  const errorMsg  = document.getElementById('error-msg')

  // Extract token from a full URL or bare token
  function parseToken(raw) {
    const trimmed = raw.trim()
    const match = trimmed.match(/session\/([a-f0-9-]{36})/i)
    if (match) return match[1]
    // Accept bare UUID
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

  // Restore state on open
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

    chrome.runtime.sendMessage({ type: 'CONNECT', token }, (res) => {
      btnConn.disabled = false
      if (res && res.ok) {
        setConnected(token)
      } else {
        setStatus('error', 'Error al conectar')
        setError('No se pudo conectar al servidor')
      }
    })
  })

  btnDisc.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT' }, () => {
      setDisconnected()
    })
  })

  // Allow pressing Enter in the input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnConn.click()
  })
})()
