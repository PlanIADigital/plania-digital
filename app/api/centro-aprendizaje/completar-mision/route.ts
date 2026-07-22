// ============================================================
//  PlanIA Digital — API: completar misión del Centro de Aprendizaje
//  app/api/centro-aprendizaje/completar-mision/route.ts
//
//  Otorga XP, recalcula nivel_gamificacion, verifica desbloqueo de
//  logros y refresca la caché de ranking. Todo pasa por
//  supabaseAdmin — el cliente nunca escribe ca_progreso_usuario
//  directamente (ver RLS en database/centro_aprendizaje_schema.sql).
// ============================================================
import { NextResponse } from 'next/server'
import { verificarUsuario, rolAplicableDe } from '@/lib/verificarUsuario'

function nivelDesdeXP(xp: number): number {
  return Math.floor(xp / 100) + 1
}

export async function POST(request: Request) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth
    const rolAplicable = rolAplicableDe(usuario.role)

    const { misionId } = await request.json()
    if (!misionId) return NextResponse.json({ error: 'Falta misionId' }, { status: 400 })

    const { data: mision } = await supabaseAdmin
      .from('ca_misiones')
      .select('id, titulo, xp_recompensa, nodo_mazmorra, rol_aplicable, activa')
      .eq('id', misionId)
      .single()

    if (!mision || !mision.activa || mision.rol_aplicable !== rolAplicable) {
      return NextResponse.json({ error: 'Misión no disponible' }, { status: 404 })
    }

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

    const misionesCompletadas: any[] = progreso.misiones_completadas || []
    if (misionesCompletadas.some((m) => m.mision_id === misionId)) {
      return NextResponse.json({ error: 'Misión ya completada' }, { status: 409 })
    }

    const ahora = new Date().toISOString()
    const nuevasMisiones = [...misionesCompletadas, { mision_id: misionId, completada_en: ahora }]
    let nuevoXP = progreso.xp_total + mision.xp_recompensa
    const nuevoNodo = mision.nodo_mazmorra || progreso.nodo_actual

    // Verificar desbloqueo de logros por conteo de misiones completadas
    const { data: logros } = await supabaseAdmin
      .from('ca_logros')
      .select('id, titulo, icono, xp_recompensa, criterio')
      .eq('rol_aplicable', rolAplicable)

    const logrosDesbloqueados: any[] = progreso.logros_desbloqueados || []
    const idsDesbloqueados = new Set(logrosDesbloqueados.map((l) => l.logro_id))
    const nuevosLogros: any[] = []

    for (const logro of logros || []) {
      if (idsDesbloqueados.has(logro.id)) continue
      const criterio = logro.criterio || {}
      if (criterio.tipo === 'misiones_completadas' && nuevasMisiones.length >= (criterio.cantidad || 0)) {
        nuevosLogros.push({ logro_id: logro.id, desbloqueado_en: ahora })
        nuevoXP += logro.xp_recompensa || 0
      }
    }

    const nuevoNivel = nivelDesdeXP(nuevoXP)

    const { data: progresoActualizado, error: errorUpdate } = await supabaseAdmin
      .from('ca_progreso_usuario')
      .update({
        xp_total: nuevoXP,
        nivel_gamificacion: nuevoNivel,
        nodo_actual: nuevoNodo,
        misiones_completadas: nuevasMisiones,
        logros_desbloqueados: [...logrosDesbloqueados, ...nuevosLogros],
        updated_at: ahora,
      })
      .eq('user_id', usuario.id)
      .select('*')
      .single()

    if (errorUpdate) return NextResponse.json({ error: 'No se pudo actualizar el progreso' }, { status: 500 })

    await supabaseAdmin
      .from('ca_ranking_cache')
      .upsert({
        user_id: usuario.id,
        full_name: usuario.full_name,
        xp_total: nuevoXP,
        nivel_gamificacion: nuevoNivel,
        rol_aplicable: rolAplicable,
        actualizado_en: ahora,
      }, { onConflict: 'user_id' })

    const logrosDesbloqueadosInfo = (logros || []).filter((l) => nuevosLogros.some((n) => n.logro_id === l.id))

    return NextResponse.json({ progreso: progresoActualizado, logrosNuevos: logrosDesbloqueadosInfo })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
