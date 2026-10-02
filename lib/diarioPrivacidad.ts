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

export async function quitarNombres(texto: string, reemplazo: string): Promise<ResultadoFiltro> {
  const base: ResultadoFiltro = { texto, nombresQuitados: 0, revision: 'ok', costoUsd: 0 }
  if (!texto.trim()) return base
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const r = await anthropic.messages.create({
      model: MODELO_FILTRO,
      max_tokens: 2000,
      temperature: 0,
      system: `Eres un filtro de privacidad para notas de una educadora de preescolar en México. Recibes una transcripción de voz. Reemplaza CADA nombre propio de persona (niñas, niños, familiares, docentes) por ${reemplazo}. No cambies ninguna otra palabra, ni la puntuación, ni el orden. No reemplaces códigos como AL-03, ni nombres de lugares, materiales o actividades. Si no hay nombres, devuelve el texto idéntico. Responde solo JSON: {"texto":"...","nombres_quitados":N}`,
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
