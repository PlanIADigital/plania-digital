// ============================================================
//  PlanIA Digital — Fechas YYYY-MM-DD según la zona horaria del CCT
//  lib/fechaMexico.ts
//
//  Una sola definición de "hoy" y de "fecha del ciclo" para que el
//  navegador (nueva/page.tsx) y el servidor (generar-planeacion)
//  comparen exactamente igual, sin importar la zona horaria de quien
//  ejecuta el código (Vercel corre en UTC).
//
//  La zona se deduce de los 2 primeros dígitos del CCT (clave de la
//  entidad federativa — la misma llave de obtenerCalendarioEstatal).
// ============================================================

const ZONA_POR_ENTIDAD: Record<string, string> = {
  '02': 'America/Tijuana',    // Baja California
  '03': 'America/Mazatlan',   // Baja California Sur
  '18': 'America/Mazatlan',   // Nayarit
  '25': 'America/Mazatlan',   // Sinaloa
  '26': 'America/Hermosillo', // Sonora
  '23': 'America/Cancun',     // Quintana Roo
  '08': 'America/Chihuahua',  // Chihuahua
}

const ZONA_POR_DEFECTO = 'America/Mexico_City'

export function zonaHorariaPorCCT(cct: string | null | undefined): string {
  const entidad = (cct || '').slice(0, 2)
  return ZONA_POR_ENTIDAD[entidad] || ZONA_POR_DEFECTO
}

// Convierte una fecha a YYYY-MM-DD en la zona indicada.
//  - Date (ej. new Date() para "hoy"): se convierte a la zona.
//  - Fecha sola ("2026-09-01"): se respeta tal cual (NO se convierte,
//    porque new Date() la leería como UTC y la correría un día atrás).
//  - Timestamp sin zona ("2026-09-01T00:00:00"): se toma su fecha tal cual.
//  - Timestamp con zona ("...Z" / "...+00:00"): se convierte a la zona.
// Devuelve null si viene vacío o no se puede interpretar.
export function fechaLocalISO(
  fecha: Date | string | null | undefined,
  zona: string
): string | null {
  if (!fecha) return null

  if (fecha instanceof Date) {
    if (isNaN(fecha.getTime())) return null
    return fecha.toLocaleDateString('en-CA', { timeZone: zona })
  }

  const s = String(fecha).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const tieneZona = /[T ]\d{2}:\d{2}.*(Z|[+-]\d{2}(:?\d{2})?)$/.test(s)
  if (!tieneZona) {
    const solo = s.slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(solo) ? solo : null
  }

  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: zona })
}
