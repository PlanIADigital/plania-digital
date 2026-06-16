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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#3D3A8C', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22 }}>✦</div>
          <p style={{ color: '#3D3A8C', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>PlanIA Digital</p>
          <p style={{ color: '#9CA3AF', fontSize: 13 }}>Verificando acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 230,
        minWidth: 230,
        minHeight: '100vh',
        background: 'white',
        borderRight: '1px solid #E8E7F5',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(61,58,140,0.06)',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F0EFF8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'linear-gradient(135deg, #3D3A8C, #5956B8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'white', fontWeight: 700, flexShrink: 0
            }}>✦</div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.2 }}>PlanIA Digital</p>
              <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', lineHeight: 1.2 }}>Centro de Control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {navItems.map(group => (
            <div key={group.section} style={{ marginBottom: 4 }}>
              <p style={{
                padding: '8px 10px 4px',
                fontSize: 10,
                fontWeight: 600,
                color: '#C4C2D8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: 0,
              }}>
                {group.section}
              </p>
              {group.items.map(item => {
                const isActive = pathname === item.href
                return (
                  
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      fontSize: 13,
                      color: isActive ? '#3D3A8C' : '#6B7280',
                      background: isActive ? '#EEEDF8' : 'transparent',
                      borderRadius: 8,
                      borderLeft: isActive ? '3px solid #3D3A8C' : '3px solid transparent',
                      textDecoration: 'none',
                      fontWeight: isActive ? 600 : 400,
                      marginBottom: 2,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                    {item.label}
                  </a>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          margin: '0 10px 12px',
          padding: '12px',
          background: '#F8F7FF',
          borderRadius: 10,
          border: '1px solid #E8E7F5',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3D3A8C, #00A896)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'white', fontWeight: 700, flexShrink: 0
            }}>A</div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#1A1A2E' }}>Alfredo</p>
              <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF' }}>Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
