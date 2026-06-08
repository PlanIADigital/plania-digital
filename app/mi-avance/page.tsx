'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CAMPOS_CONFIG = [
  { nombre: 'Lenguajes',                          color: '#3D3A8C', bg: '#EEEDF8', total: 86  },
  { nombre: 'Saberes y Pensamiento Científico',   color: '#00A896', bg: '#E0F5F3', total: 130 },
  { nombre: 'Ética, Naturaleza y Sociedades',     color: '#059669', bg: '#D1FAE5', total: 70  },
  { nombre: 'De lo Humano y lo Comunitario',      color: '#7C3AED', bg: '#EDE9FE', total: 85  },
]

const EJES = [
  'Interculturalidad crítica',
  'Igualdad de género',
  'Inclusión',
  'Pensamiento crítico',
  'Apropiación de las culturas a través de la lectura y la escritura',
  'Artes y experiencias estéticas',
  'Vida saludable',
]

const MESES = ['Sep','Oct','Nov','Dic','Ene','Feb','Mar','Abr','May','Jun','Jul']

function nombreCorto(nombre: string | null): string {
  if (!nombre) return ''
  return nombre
    .replace(/^Jardín de Niños Indígena\s*/i, '')
    .replace(/^Jardín de Niños\s*/i, '')
    .replace(/^Jardin de Niños\s*/i, '')
    .replace(/^Centro de Educación Preescolar\s*/i, '')
    .trim()
}

function campoCorto(nombre: string): string {
  const mapa: Record<string, string> = {
    'Saberes y Pensamiento Científico': 'Saberes y P. Científico',
    'Ética, Naturaleza y Sociedades':   'Ética, Naturaleza...',
    'De lo Humano y lo Comunitario':    'Lo Humano y Comunitario',
  }
  return mapa[nombre] || nombre
}

function mesActualCiclo(): number {
  const m = new Date().getMonth()
  if (m >= 8) return m - 8
  if (m <= 6) return m + 4
  return -1
}

function IconoCampo({ nombre, size = 22, opacity = 1 }: { nombre: string; size?: number; opacity?: number }) {
  if (nombre === 'Lenguajes') return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }}>
      <rect x="7" y="5" width="20" height="28" rx="3" fill="#EEEDF8" stroke="#3D3A8C" strokeWidth="1.8"/>
      <rect x="13" y="5" width="22" height="30" rx="3" fill="white" stroke="#3D3A8C" strokeWidth="1.8"/>
      <line x1="18" y1="14" x2="30" y2="14" stroke="#3D3A8C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="18" y1="19" x2="30" y2="19" stroke="#00A896" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="24" x2="26" y2="24" stroke="#00A896" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="35" cy="36" r="8" fill="#3D3A8C"/>
      <text x="35" y="40" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">A</text>
    </svg>
  )
  if (nombre === 'Saberes y Pensamiento Científico') return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }}>
      <circle cx="24" cy="24" r="7" fill="#E0F5F3" stroke="#00A896" strokeWidth="1.8"/>
      <ellipse cx="24" cy="24" rx="14" ry="7" stroke="#00A896" strokeWidth="1.5" strokeDasharray="3 2"/>
      <ellipse cx="24" cy="24" rx="7" ry="14" stroke="#3D3A8C" strokeWidth="1.5" strokeDasharray="3 2"/>
      <circle cx="24" cy="24" r="2.5" fill="#00A896"/>
      <circle cx="24" cy="10" r="2" fill="#3D3A8C"/>
      <circle cx="24" cy="38" r="2" fill="#3D3A8C"/>
    </svg>
  )
  if (nombre === 'Ética, Naturaleza y Sociedades') return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }}>
      <path d="M24 40 C24 40 10 28 10 18 C10 11 16 6 24 6 C32 6 38 11 38 18 C38 28 24 40 24 40Z" fill="#D1FAE5" stroke="#059669" strokeWidth="1.8"/>
      <path d="M24 18 C24 18 18 13 20 8" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M24 18 C24 18 30 13 28 8" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="24" y1="18" x2="24" y2="36" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ opacity }}>
      <circle cx="16" cy="14" r="5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8"/>
      <circle cx="32" cy="14" r="5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8"/>
      <circle cx="24" cy="12" r="5.5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8"/>
      <path d="M6 36 C6 28 11 24 16 24 C18 24 20 25 22 26" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M42 36 C42 28 37 24 32 24 C30 24 28 25 26 26" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 38 C14 30 18 26 24 26 C30 26 34 30 34 38" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function KpiCard({ label, value, delta, deltaColor = '#0F6E56', icon }: {
  label: string; value: string | number; delta: string; deltaColor?: string; icon: string
}) {
  return (
    <div style={{ background: '#F8F8FE', borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{icon}</span>{label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>{value}</p>
      <p style={{ fontSize: 11, color: deltaColor, margin: 0 }}>{delta}</p>
    </div>
  )
}

function AlertaMia({ tipo, texto }: { tipo: 'warn' | 'info' | 'success'; texto: React.ReactNode }) {
  const estilos = {
    warn:    { bg: '#FFF7ED', border: '#F59E0B', icon: '⚠️' },
    info:    { bg: '#EEEDF8', border: '#3D3A8C', icon: '💡' },
    success: { bg: '#ECFDF5', border: '#059669', icon: '✨' },
  }
  const e = estilos[tipo]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: e.bg, borderRadius: 8, borderLeft: `3px solid ${e.border}`, marginBottom: 8 }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{e.icon}</span>
      <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, lineHeight: 1.6 }}>{texto}</p>
    </div>
  )
}

export default function MiAvancePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [coverage, setCoverage] = useState<any[]>([])
  const [plannings, setPlannings] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [tabActivo, setTabActivo] = useState<'cobertura' | 'ejes' | 'mapa' | 'nee'>('cobertura')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      setProfile(user)
      const { data: plans } = await supabase
        .from('plannings')
        .select('id, project_name, pda_campo, eje_articulador, status, starts_on, ends_on, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setPlannings(plans || [])
      const { data: cov } = await supabase
        .from('pda_coverage')
        .select('campo, pda_literal, is_primary, covered_on, times_used')
        .eq('user_id', user.id)
      setCoverage(cov || [])
      setCargando(false)
    }
    load()
  }, [])

  const pdaUnicosPorCampo = CAMPOS_CONFIG.map(cf => {
    const unicos = [...new Set(coverage.filter(c => c.campo === cf.nombre).map(c => c.pda_literal))]
    return { ...cf, trabajados: unicos.length, porcentaje: Math.round((unicos.length / cf.total) * 100) }
  })
  const totalPDAs = [...new Set(coverage.map(c => c.pda_literal))].length
  const totalPlanesAct = plannings.filter(p => p.status === 'active').length
  const totalPlanes = plannings.length
  const pdasPrioritarios = [...new Set(coverage.filter(c => c.is_primary).map(c => c.pda_literal))].length
  const pdasPrioritariosPendientes = coverage.filter(c => c.is_primary && !c.covered_on).length
  const ejesConteo: Record<string, number> = {}
  plannings.forEach(p => {
    if (p.eje_articulador) ejesConteo[p.eje_articulador] = (ejesConteo[p.eje_articulador] || 0) + 1
  })
  const maxEje = Math.max(1, ...Object.values(ejesConteo))
  const ejesSinUsar = EJES.filter(e => !ejesConteo[e])
  const pdaCoverageMap: Record<string, number> = {}
  coverage.forEach(c => { pdaCoverageMap[c.pda_literal] = (pdaCoverageMap[c.pda_literal] || 0) + (c.times_used || 1) })
  const prioritariosPDA = new Set(coverage.filter(c => c.is_primary).map(c => c.pda_literal))
  const evaluacionIndividual = profile?.evaluacion_individual || {}
  const alumnosConNEE = Object.entries(evaluacionIndividual).filter(([, v]: any) => v?.nee && v.nee.length > 0).slice(0, 4)
  const mesActual = mesActualCiclo()
  const alertas: Array<{ tipo: 'warn' | 'info' | 'success'; texto: React.ReactNode }> = []
  const camposBajos = pdaUnicosPorCampo.filter(c => c.porcentaje < 20)
  if (camposBajos.length > 0) alertas.push({ tipo: 'warn', texto: <><strong>{camposBajos.map(c => campoCorto(c.nombre)).join(' y ')}</strong> tienen menos del 20% de cobertura.</> })
  if (ejesSinUsar.length >= 3) alertas.push({ tipo: 'warn', texto: <><strong>{ejesSinUsar.length} ejes articuladores</strong> sin abordar este ciclo — incluyendo <em>{ejesSinUsar[0]}</em>.</> })
  if (pdasPrioritariosPendientes > 0) alertas.push({ tipo: 'info', texto: <><strong>{pdasPrioritariosPendientes} PDAs prioritarios</strong> del diagnóstico grupal aún no abordados.</> })
  const campoDestacado = pdaUnicosPorCampo.find(c => c.porcentaje >= 50)
  if (campoDestacado) alertas.push({ tipo: 'success', texto: <><strong>¡Excelente!</strong> Llevas {campoDestacado.porcentaje}% en <em>{campoCorto(campoDestacado.nombre)}</em>.</> })
  if (alertas.length === 0 && totalPlanes > 0) alertas.push({ tipo: 'info', texto: <>Tu avance está equilibrado. MÍA estará aquí cuando la necesites.</> })

  if (!profile || cargando) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando tu avance...</p>
    </div>
  )

  if (totalPlanes === 0) return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '48px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>🗺️</div>
          <h2 style={{ color: '#3D3A8C', fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>Tu centro de control está listo para crecer</h2>
          <p style={{ color: '#666', fontSize: 14, lineHeight: 1.9, maxWidth: 440, margin: '0 auto 32px' }}>Cada planeación que generes construirá automáticamente tu mapa de cobertura curricular.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 380, margin: '0 auto 32px' }}>
            {CAMPOS_CONFIG.map(cf => (
              <div key={cf.nombre} style={{ background: '#F8F8FE', border: '1.5px dashed #D8D6F0', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ marginBottom: 8 }}><IconoCampo nombre={cf.nombre} size={32} opacity={0.3} /></div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C2E8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{campoCorto(cf.nombre)}</p>
                <div style={{ background: '#EEE', borderRadius: 99, height: 5 }}><div style={{ width: '0%', height: '100%', background: '#D8D6F0', borderRadius: 99 }} /></div>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/planeacion/nueva')} style={{ background: '#00A896', color: 'white', border: 'none', padding: '12px 28px', fontSize: 15, cursor: 'pointer', borderRadius: 8, fontWeight: 600 }}>
            ✨ Crear mi primera planeación
          </button>
        </div>
      </div>
    </Sidebar>
  )

  return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#3D3A8C', margin: '0 0 4px' }}>Centro de control pedagógico</h1>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{profile.school_name && <>{nombreCorto(profile.school_name)} · </>}CCT {profile.cct_primary} · {profile.grado || '2°'} grado · Ciclo 2025–2026</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          <KpiCard label="PDAs trabajados" value={totalPDAs} delta={`de ${CAMPOS_CONFIG.reduce((s, c) => s + c.total, 0)} totales del ciclo`} icon="📌" />
          <KpiCard label="Planeaciones" value={totalPlanes} delta={totalPlanesAct > 0 ? `${totalPlanesAct} activa${totalPlanesAct > 1 ? 's' : ''}` : 'todas cerradas'} icon="📋" />
          <KpiCard label="Ejes articuladores" value={`${Object.keys(ejesConteo).length}/${EJES.length}`} delta={ejesSinUsar.length > 0 ? `${ejesSinUsar.length} sin abordar` : 'todos cubiertos'} deltaColor={ejesSinUsar.length > 2 ? '#D97706' : '#0F6E56'} icon="🔗" />
          <KpiCard label="PDAs prioritarios" value={pdasPrioritarios} delta={pdasPrioritariosPendientes > 0 ? `${pdasPrioritariosPendientes} del diagnóstico pendientes` : 'diagnóstico atendido ✓'} deltaColor={pdasPrioritariosPendientes > 0 ? '#D97706' : '#0F6E56'} icon="⭐" />
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Progreso del ciclo escolar 2025–2026</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {MESES.map((mes, i) => (
              <span key={mes} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: i === mesActual ? 700 : 400, background: i < mesActual ? '#E0F5F3' : i === mesActual ? '#3D3A8C' : '#F3F3F3', color: i < mesActual ? '#0F6E56' : i === mesActual ? 'white' : '#AAA', border: `1px solid ${i < mesActual ? '#9FE1CB' : i === mesActual ? '#3D3A8C' : '#E5E5E5'}` }}>
                {mes}{i === mesActual ? ' ▶' : ''}
              </span>
            ))}
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #F0EFF8' }}>
            {(['cobertura','ejes','mapa','nee'] as const).map((key, idx) => {
              const labels = ['📊 Campos','🔗 Ejes','🗺️ PDAs','♿ Diversidad']
              return <button key={key} onClick={() => setTabActivo(key)} style={{ flex: 1, padding: '12px 6px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tabActivo === key ? 700 : 400, background: tabActivo === key ? '#EEEDF8' : 'white', color: tabActivo === key ? '#3D3A8C' : '#888', borderBottom: tabActivo === key ? '2px solid #3D3A8C' : '2px solid transparent' }}>{labels[idx]}</button>
            })}
          </div>
          <div style={{ padding: '20px 24px' }}>
            {tabActivo === 'cobertura' && <div>{pdaUnicosPorCampo.map(cf => (
              <div key={cf.nombre} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconoCampo nombre={cf.nombre} size={20} /><span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{campoCorto(cf.nombre)}</span></div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cf.color }}>{cf.trabajados}/{cf.total} PDAs</span>
                </div>
                <div style={{ background: '#F0EFF8', borderRadius: 99, height: 8, overflow: 'hidden' }}><div style={{ background: cf.color, height: '100%', borderRadius: 99, width: `${cf.porcentaje}%`, transition: 'width 0.8s ease' }} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#888' }}>{cf.porcentaje}% del ciclo</span>
                  {cf.porcentaje < 20 && <button onClick={() => router.push('/planeacion/nueva')} style={{ fontSize: 11, color: '#3D3A8C', background: '#EEEDF8', border: 'none', borderRadius: 20, padding: '2px 10px', cursor: 'pointer', fontWeight: 600 }}>Equilibrar con MÍA →</button>}
                </div>
              </div>
            ))}</div>}
            {tabActivo === 'ejes' && <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {EJES.map(eje => {
                  const count = ejesConteo[eje] || 0
                  const sinUsar = count === 0
                  return <div key={eje} style={{ padding: '10px 12px', borderRadius: 10, background: sinUsar ? '#FFF7ED' : '#F8F8FE', border: `1px solid ${sinUsar ? '#FDE68A' : '#EEEDF8'}` }}>
                    <p style={{ fontSize: 11, color: sinUsar ? '#92400E' : '#888', margin: '0 0 6px', lineHeight: 1.4 }}>{eje.length > 42 ? eje.substring(0, 42) + '…' : eje}</p>
                    <div style={{ background: sinUsar ? '#FDE68A' : '#E8E8F8', borderRadius: 99, height: 4 }}><div style={{ background: sinUsar ? '#F59E0B' : '#3D3A8C', height: '100%', borderRadius: 99, width: `${Math.round((count / maxEje) * 100)}%` }} /></div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: sinUsar ? '#92400E' : '#3D3A8C', margin: '4px 0 0' }}>{count === 0 ? '⚠️ Sin abordar' : `${count} planeación${count > 1 ? 'es' : ''}`}</p>
                  </div>
                })}
              </div>
              {ejesSinUsar.length > 0 && <button onClick={() => router.push('/planeacion/nueva')} style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '10px 20px', fontSize: 13, cursor: 'pointer', borderRadius: 8, fontWeight: 600, width: '100%', marginTop: 16 }}>✨ Crear planeación y equilibrar ejes</button>}
            </div>}
            {tabActivo === 'mapa' && <div>
              {CAMPOS_CONFIG.map(cf => {
                const pdasDelCampo = [...new Set(coverage.filter(c => c.campo === cf.nombre).map(c => c.pda_literal))]
                const celdas = Array.from({ length: Math.min(cf.total, 48) }, (_, i) => {
                  const trabajado = i < pdasDelCampo.length
                  const esPrioritario = trabajado && prioritariosPDA.has(pdasDelCampo[i])
                  const veces = trabajado ? (pdaCoverageMap[pdasDelCampo[i]] || 1) : 0
                  return { trabajado, esPrioritario, veces }
                })
                return <div key={cf.nombre} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>{campoCorto(cf.nombre)}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{pdasDelCampo.length}/{cf.total} PDAs</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 3 }}>
                    {celdas.map((c, i) => <div key={i} style={{ height: 14, borderRadius: 2, background: c.veces >= 3 ? cf.color : c.veces === 2 ? cf.bg : c.veces === 1 ? `${cf.bg}CC` : '#F0EFF8', border: c.esPrioritario && !c.trabajado ? '1.5px solid #F59E0B' : 'none' }} />)}
                  </div>
                </div>
              })}
            </div>}
            {tabActivo === 'nee' && <div>
              {alumnosConNEE.length === 0 ? <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>👥</p>
                <p style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>No has registrado observaciones de diversidad en Mi Grupo todavía.</p>
                <button onClick={() => router.push('/mi-grupo')} style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '10px 20px', fontSize: 13, cursor: 'pointer', borderRadius: 8, fontWeight: 600 }}>Ir a Mi Grupo →</button>
              </div> : <div>{alumnosConNEE.map(([ref, datos]: any, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#F8F8FE', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEEDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#3D3A8C', flexShrink: 0 }}>{String(ref).replace('alumno_', 'A')}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', margin: '0 0 4px' }}>{datos.nee?.join(' · ')}</p>
                    <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{datos.pdas_sugeridos?.length || 0} PDAs adaptados</p>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E0F5F3', color: '#0F6E56', fontWeight: 600 }}>Activo</span>
                </div>
              ))}</div>}
            </div>}
          </div>
        </div>
        {alertas.length > 0 && <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px' }}>✦ Orientación de MÍA</p>
          {alertas.map((a, i) => <AlertaMia key={i} tipo={a.tipo} texto={a.texto} />)}
          <button onClick={() => router.push('/planeacion/nueva')} style={{ marginTop: 8, background: '#00A896', color: 'white', border: 'none', padding: '10px 20px', fontSize: 13, cursor: 'pointer', borderRadius: 8, fontWeight: 600 }}>✨ Nueva planeación con MÍA</button>
        </div>}
        <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px' }}>Planeaciones del ciclo</p>
          {plannings.slice(0, 5).map((p, i) => (
            <div key={i} onClick={() => router.push(`/planeacion/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 6, background: p.status === 'active' ? '#EEEDF8' : '#F8F8FE', border: `1px solid ${p.status === 'active' ? '#3D3A8C22' : '#EEEDF8'}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: p.status === 'active' ? '#3D3A8C' : '#F0EFF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14 }}>{p.status === 'active' ? '▶' : '✓'}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name}</p>
                <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{campoCorto(p.pda_campo || '')} · {p.eje_articulador || 'sin eje'}</p>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, flexShrink: 0, background: p.status === 'active' ? '#3D3A8C' : '#E0F5F3', color: p.status === 'active' ? 'white' : '#0F6E56', fontWeight: 600 }}>{p.status === 'active' ? 'Activa' : 'Cerrada'}</span>
            </div>
          ))}
          {plannings.length > 5 && <button onClick={() => router.push('/mis-planeaciones')} style={{ fontSize: 12, color: '#3D3A8C', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0, fontWeight: 600 }}>Ver todas ({plannings.length}) →</button>}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}
