'use client'
// ============================================================
//  PlanIA Digital — components/SemaforoJardin.tsx
//  [2 oct 2026] Semáforo del jardín en el Dashboard del directivo:
//  momento, estado por grupo (con la educadora) y concentrado por área
//  (por grado y jardín). Solo cuenta grupos que ENVIARON. SOLO LECTURA.
// ============================================================
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { NIVELES, type Momento } from '@/lib/semaforo'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', cianOscuro: '#00806F',
  texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5', ambar: '#8A6D1D',
}
type Conteo = Record<string, number>
type Datos = {
  ciclo: string; momento: Momento; momentoSugerido: Momento
  momentos: Array<{ clave: Momento; nombre: string; cuando: string }>
  areas: string[]
  grupos: Array<{ grupo: string; docente: string; alumnos: number; estado: 'enviado' | 'en_captura' | 'sin_iniciar'; enviado_en: string | null; areasCompletas: number }>
  concentrado: Array<{ area: string; porGrado: Array<{ grado: string; conteo: Conteo }>; jardin: Conteo }>
  areasBloqueadas?: boolean
}

const card: React.CSSProperties = { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px', minWidth: 0 }
const h2: React.CSSProperties = { margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.texto, textTransform: 'uppercase', letterSpacing: '0.07em' }
const totalDe = (c: Conteo) => Object.values(c).reduce((s, n) => s + n, 0)
const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0)

function Barra({ conteo, etiqueta, fuerte }: { conteo: Conteo; etiqueta?: string; fuerte?: boolean }) {
  const t = totalDe(conteo)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: etiqueta ? '58px minmax(0,1fr)' : 'minmax(0,1fr)', gap: 10, alignItems: 'center' }}>
      {etiqueta && <span style={{ fontSize: 13.5, fontWeight: fuerte ? 800 : 700, color: C.texto }}>{etiqueta}</span>}
      <div>
        <div style={{ display: 'flex', gap: 2, height: fuerte ? 14 : 10 }}>
          {NIVELES.map(n => conteo[n.clave] > 0 ? (
            <div key={n.clave} title={`${n.nombre}: ${conteo[n.clave]} (${pct(conteo[n.clave], t)}%)`}
              style={{ flex: conteo[n.clave], background: n.texto, opacity: 0.8, borderRadius: 3 }} />
          ) : null)}
        </div>
        {fuerte && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.suave }}>
            {NIVELES.filter(n => conteo[n.clave] > 0).map(n => `${n.corto} ${pct(conteo[n.clave], t)}%`).join(' · ')} · {t} niños
          </p>
        )}
      </div>
    </div>
  )
}

export default function SemaforoJardin() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [borradorAreas, setBorradorAreas] = useState<string[]>([])
  const [guardandoAreas, setGuardandoAreas] = useState(false)
  const [msgAreas, setMsgAreas] = useState('')

  async function guardarAreas() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !datos) return
    setGuardandoAreas(true); setMsgAreas('')
    try {
      const res = await fetch('/api/directivo/semaforo/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ momento: datos.momento, areas: borradorAreas }),
      })
      const d = await res.json()
      if (!res.ok) { setMsgAreas(d?.error || 'No se pudo guardar.'); setGuardandoAreas(false); return }
      setEditando(false)
      await cargar(datos.momento)
      setMsgAreas('✓ Áreas guardadas. Tus educadoras ya las verán en su Semáforo.')
    } catch { setMsgAreas('No se pudo conectar con el servidor.') }
    setGuardandoAreas(false)
  }

  async function cargar(momento?: Momento) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await fetch(`/api/directivo/semaforo${momento ? `?momento=${momento}` : ''}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await res.json()
      if (!res.ok) setError(d?.error || 'No se pudo cargar el semáforo.')
      else { setDatos(d); setError('') }
    } catch { setError('No se pudo conectar con el servidor.') }
  }
  useEffect(() => { cargar() }, [])

  if (error) return <section style={card}><h2 style={h2}>Semáforo de avance</h2><p style={{ margin: 0, fontSize: 13.5, color: C.suave }}>{error}</p></section>
  if (!datos) return null

  const enviados = datos.grupos.filter(g => g.estado === 'enviado').length
  const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={h2}>Semáforo de avance</h2>
        <span style={{ fontSize: 13, color: C.suave }}>{enviados} de {datos.grupos.length} grupos enviados</span>
      </div>

      {/* Momentos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 14px' }}>
        {datos.momentos.map(m => {
          const activo = m.clave === datos.momento
          return (
            <button key={m.clave} onClick={() => cargar(m.clave)}
              style={{ minHeight: 40, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                background: activo ? C.indigo : 'white', color: activo ? 'white' : C.texto, border: `1px solid ${activo ? C.indigo : C.borde}` }}>
              {m.nombre}{m.clave === datos.momentoSugerido ? ' · ahora' : ''}
            </button>
          )
        })}
      </div>

      {/* Áreas del momento (las define la directora) */}
      <div style={{ marginBottom: 14, padding: '10px 12px', background: '#F7F7FC', borderRadius: 10 }}>
        {!editando ? (
          <>
            <p style={{ margin: 0, fontSize: 13.5, color: C.texto, lineHeight: 1.5 }}>
              <strong>Áreas que se evalúan:</strong> {datos.areas.join(' · ')}
            </p>
            {datos.areasBloqueadas ? (
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.suave }}>Las áreas de este momento ya están fijas porque hay capturas. Puedes cambiarlas en el siguiente momento.</p>
            ) : (
              <button onClick={() => { setBorradorAreas([...datos.areas]); setEditando(true); setMsgAreas('') }}
                style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, color: C.indigo, fontWeight: 700, fontSize: 13.5, textDecoration: 'underline', cursor: 'pointer', minHeight: 36, fontFamily: 'inherit' }}>
                Editar áreas
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700, color: C.texto }}>Áreas que se evaluarán en este momento</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {borradorAreas.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={a} maxLength={60} aria-label={`Área ${i + 1}`}
                    onChange={e => setBorradorAreas(b => b.map((x, j) => (j === i ? e.target.value : x)))}
                    style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${C.borde}`, fontSize: 16, fontFamily: 'inherit', color: C.texto }} />
                  <button onClick={() => setBorradorAreas(b => b.filter((_, j) => j !== i))} disabled={borradorAreas.length <= 1}
                    style={{ minHeight: 44, background: 'none', border: 'none', color: C.suave, fontSize: 13.5, textDecoration: 'underline', cursor: borradorAreas.length <= 1 ? 'default' : 'pointer', opacity: borradorAreas.length <= 1 ? 0.4 : 1, fontFamily: 'inherit' }}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            {borradorAreas.length < 6 && (
              <button onClick={() => setBorradorAreas(b => [...b, ''])}
                style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: C.indigo, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', minHeight: 36, fontFamily: 'inherit' }}>
                + Agregar área
              </button>
            )}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 10 }}>
              <button onClick={guardarAreas} disabled={guardandoAreas}
                style={{ minHeight: 44, padding: '0 20px', background: C.cianOscuro, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: guardandoAreas ? 0.7 : 1, fontFamily: 'inherit' }}>
                {guardandoAreas ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={() => { setEditando(false); setMsgAreas('') }} disabled={guardandoAreas}
                style={{ background: 'none', border: 'none', color: C.suave, fontSize: 13.5, textDecoration: 'underline', cursor: 'pointer', minHeight: 36, fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </>
        )}
        {msgAreas && <p role="status" style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: msgAreas.startsWith('✓') ? C.cianOscuro : '#8B3A3E' }}>{msgAreas}</p>}
      </div>

      {datos.grupos.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: C.suave }}>Aparecerá cuando las docentes configuren su grupo.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
          {/* Estado por grupo */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: C.texto }}>Estado por grupo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datos.grupos.map(g => (
                <div key={`${g.grupo}-${g.docente}`} style={{ padding: '10px 12px', background: '#F7F7FC', borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 14, color: C.texto }}>
                    <strong>{g.grupo}</strong> · {g.docente}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600,
                    color: g.estado === 'enviado' ? C.cianOscuro : g.estado === 'en_captura' ? C.ambar : C.suave }}>
                    {g.estado === 'enviado' ? `✓ Enviado el ${fecha(g.enviado_en!)}`
                      : g.estado === 'en_captura' ? `En captura (${g.areasCompletas} de ${datos.areas.length} áreas)`
                      : 'Sin iniciar'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Concentrado */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: C.texto }}>Concentrado del jardín</p>
            {enviados === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: C.suave, lineHeight: 1.5 }}>Se llenará conforme las educadoras envíen su semáforo de este momento.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 10, fontSize: 12 }}>
                  {NIVELES.map(n => (
                    <span key={n.clave} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.texto }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: n.texto, opacity: 0.8 }} />{n.nombre}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {datos.concentrado.map(a => (
                    <div key={a.area}>
                      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: C.texto }}>{a.area}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {a.porGrado.length > 1 && a.porGrado.map(g => <Barra key={g.grado} conteo={g.conteo} etiqueta={g.grado} />)}
                        <Barra conteo={a.jardin} etiqueta={a.porGrado.length > 1 ? 'Total' : undefined} fuerte />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
