import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { texto_evaluacion, grado, total_alumnos, auth_uid } = await request.json()

    if (!texto_evaluacion || !auth_uid) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const { data: catalogo } = await supabase
      .from('pda_catalog')
      .select('campo, contenido, pda, grado')
      .eq('grado', grado || '2°')
      .order('campo')

    const resumenPDAs = (catalogo || []).map((r: any) =>
      `CAMPO: ${r.campo} | PDA: ${r.pda}`
    ).join('\n')

    const message = await client.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México.

Tu tarea es analizar la evaluación individual de alumnos de una educadora y extraer información pedagógica útil.

REGLAS CRÍTICAS DE PRIVACIDAD:
- NUNCA incluyas nombres reales de alumnos en tu respuesta
- Si el documento tiene nombres, sustitúyelos por referencias anónimas: "Alumno 1", "Alumno 2", etc.
- Solo extrae información pedagógica: necesidades de aprendizaje, NEE, fortalezas, áreas de oportunidad
- Ignora datos administrativos, fechas de nacimiento, CURP, domicilios, nombres de padres

Responde SOLO con JSON válido, sin texto adicional:
{
  "total_alumnos_detectados": 0,
  "resumen_general": "párrafo breve",
  "alumnos": [
    {
      "referencia": "Alumno 1",
      "observaciones": "necesidades pedagógicas",
      "nee": [],
      "fortalezas": [],
      "areas_oportunidad": [],
      "pdas_sugeridos": []
    }
  ],
  "pdas_prioritarios_grupo": [],
  "alumnos_con_nee": 0,
  "alertas": []
}`,
      messages: [{
        role: 'user',
        content: `Analiza esta evaluación individual de ${grado || '2°'} grado preescolar. Total aproximado: ${total_alumnos || 24} alumnos.\n\nCATÁLOGO PDAs:\n${resumenPDAs}\n\nEVALUACIÓN:\n${texto_evaluacion}`
      }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let resultado
    try {
      const clean = responseText.replace(/```json|```/g, '').trim()
      resultado = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Error al procesar la evaluación. Intenta de nuevo.' }, { status: 500 })
    }

    const { error } = await supabase
      .from('users')
      .update({ evaluacion_individual: resultado })
      .eq('auth_uid', auth_uid)

    if (error) {
      return NextResponse.json({ error: 'Error al guardar: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ resultado })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
