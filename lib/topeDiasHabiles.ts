// ============================================================
//  PlanIA Digital — Tope mensual de días hábiles
//  lib/topeDiasHabiles.ts
//
//  [2 oct 2026] FUENTE ÚNICA DE LA REGLA (criterio del fundador):
//  - Cada ciclo de membresía permite generar hasta TOPE_DIAS_HABILES
//    días hábiles de planeación (suma de duration_days de las planeaciones
//    activas del ciclo; las descartadas no cuentan).
//  - Se empezó en 25 (un mes real tiene 22–23 días de clase) a propósito:
//    subir el límite después se siente como regalo, bajarlo como quitar.
//    Cuando haya datos reales de costo, se puede subir a 28 cambiando
//    SOLO el número de abajo.
//  - Al llegar al tope se detiene SOLO la generación de nuevas planeaciones;
//    todo lo demás (ver, descargar, Mi avance, semáforo) sigue disponible.
//    Se libera con el siguiente ciclo (siguiente pago).
//  - Las fundadoras (membership_status = 'founder') no tienen conteo en el
//    plan Planea.
// ============================================================

export const TOPE_DIAS_HABILES = 25

// Estados de membresía que NO tienen tope de días hábiles.
export const ESTATUS_SIN_TOPE = ['founder']

// [3 oct 2026] La prueba gratuita dura 7 días (ciclo_fin de v_estado_cuenta
// para cuentas 'trial'). Al terminar, se detiene la generación, igual que una
// membresía vencida: todo lo ya creado sigue disponible para consultar.
export function pruebaVencida(membershipStatus: string | null | undefined, cicloFin: string | null | undefined): boolean {
  if (membershipStatus !== 'trial' || !cicloFin) return false
  const fin = new Date(cicloFin).getTime()
  return !isNaN(fin) && Date.now() >= fin
}

export const MENSAJE_PRUEBA_VENCIDA =
  'Tu prueba gratuita de 7 días terminó. Puedes seguir consultando y descargando todo lo que creaste; para generar nuevas planeaciones, activa tu membresía.'

export function tieneTope(membershipStatus: string | null | undefined): boolean {
  return !ESTATUS_SIN_TOPE.includes(membershipStatus || '')
}

function fechaLegible(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const d = new Date(String(fecha).slice(0, 10) + 'T12:00:00Z')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export interface RevisionTope {
  permitido: boolean
  usados: number
  restantes: number
  mensaje: string
}

// Revisa si una planeación nueva de `diasNuevos` días cabe en el tope.
export function revisarTopeDiasHabiles(params: {
  membershipStatus: string | null | undefined
  diasUsados: number | null | undefined
  diasNuevos: number
  cicloFin?: string | null
}): RevisionTope {
  const usados = Math.max(0, Number(params.diasUsados) || 0)

  if (!tieneTope(params.membershipStatus)) {
    return { permitido: true, usados, restantes: Infinity, mensaje: '' }
  }

  const restantes = Math.max(0, TOPE_DIAS_HABILES - usados)
  if (params.diasNuevos <= restantes) {
    return { permitido: true, usados, restantes, mensaje: '' }
  }

  const fechaRenovacion = fechaLegible(params.cicloFin)
  const renovacion = fechaRenovacion ? ` Tus días se renuevan el ${fechaRenovacion}.` : ''
  const liberar = ' Si alguna planeación no te sirvió y aún no la descargas, puedes descartarla en Mis planeaciones para liberar sus días.'

  const mensaje = restantes === 0
    ? `Ya usaste tus ${TOPE_DIAS_HABILES} días hábiles de planeación de este ciclo.${renovacion}${liberar} Mientras tanto, puedes consultar y descargar todo lo que ya tienes.`
    : `Esta planeación tiene ${params.diasNuevos} días hábiles y en este ciclo te quedan ${restantes} de ${TOPE_DIAS_HABILES}. Ajusta las fechas a ${restantes} día(s) hábil(es) o menos.${renovacion}${liberar}`

  return { permitido: false, usados, restantes, mensaje }
}
