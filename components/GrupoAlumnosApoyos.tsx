'use client'
// ============================================================
//  PlanIA Digital — components/GrupoAlumnosApoyos.tsx
//
//  [Saneado 27 sep 2026 — Fase 1, NEE y ajustes razonables]
//  Flujo "MÍA sugiere, la educadora confirma" (criterio del fundador):
//    1) Sugerencias de MÍA: niños de la evaluación individual con
//       barreras observadas y sin revisar. La educadora edita el texto
//       de apoyos, ELIGE a qué código AL-XX corresponde (se propone el
//       de la misma posición: "Alumno 2" → AL-02) y confirma o descarta.
//    2) Tu grupo: códigos AL-XX del ciclo activo. Marcas "(alta …)" y
//       "(baja)". Agregar, editar o quitar apoyos; dar de alta y de baja.
//  Solo los apoyos CONFIRMADOS llegan a las planeaciones (ajustes
//  razonables). Enfoque BAP: barreras y apoyos observables, sin
//  diagnósticos ni nombres.
//  Datos: /api/alumnos-codigo (+ /baja). No guarda nada en el navegador.
// ============================================================
import { useEffect, useState } from 'react'
import { fetchConSesion } from '@/lib/fetchConSesion'

// Número de sugerencias de MÍA sin revisar (para el aviso en Mi Grupo).
export function sugerenciasPendientes(evaluacion: any): number {
  const alumnos = Array.isArray(evaluacion?.alumnos) ? evaluacion.alumnos : []
  return alumnos.filter((a: any) => Array.isArray(a?.nee) && a.nee.length > 0 && !a?.revision).length
}

type Alumno = {
  id: string
  codigo: string
  fecha_alta: string
  fecha_baja: string | null
  activo: boolean
  requiere_apoyos: boolean
  apoyos: string | null
  apoyos_origen: 'mia' | 'educadora' | null
  apoyos_confirmado_en: string | null
  alta_posterior?: boolean
}

const MAX_LARGO_APOYOS = 600

const c = {
  marca: '#3D3A8C',
  marcaClaro: '#EEEDF8',
  accion: '#00A896',
  texto: '#1A1A2E',
  suave: '#888',
  borde: '#E0DFF5',
}

const estilos = {
  seccion: { marginBottom: 20 } as React.CSSProperties,
  tituloSeccion: { fontSize: 12, fontWeight: 700, color: c.marca, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 8px' },
  ayuda: { fontSize: 11, color: c.suave, margin: '0 0 10px', lineHeight: 1.5 },
  tarjeta: { border: `1px solid ${c.borde}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: 'white' } as React.CSSProperties,
  fila: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center' },
  chip: { fontSize: 10, background: c.marcaClaro, color: c.marca, padding: '2px 8px', borderRadius: 10, fontWeight: 600 },
  textarea: { width: '100%', boxSizing: 'border-box' as const, minHeight: 70, fontSize: 13, lineHeight: 1.5, padding: '8px 10px', border: `1px solid ${c.borde}`, borderRadius: 8, fontFamily: 'inherit', resize: 'vertical' as const },
  select: { fontSize: 13, padding: '6px 8px', border: `1px solid ${c.borde}`, borderRadius: 8, background: 'white' },
  btnPrimario: { background: c.accion, color: 'white', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnMarca: { background: c.marca, color: 'white', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnSecundario: { background: 'white', color: c.marca, border: `1px solid ${c.borde}`, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnTexto: { background: 'none', border: 'none', color: c.marca, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 4px' },
  error: { background: '#FFF7ED', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 8, padding: '8px 10px', fontSize: 12, marginTop: 10 },
}

function fechaCorta(fechaISO: string): string {
  return new Date(fechaISO.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function numeroDeReferencia(referencia: string): number {
  const m = String(referencia || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export default function GrupoAlumnosApoyos({
  evaluacionIndividual,
  totalAlumnos,
  onEvaluacionActualizada,
  onTotalActualizado,
}: {
  evaluacionIndividual: any
  totalAlumnos: number
  onEvaluacionActualizada: (evaluacion: any) => void
  // [Saneado 27 sep 2026] Avisa a Mi Grupo cuántos códigos activos hay (fuente única del total).
  onTotalActualizado?: (total: number) => void
}) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [bajas, setBajas] = useState<Alumno[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  // Borradores de sugerencias de MÍA: referencia → { texto, alumnoId }
  const [borradores, setBorradores] = useState<Record<string, { texto: string; alumnoId: string }>>({})
  // Edición manual de apoyos en la lista del grupo
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null)
  const [confirmandoBaja, setConfirmandoBaja] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  async function cargar() {
    setError('')
    try {
      const res = await fetchConSesion('/api/alumnos-codigo')
      const json = await res.json()
      if (json.ok) {
        setAlumnos(json.alumnos || [])
        setBajas(json.bajas || [])
        onTotalActualizado?.((json.alumnos || []).length)
      } else {
        setError(json.error || 'No se pudo cargar tu grupo.')
      }
    } catch {
      setError('Error de conexión.')
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function enviar(body: any, url = '/api/alumnos-codigo'): Promise<any | null> {
    setError('')
    setAviso('')
    setOcupado(true)
    try {
      const res = await fetchConSesion(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      setOcupado(false)
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo completar la acción.')
        return null
      }
      return json
    } catch {
      setOcupado(false)
      setError('Error de conexión.')
      return null
    }
  }

  // ── Sugerencias de MÍA ──────────────────────────────────────
  const sugerencias: any[] = (Array.isArray(evaluacionIndividual?.alumnos) ? evaluacionIndividual.alumnos : [])
    .filter((a: any) => Array.isArray(a?.nee) && a.nee.length > 0 && !a?.revision)

  function codigoPropuesto(referencia: string): string {
    const n = numeroDeReferencia(referencia)
    if (!n) return ''
    const codigo = `AL-${String(n).padStart(2, '0')}`
    const alumno = alumnos.find(a => a.codigo === codigo && !a.requiere_apoyos)
    return alumno ? alumno.id : ''
  }

  function borradorDe(s: any) {
    // [27 sep 2026] Evaluaciones nuevas traen apoyos_sugeridos (acciones en
    // lenguaje neutro); las anteriores solo traen la observación.
    const textoInicial = String(s.apoyos_sugeridos || s.observaciones || '')
    return borradores[s.referencia] || { texto: textoInicial, alumnoId: codigoPropuesto(s.referencia) }
  }

  function actualizarBorrador(referencia: string, cambios: Partial<{ texto: string; alumnoId: string }>, base: { texto: string; alumnoId: string }) {
    setBorradores(prev => ({ ...prev, [referencia]: { ...base, ...(prev[referencia] || {}), ...cambios } }))
  }

  async function confirmarSugerencia(s: any) {
    const b = borradorDe(s)
    if (!b.alumnoId) { setError('Elige a qué código corresponde este niño.'); return }
    if (!b.texto.trim()) { setError('Describe los apoyos antes de confirmar.'); return }
    const json = await enviar({ accion: 'confirmar_apoyos', id: b.alumnoId, apoyos: b.texto, origen: 'mia', referencia: s.referencia })
    if (!json) return
    setAlumnos(prev => prev.map(a => (a.id === json.alumno.id ? { ...a, ...json.alumno } : a)))
    if (json.evaluacion_individual) onEvaluacionActualizada(json.evaluacion_individual)
    setAviso(`✅ Apoyos confirmados para ${json.alumno.codigo}. Llegarán a tus próximas planeaciones.`)
  }

  async function descartarSugerencia(s: any) {
    const json = await enviar({ accion: 'descartar_sugerencia', referencia: s.referencia })
    if (!json) return
    if (json.evaluacion_individual) onEvaluacionActualizada(json.evaluacion_individual)
    setAviso(`Sugerencia de ${s.referencia} descartada.`)
  }

  // ── Lista del grupo ─────────────────────────────────────────
  async function guardarApoyosManual() {
    if (!editando) return
    if (!editando.texto.trim()) { setError('Describe los apoyos o usa "Quitar apoyos".'); return }
    const json = await enviar({ accion: 'confirmar_apoyos', id: editando.id, apoyos: editando.texto, origen: 'educadora' })
    if (!json) return
    setAlumnos(prev => prev.map(a => (a.id === json.alumno.id ? { ...a, ...json.alumno } : a)))
    setEditando(null)
    setAviso(`✅ Apoyos guardados para ${json.alumno.codigo}.`)
  }

  async function quitarApoyos(id: string) {
    const json = await enviar({ accion: 'quitar_apoyos', id })
    if (!json) return
    setAlumnos(prev => prev.map(a => (a.id === json.alumno.id ? { ...a, ...json.alumno } : a)))
    setAviso(`Apoyos retirados de ${json.alumno.codigo}.`)
  }

  async function generarInicial() {
    const json = await enviar({ accion: 'bootstrap', total: totalAlumnos })
    if (json) await cargar()
  }

  async function agregarAlumno() {
    const json = await enviar({ accion: 'agregar' })
    if (!json) return
    await cargar()
    setAviso(`✅ Alta registrada: ${json.alumno.codigo}. Anótalo en tu lista personal.`)
  }

  async function darDeBaja(id: string) {
    const json = await enviar({ id }, '/api/alumnos-codigo/baja')
    setConfirmandoBaja(null)
    if (!json) return
    await cargar()
    setAviso(`Baja registrada: ${json.alumno.codigo}. Su número no se reutiliza.`)
  }

  if (cargando) return <p style={{ fontSize: 12, color: c.suave, margin: 0 }}>Cargando tu grupo...</p>

  return (
    <div>
      {/* Mensajes arriba: con grupos grandes, abajo no se verían sin desplazarse */}
      {aviso && <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: 8, padding: '8px 10px', fontSize: 12, marginBottom: 12 }}>{aviso}</div>}
      {error && <div style={{ ...estilos.error, marginTop: 0, marginBottom: 12 }}>{error}</div>}

      {/* ── 1. Sugerencias de MÍA ─────────────────────────── */}
      {sugerencias.length > 0 && alumnos.length > 0 && (
        <div style={estilos.seccion}>
          <p style={estilos.tituloSeccion}>✦ Sugerencias de MÍA ({sugerencias.length})</p>
          <p style={estilos.ayuda}>
            MÍA detectó barreras en estos niños a partir de tu evaluación individual. Revisa el texto, elige a qué código
            corresponde cada uno y confirma. Solo lo que confirmes llegará a tus planeaciones como ajustes razonables.
            Describe lo que observas y cómo apoyarás, <strong>sin nombres ni diagnósticos</strong>.
          </p>
          {sugerencias.map((s: any) => {
            const b = borradorDe(s)
            return (
              <div key={s.referencia} style={estilos.tarjeta}>
                <div style={{ ...estilos.fila, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.texto }}>{s.referencia}</span>
                  {s.nee.map((n: string, i: number) => <span key={i} style={estilos.chip}>{n}</span>)}
                </div>
                {s.apoyos_sugeridos && s.observaciones && (
                  <p style={{ ...estilos.ayuda, margin: '0 0 8px' }}>
                    <strong>Observación de MÍA:</strong> {s.observaciones}
                  </p>
                )}
                <textarea
                  value={b.texto}
                  maxLength={MAX_LARGO_APOYOS}
                  onChange={e => actualizarBorrador(s.referencia, { texto: e.target.value }, b)}
                  style={estilos.textarea}
                  placeholder="Apoyos concretos: qué harás para quitar la barrera (ej. anticipar la consigna con material visual)."
                />
                <div style={{ ...estilos.fila, marginTop: 8, justifyContent: 'space-between' }}>
                  <label style={{ ...estilos.fila, fontSize: 12, color: c.texto }}>
                    Corresponde a:
                    <select
                      value={b.alumnoId}
                      onChange={e => actualizarBorrador(s.referencia, { alumnoId: e.target.value }, b)}
                      style={estilos.select}
                    >
                      <option value="">Elige código…</option>
                      {alumnos.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.codigo}{a.requiere_apoyos ? ' (ya tiene apoyos)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={estilos.fila}>
                    <button type="button" disabled={ocupado} onClick={() => descartarSugerencia(s)} style={estilos.btnSecundario}>Descartar</button>
                    <button type="button" disabled={ocupado} onClick={() => confirmarSugerencia(s)} style={estilos.btnPrimario}>Confirmar</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sugerencias.length > 0 && alumnos.length === 0 && (
        <p style={{ ...estilos.ayuda, background: c.marcaClaro, padding: '8px 10px', borderRadius: 8 }}>
          ✦ MÍA tiene {sugerencias.length} sugerencia{sugerencias.length !== 1 ? 's' : ''} de apoyos. Primero genera los
          códigos de tu grupo para poder asignarlas.
        </p>
      )}

      {/* ── 2. Tu grupo ───────────────────────────────────── */}
      <div style={estilos.seccion}>
        <p style={estilos.tituloSeccion}>Tu grupo · códigos</p>
        <p style={estilos.ayuda}>
          Cada niño tiene un código que nunca cambia. Guarda en tu lista personal a quién corresponde cada uno.
        </p>

        {alumnos.length === 0 ? (
          <div style={{ textAlign: 'center' as const }}>
            {totalAlumnos > 0 ? (
              <>
                <p style={{ fontSize: 13, color: '#444', marginBottom: 12 }}>
                  Aún no tienes alumnos registrados. Genera la lista inicial con tu total actual ({totalAlumnos} alumnos),
                  en el mismo orden de tu lista.
                </p>
                <button type="button" disabled={ocupado} onClick={generarInicial} style={estilos.btnMarca}>Generar códigos iniciales</button>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#444', margin: 0 }}>
                Primero escribe cuántos alumnos tiene tu grupo en <strong>Configura tu grupo</strong>; con ese número se generan los códigos.
              </p>
            )}
          </div>
        ) : (
          <>
            {alumnos.map(a => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: `1px solid ${c.marcaClaro}` }}>
                <div style={{ ...estilos.fila, justifyContent: 'space-between' }}>
                  <div style={estilos.fila}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.texto }}>{a.codigo}</span>
                    {a.alta_posterior && <span style={estilos.chip}>alta {fechaCorta(a.fecha_alta)}</span>}
                    {a.requiere_apoyos && (
                      <span style={{ ...estilos.chip, background: '#E0F5F3', color: '#0F6E56' }}>
                        con apoyos{a.apoyos_origen === 'mia' ? ' · sugerido por MÍA' : ''}
                      </span>
                    )}
                  </div>
                  <div style={estilos.fila}>
                    {editando?.id !== a.id && (
                      <button type="button" style={estilos.btnTexto} onClick={() => setEditando({ id: a.id, texto: a.apoyos || '' })}>
                        {a.requiere_apoyos ? 'Editar apoyos' : 'Agregar apoyos'}
                      </button>
                    )}
                    {a.requiere_apoyos && editando?.id !== a.id && (
                      <button type="button" style={estilos.btnTexto} disabled={ocupado} onClick={() => quitarApoyos(a.id)}>Quitar apoyos</button>
                    )}
                    {confirmandoBaja === a.id ? (
                      <span style={{ ...estilos.fila, fontSize: 11, color: c.texto }}>
                        ¿Dar de baja {a.codigo}?
                        <button type="button" style={estilos.btnTexto} disabled={ocupado} onClick={() => darDeBaja(a.id)}>Sí</button>
                        <button type="button" style={estilos.btnTexto} onClick={() => setConfirmandoBaja(null)}>No</button>
                      </span>
                    ) : (
                      <button type="button" style={{ ...estilos.btnTexto, color: c.suave }} onClick={() => setConfirmandoBaja(a.id)}>Dar de baja</button>
                    )}
                  </div>
                </div>
                {a.requiere_apoyos && editando?.id !== a.id && a.apoyos && (
                  <p style={{ fontSize: 12, color: '#444', margin: '6px 0 0', lineHeight: 1.5 }}>{a.apoyos}</p>
                )}
                {editando?.id === a.id && (
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      value={editando.texto}
                      maxLength={MAX_LARGO_APOYOS}
                      onChange={e => setEditando({ id: a.id, texto: e.target.value })}
                      style={estilos.textarea}
                      placeholder="Apoyos concretos para este niño, sin nombres ni diagnósticos."
                    />
                    <div style={{ ...estilos.fila, justifyContent: 'flex-end', marginTop: 6 }}>
                      <button type="button" style={estilos.btnSecundario} onClick={() => setEditando(null)}>Cancelar</button>
                      <button type="button" style={estilos.btnPrimario} disabled={ocupado} onClick={guardarApoyosManual}>Guardar apoyos</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: 12 }}>
              <button type="button" disabled={ocupado} onClick={agregarAlumno} style={estilos.btnSecundario}>+ Registrar alta de un niño</button>
            </div>

            {bajas.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ ...estilos.tituloSeccion, color: c.suave }}>Bajas del ciclo</p>
                {bajas.map(a => (
                  <div key={a.id} style={{ ...estilos.fila, padding: '6px 0', color: c.suave, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{a.codigo}</span>
                    <span>(baja{a.fecha_baja ? ` ${fechaCorta(a.fecha_baja)}` : ''})</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
