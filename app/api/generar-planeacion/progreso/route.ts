// ============================================================
//  PlanIA Digital — API: Crear y consultar progreso de generación
//  app/api/generar-planeacion/progreso/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function POST(request: NextRequest) {
  try {
    const { job_id, user_id } = await request.json()
    if (!job_id) {
      return NextResponse.json({ error: 'Falta job_id' }, { status: 400 })
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { error } = await supabaseAdmin.from('generacion_progreso').insert({
      job_id,
      user_id: user_id || null,
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
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')
    if (!jobId) {
      return NextResponse.json({ error: 'Falta job_id' }, { status: 400 })
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabaseAdmin
      .from('generacion_progreso')
      .select('*')
      .eq('job_id', jobId)
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
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}