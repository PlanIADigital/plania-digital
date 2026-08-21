// ============================================================
//  PlanIA Digital — Super Admin: Cerrar ciclo escolar
//  app/api/admin/cerrar-ciclo/route.ts
//
//  Fase 2 del ciclo de vida de datos. Ejecuta una vez, de forma
//  deliberada, cuando el fundador confirma que el ciclo escolar
//  que termina (ej. "2025-2026") ya cerró para la gran mayoría
//  de los calendarios estatales.
//
//  Qué hace:
//  1. Verifica que quien llama es Super Admin.
//  2. Verifica que este ciclo NO se haya cerrado ya (evita doble
//     ejecución — la restricción UNIQUE en cierres_ciclo es la
//     protección real; esta verificación solo da un mensaje claro).
//  3. Limpia a NULL los 5 campos "activos" en users (PMC,
//     diagnóstico grupal, diagnóstico individual, PDAs del
//     jardín, observaciones directivas) para TODAS las cuentas.
//     El historial YA quedó preservado en documentos_historial
//     con su ciclo_escolar correcto — este paso no borra nada
//     del archivo, solo limpia lo que se muestra como "actual".
//  4. Marca activo=false en programa_analitico donde activo=true
//     (el PA no vive en users, tiene su propio sistema de
//     versiones — mismo principio, solo el mecanismo cambia).
//  5. Registra el cierre en cierres_ciclo con el conteo de
//     cuentas afectadas.
//
//  IMPORTANTE — este endpoint NO cambia CICLO_ESCOLAR_ACTIVO.
//  Ese es un paso manual aparte (editar lib/calendarioEscolar.ts
//  y hacer git push) — ver la UI de /admin/acciones para las
//  instrucciones exactas paso a paso.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'

export async function POST(request: NextRequest) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin } = auth

  const { ciclo_a_cerrar } = await request.json()
  if (!ciclo_a_cerrar || typeof ciclo_a_cerrar !== 'string') {
    return NextResponse.json({ error: 'Falta el ciclo a cerrar (ej. "2025-2026")' }, { status: 400 })
  }

  // Paso 2 — evitar doble ejecución sobre el mismo ciclo
  const { data: cierrePrevio } = await supabaseAdmin
    .from('cierres_ciclo')
    .select('fecha_cierre')
    .eq('ciclo_cerrado', ciclo_a_cerrar)
    .maybeSingle()
  if (cierrePrevio) {
    return NextResponse.json({
      error: `El ciclo ${ciclo_a_cerrar} ya fue cerrado el ${new Date(cierrePrevio.fecha_cierre).toLocaleDateString('es-MX')}. No se puede repetir el cierre.`,
    }, { status: 409 })
  }

  // Paso 3 — limpiar los 5 campos activos en users, para todas las cuentas
  const { data: usuariosActualizados, error: errorUsers } = await supabaseAdmin
    .from('users')
    .update({
      diagnostico_escolar: null,
      pdas_prioritarios: null,
      evaluacion_individual: null,
      pdas_jardin: null,
      observaciones_directivo: null,
    })
    .not('id', 'is', null) // actualiza todas las filas (condición siempre verdadera, requerida por Supabase para updates masivos)
    .select('id')

  if (errorUsers) {
    return NextResponse.json({ error: 'Error al limpiar datos de usuarios: ' + errorUsers.message }, { status: 500 })
  }

  // Paso 4 — desactivar todas las versiones activas del PA (tabla aparte)
  const { error: errorPA } = await supabaseAdmin
    .from('programa_analitico')
    .update({ activo: false })
    .eq('activo', true)

  if (errorPA) {
    // No abortamos el cierre por esto — ya se limpiaron los datos de users,
    // que es lo más importante. Se registra el error para revisión manual.
    console.error('Error al desactivar versiones de programa_analitico durante el cierre:', errorPA)
  }

  // Paso 5 — registrar el cierre
  const totalUsuarios = usuariosActualizados?.length ?? 0
  const { error: errorRegistro } = await supabaseAdmin
    .from('cierres_ciclo')
    .insert({
      ciclo_cerrado: ciclo_a_cerrar,
      usuarios_afectados: totalUsuarios,
    })

  if (errorRegistro) {
    // Los datos ya se limpiaron — esto es grave porque, sin el registro,
    // alguien podría intentar cerrar el mismo ciclo otra vez sin darse
    // cuenta. Se reporta con claridad en la respuesta.
    return NextResponse.json({
      error: 'Los datos se limpiaron pero NO se pudo registrar el cierre en cierres_ciclo: ' + errorRegistro.message + '. Revisa manualmente antes de reintentar.',
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    ciclo_cerrado: ciclo_a_cerrar,
    usuarios_afectados: totalUsuarios,
  })
}