import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SECCION_HISTORIAL = 'pmc'

export async function POST(req: NextRequest) {
  try {
    const { texto, auth_uid } = await req.json()
    if (!texto || !auth_uid) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: `Eres un agente pedagógico especializado en educación preescolar mexicana NEM 2022.
Recibes texto de uno o dos documentos institucionales de un jardín de niños:
- PMC (Programa de Mejora Continua): contiene contexto socioeconómico, cultural y comunitario del entorno escolar.
- Programa Analítico: contiene el diagnóstico pedagógico grupal e institucional.

Tu tarea:
1. Detectar qué tipo(s) de documento(s) están presentes.
2. Extraer SOLO información pedagógicamente relevante para personalizar planeaciones didácticas.
3. Ignorar datos administrativos, nombres de personas, fechas de reuniones, firmas.
4. Nunca incluir nombres reales de alumnos, docentes o directivos.

Responde ÚNICAMENTE con JSON puro, sin markdown ni backticks:
{
  "tipo_detectado": "PMC" | "Programa Analítico" | "Ambos" | "No identificado",
  "contexto_social": "resumen del entorno comunitario y socioeconómico (máx 3 oraciones)",
  "diagnostico_pedagogico": "resumen de necesidades pedagógicas institucionales detectadas (máx 3 oraciones)",
  "areas_oportunidad": ["área 1", "área 2", "área 3"],
  "notas_adicionales": "cualquier otro dato relevante para las planeaciones"
}`,
      messages: [{
        role: 'user',
        content: `Analiza este documento institucional:\n\n${texto.substring(0, 8000)}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(clean)

    const { error } = await supabaseAdmin
      .from('users')
      .update({ diagnostico_escolar: resultado })
      .eq('auth_uid', auth_uid)

    if (error) {
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    // Historial versionado — sección 1.1 (PMC / diagnóstico escolar)
    try {
      // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
      // hay que resolver primero el id interno del usuario
      const { data: usuarioRow, error: usuarioError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('auth_uid', auth_uid)
        .maybeSingle()

      if (usuarioError || !usuarioRow) {
        console.error('No se pudo resolver users.id a partir de auth_uid para historial:', usuarioError)
      } else {
        const userIdInterno = usuarioRow.id

        const { data: versionesPrevias } = await supabaseAdmin
          .from('documentos_historial')
          .select('version_numero')
          .eq('user_id', userIdInterno)
          .eq('seccion', SECCION_HISTORIAL)
          .order('version_numero', { ascending: false })
          .limit(1)

        const nuevaVersion = versionesPrevias && versionesPrevias.length > 0
          ? versionesPrevias[0].version_numero + 1
          : 1

        await supabaseAdmin
          .from('documentos_historial')
          .update({ activo: false })
          .eq('user_id', userIdInterno)
          .eq('seccion', SECCION_HISTORIAL)
          .eq('activo', true)

        const tipoDetectado = resultado.tipo_detectado || 'No identificado'
        const resumenCorto = `${tipoDetectado}: ${resultado.diagnostico_pedagogico || resultado.contexto_social || 'sin resumen disponible'}`.slice(0, 200)

        const { error: historialError } = await supabaseAdmin
          .from('documentos_historial')
          .insert({
            user_id: userIdInterno,
            seccion: SECCION_HISTORIAL,
            version_numero: nuevaVersion,
            contenido: JSON.stringify(resultado),
            resumen: resumenCorto,
            archivo_formato: 'texto',
            activo: true,
          })

        if (historialError) {
          console.error('Error guardando historial de PMC:', historialError)
        }
      }
    } catch (historialCatchError) {
      // El historial es complementario — un fallo aquí nunca debe tumbar la respuesta al usuario
      console.error('Error inesperado en historial de PMC:', historialCatchError)
    }

    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error('Error analizar-diagnostico-escolar:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}