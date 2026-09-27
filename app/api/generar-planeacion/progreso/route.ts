// ============================================================
//  PlanIA Digital — API: Crear y consultar progreso de generación
//  app/api/generar-planeacion/progreso/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
export async function POST(request: NextRequest) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth

    const { job_id } = await request.json()
    if (!job_id) {
      return NextResponse.json({ error: 'Falta job_id' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('generacion_progreso').insert({
      job_id,
      user_id: usuario.id,
      estado: 'en_progreso',
      fase_actual: 'Iniciando...',
      total_lotes: 0,
      lotes_completados: 0,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
export async function GET(request: NextRequest) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')
    if (!jobId) {
      return NextResponse.json({ error: 'Falta job_id' }, { status: 400 })
    }

    // Solo se puede consultar el progreso de un job propio
    const { data, error } = await supabaseAdmin
      .from('generacion_progreso')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_id', usuario.id)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'No se encontró ese trabajo de generación' }, { status: 404 })
    }
        return NextResponse.json({
      totalLotes: data.total_lotes,
      lotesCompletados: data.lotes_completados,
      faseActual: data.fase_actual,
      estado: data.estado,
      errorMensaje: data.error_mensaje,
      fasesLotes: data.fases_lotes || [],
      planningId: data.planning_id || null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}