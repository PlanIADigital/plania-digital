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
        ciclo: datos.ciclo || '2025-2026',
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

    const { tipo, estado, ciclo } = await request.json()
    if (!tipo || !estado) {
      return NextResponse.json({ error: 'Faltan datos (tipo o estado)' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('calendarios_sep')
      .delete()
      .eq('tipo', tipo)
      .eq('estado', estado)
      .eq('ciclo', ciclo || '2025-2026')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}