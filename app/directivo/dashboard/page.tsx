'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import SidebarDirectivo from '@/components/SidebarDirectivo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

const rolLabel: Record<string, string> = {
  educadora: 'Educadora',
  educador: 'Educador',
  maestra_musica: 'Maestra de música',
  maestro_musica: 'Maestro de música',
}

interface Docente {
  id: string
  full_name: string
  role: string
  grado: string
  total_students: number
  cct_primary: string
  shift_primary: string
  evaluacion_individual: any
}

interface Planning {
  id: string
  user_id: string
  project_name: string
  pda_campo: string
  eje_principal: string
  status: string
  starts_on: string
  ends_on: string
  created_at: string
}

export default function DirectivoDashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [planningsPorDocente, setPlanningsPorDocente] = useState<Record<string, Planning[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      if (user.role !== 'directivo') { router.push('/dashboard'); return }
      setProfile(user)

      const { data: docs } = await supabase
        .from('users')
        .select('id, full_name, role, grado, total_students, cct_primary, shift_primary, evaluacion_individual')
        .eq('cct_primary', user.cct_primary)
        .neq('role', 'directivo')
        .eq('profile_completed', true)
        .order('full_name')
      const docentesList: Docente[] = (docs || []) as Docente[]
      setDocentes(docentesList)

      if (docentesList.length > 0) {
        const ids = docentesList.map((d: Docente) => d.id)
        const { data: plans } = await supabase
          .from('plannings')
          .select('id, user_id, project_name, pda_campo, eje_principal, status, starts_on, ends_on, created_at')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
        const porDocente: Record<string, Planning[]> = {}
        ;(plans || []).forEach((p: Planning) => {
          if (!porDocente[p.user_id]) porDocente[p.user_id] = []
          porDocente[p.user_id].push(p)
        })
        setPlanningsPorDocente(porDocente)
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

  const totalPlaneaciones = Object.values(planningsPorDocente).flat().length
  const totalDocentes = docentes.length
  const docentesConPlanes = docentes.filter((d: Docente) => (planningsPorDocente[d.id] || []).length > 0).length

  return (
    <SidebarDirectivo profile={profile}>
      <div style={{ padding: '32px 40px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>Panel institucional</h1>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
            <strong>JN:</strong> {nombreCorto(profile.school_name) || profile.cct_primary} &nbsp;·&nbsp;
            <strong>CCT:</strong> {profile.cct_primary} &nbsp;·&nbsp; Ciclo 2025-2026
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
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
              {docentes.map((docente: Docente) => {
                const planes = planningsPorDocente[docente.id] || []
                const planesActivos = planes.filter((p: Planning) => p.status === 'active').length
                const camposUsados = [...new Set(planes.map((p: Planning) => p.pda_campo).filter(Boolean))]
                const neeCount = Array.isArray(docente.evaluacion_individual?.alumnos)
                  ? docente.evaluacion_individual.alumnos.filter((a: any) => a.nee?.length > 0).length : 0
                return (
                  <div key={docente.id} style={{ border: '1.5px solid #EEEDF8', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEEDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#3D3A8C', flexShrink: 0 }}>
                            {docente.full_name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 14 }}>{docente.full_name}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#888' }}>
                              {rolLabel[docente.role] || docente.role} · {docente.grado || 'sin grado'} · {docente.total_students || '?'} alumnos
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: camposUsados.length > 0 ? 8 : 0 }}>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: planes.length > 0 ? '#E0F5F3' : '#F8F8FE', color: planes.length > 0 ? '#0F6E56' : '#888', fontWeight: 600 }}>
                            📋 {planes.length} planeación{planes.length !== 1 ? 'es' : ''}
                          </span>
                          {planesActivos > 0 && (
                            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#EEEDF8', color: '#3D3A8C', fontWeight: 600 }}>
                              ▶ {planesActivos} activa{planesActivos !== 1 ? 's' : ''}
                            </span>
                          )}
                          {neeCount > 0 && (
                            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                              ⚠️ {neeCount} NEE
                            </span>
                          )}
                        </div>
                        {camposUsados.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                            {camposUsados.map((campo: string) => {
                              const cfg = CAMPOS_CONFIG.find(c => c.nombre === campo)
                              return (
                                <span key={campo} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: cfg?.bg || '#F0EFF8', color: cfg?.color || '#888', fontWeight: 600 }}>
                                  {campo === 'Saberes y Pensamiento Científico' ? 'Saberes...' : campo === 'Ética, Naturaleza y Sociedades' ? 'Ética...' : campo === 'De lo Humano y lo Comunitario' ? 'Lo Humano...' : campo}
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
        <div style={{ height: 40 }} />
      </div>
    </SidebarDirectivo>
  )
}
