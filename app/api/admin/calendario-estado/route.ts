// ============================================================
//  PlanIA Digital — API: Estado de calendarios cargados
//  app/api/admin/calendario-estado/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function GET(request: NextRequest) {
  try {
    const auth = await verificarSuperAdmin(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin } = auth
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') || '19'

    // Ya NO se filtra por un ciclo escolar fijo escrito a mano.
    // Siempre se evalúa el registro MÁS RECIENTE de cada tipo+estado,
    // sin importar qué ciclo escolar sea — así el panel nunca se queda
    // "atorado" apuntando a un ciclo viejo cuando cambia el año.
    const { data } = await supabaseAdmin
      .from('calendarios_sep')
      .select('tipo, estado, datos, actualizado_en')
      .order('actualizado_en', { ascending: false })

    const registros = data || []

    const federalRow = registros.find((r: any) => r.tipo === 'federal' && r.estado === 'FED')
    const federal = !!federalRow

    const registroEstatal = registros.find((r: any) => r.tipo === 'estatal' && r.estado === estado)
    const estatal = !!registroEstatal
    const estatalEsFederal = !!(registroEstatal?.datos?.origen_calendario === 'federal_sin_cambios')

    // Lista de estados que YA tienen calendario estatal cargado (para mostrar en el dropdown)
    const estadosConEstatal = Array.from(new Set(
      registros.filter((r: any) => r.tipo === 'estatal').map((r: any) => r.estado)
    ))

    return NextResponse.json({ federal, estatal, estadosConEstatal, estatalEsFederal })
  } catch {
    return NextResponse.json({ federal: false, estatal: false, estadosConEstatal: [], estatalEsFederal: false })
  }
}