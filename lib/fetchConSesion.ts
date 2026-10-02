// ============================================================
//  PlanIA Digital — fetch autenticado para rutas /api de usuario normal
//  lib/fetchConSesion.ts
//
//  Igual que fetchAdmin pero para cualquier usuaria logueada: el
//  token de sesión viaja en el header Authorization y el servidor
//  lo verifica con lib/verificarUsuario.ts. Así el navegador nunca
//  manda su propio auth_uid / user_id.
//
//  [1 oct 2026] Sesión vencida: antes se mandaba el token vencido y
//  cada página mostraba datos incompletos (p. ej. Mi Grupo ofrecía
//  "Generar códigos iniciales" como si no hubiera alumnos). Ahora:
//   1) si el servidor responde 401, se renueva la sesión en silencio
//      y se repite la petición una sola vez;
//   2) si no se puede renovar, se cierra la sesión SOLO en este
//      dispositivo y se manda al login con aviso, regresando después
//      a la página donde estaba la educadora.
// ============================================================
'use client'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

// Evita varias redirecciones si fallan varias peticiones a la vez.
let redirigiendo = false

function mandarALogin() {
  if (typeof window === 'undefined' || redirigiendo) return
  redirigiendo = true
  const actual = window.location.pathname + window.location.search
  const next = actual.startsWith('/auth') ? '' : `&next=${encodeURIComponent(actual)}`
  window.location.href = `/auth/login?motivo=sesion${next}`
}

async function conToken(url: string, options: RequestInit, token: string) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function fetchConSesion(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    mandarALogin()
    throw new Error('Sin sesión activa')
  }

  let res = await conToken(url, options, session.access_token)
  if (res.status !== 401) return res

  // 1) Intento de renovación silenciosa
  const { data: renovada, error } = await supabase.auth.refreshSession()
  if (!error && renovada?.session?.access_token) {
    res = await conToken(url, options, renovada.session.access_token)
    if (res.status !== 401) return res
  }

  // 2) No se pudo renovar: cerrar sesión solo aquí y volver a entrar
  try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* sin conexión */ }
  mandarALogin()
  throw new Error('Tu sesión terminó. Vuelve a entrar para continuar.')
}
