// ============================================================
//  PlanIA Digital — API: Activar/desactivar membresía manualmente
//  app/api/admin/activar-membresia/route.ts
//
//  [sep 2026] Activación manual mientras no hay pasarela de pago:
//  al activar, pone membership_status='active' y renueva
//  fecha_pago a "ahora" — esto reinicia el ciclo de pago vigente
//  que ya calcula v_estado_cuenta/ciclo_pago_actual, sin tocar esa
//  lógica. Al desactivar, solo cambia el status a 'suspended';
//  fecha_pago se conserva tal cual (no hay motivo para tocarla).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function POST(request: NextRequest) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin } = auth

  const { auth_uid, activar } = await request.json()
  if (!auth_uid || typeof activar !== 'boolean') {
    return NextResponse.json({ error: 'Faltan datos: auth_uid y activar (boolean)' }, { status: 400 })
  }

  const cambios: any = { membership_status: activar ? 'active' : 'suspended' }
  if (activar) cambios.fecha_pago = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('users')
    .update(cambios)
    .eq('auth_uid', auth_uid)

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}