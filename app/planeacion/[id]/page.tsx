'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const momentos = [
  { key: 'momento_1_punto_de_partida', titulo: '1. Punto de partida' },
  { key: 'momento_2_planeacion', titulo: '2. Planeación' },
  { key: 'momento_3_a_trabajar', titulo: '3. ¡A trabajar!' },
  { key: 'momento_4_comunicamos', titulo: '4. Comunicamos' },
  { key: 'momento_5_reflexion', titulo: '5. Reflexión' },
]

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
      const { data: userData } = await supabase
        .from('users').select('*')
        .eq('auth_uid', session.user.id).single()
      if (!userData) { router.push('/auth/login'); return }
      setProfile(userData)
      const { data, error: err } = await supabase
        .from('plannings')
        .select('*')
        .eq('id', params.id)
        .single()
      if (err || !data) { setError('No se encontró la planeación'); setLoading(false); return }
      setPlaneacion(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando planeación...</p>
    </div>
  )

  if (error || !profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#e53e3e' }}>{error || 'Error al cargar'}</p>
    </div>
  )

  const contenido = planeacion?.content_json || {}

  return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 32px' }}>

        <div style={{ background: 'white', borderRadius: 12, padding: 32, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <h2 style={{ color: '#3D3A8C', margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
              {planeacion.project_name}
            </h2>
            <span style={{
              background: planeacion.status === 'active' ? '#d1fae5' : '#EEEDF8',
              color: planeacion.status === 'active' ? '#065f46' : '#666',
              fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0
            }}>
              {planeacion.status === 'active' ? 'Activa' : planeacion.status}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {planeacion.pda_campo && (
              <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                {planeacion.pda_campo}
              </span>
            )}
            {planeacion.grade && (
              <span style={{ background: '#E0F5F3', color: '#00766B', fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                {planeacion.grade} grado
              </span>
            )}
            {planeacion.starts_on && (
              <span style={{ color: '#888', fontSize: 13 }}>
                {new Date(planeacion.starts_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                {planeacion.ends_on && ` → ${new Date(planeacion.ends_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`}
              </span>
            )}
          </div>

          {planeacion.situacion_problema && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Situación problema</p>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>{planeacion.situacion_problema}</p>
            </div>
          )}

          {planeacion.pda_literal && (
            <div style={{ background: '#EEEDF8', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>PDA principal</p>
              <p style={{ fontSize: 14, color: '#1A1A2E', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{planeacion.pda_literal}</p>
            </div>
          )}
        </div>

        {momentos.map(m => contenido[m.key] ? (
          <div key={m.key} style={{ background: 'white', borderRadius: 12, padding: 28, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h4 style={{ color: '#00A896', marginTop: 0, marginBottom: 14, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {m.titulo}
            </h4>
            <p style={{ fontSize: 14, lineHeight: 1.9, color: '#1A1A2E', margin: 0, whiteSpace: 'pre-wrap' }}>
              {contenido[m.key]}
            </p>
          </div>
        ) : null)}

        {contenido.ajustes_razonables && (
          <div style={{ background: '#FFF8E7', border: '1px solid #F6D860', borderRadius: 12, padding: 28, marginBottom: 16 }}>
            <h4 style={{ color: '#92400e', marginTop: 0, marginBottom: 14, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ajustes razonables
            </h4>
            <p style={{ fontSize: 14, lineHeight: 1.9, color: '#1A1A2E', margin: 0, whiteSpace: 'pre-wrap' }}>
              {contenido.ajustes_razonables}
            </p>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}