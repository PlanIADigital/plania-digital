// ============================================================
//  PlanIA Digital — Estado de cuenta del usuario
//  app/api/estado-cuenta/route.ts
//
//  Lee la vista v_estado_cuenta (fecha_pago + ciclo_pago_actual +
//  suma de días hábiles activos generados en el ciclo vigente).
//  Fuente única de verdad — cualquier pantalla futura (Dashboard,
//  Admin, etc.) puede reusar este mismo endpoint o consultar la
//  vista directamente, sin duplicar el cálculo.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin, usuario } = auth

  // v_estado_cuenta se filtra por auth_uid (viene del usuario verificado)
  const { data, error } = await supabaseAdmin
    .from('v_estado_cuenta')
    .select('fecha_pago, ciclo_inicio, ciclo_fin, dias_habiles_generados_ciclo')
    .eq('auth_uid', usuario.auth_uid)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo obtener el estado de cuenta' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...data })
}