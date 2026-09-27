// ============================================================
//  PlanIA Digital — lib/avanceServidor.ts
//
//  [Saneado 27 sep 2026 — Fase 1, infraestructura del directivo]
//  Cálculo de avance del lado del SERVIDOR (con la llave de servicio).
//  Este archivo solo REÚNE datos; el cálculo vive únicamente en
//  lib/cobertura.ts, así que la educadora, el directivo y el futuro
//  informe de cierre siempre obtienen el mismo resultado.
//
//  Uso típico (un jardín, varias docentes):
//    const ctx = await cargarContextoAvance(supabaseAdmin, '19', CICLO_ESCOLAR_ACTIVO)
//    for (const docente of docentes) {
//      const r = await calcularAvanceDocente(supabaseAdmin, docente, ctx)
//    }
//  El resultado es serializable a JSON (se puede guardar tal cual
//  como "foto" dentro de un informe).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SELECT_PLANNINGS_AVANCE,
  calcularAvance,
  clasificarPlaneaciones,
  construirCanastaPrioritarios,
  calcularPrioritarios,
  type PdaCatalogoConTexto,
  type PeriodoAvance,
  type ResultadoAvance,
  type ResultadoPrioritarios,
} from '@/lib/cobertura'

export type ContextoAvance = {
  periodo: PeriodoAvance
  catalogo: PdaCatalogoConTexto[]
}

// Datos mínimos de la docente que se necesitan para el cálculo.
export type DocenteParaAvance = {
  id: string
  evaluacion_individual?: any
  pdas_prioritarios?: any
  pdas_jardin?: any
}

// Resumen de planeación que se puede mostrar al directivo o guardar
// en un informe (sin contenido pedagógico completo).
export type PlaneacionResumen = {
  id: string
  project_name: string | null
  pda_campo: string | null
  eje_principal: string | null
  starts_on: string | null
  ends_on: string | null
  status: string | null
}

export type AvanceDocente = {
  version: 1
  docenteId: string
  avance: ResultadoAvance
  prioritarios: ResultadoPrioritarios
  planeaciones: PlaneacionResumen[] // solo las que cuentan en el periodo
}

// Carga UNA vez por jardín/estado: fechas del ciclo y catálogo de PDA.
export async function cargarContextoAvance(
  supabaseAdmin: SupabaseClient,
  estado: string,
  ciclo: string
): Promise<ContextoAvance> {
  const { data: cal } = await supabaseAdmin
    .from('calendarios_sep')
    .select('datos')
    .eq('ciclo', ciclo)
    .eq('tipo', 'estatal')
    .eq('estado', estado)
    .maybeSingle()

  const { data: catalogo } = await supabaseAdmin
    .from('pda_catalog')
    .select('id, campo, posicion_campo, pda')

  return {
    periodo: {
      ciclo,
      inicio: (cal as any)?.datos?.inicio_clases || null,
      fin: (cal as any)?.datos?.fin_clases || null,
    },
    catalogo: (catalogo as PdaCatalogoConTexto[]) || [],
  }
}

export async function calcularAvanceDocente(
  supabaseAdmin: SupabaseClient,
  docente: DocenteParaAvance,
  ctx: ContextoAvance
): Promise<AvanceDocente> {
  const { data: plans } = await supabaseAdmin
    .from('plannings')
    .select(`${SELECT_PLANNINGS_AVANCE}, project_name, pda_campo, ends_on, created_at`)
    .eq('user_id', docente.id)
    .eq('ciclo_escolar', ctx.periodo.ciclo)
    .order('created_at', { ascending: false })

  const todas: any[] = plans || []
  const avance = calcularAvance(todas, ctx.catalogo, ctx.periodo)
  const contadas = clasificarPlaneaciones(todas, ctx.periodo).contadas
  const canasta = construirCanastaPrioritarios(docente, ctx.catalogo)
  const prioritarios = calcularPrioritarios(canasta, avance)

  return {
    version: 1,
    docenteId: docente.id,
    avance,
    prioritarios,
    planeaciones: contadas.map((p: any) => ({
      id: p.id,
      project_name: p.project_name ?? null,
      pda_campo: p.pda_campo ?? null,
      eje_principal: p.eje_principal ?? null,
      starts_on: p.starts_on ?? null,
      ends_on: p.ends_on ?? null,
      status: p.status ?? null,
    })),
  }
}
