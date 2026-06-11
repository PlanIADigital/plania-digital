'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const GRADOS = [
  { value: '1er Grado', label: '1er Grado' },
  { value: '2do Grado', label: '2do Grado' },
  { value: '3er Grado', label: '3er Grado' },
]
const TURNOS = ['matutino', 'vespertino', 'discontinuo']

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cctInfo, setCctInfo] = useState<{ estado: string; sostenimiento: string; nivel: string; valido: boolean; nombre?: string; error?: string } | null>(null)
  const [cctLoading, setCctLoading] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [form, setForm] = useState({
    cct: '',
    grado: '',
    turno: '',
  })

  useEffect(() => {
    async function loadRole() {
      let session = null
      for (let i = 0; i < 5; i++) {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (s) { session = s; break }
        await new Promise(r => setTimeout(r, 800))
      }
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('role').eq('auth_uid', session.user.id).single()
      if (data?.role) setUserRole(data.role)
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
    if (val.length === 10) {
      setCctLoading(true)
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
    if (userRole !== 'directivo' && !form.grado) {
      setError('Selecciona el grado que atiendes')
      return
    }
    if (!form.turno) {
      setError('Selecciona el turno')
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
        grado: form.grado,
        profile_completed: true,
        estado: cctInfo?.estado || null,
        sostenimiento: cctInfo?.sostenimiento || null,
        nivel_educativo: cctInfo?.nivel || null,
        school_name: cctInfo?.nombre || null,
        total_alumnos: null,
        contexto_grupo: null,
      })
      .eq('auth_uid', session.user.id)
    if (err) { setError(err.message); setLoading(false); return }
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
              Completa tu perfil
            </h2>
            <p style={{ color: '#888', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {userRole === 'directivo'
                ? 'Esta información vincula tu cuenta con el jardín de niños que diriges.'
                : 'Esta información permite que tus planeaciones reflejen el contexto real de tu grupo.'}
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

          {/* Grado y Turno en la misma fila — solo educadores */}
          {userRole !== 'directivo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
              <div>
                <label style={labelStyle}>Grado que atiendes</label>
                <select
                  value={form.grado}
                  onChange={e => update('grado', e.target.value)}
                  style={selectStyle}
                >
                  <option value="" disabled>— Selecciona —</option>
                  {GRADOS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Turno que atiendes</label>
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
              </div>
            </div>
          )}

          {/* Turno solo — para directivo */}
          {userRole === 'directivo' && (
            <>
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
            </>
          )}

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