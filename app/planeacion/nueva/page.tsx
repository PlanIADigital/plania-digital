'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const CAMPOS = [
  'Lenguajes',
  'Saberes y Pensamiento Científico',
  'Ética, Naturaleza y Sociedades',
  'De lo Humano y lo Comunitario',
]

const DURACIONES = [
  { label: '2 semanas (10 días hábiles)', dias: 14 },
  { label: '3 semanas (15 días hábiles)', dias: 21 },
  { label: '4 semanas (20 días hábiles)', dias: 28 },
]

function calcFechaFin(inicio: string, dias: number): string {
  if (!inicio) return ''
  const d = new Date(inicio + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

export default function NuevaPlaneacionPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')

  // Catálogo PDA
  const [contenidos, setContenidos] = useState<any[]>([])
  const [pdaSugerido, setPdaSugerido] = useState('')
  const [mostrarNivelesAvanzados, setMostrarNivelesAvanzados] = useState(false)
  const [nivelesAvanzados, setNivelesAvanzados] = useState<{grado: string, pda: string}[]>([])
  const [gradoPdaElegido, setGradoPdaElegido] = useState('')

  const [form, setForm] = useState({
    nombre_proyecto: '',
    situacion_problema: '',
    finalidad: '',
    campo_formativo: '',
    contenido: '',
    pda_principal: '',
    duracion_dias: 14,
    fecha_inicio: '',
    fecha_fin: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('users').select('*')
        .eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
    }
    load()
  }, [])

  // Cargar contenidos cuando cambia el campo formativo
  useEffect(() => {
    if (!form.campo_formativo) { setContenidos([]); return }
    async function loadContenidos() {
      const { data } = await supabase
        .from('pda_catalog')
        .select('contenido')
        .eq('campo', form.campo_formativo)
        .eq('grado', '2°') // traemos los del grado 2° para obtener lista única de contenidos
        .order('contenido')
      // Deduplicar contenidos
      const unicos = [...new Set((data || []).map((r: any) => r.contenido))]
      setContenidos(unicos)
      setForm(prev => ({ ...prev, contenido: '', pda_principal: '' }))
      setPdaSugerido('')
      setMostrarNivelesAvanzados(false)
      setNivelesAvanzados([])
    }
    loadContenidos()
  }, [form.campo_formativo])

  // Cargar PDA sugerido cuando cambia el contenido
  useEffect(() => {
    if (!form.contenido || !profile) return
    const gradoGrupo = profile.grado || '2°'
    async function loadPda() {
      // PDA del grado del grupo
      const { data: sugerido } = await supabase
        .from('pda_catalog')
        .select('pda, grado')
        .eq('campo', form.campo_formativo)
        .eq('contenido', form.contenido)
        .eq('grado', gradoGrupo)
        .single()

      if (sugerido) {
        setPdaSugerido(sugerido.pda)
        setGradoPdaElegido(gradoGrupo)
        setForm(prev => ({ ...prev, pda_principal: sugerido.pda }))
      }

      // Cargar niveles avanzados (grados superiores al del grupo)
      const gradosOrden = ['1°', '2°', '3°']
      const idxActual = gradosOrden.indexOf(gradoGrupo)
      const gradosSuperiores = gradosOrden.slice(idxActual + 1)

      if (gradosSuperiores.length > 0) {
        const { data: avanzados } = await supabase
          .from('pda_catalog')
          .select('grado, pda')
          .eq('campo', form.campo_formativo)
          .eq('contenido', form.contenido)
          .in('grado', gradosSuperiores)
          .order('grado')
        setNivelesAvanzados(avanzados || [])
      } else {
        setNivelesAvanzados([])
      }

      setMostrarNivelesAvanzados(false)
    }
    loadPda()
  }, [form.contenido, profile])

  // Calcular fecha fin automáticamente
  useEffect(() => {
    if (form.fecha_inicio) {
      setForm(prev => ({
        ...prev,
        fecha_fin: calcFechaFin(form.fecha_inicio, prev.duracion_dias)
      }))
    }
  }, [form.fecha_inicio, form.duracion_dias])

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function elegirPdaAvanzado(grado: string, pda: string) {
    setGradoPdaElegido(grado)
    setForm(prev => ({ ...prev, pda_principal: pda }))
    setMostrarNivelesAvanzados(false)
  }

  function regresarPdaSugerido() {
    const gradoGrupo = profile?.grado || '2°'
    setGradoPdaElegido(gradoGrupo)
    setForm(prev => ({ ...prev, pda_principal: pdaSugerido }))
    setMostrarNivelesAvanzados(false)
  }

  async function handleGenerar() {
    if (!form.nombre_proyecto || !form.situacion_problema || !form.finalidad || !form.pda_principal) {
      alert('Completa todos los campos obligatorios')
      return
    }
    setGenerating(true)
    setResult('')
    try {
      const res = await fetch('/api/generar-planeacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form: {
            ...form,
            grado_pda: gradoPdaElegido,
            grado_grupo: profile?.grado || '2°',
          },
          profile
        })
      })
      const data = await res.json()
      setResult(data.content || data.error || 'Error al generar')
    } catch (e) {
      setResult('Error de conexión')
    }
    setGenerating(false)
  }

  const gradoGrupo = profile?.grado || '2°'
  const esNivelAvanzado = gradoPdaElegido && gradoPdaElegido !== gradoGrupo

  // Estilos
  const s = {
    label: { display: 'block', marginBottom: 6, fontWeight: 600, color: '#1A1A2E', fontSize: 14 } as React.CSSProperties,
    input: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8,
      border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 20, outline: 'none',
      fontFamily: 'sans-serif' } as React.CSSProperties,
    select: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8,
      border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 20, background: 'white',
      cursor: 'pointer', fontFamily: 'sans-serif' } as React.CSSProperties,
    textarea: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8,
      border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 20, resize: 'vertical',
      fontFamily: 'sans-serif' } as React.CSSProperties,
    section: { marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EFF8' } as React.CSSProperties,
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase',
      letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 } as React.CSSProperties,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E8F5F2', fontFamily: 'sans-serif' }}>
      {/* Nav */}
      <nav style={{ background: '#3D3A8C', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: 20, fontWeight: 600 }}>PlanIA Digital</h1>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)',
            padding: '8px 16px', cursor: 'pointer', borderRadius: 6, fontSize: 14 }}>
          ← Dashboard
        </button>
      </nav>

      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ background: 'white', borderRadius: 14, padding: 36, boxShadow: '0 2px 12px rgba(61,58,140,0.08)', marginBottom: 24 }}>

          {/* Header */}
          <h2 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 22, fontWeight: 700 }}>
            Nueva planeación
          </h2>
          {profile && (
            <p style={{ color: '#888', fontSize: 13, marginBottom: 28, marginTop: 0 }}>
              {profile.cct_primary} · Turno {profile.shift_primary}
              {profile.grado && ` · ${profile.grado} grado`}
            </p>
          )}

          {/* SECCIÓN 1 — Proyecto */}
          <div style={s.section}>
            <p style={s.sectionTitle}>1 · Datos del proyecto</p>

            <label style={s.label}>Nombre del proyecto *</label>
            <input placeholder="Ej: El agua en nuestra vida"
              value={form.nombre_proyecto}
              onChange={e => update('nombre_proyecto', e.target.value)}
              style={s.input} />

            <label style={s.label}>Situación problema *</label>
            <textarea placeholder="¿Qué situación del entorno motivó este proyecto?"
              value={form.situacion_problema}
              onChange={e => update('situacion_problema', e.target.value)}
              rows={3} style={s.textarea} />

            <label style={s.label}>Finalidad *</label>
            <textarea placeholder="¿Qué lograrán los alumnos al concluir este proyecto?"
              value={form.finalidad}
              onChange={e => update('finalidad', e.target.value)}
              rows={3} style={s.textarea} />
          </div>

          {/* SECCIÓN 2 — PDA */}
          <div style={s.section}>
            <p style={s.sectionTitle}>2 · Campo formativo y PDA</p>

            <label style={s.label}>Campo formativo *</label>
            <select value={form.campo_formativo}
              onChange={e => update('campo_formativo', e.target.value)}
              style={s.select}>
              <option value="">— Selecciona un campo —</option>
              {CAMPOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {form.campo_formativo && (
              <>
                <label style={s.label}>Contenido *</label>
                {contenidos.length === 0 ? (
                  <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>Cargando contenidos...</p>
                ) : (
                  <select value={form.contenido}
                    onChange={e => update('contenido', e.target.value)}
                    style={s.select}>
                    <option value="">— Selecciona un contenido —</option>
                    {contenidos.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </>
            )}

            {/* PDA sugerido */}
            {pdaSugerido && form.contenido && (
              <div>
                <label style={s.label}>
                  PDA sugerido para {gradoGrupo} *
                  {esNivelAvanzado && (
                    <span style={{ marginLeft: 8, background: '#00A896', color: 'white',
                      fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                      Nivel avanzado {gradoPdaElegido}
                    </span>
                  )}
                </label>

                {/* Caja PDA activo */}
                <div style={{ background: esNivelAvanzado ? '#E0F5F3' : '#EEEDF8',
                  border: `1.5px solid ${esNivelAvanzado ? '#00A896' : '#3D3A8C'}`,
                  borderRadius: 8, padding: '12px 14px', marginBottom: 12,
                  fontSize: 14, lineHeight: 1.6, color: '#1A1A2E' }}>
                  {form.pda_principal}
                </div>

                {/* Botón editar manualmente */}
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 13, color: '#3D3A8C', cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>
                    ✏️ Editar el PDA manualmente
                  </summary>
                  <textarea
                    value={form.pda_principal}
                    onChange={e => update('pda_principal', e.target.value)}
                    rows={4}
                    style={{ ...s.textarea, marginTop: 8, marginBottom: 8, background: '#FAFAFA' }} />
                </details>

                {/* Progressive disclosure — niveles avanzados */}
                {nivelesAvanzados.length > 0 && !esNivelAvanzado && (
                  <button
                    onClick={() => setMostrarNivelesAvanzados(!mostrarNivelesAvanzados)}
                    style={{ background: 'none', border: 'none', color: '#00A896', fontSize: 13,
                      cursor: 'pointer', padding: 0, textDecoration: 'underline', marginBottom: 12 }}>
                    {mostrarNivelesAvanzados ? '▲ Ocultar niveles avanzados' : '¿Tu grupo ya superó este aprendizaje? Ver niveles avanzados ▼'}
                  </button>
                )}

                {esNivelAvanzado && (
                  <button
                    onClick={regresarPdaSugerido}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: 13,
                      cursor: 'pointer', padding: 0, textDecoration: 'underline', marginBottom: 12, display: 'block' }}>
                    ← Regresar al PDA de {gradoGrupo}
                  </button>
                )}

                {/* Panel de niveles avanzados */}
                {mostrarNivelesAvanzados && nivelesAvanzados.length > 0 && (
                  <div style={{ background: '#F8F8FE', border: '1px solid #D8D6F0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: '#666', marginTop: 0, marginBottom: 12 }}>
                      Estos PDAs tienen mayor nivel de exigencia. Elige el que mejor corresponda al avance de tu grupo:
                    </p>
                    {nivelesAvanzados.map(n => (
                      <div key={n.grado} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#3D3A8C' }}>
                            Nivel {n.grado}
                          </span>
                          <button
                            onClick={() => elegirPdaAvanzado(n.grado, n.pda)}
                            style={{ background: '#3D3A8C', color: 'white', border: 'none',
                              borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>
                            Elegir este
                          </button>
                        </div>
                        <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5, margin: 0,
                          background: 'white', padding: '8px 10px', borderRadius: 6,
                          border: '1px solid #E8E8F0' }}>
                          {n.pda}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN 3 — Duración y fechas */}
          <div style={{ marginBottom: 28 }}>
            <p style={s.sectionTitle}>3 · Duración del proyecto</p>

            <label style={s.label}>¿Cuánto durará el proyecto? *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {DURACIONES.map(d => (
                <button key={d.dias}
                  onClick={() => update('duracion_dias', d.dias)}
                  style={{
                    padding: '12px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', textAlign: 'center', lineHeight: 1.3,
                    border: form.duracion_dias === d.dias ? '2px solid #3D3A8C' : '1.5px solid #D8D6F0',
                    background: form.duracion_dias === d.dias ? '#EEEDF8' : 'white',
                    color: form.duracion_dias === d.dias ? '#3D3A8C' : '#555',
                  }}>
                  {d.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={s.label}>Fecha de inicio *</label>
                <input type="date" value={form.fecha_inicio}
                  onChange={e => update('fecha_inicio', e.target.value)}
                  style={s.input} />
              </div>
              <div>
                <label style={{ ...s.label, color: '#888' }}>Fecha fin (calculada)</label>
                <input type="date" value={form.fecha_fin} readOnly
                  style={{ ...s.input, background: '#F5F5F5', color: '#888', cursor: 'default' }} />
              </div>
            </div>
          </div>

          {/* Botón generar */}
          <button onClick={handleGenerar} disabled={generating}
            style={{ background: generating ? '#ccc' : '#00A896', color: 'white', border: 'none',
              padding: '15px 24px', fontSize: 16, cursor: generating ? 'not-allowed' : 'pointer',
              width: '100%', borderRadius: 8, fontWeight: 600, letterSpacing: '0.01em' }}>
            {generating ? '✨ Generando tu planeación...' : '✨ Generar planeación con IA'}
          </button>

          {/* Nota nivel avanzado */}
          {esNivelAvanzado && (
            <p style={{ fontSize: 12, color: '#00A896', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
              ℹ️ Se registrará que tu grupo de {gradoGrupo} trabajó un PDA de nivel {gradoPdaElegido}
            </p>
          )}
        </div>

        {/* Resultado */}
        {result && (
          <div style={{ background: 'white', borderRadius: 14, padding: 32, boxShadow: '0 2px 12px rgba(61,58,140,0.08)' }}>
            <h3 style={{ color: '#3D3A8C', marginTop: 0 }}>Planeación generada</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: '#1A1A2E' }}>{result}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
