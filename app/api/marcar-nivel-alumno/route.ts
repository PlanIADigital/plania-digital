import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// POST /api/marcar-nivel-alumno
// body: { auth_uid, planning_id, codigo, nivel }
// Actualiza el nivel_marcado de UN alumno dentro de
// content_json.instrumento_evaluacion.registro_alumnos, sin tocar el
// resto del contenido de la planeación (días, ajustes, etc.).
export async function POST(request: NextRequest) {
  const { auth_uid, planning_id, codigo, nivel } = await request.json()

  if (!auth_uid || !planning_id || !codigo) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  // Resuelve el id interno del usuario para verificar dueño de la planeación
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', auth_uid)
    .maybeSingle()

  if (userError || !userRow) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const { data: planning, error: fetchError } = await supabase
    .from('plannings')
    .select('content_json, user_id')
    .eq('id', planning_id)
    .maybeSingle()

  if (fetchError || !planning) {
    return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 })
  }

  if (planning.user_id !== userRow.id) {
    return NextResponse.json({ error: 'Esta planeación no pertenece a este usuario' }, { status: 403 })
  }

  const content = planning.content_json || {}
  const instrumento = content.instrumento_evaluacion

  if (!instrumento || !Array.isArray(instrumento.registro_alumnos)) {
    return NextResponse.json({ error: 'Esta planeación no tiene instrumento de evaluación' }, { status: 400 })
  }

  const yaExiste = instrumento.registro_alumnos.some((a: any) => a.codigo === codigo)
  if (!yaExiste) {
    return NextResponse.json({ error: 'Ese código de alumno no está en el registro de esta planeación' }, { status: 400 })
  }

  const registroActualizado = instrumento.registro_alumnos.map((a: any) =>
    a.codigo === codigo ? { ...a, nivel_marcado: nivel || null } : a
  )

  const contentActualizado = {
    ...content,
    instrumento_evaluacion: { ...instrumento, registro_alumnos: registroActualizado },
  }

  const { error: updateError } = await supabase
    .from('plannings')
    .update({ content_json: contentActualizado })
    .eq('id', planning_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}