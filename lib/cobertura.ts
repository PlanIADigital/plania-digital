// ============================================================
//  PlanIA Digital — lib/cobertura.ts
//  Fuente única de verdad para calcular cobertura curricular.
//
//  [jul 2026] Extraído después de encontrar DOS divergencias reales
//  entre app/dashboard/page.tsx y app/mi-avance/page.tsx (conteo de
//  PDAs y conteo de ejes). Cualquier pantalla que necesite cobertura
//  debe importar estas funciones — nunca reconstruir el cálculo.
//
//  [Saneado 26 sep 2026 — Fase 1, Mi Avance]
//  calcularAvance() reemplaza la lectura de la tabla pda_coverage.
//  Motivo: el trigger registrar_pda_coverage agrupa por TEXTO del PDA
//  (pda_literal), no por pda_id; guarda literales concatenados "A | B";
//  ignora pda_2_*; nunca resta planeaciones descartadas; y mezclaba
//  planeaciones con fechas fuera del ciclo. Resultado: la cuenta de
//  prueba mostraba 99 "PDAs trabajados" cuando eran 33 PDA reales.
//
//  Contrato:
//    Entrada: planeaciones (SELECT_PLANNINGS_AVANCE), catálogo de PDA
//             (id, campo, posicion_campo) y periodo {ciclo, inicio, fin}.
//    Filtro:  mismo ciclo_escolar, status != 'discarded', starts_on
//             dentro de [inicio, fin] del calendario estatal.
//    Conteo:  pda_id DISTINTOS (principal, pda_2 activo, transversales
//             activos). Las repeticiones se reportan aparte (veces/usos).
//    Salida:  objeto serializable a JSON (sin Set ni Map), con
//             version, para poder guardarse tal cual en un futuro
//             informe de cierre de ciclo (Dashboard Directivo).
//  Es independiente de la pantalla y de quién la llama: sirve igual
//  para la educadora, el directivo o el proceso de cierre de ciclo.
// ============================================================

// Columnas de plannings que necesita calcularAvance. Todas las
// pantallas deben usar esta constante en su .select() para no
// desincronizarse.
export const SELECT_PLANNINGS_AVANCE =
  'id, status, starts_on, ciclo_escolar, ' +
  'pda_id, pda_2_id, pda_2_activo, ' +
  'transversal_1_id, transversal_1_activo, ' +
  'transversal_2_id, transversal_2_activo, ' +
  'transversal_3_id, transversal_3_activo, ' +
  'eje_principal, eje_secundario'

export type PlaneacionAvance = {
  id: string
  status?: string | null
  starts_on?: string | null
  ciclo_escolar?: string | null
  pda_id?: string | null
  pda_2_id?: string | null
  pda_2_activo?: boolean | null
  transversal_1_id?: string | null
  transversal_1_activo?: boolean | null
  transversal_2_id?: string | null
  transversal_2_activo?: boolean | null
  transversal_3_id?: string | null
  transversal_3_activo?: boolean | null
  eje_principal?: string | null
  eje_secundario?: string | null
}

export type PdaCatalogoAvance = {
  id: string
  campo: string
  posicion_campo: number
}

export type PeriodoAvance = {
  ciclo: string
  inicio: string | null // YYYY-MM-DD (inicio_clases del calendario estatal)
  fin: string | null    // YYYY-MM-DD (fin_clases del calendario estatal)
}

export type PdaTrabajado = {
  id: string
  campo: string
  posicion: number
  veces: number            // en cuántas planeaciones aparece
  comoPrincipal: number    // veces como PDA del campo principal
  comoTransversal: number  // veces como PDA transversal
}

export type ResultadoAvance = {
  version: 1
  periodo: PeriodoAvance
  fechasVerificadas: boolean // false si no había calendario (no se filtró por fechas)
  planeaciones: {
    contadas: number
    descartadas: number
    fueraDeFechas: number
    otroCiclo: number
  }
  pdaDistintos: number
  usosTotales: number
  pdas: PdaTrabajado[]
  porCampo: Record<string, { distintos: number; usos: number }>
  ejes: { cubiertos: string[]; conteo: Record<string, number> }
  pdaSinCatalogo: number // pda_id que no existe en el catálogo (dato a revisar)
}

function dentroDeFechas(p: PlaneacionAvance, periodo: PeriodoAvance): boolean {
  if (!p.starts_on) return true
  const fecha = String(p.starts_on).slice(0, 10)
  if (periodo.inicio && fecha < periodo.inicio) return false
  if (periodo.fin && fecha > periodo.fin) return false
  return true
}

// Separa las planeaciones que cuentan para el avance del periodo.
// Exportada para que las pantallas usen exactamente el mismo filtro
// al mostrar el número de planeaciones o su lista.
export function clasificarPlaneaciones<T extends PlaneacionAvance>(
  plannings: T[],
  periodo: PeriodoAvance
): { contadas: T[]; descartadas: number; fueraDeFechas: number; otroCiclo: number } {
  const contadas: T[] = []
  let descartadas = 0
  let fueraDeFechas = 0
  let otroCiclo = 0
  for (const p of plannings) {
    if (p.ciclo_escolar && p.ciclo_escolar !== periodo.ciclo) { otroCiclo++; continue }
    if (p.status === 'discarded') { descartadas++; continue }
    if (!dentroDeFechas(p, periodo)) { fueraDeFechas++; continue }
    contadas.push(p)
  }
  return { contadas, descartadas, fueraDeFechas, otroCiclo }
}

// PDA de una planeación, sin repetir dentro de la misma planeación.
function pdasDePlaneacion(p: PlaneacionAvance): Array<{ id: string; principal: boolean }> {
  const candidatos: Array<{ id: string | null | undefined; principal: boolean; activo: boolean }> = [
    { id: p.pda_id, principal: true, activo: true },
    { id: p.pda_2_id, principal: true, activo: !!p.pda_2_activo },
    { id: p.transversal_1_id, principal: false, activo: !!p.transversal_1_activo },
    { id: p.transversal_2_id, principal: false, activo: !!p.transversal_2_activo },
    { id: p.transversal_3_id, principal: false, activo: !!p.transversal_3_activo },
  ]
  const unicos: Record<string, boolean> = {}
  for (const c of candidatos) {
    if (!c.activo || !c.id) continue
    unicos[c.id] = (unicos[c.id] || false) || c.principal
  }
  return Object.entries(unicos).map(([id, principal]) => ({ id, principal }))
}

export function calcularAvance(
  plannings: PlaneacionAvance[],
  catalogo: PdaCatalogoAvance[],
  periodo: PeriodoAvance
): ResultadoAvance {
  const { contadas, descartadas, fueraDeFechas, otroCiclo } = clasificarPlaneaciones(plannings, periodo)

  const catalogoPorId: Record<string, PdaCatalogoAvance> = {}
  for (const c of catalogo) catalogoPorId[c.id] = c

  const acumulado: Record<string, PdaTrabajado> = {}
  let pdaSinCatalogo = 0

  for (const p of contadas) {
    for (const { id, principal } of pdasDePlaneacion(p)) {
      const info = catalogoPorId[id]
      if (!info) { pdaSinCatalogo++; continue }
      if (!acumulado[id]) {
        acumulado[id] = { id, campo: info.campo, posicion: info.posicion_campo, veces: 0, comoPrincipal: 0, comoTransversal: 0 }
      }
      acumulado[id].veces++
      if (principal) acumulado[id].comoPrincipal++
      else acumulado[id].comoTransversal++
    }
  }

  const pdas = Object.values(acumulado).sort((a, b) =>
    a.campo === b.campo ? a.posicion - b.posicion : a.campo.localeCompare(b.campo)
  )

  const porCampo: Record<string, { distintos: number; usos: number }> = {}
  for (const pda of pdas) {
    if (!porCampo[pda.campo]) porCampo[pda.campo] = { distintos: 0, usos: 0 }
    porCampo[pda.campo].distintos++
    porCampo[pda.campo].usos += pda.veces
  }

  const conteoEjes: Record<string, number> = {}
  for (const p of contadas) {
    const ejesPlaneacion = new Set<string>()
    if (p.eje_principal) ejesPlaneacion.add(p.eje_principal)
    if (p.eje_secundario) ejesPlaneacion.add(p.eje_secundario)
    ejesPlaneacion.forEach(e => { conteoEjes[e] = (conteoEjes[e] || 0) + 1 })
  }

  return {
    version: 1,
    periodo,
    fechasVerificadas: !!periodo.inicio && !!periodo.fin,
    planeaciones: { contadas: contadas.length, descartadas, fueraDeFechas, otroCiclo },
    pdaDistintos: pdas.length,
    usosTotales: pdas.reduce((s, x) => s + x.veces, 0),
    pdas,
    porCampo,
    ejes: { cubiertos: Object.keys(conteoEjes), conteo: conteoEjes },
    pdaSinCatalogo,
  }
}

// Se conserva sin cambios por compatibilidad con código existente.
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

// ============================================================
//  Canasta de PDA prioritarios
//  [Saneado 26 sep 2026 — Fase 1, Mi Avance]
//  Junta las tres fuentes de Mi Grupo SIN perder su etiqueta de
//  origen, en orden de gradualidad (criterio del fundador):
//    1) individual → evaluacion_individual.pdas_prioritarios_grupo
//       (resultado del embudo de la evaluación individual de TODO el
//       grupo; NO los pdas_sugeridos de cada alumno con NEE, que
//       alimentan ajustes razonables y la pestaña Diversidad)
//    2) grupo      → users.pdas_prioritarios (diagnóstico grupal)
//    3) jardin     → users.pdas_jardin (compromisos del colectivo o
//       de la dirección, aunque vengan de la zona)
//  Se calcula al momento (sin tabla aparte) porque el cierre de ciclo
//  ya vacía estas fuentes: la canasta siempre es del ciclo vigente.
//  Las fuentes guardan TEXTO del PDA (a veces sin el punto final), así
//  que se ubican en el catálogo con texto normalizado.
// ============================================================

export type OrigenPrioritario = 'individual' | 'grupo' | 'jardin'

export const ORIGENES_PRIORITARIO: Array<{ clave: OrigenPrioritario; etiqueta: string }> = [
  { clave: 'individual', etiqueta: 'Individual / NEE' },
  { clave: 'grupo', etiqueta: 'Grupo' },
  { clave: 'jardin', etiqueta: 'Jardín' },
]

// Columnas de users que necesita construirCanastaPrioritarios.
export const SELECT_USERS_PRIORITARIOS = 'evaluacion_individual, pdas_prioritarios, pdas_jardin'

export type PdaCatalogoConTexto = PdaCatalogoAvance & { pda: string }

export type PdaPrioritario = {
  id: string
  campo: string
  posicion: number
  origenes: OrigenPrioritario[] // en orden de gradualidad
}

export type CanastaPrioritarios = {
  version: 1
  pdas: PdaPrioritario[]
  sinCatalogo: Record<OrigenPrioritario, number> // textos que no se ubicaron en el catálogo
}

export type ResultadoPrioritarios = {
  version: 1
  hayDiagnostico: boolean
  total: number
  atendidos: number
  porOrigen: Record<OrigenPrioritario, { total: number; atendidos: number }>
  pendientes: PdaPrioritario[]
}

export function normalizarTextoPda(texto: string): string {
  return texto.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[\s.;,]+$/, '')
}

// Acepta: lista de textos, lista de objetos con "pda", o un objeto
// { pdas: [...] } (formato nuevo de pdas_jardin).
function textosDeFuente(fuente: unknown): string[] {
  let lista: unknown[] = []
  if (Array.isArray(fuente)) lista = fuente
  else if (fuente && typeof fuente === 'object' && Array.isArray((fuente as any).pdas)) lista = (fuente as any).pdas
  const textos: string[] = []
  for (const x of lista) {
    if (typeof x === 'string' && x.trim()) textos.push(x)
    else if (x && typeof x === 'object' && typeof (x as any).pda === 'string') textos.push((x as any).pda)
  }
  return textos
}

export function construirCanastaPrioritarios(
  perfil: { evaluacion_individual?: any; pdas_prioritarios?: any; pdas_jardin?: any } | null | undefined,
  catalogo: PdaCatalogoConTexto[]
): CanastaPrioritarios {
  const porTexto: Record<string, PdaCatalogoConTexto> = {}
  for (const c of catalogo) {
    if (!c.pda) continue
    const clave = normalizarTextoPda(c.pda)
    if (!porTexto[clave]) porTexto[clave] = c
  }

  const fuentes: Array<[OrigenPrioritario, string[]]> = [
    ['individual', textosDeFuente(perfil?.evaluacion_individual?.pdas_prioritarios_grupo)],
    ['grupo', textosDeFuente(perfil?.pdas_prioritarios)],
    ['jardin', textosDeFuente(perfil?.pdas_jardin)],
  ]

  const acumulado: Record<string, PdaPrioritario> = {}
  const sinCatalogo: Record<OrigenPrioritario, number> = { individual: 0, grupo: 0, jardin: 0 }

  for (const [origen, textos] of fuentes) {
    for (const texto of textos) {
      const c = porTexto[normalizarTextoPda(texto)]
      if (!c) { sinCatalogo[origen]++; continue }
      if (!acumulado[c.id]) acumulado[c.id] = { id: c.id, campo: c.campo, posicion: c.posicion_campo, origenes: [] }
      if (!acumulado[c.id].origenes.includes(origen)) acumulado[c.id].origenes.push(origen)
    }
  }

  const orden = ORIGENES_PRIORITARIO.map(o => o.clave)
  const pdas = Object.values(acumulado)
    .map(p => ({ ...p, origenes: [...p.origenes].sort((a, b) => orden.indexOf(a) - orden.indexOf(b)) }))
    .sort((a, b) => (a.campo === b.campo ? a.posicion - b.posicion : a.campo.localeCompare(b.campo)))

  return { version: 1, pdas, sinCatalogo }
}

export function calcularPrioritarios(
  canasta: CanastaPrioritarios,
  avance: ResultadoAvance
): ResultadoPrioritarios {
  const trabajados = new Set(avance.pdas.map(p => p.id))
  const porOrigen: Record<OrigenPrioritario, { total: number; atendidos: number }> = {
    individual: { total: 0, atendidos: 0 },
    grupo: { total: 0, atendidos: 0 },
    jardin: { total: 0, atendidos: 0 },
  }
  const pendientes: PdaPrioritario[] = []
  let atendidos = 0

  for (const p of canasta.pdas) {
    const atendido = trabajados.has(p.id)
    if (atendido) atendidos++
    else pendientes.push(p)
    for (const o of p.origenes) {
      porOrigen[o].total++
      if (atendido) porOrigen[o].atendidos++
    }
  }

  return {
    version: 1,
    hayDiagnostico: canasta.pdas.length > 0,
    total: canasta.pdas.length,
    atendidos,
    porOrigen,
    pendientes,
  }
}

// [Saneado 27 sep 2026 — Fase 1] ¿El PDA está en esta fuente de prioritarios?
// Misma comparación que la canasta (texto normalizado, sin el punto final),
// para que la marca en Nueva Planeación y el conteo de Mi Avance coincidan.
// Acepta las mismas formas que textosDeFuente (lista de textos, lista de
// objetos con "pda" u objeto { pdas: [...] }) y, por compatibilidad, un texto.
export function esPdaPrioritario(fuente: unknown, pdaTexto: string): boolean {
  if (!pdaTexto) return false
  const buscado = normalizarTextoPda(pdaTexto)
  if (typeof fuente === 'string') {
    return normalizarTextoPda(fuente).includes(buscado)
  }
  return textosDeFuente(fuente).some(t => normalizarTextoPda(t) === buscado)
}
