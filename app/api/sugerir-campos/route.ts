import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const EJES_ARTICULADORES = [
  'Interculturalidad crítica',
  'Igualdad de género',
  'Inclusión',
  'Pensamiento crítico',
  'Apropiación de las culturas a través de la lectura y la escritura',
  'Artes y experiencias estéticas',
  'Vida saludable',
]

export async function POST(request: NextRequest) {
  try {
    const { nombre_proyecto, situacion_problema, finalidad, campo_principal, grado } = await request.json()

    const { data: catalogo } = await supabase
      .from('pda_catalog')
      .select('campo, contenido, pda, grado')
      .eq('grado', grado || '2°')
      .order('campo')

    if (!catalogo || catalogo.length === 0) {
      return NextResponse.json({ error: 'Catálogo no disponible' }, { status: 500 })
    }

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

    const ejesLista = EJES_ARTICULADORES.map((e, i) => `${i + 1}. ${e}`).join('\n')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México.
Tu tarea es analizar un proyecto didáctico y:
1. Seleccionar los 3 campos formativos transversales más relevantes del catálogo oficial.
2. Sugerir el eje articulador principal y uno secundario más adecuados para articular el proyecto.

EJES ARTICULADORES DISPONIBLES:
${ejesLista}

REGLAS CRÍTICAS:
- Los PDAs deben ser LITERALES y EXACTOS del catálogo. Sin parafrasear.
- Selecciona exactamente 3 campos formativos, todos diferentes entre sí y al campo principal.
- El eje_principal debe ser el que mejor articule TODOS los campos y contenidos del proyecto.
- El eje_secundario debe ser diferente al principal y complementarlo.
- Responde SOLO con JSON válido, sin markdown, sin explicaciones.

FORMATO DE SALIDA EXACTO:
{
  "transversales": [
    { "campo": "...", "contenido": "...", "pda": "..." },
    { "campo": "...", "contenido": "...", "pda": "..." },
    { "campo": "...", "contenido": "...", "pda": "..." }
  ],
  "eje_principal": "nombre exacto del eje articulador principal",
  "eje_secundario": "nombre exacto del eje articulador secundario"
}`,
      messages: [{
        role: 'user',
        content: `PROYECTO:\nNombre: ${nombre_proyecto}\nSituación problema: ${situacion_problema}\nFinalidad: ${finalidad}\nCampo principal: ${campo_principal}\n\nCATÁLOGO:\n${resumenCatalogo}\n\nPDAs:\n${resumenPDAs}\n\nSelecciona 3 campos transversales y 2 ejes articuladores.`
      }]
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const resultado = JSON.parse(clean)

    if (!EJES_ARTICULADORES.includes(resultado.eje_principal)) {
      resultado.eje_principal = 'Pensamiento crítico'
    }
    if (!EJES_ARTICULADORES.includes(resultado.eje_secundario) ||
        resultado.eje_secundario === resultado.eje_principal) {
      resultado.eje_secundario = EJES_ARTICULADORES.find(
        e => e !== resultado.eje_principal
      ) || 'Inclusión'
    }

    resultado.ejes_disponibles = EJES_ARTICULADORES
    return NextResponse.json(resultado)

  } catch (error: unknown) {
    console.error('Error en sugerir-campos:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
