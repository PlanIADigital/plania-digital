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

        {/* ── ENCABEZADO COMPLETO ── */}
        <div style={{ background: 'white', borderRadius: 12, padding: '28px 28px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>

          <h2 style={{ color: '#3D3A8C', margin: '0 0 4px', fontSize: 24, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>
            {planeacion.project_name}
          </h2>

          <p style={{ fontSize: 12, color: '#888', textAlign: 'center', margin: '0 0 16px' }}>
            {profile.school_name && <>{profile.school_name.replace(/^Jardín de Niños\s*/i, '').replace(/^Jardin de Niños\s*/i, '').trim()} · </>}
            CCT {profile.cct_primary} · {planeacion.grade} grado · Turno {profile.shift_primary}
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
            {planeacion.pda_campo && (
              <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                📚 {planeacion.pda_campo}
              </span>
            )}
            {(() => {
              const modalidad = Object.keys(ORDEN_MOMENTOS).find(m =>
                ORDEN_MOMENTOS[m].some(k => Object.keys(contenido).includes(k))
              )
              const labels: Record<string, string> = {
                proyectos: 'Proyectos', abj: 'ABJ', taller_critico: 'Taller Crítico',
                rincones: 'Rincones', centros_de_interes: 'Centros de Interés', unidad_didactica: 'Unidad Didáctica'
              }
              return modalidad ? (
                <span style={{ background: '#E0F5F3', color: '#00766B', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                  🎯 {labels[modalidad] || modalidad}
                </span>
              ) : null
            })()}
            {planeacion.grade && (
              <span style={{ background: '#F4F3FB', color: '#3D3A8C', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
                👥 {planeacion.grade} grado · {profile.total_alumnos || profile.total_students || 24} alumnos
              </span>
            )}
            {planeacion.starts_on && (
              <span style={{ background: '#F4F3FB', color: '#666', fontSize: 12, padding: '4px 12px', borderRadius: 20 }}>
                📅 {new Date(planeacion.starts_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                {planeacion.ends_on && ` → ${new Date(planeacion.ends_on + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
              </span>
            )}
            <span style={{ background: planeacion.status === 'active' ? '#d1fae5' : '#EEEDF8', color: planeacion.status === 'active' ? '#065f46' : '#666', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
              {planeacion.status === 'active' ? '✓ Activa' : planeacion.status}
            </span>
          </div>

          {(planeacion.eje_principal || planeacion.eje_secundario) && (
            <div style={{ background: '#F4F3FB', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {planeacion.eje_principal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Eje principal:</span>
                  <span style={{ fontSize: 12, color: '#3D3A8C', fontWeight: 600, background: '#EEEDF8', padding: '2px 10px', borderRadius: 20 }}>{planeacion.eje_principal}</span>
                </div>
              )}
              {planeacion.eje_secundario && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Eje secundario:</span>
                  <span style={{ fontSize: 12, color: '#555', fontWeight: 500, background: 'white', border: '1px solid #D8D6F0', padding: '2px 10px', borderRadius: 20 }}>{planeacion.eje_secundario}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ height: 1, background: '#EEEDF8', margin: '0 0 16px' }} />

          {planeacion.situacion_problema && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Situación problema</p>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>{planeacion.situacion_problema}</p>
            </div>
          )}

          {planeacion.finalidad && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Finalidad</p>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>{planeacion.finalidad}</p>
            </div>
          )}

          {planeacion.pda_literal && (
            <div style={{ background: '#EEEDF8', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>Contenido principal</p>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 10px', textAlign: 'center' }}>{planeacion.pda_contenido}</p>
              <div style={{ height: 1, background: '#D8D6F0', margin: '0 0 10px' }} />
              {planeacion.pda_literal.split(' | ').map((pda: string, idx: number) => (
                <div key={idx} style={{ marginBottom: idx < planeacion.pda_literal.split(' | ').length - 1 ? 10 : 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px', textAlign: 'center' }}>
                    {idx === 0 ? 'PDA Principal' : `PDA Secundario ${idx}`}
                  </p>
                  <p style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.7, margin: 0, fontStyle: 'italic', textAlign: 'center' }}>{pda.trim()}</p>
                  {idx < planeacion.pda_literal.split(' | ').length - 1 && (
                    <div style={{ height: 1, background: '#E0DFF5', margin: '8px 0' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {(planeacion.transversal_1_campo || planeacion.transversal_2_campo || planeacion.transversal_3_campo) && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Campos formativos transversales</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {[
                  { campo: planeacion.transversal_1_campo, contenido: planeacion.transversal_1_contenido, pda: planeacion.transversal_1_pda },
                  { campo: planeacion.transversal_2_campo, contenido: planeacion.transversal_2_contenido, pda: planeacion.transversal_2_pda },
                  { campo: planeacion.transversal_3_campo, contenido: planeacion.transversal_3_contenido, pda: planeacion.transversal_3_pda },
                ].filter(t => t.campo).map((t, i) => (
                  <div key={i} style={{ background: '#F8F8FE', border: '1px solid #E0DFF5', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{t.campo}</p>
                    {t.contenido && <p style={{ margin: '0 0 6px', fontSize: 13, color: '#555', lineHeight: 1.5, textAlign: 'center' }}>{t.contenido}</p>}
                    {t.pda && <><div style={{ height: 1, background: '#E0DFF5', margin: '6px 0' }} /><p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>PDA</p><p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.5, fontStyle: 'italic', textAlign: 'center' }}>{t.pda}</p></>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #EEEDF8', paddingTop: 10, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 10, color: '#C4C2E8', textAlign: 'center' }}>
              ✦ Programa de Preescolar 2022 · NEM · PlanIA Digital no es una entidad afiliada ni respaldada por la SEP
            </p>
          </div>
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
            <p style={{ fontSize: 14, lineHeight: 1.9, color: '#1A1A2E', margin: 0 }}>
              {(valor as string).split(/(?=Día \d+ —)/g).map((bloque, bi) => (
                <span key={bi}>
                  {bi > 0 && <><br/><br/></>}
                  {bloque}
                </span>
              ))}
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

        {/* Función helper para renderizar rúbrica con lista de cotejo */}
        {[
          contenido.rubrica,
          contenido.rubrica_transversal_1,
          contenido.rubrica_transversal_2,
          contenido.rubrica_transversal_3,
        ].filter(Boolean).map((rubrica: any, idx: number) => (
          <div key={idx} style={{ background: 'white', borderRadius: 12, padding: 28, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h4 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 6, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Rúbrica de evaluación
            </h4>
            {rubrica.campo && (
              <p style={{ fontSize: 12, color: '#3D3A8C', fontWeight: 600, margin: '0 0 2px' }}>
                Campo Formativo: {rubrica.campo}
              </p>
            )}
            {rubrica.contenido && (
              <p style={{ fontSize: 12, color: '#555', margin: '0 0 2px' }}>
                Contenido: {rubrica.contenido}
              </p>
            )}
            {rubrica.pda && (
              <p style={{ fontSize: 12, color: '#555', margin: '0 0 12px', fontStyle: 'italic' }}>
                PDA: {rubrica.pda}
              </p>
            )}
            {rubrica.indicador && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Indicador de evaluación</p>
                <p style={{ fontSize: 13, color: '#666', margin: 0, fontStyle: 'italic' }}>{rubrica.indicador}</p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#3B6D11', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Nivel 3 — Logrado</p>
                <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6, textAlign: 'center' }}>{rubrica.nivel_3}</p>
              </div>
              <div style={{ background: '#FFF8E7', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#854F0B', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Nivel 2 — En proceso</p>
                <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6, textAlign: 'center' }}>{rubrica.nivel_2}</p>
              </div>
              <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Nivel 1 — Requiere Apoyo</p>
                <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6, textAlign: 'center' }}>{rubrica.nivel_1}</p>
              </div>
            </div>
            <div style={{ background: '#EEEDF8', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#3D3A8C', lineHeight: 1.6 }}>
                <strong>Nota para evaluar:</strong> {rubrica.nota_evaluadora}
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#3D3A8C' }}>
                    <th style={{ color: 'white', padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 40, border: '1px solid #2D2A6E' }}>N°</th>
                    <th style={{ color: 'white', padding: '8px 10px', textAlign: 'left', fontWeight: 700, border: '1px solid #2D2A6E' }}>Nombre del Alumno</th>
                    <th style={{ color: 'white', padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 90, border: '1px solid #2D2A6E' }}>Logrado</th>
                    <th style={{ color: 'white', padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 90, border: '1px solid #2D2A6E' }}>En Proceso</th>
                    <th style={{ color: 'white', padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 110, border: '1px solid #2D2A6E' }}>Requiere Apoyo</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: profile?.total_alumnos || profile?.total_students || 24 }).map((_, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#F8F8FE' }}>
                      <td style={{ padding: '7px 10px', textAlign: 'center', border: '1px solid #E0DFF5', color: '#888', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '7px 10px', border: '1px solid #E0DFF5' }}></td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', border: '1px solid #E0DFF5' }}></td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', border: '1px solid #E0DFF5' }}></td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', border: '1px solid #E0DFF5' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}