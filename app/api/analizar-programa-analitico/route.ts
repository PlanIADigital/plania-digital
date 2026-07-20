import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// [jul 2026] Mismo parser robusto usado en generar-planeacion/route.ts
// — repara saltos de línea/comillas sin escapar dentro de strings, y
// si el JSON quedó truncado (el modelo se quedó sin espacio antes de
// cerrar todas sus llaves/corchetes), lo cierra automáticamente en
// vez de fallar con "Unterminated string in JSON". Este endpoint
// nunca había tenido este resguardo — un Programa Analítico largo
// (muchos campos_priorizados, inconsistencias, etc.) podía agotar el
// max_tokens y tronar por completo, como pasó aquí.
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

    if (escapando) {
      resultado += ch
      escapando = false
      continue
    }

    if (ch === '\\') {
      resultado += ch
      escapando = true
      continue
    }

    if (ch === '\n') { resultado += '\\n'; continue }
    if (ch === '\r') { resultado += '\\r'; continue }
    if (ch === '\t') { resultado += '\\t'; continue }

    if (ch === '"') {
      let j = i + 1
      while (j < n && /\s/.test(raw[j])) j++
      const siguiente = raw[j]
      const esCierreReal = siguiente === ',' || siguiente === '}' || siguiente === ']' || siguiente === ':' || siguiente === undefined
      if (esCierreReal) {
        resultado += ch
        dentroDeString = false
      } else {
        resultado += '\\"'
      }
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
  } catch (primerError) {
    console.error('⚠️ JSON del Programa Analítico no parseó en primer intento, probablemente truncado. Intentando cerrar automáticamente...')
    try {
      const cerrado = cerrarJSONTruncado(reparado)
      const resultado = JSON.parse(cerrado)
      console.error('✅ Recuperado tras cierre automático de JSON truncado.')
      return resultado
    } catch (segundoError) {
      console.error('❌ No se pudo recuperar el JSON del Programa Analítico ni siquiera cerrándolo automáticamente.')
      throw primerError
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { texto, auth_uid, cct, archivo_formato, grado } = await req.json()

    if (!texto || !auth_uid || !cct) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('auth_uid')
      .eq('auth_uid', auth_uid)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { data: versionActual } = await supabaseAdmin
      .from('programa_analitico')
      .select('version_numero')
      .eq('educadora_id', auth_uid)
      .eq('cct', cct)
      .eq('activo', true)
      .single()

    const siguienteVersion = versionActual ? versionActual.version_numero + 1 : 1

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6',
      // [jul 2026] Subido de 2000 a 4000 — un PA con varios campos
      // formativos, PDAs mencionados, e inconsistencias detectadas
      // fácilmente supera 2000 tokens de salida, causando que el JSON
      // se corte a la mitad (el error "Unterminated string" que
      // reportó Alfredo). El parser robusto de arriba queda además
      // como resguardo si algún PA excepcionalmente largo siguiera
      // agotando el límite.
      max_tokens: 4000,
      system: `Eres un agente pedagógico especializado en el Programa de Educación Preescolar NEM 2022 Fase 2 de México.

Recibes el texto de un Programa Analítico (PA) de un jardín de niños. El PA puede venir en cualquier formato: por secciones numeradas, por planos, por mes, por grado, por grupo, o como presentación. No existe un formato único.

El documento puede contener información de múltiples grupos. Si el grado de la educadora está disponible, extrae prioritariamente la información de ese grado. Extrae también las problemáticas institucionales que aplican a todos los grupos.

TU TAREA:
1. Identificar problemáticas institucionales prioritarias del jardín
2. Identificar campos formativos y contenidos priorizados
3. Extraer PDAs mencionados (con o sin código)
4. Identificar ejes articuladores predominantes
5. Identificar metodología(s) declaradas
6. Extraer contexto comunitario pedagógicamente relevante
7. Detectar inconsistencias pedagógicas (ej: contenido asignado al campo formativo incorrecto)

NUNCA incluyas nombres reales de alumnos, docentes o directivos.
Responde ÚNICAMENTE con JSON puro, sin markdown ni backticks.

FORMATO DE SALIDA:
{
  "tipo_detectado": "Programa Analítico" | "PA + Diagnóstico" | "No identificado",
  "grado_detectado": "1°" | "2°" | "3°" | "Múltiples" | null,
  "problematicas_institucionales": ["problemática 1", "problemática 2"],
  "campos_priorizados": [
    {
      "campo": "Lenguajes",
      "contenidos_principales": ["contenido 1", "contenido 2"],
      "pdas_mencionados": ["texto literal del PDA o código"]
    }
  ],
  "ejes_articuladores": ["Inclusión", "Vida saludable"],
  "metodologia": ["Proyectos", "ABJ"],
  "contexto_comunitario": "resumen breve del contexto relevante para planeaciones (máx 2 oraciones)",
  "inconsistencias": [
    {
      "descripcion": "descripción de la inconsistencia detectada",
      "campo_incorrecto": "campo donde aparece",
      "campo_correcto": "campo donde debería estar"
    }
  ],
  "resumen_pa": "síntesis pedagógica del PA en 2-3 oraciones para mostrar en la card"
}`,
      messages: [{
        role: 'user',
        content: `Grado de la educadora: ${grado || 'No especificado'}\n\nTEXTO DEL PROGRAMA ANALÍTICO:\n${texto.substring(0, 12000)}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const pda_ponderacion = parsearJSONRobusto(text)

    if (versionActual) {
      await supabaseAdmin
        .from('programa_analitico')
        .update({ activo: false })
        .eq('educadora_id', auth_uid)
        .eq('cct', cct)
        .eq('activo', true)
    }

    const { data: nuevaVersion, error: insertError } = await supabaseAdmin
      .from('programa_analitico')
      .insert({
        educadora_id: auth_uid,
        cct,
        version_numero: siguienteVersion,
        archivo_formato: archivo_formato || 'desconocido',
        contenido_extraido: texto.substring(0, 5000),
        pda_ponderacion,
        activo: true,
      })
      .select('id, version_numero, fecha_carga')
      .single()

    if (insertError) {
      console.error('Error insertando PA:', insertError)
      return NextResponse.json({ error: 'Error al guardar el Programa Analítico' }, { status: 500 })
    }

    const tieneInconsistencias = pda_ponderacion.inconsistencias?.length > 0

    return NextResponse.json({
      ok: true,
      version_numero: nuevaVersion.version_numero,
      fecha_carga: nuevaVersion.fecha_carga,
      pa_id: nuevaVersion.id,
      resultado: pda_ponderacion,
      tiene_inconsistencias: tieneInconsistencias,
      inconsistencias: pda_ponderacion.inconsistencias || [],
    })

  } catch (error) {
    console.error('Error analizar-programa-analitico:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const auth_uid = searchParams.get('auth_uid')
    const cct = searchParams.get('cct')

    if (!auth_uid || !cct) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const { data: historial, error } = await supabaseAdmin
      .from('programa_analitico')
      .select('id, version_numero, fecha_carga, archivo_formato, activo, nota_directivo, nota_directivo_fecha, pda_ponderacion')
      .eq('educadora_id', auth_uid)
      .eq('cct', cct)
      .order('version_numero', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, historial: historial || [] })

  } catch (error) {
    console.error('Error GET historial PA:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}