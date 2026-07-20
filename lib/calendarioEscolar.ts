// ============================================================
//  PlanIA Digital — lib/calendarioEscolar.ts
//  Fuente única de verdad para calcular días hábiles reales dentro
//  del ciclo escolar (ya excluyendo fines de semana, CTE, vacaciones,
//  y fechas fuera de inicio_clases/fin_clases).
//
//  [jul 2026] Extraído de app/api/generar-planeacion/route.ts para que
//  el nuevo endpoint /api/calendario/dias-habiles-reales pueda usar
//  EXACTAMENTE el mismo cálculo antes de generar nada con IA — mismo
//  patrón que ya usamos con lib/cobertura.ts: cualquier lógica que
//  necesite vivir en más de un lugar se extrae aquí, nunca se duplica.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'

export type DiaHabil = { fecha: string; label: string; esCTE: boolean; motivo?: string }

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export async function obtenerCalendarioEstatal(
  supabaseAdmin: SupabaseClient,
  estadoCodigo: string,
  ciclo: string = '2025-2026'
): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('calendarios_sep')
    .select('datos')
    .eq('ciclo', ciclo)
    .eq('tipo', 'estatal')
    .eq('estado', estadoCodigo)
    .maybeSingle()

  if (error) {
    console.error(`⚠️ Error al leer el calendario estatal (estado "${estadoCodigo}"):`, error.message)
  }
  if (!data) {
    console.error(`⚠️ No se encontró calendario estatal cargado para el estado "${estadoCodigo}".`)
  }
  return data?.datos || {}
}

export function calcularDiasHabiles(calDatos: any, inicio: string, fin: string): DiaHabil[] {
  const finClases: string | null = calDatos.fin_clases || null
  const inicioClases: string | null = calDatos.inicio_clases || null

  const diasInhabilesSet = new Set<string>()
  if (calDatos.dias_inhabiles) {
    for (const d of calDatos.dias_inhabiles) {
      if (d.fecha) diasInhabilesSet.add(d.fecha)
    }
  }
  if (calDatos.sesiones_cte) {
    for (const s of calDatos.sesiones_cte) {
      if (s.fecha) diasInhabilesSet.add(s.fecha)
      if (s.fechas) s.fechas.forEach((f: string) => diasInhabilesSet.add(f))
    }
  }
  if (calDatos.periodos_vacaciones) {
    for (const v of calDatos.periodos_vacaciones) {
      if (v.inicio && v.fin) {
        const cur = new Date(v.inicio + 'T12:00:00')
        const end = new Date(v.fin + 'T12:00:00')
        while (cur <= end) {
          diasInhabilesSet.add(cur.toISOString().split('T')[0])
          cur.setDate(cur.getDate() + 1)
        }
      }
    }
  }

  const dias: DiaHabil[] = []
  const cur = new Date(inicio + 'T12:00:00')
  const end = new Date(fin + 'T12:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    const fechaStr = cur.toISOString().split('T')[0]
    if (dow !== 0 && dow !== 6) {
      if (finClases && fechaStr > finClases) {
        dias.push({ fecha: fechaStr, label: `${DIAS_SEMANA[dow]} ${cur.getDate()} de ${MESES[cur.getMonth()]}`, esCTE: false, motivo: 'Ciclo escolar concluido' })
      } else if (inicioClases && fechaStr < inicioClases) {
        dias.push({ fecha: fechaStr, label: `${DIAS_SEMANA[dow]} ${cur.getDate()} de ${MESES[cur.getMonth()]}`, esCTE: false, motivo: 'Ciclo escolar aún no inicia' })
      } else if (diasInhabilesSet.has(fechaStr)) {
        const esCTE = calDatos.sesiones_cte?.some((s: any) =>
          s.fecha === fechaStr || s.fechas?.includes(fechaStr)
        ) || false
        dias.push({ fecha: fechaStr, label: `${DIAS_SEMANA[dow]} ${cur.getDate()} de ${MESES[cur.getMonth()]}`, esCTE, motivo: esCTE ? 'CTE' : 'Inhábil' })
      } else {
        dias.push({ fecha: fechaStr, label: `${DIAS_SEMANA[dow]} ${cur.getDate()} de ${MESES[cur.getMonth()]}`, esCTE: false })
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return dias
}