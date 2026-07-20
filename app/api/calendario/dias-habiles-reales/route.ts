// ============================================================
//  PlanIA Digital — API: Días hábiles reales dentro del ciclo
//  app/api/calendario/dias-habiles-reales/route.ts
//
//  [jul 2026] Endpoint ligero para que el frontend (Nueva Planeación)
//  pueda saber, ANTES de generar, cuántos días hábiles reales caben
//  en un rango de fechas — sin gastar ninguna llamada a la IA. Usa
//  exactamente el mismo cálculo que generar-planeacion/route.ts (vía
//  lib/calendarioEscolar.ts) para que nunca puedan desincronizarse.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { obtenerCalendarioEstatal, calcularDiasHabiles } from '@/lib/calendarioEscolar'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const fechaInicio = searchParams.get('fecha_inicio')
    const fechaFin = searchParams.get('fecha_fin')
    const ciclo = searchParams.get('ciclo') || '2025-2026'

    if (!estado || !fechaInicio || !fechaFin) {
      return NextResponse.json({ error: 'Faltan parámetros (estado, fecha_inicio, fecha_fin)' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const calDatos = await obtenerCalendarioEstatal(supabaseAdmin, estado, ciclo)
    const todosDias = calcularDiasHabiles(calDatos, fechaInicio, fechaFin)
    const diasHabilesReales = todosDias.filter(d => !d.esCTE && !d.motivo).length
    const diasExcluidos = todosDias.length - diasHabilesReales

    return NextResponse.json({ diasHabilesReales, diasExcluidos })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}