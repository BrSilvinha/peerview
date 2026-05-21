'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'

type State = 'starting' | 'sharing' | 'stopped' | 'needs-click' | 'error'

export default function WorkerPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<State>('starting')

  const socketRef = useRef<Socket | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    startSharing()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startSharing() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, displaySurface: 'monitor' },
        audio: false,
      })
      await connect(stream)
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setState('needs-click')
      } else {
        setState('error')
      }
    }
  }

  async function connect(stream: MediaStream) {
    streamRef.current = stream
    setState('sharing')

    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!)
    socketRef.current = socket
    socket.emit('join-client', { token })

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
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

    socket.on('session-ended', () => stop())
    socket.on('host-disconnected', () => stop())

    stream.getVideoTracks()[0].addEventListener('ended', () => stop())
  }

  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    socketRef.current?.emit('session-end', { token })
    socketRef.current?.disconnect()
    peerRef.current?.close()
    streamRef.current = null
    socketRef.current = null
    peerRef.current = null
    setState('stopped')
    window.close()
  }

  if (state === 'sharing' || state === 'stopped' || state === 'starting') {
    return <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }} />
  }

  if (state === 'needs-click') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a',
      }}>
        <button
          onClick={startSharing}
          style={{
            padding: '10px 20px', background: '#6366f1', color: '#fff',
            borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
          }}
        >
          Aceptar compartir
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0a0a', color: '#666', fontSize: '12px',
    }}>
      Error al iniciar
    </div>
  )
}
