// app/planeacion/nueva/page.tsx
'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import { supabase } from '@/lib/supabase'

const CAMPOS = [
  'Lenguajes',
  'Saberes y Pensamiento Científico',
  'Ética, Naturaleza y Sociedades',
  'De lo Humano y lo Comunitario',
]

const TIEMPO_MINIMO_PASO1 = 3500
const TIEMPO_CONFIRMACION_FINAL = 1800

const MODO_PRUEBA_FECHAS_PASADAS = true
const FECHA_MINIMA_PRUEBA = '2026-06-01'

const NOMBRES_FASES_MODALIDAD: Record<string, string[]> = {
  'Proyectos': ['Punto de partida', 'Planeación', '¡A trabajar!', 'Comunicamos nuestros logros', 'Reflexionar sobre el aprendizaje'],
  'ABJ': ['Planteamiento del juego', 'Desarrollo de las actividades', 'Compartimos la experiencia', 'Comunidad de juego'],
  'Taller crítico': ['Situación inicial', 'Puesta en marcha', 'Valoramos lo aprendido', 'Reflexión'],
  'Rincones': ['Asamblea inicial y planeación', 'Exploración de los rincones', 'Compartimos lo aprendido', 'Reflexión sobre el aprendizaje'],
  'Centros de interés': ['Contacto con la realidad', 'Identificación e integración', 'Expresión'],
  'Unidad didáctica': ['Lectura de la realidad', 'Identificación de la trama y complejidad', 'Planificación y organización', 'Exploración y descubrimiento', 'Participación activa y horizontal', 'Valoración de la experiencia'],
}

const ORDEN_MODALIDADES = ['Proyectos', 'ABJ', 'Taller crítico', 'Rincones', 'Centros de interés', 'Unidad didáctica']

function modalidadesQueCaben(diasDisponibles: number): string[] {
  return ORDEN_MODALIDADES.filter(m => (NOMBRES_FASES_MODALIDAD[m]?.length || 99) <= diasDisponibles)
}

function contarDiasHabiles(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0
  const start = new Date(inicio + 'T12:00:00')
  const end = new Date(fin + 'T12:00:00')
  if (end < start) return 0
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const dia = cur.getDay()
    if (dia !== 0 && dia !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function hoyLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// [jul 2026] Auto-crecimiento de textareas — se llama en cada evento
// "input" (que cubre escritura, pegado con mouse/teclado, y borrado)
// de los 3 textareas del formulario (Situación problema, Finalidad,
// Recursos). Resetea la altura a "auto" antes de medir, para que
// también funcione al BORRAR texto (si no se resetea primero,
// scrollHeight se queda "atascado" en la altura más alta que tuvo
// alguna vez). Esto elimina la fricción de tener que arrastrar la
// esquina manualmente para ver el texto completo.
function ajustarAlturaTextarea(e: React.FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

interface PdaItem {
  id: string
  grado: string
  pda: string
  orden: number
  esAvanzado: boolean
}

interface ContenidoSeleccionado {
  contenido: string
  pdasSeleccionados: { id: string; pda: string; grado: string }[]
}

interface Transversal {
  campo: string
  contenido: string
  pda: string
  activo: boolean
  id?: string | null
}

interface ProgresoReal {
  totalLotes: number
  lotesCompletados: number
  faseActual: string
  estado: string
  errorMensaje?: string | null
  fasesLotes: string[]
}

type EstadoPaso = 'pendiente' | 'activo' | 'completado'

type CampoInvalidoId = 'nombre' | 'situacion' | 'finalidad' | 'campoFormativo' | 'pdas' | 'fecha' | 'modalidad' | null

function nombreCorto(nombre: string | null): string {
  if (!nombre) return ''
  return nombre
    .replace(/^Jardín de Niños Indígena\s*/i, '')
    .replace(/^Jardín de Niños\s*/i, '')
    .replace(/^Jardin de Niños\s*/i, '')
    .replace(/^Centro de Educación Preescolar\s*/i, '')
    .trim()
}

function getBadgesCapa2(evaluacion: any, pdaTexto: string): boolean {
  if (!evaluacion || Array.isArray(evaluacion)) return false
  const lista = evaluacion?.pdas_prioritarios_grupo || []
  return lista.some((p: any) =>
    (typeof p === 'string' ? p : p?.pda || '')
      .toLowerCase().trim() === pdaTexto.toLowerCase().trim()
  )
}

function getBadgesCapa3(pdasJardin: any, pdaTexto: string): boolean {
  if (!pdasJardin) return false
  if (typeof pdasJardin === 'string') {
    return pdasJardin.toLowerCase().includes(pdaTexto.toLowerCase().trim().slice(0, 40))
  }
  if (Array.isArray(pdasJardin)) {
    return pdasJardin.some((p: any) =>
      (typeof p === 'string' ? p : p?.pda || '').toLowerCase().includes(pdaTexto.toLowerCase().trim().slice(0, 40))
    )
  }
  if (typeof pdasJardin === 'object') {
    return JSON.stringify(pdasJardin).toLowerCase().includes(pdaTexto.toLowerCase().trim().slice(0, 40))
  }
  return false
}

function NuevaPlaneacionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [progreso, setProgreso] = useState<ProgresoReal>({ totalLotes: 0, lotesCompletados: 0, faseActual: 'Iniciando...', estado: 'en_progreso', fasesLotes: [] })
  const [result, setResult] = useState<any>(null)
  const [saveStatus, setSaveStatus] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [tiempoMinimoPaso1Cumplido, setTiempoMinimoPaso1Cumplido] = useState(false)

  const [ejeSugeridoParam, setEjeSugeridoParam] = useState('')
  const [avisoAvance, setAvisoAvance] = useState<{ campo?: string; eje?: string } | null>(null)
  const [avisoDescartado, setAvisoDescartado] = useState(false)

  const [diasHabilesReales, setDiasHabilesReales] = useState<number | null>(null)
  const [cambioModalidadInfo, setCambioModalidadInfo] = useState<{ original: string; nueva: string; diasReales: number; necesariosOriginal: number; necesariosNueva: number } | null>(null)
  const [cambioModalidadConfirmado, setCambioModalidadConfirmado] = useState(true)

  const [campoInvalido, setCampoInvalido] = useState<CampoInvalidoId>(null)
  const [mensajeErrorFecha, setMensajeErrorFecha] = useState('')
  const campoInvalidoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refNombreInput = useRef<HTMLInputElement>(null)
  const refSituacionInput = useRef<HTMLTextAreaElement>(null)
  const refCampoFormativoSection = useRef<HTMLDivElement>(null)
  const refFechaSection = useRef<HTMLDivElement>(null)
  const refModalidadSection = useRef<HTMLDivElement>(null)
  const refBotonGenerar = useRef<HTMLButtonElement>(null)

  function marcarInvalido<T extends HTMLElement>(id: CampoInvalidoId, ref: React.RefObject<T | null>) {
    setCampoInvalido(id)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (campoInvalidoTimeoutRef.current) clearTimeout(campoInvalidoTimeoutRef.current)
    campoInvalidoTimeoutRef.current = setTimeout(() => setCampoInvalido(null), 2800)
  }

  function estiloResaltado(id: CampoInvalidoId): React.CSSProperties {
    return campoInvalido === id
      ? { boxShadow: '0 0 0 3px #EF4444', transition: 'box-shadow 0.25s ease' }
      : { transition: 'box-shadow 0.25s ease' }
  }

  useEffect(() => {
    return () => { if (campoInvalidoTimeoutRef.current) clearTimeout(campoInvalidoTimeoutRef.current) }
  }, [])

  const hoyISO = hoyLocalISO()

  const [form, setForm] = useState({
    nombre_proyecto: '',
    situacion_problema: '',
    finalidad: '',
    recursos_materiales: '',
    fecha_inicio: '',
    fecha_fin: '',
    metodologia: 'Proyectos',
  })

  const [principalCampo, setPrincipalCampo] = useState('')
  const [contenidosDisponibles, setContenidosDisponibles] = useState<string[]>([])
  const [contenidosElegidos, setContenidosElegidos] = useState<ContenidoSeleccionado[]>([])
  const [pdasPorContenido, setPdasPorContenido] = useState<Record<string, PdaItem[]>>({})
  const [cargandoPdas, setCargandoPdas] = useState<Record<string, boolean>>({})

  const [transversales, setTransversales] = useState<Transversal[]>([])
  const [sugirendoTransversales, setSugirendoTransversales] = useState(false)
  const [mensajeSugerencia, setMensajeSugerencia] = useState(0)
  const [sugerenciaYaObtenida, setSugerenciaYaObtenida] = useState(false)

  const MENSAJES_SUGERENCIA = [
    'Leyendo tu proyecto...',
    'Revisando el catálogo de PDAs...',
    'Buscando campos coherentes...',
    'Analizando la situación problema...',
    'Casi listo...',
  ]

  const [errorTransversales, setErrorTransversales] = useState('')
  const [ejePrincipal, setEjePrincipal] = useState('')
  const [ejeSecundario, setEjeSecundario] = useState('')
  const [ejePrincipalDescartado, setEjePrincipalDescartado] = useState(false)
  const [ejeSecundarioDescartado, setEjeSecundarioDescartado] = useState(false)
  const [ejeElegidoPorEducadora, setEjeElegidoPorEducadora] = useState('')
  const [ejesDisponibles, setEjesDisponibles] = useState<string[]>([])

  const finalidadRef = useRef<HTMLTextAreaElement>(null)
  const gradoMap: Record<string, string> = { '1er Grado': '1°', '2do Grado': '2°', '3er Grado': '3°' }
  const gradoGrupo = gradoMap[profile?.grado || ''] || profile?.grado || '2°'
  const seccionGrupo = (profile?.seccion_grupo || '').trim()
  const totalAlumnos = profile?.total_alumnos || profile?.total_students || null
  const todasPdasSeleccionadas = contenidosElegidos.flatMap(c => c.pdasSeleccionados)
  const hayPdasSeleccionados = todasPdasSeleccionadas.length > 0

  const ejePrincipalVieneDeMiAvance = !!ejeSugeridoParam && ejePrincipal === ejeSugeridoParam

  const momentosNecesarios = NOMBRES_FASES_MODALIDAD[form.metodologia]?.length || 5
  const modalidadActualCabe = diasHabilesReales === null ? true : momentosNecesarios <= diasHabilesReales
  const modalidadesDisponibles = diasHabilesReales === null ? ORDEN_MODALIDADES : modalidadesQueCaben(diasHabilesReales)
  const hayModalidadQueQuepa = modalidadesDisponibles.length > 0

  const modalidadBloqueada = !!cambioModalidadInfo && !cambioModalidadConfirmado

  const diasHabilesNaive = contarDiasHabiles(form.fecha_inicio, form.fecha_fin)

  const fechaCompletaYValida = !!form.fecha_inicio && !!form.fecha_fin && diasHabilesNaive > 0
    && (MODO_PRUEBA_FECHAS_PASADAS || form.fecha_inicio >= hoyISO)

  const modalidadLista = fechaCompletaYValida && diasHabilesReales !== null && modalidadActualCabe && !modalidadBloqueada

  const todosCamposCompletos =
    !!form.nombre_proyecto &&
    !!form.situacion_problema &&
    !!form.finalidad &&
    !!principalCampo &&
    contenidosElegidos.length > 0 &&
    hayPdasSeleccionados &&
    !!ejePrincipal &&
    modalidadLista

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
    }
    load()
  }, [])

  useEffect(() => {
    const campoSugerido = searchParams.get('campo_sugerido')
    const ejeSugerido = searchParams.get('eje_sugerido')
    const campoValido = campoSugerido && CAMPOS.includes(campoSugerido) ? campoSugerido : undefined
    if (campoValido) setPrincipalCampo(campoValido)
    if (ejeSugerido) setEjeSugeridoParam(ejeSugerido)
    if (campoValido || ejeSugerido) setAvisoAvance({ campo: campoValido, eje: ejeSugerido || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function calcular() {
      if (!form.fecha_inicio || !form.fecha_fin || form.fecha_fin < form.fecha_inicio || !profile?.cct_primary) {
        setDiasHabilesReales(null)
        return
      }
      try {
        const estadoCodigo = profile.cct_primary.slice(0, 2)
        const res = await fetch(`/api/calendario/dias-habiles-reales?estado=${estadoCodigo}&fecha_inicio=${form.fecha_inicio}&fecha_fin=${form.fecha_fin}`)
        const data = await res.json()
        const dias = typeof data.diasHabilesReales === 'number' ? data.diasHabilesReales : null
        setDiasHabilesReales(dias)
        if (dias === null) return

        const necesariosActual = NOMBRES_FASES_MODALIDAD[form.metodologia]?.length || 5
        if (necesariosActual > dias) {
          const candidatos = modalidadesQueCaben(dias)
          if (candidatos.length > 0) {
            const original = form.metodologia
            const elegida = candidatos.reduce((mejor, m) =>
              (NOMBRES_FASES_MODALIDAD[m].length > NOMBRES_FASES_MODALIDAD[mejor].length ? m : mejor), candidatos[0])
            setCambioModalidadInfo({
              original,
              nueva: elegida,
              diasReales: dias,
              necesariosOriginal: necesariosActual,
              necesariosNueva: NOMBRES_FASES_MODALIDAD[elegida].length,
            })
            setCambioModalidadConfirmado(false)
            setForm(prev => ({ ...prev, metodologia: elegida }))
            refModalidadSection.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } else {
            setCambioModalidadInfo(null)
            setCambioModalidadConfirmado(true)
          }
        } else {
          setCambioModalidadInfo(null)
          setCambioModalidadConfirmado(true)
        }
      } catch {
        setDiasHabilesReales(null)
      }
    }
    calcular()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fecha_inicio, form.fecha_fin, profile?.cct_primary])

  useEffect(() => {
    if (!principalCampo) {
      setContenidosDisponibles([])
      setContenidosElegidos([])
      setPdasPorContenido({})
      return
    }
    async function loadContenidos() {
      const { data } = await supabase
        .from('pda_catalog')
        .select('contenido, grado')
        .eq('campo', principalCampo)
        .order('contenido')
      const unicos = [...new Set((data || []).map((r: any) => r.contenido))]
      setContenidosDisponibles(unicos)
      setContenidosElegidos([])
      setPdasPorContenido({})
    }
    loadContenidos()
  }, [principalCampo])

  async function cargarPdasDeContenido(contenido: string) {
    if (pdasPorContenido[contenido]) return
    setCargandoPdas(prev => ({ ...prev, [contenido]: true }))
    const gradosOrden = ['1°', '2°', '3°']
    const idxGrupo = gradosOrden.indexOf(gradoGrupo)
    const gradosPermitidos = gradosOrden.slice(idxGrupo)
    const { data } = await supabase
      .from('pda_catalog')
      .select('id, grado, pda, orden')
      .eq('campo', principalCampo)
      .eq('contenido', contenido)
      .in('grado', gradosPermitidos)
      .order('grado')
      .order('orden')
    const items: PdaItem[] = (data || []).map((r: any) => ({
      id: r.id,
      grado: r.grado,
      pda: r.pda,
      orden: r.orden,
      esAvanzado: r.grado !== gradoGrupo,
    }))
    setPdasPorContenido(prev => ({ ...prev, [contenido]: items }))
    setCargandoPdas(prev => ({ ...prev, [contenido]: false }))
  }

  function toggleContenido(contenido: string) {
    const yaElegido = contenidosElegidos.find(c => c.contenido === contenido)
    if (yaElegido) {
      setContenidosElegidos(prev => prev.filter(c => c.contenido !== contenido))
    } else {
      setContenidosElegidos(prev => [...prev, { contenido, pdasSeleccionados: [] }])
      cargarPdasDeContenido(contenido)
    }
    if (campoInvalido === 'campoFormativo') setCampoInvalido(null)
  }

  function togglePda(contenido: string, pda: PdaItem) {
    setContenidosElegidos(prev => prev.map(c => {
      if (c.contenido !== contenido) return c
      const yaSeleccionado = c.pdasSeleccionados.some(p => p.pda === pda.pda)
      return {
        ...c,
        pdasSeleccionados: yaSeleccionado
          ? c.pdasSeleccionados.filter(p => p.pda !== pda.pda)
          : [...c.pdasSeleccionados, { id: pda.id, pda: pda.pda, grado: pda.grado }]
      }
    }))
    if (campoInvalido === 'pdas') setCampoInvalido(null)
  }

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
    const mapa: Record<string, CampoInvalidoId> = {
      nombre_proyecto: 'nombre',
      situacion_problema: 'situacion',
      finalidad: 'finalidad',
      fecha_inicio: 'fecha',
      fecha_fin: 'fecha',
    }
    if (mapa[field] && campoInvalido === mapa[field]) setCampoInvalido(null)
  }

  function handleMetodologiaChange(value: string) {
    setForm(prev => ({ ...prev, metodologia: value }))
    setCambioModalidadInfo(null)
    setCambioModalidadConfirmado(true)
    if (campoInvalido === 'modalidad') setCampoInvalido(null)
  }

  function confirmarCambioModalidad() {
    setCambioModalidadConfirmado(true)
    setTimeout(() => {
      refBotonGenerar.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  useEffect(() => {
    if (!sugirendoTransversales) { setMensajeSugerencia(0); return }
    const tiempos = [1200, 2000, 1800, 2200]
    let idx = 0
    let timeout: ReturnType<typeof setTimeout>
    function avanzar() {
      if (idx >= MENSAJES_SUGERENCIA.length - 1) return
      idx++
      setMensajeSugerencia(idx)
      if (idx < MENSAJES_SUGERENCIA.length - 1) {
        timeout = setTimeout(avanzar, tiempos[idx] || 2000)
      }
    }
    timeout = setTimeout(avanzar, tiempos[0])
    return () => clearTimeout(timeout)
  }, [sugirendoTransversales])

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

  useEffect(() => {
    if (!generating) return
    setTiempoMinimoPaso1Cumplido(false)
    const timer = setTimeout(() => setTiempoMinimoPaso1Cumplido(true), TIEMPO_MINIMO_PASO1)
    return () => clearTimeout(timer)
  }, [generating])

  async function sugerirTransversales() {
    if (!form.nombre_proyecto || !form.situacion_problema || !form.finalidad || !principalCampo) return
    setSugirendoTransversales(true)
    setErrorTransversales('')
    setTransversales([])
    try {
      const res = await fetch('/api/sugerir-campos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_proyecto: form.nombre_proyecto,
          situacion_problema: form.situacion_problema,
          finalidad: form.finalidad,
          campo_principal: principalCampo,
          grado: gradoGrupo,
          eje_sugerido: ejeSugeridoParam || undefined,
        })
      })
      const data = await res.json()
      if (data.transversales) {
        setTransversales(data.transversales.map((t: any) => ({ ...t, activo: true })))
        if (data.eje_principal) { setEjePrincipal(data.eje_principal); setEjePrincipalDescartado(false) }
        if (data.eje_secundario) { setEjeSecundario(data.eje_secundario); setEjeSecundarioDescartado(false); setEjeElegidoPorEducadora('') }
        if (data.ejes_disponibles) setEjesDisponibles(data.ejes_disponibles)
        setSugerenciaYaObtenida(true)
      } else {
        setErrorTransversales('No se pudieron obtener las sugerencias. Intenta de nuevo — el eje articulador es obligatorio para poder generar tu planeación.')
      }
    } catch {
      setErrorTransversales('Error al obtener las sugerencias. Intenta de nuevo — el eje articulador es obligatorio para poder generar tu planeación.')
    }
    setSugirendoTransversales(false)
  }

  useEffect(() => {
    if (sugerenciaYaObtenida || sugirendoTransversales) return
    if (form.nombre_proyecto && form.situacion_problema && form.finalidad && principalCampo && hayPdasSeleccionados) {
      sugerirTransversales()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nombre_proyecto, form.situacion_problema, form.finalidad, principalCampo, hayPdasSeleccionados])

  function descartarTransversal(index: number) {
    setTransversales(prev => prev.map((t, i) => i === index ? { ...t, activo: false } : t))
  }

  function reactivarTransversal(index: number) {
    setTransversales(prev => prev.map((t, i) => i === index ? { ...t, activo: true } : t))
  }

  function iniciarSondeoProgreso(jobId: string) {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generar-planeacion/progreso?job_id=${jobId}`)
        const data = await res.json()
        if (!data.error) {
          setProgreso({
            totalLotes: data.totalLotes || 0,
            lotesCompletados: data.lotesCompletados || 0,
            faseActual: data.faseActual || 'Trabajando en tu planeación...',
            estado: data.estado || 'en_progreso',
            errorMensaje: data.errorMensaje,
            fasesLotes: Array.isArray(data.fasesLotes) ? data.fasesLotes : [],
          })
          if (data.estado === 'completado' || data.estado === 'error') {
            if (pollingRef.current) clearInterval(pollingRef.current)
          }
        }
      } catch {
        // Fallo silencioso de un sondeo puntual — no interrumpe la generación real
      }
    }, 1500)
  }

  async function handleGenerar() {
    if (!form.nombre_proyecto) {
      marcarInvalido('nombre', refNombreInput)
      return
    }
    if (!form.situacion_problema) {
      marcarInvalido('situacion', refSituacionInput)
      return
    }
    if (!form.finalidad) {
      marcarInvalido('finalidad', finalidadRef)
      return
    }
    if (!principalCampo || contenidosElegidos.length === 0) {
      marcarInvalido('campoFormativo', refCampoFormativoSection)
      return
    }
    if (!hayPdasSeleccionados) {
      marcarInvalido('pdas', refCampoFormativoSection)
      return
    }
    if (!ejePrincipal) {
      setErrorTransversales('Aún no se ha determinado el eje articulador de esta planeación — es obligatorio. Da clic en "Actualizar sugerencias" para intentarlo de nuevo.')
      marcarInvalido('campoFormativo', refCampoFormativoSection)
      return
    }
    if (!form.fecha_inicio || !form.fecha_fin) {
      setMensajeErrorFecha('Selecciona la fecha de inicio y la fecha de término.')
      marcarInvalido('fecha', refFechaSection)
      return
    }
    if (diasHabilesNaive === 0) {
      setMensajeErrorFecha('La fecha de término debe ser posterior a la fecha de inicio.')
      marcarInvalido('fecha', refFechaSection)
      return
    }
    if (!MODO_PRUEBA_FECHAS_PASADAS && form.fecha_inicio < hoyISO) {
      setMensajeErrorFecha('La fecha de inicio no puede ser anterior a hoy.')
      marcarInvalido('fecha', refFechaSection)
      return
    }
    if (modalidadBloqueada) {
      marcarInvalido('modalidad', refModalidadSection)
      return
    }
    if (!modalidadActualCabe) {
      marcarInvalido('modalidad', refModalidadSection)
      return
    }

    const jobId = crypto.randomUUID()
    setGenerating(true); setResult(null); setSaveStatus('')
    setProgreso({ totalLotes: 0, lotesCompletados: 0, faseActual: 'Iniciando...', estado: 'en_progreso', fasesLotes: [] })

    try {
      await fetch('/api/generar-planeacion/progreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, user_id: profile?.id }),
      })
    } catch {
      // Si falla la creación del registro, igual continuamos.
    }

    iniciarSondeoProgreso(jobId)

    const transversalesActivos = transversales.filter(t => t.activo)
    const pdasParaAgente = contenidosElegidos.flatMap(c =>
      c.pdasSeleccionados.map(p => ({ contenido: c.contenido, pda: p.pda }))
    )
    try {
      const res = await fetch('/api/generar-planeacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          form: {
            ...form,
            metodologia: form.metodologia,
            campo_formativo: principalCampo,
            contenido: contenidosElegidos[0]?.contenido || '',
            pda_principal: contenidosElegidos[0]?.pdasSeleccionados[0]?.pda || '',
            pdas_seleccionados: pdasParaAgente,
            grado_grupo: gradoGrupo,
            transversales: transversalesActivos,
            eje_principal: ejePrincipal,
            eje_secundario: ejeElegidoPorEducadora || (ejeSecundarioDescartado ? '' : ejeSecundario),
          },
          profile
        })
      })
      const data = await res.json()
      if (pollingRef.current) clearInterval(pollingRef.current)

      if (data.error) { setResult({ error: data.error }); setGenerating(false); return }
      if (data.planeacion) {
        setProgreso(prev => ({ ...prev, estado: 'completado', faseActual: '¡Tu planeación está lista!' }))
        await new Promise(r => setTimeout(r, TIEMPO_CONFIRMACION_FINAL))
        setResult(data.planeacion)
        const { data: savedData, error: saveError } = await supabase.from('plannings').insert({
          user_id: profile.id,
          project_name: form.nombre_proyecto,
          situacion_problema: form.situacion_problema,
          finalidad: form.finalidad,
          pda_campo: principalCampo,
          pda_contenido: contenidosElegidos[0]?.contenido || '',
          pda_literal: todasPdasSeleccionadas.map(p => p.pda).join(' | '),
          pda_id: contenidosElegidos[0]?.pdasSeleccionados[0]?.id || null,
          recursos_materiales: form.recursos_materiales || null,
          transversal_1_campo: transversalesActivos[0]?.campo || null,
          transversal_1_contenido: transversalesActivos[0]?.contenido || null,
          transversal_1_pda: transversalesActivos[0]?.pda || null,
          transversal_1_id: transversalesActivos[0]?.id || null,
          transversal_1_activo: !!transversalesActivos[0],
          transversal_2_campo: transversalesActivos[1]?.campo || null,
          transversal_2_contenido: transversalesActivos[1]?.contenido || null,
          transversal_2_pda: transversalesActivos[1]?.pda || null,
          transversal_2_id: transversalesActivos[1]?.id || null,
          transversal_2_activo: !!transversalesActivos[1],
          transversal_3_campo: transversalesActivos[2]?.campo || null,
          transversal_3_contenido: transversalesActivos[2]?.contenido || null,
          transversal_3_pda: transversalesActivos[2]?.pda || null,
          transversal_3_id: transversalesActivos[2]?.id || null,
          transversal_3_activo: !!transversalesActivos[2],
          starts_on: form.fecha_inicio || null,
          ends_on: form.fecha_fin || null,
          duration_days: diasHabilesNaive,
          grade: profile.grado || '2°',
          content_json: data.planeacion,
          eje_principal: ejePrincipal || null,
          eje_secundario: ejeElegidoPorEducadora || (ejeSecundarioDescartado ? null : ejeSecundario) || null,
          school_year_id: '96cae520-b0ed-4fcb-9c62-a95212ee357e',
          status: 'active',
        }).select('id').single()
        if (saveError) {
          setSaveStatus('Generada pero no guardada: ' + saveError.message)
        } else if (savedData?.id) {
          router.push(`/planeacion/${savedData.id}`)
        }
      }
    } catch {
      if (pollingRef.current) clearInterval(pollingRef.current)
      setResult({ error: 'Error de conexión' })
    }
    setGenerating(false)
  }

  const s = {
    label: { display: 'block', marginBottom: 6, fontWeight: 600, color: '#1A1A2E', fontSize: 14 } as React.CSSProperties,
    input: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, marginBottom: 16, outline: 'none', background: 'white' } as React.CSSProperties,
    // [jul 2026] "resize: none" — con el auto-crecimiento activo, ya
    // no tiene sentido dejar la manija de arrastre manual (que además
    // quedaría "peleando" contra el ajuste automático). "overflow:
    // hidden" evita que aparezca una barra de scroll interna mientras
    // la altura se recalcula.
    textarea: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, marginBottom: 16, resize: 'none' as const, overflow: 'hidden' as const, background: 'white' } as React.CSSProperties,
    card: { background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, marginBottom: 16 } as React.CSSProperties,
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 } as React.CSSProperties,
  }

  const momentos = [
    { key: 'momento_1_punto_de_partida', titulo: '1. Punto de partida' },
    { key: 'momento_2_planeacion', titulo: '2. Planeación' },
    { key: 'momento_3_a_trabajar', titulo: '3. ¡A trabajar!' },
    { key: 'momento_4_comunicamos', titulo: '4. Comunicamos' },
    { key: 'momento_5_reflexion', titulo: '5. Reflexión' },
  ]

  const porcentajeReal = progreso.totalLotes > 0
    ? Math.min(99, Math.round((progreso.lotesCompletados / progreso.totalLotes) * 100))
    : 5

  const batchesCount = Math.max(progreso.totalLotes - 1, 0)

  function construirSegmentosFases(fases: string[]): { momento: string; loteInicio: number; loteFin: number }[] {
    const segmentos: { momento: string; loteInicio: number; loteFin: number }[] = []
    fases.forEach((momento, idx) => {
      const ultimo = segmentos[segmentos.length - 1]
      if (ultimo && ultimo.momento === momento) {
        ultimo.loteFin = idx
      } else {
        segmentos.push({ momento, loteInicio: idx, loteFin: idx })
      }
    })
    return segmentos
  }

  const fasesLotesReales = (progreso.fasesLotes || []).slice(0, batchesCount)
  const haySubfasesReales = batchesCount > 0 && fasesLotesReales.length === batchesCount
  const segmentosFases = haySubfasesReales ? construirSegmentosFases(fasesLotesReales) : []

  type ItemChecklist =
    | { tipo: 'fijo'; id: 'contexto' | 'actividades' | 'rubrica' | 'listo'; titulo: string }
    | { tipo: 'subfase'; id: string; titulo: string; loteInicio: number; loteFin: number }
    | { tipo: 'placeholder'; id: string; titulo: string }

  const itemsChecklist: ItemChecklist[] = [
    { tipo: 'fijo', id: 'contexto', titulo: 'Leyendo el calendario y el contexto de tu grupo' },
  ]

  if (haySubfasesReales) {
    segmentosFases.forEach((seg, i) => {
      itemsChecklist.push({ tipo: 'subfase', id: `subfase-${i}`, titulo: seg.momento, loteInicio: seg.loteInicio, loteFin: seg.loteFin })
    })
  } else if (progreso.totalLotes > 0) {
    itemsChecklist.push({ tipo: 'fijo', id: 'actividades', titulo: 'Escribiendo las actividades día por día' })
  } else {
    const nombresPlaceholder = NOMBRES_FASES_MODALIDAD[form.metodologia] || NOMBRES_FASES_MODALIDAD['Proyectos']
    nombresPlaceholder.forEach((nombre, i) => {
      itemsChecklist.push({ tipo: 'placeholder', id: `placeholder-${i}`, titulo: nombre })
    })
  }

  itemsChecklist.push({ tipo: 'fijo', id: 'rubrica', titulo: 'Construyendo tu rúbrica de evaluación' })
  itemsChecklist.push({ tipo: 'fijo', id: 'listo', titulo: '¡Tu planeación está lista!' })

  const contextoCompletado = (progreso.totalLotes > 0 || progreso.lotesCompletados > 0) && tiempoMinimoPaso1Cumplido

  function estadoDeItem(item: ItemChecklist): EstadoPaso {
    if (item.tipo === 'fijo' && item.id === 'contexto') {
      if (contextoCompletado) return 'completado'
      return progreso.estado === 'en_progreso' ? 'activo' : 'pendiente'
    }
    if (item.tipo === 'placeholder') return 'pendiente'
    if (!contextoCompletado) return 'pendiente'
    if (item.tipo === 'fijo' && item.id === 'actividades') {
      if (progreso.totalLotes === 0) return 'pendiente'
      if (batchesCount === 0) return 'completado'
      if (progreso.lotesCompletados >= batchesCount) return 'completado'
      return 'activo'
    }
    if (item.tipo === 'subfase') {
      if (item.loteFin < progreso.lotesCompletados) return 'completado'
      if (item.loteInicio <= progreso.lotesCompletados && progreso.lotesCompletados <= item.loteFin) return 'activo'
      return 'pendiente'
    }
    if (item.tipo === 'fijo' && item.id === 'rubrica') {
      if (progreso.estado === 'completado') return 'completado'
      if (progreso.totalLotes === 0) return 'pendiente'
      if (batchesCount === 0) return 'activo'
      if (progreso.lotesCompletados >= batchesCount) return 'activo'
      return 'pendiente'
    }
    return progreso.estado === 'completado' ? 'completado' : 'pendiente'
  }

  const itemActivo = itemsChecklist.find(it => estadoDeItem(it) === 'activo')
  const mostrarEngranaje = progreso.estado === 'en_progreso' && !!itemActivo && itemActivo.id !== 'contexto' && itemActivo.id !== 'listo'

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px' }}>

        {generating && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ background: 'white', borderRadius: 14, padding: 32, boxShadow: '0 2px 12px rgba(61,58,140,0.08)', marginBottom: 24 }}>
              <style>{`
                @keyframes planiaPulso {
                  0% { transform: scale(1); opacity: 0.35; }
                  50% { transform: scale(1.9); opacity: 0; }
                  100% { transform: scale(1); opacity: 0; }
                }
                @keyframes planiaEngranaje {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>

              <div style={{ height: 42, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mostrarEngranaje ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3D3A8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <g style={{ animation: 'planiaEngranaje 2s linear infinite', transformOrigin: '12px 12px' }}>
                      <path d="M12 2v3.5M12 18.5V22M4.22 4.22l2.47 2.47M17.31 17.31l2.47 2.47M2 12h3.5M18.5 12H22M4.22 19.78l2.47-2.47M17.31 6.69l2.47-2.47" />
                      <circle cx="12" cy="12" r="4.5" />
                    </g>
                  </svg>
                ) : (
                  <span style={{ fontSize: 32 }}>✨</span>
                )}
              </div>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h3 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 18 }}>CREANDO TU PLANEACIÓN</h3>
                <p style={{ color: '#666', fontSize: 13, marginBottom: 0, marginTop: 0 }}>
                  Diseñada para <strong>{gradoGrupo || '2°'}{seccionGrupo ? ` ${seccionGrupo}` : ''}</strong>{totalAlumnos ? <> con <strong>{totalAlumnos} alumnos</strong></> : null}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, background: '#EEEDF8', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: 'linear-gradient(90deg, #3D3A8C, #00A896)', height: '100%', borderRadius: 99, width: `${porcentajeReal}%`, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{
                  minWidth: 42, height: 24, borderRadius: 99, flexShrink: 0, padding: '0 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: porcentajeReal >= 100 ? '#00A896' : 'linear-gradient(90deg, #3D3A8C, #00A896)',
                  color: 'white', fontSize: 11, fontWeight: 700,
                }}>
                  {porcentajeReal >= 100 ? '✓' : `${porcentajeReal}%`}
                </div>
              </div>

              {progreso.estado === 'error' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 18px', borderRadius: 10,
                  background: '#FEF2F2', border: '1.5px solid #FCA5A5',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#DC2626', fontSize: 12, color: 'white', fontWeight: 700,
                  }}>!</div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#DC2626' }}>
                    {progreso.errorMensaje || 'Ocurrió un error al generar tu planeación.'}
                  </p>
                </div>
              ) : (
                <div style={{ border: '1px solid #EEEDF8', borderRadius: 10, overflow: 'hidden' }}>
                  {itemsChecklist.map((item, idx) => {
                    const estadoPaso = estadoDeItem(item)
                    const esActivo = estadoPaso === 'activo'
                    const esCompletado = estadoPaso === 'completado'

                    let mostrarMiniBarra = false
                    let miniPorcentaje = 0
                    let bloqueActual = 0
                    let bloqueTotal = 0

                    if (esActivo && item.tipo === 'fijo' && item.id === 'actividades' && batchesCount > 0) {
                      mostrarMiniBarra = true
                      bloqueTotal = batchesCount
                      bloqueActual = Math.min(progreso.lotesCompletados + 1, batchesCount)
                      miniPorcentaje = Math.min(100, Math.round((progreso.lotesCompletados / batchesCount) * 100))
                    }
                    if (esActivo && item.tipo === 'subfase') {
                      bloqueTotal = item.loteFin - item.loteInicio + 1
                      if (bloqueTotal > 1) {
                        mostrarMiniBarra = true
                        bloqueActual = Math.min(progreso.lotesCompletados - item.loteInicio + 1, bloqueTotal)
                        miniPorcentaje = Math.min(100, Math.round(((progreso.lotesCompletados - item.loteInicio) / bloqueTotal) * 100))
                      }
                    }

                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: '14px 18px',
                        borderTop: idx === 0 ? 'none' : '1px solid #F0EFF8',
                        background: esActivo ? '#F4F3FB' : 'white',
                        transition: 'background 0.3s ease',
                      }}>
                        <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
                          {esActivo && (
                            <span style={{
                              position: 'absolute', inset: 0, borderRadius: '50%',
                              background: '#3D3A8C', opacity: 0.35,
                              animation: 'planiaPulso 1.6s ease-out infinite',
                            }} />
                          )}
                          <div style={{
                            position: 'relative', width: 22, height: 22, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: esCompletado ? '#00A896' : esActivo ? '#3D3A8C' : '#E5E7EB',
                            fontSize: 12, color: 'white', fontWeight: 700,
                            transition: 'background 0.3s ease',
                          }}>
                            {esCompletado ? '✓' : esActivo ? '●' : ''}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{
                            margin: 0, fontSize: 14,
                            fontWeight: esActivo || esCompletado ? 700 : 400,
                            color: esCompletado ? '#00A896' : esActivo ? '#3D3A8C' : '#9CA3AF',
                          }}>
                            {item.titulo}
                          </p>

                          {mostrarMiniBarra && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 6px' }}>
                                <span style={{ fontSize: 12, color: '#00A896', fontWeight: 600 }}>
                                  {progreso.faseActual}
                                </span>
                                <span style={{ fontSize: 12, color: '#00A896', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 12 }}>
                                  Bloque {bloqueActual} de {bloqueTotal}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, background: '#E0DFF5', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                                  <div style={{
                                    background: '#00A896', height: '100%', borderRadius: 99,
                                    width: `${miniPorcentaje}%`, transition: 'width 0.5s ease',
                                  }} />
                                </div>
                                <div style={{
                                  minWidth: 32, height: 18, borderRadius: 99, flexShrink: 0, padding: '0 6px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: miniPorcentaje >= 100 ? '#00A896' : '#3D3A8C',
                                  color: 'white', fontSize: 10, fontWeight: 700,
                                }}>
                                  {miniPorcentaje >= 100 ? '✓' : `${miniPorcentaje}%`}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 18, padding: '10px 16px', borderRadius: 99,
                background: '#F4F3FB',
              }}>
                <span style={{ fontSize: 15 }}>⏱️</span>
                <p style={{ color: '#3D3A8C', fontSize: 13, fontWeight: 600, textAlign: 'center', margin: 0 }}>
                  Las planeaciones más completas pueden tomar un par de minutos — no cierres esta ventana
                </p>
              </div>
            </div>
          </div>
        )}

        {!generating && !result && (
          <>
            <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '16px 32px', marginBottom: 24, textAlign: 'center' }}>
              <h2 style={{ color: 'white', marginTop: 0, marginBottom: 6, fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>NUEVA PLANEACIÓN</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 0, marginTop: 0 }}>
                {profile.school_name && <><strong style={{ color: 'rgba(255,255,255,0.9)' }}>JN:</strong> {nombreCorto(profile.school_name)} · </>}
                <strong style={{ color: 'rgba(255,255,255,0.9)' }}>CCT:</strong> {profile.cct_primary} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''}
              </p>
            </div>

            {avisoAvance && !avisoDescartado && (
              <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🎯</span>
                  <p style={{ margin: 0, fontSize: 13, color: '#3730A3', lineHeight: 1.6 }}>
                    <strong>Sugerido por Mi Avance:</strong>{' '}
                    {avisoAvance.campo && <>este proyecto ya preseleccionó el campo formativo <strong>{avisoAvance.campo}</strong>{avisoAvance.eje ? ' — ' : '.'}</>}
                    {avisoAvance.eje && <>intenta enfocarlo también en el eje <strong>{avisoAvance.eje}</strong>, si la situación problema lo permite de forma natural.</>}
                    {' '}Puedes cambiar cualquiera de los dos libremente.
                  </p>
                </div>
                <button onClick={() => setAvisoDescartado(true)} style={{ background: 'none', border: 'none', color: '#3730A3', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>

              <div style={{ ...s.card, height: '100%', boxSizing: 'border-box' }}>
                <p style={s.sectionTitle}>1 · Datos del proyecto</p>
                <label style={s.label}>Nombre del proyecto *</label>
                <input ref={refNombreInput} placeholder="Ej: El agua en nuestra vida" value={form.nombre_proyecto} onChange={e => update('nombre_proyecto', e.target.value)} style={{ ...s.input, ...estiloResaltado('nombre') }} />
                {campoInvalido === 'nombre' && <p style={{ color: '#DC2626', fontSize: 12, margin: '-12px 0 12px' }}>Este campo es obligatorio.</p>}
                <label style={s.label}>Situación problema *</label>
                <textarea ref={refSituacionInput} placeholder="¿Qué situación del entorno motivó este proyecto?" value={form.situacion_problema} onChange={e => update('situacion_problema', e.target.value)} onInput={ajustarAlturaTextarea} rows={3} style={{ ...s.textarea, ...estiloResaltado('situacion') }} />
                {campoInvalido === 'situacion' && <p style={{ color: '#DC2626', fontSize: 12, margin: '-12px 0 12px' }}>Este campo es obligatorio.</p>}
                <label style={s.label}>Finalidad *</label>
                <textarea ref={finalidadRef} placeholder="¿Qué lograrán los alumnos al concluir este proyecto?" value={form.finalidad} onChange={e => update('finalidad', e.target.value)} onInput={ajustarAlturaTextarea} rows={3} style={{ ...s.textarea, ...estiloResaltado('finalidad') }} />
                {campoInvalido === 'finalidad' && <p style={{ color: '#DC2626', fontSize: 12, margin: '-12px 0 12px' }}>Este campo es obligatorio.</p>}
                <div style={{ background: '#F8F8FE', border: '1px solid #D8D6F0', borderRadius: 10, padding: 16 }}>
                  <label style={{ ...s.label, marginBottom: 4 }}>
                    Recursos o materiales específicos
                    <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 6 }}>(opcional)</span>
                  </label>
                  <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5 }}>¿Tu directora indicó usar algún material en específico? El agente lo integrará en las actividades.</p>
                  <textarea placeholder="Ej: báscula, objetos de medición, lupas, material reciclado..." value={form.recursos_materiales} onChange={e => update('recursos_materiales', e.target.value)} onInput={ajustarAlturaTextarea} rows={2}
                    style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', background: 'white' } as React.CSSProperties} />
                </div>
              </div>

              <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, height: '100%', boxSizing: 'border-box' as const }}>
                <div ref={refModalidadSection} style={{ marginBottom: 24, padding: 6, borderRadius: 10, ...(modalidadBloqueada ? { boxShadow: '0 0 0 3px #EF4444', transition: 'box-shadow 0.25s ease' } : estiloResaltado('modalidad')) }}>
                  <p style={s.sectionTitle}>2 · Modalidad de trabajo</p>
                  <label style={s.label}>
                    Modalidad didáctica *
                    <span style={{ fontWeight: 400, color: '#00A896', fontSize: 12, marginLeft: 8, background: '#E8F5F2', padding: '2px 8px', borderRadius: 99 }}>Sugerida por NEM 2022</span>
                  </label>
                  <select value={form.metodologia} onChange={e => handleMetodologiaChange(e.target.value)}
                    style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 8, background: 'white', cursor: 'pointer' } as React.CSSProperties}>
                    <option value="Proyectos">⭐ Proyectos — sugerida NEM 2022</option>
                    <option value="ABJ">Aprendizaje Basado en Juegos (ABJ)</option>
                    <option value="Taller crítico">Taller crítico</option>
                    <option value="Rincones">Rincones de aprendizaje</option>
                    <option value="Centros de interés">Centros de interés</option>
                    <option value="Unidad didáctica">Unidad didáctica</option>
                  </select>
                  <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5 }}>
                    {form.metodologia === 'Proyectos' && 'Parte de una situación problema real del entorno. Modalidad preferente según NEM 2022.'}
                    {form.metodologia === 'ABJ' && '4 momentos: Planteamiento → Desarrollo → Compartimos → Comunidad de juego.'}
                    {form.metodologia === 'Taller crítico' && 'Parte de una situación inicial y promueve análisis y reflexión colectiva.'}
                    {form.metodologia === 'Rincones' && 'Espacios diferenciados donde los niños exploran de forma autónoma.'}
                    {form.metodologia === 'Centros de interés' && 'Parte del contacto directo con la realidad e intereses del grupo.'}
                    {form.metodologia === 'Unidad didáctica' && 'Trama de complejidad creciente con múltiples momentos estructurados.'}
                  </p>

                  {cambioModalidadInfo && !cambioModalidadConfirmado && (
                    <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '14px 16px', marginTop: 12 }}>
                      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#991B1B', lineHeight: 1.6 }}>
                        🔄 Tu periodo tiene {cambioModalidadInfo.diasReales} día(s) hábil(es) reales dentro del ciclo escolar — no alcanza para <strong>"{cambioModalidadInfo.original}"</strong> (necesita mínimo {cambioModalidadInfo.necesariosOriginal}). Cambiamos automáticamente a <strong>"{cambioModalidadInfo.nueva}"</strong> (necesita mínimo {cambioModalidadInfo.necesariosNueva}).
                      </p>
                      <button onClick={confirmarCambioModalidad}
                        style={{ background: '#DC2626', color: 'white', border: 'none', padding: '10px 16px', fontSize: 13, cursor: 'pointer', borderRadius: 8, fontWeight: 600 }}>
                        ✅ Entendido, continuar con "{cambioModalidadInfo.nueva}"
                      </button>
                    </div>
                  )}

                  {diasHabilesReales !== null && !modalidadActualCabe && (
                    <div style={{ background: hayModalidadQueQuepa ? '#FFF7ED' : '#FEF2F2', border: `1.5px solid ${hayModalidadQueQuepa ? '#FDBA74' : '#FCA5A5'}`, borderRadius: 10, padding: '14px 16px', marginTop: 12 }}>
                      {hayModalidadQueQuepa ? (
                        <p style={{ margin: 0, fontSize: 13, color: '#9A3412', lineHeight: 1.6 }}>
                          ⚠️ La modalidad <strong>"{form.metodologia}"</strong> necesita mínimo {momentosNecesarios} día(s) hábil(es), pero tu periodo solo tiene {diasHabilesReales} dentro del ciclo escolar. Cambia de modalidad arriba (por ejemplo: <strong>{modalidadesDisponibles.join(', ')}</strong>) o ajusta las fechas.
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: '#991B1B', lineHeight: 1.6 }}>
                          🚫 Tu periodo solo tiene {diasHabilesReales} día(s) hábil(es) reales dentro del ciclo escolar — no alcanza para ninguna modalidad disponible. Ajusta las fechas para incluir más días hábiles.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div ref={refCampoFormativoSection} style={{ marginBottom: 24, padding: 6, borderRadius: 10, ...estiloResaltado(campoInvalido === 'pdas' ? 'pdas' : 'campoFormativo') }}>
                  <p style={s.sectionTitle}>3 · Campo formativo principal</p>
                  {campoInvalido === 'campoFormativo' && (
                    <p style={{ color: '#DC2626', fontSize: 12, margin: '0 0 10px', fontWeight: 600 }}>Selecciona un campo formativo y al menos un contenido.</p>
                  )}
                  {campoInvalido === 'pdas' && (
                    <p style={{ color: '#DC2626', fontSize: 12, margin: '0 0 10px', fontWeight: 600 }}>Selecciona al menos un PDA de los contenidos elegidos.</p>
                  )}
                  <label style={s.label}>Campo formativo *</label>
                  <select value={principalCampo} onChange={e => { setPrincipalCampo(e.target.value); if (campoInvalido === 'campoFormativo') setCampoInvalido(null) }}
                    style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 20, background: 'white', cursor: 'pointer' } as React.CSSProperties}>
                    <option value="">— Selecciona un campo —</option>
                    {CAMPOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  {principalCampo && contenidosDisponibles.length > 0 && (
                    <div>
                      <label style={{ ...s.label, marginBottom: 10 }}>
                        Contenidos *
                        <span style={{ fontWeight: 400, color: '#888', fontSize: 12, marginLeft: 8 }}>Selecciona uno o más</span>
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 20 }}>
                        {contenidosDisponibles.map(contenido => {
                          const elegido = contenidosElegidos.find(c => c.contenido === contenido)
                          const isChecked = !!elegido
                          return (
                            <div key={contenido}>
                              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${isChecked ? '#3D3A8C' : '#E0DFF5'}`, background: isChecked ? '#F4F3FB' : 'white', transition: 'all 0.15s' }}>
                                <input type="checkbox" checked={isChecked} onChange={() => toggleContenido(contenido)}
                                  style={{ marginTop: 2, width: 16, height: 16, accentColor: '#3D3A8C', flexShrink: 0, cursor: 'pointer' }} />
                                <span style={{ fontSize: 13, lineHeight: 1.5, color: isChecked ? '#1A1A2E' : '#555', fontWeight: isChecked ? 600 : 400 }}>{contenido}</span>
                              </label>
                              {isChecked && (
                                <div style={{ marginLeft: 14, marginTop: 6, marginBottom: 4, paddingLeft: 14, borderLeft: '2px solid #D8D6F0' }}>
                                  {cargandoPdas[contenido] ? (
                                    <p style={{ color: '#aaa', fontSize: 12, margin: '8px 0' }}>Cargando PDAs...</p>
                                  ) : (
                                    <>
                                      {(pdasPorContenido[contenido] || []).filter(p => !p.esAvanzado).length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                          <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '8px 0 6px' }}>{gradoGrupo} grado</p>
                                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                                            {(pdasPorContenido[contenido] || []).filter(p => !p.esAvanzado).map(pda => {
                                              const seleccionado = elegido?.pdasSeleccionados.some(p => p.pda === pda.pda) || false
                                              return (
                                                <label key={pda.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${seleccionado ? '#00A896' : '#E8E8F0'}`, background: seleccionado ? '#E0F5F3' : '#FAFAFA', transition: 'all 0.15s' }}>
                                                  <input type="checkbox" checked={seleccionado} onChange={() => togglePda(contenido, pda)}
                                                    style={{ marginTop: 2, width: 15, height: 15, accentColor: '#00A896', flexShrink: 0, cursor: 'pointer' }} />
                                                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, flex: 1 }}>
                                                    <span style={{ fontSize: 13, lineHeight: 1.6, color: '#1A1A2E' }}>{pda.pda}</span>
                                                    {(profile?.pdas_prioritarios || []).some((p: any) => p.pda === pda.pda) && (
                                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#00A896', background: '#E0F5F3', border: '1px solid #00A896', borderRadius: 20, padding: '1px 8px', alignSelf: 'flex-start', letterSpacing: '0.05em' }}>
                                                        ⭐ Prioritario para tu grupo
                                                      </span>
                                                    )}
                                                    {getBadgesCapa2(profile?.evaluacion_individual, pda.pda) && (
                                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', border: '1px solid #7C3AED', borderRadius: 20, padding: '1px 8px', alignSelf: 'flex-start', letterSpacing: '0.05em' }}>
                                                        🧒 Necesidad individual detectada
                                                      </span>
                                                    )}
                                                    {getBadgesCapa3(profile?.pdas_jardin, pda.pda) && (
                                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 20, padding: '1px 8px', alignSelf: 'flex-start', letterSpacing: '0.05em' }}>
                                                        📌 Prioritario del jardín
                                                      </span>
                                                    )}
                                                  </div>
                                                </label>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      {(pdasPorContenido[contenido] || []).filter(p => p.esAvanzado).length > 0 && (
                                        <details style={{ marginTop: 6 }}>
                                          <summary style={{ fontSize: 12, color: '#00A896', cursor: 'pointer', userSelect: 'none', padding: '6px 0', fontWeight: 600 }}>
                                            ¿Tu grupo ya superó este nivel? Ver PDAs de grado avanzado ▼
                                          </summary>
                                          <div style={{ marginTop: 8 }}>
                                            {['2°', '3°'].map(grado => {
                                              const pdasDeGrado = (pdasPorContenido[contenido] || []).filter(p => p.esAvanzado && p.grado === grado)
                                              if (pdasDeGrado.length === 0) return null
                                              return (
                                                <div key={grado} style={{ marginBottom: 10 }}>
                                                  <p style={{ fontSize: 11, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '6px 0' }}>{grado} grado — nivel avanzado</p>
                                                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                                                    {pdasDeGrado.map(pda => {
                                                      const seleccionado = elegido?.pdasSeleccionados.some(p => p.pda === pda.pda) || false
                                                      return (
                                                        <label key={pda.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${seleccionado ? '#00A896' : '#E8E8F0'}`, background: seleccionado ? '#E0F5F3' : '#F5FFFE', transition: 'all 0.15s' }}>
                                                          <input type="checkbox" checked={seleccionado} onChange={() => togglePda(contenido, pda)}
                                                            style={{ marginTop: 2, width: 15, height: 15, accentColor: '#00A896', flexShrink: 0, cursor: 'pointer' }} />
                                                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, flex: 1 }}>
                                                            <span style={{ fontSize: 13, lineHeight: 1.6, color: '#1A1A2E' }}>{pda.pda}</span>
                                                            {(profile?.pdas_prioritarios || []).some((p: any) => p.pda === pda.pda) && (
                                                              <span style={{ fontSize: 10, fontWeight: 700, color: '#00A896', background: '#E0F5F3', border: '1px solid #00A896', borderRadius: 20, padding: '1px 8px', alignSelf: 'flex-start', letterSpacing: '0.05em' }}>
                                                                ⭐ Prioritario para tu grupo
                                                              </span>
                                                            )}
                                                            {getBadgesCapa2(profile?.evaluacion_individual, pda.pda) && (
                                                              <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', border: '1px solid #7C3AED', borderRadius: 20, padding: '1px 8px', alignSelf: 'flex-start', letterSpacing: '0.05em' }}>
                                                                🧒 Necesidad individual detectada
                                                              </span>
                                                            )}
                                                            {getBadgesCapa3(profile?.pdas_jardin, pda.pda) && (
                                                              <span style={{ fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 20, padding: '1px 8px', alignSelf: 'flex-start', letterSpacing: '0.05em' }}>
                                                                📌 Prioritario del jardín
                                                              </span>
                                                            )}
                                                          </div>
                                                        </label>
                                                      )
                                                    })}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </details>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {hayPdasSeleccionados && (
                    <div style={{ background: '#F0FFF8', border: '1.5px solid #00A896', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        ✓ {todasPdasSeleccionadas.length} PDA{todasPdasSeleccionadas.length > 1 ? 's' : ''} seleccionado{todasPdasSeleccionadas.length > 1 ? 's' : ''}
                      </p>
                      {contenidosElegidos.filter(c => c.pdasSeleccionados.length > 0).map(c => (
                        <p key={c.contenido} style={{ margin: '3px 0', fontSize: 12, color: '#065f46' }}>
                          <strong>{c.pdasSeleccionados.length}</strong> de "{c.contenido.substring(0, 50)}..."
                        </p>
                      ))}
                    </div>
                  )}

                  {hayPdasSeleccionados && sugirendoTransversales && !ejePrincipal && (
                    <p style={{ fontSize: 13, color: '#3D3A8C', fontWeight: 600, margin: '4px 0 0' }}>
                      {MENSAJES_SUGERENCIA[mensajeSugerencia]}
                    </p>
                  )}
                  {errorTransversales && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 8 }}>{errorTransversales}</p>}
                </div>

                {ejePrincipal && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={s.sectionTitle}>4 · Eje articulador <span style={{ color: '#DC2626', fontWeight: 400 }}>(obligatorio)</span></p>
                    <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
                      MÍA determinó automáticamente el eje que mejor articula tu proyecto. Si no te convence, puedes cambiarlo abajo.
                    </p>
                    <div style={{ border: '1.5px solid #3D3A8C', borderRadius: 10, padding: 16, marginBottom: 12, background: '#F4F3FB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Eje principal</span>
                        <span style={{ fontSize: 11, background: '#00A896', color: 'white', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                          {ejePrincipalVieneDeMiAvance ? '🎯 Sugerido por Mi Avance' : 'Determinado automáticamente'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>{ejePrincipal}</p>
                    </div>
                    <button onClick={() => setEjePrincipalDescartado(true)}
                      style={{ background: '#FFF0F0', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, marginBottom: 12, display: 'block' }}>
                      Cambiar eje principal
                    </button>
                    {ejePrincipalDescartado && (
                      <div style={{ background: '#F8F8FE', border: '1px solid #E0DFF5', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#666' }}>Elige un eje principal diferente:</p>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                          {ejesDisponibles.filter(e => e !== ejePrincipal).map(eje => (
                            <button key={eje} onClick={() => { setEjePrincipal(eje); setEjePrincipalDescartado(false) }}
                              style={{ textAlign: 'left' as const, background: 'white', border: '1.5px solid #E0DFF5', borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: '#1A1A2E' }}>
                              {eje}
                            </button>
                          ))}
                          <button onClick={() => setEjePrincipalDescartado(false)}
                            style={{ textAlign: 'left' as const, background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
                            ← Mantener eje recomendado
                          </button>
                        </div>
                      </div>
                    )}
                    {!ejeSecundarioDescartado && !ejeElegidoPorEducadora ? (
                      <div style={{ border: '1.5px solid #00A896', borderRadius: 10, padding: 16, marginBottom: 8, background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#00A896', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Eje secundario sugerido</p>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A2E' }}>{ejeSecundario}</p>
                          </div>
                          <button onClick={() => setEjeSecundarioDescartado(true)}
                            style={{ background: '#FFF0F0', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                            Cambiar
                          </button>
                        </div>
                      </div>
                    ) : ejeSecundarioDescartado && !ejeElegidoPorEducadora ? (
                      <div style={{ background: '#F8F8FE', border: '1px solid #E0DFF5', borderRadius: 10, padding: 16, marginBottom: 8 }}>
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#666' }}>Elige un eje secundario alternativo:</p>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                          {ejesDisponibles.filter(e => e !== ejePrincipal && e !== ejeSecundario).map(eje => (
                            <button key={eje} onClick={() => setEjeElegidoPorEducadora(eje)}
                              style={{ textAlign: 'left' as const, background: 'white', border: '1.5px solid #E0DFF5', borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: '#1A1A2E' }}>
                              {eje}
                            </button>
                          ))}
                          <button onClick={() => { setEjeSecundarioDescartado(false); setEjeElegidoPorEducadora('') }}
                            style={{ textAlign: 'left' as const, background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
                            ← Mantener el sugerido
                          </button>
                        </div>
                      </div>
                    ) : ejeElegidoPorEducadora ? (
                      <div style={{ border: '1.5px solid #00A896', borderRadius: 10, padding: 16, marginBottom: 8, background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#00A896', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Eje secundario elegido</p>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A2E' }}>{ejeElegidoPorEducadora}</p>
                          </div>
                          <button onClick={() => { setEjeElegidoPorEducadora(''); setEjeSecundarioDescartado(true) }}
                            style={{ background: '#FFF0F0', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                            Cambiar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {transversales.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={s.sectionTitle}>5 · Campos transversales sugeridos <span style={{ color: '#888', fontWeight: 400 }}>(opcional)</span></p>
                    <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
                      El sistema analizó tu proyecto y sugirió estos campos. Son completamente opcionales — puedes descartar los que no apliquen.
                    </p>
                    {transversales.map((t, i) => (
                      <div key={i} style={{ border: `1.5px solid ${t.activo ? '#00A896' : '#E0E0E0'}`, borderRadius: 10, padding: 16, marginBottom: 12, background: t.activo ? 'white' : '#FAFAFA', opacity: t.activo ? 1 : 0.5, transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: t.activo ? 12 : 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: t.activo ? '#00A896' : '#999', textTransform: 'uppercase', letterSpacing: '0.07em' }}>🔗 Transversal {i + 1}</p>
                          <button onClick={() => t.activo ? descartarTransversal(i) : reactivarTransversal(i)}
                            style={{ background: t.activo ? '#FFF0F0' : '#F0FFF8', border: `1px solid ${t.activo ? '#FCA5A5' : '#6EE7B7'}`, color: t.activo ? '#DC2626' : '#059669', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                            {t.activo ? '✕ Descartar' : '+ Restaurar'}
                          </button>
                        </div>
                        {t.activo && (
                          <>
                            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>Campo formativo</p>
                            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>{t.campo}</p>
                            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>Contenido</p>
                            <p style={{ margin: '0 0 10px', fontSize: 14, color: '#444' }}>{t.contenido}</p>
                            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>PDA</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6, background: '#E0F5F3', padding: '10px 12px', borderRadius: 8, fontStyle: 'italic' }}>{t.pda}</p>
                          </>
                        )}
                      </div>
                    ))}
                    <div style={{ paddingTop: 8 }}>
                      <button onClick={sugerirTransversales} disabled={sugirendoTransversales}
                        style={{ background: sugirendoTransversales ? '#F0EFF8' : '#EEEDF8', color: '#3D3A8C', border: '1.5px solid #3D3A8C', padding: '10px 18px', fontSize: 14, cursor: sugirendoTransversales ? 'default' : 'pointer', borderRadius: 8, fontWeight: 600, width: '100%' }}>
                        {sugirendoTransversales ? MENSAJES_SUGERENCIA[mensajeSugerencia] : '🔄 Actualizar sugerencias (eje + transversales)'}
                      </button>
                    </div>
                  </div>
                )}

                <div ref={refFechaSection} style={{ marginBottom: 24, padding: 6, borderRadius: 10, ...estiloResaltado('fecha') }}>
                  <p style={s.sectionTitle}>{ejePrincipal ? (transversales.length > 0 ? '6' : '5') : (transversales.length > 0 ? '5' : '4')} · Período de aplicación</p>
                  {campoInvalido === 'fecha' && (
                    <p style={{ color: '#DC2626', fontSize: 12, margin: '0 0 10px', fontWeight: 600 }}>{mensajeErrorFecha}</p>
                  )}
                  <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                    Elige la fecha en que inicias y la fecha en que terminas.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                    <div>
                      <label style={s.label}>Fecha de inicio *</label>
                      <input type="date" min={MODO_PRUEBA_FECHAS_PASADAS ? FECHA_MINIMA_PRUEBA : hoyISO} value={form.fecha_inicio} onChange={e => update('fecha_inicio', e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Fecha de término *</label>
                      <input type="date" min={form.fecha_inicio || (MODO_PRUEBA_FECHAS_PASADAS ? FECHA_MINIMA_PRUEBA : hoyISO)} value={form.fecha_fin} onChange={e => update('fecha_fin', e.target.value)} style={s.input} />
                    </div>
                  </div>

                  {form.fecha_inicio && form.fecha_fin && diasHabilesNaive > 0 && diasHabilesReales !== null && (
                    <div style={{ background: '#E8F5F2', border: '1px solid #00A896', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>📅</span>
                      <p style={{ fontSize: 13, color: '#065F46', margin: 0, fontWeight: 500 }}>
                        Tu proyecto tiene <strong>{diasHabilesReales} día(s) hábil(es) reales</strong> dentro del ciclo escolar.
                        {diasHabilesReales < diasHabilesNaive && (
                          <> ({diasHabilesNaive - diasHabilesReales} día(s) del rango elegido caen en vacaciones, CTE o fuera del ciclo.)</>
                        )}
                      </p>
                    </div>
                  )}
                  {form.fecha_inicio && form.fecha_fin && diasHabilesNaive > 0 && diasHabilesReales === null && (
                    <div style={{ background: '#F8F8FE', border: '1px solid #E0DFF5', borderRadius: 8, padding: '10px 14px' }}>
                      <p style={{ fontSize: 13, color: '#666', margin: 0 }}>Verificando días hábiles reales dentro del ciclo escolar...</p>
                    </div>
                  )}
                  {form.fecha_inicio && form.fecha_fin && diasHabilesNaive === 0 && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px' }}>
                      <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>La fecha de término debe ser posterior a la fecha de inicio.</p>
                    </div>
                  )}
                </div>

                {cambioModalidadInfo && cambioModalidadConfirmado && (
                  <div style={{ background: '#F4F3FB', border: '1px solid #D8D6F0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🔄</span>
                    <p style={{ margin: 0, fontSize: 12, color: '#3D3A8C', fontWeight: 600 }}>
                      Modalidad cambiada de "{cambioModalidadInfo.original}" a "{cambioModalidadInfo.nueva}" — tu periodo solo tiene {cambioModalidadInfo.diasReales} día(s) hábil(es) reales.
                    </p>
                  </div>
                )}

                <button ref={refBotonGenerar} onClick={handleGenerar} disabled={generating}
                  style={{ background: generating ? '#D0D0D0' : (todosCamposCompletos ? '#00A896' : '#B9B9B9'), color: 'white', border: 'none', padding: '15px 24px', fontSize: 16, cursor: generating ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600, transition: 'background 0.2s' }}>
                  ✨ Generar planeación con IA
                </button>

              </div>
            </div>
          </>
        )}

        {result && (
          <div style={{ background: 'white', borderRadius: 14, padding: 32, boxShadow: '0 2px 12px rgba(61,58,140,0.08)' }}>
            <h3 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 8 }}>Planeación generada</h3>
            {saveStatus && (
              <p style={{ fontSize: 13, color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, marginBottom: 20 }}>
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
    </SidebarWrapper>
  )
}

export default function NuevaPlaneacionPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: '#3D3A8C' }}>Cargando...</p>
      </div>
    }>
      <NuevaPlaneacionInner />
    </Suspense>
  )
}