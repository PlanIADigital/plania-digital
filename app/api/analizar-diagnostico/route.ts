import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SECCION_HISTORIAL = 'diagnostico_grupal'

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

    // 4. Guardar diagnóstico y PDAs prioritarios en Supabase (comportamiento actual, sin cambios)
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

    // 5. Historial versionado — sección 2.1 (Diagnóstico grupal)
    try {
      // 5.0 documentos_historial.user_id referencia public.users.id (NO auth_uid) —
      // hay que resolver primero el id interno del usuario
      const { data: usuarioRow, error: usuarioError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_uid', auth_uid)
        .maybeSingle()

      if (usuarioError || !usuarioRow) {
        console.error('No se pudo resolver users.id a partir de auth_uid para historial:', usuarioError)
      } else {
        const userIdInterno = usuarioRow.id

        // 5.1 Buscar la versión más alta ya existente para este usuario/sección
        const { data: versionesPrevias } = await supabase
          .from('documentos_historial')
          .select('version_numero')
          .eq('user_id', userIdInterno)
          .eq('seccion', SECCION_HISTORIAL)
          .order('version_numero', { ascending: false })
          .limit(1)

        const nuevaVersion = versionesPrevias && versionesPrevias.length > 0
          ? versionesPrevias[0].version_numero + 1
          : 1

        // 5.2 Desactivar la versión activa anterior (si existe)
        await supabase
          .from('documentos_historial')
          .update({ activo: false })
          .eq('user_id', userIdInterno)
          .eq('seccion', SECCION_HISTORIAL)
          .eq('activo', true)

        // 5.3 Resumen corto legible para mostrar en el historial sin abrir el detalle
        const totalPDAs = Array.isArray(resultado.pdas_sugeridos) ? resultado.pdas_sugeridos.length : 0
        const resumenCorto = totalPDAs > 0
          ? `${totalPDAs} PDAs prioritarios identificados: ${resultado.pdas_sugeridos.slice(0, 2).map((p: any) => p.campo).join(', ')}${totalPDAs > 2 ? '…' : ''}`
          : 'Diagnóstico procesado sin PDAs sugeridos'

        // 5.4 Insertar la nueva versión activa
        const { error: historialError } = await supabase
          .from('documentos_historial')
          .insert({
            user_id: userIdInterno,
            seccion: SECCION_HISTORIAL,
            version_numero: nuevaVersion,
            contenido: JSON.stringify(resultado.pdas_sugeridos),
            resumen: resumenCorto,
            archivo_formato: 'texto',
            activo: true,
          })

        if (historialError) {
          console.error('Error guardando historial de diagnóstico:', historialError)
        }
      }
    } catch (historialCatchError) {
      // El historial es complementario — un fallo aquí nunca debe tumbar la respuesta al usuario
      console.error('Error inesperado en historial de diagnóstico:', historialCatchError)
    }

    return NextResponse.json(resultado)

  } catch (error: unknown) {
    console.error('Error en Agente Diagnóstico:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}