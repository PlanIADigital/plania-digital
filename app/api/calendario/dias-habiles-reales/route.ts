// ============================================================
//  PlanIA Digital — API: Días hábiles reales dentro del ciclo
//  app/api/calendario/dias-habiles-reales/route.ts
//
//  [jul 2026] Endpoint ligero para que el frontend (Nueva Planeación)
//  pueda saber, ANTES de generar, cuántos días hábiles reales caben
//  en un rango de fechas — sin gastar ninguna llamada a la IA. Usa
//  exactamente el mismo cálculo que generar-planeacion/route.ts (vía
//  lib/calendarioEscolar.ts) para que nunca puedan desincronizarse.
//
//  [sep 2026] Ahora también devuelve el detalle de cada día excluido
//  (fecha + motivo real: "Vacaciones de invierno", "CTE", "Día de la
//  Independencia"...) en vez de solo el conteo — antes el frontend
//  mostraba un genérico "vacaciones, CTE o fuera del ciclo" aunque el
//  motivo real ya estaba disponible en el cálculo.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { obtenerCalendarioEstatal, calcularDiasHabiles, CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const fechaInicio = searchParams.get('fecha_inicio')
    const fechaFin = searchParams.get('fecha_fin')
    const ciclo = searchParams.get('ciclo') || CICLO_ESCOLAR_ACTIVO

    if (!estado || !fechaInicio || !fechaFin) {
      return NextResponse.json({ error: 'Faltan parámetros (estado, fecha_inicio, fecha_fin)' }, { status: 400 })
    }

    const calDatos = await obtenerCalendarioEstatal(supabaseAdmin, estado, ciclo)
    const todosDias = calcularDiasHabiles(calDatos, fechaInicio, fechaFin)
    const diasHabilesReales = todosDias.filter(d => !d.esCTE && !d.motivo).length
    const diasExcluidos = todosDias.length - diasHabilesReales
    const diasExcluidosDetalle = todosDias
      .filter(d => d.esCTE || d.motivo)
      .map(d => ({ fecha: d.fecha, label: d.label, motivo: d.motivo || 'CTE' }))

    return NextResponse.json({ diasHabilesReales, diasExcluidos, diasExcluidosDetalle })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}