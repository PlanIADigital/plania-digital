'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const GRADOS = ['1°', '2°', '3°']
const TURNOS = ['matutino', 'vespertino', 'discontinuo']

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cctInfo, setCctInfo] = useState<{ estado: string; sostenimiento: string; nivel: string; valido: boolean; error?: string } | null>(null)
  const [cctLoading, setCctLoading] = useState(false)
  const [form, setForm] = useState({
    cct: '',
    grado: '2°',
    turno: 'matutino',
    total_alumnos: '',
    contexto_grupo: ''
  })

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
        const res = await fetch('/api/decode-cct', {
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
    if (!form.total_alumnos || isNaN(Number(form.total_alumnos))) {
      setError('Ingresa un número válido de alumnos')
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
        total_alumnos: Number(form.total_alumnos),
        contexto_grupo: form.contexto_grupo || null,
      })
      .eq('auth_uid', session.user.id)
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/dashboard')
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
              Esta información permite que tus planeaciones reflejen el contexto real de tu grupo.
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
                {cctInfo.estado} · {cctInfo.sostenimiento} · {cctInfo.nivel}
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

          {/* Grado */}
          <label style={labelStyle}>Grado que atiendes</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
            {GRADOS.map(g => (
              <button key={g} onClick={() => update('grado', g)}
                style={{
                  padding: '10px 8px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', textAlign: 'center',
                  border: form.grado === g ? '2px solid #3D3A8C' : '1.5px solid #D8D6F0',
                  background: form.grado === g ? '#EEEDF8' : 'white',
                  color: form.grado === g ? '#3D3A8C' : '#555',
                }}>
                {g} Preescolar
              </button>
            ))}
          </div>

          {/* Turno */}
          <label style={labelStyle}>Turno</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
            {TURNOS.map(t => (
              <button key={t} onClick={() => update('turno', t)}
                style={{
                  padding: '10px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', textAlign: 'center',
                  border: form.turno === t ? '2px solid #3D3A8C' : '1.5px solid #D8D6F0',
                  background: form.turno === t ? '#EEEDF8' : 'white',
                  color: form.turno === t ? '#3D3A8C' : '#555',
                }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Número de alumnos */}
          <label style={labelStyle}>Número de alumnos</label>
          <input
            placeholder="Ej: 24"
            value={form.total_alumnos}
            onChange={e => update('total_alumnos', e.target.value)}
            type="number"
            min="1"
            max="50"
            style={{ ...inputStyle, marginBottom: 18 }}
          />

          {/* Contexto */}
          <label style={labelStyle}>
            Contexto del grupo{' '}
            <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span>
          </label>
          <textarea
            placeholder="Describe brevemente el contexto de tu grupo: zona escolar, características relevantes..."
            value={form.contexto_grupo}
            onChange={e => update('contexto_grupo', e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' as const, marginBottom: 18 }}
          />

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