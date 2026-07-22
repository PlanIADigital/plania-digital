// ============================================================
//  PlanIA Digital — API: ranking de Misiones
//  app/api/misiones/ranking/route.ts
//
//  Tabla de clasificación acotada al mismo rol_aplicable de quien
//  consulta (educadoras compiten entre educadoras, etc.)
// ============================================================
import { NextResponse } from 'next/server'
import { verificarUsuario, rolAplicableDe } from '@/lib/verificarUsuario'

export async function GET(request: Request) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth
    const rolAplicable = rolAplicableDe(usuario.role)

    const { data: ranking } = await supabaseAdmin
      .from('msn_ranking_cache')
      .select('user_id, full_name, xp_total, nivel_gamificacion')
      .eq('rol_aplicable', rolAplicable)
      .order('xp_total', { ascending: false })
      .limit(20)

    return NextResponse.json({ ranking: ranking || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
