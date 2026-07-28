// ============================================================
//  PlanIA Digital — API: Estado del Catálogo CCT
//  app/api/admin/cct-catalogo-estado/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
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

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { archivo_nombre, registros_count, actualizado_por } = body

  if (!archivo_nombre || !registros_count) {
    return NextResponse.json({ error: 'Faltan datos: archivo_nombre y registros_count son requeridos.' }, { status: 400 })
  }

  const { data, error } = await supabase
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