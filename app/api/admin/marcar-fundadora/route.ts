// ============================================================
//  PlanIA Digital — API: Marcar/desmarcar educadora fundadora
//  app/api/admin/marcar-fundadora/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function POST(request: NextRequest) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin } = auth

  const { auth_uid, es_fundadora } = await request.json()
  if (!auth_uid || typeof es_fundadora !== 'boolean') {
    return NextResponse.json({ error: 'Faltan datos: auth_uid y es_fundadora (boolean)' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ es_fundadora })
    .eq('auth_uid', auth_uid)

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}