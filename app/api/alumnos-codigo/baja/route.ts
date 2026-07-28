import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// POST /api/alumnos-codigo/baja
// body: { auth_uid, id } -> marca ese registro como inactivo (activo=false, fecha_baja=hoy)
// El código NUNCA se reutiliza ni se borra — solo se marca de baja.
export async function POST(request: NextRequest) {
  const { auth_uid, id } = await request.json()

  if (!auth_uid || !id) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', auth_uid)
    .maybeSingle()

  if (userError || !userRow) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Verifica que el registro pertenezca a este usuario antes de modificarlo
  const { data, error } = await supabase
    .from('alumnos_codigo')
    .update({ activo: false, fecha_baja: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
    .eq('user_id', userRow.id)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Registro no encontrado o no pertenece a este usuario.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, alumno: data })
}