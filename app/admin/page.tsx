// ============================================================
//  PlanIA Digital — Dashboard Super Admin
//  app/admin/page.tsx
// ============================================================
export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Estado general de PlanIA al día de hoy</p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 mb-4">
        <span className="text-amber-500 mt-0.5">⚠️</span>
        <p className="text-sm text-gray-700">
          <strong>Calendario SEP no cargado</strong> — el generador no puede excluir festivos ni sesiones CTE.{' '}
          <a href="/admin/calendario" className="text-indigo-600 underline">Cargarlo ahora</a>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Usuarios activos', value: '0', color: 'text-indigo-700' },
          { label: 'Planeaciones generadas', value: '0', color: 'text-gray-900' },
          { label: 'Costo API este mes', value: '$0.00', color: 'text-green-600' },
          { label: 'Alertas pendientes', value: '1', color: 'text-amber-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-medium ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span className="text-sm font-medium">Calendario SEP</span>
            </div>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">Ciclo 2025–2026 sin cargar. Necesario para calcular días hábiles.</p>
          <a href="/admin/calendario" className="text-xs text-indigo-600 font-medium">Ir a Calendario →</a>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>🤖</span>
              <span className="text-sm font-medium">Modelos IA</span>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Al día</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">Sonnet 4.6 · Haiku 4.5 activos en Vercel.</p>
          <a href="/admin/modelos" className="text-xs text-indigo-600 font-medium">Ver modelos →</a>
        </div>
      </div>
    </div>
  )
}
