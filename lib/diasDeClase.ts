// ============================================================
//  PlanIA Digital — lib/diasDeClase.ts
//  [2 oct 2026] ¿Hay clases tal día? Para la ASISTENCIA (educadora y
//  directivo). Usa la MISMA regla que Nueva planeación
//  (calcularDiasHabiles en lib/calendarioEscolar.ts): fin de semana,
//  CTE, vacaciones, receso, suspensión, o fuera del ciclo = sin clases.
//  Si el estado no tiene calendario cargado, solo cuentan los fines de
//  semana (nunca bloquea por falta de datos).
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { obtenerCalendarioEstatal, calcularDiasHabiles } from '@/lib/calendarioEscolar'

export type InfoDia = { habil: boolean; motivo: string | null; corto: string | null }

export async function cargarDiasDeClase(
  supabaseAdmin: SupabaseClient,
  cct: string | null | undefined,
  ciclo: string
): Promise<(fecha: string) => InfoDia> {
  let cal: any = null
  const estado = String(cct || '').slice(0, 2)
  if (/^\d{2}$/.test(estado)) {
    try { cal = await obtenerCalendarioEstatal(supabaseAdmin, estado, ciclo) } catch { cal = null }
  }
  return (fecha: string): InfoDia => {
    const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay()
    if (dia === 0 || dia === 6) return { habil: false, motivo: 'Fin de semana', corto: '—' }
    if (!cal) return { habil: true, motivo: null, corto: null }
    const d = calcularDiasHabiles(cal, fecha, fecha)[0]
    if (!d || (!d.esCTE && !d.motivo)) return { habil: true, motivo: null, corto: null }
    return d.esCTE
      ? { habil: false, motivo: 'Consejo Técnico Escolar', corto: 'CTE' }
      : { habil: false, motivo: d.motivo || 'Sin clases', corto: 'Sin clases' }
  }
}
