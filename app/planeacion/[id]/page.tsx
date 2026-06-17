'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function VerPlaneacionPage() {
  const router = useRouter()
  const params = useParams()
  const [profile, setProfile] = useState<any>(null)
  const [planeacion, setPlaneacion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: userData } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!userData) { router.push('/auth/login'); return }
      setProfile(userData)
      const { data, error: err } = await supabase.from('plannings').select('*').eq('id', params.id).single()
      if (err || !data) { setError('No se encontró la planeación'); setLoading(false); return }
      setPlaneacion(data)
      setLoading(false)
    }
    load()
  }, [params.id, router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8F5F2' }}>
      <p style={{ color: '#3D3A8C', fontSize: 14 }}>Cargando planeación...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#DC2626' }}>{error}</p>
    </div>
  )

  const content = planeacion?.content || {}
  const dias: any[] = content.dias || []
  const diasEspeciales: any[] = content.dias_especiales || []
  const rubrica = content.rubrica || null
  const ajustes = content.ajustes_razonables || ''

  // Mezclar días hábiles y especiales ordenados por fecha
  const todosLosDias = [
    ...dias.map((d: any) => ({ ...d, tipo: 'habil' })),
    ...diasEspeciales.map((d: any) => ({ ...d, tipo: d.tipo }))
  ].sort((a, b) => (a.fecha_iso || '').localeCompare(b.fecha_iso || ''))

  const s = {
    card: { background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 16, overflow: 'hidden' as const, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
    cardHeader: { padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0 },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    tdLabel: { padding: '10px 16px', fontWeight: 600, color: '#374151', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', width: 140, verticalAlign: 'top' as const },
    tdValue: { padding: '10px 16px', color: '#1A1A2E', borderTop: '1px solid #E5E7EB', lineHeight: 1.7, verticalAlign: 'top' as const },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', display: 'flex' }}>
      {profile && <Sidebar profile={profile} />}
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>

        {/* Encabezado */}
        <div style={{ marginBottom: 32 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#3D3A8C', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>← Volver</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>{planeacion.project_name}</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            {planeacion.metodologia} · {planeacion.starts_on} al {planeacion.ends_on} · {dias.length} días hábiles
          </p>
        </div>

        {/* Datos del proyecto */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <p style={s.sectionTitle}>Datos del proyecto</p>
          </div>
          <table style={s.table}>
            <tbody>
              <tr><td style={s.tdLabel}>Campo formativo</td><td style={s.tdValue}>{planeacion.pda_campo}</td></tr>
              <tr><td style={s.tdLabel}>PDA principal</td><td style={s.tdValue}>{planeacion.pda_literal}</td></tr>
              {planeacion.eje_principal && <tr><td style={s.tdLabel}>Eje principal</td><td style={s.tdValue}>{planeacion.eje_principal}</td></tr>}
              {planeacion.situacion_problema && <tr><td style={s.tdLabel}>Situación problema</td><td style={s.tdValue}>{planeacion.situacion_problema}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Secuencia por días */}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: '24px 0 16px' }}>Secuencia didáctica por días</h2>

        {todosLosDias.map((dia: any, idx: number) => {
          // Día CTE o inhábil
          if (dia.tipo !== 'habil') {
            return (
              <div key={idx} style={{ ...s.card, background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{dia.tipo === 'CTE' ? '📋' : '🚫'}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#92400E' }}>{dia.fecha}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>{dia.tipo === 'CTE' ? 'Consejo Técnico Escolar' : dia.tipo} — No se generan actividades pedagógicas en este día.</p>
                  </div>
                </div>
              </div>
            )
          }

          // Día hábil
          return (
            <div key={idx} style={s.card}>
              <div style={{ ...s.cardHeader, background: '#3D3A8C' }}>
                <p style={{ ...s.sectionTitle, color: 'white' }}>
                  Día {dia.numero} — {dia.fecha}
                </p>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                  {dia.momento_modalidad}
                </span>
              </div>
              <table style={s.table}>
                <tbody>
                  <tr>
                    <td style={s.tdLabel}>Inicio</td>
                    <td style={{ ...s.tdValue, whiteSpace: 'pre-wrap' as const }}>{dia.inicio}</td>
                  </tr>
                  <tr>
                    <td style={s.tdLabel}>Desarrollo</td>
                    <td style={{ ...s.tdValue, whiteSpace: 'pre-wrap' as const }}>{dia.desarrollo}</td>
                  </tr>
                  <tr>
                    <td style={s.tdLabel}>Cierre</td>
                    <td style={{ ...s.tdValue, whiteSpace: 'pre-wrap' as const }}>{dia.cierre}</td>
                  </tr>
                  {dia.materiales && (
                    <tr>
                      <td style={s.tdLabel}>Materiales</td>
                      <td style={s.tdValue}>{dia.materiales}</td>
                    </tr>
                  )}
                  {dia.actividad_complementaria && (
                    <tr>
                      <td style={s.tdLabel}>Act. complementaria</td>
                      <td style={s.tdValue}>{dia.actividad_complementaria}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        })}

        {/* Rúbrica */}
        {rubrica && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: '32px 0 16px' }}>Rúbrica de evaluación</h2>
            <div style={s.card}>
              <div style={s.cardHeader}>
                <p style={s.sectionTitle}>Campo: {rubrica.campo}</p>
              </div>
              <table style={s.table}>
                <tbody>
                  <tr><td style={s.tdLabel}>PDA</td><td style={s.tdValue}>{rubrica.pda}</td></tr>
                  <tr><td style={s.tdLabel}>Indicador</td><td style={s.tdValue}>{rubrica.indicador}</td></tr>
                  <tr><td style={{ ...s.tdLabel, color: '#065F46', background: '#ECFDF5' }}>Nivel 3</td><td style={{ ...s.tdValue, background: '#ECFDF5' }}>{rubrica.nivel_3}</td></tr>
                  <tr><td style={{ ...s.tdLabel, color: '#92400E', background: '#FFFBEB' }}>Nivel 2</td><td style={{ ...s.tdValue, background: '#FFFBEB' }}>{rubrica.nivel_2}</td></tr>
                  <tr><td style={{ ...s.tdLabel, color: '#DC2626', background: '#FEF2F2' }}>Nivel 1</td><td style={{ ...s.tdValue, background: '#FEF2F2' }}>{rubrica.nivel_1}</td></tr>
                  {rubrica.nota_evaluadora && <tr><td style={s.tdLabel}>Nota</td><td style={{ ...s.tdValue, fontStyle: 'italic' as const }}>{rubrica.nota_evaluadora}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Ajustes razonables */}
        {ajustes && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: '32px 0 16px' }}>Ajustes razonables</h2>
            <div style={{ ...s.card, padding: '16px 20px' }}>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' as const }}>{ajustes}</p>
            </div>
          </>
        )}

      </main>
    </div>
  )
}
