'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import { createClient } from '@supabase/supabase-js'
import { CENTRO_APRENDIZAJE_ACTIVO } from '@/lib/featureFlags'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NODOS = ['Inicio', 'Exploradora', 'Constructora', 'Diseñadora', 'Evaluadora', 'Maestra Guía']

const TABS = [
  { key: 'tablero', label: 'Mi Tablero', icon: '🗺️' },
  { key: 'misiones', label: 'Misiones', icon: '⚡' },
  { key: 'cofre', label: 'Cofre', icon: '🎁' },
  { key: 'ranking', label: 'Ranking', icon: '🏆' },
] as const

type TabKey = typeof TABS[number]['key']

interface Mision {
  id: string
  titulo: string
  descripcion: string | null
  tipo: 'flash' | 'semanal'
  xp_recompensa: number
  nodo_mazmorra: string | null
  ventana_horas: number | null
  orden: number
}

interface Logro {
  id: string
  titulo: string
  descripcion: string | null
  icono: string | null
  xp_recompensa: number
  criterio: any
}

interface Progreso {
  xp_total: number
  nivel_gamificacion: number
  nodo_actual: string
  misiones_completadas: { mision_id: string; completada_en: string }[]
  logros_desbloqueados: { logro_id: string; desbloqueado_en: string }[]
}

interface RankingFila {
  user_id: string
  full_name: string | null
  xp_total: number
  nivel_gamificacion: number
}

async function fetchConToken(url: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sin sesión activa')
  return fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } })
}

function ColumnaPerfil({ profile, progreso, tabActivo, setTabActivo }: {
  profile: any; progreso: Progreso; tabActivo: TabKey; setTabActivo: (t: TabKey) => void
}) {
  const iniciales = profile?.full_name
    ?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'
  const progresoNivel = progreso.xp_total % 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <nav style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 10 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabActivo(tab.key)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, border: 'none', marginBottom: 4,
              background: tabActivo === tab.key ? '#EEEDF8' : 'transparent',
              color: tabActivo === tab.key ? '#3D3A8C' : '#666',
              fontWeight: tabActivo === tab.key ? 700 : 500,
              fontSize: 13, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: '20px 18px', textAlign: 'center' }}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="foto" style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 10px',
            objectFit: 'cover', border: '2px solid #C9971C', display: 'block',
          }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 10px',
            background: '#EEEDF8', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3D3A8C', fontSize: 20, fontWeight: 700, border: '2px solid #C9971C',
          }}>
            {iniciales}
          </div>
        )}
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>{profile?.full_name}</p>
        <p style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#C9971C',
          background: '#FBF1DA', border: '1px solid #E7C878', borderRadius: 20,
          padding: '2px 10px', margin: '0 0 14px',
        }}>
          Nivel {progreso.nivel_gamificacion}
        </p>
        <div style={{ background: '#F0EFF8', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ background: '#C9971C', height: '100%', borderRadius: 99, width: `${progresoNivel}%`, transition: 'width 0.6s ease' }} />
        </div>
        <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{progreso.xp_total} XP · {100 - progresoNivel} XP para el siguiente nivel</p>
      </div>
    </div>
  )
}

function BadgeTipoMision({ tipo, disponible }: { tipo: 'flash' | 'semanal'; disponible: boolean }) {
  if (!disponible) {
    return <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', background: '#F3F4F6', borderRadius: 20, padding: '3px 10px', letterSpacing: '0.03em' }}>BLOQUEADA</span>
  }
  if (tipo === 'flash') {
    return <span style={{ fontSize: 10, fontWeight: 700, color: '#3D3A8C', background: '#EEEDF8', borderRadius: 20, padding: '3px 10px', letterSpacing: '0.03em' }}>RETO RÁPIDO</span>
  }
  return <span style={{ fontSize: 10, fontWeight: 700, color: '#0F6E56', background: '#E0F5F3', borderRadius: 20, padding: '3px 10px', letterSpacing: '0.03em' }}>RETO SEMANAL</span>
}

function TarjetaMision({ mision, disponible, completando, onCompletar }: {
  mision: Mision; disponible: boolean; completando: boolean; onCompletar: () => void
}) {
  return (
    <div style={{
      background: disponible ? 'white' : '#FAFAFA',
      border: `1px solid ${disponible ? '#E0DFF5' : '#EEE'}`,
      borderRadius: 12, padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10,
      opacity: disponible ? 1 : 0.7,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <BadgeTipoMision tipo={mision.tipo} disponible={disponible} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#C9971C' }}>+{mision.xp_recompensa} XP</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0, lineHeight: 1.4 }}>{mision.titulo}</p>
      {mision.descripcion && <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5, flex: 1 }}>{mision.descripcion}</p>}
      {mision.ventana_horas && disponible && (
        <span style={{ fontSize: 11, color: '#3D3A8C', fontWeight: 600 }}>⚡ Reto exprés — ventana de {mision.ventana_horas}h</span>
      )}
      <button
        disabled={!disponible || completando}
        onClick={onCompletar}
        style={{
          marginTop: 4, border: 'none', borderRadius: 8, padding: '9px 14px',
          fontSize: 12, fontWeight: 700, cursor: disponible ? 'pointer' : 'default',
          background: disponible ? '#00A896' : '#E5E7EB',
          color: disponible ? 'white' : '#9CA3AF',
        }}
      >
        {!disponible ? 'Completa la misión anterior' : completando ? 'Guardando…' : 'Marcar como completada'}
      </button>
    </div>
  )
}

function MapaMazmorras({ nodoActual }: { nodoActual: string }) {
  const indiceActual = NODOS.indexOf(nodoActual)
  return (
    <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: '20px 22px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 18px' }}>Mapa de ruta</p>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {NODOS.map((nodo, i) => {
          const completado = i < indiceActual
          const actual = i === indiceActual
          const color = completado ? '#00A896' : actual ? '#3D3A8C' : '#D1D5DB'
          return (
            <div key={nodo} style={{ display: 'flex', alignItems: 'center', flex: i < NODOS.length - 1 ? 1 : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', background: completado || actual ? color : 'white',
                  border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: completado || actual ? 'white' : color, fontSize: 13, fontWeight: 700,
                }}>
                  {completado ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 10, fontWeight: actual ? 700 : 500, color: actual ? '#3D3A8C' : '#888', textAlign: 'center' }}>{nodo}</span>
              </div>
              {i < NODOS.length - 1 && <div style={{ flex: 1, height: 2, background: completado ? '#00A896' : '#E5E7EB' }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BloqueLogros({ logros, desbloqueados }: { logros: Logro[]; desbloqueados: Set<string> }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: '18px 20px', flex: 1 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px' }}>Logros</p>
      {logros.length === 0 ? (
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Aún no hay logros disponibles para tu rol.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 12 }}>
          {logros.map((logro) => {
            const desbloqueado = desbloqueados.has(logro.id)
            return (
              <div key={logro.id} title={logro.descripcion || logro.titulo} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', margin: '0 auto 6px',
                  background: desbloqueado ? '#FBF1DA' : '#F3F4F6',
                  border: `2px solid ${desbloqueado ? '#C9971C' : '#E5E7EB'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  filter: desbloqueado ? 'none' : 'grayscale(1)', opacity: desbloqueado ? 1 : 0.5,
                }}>
                  {logro.icono || '🏅'}
                </div>
                <span style={{ fontSize: 10, color: desbloqueado ? '#1A1A2E' : '#AAA', fontWeight: desbloqueado ? 600 : 400 }}>{logro.titulo}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BloqueRanking({ ranking, userId }: { ranking: RankingFila[]; userId: string }) {
  const medallas = ['🥇', '🥈', '🥉']
  return (
    <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: '18px 20px', flex: 1 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px' }}>Tabla de clasificación</p>
      {ranking.length === 0 ? (
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Completa tu primera misión para aparecer aquí.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ranking.slice(0, 8).map((fila, i) => (
            <div key={fila.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8,
              background: fila.user_id === userId ? '#EEEDF8' : 'transparent',
            }}>
              <span style={{ width: 22, fontSize: 13, fontWeight: 700, color: '#3D3A8C', textAlign: 'center' }}>{medallas[i] || i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: fila.user_id === userId ? 700 : 500, color: '#1A1A2E' }}>{fila.full_name || 'Educadora'}</span>
              <span style={{ fontSize: 11, color: '#888' }}>Nv. {fila.nivel_gamificacion}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#C9971C' }}>{fila.xp_total} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CentroAprendizajePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [progreso, setProgreso] = useState<Progreso | null>(null)
  const [misiones, setMisiones] = useState<Mision[]>([])
  const [logros, setLogros] = useState<Logro[]>([])
  const [ranking, setRanking] = useState<RankingFila[]>([])
  const [tabActivo, setTabActivo] = useState<TabKey>('tablero')
  const [cargando, setCargando] = useState(true)
  const [misionEnCurso, setMisionEnCurso] = useState<string | null>(null)
  const [celebracion, setCelebracion] = useState<Logro[]>([])
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  async function cargarProgreso() {
    const res = await fetchConToken('/api/centro-aprendizaje/progreso')
    const data = await res.json()
    if (!res.ok || !data.progreso) {
      setErrorCarga('No se pudo cargar tu progreso. Es posible que las tablas del Centro de Aprendizaje aún no existan en Supabase.')
      return
    }
    setProgreso(data.progreso)
    setMisiones(data.misiones || [])
    setLogros(data.logros || [])
  }

  async function cargarRanking() {
    const res = await fetchConToken('/api/centro-aprendizaje/ranking')
    const data = await res.json()
    setRanking(data.ranking || [])
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      setProfile(user)
      if (CENTRO_APRENDIZAJE_ACTIVO) {
        try {
          await Promise.all([cargarProgreso(), cargarRanking()])
        } catch {
          setErrorCarga('No se pudo conectar con el Centro de Aprendizaje. Intenta de nuevo en un momento.')
        }
      }
      setCargando(false)
    }
    load()
  }, [])

  async function handleCompletar(misionId: string) {
    setMisionEnCurso(misionId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/centro-aprendizaje/completar-mision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ misionId }),
      })
      const data = await res.json()
      if (res.ok) {
        setProgreso(data.progreso)
        if (data.logrosNuevos?.length) setCelebracion(data.logrosNuevos)
        await cargarRanking()
      }
    } finally {
      setMisionEnCurso(null)
    }
  }

  if (!profile || cargando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando el Centro de Aprendizaje...</p>
    </div>
  )

  if (!CENTRO_APRENDIZAJE_ACTIVO) return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
        <h2 style={{ color: '#3D3A8C', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>Muy pronto</h2>
        <p style={{ color: '#666', fontSize: 14, maxWidth: 420, margin: '0 auto' }}>
          El Centro de Aprendizaje está en construcción. Vuelve pronto para aprender la NEM 2022 jugando.
        </p>
      </div>
    </SidebarWrapper>
  )

  if (errorCarga || !progreso) return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#3D3A8C', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>No se pudo cargar el Centro de Aprendizaje</h2>
        <p style={{ color: '#666', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
          {errorCarga || 'Ocurrió un problema inesperado.'}
        </p>
        <button onClick={() => window.location.reload()} style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '10px 24px', fontSize: 13, cursor: 'pointer', borderRadius: 8, fontWeight: 600 }}>
          Reintentar
        </button>
      </div>
    </SidebarWrapper>
  )

  const completadasIds = new Set(progreso.misiones_completadas.map((m) => m.mision_id))
  const logrosDesbloqueadosIds = new Set(progreso.logros_desbloqueados.map((l) => l.logro_id))
  const misionesOrdenadas = [...misiones].sort((a, b) => a.orden - b.orden)
  const primeraNoCompletadaIdx = misionesOrdenadas.findIndex((m) => !completadasIds.has(m.id))
  const misionesPendientes = misionesOrdenadas.filter((m) => !completadasIds.has(m.id)).slice(0, 3)

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px 60px' }}>

        <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '16px 32px', marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '0 0 6px', letterSpacing: '0.05em' }}>CENTRO DE APRENDIZAJE</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Aprende la NEM 2022 jugando, misión por misión.</p>
        </div>

        {celebracion.length > 0 && (
          <div style={{ background: '#FBF1DA', border: '1px solid #E7C878', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: '#8A6A10', margin: 0, fontWeight: 600 }}>
              🏅 ¡Nuevo logro desbloqueado! {celebracion.map((l) => l.titulo).join(' · ')}
            </p>
            <button onClick={() => setCelebracion([])} style={{ background: 'none', border: 'none', color: '#8A6A10', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 24, alignItems: 'start' }}>

          <ColumnaPerfil profile={profile} progreso={progreso} tabActivo={tabActivo} setTabActivo={setTabActivo} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {(tabActivo === 'tablero' || tabActivo === 'misiones') && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Misiones activas</p>
                {misionesPendientes.length === 0 ? (
                  <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#888', margin: 0 }}>🎉 Completaste todas las misiones disponibles por ahora — vuelve pronto por más.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 14 }}>
                    {misionesPendientes.map((mision) => {
                      const idxGlobal = misionesOrdenadas.findIndex((m) => m.id === mision.id)
                      const disponible = idxGlobal === primeraNoCompletadaIdx
                      return (
                        <TarjetaMision
                          key={mision.id}
                          mision={mision}
                          disponible={disponible}
                          completando={misionEnCurso === mision.id}
                          onCompletar={() => handleCompletar(mision.id)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tabActivo === 'tablero' && <MapaMazmorras nodoActual={progreso.nodo_actual} />}

            {(tabActivo === 'tablero' || tabActivo === 'cofre' || tabActivo === 'ranking') && (
              <div style={{ display: 'flex', gap: 20 }}>
                {(tabActivo === 'tablero' || tabActivo === 'cofre') && (
                  <BloqueLogros logros={logros} desbloqueados={logrosDesbloqueadosIds} />
                )}
                {(tabActivo === 'tablero' || tabActivo === 'ranking') && (
                  <BloqueRanking ranking={ranking} userId={profile.id} />
                )}
              </div>
            )}

          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}
