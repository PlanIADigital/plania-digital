// ============================================================
//  PlanIA Digital — lib/diarioPrivacidad.ts
//  [2 oct 2026] Filtro de privacidad de Mi diario (prompt autorizado
//  por el fundador). MÍA (Haiku) reemplaza cada nombre propio de
//  persona por el código del alumno o por "[nombre omitido]".
//  Se usa al transcribir y al editar una nota: ningún nombre llega
//  a la base. Si falla, no bloquea: devuelve revision = 'fallo'.
// ============================================================
import Anthropic from '@anthropic-ai/sdk'

const MODELO_FILTRO = 'claude-haiku-4-5-20251001'

export type ResultadoFiltro = {
  texto: string
  nombresQuitados: number
  revision: 'ok' | 'fallo'
  costoUsd: number
}

// [2 oct 2026] Prompt del filtro (autorizado por el fundador, v2): solo nombres
// propios; el del alumno de la nota → su código; cualquier otra persona →
// [nombre omitido]; nunca palabras de parentesco o de rol (mamá, maestra…).
function promptFiltro(reemplazo: string): string {
  const esCodigo = /^AL-\d+$/.test(reemplazo)
  const regla = esCodigo
    ? `Si el nombre es del alumno de quien trata la nota, reemplázalo por ${reemplazo}; si es de cualquier otra persona (otro niño, un familiar, una docente), reemplázalo por [nombre omitido].`
    : 'Reemplaza cada uno por [nombre omitido].'
  return `Eres un filtro de privacidad para notas de una educadora de preescolar en México. Recibes una transcripción de voz. Reemplaza SOLO los nombres propios de persona (por ejemplo: Juan, María Fernanda, Lupita, la maestra Rosy). ${regla} NUNCA reemplaces palabras de parentesco o de rol, aunque se refieran a una persona: mamá, papá, abuela, tía, hermano, familia, maestra, compañero, directora. No cambies ninguna otra palabra, ni la puntuación, ni el orden. No reemplaces códigos como AL-03, ni nombres de lugares, materiales o actividades. Si no hay nombres, devuelve el texto idéntico. Responde solo JSON: {"texto":"...","nombres_quitados":N}`
}

export async function quitarNombres(texto: string, reemplazo: string): Promise<ResultadoFiltro> {
  const base: ResultadoFiltro = { texto, nombresQuitados: 0, revision: 'ok', costoUsd: 0 }
  if (!texto.trim()) return base
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const r = await anthropic.messages.create({
      model: MODELO_FILTRO,
      max_tokens: 2000,
      temperature: 0,
      system: promptFiltro(reemplazo),
      messages: [{ role: 'user', content: texto }],
    })
    base.costoUsd = (r.usage.input_tokens * 1 + r.usage.output_tokens * 5) / 1_000_000
    const bloque: any = r.content.find((b: any) => b.type === 'text')
    const crudo = String(bloque?.text || '')
    const j = JSON.parse(crudo.slice(crudo.indexOf('{'), crudo.lastIndexOf('}') + 1))
    const limpio = String(j?.texto || '').trim()
    const n = Number(j?.nombres_quitados) || 0
    if (limpio && limpio.length > texto.length * 0.5 && limpio.length < texto.length * 1.5) {
      if (n > 0) { base.texto = limpio; base.nombresQuitados = n }
    } else {
      base.revision = 'fallo'
    }
  } catch (e: any) {
    console.error('Mi diario: el filtro de nombres falló:', e?.message)
    base.revision = 'fallo'
  }
  return base
}
