// ============================================================
//  PlanIA Digital — Super Admin: Consultar ciclos ya cerrados
//  app/api/admin/cierres-ciclo/route.ts
//
//  [sep 2026] Endpoint de solo lectura — separado de
//  /api/admin/cerrar-ciclo (que solo hace POST para ejecutar el
//  cierre) para que la pantalla pueda saber, al cargar, si el
//  ciclo escrito en el campo ya fue cerrado antes, sin depender
//  de que el fundador lo haya cerrado en esa misma sesión.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function GET(request: NextRequest) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin } = auth

  const { data, error } = await supabaseAdmin
    .from('cierres_ciclo')
    .select('ciclo_cerrado, fecha_cierre')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ciclosCerrados: data || [] })
}