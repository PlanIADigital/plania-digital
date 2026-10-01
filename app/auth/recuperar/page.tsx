'use client'
// ============================================================
//  PlanIA Digital — app/auth/recuperar/page.tsx
//  [30 sep 2026] Recuperación de contraseña, paso 1: la educadora
//  escribe su correo y Supabase le envía un enlace de un solo uso.
//  Por seguridad, el mensaje es el mismo exista o no la cuenta
//  (no se revela quién está registrado).
// ============================================================
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

const C = { indigo: '#3D3A8C', cian: '#00A896', menta: '#E8F5F2', indigoClaro: '#EEEDF8', texto: '#1A1A2E', gris: '#6B7280', borde: '#D8D6F0' }

function Marca() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ color: C.cian, fontWeight: 700, fontSize: 28 }}>✦</span>
        <span style={{ color: C.indigo, fontWeight: 700, fontSize: 32 }}>Plan</span>
        <span style={{ color: C.cian, fontWeight: 900, fontSize: 32 }}>IA</span>
        <span style={{ color: C.indigo, fontWeight: 700, fontSize: 32 }}> Digital</span>
        <span style={{ color: C.cian, fontWeight: 700, fontSize: 28 }}>✦</span>
      </div>
      <p style={{ color: C.indigo, fontSize: 15, margin: 0, letterSpacing: '0.08em', fontWeight: 500 }}>Planea. Conecta. Transforma.</p>
    </div>
  )
}

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function enviar() {
    const correo = email.trim().toLowerCase()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { setError('Escribe un correo electrónico válido.'); return }
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/auth/nueva-contrasena`,
    })
    setEnviando(false)
    // Solo se informa el límite de envíos; cualquier otro resultado muestra
    // el mismo mensaje, para no revelar si la cuenta existe.
    if (error && (error.status === 429 || /rate|seconds/i.test(error.message))) {
      setError('Ya pediste un enlace hace un momento. Espera un minuto e inténtalo de nuevo.')
      return
    }
    setEnviado(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.menta, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Marca />
        <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(61,58,140,0.10)' }}>
          {enviado ? (
            <>
              <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>📬</div>
              <h2 style={{ color: C.texto, margin: '0 0 10px', fontSize: 20, fontWeight: 700, textAlign: 'center' }}>Revisa tu correo</h2>
              <p style={{ color: '#444', fontSize: 14, lineHeight: 1.7, margin: '0 0 16px', textAlign: 'center' }}>
                Si hay una cuenta registrada con <strong>{email.trim().toLowerCase()}</strong>, te enviamos un enlace para crear una nueva contraseña. El enlace vence en 1 hora.
              </p>
              <p style={{ background: C.indigoClaro, color: C.indigo, borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
                💡 Si no lo ves en unos minutos, revisa tu carpeta de <strong>spam o correo no deseado</strong>.
              </p>
              <a href="/auth/login" style={{ display: 'block', textAlign: 'center', background: C.indigo, color: 'white', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                Volver al inicio de sesión
              </a>
            </>
          ) : (
            <>
              <h2 style={{ color: C.texto, margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>Recuperar contraseña</h2>
              <p style={{ color: C.gris, fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
                Escribe el correo con el que te registraste y te enviaremos un enlace para crear una nueva contraseña.
              </p>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.texto, marginBottom: 6 }}>Correo electrónico</label>
              <input
                type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !enviando && enviar()}
                style={{ display: 'block', width: '100%', padding: '11px 14px', fontSize: 16, borderRadius: 8, border: `1.5px solid ${C.borde}`, boxSizing: 'border-box', marginBottom: 20, outline: 'none', fontFamily: 'sans-serif' }}
              />
              {error && <p style={{ background: C.indigoClaro, color: C.indigo, borderRadius: 8, padding: '10px 14px', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>{error}</p>}
              <button
                onClick={enviar}
                disabled={enviando}
                style={{ display: 'block', width: '100%', padding: 13, fontSize: 15, fontWeight: 700, color: 'white', background: enviando ? '#9CA3AF' : C.indigo, border: 'none', borderRadius: 10, cursor: enviando ? 'default' : 'pointer', fontFamily: 'sans-serif' }}
              >
                {enviando ? 'Enviando…' : 'Enviar enlace'}
              </button>
              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
                <a href="/auth/login" style={{ color: C.indigo, fontWeight: 600, textDecoration: 'none' }}>← Volver al inicio de sesión</a>
              </p>
            </>
          )}
        </div>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#9CA3AF' }}>
          PlanIA Digital no es una entidad afiliada ni respaldada por la SEP.
        </p>
      </div>
    </div>
  )
}
