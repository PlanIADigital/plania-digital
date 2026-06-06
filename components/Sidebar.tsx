'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAV_ITEMS = [
  { label: 'Dashboard',        path: '/dashboard',        icon: '🏠', activo: true },
  { label: 'Nueva planeación', path: '/planeacion/nueva', icon: '✨', activo: true },
  { label: 'Mis planeaciones', path: '/dashboard',        icon: '📋', activo: true },
  { label: 'Mi grupo',         path: '/mi-grupo',         icon: '👥', activo: true },
  { label: 'Cobertura PDA',    path: null,                icon: '📊', activo: false },
  { label: 'Calendario',       path: null,                icon: '📅', activo: false },
  { label: 'Estadísticas',     path: null,                icon: '📈', activo: false },
  { label: 'Configuración',    path: '/configuracion',    icon: '⚙️', activo: true },
]

interface SidebarProps {
  profile: any
  children: React.ReactNode
}

export default function Sidebar({ profile, children }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const iniciales = profile?.full_name
    ?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{
        width: 240,
        background: '#3D3A8C',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
            <span style={{ color: '#00A896', fontWeight: 700, fontSize: 18 }}>✦</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Plan</span>
            <span style={{ color: '#00A896', fontWeight: 900, fontSize: 18 }}>IA</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}> Digital</span>
            <span style={{ color: '#00A896', fontWeight: 700, fontSize: 18 }}>✦</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, margin: 0, letterSpacing: '0.06em' }}>
            Planea. Conecta. Transforma.
          </p>
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.path !== null && (
              pathname === item.path ||
              (item.label === 'Mis planeaciones' && pathname?.startsWith('/planeacion/') && pathname !== '/planeacion/nueva')
            )
            return (
              <div key={item.label} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => { if (item.activo && item.path) router.push(item.path) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: item.activo ? 'pointer' : 'default',
                    background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: item.activo ? 'white' : 'rgba(255,255,255,0.35)',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {!item.activo && (
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      background: 'rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.4)',
                      padding: '2px 6px', borderRadius: 10,
                      letterSpacing: '0.04em'
                    }}>
                      PRONTO
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        {/* Perfil */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="foto"
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#00A896',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 13, fontWeight: 700, flexShrink: 0
              }}>
                {iniciales}
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.full_name}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0 }}>
                {profile?.cct_primary} · {profile?.shift_primary}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.6)', padding: '7px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12,
          }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 240, flex: 1, background: '#E8F5F2', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}