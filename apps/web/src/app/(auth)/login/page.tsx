'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Monitor, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Credenciales incorrectas')
        return
      }

      localStorage.setItem('pv_token', data.token)
      router.push('/dashboard')
    } catch {
      setError('No se pudo conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
            <Monitor size={20} color="#fff" />
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            PeerView
          </span>
        </div>

        {/* Card */}
        <div className="rounded-xl p-8" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Iniciar sesion
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Accede a tu panel de control
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Correo electronico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@peerview.dev"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Contrasena
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#2D1414', color: '#F87171', border: '1px solid #3D1414' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
