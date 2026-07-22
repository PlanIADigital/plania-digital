// ============================================================
//  PlanIA Digital — API: Lista de usuarios para Super Admin
//  app/api/admin/usuarios/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function GET(request: Request) {
  try {
    const auth = await verificarSuperAdmin(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin } = auth

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('full_name, email, role, cct_primary, membership_status, created_at')
      .eq('is_super_admin', false)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ usuarios: [] })

    return NextResponse.json({ usuarios: data || [] })
  } catch {
    return NextResponse.json({ usuarios: [] })
  }
}