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
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

  async function handleSave() {
    if (!form.cct || form.cct.length !== 10) {
      setError('El CCT debe tener exactamente 10 caracteres')
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
    profile_completed: true
  })
  .eq('auth_uid', session.user.id)

    if (err) { setError(err.message); setLoading(false); return }
    router.push('/dashboard')
  }

  const inputStyle = {
    display: 'block', width: '100%', marginBottom: 16,
    padding: '10px 12px', fontSize: 16, borderRadius: 6,
    border: '1px solid #ddd', boxSizing: 'border-box' as const
  }
  const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 500, color: '#1A1A2E' }

  return (
    <div style={{ minHeight: '100vh', background: '#E8F5F2', fontFamily: 'sans-serif' }}>
      <nav style={{ background: '#3D3A8C', padding: '16px 32px' }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: 20 }}>PlanIA Digital</h1>
      </nav>
      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: '#3D3A8C', marginTop: 0 }}>Completa tu perfil</h2>
          <p style={{ color: '#666', marginBottom: 24 }}>
            Esta información permite que tus planeaciones reflejen el contexto real de tu grupo.
          </p>

          <label style={labelStyle}>Clave del Centro de Trabajo (CCT)</label>
          <input
            placeholder="Ej: 19DJN0293I"
            value={form.cct}
            onChange={e => update('cct', e.target.value.toUpperCase())}
            maxLength={10}
            style={inputStyle}
          />

          <label style={labelStyle}>Grado que atiendes</label>
          <select value={form.grado} onChange={e => update('grado', e.target.value)} style={inputStyle}>
            {GRADOS.map(g => <option key={g} value={g}>{g} Preescolar</option>)}
          </select>

          <label style={labelStyle}>Turno</label>
          <select value={form.turno} onChange={e => update('turno', e.target.value)} style={inputStyle}>
            {TURNOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>

          <label style={labelStyle}>Número de alumnos</label>
          <input
            placeholder="Ej: 24"
            value={form.total_alumnos}
            onChange={e => update('total_alumnos', e.target.value)}
            type="number"
            min="1"
            max="50"
            style={inputStyle}
          />

          <label style={labelStyle}>Contexto del grupo <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <textarea
            placeholder="Describe brevemente el contexto de tu grupo: nivel socioeconómico, zona escolar, características relevantes..."
            value={form.contexto_grupo}
            onChange={e => update('contexto_grupo', e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          {error && <p style={{ color: 'red', fontSize: 14, marginBottom: 16 }}>{error}</p>}

          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              background: '#00A896', color: 'white', border: 'none',
              padding: '12px 24px', fontSize: 16, cursor: 'pointer',
              width: '100%', borderRadius: 6, fontWeight: 500
            }}>
            {loading ? 'Guardando...' : 'Guardar y continuar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
