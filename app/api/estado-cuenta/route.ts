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
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const authUid = request.nextUrl.searchParams.get('auth_uid')
  if (!authUid) return NextResponse.json({ error: 'Falta auth_uid' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabaseAdmin
    .from('v_estado_cuenta')
    .select('fecha_pago, ciclo_inicio, ciclo_fin, dias_habiles_generados_ciclo')
    .eq('auth_uid', authUid)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo obtener el estado de cuenta' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...data })
}