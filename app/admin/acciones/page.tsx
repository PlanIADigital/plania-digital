// ============================================================
//  PlanIA Digital — Super Admin: Acciones periódicas
//  app/admin/acciones/page.tsx
// ============================================================
export default function AccionesPage() {
  const acciones = [
    {
      frecuencia: 'Inicio de ciclo',
      color: '#EEEDFE',
      texto: '#3C3489',
      label: 'Cargar calendario SEP federal',
      desc: 'educacionbasica.sep.gob.mx → Calendario escolar',
      href: '/admin/calendario',
      link: 'Ir a Calendario SEP →',
    },
    {
      frecuencia: 'Inicio de ciclo',
      color: '#EEEDFE',
      texto: '#3C3489',
      label: 'Cargar calendario SEP Nuevo León',
      desc: 'Coordinación SENL / SEP NL — archivo PDF o JSON',
      href: '/admin/calendario',
      link: 'Ir a Calendario SEP →',
    },
    {
      frecuencia: 'Inicio de ciclo',
      color: '#EEEDFE',
      texto: '#3C3489',
      label: 'Actualizar catálogo CCTs',
      desc: 'datos.gob.mx → dataset: catalogo_centros_trabajo_sep. Requiere sesión activa en el sitio.',
      href: '/admin/cct',
      link: 'Ir a Catálogo CCTs →',
    },
    {
      frecuencia: 'Por evento',
      color: '#FAEEDA',
      texto: '#633806',
      label: 'Actualizar modelo Claude',
      desc: 'Cuando Anthropic notifique nueva versión — actualizar CLAUDE_SONNET_MODEL y CLAUDE_HAIKU_MODEL en Vercel.',
      href: '/admin/modelos',
      link: 'Ir a Modelos IA →',
    },
    {
      frecuencia: 'Mensual',
      color: '#E1F5EE',
      texto: '#085041',
      label: 'Revisar reporte ARIA',
      desc: 'Email semanal clasificado: mejora_inmediata, revisar_con_educadoras, decision_fundador.',
      href: '/admin/aria',
      link: 'Ir a ARIA →',
    },
    {
      frecuencia: 'Mensual',
      color: '#E1F5EE',
      texto: '#085041',
      label: 'Revisar costos API Anthropic',
      desc: 'console.anthropic.com → Usage. Verificar costo por planeación y tendencia mensual.',
      href: '/admin/costos',
      link: 'Ir a Costos API →',
    },
  ]

  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Acciones periódicas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tu checklist de mantenimiento como fundador. Sin estas acciones la plataforma se desactualiza.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-36">Frecuencia</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Acción</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-40">Acceso rápido</th>
            </tr>
          </thead>
          <tbody>
            {acciones.map((a, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span style={{
                    background: a.color,
                    color: a.texto,
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: 20,
                    whiteSpace: 'nowrap'
                  }}>
                    {a.frecuencia}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 mb-0.5">{a.label}</p>
                  <p className="text-xs text-gray-500">{a.desc}</p>
                </td>
                <td className="px-4 py-3">
                  <a href={a.href} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                    {a.link}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <p className="text-xs text-amber-800">
          <strong>Recuerda:</strong> El calendario SEP y el catálogo CCTs deben actualizarse <strong>antes del inicio de cada ciclo escolar</strong> (agosto). Sin el calendario, el generador no puede excluir festivos ni sesiones CTE del cálculo de días hábiles.
        </p>
      </div>
    </div>
  )
}
