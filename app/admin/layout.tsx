// ============================================================
//  PlanIA Digital — Layout Super Admin
//  app/admin/layout.tsx
// ============================================================
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

async function getSuperAdmin() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data } = await supabaseAdmin
    .from('users')
    .select('is_super_admin, full_name')
    .eq('id', user.id)
    .single()

  if (!data?.is_super_admin) redirect('/dashboard')

  return data
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await getSuperAdmin()

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
