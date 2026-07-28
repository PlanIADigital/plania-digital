import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function resolverUserId(auth_uid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', auth_uid)
    .maybeSingle()
  if (error || !data) return null
  return data.id
}

function siguienteCodigo(codigosExistentes: string[]): string {
  let max = 0
  for (const c of codigosExistentes) {
    const m = c.match(/^AL-(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  const siguiente = max + 1
  return `AL-${String(siguiente).padStart(2, '0')}`
}

// GET /api/alumnos-codigo?auth_uid=...
// Regresa los alumnos activos, ordenados por fecha de alta.
export async function GET(request: NextRequest) {
  const auth_uid = request.nextUrl.searchParams.get('auth_uid')
  if (!auth_uid) {
    return NextResponse.json({ error: 'Falta auth_uid' }, { status: 400 })
  }

  const userId = await resolverUserId(auth_uid)
  if (!userId) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('alumnos_codigo')
    .select('id, codigo, fecha_alta, fecha_baja, activo')
    .eq('user_id', userId)
    .eq('activo', true)
    .order('fecha_alta', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, alumnos: data || [] })
}

// POST /api/alumnos-codigo
// body: { auth_uid, accion: 'agregar' } -> da de alta el siguiente código consecutivo
// body: { auth_uid, accion: 'bootstrap', total } -> pre-puebla AL-01..AL-N (solo si no hay ninguno todavía)
export async function POST(request: NextRequest) {
  const { auth_uid, accion, total } = await request.json()

  if (!auth_uid || !accion) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const userId = await resolverUserId(auth_uid)
  if (!userId) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const { data: existentes, error: errorExistentes } = await supabase
    .from('alumnos_codigo')
    .select('codigo')
    .eq('user_id', userId)

  if (errorExistentes) {
    return NextResponse.json({ error: errorExistentes.message }, { status: 500 })
  }

  const codigosExistentes = (existentes || []).map(r => r.codigo)

  if (accion === 'bootstrap') {
    if (codigosExistentes.length > 0) {
      return NextResponse.json({ error: 'Ya existen alumnos registrados, no se puede pre-poblar.' }, { status: 400 })
    }
    // [jul 2026] Resta los alumnos de inclusión al total, porque ellos
    // ya tienen su propio código (iniciales) en alumnos_inclusion —
    // no deben contarse dos veces (una vez como AL-XX y otra con su
    // código de inclusión).
    const { data: userRow } = await supabase.from('users').select('alumnos_inclusion').eq('id', userId).maybeSingle()
    const totalInclusion = Array.isArray(userRow?.alumnos_inclusion) ? userRow.alumnos_inclusion.length : 0
    const totalNum = typeof total === 'number' && total > 0 ? Math.min(total, 60) - totalInclusion : 0
    if (totalNum === 0) {
      return NextResponse.json({ error: 'Total inválido para pre-poblar.' }, { status: 400 })
    }
    const filas = Array.from({ length: totalNum }, (_, i) => ({
      user_id: userId,
      codigo: `AL-${String(i + 1).padStart(2, '0')}`,
    }))
    const { data, error } = await supabase.from('alumnos_codigo').insert(filas).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, alumnos: data })
  }

  if (accion === 'agregar') {
    const nuevoCodigo = siguienteCodigo(codigosExistentes)
    const { data, error } = await supabase
      .from('alumnos_codigo')
      .insert({ user_id: userId, codigo: nuevoCodigo })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, alumno: data })
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
}