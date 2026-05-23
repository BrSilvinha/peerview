'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { Monitor, Loader2, ShieldAlert, StopCircle, Camera } from 'lucide-react'

type PageState = 'loading' | 'invalid' | 'ready' | 'sharing' | 'stopped' | 'error'

export default function SessionPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [isCamera, setIsCamera] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // iOS Safari has no getDisplayMedia — detect at runtime (not during SSR)
  const [hasDisplayMedia, setHasDisplayMedia] = useState(true)
  useEffect(() => {
    setHasDisplayMedia(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia)
  }, [])

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/sessions/${token}`)
        const data = await res.json()
        setState(data.valid ? 'ready' : 'invalid')
      } catch {
        setState('invalid')
      }
    }
    validateToken()
  }, [token])

  useEffect(() => {
    if (state === 'sharing' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [state])

  function resetControlsTimer() {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }

  async function startSharing(forceCamera = false) {
    const usingCamera = forceCamera || !navigator.mediaDevices?.getDisplayMedia
    let stream: MediaStream

    try {
      if (usingCamera) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setState('ready')
      } else {
        setErrorMsg('No se pudo iniciar la cámara o compartir pantalla.')
        setState('error')
      }
      return
    }

    setIsCamera(usingCamera)
    streamRef.current = stream

    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!)
    socketRef.current = socket
    socket.emit('join-client', { token })
    socket.on('reconnect', () => socket.emit('join-client', { token }))

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    peerRef.current = pc

    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    const pendingIce: RTCIceCandidateInit[] = []

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('ice-candidate', { token, candidate: event.candidate })
    }

    socket.on('offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      await pc.setRemoteDescription(sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', { token, sdp: answer })
      for (const c of pendingIce) await pc.addIceCandidate(c)
      pendingIce.length = 0
    })

    socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (pc.remoteDescription) await pc.addIceCandidate(candidate)
      else pendingIce.push(candidate)
    })

    socket.on('cursor-move', ({ x, y }: { x: number; y: number }) => setCursorPos({ x, y }))
    socket.on('cursor-hide', () => setCursorPos(null))
    socket.on('session-ended', () => stopSharing())
    socket.on('host-disconnected', () => stopSharing())

    stream.getVideoTracks()[0].addEventListener('ended', () => stopSharing())

    setState('sharing')
    resetControlsTimer()
  }

  function stopSharing() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    socketRef.current?.emit('session-end', { token })
    socketRef.current?.disconnect()
    peerRef.current?.close()
    streamRef.current = null
    socketRef.current = null
    peerRef.current = null
    setCursorPos(null)
    setState('stopped')
  }

  if (state === 'sharing') {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: '#000' }}
        onMouseMove={resetControlsTimer}
        onTouchStart={resetControlsTimer}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />

        {cursorPos && (
          <div
            style={{
              position: 'fixed',
              left: `${cursorPos.x * 100}vw`,
              top: `${cursorPos.y * 100}vh`,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.95)',
              border: '3px solid #fff',
              boxShadow: '0 0 0 6px rgba(239,68,68,0.4), 0 2px 16px rgba(0,0,0,0.6)',
              transform: 'translate(-50%, -50%)',
              transition: 'left 40ms linear, top 40ms linear',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Controls bar — auto-hides after 3 s of inactivity */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            zIndex: 20,
            transition: 'opacity 0.3s',
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ color: '#e2e8f0', fontSize: 13 }}>
              {isCamera ? 'Cámara activa' : 'Compartiendo pantalla'}
            </span>
          </div>
          <button
            onClick={stopSharing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: 'rgba(239,68,68,0.85)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <StopCircle size={14} />
            Detener
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-full max-w-md text-center">
        <div className="flex items-center gap-2 justify-center mb-10">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
            <Monitor size={20} color="#fff" />
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            PeerView
          </span>
        </div>

        <div
          className="rounded-xl p-8"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} color="var(--text-muted)" className="animate-spin" />
              <p style={{ color: 'var(--text-muted)' }}>Verificando sesión...</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="flex flex-col items-center gap-3">
              <ShieldAlert size={40} color="#F87171" />
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                Link inválido o expirado
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Este link ya no es válido. Solicita uno nuevo al técnico.
              </p>
            </div>
          )}

          {state === 'ready' && (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full" style={{ backgroundColor: 'var(--bg)' }}>
                {hasDisplayMedia
                  ? <Monitor size={40} color="var(--accent)" />
                  : <Camera size={40} color="var(--accent)" />}
              </div>
              <div>
                <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {hasDisplayMedia ? 'Compartir tu pantalla' : 'Mostrar con la cámara'}
                </h2>
                <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  {hasDisplayMedia
                    ? 'Elige qué pantalla o ventana compartir. Quédate en esta pestaña para ver el puntero del técnico.'
                    : 'Tu navegador no soporta compartir pantalla. Usaremos la cámara para que el técnico pueda indicarte qué hacer.'}
                </p>
              </div>

              {hasDisplayMedia && (
                <div
                  className="text-xs px-3 py-2 rounded-lg w-full text-left space-y-1"
                  style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  <p>Solo lectura — el técnico no puede controlar tu dispositivo</p>
                  <p>
                    Elige{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>Pantalla completa</strong>
                    {' '}o{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>Ventana</strong>
                    {' '}— no &quot;Pestaña&quot;
                  </p>
                  <p style={{ color: 'var(--accent)' }}>
                    Mantente en esta pestaña para ver el puntero
                  </p>
                </div>
              )}

              <button
                onClick={() => startSharing(false)}
                className="w-full py-3 rounded-lg font-medium text-sm"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                {hasDisplayMedia ? 'Comenzar a compartir' : 'Activar cámara'}
              </button>

              {/* On desktop, also offer camera as alternative */}
              {hasDisplayMedia && (
                <button
                  onClick={() => startSharing(true)}
                  className="w-full py-2 rounded-lg text-sm"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Usar cámara en su lugar
                </button>
              )}
            </div>
          )}

          {state === 'stopped' && (
            <div className="flex flex-col items-center gap-3">
              <Monitor size={40} color="var(--text-muted)" />
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                Sesión finalizada
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Puedes cerrar esta pestaña.
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3">
              <ShieldAlert size={40} color="#F87171" />
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                Error
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{errorMsg}</p>
              <button
                onClick={() => setState('ready')}
                className="text-sm mt-1"
                style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
