import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { texto, auth_uid } = await req.json()
    if (!texto || !auth_uid) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Eres un agente especializado en análisis de estilo de escritura para educadoras de preescolar mexicanas.
Recibes un texto escrito por una educadora. Tu tarea es identificar su estilo personal de redacción para que las planeaciones didácticas generadas por IA suenen auténticamente a ella.

Analiza:
- Tono general (cálido, formal, directo, descriptivo, etc.)
- Longitud típica de oraciones (cortas, medias, largas)
- Vocabulario preferido (técnico-pedagógico, cotidiano, mixto)
- Uso de conectores y transiciones
- Características distintivas de su escritura

Responde ÚNICAMENTE con JSON puro, sin markdown ni backticks:
{
  "tono": "descripción del tono en 1 frase",
  "longitud_oraciones": "cortas" | "medias" | "largas" | "mixtas",
  "vocabulario": "técnico-pedagógico" | "cotidiano" | "mixto",
  "caracteristicas": ["característica 1", "característica 2", "característica 3"],
  "instruccion_para_agente": "instrucción directa de 2-3 oraciones que el agente generador usará para imitar este estilo"
}`,
      messages: [{
        role: 'user',
        content: `Analiza el estilo de escritura de este texto:\n\n${texto.substring(0, 6000)}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(clean)

    const { error } = await supabaseAdmin
      .from('users')
      .update({ estilo_narrativo: resultado })
      .eq('auth_uid', auth_uid)

    if (error) {
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error('Error analizar-estilo-narrativo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
