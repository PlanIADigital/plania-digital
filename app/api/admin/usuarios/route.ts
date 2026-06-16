// ============================================================
//  PlanIA Digital — API: Lista de usuarios para Super Admin
//  app/api/admin/usuarios/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('full_name, email, role, cct, subscription_status, created_at')
      .eq('is_super_admin', false)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ usuarios: [] })

    return NextResponse.json({ usuarios: data || [] })
  } catch {
    return NextResponse.json({ usuarios: [] })
  }
}
