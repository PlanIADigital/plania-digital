'use client'
// ============================================================
//  PlanIA Digital — components/TarjetaAsistencia.tsx
//  [2 oct 2026] Asistencia diaria de la educadora (Dashboard).
//  Solo cantidades. Arranca con todos presentes; – / + ajusta (el + se
//  deshabilita en el total de la lista, el – en 0); Enviar guarda vía
//  /api/asistencia (hoy o el día hábil anterior). Un niño nuevo se
//  registra como "alta" en Mi grupo, nunca sumando aquí.
// ============================================================
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', cianOscuro: '#00806F',
  texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5',
}

type Registro = { fecha: string; presentes: number; total: number; actualizado_en: string }
type Estado = {
  hoy: string; anterior: string; hoyEsHabil: boolean
  grado: string | null; grupo_letra: string | null; total: number
  registroHoy: Registro | null; registroAnterior: Registro | null
}

function nombreDia(fecha: string, conFecha = false): string {
  const f = new Date(`${fecha}T12:00:00Z`)
  const op: Intl.DateTimeFormatOptions = conFecha
    ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
    : { weekday: 'long', timeZone: 'UTC' }
  const t = new Intl.DateTimeFormat('es-MX', op).format(f)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

async function token(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export default function TarjetaAsistencia() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [error, setError] = useState('')
  const [fecha, setFecha] = useState<string>('')
  const [presentes, setPresentes] = useState(0)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const t = await token()
    if (!t) return
    try {
      const res = await fetch('/api/asistencia', { headers: { Authorization: `Bearer ${t}` } })
      const d = await res.json()
      if (!res.ok) { setError(d?.error || 'No se pudo cargar la asistencia.'); return }
      setEstado(d)
      const f = d.hoyEsHabil ? d.hoy : d.anterior
      const r = f === d.hoy ? d.registroHoy : d.registroAnterior
      setFecha(f)
      setPresentes(r ? r.presentes : d.total)
      setEditando(!r)
    } catch { setError('No se pudo conectar con el servidor.') }
  }
  useEffect(() => { cargar() }, [])

  function elegir(f: string) {
    if (!estado) return
    const r = f === estado.hoy ? estado.registroHoy : estado.registroAnterior
    setFecha(f)
    setPresentes(r ? r.presentes : estado.total)
    setEditando(true)
    setError('')
  }

  async function enviar() {
    const t = await token()
    if (!t || !estado) return
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ fecha, presentes }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d?.error || 'No se pudo guardar.'); setGuardando(false); return }
      setEstado(prev => prev ? (fecha === prev.hoy ? { ...prev, registroHoy: d.registro } : { ...prev, registroAnterior: d.registro }) : prev)
      setEditando(false)
    } catch { setError('No se pudo conectar con el servidor.') }
    setGuardando(false)
  }

  const card: React.CSSProperties = { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12 }
  const titulo: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 800, color: C.texto, textTransform: 'uppercase', letterSpacing: '0.07em' }
  const btnRedondo: React.CSSProperties = { width: 48, height: 48, borderRadius: 12, border: `1.5px solid ${C.indigo}`, background: 'white', color: C.indigo, fontSize: 24, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
  const tenue: React.CSSProperties = { opacity: 0.35, cursor: 'default' }

  if (!estado) return error ? <div style={card}><p style={{ margin: 0, fontSize: 14, color: C.suave }}>{error}</p></div> : null

  const sinGrupo = !estado.grado || estado.total <= 0
  const registro = fecha === estado.hoy ? estado.registroHoy : estado.registroAnterior
  const pendienteAnterior = !estado.registroAnterior && fecha !== estado.anterior
  const enMinimo = presentes <= 0
  const enMaximo = presentes >= estado.total

  return (
    <section style={card} aria-label="Asistencia del día">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={titulo}>{fecha === estado.hoy ? 'Asistencia de hoy' : `Asistencia del ${nombreDia(fecha).toLowerCase()}`}</h2>
      </div>

      {sinGrupo ? (
        <p style={{ margin: '6px 0 0', fontSize: 14, color: C.suave, lineHeight: 1.5 }}>
          Para enviar la asistencia, primero configura tu grupo y tu lista de alumnos en{' '}
          <button onClick={() => router.push('/mi-grupo')} style={{ background: 'none', border: 'none', padding: 0, color: C.indigo, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Mi grupo</button>.
        </p>
      ) : !estado.hoyEsHabil && fecha === estado.hoy ? (
        <p style={{ margin: '6px 0 0', fontSize: 14, color: C.suave }}>Hoy no hay clases.</p>
      ) : !editando && registro ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <p style={{ margin: 0, fontSize: 15, color: C.texto }}>
            <span style={{ color: C.cianOscuro, fontWeight: 800 }}>✓ Enviada</span> · {registro.presentes} de {registro.total} niños
          </p>
          <button onClick={() => setEditando(true)} style={{ background: 'none', border: 'none', color: C.indigo, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 14, minHeight: 44, fontFamily: 'inherit' }}>Corregir</button>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: registro ? C.indigo : C.suave, fontWeight: registro ? 600 : 400 }}>
            {registro
              ? `Corrigiendo: enviaste ${registro.presentes} de ${registro.total}. Ajusta el número y guarda.`
              : `${fecha === estado.hoy ? '' : `${nombreDia(fecha, true)} · `}¿Cuántos niños asistieron?`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button aria-label="Uno menos" onClick={() => setPresentes(p => Math.max(0, p - 1))} disabled={guardando || enMinimo}
              style={{ ...btnRedondo, ...(enMinimo ? tenue : {}) }}>–</button>
            <div style={{ minWidth: 86, textAlign: 'center' }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: C.texto, lineHeight: 1 }}>{presentes}</span>
              <span style={{ fontSize: 15, color: C.suave }}> de {estado.total}</span>
            </div>
            <button aria-label="Uno más" onClick={() => setPresentes(p => Math.min(estado.total, p + 1))} disabled={guardando || enMaximo}
              title={enMaximo ? 'Están todos los alumnos de tu lista' : undefined}
              style={{ ...btnRedondo, ...(enMaximo ? tenue : {}) }}>+</button>
            <button onClick={enviar} disabled={guardando}
              style={{ marginLeft: 'auto', minHeight: 48, padding: '0 22px', background: C.cianOscuro, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.7 : 1, fontFamily: 'inherit' }}>
              {guardando ? 'Guardando…' : registro ? 'Guardar' : 'Enviar'}
            </button>
          </div>
          {registro && (
            <button onClick={() => { setPresentes(registro.presentes); setEditando(false); setError('') }} disabled={guardando}
              style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: C.suave, fontSize: 13.5, textDecoration: 'underline', cursor: 'pointer', minHeight: 36, fontFamily: 'inherit' }}>
              Cancelar
            </button>
          )}
        </>
      )}

      {error && <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#8B3A3E' }}>{error}</p>}

      {!sinGrupo && pendienteAnterior && (
        <button onClick={() => elegir(estado.anterior)}
          style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, color: C.indigo, fontSize: 13.5, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', minHeight: 36, fontFamily: 'inherit' }}>
          ¿Olvidaste el {nombreDia(estado.anterior).toLowerCase()}? Enviarla ahora
        </button>
      )}
      {!sinGrupo && fecha !== estado.hoy && estado.hoyEsHabil && (
        <button onClick={() => elegir(estado.hoy)}
          style={{ marginTop: 10, marginLeft: pendienteAnterior ? 16 : 0, background: 'none', border: 'none', padding: 0, color: C.indigo, fontSize: 13.5, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', minHeight: 36, fontFamily: 'inherit' }}>
          Volver a hoy
        </button>
      )}
    </section>
  )
}
