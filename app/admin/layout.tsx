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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8F5F2' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#3D3A8C', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>✦ PlanIA Digital ✦</p>
          <p style={{ color: '#6B7280', fontSize: 13 }}>Verificando acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F0F8', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 210,
        minWidth: 210,
        minHeight: '100vh',
        background: 'white',
        borderRight: '0.5px solid #E2E1F0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid #EEEDF8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ color: '#00A896', fontWeight: 700, fontSize: 13 }}>✦</span>
            <span style={{ color: '#3D3A8C', fontWeight: 700, fontSize: 14 }}>Plan</span>
            <span style={{ color: '#00A896', fontWeight: 900, fontSize: 14 }}>IA</span>
            <span style={{ color: '#3D3A8C', fontWeight: 700, fontSize: 14 }}> Digital</span>
            <span style={{ color: '#00A896', fontWeight: 700, fontSize: 13 }}>✦</span>
          </div>
          <p style={{ color: '#9CA3AF', fontSize: 10, margin: 0, letterSpacing: '0.05em' }}>Centro de Control</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0' }}>
          {navItems.map(group => (
            <div key={group.section}>
              <p style={{
                padding: '8px 16px 3px',
                fontSize: 9,
                fontWeight: 600,
                color: '#C4C2D8',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
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
                      gap: 8,
                      padding: '7px 16px',
                      fontSize: 13,
                      color: isActive ? '#3D3A8C' : '#6B6B8A',
                      background: isActive ? '#EEEDF8' : 'transparent',
                      borderLeft: isActive ? '3px solid #3D3A8C' : '3px solid transparent',
                      textDecoration: 'none',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    {item.label}
                  </a>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '0.5px solid #EEEDF8' }}>
          <p style={{ color: '#C4C2D8', fontSize: 10, margin: '0 0 1px' }}>Super Admin</p>
          <p style={{ color: '#3D3A8C', fontSize: 11, fontWeight: 600, margin: 0 }}>planiadigital.oficial</p>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
