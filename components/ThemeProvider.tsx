'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'light',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  function aplicarTema(nuevo: Theme) {
    setTheme(nuevo)
    document.documentElement.setAttribute('data-theme', nuevo)
    localStorage.setItem('plania-theme', nuevo)
  }

  useEffect(() => {
    const cache = localStorage.getItem('plania-theme')
    if (cache === 'light' || cache === 'dark') aplicarTema(cache)

    async function cargarPreferencia() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data } = await supabase
          .from('users')
          .select('theme_preference')
          .eq('auth_uid', session.user.id)
          .single()
        if (data?.theme_preference === 'light' || data?.theme_preference === 'dark') {
          aplicarTema(data.theme_preference)
          return
        }
      }
      if (!cache) {
        const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches
        aplicarTema(prefiereOscuro ? 'dark' : 'light')
      }
    }
    cargarPreferencia()
  }, [])

  const toggleTheme = useCallback(async () => {
    const nuevo: Theme = theme === 'light' ? 'dark' : 'light'
    aplicarTema(nuevo)

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch('/api/perfil/tema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ theme: nuevo }),
      })
    }
  }, [theme])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
