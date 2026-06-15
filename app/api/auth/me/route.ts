// ============================================================
//  PlanIA Digital — API: verificar rol del usuario autenticado
//  app/api/auth/me/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { auth_uid } = await request.json()
    if (!auth_uid) return NextResponse.json({ error: 'Sin auth_uid' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

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
