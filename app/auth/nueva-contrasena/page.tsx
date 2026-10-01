'use client'
// ============================================================
//  PlanIA Digital — app/auth/nueva-contrasena/page.tsx
//  [30 sep 2026] Recuperación de contraseña, paso 2: el enlace del
//  correo trae un token de un solo uso (token_hash). Se valida aquí
//  con verifyOtp, lo que funciona aunque el correo se abra en otro
//  navegador o dispositivo (p. ej. la app de Gmail en el celular).
//  Respaldo: también acepta el formato ?code= (PKCE) y el de #hash.
//  Al guardar, cierra la sesión y manda al inicio de sesión normal,
//  para que el sistema dirija a cada quien según su rol.
// ============================================================
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

const C = { indigo: '#3D3A8C', cian: '#00A896', menta: '#E8F5F2', indigoClaro: '#EEEDF8', texto: '#1A1A2E', gris: '#6B7280', borde: '#D8D6F0' }

type Estado = 'validando' | 'listo' | 'invalido' | 'guardado'

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

const campo: React.CSSProperties = {
  display: 'block', width: '100%', padding: '11px 14px', fontSize: 16, borderRadius: 8,
  border: `1.5px solid ${C.borde}`, boxSizing: 'border-box', outline: 'none', fontFamily: 'sans-serif',
}

export default function NuevaContrasenaPage() {
  const [estado, setEstado] = useState<Estado>('validando')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    async function validar() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const code = params.get('code')
      try {
        if (tokenHash) {
          await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        }
      } catch { /* se resuelve abajo revisando si hay sesión */ }
      // El token ya se usó: se quita de la barra de direcciones.
      if (tokenHash || code) window.history.replaceState({}, '', '/auth/nueva-contrasena')
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Formato #hash: el cliente lo procesa solo; se le da un momento.
        await new Promise(r => setTimeout(r, 600))
        session = (await supabase.auth.getSession()).data.session
      }
      if (!cancelado) setEstado(session ? 'listo' : 'invalido')
    }
    validar()
    return () => { cancelado = true }
  }, [])

  async function guardar() {
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirmacion) { setError('Las dos contraseñas no coinciden.'); return }
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      const msg = (error as any).code === 'same_password' || /different from the old/i.test(error.message)
        ? 'La nueva contraseña debe ser distinta de la anterior.'
        : (error as any).code === 'weak_password'
          ? 'Esa contraseña es muy débil. Usa al menos 8 caracteres y combina letras y números.'
          : 'No se pudo guardar. Pide un nuevo enlace e inténtalo otra vez.'
      setError(msg)
      setGuardando(false)
      return
    }
    await supabase.auth.signOut()
    setGuardando(false)
    setEstado('guardado')
  }

  const tarjeta: React.CSSProperties = { background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(61,58,140,0.10)' }
  const botonPrincipal: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'center', padding: 13, fontSize: 15, fontWeight: 700, color: 'white', background: C.indigo, border: 'none', borderRadius: 10, cursor: 'pointer', textDecoration: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', background: C.menta, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Marca />
        <div style={tarjeta}>
          {estado === 'validando' && (
            <p style={{ color: C.indigo, fontSize: 14, textAlign: 'center', margin: 0 }}>✦ Validando tu enlace…</p>
          )}

          {estado === 'invalido' && (
            <>
              <h2 style={{ color: C.texto, margin: '0 0 10px', fontSize: 20, fontWeight: 700 }}>Este enlace ya no es válido</h2>
              <p style={{ color: '#444', fontSize: 14, lineHeight: 1.7, margin: '0 0 20px' }}>
                Puede que haya vencido (dura 1 hora) o que ya se haya usado. Pide uno nuevo y ábrelo desde el correo más reciente.
              </p>
              <a href="/auth/recuperar" style={botonPrincipal}>Pedir un nuevo enlace</a>
            </>
          )}

          {estado === 'listo' && (
            <>
              <h2 style={{ color: C.texto, margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>Crea tu nueva contraseña</h2>
              <p style={{ color: C.gris, fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>Usa al menos 8 caracteres. Te recomendamos combinar letras y números.</p>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.texto, marginBottom: 6 }}>Nueva contraseña</label>
              <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...campo, marginBottom: 16 }} />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.texto, marginBottom: 6 }}>Escríbela otra vez</label>
              <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !guardando && guardar()} style={{ ...campo, marginBottom: 10 }} />

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.gris, marginBottom: 20, cursor: 'pointer' }}>
                <input type="checkbox" checked={ver} onChange={e => setVer(e.target.checked)} /> Mostrar contraseña
              </label>

              {error && <p style={{ background: C.indigoClaro, color: C.indigo, borderRadius: 8, padding: '10px 14px', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>{error}</p>}

              <button onClick={guardar} disabled={guardando} style={{ ...botonPrincipal, background: guardando ? '#9CA3AF' : C.indigo, cursor: guardando ? 'default' : 'pointer' }}>
                {guardando ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </>
          )}

          {estado === 'guardado' && (
            <>
              <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>✅</div>
              <h2 style={{ color: C.texto, margin: '0 0 10px', fontSize: 20, fontWeight: 700, textAlign: 'center' }}>Contraseña actualizada</h2>
              <p style={{ color: '#444', fontSize: 14, lineHeight: 1.7, margin: '0 0 20px', textAlign: 'center' }}>
                Ya puedes entrar a PlanIA Digital con tu nueva contraseña.
              </p>
              <a href="/auth/login" style={botonPrincipal}>Iniciar sesión</a>
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
