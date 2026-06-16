// ============================================================
//  PlanIA Digital — Super Admin: Modelos IA
//  app/admin/modelos/page.tsx
// ============================================================
export default function ModelosPage() {
  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Modelos IA</h1>
      <p className="text-sm text-gray-500 mb-6">
        Variables de entorno activas en Vercel. Actualizar cuando Anthropic lance versiones nuevas.
      </p>

      {/* Variables activas */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🤖</span>
          <h2 className="text-sm font-medium text-gray-900">Variables de entorno activas</h2>
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Al día</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 py-2 border-b border-gray-50">
            <span className="text-xs text-gray-400 w-24">Producción</span>
            <code className="text-xs font-mono text-gray-700 flex-1">CLAUDE_SONNET_MODEL</code>
            <code className="text-xs font-mono text-gray-400">claude-sonnet-4-6</code>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Planeaciones</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <span className="text-xs text-gray-400 w-24">Apoyo</span>
            <code className="text-xs font-mono text-gray-700 flex-1">CLAUDE_HAIKU_MODEL</code>
            <code className="text-xs font-mono text-gray-400">claude-haiku-4-5-20251001</code>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">CCT / routing</span>
          </div>
        </div>
      </div>

      {/* Protocolo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🔔</span>
          <h2 className="text-sm font-medium text-gray-900">Protocolo de actualización</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 py-2 border-b border-gray-50">
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Cuando Anthropic notifique modelo nuevo</p>
              <p className="text-xs text-gray-500 mt-0.5">Anthropic Console → verificar string exacto → Vercel → Environment Variables → actualizar valor</p>
            </div>
            <a href="https://vercel.com" target="_blank" className="text-xs text-indigo-600 font-medium whitespace-nowrap">Ir a Vercel →</a>
          </div>
          <div className="flex items-start gap-3 py-2 border-b border-gray-50">
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Nunca hardcodear strings en el código</p>
              <p className="text-xs text-gray-500 mt-0.5">Siempre usar las variables de entorno con fallback en .env.local</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Regla activa</span>
          </div>
          <div className="flex items-start gap-3 py-2">
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">Sonnet = producción · Haiku = apoyo · Opus = desarrollo</p>
              <p className="text-xs text-gray-500 mt-0.5">Nunca degradar el modelo de generación de planeaciones por ahorro de costos</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Principio rector</span>
          </div>
        </div>
      </div>

      {/* Links rápidos */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🔗</span>
          <h2 className="text-sm font-medium text-gray-900">Referencias rápidas</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <p className="text-sm text-gray-700">Anthropic Console — Usage y modelos disponibles</p>
            <a href="https://console.anthropic.com" target="_blank" className="text-xs text-indigo-600 font-medium">Abrir →</a>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <p className="text-sm text-gray-700">Vercel — Environment Variables</p>
            <a href="https://vercel.com/planiadigitals-projects/plania-digital/settings/environment-variables" target="_blank" className="text-xs text-indigo-600 font-medium">Abrir →</a>
          </div>
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-700">Anthropic — Documentación de modelos</p>
            <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank" className="text-xs text-indigo-600 font-medium">Abrir →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
