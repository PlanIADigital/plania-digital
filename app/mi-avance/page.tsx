'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

const CAMPOS = [
  { nombre: 'Lenguajes', emoji: '📚', color: '#3D3A8C', bg: '#EEEDF8' },
  { nombre: 'Saberes y Pensamiento Científico', emoji: '🔬', color: '#00A896', bg: '#E0F5F3' },
  { nombre: 'Ética, Naturaleza y Sociedades', emoji: '🌱', color: '#059669', bg: '#D1FAE5' },
  { nombre: 'De lo Humano y lo Comunitario', emoji: '🤝', color: '#7C3AED', bg: '#EDE9FE' },
]

export default function MiAvancePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [coverage, setCoverage] = useState<any[]>([])
  const [totalPlaneaciones, setTotalPlaneaciones] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      setProfile(user)

      // Cargar cobertura de PDAs
      const { data: cov } = await supabase
        .from('pda_coverage')
        .select('campo, contenido, pda, fecha_abordado')
        .eq('user_id', user.id)
        .order('fecha_abordado', { ascending: false })
      setCoverage(cov || [])

      // Contar planeaciones
      const { count } = await supabase
        .from('plannings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setTotalPlaneaciones(count || 0)

      setCargando(false)
    }
    load()
  }, [])

  const tieneDatos = coverage.length > 0

  const s = {
    section: { background: 'white', borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 } as React.CSSProperties,
  }

  if (!profile || cargando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 16px' }}>

        {/* Encabezado */}
        <div style={s.section}>
          <h2 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 22, fontWeight: 700 }}>
            Mi avance curricular
          </h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 0, marginTop: 0 }}>
            {profile.cct_primary} · {profile.grado || '2°'} grado · Ciclo escolar 2025–2026
          </p>
        </div>

        {!tieneDatos ? (
          <>
            {/* Estado vacío — motivador */}
            <div style={{ ...s.section, textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>🗺️</div>
              <h3 style={{ color: '#3D3A8C', fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>
                Tu mapa de avance está listo para crecer
              </h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.8, maxWidth: 480, margin: '0 auto 24px', marginBottom: 24 }}>
                Cada planeación que generes irá construyendo tu mapa de cobertura curricular — campos formativos abordados, PDAs trabajados, y áreas que aún esperan tu atención.
              </p>
              <p style={{ color: '#3D3A8C', fontSize: 14, fontWeight: 600, lineHeight: 1.7, maxWidth: 440, margin: '0 auto 32px' }}>
                Tu trabajo tiene historia. Aquí la verás crecer.
              </p>

              {/* Los 4 campos en gris — anticipando lo que vendrá */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
                {CAMPOS.map(campo => (
                  <div key={campo.nombre} style={{ background: '#F8F8FE', border: '1.5px dashed #D8D6F0', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{campo.emoji}</div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#C4C2E8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                      {campo.nombre === 'Saberes y Pensamiento Científico' ? 'Saberes y P. Científico' :
                       campo.nombre === 'Ética, Naturaleza y Sociedades' ? 'Ética, Naturaleza...' :
                       campo.nombre === 'De lo Humano y lo Comunitario' ? 'Lo Humano y Comunitario' :
                       campo.nombre}
                    </p>
                    <div style={{ background: '#EEE', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                      <div style={{ background: '#D8D6F0', height: '100%', width: '0%' }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#C4C2E8', marginTop: 6, marginBottom: 0 }}>0 PDAs abordados</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push('/planeacion/nueva')}
                style={{ background: '#00A896', color: 'white', border: 'none', padding: '13px 28px', fontSize: 15, cursor: 'pointer', borderRadius: 8, fontWeight: 600 }}>
                ✨ Crear mi primera planeación
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Resumen general */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                <p style={{ fontSize: 32, fontWeight: 800, color: '#3D3A8C', margin: '0 0 4px' }}>{totalPlaneaciones}</p>
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Planeaciones generadas</p>
              </div>
              <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                <p style={{ fontSize: 32, fontWeight: 800, color: '#00A896', margin: '0 0 4px' }}>{coverage.length}</p>
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>PDAs abordados</p>
              </div>
            </div>

            {/* Cobertura por campo formativo */}
            <div style={s.section}>
              <p style={s.sectionTitle}>Cobertura por campo formativo</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {CAMPOS.map(campo => {
                  const pdasDelCampo = coverage.filter(c => c.campo === campo.nombre)
                  const unicos = [...new Set(pdasDelCampo.map(c => c.pda))]
                  const porcentaje = Math.min(Math.round((unicos.length / 20) * 100), 100)
                  return (
                    <div key={campo.nombre}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{campo.emoji}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
                            {campo.nombre === 'Saberes y Pensamiento Científico' ? 'Saberes y P. Científico' :
                             campo.nombre === 'Ética, Naturaleza y Sociedades' ? 'Ética, Naturaleza y Sociedades' :
                             campo.nombre}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: campo.color }}>{unicos.length} PDAs</span>
                      </div>
                      <div style={{ background: '#F0EFF8', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                        <div style={{ background: `linear-gradient(90deg, ${campo.color}, ${campo.bg})`, height: '100%', borderRadius: 99, width: `${porcentaje}%`, transition: 'width 1s ease' }} />
                      </div>
                      {unicos.length === 0 && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>⚠️ Campo sin abordar este ciclo</span>
                          <button
                            onClick={() => router.push('/planeacion/nueva')}
                            style={{ fontSize: 11, color: '#3D3A8C', background: '#EEEDF8', border: 'none', borderRadius: 20, padding: '2px 10px', cursor: 'pointer', fontWeight: 600 }}>
                            Equilibrar con MÍA →
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* PDAs recientes */}
            <div style={s.section}>
              <p style={s.sectionTitle}>PDAs abordados recientemente</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {coverage.slice(0, 8).map((c, i) => {
                  const campo = CAMPOS.find(cf => cf.nombre === c.campo)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: '#F8F8FE', borderRadius: 8, border: '1px solid #EEEDF8' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{campo?.emoji || '📋'}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: campo?.color || '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.campo}</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.5, fontStyle: 'italic' }}>{c.pda}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}
