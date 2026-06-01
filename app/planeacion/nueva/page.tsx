'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CAMPOS = [
  'Lenguajes',
  'Saberes y Pensamiento Científico',
  'Ética, Naturaleza y Sociedades',
  'De lo Humano y lo Comunitario',
]

const DURACIONES = [
  { label: '2 semanas (10 días hábiles)', dias: 15 },
  { label: '3 semanas (15 días hábiles)', dias: 21 },
  { label: '4 semanas (20 días hábiles)', dias: 28 },
]

const PASOS_PROGRESO = [
  { texto: 'Leyendo el contexto de tu grupo...', porcentaje: 10 },
  { texto: 'Identificando el PDA principal...', porcentaje: 25 },
  { texto: 'Construyendo el punto de partida...', porcentaje: 40 },
  { texto: 'Diseñando las actividades del proyecto...', porcentaje: 60 },
  { texto: 'Integrando materiales y preguntas detonadoras...', porcentaje: 75 },
  { texto: 'Redactando el cierre y la reflexión...', porcentaje: 88 },
  { texto: 'Revisando que todo suene a maestra real...', porcentaje: 95 },
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
  const [pasoActual, setPasoActual] = useState(0)
  const [porcentaje, setPorcentaje] = useState(0)
  const [result, setResult] = useState<any>(null)
  const [saveStatus, setSaveStatus] = useState('')

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
    duracion_dias: 15,
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

  useEffect(() => {
    if (!form.campo_formativo) { setContenidos([]); return }
    async function loadContenidos() {
      const { data } = await supabase
        .from('pda_catalog')
        .select('contenido')
        .eq('campo', form.campo_formativo)
        .eq('grado', '2°')
        .order('contenido')
      const unicos = [...new Set((data || []).map((r: any) => r.contenido))]
      setContenidos(unicos)
      setForm(prev => ({ ...prev, contenido: '', pda_principal: '' }))
      setPdaSugerido('')
      setMostrarNivelesAvanzados(false)
      setNivelesAvanzados([])
    }
    loadContenidos()
  }, [form.campo_formativo])

  useEffect(() => {
    if (!form.contenido || !profile) return
    const gradoGrupo = profile.grado || '2°'
    async function loadPda() {
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

  useEffect(() => {
    if (form.fecha_inicio) {
      setForm(prev => ({
        ...prev,
        fecha_fin: calcFechaFin(form.fecha_inicio, prev.duracion_dias)
      }))
    }
  }, [form.fecha_inicio, form.duracion_dias])

  useEffect(() => {
    if (!generating) return
    setPasoActual(0)
    setPorcentaje(0)
    let paso = 0
    const intervalo = setInterval(() => {
      if (paso < PASOS_PROGRESO.length - 1) {
        paso++
        setPasoActual(paso)
        setPorcentaje(PASOS_PROGRESO[paso].porcentaje)
      }
    }, 5000)
    return () => clearInterval(intervalo)
  }, [generating])

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
    setResult(null)
    setSaveStatus('')
    try {
      const res = await fetch('/api/generar-planeacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form: { ...form, grado_pda: gradoPdaElegido, grado_grupo: profile?.grado || '2°' },
          profile
        })
      })
      const data = await res.json()
      if (data.error) { setResult({ error: data.error }); return }
      if (data.planeacion) {
        setPorcentaje(100)
        await new Promise(r => setTimeout(r, 600))
        setResult(data.planeacion)
        const { error: saveError } = await supabase.from('plannings').insert({
          user_id: profile.id,
          project_name: form.nombre_proyecto,
          situacion_problema: form.situacion_problema,
          finalidad: form.finalidad,
          pda_campo: form.campo_formativo,
          pda_contenido: form.contenido,
          pda_literal: form.pda_principal,
          starts_on: form.fecha_inicio || null,
          ends_on: form.fecha_fin || null,
          duration_days: form.duracion_dias,
          grade: profile.grado || '2°',
          content_json: data.planeacion,
          school_year_id: '96cae520-b0ed-4fcb-9c62-a95212ee357e',
          status: 'active'
        })
        setSaveStatus(saveError ? '⚠️ Generada pero no guardada: ' + saveError.message : '✅ Planeación guardada correctamente')
      }
    } catch (e) {
      setResult({ error: 'Error de conexión' })
    }
    setGenerating(false)
  }

  const gradoGrupo = profile?.grado || '2°'
  const esNivelAvanzado = gradoPdaElegido && gradoPdaElegido !== gradoGrupo

  const s = {
    label: { display: 'block', marginBottom: 6, fontWeight: 600, color: '#1A1A2E', fontSize: 14 } as React.CSSProperties,
    input: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 20, outline: 'none', fontFamily: 'sans-serif' } as React.CSSProperties,
    select: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 20, background: 'white', cursor: 'pointer', fontFamily: 'sans-serif' } as React.CSSProperties,
    textarea: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 20, resize: 'vertical', fontFamily: 'sans-serif' } as React.CSSProperties,
    section: { marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EFF8' } as React.CSSProperties,
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 } as React.CSSProperties,
  }

  const momentos = [
    { key: 'momento_1_punto_de_partida', titulo: '1. Punto de partida' },
    { key: 'momento_2_planeacion', titulo: '2. Planeación' },
    { key: 'momento_3_a_trabajar', titulo: '3. ¡A trabajar!' },
    { key: 'momento_4_comunicamos', titulo: '4. Comunicamos' },
    { key: 'momento_5_reflexion', titulo: '5. Reflexión' },
  ]

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 32px' }}>

        {generating && (
          <div style={{ background: 'white', borderRadius: 14, padding: 36, boxShadow: '0 2px 12px rgba(61,58,140,0.08)', marginBottom: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
            <h3 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 6, fontSize: 18 }}>Creando tu planeación</h3>
            {profile && (
              <p style={{ color: '#666', fontSize: 13, marginBottom: 24, marginTop: 0 }}>
                Diseñada específicamente para tus <strong>{profile.total_students || 24} alumnos</strong> de <strong>{profile.grado || '2°'} grado</strong>, turno <strong>{profile.shift_primary || 'matutino'}</strong>
              </p>
            )}
            <div style={{ background: '#EEEDF8', borderRadius: 99, height: 8, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(90deg, #3D3A8C, #00A896)', height: '100%', borderRadius: 99, width: `${porcentaje}%`, transition: 'width 0.8s ease' }} />
            </div>
            <p style={{ color: '#3D3A8C', fontSize: 14, fontWeight: 500, marginBottom: 0 }}>{PASOS_PROGRESO[pasoActual]?.texto}</p>
            <p style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>Esto toma entre 30 y 45 segundos</p>
          </div>
        )}

        {!generating && !result && (
          <div style={{ background: 'white', borderRadius: 14, padding: 36, boxShadow: '0 2px 12px rgba(61,58,140,0.08)', marginBottom: 24 }}>
            <h2 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 22, fontWeight: 700 }}>Nueva planeación</h2>
            {profile && (
              <p style={{ color: '#888', fontSize: 13, marginBottom: 28, marginTop: 0 }}>
                {profile.cct_primary} · Turno {profile.shift_primary}{profile.grado && ` · ${profile.grado} grado`}
              </p>
            )}

            <div style={s.section}>
              <p style={s.sectionTitle}>1 · Datos del proyecto</p>
              <label style={s.label}>Nombre del proyecto *</label>
              <input placeholder="Ej: El agua en nuestra vida" value={form.nombre_proyecto} onChange={e => update('nombre_proyecto', e.target.value)} style={s.input} />
              <label style={s.label}>Situación problema *</label>
              <textarea placeholder="¿Qué situación del entorno motivó este proyecto?" value={form.situacion_problema} onChange={e => update('situacion_problema', e.target.value)} rows={3} style={s.textarea} />
              <label style={s.label}>Finalidad *</label>
              <textarea placeholder="¿Qué lograrán los alumnos al concluir este proyecto?" value={form.finalidad} onChange={e => update('finalidad', e.target.value)} rows={3} style={s.textarea} />
            </div>

            <div style={s.section}>
              <p style={s.sectionTitle}>2 · Campo formativo y PDA</p>
              <label style={s.label}>Campo formativo *</label>
              <select value={form.campo_formativo} onChange={e => update('campo_formativo', e.target.value)} style={s.select}>
                <option value="">— Selecciona un campo —</option>
                {CAMPOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {form.campo_formativo && (
                <>
                  <label style={s.label}>Contenido *</label>
                  {contenidos.length === 0 ? (
                    <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>Cargando contenidos...</p>
                  ) : (
                    <select value={form.contenido} onChange={e => update('contenido', e.target.value)} style={s.select}>
                      <option value="">— Selecciona un contenido —</option>
                      {contenidos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </>
              )}
              {pdaSugerido && form.contenido && (
                <div>
                  <label style={s.label}>
                    PDA sugerido para {gradoGrupo} *
                    {esNivelAvanzado && (
                      <span style={{ marginLeft: 8, background: '#00A896', color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        Nivel avanzado {gradoPdaElegido}
                      </span>
                    )}
                  </label>
                  <div style={{ background: esNivelAvanzado ? '#E0F5F3' : '#EEEDF8', border: `1.5px solid ${esNivelAvanzado ? '#00A896' : '#3D3A8C'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12, fontSize: 14, lineHeight: 1.6, color: '#1A1A2E' }}>
                    {form.pda_principal}
                  </div>
                  <details style={{ marginBottom: 12 }}>
                    <summary style={{ fontSize: 13, color: '#3D3A8C', cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>✏️ Editar el PDA manualmente</summary>
                    <textarea value={form.pda_principal} onChange={e => update('pda_principal', e.target.value)} rows={4} style={{ ...s.textarea, marginTop: 8, marginBottom: 8, background: '#FAFAFA' }} />
                  </details>
                  {nivelesAvanzados.length > 0 && !esNivelAvanzado && (
                    <button onClick={() => setMostrarNivelesAvanzados(!mostrarNivelesAvanzados)}
                      style={{ background: 'none', border: 'none', color: '#00A896', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline', marginBottom: 12 }}>
                      {mostrarNivelesAvanzados ? '▲ Ocultar niveles avanzados' : '¿Tu grupo ya superó este aprendizaje? Ver niveles avanzados ▼'}
                    </button>
                  )}
                  {esNivelAvanzado && (
                    <button onClick={regresarPdaSugerido}
                      style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline', marginBottom: 12, display: 'block' }}>
                      ← Regresar al PDA de {gradoGrupo}
                    </button>
                  )}
                  {mostrarNivelesAvanzados && nivelesAvanzados.length > 0 && (
                    <div style={{ background: '#F8F8FE', border: '1px solid #D8D6F0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: '#666', marginTop: 0, marginBottom: 12 }}>Estos PDAs tienen mayor nivel de exigencia:</p>
                      {nivelesAvanzados.map(n => (
                        <div key={n.grado} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#3D3A8C' }}>Nivel {n.grado}</span>
                            <button onClick={() => elegirPdaAvanzado(n.grado, n.pda)}
                              style={{ background: '#3D3A8C', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>
                              Elegir este
                            </button>
                          </div>
                          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5, margin: 0, background: 'white', padding: '8px 10px', borderRadius: 6, border: '1px solid #E8E8F0' }}>{n.pda}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 28 }}>
              <p style={s.sectionTitle}>3 · Duración del proyecto</p>
              <label style={s.label}>¿Cuánto durará el proyecto? *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {DURACIONES.map(d => (
                  <button key={d.dias} onClick={() => update('duracion_dias', d.dias)}
                    style={{ padding: '12px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center', lineHeight: 1.3,
                      border: form.duracion_dias === d.dias ? '2px solid #3D3A8C' : '1.5px solid #D8D6F0',
                      background: form.duracion_dias === d.dias ? '#EEEDF8' : 'white',
                      color: form.duracion_dias === d.dias ? '#3D3A8C' : '#555' }}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={s.label}>Fecha de inicio *</label>
                  <input type="date" value={form.fecha_inicio} onChange={e => update('fecha_inicio', e.target.value)} style={s.input} />
                </div>
                <div>
                  <label style={{ ...s.label, color: '#888' }}>Fecha fin (calculada)</label>
                  <input type="date" value={form.fecha_fin} readOnly style={{ ...s.input, background: '#F5F5F5', color: '#888', cursor: 'default' }} />
                </div>
              </div>
            </div>

            <button onClick={handleGenerar} disabled={generating}
              style={{ background: '#00A896', color: 'white', border: 'none', padding: '15px 24px', fontSize: 16, cursor: 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
              ✨ Generar planeación con IA
            </button>
            {esNivelAvanzado && (
              <p style={{ fontSize: 12, color: '#00A896', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                ℹ️ Se registrará que tu grupo de {gradoGrupo} trabajó un PDA de nivel {gradoPdaElegido}
              </p>
            )}
          </div>
        )}

        {result && (
          <div style={{ background: 'white', borderRadius: 14, padding: 32, boxShadow: '0 2px 12px rgba(61,58,140,0.08)' }}>
            <h3 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 8 }}>Planeación generada</h3>
            {saveStatus && (
              <p style={{ fontSize: 13, color: saveStatus.startsWith('✅') ? '#065f46' : '#92400e',
                background: saveStatus.startsWith('✅') ? '#d1fae5' : '#fef3c7',
                padding: '8px 12px', borderRadius: 6, marginBottom: 20 }}>
                {saveStatus}
              </p>
            )}
            {result.error ? (
              <p style={{ color: 'red' }}>{result.error}</p>
            ) : (
              momentos.map(m => result[m.key] ? (
                <div key={m.key} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EFF8' }}>
                  <h4 style={{ color: '#00A896', marginTop: 0, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>{m.titulo}</h4>
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: '#1A1A2E', margin: 0, whiteSpace: 'pre-wrap' }}>{result[m.key]}</p>
                </div>
              ) : null)
            )}
          </div>
        )}
        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}