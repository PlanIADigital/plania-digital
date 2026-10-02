'use client'
// ============================================================
//  PlanIA Digital — app/mi-avance/page.tsx
//
//  [Saneado 26 sep 2026 — Fase 1, Mi Avance]
//  Contrato de datos:
//    - Planeaciones: plannings (SELECT_PLANNINGS_AVANCE) del ciclo
//      activo. Cuentan solo las no descartadas y con starts_on dentro
//      de inicio_clases/fin_clases del calendario estatal.
//    - Cobertura: calcularAvance() de lib/cobertura.ts — cuenta PDA
//      DISTINTOS por pda_id (principal, pda_2 y transversales).
//    - Prioritarios: canasta de lib/cobertura.ts con tres etiquetas
//      (Individual / NEE, Grupo, Jardín).
//  Principio: la educadora ve su avance REAL del grupo actual en el
//  ciclo actual; lo anterior se conserva como historial sin mezclarse.
//
//  [Rediseño 1 oct 2026] Una columna (720 px), encabezado de tres
//  renglones, indicadores 2×2, barra de progreso del ciclo, orientación
//  de MÍA en tono de sugerencia (no punitivo), pestañas redondeadas y
//  colores OFICIALES de campo (lib/coloresCampos.ts) con barras de rayas
//  y degradado. Sin alturas fijas. Cálculos SIN cambios.
// ============================================================
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { createClient } from '@/lib/supabase-browser'
import {
  SELECT_PLANNINGS_AVANCE,
  ORIGENES_PRIORITARIO,
  calcularAvance,
  clasificarPlaneaciones,
  construirCanastaPrioritarios,
  calcularPrioritarios,
  type OrigenPrioritario,
  type PdaCatalogoConTexto,
  type PeriodoAvance,
} from '@/lib/cobertura'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { fetchConSesion } from '@/lib/fetchConSesion'
import { sugerenciasPendientes } from '@/components/GrupoAlumnosApoyos'
import { colorCampo, fondoBarraCampo } from '@/lib/coloresCampos'

const supabase = createClient()

const MODO_PRUEBA_CICLO_ACTIVO = false

const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
  borde: '#E0DFF5',
}

const CAMPOS_CONFIG = [
  { nombre: 'Lenguajes',                        total: 86  },
  { nombre: 'Saberes y Pensamiento Científico', total: 130 },
  { nombre: 'Ética, Naturaleza y Sociedades',   total: 70  },
  { nombre: 'De lo Humano y lo Comunitario',    total: 85  },
]

// [jul 2026] Prefijo de 3 letras por campo formativo.
const PREFIJO_POR_CAMPO: Record<string, string> = {
  'Lenguajes': 'LEN',
  'Saberes y Pensamiento Científico': 'SPC',
  'Ética, Naturaleza y Sociedades': 'ENS',
  'De lo Humano y lo Comunitario': 'DHC',
}

// Abreviaturas para el desglose de la tarjeta de prioritarios
// (mismo orden de gradualidad que ORIGENES_PRIORITARIO).
const ABREVIATURA_ORIGEN: Record<OrigenPrioritario, string> = {
  individual: 'Ind./NEE',
  grupo: 'Grupo',
  jardin: 'Jardín',
}

const EJES = [
  'Interculturalidad crítica',
  'Igualdad de género',
  'Inclusión',
  'Pensamiento crítico',
  'Apropiación de las culturas a través de la lectura y la escritura',
  'Artes y experiencias estéticas',
  'Vida saludable',
]

const MESES_LARGOS = ['Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio']

const UMBRAL_EJE_BAJO = 0.2

// [Saneado 27 sep 2026] Alerta de cobertura por campo según la ETAPA del ciclo.
const META_CAMPO_FIN_CICLO = 20
const AVANCE_CICLO_MINIMO_PARA_ALERTA = 0.15

function fraccionCicloTranscurrida(inicio: string | null, fin: string | null, hoy: string): number | null {
  if (!inicio || !fin) return null
  const a = Date.parse(inicio + 'T12:00:00')
  const b = Date.parse(fin + 'T12:00:00')
  const h = Date.parse(hoy + 'T12:00:00')
  if (!(b > a)) return null
  return Math.min(1, Math.max(0, (h - a) / (b - a)))
}

function hoyLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function campoCorto(nombre: string): string {
  const mapa: Record<string, string> = {
    'Saberes y Pensamiento Científico': 'Saberes y P. Científico',
    'Ética, Naturaleza y Sociedades':   'Ética, Naturaleza y Sociedades',
    'De lo Humano y lo Comunitario':    'Lo Humano y Comunitario',
  }
  return mapa[nombre] || nombre
}

function campoCompletoConCodigo(nombre: string): string {
  const codigo = PREFIJO_POR_CAMPO[nombre] || ''
  return `${nombre} (${codigo})`
}

function etiquetasDeOrigen(origenes: OrigenPrioritario[]): string {
  return origenes
    .map(o => ORIGENES_PRIORITARIO.find(x => x.clave === o)?.etiqueta || o)
    .join(' · ')
}

function mesActualCiclo(): number {
  const m = new Date().getMonth()
  if (m >= 8) return m - 8
  if (m <= 6) return m + 4
  return -1
}

// Cuadrito con el color oficial del campo (reemplaza los iconos dibujados).
function PuntoCampo({ nombre, size = 14, opacity = 1 }: { nombre: string; size?: number; opacity?: number }) {
  return <span style={{ width: size, height: size, borderRadius: 4, background: fondoBarraCampo(nombre), display: 'inline-block', flexShrink: 0, opacity }} />
}

function KpiCard({ label, value, delta, icon }: { label: string; value: string | number; delta: string; icon: string }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '12px 10px', textAlign: 'center' as const, minWidth: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: C.indigo, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 800, color: C.indigo, margin: '0 0 2px', lineHeight: 1.2 }}>{value}</p>
      <p style={{ fontSize: 12, color: C.gris, margin: 0, lineHeight: 1.4 }}>{delta}</p>
    </div>
  )
}

function AlertaMia({ tipo, texto }: { tipo: 'warn' | 'info' | 'success'; texto: React.ReactNode }) {
  // Tono de sugerencia: sin naranja ni "⚠️" (principio de no usar indicadores punitivos).
  const estilos = {
    warn:    { bg: C.indigoClaro, border: C.indigo, icon: '✦' },
    info:    { bg: '#F4F3FB', border: C.cian, icon: '💡' },
    success: { bg: '#E8F5F2', border: C.cian, icon: '✨' },
  }
  const e = estilos[tipo]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: e.bg, borderRadius: 8, borderLeft: `3px solid ${e.border}`, marginBottom: 8 }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1, color: C.indigo }}>{e.icon}</span>
      <p style={{ fontSize: 14, color: C.texto, margin: 0, lineHeight: 1.6 }}>{texto}</p>
    </div>
  )
}

const st = {
  card: { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 12 } as React.CSSProperties,
  titulo: { margin: 0, fontSize: 13, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as React.CSSProperties,
  ayuda: { fontSize: 13, color: C.gris, margin: '0 0 12px', lineHeight: 1.6 } as React.CSSProperties,
}

export default function MiAvancePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [plannings, setPlannings] = useState<any[]>([])
  const [catalogoPDA, setCatalogoPDA] = useState<PdaCatalogoConTexto[]>([])
  const [cargando, setCargando] = useState(true)
  const [tabActivo, setTabActivo] = useState<'cobertura' | 'ejes' | 'mapa' | 'nee'>('cobertura')
  const [pdaSeleccionado, setPdaSeleccionado] = useState<{ id: string; codigo: string; veces: number; pda: string; origenes: OrigenPrioritario[] } | null>(null)
  const [inicioClasesCiclo, setInicioClasesCiclo] = useState<string | null>(null)
  const [finClasesCiclo, setFinClasesCiclo] = useState<string | null>(null)
  const [apoyosConfirmados, setApoyosConfirmados] = useState<Array<{ codigo: string; apoyos: string; apoyos_origen: string | null }>>([])

  useEffect(() => {
    if (tabActivo !== 'mapa') setPdaSeleccionado(null)
  }, [tabActivo])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      setProfile(user)

      const { data: plans } = await supabase
        .from('plannings')
        .select(SELECT_PLANNINGS_AVANCE)
        .eq('user_id', user.id)
        .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
        .order('created_at', { ascending: false })
      setPlannings(plans || [])

      const { data: catalogo } = await supabase
        .from('pda_catalog')
        .select('id, campo, posicion_campo, pda')
      setCatalogoPDA((catalogo as PdaCatalogoConTexto[]) || [])

      const estadoCodigo = (user.cct_primary || '').slice(0, 2)
      try {
        const res = await fetch(`/api/calendario/fin-ciclo?estado=${estadoCodigo}`)
        const data = await res.json()
        setInicioClasesCiclo(data.inicioClases || null)
        setFinClasesCiclo(data.finClases || null)
      } catch {
        setInicioClasesCiclo(null)
        setFinClasesCiclo(null)
      }

      // [Saneado 27 sep 2026] Apoyos CONFIRMADOS (alumnos_codigo), no la detección de la IA.
      try {
        const resGrupo = await fetchConSesion('/api/alumnos-codigo')
        const grupo = await resGrupo.json()
        if (grupo?.ok) setApoyosConfirmados((grupo.alumnos || []).filter((a: any) => a.requiere_apoyos && a.apoyos))
      } catch {
        setApoyosConfirmados([])
      }

      setCargando(false)
    }
    load()
  }, [])

  // ── Cálculo único (lib/cobertura.ts) — SIN cambios ──────────
  const periodo: PeriodoAvance = { ciclo: CICLO_ESCOLAR_ACTIVO, inicio: inicioClasesCiclo, fin: finClasesCiclo }
  const avance = calcularAvance(plannings, catalogoPDA, periodo)
  const planesContadas = clasificarPlaneaciones(plannings, periodo).contadas
  const canasta = construirCanastaPrioritarios(profile, catalogoPDA)
  const prioritarios = calcularPrioritarios(canasta, avance)

  const pdaUnicosPorCampo = CAMPOS_CONFIG.map(cf => {
    const trabajados = avance.porCampo[cf.nombre]?.distintos || 0
    return { ...cf, trabajados, porcentaje: Math.round((trabajados / cf.total) * 100) }
  })
  const totalPDAs = avance.pdaDistintos
  const totalPlanes = planesContadas.length
  const totalPlanesAct = planesContadas.filter((p: any) => p.status === 'active').length

  const desglosePrioritarios = ORIGENES_PRIORITARIO
    .filter(o => prioritarios.porOrigen[o.clave].total > 0)
    .map(o => `${ABREVIATURA_ORIGEN[o.clave]} ${prioritarios.porOrigen[o.clave].atendidos}/${prioritarios.porOrigen[o.clave].total}`)
    .join(' · ')
  const pdasPrioritariosPendientes = prioritarios.pendientes.length

  const ejesConteo: Record<string, number> = avance.ejes.conteo
  const ejesCubiertos = avance.ejes.cubiertos.length
  const maxEje = Math.max(1, ...Object.values(ejesConteo))
  const ejesSinUsar = EJES.filter(e => !ejesConteo[e])

  const totalUsosEjes = Object.values(ejesConteo).reduce((sum, v) => sum + v, 0)
  const promedioEsperadoPorEje = totalUsosEjes > 0 ? totalUsosEjes / EJES.length : 0
  const ejesOrdenAscendente = [...EJES].sort((a, b) => (ejesConteo[a] || 0) - (ejesConteo[b] || 0))
  const ejesBajos = promedioEsperadoPorEje > 0
    ? ejesOrdenAscendente.filter(e => (ejesConteo[e] || 0) < promedioEsperadoPorEje * UMBRAL_EJE_BAJO)
    : [...EJES]

  const catalogoPorCampoYPosicion: Record<string, Record<number, string>> = {}
  catalogoPDA.forEach(p => {
    if (!catalogoPorCampoYPosicion[p.campo]) catalogoPorCampoYPosicion[p.campo] = {}
    catalogoPorCampoYPosicion[p.campo][p.posicion_campo] = p.pda
  })
  const idPorCampoYPosicion: Record<string, Record<number, string>> = {}
  catalogoPDA.forEach(p => {
    if (!idPorCampoYPosicion[p.campo]) idPorCampoYPosicion[p.campo] = {}
    idPorCampoYPosicion[p.campo][p.posicion_campo] = p.id
  })

  const vecesPorCampoYPosicion: Record<string, Record<number, number>> = {}
  avance.pdas.forEach(p => {
    if (!vecesPorCampoYPosicion[p.campo]) vecesPorCampoYPosicion[p.campo] = {}
    vecesPorCampoYPosicion[p.campo][p.posicion] = p.veces
  })

  const prioritarioPorCampoYPosicion: Record<string, Record<number, OrigenPrioritario[]>> = {}
  canasta.pdas.forEach(p => {
    if (!prioritarioPorCampoYPosicion[p.campo]) prioritarioPorCampoYPosicion[p.campo] = {}
    prioritarioPorCampoYPosicion[p.campo][p.posicion] = p.origenes
  })

  const sugerenciasPorRevisar = sugerenciasPendientes(profile?.evaluacion_individual)
  const mesActual = mesActualCiclo()

  const hoyISO = hoyLocalISO()
  const fraccionCiclo = fraccionCicloTranscurrida(inicioClasesCiclo, finClasesCiclo, hoyISO)
  const umbralCampoHoy = fraccionCiclo === null || fraccionCiclo < AVANCE_CICLO_MINIMO_PARA_ALERTA
    ? null
    : Math.max(1, Math.round(META_CAMPO_FIN_CICLO * fraccionCiclo))
  const cicloEscolarConcluido = !MODO_PRUEBA_CICLO_ACTIVO && !!finClasesCiclo && hoyISO > finClasesCiclo

  // Orientación de MÍA — mismas condiciones que antes, redacción en tono de sugerencia.
  const alertas: Array<{ tipo: 'warn' | 'info' | 'success'; texto: React.ReactNode }> = []
  if (!cicloEscolarConcluido) {
    const camposBajos = umbralCampoHoy === null ? [] : pdaUnicosPorCampo.filter(c => c.porcentaje < umbralCampoHoy)
    if (camposBajos.length > 0) alertas.push({ tipo: 'warn', texto: <>Puedes darle más espacio a <strong>{camposBajos.map(c => campoCorto(c.nombre)).join(' y ')}</strong> en tus próximos proyectos.</> })
    if (ejesSinUsar.length >= 3) alertas.push({ tipo: 'warn', texto: <>Hay <strong>{ejesSinUsar.length} ejes articuladores</strong> que aún no abordas este ciclo, como <em>{ejesSinUsar[0]}</em>.</> })
    if (pdasPrioritariosPendientes > 0) alertas.push({ tipo: 'info', texto: <><strong>{pdasPrioritariosPendientes} PDA prioritario{pdasPrioritariosPendientes !== 1 ? 's' : ''}</strong> de tu grupo aún por abordar este ciclo.{prioritarios.pendientes[0]?.id && <> <span onClick={() => router.push(`/planeacion/nueva?pda_sugerido=${prioritarios.pendientes[0].id}`)} style={{ color: C.indigo, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Planear el primero con MÍA →</span></>}</> })
    const campoDestacado = pdaUnicosPorCampo.find(c => c.porcentaje >= 50)
    if (campoDestacado) alertas.push({ tipo: 'success', texto: <><strong>¡Excelente!</strong> Llevas {campoDestacado.porcentaje}% en <em>{campoCorto(campoDestacado.nombre)}</em>.</> })
    if (alertas.length === 0 && totalPlanes > 0) alertas.push({ tipo: 'info', texto: <>Tu avance está equilibrado. MÍA estará aquí cuando la necesites.</> })
  }

  if (!profile || cargando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando tu avance...</p>
    </div>
  )

  if (totalPlanes === 0) return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px' }}>
        <EncabezadoPagina antetitulo="Revisar" titulo="Mi avance" subtitulo={`Ciclo ${CICLO_ESCOLAR_ACTIVO}`} />
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ ...st.card, padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🗺️</div>
            <h2 style={{ color: C.indigo, fontSize: 19, fontWeight: 700, margin: '0 0 10px' }}>Tu avance está listo para crecer</h2>
            <p style={{ color: C.gris, fontSize: 14, lineHeight: 1.7, maxWidth: 420, margin: '0 auto 24px' }}>Cada planeación que generes construirá automáticamente tu mapa de cobertura curricular.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxWidth: 380, margin: '0 auto 24px' }}>
              {CAMPOS_CONFIG.map(cf => (
                <div key={cf.nombre} style={{ background: '#F8F8FE', border: '1.5px dashed #D8D6F0', borderRadius: 12, padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PuntoCampo nombre={cf.nombre} opacity={0.45} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.gris, textAlign: 'left' }}>{campoCorto(cf.nombre)}</span>
                </div>
              ))}
            </div>
            <button onClick={() => router.push('/planeacion/nueva')} style={{ background: C.cian, color: 'white', border: 'none', padding: '12px 24px', fontSize: 15, cursor: 'pointer', borderRadius: 8, fontWeight: 700 }}>
              ✨ Crear mi primera planeación
            </button>
          </div>
        </div>
      </div>
    </SidebarWrapper>
  )

  const progresoCiclo = mesActual >= 0 ? Math.round(((mesActual + 1) / MESES_LARGOS.length) * 100) : 100
  const etiquetaProgreso = mesActual >= 0 ? `${MESES_LARGOS[mesActual]} · mes ${mesActual + 1} de ${MESES_LARGOS.length}` : 'Receso entre ciclos'
  const pestañas: Array<{ clave: 'cobertura' | 'mapa' | 'ejes' | 'nee'; texto: string }> = [
    { clave: 'cobertura', texto: '📊 Campos' },
    { clave: 'mapa', texto: '🗺️ PDA' },
    { clave: 'ejes', texto: '🔗 Ejes' },
    { clave: 'nee', texto: '♿ Diversidad' },
  ]

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px' }}>

        <EncabezadoPagina
          antetitulo="Revisar"
          titulo="Mi avance"
          subtitulo={`Ciclo ${CICLO_ESCOLAR_ACTIVO} · ${totalPlanes} planeaci${totalPlanes !== 1 ? 'ones' : 'ón'}`}
        />

        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Indicadores 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
            <KpiCard icon="📋" label="Planeaciones" value={totalPlanes} delta={totalPlanesAct > 0 ? `${totalPlanesAct} activa${totalPlanesAct > 1 ? 's' : ''}` : 'sin activas'} />
            <KpiCard icon="📌" label="PDA trabajados" value={totalPDAs} delta={`de ${CAMPOS_CONFIG.reduce((s, c) => s + c.total, 0)} del programa`} />
            <KpiCard
              icon="⭐"
              label="Prioritarios"
              value={prioritarios.hayDiagnostico ? `${prioritarios.atendidos}/${prioritarios.total}` : '—'}
              delta={prioritarios.hayDiagnostico ? desglosePrioritarios : 'Sin diagnóstico este ciclo'}
            />
            <KpiCard icon="🔗" label="Ejes" value={`${ejesCubiertos}/${EJES.length}`} delta={ejesSinUsar.length > 0 ? `${ejesSinUsar.length} por abordar` : 'todos abordados'} />
          </div>

          {/* Progreso del ciclo */}
          <div style={st.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' as const, marginBottom: 10 }}>
              <p style={st.titulo}>Progreso del ciclo escolar</p>
              <span style={{ fontSize: 13, color: C.gris }}>{etiquetaProgreso}</span>
            </div>
            <div style={{ background: '#F0EFF8', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${progresoCiclo}%`, height: '100%', borderRadius: 99, background: C.cian, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Orientación de MÍA */}
          {alertas.length > 0 && (
            <div style={st.card}>
              <p style={{ ...st.titulo, marginBottom: 12 }}>✦ Orientación de MÍA</p>
              {alertas.map((a, i) => <AlertaMia key={i} tipo={a.tipo} texto={a.texto} />)}
            </div>
          )}

          {/* Pestañas */}
          <div style={st.card}>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' as const, paddingBottom: 2, marginBottom: 16 }}>
              {pestañas.map(t => {
                const activo = tabActivo === t.clave
                return (
                  <button key={t.clave} onClick={() => setTabActivo(t.clave)}
                    style={{
                      flexShrink: 0, padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                      fontWeight: activo ? 700 : 500,
                      border: `1.5px solid ${activo ? C.indigo : C.borde}`,
                      background: activo ? C.indigoClaro : 'white',
                      color: activo ? C.indigo : C.gris,
                    }}>
                    {t.texto}
                  </button>
                )
              })}
            </div>

            {/* ── Campos ── */}
            {tabActivo === 'cobertura' && <div>
              {pdaUnicosPorCampo.map(cf => {
                const color = colorCampo(cf.nombre)
                return (
                  <div key={cf.nombre} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <PuntoCampo nombre={cf.nombre} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.texto }}>{campoCompletoConCodigo(cf.nombre)}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: color.texto, whiteSpace: 'nowrap' as const }}>{cf.trabajados}/{cf.total}</span>
                    </div>
                    <div style={{ background: '#F0EFF8', borderRadius: 99, height: 12, overflow: 'hidden' }}>
                      <div style={{ background: fondoBarraCampo(cf.nombre), height: '100%', borderRadius: 99, width: `${cf.trabajados > 0 ? Math.max(cf.porcentaje, 3) : 0}%`, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: 8 }}>
                      <span style={{ fontSize: 12, color: C.gris }}>{cf.porcentaje}% de los PDA del campo</span>
                      {umbralCampoHoy !== null && cf.porcentaje < umbralCampoHoy && (
                        <button onClick={() => router.push(`/planeacion/nueva?campo_sugerido=${encodeURIComponent(cf.nombre)}`)} style={{ fontSize: 12, color: C.indigo, background: C.indigoClaro, border: 'none', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' as const }}>Equilibrar con MÍA →</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>}

            {/* ── Ejes ── */}
            {tabActivo === 'ejes' && <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {EJES.map(eje => {
                  const count = ejesConteo[eje] || 0
                  const sinUsar = count === 0
                  return <div key={eje} style={{ padding: '10px 12px', borderRadius: 10, background: sinUsar ? 'white' : '#F8F8FE', border: sinUsar ? '1.5px dashed #B8B6DA' : '1px solid #EEEDF8' }}>
                    <p style={{ fontSize: 12, color: sinUsar ? C.gris : C.texto, margin: '0 0 6px', lineHeight: 1.4 }}>{eje}</p>
                    <div style={{ background: '#E8E8F8', borderRadius: 99, height: 4 }}><div style={{ background: C.indigo, height: '100%', borderRadius: 99, width: `${Math.round((count / maxEje) * 100)}%` }} /></div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: sinUsar ? C.gris : C.indigo, margin: '4px 0 0' }}>{sinUsar ? 'Aún sin abordar' : `${count} ${count > 1 ? 'planeaciones' : 'planeación'}`}</p>
                  </div>
                })}
              </div>
              {ejesBajos.length > 0 && <button onClick={() => router.push(`/planeacion/nueva?eje_sugerido=${encodeURIComponent(ejesBajos[0])}`)} style={{ background: C.indigo, color: 'white', border: 'none', padding: '11px 20px', fontSize: 14, cursor: 'pointer', borderRadius: 8, fontWeight: 600, width: '100%', marginTop: 14 }}>✨ Crear planeación y equilibrar ejes</button>}
            </div>}

            {/* ── Mapa de PDA ── */}
            {tabActivo === 'mapa' && <div>
              <p style={st.ayuda}>Cada cuadro es un PDA del Programa Fase 2. Toca cualquiera para ver su código y contenido, trabajado o no.</p>

              {/* Detalle: crece según el texto (sin altura fija) */}
              <div style={{ background: C.indigo, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                {pdaSeleccionado ? (
                  <>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'white', fontSize: 13, lineHeight: 1.4 }}>
                      {pdaSeleccionado.codigo} {pdaSeleccionado.veces > 0 ? `— trabajado ${pdaSeleccionado.veces}x` : '— aún no trabajado'}
                      {pdaSeleccionado.origenes.length > 0 && <span style={{ fontWeight: 600, color: '#FDE68A' }}> · Prioritario: {etiquetasDeOrigen(pdaSeleccionado.origenes)}</span>}
                    </p>
                    <p style={{ margin: 0, color: 'white', fontSize: 13, lineHeight: 1.5 }}>{pdaSeleccionado.pda}</p>
                  </>
                ) : (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.4 }}>Toca un PDA para ver su detalle aquí.</p>
                )}
              </div>

              {pdaSeleccionado && pdaSeleccionado.id && pdaSeleccionado.origenes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => router.push(`/planeacion/nueva?pda_sugerido=${pdaSeleccionado.id}`)} style={{ fontSize: 13, color: C.indigo, background: C.indigoClaro, border: `1px solid ${C.indigo}`, borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontWeight: 700 }}>✦ Planear este PDA con MÍA →</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 16, fontSize: 12, color: C.gris }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#F0EFF8', display: 'inline-block' }} />Sin trabajar</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: `${C.indigo}80`, display: 'inline-block' }} />1 vez</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: C.indigo, display: 'inline-block' }} />3+ veces</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#F0EFF8', border: '1.5px solid #F59E0B', display: 'inline-block' }} />Prioritario</span>
              </div>

              {CAMPOS_CONFIG.map(cf => {
                const color = colorCampo(cf.nombre)
                const catalogoCampo = catalogoPorCampoYPosicion[cf.nombre] || {}
                const vecesCampo = vecesPorCampoYPosicion[cf.nombre] || {}
                const prioritarioCampo = prioritarioPorCampoYPosicion[cf.nombre] || {}
                const cubiertos = Object.keys(vecesCampo).length
                const prefijo = PREFIJO_POR_CAMPO[cf.nombre]
                return (
                  <div key={cf.nombre} style={{ marginBottom: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <PuntoCampo nombre={cf.nombre} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.texto }}>{campoCompletoConCodigo(cf.nombre)}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: color.texto, whiteSpace: 'nowrap' as const }}>{cubiertos}/{cf.total}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(26px, 1fr))', gap: 3 }}>
                      {Array.from({ length: cf.total }, (_, idx) => idx + 1).map(n => {
                        const veces = vecesCampo[n] || 0
                        const origenes = prioritarioCampo[n] || []
                        const pdaTexto = catalogoCampo[n] || ''
                        const codigo = `${prefijo}-${n}`
                        let bg = '#F0EFF8'
                        if (veces >= 3) bg = color.base
                        else if (veces === 2) bg = `${color.base}CC`
                        else if (veces === 1) bg = `${color.base}80`
                        return (
                          <div
                            key={n}
                            onClick={() => setPdaSeleccionado({ id: (idPorCampoYPosicion[cf.nombre] || {})[n] || '', codigo, veces, pda: pdaTexto, origenes })}
                            style={{
                              aspectRatio: '1', borderRadius: 4, background: bg,
                              border: origenes.length > 0 ? '1.5px solid #F59E0B' : '1px solid rgba(0,0,0,0.04)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 8, fontWeight: 700, color: veces > 0 ? 'white' : '#B8B6D6',
                              cursor: 'pointer', userSelect: 'none' as const,
                            }}
                          >
                            {n}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>}

            {/* ── Diversidad ── */}
            {tabActivo === 'nee' && <div>
              <p style={st.ayuda}>Apoyos que confirmaste en Mi Grupo. Son los que llegan a tus planeaciones como ajustes razonables.</p>
              {sugerenciasPorRevisar > 0 && (
                <div onClick={() => router.push('/mi-grupo')} style={{ background: C.indigoClaro, borderLeft: `3px solid ${C.indigo}`, borderRadius: 8, padding: '8px 10px', marginBottom: 12, fontSize: 13, color: C.texto, lineHeight: 1.5, cursor: 'pointer' }}>
                  ✦ MÍA tiene <strong>{sugerenciasPorRevisar}</strong> sugerencia{sugerenciasPorRevisar !== 1 ? 's' : ''} de apoyos por revisar en Mi Grupo →
                </div>
              )}
              {apoyosConfirmados.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 32, margin: '0 0 10px' }}>👥</p>
                <p style={{ fontSize: 14, color: C.gris, margin: '0 0 16px' }}>Aún no has confirmado apoyos para alumnos de tu grupo este ciclo.</p>
                <button onClick={() => router.push('/mi-grupo')} style={{ background: C.indigo, color: 'white', border: 'none', padding: '10px 20px', fontSize: 14, cursor: 'pointer', borderRadius: 8, fontWeight: 600 }}>Ir a Mi Grupo →</button>
              </div> : <div>{apoyosConfirmados.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#F8F8FE', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ minWidth: 48, height: 28, borderRadius: 14, background: C.indigoClaro, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: C.indigo, flexShrink: 0 }}>{a.codigo}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: C.texto, margin: '0 0 4px', lineHeight: 1.5 }}>{a.apoyos}</p>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#E0F5F3', color: '#0F6E56', fontWeight: 600 }}>{a.apoyos_origen === 'mia' ? 'Sugerido por MÍA · confirmado por ti' : 'Registrado por ti'}</span>
                  </div>
                </div>
              ))}</div>}
            </div>}
          </div>

        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}
