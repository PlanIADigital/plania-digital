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
//
//  [sep 2026] Reescrito para leer calDatos.eventos (el formato
//  consolidado de un solo arreglo con "categoria", adoptado en el
//  rediseño de julio 2026 del flujo de conversión de calendarios) en
//  vez de los tres campos viejos (dias_inhabiles/sesiones_cte/
//  periodos_vacaciones) que ya ningún calendario subido produce desde
//  entonces — el desajuste hacía que NINGÚN día se excluyera salvo
//  fines de semana, en los 32 estados, desde julio.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
export const CICLO_ESCOLAR_ACTIVO = '2026-2027'
export type DiaHabil = { fecha: string; label: string; esCTE: boolean; motivo?: string }

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

// Categorías de "eventos" que significan que NO hay clases ese día.
// Todo lo que NO esté en esta lista (día conmemorativo, jornada de
// concientización, registro de calificaciones, preinscripción, etc.)
// cuenta como día hábil normal — son solo informativos, no suspenden
// labores. Si aparece una categoría nueva que no está aquí, por
// diseño se trata como HÁBIL (nunca al revés) para que un dato nuevo
// nunca genere una exclusión silenciosa no revisada.
const CATEGORIAS_INHABILES = new Set([
  'receso_clases',
  'cte_fase_intensiva',
  'vacaciones',
  'suspension_labores_docentes',
  'cte_sesion_ordinaria',
])
// Subconjunto de las anteriores que además debe marcarse esCTE: true
// (para que el generador narre "Consejo Técnico Escolar" en vez de
// solo "día inhábil" genérico).
const CATEGORIAS_CTE = new Set(['cte_fase_intensiva', 'cte_sesion_ordinaria'])

export async function obtenerCalendarioEstatal(
  supabaseAdmin: SupabaseClient,
  estadoCodigo: string,
  ciclo: string
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
    throw new Error(`No se pudo leer el calendario estatal del estado "${estadoCodigo}" (ciclo ${ciclo}). Detalle: ${error.message}`)
  }
  if (!data) {
    throw new Error(`No existe calendario estatal cargado para el estado "${estadoCodigo}" en el ciclo "${ciclo}". Verifica que el calendario esté subido en /admin/calendario y que CICLO_ESCOLAR_ACTIVO (en lib/calendarioEscolar.ts) coincida con el ciclo real subido.`)
  }
  return data.datos || {}
}

export function calcularDiasHabiles(calDatos: any, inicio: string, fin: string): DiaHabil[] {
  const finClases: string | null = calDatos.fin_clases || null
  const inicioClases: string | null = calDatos.inicio_clases || null

  // Mapa fecha -> { esCTE, motivo } construido a partir de calDatos.eventos.
  // Los eventos con fecha_fin describen un RANGO (ej. vacaciones,
  // receso_clases) — se expande día por día dentro del rango.
  const diasInhabiles = new Map<string, { esCTE: boolean; motivo: string }>()
  const eventos: any[] = Array.isArray(calDatos.eventos) ? calDatos.eventos : []
  for (const ev of eventos) {
    if (!ev.fecha || !CATEGORIAS_INHABILES.has(ev.categoria)) continue
    const esCTE = CATEGORIAS_CTE.has(ev.categoria)
    const motivo = ev.motivo || (esCTE ? 'CTE' : 'Inhábil')
    if (ev.fecha_fin) {
      const cur = new Date(ev.fecha + 'T12:00:00')
      const end = new Date(ev.fecha_fin + 'T12:00:00')
      while (cur <= end) {
        diasInhabiles.set(cur.toISOString().split('T')[0], { esCTE, motivo })
        cur.setDate(cur.getDate() + 1)
      }
    } else {
      diasInhabiles.set(ev.fecha, { esCTE, motivo })
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
      } else if (diasInhabiles.has(fechaStr)) {
        const info = diasInhabiles.get(fechaStr)!
        dias.push({ fecha: fechaStr, label: `${DIAS_SEMANA[dow]} ${cur.getDate()} de ${MESES[cur.getMonth()]}`, esCTE: info.esCTE, motivo: info.motivo })
      } else {
        dias.push({ fecha: fechaStr, label: `${DIAS_SEMANA[dow]} ${cur.getDate()} de ${MESES[cur.getMonth()]}`, esCTE: false })
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return dias
}