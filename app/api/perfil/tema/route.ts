// ============================================================
//  PlanIA Digital — API: guardar preferencia de tema (claro/oscuro)
//  app/api/perfil/tema/route.ts
//
//  Solo escribe la columna theme_preference — nunca acepta ni
//  toca ninguna otra columna de users, aunque el cliente la mande.
// ============================================================
import { NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'

export async function POST(request: Request) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth

    const { theme } = await request.json()
    if (theme !== 'light' && theme !== 'dark') {
      return NextResponse.json({ error: 'Valor de tema inválido' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ theme_preference: theme })
      .eq('id', usuario.id)

    if (error) return NextResponse.json({ error: 'No se pudo guardar la preferencia' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
