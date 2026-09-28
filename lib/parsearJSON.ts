// ============================================================
//  PlanIA Digital — lib/parsearJSON.ts
//  [Saneado 27 sep 2026 — Fase 2] Reparador ÚNICO de las respuestas JSON
//  de la IA. Antes había 4 copias (evaluación individual, PDA del jardín,
//  programa analítico y generar planeación) con la misma lógica; ahora un
//  ajuste aquí llega a todas.
//
//  1. repararJSON: dentro de los textos, convierte saltos de línea y
//     tabuladores en escapes válidos y escapa comillas internas que el
//     modelo dejó sin escapar (una comilla solo cierra el texto si después
//     viene , } ] : o el final).
//  2. cerrarJSONTruncado: si la respuesta se cortó, cierra el texto abierto
//     y las llaves/corchetes pendientes.
//  3. parsearJSONRobusto: quita ```json, caracteres de control, repara y
//     parsea; si falla, intenta cerrar lo truncado. Si tampoco, lanza el
//     PRIMER error (el más informativo).
// ============================================================

export function repararJSON(raw: string): string {
  const n = raw.length
  let resultado = ''
  let dentroDeString = false
  let escapando = false

  for (let i = 0; i < n; i++) {
    const ch = raw[i]

    if (!dentroDeString) {
      resultado += ch
      if (ch === '"') dentroDeString = true
      continue
    }

    if (escapando) {
      resultado += ch
      escapando = false
      continue
    }

    if (ch === '\\') {
      resultado += ch
      escapando = true
      continue
    }

    if (ch === '\n') { resultado += '\\n'; continue }
    if (ch === '\r') { resultado += '\\r'; continue }
    if (ch === '\t') { resultado += '\\t'; continue }

    if (ch === '"') {
      let j = i + 1
      while (j < n && /\s/.test(raw[j])) j++
      const siguiente = raw[j]
      const esCierreReal = siguiente === ',' || siguiente === '}' || siguiente === ']' || siguiente === ':' || siguiente === undefined
      if (esCierreReal) {
        resultado += ch
        dentroDeString = false
      } else {
        resultado += '\\"'
      }
      continue
    }

    resultado += ch
  }

  return resultado
}

export function cerrarJSONTruncado(raw: string): string {
  const n = raw.length
  let dentroDeString = false
  let escapando = false
  const pila: string[] = []

  for (let i = 0; i < n; i++) {
    const ch = raw[i]
    if (dentroDeString) {
      if (escapando) { escapando = false; continue }
      if (ch === '\\') { escapando = true; continue }
      if (ch === '"') { dentroDeString = false; continue }
      continue
    }
    if (ch === '"') { dentroDeString = true; continue }
    if (ch === '{' || ch === '[') { pila.push(ch); continue }
    if (ch === '}' || ch === ']') { pila.pop(); continue }
  }

  let cierre = ''
  if (dentroDeString) cierre += '"'
  while (pila.length > 0) {
    const abierto = pila.pop()
    cierre += abierto === '{' ? '}' : ']'
  }
  return raw + cierre
}

// Devuelve any a propósito: cada ruta valida la forma de su propia respuesta.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsearJSONRobusto(rawContent: string): any {
  const sinFences = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim()
  const reparado = repararJSON(sinFences)
  try {
    return JSON.parse(reparado)
  } catch (primerError) {
    console.error('⚠️ JSON no parseó en primer intento, probablemente truncado. Intentando cerrar automáticamente...')
    try {
      const resultado = JSON.parse(cerrarJSONTruncado(reparado))
      console.error('✅ Recuperado tras cierre automático de JSON truncado.')
      return resultado
    } catch {
      console.error('❌ No se pudo recuperar el JSON ni siquiera cerrándolo automáticamente.')
      throw primerError
    }
  }
}
