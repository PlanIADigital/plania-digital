// ============================================================
//  PlanIA Digital — Guardia de seguridad para rutas /api/admin
//  lib/verificarSuperAdmin.ts
//
//  Uso en cualquier route.ts bajo app/api/admin/*:
//
//    const auth = await verificarSuperAdmin(request)
//    if (!auth.autorizado) {
//      return NextResponse.json({ error: auth.error }, { status: auth.status })
//    }
//    // a partir de aquí ya puedes usar auth.supabaseAdmin con confianza
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

type ResultadoAuth =
  | { autorizado: true; supabaseAdmin: SupabaseClient; userId: string }
  | { autorizado: false; status: number; error: string }

export async function verificarSuperAdmin(request: Request): Promise<ResultadoAuth> {
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

  const { data: perfil, error: errorPerfil } = await supabaseAdmin
    .from('users')
    .select('is_super_admin')
    .eq('auth_uid', user.id)
    .single()

  if (errorPerfil || !perfil?.is_super_admin) {
    return { autorizado: false, status: 403, error: 'No tienes permisos de Super Admin' }
  }

  return { autorizado: true, supabaseAdmin, userId: user.id }
}