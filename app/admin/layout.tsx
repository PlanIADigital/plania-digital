'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [verificado, setVerificado] = useState(false)

  useEffect(() => {
    async function verificarAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/auth/login?next=/admin'); return }

        const res = await fetch('/api/auth/me-session', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (!res.ok) { router.replace('/auth/login?next=/admin'); return }

        const data = await res.json()
        if (!data?.is_super_admin) { router.replace('/dashboard'); return }

        setVerificado(true)
      } catch {
        router.replace('/auth/login?next=/admin')
      }
    }
    verificarAdmin()
  }, [router])

  if (!verificado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
        <p style={{ color: '#6B7280', fontSize: 14 }}>Verificando acceso...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <aside className="w-52 min-h-screen bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-4 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">PlanIA Digital</p>
            <p className="text-xs text-gray-400 mt-0.5">Centro de Control</p>
          </div>

          <nav className="flex-1 py-3">
            <p className="px-4 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-widest">Resumen</p>
            <a href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>📊</span> Dashboard
            </a>

            <p className="px-4 py-1 mt-3 text-[10px] font-medium text-gray-400 uppercase tracking-widest">Ciclo escolar</p>
            <a href="/admin/calendario" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>📅</span> Calendario SEP
            </a>
            <a href="/admin/cct" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>🏫</span> Catálogo CCTs
            </a>

            <p className="px-4 py-1 mt-3 text-[10px] font-medium text-gray-400 uppercase tracking-widest">Plataforma</p>
            <a href="/admin/modelos" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>🤖</span> Modelos IA
            </a>
            <a href="/admin/costos" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>📈</span> Costos API
            </a>
            <a href="/admin/usuarios" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>👥</span> Usuarios
            </a>

            <p className="px-4 py-1 mt-3 text-[10px] font-medium text-gray-400 uppercase tracking-widest">Sistema</p>
            <a href="/admin/acciones" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>✅</span> Acciones periódicas
            </a>
          </nav>

          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Super Admin</p>
            <p className="text-xs font-medium text-gray-600">planiadigital.oficial</p>
          </div>
        </aside>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
