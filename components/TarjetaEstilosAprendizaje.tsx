'use client'
// ============================================================
//  PlanIA Digital — components/TarjetaEstilosAprendizaje.tsx
//  [Saneado 28 sep 2026 — Fase 2, Parte 10] Tarjeta 3.3 de Mi Grupo.
//  [Rediseño 30 sep 2026] Ahora dibuja su tarjeta completa con el mismo
//  lenguaje visual que el resto de Mi Grupo y "El alma de tu planeación"
//  (una columna, texto a la izquierda, estado ✓ guardado con borde cian).
//  La educadora escribe cuántos niños salieron kinestésicos, visuales y
//  auditivos. Opcional: si no la llena, no se bloquea nada. Solo se guarda
//  el resumen del grupo (sin datos por niño). Guarda en /api/estilos-aprendizaje.
// ============================================================
import { useState } from 'react'
import { fetchConSesion } from '@/lib/fetchConSesion'
import Icono from '@/components/Icono'

export type EstilosAprendizaje = {
  kinestesico: number
  visual: number
  auditivo: number
  total: number
  ciclo_escolar?: string
  fecha?: string | null
}

const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
  borde: '#E0DFF5',
}

// Paleta oficial: cian, índigo e índigo claro (sin naranja ni rojo).
const ESTILOS: { clave: 'kinestesico' | 'visual' | 'auditivo'; etiqueta: string; icono: string; color: string }[] = [
  { clave: 'kinestesico', etiqueta: 'Kinestésico', icono: 'hand', color: '#00A896' },
  { clave: 'visual', etiqueta: 'Visual', icono: 'eye', color: '#3D3A8C' },
  { clave: 'auditivo', etiqueta: 'Auditivo', icono: 'ear', color: '#9C99DB' },
]

function fechaCorta(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

const enlace: React.CSSProperties = {
  background: 'none', border: 'none', color: C.indigo, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', fontFamily: 'inherit',
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
  const vistaGuardada = !editando && !!guardado

  return (
    <div style={{
      background: vistaGuardada ? '#FAFFFE' : 'white',
      border: `1px solid ${vistaGuardada ? C.cian : C.borde}`,
      borderRadius: 12, padding: vistaGuardada ? '12px 16px' : 16, marginBottom: vistaGuardada ? 10 : 12,
    }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: vistaGuardada ? C.cian : C.indigo, textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1.4 }}>
        {vistaGuardada ? '✓ ' : ''}3.3 · Estilos de aprendizaje
        <span style={{ fontSize: 10, fontWeight: 600, color: C.gris, border: '1px solid #D8D6F0', borderRadius: 99, padding: '1px 8px', marginLeft: 8, letterSpacing: '0.04em', textTransform: 'none', verticalAlign: 'middle' }}>Opcional</span>
      </p>
      {!vistaGuardada && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: C.gris, lineHeight: 1.6 }}>
          ¿Cuántos niños salieron en cada estilo? MÍA equilibrará las actividades de tu grupo.
        </p>
      )}

      {editando && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
        {ESTILOS.map((e, i) => (
          <div key={e.clave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, color: C.texto, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: C.indigoClaro, color: e.color === '#9C99DB' ? C.indigo : e.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icono nombre={e.icono} tamano={16} /></span>
              {e.etiqueta}
            </span>
            {editando ? (
              <input
                type="number" min="0" max="60" inputMode="numeric"
                value={valores[e.clave]}
                onChange={ev => setValores(v => ({ ...v, [e.clave]: ev.target.value.replace(/[^0-9]/g, '') }))}
                style={{ width: 64, padding: '7px 8px', fontSize: 16, borderRadius: 8, border: `1px solid ${C.borde}`, textAlign: 'center' }}
              />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, color: e.color === '#9C99DB' ? C.indigo : e.color, minWidth: 64, textAlign: 'right' }}>
                {[guardado?.kinestesico, guardado?.visual, guardado?.auditivo][i] ?? 0} · {pct([guardado?.kinestesico || 0, guardado?.visual || 0, guardado?.auditivo || 0][i])}%
              </span>
            )}
          </div>
        ))}
      </div>}

      {/* [oct 2026] Vista guardada compacta: fecha + Actualizar en una línea; luego predominante, barra y detalle */}
      {vistaGuardada && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px 16px', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: C.gris }}>{guardado?.fecha ? `Guardado el ${fechaCorta(guardado.fecha)}` : 'Guardado'}</span>
          <button type="button" onClick={() => setEditando(true)} style={{ ...enlace, fontSize: 14 }}>Actualizar</button>
        </div>
      )}
      {/* [oct 2026] Los tres estilos en una fila: ícono, nombre en negrita, alumnos y %.
          El que predomina lleva la etiqueta "Predomina". */}
      {vistaGuardada && guardado && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 18px' }}>
          {ESTILOS.map((e, i) => {
            const n = [guardado.kinestesico, guardado.visual, guardado.auditivo][i] || 0
            const esPred = !!predominante && predominante.n > 0 && predominante.e.clave === e.clave
            const colorIcono = e.color === '#9C99DB' ? C.indigo : e.color
            return (
              <span key={e.clave} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.texto }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: esPred ? C.cian : 'white', border: esPred ? 'none' : `1.5px solid ${C.borde}`, boxShadow: esPred ? 'none' : '0 1px 3px rgba(61,58,140,0.10)', boxSizing: 'border-box', color: esPred ? 'white' : C.indigo }}>
                  <Icono nombre={e.icono} tamano={17} />
                </span>
                <span>
                  <strong>{e.etiqueta}</strong> <span style={{ color: C.gris }}>{n} ({pct(n)}%)</span>
                  {esPred && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#0F6E56', background: '#E0F5F3', borderRadius: 10, padding: '1px 7px' }}>Predomina</span>}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {total > 0 && mostrar && (
        <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', margin: '12px 0 6px', maxWidth: 360, background: C.indigoClaro }}>
          {ESTILOS.map((e, i) => {
            const n = [mostrar.kinestesico, mostrar.visual, mostrar.auditivo][i]
            return n > 0 ? <div key={e.clave} title={`${e.etiqueta} ${pct(n)}%`} style={{ width: `${pct(n)}%`, background: e.color }} /> : null
          })}
        </div>
      )}

      {editando ? (
        <>
          <p style={{ fontSize: 12, margin: '6px 0 10px', color: excede ? C.indigo : C.gris, fontWeight: excede ? 700 : 400 }}>
            {totalAlumnos > 0
              ? `${suma} de ${totalAlumnos} alumnos${suma === totalAlumnos ? ' ✓' : excede ? ' · la suma pasa de tu grupo' : ` · faltan ${totalAlumnos - suma}`}`
              : `${suma} alumnos`}
          </p>
          <button type="button" onClick={guardar} disabled={guardando || suma === 0 || excede}
            style={{ width: '100%', background: suma === 0 || excede ? '#B9B9C9' : C.cian, color: 'white', border: 'none', padding: '12px 14px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: suma === 0 || excede ? 'default' : 'pointer' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          {guardado && (
            <button type="button" onClick={() => { setEditando(false); setError('') }} style={{ ...enlace, marginTop: 8 }}>
              Cancelar
            </button>
          )}
        </>
      ) : (
        null
      )}
      {error && <p style={{ margin: '8px 0 0', fontSize: 13, color: C.indigo, background: C.indigoClaro, borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>{error}</p>}
    </div>
  )
}
