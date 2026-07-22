// ============================================================
//  PlanIA Digital — fetch autenticado para rutas /api/admin
//  lib/fetchAdmin.ts
//
//  Reemplaza cualquier fetch('/api/admin/...') en páginas de
//  /app/admin/* por fetchAdmin('/api/admin/...') para que el
//  token de sesión viaje en el header Authorization.
// ============================================================

'use client'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function fetchAdmin(url: string, options: RequestInit = {}) {
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