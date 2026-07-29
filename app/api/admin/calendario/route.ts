// ============================================================
//  PlanIA Digital — API: Guardar / eliminar calendario SEP
//  app/api/admin/calendario/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function POST(request: Request) {
  try {
    const auth = await verificarSuperAdmin(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin } = auth
    const { tipo, estado, datos } = await request.json()
    if (!tipo || !estado || !datos) {
      return NextResponse.json({ error: 'Faltan datos (tipo, estado o datos)' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('calendarios_sep')
      .upsert({
        tipo,
        estado,
        ciclo: datos.ciclo || 'sin-ciclo',
        datos,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'tipo,ciclo,estado' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verificarSuperAdmin(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin } = auth
    const { tipo, estado } = await request.json()
    if (!tipo || !estado) {
      return NextResponse.json({ error: 'Faltan datos (tipo o estado)' }, { status: 400 })
    }
    // Ya NO se filtra por ciclo: al eliminar, se borran TODOS los
    // registros de este tipo+estado sin importar de qué ciclo sean,
    // así el bote de basura siempre limpia por completo antes de
    // que subas el archivo actualizado.
    const { error } = await supabaseAdmin
      .from('calendarios_sep')
      .delete()
      .eq('tipo', tipo)
      .eq('estado', estado)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}