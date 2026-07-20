// ============================================================
//  PlanIA Digital — API: Consultar fin de ciclo escolar por estado
//  app/api/calendario/fin-ciclo/route.ts
//
//  Corre en el servidor con la llave de servicio — necesario porque
//  "calendarios_sep" tiene RLS activado (relrowsecurity = true) sin
//  ninguna política definida, así que cualquier consulta directa desde
//  el navegador (rol anon/authenticated) recibe 0 filas en silencio,
//  sin error. Este endpoint entrega ÚNICAMENTE la fecha de fin de
//  ciclo del estado solicitado — nunca el resto de los datos
//  administrativos de esa tabla.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const ciclo = searchParams.get('ciclo') || '2025-2026'
    if (!estado) {
      return NextResponse.json({ error: 'Falta estado' }, { status: 400 })
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabaseAdmin
      .from('calendarios_sep')
      .select('datos')
      .eq('ciclo', ciclo)
      .eq('tipo', 'estatal')
      .eq('estado', estado)
      .maybeSingle()

    if (error) {
      console.error(`Error al leer fin_clases para estado "${estado}":`, error.message)
      return NextResponse.json({ finClases: null })
    }
    return NextResponse.json({ finClases: data?.datos?.fin_clases || null })
  } catch {
    return NextResponse.json({ finClases: null })
  }
}