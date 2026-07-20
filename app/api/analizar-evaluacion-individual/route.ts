import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function repararJSON(raw: string): string {
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
    if (escapando) { resultado += ch; escapando = false; continue }
    if (ch === '\\') { resultado += ch; escapando = true; continue }
    if (ch === '\n') { resultado += '\\n'; continue }
    if (ch === '\r') { resultado += '\\r'; continue }
    if (ch === '\t') { resultado += '\\t'; continue }
    if (ch === '"') {
      let j = i + 1
      while (j < n && /\s/.test(raw[j])) j++
      const siguiente = raw[j]
      const esCierreReal = siguiente === ',' || siguiente === '}' || siguiente === ']' || siguiente === ':' || siguiente === undefined
      if (esCierreReal) { resultado += ch; dentroDeString = false }
      else resultado += '\\"'
      continue
    }
    resultado += ch
  }
  return resultado
}

function cerrarJSONTruncado(raw: string): string {
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

function parsearJSONRobusto(rawContent: string): any {
  const sinFences = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim()
  const reparado = repararJSON(sinFences)
  try {
    return JSON.parse(reparado)
  } catch {
    return JSON.parse(cerrarJSONTruncado(reparado))
  }
}

export async function POST(request: NextRequest) {
  try {
    const { texto_evaluacion, grado, auth_uid } = await request.json()

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
      max_tokens: 8000,
      system: `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México.

Tu tarea es analizar la evaluación individual de alumnos de una educadora y extraer información pedagógica útil.

REGLA CRÍTICA DE CONTEO: cuenta el número real de alumnos DISTINTOS que identifiques en el documento, basándote únicamente en lo que el texto describe. No asumas ni redondees a ningún número "esperado" — reporta el conteo exacto que encuentres, aunque sea un número inusual.

REGLA CRÍTICA DE EXCLUSIÓN: el documento puede incluir entradas, filas o secciones que NO corresponden a un alumno — por ejemplo, notas, firmas, comentarios generales, o entradas etiquetadas explícitamente como "Educadora", "Docente", "Maestra", "Observaciones generales del grupo", o similar. NUNCA cuentes estas entradas como si fueran un alumno. Antes de contar, identifica primero cuáles entradas realmente describen a un niño o niña, y descarta cualquier entrada que se refiera a un adulto, al personal escolar, o a observaciones generales sin nombre de un alumno específico.

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
        content: `Analiza esta evaluación individual de ${grado || '2°'} grado preescolar.\n\nCATÁLOGO PDAs:\n${resumenPDAs}\n\nEVALUACIÓN:\n${texto_evaluacion}`
      }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let resultado
    try {
      resultado = parsearJSONRobusto(responseText)
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