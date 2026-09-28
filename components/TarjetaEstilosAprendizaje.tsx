'use client'
// ============================================================
//  PlanIA Digital — components/TarjetaEstilosAprendizaje.tsx
//  [Saneado 28 sep 2026 — Fase 2, Parte 10] Tarjeta 3.3 de Mi Grupo.
//  La educadora escribe cuántos niños salieron kinestésicos, visuales y
//  auditivos. Opcional: si no la llena, no se bloquea nada. Solo se guarda
//  el resumen del grupo (sin datos por niño). Guarda en /api/estilos-aprendizaje.
// ============================================================
import { useState } from 'react'
import { fetchConSesion } from '@/lib/fetchConSesion'

export type EstilosAprendizaje = {
  kinestesico: number
  visual: number
  auditivo: number
  total: number
  ciclo_escolar?: string
  fecha?: string | null
}

const ESTILOS: { clave: 'kinestesico' | 'visual' | 'auditivo'; etiqueta: string; icono: string; color: string }[] = [
  { clave: 'kinestesico', etiqueta: 'Kinestésico', icono: '🏃', color: '#00A896' },
  { clave: 'visual', etiqueta: 'Visual', icono: '👁️', color: '#3D3A8C' },
  { clave: 'auditivo', etiqueta: 'Auditivo', icono: '👂', color: '#F59E0B' },
]

function fechaCorta(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TarjetaEstilosAprendizaje({
  guardado,
  totalAlumnos,
  onGuardado,
}: {
  guardado: EstilosAprendizaje | null
  totalAlumnos: number
  onGuardado: (estilos: EstilosAprendizaje) => void
}) {
  const [editando, setEditando] = useState(!guardado)
  const [valores, setValores] = useState<Record<string, string>>({
    kinestesico: guardado ? String(guardado.kinestesico) : '',
    visual: guardado ? String(guardado.visual) : '',
    auditivo: guardado ? String(guardado.auditivo) : '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const numeros = ESTILOS.map(e => {
    const n = parseInt(valores[e.clave] || '0', 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  })
  const suma = numeros.reduce((a, b) => a + b, 0)
  const mostrar = editando ? { kinestesico: numeros[0], visual: numeros[1], auditivo: numeros[2], total: suma } : guardado
  const excede = totalAlumnos > 0 && suma > totalAlumnos

  async function guardar() {
    setError('')
    if (suma === 0) { setError('Escribe al menos un alumno en algún estilo.'); return }
    if (excede) { setError(`La suma (${suma}) pasa del total de tu grupo (${totalAlumnos}).`); return }
    setGuardando(true)
    try {
      const res = await fetchConSesion('/api/estilos-aprendizaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kinestesico: numeros[0], visual: numeros[1], auditivo: numeros[2] }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error || 'No se pudo guardar.'); setGuardando(false); return }
      onGuardado(json.estilos)
      setEditando(false)
    } catch {
      setError('Error de conexión.')
    }
    setGuardando(false)
  }

  const total = mostrar?.total || 0
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  const predominante = mostrar && total > 0
    ? ESTILOS.map((e, i) => ({ e, n: [mostrar.kinestesico, mostrar.visual, mostrar.auditivo][i] })).sort((a, b) => b.n - a.n)[0]
    : null

  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
        3.3 · Estilos de aprendizaje <span style={{ fontSize: 9, color: '#888', border: '1px solid #D8D6F0', borderRadius: 10, padding: '1px 6px', marginLeft: 4 }}>OPCIONAL</span>
      </p>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5 }}>
        ¿Cuántos niños salieron en cada estilo?<br />MÍA equilibrará las actividades de tu grupo.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', margin: '0 auto', width: '100%', maxWidth: 260 }}>
        {ESTILOS.map((e, i) => (
          <div key={e.clave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#1A1A2E' }}>{e.icono} {e.etiqueta}</span>
            {editando ? (
              <input
                type="number" min="0" max="60" inputMode="numeric"
                value={valores[e.clave]}
                onChange={ev => setValores(v => ({ ...v, [e.clave]: ev.target.value.replace(/[^0-9]/g, '') }))}
                style={{ width: 56, padding: '5px 8px', fontSize: 13, borderRadius: 8, border: '1.5px solid #D8D6F0', textAlign: 'center' }}
              />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: e.color, minWidth: 56, textAlign: 'center' }}>
                {[guardado?.kinestesico, guardado?.visual, guardado?.auditivo][i] ?? 0} · {pct([guardado?.kinestesico || 0, guardado?.visual || 0, guardado?.auditivo || 0][i])}%
              </span>
            )}
          </div>
        ))}
      </div>

      {total > 0 && mostrar && (
        <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', margin: '12px auto 6px', width: '100%', maxWidth: 260, background: '#EEEDF8' }}>
          {ESTILOS.map((e, i) => {
            const n = [mostrar.kinestesico, mostrar.visual, mostrar.auditivo][i]
            return n > 0 ? <div key={e.clave} title={`${e.etiqueta} ${pct(n)}%`} style={{ width: `${pct(n)}%`, background: e.color }} /> : null
          })}
        </div>
      )}

      {editando ? (
        <>
          <p style={{ fontSize: 11, margin: '4px 0 8px', color: excede ? '#991B1B' : '#888' }}>
            {totalAlumnos > 0
              ? `${suma} de ${totalAlumnos} alumnos${suma === totalAlumnos ? ' ✓' : excede ? ' · la suma pasa de tu grupo' : ` · faltan ${totalAlumnos - suma}`}`
              : `${suma} alumnos`}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {guardado && (
              <button type="button" onClick={() => { setEditando(false); setError('') }}
                style={{ background: 'white', color: '#3D3A8C', border: '1px solid #E0DFF5', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
            )}
            <button type="button" onClick={guardar} disabled={guardando || suma === 0 || excede}
              style={{ background: suma === 0 || excede ? '#D1D5DB' : '#3D3A8C', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: suma === 0 || excede ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ background: '#E8F5F2', border: '1.5px solid #00A896', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#0F6E56', fontSize: 12 }}>✅ Estilos guardados</p>
          {guardado?.fecha && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>Guardado el {fechaCorta(guardado.fecha)}</p>}
          {predominante && predominante.n > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#0F6E56' }}>
              Predomina: {predominante.e.icono} {predominante.e.etiqueta} ({pct(predominante.n)}%)
            </p>
          )}
          <button type="button" onClick={() => setEditando(true)}
            style={{ background: 'none', border: 'none', color: '#0F6E56', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 6 }}>
            ↑ Actualizar
          </button>
        </div>
      )}
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginTop: 8 }}>{error}</div>}
    </div>
  )
}
