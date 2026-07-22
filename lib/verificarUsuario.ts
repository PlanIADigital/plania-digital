// ============================================================
//  PlanIA Digital — Guardia de sesión para rutas de usuario normal
//  lib/verificarUsuario.ts
//
//  A diferencia de verificarSuperAdmin.ts, esta guardia solo exige
//  una sesión válida (cualquier rol) — úsala en rutas API que
//  cualquier usuaria logueada puede llamar, ej. /api/misiones/*
//
//  Uso:
//    const auth = await verificarUsuario(request)
//    if (!auth.autorizado) {
//      return NextResponse.json({ error: auth.error }, { status: auth.status })
//    }
//    // auth.usuario trae el registro de la tabla users
//    // auth.supabaseAdmin bypasea RLS — úsalo con cuidado
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

type ResultadoAuth =
  | { autorizado: true; supabaseAdmin: SupabaseClient; usuario: any }
  | { autorizado: false; status: number; error: string }

export async function verificarUsuario(request: Request): Promise<ResultadoAuth> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { autorizado: false, status: 401, error: 'Sin token de autorización' }
  }

  const token = authHeader.replace('Bearer ', '')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: { user }, error: errorToken } = await supabaseAdmin.auth.getUser(token)

  if (errorToken || !user) {
    return { autorizado: false, status: 401, error: 'Token inválido o expirado' }
  }

  const { data: usuario, error: errorUsuario } = await supabaseAdmin
    .from('users')
    .select('id, full_name, role, cct_primary')
    .eq('auth_uid', user.id)
    .single()

  if (errorUsuario || !usuario) {
    return { autorizado: false, status: 403, error: 'Perfil de usuario no encontrado' }
  }

  return { autorizado: true, supabaseAdmin, usuario }
}

// Traduce el `role` de la tabla users al `rol_aplicable` de las
// tablas msn_* (educadora/educador → 'educadora', etc.)
export function rolAplicableDe(role: string | null | undefined): 'educadora' | 'directivo' | 'musica' {
  if (role === 'directivo') return 'directivo'
  if (role?.includes('musica')) return 'musica'
  return 'educadora'
}
