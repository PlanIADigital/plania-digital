import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const auth_uid = req.nextUrl.searchParams.get('auth_uid')
    const seccion = req.nextUrl.searchParams.get('seccion')
    if (!auth_uid || !seccion) {
      return NextResponse.json({ error: 'Faltan auth_uid o seccion' }, { status: 400 })
    }

    // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
    // hay que resolver primero el id interno del usuario
    const { data: usuarioRow, error: usuarioError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_uid', auth_uid)
      .maybeSingle()

    if (usuarioError || !usuarioRow) {
      return NextResponse.json({ ok: true, versiones: [] })
    }

    const { data: versiones, error: versionesError } = await supabaseAdmin
      .from('documentos_historial')
      .select('version_numero, resumen, created_at, activo')
      .eq('user_id', usuarioRow.id)
      .eq('seccion', seccion)
      .order('version_numero', { ascending: false })

    if (versionesError) {
      return NextResponse.json({ error: versionesError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, versiones: versiones || [] })
  } catch (error) {
    console.error('Error en documentos-historial/lista:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}