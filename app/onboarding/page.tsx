'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const supabase = createClient()

const TURNOS = ['matutino', 'vespertino', 'discontinuo']

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [error, setError] = useState('')
  const [cctInfo, setCctInfo] = useState<{ estado: string; sostenimiento: string; nivel: string; valido: boolean; nombre?: string; error?: string } | null>(null)
  const [cctLoading, setCctLoading] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [form, setForm] = useState({
    cct: '',
    turno: '',
    zona: '',
    sector: '',
    region: '',
  })

  // Sugerencias de Zona/Sector/Región desde el catálogo oficial SEP o el
  // consenso comunitario -- se piden en paralelo a decodificar-cct, no lo
  // reemplazan (decodificar-cct sigue siendo la fuente de estado/nombre/
  // sostenimiento, que alimentan el calendario escolar y otras funciones).
  const [cctLookup, setCctLookup] = useState<any>(null)
  const [cctLookupLoading, setCctLookupLoading] = useState(false)

  useEffect(() => {
    async function loadRole() {
      let session = null
      for (let i = 0; i < 5; i++) {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (s) { session = s; break }
        await new Promise(r => setTimeout(r, 800))
      }
            if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('role, profile_completed').eq('auth_uid', session.user.id).single()
      if (data?.profile_completed) {
        router.push(data.role === 'directivo' ? '/directivo/dashboard' : '/dashboard')
        return
      }
      if (data?.role) setUserRole(data.role)
      setVerificando(false)
    }
    loadRole()
  }, [])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleCCTChange(value: string) {
    const val = value.toUpperCase()
    update('cct', val)
    setCctInfo(null)
    setCctLookup(null)
    if (val.length === 10) {
      setCctLoading(true)
      setCctLookupLoading(true)
      try {
        const res = await fetch('/api/decodificar-cct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cct: val })
        })
        const data = await res.json()
        setCctInfo(data)
      } catch {
        setCctInfo({ estado: '', sostenimiento: '', nivel: '', valido: false, error: 'No se pudo verificar el CCT' })
      } finally {
        setCctLoading(false)
      }

      try {
        const resLookup = await fetch(`/api/cct-lookup?cv_cct=${val}`)
        const dataLookup = await resLookup.json()
        if (dataLookup.encontrado) {
          setCctLookup(dataLookup)
          setForm(prev => ({
            ...prev,
            zona: dataLookup.campos.zona.valor || '',
            sector: dataLookup.campos.sector.valor || '',
            region: dataLookup.campos.region.valor || '',
            turno: prev.turno || (dataLookup.turno?.valor ? dataLookup.turno.valor.toLowerCase() : ''),
          }))
        }
      } catch {
        // silencioso -- si falla, Zona/Sector/Región simplemente se quedan
        // vacías y editables, la educadora las captura a mano
      } finally {
        setCctLookupLoading(false)
      }
    }
  }

  async function handleSave() {
    if (!form.cct || form.cct.length !== 10) {
      setError('El CCT debe tener exactamente 10 caracteres')
      return
    }
    if (cctInfo && !cctInfo.valido) {
      setError('El CCT ingresado no es válido. Verifica e intenta de nuevo.')
      return
    }
    if (!form.turno) {
      setError('Selecciona el turno')
      return
    }
    if (!form.zona.trim() || !form.sector.trim() || !form.region.trim()) {
      setError('Completa Zona, Sector y Región (escribe "No aplica" si tu jardín no tiene Sector asignado)')
      return
    }
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    const { error: err } = await supabase
      .from('users')
      .update({
        cct_primary: form.cct.toUpperCase(),
        shift_primary: form.turno,
        profile_completed: true,
        estado: cctInfo?.estado || null,
        sostenimiento: cctInfo?.sostenimiento || null,
        nivel_educativo: cctInfo?.nivel || null,
        school_name: cctInfo?.nombre || null,
      })
      .eq('auth_uid', session.user.id)
    if (err) { setError(err.message); setLoading(false); return }

    // Guarda Zona/Sector/Región/Turno en el consenso comunitario -- mismo
    // mecanismo que usa Mi Grupo, para que desde el primer registro se
    // alimente el catálogo compartido.
    try {
      const campos: { campo: 'zona' | 'sector' | 'region' | 'turno'; valor: string }[] = [
        { campo: 'zona', valor: form.zona },
        { campo: 'sector', valor: form.sector },
        { campo: 'region', valor: form.region },
        { campo: 'turno', valor: form.turno },
      ]
      for (const { campo, valor } of campos) {
        await fetch('/api/cct-confirmar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ cv_cct: form.cct.toUpperCase(), campo, valor }),
        })
      }
    } catch {
      // silencioso -- si falla el consenso comunitario, el perfil ya se
      // guardó bien (arriba); no bloqueamos el avance de la educadora por esto
    }

    if (userRole === 'directivo') {
      router.push('/directivo/dashboard')
    } else {
      router.push('/dashboard')
    }
  }

  const inputStyle = {
    display: 'block', width: '100%', padding: '11px 14px', fontSize: 14,
    borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box' as const,
    marginBottom: cctInfo ? 8 : 18, outline: 'none', fontFamily: 'sans-serif', background: 'white'
  }

  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 600 as const,
    color: '#1A1A2E', marginBottom: 6
  }

  const selectStyle = {
    display: 'block', width: '100%', padding: '10px 12px', fontSize: 14,
    borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box' as const,
    marginBottom: 18, background: 'white', cursor: 'pointer'
  }

  const inputChicoStyle = {
    display: 'block', width: '100%', padding: '9px 10px', fontSize: 13,
    borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box' as const,
    outline: 'none', fontFamily: 'sans-serif', background: 'white'
  }

    if (verificando) {
    return (
      <div style={{ minHeight: '100vh', background: '#E8F5F2', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#3D3A8C', fontSize: 14 }}>Cargando...</p>
      </div>
    )
  }
  return (
    <div style={{ minHeight: '100vh', background: '#E8F5F2', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

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

          <div style={{ marginBottom: 28 }}>
            <h2 style={{ color: '#1A1A2E', margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>
              Datos institucionales de tu jardín
            </h2>
            <p style={{ color: '#888', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {userRole === 'directivo'
                ? 'Esta información vincula tu cuenta con el jardín de niños que diriges.'
                : 'Esta información identifica el jardín donde laboras. Lo que atiende tu grupo (PDAs, diagnósticos, etc.) se configura después, en Mi Grupo.'}
            </p>
          </div>

          {/* CCT */}
          <label style={labelStyle}>Clave del Centro de Trabajo (CCT)</label>
          <input
            placeholder="Ej: 19DJN0293I"
            value={form.cct}
            onChange={e => handleCCTChange(e.target.value)}
            maxLength={10}
            style={inputStyle}
          />

          {/* Pastilla CCT */}
          {cctLoading && (
            <div style={{ fontSize: 12, color: '#888', marginBottom: 18, paddingLeft: 4 }}>
              Verificando CCT...
            </div>
          )}
          {cctInfo && cctInfo.valido && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 8, padding: '8px 12px', marginBottom: 18 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <span style={{ fontSize: 13, color: '#1A1A2E', fontWeight: 500 }}>
                {cctInfo.nombre ? <strong>{cctInfo.nombre}</strong> : null}{cctInfo.nombre ? ' · ' : ''}{cctInfo.estado} · {cctInfo.sostenimiento}
              </span>
            </div>
          )}
          {cctInfo && !cctInfo.valido && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fee2e2', border: '1.5px solid #f87171', borderRadius: 8, padding: '8px 12px', marginBottom: 18 }}>
              <span style={{ fontSize: 16 }}>❌</span>
              <span style={{ fontSize: 13, color: '#991b1b' }}>
                {cctInfo.error || 'CCT no válido'}
              </span>
            </div>
          )}

          {/* Zona / Sector / Región -- sugeridos por cct-lookup, editables */}
          {form.cct.length === 10 && (
            <div style={{ marginBottom: 18 }}>
              {cctLookupLoading && (
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>Buscando Zona/Sector/Región...</p>
              )}
              {cctLookup && (
                <p style={{ fontSize: 11, color: '#0F6E56', margin: '0 0 8px' }}>
                  📍 Sugerido del catálogo oficial SEP — revisa que sea correcto y corrígelo si hace falta.
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Zona</label>
                  <input value={form.zona} onChange={e => update('zona', e.target.value)} style={inputChicoStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Sector</label>
                  <input value={form.sector} onChange={e => update('sector', e.target.value)} placeholder="o &quot;No aplica&quot;" style={inputChicoStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Región</label>
                  <input value={form.region} onChange={e => update('region', e.target.value)} style={inputChicoStyle} />
                </div>
              </div>
            </div>
          )}

          {/* Turno */}
          <label style={labelStyle}>Turno</label>
          <select
            value={form.turno}
            onChange={e => update('turno', e.target.value)}
            style={selectStyle}
          >
            <option value="" disabled>— Selecciona —</option>
            {TURNOS.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              background: loading ? '#9b99c4' : '#00A896', color: 'white', border: 'none',
              padding: '13px 24px', fontSize: 15, cursor: loading ? 'default' : 'pointer',
              width: '100%', borderRadius: 8, fontWeight: 600
            }}>
            {loading ? 'Guardando...' : 'Guardar y continuar →'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#aaa' }}>
          PlanIA Digital no es una entidad afiliada ni respaldada por la SEP.
        </p>
      </div>
    </div>
  )
}