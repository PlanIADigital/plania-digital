// ============================================================
//  PlanIA Digital — lib/coloresCampos.ts
//  [1 oct 2026] Código ÚNICO de color por campo formativo, tomado de
//  los encabezados de la tabla de campos del "Programa Sintético de la
//  Fase 2" (SEP, 2024, p. 13). Las educadoras reconocen estos colores
//  de sus documentos y capacitaciones: rojo = Lenguajes, azul =
//  Saberes, verde = Ética, morado = Humano y Comunitario.
//  Excepción consciente a la regla de "nada de rojo": aquí el color es
//  un CÓDIGO reconocido. Para que no se lea como alerta, las barras
//  usan rayas diagonales + degradado y las etiquetas usan fondo suave.
// ============================================================
export type ColorCampo = {
  base: string   // color oficial pleno (barras, mapa)
  claro: string  // inicio del degradado
  fondo: string  // fondo suave de etiquetas
  texto: string  // texto oscuro del mismo tono (etiquetas)
}

export const COLORES_CAMPO: Record<string, ColorCampo> = {
  'Lenguajes':                        { base: '#CC1418', claro: '#E46A6D', fondo: '#FBEAEA', texto: '#8E0E11' },
  'Saberes y Pensamiento Científico': { base: '#185CA8', claro: '#6A97CC', fondo: '#E8EFF8', texto: '#11406F' },
  'Ética, Naturaleza y Sociedades':   { base: '#54942C', claro: '#93C06F', fondo: '#EEF5E8', texto: '#3A671F' },
  'De lo Humano y lo Comunitario':    { base: '#60249C', claro: '#9A6EC6', fondo: '#F1EAF8', texto: '#43196D' },
}

const NEUTRO: ColorCampo = { base: '#3D3A8C', claro: '#8A88C9', fondo: '#EEEDF8', texto: '#3D3A8C' }

export function colorCampo(nombre?: string | null): ColorCampo {
  return (nombre && COLORES_CAMPO[nombre]) || NEUTRO
}

// Barra de progreso: rayas diagonales suaves sobre un degradado del color oficial.
export function fondoBarraCampo(nombre?: string | null): string {
  const c = colorCampo(nombre)
  return `repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 6px, rgba(255,255,255,0) 6px 12px), linear-gradient(90deg, ${c.claro}, ${c.base})`
}

// Etiqueta pequeña de campo: fondo suave + texto oscuro del mismo tono.
export function chipCampo(nombre?: string | null): { bg: string; color: string } {
  const c = colorCampo(nombre)
  return { bg: c.fondo, color: c.texto }
}
