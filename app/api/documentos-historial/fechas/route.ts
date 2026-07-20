import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const auth_uid = req.nextUrl.searchParams.get('auth_uid')
    if (!auth_uid) {
      return NextResponse.json({ error: 'Falta auth_uid' }, { status: 400 })
    }

    // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
    // hay que resolver primero el id interno del usuario
    const { data: usuarioRow, error: usuarioError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_uid', auth_uid)
      .maybeSingle()

    if (usuarioError || !usuarioRow) {
      // Si no se encuentra el usuario, simplemente no hay fechas que mostrar —
      // no es un error fatal para la pantalla de Mi Grupo
      return NextResponse.json({ ok: true, fechas: {} })
    }

    const { data: historial, error: historialError } = await supabaseAdmin
      .from('documentos_historial')
      .select('seccion, created_at')
      .eq('user_id', usuarioRow.id)
      .eq('activo', true)

    if (historialError) {
      return NextResponse.json({ error: historialError.message }, { status: 500 })
    }

    // Mapa seccion -> created_at de la versión activa (una por sección)
    const fechas: Record<string, string> = {}
    ;(historial || []).forEach((row: any) => {
      fechas[row.seccion] = row.created_at
    })

    return NextResponse.json({ ok: true, fechas })
  } catch (error) {
    console.error('Error en documentos-historial/fechas:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}