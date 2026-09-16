// ============================================================
//  PlanIA Digital — API: verificar rol del usuario autenticado
//  app/api/auth/me/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { auth_uid } = await request.json()
    if (!auth_uid) return NextResponse.json({ error: 'Sin auth_uid' }, { status: 400 })

    const { data } = await supabaseAdmin
      .from('users')
      .select('is_super_admin, role')
      .eq('auth_uid', auth_uid)
      .single()

    return NextResponse.json({
      is_super_admin: data?.is_super_admin ?? false,
      role: data?.role ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
