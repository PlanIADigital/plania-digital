// ============================================================
//  PlanIA Digital — Super Admin: Catálogo CCTs
//  app/admin/cct/page.tsx
// ============================================================
'use client'
import { useState, useEffect } from 'react'
import { fetchAdmin } from '@/lib/fetchAdmin'

type EstadoCatalogo = {
  archivo_nombre: string
  registros_count: number
  fecha_actualizacion: string
  actualizado_por: string | null
} | null

export default function CatalogoPage() {
  const [cct, setCct] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [estado, setEstado] = useState<EstadoCatalogo>(null)
  const [cargandoEstado, setCargandoEstado] = useState(true)

  const [mostrarFormActualizar, setMostrarFormActualizar] = useState(false)
  const [nuevoArchivo, setNuevoArchivo] = useState('')
  const [nuevoConteo, setNuevoConteo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarEstado()
  }, [])

  async function cargarEstado() {
    setCargandoEstado(true)
    try {
      const res = await fetchAdmin('/api/admin/cct-catalogo-estado')
      const json = await res.json()
      setEstado(json.data || null)
    } catch {
      setEstado(null)
    }
    setCargandoEstado(false)
  }

  async function verificarCCT() {
    if (!cct.trim()) return
    setLoading(true)
    setError('')
    setResultado(null)
    try {
      const res = await fetch(`/api/decodificar-cct?cct=${cct.trim().toUpperCase()}`)
      const data = await res.json()
      if (data.error) { setError('CCT no encontrado en el catálogo.'); }
      else { setResultado(data) }
    } catch {
      setError('Error al consultar el catálogo.')
    }
    setLoading(false)
  }

  async function marcarActualizado() {
    if (!nuevoArchivo.trim() || !nuevoConteo.trim()) return
    setGuardando(true)
    try {
      const res = await fetchAdmin('/api/admin/cct-catalogo-estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivo_nombre: nuevoArchivo.trim(),
          registros_count: parseInt(nuevoConteo.replace(/[^\d]/g, ''), 10),
        }),
      })
      const json = await res.json()
      if (!json.error) {
        setEstado(json.data)
        setMostrarFormActualizar(false)
        setNuevoArchivo('')
        setNuevoConteo('')
      }
    } catch {
      // silencioso, el estado simplemente no se refresca
    }
    setGuardando(false)
  }

  // ---- Lógica del aviso anual ----
  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() // 0 = enero, 2 = marzo

  const fechaUltima = estado ? new Date(estado.fecha_actualizacion + 'T00:00:00') : null
  const alDia = fechaUltima ? fechaUltima.getFullYear() >= anioActual : false
  const yaEntroVentanaMarzo = mesActual >= 2 // marzo en adelante

  let aviso: { tono: 'verde' | 'info' | 'recordatorio'; titulo: string; detalle: string } | null = null

  if (!cargandoEstado) {
    if (alDia) {
      aviso = {
        tono: 'verde',
        titulo: 'Catálogo al día',
        detalle: `Actualizado en ${formatearFecha(estado!.fecha_actualizacion)} para el ciclo ${anioActual}.`,
      }
    } else if (yaEntroVentanaMarzo) {
      aviso = {
        tono: 'recordatorio',
        titulo: `Toca actualizar el Catálogo CCT ${anioActual}`,
        detalle: 'SEP publica su versión anual del catálogo en esta ventana (marzo). Descarga el CSV más reciente y súbelo a Supabase.',
      }
    } else {
      aviso = {
        tono: 'info',
        titulo: `Próxima actualización sugerida: marzo de ${anioActual}`,
        detalle: `Última actualización registrada: ${estado ? formatearFecha(estado.fecha_actualizacion) : 'sin registro'}. SEP publica el catálogo anualmente en marzo.`,
      }
    }
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Catálogo de centros de trabajo</h1>
      <p className="text-sm text-gray-500 mb-6">
        Actualización anual del catálogo oficial SEP/SIGED para decodificación de CCTs.
      </p>

      {/* Aviso dinámico */}
      {aviso && (
        <div
          className="rounded-xl p-4 mb-4 border flex items-start gap-3"
          style={
            aviso.tono === 'verde'
              ? { background: '#F0FBF8', borderColor: '#B7E4DC' }
              : aviso.tono === 'recordatorio'
              ? { background: '#EEEDF8', borderColor: '#C9C6E8' }
              : { background: '#F7F7FB', borderColor: '#E5E4F0' }
          }
        >
          <span className="text-base mt-0.5">
            {aviso.tono === 'verde' ? '✓' : aviso.tono === 'recordatorio' ? '📅' : 'ℹ️'}
          </span>
          <div className="flex-1">
            <p
              className="text-sm font-medium"
              style={{ color: aviso.tono === 'verde' ? '#0B7A63' : '#3D3A8C' }}
            >
              {aviso.titulo}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{aviso.detalle}</p>
          </div>
          {aviso.tono !== 'verde' && (
            <button
              onClick={() => setMostrarFormActualizar(true)}
              className="text-xs font-medium text-white px-3 py-1.5 rounded-lg whitespace-nowrap"
              style={{ background: '#00A896' }}
            >
              Marcar como actualizado
            </button>
          )}
        </div>
      )}

      {/* Estado actual (dinámico, ya no hardcodeado) */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🗄️</span>
          <h2 className="text-sm font-medium text-gray-900">Estado actual</h2>
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
        </div>

        {cargandoEstado ? (
          <p className="text-xs text-gray-400 py-2">Cargando estado del catálogo...</p>
        ) : estado ? (
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{estado.archivo_nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {estado.registros_count?.toLocaleString('es-MX')} registros · Supabase tabla schools_catalog
              </p>
            </div>
            <span className="text-xs text-gray-400">{formatearFecha(estado.fecha_actualizacion)}</span>
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-2">Sin registro de actualización todavía.</p>
        )}

        {!mostrarFormActualizar && (
          <button
            onClick={() => setMostrarFormActualizar(true)}
            className="mt-2 text-xs font-medium"
            style={{ color: '#3D3A8C' }}
          >
            + Registrar nueva actualización
          </button>
        )}

        {mostrarFormActualizar && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-3">Registrar actualización del catálogo</p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Nombre del archivo (ej: CNCT_DA_2026_15032026.csv)"
                value={nuevoArchivo}
                onChange={e => setNuevoArchivo(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Número de registros (ej: 175084)"
                value={nuevoConteo}
                onChange={e => setNuevoConteo(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400"
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={marcarActualizado}
                  disabled={guardando}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                  style={{ background: guardando ? '#9CA3AF' : '#3D3A8C' }}
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setMostrarFormActualizar(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Verificador */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🔍</span>
          <h2 className="text-sm font-medium text-gray-900">Verificador de CCT</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">Prueba que el catálogo responde correctamente con un CCT conocido.</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ej: 19DJN0293I"
            value={cct}
            onChange={e => setCct(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verificarCCT()}
            maxLength={10}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400"
          />
          <button
            onClick={verificarCCT}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ background: loading ? '#9CA3AF' : '#3D3A8C' }}
          >
            {loading ? 'Buscando...' : 'Verificar'}
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {resultado && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-green-700 mb-2">✅ CCT encontrado</p>
            <div className="space-y-1">
              <div className="flex gap-2">
                <span className="text-xs text-gray-500 w-24">Nombre</span>
                <span className="text-xs text-gray-900 font-medium">{resultado.nombre || resultado.school_name || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs text-gray-500 w-24">Municipio</span>
                <span className="text-xs text-gray-900">{resultado.municipio || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs text-gray-500 w-24">Estado</span>
                <span className="text-xs text-gray-900">{resultado.estado || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs text-gray-500 w-24">Sostenimiento</span>
                <span className="text-xs text-gray-900">{resultado.sostenimiento || resultado.tipo || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instrucciones actualización */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🔄</span>
          <h2 className="text-sm font-medium text-gray-900">Cómo actualizar el catálogo</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 py-2 border-b border-gray-50">
            <span className="text-xs font-bold text-indigo-600 w-6 mt-0.5">1</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Descargar CSV oficial</p>
              <p className="text-xs text-gray-500 mt-0.5">Entrar al sitio con sesión activa. El acceso directo a la URL devuelve 403. SEP publica la versión anual en marzo.</p>
            </div>
            <a href="https://www.datos.gob.mx/busca/dataset/catalogo_centros_trabajo_sep" target="_blank" className="text-xs text-indigo-600 font-medium whitespace-nowrap">Ir al sitio →</a>
          </div>
          <div className="flex items-start gap-3 py-2 border-b border-gray-50">
            <span className="text-xs font-bold text-indigo-600 w-6 mt-0.5">2</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Subir a Supabase</p>
              <p className="text-xs text-gray-500 mt-0.5">Table Editor → schools_catalog → Import data from CSV. Las columnas se mapean automáticamente.</p>
            </div>
            <a href="https://supabase.com/dashboard/project/zdagfyfhuuaywocaahse/editor" target="_blank" className="text-xs text-indigo-600 font-medium whitespace-nowrap">Abrir Supabase →</a>
          </div>
          <div className="flex items-start gap-3 py-2 border-b border-gray-50">
            <span className="text-xs font-bold text-indigo-600 w-6 mt-0.5">3</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Verificar con el campo de arriba</p>
              <p className="text-xs text-gray-500 mt-0.5">Probar un CCT conocido para confirmar que el catálogo nuevo responde correctamente.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 py-2">
            <span className="text-xs font-bold text-indigo-600 w-6 mt-0.5">4</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Registrar la actualización</p>
              <p className="text-xs text-gray-500 mt-0.5">Usa el botón "Registrar nueva actualización" arriba con el nombre del archivo y el número de registros. Esto apaga el aviso hasta el próximo marzo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatearFecha(fechaISO: string) {
  const f = new Date(fechaISO + 'T00:00:00')
  return f.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}