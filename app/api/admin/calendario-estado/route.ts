// ============================================================
//  PlanIA Digital — API: Estado de calendarios cargados
//  app/api/admin/calendario-estado/route.ts
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data } = await supabaseAdmin
      .from('calendarios_sep')
      .select('tipo')
      .eq('ciclo', '2025-2026')

    const tipos = (data || []).map((r: any) => r.tipo)

    return NextResponse.json({
      federal: tipos.includes('federal'),
      estatal: tipos.includes('estatal'),
    })
  } catch {
    return NextResponse.json({ federal: false, estatal: false })
  }
}
