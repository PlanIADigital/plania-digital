'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos'); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E8F5F2', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
          <div>
            <span style={{ color: '#3D3A8C', fontWeight: 700, fontSize: 24 }}>Plan</span>
            <span style={{ color: '#00A896', fontWeight: 800, fontSize: 32 }}>IA</span>
            <span style={{ color: '#00A896', fontWeight: 700, fontSize: 24 }}> Digital</span>
          </div>
          <p style={{ color: '#888', fontSize: 13, margin: '6px 0 0', letterSpacing: '0.03em' }}>
            Planea. Conecta. Transforma.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px rgba(61,58,140,0.10)' }}>
          <h2 style={{ color: '#1A1A2E', margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>
            Iniciar sesión
          </h2>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 28px' }}>
            Accede a tus planeaciones didácticas
          </p>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>
            Correo electrónico
          </label>
          <input
            placeholder="tu@correo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 18, outline: 'none', fontFamily: 'sans-serif' }}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>
            Contraseña
          </label>
          <input
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ display: 'block', width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 24, outline: 'none', fontFamily: 'sans-serif' }}
          />

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ background: loading ? '#9b99c4' : '#3D3A8C', color: 'white', border: 'none', padding: '13px 24px', fontSize: 15, cursor: loading ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600, transition: 'background 0.2s' }}>
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
            ¿No tienes cuenta?{' '}
            <a href="/auth/register" style={{ color: '#3D3A8C', fontWeight: 600, textDecoration: 'none' }}>
              Regístrate aquí
            </a>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#aaa' }}>
          PlanIA Digital no es una entidad afiliada ni respaldada por la SEP.
        </p>
      </div>
    </div>
  )
}