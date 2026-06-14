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

function formatearFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MiGrupoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [alumnosGuardado, setAlumnosGuardado] = useState(false)

  // 1A — PMC
  const [diagnosticoEscolarTexto, setDiagnosticoEscolarTexto] = useState('')
  const [archivoEscolarNombre, setArchivoEscolarNombre] = useState('')
  const [analizandoEscolar, setAnalizandoEscolar] = useState(false)
  const [diagnosticoEscolarGuardado, setDiagnosticoEscolarGuardado] = useState(false)
  const [errorEscolar, setErrorEscolar] = useState('')
  const [resultadoEscolar, setResultadoEscolar] = useState<any>(null)

  // 1B — Programa Analítico
  const [archivoPANombre, setArchivoPANombre] = useState('')
  const [analizandoPA, setAnalizandoPA] = useState(false)
  const [errorPA, setErrorPA] = useState('')
  const [paActivo, setPaActivo] = useState<any>(null)
  const [historialPA, setHistorialPA] = useState<any[]>([])
  const [historialVisible, setHistorialVisible] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // 2 — Diagnóstico grupal
  const [diagnosticoTexto, setDiagnosticoTexto] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [pdas, setPdas] = useState<any[]>([])
  const [guardado, setGuardado] = useState(false)
  const [errorDiagnostico, setErrorDiagnostico] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')

  // 3 — Evaluación individual
  const [evaluacionIndividual, setEvaluacionIndividual] = useState<any>([])
  const [guardandoEval, setGuardandoEval] = useState(false)
  const [guardadoEval, setGuardadoEval] = useState(false)
  const [errorEval, setErrorEval] = useState('')

  // 4 — Estilo narrativo
  const [estiloTexto, setEstiloTexto] = useState('')
  const [archivoEstiloNombre, setArchivoEstiloNombre] = useState('')
  const [analizandoEstilo, setAnalizandoEstilo] = useState(false)
  const [estiloGuardado, setEstiloGuardado] = useState(false)
  const [errorEstilo, setErrorEstilo] = useState('')
  const [resultadoEstilo, setResultadoEstilo] = useState<any>(null)

  // 5 — Observaciones del directivo
  const [observacionesTexto, setObservacionesTexto] = useState('')
  const [archivoObservacionesNombre, setArchivoObservacionesNombre] = useState('')
  const [analizandoObservaciones, setAnalizandoObservaciones] = useState(false)
  const [observacionesGuardadas, setObservacionesGuardadas] = useState(false)
  const [errorObservaciones, setErrorObservaciones] = useState('')
  const [resultadoObservaciones, setResultadoObservaciones] = useState<any>(null)

  // 6 — PDAs del jardín
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
      if (data.observaciones_directivo) { setResultadoObservaciones(data.observaciones_directivo); setObservacionesGuardadas(true) }
      if (data.estilo_narrativo) { setResultadoEstilo(data.estilo_narrativo); setEstiloGuardado(true) }
      if (data.diagnostico_escolar) { setResultadoEscolar(data.diagnostico_escolar); setDiagnosticoEscolarGuardado(true) }
      if (data.diagnostico_texto) setDiagnosticoTexto(data.diagnostico_texto)
      if (data.pdas_prioritarios?.length > 0) setPdas(data.pdas_prioritarios)
      if (data.evaluacion_individual?.length > 0) {
        setEvaluacionIndividual(data.evaluacion_individual)
      } else {
        const total = data.total_students || data.total_alumnos || 24
        setEvaluacionIndividual(Array(total).fill(''))
      }
      if (data.pdas_jardin && typeof data.pdas_jardin === 'string') setPdasJardinTexto(data.pdas_jardin)
      if (data.cct_primary) {
        const res = await fetch(`/api/analizar-programa-analitico?auth_uid=${session.user.id}&cct=${data.cct_primary}`)
        const json = await res.json()
        if (json.ok && json.historial?.length > 0) {
          const activo = json.historial.find((v: any) => v.activo)
          if (activo) setPaActivo(activo)
          setHistorialPA(json.historial)
        }
      }
    }
    load()
  }, [])

  async function handleArchivoPMC(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoEscolarNombre(file.name)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.texto) setDiagnosticoEscolarTexto(prev => prev ? prev + '\n\n' + data.texto : data.texto)
    } catch { setErrorEscolar('No se pudo extraer el texto del archivo.') }
  }

  async function handleAnalizarPMC() {
    if (!diagnosticoEscolarTexto.trim()) { setErrorEscolar('Sube al menos un documento.'); return }
    setAnalizandoEscolar(true); setErrorEscolar('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-diagnostico-escolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: diagnosticoEscolarTexto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) { setResultadoEscolar(data.resultado); setDiagnosticoEscolarGuardado(true) }
      else setErrorEscolar('Error al analizar. Intenta de nuevo.')
    } catch { setErrorEscolar('Error de conexión.') }
    finally { setAnalizandoEscolar(false) }
  }

  async function handleArchivoPA(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoPANombre(file.name)
    setAnalizandoPA(true)
    setErrorPA('')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'desconocido'
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (!dataTexto.texto) { setErrorPA('No se pudo leer el archivo. Intenta con otro formato.'); setAnalizandoPA(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-programa-analitico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: dataTexto.texto,
          auth_uid: session.user.id,
          cct: profile.cct_primary,
          archivo_formato: ext,
          grado: profile.grado || '2°',
        })
      })
      const data = await res.json()
      if (data.ok) {
        const nuevaVersion = {
          id: data.pa_id,
          version_numero: data.version_numero,
          fecha_carga: data.fecha_carga,
          archivo_formato: ext,
          activo: true,
          pda_ponderacion: data.resultado,
          nota_directivo: null,
          nota_directivo_fecha: null,
        }
        setPaActivo(nuevaVersion)
        setHistorialPA(prev => [nuevaVersion, ...prev.map((v: any) => ({ ...v, activo: false }))])
        setHistorialVisible(false)
      } else {
        setErrorPA('Error al analizar el Programa Analítico. Intenta de nuevo.')
      }
    } catch { setErrorPA('Error de conexión. Intenta de nuevo.') }
    finally { setAnalizandoPA(false); setArchivoPANombre('') }
  }

  async function toggleHistorial() {
    if (historialVisible) { setHistorialVisible(false); return }
    setHistorialVisible(true)
    if (historialPA.length === 0) {
      setCargandoHistorial(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (session && profile?.cct_primary) {
        const res = await fetch(`/api/analizar-programa-analitico?auth_uid=${session.user.id}&cct=${profile.cct_primary}`)
        const json = await res.json()
        if (json.ok) setHistorialPA(json.historial || [])
      }
      setCargandoHistorial(false)
    }
  }

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
    } catch { setErrorObservaciones('No se pudo extraer el texto del archivo.') }
  }

  async function handleAnalizarObservaciones() {
    if (!observacionesTexto.trim()) { setErrorObservaciones('Escribe o sube las observaciones.'); return }
    setAnalizandoObservaciones(true); setErrorObservaciones('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-observaciones-directivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: observacionesTexto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) { setResultadoObservaciones(data.resultado); setObservacionesGuardadas(true) }
      else setErrorObservaciones('Error al analizar. Intenta de nuevo.')
    } catch { setErrorObservaciones('Error de conexión.') }
    finally { setAnalizandoObservaciones(false) }
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
    } catch { setErrorEstilo('No se pudo extraer el texto del archivo.') }
  }

  async function handleAnalizarEstilo() {
    if (!estiloTexto.trim()) { setErrorEstilo('Escribe o sube un texto para analizar.'); return }
    setAnalizandoEstilo(true); setErrorEstilo('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-estilo-narrativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: estiloTexto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) { setResultadoEstilo(data.resultado); setEstiloGuardado(true) }
      else setErrorEstilo('Error al analizar el texto. Intenta de nuevo.')
    } catch { setErrorEstilo('Error de conexión.') }
    finally { setAnalizandoEstilo(false) }
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
    } catch { setErrorEval('Error de conexión. Intenta de nuevo.') }
    setGuardandoEval(false)
  }

  async function handleGuardarJardin() {
    setGuardandoJardin(true); setErrorJardin(''); setGuardadoJardin(false)
    const { error } = await supabase.from('users').update({ pdas_jardin: pdasJardinTexto }).eq('auth_uid', profile.auth_uid)
    if (error) setErrorJardin('No se pudo guardar. Intenta de nuevo.')
    else setGuardadoJardin(true)
    setGuardandoJardin(false)
  }

  const s = {
    section: { background: 'white', borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 } as React.CSSProperties,
    label: { display: 'block', marginBottom: 6, fontWeight: 600, color: '#1A1A2E', fontSize: 14 } as React.CSSProperties,
    divider: { height: 1, background: '#EEEDF8', margin: '24px 0' } as React.CSSProperties,
    subLabel: { fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8, marginTop: 0 } as React.CSSProperties,
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

          <div style={s.section}>
            <h2 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 22, fontWeight: 700 }}>Mi grupo</h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 24, marginTop: 0 }}>
              {profile.school_name && <><strong>JN:</strong> {nombreCorto(profile.school_name)} · </>}
              <strong>CCT:</strong> {profile.cct_primary} · <strong>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''} · <strong>Grupo:</strong> {profile.grado || '2°'} A
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F4F3FB', borderRadius: 10, padding: '12px 16px' }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', flexShrink: 0 }}>Cantidad de alumnos:</label>
              <input type="number" min="1" max="50" placeholder="Ej: 24"
                value={profile.total_alumnos || ''}
                onChange={async (e) => {
                  const val = parseInt(e.target.value)
                  if (!val || val < 1) return
                  setProfile((prev: any) => ({ ...prev, total_alumnos: val }))
                  const { data: { session } } = await supabase.auth.getSession()
                  if (session) {
                    await supabase.from('users').update({ total_alumnos: val }).eq('auth_uid', session.user.id)
                    setAlumnosGuardado(true)
                    setTimeout(() => setAlumnosGuardado(false), 2000)
                  }
                }}
                style={{ width: 80, padding: '8px 12px', fontSize: 15, borderRadius: 8, border: profile.total_alumnos ? '1.5px solid #00A896' : '1.5px solid #D8D6F0', textAlign: 'center', outline: 'none' }}
              />
              {alumnosGuardado && <span style={{ fontSize: 12, color: '#00A896', fontWeight: 600 }}>✓ Guardado</span>}
            </div>
          </div>

          <div style={s.section}>
            <p style={s.sectionTitle}>1 · Diagnóstico escolar</p>

            <p style={s.subLabel}>1A · Programa de Mejora Continua (PMC)</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Sube tu PMC. MÍA extraerá el contexto institucional del jardín: entorno comunitario, organización escolar y recursos disponibles.
            </p>
            {!diagnosticoEscolarGuardado ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: analizandoEscolar ? '#C4C2E8' : '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {analizandoEscolar ? '🔍 Analizando...' : '📁 Seleccionar archivo'}
                    <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPMC} style={{ display: 'none' }} disabled={analizandoEscolar} />
                  </label>
                  {archivoEscolarNombre && <p style={{ fontSize: 12, color: '#00A896', margin: 0, fontWeight: 500 }}>✓ {archivoEscolarNombre}</p>}
                </div>
                {diagnosticoEscolarTexto && !analizandoEscolar && (
                  <button onClick={handleAnalizarPMC} style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', marginBottom: 12 }}>
                    ✨ Analizar PMC
                  </button>
                )}
                {errorEscolar && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8 }}>{errorEscolar}</div>}
              </div>
            ) : (
              <div style={{ background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 14 }}>
                    ✅ PMC guardado
                    {resultadoEscolar?.tipo_detectado && (
                      <span style={{ marginLeft: 8, background: '#3D3A8C', color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{resultadoEscolar.tipo_detectado}</span>
                    )}
                  </p>
                  <button onClick={() => { setDiagnosticoEscolarGuardado(false); setResultadoEscolar(null); setDiagnosticoEscolarTexto(''); setArchivoEscolarNombre('') }}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: 0 }}>Actualizar</button>
                </div>
                {resultadoEscolar?.contexto_social && (
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#444', lineHeight: 1.5 }}><strong>Contexto social:</strong> {resultadoEscolar.contexto_social}</p>
                )}
                {resultadoEscolar?.areas_oportunidad?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {resultadoEscolar.areas_oportunidad.map((area: string, i: number) => (
                      <span key={i} style={{ display: 'inline-block', background: '#EEEDF8', color: '#3D3A8C', fontSize: 12, padding: '3px 10px', borderRadius: 20, marginRight: 6, marginBottom: 4, fontWeight: 500 }}>{area}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={s.divider} />

            <p style={s.subLabel}>1B · Programa Analítico</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Sube el PA de tu jardín. MÍA identificará los contenidos y PDAs priorizados por tu colectivo. Acepta .docx, .pptx y .pdf.
            </p>

            {!paActivo ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: analizandoPA ? '#C4C2E8' : '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: analizandoPA ? 'default' : 'pointer' }}>
                    {analizandoPA ? '🔍 Analizando PA...' : '📁 Seleccionar archivo'}
                    <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                  </label>
                  {archivoPANombre && !analizandoPA && <p style={{ fontSize: 12, color: '#00A896', margin: 0, fontWeight: 500 }}>✓ {archivoPANombre}</p>}
                </div>
                {analizandoPA && <p style={{ fontSize: 13, color: '#3D3A8C', margin: '8px 0 0' }}>MÍA está leyendo tu Programa Analítico, esto tarda unos segundos...</p>}
                {errorPA && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginTop: 8 }}>{errorPA}</div>}
              </div>
            ) : (
              <div>
                <div style={{ background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: historialVisible ? '10px 10px 0 0' : 10, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'white', fontSize: 14 }}>✓</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 14 }}>Programa Analítico cargado</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555' }}>
                        {formatearFecha(paActivo.fecha_carga)} · .{paActivo.archivo_formato} ·{' '}
                        <span style={{ background: '#C8EFE9', color: '#0F6E56', fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>Versión {paActivo.version_numero} activa</span>
                      </p>
                      {paActivo.pda_ponderacion?.resumen_pa && (
                        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#444', lineHeight: 1.5 }}>{paActivo.pda_ponderacion.resumen_pa}</p>
                      )}
                      {paActivo.nota_directivo && (
                        <div style={{ marginTop: 8, background: '#EEF4FB', borderRadius: 8, padding: '8px 10px' }}>
                          <p style={{ margin: 0, fontSize: 12, color: '#185FA5' }}>💬 <strong>Directivo:</strong> {paActivo.nota_directivo}</p>
                        </div>
                      )}
                      {paActivo.pda_ponderacion?.inconsistencias?.length > 0 && (
                        <div style={{ marginTop: 8, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 10px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#92400E' }}>
                            ⚠ MÍA encontró {paActivo.pda_ponderacion.inconsistencias.length} observación{paActivo.pda_ponderacion.inconsistencias.length > 1 ? 'es' : ''}
                          </p>
                          {paActivo.pda_ponderacion.inconsistencias.map((inc: any, i: number) => (
                            <p key={i} style={{ margin: '0 0 2px', fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>• {inc.descripcion}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
                    <button onClick={toggleHistorial} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#0F6E56', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      <span style={{ display: 'inline-block', transform: historialVisible ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
                      {historialVisible ? 'Ocultar historial' : 'Ver historial de versiones'}
                    </button>
                    <span style={{ color: '#A7F3D0' }}>·</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0F6E56', fontSize: 12, fontWeight: 600, cursor: analizandoPA ? 'default' : 'pointer' }}>
                      {analizandoPA ? '🔍 Analizando...' : '↑ Actualizar PA'}
                      <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                    </label>
                  </div>
                </div>
                {historialVisible && (
                  <div style={{ background: 'white', border: '1.5px solid #00A896', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    <p style={{ margin: 0, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#888', background: '#F8FFFE', borderBottom: '1px solid #E0F5F3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Historial del ciclo escolar
                    </p>
                    {cargandoHistorial ? (
                      <p style={{ padding: '16px', fontSize: 13, color: '#888', margin: 0 }}>Cargando historial...</p>
                    ) : historialPA.length === 0 ? (
                      <p style={{ padding: '16px', fontSize: 13, color: '#888', margin: 0 }}>Sin versiones anteriores.</p>
                    ) : (
                      historialPA.map((version: any, i: number) => (
                        <div key={version.id} style={{ padding: '12px 16px', borderBottom: i < historialPA.length - 1 ? '1px solid #F0FDF9' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: version.activo ? '#1D9E75' : '#D1D5DB', marginTop: 5, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Versión {version.version_numero}</span>
                              {version.activo && <span style={{ fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>activa</span>}
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>{formatearFecha(version.fecha_carga)} · .{version.archivo_formato}</p>
                            {version.nota_directivo && (
                              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#185FA5' }}>💬 <strong>Directivo:</strong> {version.nota_directivo}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {paActivo && (() => {
                      const diasDesde = Math.floor((Date.now() - new Date(paActivo.fecha_carga).getTime()) / (1000 * 60 * 60 * 24))
                      if (diasDesde < 30) return null
                      return (
                        <div style={{ margin: '0 12px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>🔔</span>
                          <p style={{ margin: 0, fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
                            <strong>MÍA te recuerda:</strong> Han pasado {diasDesde} días desde tu última actualización. Si en tu último CTE se hicieron ajustes al Programa Analítico, este es un buen momento para subirlo.
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                )}
                {errorPA && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginTop: 8 }}>{errorPA}</div>}
              </div>
            )}
          </div>

          <div style={s.section}>
            <p style={s.sectionTitle}>2 · Diagnóstico grupal</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Describe las necesidades y áreas de oportunidad que detectaste en tu grupo. El sistema sugerirá los PDAs más relevantes para atenderlas.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: analizando ? '#C4C2E8' : '#00A896', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {analizando ? '🔍 Analizando...' : '📁 Seleccionar archivo'}
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} disabled={analizando} />
              </label>
              {archivoNombre && <p style={{ fontSize: 12, color: '#00A896', margin: 0, fontWeight: 500 }}>✓ {archivoNombre}</p>}
            </div>
            {diagnosticoTexto && !analizando && !guardado && (
              <button onClick={handleAnalizar} style={{ background: '#00A896', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', marginBottom: 12 }}>
                ✨ Analizar diagnóstico
              </button>
            )}
            {errorDiagnostico && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorDiagnostico}</p>}
            {guardado && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6 }}>✅ Diagnóstico guardado.</p>}
          </div>

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
                {Object.values(grupos).map((grupo, gi) => (
                  <div key={gi} style={{ border: '1.5px solid #E0F5F3', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
                      <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{grupo.campo}</span>
                      <span style={{ background: '#F0FFF8', color: '#059669', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{grupo.items.length} PDA{grupo.items.length > 1 ? 's' : ''}</span>
                    </div>
                    <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.5 }}>{grupo.contenido}</p>
                    {grupo.items.map((p, pi) => (
                      <div key={pi} style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1A1A2E', lineHeight: 1.6, fontStyle: 'italic' }}>{p.pda}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#444', lineHeight: 1.5 }}>{p.justificacion}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })()}

          <div style={s.section}>
            <p style={s.sectionTitle}>3 · Diagnóstico individual</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Sube tu evaluación individual (Word o PDF). MÍA extrae las observaciones pedagógicas, protege los nombres y detecta NEE automáticamente.
            </p>
            {!evaluacionIndividual || (Array.isArray(evaluacionIndividual) && evaluacionIndividual.every((x: any) => !x)) || (typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && !(evaluacionIndividual as any).resumen_general) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: guardandoEval ? '#F0EFF8' : '#3D3A8C', color: guardandoEval ? '#3D3A8C' : 'white', padding: '11px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {guardandoEval ? '✦ MÍA está analizando...' : '📁 Seleccionar archivo'}
                  <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} disabled={guardandoEval} onChange={handleArchivoEvaluacionIndividual} />
                </label>
                <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>🔒 Los nombres reales nunca se almacenan</p>
              </div>
            ) : (
              <div>
                {typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).resumen_general && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 6px', textTransform: 'uppercase' as const }}>✅ Análisis completado</p>
                    <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, lineHeight: 1.6 }}>{(evaluacionIndividual as any).resumen_general}</p>
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D3A8C', background: '#EEEDF8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Actualizar evaluación
                  <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleArchivoEvaluacionIndividual} />
                </label>
              </div>
            )}
            {errorEval && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginTop: 12 }}>{errorEval}</div>}
          </div>

          <div style={s.section}>
            <p style={s.sectionTitle}>4 · Tu estilo de narración</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Comparte cómo escribes: una carta a padres, unas notas, cualquier texto tuyo. MÍA aprenderá de ti.
            </p>
            {!estiloGuardado ? (
              <div>
                <textarea value={estiloTexto} onChange={e => setEstiloTexto(e.target.value)} rows={6}
                  placeholder="Ej: Estimadas familias, quiero compartirles que esta semana trabajamos con los niños explorando..."
                  style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 12 } as React.CSSProperties}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEstilo} style={{ display: 'none' }} id="archivo-estilo" />
                  <label htmlFor="archivo-estilo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    📎 O sube un documento
                  </label>
                  {archivoEstiloNombre && <span style={{ fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoEstiloNombre}</span>}
                </div>
                {errorEstilo && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{errorEstilo}</div>}
                <button onClick={handleAnalizarEstilo} disabled={analizandoEstilo || !estiloTexto.trim()}
                  style={{ background: analizandoEstilo || !estiloTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                  {analizandoEstilo ? '🔍 Analizando tu estilo...' : '✨ Analizar mi estilo de escritura'}
                </button>
              </div>
            ) : (
              <div style={{ background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 14 }}>✅ Estilo de escritura guardado</p>
                  <button onClick={() => { setEstiloGuardado(false); setResultadoEstilo(null); setEstiloTexto('') }}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: 0 }}>Actualizar</button>
                </div>
                {resultadoEstilo?.tono && <p style={{ margin: 0, fontSize: 13, color: '#444' }}><strong>Tono:</strong> {resultadoEstilo.tono}</p>}
              </div>
            )}
          </div>

          <div style={s.section}>
            <p style={s.sectionTitle}>5 · Recomendaciones del directivo</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Escribe lo que tu directora te comentó en la visita áulica. MÍA las integrará en tus planeaciones.
            </p>
            {!observacionesGuardadas ? (
              <div>
                <textarea value={observacionesTexto} onChange={e => setObservacionesTexto(e.target.value)} rows={5}
                  placeholder="Ej: La directora me indicó trabajar más la expresión oral..."
                  style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 12 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} id="archivo-observaciones" />
                  <label htmlFor="archivo-observaciones" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    📎 O sube un documento
                  </label>
                  {archivoObservacionesNombre && <span style={{ fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoObservacionesNombre}</span>}
                </div>
                {errorObservaciones && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{errorObservaciones}</div>}
                <button onClick={handleAnalizarObservaciones} disabled={analizandoObservaciones || !observacionesTexto.trim()}
                  style={{ background: analizandoObservaciones || !observacionesTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                  {analizandoObservaciones ? '🔍 Analizando...' : '✨ Guardar observaciones del directivo'}
                </button>
                <p style={{ fontSize: 11, color: '#aaa', marginTop: 10, textAlign: 'center' as const }}>Esta sección es opcional</p>
              </div>
            ) : (
              <div>
                {resultadoObservaciones?.areas_mejora?.length > 0 && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 8px', textTransform: 'uppercase' as const }}>✅ Observaciones integradas</p>
                    {resultadoObservaciones.areas_mejora.map((area: string, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: '#444', margin: '0 0 3px' }}>• {area}</p>
                    ))}
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D3A8C', background: '#EEEDF8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Actualizar
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>

          <div style={s.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <p style={{ ...s.sectionTitle, marginBottom: 0 }}>6 · PDAs del jardín de niños</p>
              <span style={{ fontSize: 11, background: '#F8F8FE', color: '#888', border: '1px solid #D8D6F0', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>Opcional</span>
            </div>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Si tu directora compartió los PDAs que acordaron trabajar este ciclo, súbelos aquí.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📁 Seleccionar archivo
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} />
              </label>
              {archivoJardinNombre && <p style={{ fontSize: 12, color: '#00A896', margin: 0, fontWeight: 500 }}>✓ {archivoJardinNombre}</p>}
            </div>
            {errorJardin && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 12, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorJardin}</p>}
            {guardadoJardin && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12 }}>✅ PDAs del jardín guardados.</p>}
          </div>

          <div style={{ height: 40 }} />
        </div>
      )}
    </SidebarWrapper>
  )
}
