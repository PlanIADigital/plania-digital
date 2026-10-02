'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { fetchConSesion } from '@/lib/fetchConSesion'

const supabase = createClient()

// Paleta PlanIA
const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  menta: '#E8F5F2',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
  borde: '#E0DFF5',
}

const estiloEtiqueta = { display: 'block', fontSize: 14, fontWeight: 600, color: C.texto, marginBottom: 6 } as const
const estiloCampo = {
  display: 'block', width: '100%', height: 48, padding: '0 14px', fontSize: 16, borderRadius: 10,
  border: `1.5px solid ${C.borde}`, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  color: C.texto, background: 'white',
} as const

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // [1 oct 2026] Aviso cuando la sesión venció y fetchConSesion mandó aquí.
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('motivo') === 'sesion') setAviso('Tu sesión terminó. Vuelve a entrar para continuar.')
  }, [])

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return
    if (!email.trim() || !password) { setError('Escribe tu correo y tu contraseña.'); return }
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) { setError('El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.'); setLoading(false); return }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut()
        setError('Aún no confirmas tu correo. Busca el mensaje de PlanIA en tu bandeja de entrada (o en spam) y toca el enlace.')
        setLoading(false)
        return
      }

      // Verificar rol vía API del servidor (bypasea RLS)
      const res = await fetchConSesion('/api/auth/me', { method: 'POST' })
      const userData = await res.json()

      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')

      if (userData?.is_super_admin) {
        window.location.href = next || '/admin'
      } else {
        // Solo se aceptan regresos a páginas internas (nunca a otro sitio ni a /auth o /admin).
        const interno = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/auth') && !next.startsWith('/admin') ? next : null
        // [oct 2026] Carga completa: Safari en iPhone no arrastra el desplazamiento del teclado al Dashboard.
        if (userData?.role === 'directivo') {
          window.location.assign(interno && interno.startsWith('/directivo') ? interno : '/directivo/dashboard')
        } else {
          window.location.assign(interno && !interno.startsWith('/directivo') ? interno : '/dashboard')
        }
      }
    } catch {
      setError('No pudimos conectar con PlanIA. Revisa tu internet e intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.menta, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ color: C.cian, fontWeight: 700, fontSize: 28 }}>✦</span>
            <span style={{ color: C.indigo, fontWeight: 700, fontSize: 32 }}>Plan</span>
            <span style={{ color: C.cian, fontWeight: 900, fontSize: 32 }}>IA</span>
            <span style={{ color: C.indigo, fontWeight: 700, fontSize: 32 }}> Digital</span>
            <span style={{ color: C.cian, fontWeight: 700, fontSize: 28 }}>✦</span>
          </div>
          <p style={{ color: C.indigo, fontSize: 15, margin: 0, letterSpacing: '0.08em', fontWeight: 500 }}>
            Planea. Conecta. Transforma.
          </p>
        </div>

        <form onSubmit={handleLogin} noValidate style={{ background: 'white', borderRadius: 16, border: `1px solid ${C.borde}`, padding: '28px 24px', boxShadow: '0 4px 24px rgba(61,58,140,0.08)' }}>
          <h1 style={{ color: C.indigo, margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>
            Iniciar sesión
          </h1>
          <p style={{ color: C.gris, fontSize: 14, margin: '0 0 24px' }}>
            Entra a tus planeaciones didácticas.
          </p>

          {aviso && !error && (
            <p role="status" style={{ background: C.indigoClaro, borderLeft: `3px solid ${C.indigo}`, color: C.texto, borderRadius: 8, padding: '10px 14px', fontSize: 14, margin: '0 0 18px', lineHeight: 1.5 }}>
              {aviso}
            </p>
          )}

          <label htmlFor="login-email" style={estiloEtiqueta}>Correo electrónico</label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="tu@correo.com"
            value={email}
            onChange={e => { setEmail(e.target.value); if (error) setError('') }}
            style={{ ...estiloCampo, marginBottom: 18 }}
          />

          <label htmlFor="login-password" style={estiloEtiqueta}>Contraseña</label>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              id="login-password"
              type={verPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); if (error) setError('') }}
              style={{ ...estiloCampo, paddingRight: 76 }}
            />
            <button
              type="button"
              onClick={() => setVerPassword(v => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={{ position: 'absolute', right: 6, top: 6, height: 36, padding: '0 10px', borderRadius: 8, border: 'none', background: C.indigoClaro, color: C.indigo, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {verPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
          <p style={{ textAlign: 'right', margin: '0 0 20px' }}>
            <a href="/auth/recuperar" style={{ color: C.indigo, fontSize: 14, fontWeight: 600, textDecoration: 'underline' }}>
              ¿Olvidaste tu contraseña?
            </a>
          </p>

          {error && (
            <p role="alert" style={{ background: C.indigoClaro, borderLeft: `3px solid ${C.indigo}`, color: C.texto, borderRadius: 8, padding: '10px 14px', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ display: 'block', width: '100%', height: 50, fontSize: 16, fontWeight: 700, color: 'white', background: C.indigo, opacity: loading ? 0.65 : 1, border: 'none', borderRadius: 12, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, marginBottom: 0, fontSize: 14, color: C.gris }}>
            ¿No tienes cuenta?{' '}
            <a href="/auth/register" style={{ color: C.indigo, fontWeight: 700, textDecoration: 'underline' }}>
              Regístrate aquí
            </a>
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: C.gris }}>
          PlanIA Digital no es una entidad afiliada ni respaldada por la SEP.
        </p>
      </div>
    </div>
  )
}
