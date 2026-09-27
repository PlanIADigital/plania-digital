import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'

export async function GET(req: NextRequest) {
  try {
    const auth = await verificarUsuario(req)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth

    const seccion = req.nextUrl.searchParams.get('seccion')
    if (!seccion) {
      return NextResponse.json({ error: 'Falta seccion' }, { status: 400 })
    }

    // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
    // el id interno viene ya verificado desde el token (usuario.id)
    const { data: versiones, error: versionesError } = await supabaseAdmin
      .from('documentos_historial')
      .select('version_numero, resumen, created_at, activo')
      .eq('user_id', usuario.id)
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