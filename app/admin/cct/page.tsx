// ============================================================
//  PlanIA Digital — Super Admin: Catálogo CCTs
//  app/admin/cct/page.tsx
// ============================================================
'use client'
import { useState } from 'react'

export default function CatalogoPage() {
  const [cct, setCct] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Catálogo de centros de trabajo</h1>
      <p className="text-sm text-gray-500 mb-6">
        Actualización anual del catálogo oficial SEP/SIGED para decodificación de CCTs.
      </p>

      {/* Estado actual */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🗄️</span>
          <h2 className="text-sm font-medium text-gray-900">Estado actual</h2>
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-900">CNCT_DA_2025_13112025.csv</p>
            <p className="text-xs text-gray-500 mt-0.5">366,685 registros · Supabase tabla schools_catalog</p>
          </div>
          <span className="text-xs text-gray-400">Nov 2025</span>
        </div>
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
              <p className="text-xs text-gray-500 mt-0.5">Entrar al sitio con sesión activa. El acceso directo a la URL devuelve 403.</p>
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
          <div className="flex items-start gap-3 py-2">
            <span className="text-xs font-bold text-indigo-600 w-6 mt-0.5">3</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Verificar con el campo de arriba</p>
              <p className="text-xs text-gray-500 mt-0.5">Probar un CCT conocido para confirmar que el catálogo nuevo responde correctamente.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
