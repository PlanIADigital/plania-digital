'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function nombreCorto(nombre: string | null): string {
  if (!nombre) return ''
  return nombre
    .replace(/^Jardín de Niños Indígena\s*/i, '')
    .replace(/^Jardín de Niños\s*/i, '')
    .replace(/^Jardin de Niños\s*/i, '')
    .replace(/^Centro de Educación Preescolar\s*/i, '')
    .trim()
}

const CAMPOS_COLORES: Record<string, { bg: string; color: string }> = {
  'Lenguajes': { bg: '#EEEDF8', color: '#3D3A8C' },
  'Saberes y Pensamiento Científico': { bg: '#E0F5F3', color: '#00A896' },
  'Ética, Naturaleza y Sociedades': { bg: '#D1FAE5', color: '#059669' },
  'De lo Humano y lo Comunitario': { bg: '#EDE9FE', color: '#7C3AED' },
}

export default function MisPlaneacionesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [planeaciones, setPlaneaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'active' | 'closed'>('todas')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
      const { data: plans } = await supabase
        .from('plannings')
        .select('id, project_name, situacion_problema, finalidad, starts_on, ends_on, pda_campo, pda_contenido, pda_literal, eje_principal, status, created_at')
        .eq('user_id', data.id)
        .order('created_at', { ascending: false })
      setPlaneaciones(plans || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtradas = planeaciones.filter(p => {
    if (filtro === 'todas') return true
    if (filtro === 'active') return p.status === 'active'
    if (filtro === 'closed') return p.status !== 'active'
    return true
  })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 60px' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#3D3A8C', margin: '0 0 4px' }}>Mis planeaciones</h1>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
            {profile.school_name && <>{nombreCorto(profile.school_name)} · </>}
            CCT {profile.cct_primary} · {profile.grado || '2°'} grado · Ciclo 2025–2026
          </p>
        </div>

        {/* Filtros + botón nueva */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['todas', 'active', 'closed'] as const).map(f => {
              const labels = { todas: 'Todas', active: 'Activas', closed: 'Cerradas' }
              return (
                <button key={f} onClick={() => setFiltro(f)}
                  style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: filtro === f ? 700 : 400, cursor: 'pointer', border: `1.5px solid ${filtro === f ? '#3D3A8C' : '#E0DFF5'}`, background: filtro === f ? '#EEEDF8' : 'white', color: filtro === f ? '#3D3A8C' : '#888' }}>
                  {labels[f]} {f === 'todas' ? `(${planeaciones.length})` : f === 'active' ? `(${planeaciones.filter(p => p.status === 'active').length})` : `(${planeaciones.filter(p => p.status !== 'active').length})`}
                </button>
              )
            })}
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
              {filtro === 'todas' ? 'Aún no tienes planeaciones.' : `No hay planeaciones ${filtro === 'active' ? 'activas' : 'cerradas'}.`}
            </p>
            <button onClick={() => router.push('/planeacion/nueva')}
              style={{ background: '#00A896', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              ✨ Crear mi primera planeación
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtradas.map(p => {
              const colores = CAMPOS_COLORES[p.pda_campo] || { bg: '#F0EFF8', color: '#3D3A8C' }
              return (
                <div key={p.id} style={{ background: 'white', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${p.status === 'active' ? '#E0DFF5' : '#F0EFF8'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#1A1A2E', fontSize: 15 }}>{p.project_name}</p>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: p.status === 'active' ? '#3D3A8C' : '#E0F5F3', color: p.status === 'active' ? 'white' : '#0F6E56', fontWeight: 600, flexShrink: 0 }}>
                          {p.status === 'active' ? 'Activa' : 'Cerrada'}
                        </span>
                      </div>
                      {p.finalidad && (
                        <p style={{ margin: '0 0 10px', color: '#555', fontSize: 13, lineHeight: 1.5 }}>
                          {p.finalidad.substring(0, 100)}{p.finalidad.length > 100 ? '...' : ''}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {p.pda_campo && (
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: colores.bg, color: colores.color }}>
                            {p.pda_campo}
                          </span>
                        )}
                        {p.eje_principal && (
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: '#F0FFF8', color: '#059669', border: '1px solid #6EE7B7' }}>
                            🔗 {p.eje_principal}
                          </span>
                        )}
                        {p.starts_on && (
                          <span style={{ color: '#aaa', fontSize: 11 }}>
                            📅 {new Date(p.starts_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            {p.ends_on && ` → ${new Date(p.ends_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => router.push(`/planeacion/${p.id}`)}
                      style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Ver →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}
