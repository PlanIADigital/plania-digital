// ============================================================
//  PlanIA Digital — lib/cobertura.ts
//  Fuente única de verdad para calcular cobertura curricular.
//
//  [jul 2026] Extraído después de encontrar DOS divergencias reales
//  entre app/dashboard/page.tsx y app/mi-avance/page.tsx: primero con
//  el conteo de PDAs (una leía una tabla vacía, otra reconstruía mal),
//  y ahora con el conteo de ejes articuladores (una solo miraba
//  "eje_principal", la otra también "eje_secundario" — por eso el
//  Dashboard marcaba 6/7 mientras Mi Avance ya marcaba 7/7 con los
//  mismos datos). Cualquier pantalla que necesite saber qué ejes ya
//  se han trabajado debe importar esta función — nunca reconstruir el
//  cálculo por su cuenta.
// ============================================================

export function calcularEjesCubiertos(
  plannings: Array<{ eje_principal?: string | null; eje_secundario?: string | null }>
): Set<string> {
  const set = new Set<string>()
  for (const p of plannings) {
    if (p.eje_principal) set.add(p.eje_principal)
    if (p.eje_secundario) set.add(p.eje_secundario)
  }
  return set
}