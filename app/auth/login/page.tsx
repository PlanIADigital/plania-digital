'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos'); setLoading(false); return }

    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut()
      setError('Debes confirmar tu correo electrónico antes de entrar. Revisa tu bandeja de entrada.')
      setLoading(false)
      return
    }

    // Verificar si es super admin
    const { data: userData } = await supabase
      .from('users')
      .select('is_super_admin, role')
      .eq('auth_uid', data.user.id)
      .single()

    // Verificar parámetro next (por si viene de /admin)
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')

    if (userData?.is_super_admin) {
      router.push(next || '/admin')
    } else if (userData?.role === 'directivo') {
      router.push('/directivo/dashboard')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E8F5F2', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ color: '#00A896', fontWeight: 700, fontSize: 28 }}>✦</span>
            <span style={{ color: '#3D3A8C', fontWeight: 700, fontSize: 32 }}>Plan</span>
            <span style={{ color: '#00A896', fontWeight: 900, fontSize: 32 }}>IA</span>
            <span style={{ color: '#3D3A8C', fontWeight: 700, fontSize: 32 }}> Digital</span>
            <span style={{ color: '#00A896', fontWeight: 700, fontSize: 28 }}>✦</span>
          </div>
          <p style={{ color: '#3D3A8C', fontSize: 15, margin: 0, letterSpacing: '0.08em', fontWeight: 500 }}>
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
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ display: 'block', width: '100%', padding: '13px', fontSize: 15, fontWeight: 700, color: 'white', background: loading ? '#9CA3AF' : '#3D3A8C', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif' }}
          >
            {loading ? 'Verificando...' : 'Iniciar sesión'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
            ¿No tienes cuenta?{' '}
            <a href="/auth/register" style={{ color: '#3D3A8C', fontWeight: 600, textDecoration: 'none' }}>
              Regístrate aquí
            </a>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#9CA3AF' }}>
          PlanIA Digital no es una entidad afiliada ni respaldada por la SEP.
        </p>
      </div>
    </div>
  )
}
