'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const navItems = [
  { section: 'Resumen', items: [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
  ]},
  { section: 'Ciclo escolar', items: [
    { href: '/admin/calendario', label: 'Calendario SEP', icon: '📅' },
    { href: '/admin/cct', label: 'Catálogo CCTs', icon: '🏫' },
  ]},
  { section: 'Plataforma', items: [
    { href: '/admin/modelos', label: 'Modelos IA', icon: '🤖' },
    { href: '/admin/costos', label: 'Costos API', icon: '📈' },
    { href: '/admin/usuarios', label: 'Usuarios', icon: '👥' },
  ]},
  { section: 'Sistema', items: [
    { href: '/admin/acciones', label: 'Acciones periódicas', icon: '✅' },
  ]},
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
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
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#3D3A8C', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'white', fontSize: 18 }}>✦</div>
          <p style={{ color: '#3D3A8C', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>PlanIA Digital</p>
          <p style={{ color: '#9CA3AF', fontSize: 12 }}>Verificando acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        minWidth: 240,
        minHeight: '100vh',
        background: 'white',
        borderRight: '1px solid #F3F4F6',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '1px 0 0 #F3F4F6',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#3D3A8C',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#00A896', fontSize: 16, fontWeight: 700, flexShrink: 0
            }}>✦</div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>PlanIA Digital</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>Centro de Control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px' }}>
          {navItems.map(group => (
            <div key={group.section} style={{ marginBottom: 4 }}>
              <p style={{
                padding: '10px 8px 4px',
                fontSize: 10,
                fontWeight: 700,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: 0,
              }}>
                {group.section}
              </p>
              {group.items.map(item => {
                const isActive = pathname === item.href
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      fontSize: 13,
                      color: isActive ? '#3D3A8C' : '#4B5563',
                      background: isActive ? '#EEEDF8' : 'transparent',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: isActive ? 600 : 400,
                      marginBottom: 1,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </a>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#3D3A8C',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'white', fontWeight: 700, flexShrink: 0
            }}>A</div>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111827' }}>Alfredo</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
