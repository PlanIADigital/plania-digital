'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import DetalleModal from '@/components/DetalleModal'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetchConSesion'
import TarjetaEstilosAprendizaje from '@/components/TarjetaEstilosAprendizaje'
import GrupoAlumnosApoyos, { sugerenciasPendientes } from '@/components/GrupoAlumnosApoyos'

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
      <p style={{ color: '#888', fontSize: 13, marginBottom: 28, marginTop: 0 }}>{grado} grado{totalAlumnos ? ` · ${totalAlumnos} alumnos` : ''} · {cct}</p>
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
    <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{formatearTiempoRelativo(fechaISO)}</p>
  )
}

const GRADO_MAP: Record<string, string> = { '1er Grado': '1°', '2do Grado': '2°', '3er Grado': '3°' }
const GRADOS_OPCIONES = ['1er Grado', '2do Grado', '3er Grado']
type OrigenConteo = '3.1' | '3.2'
interface DiscrepanciaAlumnos {
  detectado: number
  origen: OrigenConteo
}

// [30 sep 2026] Rediseño de Mi Grupo con el lenguaje visual de
// "El alma de tu planeación" (Nueva Planeación, Fase 1): una columna,
// texto a la izquierda, etiqueta de origen y dos estados (pendiente / ✓ guardado).
const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  menta: '#E8F5F2',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
  borde: '#E0DFF5',
}

// Mismas etiquetas y colores que usa MÍA en Nueva Planeación (Fase1Alma.tsx),
// para que la educadora reconozca de dónde sale cada problemática detectada.
type OrigenMiGrupo = 'PMC' | 'PA' | 'Grupo' | 'Dirección' | 'Jardín'
const COLOR_ORIGEN: Record<OrigenMiGrupo, { fg: string; bg: string }> = {
  'Grupo': { fg: '#0F6E56', bg: '#E0F5F3' },
  'PMC': { fg: '#3D3A8C', bg: '#EEEDF8' },
  'PA': { fg: '#00796B', bg: '#E8F5F2' },
  'Dirección': { fg: '#5B3F8C', bg: '#F1ECF8' },
  'Jardín': { fg: '#6B5B2E', bg: '#F5F0E1' },
}

const chipOpcional: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: C.gris, border: '1px solid #D8D6F0',
  borderRadius: 99, padding: '1px 8px', marginLeft: 8, letterSpacing: '0.04em',
  textTransform: 'none', verticalAlign: 'middle',
}

function TarjetaDoc({ numero, titulo, descripcion, origen, opcional, guardado, children }: {
  numero: string
  titulo: string
  descripcion: string
  origen?: OrigenMiGrupo
  opcional?: boolean
  guardado: boolean
  children: React.ReactNode
}) {
  const color = origen ? COLOR_ORIGEN[origen] : null
  // [30 sep 2026] La etiqueta de origen va JUNTO al título (no en su propio
  // renglón): así título y descripción quedan juntos y el botón sube.
  const encabezado = (
    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: guardado ? C.cian : C.indigo, textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1.6 }}>
      {guardado ? '✓ ' : ''}{numero} · {titulo}
      {color && origen && (
        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: color.fg, background: color.bg, borderRadius: 99, padding: '2px 8px', marginLeft: 8, verticalAlign: 'middle', lineHeight: 1.4 }}>
          {origen.toUpperCase()}
        </span>
      )}
      {opcional && <span style={chipOpcional}>Opcional</span>}
    </p>
  )
  return (
    <div style={{
      background: guardado ? '#FAFFFE' : 'white',
      border: `1px solid ${guardado ? C.cian : C.borde}`,
      borderRadius: 12, padding: 16, marginBottom: 12,
    }}>
      {!guardado ? (
        // Pendiente: título + descripción a la izquierda; acción compacta a la
        // derecha, centrada en la altura. En pantallas angostas la acción baja sola.
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            {encabezado}
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.gris, lineHeight: 1.6 }}>{descripcion}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '100%' }}>
            {children}
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 4 }}>{encabezado}</div>
          {children}
        </>
      )}
    </div>
  )
}

export default function MiGrupoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [alumnosGuardado, setAlumnosGuardado] = useState(false)
  const [gradoGuardado, setGradoGuardado] = useState(false)
  const [grupoLetraGuardado, setGrupoLetraGuardado] = useState(false)
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

// 2C — Códigos de alumnos (roster)
const [modalAlumnos, setModalAlumnos] = useState(false)
// [Saneado 27 sep 2026] Número de alumnos = códigos AL-XX activos (fuente única).
const [codigosActivos, setCodigosActivos] = useState<number | null>(null)
const [alumnosCodigo, setAlumnosCodigo] = useState<any[]>([])
const [cargandoAlumnos, setCargandoAlumnos] = useState(false)
const [errorAlumnos, setErrorAlumnos] = useState('')

  // 3A — Observaciones del directivo
  const [observacionesTexto, setObservacionesTexto] = useState('')
  const [analizandoObservaciones, setAnalizandoObservaciones] = useState(false)
  const [observacionesGuardadas, setObservacionesGuardadas] = useState(false)
  const [modalObservacionesAbierto, setModalObservacionesAbierto] = useState(false)
  const [observacionesModalExito, setObservacionesModalExito] = useState(false)
  const [errorObservaciones, setErrorObservaciones] = useState('')
  const [resultadoObservaciones, setResultadoObservaciones] = useState<any>(null)

  // 3B — PDAs del jardín
  const [guardandoJardin, setGuardandoJardin] = useState(false)
  const [guardadoJardin, setGuardadoJardin] = useState(false)
  const [errorJardin, setErrorJardin] = useState('')
  const [resultadoJardin, setResultadoJardin] = useState<any>(null)

  // [Saneado 27 sep 2026 — Fase 2] Sin grado no se supone '2°': grado y grupo
  // son obligatorios para analizar documentos (y para planear).
  const gradoGrupo = profile?.grado ? (GRADO_MAP[profile.grado] || profile.grado) : ''
  const grupoConfigurado = !!profile?.grado && !!profile?.grupo_letra

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
      try {
        const resCodigos = await fetchConSesion('/api/alumnos-codigo')
        const jsonCodigos = await resCodigos.json()
        if (jsonCodigos.ok) {
          const activos = (jsonCodigos.alumnos || []).length
          setCodigosActivos(activos)
          if (activos > 0 && data.total_alumnos !== activos) setProfile((prev: any) => ({ ...prev, total_alumnos: activos }))
        }
      } catch { /* sin conexión: se muestra el total guardado */ }
      if (data.observaciones_directivo) { setResultadoObservaciones(data.observaciones_directivo); setObservacionesGuardadas(true) }
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
        const res = await fetchConSesion(`/api/analizar-programa-analitico?cct=${data.cct_primary}`)
        const json = await res.json()
        if (json.ok && json.historial?.length > 0) {
          const activo = json.historial.find((v: any) => v.activo)
          if (activo) setPaActivo(activo)
          setHistorialPA(json.historial)
        }
      }
      // Fechas reales de guardado (desde documentos_historial) para las 5
      // secciones con historial versionado — alimenta el "Guardado hace X"
      const resFechas = await fetchConSesion('/api/documentos-historial/fechas')
      const jsonFechas = await resFechas.json()
      if (jsonFechas.ok) setFechasGuardado(jsonFechas.fechas || {})
    }
    load()
  }, [])

  async function revisarDiscrepanciaAlumnos(detectado: number, origen: OrigenConteo) {
    if (!detectado || detectado <= 0) return
    // [Saneado 27 sep 2026] MÍA solo PREGUNTA: nunca cambia el total por su cuenta.
    // Con códigos, la referencia es la lista de alumnos activos.
    const actual = codigosActivos && codigosActivos > 0 ? codigosActivos : profile?.total_alumnos
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
  async function actualizarGrado(nuevoGrado: string) {
    setProfile((prev: any) => ({ ...prev, grado: nuevoGrado }))
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.from('users').update({ grado: nuevoGrado }).eq('auth_uid', session.user.id)
    }
    setGradoGuardado(true)
    setTimeout(() => setGradoGuardado(false), 2000)
  }
 
  async function actualizarGrupoLetra(nuevaLetra: string) {
    setProfile((prev: any) => ({ ...prev, grupo_letra: nuevaLetra }))
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.from('users').update({ grupo_letra: nuevaLetra }).eq('auth_uid', session.user.id)
    }
    setGrupoLetraGuardado(true)
    setTimeout(() => setGrupoLetraGuardado(false), 2000)
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
      const res = await fetchConSesion(`/api/documentos-historial/lista?seccion=${seccion}`)
      const json = await res.json()
      if (json.ok) setVersionesHistorial(json.versiones || [])
    } catch {
      // silencioso — si falla, el modal simplemente se queda sin versiones que mostrar
    }
    setCargandoVersiones(false)
  }
async function abrirModalAlumnos() {
  // [Saneado 27 sep 2026] La carga del grupo, altas, bajas y apoyos viven
  // en components/GrupoAlumnosApoyos.tsx (flujo MÍA sugiere, educadora confirma).
  setModalAlumnos(true)
}
  // Vuelve a consultar las fechas/versiones activas después de guardar algo
  // nuevo, en vez de intentar adivinar la versión desde el frontend
  async function refrescarFechas() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetchConSesion('/api/documentos-historial/fechas')
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
      const resAnalisis = await fetchConSesion('/api/analizar-diagnostico-escolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: data.texto })
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
    if (!grupoConfigurado) { setErrorPA('Primero configura tu grupo (grado y grupo) en la parte de arriba.'); e.target.value = ''; return }
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
      const res = await fetchConSesion('/api/analizar-programa-analitico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: dataTexto.texto, cct: profile.cct_primary, archivo_formato: ext, grado: gradoGrupo })
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
        const res = await fetchConSesion(`/api/analizar-programa-analitico?cct=${profile.cct_primary}`)
        const json = await res.json()
        if (json.ok) setHistorialPA(json.historial || [])
      }
      setCargandoHistorial(false)
    }
  }

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    if (!grupoConfigurado) { setErrorDiagnostico('Primero configura tu grupo (grado y grupo) en la parte de arriba.'); e.target.value = ''; return }
    setAnalizando(true); setErrorDiagnostico(''); setPdas([]); setGuardado(false)
    try {
      const formData = new FormData()
      formData.append('file', archivo)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (!dataTexto.texto) { setErrorDiagnostico('No se pudo extraer el texto.'); setAnalizando(false); return }
      const res = await fetchConSesion('/api/analizar-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostico_texto: dataTexto.texto, grado: gradoGrupo })
      })
      const data = await res.json()
      if (data.pdas_sugeridos) {
        setPdas(data.pdas_sugeridos); setGuardado(true)
        refrescarFechas()
        // if (data.total_alumnos_detectado) revisarDiscrepanciaAlumnos(data.total_alumnos_detectado, '3.1')
      }
      else setErrorDiagnostico(data.error || 'No se pudieron analizar los PDAs.')
    } catch { setErrorDiagnostico('Error de conexión.') }
    setAnalizando(false)
  }

  async function handleArchivoEvaluacionIndividual(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!grupoConfigurado) { setErrorEval('Primero configura tu grupo (grado y grupo) en la parte de arriba.'); e.target.value = ''; return }
    setGuardandoEval(true); setErrorEval('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (dataTexto.error) { setErrorEval('Error al leer el archivo.'); setGuardandoEval(false); return }
      const resAnalisis = await fetchConSesion('/api/analizar-evaluacion-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto_evaluacion: dataTexto.texto, grado: gradoGrupo })
      })
      const dataAnalisis = await resAnalisis.json()
      if (dataAnalisis.error) { setErrorEval('Error al analizar.'); setGuardandoEval(false); return }
      setEvaluacionIndividual(dataAnalisis.resultado)
      refrescarFechas()
      const detectado = dataAnalisis.resultado?.total_alumnos_detectados
      if (detectado) revisarDiscrepanciaAlumnos(detectado, '3.2')
    } catch { setErrorEval('Error de conexión.') }
    setGuardandoEval(false)
  }

  async function analizarObservacionesConTexto(texto: string): Promise<boolean> {
    if (!texto.trim()) { setErrorObservaciones('Escribe o sube las observaciones.'); return false }
    setAnalizandoObservaciones(true); setErrorObservaciones('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false
      const res = await fetchConSesion('/api/analizar-observaciones-directivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto })
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

    async function handleAnalizarObservaciones() {
    const exito = await analizarObservacionesConTexto(observacionesTexto)
    if (exito) setObservacionesModalExito(true)
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
      if (exito) setObservacionesModalExito(true)
      else setObservacionesTexto(textoCombinado)
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
      const resAnalisis = await fetchConSesion('/api/analizar-pdas-jardin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: data.texto })
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
  const s = {
    card: { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 12 } as React.CSSProperties,
    titulo: { margin: 0, fontSize: 13, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as React.CSSProperties,
    seccion: { margin: '24px 0 10px', fontSize: 12, fontWeight: 700, color: C.gris, textTransform: 'uppercase' as const, letterSpacing: '0.08em' } as React.CSSProperties,
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.gris, marginBottom: 4 } as React.CSSProperties,
    select: { padding: '9px 10px', fontSize: 16, borderRadius: 8, border: `1px solid ${C.borde}`, background: 'white', width: 80, height: 44, lineHeight: '24px', boxSizing: 'border-box' as const } as React.CSSProperties,
    check: { fontSize: 12, color: C.cian, fontWeight: 700, marginLeft: 6 } as React.CSSProperties,
    subir: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxSizing: 'border-box' as const, background: C.indigoClaro, color: C.indigo, border: `1.5px solid ${C.indigo}`, padding: '9px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const } as React.CSSProperties,
    nota: { margin: '4px 0 0', fontSize: 11, color: C.gris, textAlign: 'right' as const } as React.CSSProperties,
    aviso: { margin: '8px 0 0', fontSize: 13, color: C.indigo, background: C.indigoClaro, borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 } as React.CSSProperties,
    err: { margin: '8px 0 0', fontSize: 13, color: C.indigo, background: C.indigoClaro, borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 } as React.CSSProperties,
    dato: { margin: '4px 0 0', fontSize: 14, color: C.texto, lineHeight: 1.5 } as React.CSSProperties,
    acciones: { display: 'flex', gap: 18, flexWrap: 'wrap' as const, marginTop: 10 } as React.CSSProperties,
    accionBtn: { background: 'none', border: 'none', color: C.indigo, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', fontFamily: 'inherit' } as React.CSSProperties,
    miaCaja: { background: C.indigoClaro, borderLeft: `3px solid ${C.indigo}`, borderRadius: 8, padding: '8px 10px', margin: '8px 0 0', fontSize: 13, color: C.texto, lineHeight: 1.5, cursor: 'pointer' } as React.CSSProperties,
    textarea: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: `1px solid ${C.borde}`, boxSizing: 'border-box' as const, resize: 'none' as const, overflow: 'hidden' as const, fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 8, textAlign: 'left' as const } as React.CSSProperties,
    btnPrimario: { background: C.indigo, color: 'white', border: 'none', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
    btnSecundario: { background: 'white', color: C.indigo, border: `1.5px solid ${C.borde}`, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  }

  // Avance amable de Mi Grupo (no punitivo): cuántas de las 7 tarjetas tienen algo guardado.
  const evalRegistrada = !!(evaluacionIndividual && typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).resumen_general)
  const registrados = [
    diagnosticoEscolarGuardado, !!paActivo, guardadoJardin, observacionesGuardadas,
    guardado, evalRegistrada, !!profile?.estilos_aprendizaje,
  ].filter(Boolean).length

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const totalAlumnos = profile.total_alumnos || 0
  const evalCompleta = evaluacionIndividual && typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).resumen_general
  const cargandoAnimacionCompleta = analizando

  return (
    <SidebarWrapper profile={profile}>
      {cargandoAnimacionCompleta ? (
        <PantallaAnimacion grado={gradoGrupo} totalAlumnos={totalAlumnos} cct={profile.cct_primary || ''} />
      ) : (
        <div style={{ padding: '0 16px' }}>

          <style>{`
            input[type=number]::-webkit-inner-spin-button,
            input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            input[type=number] { -moz-appearance: textfield; }
          `}</style>
          {/* ENCABEZADO — institucional vive solo en la ficha del Sidebar */}
          <EncabezadoPagina
            antetitulo="Configurar"
            titulo="Mi grupo"
            subtitulo={grupoConfigurado
              ? `${gradoGrupo} ${profile.grupo_letra} · ${codigosActivos || totalAlumnos} alumnos · Ciclo ${CICLO_ESCOLAR_ACTIVO}`
              : 'Elige tu grado y grupo para empezar.'}
          />

          {/* [30 sep 2026] Rediseño: una sola columna, mismo lenguaje visual que
              "El alma de tu planeación". Solo cambia la presentación: handlers,
              modales, historial y altas/bajas quedan intactos. */}
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Introducción + avance (reemplaza el aviso amarillo) */}
            <div style={{ ...s.card, background: C.menta, borderColor: '#CDEBE4' }}>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: C.indigo }}>Así conoce MÍA a tu grupo</p>
              <p style={{ margin: 0, fontSize: 13, color: '#335', lineHeight: 1.6 }}>
                Lo que registres aquí es lo que MÍA usa para <strong>personalizar tus planeaciones</strong>. Lo subes una vez y lo actualizas cuando cambie.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'white', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((registrados / 7) * 100)}%`, height: '100%', background: C.cian, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.indigo, whiteSpace: 'nowrap' as const }}>{registrados} de 7 registrados</span>
              </div>
              {(!guardado || !evalCompleta) && (
                <p style={{ ...s.aviso, marginTop: 12 }}>
                  ✦ <strong>MÍA:</strong> {!guardado && !evalCompleta
                    ? 'aún no has subido tu Diagnóstico Grupal ni tu Diagnóstico Individual'
                    : !guardado
                      ? 'aún no has subido tu Diagnóstico Grupal'
                      : 'aún no has subido tu Diagnóstico Individual'
                  } — tus planeaciones no estarán personalizadas hasta entonces.
                </p>
              )}
            </div>

            {/* Configura tu grupo */}
            <div style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
                <p style={s.titulo}>👥 Configura tu grupo</p>
                {(codigosActivos ?? 0) > 0 ? (
                  <button type="button" onClick={abrirModalAlumnos} style={s.accionBtn}>Altas y bajas →</button>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>
                <div>
                  <label style={s.label}>Grado</label>
                  <select value={profile.grado || ''} onChange={(e) => actualizarGrado(e.target.value)} style={s.select}>
                    <option value="" disabled>—</option>
                    {GRADOS_OPCIONES.map(g => (
                      <option key={g} value={g}>{GRADO_MAP[g]}</option>
                    ))}
                  </select>
                  {gradoGuardado && <span style={s.check}>✓</span>}
                </div>
                <div>
                  <label style={s.label}>Grupo</label>
                  <select value={profile.grupo_letra || ''} onChange={(e) => actualizarGrupoLetra(e.target.value)} style={s.select}>
                    <option value="" disabled>—</option>
                    {['A', 'B', 'C', 'D', 'E'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  {grupoLetraGuardado && <span style={s.check}>✓</span>}
                </div>
                <div>
                  <label style={s.label}>Alumnos</label>
                  {codigosActivos && codigosActivos > 0 ? (
                    <span style={{ ...s.select, width: 64, display: 'inline-block', background: '#F8F8FC', textAlign: 'center' as const }}>{codigosActivos}</span>
                  ) : (
                    <input
                      type="number" min="1" max="50" placeholder="24"
                      value={profile.total_alumnos || ''}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value)
                        if (!val || val < 1) return
                        await actualizarTotalAlumnos(val)
                        setAlumnosGuardado(true)
                        setTimeout(() => setAlumnosGuardado(false), 2000)
                      }}
                      style={{ ...s.select, width: 80, minWidth: 0 }}
                    />
                  )}
                  {alumnosGuardado && <span style={s.check}>✓</span>}
                </div>
              </div>
            </div>

            {discrepanciaAlumnos && (
              <div style={{ ...s.card, background: C.indigoClaro, borderColor: '#D8D6F0' }}>
                <p style={{ margin: '0 0 10px', fontSize: 14, color: C.texto, lineHeight: 1.6 }}>
                  ✦ <strong>MÍA:</strong> detecté <strong>{discrepanciaAlumnos.detectado} alumnos</strong> en {discrepanciaAlumnos.origen === '3.2' ? 'tu Diagnóstico Individual' : 'tu Diagnóstico Grupal'}
                  {codigosActivos && codigosActivos > 0
                    ? <>, pero tu lista tiene <strong>{codigosActivos}</strong> alumnos activos. Si llegó o se fue alguien, regístralo en tu lista (si el documento no incluye a todo el grupo, deja tu lista igual).</>
                    : <>. ¿Tu grupo tiene <strong>{discrepanciaAlumnos.detectado}</strong> alumnos?</>}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  <button onClick={codigosActivos && codigosActivos > 0 ? () => { setDiscrepanciaAlumnos(null); abrirModalAlumnos() } : confirmarActualizarAlumnos} style={s.btnPrimario}>
                    {codigosActivos && codigosActivos > 0 ? '👥 Revisar mi lista' : `Sí, usar ${discrepanciaAlumnos.detectado}`}
                  </button>
                  <button onClick={descartarDiscrepanciaAlumnos} style={s.btnSecundario}>
                    Mantener {codigosActivos && codigosActivos > 0 ? codigosActivos : (profile.total_alumnos || 'sin cambio')}
                  </button>
                </div>
              </div>
            )}

            {/* ============ 1 · Diagnóstico escolar ============ */}
            <p style={s.seccion}>1 · Diagnóstico escolar</p>

            <TarjetaDoc numero="1.1" titulo="Programa de Mejora Continua" origen="PMC" guardado={diagnosticoEscolarGuardado}
              descripcion="Contexto institucional del jardín: entorno, organización y recursos.">
              {!diagnosticoEscolarGuardado ? (
                <>
                  <label style={{ ...s.subir, opacity: analizandoEscolar ? 0.6 : 1, cursor: analizandoEscolar ? 'default' : 'pointer' }}>
                    {analizandoEscolar ? '✦ MÍA está analizando…' : '↑ Subir documento'}
                    <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPMC} style={{ display: 'none' }} disabled={analizandoEscolar} />
                  </label>
                  <p style={s.nota}>PDF, Word o PowerPoint.</p>
                  {errorEscolar && <p style={s.aviso}>{errorEscolar}</p>}
                </>
              ) : (
                <>
                  <TiempoGuardado fechaISO={fechasGuardado['pmc']?.fecha} />
                  {analizandoEscolar && <p style={s.aviso}>✦ MÍA está analizando la nueva versión…</p>}
                  {errorEscolar && <p style={s.aviso}>{errorEscolar}</p>}
                  <div style={s.acciones}>
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
                    >Ver detalle</button>
                    {(fechasGuardado['pmc']?.version ?? 0) >= 2 && (
                      <button onClick={() => abrirHistorial('pmc', '1.1 · Historial del PMC')} style={s.accionBtn}>Historial</button>
                    )}
                    <label style={s.accionBtn}>
                      Actualizar
                      <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPMC} style={{ display: 'none' }} disabled={analizandoEscolar} />
                    </label>
                  </div>
                </>
              )}
            </TarjetaDoc>

            <TarjetaDoc numero="1.2" titulo="Programa Analítico" origen="PA" guardado={!!paActivo}
              descripcion="Contenidos y PDA priorizados por tu jardín para este ciclo.">
              {!paActivo ? (
                <>
                  <label style={{ ...s.subir, opacity: analizandoPA ? 0.6 : 1, cursor: analizandoPA ? 'default' : 'pointer' }}>
                    {analizandoPA ? '✦ MÍA está leyendo el PA…' : '↑ Subir documento'}
                    <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                  </label>
                  <p style={s.nota}>PDF, Word o PowerPoint.</p>
                  {errorPA && <p style={s.aviso}>{errorPA}</p>}
                </>
              ) : (
                <>
                  <TiempoGuardado fechaISO={paActivo.fecha_carga} />
                  {paActivo.nota_directivo && <p style={s.dato}>💬 {paActivo.nota_directivo}</p>}
                  {paActivo.pda_ponderacion?.inconsistencias?.length > 0 && (
                    <div onClick={() => setModalMiaPA(true)} style={s.miaCaja}>
                      ✦ MÍA tiene <strong>{paActivo.pda_ponderacion.inconsistencias.length}</strong> observaci{paActivo.pda_ponderacion.inconsistencias.length !== 1 ? 'ones' : 'ón'} sobre tu PA. Revísal{paActivo.pda_ponderacion.inconsistencias.length !== 1 ? 'as' : 'a'} →
                    </div>
                  )}
                  {analizandoPA && <p style={s.aviso}>✦ MÍA está analizando la nueva versión…</p>}
                  {errorPA && <p style={s.aviso}>{errorPA}</p>}
                  <div style={s.acciones}>
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
                    >Ver detalle</button>
                    {paActivo.version_numero >= 2 && (
                      <button onClick={toggleHistorial} style={s.accionBtn}>Historial</button>
                    )}
                    <label style={s.accionBtn}>
                      Actualizar
                      <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                    </label>
                  </div>
                </>
              )}
            </TarjetaDoc>

            {/* ============ 2 · Recomendaciones directivas ============ */}
            <p style={s.seccion}>2 · Recomendaciones directivas</p>

            <TarjetaDoc numero="2.1" titulo="PDA del jardín" origen="Jardín" opcional guardado={guardadoJardin}
              descripcion="PDA acordados por el colectivo este ciclo. MÍA los integrará con tu diagnóstico.">
              {!guardadoJardin ? (
                <>
                  <label style={{ ...s.subir, opacity: guardandoJardin ? 0.6 : 1, cursor: guardandoJardin ? 'default' : 'pointer' }}>
                    {guardandoJardin ? '✦ MÍA está analizando…' : '↑ Subir documento'}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} disabled={guardandoJardin} />
                  </label>
                  <p style={s.nota}>PDF o Word.</p>
                  {errorJardin && <p style={s.aviso}>{errorJardin}</p>}
                </>
              ) : (
                <>
                  <TiempoGuardado fechaISO={fechasGuardado['pdas_jardin']?.fecha} />
                  <p style={s.dato}>{resultadoJardin?.total_vinculados ?? resultadoJardin?.pdas_jardin?.length ?? 0} PDA{(resultadoJardin?.total_vinculados ?? 0) !== 1 ? 's' : ''} del jardín identificado{(resultadoJardin?.total_vinculados ?? 0) !== 1 ? 's' : ''}</p>
                  {guardandoJardin && <p style={s.aviso}>✦ MÍA está analizando la nueva versión…</p>}
                  {errorJardin && <p style={s.aviso}>{errorJardin}</p>}
                  <div style={s.acciones}>
                    <button
                      onClick={() => setModalDetalle({
                        titulo: '2.1 · PDAs del jardín',
                        contenido: (
                          <div style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, lineHeight: 1.6 }}>{resultadoJardin?.resumen || 'Sin resumen disponible.'}</p>
                          </div>
                        ),
                      })}
                      style={s.accionBtn}
                    >Ver detalle</button>
                    {(fechasGuardado['pdas_jardin']?.version ?? 0) >= 2 && (
                      <button onClick={() => abrirHistorial('pdas_jardin', '2.1 · Historial de PDAs del jardín')} style={s.accionBtn}>Historial</button>
                    )}
                    <label style={s.accionBtn}>
                      Actualizar
                      <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} disabled={guardandoJardin} />
                    </label>
                  </div>
                </>
              )}
            </TarjetaDoc>

            <TarjetaDoc numero="2.2" titulo="Áreas de oportunidad" origen="Dirección" opcional guardado={observacionesGuardadas}
              descripcion="Observaciones de tu última visita áulica. MÍA las integrará en tus planeaciones.">
              {!observacionesGuardadas ? (
                <button type="button" onClick={() => { setObservacionesModalExito(false); setModalObservacionesAbierto(true) }} style={s.subir}>
                  ✎ Escribir o subir observaciones
                </button>
              ) : (
                <>
                  <TiempoGuardado fechaISO={fechasGuardado['observaciones_directivo']?.fecha} />
                  {resultadoObservaciones?.areas_mejora?.length > 0 && (
                    <p style={s.dato}>{resultadoObservaciones.areas_mejora.length} área{resultadoObservaciones.areas_mejora.length !== 1 ? 's' : ''} de oportunidad registrada{resultadoObservaciones.areas_mejora.length !== 1 ? 's' : ''}</p>
                  )}
                  <div style={s.acciones}>
                    <button
                      onClick={() => setModalDetalle({
                        titulo: '2.2 · Áreas de oportunidad',
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
                    >Ver detalle</button>
                    {(fechasGuardado['observaciones_directivo']?.version ?? 0) >= 2 && (
                      <button onClick={() => abrirHistorial('observaciones_directivo', '2.2 · Historial de observaciones')} style={s.accionBtn}>Historial</button>
                    )}
                    <button onClick={() => { setObservacionesModalExito(false); setModalObservacionesAbierto(true) }} style={s.accionBtn}>Actualizar</button>
                  </div>
                </>
              )}
            </TarjetaDoc>

            {/* Modal de redacción/edición de 2.2 Áreas de Oportunidad (sin cambios de lógica) */}
            {modalObservacionesAbierto && (
              <DetalleModal titulo="2.2 · Áreas de oportunidad" onClose={() => setModalObservacionesAbierto(false)}>
                {observacionesModalExito ? (
                  <div style={{ textAlign: 'center' as const, padding: '8px 0' }}>
                    <p style={{ fontSize: 32, margin: '0 0 8px' }}>✅</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0F6E56', margin: '0 0 6px' }}>Observaciones guardadas correctamente</p>
                    <p style={{ fontSize: 12, color: '#666', margin: '0 0 18px' }}>MÍA ya las integrará en tus próximas planeaciones.</p>
                    <button type="button" onClick={() => setModalObservacionesAbierto(false)} style={s.btnPrimario}>
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea value={observacionesTexto} onChange={e => setObservacionesTexto(e.target.value)} onInput={ajustarAlturaTextarea} rows={4}
                      placeholder="Ej: La directora me indicó trabajar más la expresión oral..."
                      style={s.textarea} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center', marginTop: 10 }}>
                      <button onClick={handleAnalizarObservaciones} disabled={analizandoObservaciones || !observacionesTexto.trim()}
                        style={{ ...s.btnPrimario, background: analizandoObservaciones || !observacionesTexto.trim() ? '#C4C2E8' : C.indigo }}>
                        {analizandoObservaciones ? '✦ Analizando…' : '✨ Guardar'}
                      </button>
                      <label style={{ ...s.btnSecundario, display: 'inline-flex', alignItems: 'center', gap: 4, borderColor: C.indigo }}>
                        {analizandoObservaciones ? '✦ Analizando…' : '📎 Archivo'}
                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} disabled={analizandoObservaciones} />
                      </label>
                      <button
                        type="button"
                        disabled={analizandoObservaciones}
                        onClick={() => { setModalObservacionesAbierto(false); setErrorObservaciones('') }}
                        style={{ ...s.btnSecundario, color: C.gris, cursor: analizandoObservaciones ? 'default' : 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                    {errorObservaciones && <div style={s.err}>{errorObservaciones}</div>}
                    <p style={{ fontSize: 11, color: C.gris, marginTop: 8, textAlign: 'center' as const }}>Opcional · al subir un archivo se analiza automáticamente</p>
                  </>
                )}
              </DetalleModal>
            )}

            {/* ============ 3 · Diagnóstico pedagógico ============ */}
            <p style={s.seccion}>3 · Diagnóstico pedagógico</p>

            <TarjetaDoc numero="3.1" titulo="Diagnóstico grupal" origen="Grupo" guardado={guardado}
              descripcion="Necesidades y áreas de oportunidad de tu grupo, para personalizar tus planeaciones.">
              {!guardado ? (
                <>
                  <label style={{ ...s.subir, opacity: analizando ? 0.6 : 1, cursor: analizando ? 'default' : 'pointer' }}>
                    {analizando ? '✦ MÍA está analizando…' : '↑ Subir documento'}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} disabled={analizando} />
                  </label>
                  <p style={s.nota}>PDF o Word.</p>
                  {errorDiagnostico && <p style={s.aviso}>{errorDiagnostico}</p>}
                </>
              ) : (
                <>
                  <TiempoGuardado fechaISO={fechasGuardado['diagnostico_grupal']?.fecha} />
                  <p style={s.dato}>{pdas.length} PDA prioritarios identificados</p>
                  <div style={s.acciones}>
                    <button
                      onClick={() => {
                        const grupos: Record<string, { campo: string; contenido: string; items: any[] }> = {}
                        pdas.forEach((p) => {
                          const key = `${p.campo}||${p.contenido}`
                          if (!grupos[key]) grupos[key] = { campo: p.campo, contenido: p.contenido, items: [] }
                          grupos[key].items.push(p)
                        })
                        setModalDetalle({
                          titulo: '3.1 · PDAs priorizados para tu grupo',
                          contenido: (
                            <div>
                              {Object.values(grupos).map((grupo, gi) => (
                                <div key={gi} style={{ border: '1px solid #E0F5F3', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: '#FAFFFE' }}>
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                                    <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{grupo.campo}</span>
                                    <span style={{ background: '#E0F5F3', color: '#0F6E56', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{grupo.items.length} PDA{grupo.items.length > 1 ? 's' : ''}</span>
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
                    >Ver detalle</button>
                    {(fechasGuardado['diagnostico_grupal']?.version ?? 0) >= 2 && (
                      <button onClick={() => abrirHistorial('diagnostico_grupal', '3.1 · Historial del diagnóstico grupal')} style={s.accionBtn}>Historial</button>
                    )}
                    <label style={s.accionBtn}>
                      Actualizar
                      <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} />
                    </label>
                  </div>
                </>
              )}
            </TarjetaDoc>

            <TarjetaDoc numero="3.2" titulo="Diagnóstico individual" origen="Grupo" guardado={!!evalCompleta}
              descripcion="Evaluación por alumno. MÍA protege los nombres y sugiere apoyos que tú confirmas.">
              {!evalCompleta ? (
                <>
                  <label style={{ ...s.subir, opacity: guardandoEval ? 0.6 : 1, cursor: guardandoEval ? 'default' : 'pointer' }}>
                    {guardandoEval ? '✦ MÍA está analizando…' : '↑ Subir documento'}
                    <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} disabled={guardandoEval} onChange={handleArchivoEvaluacionIndividual} />
                  </label>
                  <p style={s.nota}>PDF o Word · 🔒 Los nombres nunca se almacenan.</p>
                  {errorEval && <p style={s.aviso}>{errorEval}</p>}
                </>
              ) : (
                <>
                  <TiempoGuardado fechaISO={fechasGuardado['diagnostico_individual']?.fecha} />
                  <p style={s.dato}>
                    👥 {(evaluacionIndividual as any).total_alumnos_detectados || 0} alumnos en tu diagnóstico ·{' '}
                    <button type="button" onClick={abrirModalAlumnos} style={{ ...s.accionBtn, padding: 0, fontSize: 14 }}>ver grupo y apoyos</button>
                  </p>
                  {sugerenciasPendientes(evaluacionIndividual) > 0 && (
                    <div onClick={abrirModalAlumnos} style={s.miaCaja}>
                      ✦ MÍA detectó <strong>{sugerenciasPendientes(evaluacionIndividual)}</strong> niño{sugerenciasPendientes(evaluacionIndividual) !== 1 ? 's' : ''} que {sugerenciasPendientes(evaluacionIndividual) !== 1 ? 'podrían' : 'podría'} necesitar apoyos. Revisa y confirma para que lleguen a tus planeaciones →
                    </div>
                  )}
                  {guardandoEval && <p style={s.aviso}>✦ MÍA está analizando la nueva versión…</p>}
                  {errorEval && <p style={s.aviso}>{errorEval}</p>}
                  <div style={s.acciones}>
                    <button
                      onClick={() => setModalDetalle({
                        titulo: '3.2 · PDAs prioritarios (Diagnóstico Individual)',
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
                    >Ver detalle</button>
                    {(fechasGuardado['diagnostico_individual']?.version ?? 0) >= 2 && (
                      <button onClick={() => abrirHistorial('diagnostico_individual', '3.2 · Historial del diagnóstico individual')} style={s.accionBtn}>Historial</button>
                    )}
                    <label style={s.accionBtn}>
                      Actualizar
                      <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleArchivoEvaluacionIndividual} disabled={guardandoEval} />
                    </label>
                  </div>
                </>
              )}
            </TarjetaDoc>

            {/* 3.3 · Estilos de aprendizaje (opcional) — la tarjeta completa vive en su componente */}
            <TarjetaEstilosAprendizaje
              guardado={profile.estilos_aprendizaje || null}
              totalAlumnos={profile.total_alumnos || 0}
              onGuardado={(estilos) => { setProfile((prev: any) => ({ ...prev, estilos_aprendizaje: estilos })); refrescarFechas() }}
            />

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
          {modalAlumnos && (
            <DetalleModal titulo="Alumnos de tu grupo y apoyos" onClose={() => setModalAlumnos(false)}>
              <GrupoAlumnosApoyos
                evaluacionIndividual={evaluacionIndividual}
                totalAlumnos={profile?.total_alumnos || 0}
                onEvaluacionActualizada={setEvaluacionIndividual}
                onTotalActualizado={(n: number) => {
                  setCodigosActivos(n)
                  if (n > 0) setProfile((prev: any) => (prev && prev.total_alumnos !== n ? { ...prev, total_alumnos: n } : prev))
                }}
              />
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