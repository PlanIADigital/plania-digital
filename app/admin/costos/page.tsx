// ============================================================
//  PlanIA Digital — Super Admin: Costos API
//  app/admin/costos/page.tsx
// ============================================================
export default function CostosPage() {
  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Costos API</h1>
      <p className="text-sm text-gray-500 mb-6">
        Monitoreo mensual del consumo de la API de Anthropic.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Este mes', value: '$0.00', color: 'text-indigo-700' },
          { label: 'Mes anterior', value: '$0.00', color: 'text-gray-900' },
          { label: 'Costo por planeación', value: '~$0.03', color: 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-medium ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Consumo por modelo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📊</span>
          <h2 className="text-sm font-medium text-gray-900">Consumo por modelo</h2>
        </div>
        <div className="space-y-4">
          {[
            { modelo: 'Sonnet 4.6', uso: 'Planeaciones, rúbricas, edición IA', costo: '$0.00', pct: 0 },
            { modelo: 'Haiku 4.5', uso: 'CCT, routing, sugerencias', costo: '$0.00', pct: 0 },
          ].map(m => (
            <div key={m.modelo}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium text-gray-900">{m.modelo}</span>
                  <span className="text-xs text-gray-400 ml-2">{m.uso}</span>
                </div>
                <span className="text-sm font-medium text-gray-700">{m.costo}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: '#3D3A8C' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estimados */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📈</span>
          <h2 className="text-sm font-medium text-gray-900">Estimados de crecimiento</h2>
        </div>
        <div className="space-y-2">
          {[
            { escenario: '10 usuarias activas', estimado: '~$0.40–$0.90 USD/mes' },
            { escenario: '50 usuarias activas', estimado: '~$2.00–$4.50 USD/mes' },
            { escenario: '100 usuarias activas', estimado: '~$4.00–$9.00 USD/mes' },
          ].map(e => (
            <div key={e.escenario} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{e.escenario}</span>
              <span className="text-sm font-medium text-green-600">{e.estimado}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Basado en ~$0.03 USD por planeación con caché activo. Margen operativo IA estimado: 98%.</p>
      </div>

      {/* Link Anthropic */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🔗</span>
          <h2 className="text-sm font-medium text-gray-900">Ver en Anthropic Console</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Los costos reales y el desglose por modelo están en Anthropic Console → Usage. 
          Revisar mensualmente y comparar contra los estimados de arriba.
        </p>
        
<a href="https://console.anthropic.com"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ background: '#3D3A8C' }}
        >
          Abrir Anthropic Console →
        </a>
      </div>
    </div>
  )
}
