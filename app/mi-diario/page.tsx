'use client'
// ============================================================
//  PlanIA Digital — app/mi-diario/page.tsx
//  [2 oct 2026] Mi diario (pantallas 1–3 de la especificación):
//   1) Registrar: "Nota para todo el grupo" + cuadrícula de códigos
//      (punto verde = ya tiene nota esta semana).
//   2) Grabar: hoja inferior, Observación (1 min) / Incidente (3 min),
//      tocar para iniciar y tocar para detener. Pulso verde.
//   3) Validar: texto editable, hora "Sucedió" ajustable; la hora
//      "Registrada" la pone el servidor al guardar.
//  El audio no se guarda: se transcribe en /api/diario/transcribir
//  y se descarta. Niños solo por código AL-XX.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', cian: '#00A896', cianOscuro: '#00806F',
  menta: '#E8F5F2', texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5',
  ambar: '#8A6D1D', ambarFondo: '#FFF3CD',
}
const LIMITE: Record<Tipo, number> = { observacion: 60, incidente: 180 }

type Tipo = 'observacion' | 'incidente'
type Nota = {
  id: string; destinatario: string; tipo: Tipo; sucedido_en: string; registrado_en: string
  estado: 'activa' | 'anulada'; texto: string; editada_en: string | null
}
type Fase = 'listo' | 'grabando' | 'transcribiendo' | 'validar' | 'guardando'

const card: React.CSSProperties = { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px' }
const h2: React.CSSProperties = { margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.texto, textTransform: 'uppercase', letterSpacing: '0.07em' }

async function token(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}
function aLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
}
function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
function inicioDeSemana(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  const dia = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dia)
  return d
}
function tipoDeAudio(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export default function MiDiarioPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [alumnos, setAlumnos] = useState<string[] | null>(null)
  const [notas, setNotas] = useState<Nota[]>([])
  const [uso, setUso] = useState<{ usadosMin: number; topeMin: number } | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  // Hoja de grabación
  const [destino, setDestino] = useState<string | null>(null)
  const [tipo, setTipo] = useState<Tipo>('observacion')
  const [fase, setFase] = useState<Fase>('listo')
  const [segundos, setSegundos] = useState(0)
  const [texto, setTexto] = useState('')
  const [sucedido, setSucedido] = useState('')
  const [errorHoja, setErrorHoja] = useState('')
  const [agregando, setAgregando] = useState(false)

  const grabador = useRef<MediaRecorder | null>(null)
  const pedazos = useRef<Blob[]>([])
  const inicioGrabacion = useRef<number>(0)
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null)
  const flujo = useRef<MediaStream | null>(null)

  async function cargar() {
    const t = await token(); if (!t) return
    try {
      const [rn, ru] = await Promise.all([
        fetch('/api/diario/notas?dias=14', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/diario/transcribir', { headers: { Authorization: `Bearer ${t}` } }),
      ])
      const dn = await rn.json(); const du = await ru.json()
      if (!rn.ok) { setError(dn?.error || 'No se pudo cargar tu diario.'); return }
      setAlumnos(dn.alumnos || []); setNotas(dn.notas || [])
      if (ru.ok) setUso(du)
    } catch { setError('No se pudo conectar con el servidor.') }
  }

  useEffect(() => {
    async function inicio() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (user?.role === 'directivo') { router.push('/directivo/dashboard'); return }
      setProfile(user)
      await cargar()
    }
    inicio()
    return () => detenerTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function detenerTodo() {
    if (reloj.current) clearInterval(reloj.current)
    reloj.current = null
    flujo.current?.getTracks().forEach(tr => tr.stop())
    flujo.current = null
  }

  function abrirHoja(d: string) {
    setDestino(d); setTipo('observacion'); setFase('listo'); setSegundos(0)
    setTexto(''); setErrorHoja(''); setAgregando(false); setAviso('')
  }
  function cerrarHoja() {
    if (fase === 'grabando') grabador.current?.stop()
    detenerTodo()
    setDestino(null); setFase('listo')
  }

  async function iniciar(esAgregado = false) {
    setErrorHoja('')
    const mime = tipoDeAudio()
    if (!navigator.mediaDevices?.getUserMedia || !mime) {
      setErrorHoja('Este navegador no permite grabar audio. Prueba con Chrome o Safari actualizados.'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      flujo.current = stream
      const rec = new MediaRecorder(stream, { mimeType: mime })
      pedazos.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) pedazos.current.push(e.data) }
      rec.onstop = () => {
        const dur = Math.max(1, Math.round((Date.now() - inicioGrabacion.current) / 1000))
        detenerTodo()
        transcribir(new Blob(pedazos.current, { type: mime }), dur, esAgregado)
      }
      grabador.current = rec
      inicioGrabacion.current = Date.now()
      if (!esAgregado) setSucedido(aLocalInput(new Date()))
      setAgregando(esAgregado)
      setSegundos(0); setFase('grabando')
      rec.start()
      reloj.current = setInterval(() => {
        const s = (Date.now() - inicioGrabacion.current) / 1000
        setSegundos(s)
        if (s >= LIMITE[tipo] && rec.state === 'recording') rec.stop()
      }, 250)
    } catch {
      setErrorHoja('No se pudo usar el micrófono. Revisa que PlanIA tenga permiso para usarlo.')
    }
  }

  function detener() {
    if (grabador.current?.state === 'recording') grabador.current.stop()
  }

  async function transcribir(audio: Blob, dur: number, esAgregado: boolean) {
    setFase('transcribiendo')
    const t = await token(); if (!t) return
    const form = new FormData()
    form.append('audio', audio, 'nota')
    form.append('tipo', tipo)
    form.append('segundos', String(dur))
    try {
      const res = await fetch('/api/diario/transcribir', { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: form })
      const d = await res.json()
      if (d?.usadosMin != null) setUso({ usadosMin: d.usadosMin, topeMin: d.topeMin })
      if (!res.ok) { setErrorHoja(d?.error || 'No se pudo transcribir.'); setFase(esAgregado ? 'validar' : 'listo'); return }
      setTexto(prev => esAgregado && prev.trim() ? `${prev.trim()}\n\n(${hora(new Date().toISOString())}) ${d.texto}` : d.texto)
      setFase('validar')
    } catch {
      setErrorHoja('Se perdió la conexión al transcribir. Intenta de nuevo.')
      setFase(esAgregado ? 'validar' : 'listo')
    }
  }

  async function guardar() {
    if (!destino || !texto.trim()) return
    setFase('guardando'); setErrorHoja('')
    const t = await token(); if (!t) return
    try {
      const res = await fetch('/api/diario/notas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinatario: destino, tipo, texto: texto.trim(), sucedido_en: new Date(sucedido).toISOString() }),
      })
      const d = await res.json()
      if (!res.ok) { setErrorHoja(d?.error || 'No se pudo guardar.'); setFase('validar'); return }
      setNotas(prev => [d.nota, ...prev])
      setAviso(`✓ Guardada en tu diario · ${destino === 'grupo' ? 'Todo el grupo' : destino}`)
      setDestino(null); setFase('listo')
    } catch {
      setErrorHoja('Se perdió la conexión al guardar. Tu texto sigue aquí; intenta de nuevo.')
      setFase('validar')
    }
  }

  // ── Derivados ──
  const semana = inicioDeSemana()
  const conNota = new Set(notas.filter(n => n.estado === 'activa' && new Date(n.sucedido_en) >= semana).map(n => n.destinatario))
  const faltan = (alumnos || []).filter(a => !conNota.has(a)).length
  const hoy = new Date().toDateString()
  const notasHoy = notas.filter(n => new Date(n.sucedido_en).toDateString() === hoy)
  const limite = LIMITE[tipo]
  const quedan = Math.max(0, Math.ceil(limite - segundos))

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px 140px' }}>
        <EncabezadoPagina antetitulo="Registrar" titulo="Mi diario" subtitulo="Toca el número del alumno y dicta tu observación." />

        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ ...card, background: C.ambarFondo, borderColor: '#F0DFA6', color: C.ambar, fontSize: 14 }}>{error}</div>}
          {aviso && <div role="status" style={{ ...card, background: '#E9F6F1', borderColor: '#BFE3D6', color: C.cianOscuro, fontSize: 14, fontWeight: 700 }}>{aviso}</div>}

          {alumnos === null ? null : alumnos.length === 0 ? (
            <div style={card}>
              <p style={{ margin: 0, fontSize: 14, color: C.suave, lineHeight: 1.6 }}>
                Para usar tu diario, primero registra tu lista de alumnos en{' '}
                <button onClick={() => router.push('/mi-grupo')} style={{ background: 'none', border: 'none', padding: 0, color: C.indigo, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Mi grupo</button>.
              </p>
            </div>
          ) : (
            <>
              <section style={card}>
                <button onClick={() => abrirHoja('grupo')}
                  style={{ width: '100%', minHeight: 52, borderRadius: 12, border: 'none', background: C.indigo, color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🎙 Nota para todo el grupo
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8, marginTop: 14 }}>
                  {alumnos.map(a => {
                    const tiene = conNota.has(a)
                    return (
                      <button key={a} onClick={() => abrirHoja(a)} aria-label={`Nota para ${a}`}
                        style={{ position: 'relative', minHeight: 64, borderRadius: 12, border: `1.5px solid ${tiene ? '#BFE3D6' : C.borde}`, background: tiene ? C.menta : 'white', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10.5, color: C.suave, fontWeight: 700 }}>AL</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: C.texto, lineHeight: 1.1 }}>{a.replace(/^AL-/, '')}</span>
                        {tiene && <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 8, background: C.cian }} />}
                      </button>
                    )
                  })}
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: C.suave }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: C.cian, marginRight: 6 }} />
                  Ya tiene nota esta semana · {faltan === 0 ? 'ya observaste a todo tu grupo' : `faltan ${faltan} por observar`}
                </p>
                {uso && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.suave }}>
                    Minutos de diario usados: {uso.usadosMin} de {uso.topeMin}
                  </p>
                )}
              </section>

              <section style={card}>
                <h2 style={h2}>Hoy</h2>
                {notasHoy.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13.5, color: C.suave }}>Aún no registras notas hoy.</p>
                ) : notasHoy.map(n => (
                  <div key={n.id} style={{ padding: '10px 0 10px 10px', borderTop: `1px solid ${C.indigoClaro}`, borderLeft: n.tipo === 'incidente' ? `3px solid #E0B44C` : '3px solid transparent' }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: n.tipo === 'incidente' ? C.ambar : C.indigo }}>
                      {n.destinatario === 'grupo' ? 'Todo el grupo' : n.destinatario} · {n.tipo === 'incidente' ? 'Incidente' : 'Observación'} · sucedió {hora(n.sucedido_en)}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: C.texto, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.texto}</p>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      </div>

      {/* ===== Hoja inferior: grabar y validar ===== */}
      {destino && (
        <div onClick={fase === 'listo' || fase === 'validar' ? cerrarHoja : undefined}
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Grabar nota"
            style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', background: 'white', borderRadius: '18px 18px 0 0', padding: '18px 18px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ ...h2, margin: 0 }}>Nota para {destino === 'grupo' ? 'todo el grupo' : destino}</h2>
              {(fase === 'listo' || fase === 'validar') && (
                <button onClick={cerrarHoja} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: 22, color: C.suave, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>×</button>
              )}
            </div>

            {(fase === 'listo' || fase === 'grabando' || fase === 'transcribiendo') && !agregando && (
              <div style={{ display: 'flex', gap: 6, background: C.indigoClaro, borderRadius: 10, padding: 4, margin: '12px 0 4px' }}>
                {(['observacion', 'incidente'] as Tipo[]).map(t => (
                  <button key={t} onClick={() => fase === 'listo' && setTipo(t)} disabled={fase !== 'listo'}
                    style={{ flex: 1, minHeight: 44, borderRadius: 8, border: 'none', cursor: fase === 'listo' ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                      background: tipo === t ? 'white' : 'transparent', color: tipo === t ? (t === 'incidente' ? C.ambar : C.indigo) : C.suave }}>
                    {t === 'observacion' ? 'Observación · 1 min' : 'Incidente · 3 min'}
                  </button>
                ))}
              </div>
            )}

            {(fase === 'listo' || fase === 'grabando') && (
              <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
                <style>{`@keyframes pulsoPlania { 0% { box-shadow: 0 0 0 0 rgba(0,168,150,0.45) } 70% { box-shadow: 0 0 0 22px rgba(0,168,150,0) } 100% { box-shadow: 0 0 0 0 rgba(0,168,150,0) } }`}</style>
                <button onClick={() => (fase === 'listo' ? iniciar(agregando) : detener())}
                  aria-label={fase === 'listo' ? 'Empezar a grabar' : 'Detener grabación'}
                  style={{ width: 104, height: 104, borderRadius: 104, border: 'none', cursor: 'pointer', background: C.cian, color: 'white', fontSize: fase === 'listo' ? 34 : 30,
                    animation: fase === 'grabando' ? 'pulsoPlania 1.4s infinite' : 'none' }}>
                  {fase === 'listo' ? '🎙' : '■'}
                </button>
                <p style={{ margin: '12px 0 0', fontSize: 14, color: C.texto, fontWeight: 700 }}>
                  {fase === 'listo' ? 'Toca para empezar a dictar' : `${mmss(segundos)} · toca para terminar`}
                </p>
                {fase === 'grabando' && quedan <= 10 && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: C.ambar, fontWeight: 700 }}>Quedan {quedan} s</p>
                )}
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.suave }}>
                  Menciona a los niños por su código (por ejemplo, AL-03), nunca por su nombre.
                </p>
              </div>
            )}

            {fase === 'transcribiendo' && (
              <p style={{ textAlign: 'center', padding: '28px 0', margin: 0, fontSize: 14, color: C.indigo, fontWeight: 700 }}>✦ Convirtiendo tu voz en texto…</p>
            )}

            {(fase === 'validar' || fase === 'guardando') && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: C.suave }}>Revisa y corrige el texto</label>
                <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} disabled={fase === 'guardando'}
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 12, borderRadius: 10, border: `1.5px solid ${C.borde}`, fontSize: 15, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <label style={{ fontSize: 12.5, color: C.suave, fontWeight: 700 }}>
                    Sucedió
                    <input type="datetime-local" value={sucedido} onChange={e => setSucedido(e.target.value)} disabled={fase === 'guardando'}
                      max={aLocalInput(new Date())}
                      style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, minHeight: 44, padding: '0 8px', borderRadius: 8, border: `1.5px solid ${C.borde}`, fontSize: 14, fontFamily: 'inherit' }} />
                  </label>
                  <div style={{ fontSize: 12.5, color: C.suave, fontWeight: 700 }}>
                    Registrada
                    <p style={{ margin: '4px 0 0', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 400, color: C.texto }}>al guardar (fija)</p>
                  </div>
                </div>
                <button onClick={guardar} disabled={fase === 'guardando' || !texto.trim()}
                  style={{ width: '100%', minHeight: 50, marginTop: 14, borderRadius: 12, border: 'none', background: C.cianOscuro, color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: fase === 'guardando' ? 0.7 : 1 }}>
                  {fase === 'guardando' ? 'Guardando…' : 'Guardar en mi diario'}
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setAgregando(true); iniciar(true) }} disabled={fase === 'guardando'}
                    style={{ minHeight: 46, borderRadius: 10, border: `1.5px solid ${C.indigo}`, background: 'white', color: C.indigo, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Agregar más a esta nota
                  </button>
                  <button onClick={() => { setTexto(''); setAgregando(false); setFase('listo') }} disabled={fase === 'guardando'}
                    style={{ minHeight: 46, borderRadius: 10, border: `1.5px solid ${C.borde}`, background: 'white', color: C.suave, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Descartar y volver a grabar
                  </button>
                </div>
              </div>
            )}

            {errorHoja && (
              <p style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 10, background: C.ambarFondo, color: C.ambar, fontSize: 13.5 }}>{errorHoja}</p>
            )}
          </div>
        </div>
      )}
    </SidebarWrapper>
  )
}
