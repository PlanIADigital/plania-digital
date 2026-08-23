'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const supabase = createClient()

const LEGAL_VERSION = '2026-08-v1'

const ROLES = [
  { value: 'educadora', label: 'Educadora', activo: true },
  { value: 'educador', label: 'Educador', activo: true },
  { value: 'maestra_musica', label: 'Maestra de música', activo: false },
  { value: 'maestro_musica', label: 'Maestro de música', activo: false },
  { value: 'directivo', label: 'Directivo', activo: false },
]

const ROLES_ACTIVOS = ROLES.filter(r => r.activo)

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister() {
    if (!fullName || !email || !whatsapp || !password || !role) { setError('Completa todos los campos, incluyendo tu rol'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (!aceptaTerminos || !aceptaPrivacidad) { setError('Debes aceptar los Términos y el Aviso de Privacidad para continuar'); return }
    setLoading(true)
    setError('')
    const ahora = new Date().toISOString()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          whatsapp,
          terminos_aceptados_en: ahora,
          privacidad_aceptada_en: ahora,
          legal_version: LEGAL_VERSION,
        },
        emailRedirectTo: `${window.location.origin}/onboarding`
      }
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/auth/confirmar-correo')
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
          <label style={labelStyle}>WhatsApp</label>
          <input
            placeholder="10 dígitos, ej. 8112345678"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
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
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box' as const, marginBottom: 24, outline: 'none', fontFamily: 'sans-serif', background: 'white', color: role ? '#1A1A2E' : '#888', cursor: 'pointer' }}
          >
            <option value="" disabled>Selecciona tu rol...</option>
            {ROLES_ACTIVOS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={e => setAceptaTerminos(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
              He leído y acepto los{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: '#3D3A8C', fontWeight: 600 }}>
                Términos y Condiciones
              </a>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={aceptaPrivacidad}
              onChange={e => setAceptaPrivacidad(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
              He leído y acepto el{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#3D3A8C', fontWeight: 600 }}>
                Aviso de Privacidad
              </a>
            </span>
          </label>

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