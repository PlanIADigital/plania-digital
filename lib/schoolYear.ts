// ============================================================
//  PlanIA Digital — lib/schoolYear.ts
//  [Saneado 27 sep 2026 — Fase 2] Devuelve el id de school_years para un
//  ciclo ("2026-2027"). Si la fila no existe, la crea con las fechas del
//  calendario federal de ese ciclo (inicio_clases / fin_clases), para que
//  NUNCA haga falta crearla a mano ni escribir el UUID en el código.
//
//  school_years.* es obligatorio en plannings y lo copia el trigger
//  registrar_pda_coverage. Ninguna pantalla lo lee: el avance se calcula
//  por ciclo_escolar (lib/cobertura.ts). Por eso esta función nunca debe
//  impedir que se guarde una planeación: si no hay calendario federal,
//  usa fechas nominales del ciclo (1 ago – 31 jul) y lo avisa en el log.
//
//  Las filas nuevas se crean con is_current = false (la tabla solo admite
//  un ciclo actual); marcar el ciclo actual es parte del cierre de ciclo.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'

const FORMATO_CICLO = /^(\d{4})-(\d{4})$/
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

async function buscarId(supabaseAdmin: SupabaseClient, ciclo: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('school_years')
    .select('id')
    .eq('label', ciclo)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function obtenerSchoolYearId(supabaseAdmin: SupabaseClient, ciclo: string): Promise<string> {
  const partes = FORMATO_CICLO.exec(ciclo)
  if (!partes) throw new Error(`Ciclo escolar con formato inválido: "${ciclo}"`)

  const existente = await buscarId(supabaseAdmin, ciclo)
  if (existente) return existente

  // Fechas reales del calendario federal del ciclo, si ya está cargado.
  let inicio = `${partes[1]}-08-01`
  let fin = `${partes[2]}-07-31`
  const { data: federal } = await supabaseAdmin
    .from('calendarios_sep')
    .select('datos')
    .eq('tipo', 'federal')
    .eq('estado', 'FED')
    .eq('ciclo', ciclo)
    .maybeSingle()
  const datos = (federal as { datos?: Record<string, unknown> } | null)?.datos
  const inicioClases = typeof datos?.inicio_clases === 'string' ? datos.inicio_clases : ''
  const finClases = typeof datos?.fin_clases === 'string' ? datos.fin_clases : ''
  if (FORMATO_FECHA.test(inicioClases) && FORMATO_FECHA.test(finClases)) {
    inicio = inicioClases
    fin = finClases
  } else {
    console.warn(`⚠️ school_years: sin calendario federal para ${ciclo}; se usan fechas nominales ${inicio} – ${fin}`)
  }

  const { data: creado, error } = await supabaseAdmin
    .from('school_years')
    .insert({ label: ciclo, starts_at: inicio, ends_at: fin, students_start: inicio, is_current: false })
    .select('id')
    .single()
  if (creado) return (creado as { id: string }).id

  // Si otra planeación la creó al mismo tiempo (label es UNIQUE), se relee.
  const creadaPorOtro = await buscarId(supabaseAdmin, ciclo)
  if (creadaPorOtro) return creadaPorOtro
  throw new Error(`No se pudo obtener school_years para ${ciclo}: ${error?.message ?? 'sin detalle'}`)
}
