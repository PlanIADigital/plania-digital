import { parsearJSONRobusto } from '@/lib/parsearJSON'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verificarUsuario } from '@/lib/verificarUsuario'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// [jul 2026] Mismo parser robusto usado en generar-planeacion/route.ts
// — repara saltos de línea/comillas sin escapar dentro de strings, y
// si el JSON quedó truncado (el modelo se quedó sin espacio antes de
// cerrar todas sus llaves/corchetes), lo cierra automáticamente en
// vez de fallar con "Unterminated string in JSON". Este endpoint
// nunca había tenido este resguardo — un Programa Analítico largo
// (muchos campos_priorizados, inconsistencias, etc.) podía agotar el
// max_tokens y tronar por completo, como pasó aquí.

export async function POST(req: NextRequest) {
  try {
    const auth = await verificarUsuario(req)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth
    // programa_analitico.educadora_id guarda el auth_uid, no users.id
    const auth_uid = usuario.auth_uid

    const { texto, cct, archivo_formato, grado } = await req.json()

    if (!texto || !cct) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
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
        // [sep 2026] Ya NO se guarda el texto crudo (contenido_extraido): nadie lo
        // leía y podía contener nombres. Solo se conserva el análisis en pda_ponderacion.
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
    const auth = await verificarUsuario(req)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin, usuario } = auth
    // programa_analitico.educadora_id guarda el auth_uid, no users.id
    const auth_uid = usuario.auth_uid

    const { searchParams } = new URL(req.url)
    const cct = searchParams.get('cct')

    if (!cct) {
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