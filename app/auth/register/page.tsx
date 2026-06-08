'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ROLES = [
  { value: 'educadora', label: 'Educadora', activo: true },
  { value: 'educador', label: 'Educador', activo: true },
  { value: 'maestra_musica', label: 'Maestra de música', activo: false },
  { value: 'maestro_musica', label: 'Maestro de música', activo: false },
  { value: 'directivo', label: 'Directivo', activo: false },
]

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister() {
    if (!fullName || !email || !password || !role) { setError('Completa todos los campos, incluyendo tu rol'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } }
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/onboarding')
  }

  const inputStyle = {
    display: 'block', width: '100%', padding: '11px 14px', fontSize: 14,
    borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box' as const,
    marginBottom: 18, outline: 'none', fontFamily: 'sans-serif'
  }

  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 600 as const,
    color: '#1A1A2E', marginBottom: 6
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
            Crear cuenta
          </h2>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 28px' }}>
            7 días gratis · Sin tarjeta de crédito
          </p>

          <label style={labelStyle}>Nombre completo</label>
          <input
            placeholder="Como aparecerá en tus planeaciones"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Correo electrónico</label>
          <input
            placeholder="tu@correo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Contraseña</label>
          <input
            placeholder="Mínimo 6 caracteres"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            style={inputStyle}
          />

          <label style={labelStyle}>Soy...</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 24 }}>
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => r.activo && setRole(r.value)}
                disabled={!r.activo}
                style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: r.activo ? 'pointer' : 'default', textAlign: 'left',
                  border: role === r.value ? '2px solid #3D3A8C' : '1.5px solid #D8D6F0',
                  background: !r.activo ? '#F9F9F9' : role === r.value ? '#EEEDF8' : 'white',
                  color: !r.activo ? '#BBBBBB' : role === r.value ? '#3D3A8C' : '#555',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{role === r.value ? '✓ ' : ''}{r.label}</span>
                {!r.activo && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#BBBBBB', background: '#EFEFEF', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em' }}>
                    PRÓXIMAMENTE
                  </span>
                )}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={loading}
            style={{ background: loading ? '#9b99c4' : '#00A896', color: 'white', border: 'none', padding: '13px 24px', fontSize: 15, cursor: loading ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta gratis →'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
            ¿Ya tienes cuenta?{' '}
            <a href="/auth/login" style={{ color: '#3D3A8C', fontWeight: 600, textDecoration: 'none' }}>
              Inicia sesión
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