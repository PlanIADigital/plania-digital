'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function nombreCorto(nombre: string | null): string {
  if (!nombre) return ''
  return nombre.replace(/^Jardín de Niños Indígena\s*/i, '').replace(/^Jardín de Niños\s*/i, '').replace(/^Jardin de Niños\s*/i, '').replace(/^Centro de Educación Preescolar\s*/i, '').trim()
}

const CAMPOS_COLORES: Record<string, { bg: string; color: string }> = {
  'Lenguajes': { bg: '#EEEDF8', color: '#3D3A8C' },
  'Saberes y Pensamiento Científico': { bg: '#E0F5F3', color: '#00A896' },
  'Ética, Naturaleza y Sociedades': { bg: '#D1FAE5', color: '#059669' },
  'De lo Humano y lo Comunitario': { bg: '#EDE9FE', color: '#7C3AED' },
}

// [jul 2026] Se agrega 'created_at' como criterio de orden — antes
// solo se podía ordenar por "Período" (fecha de inicio/fin en el
// aula), lo cual confundía a la educadora al buscar una planeación
// que acababa de crear pero con fechas de aplicación distantes o de
// prueba: no aparecía "arriba" aunque fuera la más reciente. Ahora
// "Creada" (fecha real de creación del registro) es el orden por
// defecto, y "Período" sigue disponible como columna/orden alterno.
type SortKey = 'project_name' | 'pda_campo' | 'eje_principal' | 'starts_on' | 'created_at'
type SortDir = 'asc' | 'desc'

export default function MisPlaneacionesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [planeaciones, setPlaneaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'active' | 'closed'>('todas')
  // [jul 2026] Orden por defecto: más recientes primero (created_at),
  // no por período — ver comentario junto al type SortKey arriba.
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // [jul 2026] Buscador por nombre del proyecto, filtra en vivo sin
  // necesidad de botón — se aplica antes del ordenamiento.
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
      const { data: plans } = await supabase
        .from('plannings')
        .select('id, project_name, finalidad, starts_on, ends_on, pda_campo, eje_principal, status, created_at')
        .eq('user_id', data.id)
        .order('created_at', { ascending: false })
      setPlaneaciones(plans || [])
      setLoading(false)
    }
    load()
  }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtradas = planeaciones
    .filter(p => {
      if (filtro === 'active') return p.status === 'active'
      if (filtro === 'closed') return p.status !== 'active'
      return true
    })
    .filter(p => {
      if (!busqueda.trim()) return true
      return (p.project_name || '').toLowerCase().includes(busqueda.trim().toLowerCase())
    })
    .sort((a, b) => {
      const va = a[sortKey] || ''
      const vb = b[sortKey] || ''
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ color: '#CCC', marginLeft: 4 }}>↕</span>
    return <span style={{ color: '#3D3A8C', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function formatoFechaCorta(fechaISO: string): string {
    return new Date(fechaISO).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px 60px' }}>

        {/* Encabezado */}
        <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '16px 32px', marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ color: 'white', margin: '0 0 6px', fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>MIS PLANEACIONES</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: 13 }}>
            {profile.school_name && <><strong style={{ color: 'rgba(255,255,255,0.9)' }}>{nombreCorto(profile.school_name)}</strong> · </>}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>CCT</strong> {profile.cct_primary} · {profile.grado || '2do'} Grado · Ciclo 2025–2026
          </p>
        </div>

        {/* Filtros + buscador + botón nueva */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' as const }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {(['todas', 'active', 'closed'] as const).map(f => {
              const labels = { todas: 'Todas', active: 'Activas', closed: 'Cerradas' }
              const count = f === 'todas' ? planeaciones.length : f === 'active' ? planeaciones.filter(p => p.status === 'active').length : planeaciones.filter(p => p.status !== 'active').length
              return (
                <button key={f} onClick={() => setFiltro(f)}
                  style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: filtro === f ? 700 : 400, cursor: 'pointer', border: `1.5px solid ${filtro === f ? '#3D3A8C' : '#E0DFF5'}`, background: filtro === f ? '#EEEDF8' : 'white', color: filtro === f ? '#3D3A8C' : '#888' }}>
                  {labels[f]} ({count})
                </button>
              )
            })}
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar por nombre del proyecto..."
              style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, border: '1.5px solid #E0DFF5', background: 'white', color: '#1A1A2E', minWidth: 240, outline: 'none' }}
            />
          </div>
          <button onClick={() => router.push('/planeacion/nueva')}
            style={{ background: '#00A896', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ✨ Nueva planeación
          </button>
        </div>

        {filtradas.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 14, padding: '48px 32px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 36, marginBottom: 16 }}>📋</p>
            <p style={{ fontSize: 15, color: '#888', marginBottom: 24 }}>
              {busqueda.trim()
                ? `No se encontraron planeaciones con "${busqueda.trim()}".`
                : filtro === 'todas' ? 'Aún no tienes planeaciones.' : `No hay planeaciones ${filtro === 'active' ? 'activas' : 'cerradas'}.`}
            </p>
            {!busqueda.trim() && (
              <button onClick={() => router.push('/planeacion/nueva')}
                style={{ background: '#00A896', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                ✨ Crear mi primera planeación
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F7FF', borderBottom: '2px solid #EEEDF8' }}>
                  {[
                    { label: 'Nombre del Proyecto', key: 'project_name' as SortKey, width: '24%' },
                    { label: 'Finalidad', key: null, width: '22%' },
                    { label: 'Campo Formativo', key: 'pda_campo' as SortKey, width: '16%' },
                    { label: 'Eje Articulador', key: 'eje_principal' as SortKey, width: '13%' },
                    { label: 'Creada', key: 'created_at' as SortKey, width: '9%' },
                    { label: 'Período', key: 'starts_on' as SortKey, width: '10%' },
                    { label: '', key: null, width: '6%' },
                  ].map((col, i) => (
                    <th key={i} onClick={() => col.key && handleSort(col.key)}
                      style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.06em', width: col.width, cursor: col.key ? 'pointer' : 'default', userSelect: 'none' as const, whiteSpace: 'nowrap' as const }}>
                      {col.label}{col.key && <SortIcon col={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p, idx) => {
                  const colores = CAMPOS_COLORES[p.pda_campo] || { bg: '#F0EFF8', color: '#3D3A8C' }
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F0EFF8', background: idx % 2 === 0 ? 'white' : '#FAFAFE' }}>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{p.project_name}</span>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: p.status === 'active' ? '#3D3A8C' : '#E0F5F3', color: p.status === 'active' ? 'white' : '#0F6E56', fontWeight: 600, flexShrink: 0 }}>
                            {p.status === 'active' ? 'Activa' : 'Cerrada'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>
                          {p.finalidad ? `${p.finalidad.substring(0, 80)}${p.finalidad.length > 80 ? '...' : ''}` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        {p.pda_campo ? (
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: colores.bg, color: colores.color, whiteSpace: 'nowrap' as const }}>
                            {p.pda_campo}
                          </span>
                        ) : <span style={{ color: '#CCC' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        {p.eje_principal ? (
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>{p.eje_principal}</span>
                        ) : <span style={{ color: '#CCC' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' as const }}>
                        {p.created_at ? (
                          <span style={{ fontSize: 11, color: '#888' }}>{formatoFechaCorta(p.created_at)}</span>
                        ) : <span style={{ color: '#CCC' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' as const }}>
                        {p.starts_on ? (
                          <span style={{ fontSize: 11, color: '#888' }}>
                            {new Date(p.starts_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            {p.ends_on && <><br />{new Date(p.ends_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</>}
                          </span>
                        ) : <span style={{ color: '#CCC' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right' as const }}>
                        <button onClick={() => router.push(`/planeacion/${p.id}`)}
                          style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                          Ver →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}