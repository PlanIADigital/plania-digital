// ============================================================
//  PlanIA Digital — API: Estado del Catálogo CCT
//  app/api/admin/cct-catalogo-estado/route.ts
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
    .from('admin_cct_catalogo')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'No se pudo consultar el estado del catálogo.' }, { status: 500 })
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
  const { archivo_nombre, registros_count, actualizado_por } = body

  if (!archivo_nombre || !registros_count) {
    return NextResponse.json({ error: 'Faltan datos: archivo_nombre y registros_count son requeridos.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('admin_cct_catalogo')
    .insert({
      archivo_nombre,
      registros_count,
      actualizado_por: actualizado_por || null,
      fecha_actualizacion: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo registrar la actualización.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}