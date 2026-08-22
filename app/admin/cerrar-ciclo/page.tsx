// ============================================================
//  PlanIA Digital — Super Admin: Cerrar ciclo escolar
//  app/admin/cerrar-ciclo/page.tsx
//
//  Fase 2 del ciclo de vida de datos. Acción de dos partes:
//  (1) esta página limpia los datos en base de datos, vía
//      /api/admin/cerrar-ciclo
//  (2) el fundador debe editar CICLO_ESCOLAR_ACTIVO en el código
//      manualmente después — nunca se puede automatizar porque
//      es una constante de build-time, no un valor en la base
//      de datos. Esta página deja las instrucciones exactas.
// ============================================================
'use client'
import { useState } from 'react'
import { fetchAdmin } from '@/lib/fetchAdmin'

export default function CerrarCicloPage() {
  const [cicloACerrar, setCicloACerrar] = useState('2025-2026')
  const [confirmando, setConfirmando] = useState(false)
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; usuariosAfectados?: number } | null>(null)

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
      } else {
        setResultado({ ok: false, mensaje: data.error || 'Error desconocido al cerrar el ciclo.' })
      }
    } catch (e: any) {
      setResultado({ ok: false, mensaje: 'Error de conexión: ' + e.message })
    }
    setEjecutando(false)
    setConfirmando(false)
  }

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
          <li>No cambia <code>CICLO_ESCOLAR_ACTIVO</code> — ese paso es manual, y las instrucciones están más abajo.</li>
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

        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            disabled={!cicloACerrar.trim()}
            style={{
              background: cicloACerrar.trim() ? '#DC2626' : '#D1D5DB',
              color: 'white', border: 'none', padding: '10px 18px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: cicloACerrar.trim() ? 'pointer' : 'default',
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
            {resultado.ok && resultado.usuariosAfectados !== undefined && ` (${resultado.usuariosAfectados} cuentas afectadas)`}
          </p>
        </div>
      )}

      {/* Paso manual — SIEMPRE visible, no solo tras el cierre, para que puedas
          revisarlo con anticipación */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '16px 18px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 10px' }}>
          ⚠️ Paso 2 (manual, obligatorio) — actualizar el ciclo activo en el código
        </p>
        <p style={{ fontSize: 12, color: '#92400E', margin: '0 0 12px', lineHeight: 1.6 }}>
          Limpiar los datos NO cambia qué ciclo usa el generador. Ese valor vive en el código, no en la base de datos, así que tienes que editarlo tú mismo y desplegar.
        </p>
        <ol style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12, color: '#92400E', lineHeight: 1.9 }}>
          <li>Abre en VS Code el archivo: <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>lib/calendarioEscolar.ts</code></li>
          <li>Busca la línea: <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>export const CICLO_ESCOLAR_ACTIVO = '...'</code></li>
          <li>Cámbiala al ciclo nuevo, por ejemplo: <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>export const CICLO_ESCOLAR_ACTIVO = '2026-2027'</code></li>
          <li>Guarda el archivo, y en tu terminal corre:</li>
        </ol>
        <pre style={{ background: 'white', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#374151', margin: '0 0 12px', overflowX: 'auto' }}>
{`npx tsc --noEmit
git add .
git commit -m "Actualizar CICLO_ESCOLAR_ACTIVO a [nuevo ciclo]"
git push`}
        </pre>
        <p style={{ fontSize: 12, color: '#92400E', margin: 0, lineHeight: 1.6 }}>
          <strong>Cómo validar que quedó bien:</strong> espera a que el deploy diga "Ready" en Vercel, entra a cualquier cuenta de prueba en <code style={{ background: 'white', padding: '1px 5px', borderRadius: 4 }}>/mi-grupo</code>, y confirma que todas las tarjetas (PMC, PA, Diagnóstico Grupal, Individual, PDAs del jardín, Observaciones) muestren <strong>"Seleccionar"</strong> en vez de datos ya guardados — eso confirma que tanto la limpieza de datos como el cambio de ciclo activo quedaron sincronizados correctamente.
        </p>
      </div>
    </div>
  )
}