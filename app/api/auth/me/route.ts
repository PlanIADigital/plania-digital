// ============================================================
//  PlanIA Digital — API: verificar rol del usuario autenticado
//  app/api/auth/me/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'

export async function POST(request: Request) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth

    const { data } = await supabaseAdmin
      .from('users')
      .select('is_super_admin, role')
      .eq('id', usuario.id)
      .single()

    return NextResponse.json({
      is_super_admin: data?.is_super_admin ?? false,
      role: data?.role ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
