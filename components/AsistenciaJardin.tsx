'use client'
// ============================================================
//  PlanIA Digital — components/AsistenciaJardin.tsx
//  [2 oct 2026] Asistencia del jardín en el Dashboard del directivo:
//  hoy por grupo (+ copiar reporte para WhatsApp) y semana en curso.
//  Datos: /api/directivo/asistencia (solo cantidades). SOLO LECTURA.
// ============================================================
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', verde: '#00897A', verdeOscuro: '#00806F',
  texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5', linea: '#E5E7EB',
}

type Grupo = { grupo: string; docente: string; presentes: number | null; total: number | null }
type Dia = { fecha: string; presentes: number; total: number; grupos: number; sinClases?: string | null }
type Datos = { hoy: string; grupos: Grupo[]; semana: Dia[]; motivoHoy?: string | null }

const card: React.CSSProperties = { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px', minWidth: 0 }
const h2: React.CSSProperties = { margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.texto, textTransform: 'uppercase', letterSpacing: '0.07em' }
const sub: React.CSSProperties = { margin: '0 0 12px', fontSize: 13, color: C.suave, lineHeight: 1.4 }

function fechaLarga(f: string): string {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${f}T12:00:00Z`))
}
function diaCorto(f: string): string {
  const t = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${f}T12:00:00Z`)).replace('.', '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const pct = (p: number, t: number) => (t > 0 ? Math.round((p / t) * 100) : 0)

export default function AsistenciaJardin({ jardin }: { jardin: string }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/directivo/asistencia', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const d = await res.json()
        if (!res.ok) setError(d?.error || 'No se pudo cargar la asistencia.')
        else setDatos(d)
      } catch { setError('No se pudo conectar con el servidor.') }
    }
    cargar()
  }, [])

  if (error) return <section style={card}><h2 style={h2}>Asistencia</h2><p style={sub}>{error}</p></section>
  if (!datos) return null

  const reportaron = datos.grupos.filter(g => g.presentes !== null)
  const presentesHoy = reportaron.reduce((s, g) => s + (g.presentes || 0), 0)
  const totalHoy = reportaron.reduce((s, g) => s + (g.total || 0), 0)

  async function copiarReporte() {
    if (!datos) return
    const lineas = [
      `Asistencia del ${fechaLarga(datos.hoy)}${jardin ? ` — ${jardin}` : ''}`,
      ...datos.grupos.map(g => `${g.grupo}: ${g.presentes !== null ? `${g.presentes} de ${g.total}` : 'sin reporte'}`),
      `Total: ${presentesHoy} de ${totalHoy} (${pct(presentesHoy, totalHoy)}%)`,
    ]
    try {
      await navigator.clipboard.writeText(lineas.join('\n'))
      setCopiado(true)
    } catch {
      setError('No se pudo copiar. Intenta de nuevo.')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
      {/* Hoy */}
      <section style={card}>
        <h2 style={h2}>Asistencia de hoy</h2>
        <p style={sub}>{fechaLarga(datos.hoy).charAt(0).toUpperCase() + fechaLarga(datos.hoy).slice(1)}</p>
        {datos.motivoHoy && reportaron.length === 0 ? (
          <p style={{ ...sub, margin: 0 }}>Hoy no hay clases ({datos.motivoHoy}).</p>
        ) : datos.grupos.length === 0 ? (
          <p style={{ ...sub, margin: 0 }}>Aparecerá cuando las docentes configuren su grupo.</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: C.texto, lineHeight: 1 }}>{presentesHoy}</span>
              <span style={{ fontSize: 14, color: C.suave }}>de {totalHoy} niños · {reportaron.length} de {datos.grupos.length} grupos reportaron</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datos.grupos.map(g => {
                const sin = g.presentes === null
                return (
                  <div key={`${g.grupo}-${g.docente}`} title={g.docente}
                    style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 84px', alignItems: 'center', gap: 10, fontSize: 13.5, color: sin ? '#9CA3AF' : C.texto }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{g.grupo}</span>
                    {sin
                      ? <div style={{ height: 10, border: '1px dashed #D1D5DB', borderRadius: 99, boxSizing: 'border-box' }} />
                      : <div style={{ height: 10, background: C.indigoClaro, borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${pct(g.presentes || 0, g.total || 0)}%`, height: '100%', background: C.verde, borderRadius: 99 }} />
                        </div>}
                    <span style={{ textAlign: 'right', color: C.suave }}>{sin ? 'Sin reporte' : `${g.presentes}/${g.total}`}</span>
                  </div>
                )
              })}
            </div>
            <button onClick={copiarReporte} disabled={reportaron.length === 0}
              style={{
                marginTop: 14, width: '100%', minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                cursor: reportaron.length ? 'pointer' : 'default', opacity: reportaron.length ? 1 : 0.5,
                ...(copiado
                  ? { background: C.verdeOscuro, color: 'white', border: `1.5px solid ${C.verdeOscuro}` }
                  : { background: 'white', color: C.indigo, border: `1.5px solid ${C.indigo}` }),
              }}>
              {copiado ? '✓ Reporte copiado' : 'Copiar reporte del día'}
            </button>
            {copiado && (
              <p role="status" style={{ margin: '8px 0 0', fontSize: 13, color: C.verdeOscuro, fontWeight: 600, textAlign: 'center' }}>
                Listo para pegar en WhatsApp.
              </p>
            )}
          </>
        )}
      </section>

      {/* Semana */}
      <section style={card}>
        <h2 style={h2}>Asistencia de la semana</h2>
        <p style={sub}>Porcentaje del jardín por día</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, alignItems: 'end', height: 170, borderBottom: `1px solid ${C.linea}`, padding: '0 4px' }}>
          {datos.semana.map(d => {
            const futuro = d.fecha > datos.hoy
            const libre = !futuro && !!d.sinClases && d.grupos === 0
            const sin = !futuro && !libre && d.grupos === 0
            const p = pct(d.presentes, d.total)
            return (
              <div key={d.fecha} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
                {!futuro && !sin && <span style={{ fontSize: 12, fontWeight: 700, color: C.texto }}>{p}%</span>}
                {sin && <span style={{ fontSize: 11, color: '#9CA3AF' }}>—</span>}
                {libre && <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>{d.sinClases}</span>}
                <div title={futuro ? '' : sin ? 'Sin reporte' : `${diaCorto(d.fecha)}: ${d.presentes} de ${d.total} (${p}%)`}
                  style={{
                    width: '70%', borderRadius: '4px 4px 0 0',
                    height: futuro || libre ? 0 : sin ? '24%' : `${Math.max(p, 2) * 0.82}%`,
                    background: sin ? 'transparent' : C.verde,
                    border: sin ? '1px dashed #D1D5DB' : 'none', borderBottom: 'none', boxSizing: 'border-box',
                  }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, padding: '6px 4px 0', fontSize: 12.5, textAlign: 'center' }}>
          {datos.semana.map(d => (
            <span key={d.fecha} style={{ color: d.fecha === datos.hoy ? C.texto : C.suave, fontWeight: d.fecha === datos.hoy ? 800 : 400 }}>{diaCorto(d.fecha)}</span>
          ))}
        </div>
      </section>
    </div>
  )
}
