'use client'
// ============================================================
//  PlanIA Digital — components/ThemeProvider.tsx
//  [oct 2026] MODO OSCURO APAGADO PARA EL LANZAMIENTO.
//  Las páginas tienen colores fijos en el código, así que el modo
//  oscuro se veía a medias (tarjetas blancas, textos invisibles).
//  Además se activaba solo si el teléfono estaba en modo oscuro.
//  Ahora PlanIA se ve SIEMPRE en claro. Se conserva useTheme() para
//  no romper componentes que lo importen; toggleTheme no hace nada.
//  Para reactivarlo: convertir los colores de cada página a las
//  variables --plania-* de globals.css y restaurar la versión anterior.
// ============================================================
import { createContext, useContext, useEffect } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'light',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    try { localStorage.setItem('plania-theme', 'light') } catch {}
  }, [])

  return <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>{children}</ThemeContext.Provider>
}
