// ============================================================
//  PlanIA Digital — API: Control de Avances SaaS
//  app/api/admin/avances/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function GET(request: NextRequest) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin } = auth

  const { data, error } = await supabaseAdmin
    .from('admin_avances')
    .select('*')
    .order('categoria', { ascending: true })
    .order('orden', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'No se pudo consultar el control de avances.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin } = auth

  const body = await request.json()
  const { id, estado, nota } = body

  if (!id) {
    return NextResponse.json({ error: 'Falta el id del elemento.' }, { status: 400 })
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (estado !== undefined) updates.estado = estado
  if (nota !== undefined) updates.nota = nota

  const { data, error } = await supabaseAdmin
    .from('admin_avances')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar el elemento.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin } = auth

  const body = await request.json()
  const { categoria, elemento } = body

  if (!categoria || !elemento) {
    return NextResponse.json({ error: 'Faltan datos: categoria y elemento son requeridos.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('admin_avances')
    .insert({ categoria, elemento, estado: 'pendiente', orden: 999 })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo agregar el elemento.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}