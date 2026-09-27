import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'

export async function GET(req: NextRequest) {
  try {
    const auth = await verificarUsuario(req)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth

    // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
    // el id interno viene ya verificado desde el token (usuario.id)
    const { data: historial, error: historialError } = await supabaseAdmin
      .from('documentos_historial')
      .select('seccion, created_at, version_numero')
      .eq('user_id', usuario.id)
      .eq('activo', true)

    if (historialError) {
      return NextResponse.json({ error: historialError.message }, { status: 500 })
    }

    // Mapa seccion -> { fecha de la versión activa, número de versión } —
    // el número de versión permite decidir cuándo mostrar el botón
    // "Historial" (solo a partir de la 2ª versión subida)
    const fechas: Record<string, { fecha: string; version: number }> = {}
    ;(historial || []).forEach((row: any) => {
      fechas[row.seccion] = { fecha: row.created_at, version: row.version_numero }
    })

    return NextResponse.json({ ok: true, fechas })
  } catch (error) {
    console.error('Error en documentos-historial/fechas:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}