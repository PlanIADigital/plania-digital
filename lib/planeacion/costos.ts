// ============================================================
//  PlanIA Digital — lib/planeacion/costos.ts
//  [Saneado 27 sep 2026 — Fase 2] Separado de app/api/generar-planeacion/route.ts
//  SIN cambios de contenido: solo se movió y se agregó 'export'.
//  Tarifas del modelo y acumulador del costo real de cada generación.
// ============================================================
import type Anthropic from '@anthropic-ai/sdk'

// [sep 2026] Tarifas de Sonnet 4.6, USD por millón de tokens — verificar
// contra platform.claude.com/docs/en/about-claude/pricing si cambian.
const PRECIO_INPUT_POR_MILLON = 3.00
const PRECIO_OUTPUT_POR_MILLON = 15.00
const PRECIO_CACHE_READ_POR_MILLON = 0.30
const PRECIO_CACHE_WRITE_POR_MILLON = 3.75

// Acumulador de costo real en USD, creado nuevo en cada POST (nunca a
// nivel de módulo) para que peticiones concurrentes de distintas
// educadoras nunca mezclen su costo entre sí.
export type AcumuladorCosto = { total: number }

export function sumarCostoLlamada(acumulador: AcumuladorCosto, usage: Anthropic.Messages.Usage) {
  const costo =
    (usage.input_tokens / 1_000_000) * PRECIO_INPUT_POR_MILLON +
    (usage.output_tokens / 1_000_000) * PRECIO_OUTPUT_POR_MILLON +
    ((usage.cache_read_input_tokens || 0) / 1_000_000) * PRECIO_CACHE_READ_POR_MILLON +
    ((usage.cache_creation_input_tokens || 0) / 1_000_000) * PRECIO_CACHE_WRITE_POR_MILLON
  acumulador.total += costo
}
