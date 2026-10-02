// ============================================================
//  PlanIA Digital — lib/nombrePila.ts
//  [2 oct 2026] Nombre de pila para el saludo de los dashboards
//  (educadora y directivo), sacado del nombre completo registrado,
//  sin pedir un dato nuevo. Costumbre mexicana: dos apellidos al final.
//    "Rosa María Fernández Contreras" → "Rosa María"
//    "José Alfredo Hernández Torres"  → "José Alfredo"
//    "María de la Luz García Pérez"   → "María de la Luz"
//    "Mariana Cortez"                 → "Mariana"
//  Si queda terminando en partícula ("Juan de la"), se recorta.
//  Con un solo apellido y nombre compuesto se queda con la primera
//  palabra (igual que antes), nunca peor.
// ============================================================
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

export function nombrePila(nombreCompleto?: string | null): string {
  const palabras = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return ''
  if (palabras.length <= 2) return palabras[0]

  let nombre = palabras.slice(0, palabras.length - 2)
  while (nombre.length > 1 && PARTICULAS.has(nombre[nombre.length - 1].toLowerCase())) {
    nombre = nombre.slice(0, -1)
  }
  return nombre.join(' ')
}
