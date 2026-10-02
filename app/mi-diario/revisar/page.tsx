'use client'
// ============================================================
//  PlanIA Digital — app/mi-diario/revisar/page.tsx
//  [2 oct 2026] Mi diario · pantalla 4 (Revisar):
//  filtros (Todas, Grupo, Incidentes, alumno, periodo), notas
//  agrupadas por día, incidentes con franja ámbar, notas editadas
//  con "Ver versiones", notas anuladas tachadas con su motivo.
//  Editar crea una versión nueva; anular nunca borra.
// ============================================================
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', cian: '#00A896', cianOscuro: '#00806F',
  texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5', ambar: '#8A6D1D', ambarFondo: '#FFF3CD', franja: '#E0B44C',
}

type Nota = {
  id: string; destinatario: string; tipo: 'observacion' | 'incidente'; sucedido_en: string; registrado_en: string
  estado: 'activa' | 'anulada'; anulada_en: string | null; motivo_anulacion: string | null
  version_actual: number; texto: string; editada_en: string | null
}
type Version = { numero: number; texto: string; origen: string; creado_en: string }
type Filtro = 'todas' | 'grupo' | 'incidentes' | string // string = código AL-XX
type Periodo = 'semana' | 'mes' | 'ciclo'

const card: React.CSSProperties = { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px' }
const chip = (activo: boolean): React.CSSProperties => ({
  minHeight: 40, padding: '0 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
  border: `1.5px solid ${activo ? C.indigo : C.borde}`, background: activo ? C.indigo : 'white', color: activo ? 'white' : C.texto,
})
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: '8px 0', minHeight: 40, color: C.indigo, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

async function token(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
function etiquetaDia(iso: string): string {
  const t = new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
function inicioPeriodo(p: Periodo): Date | null {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (p === 'semana') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d }
  if (p === 'mes') { d.setDate(1); return d }
  return null
}

export default function RevisarDiarioPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [alumnos, setAlumnos] = useState<string[]>([])
  const [notas, setNotas] = useState<Nota[] | null>(null)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [periodo, setPeriodo] = useState<Periodo>('semana')

  const [versiones, setVersiones] = useState<Record<string, Version[] | 'cargando'>>({})
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null)
  const [anulando, setAnulando] = useState<{ id: string; motivo: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ id: string; texto: string; tipo: 'ok' | 'aviso' } | null>(null)

  useEffect(() => {
    async function inicio() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (user?.role === 'directivo') { router.push('/directivo/dashboard'); return }
      setProfile(user)
      const t = await token(); if (!t) return
      try {
        const res = await fetch('/api/diario/notas?dias=400', { headers: { Authorization: `Bearer ${t}` } })
        const d = await res.json()
        if (!res.ok) { setError(d?.error || 'No se pudo cargar tu diario.'); return }
        setAlumnos(d.alumnos || []); setNotas(d.notas || [])
      } catch { setError('No se pudo conectar con el servidor.') }
    }
    inicio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verVersiones(id: string) {
    if (versiones[id] && versiones[id] !== 'cargando') { setVersiones(v => { const n = { ...v }; delete n[id]; return n }); return }
    setVersiones(v => ({ ...v, [id]: 'cargando' }))
    const t = await token(); if (!t) return
    const res = await fetch(`/api/diario/notas/${id}`, { headers: { Authorization: `Bearer ${t}` } })
    const d = await res.json()
    setVersiones(v => ({ ...v, [id]: res.ok ? d.versiones : [] }))
  }

  async function enviar(id: string, body: any) {
    setOcupado(true); setMensaje(null)
    const t = await token(); if (!t) { setOcupado(false); return null }
    try {
      const res = await fetch(`/api/diario/notas/${id}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setMensaje({ id, texto: d?.error || 'No se pudo guardar.', tipo: 'aviso' }); return null }
      return d
    } catch {
      setMensaje({ id, texto: 'Se perdió la conexión. Intenta de nuevo.', tipo: 'aviso' }); return null
    } finally { setOcupado(false) }
  }

  async function guardarEdicion() {
    if (!editando) return
    const d = await enviar(editando.id, { accion: 'editar', texto: editando.texto })
    if (!d) return
    setNotas(prev => (prev || []).map(n => n.id === editando.id ? { ...n, texto: d.texto, editada_en: d.editada_en, version_actual: d.version_actual } : n))
    setVersiones(v => { const n = { ...v }; delete n[editando.id]; return n })
    const extra = d.revisionNombres === 'fallo' ? ' MÍA no pudo revisar nombres esta vez; revisa el texto.'
      : d.nombresQuitados > 0 ? ` ✦ MÍA quitó ${d.nombresQuitados} ${d.nombresQuitados === 1 ? 'nombre' : 'nombres'}.` : ''
    setMensaje({ id: editando.id, texto: `✓ Se guardó como versión ${d.version_actual}.${extra}`, tipo: 'ok' })
    setEditando(null)
  }

  async function confirmarAnulacion() {
    if (!anulando) return
    const d = await enviar(anulando.id, { accion: 'anular', motivo: anulando.motivo })
    if (!d) return
    setNotas(prev => (prev || []).map(n => n.id === anulando.id ? { ...n, ...d.nota } : n))
    setMensaje({ id: anulando.id, texto: '✓ Nota anulada. Sigue visible en tu diario con su motivo.', tipo: 'ok' })
    setAnulando(null)
  }

  const [descargando, setDescargando] = useState('')
  async function descargarWord(consulta: string, clave: string) {
    setDescargando(clave); setError('')
    const t = await token(); if (!t) { setDescargando(''); return }
    try {
      const res = await fetch(`/api/diario/word?${consulta}`, { headers: { Authorization: `Bearer ${t}` } })
      if (!res.ok) {
        let msg = 'No se pudo generar el Word.'
        try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
        setError(msg); return
      }
      const blob = await res.blob()
      const m = (res.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/i)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = m ? m[1] : 'Mi_diario.docx'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('No se pudo descargar. Revisa tu conexión e inténtalo de nuevo.')
    } finally { setDescargando('') }
  }

  // ── Filtrado y agrupación por día ──
  const desde = inicioPeriodo(periodo)
  const visibles = (notas || []).filter(n => {
    if (desde && new Date(n.sucedido_en) < desde) return false
    if (filtro === 'grupo') return n.destinatario === 'grupo'
    if (filtro === 'incidentes') return n.tipo === 'incidente'
    if (filtro !== 'todas') return n.destinatario === filtro
    return true
  })
  const dias: Array<{ dia: string; notas: Nota[] }> = []
  for (const n of visibles) {
    const dia = new Date(n.sucedido_en).toDateString()
    const g = dias.find(x => x.dia === dia)
    if (g) g.notas.push(n); else dias.push({ dia, notas: [n] })
  }
  const nombrePeriodo = periodo === 'semana' ? 'esta semana' : periodo === 'mes' ? 'este mes' : 'todo el ciclo'

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px 48px' }}>
        <EncabezadoPagina antetitulo="Revisar" titulo="Mi diario" subtitulo={`${visibles.length} ${visibles.length === 1 ? 'nota' : 'notas'} · ${nombrePeriodo}`} />

        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => router.push('/mi-diario')} style={{ ...linkBtn, alignSelf: 'flex-start', fontSize: 14 }}>← Registrar notas</button>
          {error && <div style={{ ...card, background: C.ambarFondo, color: C.ambar, fontSize: 14 }}>{error}</div>}

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['semana', 'mes', 'ciclo'] as Periodo[]).map(p => (
                <button key={p} onClick={() => setPeriodo(p)} style={chip(periodo === p)}>
                  {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mes' : 'Todo el ciclo'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setFiltro('todas')} style={chip(filtro === 'todas')}>Todas</button>
              <button onClick={() => setFiltro('grupo')} style={chip(filtro === 'grupo')}>Grupo</button>
              <button onClick={() => setFiltro('incidentes')} style={chip(filtro === 'incidentes')}>Incidentes</button>
              <select value={alumnos.includes(filtro) ? filtro : ''} onChange={e => setFiltro(e.target.value || 'todas')}
                aria-label="Filtrar por alumno"
                style={{ minHeight: 40, padding: '0 10px', borderRadius: 20, border: `1.5px solid ${alumnos.includes(filtro) ? C.indigo : C.borde}`, background: 'white', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', color: C.texto }}>
                <option value="">Un alumno…</option>
                {alumnos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button onClick={() => descargarWord(`periodo=${periodo}&filtro=${encodeURIComponent(filtro)}`, 'diario')}
              disabled={!!descargando || visibles.length === 0}
              style={{ minHeight: 44, borderRadius: 10, border: `1.5px solid ${visibles.length ? C.indigo : C.borde}`, background: 'white', color: visibles.length ? C.indigo : C.suave, fontSize: 14, fontWeight: 700, cursor: visibles.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              {descargando === 'diario' ? 'Generando…' : 'Descargar Word de estas notas'}
            </button>
          </section>

          {notas !== null && dias.length === 0 && (
            <div style={card}><p style={{ margin: 0, fontSize: 14, color: C.suave }}>No hay notas con estos filtros.</p></div>
          )}

          {dias.map(g => (
            <section key={g.dia} style={card}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.indigo, letterSpacing: '0.04em' }}>{etiquetaDia(g.notas[0].sucedido_en)}</p>
              {g.notas.map(n => {
                const anulada = n.estado === 'anulada'
                const vs = versiones[n.id]
                return (
                  <div key={n.id} style={{ padding: '12px 0 10px 12px', borderTop: `1px solid ${C.indigoClaro}`, borderLeft: `3px solid ${n.tipo === 'incidente' ? C.franja : 'transparent'}` }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: n.tipo === 'incidente' ? C.ambar : C.indigo }}>
                      {n.destinatario === 'grupo' ? 'Todo el grupo' : n.destinatario} · {n.tipo === 'incidente' ? 'Incidente' : 'Observación'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: C.suave }}>
                      Sucedió {hora(n.sucedido_en)} · Registrada {fechaHora(n.registrado_en)}
                    </p>

                    {editando?.id === n.id ? (
                      <div style={{ marginTop: 8 }}>
                        <textarea value={editando.texto} onChange={e => setEditando({ id: n.id, texto: e.target.value })} rows={5} disabled={ocupado}
                          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1.5px solid ${C.borde}`, fontSize: 15, lineHeight: 1.5, fontFamily: 'inherit' }} />
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.suave }}>Se guardará como una versión nueva; la anterior se conserva.</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={guardarEdicion} disabled={ocupado}
                            style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', background: C.cianOscuro, color: 'white', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                            {ocupado ? 'Guardando…' : 'Guardar versión nueva'}
                          </button>
                          <button onClick={() => setEditando(null)} disabled={ocupado}
                            style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: `1.5px solid ${C.borde}`, background: 'white', color: C.suave, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: anulada ? C.suave : C.texto, textDecoration: anulada ? 'line-through' : 'none' }}>{n.texto}</p>
                    )}

                    {anulada && (
                      <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.ambar }}>
                        Anulada {n.anulada_en ? `el ${fechaHora(n.anulada_en)}` : ''} · Motivo: {n.motivo_anulacion}
                      </p>
                    )}

                    {anulando?.id === n.id && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: C.ambarFondo }}>
                        <label style={{ fontSize: 12.5, fontWeight: 700, color: C.ambar }}>¿Por qué anulas esta nota?</label>
                        <input value={anulando.motivo} onChange={e => setAnulando({ id: n.id, motivo: e.target.value })} disabled={ocupado} maxLength={300}
                          placeholder="Ej.: la registré en el código equivocado"
                          style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, minHeight: 44, padding: '0 10px', borderRadius: 8, border: `1.5px solid #F0DFA6`, fontSize: 14, fontFamily: 'inherit' }} />
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.ambar }}>La nota no se borra: queda visible como anulada.</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={confirmarAnulacion} disabled={ocupado || anulando.motivo.trim().length < 5}
                            style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', background: C.ambar, color: 'white', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', opacity: anulando.motivo.trim().length < 5 ? 0.5 : 1 }}>
                            {ocupado ? 'Anulando…' : 'Anular nota'}
                          </button>
                          <button onClick={() => setAnulando(null)} disabled={ocupado}
                            style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: `1.5px solid ${C.borde}`, background: 'white', color: C.suave, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {n.editada_en && (
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: C.suave }}>Editada · {fechaHora(n.editada_en)}</span>
                        <button onClick={() => verVersiones(n.id)} style={linkBtn}>{vs && vs !== 'cargando' ? 'Ocultar versiones' : 'Ver versiones'}</button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                      {!anulada && editando?.id !== n.id && anulando?.id !== n.id && (
                        <>
                          <button onClick={() => { setAnulando(null); setMensaje(null); setEditando({ id: n.id, texto: n.texto }) }} style={linkBtn}>Editar</button>
                          <button onClick={() => { setEditando(null); setMensaje(null); setAnulando({ id: n.id, motivo: '' }) }} style={{ ...linkBtn, color: C.ambar }}>Anular</button>
                        </>
                      )}
                      {n.tipo === 'incidente' && editando?.id !== n.id && anulando?.id !== n.id && (
                        <button onClick={() => descargarWord(`nota=${n.id}`, n.id)} disabled={!!descargando} style={{ ...linkBtn, color: C.ambar }}>
                          {descargando === n.id ? 'Generando…' : 'Reporte en Word'}
                        </button>
                      )}
                    </div>

                    {vs === 'cargando' && <p style={{ margin: 0, fontSize: 12.5, color: C.suave }}>Cargando versiones…</p>}
                    {Array.isArray(vs) && (
                      <div style={{ marginTop: 4, paddingLeft: 10, borderLeft: `2px solid ${C.indigoClaro}` }}>
                        {vs.map(v => (
                          <div key={v.numero} style={{ padding: '6px 0' }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.suave }}>
                              Versión {v.numero} · {v.origen === 'edicion' ? 'editada' : 'original'} · {fechaHora(v.creado_en)}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 13.5, color: C.texto, whiteSpace: 'pre-wrap' }}>{v.texto}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {mensaje?.id === n.id && (
                      <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 700, color: mensaje.tipo === 'ok' ? C.cianOscuro : C.ambar }}>{mensaje.texto}</p>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </div>
    </SidebarWrapper>
  )
}
