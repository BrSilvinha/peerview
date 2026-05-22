'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { Monitor, Loader2, ShieldAlert } from 'lucide-react'

type PageState = 'loading' | 'invalid' | 'ready' | 'sharing' | 'stopped' | 'error'

export default function SessionPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/sessions/${token}`)
        const data = await res.json()
        if (!data.valid) {
          setState('invalid')
        } else {
          setState('ready')
        }
      } catch {
        setState('invalid')
      }
    }
    validateToken()
  }, [token])

  async function startSharing() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setState('ready')
      } else {
        setErrorMsg('No se pudo iniciar el uso compartido de pantalla.')
        setState('error')
      }
      return
    }

    streamRef.current = stream

    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!)
    socketRef.current = socket
    socket.emit('join-client', { token })

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    peerRef.current = pc

    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    const pendingIce: RTCIceCandidateInit[] = []

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { token, candidate: event.candidate })
      }
    }

    socket.on('offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      await pc.setRemoteDescription(sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', { token, sdp: answer })
      for (const candidate of pendingIce) {
        await pc.addIceCandidate(candidate)
      }
      pendingIce.length = 0
    })

    socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(candidate)
      } else {
        pendingIce.push(candidate)
      }
    })

    socket.on('cursor-move', ({ x, y }: { x: number; y: number }) => {
      setCursorPos({ x, y })
    })

    socket.on('cursor-hide', () => setCursorPos(null))

    socket.on('session-ended', () => stopSharing())
    socket.on('host-disconnected', () => stopSharing())

    stream.getVideoTracks()[0].addEventListener('ended', () => stopSharing())

    setState('sharing')
  }

  function stopSharing() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    socketRef.current?.emit('session-end', { token })
    socketRef.current?.disconnect()
    peerRef.current?.close()
    streamRef.current = null
    socketRef.current = null
    peerRef.current = null
    setState('stopped')
  }

  if (state === 'sharing') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'transparent', pointerEvents: 'none' }}>
        {cursorPos && (
          <div
            style={{
              position: 'fixed',
              left: `${cursorPos.x * 100}vw`,
              top: `${cursorPos.y * 100}vh`,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.92)',
              border: '3px solid #fff',
              boxShadow: '0 0 0 4px rgba(239,68,68,0.3)',
              transform: 'translate(-50%, -50%)',
              transition: 'left 40ms linear, top 40ms linear',
              zIndex: 2147483647,
              pointerEvents: 'none',
            }}
          />
        )}
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
                Este link de sesión ya no es válido. Solicita uno nuevo al técnico.
              </p>
            </div>
          )}

          {state === 'ready' && (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full" style={{ backgroundColor: 'var(--bg)' }}>
                <Monitor size={40} color="var(--accent)" />
              </div>
              <div>
                <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                  Compartir tu pantalla
                </h2>
                <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Al hacer clic en el botón, se te pedirá que elijas qué pantalla o ventana compartir.
                  Solo el técnico podrá ver tu pantalla.
                </p>
              </div>
              <div
                className="text-xs px-3 py-2 rounded-lg w-full text-left space-y-1"
                style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <p>Solo lectura — el técnico no puede controlar tu dispositivo</p>
                <p>En el selector, elige <strong style={{ color: 'var(--text-primary)' }}>Pantalla completa</strong> o <strong style={{ color: 'var(--text-primary)' }}>Ventana</strong>, no &quot;Pestaña&quot;</p>
              </div>
              <button
                onClick={startSharing}
                className="w-full py-3 rounded-lg font-medium text-sm"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                Comenzar a compartir
              </button>
            </div>
          )}

          {state === 'stopped' && (
            <div className="flex flex-col items-center gap-3">
              <Monitor size={40} color="var(--text-muted)" />
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                Sesión finalizada
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Sesión finalizada. Puedes cerrar esta pestaña.
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3">
              <ShieldAlert size={40} color="#F87171" />
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                Error
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {errorMsg}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
