'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { MISIONES_ACTIVO } from '@/lib/featureFlags'
import { useTheme } from '@/components/ThemeProvider'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAV_ITEMS = [
  { label: 'Dashboard',        path: '/dashboard',        icon: '🏠', activo: true },
  { label: 'Mi grupo',         path: '/mi-grupo',         icon: '👥', activo: true },
  { label: 'Nueva planeación', path: '/planeacion/nueva', icon: '✨', activo: true },
  { label: 'Mis planeaciones', path: '/mis-planeaciones', icon: '📋', activo: true },
  { label: 'Mi avance',        path: '/mi-avance',        icon: '📊', activo: true },
  { label: 'Misiones',          path: '/misiones',         icon: '🎓', activo: MISIONES_ACTIVO },
  { label: 'Calendario',       path: null,                icon: '📅', activo: false },
  { label: 'Estadísticas',     path: null,                icon: '📈', activo: false },
  { label: 'Configuración',    path: '/configuracion',    icon: '⚙️', activo: true },
]

interface SidebarProps {
  profile: any
  children: React.ReactNode
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
        position: 'relative', flexShrink: 0, padding: 0,
        background: isDark ? '#00A896' : 'rgba(255,255,255,0.22)',
        transition: 'background 0.2s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: isDark ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, lineHeight: 1, transition: 'left 0.2s ease',
      }}>
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  )
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
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4, justifyContent: 'center' }}>
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
              (item.label === 'Mis planeaciones' && (
                pathname?.startsWith('/planeacion/') && pathname !== '/planeacion/nueva'
              ))
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
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="foto"
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }} />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#00A896',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 18, fontWeight: 700
              }}>
                {iniciales}
              </div>
            )}
            <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: 0 }}>
              {profile?.full_name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Modo oscuro</span>
              <ThemeToggle />
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', background: '#00A896',
            border: 'none',
            color: 'white', padding: '7px 12px', borderRadius: 8, fontWeight: 600,
            cursor: 'pointer', fontSize: 12,
          }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 240, flex: 1, background: 'var(--plania-fondo)', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}