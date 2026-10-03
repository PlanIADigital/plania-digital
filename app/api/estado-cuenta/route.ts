// ============================================================
//  PlanIA Digital — Estado de cuenta del usuario
//  app/api/estado-cuenta/route.ts
//
//  Lee la vista v_estado_cuenta (fecha_pago + ciclo_pago_actual +
//  suma de días hábiles activos generados en el ciclo vigente).
//  Fuente única de verdad — cualquier pantalla futura (Dashboard,
//  Admin, etc.) puede reusar este mismo endpoint o consultar la
//  vista directamente, sin duplicar el cálculo.
//
//  [2 oct 2026] También informa el tope mensual de días hábiles
//  (lib/topeDiasHabiles.ts): si aplica a esta cuenta, el tope y cuántos
//  días le quedan. Así la pantalla avisa ANTES de que la educadora
//  llene el formulario; el servidor de generación lo vuelve a revisar.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { TOPE_DIAS_HABILES, tieneTope } from '@/lib/topeDiasHabiles'

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

  const { data: perfil } = await supabaseAdmin
    .from('users')
    .select('membership_status')
    .eq('auth_uid', usuario.auth_uid)
    .single()

  const aplicaTope = tieneTope(perfil?.membership_status)
  const usados = Math.max(0, Number(data.dias_habiles_generados_ciclo) || 0)

  return NextResponse.json({
    ok: true,
    ...data,
    tiene_tope: aplicaTope,
    tope_dias_habiles: aplicaTope ? TOPE_DIAS_HABILES : null,
    dias_habiles_restantes: aplicaTope ? Math.max(0, TOPE_DIAS_HABILES - usados) : null,
  })
}
