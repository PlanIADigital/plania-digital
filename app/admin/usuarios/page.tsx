// ============================================================
//  PlanIA Digital — Super Admin: Usuarios
//  app/admin/usuarios/page.tsx
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { fetchAdmin } from '@/lib/fetchAdmin'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetchAdmin('/api/admin/usuarios')
        const data = await res.json()
        setUsuarios(data.usuarios || [])
      } catch {
        setUsuarios([])
      }
      setLoading(false)
    }
    cargar()
  }, [])

  const educadoras = usuarios.filter(u => ['educadora','educador'].includes(u.role))
  const directivos = usuarios.filter(u => u.role === 'directivo')
  const trials = usuarios.filter(u => u.subscription_status === 'trial')

  const roles: Record<string, string> = {
    educadora: 'Educadora',
    educador: 'Educador',
    directivo: 'Directivo',
    maestra_musica: 'Maestra de música',
    maestro_musica: 'Maestro de música',
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-gray-900 mb-1">Usuarios</h1>
      <p className="text-sm text-gray-500 mb-6">Vista global de cuentas registradas en la plataforma.</p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total usuarios', value: usuarios.length, color: 'text-indigo-700' },
          { label: 'Educadoras', value: educadoras.length, color: 'text-gray-900' },
          { label: 'Directivos', value: directivos.length, color: 'text-gray-900' },
          { label: 'Trial activos', value: trials.length, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-medium ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando usuarios...</div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-2xl mb-2">👥</p>
            <p className="text-sm text-gray-400">Aún no hay usuarios registrados.</p>
            <p className="text-xs text-gray-300 mt-1">Los primeros aparecerán en el beta de junio.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">CCT</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Registro</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      {roles[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{u.cct || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                      u.subscription_status === 'trial' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {u.subscription_status === 'active' ? 'Activo' :
                       u.subscription_status === 'trial' ? 'Trial' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}