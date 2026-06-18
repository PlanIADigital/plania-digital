'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [planeaciones, setPlaneaciones] = useState<any[]>([])
  const [cobertura, setCobertura] = useState({ campos: 0, ejes: 0, pdas: 0, totalCampos: 4, totalEjes: 7, totalPdas: 371 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      if (data?.is_super_admin) { router.push('/admin'); return }
      if (data?.role === 'directivo') { router.push('/directivo/dashboard'); return }
      setProfile(data)

      const { data: plans } = await supabase
        .from('plannings')
        .select('id, project_name, situacion_problema, starts_on, ends_on, pda_campo, eje_principal, status, created_at')
        .eq('user_id', data.id)
        .order('created_at', { ascending: false })
      setPlaneaciones(plans || [])

      // Cobertura dinámica
      const campos = new Set((plans || []).map((p: any) => p.pda_campo).filter(Boolean))
      const ejes = new Set((plans || []).map((p: any) => p.eje_principal).filter(Boolean))
      const { data: pdaCov } = await supabase.from('pda_coverage').select('pda_id').eq('user_id', data.id)
      setCobertura({ campos: campos.size, ejes: ejes.size, pdas: pdaCov?.length || 0, totalCampos: 4, totalEjes: 7, totalPdas: 371 })

      setLoading(false)
    }
    loadUser()
  }, [])

  const turnoLabel: Record<string, string> = { matutino: 'Matutino', vespertino: 'Vespertino', discontinuo: 'Discontinuo' }
  const rolLabel: Record<string, string> = { educadora: 'Educadora', educador: 'Educador', maestra_musica: 'Maestra de música', maestro_musica: 'Maestro de música', directivo: 'Directivo' }

  function nombreCorto(nombre: string | null): string {
    if (!nombre) return ''
    return nombre.replace(/^Jardín de Niños Indígena\s*/i, '').replace(/^Jardín de Niños\s*/i, '').replace(/^Jardin de Niños\s*/i, '').replace(/^Centro de Educación Preescolar\s*/i, '').trim()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const ultimasPlaneaciones = planeaciones.slice(0, 4)

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px' }}>

        {/* FILA 1 — Saludo completo */}
        <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '16px 32px', marginBottom: 24, textAlign: 'center' }}>
          <h2 style={{ color: 'white', marginTop: 0, marginBottom: 6, fontSize: 24, fontWeight: 800, letterSpacing: '0.02em' }}>
            ¡HOLA, {profile?.full_name?.toUpperCase()}! 👋
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: 13 }}>
            {profile?.school_name && <><strong style={{ color: 'rgba(255,255,255,0.9)' }}>JN:</strong> {nombreCorto(profile.school_name)} · </>}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>CCT:</strong> {profile?.cct_primary} · 
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}> Turno:</strong> {turnoLabel[profile?.shift_primary] ?? profile?.shift_primary} · 
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}> Rol:</strong> {rolLabel[profile?.role] ?? profile?.role}
          </p>
        </div>

        {/* FILA 2 — 2 columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>

          {/* COLUMNA IZQUIERDA — KPIs + MÍA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 3 KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'COBERTURA DE\nCAMPOS FORMATIVOS', value: `${cobertura.campos} / ${cobertura.totalCampos}`, sub: 'CAMPOS Cubiertos · Ciclo 2025-2026' },
                { label: 'COBERTURA DE\nEJES ARTICULADORES', value: `${cobertura.ejes} / ${cobertura.totalEjes}`, sub: 'EJES Cubiertos · Ciclo 2025-2026' },
                { label: 'COBERTURA DE\nPDA', value: `${cobertura.pdas} / ${cobertura.totalPdas}`, sub: 'PDA Cubiertos · Ciclo 2025-2026' },
              ].map((kpi, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 12, padding: '18px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                  <p style={{ color: '#3D3A8C', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{kpi.label}</p>
                  <p style={{ color: '#3D3A8C', fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>{kpi.value}</p>
                  <p style={{ color: '#999', fontSize: 10, margin: 0 }}>{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Sugerencias MÍA */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flex: 1 }}>
              <p style={{ color: '#3D3A8C', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>✨ Sugerencias de MÍA</p>
              {planeaciones.length === 0 ? (
                <p style={{ color: '#999', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                  Cuando generes tu primera planeación, MÍA comenzará a analizar tu cobertura curricular y te dará orientaciones personalizadas aquí.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cobertura.campos < cobertura.totalCampos && (
                    <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #F59E0B' }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                        ⚠️ Tienes {cobertura.totalCampos - cobertura.campos} campo(s) formativo(s) sin cubrir este ciclo. Tu próximo proyecto podría enfocarse en equilibrar la cobertura.
                      </p>
                    </div>
                  )}
                  {cobertura.pdas < 50 && (
                    <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #3D3A8C' }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#3D3A8C', lineHeight: 1.5 }}>
                        📋 Llevas {cobertura.pdas} PDAs cubiertos. ¡Vas bien! Continúa generando planeaciones para aumentar tu cobertura curricular.
                      </p>
                    </div>
                  )}
                  {cobertura.campos >= cobertura.totalCampos && cobertura.pdas >= 50 && (
                    <div style={{ background: '#ECFDF5', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #00A896' }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#065F46', lineHeight: 1.5 }}>
                        ✅ Excelente cobertura curricular. Revisa Mi Avance para identificar áreas de oportunidad específicas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA — Mis Planeaciones */}
          <div style={{ background: 'white', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ color: '#3D3A8C', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>MIS PLANEACIONES</p>
                <span style={{ background: '#3D3A8C', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
                  {planeaciones.length}
                </span>
              </div>
              <button onClick={() => router.push('/planeacion/nueva')}
                style={{ background: '#00A896', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                + Nueva
              </button>
            </div>

            {planeaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 32, margin: '0 0 12px' }}>📋</p>
                <p style={{ color: '#999', fontSize: 14, margin: 0 }}>Aún no tienes planeaciones.<br />¡Crea tu primera hoy!</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {ultimasPlaneaciones.map(p => (
                    <div key={p.id} style={{ border: '1px solid #EEEDF8', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1A1A2E', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.project_name}
                        </p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {p.pda_campo && (
                            <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                              {p.pda_campo}
                            </span>
                          )}
                          {p.starts_on && (
                            <span style={{ color: '#aaa', fontSize: 11 }}>
                              {new Date(p.starts_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                              {p.ends_on && ` → ${new Date(p.ends_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
                            </span>
                          )}
                          <span style={{ background: p.status === 'active' ? '#d1fae5' : '#EEEDF8', color: p.status === 'active' ? '#065f46' : '#666', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                            {p.status === 'active' ? 'Activa' : p.status}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => router.push(`/planeacion/${p.id}`)}
                        style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                        Ver →
                      </button>
                    </div>
                  ))}
                </div>
                {planeaciones.length > 4 && (
                  <button onClick={() => router.push('/mis-planeaciones')}
                    style={{ background: 'none', border: '1px solid #EEEDF8', color: '#3D3A8C', padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 12, width: '100%' }}>
                    Ver todas las planeaciones ({planeaciones.length}) →
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}
