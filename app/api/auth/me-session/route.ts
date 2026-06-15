// ============================================================
//  PlanIA Digital — API: verificar sesión activa + is_super_admin
//  app/api/auth/me-session/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Sin token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { data } = await supabaseAdmin
      .from('users')
      .select('is_super_admin, role')
      .eq('auth_uid', user.id)
      .single()

    return NextResponse.json({
      is_super_admin: data?.is_super_admin ?? false,
      role: data?.role ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
