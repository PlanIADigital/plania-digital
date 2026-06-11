'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CLAVES_EXCLUIDAS = ['ajustes_razonables', 'rubrica', 'materiales']
const ORDEN_MOMENTOS: Record<string, string[]> = {
  proyectos: ['situacion_inicial', 'organizacion_de_las_acciones', 'a_trabajar', 'comunicamos_nuestros_logros', 'reflexion_sobre_el_aprendizaje'],
  abj: ['planteamiento_del_juego', 'desarrollo_de_las_actividades', 'compartimos_la_experiencia', 'comunidad_de_juego'],
  taller_critico: ['situacion_inicial', 'puesta_en_marcha', 'valoramos_lo_aprendido', 'reflexion'],
  rincones: ['asamblea_inicial_y_planeacion', 'exploracion_de_los_rincones', 'compartimos_lo_aprendido', 'reflexion_sobre_el_aprendizaje'],
  centros_de_interes: ['contacto_con_la_realidad', 'identificacion_e_integracion', 'expresion'],
  unidad_didactica: ['lectura_de_la_realidad', 'identificacion_de_la_trama_y_complejidad', 'planificacion_y_organizacion', 'exploracion_y_descubrimiento', 'participacion_activa_y_horizontal', 'valoracion_de_la_experiencia']
}

function formatearTituloMomento(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\w/g, l => l.toUpperCase())
    .replace(/^(\d+)\s/, '$1. ')
}

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
                {planeacion.grade}
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

          {planeacion.pda_contenido && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Contenido</p>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>{planeacion.pda_contenido}</p>
            </div>
          )}

          {planeacion.pda_literal && (
            <div style={{ background: '#EEEDF8', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>PDA principal</p>
              <p style={{ fontSize: 14, color: '#1A1A2E', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{planeacion.pda_literal}</p>
            </div>
          )}
        </div>

        {(() => {
          const claves = Object.keys(contenido).filter(k => !CLAVES_EXCLUIDAS.includes(k) && typeof contenido[k] === 'string')
          const modalidadDetectada = Object.keys(ORDEN_MOMENTOS).find(m => ORDEN_MOMENTOS[m].some(k => claves.includes(k))) || ''
          const ordenado = modalidadDetectada
            ? ORDEN_MOMENTOS[modalidadDetectada].filter(k => claves.includes(k))
            : claves
          return ordenado.map((key, index) => {
            const valor = contenido[key]
            return (
          <div key={key} style={{ background: 'white', borderRadius: 12, padding: 28, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h4 style={{ color: '#00A896', marginTop: 0, marginBottom: 14, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {index + 1}. {formatearTituloMomento(key)}
            </h4>
            <p style={{ fontSize: 14, lineHeight: 1.9, color: '#1A1A2E', margin: 0, whiteSpace: 'pre-wrap' }}>
              {valor as string}
            </p>
          </div>
            )
          })
        })()}

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

        {contenido.rubrica && (
          <div style={{ background: 'white', borderRadius: 12, padding: 28, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h4 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 6, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Rúbrica de evaluación
            </h4>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, fontStyle: 'italic' }}>
              {contenido.rubrica.indicador}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#3B6D11', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nivel 3 — Logrado</p>
                <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{contenido.rubrica.nivel_3}</p>
              </div>
              <div style={{ background: '#FFF8E7', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#854F0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nivel 2 — En proceso</p>
                <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{contenido.rubrica.nivel_2}</p>
              </div>
              <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nivel 1 — Inicio</p>
                <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{contenido.rubrica.nivel_1}</p>
              </div>
            </div>
            <div style={{ background: '#EEEDF8', borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#3D3A8C', lineHeight: 1.6 }}>
                <strong>Nota para evaluar:</strong> {contenido.rubrica.nota_evaluadora}
              </p>
            </div>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}