// ============================================================
//  PlanIA Digital — lib/semaforo.ts
//  [2 oct 2026] Reglas compartidas del Semáforo de desempeño
//  (educadora, directivo, futuro Excel). Niños solo por código AL-XX.
// ============================================================
export const AREAS_PREDETERMINADAS = [
  'Lenguaje oral',
  'Lenguaje escrito',
  'Conteo',
  'Educación socioemocional',
]

export type Momento = 'diagnostico' | 'm1' | 'm2' | 'm3'
export const MOMENTOS: Array<{ clave: Momento; nombre: string; cuando: string }> = [
  { clave: 'diagnostico', nombre: 'Diagnóstico',     cuando: 'Inicio de ciclo' },
  { clave: 'm1',          nombre: 'Primer momento',  cuando: 'Noviembre' },
  { clave: 'm2',          nombre: 'Segundo momento', cuando: 'Marzo' },
  { clave: 'm3',          nombre: 'Tercer momento',  cuando: 'Mayo – junio' },
]
export const esMomento = (m: any): m is Momento => MOMENTOS.some(x => x.clave === m)

export type Nivel = 'suficiente' | 'en_desarrollo' | 'requiere_apoyo' | 'no_evaluado'
// Semáforo pastel (mismo que las rúbricas; sin rojo intenso).
export const NIVELES: Array<{ clave: Nivel; nombre: string; corto: string; fondo: string; texto: string }> = [
  { clave: 'suficiente',     nombre: 'Suficiente',     corto: 'S',  fondo: '#D4EDDA', texto: '#2D6A4F' },
  { clave: 'en_desarrollo',  nombre: 'En desarrollo',  corto: 'ED', fondo: '#FFF3CD', texto: '#8A6D1D' },
  { clave: 'requiere_apoyo', nombre: 'Requiere apoyo', corto: 'RA', fondo: '#F8D7DA', texto: '#8B3A3E' },
  { clave: 'no_evaluado',    nombre: 'No evaluado',    corto: '—',  fondo: '#F3F4F6', texto: '#6B7280' },
]
export const esNivel = (n: any): n is Nivel => NIVELES.some(x => x.clave === n)

// Momento que normalmente toca según el mes (YYYY-MM-DD).
export function momentoSugerido(fecha: string): Momento {
  const mes = Number(String(fecha).slice(5, 7))
  if (mes >= 8 && mes <= 10) return 'diagnostico'
  if (mes >= 11 || mes <= 2) return 'm1'
  if (mes <= 4) return 'm2'
  return 'm3'
}
