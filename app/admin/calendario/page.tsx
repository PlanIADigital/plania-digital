// ============================================================
//  PlanIA Digital — Super Admin: Calendario SEP
//  app/admin/calendario/page.tsx
// ============================================================
'use client'
import { useState } from 'react'

export default function CalendarioPage() {
  const [uploadingFederal, setUploadingFederal] = useState(false)
  const [uploadingEstatal, setUploadingEstatal] = useState(false)
  const [mensajeFederal, setMensajeFederal] = useState('')
  const [mensajeEstatal, setMensajeEstatal] = useState('')

  async function handleUpload(tipo: 'federal' | 'estatal', file: File) {
    if (tipo === 'federal') setUploadingFederal(true)
    else setUploadingEstatal(true)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      const res = await fetch('/api/admin/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, datos: json }),
      })

      const data = await res.json()
      if (data.ok) {
        if (tipo === 'federal') setMensajeFederal('✅ Calendario federal cargado correctamente')
        else setMensajeEstatal('✅ Calendario estatal cargado correctamente')
      } else {
        if (tipo === 'federal') setMensajeFederal('❌ Error: ' + (data.error || 'inténtalo de nuevo'))
        else setMensajeEstatal('❌ Error: ' + (data.error || 'inténtalo de nuevo'))
      }
    } catch {
      if (tipo === 'federal') setMensajeFederal('❌ El archivo no es un JSON válido')
      else setMensajeEstatal('❌ El archivo no es un JSON válido')
    }

    if (tipo === 'federal') setUploadingFederal(false)
    else setUploadingEstatal(false)
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Calendario SEP</h1>
      <p className="text-sm text-gray-500 mb-6">
        Gestión del calendario escolar oficial. Define días hábiles, festivos y sesiones CTE para el generador de planeaciones.
      </p>

      {/* Alerta pendiente */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 flex gap-3">
        <span className="text-amber-500 mt-0.5">⚠️</span>
        <p className="text-sm text-amber-800">
          <strong>Ciclo 2025–2026 sin cargar.</strong> El generador no puede excluir festivos ni sesiones CTE del cálculo de días hábiles hasta que cargues el calendario.
        </p>
      </div>

      {/* Cómo convertir PDF a JSON */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">💡</span>
          <h2 className="text-sm font-medium text-indigo-900">Cómo convertir el PDF del calendario SEP a JSON</h2>
        </div>
        <ol className="space-y-2 text-xs text-indigo-800">
          <li className="flex gap-2"><span className="font-bold w-4">1.</span> Descarga el PDF oficial del calendario desde educacionbasica.sep.gob.mx</li>
          <li className="flex gap-2"><span className="font-bold w-4">2.</span> Abre un chat nuevo en Claude.ai y sube el PDF</li>
          <li className="flex gap-2"><span className="font-bold w-4">3.</span> Pide: <em>"Extrae todas las fechas en formato JSON con esta estructura: {`{"ciclo":"2025-2026","inicio_clases":"YYYY-MM-DD","fin_clases":"YYYY-MM-DD","dias_inhabiles":[],"sesiones_cte":[]}`}"</em></li>
          <li className="flex gap-2"><span className="font-bold w-4">4.</span> Copia el JSON, guárdalo como archivo <code>.json</code> y súbelo aquí</li>
        </ol>
        <div className="mt-3 flex gap-2">
          <a href="https://educacionbasica.sep.gob.mx" target="_blank"
            className="text-xs font-medium text-indigo-700 underline">
            Ir a SEP →
          </a>
          <span className="text-indigo-300">·</span>
          <a href="https://claude.ai" target="_blank"
            className="text-xs font-medium text-indigo-700 underline">
            Abrir Claude.ai →
          </a>
        </div>
      </div>

      {/* Upload Federal */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🇲🇽</span>
          <h2 className="text-sm font-medium text-gray-900">Calendario SEP Federal</h2>
          <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Aplica a todos los estados. Cargar al inicio de cada ciclo escolar.</p>
        <label className="block border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-300 transition-colors">
          <span className="text-2xl block mb-2">📂</span>
          <span className="text-sm text-gray-500">
            {uploadingFederal ? 'Cargando...' : 'Selecciona el archivo JSON del calendario federal'}
          </span>
          <span className="text-xs text-gray-300 block mt-1">Formato: .json · Máx. 1 MB</span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleUpload('federal', file)
            }}
          />
        </label>
        {mensajeFederal && (
          <p className="mt-3 text-xs font-medium text-gray-700">{mensajeFederal}</p>
        )}
      </div>

      {/* Upload Estatal */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🏛️</span>
          <h2 className="text-sm font-medium text-gray-900">Calendario SEP Nuevo León</h2>
          <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Ajustes estatales de Nuevo León. Coordinación SENL / SEP NL.</p>
        <label className="block border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-300 transition-colors">
          <span className="text-2xl block mb-2">📂</span>
          <span className="text-sm text-gray-500">
            {uploadingEstatal ? 'Cargando...' : 'Selecciona el archivo JSON del calendario estatal'}
          </span>
          <span className="text-xs text-gray-300 block mt-1">Formato: .json · Máx. 1 MB</span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleUpload('estatal', file)
            }}
          />
        </label>
        {mensajeEstatal && (
          <p className="mt-3 text-xs font-medium text-gray-700">{mensajeEstatal}</p>
        )}
      </div>
    </div>
  )
}
