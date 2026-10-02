'use client'
// ============================================================
//  PlanIA Digital — components/Sidebar.tsx
//  [30 sep 2026] Menú adaptable a celular ("hamburguesa"):
//  - Más de 768 px: menú fijo de 240 px a la izquierda.
//  - 768 px o menos: el menú se oculta y aparece una barra superior con ☰.
//    Al tocarla, el menú se desliza desde la izquierda con fondo oscurecido;
//    se cierra con ✕, tocando fuera, eligiendo una opción o al cambiar de página.
//  El cambio de diseño se hace con CSS (@media), no con JS.
//  [oct 2026] Iconografía "línea en recuadro" (opción B): cada sección con
//  su ícono de línea en un recuadro suave; la activa con recuadro verde.
//  Ficha del jardín en verde PlanIA, solo con el nombre.
//  [oct 2026] Modo oscuro apagado para el lanzamiento (ver ThemeProvider):
//  se quitó el interruptor; el pie queda con foto, nombre y Salir.
//  [2 oct 2026] UN SOLO MENÚ PARA TODOS LOS ROLES: las opciones se eligen
//  según profile.role (educadora o directivo). Reemplaza a SidebarDirectivo,
//  para que cada mejora del menú llegue a todos los roles a la vez.
// ============================================================
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Icono from '@/components/Icono'

const supabase = createClient()

interface ItemMenu {
  label: string
  path: string | null
  icono: string
  activo: boolean
  // Rutas hijas que también marcan esta opción como activa
  prefijoActivo?: string
}

const NAV_EDUCADORA: ItemMenu[] = [
  { label: 'Dashboard',        path: '/dashboard',        icono: 'house',         activo: true },
  { label: 'Mi grupo',         path: '/mi-grupo',         icono: 'users',         activo: true },
  { label: 'Mi diario',        path: null,                icono: 'mi-diario',     activo: false },
  { label: 'Nueva planeación', path: '/planeacion/nueva', icono: 'sparkles',      activo: true },
  { label: 'Mis planeaciones', path: '/mis-planeaciones', icono: 'folder-open',   activo: true, prefijoActivo: '/planeacion/' },
  { label: 'Mi avance',        path: '/mi-avance',        icono: 'chart-column',  activo: true },
  { label: 'Misiones',         path: '/misiones',         icono: 'flag',          activo: false },
  { label: 'Calendario',       path: null,                icono: 'calendar-days', activo: false },
  { label: 'Estadísticas',     path: null,                icono: 'chart-pie',     activo: false },
  { label: 'Configuración',    path: '/configuracion',    icono: 'settings',      activo: true },
]

const NAV_DIRECTIVO: ItemMenu[] = [
  { label: 'Dashboard',        path: '/directivo/dashboard', icono: 'house',         activo: true },
  { label: 'Mis docentes',     path: '/directivo/docentes',  icono: 'users',         activo: true, prefijoActivo: '/directivo/docentes/' },
  { label: 'Estadísticas',     path: null,                   icono: 'chart-pie',     activo: false },
  { label: 'Informes',         path: null,                   icono: 'folder-open',   activo: false },
  { label: 'Calendario',       path: null,                   icono: 'calendar-days', activo: false },
  { label: 'Configuración',    path: '/configuracion',       icono: 'settings',      activo: true },
]

interface SidebarProps {
  profile: any
  children: React.ReactNode
}

// Reglas de diseño adaptable. Prefijo "plania-" para no chocar con otras clases.
const ESTILOS_RESPONSIVOS = `
  .plania-aside {
    width: 240px; background: #3D3A8C; display: flex; flex-direction: column;
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
    overflow-y: auto; transition: transform 0.25s ease;
  }
  .plania-main { margin-left: 240px; flex: 1; min-width: 0; background: var(--plania-fondo); min-height: 100vh; }
  .plania-topbar, .plania-overlay, .plania-cerrar { display: none; }

  .plania-item { transition: background 0.15s ease; }
  .plania-item.habilitado:hover { background: rgba(255,255,255,0.08); }
  .plania-item:focus-visible, .plania-ficha:focus-visible { outline: 2px solid #00A896; outline-offset: 2px; }

  @media (max-width: 768px) {
    .plania-aside { width: 280px; max-width: 85vw; transform: translateX(-100%); box-shadow: none; }
    .plania-aside.abierto { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.25); }
    .plania-main { margin-left: 0; }
    .plania-topbar {
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 90; height: 56px; padding: 0 8px;
      background: #3D3A8C; box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }
    .plania-overlay.abierto { display: block; position: fixed; inset: 0; z-index: 99; background: rgba(26,26,46,0.45); }
    .plania-cerrar { display: flex; }
    .plania-logo { padding-left: 52px !important; padding-right: 52px !important; }
    /* Safari en iPhone hace zoom al tocar campos con letra < 16 px. */
    input, select, textarea { font-size: 16px !important; }
  }
`

function Logo({ tamano }: { tamano: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
      <span style={{ color: '#00A896', fontWeight: 700, fontSize: tamano }}>✦</span>
      <span style={{ color: 'white', fontWeight: 700, fontSize: tamano }}>Plan</span>
      <span style={{ color: '#00A896', fontWeight: 900, fontSize: tamano }}>IA</span>
      <span style={{ color: 'white', fontWeight: 700, fontSize: tamano }}> Digital</span>
      <span style={{ color: '#00A896', fontWeight: 700, fontSize: tamano }}>✦</span>
    </div>
  )
}

// [sep 2026] Abrevia el nombre del jardín por PRESUPUESTO DE CARACTERES:
// muestra tantas palabras COMPLETAS quepan y, si hace falta cortar, usa
// "..." (se lee como "hay más texto", no como un dato inventado).
function nombreJardinCorto(nombreCompleto?: string | null): string {
  if (!nombreCompleto) return 'Jardín de Niños'
  let base = nombreCompleto
    .replace(/^Jard[ií]n de Ni[ñn]os Ind[ií]gena\s*/i, '')
    .replace(/^Jard[ií]n de Ni[ñn]os\s*/i, '')
    .replace(/^Centro de Educaci[oó]n Preescolar\s*/i, '')
    .trim()
  base = base.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
  const palabras = base.split(' ').filter(Boolean)

  const MAX_CHARS = 22
  let resultado = ''
  for (const palabra of palabras) {
    const candidato = resultado ? `${resultado} ${palabra}` : palabra
    if (candidato.length > MAX_CHARS) {
      if (!resultado) {
        resultado = palabra.slice(0, Math.max(1, MAX_CHARS - 3))
      }
      return `JN ${resultado}...`
    }
    resultado = candidato
  }
  return `JN ${resultado}`
}

export default function Sidebar({ profile, children }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)

  const esDirectivo = profile?.role === 'directivo'
  const NAV_ITEMS = esDirectivo ? NAV_DIRECTIVO : NAV_EDUCADORA

  // Al cambiar de página, el menú del celular se cierra solo.
  useEffect(() => { setAbierto(false) }, [pathname])

  // Cada página abre hasta arriba (evita que Safari restaure un scroll intermedio al recargar)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [pathname])

  // Con el menú abierto en el celular, la página de atrás no se desplaza.
  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [abierto])

  // Tecla Esc cierra el menú (útil en tabletas con teclado).
  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [abierto])

  function irA(path: string) {
    setAbierto(false)
    router.push(path)
  }

  async function handleLogout() {
    setAbierto(false)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function estaActivo(item: ItemMenu): boolean {
    if (item.path === null) return false
    if (pathname === item.path) return true
    if (!item.prefijoActivo || !pathname?.startsWith(item.prefijoActivo)) return false
    // "Nueva planeación" tiene su propia opción; no marca "Mis planeaciones".
    return pathname !== '/planeacion/nueva'
  }

  const iniciales = profile?.full_name
    ?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <style>{ESTILOS_RESPONSIVOS}</style>

      {/* Fondo oscurecido (solo celular, con el menú abierto) */}
      <div className={`plania-overlay${abierto ? ' abierto' : ''}`} onClick={() => setAbierto(false)} aria-hidden="true" />

      <aside className={`plania-aside${abierto ? ' abierto' : ''}`} aria-label="Menú principal">
        {/* Cerrar (solo celular) */}
        <button
          className="plania-cerrar"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar menú"
          style={{
            position: 'absolute', top: 8, right: 8, width: 40, height: 40,
            alignItems: 'center', justifyContent: 'center', borderRadius: 8,
            background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
            fontSize: 20, cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {/* Logo y lema */}
        <div className="plania-logo" style={{ padding: '22px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'center' }}>
          <div style={{ marginBottom: 4 }}><Logo tamano={18} /></div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: 0, letterSpacing: '0.06em' }}>
            Planea. Conecta. Transforma.
          </p>
        </div>

        {/* Ficha del jardín — en verde para ver de entrada en qué jardín se está.
            Los datos (CCT, zona, etc.) viven en Configuración. */}
        <button
          className="plania-ficha"
          onClick={() => irA('/configuracion')}
          title={profile?.school_name || ''}
          style={{
            margin: '14px 12px 6px', padding: '10px 10px', borderRadius: 10,
            background: '#00A896', border: 'none', cursor: 'pointer',
            display: 'block', width: 'calc(100% - 24px)',
            color: 'white', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em',
            textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {nombreJardinCorto(profile?.school_name).toUpperCase()}
        </button>

        {/* Navegación */}
        <nav style={{ padding: '8px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = estaActivo(item)
            return (
              <button
                key={item.label}
                className={`plania-item${item.activo ? ' habilitado' : ''}`}
                onClick={() => { if (item.activo && item.path) irA(item.path) }}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={!item.activo || undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 8px', borderRadius: 10, border: 'none',
                  cursor: item.activo ? 'pointer' : 'default',
                  background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: item.activo ? 'white' : 'rgba(255,255,255,0.38)',
                  fontSize: 14, fontWeight: isActive ? 600 : 400, textAlign: 'left',
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? '#00A896' : (item.activo ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)'),
                }}>
                  <Icono nombre={item.icono} tamano={18} />
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {!item.activo && (
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    background: 'rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.45)',
                    padding: '2px 6px', borderRadius: 10,
                    letterSpacing: '0.04em',
                  }}>
                    PRONTO
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Perfil: foto, nombre y Salir en una fila */}
        <div style={{ padding: '12px 14px 16px', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="foto"
              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#EEEDF8', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#3D3A8C', fontSize: 14, fontWeight: 800,
            }}>
              {iniciales}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: 'white', fontSize: 13.5, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name}
            </p>
            {esDirectivo ? (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, margin: '2px 0 0', letterSpacing: '0.04em' }}>Directivo</p>
            ) : profile?.es_fundadora && (
              <p style={{ color: '#FCD34D', fontSize: 11, fontWeight: 700, margin: '2px 0 0' }}>⭐ Fundadora</p>
            )}
          </div>
          <button onClick={handleLogout} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            background: '#00A896', border: 'none', color: 'white',
            padding: '8px 12px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>
            <Icono nombre="log-out" tamano={16} />
            Salir
          </button>
        </div>
      </aside>

      <main className="plania-main">
        {/* Barra superior (solo celular) */}
        <div className="plania-topbar">
          <button
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú"
            aria-expanded={abierto}
            style={{
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer', borderRadius: 8,
            }}
          >
            ☰
          </button>
          <Logo tamano={16} />
          {/* Espacio del mismo ancho que ☰ para que el logo quede centrado */}
          <div style={{ width: 44 }} />
        </div>
        {children}
      </main>
    </div>
  )
}
