// ============================================================
//  PlanIA Digital — Super Admin: Cerrar ciclo escolar
//  app/admin/cerrar-ciclo/page.tsx
//
//  Fase 2 del ciclo de vida de datos. Acción de dos partes:
//  (1) esta página limpia los datos en base de datos, vía
//      /api/admin/cerrar-ciclo
//  (2) [Saneado 27 sep 2026 — Fase 2] Ya no hay paso manual: el ciclo
//      activo cambia solo el 1 de agosto (lib/calendarioEscolar.ts).
//      Esta página propone por defecto el ciclo ANTERIOR al activo y
//      no permite cerrar el activo.
//
//  [sep 2026] Tras un cierre exitoso, el botón deja de verse como
//  advertencia roja (invitando a repetir la acción) y pasa a un
//  estado neutro "ya cerrado" — antes volvía al mismo rojo de
//  siempre, como si nada hubiera pasado, aunque el backend ya
//  fuera a rechazar un segundo intento para ese mismo ciclo.
// ============================================================
'use client'
import { useState, useEffect } from 'react'
import { fetchAdmin } from '@/lib/fetchAdmin'
import { CICLO_ESCOLAR_ACTIVO, cicloAnterior } from '@/lib/calendarioEscolar'

export default function CerrarCicloPage() {
  const [cicloACerrar, setCicloACerrar] = useState(cicloAnterior(CICLO_ESCOLAR_ACTIVO))
  const [confirmando, setConfirmando] = useState(false)
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; usuariosAfectados?: number } | null>(null)
  // [sep 2026] Lista de ciclos ya cerrados según la base de datos —
  // se consulta al cargar la página, así el botón sabe si mostrarse
  // como "ya cerrado" desde el primer render, sin depender de que el
  // cierre haya ocurrido en esta misma sesión del navegador.
  const [ciclosCerrados, setCiclosCerrados] = useState<string[]>([])
  const [cargandoCiclos, setCargandoCiclos] = useState(true)

  useEffect(() => {
    async function cargarCiclosCerrados() {
      try {
        const res = await fetchAdmin('/api/admin/cierres-ciclo')
        const data = await res.json()
        if (data.ok) setCiclosCerrados((data.ciclosCerrados || []).map((c: any) => c.ciclo_cerrado))
      } catch {
        // silencioso -- si falla, el botón simplemente se comporta como si
        // ningún ciclo estuviera cerrado todavía; el backend igual protege
        // contra un doble cierre real al momento de intentarlo
      }
      setCargandoCiclos(false)
    }
    cargarCiclosCerrados()
  }, [])

  async function ejecutarCierre() {
    setEjecutando(true)
    setResultado(null)
    try {
      const res = await fetchAdmin('/api/admin/cerrar-ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_a_cerrar: cicloACerrar }),
      })
      const data = await res.json()
        if (data.ok) {
        setResultado({
          ok: true,
          mensaje: `Ciclo ${data.ciclo_cerrado} cerrado correctamente.`,
          usuariosAfectados: data.usuarios_afectados,
        })
        setCiclosCerrados(prev => [...prev, data.ciclo_cerrado])
      } else {
        setResultado({ ok: false, mensaje: data.error || 'Error desconocido al cerrar el ciclo.' })
      }
    } catch (e: any) {
      setResultado({ ok: false, mensaje: 'Error de conexión: ' + e.message })
    }
    setEjecutando(false)
    setConfirmando(false)
  }

    const yaCerradoAhora = cicloACerrar.trim() && ciclosCerrados.includes(cicloACerrar.trim())
  // No se puede cerrar el ciclo activo ni uno posterior (borraría Mi Grupo a mitad del ciclo).
  const cicloNoCerrable = !!cicloACerrar.trim() && cicloACerrar.trim() >= CICLO_ESCOLAR_ACTIVO

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Cerrar ciclo escolar</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
        Congela los diagnósticos del ciclo que termina y limpia los campos activos de todas las cuentas, para que las educadoras empiecen el ciclo nuevo con Mi Grupo en blanco.
      </p>

      {/* Explicación de qué hace, ANTES del formulario */}
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: '#3730A3', margin: '0 0 8px', fontWeight: 600 }}>Qué hace esta acción:</p>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#3730A3', lineHeight: 1.8 }}>
          <li>No borra nada del historial — cada diagnóstico ya queda preservado en <code>documentos_historial</code>, etiquetado con su ciclo real.</li>
          <li>Limpia a vacío PMC, PA, Diagnóstico Grupal, Diagnóstico Individual, PDAs del jardín y Observaciones directivas de <strong>todas</strong> las cuentas, de golpe.</li>
          <li>No cambia el ciclo activo: ese cambia solo el <strong>1 de agosto</strong> (hoy es <strong>{CICLO_ESCOLAR_ACTIVO}</strong>). Solo se puede cerrar un ciclo <strong>anterior</strong> al activo.</li>
          <li>Solo se puede ejecutar <strong>una vez</strong> por ciclo — si ya se cerró, el sistema lo rechaza.</li>
        </ul>
      </div>

      {/* Formulario */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Ciclo escolar que está terminando (el que se va a cerrar/congelar)
        </label>
        <input
          type="text"
          value={cicloACerrar}
          onChange={e => { setCicloACerrar(e.target.value); setConfirmando(false); setResultado(null) }}
          placeholder="Ej. 2025-2026"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
        />
        {cicloNoCerrable && (
          <p style={{ fontSize: 12, color: '#991B1B', margin: '-8px 0 14px' }}>
            {cicloACerrar.trim()} es el ciclo activo (o uno posterior): no se puede cerrar. Solo se cierran ciclos anteriores a {CICLO_ESCOLAR_ACTIVO}.
          </p>
        )}

        {yaCerradoAhora ? (
          <button
            disabled
            style={{
              background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7',
              padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'default',
            }}
          >
            ✅ Ciclo {cicloACerrar} ya cerrado
          </button>
        ) : !confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            disabled={!cicloACerrar.trim() || cicloNoCerrable}
            style={{
              background: cicloACerrar.trim() && !cicloNoCerrable ? '#DC2626' : '#D1D5DB',
              color: 'white', border: 'none', padding: '10px 18px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: cicloACerrar.trim() && !cicloNoCerrable ? 'pointer' : 'default',
            }}
          >
            Cerrar ciclo {cicloACerrar}
          </button>
        ) : (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, color: '#991B1B', fontWeight: 700, margin: '0 0 6px' }}>
              ¿Confirmas cerrar el ciclo {cicloACerrar}?
            </p>
            <p style={{ fontSize: 12, color: '#991B1B', margin: '0 0 14px' }}>
              Esto limpia los datos activos de <strong>todas las cuentas</strong> ahora mismo. No se puede deshacer, y no se podrá repetir para este mismo ciclo.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={ejecutarCierre}
                disabled={ejecutando}
                style={{ background: '#DC2626', color: 'white', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: ejecutando ? 'default' : 'pointer', opacity: ejecutando ? 0.6 : 1 }}
              >
                {ejecutando ? 'Cerrando...' : 'Sí, cerrar ahora'}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                disabled={ejecutando}
                style={{ background: 'white', border: '1px solid #D1D5DB', color: '#374151', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: ejecutando ? 'default' : 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resultado */}
      {resultado && (
        <div style={{
          background: resultado.ok ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${resultado.ok ? '#6EE7B7' : '#FECACA'}`,
          borderRadius: 10, padding: '14px 16px', marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: resultado.ok ? '#065F46' : '#991B1B', margin: '0 0 4px' }}>
            {resultado.ok ? '✅ Cierre completado' : '❌ No se pudo completar'}
          </p>
          <p style={{ fontSize: 12, color: resultado.ok ? '#065F46' : '#991B1B', margin: 0 }}>
            {resultado.mensaje}
            {resultado.ok && resultado.usuariosAfectados !== undefined && ` (${resultado.usuariosAfectados} cuentas actualizadas)`}
          </p>
        </div>
      )}

      {/* [Saneado 27 sep 2026 — Fase 2] Cambio de ciclo automático (antes: paso manual en el código) */}
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '16px 18px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#3730A3', margin: '0 0 10px' }}>
          🔄 Cambio de ciclo automático · ciclo activo hoy: {CICLO_ESCOLAR_ACTIVO}
        </p>
        <ol style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12, color: '#3730A3', lineHeight: 1.9 }}>
          <li>El <strong>1 de agosto</strong> (hora del centro de México) el ciclo activo cambia solo. No hay que editar código ni desplegar.</li>
          <li>Después del 1 de agosto, entra a esta página: ya propone el ciclo que terminó. Ciérralo antes de que las educadoras regresen (CTE intensivo).</li>
          <li>Al cerrar, el ciclo nuevo queda marcado como actual en <code>school_years</code>.</li>
        </ol>
        <p style={{ fontSize: 12, color: '#3730A3', margin: '0 0 10px', lineHeight: 1.6 }}>
          <strong>Emergencia</strong> (solo si la SEP cambiara las fechas): en Vercel → Settings → Environment Variables, crea{' '}
          <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>NEXT_PUBLIC_CICLO_ESCOLAR_FORZADO</code> con el ciclo
          (ej. <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>2027-2028</code>) y vuelve a desplegar. Bórrala cuando ya no haga falta.
        </p>
        <p style={{ fontSize: 12, color: '#3730A3', margin: 0, lineHeight: 1.6 }}>
          <strong>Cómo validar el cierre:</strong> entra a una cuenta de prueba en <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>/mi-grupo</code> y confirma que todas las tarjetas (PMC, PA, Diagnóstico Grupal, Individual, PDAs del jardín, Observaciones) muestren <strong>"Seleccionar"</strong> y que Configura tu grupo pida grado, grupo y alumnos.
        </p>
      </div>
    </div>
  )
}