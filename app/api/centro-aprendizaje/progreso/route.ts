// ============================================================
//  PlanIA Digital — API: progreso del Centro de Aprendizaje
//  app/api/centro-aprendizaje/progreso/route.ts
//
//  Devuelve el progreso de la usuaria (XP, nivel, misiones y
//  logros desbloqueados) más los catálogos de misiones y logros
//  aplicables a su rol. Crea el registro de progreso si no existe.
// ============================================================
import { NextResponse } from 'next/server'
import { verificarUsuario, rolAplicableDe } from '@/lib/verificarUsuario'

export async function GET(request: Request) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth
    const rolAplicable = rolAplicableDe(usuario.role)

    let { data: progreso } = await supabaseAdmin
      .from('ca_progreso_usuario')
      .select('*')
      .eq('user_id', usuario.id)
      .single()

    if (!progreso) {
      const { data: nuevoProgreso, error: errorCrear } = await supabaseAdmin
        .from('ca_progreso_usuario')
        .insert({ user_id: usuario.id, rol_aplicable: rolAplicable })
        .select('*')
        .single()

      if (errorCrear) return NextResponse.json({ error: 'No se pudo inicializar el progreso' }, { status: 500 })
      progreso = nuevoProgreso
    }

    const { data: misiones } = await supabaseAdmin
      .from('ca_misiones')
      .select('id, titulo, descripcion, tipo, xp_recompensa, nodo_mazmorra, ventana_horas, orden')
      .eq('rol_aplicable', rolAplicable)
      .eq('activa', true)
      .order('orden', { ascending: true })

    const { data: logros } = await supabaseAdmin
      .from('ca_logros')
      .select('id, titulo, descripcion, icono, xp_recompensa, criterio')
      .eq('rol_aplicable', rolAplicable)

    return NextResponse.json({ progreso, misiones: misiones || [], logros: logros || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
