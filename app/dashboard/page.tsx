'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [planeaciones, setPlaneaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('users').select('*')
        .eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      if (data?.role === 'directivo') { router.push('/directivo/dashboard'); return }
      setProfile(data)
      const { data: plans } = await supabase
        .from('plannings')
        .select('id, project_name, situacion_problema, starts_on, ends_on, pda_campo, pda_literal, status, created_at')
        .eq('user_id', data.id)
        .order('created_at', { ascending: false })
      setPlaneaciones(plans || [])
      setLoading(false)
    }
    loadUser()
  }, [])


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
    directivo: 'Directivo',
  }

  const turnoLabel: Record<string, string> = {
    matutino: 'Matutino',
    vespertino: 'Vespertino',
    discontinuo: 'Discontinuo',
  }

  const membresiaLabel: Record<string, string> = {
    trial: 'Prueba gratuita',
    active: 'Activa',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 32px' }}>

        {/* Bienvenida */}
        <div style={{ background: 'white', borderRadius: 12, padding: 32, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 22 }}>
            ¡Hola, {profile?.full_name}! 👋
          </h2>
          <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
            {profile?.school_name && <><strong>JN:</strong> {nombreCorto(profile.school_name)} · </>}<strong>CCT:</strong> {profile?.cct_primary} · <strong>Turno:</strong> {turnoLabel[profile?.shift_primary] ?? profile?.shift_primary} · <strong>Rol:</strong> {rolLabel[profile?.role] ?? profile?.role} · <strong>Membresía:</strong> {membresiaLabel[profile?.membership_status] ?? profile?.membership_status}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Planeaciones</h3>
            <p style={{ color: '#3D3A8C', fontSize: 32, fontWeight: 700, margin: 0 }}>{planeaciones.length}</p>
            <p style={{ color: '#999', fontSize: 13, margin: '4px 0 0' }}>Este ciclo escolar</p>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobertura PDA</h3>
            <p style={{ color: '#3D3A8C', fontSize: 32, fontWeight: 700, margin: 0 }}>{planeaciones.length}</p>
            <p style={{ color: '#999', fontSize: 13, margin: '4px 0 0' }}>PDAs cubiertos — Ciclo 2025-2026</p>
          </div>
        </div>

        {/* Historial */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ color: '#3D3A8C', margin: 0, fontSize: 16, fontWeight: 700 }}>Mis planeaciones</h3>
            <button onClick={() => router.push('/planeacion/nueva')}
              style={{ background: '#00A896', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              + Nueva planeación
            </button>
          </div>

          {planeaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: 32, margin: '0 0 12px' }}>📋</p>
              <p style={{ color: '#999', fontSize: 14, margin: 0 }}>Aún no tienes planeaciones.<br />¡Crea tu primera hoy!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {planeaciones.map(p => (
                <div key={p.id} style={{ border: '1px solid #EEEDF8', borderRadius: 10, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1A1A2E', fontSize: 15 }}>
                        {p.project_name}
                      </p>
                      <p style={{ margin: '0 0 8px', color: '#666', fontSize: 13, lineHeight: 1.4 }}>
                        {p.situacion_problema?.substring(0, 90)}{p.situacion_problema?.length > 90 ? '...' : ''}
                      </p>
                      {p.pda_literal && (
                        <p style={{ margin: '0 0 8px', color: '#555', fontSize: 12, fontStyle: 'italic', lineHeight: 1.4 }}>
                          PDA: {p.pda_literal?.substring(0, 100)}{p.pda_literal?.length > 100 ? '...' : ''}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {p.pda_campo && (
                          <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                            {p.pda_campo}
                          </span>
                        )}
                        {p.starts_on && (
                          <span style={{ color: '#aaa', fontSize: 12 }}>
                            {new Date(p.starts_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {p.ends_on && ` → ${new Date(p.ends_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
                          </span>
                        )}
                        <span style={{
                          background: p.status === 'active' ? '#d1fae5' : '#EEEDF8',
                          color: p.status === 'active' ? '#065f46' : '#666',
                          fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600
                        }}>
                          {p.status === 'active' ? 'Activa' : p.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/planeacion/${p.id}`)}
                      style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Ver →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}