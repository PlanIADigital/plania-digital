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
    const { diagnostico_texto, grado, auth_uid } = await request.json()
    if (!diagnostico_texto || !auth_uid) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    // 1. Cargar catálogo completo desde Supabase
    const { data: catalogo } = await supabase
      .from('pda_catalog')
      .select('campo, contenido, pda, grado')
      .eq('grado', grado || '2°')
      .order('campo')

    if (!catalogo || catalogo.length === 0) {
      return NextResponse.json({ error: 'Catálogo no disponible' }, { status: 500 })
    }

    // 2. Construir resumen del catálogo para el prompt
    const resumenPDAs = catalogo.map((r: any) =>
      `CAMPO: ${r.campo} | CONTENIDO: ${r.contenido} | PDA: ${r.pda}`
    ).join('\n')

    // 3. Llamar a Haiku con modelo correcto y prompt mejorado
    const message = await client.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México.

Tu tarea es analizar el diagnóstico de grupo de una educadora e identificar qué PDAs del catálogo oficial son más relevantes para atender las necesidades detectadas en sus alumnos.

PASO 1 — EXTRACCIÓN:
El diagnóstico puede venir en cualquier formato: narrativo, por secciones, por campos formativos, como lista, o mezclado con datos administrativos. Ignora completamente los datos administrativos (nombre del jardín, CCT, turno, horarios, infraestructura, datos de los padres de familia, nivel socioeconómico). Extrae ÚNICAMENTE las necesidades pedagógicas, áreas de oportunidad, y características de desarrollo y aprendizaje de los alumnos que sean relevantes para la planeación didáctica.

PASO 2 — SELECCIÓN DE PDAs:
Con base en las necesidades extraídas, selecciona entre 5 y 7 PDAs del catálogo oficial, ordenados de mayor a menor relevancia. Los PDAs deben ser LITERALES y EXACTOS del catálogo. Nunca parafrasear ni modificar el texto del PDA.

PASO 3 — JUSTIFICACIÓN:
Para cada PDA seleccionado, escribe una justificación breve (1-2 oraciones) explicando con qué necesidad específica detectada en el diagnóstico se relaciona directamente.

REGLA ABSOLUTA: Responde SOLO con JSON válido, sin markdown, sin texto adicional, sin explicaciones fuera del JSON.

FORMATO DE SALIDA EXACTO:
{
  "pdas_sugeridos": [
    {
      "campo": "...",
      "contenido": "...",
      "pda": "...",
      "justificacion": "..."
    }
  ]
}`,
      messages: [{
        role: 'user',
        content: `DIAGNÓSTICO DE GRUPO (puede venir en cualquier formato):
${diagnostico_texto}

CATÁLOGO OFICIAL DE PDAs (grado ${grado || '2°'}):
${resumenPDAs}

Analiza el diagnóstico, extrae las necesidades pedagógicas reales ignorando datos administrativos, y selecciona los 5-7 PDAs más relevantes del catálogo. Los PDAs deben ser literales.`
      }]
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const resultado = JSON.parse(clean)

    // 4. Guardar diagnóstico y PDAs prioritarios en Supabase
    const { error: saveError } = await supabase
      .from('users')
      .update({
        diagnostico_texto,
        diagnostico_fecha: new Date().toISOString(),
        pdas_prioritarios: resultado.pdas_sugeridos,
      })
      .eq('auth_uid', auth_uid)

    if (saveError) {
      console.error('Error guardando diagnóstico:', saveError)
    }

    return NextResponse.json(resultado)

  } catch (error: unknown) {
    console.error('Error en Agente Diagnóstico:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
