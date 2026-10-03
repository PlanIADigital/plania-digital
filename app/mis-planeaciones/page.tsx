'use client'
// ============================================================
//  PlanIA Digital — app/mis-planeaciones/page.tsx
//
//  [Rediseño 1 oct 2026] Mismo lenguaje visual que Dashboard, Mi Grupo
//  y Nueva Planeación: encabezado común, una columna (720 px) y
//  TARJETAS en lugar de tabla (una tabla de 6 columnas no cabe en
//  celular). Cada tarjeta: título, etiquetas (campo + eje), período y
//  estado; "Ver →" como acción principal y "Descartar" como enlace
//  discreto. Se retiran de la lista: propósito (se ve completo al abrir
//  la planeación), fecha de creación y ordenar por columna — el orden
//  es siempre "más recientes primero" (created_at desc).
//  Se conservan intactos: selector de ciclo, pestañas con contadores,
//  buscador en vivo y la regla de descarte (solo activas y antes de
//  descargar el Word).
//  [2 oct 2026] Menos scroll, sobre todo en celular:
//  - Se muestran las 10 más recientes y un botón "Mostrar 10 más". El
//    buscador y los filtros siguen buscando en TODAS.
//  - Tarjeta compacta: etiquetas, fechas y estado en una sola línea que
//    se acomoda sola; toda la tarjeta abre la planeación. En celular se
//    oculta el botón "Ver →" (la tarjeta completa ya es el botón).
// ============================================================
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { chipCampo } from '@/lib/coloresCampos'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
  borde: '#E0DFF5',
}

const CAMPOS_COLORES: Record<string, { bg: string; color: string }> = {
  'Lenguajes': { bg: '#EEEDF8', color: '#3D3A8C' },
  'Saberes y Pensamiento Científico': { bg: '#E0F5F3', color: '#00796B' },
  'Ética, Naturaleza y Sociedades': { bg: '#E8F5F2', color: '#0F6E56' },
  'De lo Humano y lo Comunitario': { bg: '#F1ECF8', color: '#5B3F8C' },
}

const ESTADOS: Record<string, { texto: string; bg: string; color: string }> = {
  active: { texto: 'Activa', bg: '#E0F5F3', color: '#0F6E56' },
  discarded: { texto: 'Descartada', bg: '#F3F4F6', color: '#6B7280' },
  closed: { texto: 'Cerrada', bg: C.indigoClaro, color: C.indigo },
}

type Filtro = 'todas' | 'active' | 'closed' | 'discarded'

const POR_PAGINA = 10

// Ajustes de la tarjeta según el ancho. Prefijo "mp-" para no chocar con otras clases.
const ESTILOS_LISTA = `
  .mp-tarjeta { cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
  .mp-tarjeta:hover { border-color: #C9C7EC; box-shadow: 0 2px 10px rgba(61,58,140,0.08); }
  .mp-tarjeta:focus-visible { outline: 2px solid #00A896; outline-offset: 2px; }
  .mp-flecha { display: none; }
  @media (max-width: 600px) {
    .mp-tarjeta { padding: 12px 14px !important; }
    .mp-ver { display: none !important; }
    .mp-flecha { display: inline-flex; }
  }
`

function fechaCorta(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function MisPlaneacionesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [planeaciones, setPlaneaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  // [sep 2026] Selector de ciclo escolar — por defecto muestra solo el
  // ciclo activo; las planeaciones de ciclos anteriores no desaparecen,
  // solo quedan un clic de distancia (sus planeaciones siempre son suyas).
  const [cicloSeleccionado, setCicloSeleccionado] = useState(CICLO_ESCOLAR_ACTIVO)
  // [jul 2026] Buscador por nombre del proyecto, filtra en vivo.
  const [busqueda, setBusqueda] = useState('')
  // [2 oct 2026] Cuántas tarjetas se muestran; vuelve a 10 al cambiar filtro, ciclo o búsqueda.
  const [visibles, setVisibles] = useState(POR_PAGINA)
  useEffect(() => { setVisibles(POR_PAGINA) }, [filtro, cicloSeleccionado, busqueda])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
      const { data: plans } = await supabase
        .from('plannings')
        .select('id, project_name, finalidad, starts_on, ends_on, pda_campo, eje_principal, status, created_at, ciclo_escolar, word_descargado_en')
        .eq('user_id', data.id)
        .order('created_at', { ascending: false })
      setPlaneaciones(plans || [])
      setLoading(false)
    }
    load()
  }, [])

  // [sep 2026] Descartar planeación completa — no borra nada, solo
  // marca status='discarded'. Existe para que una planeación que no
  // convenció y se va a regenerar no siga contando contra el tope
  // mensual de días hábiles de la educadora.
  async function descartarPlaneacion(id: string) {
    const confirmar = window.confirm('¿Descartar esta planeación? Ya no contará para tu límite de días hábiles del mes, pero seguirá disponible en tu historial.')
    if (!confirmar) return
    const { error } = await supabase.from('plannings').update({ status: 'discarded' }).eq('id', id)
    if (error) {
      alert('No se pudo descartar la planeación: ' + error.message)
      return
    }
    setPlaneaciones(prev => prev.map(p => p.id === id ? { ...p, status: 'discarded' } : p))
  }

  // Ciclos con al menos una planeación, más recientes primero. Los
  // registros antiguos sin ciclo_escolar se agrupan como "Sin ciclo".
  const ciclosDisponibles = [...new Set(planeaciones.map(p => p.ciclo_escolar || 'Sin ciclo'))]
    .sort((a, b) => b.localeCompare(a))
  if (!ciclosDisponibles.includes(CICLO_ESCOLAR_ACTIVO)) ciclosDisponibles.unshift(CICLO_ESCOLAR_ACTIVO)

  const planeacionesDelCiclo = planeaciones.filter(p => (p.ciclo_escolar || 'Sin ciclo') === cicloSeleccionado)

  const coincide = (p: any, f: Filtro) =>
    f === 'todas' ? true
      : f === 'active' ? p.status === 'active'
      : f === 'discarded' ? p.status === 'discarded'
      : p.status !== 'active' && p.status !== 'discarded'

  // Orden fijo: más recientes primero (ya viene así de la consulta).
  const filtradas = planeacionesDelCiclo
    .filter(p => coincide(p, filtro))
    .filter(p => !busqueda.trim() || (p.project_name || '').toLowerCase().includes(busqueda.trim().toLowerCase()))

  const mostradas = filtradas.slice(0, visibles)
  const restantes = filtradas.length - mostradas.length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const etiquetasFiltro: Record<Filtro, string> = { todas: 'Todas', active: 'Activas', discarded: 'Descartadas', closed: 'Cerradas' }
  const vacioFiltro: Record<Filtro, string> = {
    todas: 'Aún no tienes planeaciones en este ciclo.',
    active: 'No hay planeaciones activas.',
    discarded: 'No hay planeaciones descartadas.',
    closed: 'No hay planeaciones cerradas.',
  }

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px' }}>
        <style>{ESTILOS_LISTA}</style>

        <EncabezadoPagina
          antetitulo="Consultar"
          titulo="Mis planeaciones"
          subtitulo={`${planeacionesDelCiclo.length} en el ciclo ${cicloSeleccionado}`}
        />

        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Filtros */}
          <div style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' as const, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                Ciclo
                <select
                  value={cicloSeleccionado}
                  onChange={e => setCicloSeleccionado(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, fontSize: 15, fontWeight: 600, border: `1px solid ${C.borde}`, background: 'white', color: C.indigo, cursor: 'pointer', textTransform: 'none' as const, letterSpacing: 0 }}
                >
                  {ciclosDisponibles.map(c => (
                    <option key={c} value={c}>{c}{c === CICLO_ESCOLAR_ACTIVO ? ' (actual)' : ''}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => router.push('/planeacion/nueva')}
                style={{ background: C.cian, color: 'white', border: 'none', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' as const }}>
                ✨ Nueva
              </button>
            </div>

            <input
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar por nombre del proyecto"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box' as const, padding: '10px 14px', borderRadius: 10, fontSize: 16, border: `1px solid ${C.borde}`, background: 'white', color: C.texto, outline: 'none', marginBottom: 12 }}
            />

            {/* Pestañas: en celular se deslizan de lado */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' as const, paddingBottom: 2, WebkitOverflowScrolling: 'touch' as any }}>
              {/* [1 oct 2026] Sin pestaña "Cerradas": ningún flujo cierra planeaciones (siempre 0). */}
              {(['todas', 'active', 'discarded'] as const).map(f => {
                const activo = filtro === f
                const count = planeacionesDelCiclo.filter(p => coincide(p, f)).length
                return (
                  <button key={f} onClick={() => setFiltro(f)}
                    style={{
                      flexShrink: 0, padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                      fontWeight: activo ? 700 : 500,
                      border: `1.5px solid ${activo ? C.indigo : C.borde}`,
                      background: activo ? C.indigoClaro : 'white',
                      color: activo ? C.indigo : C.gris,
                    }}>
                    {etiquetasFiltro[f]} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lista */}
          {filtradas.length === 0 ? (
            <div style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '36px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 32, margin: '0 0 10px' }}>📋</p>
              <p style={{ fontSize: 15, color: C.gris, margin: '0 0 18px', lineHeight: 1.6 }}>
                {busqueda.trim() ? `No se encontraron planeaciones con "${busqueda.trim()}".` : vacioFiltro[filtro]}
              </p>
              {!busqueda.trim() && filtro === 'todas' && (
                <button onClick={() => router.push('/planeacion/nueva')}
                  style={{ background: C.cian, color: 'white', border: 'none', padding: '12px 22px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  ✨ Crear mi primera planeación
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mostradas.map(p => {
                const campo = chipCampo(p.pda_campo)
                const estado = ESTADOS[p.status] || ESTADOS.closed
                const puedeDescartar = p.status === 'active' && !p.word_descargado_en
                const abrir = () => router.push(`/planeacion/${p.id}`)
                return (
                  <div
                    key={p.id}
                    className="mp-tarjeta"
                    role="link"
                    tabIndex={0}
                    aria-label={`Abrir ${p.project_name || 'planeación'}`}
                    onClick={abrir}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir() } }}
                    style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: '0 0 6px', fontWeight: 700, color: C.texto, fontSize: 15, lineHeight: 1.35,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                      }}>
                        {p.project_name}
                      </p>
                      {/* Etiquetas, fechas y estado en una sola línea que se acomoda sola */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const }}>
                        {p.pda_campo && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: campo.bg, color: campo.color }}>{p.pda_campo}</span>
                        )}
                        {p.eje_principal && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: '#E8F5F2', color: '#0F6E56' }}>{p.eje_principal}</span>
                        )}
                        {p.starts_on && (
                          <span style={{ fontSize: 12, color: C.gris, whiteSpace: 'nowrap' as const }}>{fechaCorta(p.starts_on)}{p.ends_on && ` → ${fechaCorta(p.ends_on)}`}</span>
                        )}
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: estado.bg, color: estado.color }}>{estado.texto}</span>
                      </div>
                    </div>
                    {/* [2 oct 2026] Descartar a la izquierda de "Ver →" (en fila) para que no alargue la tarjeta */}
                    <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                      {/* En celular, una flecha indica que la tarjeta se puede tocar */}
                      <span className="mp-flecha" aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 30, background: C.cian, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" style={{ marginLeft: 2 }}><path d="M3 1.5 L10 6 L3 10.5 Z" fill="white" /></svg>
                      </span>
                      <button
                        className="mp-ver"
                        onClick={e => { e.stopPropagation(); abrir() }}
                        style={{ background: C.indigo, color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                        Ver →
                      </button>
                      {puedeDescartar && (
                        <button onClick={e => { e.stopPropagation(); descartarPlaneacion(p.id) }}
                          style={{ background: 'none', border: 'none', color: C.gris, padding: '4px 0', cursor: 'pointer', fontSize: 12, fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap' as const }}>
                          Descartar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {restantes > 0 && (
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <p style={{ fontSize: 13, color: C.gris, margin: '0 0 8px' }}>
                    Mostrando {mostradas.length} de {filtradas.length}
                  </p>
                  <button onClick={() => setVisibles(v => v + POR_PAGINA)}
                    style={{ background: 'white', color: C.indigo, border: `1.5px solid ${C.borde}`, padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                    Mostrar {Math.min(POR_PAGINA, restantes)} más
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}
