'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import SidebarDirectivo from '@/components/SidebarDirectivo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CAMPOS_CONFIG = [
  { nombre: 'Lenguajes', color: '#3D3A8C', bg: '#EEEDF8', total: 86 },
  { nombre: 'Saberes y Pensamiento Científico', color: '#00A896', bg: '#E0F5F3', total: 130 },
  { nombre: 'Ética, Naturaleza y Sociedades', color: '#059669', bg: '#D1FAE5', total: 70 },
  { nombre: 'De lo Humano y lo Comunitario', color: '#7C3AED', bg: '#EDE9FE', total: 85 },
]

const EJES = [
  'Interculturalidad crítica','Igualdad de género','Inclusión',
  'Pensamiento crítico','Apropiación de las culturas a través de la lectura y la escritura',
  'Artes y experiencias estéticas','Vida saludable',
]

function campoCorto(nombre: string): string {
  const mapa: Record<string,string> = {
    'Saberes y Pensamiento Científico': 'Saberes...',
    'Ética, Naturaleza y Sociedades': 'Ética...',
    'De lo Humano y lo Comunitario': 'Lo Humano...',
  }
  return mapa[nombre] || nombre
}

const rolLabel: Record<string,string> = {
  educadora: 'Educadora', educador: 'Educador',
  maestra_musica: 'Maestra de música', maestro_musica: 'Maestro de música',
}

export default function DocenteDetallePage() {
  const router = useRouter()
  const params = useParams()
  const docenteId = params?.id as string

  const [profile, setProfile] = useState<any>(null)
  const [docente, setDocente] = useState<any>(null)
  const [plannings, setPlannings] = useState<any[]>([])
  const [coverage, setCoverage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tabActivo, setTabActivo] = useState<'campos'|'ejes'|'nee'>('campos')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed || user.role !== 'directivo') { router.push('/dashboard'); return }
      setProfile(user)

      const { data: doc } = await supabase.from('users').select('*').eq('id', docenteId).single()
      if (!doc || doc.cct_primary !== user.cct_primary) { router.push('/directivo/dashboard'); return }
      setDocente(doc)

      const { data: plans } = await supabase
        .from('plannings')
        .select('id, project_name, pda_campo, pda_contenido, eje_principal, eje_secundario, status, starts_on, ends_on, created_at')
        .eq('user_id', docenteId)
        .order('created_at', { ascending: false })
      setPlannings(plans || [])

      const { data: cov } = await supabase
        .from('pda_coverage')
        .select('campo, pda_literal, is_primary, covered_on, times_used')
        .eq('user_id', docenteId)
      setCoverage(cov || [])

      setLoading(false)
    }
    load()
  }, [docenteId])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const pdaUnicosPorCampo = CAMPOS_CONFIG.map(cf => {
    const unicos = [...new Set(coverage.filter(c => c.campo === cf.nombre).map(c => c.pda_literal))]
    return { ...cf, trabajados: unicos.length, porcentaje: Math.round((unicos.length / cf.total) * 100) }
  })

  const ejesConteo: Record<string,number> = {}
  plannings.forEach(p => {
    if (p.eje_principal) ejesConteo[p.eje_principal] = (ejesConteo[p.eje_principal] || 0) + 1
    if (p.eje_secundario) ejesConteo[p.eje_secundario] = (ejesConteo[p.eje_secundario] || 0) + 1
  })
  const maxEje = Math.max(1, ...Object.values(ejesConteo))

  const alumnosConNEE = Array.isArray(docente?.evaluacion_individual?.alumnos)
    ? docente.evaluacion_individual.alumnos.filter((a: any) => a.nee?.length > 0)
    : []

  const totalPDAs = [...new Set(coverage.map(c => c.pda_literal))].length

  return (
    <SidebarDirectivo profile={profile}>
      <div style={{ padding: '32px 40px 60px' }}>

        {/* Volver */}
        <button onClick={() => router.push('/directivo/dashboard')}
          style={{ background: 'none', border: 'none', color: '#3D3A8C', fontSize: 13, cursor: 'pointer', padding: '0 0 16px', fontWeight: 600 }}>
          ← Volver al panel
        </button>

        {/* Header docente */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EEEDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#3D3A8C', flexShrink: 0 }}>
              {docente.full_name?.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>{docente.full_name}</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                {rolLabel[docente.role] || docente.role} · {docente.grado || '—'} grado · {docente.total_students || '—'} alumnos · CCT {docente.cct_primary}
              </p>
            </div>
          </div>

          {/* KPIs docente */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: '#F8F8FE', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>PDAs trabajados</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#3D3A8C', margin: 0 }}>{totalPDAs}</p>
            </div>
            <div style={{ background: '#F8F8FE', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>Planeaciones</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#3D3A8C', margin: 0 }}>{plannings.length}</p>
            </div>
            <div style={{ background: '#F8F8FE', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>Alumnos con NEE</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: alumnosConNEE.length > 0 ? '#92400E' : '#3D3A8C', margin: 0 }}>{alumnosConNEE.length}</p>
            </div>
          </div>
        </div>

        {/* Tabs análisis */}
        <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #F0EFF8' }}>
            {(['campos','ejes','nee'] as const).map((key, idx) => {
              const labels = ['📊 Campos','🔗 Ejes','♿ NEE']
              return <button key={key} onClick={() => setTabActivo(key)}
                style={{ flex: 1, padding: '12px 6px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tabActivo === key ? 700 : 400, background: tabActivo === key ? '#EEEDF8' : 'white', color: tabActivo === key ? '#3D3A8C' : '#888', borderBottom: tabActivo === key ? '2px solid #3D3A8C' : '2px solid transparent' }}>
                {labels[idx]}
              </button>
            })}
          </div>
          <div style={{ padding: '20px 24px' }}>
            {tabActivo === 'campos' && (
              <div>
                {pdaUnicosPorCampo.map(cf => (
                  <div key={cf.nombre} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{campoCorto(cf.nombre)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cf.color }}>{cf.trabajados}/{cf.total} PDAs</span>
                    </div>
                    <div style={{ background: '#F0EFF8', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                      <div style={{ background: cf.color, height: '100%', borderRadius: 99, width: `${cf.porcentaje}%`, transition: 'width 0.8s ease' }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>{cf.porcentaje}% del ciclo</p>
                  </div>
                ))}
              </div>
            )}
            {tabActivo === 'ejes' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {EJES.map(eje => {
                  const count = ejesConteo[eje] || 0
                  return (
                    <div key={eje} style={{ padding: '10px 12px', borderRadius: 10, background: count === 0 ? '#FFF7ED' : '#F8F8FE', border: `1px solid ${count === 0 ? '#FDE68A' : '#EEEDF8'}` }}>
                      <p style={{ fontSize: 11, color: count === 0 ? '#92400E' : '#888', margin: '0 0 6px', lineHeight: 1.4 }}>{eje.length > 40 ? eje.substring(0,40)+'…' : eje}</p>
                      <p style={{ fontSize: 12, fontWeight: 700, color: count === 0 ? '#92400E' : '#3D3A8C', margin: 0 }}>
                        {count === 0 ? '⚠️ Sin abordar' : `${count} planeación${count > 1 ? 'es' : ''}`}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
            {tabActivo === 'nee' && (
              <div>
                {alumnosConNEE.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: '20px 0' }}>Sin NEE registradas en el diagnóstico individual.</p>
                ) : alumnosConNEE.map((alumno: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#F8F8FE', borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EEEDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#3D3A8C', flexShrink: 0 }}>
                      {String(alumno.referencia || i+1).replace('Alumno ','')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        {alumno.nee?.map((n: string, j: number) => (
                          <span key={j} style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>{n}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: '#444', margin: 0, lineHeight: 1.5 }}>{alumno.observaciones}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Planeaciones */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 16px' }}>
            Planeaciones del ciclo ({plannings.length})
          </p>
          {plannings.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: '20px 0' }}>Sin planeaciones registradas aún.</p>
          ) : plannings.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: p.status === 'active' ? '#EEEDF8' : '#F8F8FE', border: `1px solid ${p.status === 'active' ? '#3D3A8C22' : '#EEEDF8'}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name}</p>
                <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
                  {p.pda_campo} {p.eje_principal && `· ${p.eje_principal}`}
                  {p.starts_on && ` · ${new Date(p.starts_on+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}`}
                </p>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: p.status === 'active' ? '#3D3A8C' : '#E0F5F3', color: p.status === 'active' ? 'white' : '#0F6E56', fontWeight: 600, flexShrink: 0 }}>
                {p.status === 'active' ? 'Activa' : 'Cerrada'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarDirectivo>
  )
}
