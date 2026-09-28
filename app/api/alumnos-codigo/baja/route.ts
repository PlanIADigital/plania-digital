import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { fechaLocalISO, zonaHorariaPorCCT } from '@/lib/fechaMexico'

// POST /api/alumnos-codigo/baja
// body: { id } -> marca ese registro como inactivo (activo=false, fecha_baja=hoy)
// El código NUNCA se reutiliza ni se borra — solo se marca de baja.
// El usuario se identifica por el token Bearer (verificarUsuario).
export async function POST(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin: supabase, usuario } = auth

  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  // Verifica que el registro pertenezca a este usuario antes de modificarlo
  const { data, error } = await supabase
    .from('alumnos_codigo')
    .update({ activo: false, fecha_baja: fechaLocalISO(new Date(), zonaHorariaPorCCT(usuario.cct_primary)) })
    .eq('id', id)
    .eq('user_id', usuario.id)
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