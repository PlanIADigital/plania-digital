// ============================================================
//  PlanIA Digital — API: Marcar/desmarcar educadora fundadora
//  app/api/admin/marcar-fundadora/route.ts
//
//  [2 oct 2026] UNA SOLA FUENTE DE VERDAD PARA "FUNDADORA".
//  Antes este botón solo cambiaba `es_fundadora` (la estrella), pero el
//  acceso para generar y la exención del tope de días hábiles dependen de
//  `membership_status = 'founder'`. Resultado: una cuenta podía tener la
//  estrella sin acceso, o acceso sin la estrella. Ahora los dos campos
//  cambian SIEMPRE juntos:
//    - Marcar  → es_fundadora = true  y membership_status = 'founder'
//    - Quitar  → es_fundadora = false y membership_status = 'suspended'
//      (solo lectura: conserva y descarga lo que ya tiene; para volver a
//      generar, se activa como membresía pagada con el botón normal).
//  Nunca se borra la cuenta: si regresa, se vuelve a marcar o se activa.
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

  const membership_status = es_fundadora ? 'founder' : 'suspended'

  const { error } = await supabaseAdmin
    .from('users')
    .update({ es_fundadora, membership_status })
    .eq('auth_uid', auth_uid)

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, es_fundadora, membership_status })
}
