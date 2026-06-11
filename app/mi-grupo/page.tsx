'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
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


function nombreCorto(nombre: string | null): string {
  if (!nombre) return ''
  return nombre
    .replace(/^Jardín de Niños Indígena\s*/i, '')
    .replace(/^Jardín de Niños\s*/i, '')
    .replace(/^Jardin de Niños\s*/i, '')
    .replace(/^Centro de Educación Preescolar\s*/i, '')
    .trim()
}

export default function MiGrupoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)

  // Capa 0 — Diagnóstico escolar
  const [diagnosticoEscolarTexto, setDiagnosticoEscolarTexto] = useState('')
  const [archivoEscolarNombre, setArchivoEscolarNombre] = useState('')
  const [analizandoEscolar, setAnalizandoEscolar] = useState(false)
  const [diagnosticoEscolarGuardado, setDiagnosticoEscolarGuardado] = useState(false)
  const [errorEscolar, setErrorEscolar] = useState('')
  const [resultadoEscolar, setResultadoEscolar] = useState<any>(null)

  // Capa 1 — Diagnóstico grupal
  const [diagnosticoTexto, setDiagnosticoTexto] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [pdas, setPdas] = useState<any[]>([])
  const [guardado, setGuardado] = useState(false)
  const [errorDiagnostico, setErrorDiagnostico] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')

  // Capa 2 — Estilo narrativo
  const [estiloTexto, setEstiloTexto] = useState('')
  const [archivoEstiloNombre, setArchivoEstiloNombre] = useState('')
  const [analizandoEstilo, setAnalizandoEstilo] = useState(false)
  const [estiloGuardado, setEstiloGuardado] = useState(false)
  const [errorEstilo, setErrorEstilo] = useState('')
  const [resultadoEstilo, setResultadoEstilo] = useState<any>(null)

  // Capa 5 — Observaciones del directivo
  const [observacionesTexto, setObservacionesTexto] = useState('')
  const [archivoObservacionesNombre, setArchivoObservacionesNombre] = useState('')
  const [analizandoObservaciones, setAnalizandoObservaciones] = useState(false)
  const [observacionesGuardadas, setObservacionesGuardadas] = useState(false)
  const [errorObservaciones, setErrorObservaciones] = useState('')
  const [resultadoObservaciones, setResultadoObservaciones] = useState<any>(null)

  // Capa 2 — Evaluación individual
  const [evaluacionIndividual, setEvaluacionIndividual] = useState<any>([])
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
      if (data.observaciones_directivo) {
        setResultadoObservaciones(data.observaciones_directivo)
        setObservacionesGuardadas(true)
      }
      if (data.estilo_narrativo) {
        setResultadoEstilo(data.estilo_narrativo)
        setEstiloGuardado(true)
      }
      if (data.diagnostico_escolar) {
        setResultadoEscolar(data.diagnostico_escolar)
        setDiagnosticoEscolarGuardado(true)
      }
      if (data.diagnostico_texto) setDiagnosticoTexto(data.diagnostico_texto)
      if (data.pdas_prioritarios?.length > 0) setPdas(data.pdas_prioritarios)
      if (data.evaluacion_individual?.length > 0) {
        setEvaluacionIndividual(data.evaluacion_individual)
      } else {
        const total = data.total_students || data.total_alumnos || 24
        setEvaluacionIndividual(Array(total).fill(''))
      }
      if (data.pdas_jardin && typeof data.pdas_jardin === 'string') setPdasJardinTexto(data.pdas_jardin)
    }
    load()
  }, [])

  async function handleArchivoObservaciones(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoObservacionesNombre(file.name)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.texto) setObservacionesTexto(prev => prev ? prev + '\n\n' + data.texto : data.texto)
    } catch {
      setErrorObservaciones('No se pudo extraer el texto del archivo.')
    }
  }

  async function handleAnalizarObservaciones() {
    if (!observacionesTexto.trim()) {
      setErrorObservaciones('Escribe o sube las observaciones.')
      return
    }
    setAnalizandoObservaciones(true)
    setErrorObservaciones('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-observaciones-directivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: observacionesTexto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) {
        setResultadoObservaciones(data.resultado)
        setObservacionesGuardadas(true)
      } else {
        setErrorObservaciones('Error al analizar. Intenta de nuevo.')
      }
    } catch {
      setErrorObservaciones('Error de conexión. Intenta de nuevo.')
    } finally {
      setAnalizandoObservaciones(false)
    }
  }

  async function handleArchivoEstilo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoEstiloNombre(file.name)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.texto) setEstiloTexto(prev => prev ? prev + '\n\n' + data.texto : data.texto)
    } catch {
      setErrorEstilo('No se pudo extraer el texto del archivo.')
    }
  }

  async function handleAnalizarEstilo() {
    if (!estiloTexto.trim()) {
      setErrorEstilo('Escribe o sube un texto para analizar.')
      return
    }
    setAnalizandoEstilo(true)
    setErrorEstilo('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-estilo-narrativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: estiloTexto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) {
        setResultadoEstilo(data.resultado)
        setEstiloGuardado(true)
      } else {
        setErrorEstilo('Error al analizar el texto. Intenta de nuevo.')
      }
    } catch {
      setErrorEstilo('Error de conexión. Intenta de nuevo.')
    } finally {
      setAnalizandoEstilo(false)
    }
  }

  async function handleArchivoEscolar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoEscolarNombre(file.name)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.texto) setDiagnosticoEscolarTexto(prev => prev ? prev + '\n\n' + data.texto : data.texto)
    } catch {
      setErrorEscolar('No se pudo extraer el texto del archivo.')
    }
  }

  async function handleAnalizarEscolar() {
    if (!diagnosticoEscolarTexto.trim()) {
      setErrorEscolar('Escribe o sube al menos un documento.')
      return
    }
    setAnalizandoEscolar(true)
    setErrorEscolar('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-diagnostico-escolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: diagnosticoEscolarTexto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) {
        setResultadoEscolar(data.resultado)
        setDiagnosticoEscolarGuardado(true)
      } else {
        setErrorEscolar('Error al analizar el documento. Intenta de nuevo.')
      }
    } catch {
      setErrorEscolar('Error de conexión. Intenta de nuevo.')
    } finally {
      setAnalizandoEscolar(false)
    }
  }

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

  async function handleArchivoEvaluacionIndividual(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGuardandoEval(true); setErrorEval(''); setGuardadoEval(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (dataTexto.error) { setErrorEval('Error al leer el archivo: ' + dataTexto.error); setGuardandoEval(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      const resAnalisis = await fetch('/api/analizar-evaluacion-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto_evaluacion: dataTexto.texto,
          grado: profile.grado || '2°',
          total_alumnos: profile.total_students || profile.total_alumnos || 24,
          auth_uid: session?.user?.id
        })
      })
      const dataAnalisis = await resAnalisis.json()
      if (dataAnalisis.error) { setErrorEval('Error al analizar: ' + dataAnalisis.error); setGuardandoEval(false); return }
      setEvaluacionIndividual(dataAnalisis.resultado)
      setGuardadoEval(true)
    } catch {
      setErrorEval('Error de conexión. Intenta de nuevo.')
    }
    setGuardandoEval(false)
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
    setEvaluacionIndividual((prev: any[]) => { const nuevo = [...prev]; nuevo[idx] = valor; return nuevo })
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
    <SidebarWrapper profile={profile}>
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
              {profile.school_name && <><strong>JN:</strong> {nombreCorto(profile.school_name)} · </>}<strong>CCT:</strong> {profile.cct_primary} · <strong>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''} · <strong>Grupo:</strong> {profile.grado || '2°'} A
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, background: '#F4F3FB', borderRadius: 10, padding: '12px 16px' }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', flexShrink: 0 }}>Cantidad de alumnos:</label>
              <input
                type="number"
                min="1"
                max="50"
                placeholder="Ej: 24"
                value={profile.total_alumnos || ''}
                onChange={async (e) => {
                  const val = parseInt(e.target.value)
                  if (!val || val < 1) return
                  setProfile((prev: any) => ({ ...prev, total_alumnos: val }))
                  const { data: { session } } = await supabase.auth.getSession()
                  if (session) {
                    await supabase.from('users').update({ total_alumnos: val }).eq('auth_uid', session.user.id)
                  }
                }}
                style={{ width: 80, padding: '8px 12px', fontSize: 15, borderRadius: 8, border: '1.5px solid #D8D6F0', textAlign: 'center', outline: 'none' }}
              />
            </div>
            <p style={s.sectionTitle}>1 · Diagnóstico escolar</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Sube tu PMC (Programa de Mejora Continua) y/o tu Programa Analítico. MÍA extraerá el contexto institucional para personalizar tus planeaciones.
            </p>

            {!diagnosticoEscolarGuardado ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: analizandoEscolar ? '#C4C2E8' : '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    {analizandoEscolar ? '🔍 Analizando...' : '📁 Seleccionar archivo'}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEscolar} style={{ display: 'none' }} disabled={analizandoEscolar} />
                  </label>
                  {archivoEscolarNombre && <p style={{ fontSize: 12, color: '#00A896', margin: 0, fontWeight: 500 }}>✓ {archivoEscolarNombre}</p>}
                </div>
                {errorEscolar && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{errorEscolar}</div>}
              </div>
            ) : (
              <div style={{ background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 14 }}>
                    ✅ Contexto escolar guardado
                    {resultadoEscolar?.tipo_detectado && (
                      <span style={{ marginLeft: 8, background: '#3D3A8C', color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        {resultadoEscolar.tipo_detectado}
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => { setDiagnosticoEscolarGuardado(false); setResultadoEscolar(null) }}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                    Actualizar
                  </button>
                </div>
                {resultadoEscolar?.contexto_social && (
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                    <strong>Contexto social:</strong> {resultadoEscolar.contexto_social}
                  </p>
                )}
                {resultadoEscolar?.diagnostico_pedagogico && (
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                    <strong>Diagnóstico pedagógico:</strong> {resultadoEscolar.diagnostico_pedagogico}
                  </p>
                )}
                {resultadoEscolar?.areas_oportunidad?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Áreas de oportunidad:</p>
                    {resultadoEscolar.areas_oportunidad.map((area: string, i: number) => (
                      <span key={i} style={{ display: 'inline-block', background: '#EEEDF8', color: '#3D3A8C', fontSize: 12, padding: '3px 10px', borderRadius: 20, marginRight: 6, marginBottom: 4, fontWeight: 500 }}>
                        {area}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ height: 1, background: '#EEEDF8', margin: '28px 0' }} />

            <p style={s.sectionTitle}>2 · Diagnóstico grupal</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Describe las necesidades y áreas de oportunidad que detectaste en tu grupo. El sistema sugerirá los PDAs más relevantes para atenderlas.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: analizando ? '#C4C2E8' : '#00A896', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                {analizando ? '🔍 Analizando...' : '📁 Seleccionar archivo'}
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} disabled={analizando} />
              </label>
              {archivoNombre && <p style={{ fontSize: 12, color: '#00A896', margin: 0, fontWeight: 500 }}>✓ {archivoNombre}</p>}
            </div>
            </div>
            {errorDiagnostico && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorDiagnostico}</p>}
            {guardado && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginBottom: 0 }}>✅ Diagnóstico guardado. Los PDAs prioritarios ya están disponibles al crear tu próxima planeación.</p>}
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

          {/* ── CAPA 2: Evaluación individual — nuevo flujo ── */}
          <div style={s.section}>
            <p style={s.sectionTitle}>3 · Diagnóstico individual</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Sube tu evaluación individual (Word o PDF). MÍA extrae las observaciones pedagógicas, protege los nombres y detecta NEE automáticamente.
            </p>
            {!evaluacionIndividual || (Array.isArray(evaluacionIndividual) && evaluacionIndividual.every((x: any) => !x)) || (typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && !(evaluacionIndividual as any).resumen_general) ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: guardandoEval ? '#F0EFF8' : '#3D3A8C', color: guardandoEval ? '#3D3A8C' : 'white', padding: '11px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    {guardandoEval ? '✦ MÍA está analizando...' : '📁 Seleccionar archivo'}
                    <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} disabled={guardandoEval} onChange={handleArchivoEvaluacionIndividual} />
                  </label>
                  <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>🔒 Los nombres reales nunca se almacenan</p>
                </div>
              </div>
            ) : (
              <div>
                {typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).resumen_general && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>✅ Análisis completado</p>
                    <p style={{ fontSize: 13, color: '#1A1A2E', margin: '0 0 8px', lineHeight: 1.6 }}>{(evaluacionIndividual as any).resumen_general}</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{(evaluacionIndividual as any).total_alumnos_detectados || 0} alumnos analizados</span>
                      {(evaluacionIndividual as any).alumnos_con_nee > 0 && (
                        <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>⚠️ {(evaluacionIndividual as any).alumnos_con_nee} con NEE detectadas</span>
                      )}
                    </div>
                  </div>
                )}
                {typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).alertas?.length > 0 && (
                  <div style={{ background: '#EEEDF8', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', margin: '0 0 8px', textTransform: 'uppercase' as const }}>✦ Observaciones de MÍA</p>
                    {(evaluacionIndividual as any).alertas.map((alerta: string, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: '#3D3A8C', margin: '0 0 4px', lineHeight: 1.5 }}>• {alerta}</p>
                    ))}
                  </div>
                )}
                {typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).alumnos?.filter((a: any) => a.nee?.length > 0).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', margin: '0 0 8px' }}>Alumnos con necesidades específicas:</p>
                    {(evaluacionIndividual as any).alumnos.filter((a: any) => a.nee?.length > 0).map((alumno: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#F8F8FE', borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EEEDF8', color: '#3D3A8C', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{String(alumno.referencia || '').replace('Alumno ', '')}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, color: '#1A1A2E', margin: '0 0 3px' }}>{alumno.observaciones}</p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>{alumno.nee?.map((n: string, j: number) => (<span key={j} style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>{n}</span>))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D3A8C', background: '#EEEDF8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Actualizar evaluación
                  <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleArchivoEvaluacionIndividual} />
                </label>
              </div>
            )}
          </div>


          <div style={s.section}>
            <p style={s.sectionTitle}>4 · Tu estilo de narración</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Esto es para que tu planeación sea realmente tuya — a tu tono y a tu estilo. Comparte cómo escribes: una carta a padres, unas notas, cualquier texto tuyo. MÍA aprenderá de ti.
            </p>

            {!estiloGuardado ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Escribe o pega un texto tuyo</label>
                  <textarea
                    value={estiloTexto}
                    onChange={e => setEstiloTexto(e.target.value)}
                    rows={6}
                    placeholder="Ej: Estimadas familias, quiero compartirles que esta semana trabajamos con los niños explorando..."
                    style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6 } as React.CSSProperties}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <label style={{ ...s.label, marginBottom: 0, flexShrink: 0 }}>O sube un documento Word o PDF</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEstilo} style={{ display: 'none' }} id="archivo-estilo" />
                  <label htmlFor="archivo-estilo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    📎 Seleccionar archivo
                  </label>
                  {archivoEstiloNombre && <span style={{ fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoEstiloNombre}</span>}
                </div>
                {errorEstilo && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                    {errorEstilo}
                  </div>
                )}
                <button
                  onClick={handleAnalizarEstilo}
                  disabled={analizandoEstilo || !estiloTexto.trim()}
                  style={{ background: analizandoEstilo || !estiloTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: analizandoEstilo || !estiloTexto.trim() ? 'default' : 'pointer', width: '100%' }}>
                  {analizandoEstilo ? '🔍 Analizando tu estilo...' : '✨ Analizar mi estilo de escritura'}
                </button>
              </div>
            ) : (
              <div style={{ background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 14 }}>✅ Estilo de escritura guardado</p>
                  <button
                    onClick={() => { setEstiloGuardado(false); setResultadoEstilo(null); setEstiloTexto('') }}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                    Actualizar
                  </button>
                </div>
                {resultadoEstilo?.tono && (
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                    <strong>Tono:</strong> {resultadoEstilo.tono}
                  </p>
                )}
                {resultadoEstilo?.vocabulario && (
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                    <strong>Vocabulario:</strong> {resultadoEstilo.vocabulario}
                  </p>
                )}
                {resultadoEstilo?.caracteristicas?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Características detectadas:</p>
                    {resultadoEstilo.caracteristicas.map((c: string, i: number) => (
                      <span key={i} style={{ display: 'inline-block', background: '#EEEDF8', color: '#3D3A8C', fontSize: 12, padding: '3px 10px', borderRadius: 20, marginRight: 6, marginBottom: 4, fontWeight: 500 }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          
          <div style={s.section}>
            <p style={s.sectionTitle}>5 · Recomendaciones del directivo</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Escribe lo que tu directora te comentó en la visita áulica o áreas de mejora que te indicó. MÍA las integrará en tus planeaciones.
            </p>
            {!observacionesGuardadas ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Escribe las observaciones</label>
                  <textarea
                    value={observacionesTexto}
                    onChange={e => setObservacionesTexto(e.target.value)}
                    rows={5}
                    placeholder="Ej: La directora me indicó trabajar más la expresión oral, fortalecer la convivencia en el recreo y atender a los alumnos que presentan dificultades en motricidad fina..."
                    style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <label style={{ ...s.label, marginBottom: 0, flexShrink: 0 }}>O sube un documento</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} id="archivo-observaciones" />
                  <label htmlFor="archivo-observaciones" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    📎 Seleccionar archivo
                  </label>
                  {archivoObservacionesNombre && <span style={{ fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoObservacionesNombre}</span>}
                </div>
                {errorObservaciones && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                    {errorObservaciones}
                  </div>
                )}
                <button
                  onClick={handleAnalizarObservaciones}
                  disabled={analizandoObservaciones || !observacionesTexto.trim()}
                  style={{ background: analizandoObservaciones || !observacionesTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: analizandoObservaciones || !observacionesTexto.trim() ? 'default' : 'pointer', width: '100%' }}>
                  {analizandoObservaciones ? '🔍 Analizando...' : '✨ Guardar observaciones del directivo'}
                </button>
                <p style={{ fontSize: 11, color: '#aaa', marginTop: 10, textAlign: 'center' as const }}>Esta sección es opcional</p>
              </div>
            ) : (
              <div>
                {resultadoObservaciones && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>✅ Observaciones del directivo integradas</p>
                    {resultadoObservaciones.areas_mejora?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', margin: '0 0 6px' }}>Áreas de mejora:</p>
                        {resultadoObservaciones.areas_mejora.map((area: string, i: number) => (
                          <p key={i} style={{ fontSize: 12, color: '#444', margin: '0 0 3px', lineHeight: 1.5 }}>• {area}</p>
                        ))}
                      </div>
                    )}
                    {resultadoObservaciones.fortalezas?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', margin: '0 0 6px' }}>Fortalezas reconocidas:</p>
                        {resultadoObservaciones.fortalezas.map((f: string, i: number) => (
                          <p key={i} style={{ fontSize: 12, color: '#444', margin: '0 0 3px', lineHeight: 1.5 }}>• {f}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D3A8C', background: '#EEEDF8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Actualizar documento
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>

          {/* ── CAPA 3: PDAs del jardín (opcional) ── */}
          <div style={s.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <p style={{ ...s.sectionTitle, marginBottom: 0 }}>6 · PDAs del jardín de niños</p>
              <span style={{ fontSize: 11, background: '#F8F8FE', color: '#888', border: '1px solid #D8D6F0', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>Opcional</span>
            </div>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Si tu directora compartió los PDAs que acordaron trabajar este ciclo en el jardín, súbelos aquí. El sistema los integrará de forma armoniosa con tu diagnóstico.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: guardandoJardin ? '#C4C2E8' : '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                {guardandoJardin ? '⏳ Guardando...' : '📁 Seleccionar archivo'}
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} disabled={guardandoJardin} />
              </label>
              {archivoJardinNombre && <p style={{ fontSize: 12, color: '#00A896', margin: 0, fontWeight: 500 }}>✓ {archivoJardinNombre}</p>}
            </div>
            {errorJardin && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorJardin}</p>}
            {guardadoJardin && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginBottom: 0 }}>✅ PDAs del jardín guardados. Se integrarán en tus próximas planeaciones.</p>}
          </div>

          <div style={{ height: 40 }} />
        </div>
      )}
    </SidebarWrapper>
  )
}
