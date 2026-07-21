'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import DetalleModal from '@/components/DetalleModal'
import { supabase } from '@/lib/supabase'

const MENSAJES_ANALISIS = [
  '🔍 Leyendo las necesidades de tu grupo...',
  '📚 Revisando los 371 PDAs del Programa NEM 2022...',
  '🧩 Identificando áreas de oportunidad clave...',
  '✨ Seleccionando los PDAs más relevantes para tus alumnos...',
  '📋 Preparando tus resultados...',
]

function ajustarAlturaTextarea(e: React.FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

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

// Formatea una fecha ISO como tiempo relativo ("Guardado hace 2 minutos",
// "Guardado ayer", etc.) para que la educadora pueda confirmar que el
// guardado fue real y no solo un ícono decorativo que apareció al instante.
function formatearTiempoRelativo(fechaISO: string): string {
  const ahora = Date.now()
  const entonces = new Date(fechaISO).getTime()
  const diffSegundos = Math.floor((ahora - entonces) / 1000)

  if (diffSegundos < 60) return 'Guardado hace instantes'

  const diffMinutos = Math.floor(diffSegundos / 60)
  if (diffMinutos < 60) return `Guardado hace ${diffMinutos} minuto${diffMinutos !== 1 ? 's' : ''}`

  const diffHoras = Math.floor(diffMinutos / 60)
  if (diffHoras < 24) return `Guardado hace ${diffHoras} hora${diffHoras !== 1 ? 's' : ''}`

  // Pasadas las 24 horas, mostramos la fecha completa directamente —
  // sin pasos intermedios de "ayer" o "hace X días" que solo agregan
  // ambigüedad sin aportar más certeza que la fecha exacta
  const fecha = new Date(fechaISO)
  return `Guardado el ${fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// Componente que muestra el tiempo relativo de guardado y se actualiza solo
// cada 30 segundos (para que "hace instantes" eventualmente pase a
// "hace 2 minutos" sin que la educadora tenga que recargar la página)
function TiempoGuardado({ fechaISO }: { fechaISO?: string }) {
  const [, forzarActualizacion] = useState(0)
  useEffect(() => {
    const intervalo = setInterval(() => forzarActualizacion(t => t + 1), 30000)
    return () => clearInterval(intervalo)
  }, [])
  if (!fechaISO) return null
  return (
    <p style={{ fontSize: 10, color: '#888', margin: '2px 0 0' }}>{formatearTiempoRelativo(fechaISO)}</p>
  )
}

const GRADO_MAP: Record<string, string> = { '1er Grado': '1°', '2do Grado': '2°', '3er Grado': '3°' }

type OrigenConteo = '2.1' | '2.2'
interface DiscrepanciaAlumnos {
  detectado: number
  origen: OrigenConteo
}

export default function MiGrupoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [alumnosGuardado, setAlumnosGuardado] = useState(false)
  const [discrepanciaAlumnos, setDiscrepanciaAlumnos] = useState<DiscrepanciaAlumnos | null>(null)

  // Timestamps de guardado para las secciones con historial versionado —
  // permite mostrar "Guardado hace X" junto al ✅, para confirmar que el
  // guardado fue real y no solo un ícono que apareció de inmediato.
  // Ahora también trae version_numero, para saber cuándo mostrar "Historial"
  // (solo a partir de la 2ª versión subida)
  const [fechasGuardado, setFechasGuardado] = useState<Record<string, { fecha: string; version: number }>>({})

  // Modal genérico de "Ver detalle" — el contenido se arma según qué
  // sección lo dispare, para no duplicar 6 componentes de modal casi iguales
  const [modalDetalle, setModalDetalle] = useState<{ titulo: string; contenido: React.ReactNode } | null>(null)

  // Modal genérico de "Historial" para las 5 secciones que usan
  // documentos_historial (PA usa su propio historial, ya existente)
  const [modalHistorial, setModalHistorial] = useState<{ titulo: string } | null>(null)
  const [versionesHistorial, setVersionesHistorial] = useState<any[]>([])
  const [cargandoVersiones, setCargandoVersiones] = useState(false)

  // Modal de observaciones de MÍA sobre el PA — reemplaza el bloque
  // amarillo grande por un badge compacto que abre esta ventana
  const [modalMiaPA, setModalMiaPA] = useState(false)

  // 1A — PMC
  const [analizandoEscolar, setAnalizandoEscolar] = useState(false)
  const [diagnosticoEscolarGuardado, setDiagnosticoEscolarGuardado] = useState(false)
  const [errorEscolar, setErrorEscolar] = useState('')
  const [resultadoEscolar, setResultadoEscolar] = useState<any>(null)

  // 1B — Programa Analítico
  const [analizandoPA, setAnalizandoPA] = useState(false)
  const [errorPA, setErrorPA] = useState('')
  const [paActivo, setPaActivo] = useState<any>(null)
  const [historialPA, setHistorialPA] = useState<any[]>([])
  const [historialVisible, setHistorialVisible] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // 2A — Diagnóstico grupal
  const [analizando, setAnalizando] = useState(false)
  const [pdas, setPdas] = useState<any[]>([])
  const [guardado, setGuardado] = useState(false)
  const [errorDiagnostico, setErrorDiagnostico] = useState('')

  // 2B — Evaluación individual
  const [evaluacionIndividual, setEvaluacionIndividual] = useState<any>([])
  const [guardandoEval, setGuardandoEval] = useState(false)
  const [errorEval, setErrorEval] = useState('')

  // 3A — Observaciones del directivo
  const [observacionesTexto, setObservacionesTexto] = useState('')
  const [analizandoObservaciones, setAnalizandoObservaciones] = useState(false)
  const [observacionesGuardadas, setObservacionesGuardadas] = useState(false)
  const [errorObservaciones, setErrorObservaciones] = useState('')
  const [resultadoObservaciones, setResultadoObservaciones] = useState<any>(null)

  // 3B — PDAs del jardín
  const [guardandoJardin, setGuardandoJardin] = useState(false)
  const [guardadoJardin, setGuardadoJardin] = useState(false)
  const [errorJardin, setErrorJardin] = useState('')
  const [resultadoJardin, setResultadoJardin] = useState<any>(null)

  // 4 — Estilo narrativo
  const [estiloTexto, setEstiloTexto] = useState('')
  const [analizandoEstilo, setAnalizandoEstilo] = useState(false)
  const [estiloGuardado, setEstiloGuardado] = useState(false)
  const [errorEstilo, setErrorEstilo] = useState('')
  const [resultadoEstilo, setResultadoEstilo] = useState<any>(null)

  const gradoGrupo = GRADO_MAP[profile?.grado || ''] || profile?.grado || '2°'

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
      // [jul 2026] Faltaba marcar guardado=true al restaurar — sin
      // esto, el botón seguía mostrando "Seleccionar" como si nunca
      // se hubiera subido nada, aunque los PDAs sí estaban cargados
      // y visibles debajo (se veía ambiguo si el archivo ya estaba
      // subido o no).
      if (data.pdas_prioritarios?.length > 0) { setPdas(data.pdas_prioritarios); setGuardado(true) }
      if (data.pdas_jardin) {
        const esFormatoNuevo = !Array.isArray(data.pdas_jardin) && Array.isArray(data.pdas_jardin.pdas)
        const listaPdas = esFormatoNuevo ? data.pdas_jardin.pdas : (Array.isArray(data.pdas_jardin) ? data.pdas_jardin : [])
        const resumenGuardado = esFormatoNuevo ? data.pdas_jardin.resumen : ''
        if (listaPdas.length > 0) {
          setResultadoJardin({
            pdas_jardin: listaPdas,
            total_vinculados: listaPdas.filter((p: any) => p.vinculado).length,
            resumen: resumenGuardado,
          })
          setGuardadoJardin(true)
        }
      }
      // [jul 2026] evaluacion_individual se guarda como OBJETO
      // ({total_alumnos_detectados, resumen_general, alumnos: [...]})
      // no como arreglo — la condición anterior usaba ".length > 0",
      // que en un objeto siempre es "undefined > 0" = false. Por eso
      // nunca se restauraba correctamente al refrescar, y el código
      // caía al "else", reemplazando silenciosamente los datos reales
      // por un arreglo vacío de relleno (perdiendo la tarjeta verde,
      // aunque el dato seguía intacto en la base de datos).
      const evalGuardada = data.evaluacion_individual
      const evalTieneContenido = evalGuardada && typeof evalGuardada === 'object' && !Array.isArray(evalGuardada) && evalGuardada.resumen_general
      if (evalTieneContenido) {
        setEvaluacionIndividual(evalGuardada)
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
      // Fechas reales de guardado (desde documentos_historial) para las 5
      // secciones con historial versionado — alimenta el "Guardado hace X"
      const resFechas = await fetch(`/api/documentos-historial/fechas?auth_uid=${session.user.id}`)
      const jsonFechas = await resFechas.json()
      if (jsonFechas.ok) setFechasGuardado(jsonFechas.fechas || {})
    }
    load()
  }, [])

  async function revisarDiscrepanciaAlumnos(detectado: number, origen: OrigenConteo) {
    if (!detectado || detectado <= 0) return
    const actual = profile?.total_alumnos
    if (!actual) {
      await actualizarTotalAlumnos(detectado)
      return
    }
    if (actual === detectado) return
    setDiscrepanciaAlumnos({ detectado, origen })
  }

  async function actualizarTotalAlumnos(nuevoTotal: number) {
    setProfile((prev: any) => ({ ...prev, total_alumnos: nuevoTotal }))
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.from('users').update({ total_alumnos: nuevoTotal }).eq('auth_uid', session.user.id)
    }
  }

  async function confirmarActualizarAlumnos() {
    if (!discrepanciaAlumnos) return
    await actualizarTotalAlumnos(discrepanciaAlumnos.detectado)
    setDiscrepanciaAlumnos(null)
  }

  function descartarDiscrepanciaAlumnos() {
    setDiscrepanciaAlumnos(null)
  }

  // Abre el modal de Historial para cualquiera de las 5 secciones que usan
  // documentos_historial (PMC, Diagnóstico Grupal, Diagnóstico Individual,
  // Observaciones de dirección, PDAs del jardín). PA no usa esta función —
  // tiene su propio historial ya construido en programa_analitico.
  async function abrirHistorial(seccion: string, titulo: string) {
    setModalHistorial({ titulo })
    setVersionesHistorial([])
    setCargandoVersiones(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setCargandoVersiones(false); return }
      const res = await fetch(`/api/documentos-historial/lista?auth_uid=${session.user.id}&seccion=${seccion}`)
      const json = await res.json()
      if (json.ok) setVersionesHistorial(json.versiones || [])
    } catch {
      // silencioso — si falla, el modal simplemente se queda sin versiones que mostrar
    }
    setCargandoVersiones(false)
  }

  // Vuelve a consultar las fechas/versiones activas después de guardar algo
  // nuevo, en vez de intentar adivinar la versión desde el frontend
  async function refrescarFechas() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/documentos-historial/fechas?auth_uid=${session.user.id}`)
    const json = await res.json()
    if (json.ok) setFechasGuardado(json.fechas || {})
  }

  async function handleArchivoPMC(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAnalizandoEscolar(true); setErrorEscolar('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.texto) { setErrorEscolar('No se pudo extraer el texto del archivo.'); setAnalizandoEscolar(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setAnalizandoEscolar(false); return }
      const resAnalisis = await fetch('/api/analizar-diagnostico-escolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: data.texto, auth_uid: session.user.id })
      })
      const dataAnalisis = await resAnalisis.json()
      if (dataAnalisis.ok) {
        setResultadoEscolar(dataAnalisis.resultado); setDiagnosticoEscolarGuardado(true)
        refrescarFechas()
      }
      else setErrorEscolar('Error al analizar. Intenta de nuevo.')
    } catch { setErrorEscolar('Error de conexión.') }
    setAnalizandoEscolar(false)
  }

  async function handleArchivoPA(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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
        body: JSON.stringify({ texto: dataTexto.texto, auth_uid: session.user.id, cct: profile.cct_primary, archivo_formato: ext, grado: gradoGrupo })
      })
      const data = await res.json()
      if (data.ok) {
        const nuevaVersion = { id: data.pa_id, version_numero: data.version_numero, fecha_carga: data.fecha_carga, archivo_formato: ext, activo: true, pda_ponderacion: data.resultado, nota_directivo: null }
        setPaActivo(nuevaVersion)
        setHistorialPA(prev => [nuevaVersion, ...prev.map((v: any) => ({ ...v, activo: false }))])
        setHistorialVisible(false)
      } else { setErrorPA('Error al analizar el Programa Analítico.') }
    } catch { setErrorPA('Error de conexión.') }
    finally { setAnalizandoPA(false) }
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
    setAnalizando(true); setErrorDiagnostico(''); setPdas([]); setGuardado(false)
    try {
      const formData = new FormData()
      formData.append('file', archivo)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (!dataTexto.texto) { setErrorDiagnostico('No se pudo extraer el texto.'); setAnalizando(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/analizar-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostico_texto: dataTexto.texto, grado: gradoGrupo, auth_uid: session?.user?.id || profile?.auth_uid })
      })
      const data = await res.json()
      if (data.pdas_sugeridos) {
        setPdas(data.pdas_sugeridos); setGuardado(true)
        refrescarFechas()
        // if (data.total_alumnos_detectado) revisarDiscrepanciaAlumnos(data.total_alumnos_detectado, '2.1')
      }
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
        body: JSON.stringify({ texto_evaluacion: dataTexto.texto, grado: gradoGrupo, auth_uid: session?.user?.id })
      })
      const dataAnalisis = await resAnalisis.json()
      if (dataAnalisis.error) { setErrorEval('Error al analizar.'); setGuardandoEval(false); return }
      setEvaluacionIndividual(dataAnalisis.resultado)
      refrescarFechas()
      const detectado = dataAnalisis.resultado?.total_alumnos_detectados
      if (detectado) revisarDiscrepanciaAlumnos(detectado, '2.2')
    } catch { setErrorEval('Error de conexión.') }
    setGuardandoEval(false)
  }

  async function analizarObservacionesConTexto(texto: string): Promise<boolean> {
    if (!texto.trim()) { setErrorObservaciones('Escribe o sube las observaciones.'); return false }
    setAnalizandoObservaciones(true); setErrorObservaciones('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false
      const res = await fetch('/api/analizar-observaciones-directivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) {
        setResultadoObservaciones(data.resultado); setObservacionesGuardadas(true)
        refrescarFechas()
        return true
      }
      setErrorObservaciones('Error al analizar.')
      return false
    } catch {
      setErrorObservaciones('Error de conexión.')
      return false
    } finally {
      setAnalizandoObservaciones(false)
    }
  }

  function handleAnalizarObservaciones() {
    analizarObservacionesConTexto(observacionesTexto)
  }

  async function handleArchivoObservaciones(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.texto) { setErrorObservaciones('No se pudo extraer el texto.'); return }
      const textoCombinado = observacionesTexto ? observacionesTexto + '\n\n' + data.texto : data.texto
      const exito = await analizarObservacionesConTexto(textoCombinado)
      if (!exito) setObservacionesTexto(textoCombinado)
    } catch { setErrorObservaciones('No se pudo extraer el texto.') }
  }

  async function handleArchivoJardin(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setGuardandoJardin(true); setErrorJardin('')
    const formData = new FormData()
    formData.append('file', archivo)
    try {
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.texto) { setErrorJardin('No se pudo extraer el texto.'); setGuardandoJardin(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setGuardandoJardin(false); return }
      const resAnalisis = await fetch('/api/analizar-pdas-jardin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: data.texto, auth_uid: session.user.id })
      })
      const dataAnalisis = await resAnalisis.json()
      if (dataAnalisis.ok) {
        setResultadoJardin(dataAnalisis)
        setGuardadoJardin(true)
        refrescarFechas()
      } else {
        setErrorJardin('No se pudieron identificar los PDAs del documento.')
      }
    } catch { setErrorJardin('Error al procesar el archivo.') }
    setGuardandoJardin(false)
  }

  async function analizarEstiloConTexto(texto: string): Promise<boolean> {
    if (!texto.trim()) { setErrorEstilo('Escribe o sube un texto.'); return false }
    setAnalizandoEstilo(true); setErrorEstilo('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false
      const res = await fetch('/api/analizar-estilo-narrativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) { setResultadoEstilo(data.resultado); setEstiloGuardado(true); return true }
      setErrorEstilo('Error al analizar.')
      return false
    } catch {
      setErrorEstilo('Error de conexión.')
      return false
    } finally {
      setAnalizandoEstilo(false)
    }
  }

  function handleAnalizarEstilo() {
    analizarEstiloConTexto(estiloTexto)
  }

  async function handleArchivoEstilo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.texto) { setErrorEstilo('No se pudo extraer el texto.'); return }
      const textoCombinado = estiloTexto ? estiloTexto + '\n\n' + data.texto : data.texto
      const exito = await analizarEstiloConTexto(textoCombinado)
      if (!exito) setEstiloTexto(textoCombinado)
    } catch { setErrorEstilo('No se pudo extraer el texto.') }
  }

  const s = {
    page: { padding: '0 40px' } as React.CSSProperties,
    card: { background: 'white', borderRadius: 12, padding: '20px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
    cardTitle: { fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 16px', textAlign: 'center' as const } as React.CSSProperties,
    subTitle: { fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 4px', textAlign: 'center' as const } as React.CSSProperties,
    desc: { fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5, textAlign: 'center' as const } as React.CSSProperties,
    btn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#3D3A8C', color: 'white', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
    btnGreen: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#3D3A8C', color: 'white', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
    ok: { background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column' as const } as React.CSSProperties,
    okText: { margin: 0, fontWeight: 700, color: '#0F6E56', fontSize: 12 } as React.CSSProperties,
    err: { background: '#fee2e2', color: '#991b1b', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginTop: 8 } as React.CSSProperties,
    textarea: { display: 'block', width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, resize: 'none' as const, overflow: 'hidden' as const, fontFamily: 'sans-serif', lineHeight: 1.5, marginBottom: 8, textAlign: 'left' as const } as React.CSSProperties,
    // Fila de acciones unificada — misma posición y estilo en las 6 tarjetas
    // con historial (todas menos la Sección 4)
    accionesFila: { display: 'flex', gap: 14, justifyContent: 'center', marginTop: 'auto', paddingTop: 8, flexWrap: 'wrap' as const } as React.CSSProperties,
    accionBtn: { background: 'none', border: 'none', color: '#0F6E56', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' } as React.CSSProperties,
    badgeMia: { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, cursor: 'pointer' } as React.CSSProperties,
  }

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const totalAlumnos = profile.total_students || profile.total_alumnos || 24
  const evalCompleta = evaluacionIndividual && typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).resumen_general
  const cargandoAnimacionCompleta = analizando

  return (
    <SidebarWrapper profile={profile}>
      {cargandoAnimacionCompleta ? (
        <PantallaAnimacion grado={gradoGrupo} totalAlumnos={totalAlumnos} cct={profile.cct_primary || ''} />
      ) : (
        <div style={{ padding: '0 32px' }}>

          <style>{`
            input[type=number]::-webkit-inner-spin-button,
            input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            input[type=number] { -moz-appearance: textfield; }
          `}</style>
          {/* ENCABEZADO */}
          <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '14px 32px', marginBottom: 20, textAlign: 'center' }}>
            <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>MI GRUPO</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: 13 }}>
              {profile.school_name && <><strong style={{ color: 'rgba(255,255,255,0.9)' }}>JN:</strong> {nombreCorto(profile.school_name)} · </>}
              <strong style={{ color: 'rgba(255,255,255,0.9)' }}>CCT:</strong> {profile.cct_primary} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Grupo:</strong> {profile.grado || '2°'} A · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Alumnos:</strong> <input type="number" min="1" max="50" placeholder="24" value={profile.total_alumnos || ''} onChange={async (e) => { const val = parseInt(e.target.value); if (!val || val < 1) return; await actualizarTotalAlumnos(val); setAlumnosGuardado(true); setTimeout(() => setAlumnosGuardado(false), 2000); }} style={{ width: 44, padding: '1px 4px', fontSize: 13, fontWeight: 700, borderRadius: 6, border: '1.5px solid rgba(255,255,255,0.4)', textAlign: 'center', outline: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', display: 'inline-block', verticalAlign: 'middle' }} />
              {alumnosGuardado && <span style={{ fontSize: 11, color: '#00A896', fontWeight: 600, marginLeft: 4 }}>✓</span>}
            </p>
          </div>

          {discrepanciaAlumnos && (
            <div style={{ background: '#EFF6FF', border: '1.5px solid #93C5FD', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1E40AF', lineHeight: 1.6, flex: 1, minWidth: 260 }}>
                🔔 <strong>MÍA:</strong> detecté <strong>{discrepanciaAlumnos.detectado} alumnos</strong> en {discrepanciaAlumnos.origen === '2.2' ? 'tu Diagnóstico Individual' : 'tu Diagnóstico Grupal'}, pero tienes registrados <strong>{profile.total_alumnos}</strong> en tu grupo. ¿Actualizamos el total a {discrepanciaAlumnos.detectado}?
              </p>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={confirmarActualizarAlumnos}
                  style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✅ Sí, actualizar
                </button>
                <button onClick={descartarDiscrepanciaAlumnos}
                  style={{ background: 'white', border: '1.5px solid #93C5FD', color: '#1E40AF', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✕ Mantener {profile.total_alumnos}
                </button>
              </div>
            </div>
          )}

          {/* GRID 2×2 — cada sección es su propia tarjeta con posición fija en
              la cuadrícula (fila/columna explícita), así el navegador iguala
              automáticamente la altura entre 1↔2 (misma fila) y 3↔4 (misma fila) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>

            {/* Sección 1 · Diagnóstico Escolar (fila 1, columna 1) */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const, gridColumn: 1, gridRow: 1 }}>

              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <p style={s.cardTitle}>1 · Diagnóstico Escolar</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <p style={s.subTitle}>1.1 · PROGRAMA DE MEJORA CONTINUA</p>
                    <p style={s.desc}>Contexto Institucional del Jardín:<br/>Entorno, Organización y Recursos.</p>
                    {!diagnosticoEscolarGuardado ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <label style={{ ...s.btn, opacity: analizandoEscolar ? 0.6 : 1 }}>
                          {analizandoEscolar ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPMC} style={{ display: 'none' }} disabled={analizandoEscolar} />
                        </label>
                        {errorEscolar && <div style={s.err}>{errorEscolar}</div>}
                      </div>
                    ) : (
                      <div style={{ ...s.ok, flex: 1 }}>
                        <p style={s.okText}>✅ PMC guardado</p>
                        <TiempoGuardado fechaISO={fechasGuardado['pmc']?.fecha} />
                        <div style={s.accionesFila}>
                          <button
                            onClick={() => setModalDetalle({
                              titulo: '1.1 · Programa de Mejora Continua',
                              contenido: (
                                <div style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: '12px 14px' }}>
                                  <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, lineHeight: 1.6 }}>{resultadoEscolar?.contexto_social || 'Sin detalle disponible.'}</p>
                                </div>
                              ),
                            })}
                            style={s.accionBtn}
                          >▾ Ver detalle</button>
                          {(fechasGuardado['pmc']?.version ?? 0) >= 2 && (
                            <button onClick={() => abrirHistorial('pmc', '1.1 · Historial del PMC')} style={s.accionBtn}>▾ Historial</button>
                          )}
                          <label style={s.accionBtn}>
                            ↑ Actualizar
                            <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPMC} style={{ display: 'none' }} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <p style={s.subTitle}>1.2 · Programa Analítico</p>
                    <p style={s.desc}>PDA Y Contenidos priorizados por el colectivo.<br/>Acepta formato .docx, .pptx, .pdf.</p>
                    {!paActivo ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <label style={{ ...s.btn, opacity: analizandoPA ? 0.6 : 1, cursor: analizandoPA ? 'default' : 'pointer' }}>
                          {analizandoPA ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                        </label>
                        {analizandoPA && <p style={{ fontSize: 11, color: '#3D3A8C', margin: '6px 0 0' }}>MÍA está leyendo el PA...</p>}
                        {errorPA && <div style={s.err}>{errorPA}</div>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ ...s.ok, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                            <p style={s.okText}>✅ PA cargado · <span style={{ fontWeight: 400 }}>v{paActivo.version_numero}</span></p>
                            {paActivo.pda_ponderacion?.inconsistencias?.length > 0 && (
                              <button onClick={() => setModalMiaPA(true)} style={s.badgeMia}>⚠ MÍA</button>
                            )}
                          </div>
                          <TiempoGuardado fechaISO={paActivo.fecha_carga} />
                          {paActivo.nota_directivo && (
                            <p style={{ fontSize: 11, color: '#185FA5', margin: '6px 0 0' }}>💬 {paActivo.nota_directivo}</p>
                          )}
                          <div style={s.accionesFila}>
                            <button
                              onClick={() => setModalDetalle({
                                titulo: '1.2 · Resumen del Programa Analítico',
                                contenido: (
                                  <div style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: '12px 14px' }}>
                                    <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, lineHeight: 1.6 }}>{paActivo.pda_ponderacion?.resumen_pa || 'Sin resumen disponible.'}</p>
                                  </div>
                                ),
                              })}
                              style={s.accionBtn}
                            >▾ Ver detalle</button>
                            {paActivo.version_numero >= 2 && (
                              <button onClick={toggleHistorial} style={s.accionBtn}>▾ Historial</button>
                            )}
                            <label style={s.accionBtn}>
                              ↑ Actualizar
                              <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                            </label>
                          </div>
                        </div>
                        {errorPA && <div style={s.err}>{errorPA}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sección 3 · Recomendaciones Directivas (fila 2, columna 1) */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const, gridColumn: 1, gridRow: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <p style={s.cardTitle}>3 · Recomendaciones Directivas</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <p style={s.subTitle}>3.1 · Áreas de Oportunidad</p>
                    <p style={s.desc}>Observaciones de tu última visita áulica.<br/>MÍA las integrará en tus planeaciones.</p>
                    {!observacionesGuardadas ? (
                      <div style={{ flex: 1 }}>
                        <textarea value={observacionesTexto} onChange={e => setObservacionesTexto(e.target.value)} onInput={ajustarAlturaTextarea} rows={3}
                          placeholder="Ej: La directora me indicó trabajar más la expresión oral..."
                          style={s.textarea} />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                          <button onClick={handleAnalizarObservaciones} disabled={analizandoObservaciones || !observacionesTexto.trim()}
                            style={{ background: analizandoObservaciones || !observacionesTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {analizandoObservaciones ? '🔍...' : '✨ Guardar'}
                          </button>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {analizandoObservaciones ? '🔍 Analizando...' : '📎 Archivo'}
                            <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} disabled={analizandoObservaciones} />
                          </label>
                        </div>
                        {errorObservaciones && <div style={s.err}>{errorObservaciones}</div>}
                        <p style={{ fontSize: 10, color: '#aaa', marginTop: 6 }}>Opcional · al subir un archivo se analiza automáticamente</p>
                      </div>
                    ) : (
                      <div style={{ ...s.ok, flex: 1 }}>
                        <p style={s.okText}>✅ Observaciones integradas</p>
                        <TiempoGuardado fechaISO={fechasGuardado['observaciones_directivo']?.fecha} />
                        <div style={s.accionesFila}>
                          <button
                            onClick={() => setModalDetalle({
                              titulo: '3.1 · Áreas de oportunidad',
                              contenido: (
                                <div>
                                  {resultadoObservaciones?.areas_mejora?.length > 0
                                    ? resultadoObservaciones.areas_mejora.map((area: string, i: number) => (
                                        <div key={i} style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: '10px 12px', marginBottom: i < resultadoObservaciones.areas_mejora.length - 1 ? 8 : 0 }}>
                                          <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.5 }}>{area}</p>
                                        </div>
                                      ))
                                    : <p style={{ fontSize: 13, color: '#444', margin: 0 }}>Sin áreas de mejora registradas.</p>}
                                </div>
                              ),
                            })}
                            style={s.accionBtn}
                          >▾ Ver detalle</button>
                          {(fechasGuardado['observaciones_directivo']?.version ?? 0) >= 2 && (
                            <button onClick={() => abrirHistorial('observaciones_directivo', '3.1 · Historial de observaciones')} style={s.accionBtn}>▾ Historial</button>
                          )}
                          <button onClick={() => { setObservacionesGuardadas(false); setResultadoObservaciones(null); setObservacionesTexto('') }} style={s.accionBtn}>↑ Actualizar</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <p style={s.subTitle}>3.2 · PDAs del jardín <span style={{ fontSize: 10, background: '#F8F8FE', color: '#888', border: '1px solid #D8D6F0', padding: '1px 6px', borderRadius: 10, fontWeight: 600, marginLeft: 4 }}>Opcional</span></p>
                    <p style={s.desc}>PDAs acordados por el colectivo este ciclo.<br/>El sistema los integrará con tu diagnóstico.</p>
                    {!guardadoJardin ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <label style={{ ...s.btn, opacity: guardandoJardin ? 0.6 : 1 }}>
                          {guardandoJardin ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} disabled={guardandoJardin} />
                        </label>
                        {errorJardin && <div style={s.err}>{errorJardin}</div>}
                      </div>
                    ) : (
                      <div style={{ ...s.ok, flex: 1 }}>
                        <p style={s.okText}>✅ {resultadoJardin?.total_vinculados ?? resultadoJardin?.pdas_jardin?.length ?? 0} PDA{(resultadoJardin?.total_vinculados ?? 0) !== 1 ? 's' : ''} del jardín identificado{(resultadoJardin?.total_vinculados ?? 0) !== 1 ? 's' : ''}</p>
                        <TiempoGuardado fechaISO={fechasGuardado['pdas_jardin']?.fecha} />
                        <div style={s.accionesFila}>
                          <button
                            onClick={() => setModalDetalle({
                              titulo: '3.2 · PDAs del jardín',
                              contenido: (
                                <div style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: '12px 14px' }}>
                                  <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, lineHeight: 1.6 }}>{resultadoJardin?.resumen || 'Sin resumen disponible.'}</p>
                                </div>
                              ),
                            })}
                            style={s.accionBtn}
                          >▾ Ver detalle</button>
                          {(fechasGuardado['pdas_jardin']?.version ?? 0) >= 2 && (
                            <button onClick={() => abrirHistorial('pdas_jardin', '3.2 · Historial de PDAs del jardín')} style={s.accionBtn}>▾ Historial</button>
                          )}
                          <label style={s.accionBtn}>
                            ↑ Actualizar
                            <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Sección 2 · Diagnóstico Pedagógico (fila 1, columna 2) */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const, gridColumn: 2, gridRow: 1 }}>

              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <p style={s.cardTitle}>2 · Diagnóstico Pedagógico</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <p style={s.subTitle}>2.1 · Diagnóstico Grupal</p>
                    <p style={s.desc}>Necesidades y áreas de oportunidad del Grupo,<br/>para personalizar tu planeaciones.</p>
                    {!guardado ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <label style={{ ...s.btnGreen, opacity: analizando ? 0.6 : 1 }}>
                          {analizando ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} disabled={analizando} />
                        </label>
                        {errorDiagnostico && <div style={s.err}>{errorDiagnostico}</div>}
                      </div>
                    ) : (
                      <div style={{ ...s.ok, flex: 1 }}>
                        <p style={s.okText}>✅ Diagnóstico guardado</p>
                        <TiempoGuardado fechaISO={fechasGuardado['diagnostico_grupal']?.fecha} />
                        <p style={{ fontSize: 11, color: '#444', margin: '3px 0 0' }}>{pdas.length} PDAs prioritarios identificados</p>
                        <div style={s.accionesFila}>
                          <button
                            onClick={() => {
                              const grupos: Record<string, { campo: string; contenido: string; items: any[] }> = {}
                              pdas.forEach((p) => {
                                const key = `${p.campo}||${p.contenido}`
                                if (!grupos[key]) grupos[key] = { campo: p.campo, contenido: p.contenido, items: [] }
                                grupos[key].items.push(p)
                              })
                              setModalDetalle({
                                titulo: '2.1 · PDAs priorizados para tu grupo',
                                contenido: (
                                  <div>
                                    {Object.values(grupos).map((grupo, gi) => (
                                      <div key={gi} style={{ border: '1px solid #E0F5F3', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: '#FAFFFE' }}>
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                                          <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{grupo.campo}</span>
                                          <span style={{ background: '#F0FFF8', color: '#059669', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{grupo.items.length} PDA{grupo.items.length > 1 ? 's' : ''}</span>
                                        </div>
                                        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.4 }}>{grupo.contenido}</p>
                                        {grupo.items.map((p, pi) => (
                                          <div key={pi} style={{ background: 'white', border: '1px solid #C8EFE9', borderRadius: 6, padding: '8px 10px', marginBottom: 4 }}>
                                            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#1A1A2E', lineHeight: 1.5, fontStyle: 'italic' }}>{p.pda}</p>
                                            <p style={{ margin: 0, fontSize: 11, color: '#666', lineHeight: 1.4 }}>{p.justificacion}</p>
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                ),
                              })
                            }}
                            style={s.accionBtn}
                          >▾ Ver detalle</button>
                          {(fechasGuardado['diagnostico_grupal']?.version ?? 0) >= 2 && (
                            <button onClick={() => abrirHistorial('diagnostico_grupal', '2.1 · Historial del diagnóstico grupal')} style={s.accionBtn}>▾ Historial</button>
                          )}
                          <label style={s.accionBtn}>
                            ↑ Actualizar
                            <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <p style={s.subTitle}>2.2 · Diagnóstico Individual</p>
                    <p style={s.desc}>Evaluación por alumno.<br/>MÍA protege nombres y detecta NNE.</p>
                    {!evalCompleta ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <label style={{ ...s.btn, opacity: guardandoEval ? 0.6 : 1 }}>
                          {guardandoEval ? '✦ Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} disabled={guardandoEval} onChange={handleArchivoEvaluacionIndividual} />
                        </label>
                      <p style={{ fontSize: 10, color: '#aaa', margin: '8px 0 0', textAlign: 'center' }}>🔒 Nombres nunca almacenados</p>
                        {errorEval && <div style={s.err}>{errorEval}</div>}
                      </div>
                    ) : (
                      <div style={{ ...s.ok, flex: 1 }}>
                        <p style={s.okText}>✅ Evaluación completa</p>
                        <TiempoGuardado fechaISO={fechasGuardado['diagnostico_individual']?.fecha} />
                        <p style={{ fontSize: 11, color: '#444', margin: '3px 0 0' }}>{(evaluacionIndividual as any).total_alumnos_detectados || 0} alumnos · {(evaluacionIndividual as any).alumnos_con_nee > 0 ? `⚠ ${(evaluacionIndividual as any).alumnos_con_nee} con NEE` : 'sin NEE detectadas'}</p>
                        <div style={s.accionesFila}>
                          <button
                            onClick={() => setModalDetalle({
                              titulo: '2.2 · PDAs prioritarios (Diagnóstico Individual)',
                              contenido: (
                                <div>
                                  {(evaluacionIndividual as any)?.pdas_prioritarios_grupo?.length > 0
                                    ? (evaluacionIndividual as any).pdas_prioritarios_grupo.map((pda: any, i: number) => {
                                        const esObjeto = typeof pda !== 'string'
                                        return (
                                          <div key={i} style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                                            {esObjeto && pda?.campo && (
                                              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                                                <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{pda.campo}</span>
                                              </div>
                                            )}
                                            {esObjeto && pda?.contenido && (
                                              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.4 }}>{pda.contenido}</p>
                                            )}
                                            <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.5, fontStyle: 'italic' }}>
                                              {esObjeto ? pda.pda : pda}
                                            </p>
                                          </div>
                                        )
                                      })
                                    : <p style={{ fontSize: 13, color: '#444', margin: 0 }}>Sin PDAs prioritarios registrados.</p>}
                                </div>
                              ),
                            })}
                            style={s.accionBtn}
                          >▾ Ver detalle</button>
                          {(fechasGuardado['diagnostico_individual']?.version ?? 0) >= 2 && (
                            <button onClick={() => abrirHistorial('diagnostico_individual', '2.2 · Historial del diagnóstico individual')} style={s.accionBtn}>▾ Historial</button>
                          )}
                          <label style={s.accionBtn}>
                            ↑ Actualizar
                            <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleArchivoEvaluacionIndividual} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sección 4 · Mi estilo de narración (fila 2, columna 2) */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const, gridColumn: 2, gridRow: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <p style={s.cardTitle}>4 · Mi estilo de narración</p>
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5, textAlign: 'center' }}>
                  Comparte cómo escribes: una carta a padres, unas notas, cualquier texto tuyo.<br/>MÍA aprenderá de ti para que tus planeaciones suenen a ti, con tu tono y estilo personal.
                </p>
                {!estiloGuardado ? (
                  <div style={{ flex: 1 }}>
                    <textarea value={estiloTexto} onChange={e => setEstiloTexto(e.target.value)} onInput={ajustarAlturaTextarea} rows={4}
                      placeholder="Ej: Estimadas familias, quiero compartirles que esta semana trabajamos con los niños explorando..."
                      style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 10 } as React.CSSProperties}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                      <button onClick={handleAnalizarEstilo} disabled={analizandoEstilo || !estiloTexto.trim()}
                        style={{ background: analizandoEstilo || !estiloTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {analizandoEstilo ? '🔍 Analizando...' : '✨ Analizar estilo'}
                      </button>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {analizandoEstilo ? '🔍 Analizando...' : '📎 O sube un documento'}
                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEstilo} style={{ display: 'none' }} disabled={analizandoEstilo} />
                      </label>
                    </div>
                    {errorEstilo && <div style={s.err}>{errorEstilo}</div>}
                    <p style={{ fontSize: 10, color: '#aaa', marginTop: 6 }}>Al subir un documento se analiza automáticamente</p>
                  </div>
                ) : (
                  <div style={{ ...s.ok, flex: 1 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <p style={s.okText}>✅ Estilo de escritura guardado</p>
                      {resultadoEstilo?.tono && <p style={{ fontSize: 12, color: '#444', margin: '4px 0 0' }}><strong>Tono:</strong> {resultadoEstilo.tono}</p>}
                    </div>
                    <button onClick={() => { setEstiloGuardado(false); setResultadoEstilo(null); setEstiloTexto('') }}
                      style={{ ...s.accionBtn, marginTop: 'auto', paddingTop: 8, alignSelf: 'center' }}>↑ Actualizar</button>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div style={{ height: 40 }} />

          {/* Modal genérico de "Ver detalle" — usado por las 6 tarjetas */}
          {modalDetalle && (
            <DetalleModal titulo={modalDetalle.titulo} onClose={() => setModalDetalle(null)}>
              {modalDetalle.contenido}
            </DetalleModal>
          )}

          {/* Modal de "Historial" para las 5 secciones que usan documentos_historial */}
          {modalHistorial && (
            <DetalleModal titulo={modalHistorial.titulo} onClose={() => setModalHistorial(null)}>
              {cargandoVersiones ? (
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Cargando...</p>
              ) : versionesHistorial.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>No hay versiones anteriores todavía.</p>
              ) : (
                versionesHistorial.map((v: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingBottom: i < versionesHistorial.length - 1 ? 8 : 0, marginBottom: i < versionesHistorial.length - 1 ? 8 : 0, borderBottom: i < versionesHistorial.length - 1 ? '1px solid #F0EFF8' : 'none' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.activo ? '#1D9E75' : '#D1D5DB', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>v{v.version_numero}</span>
                      {v.activo && <span style={{ marginLeft: 6, fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>activa</span>}
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{formatearFecha(v.created_at)}</p>
                      {v.resumen && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#444', lineHeight: 1.4 }}>{v.resumen}</p>}
                    </div>
                  </div>
                ))
              )}
            </DetalleModal>
          )}

          {/* Modal de Historial del PA — reutiliza los datos que ya se cargan
              desde /api/analizar-programa-analitico (no usa documentos_historial) */}
          {historialVisible && (
            <DetalleModal titulo="1.2 · Historial del Programa Analítico" onClose={() => setHistorialVisible(false)}>
              {cargandoHistorial ? (
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Cargando...</p>
              ) : (
                <>
                  {historialPA.map((v: any, i: number) => (
                    <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingBottom: i < historialPA.length - 1 ? 8 : 0, marginBottom: i < historialPA.length - 1 ? 8 : 0, borderBottom: i < historialPA.length - 1 ? '1px solid #F0EFF8' : 'none' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.activo ? '#1D9E75' : '#D1D5DB', marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>v{v.version_numero}</span>
                        {v.activo && <span style={{ marginLeft: 6, fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>activa</span>}
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{formatearFecha(v.fecha_carga)}</p>
                        {v.nota_directivo && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#185FA5' }}>💬 {v.nota_directivo}</p>}
                      </div>
                    </div>
                  ))}
                  {paActivo && (() => {
                    const dias = Math.floor((Date.now() - new Date(paActivo.fecha_carga).getTime()) / (1000 * 60 * 60 * 24))
                    if (dias < 30) return null
                    return (
                      <div style={{ marginTop: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '8px 10px', display: 'flex', gap: 6 }}>
                        <span style={{ flexShrink: 0 }}>🔔</span>
                        <p style={{ margin: 0, fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
                          <strong>MÍA:</strong> Han pasado {dias} días. Si hubo ajustes en tu último CTE, actualiza el PA.
                        </p>
                      </div>
                    )
                  })()}
                </>
              )}
            </DetalleModal>
          )}

          {/* Modal de observaciones de MÍA sobre inconsistencias del PA */}
          {modalMiaPA && paActivo?.pda_ponderacion?.inconsistencias && (
            <DetalleModal titulo="⚠ Observaciones de MÍA sobre el PA" onClose={() => setModalMiaPA(false)}>
              {paActivo.pda_ponderacion.inconsistencias.map((obs: any, i: number) => {
                const esTexto = typeof obs === 'string'
                const descripcion = esTexto ? obs : (obs?.descripcion || 'Sin descripción.')
                const tieneCampos = !esTexto && (obs?.campo_correcto || obs?.campo_incorrecto)
                return (
                  <div
                    key={i}
                    style={{
                      background: '#F8FFFE',
                      border: '1px solid #C8EFE9',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginBottom: i < paActivo.pda_ponderacion.inconsistencias.length - 1 ? 10 : 0,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.5 }}>{descripcion}</p>
                    {tieneCampos && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E0F5F3', display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                        {obs?.campo_incorrecto && (
                          <span style={{ fontSize: 10, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                            Detectado: {obs.campo_incorrecto}
                          </span>
                        )}
                        {obs?.campo_correcto && (
                          <span style={{ fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                            Sugerido: {obs.campo_correcto}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </DetalleModal>
          )}
        </div>
      )}
    </SidebarWrapper>
  )
}