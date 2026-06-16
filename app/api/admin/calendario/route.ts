// ============================================================
//  PlanIA Digital — API: Guardar calendario SEP
//  app/api/admin/calendario/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { tipo, datos } = await request.json()

    if (!tipo || !datos) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { error } = await supabaseAdmin
      .from('calendarios_sep')
      .upsert({
        tipo,
        ciclo: datos.ciclo || '2025-2026',
        datos,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'tipo,ciclo' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
