'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import { supabase } from '@/lib/supabase'

const CAMPOS = [
  'Lenguajes',
  'Saberes y Pensamiento Científico',
  'Ética, Naturaleza y Sociedades',
  'De lo Humano y lo Comunitario',
]

function getPasosProgreso(totalAlumnos: number) {
  return [
    { texto: 'Leyendo el contexto de tu grupo...', porcentaje: 10 },
    { texto: 'Conectando el PDA con la realidad de tus alumnos...', porcentaje: 25 },
    { texto: 'Construyendo el punto de partida de tu proyecto...', porcentaje: 40 },
    { texto: `Diseñando actividades para tus ${totalAlumnos} niños específicamente...`, porcentaje: 60 },
    { texto: 'Integrando materiales y preguntas detonadoras...', porcentaje: 75 },
    { texto: 'Redactando el cierre con la voz de tu grupo...', porcentaje: 88 },
    { texto: 'Ajustando el tono y estilo a tu forma de enseñar...', porcentaje: 95 },
  ]
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

interface PdaItem {
  id: string
  grado: string
  pda: string
  orden: number
  esAvanzado: boolean
}

interface ContenidoSeleccionado {
  contenido: string
  pdasSeleccionados: string[]
}

interface Transversal {
  campo: string
  contenido: string
  pda: string
  activo: boolean
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

export default function NuevaPlaneacionPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [pasoActual, setPasoActual] = useState(0)
  const [porcentaje, setPorcentaje] = useState(0)
  const [result, setResult] = useState<any>(null)
  const [saveStatus, setSaveStatus] = useState('')

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
  const [mensajeEspera, setMensajeEspera] = useState(0)
  const [esperaFinal, setEsperaFinal] = useState(false)
  const [puntos, setPuntos] = useState('.')

  const MENSAJES_SUGERENCIA = [
    'Leyendo tu proyecto...',
    'Revisando el catálogo de PDAs...',
    'Buscando campos coherentes...',
    'Analizando la situación problema...',
    'Casi listo...',
  ]

  const MENSAJES_ESPERA = [
    'Revisando coherencia pedagógica...',
    'Verificando que los PDAs estén bien integrados...',
    'Puliendo el lenguaje narrativo...',
    'Casi lista, revisando los detalles finales...',
    'Unos segundos más — vale la pena esperar...',
    'Asegurando que suene como tú, no como un documento...',
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
  const totalAlumnos = profile?.total_alumnos || profile?.total_students || null
  const pasosProgreso = getPasosProgreso(totalAlumnos)
  const todasPdasSeleccionadas = contenidosElegidos.flatMap(c => c.pdasSeleccionados)
  const hayPdasSeleccionados = todasPdasSeleccionadas.length > 0

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
  }

  function togglePda(contenido: string, pdaTexto: string) {
    setContenidosElegidos(prev => prev.map(c => {
      if (c.contenido !== contenido) return c
      const yaSeleccionado = c.pdasSeleccionados.includes(pdaTexto)
      return {
        ...c,
        pdasSeleccionados: yaSeleccionado
          ? c.pdasSeleccionados.filter(p => p !== pdaTexto)
          : [...c.pdasSeleccionados, pdaTexto]
      }
    }))
  }

  useEffect(() => {
    if (!generating) return
    setPasoActual(0); setPorcentaje(0)
    let paso = 0
    const intervalo = setInterval(() => {
      if (paso < pasosProgreso.length - 1) { paso++; setPasoActual(paso); setPorcentaje(pasosProgreso[paso].porcentaje) }
    }, 5000)
    return () => clearInterval(intervalo)
  }, [generating])

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
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
    if (!esperaFinal) { setPuntos('.'); return }
    const interval = setInterval(() => {
      setPuntos(prev => prev.length >= 3 ? '.' : prev + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [esperaFinal])

  useEffect(() => {
    if (!generating || porcentaje < 95) { setMensajeEspera(0); setEsperaFinal(false); return }
    const tiempos = [3000, 4000, 3500, 5000, 3000]
    let idx = 0
    let timeout: ReturnType<typeof setTimeout>
    function avanzar() {
      if (idx >= MENSAJES_ESPERA.length - 1) { setEsperaFinal(true); return }
      idx++
      setMensajeEspera(idx)
      if (idx < MENSAJES_ESPERA.length - 1) {
        timeout = setTimeout(avanzar, tiempos[idx] || 3000)
      } else {
        setEsperaFinal(true)
      }
    }
    timeout = setTimeout(avanzar, tiempos[0])
    return () => clearTimeout(timeout)
  }, [generating, porcentaje])

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
        })
      })
      const data = await res.json()
      if (data.transversales) {
        setTransversales(data.transversales.map((t: any) => ({ ...t, activo: true })))
        if (data.eje_principal) { setEjePrincipal(data.eje_principal); setEjePrincipalDescartado(false) }
        if (data.eje_secundario) { setEjeSecundario(data.eje_secundario); setEjeSecundarioDescartado(false); setEjeElegidoPorEducadora('') }
        if (data.ejes_disponibles) setEjesDisponibles(data.ejes_disponibles)
      } else {
        setErrorTransversales('No se pudieron sugerir los campos transversales.')
      }
    } catch {
      setErrorTransversales('Error al sugerir campos transversales.')
    }
    setSugirendoTransversales(false)
  }

  function descartarTransversal(index: number) {
    setTransversales(prev => prev.map((t, i) => i === index ? { ...t, activo: false } : t))
  }

  function reactivarTransversal(index: number) {
    setTransversales(prev => prev.map((t, i) => i === index ? { ...t, activo: true } : t))
  }

  async function handleGenerar() {
    if (!form.nombre_proyecto || !form.situacion_problema || !form.finalidad) {
      alert('Completa el nombre, situación problema y finalidad del proyecto')
      return
    }
    if (!principalCampo || contenidosElegidos.length === 0) {
      alert('Selecciona al menos un contenido del campo formativo principal')
      return
    }
    if (!hayPdasSeleccionados) {
      alert('Selecciona al menos un PDA')
      return
    }
    setGenerating(true); setResult(null); setSaveStatus('')
    const transversalesActivos = transversales.filter(t => t.activo)
    const pdasParaAgente = contenidosElegidos.flatMap(c =>
      c.pdasSeleccionados.map(p => ({ contenido: c.contenido, pda: p }))
    )
    try {
      const res = await fetch('/api/generar-planeacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form: {
            ...form,
            metodologia: form.metodologia,
            campo_formativo: principalCampo,
            contenido: contenidosElegidos[0]?.contenido || '',
            pda_principal: contenidosElegidos[0]?.pdasSeleccionados[0] || '',
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
      if (data.error) { setResult({ error: data.error }); setGenerating(false); return }
      if (data.planeacion) {
        setPorcentaje(100)
        await new Promise(r => setTimeout(r, 600))
        setResult(data.planeacion)
        const { data: savedData, error: saveError } = await supabase.from('plannings').insert({
          user_id: profile.id,
          project_name: form.nombre_proyecto,
          situacion_problema: form.situacion_problema,
          finalidad: form.finalidad,
          pda_campo: principalCampo,
          pda_contenido: contenidosElegidos[0]?.contenido || '',
          pda_literal: todasPdasSeleccionadas.join(' | '),
          recursos_materiales: form.recursos_materiales || null,
          transversal_1_campo: transversalesActivos[0]?.campo || null,
          transversal_1_contenido: transversalesActivos[0]?.contenido || null,
          transversal_1_pda: transversalesActivos[0]?.pda || null,
          transversal_1_activo: !!transversalesActivos[0],
          transversal_2_campo: transversalesActivos[1]?.campo || null,
          transversal_2_contenido: transversalesActivos[1]?.contenido || null,
          transversal_2_pda: transversalesActivos[1]?.pda || null,
          transversal_2_activo: !!transversalesActivos[1],
          transversal_3_campo: transversalesActivos[2]?.campo || null,
          transversal_3_contenido: transversalesActivos[2]?.contenido || null,
          transversal_3_pda: transversalesActivos[2]?.pda || null,
          transversal_3_activo: !!transversalesActivos[2],
          starts_on: form.fecha_inicio || null,
          ends_on: form.fecha_fin || null,
          duration_days: contarDiasHabiles(form.fecha_inicio, form.fecha_fin),
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
      setResult({ error: 'Error de conexión' })
    }
    setGenerating(false)
  }

  const s = {
    label: { display: 'block', marginBottom: 6, fontWeight: 600, color: '#1A1A2E', fontSize: 14 } as React.CSSProperties,
    input: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, marginBottom: 16, outline: 'none', background: 'white' } as React.CSSProperties,
    textarea: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, marginBottom: 16, resize: 'vertical' as const, background: 'white' } as React.CSSProperties,
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

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px' }}>

        {generating && (
          <div style={{ background: 'white', borderRadius: 14, padding: 32, boxShadow: '0 2px 12px rgba(61,58,140,0.08)', marginBottom: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
              <h3 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 18 }}>CREANDO TU PLANEACIÓN</h3>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 0, marginTop: 0 }}>
                Diseñada para <strong>{gradoGrupo || '2°'}</strong>{totalAlumnos ? <> &middot; <strong>{totalAlumnos} alumnos</strong></> : null}
              </p>
            </div>
            <div style={{ background: '#EEEDF8', borderRadius: 99, height: 6, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(90deg, #3D3A8C, #00A896)', height: '100%', borderRadius: 99, width: `${porcentaje}%`, transition: 'width 0.8s ease' }} />
            </div>
            <p style={{ color: '#3D3A8C', fontSize: 12, fontWeight: 600, textAlign: 'right', margin: '0 0 20px' }}>{porcentaje}%</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {pasosProgreso.map((paso, index) => {
                const completado = index < pasoActual
                const activo = index === pasoActual
                return (
                  <div key={index} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8,
                    background: activo ? '#EEEDF8' : completado ? '#F0FDF4' : '#FAFAFA',
                    border: activo ? '1.5px solid #3D3A8C' : completado ? '1.5px solid #86EFAC' : '1.5px solid #F0F0F0',
                    opacity: index > pasoActual ? 0.4 : 1,
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: completado ? '#22C55E' : activo ? '#3D3A8C' : '#E5E7EB',
                      fontSize: 11, color: 'white', fontWeight: 700
                    }}>
                      {completado ? '✓' : activo ? '●' : ''}
                    </div>
                    <p style={{
                      margin: 0, fontSize: 13,
                      color: activo ? '#3D3A8C' : completado ? '#166534' : '#9CA3AF',
                      fontWeight: activo ? 600 : 400
                    }}>
                      {activo && porcentaje >= 95 ? (esperaFinal ? `${MENSAJES_ESPERA[MENSAJES_ESPERA.length - 1]}${puntos}` : MENSAJES_ESPERA[mensajeEspera]) : paso.texto}
                    </p>
                  </div>
                )
              })}
            </div>
            <p style={{ color: '#aaa', fontSize: 12, marginTop: 16, textAlign: 'center', marginBottom: 0 }}>
              Esto toma entre 30 y 45 segundos — no cierres esta ventana
            </p>
          </div>
        )}

        {!generating && !result && (
          <>
            <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '32px 32px', marginBottom: 24, textAlign: 'center' }}>
              <h2 style={{ color: 'white', marginTop: 0, marginBottom: 6, fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>NUEVA PLANEACIÓN</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 0, marginTop: 0 }}>
                {profile.school_name && <><strong style={{ color: 'rgba(255,255,255,0.9)' }}>JN:</strong> {nombreCorto(profile.school_name)} · </>}
                <strong style={{ color: 'rgba(255,255,255,0.9)' }}>CCT:</strong> {profile.cct_primary} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>

              <div style={{ ...s.card, height: '100%', boxSizing: 'border-box' }}>
                <p style={s.sectionTitle}>1 · Datos del proyecto</p>
                <label style={s.label}>Nombre del proyecto *</label>
                <input placeholder="Ej: El agua en nuestra vida" value={form.nombre_proyecto} onChange={e => update('nombre_proyecto', e.target.value)} style={s.input} />
                <label style={s.label}>Situación problema *</label>
                <textarea placeholder="¿Qué situación del entorno motivó este proyecto?" value={form.situacion_problema} onChange={e => update('situacion_problema', e.target.value)} rows={3} style={s.textarea} />
                <label style={s.label}>Finalidad *</label>
                <textarea ref={finalidadRef} placeholder="¿Qué lograrán los alumnos al concluir este proyecto?" value={form.finalidad} onChange={e => update('finalidad', e.target.value)} rows={3} style={s.textarea} />
                <div style={{ background: '#F8F8FE', border: '1px solid #D8D6F0', borderRadius: 10, padding: 16 }}>
                  <label style={{ ...s.label, marginBottom: 4 }}>
                    Recursos o materiales específicos
                    <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 6 }}>(opcional)</span>
                  </label>
                  <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5 }}>¿Tu directora indicó usar algún material en específico? El agente lo integrará en las actividades.</p>
                  <textarea placeholder="Ej: báscula, objetos de medición, lupas, material reciclado..." value={form.recursos_materiales} onChange={e => update('recursos_materiales', e.target.value)} rows={2}
                    style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', background: 'white' } as React.CSSProperties} />
                </div>
              </div>

              <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, height: '100%', boxSizing: 'border-box' as const }}>
                <div style={{ marginBottom: 24 }}>
                  <p style={s.sectionTitle}>2 · Modalidad de trabajo</p>
                  <label style={s.label}>
                    Modalidad didáctica *
                    <span style={{ fontWeight: 400, color: '#00A896', fontSize: 12, marginLeft: 8, background: '#E8F5F2', padding: '2px 8px', borderRadius: 99 }}>Sugerida por NEM 2022</span>
                  </label>
                  <select value={form.metodologia} onChange={e => update('metodologia', e.target.value)}
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
                </div>

                <div style={{ marginBottom: 24 }}>
                  <p style={s.sectionTitle}>3 · Campo formativo principal</p>
                  <label style={s.label}>Campo formativo *</label>
                  <select value={principalCampo} onChange={e => setPrincipalCampo(e.target.value)}
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
                                              const seleccionado = elegido?.pdasSeleccionados.includes(pda.pda) || false
                                              return (
                                                <label key={pda.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${seleccionado ? '#00A896' : '#E8E8F0'}`, background: seleccionado ? '#E0F5F3' : '#FAFAFA', transition: 'all 0.15s' }}>
                                                  <input type="checkbox" checked={seleccionado} onChange={() => togglePda(contenido, pda.pda)}
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
                                                      const seleccionado = elegido?.pdasSeleccionados.includes(pda.pda) || false
                                                      return (
                                                        <label key={pda.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${seleccionado ? '#00A896' : '#E8E8F0'}`, background: seleccionado ? '#E0F5F3' : '#F5FFFE', transition: 'all 0.15s' }}>
                                                          <input type="checkbox" checked={seleccionado} onChange={() => togglePda(contenido, pda.pda)}
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

                  {hayPdasSeleccionados && form.nombre_proyecto && form.situacion_problema && form.finalidad && (
                    <div style={{ paddingTop: 8 }}>
                      <button onClick={sugerirTransversales} disabled={sugirendoTransversales}
                        style={{ background: sugirendoTransversales ? '#F0EFF8' : '#EEEDF8', color: '#3D3A8C', border: '1.5px solid #3D3A8C', padding: '10px 18px', fontSize: 14, cursor: sugirendoTransversales ? 'default' : 'pointer', borderRadius: 8, fontWeight: 600, width: '100%' }}>
                        {sugirendoTransversales ? MENSAJES_SUGERENCIA[mensajeSugerencia] : '🔗 Sugerir campos transversales'}
                      </button>
                      {errorTransversales && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 8 }}>{errorTransversales}</p>}
                    </div>
                  )}
                </div>

                {transversales.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={s.sectionTitle}>Campos transversales sugeridos</p>
                    <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
                      El sistema analizó tu proyecto y sugirió estos campos. Puedes descartar los que no apliquen.
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
                  </div>
                )}

                {ejePrincipal && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={s.sectionTitle}>{transversales.length > 0 ? '5' : '4'} · Ejes articuladores</p>
                    <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
                      El sistema determinó los ejes que mejor articulan todos tus campos y contenidos.
                    </p>
                    <div style={{ border: '1.5px solid #3D3A8C', borderRadius: 10, padding: 16, marginBottom: 12, background: '#F4F3FB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Eje principal</span>
                        <span style={{ fontSize: 11, background: '#00A896', color: 'white', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Recomendado</span>
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

                <div style={{ marginBottom: 24 }}>
                  <p style={s.sectionTitle}>{ejePrincipal ? (transversales.length > 0 ? '6' : '5') : (transversales.length > 0 ? '5' : '4')} · Período de aplicación</p>
                  <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                    Elige la fecha en que inicias y la fecha en que terminas.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                    <div>
                      <label style={s.label}>Fecha de inicio *</label>
                      <input type="date" value={form.fecha_inicio} onChange={e => update('fecha_inicio', e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Fecha de término *</label>
                      <input type="date" value={form.fecha_fin} onChange={e => update('fecha_fin', e.target.value)} style={s.input} />
                    </div>
                  </div>
                  {form.fecha_inicio && form.fecha_fin && contarDiasHabiles(form.fecha_inicio, form.fecha_fin) > 0 && (
                    <div style={{ background: '#E8F5F2', border: '1px solid #00A896', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>📅</span>
                      <p style={{ fontSize: 13, color: '#065F46', margin: 0, fontWeight: 500 }}>
                        Tu proyecto tendrá <strong>{contarDiasHabiles(form.fecha_inicio, form.fecha_fin)} días hábiles</strong> de aplicación.
                      </p>
                    </div>
                  )}
                  {form.fecha_inicio && form.fecha_fin && contarDiasHabiles(form.fecha_inicio, form.fecha_fin) === 0 && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px' }}>
                      <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>La fecha de término debe ser posterior a la fecha de inicio.</p>
                    </div>
                  )}
                </div>

                <button onClick={handleGenerar} disabled={generating || !hayPdasSeleccionados}
                  style={{ background: hayPdasSeleccionados ? '#00A896' : '#D0D0D0', color: 'white', border: 'none', padding: '15px 24px', fontSize: 16, cursor: hayPdasSeleccionados ? 'pointer' : 'default', width: '100%', borderRadius: 8, fontWeight: 600, transition: 'background 0.2s' }}>
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
