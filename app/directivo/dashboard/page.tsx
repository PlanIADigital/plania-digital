'use client'
// ============================================================
//  PlanIA Digital — app/directivo/dashboard/page.tsx
//
//  [Saneado 27 sep 2026 — Fase 1, infraestructura del directivo]
//  La página ya NO lee la base desde el navegador: la tabla users solo
//  permite leer el propio registro (RLS), por eso mostraba "0 docentes"
//  aunque hubiera educadoras con el mismo CCT. Ahora pide la lista a
//  /api/directivo/docentes (token Bearer), que verifica al directivo,
//  incluye a todas las docentes de sus CCT (cualquier membresía,
//  también fundadoras) y resume su avance del ciclo ACTIVO con las
//  mismas funciones que Mi Avance.
//  El ciclo ya no está escrito a mano ("Ciclo 2025-2026"): sale de
//  CICLO_ESCOLAR_ACTIVO vía la respuesta del endpoint.
// ============================================================
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SidebarDirectivo from '@/components/SidebarDirectivo'

const supabase = createClient()

const CAMPOS_CONFIG = [
  { nombre: 'Lenguajes', color: '#3D3A8C', bg: '#EEEDF8' },
  { nombre: 'Saberes y Pensamiento Científico', color: '#00A896', bg: '#E0F5F3' },
  { nombre: 'Ética, Naturaleza y Sociedades', color: '#059669', bg: '#D1FAE5' },
  { nombre: 'De lo Humano y lo Comunitario', color: '#7C3AED', bg: '#EDE9FE' },
]

function nombreCorto(nombre: string | null): string {
  if (!nombre) return ''
  return nombre
    .replace(/^Jardín de Niños Indígena\s*/i, '')
    .replace(/^Jardín de Niños\s*/i, '')
    .replace(/^Jardin de Niños\s*/i, '')
    .replace(/^Centro de Educación Preescolar\s*/i, '')
    .trim()
}

function campoCorto(campo: string): string {
  if (campo === 'Saberes y Pensamiento Científico') return 'Saberes...'
  if (campo === 'Ética, Naturaleza y Sociedades') return 'Ética...'
  if (campo === 'De lo Humano y lo Comunitario') return 'Lo Humano...'
  return campo
}

const rolLabel: Record<string, string> = {
  educadora: 'Educadora',
  educador: 'Educador',
  maestra_musica: 'Maestra de música',
  maestro_musica: 'Maestro de música',
}

// Forma de la respuesta de /api/directivo/docentes
interface DocenteResumen {
  id: string
  full_name: string | null
  role: string
  grado: string | null
  grupo_letra: string | null
  total_alumnos: number | null
  cct_primary: string | null
  resumen: {
    pdaDistintos: number
    campos: string[]
    planeaciones: number
    planeacionesActivas: number
    ejesCubiertos: number
    prioritarios: { hayDiagnostico: boolean; total: number; atendidos: number }
    alumnosConApoyos: number
  }
}

// Forma en que lo escriben las educadoras: "3° grado B".
function textoGrupo(grado: string | null, letra: string | null): string {
  if (!grado) return 'sin grado'
  return `${grado} grado${letra ? ` ${letra}` : ''}`
}

export default function DirectivoDashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [docentes, setDocentes] = useState<DocenteResumen[]>([])
  const [ciclo, setCiclo] = useState<string>('')
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      if (user.role !== 'directivo') { router.push('/dashboard'); return }
      setProfile(user)

      try {
        const res = await fetch('/api/directivo/docentes', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) {
          setErrorCarga(data?.error || 'No se pudo cargar la información de tus docentes.')
        } else {
          setDocentes((data?.docentes || []) as DocenteResumen[])
          setCiclo(data?.ciclo || '')
        }
      } catch {
        setErrorCarga('No se pudo conectar con el servidor. Intenta de nuevo.')
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const totalPlaneaciones = docentes.reduce((s, d) => s + d.resumen.planeaciones, 0)
  const totalDocentes = docentes.length
  const docentesConPlanes = docentes.filter(d => d.resumen.planeaciones > 0).length

  return (
    <SidebarDirectivo profile={profile}>
      <div style={{ padding: '32px 40px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>Panel institucional</h1>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
            <strong>JN:</strong> {nombreCorto(profile.school_name) || profile.cct_primary} &nbsp;·&nbsp;
            <strong>CCT:</strong> {profile.cct_primary}
            {ciclo && <> &nbsp;·&nbsp; Ciclo {ciclo}</>}
          </p>
        </div>

        {errorCarga ? (
          <div style={{ background: 'white', borderRadius: 14, padding: '32px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', textAlign: 'center' }}>
            <p style={{ fontSize: 28, margin: '0 0 12px' }}>🔒</p>
            <p style={{ fontSize: 14, color: '#444', margin: 0, lineHeight: 1.6 }}>{errorCarga}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
              <div style={{ background: 'white', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>👩‍🏫 Docentes activos</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A2E', margin: '0 0 2px' }}>{totalDocentes}</p>
                <p style={{ fontSize: 11, color: '#00A896', margin: 0 }}>{docentesConPlanes} con planeaciones</p>
              </div>
              <div style={{ background: 'white', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>📋 Planeaciones totales</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A2E', margin: '0 0 2px' }}>{totalPlaneaciones}</p>
                <p style={{ fontSize: 11, color: '#888', margin: 0 }}>en el ciclo</p>
              </div>
              <div style={{ background: 'white', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>📊 Promedio por docente</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A2E', margin: '0 0 2px' }}>
                  {totalDocentes === 0 ? '0' : Math.round((totalPlaneaciones / totalDocentes) * 10) / 10}
                </p>
                <p style={{ fontSize: 11, color: '#888', margin: 0 }}>planeaciones</p>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 20px' }}>
                Docentes registrados
              </p>
              {docentes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>👩‍🏫</p>
                  <p style={{ fontSize: 14, color: '#888' }}>Aún no hay docentes con el CCT {profile.cct_primary}.</p>
                  <p style={{ fontSize: 12, color: '#aaa' }}>Cuando una educadora se registre con este CCT aparecerá aquí.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {docentes.map(docente => {
                    const r = docente.resumen
                    return (
                      <div key={docente.id} style={{ border: '1.5px solid #EEEDF8', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' as const }}>
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEEDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#3D3A8C', flexShrink: 0 }}>
                                {(docente.full_name || '').split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                              </div>
                              <div>
                                <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 14 }}>{docente.full_name}</p>
                                <p style={{ margin: 0, fontSize: 11, color: '#888' }}>
                                  {rolLabel[docente.role] || docente.role} · {textoGrupo(docente.grado, docente.grupo_letra)} · {docente.total_alumnos || '?'} alumnos
                                </p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: r.campos.length > 0 ? 8 : 0 }}>
                              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: r.planeaciones > 0 ? '#E0F5F3' : '#F8F8FE', color: r.planeaciones > 0 ? '#0F6E56' : '#888', fontWeight: 600 }}>
                                📋 {r.planeaciones} {r.planeaciones !== 1 ? 'planeaciones' : 'planeación'}
                              </span>
                              {r.planeacionesActivas > 0 && (
                                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#EEEDF8', color: '#3D3A8C', fontWeight: 600 }}>
                                  ▶ {r.planeacionesActivas} activa{r.planeacionesActivas !== 1 ? 's' : ''}
                                </span>
                              )}
                              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F8F8FE', color: '#3D3A8C', fontWeight: 600 }}>
                                📌 {r.pdaDistintos} PDA
                              </span>
                              {r.prioritarios.hayDiagnostico && (
                                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#FFF7ED', color: '#92400E', fontWeight: 600 }}>
                                  ⭐ {r.prioritarios.atendidos}/{r.prioritarios.total} prioritarios
                                </span>
                              )}
                              {r.alumnosConApoyos > 0 && (
                                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                                  ♿ {r.alumnosConApoyos} con apoyos
                                </span>
                              )}
                            </div>
                            {r.campos.length > 0 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                                {r.campos.map((campo: string) => {
                                  const cfg = CAMPOS_CONFIG.find(c => c.nombre === campo)
                                  return (
                                    <span key={campo} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: cfg?.bg || '#F0EFF8', color: cfg?.color || '#888', fontWeight: 600 }}>
                                      {campoCorto(campo)}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <button onClick={() => router.push(`/directivo/docentes/${docente.id}`)}
                            style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                            Ver detalle →
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
        <div style={{ height: 40 }} />
      </div>
    </SidebarDirectivo>
  )
}
