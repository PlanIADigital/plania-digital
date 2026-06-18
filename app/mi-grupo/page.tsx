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

function SubSeccion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px', textAlign: 'center' }}>{titulo}</p>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>{descripcion}</p>
      {children}
    </div>
  )
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

  // 2A — Diagnóstico grupal
  const [diagnosticoTexto, setDiagnosticoTexto] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [pdas, setPdas] = useState<any[]>([])
  const [guardado, setGuardado] = useState(false)
  const [errorDiagnostico, setErrorDiagnostico] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')

  // 2B — Evaluación individual
  const [evaluacionIndividual, setEvaluacionIndividual] = useState<any>([])
  const [guardandoEval, setGuardandoEval] = useState(false)
  const [errorEval, setErrorEval] = useState('')

  // 3A — Observaciones del directivo
  const [observacionesTexto, setObservacionesTexto] = useState('')
  const [archivoObservacionesNombre, setArchivoObservacionesNombre] = useState('')
  const [analizandoObservaciones, setAnalizandoObservaciones] = useState(false)
  const [observacionesGuardadas, setObservacionesGuardadas] = useState(false)
  const [errorObservaciones, setErrorObservaciones] = useState('')
  const [resultadoObservaciones, setResultadoObservaciones] = useState<any>(null)

  // 3B — PDAs del jardín
  const [archivoJardinNombre, setArchivoJardinNombre] = useState('')
  const [guardandoJardin, setGuardandoJardin] = useState(false)
  const [guardadoJardin, setGuardadoJardin] = useState(false)
  const [errorJardin, setErrorJardin] = useState('')

  // 4 — Estilo narrativo
  const [estiloTexto, setEstiloTexto] = useState('')
  const [archivoEstiloNombre, setArchivoEstiloNombre] = useState('')
  const [analizandoEstilo, setAnalizandoEstilo] = useState(false)
  const [estiloGuardado, setEstiloGuardado] = useState(false)
  const [errorEstilo, setErrorEstilo] = useState('')
  const [resultadoEstilo, setResultadoEstilo] = useState<any>(null)

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
    setAnalizandoPA(true); setErrorPA('')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'desconocido'
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (!dataTexto.texto) { setErrorPA('No se pudo leer el archivo.'); setAnalizandoPA(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/analizar-programa-analitico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: dataTexto.texto, auth_uid: session.user.id, cct: profile.cct_primary, archivo_formato: ext, grado: profile.grado || '2°' })
      })
      const data = await res.json()
      if (data.ok) {
        const nuevaVersion = { id: data.pa_id, version_numero: data.version_numero, fecha_carga: data.fecha_carga, archivo_formato: ext, activo: true, pda_ponderacion: data.resultado, nota_directivo: null }
        setPaActivo(nuevaVersion)
        setHistorialPA(prev => [nuevaVersion, ...prev.map((v: any) => ({ ...v, activo: false }))])
        setHistorialVisible(false)
      } else { setErrorPA('Error al analizar el Programa Analítico.') }
    } catch { setErrorPA('Error de conexión.') }
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
      else setErrorDiagnostico('No se pudo extraer el texto.')
    } catch { setErrorDiagnostico('Error al procesar el archivo.') }
  }

  async function handleAnalizar() {
    if (!diagnosticoTexto.trim()) { setErrorDiagnostico('Sube tu diagnóstico antes de analizar.'); return }
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
    setGuardandoEval(true); setErrorEval('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (dataTexto.error) { setErrorEval('Error al leer el archivo.'); setGuardandoEval(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      const resAnalisis = await fetch('/api/analizar-evaluacion-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto_evaluacion: dataTexto.texto, grado: profile.grado || '2°', total_alumnos: profile.total_students || profile.total_alumnos || 24, auth_uid: session?.user?.id })
      })
      const dataAnalisis = await resAnalisis.json()
      if (dataAnalisis.error) { setErrorEval('Error al analizar.'); setGuardandoEval(false); return }
      setEvaluacionIndividual(dataAnalisis.resultado)
    } catch { setErrorEval('Error de conexión.') }
    setGuardandoEval(false)
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
    } catch { setErrorObservaciones('No se pudo extraer el texto.') }
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
      else setErrorObservaciones('Error al analizar.')
    } catch { setErrorObservaciones('Error de conexión.') }
    finally { setAnalizandoObservaciones(false) }
  }

  async function handleArchivoJardin(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setArchivoJardinNombre(archivo.name)
    setGuardandoJardin(true); setErrorJardin('')
    const formData = new FormData()
    formData.append('file', archivo)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.texto) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.from('users').update({ pdas_jardin: data.texto }).eq('auth_uid', session.user.id)
          setGuardadoJardin(true)
        }
      } else setErrorJardin('No se pudo extraer el texto.')
    } catch { setErrorJardin('Error al procesar el archivo.') }
    setGuardandoJardin(false)
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
    } catch { setErrorEstilo('No se pudo extraer el texto.') }
  }

  async function handleAnalizarEstilo() {
    if (!estiloTexto.trim()) { setErrorEstilo('Escribe o sube un texto.'); return }
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
      else setErrorEstilo('Error al analizar.')
    } catch { setErrorEstilo('Error de conexión.') }
    finally { setAnalizandoEstilo(false) }
  }

  const s = {
    page: { padding: '0 40px' } as React.CSSProperties,
    card: { background: 'white', borderRadius: 12, padding: '20px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
    cardTitle: { fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 16px', textAlign: 'center' as const } as React.CSSProperties,
    cols: { display: 'flex', gap: 0, flexWrap: 'wrap' as const } as React.CSSProperties,
    col: { flex: '1 1 200px', minWidth: 0, padding: '0 16px 0 0', textAlign: 'center' as const } as React.CSSProperties,
    colRight: { flex: '1 1 200px', minWidth: 0, padding: '0 0 0 16px', borderLeft: '1px solid #EEEDF8', textAlign: 'center' as const } as React.CSSProperties,
    subTitle: { fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 4px', textAlign: 'center' as const } as React.CSSProperties,
    desc: { fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5, textAlign: 'center' as const } as React.CSSProperties,
    btn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#3D3A8C', color: 'white', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
    btnGreen: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#3D3A8C', color: 'white', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
    ok: { background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 8, padding: '10px 12px' } as React.CSSProperties,
    okText: { margin: 0, fontWeight: 700, color: '#0F6E56', fontSize: 12 } as React.CSSProperties,
    err: { background: '#fee2e2', color: '#991b1b', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginTop: 8 } as React.CSSProperties,
  }

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const totalAlumnos = profile.total_students || profile.total_alumnos || 24
  const evalCompleta = evaluacionIndividual && typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).resumen_general

  return (
    <SidebarWrapper profile={profile}>
      {analizando ? (
        <PantallaAnimacion grado={profile.grado || '2°'} totalAlumnos={totalAlumnos} cct={profile.cct_primary || ''} />
      ) : (
        <div style={{ padding: '0 32px' }}>

          {/* ENCABEZADO */}
          <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '14px 32px', marginBottom: 20, textAlign: 'center' }}>
            <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>MI GRUPO</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: 13 }}>
              {profile.school_name && <><strong style={{ color: 'rgba(255,255,255,0.9)' }}>JN:</strong> {nombreCorto(profile.school_name)} · </>}
              <strong style={{ color: 'rgba(255,255,255,0.9)' }}>CCT:</strong> {profile.cct_primary} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Grupo:</strong> {profile.grado || '2°'} A · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Alumnos:</strong> <input type="number" min="1" max="50" placeholder="24" value={profile.total_alumnos || ''} onChange={async (e) => { const val = parseInt(e.target.value); if (!val || val < 1) return; setProfile((prev: any) => ({ ...prev, total_alumnos: val })); const { data: { session } } = await supabase.auth.getSession(); if (session) { await supabase.from('users').update({ total_alumnos: val }).eq('auth_uid', session.user.id); setAlumnosGuardado(true); setTimeout(() => setAlumnosGuardado(false), 2000); } }} style={{ width: 44, padding: '1px 4px', fontSize: 13, fontWeight: 700, borderRadius: 6, border: '1.5px solid rgba(255,255,255,0.4)', textAlign: 'center', outline: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', display: 'inline-block' }} />
              {alumnosGuardado && <span style={{ fontSize: 11, color: '#00A896', fontWeight: 600, marginLeft: 4 }}>✓</span>}
            </p>
          </div>

          {/* GRID 2 COLUMNAS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>

            {/* COLUMNA IZQUIERDA: 1.1 PMC + 1.2 PA + 3.1 + 3.2 */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const }}>

              <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EFF8' }}>
                <p style={s.cardTitle}>1 · Diagnóstico Escolar</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={s.subTitle}>1.1 · PROGRAMA DE MEJORA CONTINUA</p>
                    <p style={s.desc}>Contexto Institucional del Jardín:<br/>Entorno, Organización y Recursos.</p>
                    {!diagnosticoEscolarGuardado ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ ...s.btn, opacity: analizandoEscolar ? 0.6 : 1 }}>
                          {analizandoEscolar ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPMC} style={{ display: 'none' }} disabled={analizandoEscolar} />
                        </label>
                        {archivoEscolarNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoEscolarNombre}</p>}
                        {diagnosticoEscolarTexto && !analizandoEscolar && (
                          <button onClick={handleAnalizarPMC} style={{ display: 'block', marginTop: 8, background: '#3D3A8C', color: 'white', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                            ✨ Analizar PMC
                          </button>
                        )}
                        {errorEscolar && <div style={s.err}>{errorEscolar}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ PMC guardado</p>
                        {resultadoEscolar?.contexto_social && <p style={{ fontSize: 11, color: '#444', margin: '4px 0 0', lineHeight: 1.4 }}>{resultadoEscolar.contexto_social}</p>}
                        <button onClick={() => { setDiagnosticoEscolarGuardado(false); setResultadoEscolar(null); setDiagnosticoEscolarTexto(''); setArchivoEscolarNombre('') }}
                          style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>Actualizar</button>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={s.subTitle}>1.2 · Programa Analítico</p>
                    <p style={s.desc}>PDA Y Contenidos priorizados por el colectivo.<br/>Acepta formato .docx, .pptx, .pdf.</p>
                    {!paActivo ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ ...s.btn, opacity: analizandoPA ? 0.6 : 1, cursor: analizandoPA ? 'default' : 'pointer' }}>
                          {analizandoPA ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                        </label>
                        {analizandoPA && <p style={{ fontSize: 11, color: '#3D3A8C', margin: '6px 0 0' }}>MÍA está leyendo el PA...</p>}
                        {errorPA && <div style={s.err}>{errorPA}</div>}
                      </div>
                    ) : (
                      <div>
                        <div style={{ ...s.ok, borderRadius: historialVisible ? '8px 8px 0 0' : 8 }}>
                          <p style={s.okText}>✅ PA cargado · <span style={{ fontWeight: 400 }}>v{paActivo.version_numero}</span></p>
                          <p style={{ fontSize: 11, color: '#555', margin: '2px 0 0' }}>{formatearFecha(paActivo.fecha_carga)}</p>
                          {paActivo.pda_ponderacion?.resumen_pa && (
                            <p style={{ fontSize: 11, color: '#444', margin: '4px 0 0', lineHeight: 1.4 }}>{paActivo.pda_ponderacion.resumen_pa}</p>
                          )}
                          {paActivo.nota_directivo && (
                            <p style={{ fontSize: 11, color: '#185FA5', margin: '4px 0 0' }}>💬 {paActivo.nota_directivo}</p>
                          )}
                          {paActivo.pda_ponderacion?.inconsistencias?.length > 0 && (
                            <div style={{ marginTop: 6, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 8px' }}>
                              <p style={{ margin: 0, fontSize: 11, color: '#92400E', fontWeight: 700 }}>⚠ {paActivo.pda_ponderacion.inconsistencias.length} observación{paActivo.pda_ponderacion.inconsistencias.length > 1 ? 'es' : ''} de MÍA</p>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button onClick={toggleHistorial} style={{ background: 'none', border: 'none', color: '#0F6E56', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                              {historialVisible ? '▴ Ocultar' : '▾ Historial'}
                            </button>
                            <label style={{ color: '#0F6E56', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              ↑ Actualizar
                              <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                            </label>
                          </div>
                        </div>
                        {historialVisible && (
                          <div style={{ background: 'white', border: '1.5px solid #00A896', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px' }}>
                            {cargandoHistorial ? <p style={{ fontSize: 11, color: '#888', margin: 0 }}>Cargando...</p> : historialPA.map((v: any, i: number) => (
                              <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingBottom: i < historialPA.length - 1 ? 6 : 0, marginBottom: i < historialPA.length - 1 ? 6 : 0, borderBottom: i < historialPA.length - 1 ? '1px solid #F0FDF9' : 'none' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.activo ? '#1D9E75' : '#D1D5DB', marginTop: 4, flexShrink: 0 }} />
                                <div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>v{v.version_numero}</span>
                                  {v.activo && <span style={{ marginLeft: 6, fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>activa</span>}
                                  <p style={{ margin: '1px 0 0', fontSize: 11, color: '#888' }}>{formatearFecha(v.fecha_carga)}</p>
                                  {v.nota_directivo && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#185FA5' }}>💬 {v.nota_directivo}</p>}
                                </div>
                              </div>
                            ))}
                            {paActivo && (() => {
                              const dias = Math.floor((Date.now() - new Date(paActivo.fecha_carga).getTime()) / (1000 * 60 * 60 * 24))
                              if (dias < 30) return null
                              return (
                                <div style={{ marginTop: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '8px 10px', display: 'flex', gap: 6 }}>
                                  <span style={{ flexShrink: 0 }}>🔔</span>
                                  <p style={{ margin: 0, fontSize: 11, color: '#1E40AF', lineHeight: 1.5 }}>
                                    <strong>MÍA:</strong> Han pasado {dias} días. Si hubo ajustes en tu último CTE, actualiza el PA.
                                  </p>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                        {errorPA && <div style={s.err}>{errorPA}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p style={s.cardTitle}>3 · Recomendaciones Directivas</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={s.subTitle}>3.1 · Áreas de Oportunidad</p>
                    <p style={s.desc}>Observaciones de tu última visita áulica.<br/>MÍA las integrará en tus planeaciones.</p>
                    {!observacionesGuardadas ? (
                      <div>
                        <textarea value={observacionesTexto} onChange={e => setObservacionesTexto(e.target.value)} rows={3}
                          placeholder="Ej: La directora me indicó trabajar más la expresión oral..."
                          style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.5, marginBottom: 8, textAlign: 'left' as const }} />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                          <button onClick={handleAnalizarObservaciones} disabled={analizandoObservaciones || !observacionesTexto.trim()}
                            style={{ background: analizandoObservaciones || !observacionesTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {analizandoObservaciones ? '🔍...' : '✨ Guardar'}
                          </button>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            📎 Archivo
                            <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} />
                          </label>
                        </div>
                        {archivoObservacionesNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '5px 0 0' }}>✓ {archivoObservacionesNombre}</p>}
                        {errorObservaciones && <div style={s.err}>{errorObservaciones}</div>}
                        <p style={{ fontSize: 10, color: '#aaa', marginTop: 6 }}>Opcional</p>
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ Observaciones integradas</p>
                        {resultadoObservaciones?.areas_mejora?.slice(0, 2).map((area: string, i: number) => (
                          <p key={i} style={{ fontSize: 11, color: '#444', margin: '3px 0 0', lineHeight: 1.4 }}>• {area}</p>
                        ))}
                        <button onClick={() => { setObservacionesGuardadas(false); setResultadoObservaciones(null); setObservacionesTexto('') }}
                          style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>Actualizar</button>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={s.subTitle}>3.2 · PDAs del jardín <span style={{ fontSize: 10, background: '#F8F8FE', color: '#888', border: '1px solid #D8D6F0', padding: '1px 6px', borderRadius: 10, fontWeight: 600, marginLeft: 4 }}>Opcional</span></p>
                    <p style={s.desc}>PDAs acordados por el colectivo este ciclo.<br/>El sistema los integrará con tu diagnóstico.</p>
                    {!guardadoJardin ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ ...s.btn, opacity: guardandoJardin ? 0.6 : 1 }}>
                          {guardandoJardin ? '⏳ Guardando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} disabled={guardandoJardin} />
                        </label>
                        {archivoJardinNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoJardinNombre}</p>}
                        {errorJardin && <div style={s.err}>{errorJardin}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ PDAs del jardín guardados</p>
                        <label style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>
                          Actualizar
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMNA DERECHA: 2.1 + 2.2 + 4 */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const }}>

              <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EFF8' }}>
                <p style={s.cardTitle}>2 · Diagnóstico Pedagógico</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={s.subTitle}>2.1 · Diagnóstico Grupal</p>
                    <p style={s.desc}>Necesidades y áreas de oportunidad del Grupo,<br/>para personalizar tu planeaciones.</p>
                    {!guardado ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ ...s.btnGreen, opacity: analizando ? 0.6 : 1 }}>
                          {analizando ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} disabled={analizando} />
                        </label>
                        {archivoNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoNombre}</p>}
                        {diagnosticoTexto && !analizando && (
                          <button onClick={handleAnalizar} style={{ display: 'block', marginTop: 8, background: '#3D3A8C', color: 'white', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                            ✨ Analizar
                          </button>
                        )}
                        {errorDiagnostico && <div style={s.err}>{errorDiagnostico}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ Diagnóstico guardado</p>
                        <p style={{ fontSize: 11, color: '#444', margin: '3px 0 0' }}>{pdas.length} PDAs prioritarios identificados</p>
                        <button onClick={() => { setGuardado(false); setDiagnosticoTexto(''); setPdas([]); setArchivoNombre('') }}
                          style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>Actualizar</button>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={s.subTitle}>2.2 · Diagnóstico Individual</p>
                    <p style={s.desc}>Evaluación por alumno.<br/>MÍA protege nombres y detecta NNE.</p>
                    {!evalCompleta ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ ...s.btn, opacity: guardandoEval ? 0.6 : 1 }}>
                          {guardandoEval ? '✦ Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} disabled={guardandoEval} onChange={handleArchivoEvaluacionIndividual} />
                        </label>
                      <p style={{ fontSize: 10, color: '#aaa', margin: '8px 0 0', textAlign: 'center' }}>🔒 Nombres nunca almacenados</p>
                        {errorEval && <div style={s.err}>{errorEval}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ Evaluación completa</p>
                        <p style={{ fontSize: 11, color: '#444', margin: '3px 0 0' }}>{(evaluacionIndividual as any).total_alumnos_detectados || 0} alumnos · {(evaluacionIndividual as any).alumnos_con_nee > 0 ? `⚠ ${(evaluacionIndividual as any).alumnos_con_nee} con NEE` : 'sin NEE detectadas'}</p>
                        <label style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>
                          Actualizar
                          <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleArchivoEvaluacionIndividual} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                {pdas.length > 0 && (() => {
                  const grupos: Record<string, { campo: string; contenido: string; items: any[] }> = {}
                  pdas.forEach((p) => {
                    const key = `${p.campo}||${p.contenido}`
                    if (!grupos[key]) grupos[key] = { campo: p.campo, contenido: p.contenido, items: [] }
                    grupos[key].items.push(p)
                  })
                  return (
                    <div style={{ marginTop: 16, borderTop: '1px solid #EEEDF8', paddingTop: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>PDAs priorizados para tu grupo</p>
                      {Object.values(grupos).map((grupo, gi) => (
                        <div key={gi} style={{ border: '1px solid #E0F5F3', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                            <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{grupo.campo}</span>
                            <span style={{ background: '#F0FFF8', color: '#059669', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{grupo.items.length} PDA{grupo.items.length > 1 ? 's' : ''}</span>
                          </div>
                          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.4 }}>{grupo.contenido}</p>
                          {grupo.items.map((p, pi) => (
                            <div key={pi} style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 6, padding: '8px 10px', marginBottom: 4 }}>
                              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#1A1A2E', lineHeight: 1.5, fontStyle: 'italic' }}>{p.pda}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#666', lineHeight: 1.4 }}>{p.justificacion}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div>
                <p style={s.cardTitle}>4 · Mi estilo de narración</p>
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5, textAlign: 'center' }}>
                  Comparte cómo escribes: una carta a padres, unas notas, cualquier texto tuyo.<br/>MÍA aprenderá de ti para que tus planeaciones suenen a ti.
                </p>
                {!estiloGuardado ? (
                  <div>
                    <textarea value={estiloTexto} onChange={e => setEstiloTexto(e.target.value)} rows={4}
                      placeholder="Ej: Estimadas familias, quiero compartirles que esta semana trabajamos con los niños explorando..."
                      style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 10 } as React.CSSProperties}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                      <button onClick={handleAnalizarEstilo} disabled={analizandoEstilo || !estiloTexto.trim()}
                        style={{ background: analizandoEstilo || !estiloTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {analizandoEstilo ? '🔍 Analizando...' : '✨ Analizar estilo'}
                      </button>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        📎 O sube un documento
                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEstilo} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {archivoEstiloNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoEstiloNombre}</p>}
                    {errorEstilo && <div style={s.err}>{errorEstilo}</div>}
                  </div>
                ) : (
                  <div style={s.ok}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={s.okText}>✅ Estilo de escritura guardado</p>
                      <button onClick={() => { setEstiloGuardado(false); setResultadoEstilo(null); setEstiloTexto('') }}
                        style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: 0 }}>Actualizar</button>
                    </div>
                    {resultadoEstilo?.tono && <p style={{ fontSize: 12, color: '#444', margin: '4px 0 0' }}><strong>Tono:</strong> {resultadoEstilo.tono}</p>}
                  </div>
                )}
              </div>

            </div>
          </div>

          <div style={{ height: 40 }} />
        </div>
      )}
    </SidebarWrapper>
  )
}
