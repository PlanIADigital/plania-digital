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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Eres un agente pedagógico especializado en educación preescolar mexicana NEM 2022.
Recibes observaciones que un directivo ha hecho a una educadora durante visitas de aula o Consejos Técnicos Escolares.
Tu tarea es extraer las áreas de mejora pedagógica concretas para que el sistema las integre como criterios de cuidado en las planeaciones didácticas.

Reglas:
- Nunca incluir nombres reales de personas
- Enfocarte solo en aspectos pedagógicos y didácticos
- Transformar críticas en áreas de oportunidad constructivas
- Ignorar aspectos administrativos o personales

Responde ÚNICAMENTE con JSON puro, sin markdown ni backticks:
{
  "areas_mejora": ["área concreta 1", "área concreta 2", "área concreta 3"],
  "aspectos_fuertes": ["aspecto positivo 1", "aspecto positivo 2"],
  "instruccion_para_agente": "instrucción directa de 2-3 oraciones que el agente generador usará para cuidar estos aspectos en cada planeación"
}`,
      messages: [{
        role: 'user',
        content: `Analiza estas observaciones del directivo:\n\n${texto.substring(0, 6000)}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(clean)

    const { error } = await supabaseAdmin
      .from('users')
      .update({ observaciones_directivo: resultado })
      .eq('auth_uid', auth_uid)

    if (error) {
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error('Error analizar-observaciones-directivo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
