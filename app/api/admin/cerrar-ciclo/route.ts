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
//  3. Limpia a NULL los 8 campos "activos" en users (PMC,
//     diagnóstico grupal, diagnóstico individual, PDAs del
//     jardín, observaciones directivas, y Grado/Grupo/Alumnos
//     — para que la educadora reconfirme su grupo del ciclo
//     nuevo, no se quede con el grupo del ciclo pasado) para
//     TODAS las cuentas.
//     El historial YA quedó preservado en documentos_historial
//     con su ciclo_escolar correcto — este paso no borra nada
//     del archivo, solo limpia lo que se muestra como "actual".
//  4. Marca activo=false en programa_analitico donde activo=true
//     (el PA no vive en users, tiene su propio sistema de
//     versiones — mismo principio, solo el mecanismo cambia).
//  5. Registra el cierre en cierres_ciclo con el conteo de
//     cuentas afectadas.
//
//  6. [Saneado 27 sep 2026 — Fase 2] Marca en school_years el ciclo
//     activo como is_current.
//
//  El ciclo activo (CICLO_ESCOLAR_ACTIVO) cambia solo el 1 de agosto
//  (lib/calendarioEscolar.ts). Por seguridad este endpoint RECHAZA
//  cerrar el ciclo activo o uno posterior: solo se cierran ciclos que
//  ya terminaron.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { obtenerSchoolYearId } from '@/lib/schoolYear'

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
  if (!/^\d{4}-\d{4}$/.test(ciclo_a_cerrar)) {
    return NextResponse.json({ error: 'Formato de ciclo inválido (ej. "2025-2026").' }, { status: 400 })
  }
  // [Saneado 27 sep 2026] Nunca cerrar el ciclo activo (ni uno posterior):
  // limpiaría Mi Grupo de todas las cuentas a mitad del ciclo.
  if (ciclo_a_cerrar >= CICLO_ESCOLAR_ACTIVO) {
    return NextResponse.json({
      error: `${ciclo_a_cerrar} es el ciclo activo o uno posterior (activo: ${CICLO_ESCOLAR_ACTIVO}). Solo se pueden cerrar ciclos que ya terminaron.`,
    }, { status: 400 })
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
      diagnostico_texto: null,
      diagnostico_fecha: null,
      evaluacion_individual: null,
      pdas_jardin: null,
      observaciones_directivo: null,
      grado: null,
      grupo_letra: null,
      total_alumnos: null,
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

  // Paso 6 — marcar en school_years el ciclo activo (no crítico: nadie lo
  // lee para calcular; si falla, el cierre ya quedó registrado).
  try {
    const idActivo = await obtenerSchoolYearId(supabaseAdmin, CICLO_ESCOLAR_ACTIVO)
    await supabaseAdmin.from('school_years').update({ is_current: false }).eq('is_current', true).neq('id', idActivo)
    await supabaseAdmin.from('school_years').update({ is_current: true, updated_at: new Date().toISOString() }).eq('id', idActivo)
  } catch (e) {
    console.error('No se pudo marcar el ciclo activo en school_years (no crítico):', e)
  }

  return NextResponse.json({
    ok: true,
    ciclo_cerrado: ciclo_a_cerrar,
    usuarios_afectados: totalUsuarios,
  })
}