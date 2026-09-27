// ============================================================
//  PlanIA Digital — fetch autenticado para rutas /api de usuario normal
//  lib/fetchConSesion.ts
//
//  Igual que fetchAdmin pero para cualquier usuaria logueada: el
//  token de sesión viaja en el header Authorization y el servidor
//  lo verifica con lib/verificarUsuario.ts. Así el navegador nunca
//  manda su propio auth_uid / user_id.
// ============================================================
'use client'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

export async function fetchConSesion(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Sin sesión activa')
  }
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
}
