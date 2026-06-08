'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ICONOS_CAMPO: Record<string, (size?: number, opacity?: number) => React.ReactNode> = {
  'Lenguajes': (size = 48, opacity = 1) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="5" width="20" height="28" rx="3" fill="#EEEDF8" stroke="#3D3A8C" strokeWidth="1.8"/>
      <rect x="13" y="5" width="22" height="30" rx="3" fill="white" stroke="#3D3A8C" strokeWidth="1.8"/>
      <line x1="18" y1="14" x2="30" y2="14" stroke="#3D3A8C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="18" y1="19" x2="30" y2="19" stroke="#00A896" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="24" x2="26" y2="24" stroke="#00A896" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="35" cy="36" r="8" fill="#3D3A8C"/>
      <text x="35" y="40" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">A</text>
    </svg>
  ),
  'Saberes y Pensamiento Científico': (size = 48, opacity = 1) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="7" fill="#E0F5F3" stroke="#00A896" strokeWidth="1.8"/>
      <ellipse cx="24" cy="24" rx="14" ry="7" stroke="#00A896" strokeWidth="1.5" strokeDasharray="3 2"/>
      <ellipse cx="24" cy="24" rx="7" ry="14" stroke="#3D3A8C" strokeWidth="1.5" strokeDasharray="3 2"/>
      <circle cx="24" cy="24" r="2.5" fill="#00A896"/>
      <circle cx="24" cy="10" r="2" fill="#3D3A8C"/>
      <circle cx="24" cy="38" r="2" fill="#3D3A8C"/>
    </svg>
  ),
  'Ética, Naturaleza y Sociedades': (size = 48, opacity = 1) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
      <path d="M24 40 C24 40 10 28 10 18 C10 11 16 6 24 6 C32 6 38 11 38 18 C38 28 24 40 24 40Z" fill="#D1FAE5" stroke="#059669" strokeWidth="1.8"/>
      <path d="M24 18 C24 18 18 13 20 8" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M24 18 C24 18 30 13 28 8" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="24" y1="18" x2="24" y2="36" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M24 24 C24 24 19 22 17 25" stroke="#059669" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M24 29 C24 29 29 27 31 30" stroke="#059669" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  'De lo Humano y lo Comunitario': (size = 48, opacity = 1) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="14" r="5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8"/>
      <circle cx="32" cy="14" r="5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8"/>
      <circle cx="24" cy="12" r="5.5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8"/>
      <path d="M6 36 C6 28 11 24 16 24 C18 24 20 25 22 26" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M42 36 C42 28 37 24 32 24 C30 24 28 25 26 26" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 38 C14 30 18 26 24 26 C30 26 34 30 34 38" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
}

const CAMPOS = [
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
        .select('campo, pda_literal, is_primary, covered_on, times_used')
        .eq('user_id', user.id)
        
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
            {profile.school_name && <><strong>JN:</strong> {nombreCorto(profile.school_name)} · </>}<strong>CCT:</strong> {profile.cct_primary} · <strong>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''} · <strong>Grupo:</strong> {profile.grado || '2°'} A · <strong>Ciclo Escolar:</strong> 2025-2026
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
                    <div style={{ marginBottom: 8 }}>{ICONOS_CAMPO[campo.nombre]?.(36, 0.3)}</div>
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
                  const unicos = [...new Set(pdasDelCampo.map(c => c.pda_literal))]
                  const porcentaje = Math.min(Math.round((unicos.length / 20) * 100), 100)
                  return (
                    <div key={campo.nombre}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{ICONOS_CAMPO[campo.nombre]?.(22)}</span>
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
                      <span style={{ flexShrink: 0 }}>{campo ? ICONOS_CAMPO[campo.nombre]?.(20) : '📋'}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: campo?.color || '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.campo}</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.5, fontStyle: 'italic' }}>{c.pda_literal}</p>
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
