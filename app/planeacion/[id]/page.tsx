'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// [jul 2026] Mismo prefijo de 3 letras usado en Mi Avance — para poder
// mostrar el código real (LEN-1, SPC-14, etc.) de cada PDA en esta
// vista, no solo su texto literal.
const PREFIJO_POR_CAMPO: Record<string, string> = {
  'Lenguajes': 'LEN',
  'Saberes y Pensamiento Científico': 'SPC',
  'Ética, Naturaleza y Sociedades': 'ENS',
  'De lo Humano y lo Comunitario': 'DHC',
}

export default function VerPlaneacionPage() {
  const router = useRouter()
  const params = useParams()
  const [profile, setProfile] = useState<any>(null)
  const [planeacion, setPlaneacion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // [jul 2026] Mapa id de pda_catalog -> posicion_campo, para los
  // hasta 4 PDAs de esta planeación (principal + 3 transversales).
  // Se usa junto con PREFIJO_POR_CAMPO para construir el código real
  // (LEN-1, SPC-14...). Si un registro es anterior a esta migración
  // y no tiene *_id guardado, simplemente no habrá código para ese
  // PDA — se sigue mostrando solo el texto literal, sin romper nada.
  const [posicionesPorId, setPosicionesPorId] = useState<Record<string, number>>({})

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

      const idsPDA: string[] = [data.pda_id, data.transversal_1_id, data.transversal_2_id, data.transversal_3_id]
        .filter((id): id is string => !!id)
      if (idsPDA.length > 0) {
        const { data: catalogo } = await supabase
          .from('pda_catalog')
          .select('id, posicion_campo')
          .in('id', idsPDA)
        const mapa: Record<string, number> = {}
        ;(catalogo || []).forEach((r: any) => { mapa[r.id] = r.posicion_campo })
        setPosicionesPorId(mapa)
      }

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

  const content = planeacion?.content_json || planeacion?.content || {}
  const dias: any[] = content.dias || []
  const diasEspeciales: any[] = content.dias_especiales || []
  const rubrica = content.rubrica || null

  // [jul 2026] Construye el código real (LEN-1, SPC-14...) para un PDA
  // dado su campo formativo y su id de pda_catalog. Regresa null si
  // falta cualquier pieza (id no guardado, campo sin prefijo
  // conocido, etc.) — en ese caso el llamador simplemente muestra el
  // texto literal sin código, sin romper la vista.
  function codigoPDA(campo: string | null, id: string | null): string | null {
    if (!campo || !id) return null
    const prefijo = PREFIJO_POR_CAMPO[campo]
    const posicion = posicionesPorId[id]
    if (!prefijo || posicion == null) return null
    return `${prefijo}-${posicion}`
  }

  // [jul 2026] Campos formativos involucrados: el principal siempre
  // primero, luego cada campo de un transversal ACTIVO que no se haya
  // listado ya (evita duplicar si un transversal comparte el mismo
  // campo que el principal).
  const camposFormativos: string[] = []
  if (planeacion.pda_campo) camposFormativos.push(planeacion.pda_campo)
  ;[1, 2, 3].forEach(n => {
    const activo = planeacion[`transversal_${n}_activo`]
    const campo = planeacion[`transversal_${n}_campo`]
    if (activo && campo && !camposFormativos.includes(campo)) camposFormativos.push(campo)
  })

  // [jul 2026] Segmentos de PDA a mostrar: principal primero (con su
  // código si está disponible), luego cada transversal activo en su
  // propia línea, separados por salto — para que quede claro que el
  // proyecto está vinculado a varios PDAs, no solo al principal.
  const segmentosPDA: { codigo: string | null; texto: string }[] = []
  if (planeacion.pda_literal) {
    segmentosPDA.push({ codigo: codigoPDA(planeacion.pda_campo, planeacion.pda_id), texto: planeacion.pda_literal })
  }
  ;[1, 2, 3].forEach(n => {
    const activo = planeacion[`transversal_${n}_activo`]
    const pdaTexto = planeacion[`transversal_${n}_pda`]
    if (activo && pdaTexto) {
      segmentosPDA.push({
        codigo: codigoPDA(planeacion[`transversal_${n}_campo`], planeacion[`transversal_${n}_id`]),
        texto: pdaTexto,
      })
    }
  })

  // Ajustes por día (formato nuevo, jul 2026). Puede haber VARIAS
  // entradas con el mismo número de día (una por cada alumno) — se
  // ACUMULAN en una lista, nunca se sobrescriben entre sí.
  const ajustesPorDia: { numero: number; codigo?: string; ajuste: string }[] = content.ajustes_por_dia || []
  const ajustesPorNumero = new Map<number, string[]>()
  ajustesPorDia.forEach((a) => {
    if (a?.numero == null || !a?.ajuste) return
    const lista = ajustesPorNumero.get(a.numero) || []
    lista.push(a.ajuste)
    ajustesPorNumero.set(a.numero, lista)
  })

  // Respaldo SOLO para planeaciones antiguas generadas antes de este
  // cambio, que guardaron un único bloque de texto al final en vez de
  // ajustes por día. Nunca se muestra si ya existe el formato nuevo.
  const ajustesLegacyTexto: string = content.ajustes_razonables || ''
  const hayAjustesPorDia = ajustesPorDia.length > 0

  // Mezclar días hábiles y especiales ordenados por fecha
  const todosLosDias = [
    ...dias.map((d: any) => ({ ...d, tipo: 'habil' })),
    ...diasEspeciales.map((d: any) => ({ ...d, tipo: d.tipo }))
  ].sort((a, b) => (a.fecha_iso || '').localeCompare(b.fecha_iso || ''))

  // Agrupar días NO hábiles consecutivos (sin ningún día hábil entre medio) en un solo bloque
  type Bloque =
    | { esHabil: true; dia: any }
    | { esHabil: false; grupo: any[] }

  const bloques: Bloque[] = []
  {
    let i = 0
    while (i < todosLosDias.length) {
      const dia = todosLosDias[i]
      if (dia.tipo === 'habil') {
        bloques.push({ esHabil: true, dia })
        i++
      } else {
        const grupo = [dia]
        let j = i + 1
        while (j < todosLosDias.length && todosLosDias[j].tipo !== 'habil') {
          grupo.push(todosLosDias[j])
          j++
        }
        bloques.push({ esHabil: false, grupo })
        i = j
      }
    }
  }

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
      {profile && <Sidebar profile={profile}>
      <main style={{ flex: 1, padding: '32px 40px',  }}>

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
              <tr>
                <td style={s.tdLabel}>Campo formativo{camposFormativos.length > 1 ? ' y transversales' : ''}</td>
                <td style={s.tdValue}>{camposFormativos.join(' - ')}</td>
              </tr>
              <tr>
                <td style={s.tdLabel}>PDA principal{segmentosPDA.length > 1 ? ' y transversales' : ''}</td>
                <td style={s.tdValue}>
                  {segmentosPDA.map((seg, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0' }}>
                      {seg.codigo && <strong>{seg.codigo} — </strong>}{seg.texto}
                    </p>
                  ))}
                </td>
              </tr>
              {planeacion.eje_principal && <tr><td style={s.tdLabel}>Eje principal</td><td style={s.tdValue}>{planeacion.eje_principal}</td></tr>}
              {planeacion.eje_secundario && <tr><td style={s.tdLabel}>Eje secundario</td><td style={s.tdValue}>{planeacion.eje_secundario}</td></tr>}
              {planeacion.situacion_problema && <tr><td style={s.tdLabel}>Situación problema</td><td style={s.tdValue}>{planeacion.situacion_problema}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Secuencia por días */}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: '24px 0 16px' }}>Secuencia didáctica por días</h2>

        {bloques.map((bloque, idx) => {
          // Bloque de día(s) NO hábil(es) — posiblemente agrupados
          if (!bloque.esHabil) {
            const grupo = bloque.grupo
            const esRango = grupo.length > 1
            const etiquetaFecha = esRango
              ? `${grupo[0].fecha} al ${grupo[grupo.length - 1].fecha}`
              : grupo[0].fecha
            const tiposUnicos = Array.from(
              new Set(grupo.map((d: any) => (d.tipo === 'CTE' ? 'Consejo Técnico Escolar' : (d.motivo || d.tipo || 'Inhábil'))))
            )
            const tieneCTE = grupo.some((d: any) => d.tipo === 'CTE')

            return (
              <div key={idx} style={{ ...s.card, background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{tieneCTE ? '📋' : '🚫'}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#92400E' }}>{etiquetaFecha}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>
                      {tiposUnicos.join(' / ')} — No se generan actividades pedagógicas en {esRango ? 'estos días' : 'este día'}.
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          // Día hábil
          const dia = bloque.dia
          const ajustesDeEsteDia = ajustesPorNumero.get(dia.numero) || []
          return (
            <div key={idx} style={s.card}>
              <div style={{ ...s.cardHeader, background: '#3D3A8C' }}>
                <p style={{ ...s.sectionTitle, color: 'white' }}>
                  Día {dia.numero} — {dia.fecha}
                </p>
                <span style={{
                  fontSize: 13,
                  color: '#3D3A8C',
                  fontWeight: 800,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                  background: '#FFFFFF',
                  padding: '5px 12px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap' as const,
                }}>
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
                  {ajustesDeEsteDia.length > 0 && (
                    <tr>
                      <td style={{ ...s.tdLabel, color: '#7C3AED', background: '#F5F3FF' }}>
                        Ajuste{ajustesDeEsteDia.length > 1 ? 's' : ''} razonable{ajustesDeEsteDia.length > 1 ? 's' : ''}
                      </td>
                      <td style={{ ...s.tdValue, background: '#F5F3FF' }}>
                        {ajustesDeEsteDia.map((texto, i) => (
                          <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0', whiteSpace: 'pre-wrap' as const }}>{texto}</p>
                        ))}
                      </td>
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
                  <tr><td style={{ ...s.tdLabel, color: '#065F46', background: '#ECFDF5' }}>LOGRADO</td><td style={{ ...s.tdValue, background: '#ECFDF5' }}>{rubrica.nivel_3}</td></tr>
                  <tr><td style={{ ...s.tdLabel, color: '#92400E', background: '#FFFBEB' }}>EN PROCESO</td><td style={{ ...s.tdValue, background: '#FFFBEB' }}>{rubrica.nivel_2}</td></tr>
                  <tr><td style={{ ...s.tdLabel, color: '#DC2626', background: '#FEF2F2' }}>REQUIERE APOYO</td><td style={{ ...s.tdValue, background: '#FEF2F2' }}>{rubrica.nivel_1}</td></tr>
                  {rubrica.nota_evaluadora && <tr><td style={s.tdLabel}>Nota</td><td style={{ ...s.tdValue, fontStyle: 'italic' as const }}>{rubrica.nota_evaluadora}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Ajustes razonables — RESPALDO solo para planeaciones antiguas
            (antes de jul 2026) que aún guardan el bloque único al final.
            Si ya existe el formato nuevo por día, esta sección no se
            muestra para evitar duplicar la información. */}
        {!hayAjustesPorDia && ajustesLegacyTexto && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: '32px 0 16px' }}>Ajustes razonables</h2>
            <div style={{ ...s.card, padding: '16px 20px' }}>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' as const }}>{ajustesLegacyTexto}</p>
            </div>
          </>
        )}

      </main>
      </Sidebar>}
    </div>
  )
}