(function () {
  if (document.getElementById('__pv_dot')) return

  const dot = document.createElement('div')
  dot.id = '__pv_dot'
  dot.style.cssText = [
    'position:fixed',
    'width:22px',
    'height:22px',
    'border-radius:50%',
    'background:rgba(239,68,68,0.88)',
    'border:2.5px solid #fff',
    'box-shadow:0 0 0 3px rgba(239,68,68,0.35),0 2px 10px rgba(0,0,0,0.4)',
    'pointer-events:none',
    'z-index:2147483647',
    'display:none',
    'transform:translate(-50%,-50%)',
    'transition:left 0.06s linear,top 0.06s linear',
    'will-change:left,top',
  ].join(';')

  document.documentElement.appendChild(dot)

  let hideTimer = null

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CURSOR_MOVE') {
      dot.style.left = (msg.x * 100) + 'vw'
      dot.style.top  = (msg.y * 100) + 'vh'
      dot.style.display = 'block'

      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => { dot.style.display = 'none' }, 2500)
    }

    if (msg.type === 'CURSOR_HIDE') {
      dot.style.display = 'none'
      clearTimeout(hideTimer)
    }
  })
})()
