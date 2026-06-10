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
    const { nombre_proyecto, situacion_problema, finalidad, campo_principal, grado } = await request.json()

    // 1. Cargar catálogo completo desde Supabase
    const { data: catalogo } = await supabase
      .from('pda_catalog')
      .select('campo, contenido, pda, grado')
      .eq('grado', grado || '2°')
      .order('campo')

    if (!catalogo || catalogo.length === 0) {
      return NextResponse.json({ error: 'Catálogo no disponible' }, { status: 500 })
    }

    // 2. Construir resumen del catálogo para el prompt (excluye el campo principal)
    const camposDisponibles = [...new Set(catalogo.map((r: any) => r.campo))]
      .filter(c => c !== campo_principal)

    const resumenCatalogo = camposDisponibles.map(campo => {
      const contenidos = [...new Set(
        catalogo.filter((r: any) => r.campo === campo).map((r: any) => r.contenido)
      )]
      return `CAMPO: ${campo}\nCONTENIDOS: ${contenidos.join(' | ')}`
    }).join('\n\n')

    const pdaPorContenido = catalogo.reduce((acc: any, r: any) => {
      const key = `${r.campo}||${r.contenido}`
      if (!acc[key]) acc[key] = []
      acc[key].push(r.pda)
      return acc
    }, {})

    const resumenPDAs = Object.entries(pdaPorContenido)
      .filter(([key]) => !key.startsWith(campo_principal))
      .map(([key, pdas]) => {
        const [campo, contenido] = key.split('||')
        return `${campo} > ${contenido}:\n${(pdas as string[]).map(p => `  - ${p}`).join('\n')}`
      }).join('\n\n')

    // 3. Llamar a Haiku
    const message = await client.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México. 
Tu tarea es analizar un proyecto didáctico y seleccionar los 3 campos formativos transversales más relevantes desde un catálogo oficial.

REGLAS CRÍTICAS:
- Los PDAs deben ser LITERALES y EXACTOS del catálogo proporcionado. Sin parafrasear ni modificar.
- Selecciona exactamente 3 campos formativos, todos diferentes entre sí y diferentes al campo principal.
- Elige el contenido y PDA que tenga relación más directa con la situación problema y finalidad del proyecto.
- Responde SOLO con JSON válido, sin markdown, sin explicaciones.

FORMATO DE SALIDA EXACTO:
{
  "transversales": [
    { "campo": "...", "contenido": "...", "pda": "..." },
    { "campo": "...", "contenido": "...", "pda": "..." },
    { "campo": "...", "contenido": "...", "pda": "..." }
  ]
}`,
      messages: [{
        role: 'user',
        content: `PROYECTO:
Nombre: ${nombre_proyecto}
Situación problema: ${situacion_problema}
Finalidad: ${finalidad}
Campo principal ya elegido: ${campo_principal}

CATÁLOGO DISPONIBLE (campos y contenidos):
${resumenCatalogo}

PDAs DISPONIBLES POR CONTENIDO:
${resumenPDAs}

Selecciona los 3 campos transversales más relevantes para este proyecto. Los PDAs deben ser literales del catálogo.`
      }]
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const resultado = JSON.parse(clean)

    return NextResponse.json(resultado)

  } catch (error: unknown) {
    console.error('Error en sugerir-campos:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}