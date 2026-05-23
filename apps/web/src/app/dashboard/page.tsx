'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import {
  Monitor,
  Copy,
  Check,
  LogOut,
  Plus,
  Clock,
  X,
} from 'lucide-react'

interface Session {
  token: string
  link: string
  expiresAt: string
  status: 'waiting' | 'connected' | 'ended'
}

export default function DashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [clientStatus, setClientStatus] = useState<'waiting' | 'connected'>('waiting')
  const [error, setError] = useState('')
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const lastCursorSend = useRef(0)
  const isMouseDown = useRef(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('pv_token') : null

  useEffect(() => {
    if (!token) {
      router.push('/login')
    }
  }, [token, router])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Global mouseup so releasing the button outside the video still hides the dot.
  useEffect(() => {
    function onGlobalMouseUp() {
      if (!isMouseDown.current) return
      isMouseDown.current = false
      setCursorPos(null)
      const s = socketRef.current
      const sess = session
      if (s && sess) s.emit('cursor-hide', { token: sess.token })
    }
    window.addEventListener('mouseup', onGlobalMouseUp)
    return () => window.removeEventListener('mouseup', onGlobalMouseUp)
  }, [session])

  const endSession = useCallback(() => {
    socketRef.current?.emit('session-end', { token: session?.token })
    socketRef.current?.disconnect()
    peerRef.current?.close()
    socketRef.current = null
    peerRef.current = null
    pendingCandidates.current = []
    setSession(null)
    setClientStatus('waiting')
    setRemoteStream(null)
    setCursorPos(null)
    isMouseDown.current = false
  }, [session])

  const setupSocket = useCallback((sessionToken: string) => {
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!, {
      auth: { token },
    })
    socketRef.current = socket

    socket.emit('join-host', { token: sessionToken })

    // Re-join host room after any reconnection so cursor events keep working.
    socket.on('reconnect', () => {
      socket.emit('join-host', { token: sessionToken })
    })

    socket.on('client-connected', async () => {
      setClientStatus('connected')
      pendingCandidates.current = []

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peerRef.current = pc

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setRemoteStream(event.streams[0])
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { token: sessionToken, candidate: event.candidate })
        }
      }

      pc.addTransceiver('video', { direction: 'recvonly' })
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('offer', { token: sessionToken, sdp: offer })
    })

    socket.on('answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      await peerRef.current?.setRemoteDescription(sdp)
      for (const candidate of pendingCandidates.current) {
        await peerRef.current?.addIceCandidate(candidate)
      }
      pendingCandidates.current = []
    })

    socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (peerRef.current?.remoteDescription) {
        await peerRef.current.addIceCandidate(candidate)
      } else {
        pendingCandidates.current.push(candidate)
      }
    })

    socket.on('client-disconnected', () => {
      setClientStatus('waiting')
      setRemoteStream(null)
      setCursorPos(null)
      isMouseDown.current = false
      peerRef.current?.close()
      peerRef.current = null
    })
  }, [token])

  async function createSession() {
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 401) {
        localStorage.removeItem('pv_token')
        router.push('/login')
        return
      }

      const data = await res.json()
      setSession({ ...data, status: 'waiting' })
      setupSocket(data.token)
    } catch {
      setError('No se pudo crear la sesion')
    } finally {
      setCreating(false)
    }
  }

  function sendCursor(e: React.MouseEvent<HTMLVideoElement>) {
    const now = Date.now()
    if (now - lastCursorSend.current < 33) return
    lastCursorSend.current = now
    if (!session || !socketRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setCursorPos({ x, y })
    socketRef.current.emit('cursor-move', { token: session.token, x, y })
  }

  function handleMouseDown(e: React.MouseEvent<HTMLVideoElement>) {
    isMouseDown.current = true
    sendCursor(e)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLVideoElement>) {
    if (!isMouseDown.current) return
    sendCursor(e)
  }

  function handleMouseUp() {
    isMouseDown.current = false
    setCursorPos(null)
    if (!session || !socketRef.current) return
    socketRef.current.emit('cursor-hide', { token: session.token })
  }

  function handleMouseLeave() {
    if (!isMouseDown.current) return
    isMouseDown.current = false
    setCursorPos(null)
    if (!session || !socketRef.current) return
    socketRef.current.emit('cursor-hide', { token: session.token })
  }

  function copyLink() {
    if (!session) return
    navigator.clipboard.writeText(session.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyToken() {
    if (!session) return
    navigator.clipboard.writeText(session.token)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
  }

  function logout() {
    localStorage.removeItem('pv_token')
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
            <Monitor size={18} color="#fff" />
          </div>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            PeerView
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <LogOut size={14} />
          Salir
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                Sesion activa
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Genera un link y compartelo para ver la pantalla de alguien
              </p>
            </div>
            {!session && (
              <button
                onClick={createSession}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                <Plus size={16} />
                {creating ? 'Creando...' : 'Nueva sesion'}
              </button>
            )}
            {session && (
              <button
                onClick={endSession}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#2D1414', color: '#F87171', border: '1px solid #3D1414' }}
              >
                <X size={16} />
                Terminar sesion
              </button>
            )}
          </div>

          {error && (
            <p
              className="text-sm px-3 py-2 rounded-lg mb-4"
              style={{ backgroundColor: '#2D1414', color: '#F87171', border: '1px solid #3D1414' }}
            >
              {error}
            </p>
          )}

          {session && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  Link para compartir
                </p>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                  style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  <span
                    className="flex-1 text-sm truncate font-mono"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {session.link}
                  </span>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors"
                    style={{
                      backgroundColor: copied ? '#14532D' : 'var(--surface)',
                      color: copied ? '#86EFAC' : 'var(--text-muted)',
                      border: `1px solid ${copied ? '#166534' : 'var(--border)'}`,
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  Token (para la extension del navegador)
                </p>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                  style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  <span
                    className="flex-1 text-sm font-mono"
                    style={{ color: 'var(--text-primary)', letterSpacing: '0.03em' }}
                  >
                    {session.token}
                  </span>
                  <button
                    onClick={copyToken}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors"
                    style={{
                      backgroundColor: copiedToken ? '#14532D' : 'var(--surface)',
                      color: copiedToken ? '#86EFAC' : 'var(--text-muted)',
                      border: `1px solid ${copiedToken ? '#166534' : 'var(--border)'}`,
                    }}
                  >
                    {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                    {copiedToken ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                <Clock size={14} />
                <span>
                  Expira:{' '}
                  {new Date(session.expiresAt).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {session && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    clientStatus === 'connected' ? '#22c55e' : 'var(--text-muted)',
                }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {clientStatus === 'connected' ? 'Cliente conectado' : 'Esperando que el cliente comparta su pantalla...'}
              </span>
            </div>

            <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', backgroundColor: '#0a0f1e' }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                {clientStatus === 'connected' ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      title="Mantén click presionado para señalar"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        cursor: 'crosshair',
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseLeave}
                    />
                    {cursorPos && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${cursorPos.x * 100}%`,
                          top: `${cursorPos.y * 100}%`,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'rgba(239,68,68,0.9)',
                          border: '2.5px solid #fff',
                          boxShadow: '0 0 0 3px rgba(239,68,68,0.3)',
                          transform: 'translate(-50%,-50%)',
                          pointerEvents: 'none',
                          transition: 'left 40ms linear, top 40ms linear',
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                    }}
                  >
                    <Monitor size={36} color="rgba(255,255,255,0.15)" />
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                      Esperando que el cliente comparta su pantalla...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!session && (
          <div
            className="rounded-xl p-12 text-center"
            style={{ backgroundColor: 'var(--surface)', border: '1px dashed var(--border)' }}
          >
            <Monitor size={40} color="var(--text-muted)" className="mx-auto mb-3" />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              Sin sesion activa
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Crea una nueva sesion para comenzar a ver pantallas remotas
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
