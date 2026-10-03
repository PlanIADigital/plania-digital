// ============================================================
//  PlanIA Digital — Catálogo de modalidades de trabajo
//  lib/modalidades.ts
//
//  [2 oct 2026] FUENTE ÚNICA de las fases de cada modalidad. La usan la
//  pantalla de Nueva planeación y la ruta de generación, para que ambas
//  calculen EXACTAMENTE los mismos días mínimos (una fase = al menos un
//  día hábil). Antes cada una tenía su propia copia de la tabla.
//
//  Preparado para crecer: si después se agregan las metodologías
//  sociocríticas (proyectos comunitarios, STEAM, ABP, aprendizaje
//  servicio), se añaden aquí con sus fases y todo lo demás se ajusta solo.
// ============================================================

export interface Modalidad {
  fases: string[]
  // Índice de la fase de desarrollo, la única que se extiende a varios días.
  desarrollo: number
}

export const MODALIDADES: Record<string, Modalidad> = {
  'Proyectos': { fases: ['Punto de partida', 'Planeación', '¡A trabajar!', 'Comunicamos nuestros logros', 'Reflexionar sobre el aprendizaje'], desarrollo: 2 },
  'ABJ': { fases: ['Planteamiento del juego', 'Desarrollo de las actividades', 'Compartimos la experiencia', 'Comunidad de juego'], desarrollo: 1 },
  'Taller crítico': { fases: ['Situación inicial', 'Puesta en marcha', 'Valoramos lo aprendido', 'Reflexión'], desarrollo: 1 },
  'Rincones': { fases: ['Asamblea inicial y planeación', 'Exploración de los rincones', 'Compartimos lo aprendido', 'Reflexión sobre el aprendizaje'], desarrollo: 1 },
  'Centros de interés': { fases: ['Contacto con la realidad', 'Identificación e integración', 'Expresión'], desarrollo: 1 },
  'Unidad didáctica': { fases: ['Lectura de la realidad', 'Identificación de la trama y complejidad', 'Planificación y organización', 'Exploración y descubrimiento', 'Participación activa y horizontal', 'Valoración de la experiencia'], desarrollo: 2 },
}

export const ORDEN_MODALIDADES = ['Proyectos', 'ABJ', 'Taller crítico', 'Rincones', 'Centros de interés', 'Unidad didáctica']

// Días hábiles mínimos de una modalidad (uno por fase).
export function diasMinimosModalidad(modalidad: string): number {
  return MODALIDADES[modalidad]?.fases.length || 99
}

// La modalidad más corta define el mínimo para poder planear algo.
export const DIAS_MINIMOS_PARA_PLANEAR = Math.min(...ORDEN_MODALIDADES.map(diasMinimosModalidad))

export function modalidadesQueCaben(diasDisponibles: number): string[] {
  return ORDEN_MODALIDADES.filter(m => diasMinimosModalidad(m) <= diasDisponibles)
}
