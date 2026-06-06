'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

const MENSAJES_ANALISIS = [
  '🔍 Leyendo las necesidades de tu grupo...',
  '📚 Revisando los 371 PDAs del Programa NEM 2022...',
  '🧩 Identificando áreas de oportunidad clave...',
  '✨ Seleccionando los PDAs más relevantes para tus alumnos...',
  '📋 Preparando tus resultados...',
]

function PantallaAnimacion({ grado, totalAlumnos, cct }: { grado: string; totalAlumnos: number; cct: string }) {
  const [mensajeIdx, setMensajeIdx] = useState(0)
  const [puntos, setPuntos] = useState('')
  useEffect(() => {
    const intervaloMensaje = setInterval(() => {
      setMensajeIdx(prev => (prev + 1) % MENSAJES_ANALISIS.length)
    }, 2200)
    const intervaloPuntos = setInterval(() => {
      setPuntos(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return () => { clearInterval(intervaloMensaje); clearInterval(intervaloPuntos) }
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '0 24px', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 90, height: 90, marginBottom: 32 }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', border: '4px solid #E8F5F2', borderTop: '4px solid #00A896', animation: 'giroPlanIA 1s linear infinite', position: 'absolute', top: 0, left: 0 }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 28 }}>🧠</div>
      </div>
      <style>{`
        @keyframes giroPlanIA { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeInMsg { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <h2 style={{ color: '#3D3A8C', fontSize: 20, fontWeight: 700, marginBottom: 8, marginTop: 0 }}>Analizando tu grupo{puntos}</h2>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 28, marginTop: 0 }}>{grado} grado · {totalAlumnos} alumnos · {cct}</p>
      <div style={{ background: 'white', borderRadius: 12, padding: '16px 24px', boxShadow: '0 2px 12px rgba(61,58,140,0.08)', minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: 360, width: '100%' }}>
        <p style={{ color: '#3D3A8C', fontSize: 14, fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{MENSAJES_ANALISIS[mensajeIdx]}</p>
      </div>
      <p style={{ color: '#C4C2E8', fontSize: 12, marginTop: 24 }}>Esto puede tomar unos segundos</p>
    </div>
  )
}

export default function MiGrupoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)

  // Capa 1 — Diagnóstico grupal
  const [diagnosticoTexto, setDiagnosticoTexto] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [pdas, setPdas] = useState<any[]>([])
  const [guardado, setGuardado] = useState(false)
  const [errorDiagnostico, setErrorDiagnostico] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')

  // Capa 2 — Evaluación individual
  const [evaluacionIndividual, setEvaluacionIndividual] = useState<string[]>([])
  const [guardandoEval, setGuardandoEval] = useState(false)
  const [guardadoEval, setGuardadoEval] = useState(false)
  const [errorEval, setErrorEval] = useState('')

  // Capa 3 — PDAs del jardín (opcional)
  const [pdasJardinTexto, setPdasJardinTexto] = useState('')
  const [archivoJardinNombre, setArchivoJardinNombre] = useState('')
  const [guardandoJardin, setGuardandoJardin] = useState(false)
  const [guardadoJardin, setGuardadoJardin] = useState(false)
  const [errorJardin, setErrorJardin] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
      if (data.diagnostico_texto) setDiagnosticoTexto(data.diagnostico_texto)
      if (data.pdas_prioritarios?.length > 0) setPdas(data.pdas_prioritarios)
      if (data.evaluacion_individual?.length > 0) {
        setEvaluacionIndividual(data.evaluacion_individual)
      } else {
        const total = data.total_students || data.total_alumnos || 24
        setEvaluacionIndividual(Array(total).fill(''))
      }
      if (data.pdas_jardin) setPdasJardinTexto(data.pdas_jardin)
    }
    load()
  }, [])

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setArchivoNombre(archivo.name)
    const formData = new FormData()
    formData.append('file', archivo)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.texto) setDiagnosticoTexto(data.texto)
      else setErrorDiagnostico('No se pudo extraer el texto del archivo.')
    } catch { setErrorDiagnostico('Error al procesar el archivo.') }
  }

  async function handleArchivoJardin(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setArchivoJardinNombre(archivo.name)
    const formData = new FormData()
    formData.append('file', archivo)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.texto) setPdasJardinTexto(data.texto)
      else setErrorJardin('No se pudo extraer el texto del archivo.')
    } catch { setErrorJardin('Error al procesar el archivo.') }
  }

  async function handleAnalizar() {
    if (!diagnosticoTexto.trim()) { setErrorDiagnostico('Escribe o sube tu diagnóstico antes de analizar.'); return }
    setAnalizando(true); setErrorDiagnostico(''); setPdas([]); setGuardado(false)
    try {
      const res = await fetch('/api/analizar-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostico_texto: diagnosticoTexto, grado: profile?.grado || '2°', auth_uid: profile?.auth_uid })
      })
      const data = await res.json()
      if (data.pdas_sugeridos) { setPdas(data.pdas_sugeridos); setGuardado(true) }
      else setErrorDiagnostico(data.error || 'No se pudieron analizar los PDAs.')
    } catch { setErrorDiagnostico('Error de conexión.') }
    setAnalizando(false)
  }

  async function handleGuardarEvaluacion() {
    setGuardandoEval(true); setErrorEval(''); setGuardadoEval(false)
    const { error } = await supabase.from('users')
      .update({ evaluacion_individual: evaluacionIndividual })
      .eq('auth_uid', profile.auth_uid)
    if (error) setErrorEval('No se pudo guardar. Intenta de nuevo.')
    else setGuardadoEval(true)
    setGuardandoEval(false)
  }

  async function handleGuardarJardin() {
    setGuardandoJardin(true); setErrorJardin(''); setGuardadoJardin(false)
    const { error } = await supabase.from('users')
      .update({ pdas_jardin: pdasJardinTexto })
      .eq('auth_uid', profile.auth_uid)
    if (error) setErrorJardin('No se pudo guardar. Intenta de nuevo.')
    else setGuardadoJardin(true)
    setGuardandoJardin(false)
  }

  function actualizarAlumno(idx: number, valor: string) {
    setEvaluacionIndividual(prev => { const nuevo = [...prev]; nuevo[idx] = valor; return nuevo })
    setGuardadoEval(false)
  }


  const s = {
    section: { background: 'white', borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 } as React.CSSProperties,
    label: { display: 'block', marginBottom: 6, fontWeight: 600, color: '#1A1A2E', fontSize: 14 } as React.CSSProperties,
  }

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const totalAlumnos = profile.total_students || profile.total_alumnos || 24

  return (
    <Sidebar profile={profile}>
      {analizando ? (
        <PantallaAnimacion grado={profile.grado || '2°'} totalAlumnos={totalAlumnos} cct={profile.cct_primary || ''} />
      ) : (
        <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 16px' }}>

          {/* ── CAPA 1: Diagnóstico grupal ── */}
          <div style={s.section}>
            <h2 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 22, fontWeight: 700 }}>
              Mi grupo
            </h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 24, marginTop: 0 }}>
              {profile.cct_primary} · {profile.grado || '2°'} grado · {totalAlumnos} alumnos
            </p>

            <p style={s.sectionTitle}>1 · Diagnóstico grupal</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Describe las necesidades y áreas de oportunidad que detectaste en tu grupo. El sistema sugerirá los PDAs más relevantes para atenderlas.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>Escribe o pega tu diagnóstico *</label>
              <textarea
                value={diagnosticoTexto}
                onChange={e => setDiagnosticoTexto(e.target.value)}
                rows={8}
                placeholder="Ej: El grupo presenta dificultades en la expresión oral, varios niños no logran sostener conversaciones breves..."
                style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6 } as React.CSSProperties}
              />
            </div>

            <div style={{ background: '#F8F8FE', border: '1px dashed #C4C2E8', borderRadius: 10, padding: 16, marginBottom: 24 }}>
              <label style={{ ...s.label, marginBottom: 4 }}>
                O sube tu diagnóstico en Word o PDF
                <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 6 }}>(opcional)</span>
              </label>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>El sistema extraerá el texto automáticamente.</p>
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} id="archivo-diagnostico" />
              <label htmlFor="archivo-diagnostico" style={{ display: 'inline-block', background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📎 Seleccionar archivo
              </label>
              {archivoNombre && <span style={{ marginLeft: 12, fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoNombre}</span>}
            </div>

            {errorDiagnostico && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorDiagnostico}</p>}

            <button onClick={handleAnalizar} disabled={analizando || !diagnosticoTexto.trim()}
              style={{ background: !diagnosticoTexto.trim() ? '#D0D0D0' : '#00A896', color: 'white', border: 'none', padding: '13px 24px', fontSize: 15, cursor: !diagnosticoTexto.trim() ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
              ✨ Analizar diagnóstico y sugerir PDAs
            </button>

            {guardado && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12, marginBottom: 0 }}>✅ Diagnóstico guardado. Los PDAs prioritarios ya están disponibles al crear tu próxima planeación.</p>}
          </div>

          {/* Resultados PDAs Capa 1 */}
          {pdas.length > 0 && (() => {
            const grupos: Record<string, { campo: string; contenido: string; items: any[] }> = {}
            pdas.forEach((p) => {
              const key = `${p.campo}||${p.contenido}`
              if (!grupos[key]) grupos[key] = { campo: p.campo, contenido: p.contenido, items: [] }
              grupos[key].items.push(p)
            })
            return (
              <div style={s.section}>
                <p style={s.sectionTitle}>PDAs sugeridos para tu grupo</p>
                <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>Basados en las necesidades de tu diagnóstico grupal.</p>
                {Object.values(grupos).map((grupo, gi) => (
                  <div key={gi} style={{ border: '1.5px solid #E0F5F3', borderRadius: 10, padding: 16, marginBottom: 12, background: 'white' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
                      <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{grupo.campo}</span>
                      <span style={{ background: '#F0FFF8', color: '#059669', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{grupo.items.length} PDA{grupo.items.length > 1 ? 's' : ''} prioritario{grupo.items.length > 1 ? 's' : ''}</span>
                    </div>
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>Contenido</p>
                    <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.5 }}>{grupo.contenido}</p>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                      {grupo.items.map((p, pi) => (
                        <div key={pi} style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: 12 }}>
                          {grupo.items.length > 1 && <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#00A896', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>PDA {pi + 1}</p>}
                          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1A1A2E', lineHeight: 1.6, fontStyle: 'italic' }}>{p.pda}</p>
                          <p style={{ margin: '0 0 2px', fontSize: 11, color: '#888' }}>¿Por qué este PDA?</p>
                          <p style={{ margin: 0, fontSize: 12, color: '#444', lineHeight: 1.5 }}>{p.justificacion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── CAPA 2: Evaluación individual ── */}
          <div style={s.section}>
            <p style={s.sectionTitle}>2 · Evaluación individual</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 8, lineHeight: 1.6 }}>
              Anota las necesidades específicas de cada alumno. Esta información personaliza aún más tus planeaciones.
            </p>
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
              🔒 Los alumnos se identifican solo por número, sin nombres reales (protección de datos).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 20 }}>
              {evaluacionIndividual.map((obs, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ minWidth: 28, height: 28, borderRadius: '50%', background: '#EEEDF8', color: '#3D3A8C', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 8 }}>
                    {idx + 1}
                  </span>
                  <textarea
                    value={obs}
                    onChange={e => actualizarAlumno(idx, e.target.value)}
                    rows={2}
                    placeholder={`Alumno ${idx + 1} — observaciones específicas...`}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.5 } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
            {errorEval && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorEval}</p>}
            <button onClick={handleGuardarEvaluacion} disabled={guardandoEval}
              style={{ background: guardandoEval ? '#F0EFF8' : '#3D3A8C', color: guardandoEval ? '#3D3A8C' : 'white', border: 'none', padding: '12px 24px', fontSize: 14, cursor: guardandoEval ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
              {guardandoEval ? 'Guardando...' : '💾 Guardar evaluación individual'}
            </button>
            {guardadoEval && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12, marginBottom: 0 }}>✅ Evaluación individual guardada correctamente.</p>}
          </div>

          {/* ── CAPA 3: PDAs del jardín (opcional) ── */}
          <div style={{ ...s.section, border: '1.5px dashed #C4C2E8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <p style={{ ...s.sectionTitle, marginBottom: 0 }}>3 · PDAs del jardín</p>
              <span style={{ fontSize: 11, background: '#F8F8FE', color: '#888', border: '1px solid #D8D6F0', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>Opcional</span>
            </div>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Si tu directora compartió los PDAs que acordaron trabajar este ciclo en el jardín, súbelos aquí. El sistema los integrará de forma armoniosa con tu diagnóstico.
            </p>
            <textarea
              value={pdasJardinTexto}
              onChange={e => setPdasJardinTexto(e.target.value)}
              rows={5}
              placeholder="Pega aquí los PDAs que tu directora indicó trabajar, o sube el archivo..."
              style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 16 } as React.CSSProperties}
            />
            <div style={{ background: '#F8F8FE', border: '1px dashed #C4C2E8', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>O sube el documento que compartió tu directora (Word o PDF)</p>
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} id="archivo-jardin" />
              <label htmlFor="archivo-jardin" style={{ display: 'inline-block', background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📎 Seleccionar archivo
              </label>
              {archivoJardinNombre && <span style={{ marginLeft: 12, fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoJardinNombre}</span>}
            </div>
            {errorJardin && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorJardin}</p>}
            <button onClick={handleGuardarJardin} disabled={guardandoJardin || !pdasJardinTexto.trim()}
              style={{ background: !pdasJardinTexto.trim() ? '#D0D0D0' : guardandoJardin ? '#F0EFF8' : '#3D3A8C', color: !pdasJardinTexto.trim() || guardandoJardin ? '#888' : 'white', border: 'none', padding: '12px 24px', fontSize: 14, cursor: !pdasJardinTexto.trim() ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
              {guardandoJardin ? 'Guardando...' : '💾 Guardar PDAs del jardín'}
            </button>
            {guardadoJardin && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12, marginBottom: 0 }}>✅ PDAs del jardín guardados. Se integrarán en tus próximas planeaciones.</p>}
          </div>

          <div style={{ height: 40 }} />
        </div>
      )}
    </Sidebar>
  )
}
